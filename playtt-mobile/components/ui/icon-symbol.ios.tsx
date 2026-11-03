import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { Platform, StyleProp, ViewStyle } from 'react-native';

/**
 * SF Symbols that only exist from iOS 17, with an older look-alike.
 * Without this, the symbol renders blank on iOS 16 and earlier.
 */
const IOS_17_FALLBACKS: Partial<Record<string, SymbolViewProps['name']>> = {
  'figure.table.tennis': 'sportscourt.fill',
};

const iosMajor = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;

function resolveSymbol(name: SymbolViewProps['name']): SymbolViewProps['name'] {
  if (iosMajor >= 17 || typeof name !== 'string') return name;
  return IOS_17_FALLBACKS[name] ?? name;
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={resolveSymbol(name)}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
