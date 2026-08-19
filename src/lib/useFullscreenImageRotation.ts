import { useWindowDimensions } from "react-native";

/**
 * Detect landscape vs portrait from window dimensions.
 * Works in Expo Go without any native sensor modules.
 * Returns 0 for portrait, 90 for landscape.
 */
export function useFullscreenImageRotation(enabled: boolean): 0 | 90 {
  const { width, height } = useWindowDimensions();
  if (!enabled) return 0;
  return width > height ? 90 : 0;
}
