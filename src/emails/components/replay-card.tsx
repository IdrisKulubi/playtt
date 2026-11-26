import { Link, Section, Text } from "@react-email/components"

import { color, displayFont, font } from "./tokens"

/**
 * A tappable "video" tile for replay emails: navy, a cyan play button and the
 * clip's name. Built from table cells so it renders without images.
 */
export function EmailReplayCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Section style={{ margin: "0 0 28px" }}>
      <Link href={href} style={{ textDecoration: "none", display: "block" }}>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "separate", backgroundColor: color.navy, borderRadius: "20px" }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "56px 24px 20px", textAlign: "center" }}>
                <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: "64px",
                          height: "64px",
                          borderRadius: "32px",
                          backgroundColor: color.accent,
                          textAlign: "center",
                          verticalAlign: "middle",
                          fontFamily: font,
                          fontSize: "24px",
                          lineHeight: "64px",
                          color: color.accentInk,
                        }}
                      >
                        &#9654;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "0 24px 36px", textAlign: "center" }}>
                <Text
                  style={{
                    margin: 0,
                    fontFamily: displayFont,
                    fontSize: "20px",
                    fontWeight: 600,
                    lineHeight: "26px",
                    letterSpacing: "-0.01em",
                    color: "#ffffff",
                  }}
                >
                  {title}
                </Text>
                <Text style={{ margin: "6px 0 0", fontFamily: font, fontSize: "14px", lineHeight: "20px", color: "rgba(255,255,255,0.7)" }}>
                  {subtitle}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Link>
    </Section>
  )
}
