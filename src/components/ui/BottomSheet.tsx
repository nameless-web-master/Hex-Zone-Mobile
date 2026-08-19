import { type ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme/colors";

const SLIDE_MS = 280;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: number | `${number}%`;
  contentStyle?: ViewStyle;
  overlayColor?: string;
};

/**
 * Overlay paints immediately (Modal animationType none). Only the sheet
 * panel slides. The dimmed region is a flex spacer above the sheet, so
 * backdrop taps are not covered by the panel's hit box.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = "88%",
  contentStyle,
  overlayColor = "rgba(15, 44, 92, 0.4)",
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      translateY.setValue(windowHeight);
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!visible) {
      translateY.setValue(windowHeight);
    }
    wasVisible.current = visible;
  }, [visible, windowHeight, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: overlayColor }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.backdrop}
        />
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight, transform: [{ translateY }] },
            contentStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
});
