import { router } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

type AccountScreenHeaderProps = {
  title: string
}

export function AccountScreenHeader({ title }: AccountScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PlayTTSpacing.lg,
    paddingTop: PlayTTSpacing.sm,
  },
  back: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  spacer: {
    width: 40,
  },
})
