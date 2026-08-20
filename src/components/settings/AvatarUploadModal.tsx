import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/theme/colors";

/** Wait for an iOS modal / picker presentation to finish dismissing. */
function waitForPresentationSettle(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type Mode = "chooser" | "camera" | "gallery" | "crop";

function buildGalleryHtml(options: {
  multiple: boolean;
  maxCount: number;
  /** Chat photos: always stream compressed items (avoids iOS freeze on 1 image). */
  streamResults: boolean;
}) {
  const multiple = options.multiple;
  const maxCount = Math.max(1, Math.min(5, Math.floor(options.maxCount)));
  const streamResults = options.streamResults;
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
      var streamResults = ${streamResults ? "true" : "false"};
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
      function isImageFile(file) {
        var type = String(file && file.type || '').toLowerCase();
        if (type.indexOf('image/') === 0) return true;
        var name = String(file && file.name || '').toLowerCase();
        return /\\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/.test(name);
      }
      function drawJpeg(source, done) {
        try {
          var maxEdge = streamResults ? 720 : 960;
          var quality = streamResults ? 0.55 : 0.62;
          var w = source.naturalWidth || source.width || 0;
          var h = source.naturalHeight || source.height || 0;
          if (!w || !h) { done(''); return; }
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          if (!ctx) { done(''); return; }
          ctx.drawImage(source, 0, 0, cw, ch);
          var dataUrl = canvas.toDataURL('image/jpeg', quality);
          canvas.width = 1;
          canvas.height = 1;
          done(dataUrl);
        } catch (e) {
          done('');
        }
      }
      function compressFile(file, done) {
        var finished = false;
        function finish(dataUrl) {
          if (finished) return;
          finished = true;
          done(dataUrl);
        }
        function fromElement(el) {
          requestAnimationFrame(function () { drawJpeg(el, finish); });
        }
        function drawFromBitmap(bitmap) {
          requestAnimationFrame(function () {
            drawJpeg(bitmap, function (dataUrl) {
              try { bitmap.close && bitmap.close(); } catch (e) {}
              finish(dataUrl);
            });
          });
        }
        if (typeof createImageBitmap === 'function') {
          // Decode-time resize is critical for a single iPhone photo (HEIC).
          // Falling back to a full-resolution decode freezes WKWebView.
          if (streamResults) {
            createImageBitmap(file, {
              resizeWidth: 720,
              resizeHeight: 720,
              resizeQuality: 'medium'
            }).then(drawFromBitmap).catch(function () {
              // Older WebViews may reject resize opts — try plain decode
              // only for small files; otherwise fail soft.
              if (file.size && file.size > 2 * 1024 * 1024) {
                finish('');
                return;
              }
              createImageBitmap(file).then(drawFromBitmap).catch(function () {
                loadViaObjectUrl(file, fromElement, finish);
              });
            });
            return;
          }
          createImageBitmap(file).then(drawFromBitmap).catch(function () {
            loadViaObjectUrl(file, fromElement, finish);
          });
          return;
        }
        loadViaObjectUrl(file, fromElement, finish);
      }
      function loadViaObjectUrl(file, onReady, fail) {
        var img = new Image();
        var objectUrl = '';
        img.onload = function () {
          requestAnimationFrame(function () {
            onReady(img);
            try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch (e) {}
          });
        };
        img.onerror = function () {
          try { if (objectUrl) URL.revokeObjectURL(objectUrl); } catch (e) {}
          // Never FileReader-decode large originals on iOS — that freezes WKWebView.
          fail('');
        };
        try {
          objectUrl = URL.createObjectURL(file);
          img.src = objectUrl;
        } catch (e) {
          fail('');
        }
      }
      function readFiles(list) {
        var files = [];
        for (var i = 0; i < (list ? list.length : 0); i++) {
          var f = list[i];
          if (f && isImageFile(f)) files.push(f);
        }
        if (!files.length) {
          post({ type: 'error', message: 'Please choose image files.' });
          return;
        }
        if (files.length > maxCount) files = files.slice(0, maxCount);
        button.disabled = true;
        setStatus(files.length > 1 ? ('Preparing ' + files.length + ' photos…') : 'Preparing image…');
        post({ type: 'preparing', total: files.length });
        var results = [];
        var idx = 0;
        function finishAll() {
          button.disabled = false;
          setStatus('');
          if (!results.length) {
            post({ type: 'error', message: 'Could not prepare those photos on this device. Try a smaller photo.' });
            return;
          }
          // Chat: one final message with already-compressed JPEGs.
          // Do NOT stream each dataUrl via image_item — a single full-size
          // postMessage was freezing iOS when only 1 photo was picked.
          if (streamResults) {
            post({ type: 'images', dataUrls: results, total: results.length });
          } else {
            post({
              type: 'image',
              dataUrl: results[0] || '',
              mime: 'image/jpeg',
              name: (files[0] && files[0].name) || 'photo.jpg'
            });
          }
        }
        function next() {
          if (idx >= files.length) {
            setTimeout(finishAll, streamResults ? 80 : 0);
            return;
          }
          setStatus('Preparing photo ' + (idx + 1) + ' of ' + files.length + '…');
          // Progress only — no dataUrl payload (keeps the bridge light).
          if (streamResults) {
            post({ type: 'progress', index: idx, total: files.length });
          }
          compressFile(files[idx], function (dataUrl) {
            if (dataUrl) results.push(dataUrl);
            idx += 1;
            setTimeout(next, streamResults ? 60 : 40);
          });
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
  const pickingGalleryRef = useRef(false);
  const [mode, setMode] = useState<Mode>("chooser");
  const [galleryReady, setGalleryReady] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropImageReady, setCropImageReady] = useState(false);
  const [clipping, setClipping] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
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
        maxCount: Math.max(1, maxSelection),
        // Chat attachments must always stream (1 or many). The single
        // `image` postMessage path freezes WKWebView on iOS.
        streamResults: skipCrop,
      }),
    [allowMultiple, maxSelection, skipCrop],
  );

  useEffect(() => {
    if (visible) {
      // Fresh open after a native-gallery pick that closed us early.
      setMode("chooser");
      setGalleryReady(false);
      setCropSource(null);
      setCropImageReady(false);
      setClipping(false);
      setCapturing(false);
      setPreparingPhotos(false);
      handledRef.current = false;
      pendingImagesRef.current = [];
      return;
    }
    // Native gallery intentionally closes this Modal before PHPicker opens.
    // Do not wipe pick state mid-flight or the in-progress selection is aborted.
    if (pickingGalleryRef.current) return;
    setMode("chooser");
    setGalleryReady(false);
    setCropSource(null);
    setCropImageReady(false);
    setClipping(false);
    setCapturing(false);
    setPreparingPhotos(false);
    handledRef.current = false;
    pendingImagesRef.current = [];
  }, [visible]);

  const emitCropped = (dataUrl: string) => {
    if (handledRef.current || uploading) return;
    handledRef.current = true;
    setClipping(false);
    setPreparingPhotos(false);
    InteractionManager.runAfterInteractions(() => {
      onImageSelected(dataUrl);
    });
  };

  const emitImages = (dataUrls: string[]) => {
    if (handledRef.current || uploading) return;
    const cleaned = dataUrls
      .filter((url) => typeof url === "string" && url.startsWith("data:image/"))
      .slice(0, Math.max(1, maxSelection));
    if (!cleaned.length) {
      setPreparingPhotos(false);
      onError?.("Could not prepare those photos. Try a smaller image.");
      return;
    }
    handledRef.current = true;
    setClipping(false);
    setPreparingPhotos(false);
    InteractionManager.runAfterInteractions(() => {
      if (onImagesSelected) onImagesSelected(cleaned);
      else onImageSelected(cleaned[0]);
    });
  };

  const openCrop = (dataUrl: string) => {
    if (skipCrop) {
      emitImages([dataUrl]);
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

  /**
   * Chat attachments use the native PHPicker / Android picker.
   *
   * iOS freezes if we stack or tear down RCT Modal while PHPicker is still
   * presenting/dismissing ("Attempt to present RCTFabricModalHostViewController
   * while a presentation is in progress"). Single-image picks finish processing
   * faster than multi, so they hit that race; multi often "worked" by accident.
   *
   * Flow: close our Modal → wait → open picker → wait → hand images to parent.
   */
  const openNativeGallery = async () => {
    if (
      uploading ||
      preparingPhotos ||
      pickingGalleryRef.current ||
      handledRef.current
    ) {
      return;
    }
    handledRef.current = false;
    pendingImagesRef.current = [];
    pickingGalleryRef.current = true;

    const settleMs = Platform.OS === "ios" ? 450 : 80;

    try {
      if (Platform.OS !== "web") {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync();
        let granted = current.granted;
        if (!granted && current.canAskAgain) {
          const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
          granted = asked.granted;
        }
        if (!granted) {
          pickingGalleryRef.current = false;
          onError?.(
            "Photo library permission is required to attach images.",
          );
          return;
        }
      }

      // 1) Dismiss AvatarUploadModal BEFORE presenting PHPicker.
      onClose();
      await waitForPresentationSettle(settleMs);

      const limit = Math.max(1, Math.min(5, maxSelection));
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: limit,
        quality: 1,
        base64: false,
        exif: false,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      // 2) Wait for PHPicker dismiss — do not touch any Modal until this settles.
      await waitForPresentationSettle(settleMs);

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const dataUrls: string[] = [];
      for (const asset of result.assets.slice(0, limit)) {
        if (!asset.uri) continue;
        try {
          const width = asset.width || 0;
          const height = asset.height || 0;
          const longEdge = Math.max(width, height);
          const actions =
            longEdge > 1280
              ? [
                  {
                    resize:
                      width >= height
                        ? { width: 1280 }
                        : { height: 1280 },
                  },
                ]
              : [];
          const prepared = await ImageManipulator.manipulateAsync(
            asset.uri,
            actions,
            {
              compress: 0.55,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          );
          if (prepared.base64) {
            dataUrls.push(`data:image/jpeg;base64,${prepared.base64}`);
          }
        } catch {
          // Skip this asset; try the rest.
        }
      }

      if (!dataUrls.length) {
        onError?.(
          "Could not read those photos. Try again or pick a smaller image.",
        );
        return;
      }

      // Modal is already closed — deliver images only (no Modal present/dismiss).
      const cleaned = dataUrls
        .filter((url) => url.startsWith("data:image/"))
        .slice(0, Math.max(1, maxSelection));
      if (!cleaned.length) {
        onError?.("Could not prepare those photos. Try a smaller image.");
        return;
      }
      handledRef.current = true;
      if (onImagesSelected) onImagesSelected(cleaned);
      else onImageSelected(cleaned[0]);
    } catch {
      onError?.("Could not open the photo library. Try again.");
    } finally {
      pickingGalleryRef.current = false;
    }
  };

  const takePhoto = async () => {
    if (capturing || uploading || handledRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: skipCrop ? 0.7 : 0.65,
        base64: !skipCrop,
        exif: false,
        shutterSound: false,
      });
      if (!photo?.uri && !photo?.base64) {
        onError?.("Could not capture photo. Try again.");
        return;
      }
      if (skipCrop) {
        if (!photo?.uri) {
          onError?.("Could not capture photo. Try again.");
          return;
        }
        setPreparingPhotos(true);
        const width = photo.width || 0;
        const height = photo.height || 0;
        const longEdge = Math.max(width, height);
        const actions =
          longEdge > 1280
            ? [
                {
                  resize:
                    width >= height ? { width: 1280 } : { height: 1280 },
                },
              ]
            : [];
        const prepared = await ImageManipulator.manipulateAsync(
          photo.uri,
          actions,
          {
            compress: 0.55,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        setPreparingPhotos(false);
        if (!prepared.base64) {
          onError?.("Could not prepare that photo. Try again.");
          return;
        }
        emitImages([`data:image/jpeg;base64,${prepared.base64}`]);
      } else {
        const dataUrl = `data:image/jpeg;base64,${photo!.base64}`;
        openCrop(dataUrl);
      }
    } catch {
      setPreparingPhotos(false);
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
      if (raw.type === "preparing" || raw.type === "progress") {
        setPreparingPhotos(true);
        return;
      }
      if (raw.type === "error") {
        setClipping(false);
        setPreparingPhotos(false);
        onError?.(raw.message || "Could not process image.");
        return;
      }
      if (raw.type === "crop_image_ready") {
        setCropImageReady(true);
        return;
      }
      if (raw.type === "images" && Array.isArray(raw.dataUrls)) {
        pendingImagesRef.current = [];
        emitImages(
          raw.dataUrls.filter((item): item is string => typeof item === "string"),
        );
        return;
      }
      // Legacy stream path (kept for safety if an older WebView bundle is cached).
      if (raw.type === "image_item" && typeof raw.dataUrl === "string" && raw.dataUrl) {
        pendingImagesRef.current.push(raw.dataUrl);
        return;
      }
      if (raw.type === "images_done") {
        const batch = pendingImagesRef.current;
        pendingImagesRef.current = [];
        setTimeout(() => emitImages(batch), 50);
        return;
      }
      if (raw.type === "image" && typeof raw.dataUrl === "string" && raw.dataUrl) {
        if (skipCrop) {
          emitImages([raw.dataUrl]);
        } else {
          openCrop(raw.dataUrl);
        }
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
      setPreparingPhotos(false);
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
                disabled={preparingPhotos}
              >
                <Text style={styles.primaryBtnText}>Take photo</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                disabled={preparingPhotos}
                onPress={() => {
                  if (skipCrop) {
                    void openNativeGallery();
                    return;
                  }
                  handledRef.current = false;
                  pendingImagesRef.current = [];
                  setGalleryReady(false);
                  setMode("gallery");
                }}
              >
                <Text style={styles.secondaryBtnText}>Browse gallery</Text>
              </Pressable>
              {preparingPhotos ? (
                <View style={[styles.loading, { marginTop: 18 }]}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.loadingText}>Preparing photos…</Text>
                </View>
              ) : null}
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
              {preparingPhotos ? (
                <View style={[styles.loading, styles.preparingOverlay]}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.loadingText}>Preparing photos…</Text>
                </View>
              ) : null}
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
  preparingOverlay: {
    zIndex: 4,
    backgroundColor: "rgba(244,247,251,0.92)",
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
