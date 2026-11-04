# PlayTT: App permissions and data use

This is the full list of device permissions the PlayTT iOS app (`com.theplaytt.app`) asks for, what each one is used for, and when the prompt appears. It is written for Apple App Review and for anyone auditing the app.

Every permission is **optional**. If you decline, the rest of the app keeps working. PlayTT never asks for a permission on first launch; each prompt appears only after you tap the feature that needs it.

## Summary

| Permission | Asked? | Why | When it appears |
|---|---|---|---|
| Notifications | Yes | Booking confirmations, reminders and replay-ready alerts | After you turn on notifications in the app and read why |
| Photos: add only | Yes | Save a stats card or session clip to your photo library | When you tap **Save** on a share card or clip |
| Photos: select | Yes (system picker) | Choose one picture for your player card | When you tap **Add photo** on your player card |
| Calendar | Declared, see note | Add a booked game to your calendar | When you tap **Add to calendar** on a booking |
| Camera | **No** | Not used | n/a |
| Microphone | **No** | Not used | n/a |
| Location | **No** | Not used | n/a |
| Contacts | **No** | Not used | n/a |
| Bluetooth, Motion, Health, Face ID | **No** | Not used | n/a |
| App Tracking Transparency | **No** | PlayTT does not track you across other companies' apps or sites | n/a |

## Details

### Notifications
- **What it allows:** PlayTT can send you push notifications.
- **Used for:** table access (entry ready or failed), session reminders, warnings and end-of-session alerts, a heads-up when a replay clip is ready, and community activity (messages, follows, kudos). Each type has its own switch in **Me > Notifications**. We do not send marketing notifications.
- **How it works:** the app first shows its own screen explaining why. The iOS system prompt appears only if you continue. You can switch notifications off any time in **Me > Notifications** or in iOS Settings.
- **Data sent:** a device push token, stored with your account so we can reach your phone. It is deleted when you turn notifications off, sign out or delete your account.

### Photos: add only (`NSPhotoLibraryAddUsageDescription`)
- **Text shown to you:** "PlayTT saves your session clips and activity cards to your photo library when you choose Save."
- **Used for:** writing an image or video you created to your library. Nothing is read from your library with this permission.
- **When:** only after you tap **Save to Photos**.

### Photos: select (`NSPhotoLibraryUsageDescription`)
- **Text shown to you:** "PlayTT uses your photos so you can add a picture to your player card and save session clips and activity cards."
- **Used for:** picking one picture for your player card. Only the picture you choose is uploaded. The app does not browse or upload the rest of your library.
- **When:** only after you tap **Add photo** (or **Change photo**).
- **Where it goes:** the chosen picture is stored on PlayTT servers and shown on your player card. Deleting your account removes it.

### Calendar (`NSCalendarsUsageDescription`)
- **Text shown to you:** "PlayTT adds your booked games to your calendar when you ask it to."
- **Used for:** the **Add to calendar** button on a booking. The app opens the standard iOS event screen with the game time filled in, and you decide whether to save it.
- **Read access:** PlayTT never reads your existing calendar events. Because it uses the system event screen, iOS may not show a separate calendar permission prompt at all; the usage text is declared because the calendar library requires it.

### Sign in with Apple and Google
These are sign-in options, not device permissions. With Apple, we receive your name and email (or Apple's private relay address) only if you share them. With Google, we receive your name, email and profile picture. Deleting your account also revokes the Apple link.

### Internet
The app needs a network connection to book, pay and load your data. It talks only to PlayTT servers (`theplaytt.com`) and, for sign-in, to Apple or Google.

## Permissions PlayTT does not request

PlayTT has **no** camera, microphone, location, contacts, Bluetooth, motion, health or tracking permissions and does not contain code that asks for them. The camera in the app's venue is VenueEdge hardware owned by the venue; it is not your phone's camera.

## Third-party services that receive data

| Service | What it receives | Why |
|---|---|---|
| Payment provider (M-Pesa and card) | Amount and phone number or card details you enter on their screen | To take payment. PlayTT never sees your card number or M-Pesa PIN. |
| Expo push service | Push token and notification text | To deliver notifications |
| AI Coach provider (optional) | Messages you type and play stats needed for a reply, only after you tap **Allow** in the consent card | To write Coach replies. Never your email, phone number, password or payment details. |

## Account deletion and privacy

- Delete your account in the app: **Me > Delete account**. It erases your name, email, phone, photo and player card, and signs out all devices.
- Privacy policy: https://theplaytt.com/privacy
- Terms: https://theplaytt.com/terms
- Questions: see the support email on the privacy page.

## Paste-ready text for App Store Connect (App Review Information > Notes)

> PlayTT asks only for the permissions it needs, each one only after the user taps the related feature. Nothing is requested at launch and every permission is optional.
> - Notifications: table access, session reminders, replay-ready and community alerts, each with its own switch. The app explains why before the system prompt.
> - Photos (add only): saving a stats card or session clip when the user taps Save to Photos.
> - Photos (select): choosing one picture for the user's player card.
> - Calendar: Add to calendar on a booking opens the standard iOS event screen. The app does not read existing events.
> - No camera, microphone, location, contacts or tracking.
> Account deletion is in Me > Delete account. The full permission list is in PERMISSIONS.md in the project root and at https://theplaytt.com/privacy.

## Where this is declared

All purpose strings live in `playtt-mobile/app.json` (`ios.infoPlist` and the plugin options for `expo-media-library`, `expo-image-picker` and `expo-calendar`), and Android permissions in `android.permissions` and `android.blockedPermissions`. Reminders access is switched off, and calendar access is write-only.

## Keeping this file correct

If you add a plugin or a `requestPermissionsAsync` call, update this file and the matching strings in `playtt-mobile/app.json` in the same change. The strings above are copied from that file.
