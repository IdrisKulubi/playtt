// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'figure.table.tennis': 'sports-tennis',
  'person.crop.circle.fill': 'account-circle',
  'location.fill': 'place',
  'qrcode': 'qr-code-2',
  'clock.fill': 'schedule',
  'sparkles': 'auto-awesome',
  'exclamationmark.triangle.fill': 'warning',
  'minus': 'remove',
  'plus': 'add',
  'checkmark': 'check',
  'arrow.up': 'arrow-upward',
  'arrow.down': 'arrow-downward',
  'film.stack': 'video-library',
  'cart.fill': 'shopping-cart',
  'bubble.left.and.bubble.right.fill': 'forum',
  'person.badge.plus': 'person-add',
  'pencil': 'edit',
  'bell.fill': 'notifications',
  'person.text.rectangle': 'badge',
  'lock.fill': 'lock',
  'questionmark.circle.fill': 'help',
  'doc.text.fill': 'description',
  'paintpalette.fill': 'palette',
  'rectangle.portrait.and.arrow.right': 'logout',
  'paperplane.fill': 'send',
  calendar: 'event',
  'chart.bar.fill': 'bar-chart',
  'person.fill': 'person',
  'book.fill': 'menu-book',
  'person.2.fill': 'people',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'play.circle.fill': 'play-circle-filled',
  'chevron.left': 'arrow-back',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'info.circle.fill': 'info',
  xmark: 'close',
  'square.and.arrow.up': 'share',
  'arrow.down.circle.fill': 'file-download',
  link: 'link',
  ellipsis: 'more-horiz',
  'star.fill': 'star',
  'arrow.right': 'arrow-forward',
  'chevron.down': 'expand-more',
  'slider.horizontal.3': 'tune',
  'trophy.fill': 'emoji-events',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
