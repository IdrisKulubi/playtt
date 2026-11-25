// Renders 1920x1080 stills of each TV concept.
// Usage: node docs/design/tv-concepts/render-stills.mjs [time=40] [concepts=1,2,3,4,5]
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, "stills")
mkdirSync(outDir, { recursive: true })

const time = process.argv[2] ?? "40"
const concepts = (process.argv[3] ?? "1,2,3,4,5").split(",")
const page_url = pathToFileURL(join(here, "concept.html")).href

const browser = await chromium.launch({ channel: "msedge" })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
for (const c of concepts) {
  await page.goto(`${page_url}?c=${c}&t=${time}`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  const file = join(outDir, `concept-${c}.png`)
  await page.screenshot({ path: file })
  console.log(file)
}
await browser.close()
