// Shared GitHub-API access for the desktop update endpoints (ApiDesktopVersion + ApiDesktopFeed).
//
// The desktop "update pickup lag" is dominated by how stale the server's cached view of GitHub
// Releases is: the client can only act on what /api/desktop/version reports, and that is cached to
// stay under GitHub's UNAUTHENTICATED rate limit (60 requests/hour per IP — shared across every
// cached read here). A short TTL would blow that budget and get the server 403-throttled, which
// makes the lag WORSE, not better.
//
// The fix is a server-side token: set TM_DESKTOP_GITHUB_TOKEN (or GITHUB_TOKEN / GH_TOKEN) and the
// ceiling jumps to 5000 requests/hour, so the caches can safely run far shorter → the client sees a
// new release within tens of seconds instead of minutes. The token is server-only; it NEVER
// reaches the client (Velopack's JS binding can't send one — that's the whole reason this proxy
// exists). No token → the conservative long TTLs, i.e. exactly today's behaviour (zero regression).

/** Whether a server-side GitHub token is configured (raises the rate ceiling to 5000/hr). */
export function hasGithubToken(): boolean {
  return githubToken() !== undefined;
}

function githubToken(): string | undefined {
  for (const key of ['TM_DESKTOP_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const v = (process.env[key] ?? '').trim();
    if (v !== '') {
      return v;
    }
  }
  return undefined;
}

/** Standard headers for a GitHub REST call, with Bearer auth when a token is configured (and
 *  `withAuth` isn't turned off — the retry path suppresses it). */
export function githubHeaders(userAgent: string, withAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': userAgent,
  };
  const token = githubToken();
  if (withAuth && token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * GitHub REST fetch with a timeout AND a graceful auth fallback: if a configured token is REJECTED
 * or INSUFFICIENT (401 / 403 — e.g. a fine-grained token missing `Actions: Read`, which the
 * build-in-progress detector needs), retry the SAME request UNAUTHENTICATED. This guarantees a
 * misconfigured server token is never WORSE than no token — without it, every GitHub call 4xx'd and
 * the pending-build fail-safe froze the client on a stale "build in progress" forever. `fetchImpl`
 * is injectable for tests. Throws on a network error / timeout (callers already fall back to cache).
 */
export async function githubFetch(
  url: string,
  userAgent: string,
  timeoutMs = 5000,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const attempt = async (withAuth: boolean): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {signal: controller.signal, headers: githubHeaders(userAgent, withAuth)});
    } finally {
      clearTimeout(timer);
    }
  };
  const first = await attempt(true);
  if ((first.status === 401 || first.status === 403) && hasGithubToken()) {
    console.warn(
      `[desktop-github] token rejected/insufficient (HTTP ${first.status}) for ${userAgent} — ` +
      `retrying unauthenticated. Fix: grant the token 'Contents: Read' + 'Actions: Read', or unset it.`);
    return attempt(false);
  }
  return first;
}

/**
 * Pick a cache TTL by rate-limit headroom: the SHORT value when a token lifts the ceiling to
 * 5000/hr (fast pickup), the LONG value otherwise (stay under 60/hr). PURE (unit-tested).
 * `override` (an env-provided ms) wins when it's a positive finite number — an operator escape
 * hatch to tune either way.
 */
export function githubCacheTtlMs(shortMs: number, longMs: number, override?: string): number {
  const parsed = Number(override);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return hasGithubToken() ? shortMs : longMs;
}
