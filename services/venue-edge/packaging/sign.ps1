param(
  [Parameter(Mandatory = $true)]
  [string] $ArtifactPath
)

$ErrorActionPreference = "Stop"

$thumbprint = $env:VENUE_EDGE_SIGNING_CERT
if (-not $thumbprint) {
  Write-Host "VENUE_EDGE_SIGNING_CERT not set; skipping Authenticode signing for $ArtifactPath"
  exit 0
}

$signtool = "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
if (-not (Test-Path $signtool)) {
  $signtool = "signtool.exe"
}

& $signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /sha1 $thumbprint $ArtifactPath
Write-Host "Signed $ArtifactPath"
