#Requires -Version 5.1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationFramework

try {
  $dataRoot = Join-Path $env:ProgramData "PlayTT\VenueEdge"
  $logRoot = Join-Path $dataRoot "logs"
  if (-not (Test-Path -LiteralPath $logRoot)) {
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
  }
  Start-Process explorer.exe -ArgumentList $logRoot

  $setupPath = Join-Path $dataRoot "setup-url.txt"
  if (Test-Path -LiteralPath $setupPath) {
    $setupUrl = (Get-Content -LiteralPath $setupPath -Raw).Trim()
    $separator = if ($setupUrl.Contains("?")) { "&" } else { "?" }
    Start-Process "$setupUrl${separator}technician=1"
  } else {
    $setupScript = Join-Path $PSScriptRoot "open-setup.ps1"
    & $setupScript -WaitSeconds 15
  }
} catch {
  [System.Windows.MessageBox]::Show(
    "Could not open VenueEdge diagnostics. Run the installer again and choose Repair.`n`n$($_.Exception.Message)",
    "PlayTT VenueEdge diagnostics",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Error
  ) | Out-Null
  exit 1
}
