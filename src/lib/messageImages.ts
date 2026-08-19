export const MAX_MESSAGE_IMAGES = 5;

function isMessageImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/")
  );
}

function readImagesArray(source: unknown): string[] {
  if (!Array.isArray(source)) return [];
  const urls: string[] = [];
  for (const item of source) {
    if (isMessageImageUrl(item) && urls.length < MAX_MESSAGE_IMAGES) {
      urls.push(item.trim());
    }
  }
  return urls;
}

/** Extract up to 5 image URLs from a persisted message payload. */
export function extractMessageImages(
  row: Record<string, unknown> | null | undefined,
  msgRecord: Record<string, unknown> | null | undefined,
  rawPayload: Record<string, unknown> | null | undefined,
): string[] {
  const nestedRawMsg =
    rawPayload &&
    rawPayload.msg != null &&
    typeof rawPayload.msg === "object" &&
    !Array.isArray(rawPayload.msg)
      ? (rawPayload.msg as Record<string, unknown>)
      : null;
  for (const source of [
    row?.images,
    msgRecord?.images,
    rawPayload?.images,
    nestedRawMsg?.images,
  ]) {
    const urls = readImagesArray(source);
    if (urls.length) return urls;
  }
  return [];
}

export function clampMessageImages(urls: string[]): string[] {
  return urls.filter(isMessageImageUrl).slice(0, MAX_MESSAGE_IMAGES);
}
