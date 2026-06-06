const DEFAULT_API_URL = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  return configured || DEFAULT_API_URL;
  
}
