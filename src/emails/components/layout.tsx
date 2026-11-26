import type { ReactNode } from "react"

import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

import { assetUrl, color, font, siteUrl, space } from "./tokens"

/**
 * The frame every PlayTT email shares: logo, a white card on a soft grey
 * page, and a quiet footer. Templates only fill the card.
 */
export function EmailLayout({
  preview,
  children,
  footerNote,
}: {
  /** The grey line inbox lists show after the subject. */
  preview: string
  children: ReactNode
  /** Why this person got the email, shown small in the footer. */
  footerNote?: string
}) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
        <style>{`
          body { -webkit-font-smoothing: antialiased; }
          a { color: ${color.ink}; }
          @media (max-width: 600px) {
            .playtt-card { padding: 32px 24px !important; border-radius: 0 !important; }
            .playtt-title { font-size: 28px !important; line-height: 34px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: color.canvas, fontFamily: font }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 0 48px" }}>
          <Section style={{ padding: "0 8px 28px", textAlign: "center" }}>
            <Link href={siteUrl("/")}>
              <Img
                src={assetUrl("/brand/playtt-logo-primary.png")}
                alt="PlayTT"
                width="124"
                height="36"
                style={{ display: "inline-block", border: 0 }}
              />
            </Link>
          </Section>

          <Section
            className="playtt-card"
            style={{
              backgroundColor: color.card,
              borderRadius: "24px",
              padding: `${space.cardY} ${space.cardX}`,
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "28px 24px 0", textAlign: "center" }}>
            {footerNote ? <FooterText>{footerNote}</FooterText> : null}
            <FooterText>
              PlayTT · Book a table. Play on.{" "}
              <Link href={siteUrl("/")} style={{ color: color.inkFainter, textDecoration: "underline" }}>
                theplaytt.com
              </Link>
            </FooterText>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function FooterText({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 6px",
        fontFamily: font,
        fontSize: "12px",
        lineHeight: "18px",
        color: color.inkFainter,
      }}
    >
      {children}
    </Text>
  )
}
