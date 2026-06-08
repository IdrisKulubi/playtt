export const PlayTTColors = {
  primary: '#00b7ff',
  primaryForeground: '#041019',
  primaryGlow: 'rgba(0, 183, 255, 0.26)',
  background: '#07111d',
  backgroundElevated: '#0b1627',
  card: '#101b2b',
  border: '#203149',
  input: '#162336',
  mutedText: '#92a6bf',
  foreground: '#ffffff',
  destructive: '#ff3b30',
  success: '#00ff66',
  warning: '#ffb800',
  // Light product surface (auth/booking)
  productBackground: '#f5f7fa',
  productElevated: '#eef2f7',
  productCard: '#ffffff',
  productForeground: '#0a1628',
  productMuted: '#5a6b82',
  productBorder: '#d8e0ea',
  productInput: '#ffffff',
  productFocusRing: 'rgba(0, 183, 255, 0.35)',
} as const;

export const PlayTTSpacing = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const PlayTTRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  field: 20,
  card: 28,
  panel: 32,
  pill: 9999,
} as const;

export const PlayTTTypography = {
  display: {
    fontSize: 36,
    fontWeight: '600' as const,
    lineHeight: 38,
    letterSpacing: -0.72,
  },
  headline: {
    fontSize: 28,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: -0.42,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 23,
    letterSpacing: -0.18,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 26,
    letterSpacing: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
    letterSpacing: 0.14,
  },
} as const;

export const PlayTTElevation = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 48,
    elevation: 8,
  },
  panel: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.32,
    shadowRadius: 90,
    elevation: 12,
  },
  productCard: {
    shadowColor: '#0a1628',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
} as const;

export const PlayTTFontFamily = 'SpaceGrotesk_600SemiBold';

export const PlayTTFontFamilies = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
} as const;
