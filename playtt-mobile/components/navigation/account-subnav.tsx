import { ScreenSubnav } from "@/components/navigation/screen-subnav"

export type AccountTab = "account" | "settings"

type AccountSubnavProps = {
  value: AccountTab
  onChange: (value: AccountTab) => void
}

const TABS: { value: AccountTab; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "settings", label: "Settings" },
]

export function AccountSubnav({ value, onChange }: AccountSubnavProps) {
  return <ScreenSubnav value={value} options={TABS} onChange={onChange} />
}
