import type { Metadata } from "next"

import { LegalPage, type LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Support | PlayTT",
  description: "Get help with PlayTT bookings, payments, entry, replays and your account.",
}

const sections: LegalSection[] = [
  {
    heading: "Contact us",
    body: (
      <>
        <p>
          Email <a className="text-foreground underline" href="mailto:hello@theplaytt.com">hello@theplaytt.com</a> and a
          person on the PlayTT team will reply. It helps to include the email you signed up with, the venue and table, and
          the time of your booking.
        </p>
        <p>
          Never send your password or M-Pesa PIN. We will never ask for them.
        </p>
      </>
    ),
  },
  {
    heading: "Booking and entry",
    body: (
      <ul>
        <li><strong>Find your booking:</strong> open the PlayTT app and go to Bookings. Your entry details for the pod are shown there.</li>
        <li><strong>Can&apos;t get in:</strong> check you are using the booked table and time, then email us with the venue name and we will help.</li>
        <li><strong>Change or cancel:</strong> open the booking in the app. If it can&apos;t be changed there, email us.</li>
      </ul>
    ),
  },
  {
    heading: "Payments",
    body: (
      <ul>
        <li><strong>M-Pesa:</strong> we send a payment request to your phone. If it doesn&apos;t arrive, check the number on your account and try again.</li>
        <li><strong>Charged but no booking:</strong> email us the M-Pesa message or receipt and we will sort it out.</li>
        <li>We never see or store your M-Pesa PIN.</li>
      </ul>
    ),
  },
  {
    heading: "Replays",
    body: (
      <ul>
        <li>Replay clips appear in the Activity tab of the app after your session.</li>
        <li>You can save a clip or your stats card to Photos and share it from there.</li>
        <li>Missing a clip? Email us with the venue, table and session time.</li>
      </ul>
    ),
  },
  {
    heading: "Sign-in and your account",
    body: (
      <ul>
        <li><strong>Sign-in:</strong> use Apple, Google, or your email and password. If one doesn&apos;t work, try another way in.</li>
        <li><strong>Notifications and permissions:</strong> you can change these in the app under Me, and in your phone&apos;s Settings.</li>
        <li><strong>Delete your account:</strong> open the app, go to Me, then Delete account. Cancel any upcoming bookings first. If you can&apos;t use the app, email us and we will do it for you.</li>
      </ul>
    ),
  },
  {
    heading: "Safety and reporting",
    body: (
      <p>
        To report a player or a message, use Report in the app&apos;s Community. You can also block a player there. For anything
        urgent or about safety at a venue, email us with the details.
      </p>
    ),
  },
  {
    heading: "More information",
    body: (
      <ul>
        <li><a className="text-foreground underline" href="/privacy">Privacy policy</a></li>
        <li><a className="text-foreground underline" href="/terms">Terms of service</a></li>
      </ul>
    ),
  },
]

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      updated="4 November 2026"
      intro="Help with bookings, payments, entry, replays and your account. If you can't find your answer here, email us."
      sections={sections}
    />
  )
}
