// Pure navigation-guard helpers for the Electron main process (unit-tested).
//
// The subtle bug this fixes: Node's URL parser does NOT treat the custom `app://`
// scheme as "standard", so `new URL('app://bundle/x').origin` is the string 'null'.
// Comparing that to the renderer's origin wrongly rejected genuine same-origin app://
// navigation → `will-navigate` called preventDefault() → every game-boundary reload
// (Join, create, leave, rematch) silently did nothing in the packaged app.
//
// So we compute the origin MANUALLY as `scheme://host`, which is correct for both
// `http(s)://…` (dev / hosted server) and `app://bundle` (packaged renderer).

/** Origin of a URL as `scheme://host`, or undefined if it can't be parsed. */
export function originOf(url: string): string | undefined {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
}

/** True when `target` shares `rendererOrigin` (an in-window SPA navigation to allow). */
export function isSameOrigin(target: string, rendererOrigin: string): boolean {
  const o = originOf(target);
  return o !== undefined && o !== 'null//' && o === rendererOrigin;
}

/** True for an http(s) URL (opened in the system browser, never in-window). */
export function isExternalHttp(target: string): boolean {
  try {
    const protocol = new URL(target).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
