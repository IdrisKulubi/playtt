import { router } from "expo-router"

import { setHasSeenWelcome } from "@/lib/welcome-storage"

export const AUTHENTICATED_HOME = "/(app)/(tabs)"
export const ONBOARDING_ROUTE = "/onboarding"
export const WELCOME_ROUTE = "/welcome"

export function goToAuthenticatedHome() {
  router.replace(AUTHENTICATED_HOME)
}

export function goToOnboarding() {
  router.replace(ONBOARDING_ROUTE)
}

export function goToSignIn() {
  router.replace("/?mode=sign-in")
}

export function goToSignUp() {
  router.replace("/?mode=sign-up")
}

export function goToWelcome(replay = false) {
  router.push(replay ? `${WELCOME_ROUTE}?replay=1` : WELCOME_ROUTE)
}

export async function completeWelcomeSignUp(replay = false) {
  if (!replay) {
    await setHasSeenWelcome()
  }
  goToSignUp()
}

export async function completeWelcomeSignIn(replay = false) {
  if (!replay) {
    await setHasSeenWelcome()
  }
  goToSignIn()
}

export function goToResetPassword() {
  router.replace("/reset-password" as never)
}

export function goToVerifyEmail(email: string) {
  router.replace({
    pathname: "/verify-email",
    params: { email },
  })
}

export function goToResetPasswordConfirm(email: string) {
  router.replace({
    pathname: "/reset-password/confirm",
    params: { email },
  })
}
