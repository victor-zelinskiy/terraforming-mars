import {paths} from '../../common/app/paths';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * Desktop (Electron `app://`) cross-origin support — Phase 2B.
 *
 * ADDITIVE + allowlist-only. A browser is same-origin and sends no cross-origin
 * `Origin`, so none of this ever fires for web users. Guardrails
 * (docs/ELECTRON_MIGRATION_PLAN.md §10/§11):
 *   - EXPLICIT, environment-configured allowlist — NEVER a wildcard `*`;
 *   - NO credentials: gameplay authenticates with the `?id=` URL token, not a
 *     cookie, so `Access-Control-Allow-Credentials` is deliberately absent;
 *   - scoped to the game-runtime + create/join API surface only. Admin (games
 *     list / delete / history / IPs / metrics / stats) and auth (login / logout /
 *     profile / Discord) are DELIBERATELY excluded — they stay same-origin only;
 *   - the real `app://` `Origin` is LOGGED when it reaches an in-scope API but
 *     isn't allowlisted, so its exact value can be verified empirically and added.
 */

const DEFAULT_ALLOWED_ORIGINS: ReadonlyArray<string> = ['app://bundle'];

/**
 * Origins allowed to make cross-origin game-runtime calls. Default is the
 * desktop shell's `app://bundle`. Override/extend with a comma-separated
 * `TM_DESKTOP_ALLOWED_ORIGINS` (e.g. after empirically confirming the value the
 * packaged renderer actually sends).
 */
function allowedOrigins(): ReadonlyArray<string> {
  const raw = (process.env.TM_DESKTOP_ALLOWED_ORIGINS ?? '').trim();
  if (raw === '') {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * The API surface a desktop client legitimately calls. Kept as an explicit
 * allowlist (not a prefix match) so admin/auth endpoints can never be opened to
 * a cross-origin caller by accident.
 */
const CORS_PATHS: ReadonlySet<string> = new Set<string>([
  // Core game runtime.
  paths.API_PLAYER,
  paths.API_SPECTATOR,
  paths.API_GAME,
  paths.API_WAITING_FOR,
  paths.PLAYER_INPUT,
  paths.PLAYER_INPUT_BATCH,
  paths.ACKNOWLEDGE_DRAW,
  paths.RESET,
  paths.AUTOPASS,
  // Soft MarsBot-turn ack (best-effort, never authoritative — see BotTurnScheduler).
  paths.API_GAME_BOT_TURN_ACK,
  // Premium read-only analytics / previews.
  paths.API_GAME_LOGS,
  paths.API_GAME_JOURNAL_EVENTS,
  paths.API_GAME_EFFECT_STATS,
  paths.API_GAME_ACTION_STATS,
  paths.API_GAME_ENDGAME_FACTS,
  paths.API_GAME_DELTA_PREVIEW,
  paths.API_GAME_BOARD_CELL_PREVIEW,
  paths.API_GAME_COLONY_TRADE_PREVIEW,
  paths.API_GAME_REMATCH,
  paths.API_ACTION_PREVIEW,
  paths.API_CARD_PLAY_PREVIEW,
  paths.API_CORP_FIRST_ACTION_PREVIEW,
  // Lobby / create / join / load (the flows a desktop client needs).
  paths.API_GAMES_JOINABLE,
  paths.API_GAME_PLAYER_COLOR,
  paths.API_CREATEGAME,
  paths.API_CLONEABLEGAME,
  paths.LOAD_GAME,
]);

/** Whether a pathname (no leading slash) is in the desktop CORS surface. */
export function isCorsEligiblePath(pathname: string): boolean {
  return CORS_PATHS.has(pathname);
}

/** Returns the origin string if it is allowlisted, else `undefined`. */
export function resolveAllowedOrigin(origin: string | undefined): string | undefined {
  if (origin === undefined || origin === '') {
    return undefined;
  }
  return allowedOrigins().includes(origin) ? origin : undefined;
}

/**
 * Apply desktop CORS. Called from the request dispatcher BEFORE the route
 * handler runs. Returns `true` iff the request was fully handled here (an
 * OPTIONS preflight) — the caller must then stop. For a normal request it only
 * sets response headers (which survive the handler's `writeJson`/`writeHead`,
 * both of which preserve previously `setHeader`'d headers) and returns `false`.
 */
export function handleDesktopCors(req: Request, res: Response, pathname: string): boolean {
  const origin = req.headers.origin;
  const isPreflight = req.method === 'OPTIONS';

  if (origin === undefined) {
    // Same-origin (browser) — nothing to do. A bare OPTIONS with no Origin is
    // not a CORS preflight; let it fall through to the normal handler.
    return false;
  }

  // Browsers DO send `Origin` on a same-origin POST (player/input, creategame,
  // …). Those are not cross-origin — skip entirely (no warning, no headers) so
  // web users are completely unaffected. Compare hosts (scheme-agnostic → robust
  // behind a TLS-terminating proxy where the process speaks http).
  const host = req.headers.host;
  if (host !== undefined) {
    try {
      if (new URL(origin).host === host) {
        return false;
      }
    } catch {
      // Malformed Origin — fall through to the allowlist check below.
    }
  }

  const eligible = isCorsEligiblePath(pathname);
  const allowed = resolveAllowedOrigin(origin);

  // Empirical-Origin inspection aid (opt-in): print the EXACT cross-origin value
  // reaching an in-scope API — allowed or not — so the packaged renderer's real
  // Origin can be positively confirmed once. Off by default (no log spam).
  if (eligible && process.env.TM_CORS_LOG_ORIGINS === '1') {
    console.log(`[cors] ${req.method} /${pathname} Origin="${origin}" allowed=${allowed !== undefined}`);
  }

  if (eligible && allowed === undefined) {
    // Empirical-Origin aid: an in-scope cross-origin call whose Origin is not
    // allowlisted. Log the EXACT value so it can be confirmed + added to
    // TM_DESKTOP_ALLOWED_ORIGINS. (Warns only for in-scope paths → no noise.)
    console.warn(`[cors] blocked cross-origin ${req.method} /${pathname} from Origin="${origin}" — not allowlisted (set TM_DESKTOP_ALLOWED_ORIGINS)`);
  }

  if (eligible && allowed !== undefined) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    // NOTE: intentionally NO Access-Control-Allow-Credentials (token auth, not cookies).
  }

  if (isPreflight) {
    // 204 for an allowed in-scope preflight; 403 otherwise (no ACAO header was
    // set → the browser blocks it regardless, but an explicit 403 is clearer).
    res.writeHead(eligible && allowed !== undefined ? 204 : 403);
    res.end();
    return true;
  }
  return false;
}
