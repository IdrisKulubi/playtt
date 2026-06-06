# PlayTT Software Requirements Specification (SRS)

## 1. Project Overview
**PlayTT** is an autonomous, fully unmanned table tennis pod booking and management system. The software allows players to discover locations, book time slots, pay via mobile money (M-Pesa), and gain physical entry via smart lock integrations. The system also handles in-session automation, including lighting control, digital scorekeeping, and instant video replays.

## 2. Technology Stack
* **Web/Admin Frontend:** Next.js (React), TailwindCSS (shadcn/ui, dark mode default)
* **Mobile Frontend:** React Native (Expo)
* **Backend:** Next.js API Routes (or separate Node.js/Express service for heavy IoT webhook processing)
* **Database:** PostgreSQL (neon)
* **Real-Time Engine:** WebSockets ( Socket.io)
* **Payment Gateway:** paystack
* **IoT APIs:** TTLock API (Doors), Tuya/Sonoff Cloud API (Smart Relays/Lighting)

## 3. Architecture Strategy (The "Future-Proof" MVP)
The system is built as a single-location MVP but designed for Multi-Tenant SaaS scaling.
* **Core Rule:** All primary database tables (`bookings`, `hardware_configs`, `resources`) must include a `location_id` foreign key. 
* **Current State:** MVP runs entirely on `location_id = 1` (Hurlingham Pod).
* **Hardware Abstraction:** API keys for locks and cameras are stored securely in `hardware_configs` tied to the `location_id`, never hardcoded into API routes.

## 4. User Roles
1. **Player (End-User):** Can browse availability, book slots, pay, receive digital keys, and control the in-pod scoreboard.
2. **Super Admin:** Can view all bookings, manage physical hardware states (remote unlock), handle refunds, and view revenue analytics.

---

## 5. Functional Requirements

### 5.1 Authentication & User Management
* **REQ-1.1:** Users must be able to sign up/login via Phone Number (OTP) or Google OAuth.
* **REQ-1.2:** System must maintain a user profile tracking total games played, total spend, and saved video replay clips.

### 5.2 Booking & Scheduling Engine
* **REQ-2.1:** System must display a calendar UI showing available 30-minute and 60-minute blocks for a specific `location_id`.
* **REQ-2.2:** System must prevent double-booking using database-level transaction locks.
* **REQ-2.3:** System must support dynamic pricing (Off-Peak vs. Peak pricing variables).
* **REQ-2.4:** Users must receive a booking confirmation (In-app, SMS, or Email) containing their access instructions.

### 5.3 Payment Integration (M-Pesa)
* **REQ-3.1:** System must trigger an M-Pesa STK Push to the user's phone upon checkout.
* **REQ-3.2:** System must listen for the M-Pesa callback webhook to confirm payment.
* **REQ-3.3:** A booking status remains `pending` until the M-Pesa webhook confirms `success`, at which point the system changes status to `confirmed` and generates the smart lock key.

### 5.4 Hardware Integration (The "Magic Loop")
* **REQ-4.1 (Access):** Upon confirmed payment, backend must call the TTLock API to generate a time-bound passcode or eKey valid *only* for the duration of the booking (plus a 5-minute grace period).
* **REQ-4.2 (Lighting Automation):** A cron job or scheduled task must trigger the smart lighting API (Tuya/Sonoff) to turn on the main room and table lights 2 minutes before a session starts.
* **REQ-4.3 (Session Warning):** The smart lighting API must flash the lights, and the app must send a push notification 5 minutes before the session expires.
* **REQ-4.4 (Session End):** At the end of the session, the TTLock passcode expires automatically, and the system powers down the table lights to save electricity.

### 5.5 In-Session Experience (Digital Scoreboard & Replays)
* **REQ-5.1:** An in-pod tablet (or the user's mobile app) must display a digital scoreboard UI.
* **REQ-5.2:** Scoreboard button presses must update the local state and sync via WebSockets to a main TV display in the pod.
* **REQ-5.3:** "Instant Replay" trigger: When a user hits the physical/digital "Replay" button, the system must ping the local NVR/Camera IP to export the last 30 seconds of video and upload it to an AWS S3/Supabase Storage bucket tied to the `user_id`.

---

## 6. Non-Functional Requirements

### 6.1 UI/UX & Design System
* **REQ-6.1.1:** System must strictly adhere to the PlayTT Dark Mode design guidelines (Background: `#121212`, Primary Action: `#0058FF` Electric Azure).
* **REQ-6.1.2:** Mobile Web UI must be fully responsive and optimized for one-handed thumb navigation.

### 6.2 Security & Reliability
* **REQ-6.2.1:** All hardware API keys must be encrypted at rest and accessed via secure environment variables.
* **REQ-6.2.2:** The webhook listener for smart locks and payments must have retry logic in case of network drops.
* **REQ-6.2.3:** System must have a "Manual Override" button in the Admin panel to remotely unlock the door via API if a user's pin fails.

---

## 7. Database Schema Overview (Core Entities)
* `users` (id, phone, name, email, created_at)
* `locations` (id, name, address, active_status)
* `resources` (id, location_id, type [e.g., 'table'], name)
* `hardware_configs` (id, location_id, lock_api_key, light_api_key)
* `bookings` (id, user_id, resource_id, start_time, end_time, total_price, payment_status, access_code)
* `replays` (id, booking_id, user_id, video_url, timestamp)

## 8. Development Phases

* **Phase 1 (The Engine):** DB Setup, Auth, M-Pesa Integration, Booking Flow (No hardware yet).
* **Phase 2 (The Physical Link):** TTLock API integration, Webhook listeners, Next.js Admin Dashboard for manual overrides.
* **Phase 3 (The Experience):** In-app scoreboard, Tuya light syncing, dark mode UI polish.
* **Phase 4 (The Cool Factor):** Local network camera clipping and cloud upload for Instant Replays.