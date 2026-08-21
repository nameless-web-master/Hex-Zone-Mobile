/**
 * Android often rewrites `safezonepatrol:///join?token=…` to
 * `safezonepatrol://join?token=…`, so `join` becomes the hostname and Expo
 * Router would land on `/`. Map those hosts back to real routes.
 */
const PUBLIC_HOSTS = new Set(["join", "access", "guest"]);

function pathFromUrlLike(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "/";

  try {
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const url = new URL(
      hasScheme
        ? trimmed
        : `https://szp.invalid/${trimmed.replace(/^\/+/, "")}`,
    );
    const host = url.hostname;
    const search = url.search;
    const hash = url.hash;
    const pathname = url.pathname === "/" ? "" : url.pathname;

    if (PUBLIC_HOSTS.has(host) && !pathname) {
      return `/${host}${search}${hash}`;
    }
    if (pathname) {
      return `${pathname}${search}${hash}`;
    }
    if (PUBLIC_HOSTS.has(host)) {
      return `/${host}${search}${hash}`;
    }
  } catch {
    /* fall through */
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function redirectSystemPath({ path }: { path: string }): string {
  return pathFromUrlLike(path);
}
