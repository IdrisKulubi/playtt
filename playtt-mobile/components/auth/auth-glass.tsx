import { BlurView } from 'expo-blur';
import { createContext, useContext, useId, type RefObject } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const AuthGlassContext = createContext<{
  target: RefObject<View | null> | undefined;
  reduceTransparency: boolean;
}>({ target: undefined, reduceTransparency: false });

/** Decorative layer; the parent owns clipping and all interaction. */
export function AuthGlass({ luminous = false }: { luminous?: boolean }) {
  const { target, reduceTransparency } = useContext(AuthGlassContext);
  const gradientId = `glass-${useId().replace(/:/g, '')}`;
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      {!reduceTransparency && !luminous ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          tint="dark"
          intensity={12}
          blurTarget={target}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : 'none'}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: luminous ? '#12afe3' : '#164f73' }]} />
      )}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.15" y2="1">
            <Stop offset="0" stopColor="#d6f8ff" stopOpacity={luminous ? 0.72 : 0.3} />
            <Stop offset="0.28" stopColor="#49d3f6" stopOpacity={luminous ? 0.22 : 0.16} />
            <Stop offset="0.72" stopColor="#12afe3" stopOpacity={luminous ? 0.06 : 0.06} />
            <Stop offset="1" stopColor="#9beeff" stopOpacity={luminous ? 0.35 : 0.22} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
