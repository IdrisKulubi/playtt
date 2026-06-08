import { importPKCS8, SignJWT } from "jose";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function normalizeApplePrivateKey(raw: string) {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

export async function generateAppleClientSecret(): Promise<string> {
  const clientId = requireEnv("APPLE_CLIENT_ID");
  const teamId = requireEnv("APPLE_TEAM_ID");
  const keyId = requireEnv("APPLE_KEY_ID");
  const privateKey = normalizeApplePrivateKey(requireEnv("APPLE_PRIVATE_KEY"));

  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

/** Prefer dynamic JWT from .p8; fall back to APPLE_CLIENT_SECRET for hosted envs. */
export async function resolveAppleClientSecret(): Promise<string | null> {
  const staticSecret = process.env.APPLE_CLIENT_SECRET?.trim();
  const privateKey = process.env.APPLE_PRIVATE_KEY?.trim();

  if (privateKey) {
    try {
      return await generateAppleClientSecret();
    } catch (error) {
      console.error(
        "[AUTH] Failed to generate Apple client secret from APPLE_PRIVATE_KEY:",
        error,
      );
      if (staticSecret) {
        console.warn(
          "[AUTH] Falling back to APPLE_CLIENT_SECRET env var for Apple sign-in.",
        );
        return staticSecret;
      }
      return null;
    }
  }

  if (staticSecret) {
    return staticSecret;
  }

  return null;
}
