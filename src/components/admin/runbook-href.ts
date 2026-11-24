// Plain module (no "use client") so server and client components can both call it.
export function runbookHref(runbookPath: string) {
  return `https://github.com/IdrisKulubi/playtt/blob/main/${runbookPath}`
}
