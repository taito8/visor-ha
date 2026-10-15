/// <reference types="vite/client" />
import type { VisorApi } from '@shared/types'

declare global {
  interface Window {
    visor: VisorApi
  }
}
