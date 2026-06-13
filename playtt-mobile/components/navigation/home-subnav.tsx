import { ScreenSubnav } from "@/components/navigation/screen-subnav"

export type HomeTab = "play" | "coach"

type HomeSubnavProps = {
  value: HomeTab
  onChange: (value: HomeTab) => void
}

const TABS: { value: HomeTab; label: string }[] = [
  { value: "play", label: "Play" },
  { value: "coach", label: "Coach" },
]

export function HomeSubnav({ value, onChange }: HomeSubnavProps) {
  return <ScreenSubnav value={value} options={TABS} onChange={onChange} />
}
