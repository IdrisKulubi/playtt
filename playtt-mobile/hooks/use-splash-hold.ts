import { useLayoutEffect } from "react"

import { useSplashScreenGate } from "@/components/splash-screen-provider"

export function useSplashHold(active: boolean, key: string) {
  const { hold, release } = useSplashScreenGate()

  useLayoutEffect(() => {
    if (!active) {
      return
    }

    hold(key)

    return () => {
      release(key)
    }
  }, [active, hold, key, release])
}
