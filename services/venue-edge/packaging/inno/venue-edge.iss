#define MyAppName "PlayTT VenueEdge Agent"
#define MyAppPublisher "PlayTT"
#define MyAppURL "https://playtt.app"
#define MyInstallRoot "{pf64}\PlayTT\VenueEdge"
#define MyDataRoot "{commonappdata}\PlayTT\VenueEdge"

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0-rc1"
#endif

#ifndef StagingRoot
  #define StagingRoot "..\dist\windows-bundle\staging"
#endif

#ifndef OutputDir
  #define OutputDir "..\dist\windows-bundle\artifacts"
#endif

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={#MyInstallRoot}
DefaultGroupName=PlayTT
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=PlayTTVenueEdge-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayIcon={#MyInstallRoot}\PlayTTVenueEdge.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "removeData"; Description: "Remove local VenueEdge data and pairing (destructive)"; GroupDescription: "Uninstall options:"; Flags: unchecked

[Files]
Source: "{#StagingRoot}\PlayTTVenueEdge\*"; DestDir: "{#MyInstallRoot}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{#MyDataRoot}"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\logs"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\buffers"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\pending"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\uploaded"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\failed"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\commissioning"; Permissions: admins-full system-full
Name: "{#MyDataRoot}\nvrs"; Permissions: admins-full system-full

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{#MyInstallRoot}\install-acl.ps1"" -ProgramFilesRoot ""{#MyInstallRoot}"" -ProgramDataRoot ""{#MyDataRoot}"""; StatusMsg: "Applying security permissions..."; Flags: runhidden waituntilterminated
Filename: "{#MyInstallRoot}\PlayTTVenueEdge.exe"; Parameters: "install"; StatusMsg: "Installing VenueEdge service..."; Flags: runhidden waituntilterminated
Filename: "{#MyInstallRoot}\PlayTTVenueEdge.exe"; Parameters: "start"; StatusMsg: "Starting VenueEdge service..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -Command ""Start-Sleep -Seconds 6; $path = Join-Path $env:ProgramData 'PlayTT\VenueEdge\setup-url.txt'; if (Test-Path $path) { Start-Process (Get-Content $path -Raw).Trim() }"""; Description: "Open VenueEdge setup wizard"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{#MyInstallRoot}\PlayTTVenueEdge.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated
Filename: "{#MyInstallRoot}\PlayTTVenueEdge.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{#MyDataRoot}"; Tasks: removeData

[Code]
function InitializeUninstall(): Boolean;
begin
  Result := True;
end;
