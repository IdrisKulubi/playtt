import { router } from "expo-router"

export const AUTHENTICATED_HOME = "/(app)/(tabs)"
export const ONBOARDING_ROUTE = "/onboarding"

export function goToAuthenticatedHome() {
  router.replace(AUTHENTICATED_HOME)
}

export function goToOnboarding() {
  router.replace(ONBOARDING_ROUTE)
}

export function goToSignIn() {
  router.replace("/?mode=sign-in")
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
