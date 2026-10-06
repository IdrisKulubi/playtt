import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export function AuthBackdrop() {
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 420 900" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="auth-depth" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#008cba" />
            <Stop offset="0.28" stopColor="#006e9d" />
            <Stop offset="0.58" stopColor="#064e7c" />
            <Stop offset="1" stopColor="#031b36" />
          </LinearGradient>
          <RadialGradient id="auth-cyan" cx="335" cy="25" rx="310" ry="320" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#12afe3" stopOpacity="0.9" />
            <Stop offset="0.45" stopColor="#12afe3" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#12afe3" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="auth-current" cx="130" cy="125" rx="350" ry="175" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#d3fbff" stopOpacity="0.65" />
            <Stop offset="0.4" stopColor="#52daf8" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#12afe3" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="auth-undercurrent" cx="0" cy="640" rx="350" ry="340" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#12afe3" stopOpacity="0.23" />
            <Stop offset="1" stopColor="#12afe3" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="auth-vignette" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#02152b" stopOpacity="0" />
            <Stop offset="0.24" stopColor="#02152b" stopOpacity="0.22" />
            <Stop offset="0.48" stopColor="#02152b" stopOpacity="0.18" />
            <Stop offset="0.7" stopColor="#02152b" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#02152b" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Rect width="420" height="900" fill="url(#auth-depth)" />
        <Rect width="420" height="900" fill="url(#auth-cyan)" />
        <Path d="M -80 45 C 80 30 140 210 300 230 C 390 243 458 195 520 155 L 520 260 C 395 320 302 315 220 265 C 95 185 80 95 -80 115 Z" fill="url(#auth-current)" opacity="0.6" />
        <Path d="M -80 70 C 95 75 143 231 304 250 C 405 260 465 210 520 182 L 520 202 C 420 270 347 287 263 260 C 127 215 88 95 -80 87 Z" fill="url(#auth-current)" />
        <Rect width="420" height="900" fill="url(#auth-undercurrent)" />
        <Rect width="420" height="900" fill="url(#auth-vignette)" />
      </Svg>
    </View>
  );
}
