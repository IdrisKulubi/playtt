import { EdgeProtocolError } from "../cloud/client"

export function isDeviceRevokedCloudError(error: unknown): boolean {
  return (
    error instanceof EdgeProtocolError &&
    error.code === "DEVICE_REVOKED" &&
    error.status === 403
  )
}
