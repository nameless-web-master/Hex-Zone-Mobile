/**
 * Expo Router feeds the native launch URL into `redirectSystemPath`.
 *
 * iOS home-screen launches use the app scheme with an empty path
 * (`safezonepatrol:///`). Returning that string as a route produces the
 * Unmatched Route screen: `safezonepatrol:///safezonepatrol:///`.
 *
 * Android often rewrites `safezonepatrol:///join?token=…` to
 * `safezonepatrol://join?token=…`, so `join` becomes the hostname. Strip the
 * scheme and keep the path so Expo Router can match real screens.
 *
 * This file runs outside the React tree — keep it dependency-free.
 */

const APP_SCHEME_RE =
  /^(?:safezonepatrol|zoneweaver|com\.neighbourhoodassistant\.safe-zone-patrol|com\.safezonepatrol\.mobile):\/+/i;

function unwrapAppUrl(raw: string): string {
  let value = (raw ?? "").trim();
  if (!value) return "";

  // `/safezonepatrol:///` (previous buggy rewrite) → `safezonepatrol:///`
  value = value.replace(/^\/+(?=[a-zA-Z][a-zA-Z0-9+.-]*:)/, "");

  while (APP_SCHEME_RE.test(value)) {
    value = value.replace(APP_SCHEME_RE, "");
  }

  return value.replace(/^\/+/, "");
}

export function pathFromUrlLike(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "/";

  // Dev-client URLs must stay intact so Expo can unwrap the inner Metro URL.
  if (/expo-development-client/i.test(trimmed)) {
    return trimmed;
  }

  const unwrapped = unwrapAppUrl(trimmed);
  if (!unwrapped) return "/";
  if (unwrapped.startsWith("?") || unwrapped.startsWith("#")) {
    return `/${unwrapped}`;
  }
  if (unwrapped.startsWith("/")) return unwrapped;
  // Leftover unknown scheme — do not treat it as a route name.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(unwrapped)) return "/";
  return `/${unwrapped}`;
}

export function redirectSystemPath({ path }: { path: string }): string {
  try {
    return pathFromUrlLike(path);
  } catch {
    return "/";
  }
}
