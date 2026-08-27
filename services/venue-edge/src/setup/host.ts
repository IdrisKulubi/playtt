import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { CredentialManager } from "../auth/credential-manager"
import { detectHostSleepRisk } from "../health/host-sleep-risk"
import { safeLog } from "../health/metrics"
import { renderSetupPage } from "./html"
import { LocalNvrError, type LocalNvrManager } from "./local-nvr-manager"
import {
  LocalCameraError,
  type LocalCameraManager,
} from "./local-camera-manager"
import {
  LocalResourceMappingError,
  type LocalResourceMappingManager,
} from "./local-resource-mapping-manager"
import {
  CommissioningError,
  type CommissioningManager,
} from "./commissioning-manager"
import {
  checkSetupSecurity,
  extractSetupToken,
} from "./security"
import {
  createSetupSession,
  isSetupSessionActive,
  lockSetupSession,
  type SetupSessionState,
} from "./session"
import {
  buildSetupStatusPayload,
  resolveSetupEnrollmentStatus,
} from "./status"

export interface SetupHostOptions {
  port: number
  sessionTtlMs: number
  credentialManager: CredentialManager
  dataDir?: string
  localNvrManager?: LocalNvrManager
  localCameraManager?: LocalCameraManager
  localResourceMappingManager?: LocalResourceMappingManager
  commissioningManager?: CommissioningManager
  onConfigurationChanged?: () => Promise<void>
  enroll?: (pairingCode: string) => Promise<unknown>
  host?: string
}

export interface SetupHostHandle {
  port: number
  setupUrl: string
  session: SetupSessionState
  lock(): void
  stop(): Promise<void>
  isLocked(): boolean
}

async function readJsonBody(
  req: import("node:http").IncomingMessage,
): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) {
    return {}
  }

  return JSON.parse(raw) as unknown
}

async function handleLocalNvrRoutes(
  method: string,
  pathname: string,
  body: unknown,
  localNvrManager: LocalNvrManager,
): Promise<Response | null> {
  if (method === "GET" && pathname === "/api/setup/nvrs") {
    const nvrs = await localNvrManager.listPublicNvrs()
    return jsonResponse(200, { nvrs })
  }

  if (method === "POST" && pathname === "/api/setup/nvrs") {
    const payload = (body ?? {}) as Record<string, unknown>
    const nvr = await localNvrManager.createNvr({
      label: payload.label as string,
      vendor: payload.vendor,
      host: payload.host,
      rtspPort: payload.rtspPort,
      playbackPort: payload.playbackPort,
      username: payload.username,
      password: payload.password,
      enabled: payload.enabled as boolean | undefined,
      testChannelKey: payload.testChannelKey,
    })
    return jsonResponse(201, { nvr })
  }

  if (method === "POST" && pathname === "/api/setup/nvrs/discover") {
    const payload = (body ?? {}) as Record<string, unknown>
    const result = await localNvrManager.discover({
      host: payload.host,
      rtspPort: payload.rtspPort,
    })
    return jsonResponse(200, result)
  }

  const patchMatch = pathname.match(/^\/api\/setup\/nvrs\/([^/]+)$/)
  if (patchMatch && method === "PATCH") {
    const payload = (body ?? {}) as Record<string, unknown>
    const updated = await localNvrManager.updateNvr(patchMatch[1], payload)
    if (!updated) {
      return jsonResponse(404, { error: "NVR not found." })
    }
    return jsonResponse(200, { nvr: updated })
  }

  if (patchMatch && method === "DELETE") {
    const deleted = await localNvrManager.deleteNvr(patchMatch[1])
    if (!deleted) {
      return jsonResponse(404, { error: "NVR not found." })
    }
    return jsonResponse(200, { deleted: true })
  }

  const testMatch = pathname.match(/^\/api\/setup\/nvrs\/([^/]+)\/test$/)
  if (testMatch && method === "POST") {
    const tested = await localNvrManager.testNvr(testMatch[1])
    if (!tested) {
      return jsonResponse(404, { error: "NVR not found." })
    }
    return jsonResponse(200, tested)
  }

  return null
}

async function handleLocalCameraRoutes(
  method: string,
  pathname: string,
  body: unknown,
  localCameraManager: LocalCameraManager,
): Promise<Response | null> {
  if (method === "GET" && pathname === "/api/setup/cameras") {
    const cameras = await localCameraManager.listPublicCameras()
    return jsonResponse(200, { cameras })
  }

  if (method === "POST" && pathname === "/api/setup/cameras") {
    const payload = (body ?? {}) as Record<string, unknown>
    const camera = await localCameraManager.createCamera({
      nvrId: payload.nvrId,
      label: payload.label,
      channelKey: payload.channelKey,
      streamProfile: payload.streamProfile,
      codec: payload.codec,
      enabled: payload.enabled as boolean | undefined,
    })
    return jsonResponse(201, { camera })
  }

  const cameraMatch = pathname.match(/^\/api\/setup\/cameras\/([^/]+)$/)
  if (cameraMatch && method === "PATCH") {
    const payload = (body ?? {}) as Record<string, unknown>
    const updated = await localCameraManager.updateCamera(cameraMatch[1], payload)
    if (!updated) {
      return jsonResponse(404, { error: "Camera not found." })
    }
    return jsonResponse(200, { camera: updated })
  }

  if (cameraMatch && method === "DELETE") {
    const deleted = await localCameraManager.deleteCamera(cameraMatch[1])
    if (!deleted) {
      return jsonResponse(404, { error: "Camera not found." })
    }
    return jsonResponse(200, { deleted: true })
  }

  const enumerateMatch = pathname.match(
    /^\/api\/setup\/nvrs\/([^/]+)\/cameras\/enumerate$/,
  )
  if (enumerateMatch && method === "POST") {
    const payload = (body ?? {}) as Record<string, unknown>
    const maxChannels =
      payload.maxChannels === undefined
        ? undefined
        : Number(payload.maxChannels)
    const result = await localCameraManager.enumerateCameras(
      enumerateMatch[1],
      maxChannels ? { maxChannels } : undefined,
    )
    return jsonResponse(200, result)
  }

  return null
}

async function handleCommissioningRoutes(
  method: string,
  pathname: string,
  body: unknown,
  commissioningManager: CommissioningManager,
  enrollmentStatus: Awaited<ReturnType<typeof resolveSetupEnrollmentStatus>>,
): Promise<Response | null> {
  if (method === "GET" && pathname === "/api/setup/commissioning") {
    const checklist = commissioningManager.buildChecklist(
      enrollmentStatus === "enrolled",
    )
    return jsonResponse(200, {
      state: commissioningManager.getState(),
      checklist,
    })
  }

  if (method === "POST" && pathname === "/api/setup/commissioning/test-enabled") {
    const result = await commissioningManager.testEnabledCameras()
    return jsonResponse(200, result)
  }

  if (method === "POST" && pathname === "/api/setup/commissioning/publish") {
    const result = await commissioningManager.publish(
      enrollmentStatus === "enrolled",
    )
    return jsonResponse(200, result)
  }

  if (method === "POST" && pathname === "/api/setup/commissioning/complete") {
    const state = await commissioningManager.complete(
      enrollmentStatus === "enrolled",
    )
    return jsonResponse(200, { state })
  }

  const cameraTestMatch = pathname.match(/^\/api\/setup\/cameras\/([^/]+)\/test$/)
  if (cameraTestMatch && method === "POST") {
    const tested = await commissioningManager.testCamera(cameraTestMatch[1])
    if (!tested) {
      return jsonResponse(404, { error: "Camera not found." })
    }
    return jsonResponse(200, tested)
  }

  const previewPostMatch = pathname.match(
    /^\/api\/setup\/cameras\/([^/]+)\/preview$/,
  )
  if (previewPostMatch && method === "POST") {
    const preview = await commissioningManager.capturePreview(previewPostMatch[1])
    if (!preview) {
      return jsonResponse(404, { error: "Camera not found." })
    }
    return jsonResponse(200, preview)
  }

  const failoverMatch = pathname.match(
    /^\/api\/setup\/resources\/([^/]+)\/failover-drill$/,
  )
  if (failoverMatch && method === "POST") {
    const result = await commissioningManager.runFailoverDrill(failoverMatch[1])
    return jsonResponse(200, { result })
  }

  return null
}

async function handleLocalResourceRoutes(
  method: string,
  pathname: string,
  body: unknown,
  localResourceMappingManager: LocalResourceMappingManager,
): Promise<Response | null> {
  if (method === "GET" && pathname === "/api/setup/resources") {
    const result = localResourceMappingManager.listAuthorizedResources()
    return jsonResponse(200, result)
  }

  const policyMatch = pathname.match(/^\/api\/setup\/resources\/([^/]+)\/policy$/)
  if (policyMatch && method === "GET") {
    const policy = localResourceMappingManager.getResourcePolicy(policyMatch[1])
    if (!policy) {
      return jsonResponse(404, { error: "Resource not found or not authorized." })
    }
    return jsonResponse(200, { policy })
  }

  if (policyMatch && method === "PUT") {
    const payload = (body ?? {}) as Record<string, unknown>
    const policy = localResourceMappingManager.putResourcePolicy(
      policyMatch[1],
      payload,
    )
    return jsonResponse(200, { policy })
  }

  return null
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function isTopologyMutation(method: string, pathname: string): boolean {
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(method)) {
    return false
  }

  if (pathname === "/api/setup/commissioning/test-enabled") {
    return false
  }

  if (/^\/api\/setup\/cameras\/[^/]+\/(?:test|preview)$/.test(pathname)) {
    return false
  }

  if (/^\/api\/setup\/nvrs\/[^/]+\/test$/.test(pathname)) {
    return false
  }

  if (/^\/api\/setup\/resources\/[^/]+\/failover-drill$/.test(pathname)) {
    return false
  }

  return (
    pathname.startsWith("/api/setup/nvrs") ||
    pathname.startsWith("/api/setup/cameras") ||
    pathname.startsWith("/api/setup/resources")
  )
}

function textResponse(status: number, body: string, contentType: string): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  })
}

async function sendNodeResponse(
  nodeRes: import("node:http").ServerResponse,
  response: Response,
): Promise<void> {
  nodeRes.statusCode = response.status
  response.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value)
  })
  const body = await response.text()
  nodeRes.end(body)
}

async function sendNodeFile(
  nodeRes: import("node:http").ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  const { createReadStream } = await import("node:fs")
  nodeRes.statusCode = 200
  nodeRes.setHeader("content-type", contentType)
  nodeRes.setHeader("cache-control", "no-store")
  createReadStream(filePath).pipe(nodeRes)
}

export async function startSetupHost(
  options: SetupHostOptions,
): Promise<SetupHostHandle> {
  const bindHost = options.host ?? "127.0.0.1"
  if (bindHost !== "127.0.0.1") {
    throw new Error("Setup host must bind to 127.0.0.1 only.")
  }

  let session = createSetupSession(options.sessionTtlMs)
  let server: Server | null = null

  const getPort = (): number => {
    if (!server) {
      return options.port
    }

    const address = server.address()
    if (address && typeof address === "object") {
      return (address as AddressInfo).port
    }

    return options.port
  }

  const buildSetupUrl = (): string => {
    const port = getPort()
    return `http://127.0.0.1:${port}/?setup_token=${session.token}`
  }

  const handleRequest = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
  ): Promise<void> => {
    try {
      const port = getPort()
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
      const token = extractSetupToken(req, url)
      const sessionActive = isSetupSessionActive(session)
      const method = req.method?.toUpperCase() ?? "GET"

      const security = checkSetupSecurity({
        req,
        port,
        token,
        expectedToken: session.token,
        sessionActive,
        requireJsonContentType: method === "POST" || method === "PUT" || method === "PATCH",
      })

      if (!security.ok) {
        await sendNodeResponse(
          res,
          jsonResponse(security.status, { error: security.message }),
        )
        return
      }

      if (method === "GET" && url.pathname === "/api/setup/status") {
        const enrollmentStatus = await resolveSetupEnrollmentStatus(
          options.credentialManager,
        )
        const hostSleepRisk = await detectHostSleepRisk()
        const payload = buildSetupStatusPayload({
          enrollmentStatus,
          setupLocked: session.locked,
          expiresAt: session.expiresAt,
          hostSleepRisk,
        })
        await sendNodeResponse(res, jsonResponse(200, payload))
        return
      }

      if (method === "POST" && url.pathname === "/api/setup/lock") {
        session = lockSetupSession(session)
        safeLog("info", "VenueEdge setup host locked")
        const enrollmentStatus = await resolveSetupEnrollmentStatus(
          options.credentialManager,
        )
        const hostSleepRisk = await detectHostSleepRisk()
        const payload = buildSetupStatusPayload({
          enrollmentStatus,
          setupLocked: true,
          expiresAt: session.expiresAt,
          hostSleepRisk,
        })
        await sendNodeResponse(res, jsonResponse(200, payload))
        return
      }

      if (method === "POST" && url.pathname === "/api/setup/enroll") {
        if (!options.enroll) {
          await sendNodeResponse(
            res,
            jsonResponse(409, { error: "Enrollment is unavailable in this setup session." }),
          )
          return
        }

        const payload = (await readJsonBody(req)) as Record<string, unknown>
        const pairingCode =
          typeof payload.pairingCode === "string" ? payload.pairingCode.trim() : ""
        if (!pairingCode || pairingCode.length > 32) {
          await sendNodeResponse(
            res,
            jsonResponse(400, { error: "Enter a valid VenueEdge pairing code." }),
          )
          return
        }

        const enrolled = await options.enroll(pairingCode)
        await sendNodeResponse(res, jsonResponse(200, { enrolled }))
        return
      }

      let jsonBody: unknown = null
      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH"
      ) {
        jsonBody = await readJsonBody(req)
      }

      const previewFileMatch = url.pathname.match(
        /^\/api\/setup\/cameras\/([^/]+)\/preview\.mp4$/,
      )
      if (previewFileMatch && method === "GET" && options.commissioningManager) {
        const previewPath = options.commissioningManager.getPreviewPath(
          previewFileMatch[1],
        )
        if (!previewPath) {
          await sendNodeResponse(res, jsonResponse(404, { error: "Preview not found." }))
          return
        }
        await sendNodeFile(res, previewPath, "video/mp4")
        return
      }

      if (options.commissioningManager) {
        const enrollmentStatus = await resolveSetupEnrollmentStatus(
          options.credentialManager,
        )
        try {
          const commissioningResponse = await handleCommissioningRoutes(
            method,
            url.pathname,
            jsonBody,
            options.commissioningManager,
            enrollmentStatus,
          )
          if (commissioningResponse) {
            if (
              options.onConfigurationChanged &&
              method === "POST" &&
              url.pathname === "/api/setup/commissioning/complete" &&
              commissioningResponse.ok
            ) {
              await options.onConfigurationChanged()
            }
            await sendNodeResponse(res, commissioningResponse)
            return
          }
        } catch (error) {
          if (error instanceof CommissioningError) {
            const status =
              error.code === "not_enrolled" ? 409 : 400
            await sendNodeResponse(
              res,
              jsonResponse(status, { error: error.message, code: error.code }),
            )
            return
          }
          throw error
        }
      }

      if (options.localNvrManager) {
        try {
          const nvrResponse = await handleLocalNvrRoutes(
            method,
            url.pathname,
            jsonBody,
            options.localNvrManager,
          )
          if (nvrResponse) {
            if (
              options.onConfigurationChanged &&
              isTopologyMutation(method, url.pathname) &&
              nvrResponse.ok
            ) {
              await options.onConfigurationChanged()
            }
            await sendNodeResponse(res, nvrResponse)
            return
          }
        } catch (error) {
          if (error instanceof LocalNvrError) {
            await sendNodeResponse(
              res,
              jsonResponse(400, { error: error.message, code: error.code }),
            )
            return
          }
          throw error
        }
      }

      if (options.localCameraManager) {
        try {
          const cameraResponse = await handleLocalCameraRoutes(
            method,
            url.pathname,
            jsonBody,
            options.localCameraManager,
          )
          if (cameraResponse) {
            if (
              options.onConfigurationChanged &&
              isTopologyMutation(method, url.pathname) &&
              cameraResponse.ok
            ) {
              await options.onConfigurationChanged()
            }
            await sendNodeResponse(res, cameraResponse)
            return
          }
        } catch (error) {
          if (error instanceof LocalCameraError) {
            await sendNodeResponse(
              res,
              jsonResponse(400, { error: error.message, code: error.code }),
            )
            return
          }
          throw error
        }
      }

      if (options.localResourceMappingManager) {
        try {
          const resourceResponse = await handleLocalResourceRoutes(
            method,
            url.pathname,
            jsonBody,
            options.localResourceMappingManager,
          )
          if (resourceResponse) {
            if (
              options.onConfigurationChanged &&
              isTopologyMutation(method, url.pathname) &&
              resourceResponse.ok
            ) {
              await options.onConfigurationChanged()
            }
            await sendNodeResponse(res, resourceResponse)
            return
          }
        } catch (error) {
          if (error instanceof LocalResourceMappingError) {
            await sendNodeResponse(
              res,
              jsonResponse(400, { error: error.message, code: error.code }),
            )
            return
          }
          throw error
        }
      }

      if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        const enrollmentStatus = await resolveSetupEnrollmentStatus(
          options.credentialManager,
        )
        const html = renderSetupPage({
          enrollmentStatus,
          setupLocked: session.locked,
          expiresAt: session.expiresAt.toISOString(),
          setupToken: session.token,
        })
        await sendNodeResponse(res, textResponse(200, html, "text/html; charset=utf-8"))
        return
      }

      await sendNodeResponse(res, jsonResponse(404, { error: "Not found." }))
    } catch (error) {
      safeLog("error", "Setup host request failed", {
        message: error instanceof Error ? error.message : String(error),
      })
      await sendNodeResponse(
        res,
        jsonResponse(500, { error: "Internal setup host error." }),
      )
    }
  }

  server = createServer((req, res) => {
    void handleRequest(req, res)
  })

  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject)
    server!.listen(options.port, bindHost, () => {
      server!.off("error", reject)
      resolve()
    })
  })

  const setupUrl = buildSetupUrl()
  safeLog("info", "VenueEdge setup host listening", {
    bindHost,
    port: getPort(),
    setupUrl: "[redacted]",
    expiresAt: session.expiresAt.toISOString(),
  })

  if (options.dataDir) {
    try {
      await mkdir(options.dataDir, { recursive: true })
      await writeFile(
        join(options.dataDir, "setup-url.txt"),
        `${setupUrl}\n`,
        { mode: 0o600 },
      )
    } catch (error) {
      safeLog("warn", "Failed to write setup-url.txt", {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    port: getPort(),
    setupUrl,
    session,
    lock() {
      session = lockSetupSession(session)
    },
    isLocked() {
      return session.locked
    },
    async stop() {
      if (!server) {
        return
      }

      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
      server = null
    },
  }
}

export async function stopSetupHost(handle: SetupHostHandle): Promise<void> {
  await handle.stop()
}
