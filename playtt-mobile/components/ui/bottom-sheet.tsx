import type { ReactNode } from "react"

import { Sheet } from "@/components/kit/sheet"

type BottomSheetProps = {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** @deprecated Sheets follow the phone's light/dark setting now. */
  surface?: "product" | "dark"
  scrollable?: boolean
}

/**
 * Compatibility wrapper: every older sheet now renders the kit `Sheet`
 * (Apple-style physics, Close button, shared theme), sized to its content.
 * New code should use `Sheet` from `components/kit/sheet` directly.
 */
export function BottomSheet({ visible, title, onClose, children, scrollable = false }: BottomSheetProps) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose} detents={["content"]} scrollable={scrollable}>
      {children}
    </Sheet>
  )
}
