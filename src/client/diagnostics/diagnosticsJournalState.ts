/*
 * THE JOURNAL, AS THE PAGE SHOWS IT — the reactive face of the interceptor's `DiagJournal`, and its mirror in the hub.
 *
 * The interceptor (`diagnosticsCapture.ts`) records from the page's first line and knows nothing of Vue; this module
 * is what the surfaces read (the developer's notice, the journal screen, the report). It also keeps the three promises
 * the journal makes across a page's death:
 *
 *  · every record goes to the hub AS IT IS MADE (a one-way line — a page that is about to be killed by the hang watch
 *    cannot wait for an answer);
 *  · the next page ADOPTS what the hub mirrors — the earlier page's records, the main process's, the server's — so
 *    «what happened before the renderer was restarted» is on screen;
 *  · with no hub (a browser page), the same mirror is the tab's session storage.
 *
 * State of the PAGE: it outlives every game screen (`consoleAppScope()` owns its tick), and nothing here resets when a
 * game is left — a journal that forgot the game it was opened to explain would be no journal.
 */

import {reactive} from 'vue';
import {DiagEntry, DiagKind} from '@/common/diagnostics/DiagnosticModel';
import {DiagChange} from '@/common/diagnostics/journal';
import {DiagPush} from '@/common/diagnostics/protocol';
import {consoleAppScope} from '@/client/console/session/consoleSession';
import {announceDiagnosticEntry, diagnosticsGameAlive, onDiagnosticEntry, pageJournal} from '@/client/diagnostics/diagnosticsCapture';
import {publishDebugIds} from '@/client/diagnostics/diagnosticsContext';
import {noteDiagnosticsHubStatus, refreshDiagnosticsHubStatus} from '@/client/diagnostics/diagnosticsHubState';
import {diagnosticsTransport} from '@/client/diagnostics/diagnosticsTransport';

export const diagJournalState = reactive({
  /** Bumped by every change of the journal — what a reader depends on (the records themselves are plain objects). */
  revision: 0,
  /** The id of the newest record of each kind, for «is there something I have not seen». */
  newest: '' as string,
  /** The hub's mirror was read (or there is no hub) — until then the list may still gain earlier records. */
  adopted: false,
});

/** A page with no hub mirrors its journal here (a reload keeps the tab's session storage). */
const SESSION_KEY = 'tm_diag_journal';
const MIRROR_DEBOUNCE_MS = 400;
/** How often an open episode is re-judged for silence. */
const TICK_MS = 5_000;
/** Every this many ticks the page tells the hub it is alive (a minute) — what the session's play time is counted from. */
const PULSE_TICKS = 12;

let installed = false;
let mirrorArmed = false;
const pushListeners = new Set<(push: DiagPush) => void>();
/** Records the HUB handed over (the main process's, the server's) — they are shown, never mirrored back. */
const foreign = new Set<string>();

/** Every record, NEWEST FIRST. Reactive: re-read when the journal changes. */
export function diagEntries(): ReadonlyArray<DiagEntry> {
  void diagJournalState.revision;
  const entries = pageJournal()?.entries() ?? [];
  return [...entries].reverse();
}

export function diagEntry(id: string): DiagEntry | undefined {
  void diagJournalState.revision;
  return pageJournal()?.find(id);
}

/** How many records of each kind the journal holds. Reactive. */
export function diagCounts(): Record<DiagKind, number> {
  const counts: Record<DiagKind, number> = {error: 0, stall: 0, integrity: 0, perf: 0, note: 0};
  for (const entry of diagEntries()) {
    counts[entry.kind]++;
  }
  return counts;
}

/** What the hub pushes that is not a record (the developer's key, a status) — for the surfaces. Returns the unsubscribe. */
export function onDiagnosticsPush(listener: (push: DiagPush) => void): () => void {
  pushListeners.add(listener);
  return () => pushListeners.delete(listener);
}

function changed(entry: DiagEntry): void {
  diagJournalState.newest = entry.id;
  diagJournalState.revision++;
}

/**
 * Which changes travel to the hub. A new record and a closed episode always; an episode's every line (one per rung —
 * two seconds apart at most); a plain repeat only when its count doubles — an exception thrown on every frame must not
 * become sixty messages a second to the main process.
 */
export function mirrorsToHub(entry: DiagEntry, change: DiagChange): boolean {
  if (change !== 'update' || entry.episode !== undefined) {
    return true;
  }
  return (entry.count & (entry.count - 1)) === 0;
}

function writeSessionMirror(): void {
  mirrorArmed = false;
  try {
    const entries = (pageJournal()?.entries() ?? []).slice(-80);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or disabled — the journal still stands for this page.
  }
}

function readSessionMirror(): Array<DiagEntry> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw === null ? [] : JSON.parse(raw) as Array<DiagEntry>;
  } catch {
    return [];
  }
}

/** What the hub tells the page (the transport's one listener; exported for the spec that plays the hub). */
export function acceptDiagnosticsPush(push: DiagPush): void {
  const journal = pageJournal();
  if (push.kind === 'entry' && journal !== undefined) {
    foreign.add(push.entry.id);
    // Told like one of the page's own: the list re-reads, and the developer's notice raises for it — a window that
    // stopped answering and an exception of the game server are exactly what that notice is for.
    announceDiagnosticEntry(push.entry, journal.accept(push.entry));
    return;
  }
  if (push.kind === 'delivery' && journal !== undefined) {
    const entry = journal.find(push.id);
    if (entry !== undefined && push.delivery !== undefined) {
      entry.delivery = push.delivery;
      diagJournalState.revision++;
    }
    return;
  }
  if (push.kind === 'status') {
    // The hub's own word about itself (a report left the queue, the consent changed in another window).
    noteDiagnosticsHubStatus(push.status);
    return;
  }
  for (const listener of pushListeners) {
    listener(push);
  }
}

/** Idempotent — called once by `main.ts` when the app is created. */
export function installDiagnosticsJournal(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  const transport = diagnosticsTransport();
  const journal = pageJournal();
  // What the page recorded BEFORE this module stood (the boot's own lines) goes to the hub first, in order.
  for (const entry of journal?.entries() ?? []) {
    transport.send({kind: 'entry', entry, change: 'new'});
  }
  onDiagnosticEntry((entry, change) => {
    changed(entry);
    if (foreign.has(entry.id)) {
      return;
    }
    if (transport.kind === 'none') {
      if (!mirrorArmed) {
        mirrorArmed = true;
        // A RELEASE of the page's scope: the mirror is what the next page reads, so it is written even if the scope ends.
        consoleAppScope().guarantee(MIRROR_DEBOUNCE_MS, 'the diagnostics journal\'s session mirror', writeSessionMirror);
      }
      return;
    }
    if (mirrorsToHub(entry, change)) {
      // A stack is resolved by the debug ids of its files: told before the record that needs them (a lazy chunk that
      // loaded since the last record brings its own).
      if (change === 'new' && entry.stack !== undefined) {
        publishDebugIds();
      }
      transport.send({kind: 'entry', entry, change});
    }
  });
  transport.onPush(acceptDiagnosticsPush);
  // ADOPT what stood before this page: the hub's mirror, or the tab's.
  const adopt = (prior: ReadonlyArray<DiagEntry> | undefined): void => {
    if (prior !== undefined && prior.length > 0) {
      journal?.adopt(prior);
    }
    diagJournalState.adopted = true;
    diagJournalState.revision++;
  };
  if (transport.kind === 'none') {
    adopt(readSessionMirror());
  } else {
    void transport.invoke('journal', journal === undefined ? undefined : {session: journal.session}).then(adopt);
    // THE HUB'S STATUS IS ASKED AT BOOT, not at the first opening of the diagnostics surface: the settings console
    // shows «Автоотчёты об ошибках» only once the hub has said what the player's choice is — and a player who goes to
    // the settings first must find the row there (the e2e's «two doors» stand found it missing).
    void refreshDiagnosticsHubStatus();
  }
  // An episode nobody is curing any more is closed as «не вылечено» — the page's own tick, for the page's whole life.
  let ticks = 0;
  consoleAppScope().every(TICK_MS, 'the diagnostics journal re-judges its open episodes', () => {
    for (const entry of journal?.tick(Date.now()) ?? []) {
      announceDiagnosticEntry(entry, 'close');
    }
    // …and once a minute the page says it lives (the same tick — no timer of its own): the hub's play clock.
    if (++ticks % PULSE_TICKS === 0 && transport.kind !== 'none') {
      transport.send({kind: 'pulse', inGame: diagnosticsGameAlive()});
    }
  });
  // The page is leaving under an open episode: it was never cured here, and the next page must read it so.
  window.addEventListener('pagehide', () => {
    for (const entry of journal?.closeOpenEpisodes() ?? []) {
      transport.send({kind: 'entry', entry, change: 'close'});
    }
    if (transport.kind === 'none') {
      writeSessionMirror();
    }
  });
}
