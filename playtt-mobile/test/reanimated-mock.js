// Minimal react-native-reanimated stand-in for Jest. The package's own
// `react-native-reanimated/mock` fails to initialise under jest-expo 58
// (setCSSEventHandler is missing in JSReanimated), so tests that render
// animated components use this instead:
//   jest.mock("react-native-reanimated", () => require("@/test/reanimated-mock"))
const { View, ScrollView, FlatList, Text, Image } = require("react-native")

function layoutAnimation() {
  const builder = {
    delay: () => builder,
    duration: () => builder,
    springify: () => builder,
    easing: () => builder,
  }
  return builder
}

const identity = (value) => value
const easingFn = () => identity

module.exports = {
  __esModule: true,
  default: { View, ScrollView, FlatList, Text, Image, createAnimatedComponent: identity },
  createAnimatedComponent: identity,
  useSharedValue: (initial) => {
    const shared = { value: initial }
    shared.get = () => shared.value
    shared.set = (next) => {
      shared.value = typeof next === "function" ? next(shared.value) : next
    }
    return shared
  },
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useAnimatedScrollHandler: () => undefined,
  useDerivedValue: (fn) => ({ value: fn() }),
  useReducedMotion: () => false,
  cancelAnimation: () => undefined,
  runOnJS: identity,
  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay, value) => value,
  withRepeat: identity,
  withSequence: (...values) => values[values.length - 1],
  interpolate: (_value, _input, output) => output[0],
  Easing: {
    linear: identity,
    quad: identity,
    cubic: identity,
    in: easingFn,
    out: easingFn,
    inOut: easingFn,
    bezier: easingFn,
  },
  FadeIn: layoutAnimation(),
  FadeInDown: layoutAnimation(),
  FadeOut: layoutAnimation(),
  SlideInDown: layoutAnimation(),
}
