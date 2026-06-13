import * as SplashScreen from "expo-splash-screen"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type SplashScreenContextValue = {
  hold: (key: string) => void
  release: (key: string) => void
}

const SplashScreenContext = createContext<SplashScreenContextValue | null>(null)

type SplashScreenProviderProps = {
  fontsReady: boolean
  children: ReactNode
}

export function SplashScreenProvider({
  fontsReady,
  children,
}: SplashScreenProviderProps) {
  const [holders, setHolders] = useState<Set<string>>(() => new Set())

  const hold = useCallback((key: string) => {
    setHolders((current) => {
      if (current.has(key)) {
        return current
      }

      const next = new Set(current)
      next.add(key)
      return next
    })
  }, [])

  const release = useCallback((key: string) => {
    setHolders((current) => {
      if (!current.has(key)) {
        return current
      }

      const next = new Set(current)
      next.delete(key)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      hold,
      release,
    }),
    [hold, release],
  )

  useEffect(() => {
    if (fontsReady && holders.size === 0) {
      void SplashScreen.hideAsync()
    }
  }, [fontsReady, holders.size])

  return (
    <SplashScreenContext.Provider value={value}>
      {children}
    </SplashScreenContext.Provider>
  )
}

export function useSplashScreenGate() {
  const context = useContext(SplashScreenContext)

  if (!context) {
    throw new Error("useSplashScreenGate must be used within SplashScreenProvider")
  }

  return context
}
