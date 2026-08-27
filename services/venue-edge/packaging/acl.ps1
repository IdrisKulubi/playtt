param(
  [Parameter(Mandatory = $true)]
  [string] $ProgramFilesRoot,

  [Parameter(Mandatory = $true)]
  [string] $ProgramDataRoot
)

$ErrorActionPreference = "Stop"

function Ensure-DirectoryAcl {
  param([string] $Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }

  icacls $Path /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
}

Ensure-DirectoryAcl -Path $ProgramFilesRoot
Ensure-DirectoryAcl -Path $ProgramDataRoot
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "logs")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "buffers")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "pending")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "uploaded")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "failed")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "commissioning")
Ensure-DirectoryAcl -Path (Join-Path $ProgramDataRoot "nvrs")

$entropyPath = Join-Path $ProgramDataRoot ".dpapi-entropy"
if (-not (Test-Path $entropyPath)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [System.IO.File]::WriteAllBytes($entropyPath, $bytes)
}

icacls $entropyPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null

Write-Host "Applied ACLs for $ProgramFilesRoot and $ProgramDataRoot"
