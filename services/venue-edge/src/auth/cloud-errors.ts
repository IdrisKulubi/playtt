import { EdgeProtocolError } from "../cloud/client"

export function isDeviceRevokedCloudError(error: unknown): boolean {
  return (
    error instanceof EdgeProtocolError &&
    ((error.code === "DEVICE_REVOKED" && error.status === 403) ||
      (error.code === "DEVICE_UNAUTHENTICATED" && error.status === 401) ||
      (error.code === "DEVICE_NOT_FOUND" &&
        (error.status === 401 || error.status === 404)))
  )
}
