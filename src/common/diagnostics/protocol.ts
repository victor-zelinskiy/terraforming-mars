/*
 * THE PAGE ↔ HUB PROTOCOL — what the page says to whoever carries its diagnostics off the device, and what it hears.
 *
 * The HUB is the one sender (`src/server/diagnostics/hub/`): today it runs in the Electron main process and the page
 * reaches it over the desktop bridge; a hosted server will run the same hub and a web page will reach it over HTTP.
 * Neither side of this file knows which — that is the seam (`docs/claude/diagnostics.md` § The seams).
 *
 * Verbs the page INVOKES (a promise of the answer), lines it SENDS (no answer), events the hub PUSHES.
 * Pure types.
 */

import {DiagEntry, DiagRuntime} from './DiagnosticModel';
import {DiagChange} from './journal';

/** What kind of deployment the page runs in — a tag of every event, and what decides whether a save can be attached. */
export type DiagAppMode =
  /** The desktop app with its own embedded game server (the save is on this device). */
  'host' |
  /** The desktop app as a thin client of a remote server. */
  'remote' |
  /** A browser page of a hosted server. */
  'web';

/** Why nothing leaves the device by itself ('' = it does). */
export type DiagSendingOff =
  '' |
  /** The player switched automatic reports off. */
  'consent' |
  /** This build has no destination (a local build, a development run, a test) — nothing is ever sent from it. */
  'environment';

export type DiagHubStatus = {
  /** `box` (the owner's machine) · `production` (a player's release) · `development` (never sends). */
  environment: string;
  /** `terraforming-mars@<version>` — the release the events are filed under. */
  release: string;
  appMode: DiagAppMode;
  sendingOff: DiagSendingOff;
  /** The player's choice for AUTOMATIC reports (an explicit report is always the player's own press). */
  consent: boolean;
  /** Envelopes waiting for the network. */
  queued: number;
  /** When the transport last delivered anything (ms since the epoch; 0 = never in this run). */
  lastDeliveredAt: number;
  /** The transport's last failure in its own words ('' = none since the last delivery). */
  lastError: string;
  /**
   * What the COLLECTOR refuses right now by its own limits — the plan's quota, a key's rate limit, the spike
   * protection: '' (nothing it told us of) · `events` (it takes nothing: reports wait on this device) · `attachments`
   * (events go, their files do not). Never «no network»: the player is told which of the two it is.
   */
  limitedWhat: '' | 'events' | 'attachments';
  /** The collector's own word for the reason (`usage_exceeded`, `key_quota` …; '' = it gave none). */
  limitedReason: string;
  /** Where the report packages are kept on this device. */
  reportsDir: string;
};

/**
 * What the page knows that the hub cannot see: where the player stands, and what must never leave by itself. Sent
 * whenever it changes; the hub scrubs every AUTOMATIC payload with it (`privacy.ts`).
 */
export type DiagContext = {
  screen: string;
  profile: string;
  locale: string;
  /** The game and the seat ('' outside a game). KEYS — they travel only inside an explicit report. */
  gameId: string;
  participantId: string;
  /** Every name on this table and of this device's profiles. Never sent by themselves. */
  names: Array<string>;
  /** The server's question type ('' = none) — a tag. */
  promptType: string;
};

export type DiagReportCategory = 'freeze' | 'visual' | 'rules' | 'crash' | 'other';

export const DIAG_REPORT_CATEGORIES: ReadonlyArray<DiagReportCategory> = ['freeze', 'visual', 'rules', 'crash', 'other'];

export type DiagReportRequest = {
  category: DiagReportCategory;
  /** The player's own words ('' = none). */
  comment: string;
  /** The journal record the report was opened from ('' = none). */
  entryId: string;
  context: DiagContext;
  /** The page's journal and the field recorder's ring, as the page holds them at the press. */
  journal: Array<DiagEntry>;
  fieldRecord: unknown;
};

/** One file of a report package. */
export type DiagReportPart = {
  /** `report.json`, `console_export.txt`, `screen.jpg`, `save.json`, … */
  name: string;
  bytes: number;
  /** Cut to fit the budget (the file says where). */
  truncated: boolean;
};

export type DiagReportResult = {
  /** `TM-XXXXXX` — what the player reads out. */
  code: string;
  /**
   * `sent` — the developer has it. `queued` — it leaves when the network returns (it is kept on this device meanwhile).
   * `local` — this build sends nothing; the package is on this device only.
   */
  state: 'sent' | 'queued' | 'local';
  /** A `queued` report waits for: the network to return, or the collector's limit to renew ('' = it does not wait). */
  waits: '' | 'network' | 'limit';
  /** `sent`, but the collector took the summary only — its limit for attached files is reached (they are in the folder). */
  filesRefused: boolean;
  /** The folder of the package on this device. */
  folder: string;
  parts: Array<DiagReportPart>;
};

export type DiagSelfTestRow = {
  runtime: DiagRuntime;
  /** `delivered` — the collector accepted it. `failed` — it did not arrive, `reason` says why. `absent` — this runtime does not run here. */
  state: 'delivered' | 'failed' | 'absent';
  eventId: string;
  reason: string;
  /** `failed` because the collector's limit is reached — not because the device has no network. */
  limited: boolean;
};

export type DiagSelfTestResult = {
  rows: Array<DiagSelfTestRow>;
  /** Milliseconds the whole check took. */
  tookMs: number;
};

/** What the page may ask. */
export type DiagInvoke = {
  /** Every record of this app run the hub mirrors (earlier page loads, the main process, the server). */
  journal: {request: undefined, response: Array<DiagEntry>};
  status: {request: undefined, response: DiagHubStatus};
  'set-consent': {request: boolean, response: DiagHubStatus};
  /** Keep the frame on screen NOW (before a menu covers it) for a report that may follow. */
  'hold-screen': {request: undefined, response: boolean};
  /** The held frame is not needed any more. */
  'drop-screen': {request: undefined, response: boolean};
  report: {request: DiagReportRequest, response: DiagReportResult};
  /** `pageEventId` — the page's own test record, already sent as a line. */
  selftest: {request: {pageEntryId: string}, response: DiagSelfTestResult};
  /** The full text of a record the hub holds, put on the system clipboard. */
  copy: {request: string, response: boolean};
};

export type DiagVerb = keyof DiagInvoke;

/** What the page tells without waiting for an answer. */
export type DiagSend =
  {kind: 'entry', entry: DiagEntry, change: DiagChange} |
  {kind: 'context', context: DiagContext} |
  /** The page's script files and their debug ids (file URL → id) — what resolves a stack to `src/…:line`. */
  {kind: 'debug-ids', ids: Record<string, string>};

/** What the hub tells the page. */
export type DiagPush =
  /** A record born outside the page (the main process, the server) — or the delivery state of one of the page's. */
  {kind: 'entry', entry: DiagEntry} |
  {kind: 'delivery', id: string, delivery: DiagEntry['delivery']} |
  /** The developer's key (F12): open the journal. */
  {kind: 'open-journal'} |
  {kind: 'status', status: DiagHubStatus};

/**
 * HOW A PLAYER REACHES THE DEVELOPER — ONE value, in ONE place (the owner's decision of 2026-11-14: for now there is
 * NO channel; a report reaches the developer by itself, and its code is for reference). While this is empty, no line
 * about a contact exists anywhere — not on the report's last step, not in the guides. Setting it (a short address a
 * person can type or read out) is the whole change: the last step then prints it under the code.
 * (`DISCORD_INVITE` of `common/constants.ts` is the ORIGINAL project's community — never this.)
 */
export const DIAG_CONTACT: string = '';

/** A report code: `TM-` + six characters of an alphabet with no look-alikes (no 0 / O, 1 / I / L, 5 / S, 2 / Z, 8 / B). */
export const REPORT_CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
export const REPORT_CODE_PATTERN = /^TM-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/;

/** A fresh code from six random numbers in [0, 1). Pure of its randomness. */
export function reportCodeFrom(randoms: ReadonlyArray<number>): string {
  let code = 'TM-';
  for (let i = 0; i < 6; i++) {
    code += REPORT_CODE_ALPHABET[Math.floor((randoms[i] ?? 0) * REPORT_CODE_ALPHABET.length) % REPORT_CODE_ALPHABET.length];
  }
  return code;
}
