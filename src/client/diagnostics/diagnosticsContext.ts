/*
 * WHAT THE PAGE KNOWS THAT THE HUB CANNOT SEE — where the player stands, and what must never leave by itself.
 *
 * The hub scrubs every AUTOMATIC event (`src/common/diagnostics/privacy.ts`), and to scrub it has to be told what is on
 * this page's table: the seat's id (a key), every player's name, the names of this device's profiles. The page says it
 * here, whenever it changes — never once per event (a record born while the page is dying must not wait for a
 * description of the table).
 *
 * It also carries what an agent filters by (the screen, the profile, the language, the server's question) and, once per
 * load, which script has which debug id — what turns a stack into `src/…:line` (`common/diagnostics/debugIds.ts`).
 *
 * Pure where it matters: `buildDiagContext` takes the facts and returns the context (spec'd); the sender compares and
 * sends on change.
 */

import {debugIdsOf} from '@/common/diagnostics/debugIds';
import {DiagContext} from '@/common/diagnostics/protocol';
import {diagnosticsTransport} from '@/client/diagnostics/diagnosticsTransport';

export type DiagContextFacts = {
  screen: string;
  profile: string;
  locale: string;
  /** The seat's id ('' outside a game). */
  participantId: string;
  /** The names at the table. */
  playerNames: ReadonlyArray<string>;
  /** The names of this device's profiles. */
  profileNames: ReadonlyArray<string>;
  /** The server's question type ('' = none). */
  promptType: string;
};

export function buildDiagContext(facts: DiagContextFacts): DiagContext {
  const names = [...new Set([...facts.playerNames, ...facts.profileNames].map((n) => n.trim()).filter((n) => n !== ''))].sort();
  return {
    screen: facts.screen,
    profile: facts.profile,
    locale: facts.locale,
    // A page knows its seat and never its game's id; the hub finds the game by the seat when a report asks for the save.
    gameId: '',
    participantId: facts.participantId,
    names,
    promptType: facts.promptType,
  };
}

let lastSent = '';
let current: DiagContext = buildDiagContext({screen: '', profile: '', locale: '', participantId: '', playerNames: [], profileNames: [], promptType: ''});
let sentDebugIds = 0;

/** The context as last told (what a report request carries). */
export function currentDiagContext(): DiagContext {
  return current;
}

/** Tell the hub — only when something changed. */
export function publishDiagContext(facts: DiagContextFacts): void {
  current = buildDiagContext(facts);
  const key = JSON.stringify(current);
  if (key === lastSent) {
    return;
  }
  lastSent = key;
  diagnosticsTransport().send({kind: 'context', context: current});
}

/**
 * Which script has which debug id — sent when the registry grew (a lazy chunk that loaded later brings its own). A
 * build that was not stamped has an empty registry and nothing is sent.
 */
export function publishDebugIds(): void {
  const ids = debugIdsOf(typeof window === 'undefined' ? undefined : window);
  const count = Object.keys(ids).length;
  if (count === 0 || count === sentDebugIds) {
    return;
  }
  sentDebugIds = count;
  diagnosticsTransport().send({kind: 'debug-ids', ids});
}

/** Spec seam. */
export function __resetDiagContextForTesting(): void {
  lastSent = '';
  sentDebugIds = 0;
}
