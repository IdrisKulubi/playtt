import test from "node:test"
import assert from "node:assert/strict"

import { H264_TRANSCODE_OUTPUT_ARGS } from "../src/ffmpeg/h264-output.ts"

test("packaged transcode fallback uses the LGPL OpenH264 encoder", () => {
  assert.equal(H264_TRANSCODE_OUTPUT_ARGS.includes("libopenh264"), true)
  assert.equal(H264_TRANSCODE_OUTPUT_ARGS.includes("libx264"), false)
  assert.equal(H264_TRANSCODE_OUTPUT_ARGS.includes("yuv420p"), true)
})
