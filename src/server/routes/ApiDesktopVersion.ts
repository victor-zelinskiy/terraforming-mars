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
 *   TM_DESKTOP_DETECT_BUILDS    (default 1) report a CI build-in-progress so the client waits for
 *                               the imminent release instead of launching stale OR updating to a
 *                               version that build is about to supersede; set 0 to disable (the
 *                               client then always chases whatever is published right now)
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
    // Premium "wait for the building release": when a newer desktop build is currently running on
    // CI (release.yml) but its release isn't published yet, tell the client so it LOCKS and waits
    // for that build rather than launching stale — or updating to whatever is published right now
    // only to be updated again minutes later. This is also what carries a Linux client through the
    // window where the release tag already exists (the `windows` job created it) but the `linux`
    // channel hasn't been merged into it yet. Follows requireLatest; disable with
    // TM_DESKTOP_DETECT_BUILDS=0. Fail-open (a GitHub blip just means no pending signal).
    const detectBuilds = requireLatest && (process.env.TM_DESKTOP_DETECT_BUILDS ?? '1') !== '0';
    const pendingVersion = detectBuilds ? await githubPendingBuildVersion() : undefined;
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
      pendingVersion,
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

// The version a release build currently RUNNING on CI will publish, or undefined when none is
// active. Reads the in-progress/queued runs of the release workflow (public repo, no auth) and
// derives the version from the run number — the CI versions each run `1.1.<run_number>` (see
// .github/workflows/release.yml `VELO_VERSION`). Cached briefly (builds change faster than
// releases). Fail-open (a blip → undefined → no pending signal). `concurrency: cancel-in-progress`
// means at most one run is active, so the max active run_number is the pending build.
const GITHUB_RUNS_URL =
  'https://api.github.com/repos/victor-zelinskiy/terraforming-mars/actions/workflows/release.yml/runs?branch=main&per_page=10';
const GITHUB_RUNS_TTL_MS = 45_000;
let githubRunsCache: {version: string | undefined; at: number} | undefined;

async function githubPendingBuildVersion(): Promise<string | undefined> {
  const now = Date.now();
  if (githubRunsCache !== undefined && now - githubRunsCache.at < GITHUB_RUNS_TTL_MS) {
    return githubRunsCache.version;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(GITHUB_RUNS_URL, {
      signal: controller.signal,
      headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'tm-desktop-gate'},
    });
    clearTimeout(timer);
    if (!res.ok) {
      return githubRunsCache?.version;
    }
    const body = await res.json() as {workflow_runs?: Array<{run_number?: number; status?: string}>};
    // Any run not yet `completed` is active (queued / in_progress / requested / waiting / pending).
    const maxActiveRun = (body.workflow_runs ?? [])
      .filter((r) => r.status !== 'completed' && typeof r.run_number === 'number')
      .reduce((m, r) => Math.max(m, r.run_number ?? 0), 0);
    const version = maxActiveRun > 0 ? `1.1.${maxActiveRun}` : undefined;
    githubRunsCache = {version, at: now};
    return version;
  } catch {
    return githubRunsCache?.version;
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
