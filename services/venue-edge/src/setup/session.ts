import { randomBytes } from "node:crypto"

export interface SetupSessionState {
  token: string
  expiresAt: Date
  locked: boolean
}

export function createSetupSession(ttlMs: number): SetupSessionState {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + ttlMs),
    locked: false,
  }
}

export function isSetupSessionActive(
  session: SetupSessionState | null,
  now = Date.now(),
): boolean {
  if (!session || session.locked) {
    return false
  }

  return session.expiresAt.getTime() > now
}

export function lockSetupSession(session: SetupSessionState): SetupSessionState {
  return {
    ...session,
    locked: true,
  }
}
