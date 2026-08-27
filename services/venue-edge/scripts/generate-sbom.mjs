import { readFile, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { pathToFileURL } from "node:url"

export async function generateSbom({ pinsPath, packagePath, outputPath, createdAt }) {
  const [pins, packageJson] = await Promise.all([
    readFile(pinsPath, "utf8").then(JSON.parse),
    readFile(packagePath, "utf8").then(JSON.parse),
  ])
  const packages = [
    { name: packageJson.name, versionInfo: pins.packageVersion, downloadLocation: "NOASSERTION", licenseConcluded: "NOASSERTION" },
    ...["node", "ffmpeg", "winsw"].map((name) => ({
      name,
      versionInfo: pins[name].version,
      downloadLocation: pins[name].url,
      checksums: [{ algorithm: "SHA256", checksumValue: pins[name].sha256 }],
      licenseConcluded: "NOASSERTION",
    })),
  ].map((item, index) => ({
    SPDXID: `SPDXRef-Package-${index + 1}`,
    filesAnalyzed: false,
    copyrightText: "NOASSERTION",
    ...item,
  }))

  const document = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `PlayTT-VenueEdge-${pins.packageVersion}`,
    documentNamespace: `https://playtt.app/sbom/venue-edge/${encodeURIComponent(pins.packageVersion)}`,
    creationInfo: { created: createdAt, creators: ["Organization: PlayTT", "Tool: venue-edge-packager"] },
    packages,
    relationships: packages.slice(1).map((pkg) => ({
      spdxElementId: packages[0].SPDXID,
      relationshipType: "DEPENDS_ON",
      relatedSpdxElement: pkg.SPDXID,
    })),
  }
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8")
  return document
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [pinsPath, packagePath, outputPath, createdAt] = process.argv.slice(2)
  if (!pinsPath || !packagePath || !outputPath || !createdAt) {
    throw new Error(`Usage: ${basename(process.argv[1])} <pins.json> <package.json> <output> <createdAt>`)
  }
  await generateSbom({ pinsPath, packagePath, outputPath, createdAt })
}
