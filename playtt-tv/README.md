# PlayTT TV (Android TV / Google TV app)

One app per table TV. It shows the table's PlayTT TV page
(`https://www.theplaytt.com/pod/tv?resourceId=…`) full-screen and lets
replays play straight from the venue PC over the local network, which is
several seconds faster than waiting for the cloud copy.

What it does:

- **First launch:** pick the venue, then the table, with the remote.
- **Full-screen, always on:** no browser bars, the screen never sleeps,
  and Back doesn't close it.
- **Change table later:** press **Back 5 times** quickly on the TV screen.
- **Starts with the TV** in kiosk mode (see below).
- **Offline:** shows "Can't reach PlayTT. Retrying…" and retries every 10 s.
- **Website updates need no reinstall.** The scoreboard, replays and look all
  live on the website. Reinstall only when this app itself changes.

## Build

Needs Android Studio installed (its built-in Java is used).

```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
cd playtt-tv
.\gradlew.bat assembleDebug     # -> app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat assembleRelease   # -> app\build\outputs\apk\release\app-release.apk (needs keystore.properties)
```

If Gradle fails with `Unable to establish loopback connection`, set this
first (a Windows Java quirk with some temp folders):

```powershell
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=C:\Users\Public\gradle-uds"
```

### Release signing

Every update must be signed with the **same key**, or the TV refuses it and
the app has to be uninstalled first. Keep `keystore/` and
`keystore.properties` out of git (already ignored) and back them up somewhere
safe, such as a password manager.

`keystore.properties`:

```properties
storeFile=keystore/playtt-tv.jks
storePassword=…
keyAlias=playtt-tv
keyPassword=…
```

## Install on a TV

1. On the TV: **Settings → System → About**, click **Android TV OS build** 7
   times to turn on developer options. Then **Settings → System → Developer
   options →** turn on **USB debugging** (some TVs call it **Network debugging**
   or **ADB debugging**).
2. Find the TV's IP address: **Settings → Network & Internet → (your network)**.
3. From the laptop (`adb` is in `%LOCALAPPDATA%\Android\Sdk\platform-tools`):

   ```powershell
   adb connect <tv-ip>:5555        # accept the prompt on the TV the first time
   adb install -r app-release.apk
   adb shell am start -n com.theplaytt.tv/.MainActivity   # open it now
   ```

4. On the TV, pick the venue and the table.

Without a laptop, use the **Downloader** app from the TV's app store: enter a
private link to the APK and install it. Kiosk mode below still needs `adb`.

## Kiosk mode: start with the TV, Home stays on PlayTT

Google TV resets "display over other apps" at every boot and its own home
screen always takes over the Home button, so the reliable way is to make
PlayTT TV the TV's home screen:

1. On the TV, open setup (**Back 5 times**), select **Kiosk mode: Off** so it
   says **On**.
2. From the laptop:

   ```powershell
   adb shell cmd package set-home-activity com.theplaytt.tv/.KioskHome
   # Google TV only: switch off Google's home screen so it can't take over.
   adb shell pm disable-user --user 0 com.google.android.apps.tv.launcherx
   ```

3. Wait ~20 seconds (Android saves the change), then restart the TV. It opens
   straight into PlayTT TV, and Home returns to it.

To reach the TV's own settings in kiosk mode: Back 5 times → **Android
settings**. To undo kiosk mode:

```powershell
adb shell pm enable com.google.android.apps.tv.launcherx
```

then turn **Kiosk mode** off in setup.

Tested on the Google TV (Android 14) emulator: boots into PlayTT TV, Home
stays on it. Non-Google Android TV boxes use a different home app; the
`set-home-activity` command is usually enough there.

## Venue network checklist

- TV and venue PC on the **same network** (Ethernet best, 5 GHz Wi-Fi fine).
- Venue PC allowed through the Windows firewall on **private networks**
  (Windows asks the first time VenueEdge starts).
- If replays still come from the cloud (slower), the TV can't reach the PC.
  Check they're on the same network, then restart VenueEdge.
