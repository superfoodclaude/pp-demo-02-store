/**
 * Script B — click linker, on the storefront (brief §7).
 *
 * Hand-written equivalent of a GTM conversion linker tag: turn an inbound click ID into
 * a durable first-party cookie, and mirror it onto the cart when one exists.
 *
 * Both *.github.io and *.myshopify.dev sit on the Public Suffix List, so this cookie can
 * only ever be host-only — that's correct, not a limitation, and it's what makes the
 * acceptance test's origin-isolation assertion (§8.5) real rather than a same-site shortcut.
 */

export const PP_CLICK_COOKIE = "_pp_click";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

export type PpClickPayload = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  ts: number;
  landing_path: string;
};

/**
 * Reads click params from an incoming request URL. __gclid is the TPV's renamed carrier
 * (see script-a-propagation.js) — restore it to gclid here, before anything downstream
 * (cart attributes, the cookie itself) ever sees it.
 */
export function extractClickParams(url: URL): Partial<PpClickPayload> | null {
  const params = url.searchParams;
  const gclid = params.get("gclid") ?? params.get("__gclid") ?? undefined;
  const gbraid = params.get("gbraid") ?? undefined;
  const wbraid = params.get("wbraid") ?? undefined;
  const fbclid = params.get("fbclid") ?? undefined;

  const hasClickId = Boolean(gclid || gbraid || wbraid || fbclid);
  if (!hasClickId) return null;

  return {
    gclid,
    gbraid,
    wbraid,
    fbclid,
    source: params.get("utm_source") ?? undefined,
    medium: params.get("utm_medium") ?? undefined,
    campaign: params.get("utm_campaign") ?? undefined,
  };
}

export function buildClickCookiePayload(url: URL): PpClickPayload | null {
  const params = extractClickParams(url);
  if (!params) return null;
  return {
    ...params,
    ts: Date.now(),
    landing_path: url.pathname,
  };
}

export function serializeClickCookie(payload: PpClickPayload): string {
  const value = encodeURIComponent(JSON.stringify(payload));
  // Secure + SameSite=Lax + Path=/ + Max-Age=90d, no Domain attribute -> host-only.
  return `${PP_CLICK_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

export function readClickCookie(cookieHeader: string | null): PpClickPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PP_CLICK_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.slice(PP_CLICK_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

/**
 * Called from the root loader on every request. If this load carries a click ID, write
 * (overwrite) the cookie — that's "last non-direct click wins". If it doesn't, existing
 * cookie is left untouched by simply not returning a Set-Cookie header.
 */
export function maybeSetClickCookie(request: Request): string | null {
  const url = new URL(request.url);
  const payload = buildClickCookiePayload(url);
  if (!payload) return null;
  return serializeClickCookie(payload);
}

/** Mirrors the click payload into cart attributes at cart-creation time (brief §7). */
export function clickPayloadToCartAttributes(
  payload: PpClickPayload
): Array<{ key: string; value: string }> {
  return Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => ({ key: `pp_click_${key}`, value: String(value) }));
}
