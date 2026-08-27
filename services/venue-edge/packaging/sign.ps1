param(
  [Parameter(Mandatory = $true)]
  [string[]] $ArtifactPath,

  [switch] $AllowUnsignedDevelopment
)

$ErrorActionPreference = "Stop"

$thumbprint = $env:VENUE_EDGE_SIGNING_CERT
if (-not $thumbprint) {
  if ($AllowUnsignedDevelopment) {
    Write-Warning "VENUE_EDGE_SIGNING_CERT is not set. Producing explicitly unsigned development artifacts."
    return
  }
  throw "VENUE_EDGE_SIGNING_CERT is required for release packaging. Use -AllowUnsignedDevelopment only for local testing."
}

$signtool = $env:SIGNTOOL_PATH
if (-not $signtool) {
  $command = Get-Command "signtool.exe" -ErrorAction SilentlyContinue
  if ($command) {
    $signtool = $command.Source
  }
}
if (-not $signtool -or -not (Test-Path $signtool)) {
  throw "signtool.exe was not found. Set SIGNTOOL_PATH to the Windows SDK signtool executable."
}

foreach ($path in $ArtifactPath) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Signing target does not exist: $path"
  }
  & $signtool sign /fd SHA256 /tr https://timestamp.digicert.com /td SHA256 /sha1 $thumbprint $path
  if ($LASTEXITCODE -ne 0) {
    throw "Authenticode signing failed for $path"
  }
  & $signtool verify /pa /all /v $path
  if ($LASTEXITCODE -ne 0) {
    throw "Authenticode verification failed for $path"
  }
  Write-Host "Signed and verified $path"
}
