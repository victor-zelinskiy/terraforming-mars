import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {computeDesktopVersion, resolvePendingForPlatform} from '../../common/models/DesktopVersionModel';
import {REALTIME_PROTOCOL_VERSION} from '../../common/realtime/Protocol';
import {githubCacheTtlMs, githubHeaders} from './desktopGithub';

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
 *   TM_DESKTOP_GITHUB_TOKEN     (or GITHUB_TOKEN / GH_TOKEN) — a server-only GitHub token. Lifts the
 *                               API ceiling 60→5000/hr, so the caches below run SHORT and a new
 *                               release is picked up in ~30s instead of up to 2 min. Never sent to
 *                               the client. STRONGLY recommended for a snappy update experience.
 *   TM_DESKTOP_GITHUB_TTL_MS    override for every GitHub-read cache TTL (ms). Default: adaptive —
 *                               short when a token is set, long (rate-limit-safe) when it isn't.
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
    //
    // The lock is PER-PLATFORM (resolvePendingForPlatform below): a build stays "in progress" for
    // the whole run, but each OS's package lands in the release at a different time — so the moment
    // THIS platform's channel feed is published for the pending version, we drop its lock and let it
    // update, instead of making it wait out the other OS's job + prune.
    const detectBuilds = requireLatest && (process.env.TM_DESKTOP_DETECT_BUILDS ?? '1') !== '0';
    const platform = q.get('platform') ?? 'win32';
    const rawPending = detectBuilds ? await githubPendingBuildVersion() : undefined;
    // Per-platform EARLY UNLOCK: a build is "in progress" for the whole workflow RUN (windows →
    // linux → prune), but the windows job publishes the `win` channel feed into the release tag
    // first. As soon as THIS platform's channel is published for the pending version, its package
    // is downloadable — don't keep it locked waiting out the rest of the run. Resolves to the
    // available version + drops the pending signal; the other platform keeps waiting until its own
    // channel is merged. Only fetches when a build is actually running (rawPending set).
    const publishedChannels =
      rawPending !== undefined ? await githubReleasePublishedChannels(rawPending) : undefined;
    const resolved = resolvePendingForPlatform({
      latestVersion,
      pendingVersion: rawPending,
      platformChannel: velopackChannel(platform),
      publishedChannels,
    });
    const model = computeDesktopVersion({
      latestVersion: resolved.latestVersion,
      minSupportedVersion: process.env.TM_DESKTOP_MIN_VERSION ?? '0.0.0',
      serverProtocolVersion: REALTIME_PROTOCOL_VERSION,
      channel: process.env.TM_DESKTOP_CHANNEL ?? 'latest',
      platform,
      releaseNotes: parseReleaseNotes(process.env.TM_DESKTOP_RELEASE_NOTES),
      downloadUrl: emptyToUndefined(process.env.TM_DESKTOP_DOWNLOAD_URL),
      forceUpdate: (process.env.TM_DESKTOP_FORCE_UPDATE ?? '') === '1',
      currentVersion: emptyToUndefined(q.get('current') ?? undefined),
      requireLatest,
      pendingVersion: resolved.pendingVersion,
    });
    responses.writeJson(res, ctx, model);
  }
}

// The newest published desktop version, read from GitHub Releases (public repo, no auth) and
// cached briefly so the gate stays well under GitHub's unauthenticated rate limit. Returns
// undefined on failure → the route falls back to the env default (fail-open).
const GITHUB_LATEST_URL =
  'https://api.github.com/repos/victor-zelinskiy/terraforming-mars/releases/latest';
// With a server token the client can pick up a new release in ~30s; without one, 120s keeps the
// gate under GitHub's 60/hr unauthenticated limit. Operator override: TM_DESKTOP_GITHUB_TTL_MS.
function githubLatestTtl(): number {
  return githubCacheTtlMs(30_000, 120_000, process.env.TM_DESKTOP_GITHUB_TTL_MS);
}
let githubLatestCache: {version: string; at: number} | undefined;

async function githubLatestVersion(): Promise<string | undefined> {
  const now = Date.now();
  if (githubLatestCache !== undefined && now - githubLatestCache.at < githubLatestTtl()) {
    return githubLatestCache.version;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(GITHUB_LATEST_URL, {
      signal: controller.signal,
      headers: githubHeaders('tm-desktop-gate'),
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
// Builds change faster than releases; with a token poll them tightly (20s) so the pending→required
// handoff is quick, else 45s to stay under the unauthenticated budget.
function githubRunsTtl(): number {
  return githubCacheTtlMs(20_000, 45_000, process.env.TM_DESKTOP_GITHUB_TTL_MS);
}
let githubRunsCache: {version: string | undefined; at: number} | undefined;

async function githubPendingBuildVersion(): Promise<string | undefined> {
  const now = Date.now();
  if (githubRunsCache !== undefined && now - githubRunsCache.at < githubRunsTtl()) {
    return githubRunsCache.version;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(GITHUB_RUNS_URL, {
      signal: controller.signal,
      headers: githubHeaders('tm-desktop-gate'),
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

// The Velopack channel a platform downloads. release.yml's `windows` job packs the `win` channel,
// the `linux` job the `linux` channel (each `vpk pack` uses the per-OS default). Anything else maps
// to `win` (macOS is out of scope; the field only matters for win/linux clients).
function velopackChannel(platform: string): string {
  return platform === 'linux' ? 'linux' : 'win';
}

// Which Velopack channels are ALREADY published in the release tagged v<version> — i.e. which
// platforms' packages are downloadable now, even while the rest of the CI run is still going. Each
// OS's channel adds a `releases.<channel>.json` feed asset to the shared release tag, and vpk
// uploads that manifest together with its .nupkg in one publish step, so the manifest's presence
// means the package is fetchable. Returns an EMPTY set when the tag doesn't exist yet (404 → the
// build hasn't published anything), or undefined on a transient failure (→ the caller keeps the
// client locked rather than unlocking onto a maybe-half-published release). Cached briefly (a
// release's channel set changes only as CI merges each OS, on the order of a minute).
function githubReleaseTagUrl(tag: string): string {
  return `https://api.github.com/repos/victor-zelinskiy/terraforming-mars/releases/tags/${tag}`;
}
// The per-platform early-unlock check — with a token, 15s catches each channel merge quickly.
function githubReleaseTtl(): number {
  return githubCacheTtlMs(15_000, 30_000, process.env.TM_DESKTOP_GITHUB_TTL_MS);
}
const releaseChannelsCache = new Map<string, {channels: Set<string>; at: number}>();

async function githubReleasePublishedChannels(version: string): Promise<Set<string> | undefined> {
  const now = Date.now();
  const cached = releaseChannelsCache.get(version);
  if (cached !== undefined && now - cached.at < githubReleaseTtl()) {
    return cached.channels;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(githubReleaseTagUrl(`v${version}`), {
      signal: controller.signal,
      headers: githubHeaders('tm-desktop-gate'),
    });
    clearTimeout(timer);
    if (res.status === 404) {
      // The build hasn't created the release yet → nothing published for any platform.
      const channels = new Set<string>();
      releaseChannelsCache.set(version, {channels, at: now});
      return channels;
    }
    if (!res.ok) {
      return cached?.channels;
    }
    const body = await res.json() as {assets?: Array<{name?: string}>};
    const channels = new Set<string>();
    for (const a of body.assets ?? []) {
      const m = /^releases\.(.+)\.json$/i.exec(a.name ?? '');
      if (m !== null) {
        channels.add(m[1].toLowerCase());
      }
    }
    releaseChannelsCache.set(version, {channels, at: now});
    return channels;
  } catch {
    return cached?.channels;
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
