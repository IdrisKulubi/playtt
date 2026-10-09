import { router } from "expo-router"

import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountStackScreen } from "@/components/account/account-stack-screen"
import { ChangePasswordForm } from "@/components/account/change-password-form"

export default function ChangePasswordScreen() {
  return (
    <AccountStackScreen
      title="Change password"
      description="Enter your current password, then choose a new one with at least 8 characters."
    >
      <AccountGlassSection>
        <ChangePasswordForm onSaved={() => router.back()} />
      </AccountGlassSection>
    </AccountStackScreen>
  )
}
