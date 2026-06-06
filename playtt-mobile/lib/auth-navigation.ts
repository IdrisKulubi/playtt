import { router } from 'expo-router';

export const AUTHENTICATED_HOME = '/(app)/(tabs)';

export function goToAuthenticatedHome() {
  router.replace(AUTHENTICATED_HOME);
}

export function goToSignIn() {
  router.replace('/sign-in');
}

export function goToVerifyEmail(email: string) {
  router.replace({
    pathname: '/verify-email',
    params: { email },
  });
}
