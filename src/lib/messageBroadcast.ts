import type { Message } from "@/api/messages";

/**
 * Read a broadcast name embedded in an outgoing message payload. Senders attach
 * `broadcast_name` to `msg`/`raw_payload` so receivers can display a friendly
 * identity instead of a numeric owner id.
 */
export function readMessageBroadcastName(
  message: Pick<Message, "raw_payload">,
): string | null {
  const rp = message.raw_payload;
  if (!rp || typeof rp !== "object") return null;
  const pick = (o: Record<string, unknown> | null): string | null => {
    if (!o) return null;
    const v = o.broadcast_name ?? o.broadcastName;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const top = pick(rp as Record<string, unknown>);
  if (top) return top;
  const msg = (rp as Record<string, unknown>).msg;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    return pick(msg as Record<string, unknown>);
  }
  return null;
}

export type BroadcastLabelOptions = {
  selfOwnerId?: number | null;
  selfBroadcastName?: string | null;
  selfRealName?: string | null;
  resolveOwnerName?: (ownerId: number) => string | null | undefined;
};

function isOwnMessage(
  message: Pick<Message, "sender_id">,
  selfOwnerId?: number | null,
): boolean {
  return selfOwnerId != null && message.sender_id === selfOwnerId;
}

/** Best-effort display name (sender's broadcast name) for an inbox row. */
export function messageBroadcastLabel(
  message: Message,
  options: BroadcastLabelOptions = {},
): string {
  if (isOwnMessage(message, options.selfOwnerId)) {
    return "ME";
  }
  const embedded = readMessageBroadcastName(message);
  if (embedded) return embedded;
  if (message.guest_sender_id != null) return "Guest";
  const resolved = options.resolveOwnerName?.(message.sender_id);
  if (resolved && resolved.trim()) return resolved.trim();
  return `Member ${message.sender_id}`;
}

/**
 * Account name used for avatar initials when the sender has no photo.
 * Own messages use the settings name (never "ME"); other senders use their
 * member profile name.
 */
export function messageAvatarLabel(
  message: Message,
  options: BroadcastLabelOptions = {},
): string {
  if (isOwnMessage(message, options.selfOwnerId)) {
    const real = (options.selfRealName ?? "").trim();
    if (real) return real;
  }
  const resolved = options.resolveOwnerName?.(message.sender_id);
  if (resolved && resolved.trim()) return resolved.trim();
  if (message.guest_sender_id != null) return "Guest";
  const embedded = readMessageBroadcastName(message);
  if (embedded && embedded.toUpperCase() !== "ME") return embedded;
  return "";
}
