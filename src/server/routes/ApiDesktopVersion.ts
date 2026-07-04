import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {computeDesktopVersion} from '../../common/models/DesktopVersionModel';
import {REALTIME_PROTOCOL_VERSION} from '../../common/realtime/Protocol';

/**
 * GET /api/desktop/version?platform=win32&current=1.2.3
 *
 * Public (no token) compatibility endpoint for the Electron desktop client (Phase 7).
 * The desktop MAIN process calls this on startup — from the main process, NOT the
 * renderer, so it is NOT subject to CORS. Drives the mandatory-update gate.
 *
 * Operator config via env (a self-hosted fork sets these; sane no-force defaults):
 *   TM_DESKTOP_LATEST_VERSION   newest desktop version           (default 1.0.0)
 *   TM_DESKTOP_MIN_VERSION      oldest still allowed to play      (default 0.0.0 → nobody forced)
 *   TM_DESKTOP_CHANNEL          update channel label              (default 'latest')
 *   TM_DESKTOP_FORCE_UPDATE=1   force every client to update
 *   TM_DESKTOP_DOWNLOAD_URL     manual-download installer URL
 *   TM_DESKTOP_RELEASE_NOTES    JSON string array of notes
 */
export class ApiDesktopVersion extends Handler {
  public static readonly INSTANCE = new ApiDesktopVersion();
  private constructor() {
    super();
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const q = ctx.url.searchParams;
    // "Always require an update when a newer version exists": read the newest version LIVE
    // from GitHub Releases (cached) so the gate is always current without touching env on
    // every release. Falls back to TM_DESKTOP_LATEST_VERSION when GitHub is unreachable
    // (fail-open — a GitHub blip never forces an update). Set TM_DESKTOP_REQUIRE_LATEST=0
    // to disable and go back to the plain min-version gate.
    const requireLatest = (process.env.TM_DESKTOP_REQUIRE_LATEST ?? '1') !== '0';
    const githubLatest = requireLatest ? await githubLatestVersion() : undefined;
    const latestVersion = githubLatest ?? process.env.TM_DESKTOP_LATEST_VERSION ?? '1.0.0';
    const model = computeDesktopVersion({
      latestVersion,
      minSupportedVersion: process.env.TM_DESKTOP_MIN_VERSION ?? '0.0.0',
      serverProtocolVersion: REALTIME_PROTOCOL_VERSION,
      channel: process.env.TM_DESKTOP_CHANNEL ?? 'latest',
      platform: q.get('platform') ?? 'win32',
      releaseNotes: parseReleaseNotes(process.env.TM_DESKTOP_RELEASE_NOTES),
      downloadUrl: emptyToUndefined(process.env.TM_DESKTOP_DOWNLOAD_URL),
      forceUpdate: (process.env.TM_DESKTOP_FORCE_UPDATE ?? '') === '1',
      currentVersion: emptyToUndefined(q.get('current') ?? undefined),
      requireLatest,
    });
    responses.writeJson(res, ctx, model);
  }
}

// The newest published desktop version, read from GitHub Releases (public repo, no auth) and
// cached briefly so the gate stays well under GitHub's unauthenticated rate limit. Returns
// undefined on failure → the route falls back to the env default (fail-open).
const GITHUB_LATEST_URL =
  'https://api.github.com/repos/victor-zelinskiy/terraforming-mars/releases/latest';
const GITHUB_LATEST_TTL_MS = 120_000;
let githubLatestCache: {version: string; at: number} | undefined;

async function githubLatestVersion(): Promise<string | undefined> {
  const now = Date.now();
  if (githubLatestCache !== undefined && now - githubLatestCache.at < GITHUB_LATEST_TTL_MS) {
    return githubLatestCache.version;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(GITHUB_LATEST_URL, {
      signal: controller.signal,
      headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'tm-desktop-gate'},
    });
    clearTimeout(timer);
    if (!res.ok) {
      return githubLatestCache?.version;
    }
    const body = await res.json() as {tag_name?: string};
    const version = (body.tag_name ?? '').replace(/^v/, '').trim();
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      return githubLatestCache?.version;
    }
    githubLatestCache = {version, at: now};
    return version;
  } catch {
    return githubLatestCache?.version;
  }
}

function emptyToUndefined(v: string | undefined): string | undefined {
  const t = (v ?? '').trim();
  return t === '' ? undefined : t;
}

function parseReleaseNotes(raw: string | undefined): ReadonlyArray<string> {
  if (raw === undefined || raw.trim() === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // ignore malformed env — treat as no notes
  }
  return [];
}
