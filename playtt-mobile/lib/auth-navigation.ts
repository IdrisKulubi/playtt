import { router } from "expo-router"

export const AUTHENTICATED_HOME = "/(app)/(tabs)"

export function goToAuthenticatedHome() {
  router.replace(AUTHENTICATED_HOME)
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
