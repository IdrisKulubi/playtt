export function formatAuthError(message: string): string {
  if (message.includes('Network request failed')) {
    return 'Cannot reach the PlayTT server. Check EXPO_PUBLIC_API_URL in playtt-mobile/.env.';
  }

  return message;
}
