import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {githubCacheTtlMs, githubFetch} from './desktopGithub';

/**
 * GET /api/desktop/feed/<file>  — Velopack update-feed PROXY for the desktop client.
 *
 * The desktop app points Velopack's UpdateManager at THIS path instead of github.com, so a
 * client NEVER calls the GitHub REST API (unauthenticated: 60 requests/hour per IP → HTTP 403
 * under load, and the JS binding can't send a token). Two behaviours:
 *   - `releases.<channel>.json` (the channel manifest) is PROXIED (its content is served from
 *     here) so Velopack keeps resolving the .nupkg packages against THIS origin — deltas live
 *     across several GitHub releases, so a redirect would break relative resolution;
 *   - every .nupkg is 302-REDIRECTED straight to its GitHub release-asset download URL — asset
 *     downloads are public, served from a CDN, and are NOT counted against the API rate limit.
 *
 * The filename → download-URL map comes from ONE cached GitHub API call (per ~2 min, shared
 * across all clients), so the server itself stays far under the limit. Fail-open: a GitHub blip
 * serves the last good map; an unknown file → 404. If the Heroku egress IP ever nears the limit,
 * add a server-side token to the RELEASES_API fetch (safe — it never reaches the client).
 */
const REPO = 'victor-zelinskiy/terraforming-mars';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=15`;
const PREFIX = '/api/desktop/feed/';
// The asset-URL map gates how fast a client can DOWNLOAD a fresh release (a stale map points
// `releases.<channel>.json` at the previous release). With a server token, refresh it every 30s so
// the download follows the version gate closely; without one, 120s keeps us under the 60/hr limit.
function assetsTtl(): number {
  return githubCacheTtlMs(30_000, 120_000, process.env.TM_DESKTOP_GITHUB_TTL_MS);
}
let assetsCache: {map: Map<string, string>; at: number} | undefined;

async function assetMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (assetsCache !== undefined && now - assetsCache.at < assetsTtl()) {
    return assetsCache.map;
  }
  try {
    const res = await githubFetch(RELEASES_API, 'tm-desktop-feed', 6000);
    if (!res.ok) {
      return assetsCache?.map ?? new Map();
    }
    const body = await res.json() as Array<{assets?: Array<{name?: string; browser_download_url?: string}>}>;
    const map = new Map<string, string>();
    // Releases come newest-first; the FIRST occurrence of a name wins, so `releases.<channel>.json`
    // resolves to the NEWEST release's copy (the most complete channel manifest).
    for (const rel of body) {
      for (const a of rel.assets ?? []) {
        if (typeof a.name === 'string' && typeof a.browser_download_url === 'string' && !map.has(a.name)) {
          map.set(a.name, a.browser_download_url);
        }
      }
    }
    assetsCache = {map, at: now};
    return map;
  } catch {
    return assetsCache?.map ?? new Map();
  }
}

export class ApiDesktopFeed extends Handler {
  public static readonly INSTANCE = new ApiDesktopFeed();
  private constructor() {
    super();
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const path = ctx.url.pathname;
    const idx = path.indexOf(PREFIX);
    const fileName = idx >= 0 ? decodeURIComponent(path.substring(idx + PREFIX.length)) : '';
    // Bare filenames only — no path traversal, no subfolders.
    if (fileName === '' || !/^[A-Za-z0-9._-]+$/.test(fileName)) {
      responses.notFound(req, res);
      return;
    }

    let url = (await assetMap()).get(fileName);
    if (url === undefined) {
      // A just-published asset may not be in the cached map yet — force one refresh.
      assetsCache = undefined;
      url = (await assetMap()).get(fileName);
    }
    if (url === undefined) {
      responses.notFound(req, res);
      return;
    }

    // The channel manifest is SERVED from this origin (so the client resolves the .nupkg packages
    // here, not at the CDN — deltas span several releases). Everything else redirects to the CDN.
    if (/^releases\..+\.json$/i.test(fileName)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(url, {signal: controller.signal, headers: {'User-Agent': 'tm-desktop-feed'}});
        clearTimeout(timer);
        if (!r.ok) {
          responses.notFound(req, res);
          return;
        }
        const text = await r.text();
        res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-cache'});
        res.end(text);
      } catch (err) {
        responses.internalServerError(req, res, err);
      }
      return;
    }

    responses.redirect(res, url);
  }
}
