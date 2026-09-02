# VenueEdge Windows Installer Release Guide

This runbook explains how to make the VenueEdge installer available from the
PlayTT `/nvr` page, test it at the pilot venue on a clean Windows PC, withdraw a
bad release, and later publish a signed stable release.

The venue administrator's normal installation experience must not require a
terminal. The terminal and GitHub steps in this document are release-engineering
steps performed before the venue downloads the installer.

## What is already implemented

- Browser-downloadable offline Windows installer.
- Private, immutable installer storage in Cloudflare R2.
- Venue-specific pilot eligibility.
- Authenticated, audited, short-lived download links.
- Separate short-lived pairing codes; no venue credential is embedded in the
  installer.
- Six-stage local setup wizard.
- Windows service installation, delayed automatic start, and crash recovery.
- Upgrade-safe ProgramData state and DPAPI credentials.
- GitHub release gates for an unsigned pilot and a signed stable release.

The current local pilot artifact is:

```text
services/venue-edge/dist/windows-bundle/artifacts/PlayTTVenueEdge-Setup-0.2.0.exe
SHA-256: ea571280d7b372428623c94e0fd42b13cd5a1922cf600c8c94e0bf2ec042e9b9
Size: 99,398,165 bytes
Channel: pilot
Signing status: unsigned
```

The artifact in `dist/` is ignored by Git. The release workflow always rebuilds
from the committed source and publishes the newly generated checksum.

## Release flow at a glance

1. Create the private R2 bucket and two scoped R2 credentials.
2. Apply database migration `0033`.
3. configure and deploy the web application.
4. Configure the GitHub `venue-edge-pilot` environment.
5. Run the Windows installer workflow for one location UUID.
6. Download from `/nvr` and complete the clean-PC acceptance run.
7. Withdraw the release immediately if it fails.
8. Add trusted code signing and publish through the stable gate only after the
   pilot passes.

## Part 1: Create the private Cloudflare R2 bucket

### 1.1 Create the bucket

In the Cloudflare dashboard:

1. Open **R2 Object Storage**.
2. Create a bucket such as `playtt-venue-edge-installers`.
3. Keep the bucket private.
4. Do not enable a public development URL or public custom domain.
5. Record the bucket name and Cloudflare account ID.

The S3-compatible endpoint normally has this shape:

```text
https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
```

Use the endpoint shown by Cloudflare for the account rather than guessing it.

### 1.2 Create the web application's read credential

Create an R2 API token restricted to the installer bucket with object-read
permission. Store these values in the production web hosting environment:

```text
VENUE_EDGE_R2_BUCKET=playtt-venue-edge-installers
VENUE_EDGE_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VENUE_EDGE_R2_ACCESS_KEY_ID=<WEB_READ_ACCESS_KEY>
VENUE_EDGE_R2_SECRET_ACCESS_KEY=<WEB_READ_SECRET>
```

The web server needs read access so it can create a two-minute download URL. It
does not need permission to make the bucket public.

### 1.3 Create the GitHub release credential

Create a second token restricted to the same bucket with object read/write
permission. This key is used only by the release workflow to upload a new
installer. Do not reuse the web read-only key.

Record:

```text
VENUE_EDGE_R2_ACCESS_KEY_ID=<CI_WRITE_ACCESS_KEY>
VENUE_EDGE_R2_SECRET_ACCESS_KEY=<CI_WRITE_SECRET>
VENUE_EDGE_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VENUE_EDGE_R2_BUCKET=playtt-venue-edge-installers
```

The workflow writes installers under immutable keys like:

```text
venue-edge/installers/pilot/0.2.0/<SHA256>/PlayTTVenueEdge-Setup-0.2.0.exe
```

Never overwrite an existing object. Publish a new version when the installer
changes.

## Part 2: Create the release-registration secret

Generate a high-entropy secret once. For example, on an administrator Windows
PC:

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(48)
)
```

Save the exact generated value in both places:

- Production web environment: `VENUE_EDGE_RELEASE_REGISTRATION_TOKEN`
- GitHub environment secret: `VENUE_EDGE_RELEASE_REGISTRATION_TOKEN`

This is a CI-to-server bearer secret. Do not put it in source control, an
installer, a browser-visible variable, or a venue PC.

## Part 3: Apply migration 0033

The migration creates the release, pilot eligibility, and download-audit tables.
It is additive and does not delete VenueEdge topology.

From the repository root, configure `POSTGRES_URL` for the target deployment and
run:

```powershell
pnpm db:validate:strict
pnpm db:migrate
```

If `pnpm` is unavailable but Corepack is installed:

```powershell
corepack pnpm db:validate:strict
corepack pnpm db:migrate
```

The migration file is:

```text
drizzle/0033_venue_edge_installer_delivery.sql
```

Apply it to staging first, then production. Confirm that the migration command
finishes successfully before opening the new `/nvr` deployment.

## Part 4: Configure and deploy the web application

Add these server-side environment variables to the production deployment:

```text
VENUE_EDGE_R2_BUCKET=playtt-venue-edge-installers
VENUE_EDGE_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VENUE_EDGE_R2_ACCESS_KEY_ID=<WEB_READ_ACCESS_KEY>
VENUE_EDGE_R2_SECRET_ACCESS_KEY=<WEB_READ_SECRET>
VENUE_EDGE_RELEASE_REGISTRATION_TOKEN=<THE_SHARED_RANDOM_SECRET>
```

Keep the existing `POSTGRES_URL`, authentication variables, and normal PlayTT
production configuration in place.

Redeploy the web application after adding the variables. The registration URL
for the production release workflow is:

```text
https://<YOUR_PLAYTT_DOMAIN>/api/operator/venue-edge/installer-releases
```

For example, if the production application is `https://www.theplaytt.com`, use:

```text
https://www.theplaytt.com/api/operator/venue-edge/installer-releases
```

Do not use a preview-deployment URL for a production pilot unless that preview
uses the intended database and has been explicitly approved.

## Part 5: Find the pilot location UUID

The pilot allow-list uses a location UUID, not a venue name or installation ID.

The easiest method is:

1. Sign in to PlayTT as the venue administrator.
2. Open `/nvr`.
3. Select the pilot venue.
4. Read the `venueId` value in the browser URL.

It should look like:

```text
https://<YOUR_PLAYTT_DOMAIN>/nvr?venueId=11111111-1111-1111-1111-111111111111
```

The UUID after `venueId=` is the `pilot_location_ids` workflow input. Verify the
venue name before releasing; eligibility is deliberately exact and
venue-specific.

If database access is necessary, use a read-only query:

```sql
select id, name, tenant_id
from locations
order by name;
```

## Part 6: Configure GitHub Environments

In the GitHub repository, open **Settings → Environments**.

### 6.1 Create `venue-edge-pilot`

Create an environment named exactly:

```text
venue-edge-pilot
```

Add these environment secrets:

```text
VENUE_EDGE_R2_ACCESS_KEY_ID=<CI_WRITE_ACCESS_KEY>
VENUE_EDGE_R2_SECRET_ACCESS_KEY=<CI_WRITE_SECRET>
VENUE_EDGE_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VENUE_EDGE_R2_BUCKET=playtt-venue-edge-installers
VENUE_EDGE_RELEASE_REGISTRATION_URL=https://<DOMAIN>/api/operator/venue-edge/installer-releases
VENUE_EDGE_RELEASE_REGISTRATION_TOKEN=<THE_SHARED_RANDOM_SECRET>
```

Signing secrets may be absent for the pilot environment. Add an environment
approval rule so an authorized maintainer must approve installer publication.

### 6.2 Reserve `venue-edge-stable`

Create a second environment named:

```text
venue-edge-stable
```

Use the same types of R2 and registration secrets, but protect this environment
more strictly. Stable also requires signing configuration, described in Part 10.

## Part 7: Publish the pilot installer

First ensure all intended installer changes are committed. The GitHub runner
builds from the selected commit, not from uncommitted files on a developer PC.

To calculate a reproducible timestamp from the commit:

```powershell
git show -s --format=%ct HEAD
```

Then in GitHub:

1. Open **Actions**.
2. Select **VenueEdge Windows installer**.
3. Select **Run workflow**.
4. Choose the branch or exact commit intended for the pilot.
5. Enter the inputs below.

| Input                | Pilot value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `channel`            | `pilot`                                                                                      |
| `source_date_epoch`  | Output of `git show -s --format=%ct HEAD`                                                    |
| `pilot_location_ids` | Exact pilot location UUID; comma-separate only if intentionally allowing more than one venue |
| `target_tenant_ids`  | Leave empty                                                                                  |
| `release_notes`      | A concise description, for example `VenueEdge 0.2.0 clean-PC pilot`                          |

The workflow will:

1. Install the build dependencies.
2. Build the complete offline installer.
3. Verify bundle and installer hashes.
4. Confirm that the artifact satisfies the selected release gate.
5. Scan the bundle using Microsoft Defender.
6. Upload it to the private R2 bucket.
7. Register its checksum and pilot eligibility with the PlayTT API.
8. Keep a 14-day GitHub Actions copy for troubleshooting.

Do not manually register a different checksum from the one uploaded by the
workflow.

## Part 8: Confirm browser delivery

After the workflow succeeds:

1. Sign in as an administrator for the pilot venue.
2. Open `/nvr` and select the allowed venue.
3. Confirm the page shows the expected version, file size, checksum, Windows
   requirement, and **Unsigned pilot** status.
4. Accept the internal-test acknowledgement.
5. Select **Download installer**.
6. Confirm the downloaded filename matches the page.
7. Confirm a user from another venue cannot download the pilot.

The R2 URL is intentionally short-lived. Saving or sharing that URL is not a
supported delivery method; users should download through `/nvr`.

Optional release-engineering checksum verification:

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath '.\PlayTTVenueEdge-Setup-0.2.0.exe').Hash.ToLowerInvariant()
```

Compare the result with the checksum displayed on `/nvr`.

## Part 9: Clean-PC pilot acceptance

Use a clean Windows 10 22H2 or Windows 11 x64 PC without Node.js, pnpm, Git, or a
separate FFmpeg installation.

### 9.1 Install and pair

1. On the clean PC, sign in to `/nvr` as the pilot venue administrator.
2. Download the installer.
3. Accept the expected Windows warning for the unsigned internal pilot.
4. Approve the administrator/UAC prompt.
5. Complete installation without opening a terminal.
6. The browser should open the local VenueEdge wizard automatically.
7. Return to `/nvr` and generate a one-time pairing code.
8. Enter the code into the local wizard.
9. Confirm `/nvr` changes from **Download installer** to **Continue setup**.

### 9.2 Complete the six stages

Complete each wizard stage:

1. Pair device.
2. Add the NVR and enter credentials locally.
3. Review the strictly probed cameras.
4. Map each table to the correct camera.
5. Publish and wait until the exact configuration revision is applied.
6. Complete commissioning after previews, mappings, failover, and replay checks
   pass.

Credentials must remain on the venue PC and must not appear in `/nvr`, logs, or
cloud API responses.

### 9.3 Replay acceptance

1. Start an active test session.
2. Allow enough time for the rolling buffer to contain more than the configured
   replay duration.
3. Trigger a replay from the kiosk.
4. Confirm the kiosk displays progressive processing feedback.
5. Confirm a full-duration playable clip appears on the TV immediately after
   processing.
6. Confirm email delivery happens after TV playback is initiated.
7. Confirm the library player reports a real duration rather than `0:00`.

Treat a short, black, unplayable, or `0:00` clip as a failed acceptance run.

### 9.4 Restart recovery

1. Close the local wizard and open **Continue VenueEdge setup** from the Start
   Menu. Confirm the correct stage resumes.
2. Reboot the venue PC.
3. Wait for Windows startup and confirm VenueEdge returns without running a
   command.
4. Confirm configuration, credentials, buffering, and setup progress remain.
5. Trigger another replay and confirm TV playback still works.
6. Open **VenueEdge diagnostics** from the Start Menu if any step fails.

Record the Git commit, workflow run URL, installer version, SHA-256, clean-PC
Windows version, NVR model, camera count, and acceptance result. Only promote a
build after the exact recorded pilot checksum passes.

## Part 10: Stable signed release

Unsigned installers can never pass the stable workflow gate.

Before stable release:

1. Obtain a trusted Authenticode certificate from a provider that supports the
   publisher's verified jurisdiction, such as DigiCert KeyLocker where
   applicable.
2. Confirm the final publisher name.
3. Acquire the appropriate Inno Setup commercial license for commercial
   distribution.
4. Integrate and test the signing provider on a protected release runner.
5. Verify the signatures of every bundled executable and the final installer.

The current GitHub workflow supports a protected PFX signing adapter with these
stable environment secrets:

```text
VENUE_EDGE_SIGNING_PFX_BASE64=<BASE64_ENCODED_PFX>
VENUE_EDGE_SIGNING_PFX_PASSWORD=<PFX_PASSWORD>
VENUE_EDGE_SIGNATURE_PUBLISHER=<EXACT_AUTHENTICODE_PUBLISHER>
```

Do not export a certificate into PFX merely to work around an HSM or KeyLocker
security policy. When using KeyLocker or another cloud signing provider, replace
the workflow's PFX import step with that provider's authenticated signing step
before publishing stable.

For a stable workflow run:

| Input                | Stable value                             |
| -------------------- | ---------------------------------------- |
| `channel`            | `stable`                                 |
| `source_date_epoch`  | Commit timestamp                         |
| `pilot_location_ids` | Leave empty                              |
| `target_tenant_ids`  | Exact tenant UUIDs receiving the release |
| `release_notes`      | Approved stable release notes            |

The stable workflow fails if the required signing configuration is absent or an
executable has an invalid Authenticode signature. Perform the clean-PC acceptance
run again because signing produces a new installer checksum.

## Part 11: Withdraw a faulty release

Withdrawing stops new `/nvr` downloads but preserves the immutable R2 object and
audit history.

You need the release UUID and tenant UUID. Retrieve them from the release
registration response or with a read-only database query:

```sql
select id, tenant_id, version, channel, sha256, status, published_at
from venue_edge_installer_releases
order by published_at desc;
```

Then call the registration endpoint from a trusted administrator workstation:

```powershell
$releaseToken = '<VENUE_EDGE_RELEASE_REGISTRATION_TOKEN>'
$body = @{
  tenantId = '<TENANT_UUID>'
  releaseId = '<RELEASE_UUID>'
  status = 'withdrawn'
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Patch `
  -Uri 'https://<DOMAIN>/api/operator/venue-edge/installer-releases' `
  -Headers @{ Authorization = "Bearer $releaseToken" } `
  -ContentType 'application/json' `
  -Body $body
```

Afterward, reload `/nvr` and confirm the withdrawn release is no longer offered.
Do not delete the R2 object until the incident review and audit-retention period
are complete.

## Troubleshooting

### The workflow fails before building

- Confirm all `venue-edge-pilot` secrets exist and contain no extra quotes.
- Confirm `pilot_location_ids` is a valid location UUID.
- Confirm the workflow is using the intended Git commit.

### R2 upload fails

- Confirm the endpoint and bucket name.
- Confirm the GitHub R2 token is scoped to the correct bucket with object-write
  access.
- Confirm the bucket remains private; public access is not required.

### Release registration returns 401

- Confirm GitHub and the deployed web application use the exact same
  `VENUE_EDGE_RELEASE_REGISTRATION_TOKEN`.
- Redeploy the web application after changing its environment variables.

### Release registration reports a missing location

- Confirm the value is a `locations.id` UUID, not an installation, device,
  tenant, or resource UUID.
- Confirm migration `0033` was applied to the same database used by the deployed
  web application.

### `/nvr` shows no installer

- Confirm the workflow's upload and registration steps both succeeded.
- Confirm the signed-in administrator is viewing the exact eligible location.
- Confirm the release has `published` status and was not withdrawn.
- Confirm a pilot release was registered with that exact location UUID.

### Download fails after the button appears

- Confirm the web deployment has the read-only R2 credentials.
- Confirm those credentials can read the exact installer bucket.
- Start a new download from `/nvr`; an old generated R2 URL expires after about
  two minutes.

### Installer completes but the wizard does not open

- Use **Continue VenueEdge setup** from the Windows Start Menu.
- If it still fails, use **VenueEdge diagnostics** and review the service-start
  message and logs.
- Confirm the PC is Windows 10 22H2 or newer and that the local VenueEdge port is
  not occupied.

### Pairing or cloud setup fails

- Confirm the venue PC has internet access to the PlayTT production domain.
- Generate a new pairing code; codes are short-lived and single-use.
- Confirm the code was generated for the same venue selected in `/nvr`.
- Use the **Replace PC** flow instead of reusing an old device identity when
  replacing venue hardware.

## Release checklist

### Pilot publication

- [ ] Intended changes are committed and reviewed.
- [ ] R2 bucket is private.
- [ ] Web R2 key is read-only.
- [ ] GitHub R2 key is bucket-scoped read/write.
- [ ] Migration `0033` is applied.
- [ ] Production web environment is configured and redeployed.
- [ ] Pilot location UUID has been verified.
- [ ] `venue-edge-pilot` GitHub environment is protected and configured.
- [ ] Workflow completes build, hash verification, Defender scan, upload, and
      registration.
- [ ] `/nvr` displays the same version, size, and checksum.
- [ ] Unauthorized and non-pilot download attempts are rejected.
- [ ] Exact checksum passes clean-PC installation, commissioning, replay, and
      reboot recovery.

### Stable publication

- [ ] Pilot acceptance record is complete.
- [ ] Trusted signing provider and publisher identity are approved.
- [ ] Inno Setup commercial licensing is resolved.
- [ ] All bundled executables and final installer have valid signatures.
- [ ] `venue-edge-stable` environment requires approval.
- [ ] Exact target tenant UUIDs are verified.
- [ ] Signed checksum passes a fresh clean-PC acceptance run.
