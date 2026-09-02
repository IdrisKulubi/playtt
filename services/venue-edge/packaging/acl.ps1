param(
  [Parameter(Mandatory = $true)]
  [string] $ProgramFilesRoot,

  [Parameter(Mandatory = $true)]
  [string] $ProgramDataRoot
)

$ErrorActionPreference = "Stop"

function Ensure-DirectoryAcl {
  param(
    [string] $Path,
    [switch] $WritableByService
  )

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }

  # Use well-known SIDs so ACL installation works on every Windows language.
  $grants = @(
    "*S-1-5-18:(OI)(CI)F",      # Local System
    "*S-1-5-32-544:(OI)(CI)F"  # Built-in Administrators
  )
  if ($WritableByService) {
    $grants += "*S-1-5-19:(OI)(CI)M" # Local Service
  } else {
    $grants += "*S-1-5-19:(OI)(CI)RX"
  }
  & icacls $Path /inheritance:r /grant:r $grants | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply ACLs to $Path"
  }
}

Ensure-DirectoryAcl -Path $ProgramFilesRoot
Ensure-DirectoryAcl -Path $ProgramDataRoot -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "logs") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "buffers") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "pending") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "uploaded") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "failed") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "commissioning") -WritableByService
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "nvrs") -WritableByService

$entropyPath = Join-Path $ProgramDataRoot ".dpapi-entropy"
if (-not (Test-Path $entropyPath)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [System.IO.File]::WriteAllBytes($entropyPath, $bytes)
}

icacls $entropyPath /inheritance:r /grant:r "*S-1-5-18:F" "*S-1-5-32-544:F" "*S-1-5-19:R" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Failed to secure DPAPI entropy file"
}

Write-Host "Applied ACLs for $ProgramFilesRoot and $ProgramDataRoot"
