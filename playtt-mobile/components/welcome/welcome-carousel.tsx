import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewToken,
} from "react-native"

import { WelcomeBall } from "@/components/welcome/illustrations/welcome-ball"
import { WelcomePaddles } from "@/components/welcome/illustrations/welcome-paddles"
import { WelcomeTable } from "@/components/welcome/illustrations/welcome-table"
import { WelcomeUnlock } from "@/components/welcome/illustrations/welcome-unlock"
import {
  WelcomeSlide,
  type WelcomeSlideData,
} from "@/components/welcome/welcome-slide"

const SLIDES: WelcomeSlideData[] = [
  {
    id: "welcome",
    headline: "Private table tennis, on your schedule.",
    body: "Premium self-serve pods you book and walk into — no front desk.",
    illustration: <WelcomeBall />,
  },
  {
    id: "book",
    headline: "Book in seconds.",
    body: "Pick a time, see the price upfront, and pay with M-Pesa.",
    illustration: <WelcomeTable />,
  },
  {
    id: "access",
    headline: "Walk right in.",
    body: "When it's time, unlock your pod from the app — no keys, no waiting.",
    illustration: <WelcomeUnlock />,
  },
  {
    id: "play",
    headline: "Every session counts.",
    body: "Track scores, save replays, and improve with Coach.",
    illustration: <WelcomePaddles />,
  },
]

type WelcomeCarouselProps = {
  onIndexChange?: (index: number) => void
}

export function WelcomeCarousel({ onIndexChange }: WelcomeCarouselProps) {
  const { width } = useWindowDimensions()
  const [reduceMotion, setReduceMotion] = useState(false)
  const lastIndexRef = useRef(0)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  const notifyIndexChange = useCallback(
    (index: number) => {
      if (index === lastIndexRef.current) {
        return
      }

      lastIndexRef.current = index
      onIndexChange?.(index)

      if (!reduceMotion && process.env.EXPO_OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    },
    [onIndexChange, reduceMotion],
  )

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const index = viewableItems[0]?.index
      if (index != null) {
        notifyIndexChange(index)
      }
    },
    [notifyIndexChange],
  )

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current

  return (
    <View style={styles.container}>
      <FlatList
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <WelcomeSlide slide={item} width={width} />
        )}
        onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width)
          notifyIndexChange(index)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
