#Requires -Version 5.1
param(
  [int] $WaitSeconds = 35
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationFramework

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $quotedScript = '"' + $PSCommandPath.Replace('"', '""') + '"'
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File $quotedScript -WaitSeconds $WaitSeconds"
  exit 0
}

function Show-SetupError {
  param([string] $Message)
  [System.Windows.MessageBox]::Show(
    $Message,
    "PlayTT VenueEdge setup",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Error
  ) | Out-Null
}

try {
  $service = Get-Service -Name "PlayTTVenueEdge" -ErrorAction SilentlyContinue
  if (-not $service) {
    throw "VenueEdge is not installed correctly. Run the installer again and choose Repair."
  }
  if ($service.Status -ne "Running") {
    Start-Service -Name "PlayTTVenueEdge"
    $service.WaitForStatus("Running", [TimeSpan]::FromSeconds(15))
  }

  $setupPath = Join-Path $env:ProgramData "PlayTT\VenueEdge\setup-url.txt"
  $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
  do {
    if (Test-Path -LiteralPath $setupPath) {
      $setupUrl = (Get-Content -LiteralPath $setupPath -Raw).Trim()
      $parsed = $null
      if (
        [Uri]::TryCreate($setupUrl, [UriKind]::Absolute, [ref]$parsed) -and
        $parsed.Scheme -eq "http" -and
        $parsed.Host -eq "127.0.0.1"
      ) {
        Start-Process $setupUrl
        exit 0
      }
    }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)

  $service.Refresh()
  $logPath = Join-Path $env:ProgramData "PlayTT\VenueEdge\logs"
  throw "VenueEdge setup did not become ready. Service status: $($service.Status). Open VenueEdge diagnostics and send the newest log from $logPath to PlayTT support."
} catch {
  Show-SetupError $_.Exception.Message
  exit 1
}
