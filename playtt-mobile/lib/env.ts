const DEFAULT_API_URL = 'https://www.theplaytt.com';

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  const base = configured || DEFAULT_API_URL;
  return base.replace(/\/+$/, '');
}
