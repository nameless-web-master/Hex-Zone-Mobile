import { useState } from "react";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { colors } from "@/theme/colors";

type MessageImageGalleryProps = {
  uris: string[];
  /** Edge-to-edge inside a padded card (18px). */
  bleed?: boolean;
  /** Compact compose preview. */
  compact?: boolean;
  onRemove?: (index: number) => void;
};

export function MessageImageGallery({
  uris,
  bleed = false,
  compact = false,
  onRemove,
}: MessageImageGalleryProps) {
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  if (!uris.length) return null;

  const frameHeight = compact ? 200 : 220;
  const multi = uris.length > 1;
  const ready = pageWidth > 0;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const clamped = Math.max(0, Math.min(uris.length - 1, next));
    if (clamped !== page) setPage(clamped);
  };

  return (
    <View
      style={{
        marginHorizontal: bleed ? -18 : 0,
        marginTop: compact ? 10 : 2,
        flexShrink: 0,
      }}
    >
      <View
        style={{
          height: frameHeight,
          width: "100%",
          overflow: "hidden",
          borderRadius: bleed ? 0 : 14,
          backgroundColor: "#0B1A33",
          flexShrink: 0,
        }}
        onLayout={(event) => {
          const w = Math.round(event.nativeEvent.layout.width);
          if (w > 0 && w !== pageWidth) setPageWidth(w);
        }}
      >
        {ready ? (
          <ScrollView
            horizontal
            pagingEnabled={multi}
            scrollEnabled={multi}
            nestedScrollEnabled
            directionalLockEnabled
            disableIntervalMomentum={multi}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ height: frameHeight, width: pageWidth }}
            contentContainerStyle={{ height: frameHeight }}
          >
            {uris.map((uri, index) => (
              <View
                key={`${index}-${uri.length}`}
                style={{
                  width: pageWidth,
                  height: frameHeight,
                  backgroundColor: "#0B1A33",
                }}
              >
                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  style={{ width: pageWidth, height: frameHeight }}
                />
                {onRemove ? (
                  <Pressable
                    onPress={() => onRemove(index)}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: "rgba(15,44,92,0.72)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    accessibilityLabel="Remove photo"
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
        {multi && ready ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 10,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {uris.map((_, index) => (
              <View
                key={index}
                style={{
                  width: page === index ? 16 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor:
                    page === index ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
        ) : null}
        {multi && compact && ready ? (
          <Text
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              color: "#fff",
              fontSize: 11,
              fontWeight: "700",
              backgroundColor: "rgba(15,44,92,0.72)",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {page + 1}/{uris.length}
          </Text>
        ) : null}
      </View>
      {onRemove ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: "600",
            marginTop: 8,
            marginHorizontal: bleed ? 18 : 0,
          }}
        >
          {uris.length} of 5 photos{multi ? " · swipe to review" : ""}
        </Text>
      ) : null}
    </View>
  );
}
