import { readFileSync } from "node:fs";
import { importPKCS8, SignJWT } from "jose";

const clientId = process.env.APPLE_CLIENT_ID;
const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const privateKey = (
  process.env.APPLE_PRIVATE_KEY ||
  readFileSync(process.argv[2], "utf8")
).replace(/\\n/g, "\n");

const key = await importPKCS8(privateKey, "ES256");
const now = Math.floor(Date.now() / 1000);

const secret = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId })
  .setIssuer(teamId)
  .setSubject(clientId)
  .setAudience("https://appleid.apple.com")
  .setIssuedAt(now)
  .setExpirationTime(now + 180 * 24 * 60 * 60)
  .sign(key);

console.log(secret);