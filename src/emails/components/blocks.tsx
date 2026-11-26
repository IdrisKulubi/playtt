// Building blocks for the email card. Each one is a small, single-purpose
// piece; templates stack them. Tables, not flexbox: that's what Outlook and
// Gmail render reliably.

import type { ReactNode } from "react"

import { Button, Heading, Hr, Section, Text } from "@react-email/components"

import { color, displayFont, font, monoFont } from "./tokens"

/** Eyebrow, big headline and an optional lede. Every email opens with one. */
export function EmailHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string
  title: string
  lede?: ReactNode
}) {
  return (
    <Section style={{ marginBottom: "28px" }}>
      {eyebrow ? (
        <Text
          style={{
            margin: "0 0 12px",
            fontFamily: font,
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: "18px",
            letterSpacing: "0.02em",
            color: color.inkFaint,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Heading
        as="h1"
        className="playtt-title"
        style={{
          margin: 0,
          fontFamily: displayFont,
          fontSize: "34px",
          fontWeight: 700,
          lineHeight: "40px",
          letterSpacing: "-0.025em",
          color: color.ink,
        }}
      >
        {title}
      </Heading>
      {lede ? (
        <Text
          style={{
            margin: "14px 0 0",
            fontFamily: font,
            fontSize: "17px",
            lineHeight: "26px",
            color: color.inkSoft,
          }}
        >
          {lede}
        </Text>
      ) : null}
    </Section>
  )
}

/** The one action in the email, in brand cyan. */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 4px" }}>
      <Button
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: color.accent,
          color: color.accentInk,
          fontFamily: font,
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: "20px",
          padding: "15px 28px",
          borderRadius: "14px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

export interface EmailDetail {
  label: string
  value: ReactNode
  /** Smaller grey line under the value, e.g. "Was Table 2". */
  hint?: string
}

/** Label / value rows with hairlines between, like an Apple receipt. */
export function EmailDetails({ rows }: { rows: EmailDetail[] }) {
  return (
    <Section
      style={{
        margin: "0 0 28px",
        borderTop: `1px solid ${color.hairline}`,
      }}
    >
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  padding: "14px 16px 14px 0",
                  borderBottom: `1px solid ${color.hairline}`,
                  fontFamily: font,
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: color.inkFaint,
                  verticalAlign: "top",
                  width: "34%",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: "14px 0",
                  borderBottom: `1px solid ${color.hairline}`,
                  fontFamily: font,
                  fontSize: "15px",
                  lineHeight: "22px",
                  fontWeight: 600,
                  color: color.ink,
                  textAlign: "right",
                  verticalAlign: "top",
                }}
              >
                {row.value}
                {row.hint ? (
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 400, color: color.inkFainter }}>
                    {row.hint}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

/** A one-time code, large and spaced so it reads at a glance. */
export function EmailCode({ code, caption }: { code: string; caption?: string }) {
  return (
    <Section
      style={{
        margin: "0 0 24px",
        padding: "26px 16px 22px",
        borderRadius: "16px",
        backgroundColor: color.well,
        textAlign: "center",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: monoFont,
          fontSize: "40px",
          fontWeight: 600,
          lineHeight: "44px",
          letterSpacing: "0.28em",
          color: color.ink,
        }}
      >
        {code}
      </Text>
      {caption ? (
        <Text style={{ margin: "10px 0 0", fontFamily: font, fontSize: "13px", lineHeight: "18px", color: color.inkFaint }}>
          {caption}
        </Text>
      ) : null}
    </Section>
  )
}

/** Body copy. */
export function EmailText({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontFamily: font,
        fontSize: "15px",
        lineHeight: "24px",
        color: muted ? color.inkFaint : color.inkSoft,
      }}
    >
      {children}
    </Text>
  )
}

/** A short list of "good to know" points under a small heading. */
export function EmailTips({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <Section style={{ margin: "28px 0 0" }}>
      <Text
        style={{
          margin: "0 0 8px",
          fontFamily: font,
          fontSize: "13px",
          fontWeight: 600,
          lineHeight: "18px",
          color: color.ink,
        }}
      >
        {title}
      </Text>
      {items.map((item, index) => (
        <Text
          key={index}
          style={{
            margin: "0 0 8px",
            fontFamily: font,
            fontSize: "14px",
            lineHeight: "21px",
            color: color.inkFaint,
          }}
        >
          {item}
        </Text>
      ))}
    </Section>
  )
}

/** Small print at the bottom of the card (security notes, "didn't ask?"). */
export function EmailFinePrint({ children }: { children: ReactNode }) {
  return (
    <>
      <Hr style={{ margin: "28px 0 20px", borderColor: color.hairline }} />
      <Text style={{ margin: 0, fontFamily: font, fontSize: "13px", lineHeight: "20px", color: color.inkFainter }}>
        {children}
      </Text>
    </>
  )
}
