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

  public override get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const q = ctx.url.searchParams;
    const model = computeDesktopVersion({
      latestVersion: process.env.TM_DESKTOP_LATEST_VERSION ?? '1.0.0',
      minSupportedVersion: process.env.TM_DESKTOP_MIN_VERSION ?? '0.0.0',
      serverProtocolVersion: REALTIME_PROTOCOL_VERSION,
      channel: process.env.TM_DESKTOP_CHANNEL ?? 'latest',
      platform: q.get('platform') ?? 'win32',
      releaseNotes: parseReleaseNotes(process.env.TM_DESKTOP_RELEASE_NOTES),
      downloadUrl: emptyToUndefined(process.env.TM_DESKTOP_DOWNLOAD_URL),
      forceUpdate: (process.env.TM_DESKTOP_FORCE_UPDATE ?? '') === '1',
      currentVersion: emptyToUndefined(q.get('current') ?? undefined),
    });
    responses.writeJson(res, ctx, model);
    return Promise.resolve();
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
