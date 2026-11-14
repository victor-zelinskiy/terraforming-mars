/*
 * THE LAST LINE — THE CONSOLE SESSION IS REBUILT FROM THE SERVER'S VIEW (FREEZE ZERO — PLAN §4 · 6; crash-only).
 *
 * A freeze of this console is client state that stopped following the server's truth — and a reload has always cured
 * it, because everything the game screen shows is a function of the server's view. Every rung of the liveness ladder
 * is a hand-written, partial imitation of that function for one module; and past the last rung there was NOTHING: the
 * line «the ladder is spent», and a player who had to close the game. This module is what stands there now — ONE verb
 * that takes the page back to the server's truth, whatever was wrong with it.
 *
 * DEPTH. `page` — the document itself is replaced behind the loading curtain (`navigateWithCurtain`: the road of every
 * game-boundary navigation — the curtain is painted before the page goes and the next page opens under it; in the
 * native shell the overlay curtain holds the window meanwhile). Complete by construction: no module state survives a
 * document. (`shell` — the game screen remounted in the page, instant — joins once `moduleStateGuard.spec` is at
 * zero: an in-page rebuild is exactly as complete as «every module state of a game is reached by the session's end».)
 *
 * BOUNDED, never a loop (`rebuildBound.ts`): one rebuild per question, a few per window; past either the page STAYS
 * and the refusal is said once, by name — a question no rebuild can serve is a defect of the table itself.
 * `?rebuild=0` switches the line off (a control spec that must stand on a spent ladder; a diagnosis in the field).
 *
 * A REBUILD IS A DEFECT, NEVER A CURE. Its line is a `stall` of the diagnostics journal (the episode it ends is filed
 * with the outcome `rebuilt`), it is counted by the session's ledger, and the program's bar is zero of them. Nothing
 * here is shown to the player but the curtain every navigation of the game already shows.
 */

import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {decideRebuild, parseRebuildMemory} from '@/client/console/session/rebuildBound';
import {captureDiagEvidence, withDiagEvidence} from '@/client/diagnostics/diagnosticsCapture';

/** Who may ask: the arbiter past its last rung; the server's own judgement of the question's delivery. */
export type RebuildAsker = 'liveness' | 'delivery';

export type RebuildAsk = {
  by: RebuildAsker;
  /** The seat the question is asked of — the bound's key only, NEVER printed. */
  seat: string;
  /** The standing question as the evidence names it — `card#12` ('' when the server asks nothing). */
  question: string;
  /** The router's task kind (`handPick`) — the structural word of the line's cause class. */
  task: string;
  /** What the asker saw, in its own words. */
  why: string;
};

export type RebuildVerdict = 'rebuilding' | 'refused';

const STORE = 'tm_session_rebuild';

function readMemory(): string | null {
  try {
    return sessionStorage.getItem(STORE);
  } catch {
    return null;
  }
}

function writeMemory(raw: string): void {
  try {
    sessionStorage.setItem(STORE, raw);
  } catch {
    // No storage: the bound is this document's alone — the rebuild still goes (a frozen page is the worse end).
  }
}

function switchedOff(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('rebuild') === '0';
  } catch {
    return false;
  }
}

/** True from the moment this document was told to leave — it dies with the document. */
let leaving = false;
/** How the document is replaced — the curtain's road; a spec gives its own. */
let navigate: () => void = () => navigateWithCurtain(window.location.href, 'sync');

/** Is the page on its way out for a rebuild? (A net that would act meanwhile has nothing left to cure.) */
export function sessionRebuilding(): boolean {
  return leaving;
}

/**
 * Rebuild the console session — or say why not. Idempotent while the document is leaving.
 *
 * The line is printed BEFORE the document goes (the journal is mirrored as it is written — the next page adopts the
 * episode this ends), with what stood (`captureDiagEvidence`).
 */
export function rebuildConsoleSession(ask: RebuildAsk): RebuildVerdict {
  if (leaving) {
    return 'rebuilding';
  }
  const key = ask.question === '' ? '' : `${ask.seat}|${ask.question}`;
  const decision = decideRebuild(parseRebuildMemory(readMemory()), key, Date.now(), switchedOff());
  const task = ask.task === '' ? 'none' : ask.task;
  const question = ask.question === '' ? 'no question' : ask.question;
  const stood = captureDiagEvidence();
  if (decision.verdict === 'refused') {
    if (decision.tell) {
      writeMemory(JSON.stringify(decision.memory));
      const reason = decision.reason;
      withDiagEvidence(stood, () => {
        if (reason === 'again') {
          console.warn(`[session-rebuild] refused (again) — «${task}» (${question}) stands unserved after the page was rebuilt for it — by ${ask.by}: ${ask.why}`);
        } else if (reason === 'rate') {
          console.warn(`[session-rebuild] refused (rate) — «${task}» (${question}) stays as it stands: the window of rebuilds is full — by ${ask.by}: ${ask.why}`);
        } else {
          console.warn(`[session-rebuild] refused (off) — «${task}» (${question}) stays as it stands: the last line is switched off (?rebuild=0) — by ${ask.by}: ${ask.why}`);
        }
      });
    }
    return 'refused';
  }
  leaving = true;
  writeMemory(JSON.stringify(decision.memory));
  withDiagEvidence(stood, () => console.warn(`[session-rebuild] page — «${task}» (${question}) — by ${ask.by}: ${ask.why}`));
  navigate();
  return 'rebuilding';
}

/** Test seam: a spec's document does not leave — it is told instead. Returns the undo. */
export function __setSessionRebuildNavigateForTesting(fake: () => void): () => void {
  const was = navigate;
  navigate = fake;
  leaving = false;
  return () => {
    navigate = was;
    leaving = false;
  };
}
