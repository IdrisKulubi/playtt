import { router } from 'expo-router';

export const AUTHENTICATED_HOME = '/(app)/(tabs)';

export function goToAuthenticatedHome() {
  router.replace(AUTHENTICATED_HOME);
}
