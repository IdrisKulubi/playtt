# PlayTT: User Journey & Role Mapping

## 1. User Roles Overview

### 1.1 The Player (End-User)
The core customer. Usually a student, young professional, or table tennis enthusiast looking for a premium, frictionless, and private place to play. 

### 1.2 The Super Admin (System Operator)
The venue owner/operator (You). Responsible for monitoring system health, managing hardware overrides, tracking revenue, and handling customer support.

---

## 2. The Player Journey (End-to-End)

### Phase 1: Discovery & Onboarding
* **Trigger:** The user sees a TikTok video of someone playing at PlayTT, walks past the glowing Electric Azure glass storefront in Hurlingham, or hears about it from a friend.
* **Action:** They visit `theplaytt.com` or download the mobile app.
* **Onboarding:**
  1. User opens the app (greeted by the Dark Mode & Azure UI).
  2. Clicks "Sign In / Register".
  3. Enters their phone number to receive an OTP (or uses Google OAuth).
  4. Completes profile (Name, Skill Level [Beginner, Intermediate, Pro]).

### Phase 2: Booking & Payment
* **Action:** The user wants to book a session for Friday evening.
* **Flow:**
  1. User selects a location (e.g., "PlayTT Hurlingham").
  2. The app displays an intuitive calendar with available 30-minute and 60-minute blocks.
  3. User selects the `18:00 - 19:00` slot. 
  4. App shows the total price (factoring in Peak pricing).
  5. User clicks "Pay with M-Pesa".
  6. An STK Push triggers on their phone. User enters their M-Pesa PIN.
  7. **Success:** The screen pulses Electric Azure, displaying a "Booking Confirmed" animation. 

### Phase 3: Pre-Arrival & Access (The Magic Moment)
* **Action:** The user heads to the physical pod.
* **Flow:**
  1. App generates a digital 'Access Card' for that specific booking. This card contains a 6-digit PIN and a digital "Tap to Unlock" button.
  2. User arrives at the glass-fronted pod at `17:55`. 
  3. *Behind the scenes:* At `17:58`, the system automatically turns on the pod's main ambient lights to welcome them.
  4. User enters the PIN on the physical TTLock keypad or presses "Unlock" in the app (via Bluetooth).
  5. The door clicks open. The user walks in.

### Phase 4: The In-Session Experience
* **Action:** The user plays their match.
* **Flow:**
  1. As the user walks in, the bright, professional table lights automatically power on.
  2. The user places their bags on the bench and grabs the premium paddles (e.g., JOOLA/STIGA/Butterfly).
  3. **Scorekeeping:** The user interacts with the wall-mounted tablet (or their phone app), tapping "+1" as they score. The live score is mirrored on a large TV screen in the room.
  4. **The Replay:** Player A hits an incredible smash. Player B yells, "No way!" Player A hits the physical/digital "Instant Replay" button. The system clips the last 30 seconds of footage from the overhead NVR camera.
  5. The video is instantly processed and available in the user's app profile.

### Phase 5: Departure & Retention
* **Action:** The session time is running out.
* **Flow:**
  1. At `18:55` (5 minutes left), the app sends a push notification, and the ambient room lights flash Amber/Orange twice to warn the players.
  2. At `19:00`, the session ends. 
  3. The users leave and close the door. The smart lock engages automatically.
  4. *Behind the scenes:* At `19:01`, the table lights power off to save electricity.
  5. **Follow-up:** 10 minutes later, the user receives an SMS/Notification: *"Great game! Your Instant Replay is ready to view and share."*
  6. User downloads the branded video clip and posts it to Instagram, restarting the discovery loop for new users.

---

## 3. The Super Admin Journey (End-to-End)

### Phase 1: Daily Monitoring & Analytics
* **Action:** Admin opens the web dashboard on their laptop.
* **Flow:**
  1. Logs into the Admin portal.
  2. Views the "Live Status" dashboard: Shows which pods are currently occupied, upcoming bookings for the day, and live hardware statuses (e.g., "Door Locked", "Lights ON").
  3. Checks the "Revenue" tab: Views M-Pesa settlements and calculates daily peak vs. off-peak earnings.

### Phase 2: Intervention & Edge Cases
* **Action:** A player calls/messages support saying, "My phone died, and I can't remember my PIN to get in!"
* **Flow:**
  1. Admin searches the user's name or active booking in the dashboard.
  2. Verifies the user's booking time.
  3. Clicks the red "Remote Override Unlock" button.
  4. The webhook fires to the smart lock gateway, and the door opens for the user instantly.
* **Action:** An M-Pesa payment fails to reflect due to Safaricom downtime.
  1. Admin verifies the payment manually using the M-Pesa transaction code provided by the user.
  2. Clicks "Force Confirm Booking," which triggers the system to generate the access codes as if the webhook had succeeded.