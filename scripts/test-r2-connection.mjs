import { randomUUID } from "node:crypto"
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function requireEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name}. Run with: node --env-file=.env.local scripts/test-r2-connection.mjs`)
  }

  return value
}

function createClient() {
  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ??
    `https://${accountId}.r2.cloudflarestorage.com`

  return {
    client: new S3Client({
      region: process.env.R2_REGION?.trim() || "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }),
    endpoint,
    accountId,
  }
}

function redact(value) {
  if (!value || value.length < 8) {
    return "(set)"
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

async function main() {
  const bucket = requireEnv("R2_BUCKET")
  const { client, endpoint, accountId } = createClient()
  const derivedEndpoint = `https://${accountId}.r2.cloudflarestorage.com`

  console.log("R2 connection test")
  console.log(`  bucket: ${bucket}`)
  console.log(`  account: ${accountId}`)
  console.log(`  endpoint: ${endpoint}`)
  console.log(`  access key: ${redact(process.env.R2_ACCESS_KEY_ID)}`)

  if (endpoint !== derivedEndpoint) {
    console.warn(
      `  warning: R2_ENDPOINT differs from https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    )
    console.warn(`  derived endpoint would be: ${derivedEndpoint}`)
  }

  console.log("\n1. HeadBucket")
  await client.send(new HeadBucketCommand({ Bucket: bucket }))
  console.log("   ok")

  console.log("\n2. ListObjectsV2 (prefix __playtt/)")
  const listed = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "__playtt/",
      MaxKeys: 5,
    }),
  )
  console.log(`   ok (${listed.KeyCount ?? 0} object(s) under prefix)`)

  const testKey = `__playtt/connection-test-${randomUUID()}.txt`
  const body = `playtt-r2-test ${new Date().toISOString()}`

  console.log("\n3. PutObject")
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: body,
      ContentType: "text/plain",
    }),
  )
  console.log(`   ok (${testKey})`)

  console.log("\n4. HeadObject")
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }),
  )
  console.log(`   ok (size=${head.ContentLength ?? 0}, type=${head.ContentType ?? "unknown"})`)

  console.log("\n5. Presigned GET URL")
  const signedUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      ContentType: "text/plain",
    }),
    { expiresIn: 60 },
  )
  console.log(`   ok (${signedUrl.slice(0, 72)}…)`)

  console.log("\n6. DeleteObject (cleanup)")
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }),
  )
  console.log("   ok")

  console.log("\nR2 token and bucket access verified successfully.")
}

main().catch((error) => {
  console.error("\nR2 connection test failed.")
  if (error?.name) {
    console.error(`  name: ${error.name}`)
  }
  if (error?.$metadata?.httpStatusCode) {
    console.error(`  http: ${error.$metadata.httpStatusCode}`)
  }
  console.error(`  message: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
