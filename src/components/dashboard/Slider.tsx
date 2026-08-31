import { useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  Text,
  View,
} from "react-native";
import { colors } from "@/theme/colors";

type Props = {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
  color?: string;
};

/**
 * Lightweight slider that doesn't pull in @react-native-community/slider —
 * good enough for a single-finger drag on the dashboard's compact UI.
 */
export function CompactSlider({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
  color = colors.accent,
}: Props) {
  const [width, setWidth] = useState(0);
  const ratio = width > 0 ? (value - min) / (max - min) : 0;
  const safeRatio = Math.max(0, Math.min(1, ratio));

  const update = (locationX: number) => {
    if (width <= 0) return;
    const next = min + (locationX / width) * (max - min);
    const stepped = Math.round(next / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    onChange(clamped);
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) =>
      update(e.nativeEvent.locationX),
    onPanResponderMove: (e: GestureResponderEvent) =>
      update(e.nativeEvent.locationX),
  });

  return (
    <View>
      {label ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {label}
          {"  "}
          <Text style={{ color }}>
            {formatValue ? formatValue(value) : value}
          </Text>
        </Text>
      ) : null}
      <View
        {...responder.panHandlers}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 30, justifyContent: "center" }}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.bgSurface,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${safeRatio * 100}%`,
              height: 4,
              backgroundColor: color,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${safeRatio * 100}%`,
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      </View>
    </View>
  );
}

type VerticalProps = Props & {
  /** Track height in px. */
  height?: number;
};

/** Vertical slider for map overlays (e.g. proximity radius above the FAB). */
export function VerticalCompactSlider({
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
  color = colors.accent,
  height = 140,
}: VerticalProps) {
  const trackHRef = useRef(height);
  const [trackH, setTrackH] = useState(height);
  const ratio = trackH > 0 ? (value - min) / (max - min) : 0;
  const safeRatio = Math.max(0, Math.min(1, ratio));
  /** Top = max, bottom = min. */
  const thumbFromTop = (1 - safeRatio) * trackH;

  const boundsRef = useRef({ min, max, step, onChange });
  boundsRef.current = { min, max, step, onChange };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const h = trackHRef.current;
          if (h <= 0) return;
          const { min: lo, max: hi, step: st, onChange: cb } =
            boundsRef.current;
          const fromBottom = 1 - e.nativeEvent.locationY / h;
          const next = lo + fromBottom * (hi - lo);
          const stepped = Math.round(next / st) * st;
          cb(Math.max(lo, Math.min(hi, stepped)));
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const h = trackHRef.current;
          if (h <= 0) return;
          const { min: lo, max: hi, step: st, onChange: cb } =
            boundsRef.current;
          const fromBottom = 1 - e.nativeEvent.locationY / h;
          const next = lo + fromBottom * (hi - lo);
          const stepped = Math.round(next / st) * st;
          cb(Math.max(lo, Math.min(hi, stepped)));
        },
      }),
    [],
  );

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Text
        style={{
          color,
          fontSize: 11,
          fontWeight: "800",
        }}
      >
        {formatValue ? formatValue(value) : value}
      </Text>
      <View
        {...responder.panHandlers}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          trackHRef.current = h;
          setTrackH(h);
        }}
        style={{
          width: 36,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 4,
            height: "100%",
            borderRadius: 2,
            backgroundColor: colors.bgSurface,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${safeRatio * 100}%`,
              backgroundColor: color,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: thumbFromTop - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      </View>
    </View>
  );
}
