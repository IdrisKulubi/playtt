# PlayTT: Brand & Design Guidelines (v1.0)

## 1. Brand Identity
**Name:** PlayTT
**Domain:** theplaytt.com
**Tagline:** Autonomous Table Tennis. Anytime.
**Core Vibe:** High-tech, private, energetic, and frictionless.
**Target Audience:** Students, young professionals, and casual players seeking a premium, private sporting experience.

---

## 2. Color Palette
PlayTT operates on a "Dark Mode" aesthetic both digitally and physically. The primary color acts as a beacon.

* **Primary Hero (Electric Azure): `##00b7ff`** * *Usage:* Primary call-to-action buttons ("Unlock Door"), the PlayTT logo, physical LED strip lighting, and storefront branding.
* **Background Base (Charcoal Black): `#121212`**
    * *Usage:* Digital app backgrounds, physical pod walls, ceiling paint, and hardware casing (smart locks/cameras).
* **Surface / Card Base (Dark Grey): `#1E1E1E`**
    * *Usage:* Booking slots, modal backgrounds, and secondary UI elements to create depth against the black background.
* **Text & Accents (Crisp White): `#FFFFFF`**
    * *Usage:* Typography, physical floor boundary lines, and live scoreboard text.
* **Hardware Status (System Colors):**
    * *Success (Neon Green):* `#00FF66` (Door unlocked, booking confirmed).
    * *Warning (Amber):* `#FFB800` (5 minutes remaining in session).

---

## 3. Typography
The font must be modern, highly legible on digital screens, and carry a slight "sports/tech" aesthetic. 

* **Primary Font Family:** `Inter` or `Geist` (Ideal for Next.js/React Native).
* **Headings (H1, H2, H3):** Bold (700) or ExtraBold (800). 
    * *Example:* **Book a Pod**, **Unlock Door**
* **Body Text:** Regular (400) or Medium (500). 
    * *Example:* Time slot descriptions, checkout details, and terms.
* **Numerals (Important for Scoreboards):** Use a monospace variant for the live scoreboard (e.g., `Space Mono` or `Roboto Mono`) so the numbers don't jump around when updating from 9 to 10.

---

## 4. Digital UI/UX (Software)
Guidelines for the Next.js Web App and React Native Mobile interface.

### **The Layout Strategy**
* **Mobile-First:** 95% of users will book while on the go. The UI must center around a massive "Book Now" or "Unlock" button on the lower half of the screen (easy thumb reach).
* **Dark Mode Only:** There is no "Light Mode." The app must mirror the physical room's vibe.

### **Key Interaction States**
1.  **Idle / Browsing:** Black background, white text, Azure Blue accents for available time slots.
2.  **Action (Unlocking):** When the "Unlock Door" button is pressed, trigger a haptic pulse on the phone. The button should briefly glow Electric Azure, and a success checkmark (Neon Green) should appear.
3.  **In-Session:** The screen transforms into a remote control. Massive, easy-to-tap buttons for "+1 Score Player A" and "+1 Score Player B". An Azure Blue "Replay" button is positioned dead center.

---

## 5. Physical Space Design (The Pod)
Guidelines for the 400-500 sq. ft. physical location to maintain brand consistency.

### **Storefront & Visibility**
* **Glass Frontage:** Keep the glass clear (no frosted vinyl up to eye level) so people walking by can see the table and the tech.
* **The Sign:** 3D LED backlit letters. The "Play" can be crisp white, while the "TT" is glowing Electric Azure.

### **Interior Layout & Decor**
* **Paint:** Matte black or very dark grey for the walls and ceiling. This makes the table "pop" and hides the wiring/cameras.
* **The "PlayTT Line":** A 1-foot wide Electric Azure painted line on the floor, starting at the smart lock on the door and leading directly to the center of the table. 
* **Lighting:** * *Table Light:* Bright, white, professional-grade LED panels suspended exactly over the table (essential for gameplay).
    * *Ambient Light:* Electric Azure LED strips along the floorboards or ceiling edges.

### **Hardware Integration**
* **Smart Lock (TTLock):** Must be matte black. Mounted cleanly at the entrance.
* **Camera System (NVR/Raspberry Pi):** Mounted 8-10 feet high, painted or wrapped in black to blend into the ceiling.
* **Tablet/Control Screen:** Mounted on the wall next to the table at a height of 4.5 feet. Wrapped in a matte black bezel displaying the Next.js scoreboard interface.