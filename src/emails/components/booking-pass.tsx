import { Section, Text } from "@react-email/components"

import { color, displayFont, font } from "./tokens"

/**
 * A Wallet-style pass for a booking: brand cyan, the table big, then day and
 * time. The thing people screenshot, so it carries the essentials alone.
 */
export function EmailBookingPass({
  venueName,
  tableName,
  day,
  time,
  note,
}: {
  venueName: string
  tableName: string
  day: string
  time: string
  /** Small line under the table, e.g. "Was Table 2". */
  note?: string
}) {
  const label = {
    margin: 0,
    fontFamily: font,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "16px",
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "rgba(4,16,25,0.6)",
  }
  const value = {
    margin: "4px 0 0",
    fontFamily: font,
    fontSize: "17px",
    fontWeight: 600,
    lineHeight: "22px",
    color: color.accentInk,
  }

  return (
    <Section style={{ margin: "0 0 28px" }}>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ borderCollapse: "separate", backgroundColor: color.accent, borderRadius: "20px" }}
      >
        <tbody>
          <tr>
            <td colSpan={2} style={{ padding: "22px 24px 0" }}>
              <Text style={label}>{venueName}</Text>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: "6px 24px 0" }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: displayFont,
                  fontSize: "44px",
                  fontWeight: 700,
                  lineHeight: "48px",
                  letterSpacing: "-0.03em",
                  color: color.accentInk,
                }}
              >
                {tableName}
              </Text>
              {note ? (
                <Text style={{ ...value, margin: "2px 0 0", fontSize: "14px", fontWeight: 500, color: "rgba(4,16,25,0.65)" }}>
                  {note}
                </Text>
              ) : null}
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: "20px 24px 0" }}>
              <div style={{ borderTop: "1px dashed rgba(4,16,25,0.25)", height: "1px", lineHeight: "1px" }}>&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "16px 12px 24px 24px", verticalAlign: "top", width: "55%" }}>
              <Text style={label}>Date</Text>
              <Text style={value}>{day}</Text>
            </td>
            <td style={{ padding: "16px 24px 24px 12px", verticalAlign: "top" }}>
              <Text style={label}>Time</Text>
              <Text style={value}>{time}</Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}
