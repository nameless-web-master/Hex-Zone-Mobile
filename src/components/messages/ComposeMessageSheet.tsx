import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Send } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { MessageImageGallery } from "@/components/messages/MessageImageGallery";
import { useAuth } from "@/context/AuthContext";
import { useMessagesFeed } from "@/hooks/useMessagesFeed";
import { useBottomSafeInset } from "@/hooks/useBottomSafeInset";
import { sendMessage } from "@/api/messages";
import { uploadMessageImage } from "@/api/settings";
import {
  propagateMessageFeatureMessage,
  searchPrivateMessageRecipients,
  type PrivateSearchMember,
} from "@/api/messageFeature";
import { listGuestRequests } from "@/api/guest";
import { presentLocalMessageNotification } from "@/lib/notifications";
import {
  privateLocationStatusMessage,
  type PrivateLocationStatus,
} from "@/lib/privateMessageLocation";
import {
  messagePositionSourceLabel,
  resolveMessagePropagationPositionForType,
} from "@/lib/messagePosition";
import { getOrCreateDeviceHid } from "@/lib/storage";
import {
  groupMessageTypesForUI,
  isAccessGuestChannelType,
  isPrivateMessageType,
  toMessageTypeLabel,
  usesGeoPropagationMessageType,
  type MessageType,
} from "@/lib/messageTypes";
import { resolveBroadcastName } from "@/lib/appSettings";
import { MAX_MESSAGE_IMAGES } from "@/lib/messageImages";
import {
  isEmergencyMessageType,
} from "@/lib/messageWorkflow";
import {
  SERVICE_PA_TOPICS,
  buildServicePaMsgPayload,
  getTopicOption,
  isServicePaMessageType,
  serviceTopicRequiresSubtopic,
  validateServicePaCompose,
  type ServicePaComposeFields,
} from "@/lib/servicePaTopics";
import { colors } from "@/theme/colors";

function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Resize + JPEG-compress a picked asset into a data URL for upload/preview. */
async function prepareChatImageDataUrl(asset: {
  uri: string;
  width?: number;
  height?: number;
}): Promise<string | null> {
  if (!asset.uri) return null;
  const width = asset.width || 0;
  const height = asset.height || 0;
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
  const prepared = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.55,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return prepared.base64 ? `data:image/jpeg;base64,${prepared.base64}` : null;
}

export function ComposeMessageSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const bottomInset = useBottomSafeInset();
  const {
    refresh,
    applyGeoPropagationToInbox,
    ownerId,
    zoneId,
  } = useMessagesFeed();

  const selfRealName =
    (user?.name ?? "").trim() ||
    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const selfBroadcastName = resolveBroadcastName(selfRealName || user?.name);

  const [composeType, setComposeType] = useState<MessageType>("PA");
  const [composeReceiverId, setComposeReceiverId] = useState("");
  const [draft, setDraft] = useState("");
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const pickingImagesRef = useRef(false);
  const [composeServicePaFields, setComposeServicePaFields] =
    useState<ServicePaComposeFields>({ subject: "", topic: "", subtopic: "" });
  const [sending, setSending] = useState(false);
  const [composeStatus, setComposeStatus] = useState("");
  const [privateSearchQuery, setPrivateSearchQuery] = useState("");
  const [privateSearchResults, setPrivateSearchResults] = useState<
    PrivateSearchMember[]
  >([]);
  const [privateSearchLoading, setPrivateSearchLoading] = useState(false);
  const [senderZoneIds, setSenderZoneIds] = useState<string[]>([]);
  const [privateLocationStatus, setPrivateLocationStatus] =
    useState<PrivateLocationStatus | null>(null);
  const [guestOptions, setGuestOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [loadingComposeMeta, setLoadingComposeMeta] = useState(false);
  const composeScrollRef = useRef<ScrollView>(null);

  const scrollComposeFieldIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      composeScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const composeZoneId = useMemo(
    () => (zoneId?.trim() ? zoneId.trim() : null),
    [zoneId],
  );

  const groupedTypeOptions = useMemo(() => groupMessageTypesForUI(), []);
  const composeTypeOptions = useMemo(
    () =>
      groupedTypeOptions
        .map((group) => ({
          ...group,
          options: group.options.filter((o) => o.type !== "PERMISSION"),
        }))
        .filter((group) => group.options.length > 0),
    [groupedTypeOptions],
  );

  useEffect(() => {
    if (!visible) return;
    setComposeType("PA");
    setDraft("");
    setComposeImages([]);
    setComposeServicePaFields({ subject: "", topic: "", subtopic: "" });
    setComposeStatus("");
    setComposeReceiverId("");
    setPrivateSearchQuery("");
    pickingImagesRef.current = false;
    setPrivateSearchResults([]);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoadingComposeMeta(true);
    void (
      composeZoneId
        ? listGuestRequests(composeZoneId)
        : Promise.resolve({ data: [], error: null, loading: false })
    )
      .then((guestsRes) => {
        if (!active) return;
        const guestRows = guestsRes.data ?? [];
        setGuestOptions(
          guestRows
            .filter((g) => g.approval_status !== "REJECTED")
            .map((g) => ({
              id: g.guest_id,
              label: `${g.guest_name?.trim() || "Guest"} — ${g.guest_id.slice(0, 10)}…`,
            })),
        );
      })
      .finally(() => {
        if (active) setLoadingComposeMeta(false);
      });
    return () => { active = false; };
  }, [visible, composeZoneId]);

  useEffect(() => {
    if (!visible || !isPrivateMessageType(composeType)) {
      if (!isPrivateMessageType(composeType)) {
        setSenderZoneIds([]);
        setPrivateLocationStatus(null);
        setPrivateSearchResults([]);
      }
      return;
    }
    let active = true;
    setPrivateSearchLoading(true);
    const debounceMs = privateSearchQuery.trim().length >= 2 ? 300 : 0;
    const timer = setTimeout(() => {
      void (async () => {
        const resolved = await resolveMessagePropagationPositionForType(
          "PRIVATE",
          user?.mapCenter ?? user?.map_center ?? null,
        );
        const position = "error" in resolved ? undefined : resolved.position;
        const result = await searchPrivateMessageRecipients(
          privateSearchQuery,
          position,
        );
        if (!active) return;
        setPrivateSearchLoading(false);
        setSenderZoneIds(result.data?.zone_ids ?? []);
        setPrivateLocationStatus(result.data?.location_status ?? null);
        setPrivateSearchResults(result.data?.members ?? []);
      })();
    }, debounceMs);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, composeType, privateSearchQuery, user?.mapCenter, user?.map_center]);

  useEffect(() => {
    setComposeReceiverId("");
    setComposeStatus("");
    setPrivateSearchQuery("");
    setPrivateSearchResults([]);
  }, [composeType]);

  useEffect(() => {
    if (composeType !== "PERMISSION") return;
    setComposeType("CHAT");
    setComposeStatus("PERMISSION is system-generated; switched to CHAT for guest messaging.");
  }, [composeType]);

  const confirmEmergencySend = useCallback(
    (type: MessageType): Promise<boolean> =>
      new Promise((resolve) => {
        if (!isEmergencyMessageType(type)) { resolve(true); return; }
        Alert.alert(
          "Emergency alert",
          `${toMessageTypeLabel(type)} uses your current location. Inside the admin primary zone, all invited members and the administrator are notified; outside the primary zone, no one receives it. Block filters are bypassed.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Send", style: "destructive", onPress: () => resolve(true) },
          ],
        );
      }),
    [],
  );

  const closeAll = useCallback(() => {
    onClose();
  }, [onClose]);

  const attachPreparedImages = useCallback((dataUrls: string[]) => {
    if (!dataUrls.length) return;
    setComposeStatus("");
    setComposeImages((prev) =>
      [...prev, ...dataUrls].slice(0, MAX_MESSAGE_IMAGES),
    );
  }, []);

  /**
   * Pick chat photos without a second RCT Modal.
   * BottomSheet stays open; only the system picker presents/dismisses.
   * (Toggling BottomSheet ↔ AvatarUploadModal caused the iOS freeze:
   * "Attempt to present RCTFabricModalHostViewController while a
   * presentation is in progress".)
   */
  const pickChatImages = useCallback(
    async (source: "library" | "camera") => {
      if (pickingImagesRef.current || sending) return;
      const remaining = MAX_MESSAGE_IMAGES - composeImages.length;
      if (remaining <= 0) {
        setComposeStatus("You can attach up to 5 photos.");
        return;
      }

      pickingImagesRef.current = true;
      const settleMs = Platform.OS === "ios" ? 400 : 50;

      try {
        // Let the iOS action sheet / alert finish dismissing first.
        await waitMs(settleMs);

        if (source === "library") {
          const current = await ImagePicker.getMediaLibraryPermissionsAsync();
          let granted = current.granted;
          if (!granted && current.canAskAgain) {
            const asked =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            granted = asked.granted;
          }
          if (!granted) {
            setComposeStatus(
              "Photo library permission is required to attach images.",
            );
            return;
          }
        } else {
          const current = await ImagePicker.getCameraPermissionsAsync();
          let granted = current.granted;
          if (!granted && current.canAskAgain) {
            const asked = await ImagePicker.requestCameraPermissionsAsync();
            granted = asked.granted;
          }
          if (!granted) {
            setComposeStatus("Camera permission is required to take a photo.");
            return;
          }
        }

        const result =
          source === "library"
            ? await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsMultipleSelection: true,
                selectionLimit: remaining,
                quality: 1,
                base64: false,
                exif: false,
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                    .Compatible,
              })
            : await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                quality: 0.7,
                base64: false,
                exif: false,
                preferredAssetRepresentationMode:
                  ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                    .Compatible,
              });

        // Wait for PHPicker / camera UI to finish dismissing before any
        // React state that could interact with the BottomSheet Modal.
        await waitMs(settleMs);

        if (result.canceled || !result.assets?.length) return;

        setComposeStatus("Preparing photos…");
        const dataUrls: string[] = [];
        for (const asset of result.assets.slice(0, remaining)) {
          try {
            const dataUrl = await prepareChatImageDataUrl(asset);
            if (dataUrl) dataUrls.push(dataUrl);
          } catch {
            // Skip unreadable assets.
          }
        }

        if (!dataUrls.length) {
          setComposeStatus(
            "Could not read those photos. Try again or pick a smaller image.",
          );
          return;
        }

        attachPreparedImages(dataUrls);
      } catch {
        setComposeStatus("Could not open the photo picker. Try again.");
      } finally {
        pickingImagesRef.current = false;
      }
    },
    [attachPreparedImages, composeImages.length, sending],
  );

  const openAddPhotosMenu = useCallback(() => {
    if (sending || pickingImagesRef.current) return;
    if (composeImages.length >= MAX_MESSAGE_IMAGES) {
      setComposeStatus("You can attach up to 5 photos.");
      return;
    }
    Alert.alert("Add photos", "Take a new photo or choose from your library.", [
      {
        text: "Take photo",
        onPress: () => {
          void pickChatImages("camera");
        },
      },
      {
        text: "Browse gallery",
        onPress: () => {
          void pickChatImages("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [composeImages.length, pickChatImages, sending]);

  const afterSuccessfulSend = useCallback(
    (type: MessageType) => {
      setDraft("");
      setComposeImages([]);
      setComposeServicePaFields({ subject: "", topic: "", subtopic: "" });
      setComposeStatus("");
      closeAll();
      void refresh();
      const isAlarmType =
        type === "PANIC" ||
        type === "NS_PANIC" ||
        type === "SENSOR" ||
        type === "UNKNOWN" ||
        type === "WELLNESS_CHECK";
      if (isAlarmType) {
        router.push("/(tabs)/alerts" as Href);
      } else {
        router.replace("/(tabs)" as Href);
      }
    },
    [closeAll, refresh, router],
  );

  const onSend = useCallback(async () => {
    if (sending) return;
    const text = draft.trim();
    const hasImages = composeImages.length > 0;
    const servicePaValidation = validateServicePaCompose(
      composeType,
      composeServicePaFields,
      text,
      { allowEmptyBody: hasImages },
    );
    if (servicePaValidation) { setComposeStatus(servicePaValidation); return; }
    if (!text && !hasImages && !isServicePaMessageType(composeType)) return;
    if (!(await confirmEmergencySend(composeType))) return;

    const accessGuest = isAccessGuestChannelType(composeType);
    if (accessGuest && !composeReceiverId.trim()) {
      setComposeStatus("Select a guest for Access CHAT."); return;
    }
    if (!accessGuest && isPrivateMessageType(composeType) && !composeReceiverId) {
      setComposeStatus("Select a receiver for private messages."); return;
    }
    const parsedReceiverId = Number(composeReceiverId);
    if (!accessGuest && isPrivateMessageType(composeType) && (!Number.isFinite(parsedReceiverId) || parsedReceiverId <= 0)) {
      setComposeStatus("Receiver must be a valid member id."); return;
    }
    if (accessGuest && !composeZoneId) {
      setComposeStatus("Your account has no network id; cannot message guests."); return;
    }

    setSending(true);
    setComposeStatus(hasImages ? "Uploading photos…" : "Sending…");
    try {
      let imageUrls: string[] = [];
      if (hasImages) {
        for (let i = 0; i < composeImages.length; i += 1) {
          setComposeStatus(`Uploading photo ${i + 1} of ${composeImages.length}…`);
          const uploaded = await uploadMessageImage(composeImages[i]);
          const url = uploaded.data?.url?.trim();
          imageUrls.push(url || composeImages[i]);
        }
      }
      const imageExtras = imageUrls.length ? { images: imageUrls } : {};
      setComposeStatus("Sending…");

      const usesGeo = usesGeoPropagationMessageType(composeType);
      if (usesGeo) {
        const resolved = await resolveMessagePropagationPositionForType(
          composeType,
          user?.mapCenter ?? user?.map_center ?? null,
        );
        if ("error" in resolved) throw new Error(resolved.error);
        const hid = await getOrCreateDeviceHid();
        const msgPayload: Record<string, unknown> = isServicePaMessageType(composeType)
          ? buildServicePaMsgPayload(composeServicePaFields, text, {
              broadcast_name: selfBroadcastName,
              ...imageExtras,
            })
          : {
              description: text,
              broadcast_name: selfBroadcastName,
              ...imageExtras,
              ...(isPrivateMessageType(composeType) && parsedReceiverId > 0
                ? { receiver_id: parsedReceiverId }
                : {}),
            };
        const result = await propagateMessageFeatureMessage({
          type: composeType,
          hid,
          msg: msgPayload,
          position: resolved.position,
          ...(isPrivateMessageType(composeType)
            ? { receiver_owner_id: parsedReceiverId }
            : {}),
        });
        if (result.error) throw new Error(result.error);
        const body = result.data;
        if (body && !body.skipped && ownerId != null) {
          applyGeoPropagationToInbox({
            ...body,
            sender_id: body.sender_id ?? ownerId,
            zone_id: body.zone_id ?? body.zone_ids?.[0] ?? composeZoneId ?? undefined,
          });
        }
        afterSuccessfulSend(composeType);
      } else if (accessGuest) {
        const result = await sendMessage({
          receiver_id: composeReceiverId,
          type: composeType,
          message: text,
          zone_id: composeZoneId ?? undefined,
          images: imageUrls.length ? imageUrls : undefined,
        });
        if (result.error) throw new Error(result.error);
        afterSuccessfulSend(composeType);
      } else {
        const hid = await getOrCreateDeviceHid();
        const resolved = await resolveMessagePropagationPositionForType(
          composeType,
          user?.mapCenter ?? user?.map_center ?? null,
        );
        if ("error" in resolved) throw new Error(resolved.error);
        const result = await sendMessage({
          receiver_id: isPrivateMessageType(composeType) ? String(parsedReceiverId) : undefined,
          type: composeType,
          message: text,
          zone_id: composeZoneId ?? undefined,
          hid,
          images: imageUrls.length ? imageUrls : undefined,
        });
        if (result.error) throw new Error(result.error);
        afterSuccessfulSend(composeType);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send message.";
      setComposeStatus(msg);
      await presentLocalMessageNotification({
        title: "Send failed",
        body: msg.slice(0, 120),
        data: { type: "error" },
      });
    } finally {
      setSending(false);
    }
  }, [
    draft, composeImages, composeType, composeReceiverId, composeZoneId,
    refresh, user?.mapCenter, user?.map_center, selfBroadcastName, ownerId,
    applyGeoPropagationToInbox, composeServicePaFields, confirmEmergencySend,
    sending, afterSuccessfulSend,
  ]);

  return (
    <>
      <BottomSheet visible={visible} onClose={closeAll} maxHeight="88%">
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 24,
            gap: 12,
            paddingBottom: Math.max(bottomInset, 16) + 12,
            flexGrow: 1,
            flexShrink: 1,
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 10 }}>
            <View
              style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: colors.borderStrong,
              }}
            />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
            Compose message
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Sending as {selfBroadcastName}
          </Text>

          <ScrollView
            ref={composeScrollRef}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            keyboardDismissMode="interactive"
            style={{ flexGrow: 1, flexShrink: 1, minHeight: 160 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <Text
              style={{
                color: colors.textMuted, fontSize: 11, fontWeight: "600",
                letterSpacing: 1.5, textTransform: "uppercase",
              }}
            >
              Message type
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8, marginBottom: 8 }}
            >
              {composeTypeOptions.flatMap((group) =>
                group.options.map((opt) => (
                  <Pressable
                    key={opt.type}
                    onPress={() => {
                      setComposeType(opt.type);
                      setComposeServicePaFields({ subject: "", topic: "", subtopic: "" });
                    }}
                    style={{ marginRight: 8 }}
                  >
                    <Chip label={opt.label} active={composeType === opt.type} />
                  </Pressable>
                )),
              )}
            </ScrollView>

            {isAccessGuestChannelType(composeType) ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Guest (zone {composeZoneId ?? "—"})
                </Text>
                {loadingComposeMeta ? (
                  <ActivityIndicator color={colors.accent} />
                ) : guestOptions.length === 0 ? (
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>
                    No active guest requests in this zone.
                  </Text>
                ) : (
                  guestOptions.map((g) => (
                    <Pressable key={g.id} onPress={() => setComposeReceiverId(g.id)}>
                      <Chip
                        label={g.label}
                        active={composeReceiverId === g.id}
                        style={{ marginBottom: 6 }}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {!isAccessGuestChannelType(composeType) &&
            isPrivateMessageType(composeType) ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                {privateSearchLoading && privateLocationStatus === null ? (
                  <ActivityIndicator color={colors.accent} />
                ) : privateLocationStatusMessage(privateLocationStatus) ? (
                  <Text style={{ color: colors.textDim, fontSize: 12 }}>
                    {privateLocationStatusMessage(privateLocationStatus)}
                  </Text>
                ) : (
                  <>
                    <TextInput
                      placeholder="Name or email"
                      placeholderTextColor={colors.textDim}
                      value={privateSearchQuery}
                      onChangeText={(text) => {
                        setPrivateSearchQuery(text);
                        setComposeReceiverId("");
                      }}
                      onFocus={scrollComposeFieldIntoView}
                      style={{
                        backgroundColor: colors.bgCard,
                        borderWidth: 1, borderColor: colors.border,
                        borderRadius: 12, padding: 12,
                        color: colors.text, fontSize: 15,
                      }}
                    />
                    {privateSearchLoading ? <ActivityIndicator color={colors.accent} /> : null}
                    {privateSearchResults.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          setComposeReceiverId(String(m.id));
                          setPrivateSearchQuery(m.display_name);
                        }}
                      >
                        <Chip
                          label={`${m.display_name} — ${m.subtitle || m.email}`}
                          active={composeReceiverId === String(m.id)}
                          style={{ marginBottom: 6 }}
                        />
                      </Pressable>
                    ))}
                    {privateSearchQuery.trim().length >= 2 &&
                    !privateSearchLoading &&
                    privateSearchResults.length === 0 ? (
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>
                        No members matched.
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            {isServicePaMessageType(composeType) ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {composeType === "SERVICE" ? "Service listing" : "Public announcement"}
                </Text>
                <TextInput
                  placeholder="Subject"
                  placeholderTextColor={colors.textDim}
                  value={composeServicePaFields.subject}
                  onChangeText={(subject) =>
                    setComposeServicePaFields((prev) => ({ ...prev, subject }))
                  }
                  onFocus={scrollComposeFieldIntoView}
                  maxLength={200}
                  style={{
                    backgroundColor: colors.bgCard,
                    borderWidth: 1, borderColor: colors.border,
                    borderRadius: 12, padding: 12,
                    color: colors.text, fontSize: 15,
                  }}
                />
                {composeType === "SERVICE" ? (
                  <>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Topic</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {SERVICE_PA_TOPICS.map((topic) => (
                        <Pressable
                          key={topic.id}
                          onPress={() =>
                            setComposeServicePaFields((prev) => ({
                              ...prev, topic: topic.id, subtopic: "",
                            }))
                          }
                          style={{ marginRight: 8 }}
                        >
                          <Chip
                            label={topic.label}
                            active={composeServicePaFields.topic === topic.id}
                          />
                        </Pressable>
                      ))}
                    </ScrollView>
                    {serviceTopicRequiresSubtopic(composeType, composeServicePaFields.topic) ? (
                      <>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          Products subtopic
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {(getTopicOption(composeServicePaFields.topic)?.subtopics ?? []).map(
                            (subtopic) => (
                              <Pressable
                                key={subtopic.id}
                                onPress={() =>
                                  setComposeServicePaFields((prev) => ({
                                    ...prev, subtopic: subtopic.id,
                                  }))
                                }
                                style={{ marginRight: 8 }}
                              >
                                <Chip
                                  label={subtopic.label}
                                  active={composeServicePaFields.subtopic === subtopic.id}
                                />
                              </Pressable>
                            ),
                          )}
                        </ScrollView>
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            <TextInput
              placeholder={
                isServicePaMessageType(composeType) ? "Message body…" : "Type your message…"
              }
              placeholderTextColor={colors.textDim}
              value={draft}
              onChangeText={setDraft}
              onFocus={scrollComposeFieldIntoView}
              multiline
              style={{
                marginTop: 16, minHeight: 100,
                backgroundColor: colors.bgCard,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 14, padding: 14,
                color: colors.text, fontSize: 15,
                textAlignVertical: "top",
              }}
            />

            {composeImages.length ? (
              <MessageImageGallery
                uris={composeImages}
                compact
                onRemove={(index) =>
                  setComposeImages((prev) => prev.filter((_, i) => i !== index))
                }
              />
            ) : null}

            <Pressable
              onPress={openAddPhotosMenu}
              disabled={sending}
              style={{
                marginTop: 12, alignSelf: "flex-start",
                flexDirection: "row", alignItems: "center", gap: 8,
                borderWidth: 1, borderColor: colors.border,
                backgroundColor: colors.bgCard,
                borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
              }}
            >
              <ImagePlus size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700" }}>
                {composeImages.length ? `Add photo (${composeImages.length}/5)` : "Add photos"}
              </Text>
            </Pressable>

            {composeStatus ? (
              <Text
                style={{
                  color:
                    composeStatus.startsWith("Sending") ||
                    composeStatus.startsWith("Uploading") ||
                    composeStatus.startsWith("Preparing")
                      ? colors.textMuted
                      : colors.danger,
                  fontSize: 12, marginTop: 8,
                }}
              >
                {composeStatus}
              </Text>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Button label="Cancel" variant="secondary" onPress={closeAll} style={{ flex: 1 }} />
            <Button
              label="Send"
              onPress={() => void onSend()}
              loading={sending}
              leftIcon={<Send size={16} color="#fff" />}
              style={{ flex: 1 }}
              disabled={ownerId == null}
            />
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
