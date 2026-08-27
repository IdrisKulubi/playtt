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

  $grants = @("SYSTEM:(OI)(CI)F", "Administrators:(OI)(CI)F")
  if ($WritableByService) {
    $grants += "NT AUTHORITY\LOCAL SERVICE:(OI)(CI)M"
  } else {
    $grants += "NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX"
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

icacls $entropyPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" "NT AUTHORITY\LOCAL SERVICE:R" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Failed to secure DPAPI entropy file"
}

Write-Host "Applied ACLs for $ProgramFilesRoot and $ProgramDataRoot"
