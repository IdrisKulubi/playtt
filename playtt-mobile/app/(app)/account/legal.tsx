import { useMemo } from "react"
import { StyleSheet, Text } from "react-native"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountStackScreen } from "@/components/account/account-stack-screen"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export default function LegalScreen() {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        heading: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        body: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 20,
          marginTop: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  return (
    <AccountStackScreen
      title="Legal"
      description="Terms and privacy for your PlayTT account."
    >
      <AccountGlassSection>
        <Text style={styles.heading}>Terms of service</Text>
        <Text style={styles.body}>
          Full terms will be published at theplaytt.com/terms. By using PlayTT
          you agree to book in good faith and arrive on time for paid sessions.
        </Text>
      </AccountGlassSection>

      <AccountGlassSection>
        <Text style={styles.heading}>Privacy policy</Text>
        <Text style={styles.body}>
          Full privacy details will be published at theplaytt.com/privacy. We
          use your contact details for bookings and account security only.
        </Text>
      </AccountGlassSection>
    </AccountStackScreen>
  )
}
