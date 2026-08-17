import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

/**
 * @typedef {Object} DeviceCredentials
 * @property {string} deviceId
 * @property {string} secret
 * @property {number} credentialVersion
 * @property {string} hardwareUid
 */

/**
 * @param {string} statePath
 */
export function createCredentialStore(statePath) {
  /** @type {DeviceCredentials | null} */
  let memory = null

  return {
    load() {
      if (memory) {
        return memory
      }

      if (!existsSync(statePath)) {
        return null
      }

      memory = JSON.parse(readFileSync(statePath, "utf8"))
      return memory
    },

    /** @param {DeviceCredentials} credentials */
    save(credentials) {
      mkdirSync(dirname(statePath), { recursive: true })
      memory = credentials
      writeFileSync(statePath, `${JSON.stringify(credentials, null, 2)}\n`)
    },

    clear() {
      memory = null

      if (existsSync(statePath)) {
        unlinkSync(statePath)
      }
    },
  }
}
