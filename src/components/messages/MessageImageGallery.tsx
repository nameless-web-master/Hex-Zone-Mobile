import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { useFullscreenImageRotation } from "@/lib/useFullscreenImageRotation";

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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const fullscreenRef = useRef<ScrollView>(null);
  const rotation = useFullscreenImageRotation(fullscreenOpen);
  const landscape = rotation === 90;

  useEffect(() => {
    if (!fullscreenOpen) return;
    requestAnimationFrame(() => {
      fullscreenRef.current?.scrollTo({
        x: fullscreenIndex * windowWidth,
        animated: false,
      });
    });
  }, [fullscreenOpen, windowWidth]);

  if (!uris.length) return null;

  const frameHeight = compact ? 200 : 220;
  const multi = uris.length > 1;
  const ready = pageWidth > 0;

  const syncPageFromScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    width: number,
  ) => {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    const clamped = Math.max(0, Math.min(uris.length - 1, next));
    return clamped;
  };

  const onInlineScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = syncPageFromScroll(event, pageWidth);
    if (next !== undefined && next !== page) setPage(next);
  };

  const onFullscreenScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = syncPageFromScroll(event, windowWidth);
    if (next !== undefined && next !== fullscreenIndex) setFullscreenIndex(next);
  };

  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenOpen(true);
  };

  return (
    <>
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
              onMomentumScrollEnd={onInlineScroll}
              onScroll={onInlineScroll}
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
                  <Pressable
                    onPress={() => openFullscreen(index)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`View photo ${index + 1} full screen`}
                    style={{ width: pageWidth, height: frameHeight }}
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      style={{ width: pageWidth, height: frameHeight }}
                    />
                  </Pressable>
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
            {uris.length} of 5 photos
            {multi ? " · swipe to review · tap to enlarge" : " · tap to enlarge"}
          </Text>
        ) : multi ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 11,
              fontWeight: "600",
              marginTop: 6,
              marginHorizontal: bleed ? 18 : 0,
            }}
          >
            Tap to view full screen
          </Text>
        ) : null}
      </View>

      <Modal
        visible={fullscreenOpen}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setFullscreenOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.96)",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
              {uris.length > 1
                ? `${fullscreenIndex + 1} / ${uris.length}`
                : "Photo"}
            </Text>
            <Pressable
              onPress={() => setFullscreenOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close full screen photo"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            ref={fullscreenRef}
            horizontal
            pagingEnabled={multi}
            scrollEnabled={multi}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onFullscreenScroll}
            onScroll={onFullscreenScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            contentContainerStyle={{
              alignItems: "center",
              minHeight: windowHeight - insets.top - insets.bottom - 56,
            }}
          >
            {uris.map((uri, index) => {
              const portraitW = windowWidth;
              const portraitH = windowHeight - insets.top - insets.bottom - 56;
              const imageW = landscape ? portraitH : portraitW;
              const imageH = landscape ? portraitW : portraitH;
              return (
                <View
                  key={`fs-${index}-${uri.length}`}
                  style={{
                    width: windowWidth,
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: portraitH,
                  }}
                >
                  <Image
                    source={{ uri }}
                    resizeMode="contain"
                    style={{
                      width: imageW,
                      height: imageH,
                      transform: [{ rotate: `${rotation}deg` }],
                    }}
                  />
                </View>
              );
            })}
          </ScrollView>

          {multi ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: insets.bottom + 16,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {uris.map((_, index) => (
                <View
                  key={`fs-dot-${index}`}
                  style={{
                    width: fullscreenIndex === index ? 16 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor:
                      fullscreenIndex === index
                        ? "#FFFFFF"
                        : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
