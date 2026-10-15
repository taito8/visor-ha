import { describeError, once, watchVideo, type PlayerFactory } from './types'

/** Respuesta de `camera/webrtc/get_client_config`. */
interface ClientConfig {
  configuration?: RTCConfiguration
  dataChannel?: string
  /** Algunas cámaras quieren todos los candidatos ICE dentro de la oferta, sin trickle. */
  getCandidatesUpfront?: boolean
}

/** Mensajes que HA manda durante la negociación iniciada con `camera/webrtc/offer`. */
type OfferEvent =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit | string }
  | { type: 'error'; code: string; message: string }

/** Tiempo máximo para que la conexión quede establecida. */
const CONNECT_TIMEOUT_MS = 15_000
/** Tiempo máximo, ya conectado, para que llegue la primera imagen. */
const FIRST_FRAME_TIMEOUT_MS = 10_000
/** Cuánto se tolera el estado "disconnected" antes de reconectar (a veces se recupera solo). */
const DISCONNECTED_GRACE_MS = 5_000

function waitIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const timer = setTimeout(resolve, timeoutMs)
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer)
        resolve()
      }
    })
  })
}

/**
 * WebRTC usando el soporte nativo de HA (go2rtc integrado): se manda una oferta SDP por el
 * websocket y HA responde con la sesión, la respuesta SDP y sus candidatos ICE.
 */
export const startWebRtc: PlayerFactory = (container, ctx, cb) => {
  let destroyed = false
  let playing = false
  let pc: RTCPeerConnection | null = null
  let unsubscribe: (() => Promise<void>) | null = null
  let firstFrameTimer: ReturnType<typeof setTimeout> | undefined
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined
  const fail = once(cb.onError)

  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  container.append(video)
  const stopWatch = watchVideo(
    video,
    () => {
      playing = true
      clearTimeout(firstFrameTimer)
      cb.onPlaying()
    },
    fail
  )

  let connected = false
  const connectTimer = setTimeout(() => {
    if (!connected) fail('no se pudo establecer la conexión WebRTC')
  }, CONNECT_TIMEOUT_MS)

  void (async () => {
    try {
      let config: ClientConfig = {}
      try {
        config = await ctx.conn.sendMessagePromise<ClientConfig>({
          type: 'camera/webrtc/get_client_config',
          entity_id: ctx.entityId
        })
      } catch {
        // Sin configuración de cliente se usa la de por defecto.
      }
      if (destroyed) return

      const peer = new RTCPeerConnection(config.configuration ?? {})
      pc = peer
      if (config.dataChannel) peer.createDataChannel(config.dataChannel)
      peer.addTransceiver('audio', { direction: 'recvonly' })
      peer.addTransceiver('video', { direction: 'recvonly' })

      const remoteStream = new MediaStream()
      peer.addEventListener('track', (event) => {
        remoteStream.addTrack(event.track)
        if (video.srcObject !== remoteStream) video.srcObject = remoteStream
        video.play().catch(() => {})
      })

      peer.addEventListener('connectionstatechange', () => {
        switch (peer.connectionState) {
          case 'connected':
            connected = true
            clearTimeout(connectTimer)
            clearTimeout(disconnectTimer)
            if (!playing) {
              clearTimeout(firstFrameTimer)
              firstFrameTimer = setTimeout(() => {
                if (!playing) fail('conectó pero no llegó video')
              }, FIRST_FRAME_TIMEOUT_MS)
            }
            break
          case 'disconnected':
            clearTimeout(disconnectTimer)
            disconnectTimer = setTimeout(() => fail('se cortó la conexión WebRTC'), DISCONNECTED_GRACE_MS)
            break
          case 'failed':
            fail(connected ? 'se cortó la conexión WebRTC' : 'la conexión WebRTC falló (red)')
            break
        }
      })

      // Los candidatos propios se mandan a HA cuando ya conocemos el id de sesión.
      let sessionId: string | null = null
      const pendingLocal: RTCIceCandidateInit[] = []
      const pendingRemote: RTCIceCandidateInit[] = []
      const sendCandidate = (candidate: RTCIceCandidateInit) => {
        ctx.conn
          .sendMessagePromise({ type: 'camera/webrtc/candidate', entity_id: ctx.entityId, session_id: sessionId, candidate })
          .catch((err) => console.info(`[${ctx.entityId}] WebRTC: HA no aceptó un candidato ICE: ${describeError(err)}`))
      }
      const addRemote = (candidate: RTCIceCandidateInit) => {
        peer.addIceCandidate(candidate).catch((err) => console.info(`[${ctx.entityId}] WebRTC: candidato remoto inválido: ${describeError(err)}`))
      }

      if (!config.getCandidatesUpfront) {
        peer.addEventListener('icecandidate', (event) => {
          if (!event.candidate) return
          const candidate = event.candidate.toJSON()
          if (sessionId) sendCandidate(candidate)
          else pendingLocal.push(candidate)
        })
      }

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      if (config.getCandidatesUpfront) await waitIceGathering(peer, 5_000)
      if (destroyed) return

      const handleEvent = async (event: OfferEvent) => {
        if (destroyed) return
        try {
          switch (event.type) {
            case 'session':
              sessionId = event.session_id
              pendingLocal.splice(0).forEach(sendCandidate)
              break
            case 'answer':
              await peer.setRemoteDescription({ type: 'answer', sdp: event.answer })
              pendingRemote.splice(0).forEach(addRemote)
              break
            case 'candidate': {
              const candidate =
                typeof event.candidate === 'string' ? { candidate: event.candidate, sdpMLineIndex: 0 } : event.candidate
              if (peer.remoteDescription) addRemote(candidate)
              else pendingRemote.push(candidate)
              break
            }
            case 'error':
              fail(`HA: ${event.message}`)
              break
          }
        } catch (err) {
          fail(describeError(err))
        }
      }

      const unsub = await ctx.conn.subscribeMessage<OfferEvent>(
        (event) => void handleEvent(event),
        {
          type: 'camera/webrtc/offer',
          entity_id: ctx.entityId,
          offer: config.getCandidatesUpfront ? peer.localDescription!.sdp : offer.sdp!
        },
        // Una oferta vieja no sirve después de una reconexión: el tile arranca una sesión nueva.
        { resubscribe: false }
      )
      if (destroyed) unsub().catch(() => {})
      else unsubscribe = unsub
    } catch (err) {
      if (!destroyed) fail(describeError(err))
    }
  })()

  return {
    destroy() {
      destroyed = true
      clearTimeout(connectTimer)
      clearTimeout(firstFrameTimer)
      clearTimeout(disconnectTimer)
      stopWatch()
      unsubscribe?.().catch(() => {})
      pc?.close()
      video.srcObject = null
      video.remove()
    }
  }
}
