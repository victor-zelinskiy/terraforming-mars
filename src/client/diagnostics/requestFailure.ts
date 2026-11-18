/*
 * A REQUEST THAT FAILED IS THE NETWORK'S WORD — unless something of OURS threw.
 *
 * The page asks the server for many things (the view, the journal, the log, a profile, a saved game), and a failure of
 * any of them used to be `console.error(err)` — an UNTAGGED error, which the collector receives as an exception of the
 * game (`common/diagnostics/classify.ts`: an untagged `console.error` is kind `error`, sent). So a player's Wi-Fi
 * blinking, a server being restarted, a login that is simply not there — each was filed as a bug, stackless, and
 * grouped with the real ones (the audit of 2026-11-19: 15 of the 34 sites that reach the collector as errors were
 * this). And the SAME `catch` often receives a throw of our own code — a response that would not parse, a presenter
 * that threw — which was then shown to the player as «cannot contact the server» and filed under the network's noise.
 *
 * ONE DOOR, and it reads WHAT failed:
 *   · the NETWORK (the fetch rejected, was aborted, timed out) or the SERVER'S OWN ANSWER (a status that is not OK) →
 *     a NOTE, `[net] <where> — <what>`: never an event; a breadcrumb of the next one, a line of the journal, a count
 *     of the session. A 5xx is the server's defect, and the server reports it itself, with its stack.
 *   · ANYTHING ELSE the catch received → an ERROR by the sanctioned door (`reportDiagnosticError`), with its stack.
 *
 * Returns `'network'` or `'bug'`, so a caller can tell the player the truth («the server cannot be reached» is a
 * lie about a presenter that threw).
 */
import {pageErrorLine, reportDiagnosticError} from '@/client/diagnostics/diagnosticsCapture';

/** The server answered, and its answer is not OK — thrown by a caller that reads the status, caught by `requestFailed`. */
export class HttpStatusError extends Error {
  /**
   * `said` — the server's own words for the PLAYER (a refusal's text the caller shows in its surface): it becomes the
   * error's message, and is NEVER printed by this module — a refusal may name a table, a campaign, a seat.
   */
  public constructor(public readonly status: number, public readonly statusText: string = '', said?: string) {
    super(said !== undefined && said !== '' ? said : `HTTP ${status}${statusText !== '' ? ` ${statusText}` : ''}`);
    this.name = 'HttpStatusError';
  }
}

/** What a browser's `fetch` rejects with when the request never got an answer (Chromium · Firefox · WebKit). */
const NETWORK_WORDS = /failed to fetch|networkerror|load failed|network request failed|the network connection was lost|err_(?:internet|network|connection|name_not_resolved)/i;

/** PURE: is this what a request rejects with when the network (or the request's own bound) ended it? */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof HttpStatusError) {
    return true;
  }
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const name = String((err as {name?: unknown}).name ?? '');
  const message = String((err as {message?: unknown}).message ?? '');
  // An abort (the request's own bound, a navigation away) and a timeout are the request's, never a defect.
  if (name === 'AbortError' || name === 'TimeoutError') {
    return true;
  }
  // `fetch` rejects with a TypeError whose words are the browser's.
  return name === 'TypeError' && NETWORK_WORDS.test(message);
}

/**
 * A CHUNK OF AN OLDER BUILD — the page was open while the server was redeployed, and a lazy part of it is asked for
 * under a name the server no longer has. Not a defect of the game: the page is out of date and must be reloaded.
 * What a failed dynamic import rejects with is the BROWSER's word (the bundler names nothing of its own since the
 * move to Vite — the old check for webpack's `ChunkLoadError` could never match, so the player was never offered the
 * reload and the failure was filed as a `[vue-error]`). PURE.
 */
const STALE_CHUNK_WORDS = /dynamically imported module|importing a module script failed|unable to preload css|failed to load module script/i;

export function isStaleChunkFailure(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const name = String((err as {name?: unknown}).name ?? '');
  const message = String((err as {message?: unknown}).message ?? '');
  return name === 'ChunkLoadError' || STALE_CHUNK_WORDS.test(message);
}

/** The note a stale chunk is said as (one wording for every site that meets it). */
export function staleChunkNoted(err: unknown): void {
  console.warn(`[net] a part of this page's build could not be loaded — the page is out of date — ${said(err)}`);
}

function said(err: unknown): string {
  return (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).replace(/\s+/g, ' ').slice(0, 200);
}

/**
 * A request's `catch`: the network's word is a note, a throw of our own is an error. `where` — a few fixed words that
 * name the request («the journal's poll», «the saved game's load») — never an id, a name or an address.
 */
export function requestFailed(where: string, err: unknown): 'network' | 'bug' {
  if (err instanceof HttpStatusError) {
    // (The status only — the answer's words may be a refusal written for the player, with names in it.)
    requestRefused(where, err.status, err.statusText);
    return 'network';
  }
  if (isNetworkFailure(err)) {
    console.warn(`[net] ${where} — ${said(err)}`);
    return 'network';
  }
  reportDiagnosticError(pageErrorLine(`caught by ${where}`, err), err);
  return 'bug';
}

/** The server ANSWERED a request, and the answer is not OK: its own word — a note (see the header). */
export function requestRefused(where: string, status: number, statusText: string = ''): void {
  console.warn(`[net] ${where} — the server answered ${status}${statusText !== '' ? ` ${statusText.replace(/\s+/g, ' ').slice(0, 80)}` : ''}`);
}
