#Requires -Version 5.1
param(
  [string] $OutputDir = "",
  [switch] $SkipSetupExe,
  [switch] $AllowUnsignedDevelopment
)

$ErrorActionPreference = "Stop"

$packagingRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serviceRoot = Split-Path -Parent $packagingRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $serviceRoot)

if (-not $OutputDir) {
  $OutputDir = Join-Path $serviceRoot "dist\windows-bundle"
}

$pinsPath = Join-Path $packagingRoot "pins.json"
$pins = Get-Content $pinsPath -Raw | ConvertFrom-Json
$version = $pins.packageVersion
$sourceDateEpoch = if ($env:SOURCE_DATE_EPOCH) { [long]$env:SOURCE_DATE_EPOCH } else { 0 }
$builtAt = [DateTimeOffset]::FromUnixTimeSeconds($sourceDateEpoch).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
$isSignedBuild = -not $AllowUnsignedDevelopment

foreach ($dependency in @("node", "ffmpeg", "winsw")) {
  $pin = $pins.$dependency
  if (-not $pin.url.StartsWith("https://") -or $pin.url -match "/latest/" -or $pin.url -match "-latest-") {
    throw "$dependency must use an immutable HTTPS download URL"
  }
  if ($pin.sha256 -notmatch "^[a-fA-F0-9]{64}$") {
    throw "$dependency must have a non-empty SHA-256 pin"
  }
}

$stagingRoot = Join-Path $OutputDir "staging"
$artifactRoot = Join-Path $OutputDir "artifacts"
$downloadsRoot = Join-Path $OutputDir "downloads"

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $stagingRoot, $artifactRoot
New-Item -ItemType Directory -Path $stagingRoot, $artifactRoot, $downloadsRoot -Force | Out-Null

function Get-FileSha256Hex {
  param([string] $Path)
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Download-IfMissing {
  param(
    [string] $Url,
    [string] $Destination,
    [string] $ExpectedSha256
  )

  if (Test-Path $Destination) {
    Write-Host "Using cached download: $Destination"
  } else {
    Write-Host "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  }

  if ($ExpectedSha256 -notmatch "^[a-fA-F0-9]{64}$") {
    throw "A valid expected SHA-256 is required for $Url"
  }
  $actual = Get-FileSha256Hex -Path $Destination
  if ($actual -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $Destination. Expected $ExpectedSha256 got $actual"
  }
}

Push-Location $serviceRoot
try {
  if (-not (Test-Path "node_modules")) {
    pnpm install --frozen-lockfile
  }
  pnpm run build
} finally {
  Pop-Location
}

$installRoot = Join-Path $stagingRoot "PlayTTVenueEdge"
@("app", "node", "ffmpeg", "licenses") | ForEach-Object {
  New-Item -ItemType Directory -Path (Join-Path $installRoot $_) -Force | Out-Null
}

Copy-Item (Join-Path $serviceRoot "dist\index.js") (Join-Path $installRoot "app\index.js") -Force
if (Test-Path (Join-Path $serviceRoot "dist\index.js.map")) {
  Copy-Item (Join-Path $serviceRoot "dist\index.js.map") (Join-Path $installRoot "app\index.js.map") -Force
}

$versionJson = @{
  version = $version
  channel = "development"
  minimumAgentVersion = "0.1.0"
  signed = $isSignedBuild
  builtAt = $builtAt
}
$versionJsonPath = Join-Path $installRoot "version.json"
$versionJson | ConvertTo-Json -Depth 4 | Set-Content -Path $versionJsonPath -Encoding UTF8

Copy-Item (Join-Path $packagingRoot "THIRD-PARTY-NOTICES.md") (Join-Path $installRoot "licenses\THIRD-PARTY-NOTICES.md") -Force
Copy-Item (Join-Path $packagingRoot "acl.ps1") (Join-Path $installRoot "install-acl.ps1") -Force

$nodeZip = Join-Path $downloadsRoot "node-$($pins.node.version)-win-x64.zip"
Download-IfMissing -Url $pins.node.url -Destination $nodeZip -ExpectedSha256 $pins.node.sha256
Expand-Archive -Path $nodeZip -DestinationPath (Join-Path $downloadsRoot "node-expand") -Force
Copy-Item (Join-Path $downloadsRoot "node-expand\node-v$($pins.node.version)-win-x64\node.exe") (Join-Path $installRoot "node\node.exe") -Force

$ffmpegZip = Join-Path $downloadsRoot "ffmpeg-$($pins.ffmpeg.version)-win64-lgpl.zip"
Download-IfMissing -Url $pins.ffmpeg.url -Destination $ffmpegZip -ExpectedSha256 $pins.ffmpeg.sha256
Expand-Archive -Path $ffmpegZip -DestinationPath (Join-Path $downloadsRoot "ffmpeg-expand") -Force
$ffmpegBin = Get-ChildItem -Path (Join-Path $downloadsRoot "ffmpeg-expand") -Recurse -Filter ffmpeg.exe | Select-Object -First 1
$ffprobeBin = Get-ChildItem -Path (Join-Path $downloadsRoot "ffmpeg-expand") -Recurse -Filter ffprobe.exe | Select-Object -First 1
if (-not $ffmpegBin -or -not $ffprobeBin) {
  throw "FFmpeg bundle is missing ffmpeg.exe or ffprobe.exe"
}
Copy-Item $ffmpegBin.FullName (Join-Path $installRoot "ffmpeg\ffmpeg.exe") -Force
Copy-Item $ffprobeBin.FullName (Join-Path $installRoot "ffmpeg\ffprobe.exe") -Force

$winswExe = Join-Path $downloadsRoot "WinSW-x64.exe"
Download-IfMissing -Url $pins.winsw.url -Destination $winswExe -ExpectedSha256 $pins.winsw.sha256
Copy-Item $winswExe (Join-Path $installRoot "PlayTTVenueEdge.exe") -Force
Copy-Item (Join-Path $packagingRoot "winsw\PlayTTVenueEdge.xml") (Join-Path $installRoot "PlayTTVenueEdge.xml") -Force

$executablePaths = @(
  (Join-Path $installRoot "node\node.exe"),
  (Join-Path $installRoot "ffmpeg\ffmpeg.exe"),
  (Join-Path $installRoot "ffmpeg\ffprobe.exe"),
  (Join-Path $installRoot "PlayTTVenueEdge.exe")
)
& (Join-Path $packagingRoot "sign.ps1") -ArtifactPath $executablePaths -AllowUnsignedDevelopment:$AllowUnsignedDevelopment

& node `
  (Join-Path $serviceRoot "scripts\generate-sbom.mjs") `
  $pinsPath `
  (Join-Path $serviceRoot "package.json") `
  (Join-Path $installRoot "licenses\SBOM.spdx.json") `
  $builtAt
if ($LASTEXITCODE -ne 0) {
  throw "SBOM generation failed"
}

$checksumLines = @()
Get-ChildItem -Path $installRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
  $hash = Get-FileHash -Algorithm SHA256 -Path $_.FullName
  $relative = $_.FullName.Substring($installRoot.Length + 1).Replace("\", "/")
  $checksumLines += "$($hash.Hash.ToLowerInvariant())  $relative"
}
$checksumLines | Set-Content (Join-Path $installRoot "SHA256SUMS") -Encoding ASCII

$manifest = @{
  version = $version
  channel = "development"
  signed = $isSignedBuild
  artifacts = @{
    bundleRoot = "PlayTTVenueEdge"
    setupExe = "PlayTTVenueEdge-Setup-$version.exe"
  }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $artifactRoot "manifest.json") -Encoding UTF8

if (-not $SkipSetupExe) {
  $iscc = $env:INNO_SETUP_COMPILER
  if (-not $iscc) {
    $iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
  }

  if (Test-Path $iscc) {
    & $iscc (Join-Path $packagingRoot "inno\venue-edge.iss") "/DMyAppVersion=$version" "/DStagingRoot=$stagingRoot" "/DOutputDir=$artifactRoot"
    $setupExe = Join-Path $artifactRoot "PlayTTVenueEdge-Setup-$version.exe"
    if (-not (Test-Path $setupExe)) {
      throw "Inno Setup completed without producing $setupExe"
    }
    & (Join-Path $packagingRoot "sign.ps1") -ArtifactPath $setupExe -AllowUnsignedDevelopment:$AllowUnsignedDevelopment
    $setupHash = Get-FileSha256Hex -Path $setupExe
    "$setupHash  PlayTTVenueEdge-Setup-$version.exe" | Add-Content (Join-Path $artifactRoot "SHA256SUMS")
  } else {
    throw "Inno Setup compiler not found. Set INNO_SETUP_COMPILER or use -SkipSetupExe for an explicit bundle-only build."
  }
}

Write-Host "VenueEdge Windows bundle ready under $OutputDir"
