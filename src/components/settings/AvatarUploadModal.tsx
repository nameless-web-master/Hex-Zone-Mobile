import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/theme/colors";

type Mode = "chooser" | "camera" | "gallery" | "crop";

function buildGalleryHtml(options: { multiple: boolean; maxCount: number }) {
  const multiple = options.multiple;
  const maxCount = Math.max(1, Math.min(5, Math.floor(options.maxCount)));
  const multipleAttr = multiple ? " multiple" : "";
  const lead = multiple
    ? `Select up to ${maxCount} photos at once.`
    : "Pick an existing photo from your device library.";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      background: #F4F7FB;
      color: #0F2C5C;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 360px;
      background: #fff;
      border: 1px solid #D7E2F0;
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #566784; margin: 0 0 16px; line-height: 1.4; }
    button {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 700;
      background: #2F80ED;
      color: #fff;
    }
    button:disabled { opacity: 0.6; }
    .hint { margin-top: 12px; font-size: 11px; color: #8A9BB5; }
    input { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Choose from gallery</h1>
    <p>${lead}</p>
    <input id="file" type="file" accept="image/*"${multipleAttr} />
    <button id="pick" type="button">Browse photos</button>
    <div class="hint" id="status"></div>
  </div>
  <script>
    (function () {
      var multiple = ${multiple ? "true" : "false"};
      var maxCount = ${maxCount};
      var input = document.getElementById('file');
      var button = document.getElementById('pick');
      var status = document.getElementById('status');
      function post(msg) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }
      function setStatus(text) { status.textContent = text || ''; }
      function readFiles(list) {
        var files = [];
        for (var i = 0; i < (list ? list.length : 0); i++) {
          var f = list[i];
          if (f && String(f.type || '').startsWith('image/')) files.push(f);
        }
        if (!files.length) {
          post({ type: 'error', message: 'Please choose image files.' });
          return;
        }
        if (files.length > maxCount) files = files.slice(0, maxCount);
        button.disabled = true;
        setStatus(files.length > 1 ? ('Preparing ' + files.length + ' photos…') : 'Preparing image…');
        var results = [];
        var idx = 0;
        function next() {
          if (idx >= files.length) {
            button.disabled = false;
            setStatus('');
            if (multiple) {
              for (var p = 0; p < results.length; p++) {
                post({ type: 'image_item', dataUrl: results[p], index: p, total: results.length });
              }
              post({ type: 'images_done', total: results.length });
            } else post({
              type: 'image',
              dataUrl: results[0] || '',
              mime: files[0] && files[0].type || 'image/jpeg',
              name: files[0] && files[0].name || 'avatar.jpg'
            });
            return;
          }
          var file = files[idx++];
          if (file.size > 8 * 1024 * 1024) {
            button.disabled = false;
            setStatus('');
            post({ type: 'error', message: 'One image is too large (max about 8 MB).' });
            return;
          }
          var reader = new FileReader();
          reader.onerror = function () {
            button.disabled = false;
            setStatus('');
            post({ type: 'error', message: 'Could not read that image.' });
          };
          reader.onload = function () {
            var dataUrl = String(reader.result || '');
            if (dataUrl) results.push(dataUrl);
            next();
          };
          reader.readAsDataURL(file);
        }
        next();
      }
      button.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () { readFiles(input.files); });
      setTimeout(function () { input.click(); }, 250);
    })();
  </script>
</body>
</html>`;
}

/** Stage-only crop UI. Zoom / Use photo live in native footer so they stay visible. */
function buildCropHtml(dataUrl: string): string {
  const srcJson = JSON.stringify(dataUrl);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-user-select: none; user-select: none; }
    html, body {
      margin: 0; height: 100%; width: 100%;
      background: #111827;
      overflow: hidden;
    }
    #stage {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      touch-action: none;
      background: #111827;
    }
    #img {
      position: absolute;
      top: 0; left: 0;
      will-change: transform;
      transform-origin: 0 0;
      pointer-events: none;
    }
    #ring {
      position: absolute;
      border: 2px solid rgba(255,255,255,0.95);
      border-radius: 50%;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);
      pointer-events: none;
    }
    #hint {
      position: absolute;
      left: 12px; right: 12px; bottom: 14px;
      text-align: center;
      font-size: 12px;
      color: rgba(255,255,255,0.9);
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
    }
  </style>
</head>
<body>
  <div id="stage">
    <img id="img" alt="" />
    <div id="ring"></div>
    <div id="hint">Drag to move · pinch to zoom</div>
  </div>
  <script>
    (function () {
      var OUT = 512;
      var MIN_SCALE = 1;
      var MAX_SCALE = 4;
      var stage = document.getElementById('stage');
      var img = document.getElementById('img');
      var ring = document.getElementById('ring');
      var scale = 1;
      var offsetX = 0;
      var offsetY = 0;
      var cropSize = 280;
      var ready = false;
      var pointers = {};
      var pinchStartDist = 0;
      var pinchStartScale = 1;
      var dragStart = null;

      function post(msg) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }

      function layoutRing() {
        var sw = stage.clientWidth || window.innerWidth;
        var sh = stage.clientHeight || window.innerHeight;
        cropSize = Math.min(sw, sh) * 0.78;
        ring.style.width = cropSize + 'px';
        ring.style.height = cropSize + 'px';
        ring.style.left = ((sw - cropSize) / 2) + 'px';
        ring.style.top = ((sh - cropSize) / 2) + 'px';
      }

      function coverScale() {
        if (!img.naturalWidth || !img.naturalHeight) return 1;
        return Math.max(cropSize / img.naturalWidth, cropSize / img.naturalHeight);
      }

      function clampOffsets() {
        if (!ready) return;
        var base = coverScale() * scale;
        var dispW = img.naturalWidth * base;
        var dispH = img.naturalHeight * base;
        var sw = stage.clientWidth;
        var sh = stage.clientHeight;
        var cropL = (sw - cropSize) / 2;
        var cropT = (sh - cropSize) / 2;
        var cropR = cropL + cropSize;
        var cropB = cropT + cropSize;
        var left = (sw - dispW) / 2 + offsetX;
        var top = (sh - dispH) / 2 + offsetY;
        var maxLeft = cropL;
        var minLeft = cropR - dispW;
        var maxTop = cropT;
        var minTop = cropB - dispH;
        if (left > maxLeft) offsetX += maxLeft - left;
        if (left < minLeft) offsetX += minLeft - left;
        if (top > maxTop) offsetY += maxTop - top;
        if (top < minTop) offsetY += minTop - top;
      }

      function apply() {
        if (!ready) return;
        layoutRing();
        clampOffsets();
        var base = coverScale() * scale;
        var sw = stage.clientWidth;
        var sh = stage.clientHeight;
        var left = (sw - img.naturalWidth * base) / 2 + offsetX;
        var top = (sh - img.naturalHeight * base) / 2 + offsetY;
        img.style.width = (img.naturalWidth * base) + 'px';
        img.style.height = (img.naturalHeight * base) + 'px';
        img.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      }

      function zoomBy(factor, cx, cy) {
        if (!ready) return;
        var prev = scale;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
        if (scale === prev) return;
        var sw = stage.clientWidth;
        var sh = stage.clientHeight;
        var fx = (typeof cx === 'number') ? cx : sw / 2;
        var fy = (typeof cy === 'number') ? cy : sh / 2;
        var ratio = scale / prev;
        offsetX = fx - sw / 2 - (fx - sw / 2 - offsetX) * ratio;
        offsetY = fy - sh / 2 - (fy - sh / 2 - offsetY) * ratio;
        apply();
      }

      function exportCrop() {
        if (!ready) {
          post({ type: 'error', message: 'Image is still loading.' });
          return;
        }
        try {
          layoutRing();
          clampOffsets();
          var base = coverScale() * scale;
          var sw = stage.clientWidth;
          var sh = stage.clientHeight;
          var left = (sw - img.naturalWidth * base) / 2 + offsetX;
          var top = (sh - img.naturalHeight * base) / 2 + offsetY;
          var cropL = (sw - cropSize) / 2;
          var cropT = (sh - cropSize) / 2;
          var sx = (cropL - left) / base;
          var sy = (cropT - top) / base;
          var swSrc = cropSize / base;
          var shSrc = cropSize / base;
          var canvas = document.createElement('canvas');
          canvas.width = OUT;
          canvas.height = OUT;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, OUT, OUT);
          ctx.drawImage(img, sx, sy, swSrc, shSrc, 0, 0, OUT, OUT);
          post({ type: 'cropped', dataUrl: canvas.toDataURL('image/jpeg', 0.88) });
        } catch (e) {
          post({ type: 'error', message: 'Could not clip that photo.' });
        }
      }

      window.__cropZoomIn = function () { zoomBy(1.18); };
      window.__cropZoomOut = function () { zoomBy(1 / 1.18); };
      window.__cropExport = exportCrop;

      function dist(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
      function pointerList() {
        return Object.keys(pointers).map(function (k) { return pointers[k]; });
      }

      stage.addEventListener('pointerdown', function (e) {
        stage.setPointerCapture(e.pointerId);
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var list = pointerList();
        if (list.length === 1) {
          dragStart = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
        } else if (list.length === 2) {
          pinchStartDist = dist(list[0], list[1]);
          pinchStartScale = scale;
          dragStart = null;
        }
      });
      stage.addEventListener('pointermove', function (e) {
        if (!pointers[e.pointerId]) return;
        pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var list = pointerList();
        if (list.length === 2) {
          var d = dist(list[0], list[1]);
          if (pinchStartDist > 0) {
            var rect = stage.getBoundingClientRect();
            var midX = (list[0].x + list[1].x) / 2 - rect.left;
            var midY = (list[0].y + list[1].y) / 2 - rect.top;
            var next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartScale * (d / pinchStartDist)));
            var factor = next / scale;
            if (factor !== 1) zoomBy(factor, midX, midY);
            pinchStartDist = d;
            pinchStartScale = scale;
          }
        } else if (list.length === 1 && dragStart) {
          offsetX = dragStart.ox + (e.clientX - dragStart.x);
          offsetY = dragStart.oy + (e.clientY - dragStart.y);
          apply();
        }
      });
      function endPointer(e) {
        delete pointers[e.pointerId];
        var list = pointerList();
        if (list.length === 1) {
          dragStart = { x: list[0].x, y: list[0].y, ox: offsetX, oy: offsetY };
          pinchStartDist = 0;
        } else {
          dragStart = null;
          pinchStartDist = 0;
        }
      }
      stage.addEventListener('pointerup', endPointer);
      stage.addEventListener('pointercancel', endPointer);
      window.addEventListener('resize', apply);

      img.onload = function () {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        ready = true;
        apply();
        post({ type: 'crop_image_ready' });
      };
      img.onerror = function () {
        post({ type: 'error', message: 'Could not load image for cropping.' });
      };
      layoutRing();
      img.src = ${srcJson};
    })();
  </script>
</body>
</html>`;
}

type AvatarUploadModalProps = {
  visible: boolean;
  uploading?: boolean;
  onClose: () => void;
  onImageSelected: (dataUrl: string) => void;
  /** Used when the gallery allows multi-select (chat photos). */
  onImagesSelected?: (dataUrls: string[]) => void;
  onError?: (message: string) => void;
  /** Skip circular crop (chat photos). */
  skipCrop?: boolean;
  /** Max photos to accept from gallery. Defaults to 1. */
  maxSelection?: number;
  chooserTitle?: string;
  chooserLead?: string;
};

export function AvatarUploadModal({
  visible,
  uploading = false,
  onClose,
  onImageSelected,
  onImagesSelected,
  onError,
  skipCrop = false,
  maxSelection = 1,
  chooserTitle,
  chooserLead,
}: AvatarUploadModalProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const cropWebRef = useRef<WebView>(null);
  const handledRef = useRef(false);
  const pendingImagesRef = useRef<string[]>([]);
  const [mode, setMode] = useState<Mode>("chooser");
  const [galleryReady, setGalleryReady] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImageReady, setCropImageReady] = useState(false);
  const [clipping, setClipping] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const cropHtml = useMemo(
    () => (cropSource ? buildCropHtml(cropSource) : null),
    [cropSource],
  );
  const allowMultiple = skipCrop && maxSelection > 1;
  const galleryHtml = useMemo(
    () =>
      buildGalleryHtml({
        multiple: allowMultiple,
        maxCount: allowMultiple ? maxSelection : 1,
      }),
    [allowMultiple, maxSelection],
  );

  useEffect(() => {
    if (!visible) {
      setMode("chooser");
      setGalleryReady(false);
      setCropSource(null);
      setCropImageReady(false);
      setClipping(false);
      setCapturing(false);
      handledRef.current = false;
      pendingImagesRef.current = [];
    }
  }, [visible]);

  const emitCropped = (dataUrl: string) => {
    if (handledRef.current || uploading) return;
    handledRef.current = true;
    setClipping(false);
    onImageSelected(dataUrl);
  };

  const emitImages = (dataUrls: string[]) => {
    if (handledRef.current || uploading) return;
    const cleaned = dataUrls
      .filter((url) => typeof url === "string" && url.startsWith("data:image/"))
      .slice(0, Math.max(1, maxSelection));
    if (!cleaned.length) return;
    handledRef.current = true;
    setClipping(false);
    if (onImagesSelected) onImagesSelected(cleaned);
    else onImageSelected(cleaned[0]);
  };

  const openCrop = (dataUrl: string) => {
    if (skipCrop) {
      emitCropped(dataUrl);
      return;
    }
    handledRef.current = false;
    setCropImageReady(false);
    setClipping(false);
    setCropSource(dataUrl);
    setMode("crop");
  };

  const openCamera = async () => {
    handledRef.current = false;
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        onError?.(
          "Camera permission is required to take a profile photo. You can still browse the gallery.",
        );
        return;
      }
    }
    setMode("camera");
  };

  const takePhoto = async () => {
    if (capturing || uploading || handledRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.65,
        base64: true,
        exif: false,
        shutterSound: false,
      });
      if (!photo?.base64) {
        onError?.("Could not capture photo. Try again.");
        return;
      }
      openCrop(`data:image/jpeg;base64,${photo.base64}`);
    } catch {
      onError?.("Could not capture photo. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  const runCropCommand = (fn: "__cropZoomIn" | "__cropZoomOut" | "__cropExport") => {
    cropWebRef.current?.injectJavaScript(
      `try { window.${fn} && window.${fn}(); } catch (e) {} true;`,
    );
  };

  const onUsePhoto = () => {
    if (!cropImageReady || clipping || uploading) return;
    setClipping(true);
    runCropCommand("__cropExport");
  };

  const onWebMessage = (event: WebViewMessageEvent) => {
    if (uploading) return;
    try {
      const raw = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        dataUrl?: string;
        dataUrls?: unknown;
        message?: string;
      };
      if (raw.type === "error") {
        setClipping(false);
        onError?.(raw.message || "Could not process image.");
        return;
      }
      if (raw.type === "crop_image_ready") {
        setCropImageReady(true);
        return;
      }
      if (raw.type === "images" && Array.isArray(raw.dataUrls)) {
        emitImages(
          raw.dataUrls.filter((item): item is string => typeof item === "string"),
        );
        return;
      }
      if (raw.type === "image_item" && typeof raw.dataUrl === "string" && raw.dataUrl) {
        pendingImagesRef.current.push(raw.dataUrl);
        return;
      }
      if (raw.type === "images_done") {
        const batch = pendingImagesRef.current;
        pendingImagesRef.current = [];
        emitImages(batch);
        return;
      }
      if (raw.type === "image" && typeof raw.dataUrl === "string" && raw.dataUrl) {
        openCrop(raw.dataUrl);
        return;
      }
      if (
        raw.type === "cropped" &&
        typeof raw.dataUrl === "string" &&
        raw.dataUrl
      ) {
        emitCropped(raw.dataUrl);
      }
    } catch {
      setClipping(false);
      onError?.("Could not read the selected image.");
    }
  };

  const goBack = () => {
    if (uploading || capturing || clipping) return;
    handledRef.current = false;
    if (mode === "crop") {
      setCropSource(null);
      setCropImageReady(false);
      setMode("chooser");
      return;
    }
    setMode("chooser");
  };

  const title =
    mode === "camera"
      ? "Take photo"
      : mode === "gallery"
        ? "Browse gallery"
        : mode === "crop"
          ? "Clip photo"
          : chooserTitle || "Upload avatar";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          {mode !== "chooser" ? (
            <Pressable
              onPress={goBack}
              hitSlop={8}
              disabled={uploading || capturing || clipping}
            >
              <Text style={styles.close}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ width: 52 }} />
          )}
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            disabled={uploading || clipping}
          >
            <Text style={styles.close}>{uploading ? "…" : "Close"}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {uploading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Uploading to image host…</Text>
            </View>
          ) : null}

          {!uploading && mode === "chooser" ? (
            <View style={styles.chooser}>
              <Text style={styles.chooserLead}>
                {chooserLead ||
                  "Take a photo or choose from gallery, then clip the part you want for your avatar."}
              </Text>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => void openCamera()}
              >
                <Text style={styles.primaryBtnText}>Take photo</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  handledRef.current = false;
                  pendingImagesRef.current = [];
                  setGalleryReady(false);
                  setMode("gallery");
                }}
              >
                <Text style={styles.secondaryBtnText}>Browse gallery</Text>
              </Pressable>
            </View>
          ) : null}

          {!uploading && mode === "camera" ? (
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                mode="picture"
              />
              <View style={styles.cameraControls}>
                <Pressable
                  style={[
                    styles.shutter,
                    capturing && styles.shutterDisabled,
                  ]}
                  onPress={() => void takePhoto()}
                  disabled={capturing}
                >
                  {capturing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.shutterInner} />
                  )}
                </Pressable>
                <Text style={styles.cameraHint}>
                  Tap the shutter, then clip your avatar
                </Text>
              </View>
            </View>
          ) : null}

          {!uploading && mode === "gallery" ? (
            <View style={styles.body}>
              {!galleryReady ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.loadingText}>Opening gallery…</Text>
                </View>
              ) : null}
              <WebView
                originWhitelist={["*"]}
                source={{ html: galleryHtml }}
                onLoadEnd={() => setGalleryReady(true)}
                onMessage={onWebMessage}
                style={[styles.web, !galleryReady && styles.webHidden]}
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

          {!uploading && mode === "crop" && cropHtml ? (
            <View style={styles.cropRoot}>
              <View style={styles.cropStage}>
                {!cropImageReady ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.loadingText}>Preparing clip…</Text>
                  </View>
                ) : null}
                <WebView
                  ref={cropWebRef}
                  originWhitelist={["*"]}
                  source={{ html: cropHtml }}
                  onMessage={onWebMessage}
                  style={styles.web}
                  javaScriptEnabled
                  domStorageEnabled
                  setSupportMultipleWindows={false}
                  scrollEnabled={false}
                  bounces={false}
                  overScrollMode="never"
                />
              </View>

              <View style={styles.cropFooter}>
                <Text style={styles.cropHint}>
                  Move the circle over the part you want, then tap Use photo.
                </Text>
                <View style={styles.cropActions}>
                  <Pressable
                    style={styles.zoomBtn}
                    onPress={() => runCropCommand("__cropZoomOut")}
                    disabled={!cropImageReady || clipping}
                  >
                    <Text style={styles.zoomBtnText}>−</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.useBtn,
                      (!cropImageReady || clipping) && styles.useBtnDisabled,
                    ]}
                    onPress={onUsePhoto}
                    disabled={!cropImageReady || clipping}
                  >
                    {clipping ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.useBtnText}>Use photo</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.zoomBtn}
                    onPress={() => runCropCommand("__cropZoomIn")}
                    disabled={!cropImageReady || clipping}
                  >
                    <Text style={styles.zoomBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  close: { color: colors.accent, fontSize: 15, fontWeight: "700", minWidth: 52 },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: "#111827" },
  webHidden: { opacity: 0 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 2,
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  chooser: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 12,
  },
  chooserLead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  cameraWrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  cameraControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 36,
    paddingTop: 20,
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  cameraHint: { color: "#fff", fontSize: 12, fontWeight: "600" },
  cropRoot: { flex: 1 },
  cropStage: { flex: 1, backgroundColor: "#111827" },
  cropFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  cropHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  cropActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
  },
  useBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  useBtnDisabled: { opacity: 0.55 },
  useBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
