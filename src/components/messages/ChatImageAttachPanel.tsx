import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { buildGalleryHtml } from "@/lib/galleryPickerHtml";
import { colors } from "@/theme/colors";

type Mode = "chooser" | "gallery" | "camera";

type ChatImageAttachPanelProps = {
  maxSelection: number;
  onCancel: () => void;
  onImagesSelected: (dataUrls: string[]) => void;
  onError: (message: string) => void;
};

/**
 * In-sheet photo attach UI (no second RCT Modal, no expo-image-picker).
 * Uses WebView file input + expo-camera — both already linked in the dev client.
 */
export function ChatImageAttachPanel({
  maxSelection,
  onCancel,
  onImagesSelected,
  onError,
}: ChatImageAttachPanelProps) {
  const cameraRef = useRef<CameraView>(null);
  const handledRef = useRef(false);
  const [mode, setMode] = useState<Mode>("chooser");
  const [galleryReady, setGalleryReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const limit = Math.max(1, Math.min(5, maxSelection));
  const galleryHtml = useMemo(
    () =>
      buildGalleryHtml({
        multiple: limit > 1,
        maxCount: limit,
        streamResults: true,
      }),
    [limit],
  );

  const emit = (dataUrls: string[]) => {
    if (handledRef.current) return;
    const cleaned = dataUrls
      .filter((url) => typeof url === "string" && url.startsWith("data:image/"))
      .slice(0, limit);
    if (!cleaned.length) {
      setPreparing(false);
      onError("Could not prepare those photos. Try a smaller image.");
      return;
    }
    handledRef.current = true;
    setPreparing(false);
    onImagesSelected(cleaned);
  };

  const openCamera = async () => {
    handledRef.current = false;
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        onError("Camera permission is required to take a photo.");
        return;
      }
    }
    setMode("camera");
  };

  const takePhoto = async () => {
    if (capturing || handledRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.45,
        base64: true,
        exif: false,
        shutterSound: false,
      });
      if (!photo?.base64) {
        onError("Could not capture photo. Try again.");
        return;
      }
      emit([`data:image/jpeg;base64,${photo.base64}`]);
    } catch {
      onError("Could not capture photo. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  const onWebMessage = (event: WebViewMessageEvent) => {
    try {
      const raw = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        dataUrls?: unknown;
        message?: string;
      };
      if (raw.type === "preparing" || raw.type === "progress") {
        setPreparing(true);
        return;
      }
      if (raw.type === "error") {
        setPreparing(false);
        onError(raw.message || "Could not process image.");
        return;
      }
      if (raw.type === "images" && Array.isArray(raw.dataUrls)) {
        emit(
          raw.dataUrls.filter((item): item is string => typeof item === "string"),
        );
      }
    } catch {
      setPreparing(false);
      onError("Could not read the selected image.");
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mode === "camera"
            ? "Take photo"
            : mode === "gallery"
              ? "Browse gallery"
              : "Add photos"}
        </Text>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      {mode === "chooser" ? (
        <View style={styles.chooser}>
          <Pressable style={styles.primaryBtn} onPress={() => void openCamera()}>
            <Text style={styles.primaryBtnText}>Take photo</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              handledRef.current = false;
              setGalleryReady(false);
              setMode("gallery");
            }}
          >
            <Text style={styles.secondaryBtnText}>Browse gallery</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === "gallery" ? (
        <View style={styles.galleryWrap}>
          {!galleryReady || preparing ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>
                {preparing ? "Preparing photos…" : "Opening gallery…"}
              </Text>
            </View>
          ) : null}
          <WebView
            originWhitelist={["*"]}
            source={{ html: galleryHtml }}
            onLoadEnd={() => setGalleryReady(true)}
            onMessage={onWebMessage}
            style={[styles.web, (!galleryReady || preparing) && styles.webHidden]}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
          />
        </View>
      ) : null}

      {mode === "camera" ? (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="picture"
          />
          <Pressable
            style={[styles.shutter, capturing && styles.shutterDisabled]}
            onPress={() => void takePhoto()}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  cancel: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  chooser: { padding: 14, gap: 10 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  galleryWrap: { height: 280, position: "relative" },
  web: { flex: 1, backgroundColor: "transparent" },
  webHidden: { opacity: 0 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 2,
    backgroundColor: colors.bgCard,
  },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  cameraWrap: { height: 320, backgroundColor: "#111" },
  camera: { flex: 1 },
  shutter: {
    position: "absolute",
    alignSelf: "center",
    bottom: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
});
