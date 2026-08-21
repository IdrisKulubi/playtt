import { runFfmpeg } from "./runner"

export interface CodecProbeResult {
  codec: string | null
  compatible: boolean
  raw: string
}

export async function probeCodec(inputUrl: string): Promise<CodecProbeResult> {
  const result = await runFfmpeg({
    args: ["-i", inputUrl, "-t", "0.1", "-f", "null", "-"],
    timeoutMs: 15_000,
  })

  const combined = `${result.stdout}\n${result.stderr}`
  const codecMatch = combined.match(/Video:\s+(\w+)/)
  const codec = codecMatch?.[1] ?? null
  const compatible = codec === "h264"

  return {
    codec,
    compatible,
    raw: combined,
  }
}
