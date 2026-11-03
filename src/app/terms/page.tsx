import type { Metadata } from "next"

import { LegalPage, type LegalSection } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service | PlayTT",
  description: "The rules for booking and playing at PlayTT, and for using the PlayTT app.",
}

const sections: LegalSection[] = [
  {
    heading: "Agreeing to these terms",
    body: (
      <p>
        By creating an account or booking a table you agree to these terms and to our{" "}
        <a className="text-foreground underline" href="/privacy">Privacy Policy</a>. If you do not agree, do not use PlayTT.
        You must be 18 or older, or use PlayTT with a parent or guardian who agrees for you.
      </p>
    ),
  },
  {
    heading: "Your account",
    body: (
      <p>
        Give us true details and keep your sign-in safe. You are responsible for what happens on your account. You can delete
        it at any time in the app under Me → Delete account.
      </p>
    ),
  },
  {
    heading: "Booking and paying",
    body: (
      <ul>
        <li>A booking reserves one table for the time shown. The price, in Kenya shillings, is shown before you pay.</li>
        <li>You pay by M-Pesa. A booking is confirmed once the payment is received.</li>
        <li>You can change the time or add players up to 2 hours before play starts. If you reduce the group, the extra amount stays as credit on your account.</li>
        <li>Please arrive on time. Late arrival does not extend your session.</li>
        <li>If a table is unavailable because of a fault, we will refund you or move your booking.</li>
      </ul>
    ),
  },
  {
    heading: "Using the pods",
    body: (
      <ul>
        <li>Play safely and look after the equipment. You may be charged for damage you cause.</li>
        <li>Your entry code is for you and your group only. Do not share it.</li>
        <li>Pods have cameras for replays. By entering you agree to be recorded for that purpose, as described in the Privacy Policy.</li>
      </ul>
    ),
  },
  {
    heading: "Replays and your content",
    body: (
      <p>
        Replay clips and photos you add belong to you. You give PlayTT permission to store and show them to you and, where you
        choose, to other players. Replay packs unlock more replays for your own use; they are not refundable once used.
      </p>
    ),
  },
  {
    heading: "Community rules",
    body: (
      <>
        <p>Be kind. Do not post anything that is abusive, hateful, sexual, threatening, false, or that shares someone else&apos;s private details.</p>
        <p>
          You can block any player and report any player or message. We review reports within 24 hours and may remove
          content or accounts that break these rules.
        </p>
      </>
    ),
  },
  {
    heading: "AI Coach",
    body: (
      <p>
        Coach is a computer program. Its tips about your game are general and may be wrong, and they are not medical, fitness,
        or professional advice. Use your own judgement.
      </p>
    ),
  },
  {
    heading: "Ending your access",
    body: (
      <p>
        We may suspend or close an account that breaks these terms, harms others, or uses PlayTT for fraud. You may stop using
        PlayTT at any time.
      </p>
    ),
  },
  {
    heading: "Our responsibility",
    body: (
      <p>
        We provide PlayTT with reasonable care, but cannot promise it will always be available or error free. To the extent
        the law allows, PlayTT is not liable for indirect losses, and our total liability for a booking is limited to the amount
        you paid for it. Nothing here limits liability that cannot be limited by law, such as for death or personal injury caused
        by our negligence.
      </p>
    ),
  },
  {
    heading: "Changes and law",
    body: (
      <p>
        We may update these terms and will tell you in the app first. These terms are governed by the laws of Kenya and the
        courts of Nairobi. Questions: <a className="text-foreground underline" href="mailto:hello@theplaytt.com">hello@theplaytt.com</a>.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="3 November 2026"
      intro="The short version: book honestly, play safely, be kind to other players, and look after the pods."
      sections={sections}
    />
  )
}
