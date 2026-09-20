// The packaged FFmpeg build is LGPL and therefore does not ship GPL libx264.
// OpenH264 is bundled and produces browser/TV-compatible H.264 MP4 output.
export const H264_TRANSCODE_OUTPUT_ARGS = [
  "-c:v",
  "libopenh264",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "high",
  "-b:v",
  "2500k",
  "-maxrate",
  "3500k",
  "-bufsize",
  "5000k",
] as const
