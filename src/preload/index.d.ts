import type { CampusLoginApi } from '../shared/types'

declare global {
  interface Window {
    campusLogin: CampusLoginApi
  }
}
