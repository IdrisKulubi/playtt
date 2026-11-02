import { type Href, router } from "expo-router"
import type { ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { Screen } from "@/components/kit/screen"
import { AppText } from "@/components/ui/app-text"

const ME_HREF = "/(app)/(tabs)/account" as Href

type AccountStackScreenProps = {
  title: string
  description?: string
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  /** Where back goes; every Me sub-screen returns to Me. */
  backLabel?: string
}

/** Me sub-screens: large title, "< Me" back button, content on the shared theme. */
export function AccountStackScreen({
  title,
  description,
  children,
  contentContainerStyle,
  backLabel = "Me",
}: AccountStackScreenProps) {
  return (
    <Screen
      title={title}
      back={{
        label: backLabel,
        onPress: () => (router.canGoBack() ? router.back() : router.replace(ME_HREF)),
      }}
      contentContainerStyle={contentContainerStyle}
    >
      {description ? (
        <AppText variant="body" color="secondaryLabel">
          {description}
        </AppText>
      ) : null}
      {children}
    </Screen>
  )
}
