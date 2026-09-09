import assert from "node:assert/strict"
import test from "node:test"

import { diagnoseCodecProbe } from "../src/setup/nvr-probe.ts"

test("camera probe reports the concrete failure and redacts RTSP credentials", () => {
  const diagnostic = diagnoseCodecProbe({
    codec: null,
    compatible: false,
    raw: "rtsp://playtt_edge:private-password@192.168.0.82/live/1 Invalid data found when processing input",
    exitCode: 1,
    timedOut: false,
    cancelled: false,
  })

  assert.equal(diagnostic.code, "ffmpeg_failed")
  assert.match(diagnostic.summary, /exit code 1/)
  assert.match(diagnostic.output ?? "", /Invalid data found/)
  assert.doesNotMatch(diagnostic.output ?? "", /private-password/)
})

test("camera probe distinguishes timeout from an unsupported codec", () => {
  const timeout = diagnoseCodecProbe({ codec: null, compatible: false, raw: "", exitCode: null, timedOut: true, cancelled: false })
  const codec = diagnoseCodecProbe({ codec: "hevc", compatible: false, raw: "Video: hevc", exitCode: 0, timedOut: false, cancelled: false })

  assert.equal(timeout.code, "probe_timed_out")
  assert.equal(codec.code, "codec_incompatible")
  assert.match(codec.summary, /HEVC/)
})
