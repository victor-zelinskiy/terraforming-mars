import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {LogMessage} from '@/common/logs/LogMessage';
import {GameEvent} from '@/common/events/GameEvent';
import {ParticipantId} from '@/common/Types';
import {startRealtimePoller} from '@/client/components/realtime/realtimePoller';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';

/*
 * journalDataSource — the ONE journal feed brain shared by the two shells:
 * the desktop `JournalPanel` and the console-native `ConsoleJournalPanel`
 * (the P16 "one brain, two shells" pattern). Extracted VERBATIM from
 * JournalPanel so the desktop behaviour stays byte-identical:
 *
 *  - `GET /api/game/logs?id=&generation=` (structured LogMessage[]) + the
 *    sibling `/api/game/journal-events` fetch for event-driven children;
 *  - live-follow: while the selected generation IS the current one, every
 *    `pullLatest()` re-fetches it so fresh entries stream in; selecting an
 *    older generation drops out of follow mode (static history);
 *  - `loadEpoch` is bumped ONLY on a whole-list swap (generation switch /
 *    an explicit `bumpEpoch()` for filter / mode changes), so the feed can
 *    tell "silent fade + re-key" from "appended live";
 *  - an independent realtime poller keeps the feed fresh in phases where
 *    the playerView never refreshes (simultaneous draft / research).
 */

// How often the open journal re-polls the logs endpoint while following
// the latest generation (see JournalPanel for the full rationale).
const LIVE_POLL_INTERVAL_MS = 1500;

export type JournalFeedState = {
  messages: ReadonlyArray<LogMessage>;
  /** Structured events of the selected generation — event-driven children. */
  events: ReadonlyArray<GameEvent>;
  selectedGeneration: number;
  followLatest: boolean;
  loadEpoch: number;
  loading: boolean;
};

export type JournalDataSource = {
  /** Reactive feed state — safe to expose to templates via computeds. */
  state: JournalFeedState;
  /** Load a specific generation (no-op when already selected). */
  selectGeneration(gen: number): void;
  /** Re-pull the current generation while following the latest. */
  pullLatest(): void;
  /** Force a soft re-key of the feed (filter / display-mode change). */
  bumpEpoch(): void;
  /** Initial load + start the independent live poller. */
  start(): void;
  /** Stop polling + abort in-flight requests. */
  dispose(): void;
};

type Host = {
  /** The viewer's participant id (undefined → fetches are skipped). */
  id: () => ParticipantId | undefined;
  /** The CURRENT game generation (live, from the view model). */
  generation: () => number;
};

export function createJournalDataSource(host: Host): JournalDataSource {
  const state = reactive<JournalFeedState>({
    messages: [],
    events: [],
    selectedGeneration: -1,
    followLatest: true,
    loadEpoch: 0,
    loading: false,
  });

  let abort: AbortController | undefined;
  let eventsAbort: AbortController | undefined;
  let stopPoller: (() => void) | undefined;

  // Fetch the generation's structured events (bounded — not the full stream).
  // Replaced only when the set actually changed, so silent polls don't churn.
  function fetchEvents(generation: number, bumpEpoch: boolean): void {
    const id = host.id();
    if (id === undefined) {
      return;
    }
    if (eventsAbort !== undefined) {
      eventsAbort.abort();
    }
    const controller = new AbortController();
    eventsAbort = controller;
    const url = `${apiUrl(paths.API_GAME_JOURNAL_EVENTS)}?id=${id}&generation=${generation}`;
    fetch(url, {signal: controller.signal})
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data: Array<GameEvent> | null) => {
        if (data === null) {
          return;
        }
        if (bumpEpoch || data.length !== state.events.length) {
          state.events = data;
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('error updating journal events');
        }
      });
  }

  function fetchLogs(generation: number, opts: {bumpEpoch: boolean, showLoading: boolean}): void {
    const id = host.id();
    if (id === undefined) {
      return;
    }
    // Event-driven children ride alongside the logs for the same generation.
    fetchEvents(generation, opts.bumpEpoch);
    // Abort any in-flight request so a slow historical fetch can't land
    // after a newer one.
    if (abort !== undefined) {
      abort.abort();
    }
    const controller = new AbortController();
    abort = controller;
    if (opts.showLoading) {
      state.loading = true;
    }

    const url = `${apiUrl(paths.API_GAME_LOGS)}?id=${id}&generation=${generation}`;
    fetch(url, {signal: controller.signal})
      .then((resp) => {
        if (!resp.ok) {
          console.error(`error updating journal, response code ${resp.status}`);
          return null;
        }
        return resp.json();
      })
      .then((data: Array<LogMessage> | null) => {
        if (data === null) {
          state.loading = false;
          return;
        }
        // The log is append-only within a generation, so on a silent
        // live poll we only swap (and re-render) when the length grew —
        // identical-length polls are no-ops. A generation load always
        // swaps + bumps the epoch so the feed re-keys cleanly.
        if (opts.bumpEpoch) {
          state.messages = data;
          state.loadEpoch++;
        } else if (data.length !== state.messages.length) {
          state.messages = data;
        }
        state.loading = false;
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        state.loading = false;
        console.error('error updating journal, unable to reach server');
      });
  }

  function selectGeneration(gen: number): void {
    if (gen === state.selectedGeneration) {
      return;
    }
    state.selectedGeneration = gen;
    state.followLatest = gen === host.generation();
    fetchLogs(gen, {bumpEpoch: true, showLoading: true});
  }

  // Re-pull the current generation while following the latest. Used by both
  // the host's view watcher (instant) and the interval poll (safety net).
  // A generation rollover loads the new generation as a fresh epoch;
  // otherwise it appends silently.
  function pullLatest(): void {
    if (!state.followLatest) {
      return;
    }
    const gen = host.generation();
    if (state.selectedGeneration !== gen) {
      state.selectedGeneration = gen;
      fetchLogs(gen, {bumpEpoch: true, showLoading: false});
    } else {
      fetchLogs(gen, {bumpEpoch: false, showLoading: false});
    }
  }

  function start(): void {
    state.selectedGeneration = host.generation();
    state.followLatest = true;
    fetchLogs(state.selectedGeneration, {bumpEpoch: true, showLoading: true});
    if (stopPoller !== undefined) {
      return;
    }
    // Refetch on every realtime wake (game change) + a lengthened fallback
    // while WS is healthy; falls back to the safe live rate when WS is down.
    stopPoller = startRealtimePoller(() => pullLatest(), LIVE_POLL_INTERVAL_MS, realtimePollIntervalMs);
  }

  function dispose(): void {
    if (stopPoller !== undefined) {
      stopPoller();
      stopPoller = undefined;
    }
    if (abort !== undefined) {
      abort.abort();
    }
    if (eventsAbort !== undefined) {
      eventsAbort.abort();
    }
  }

  return {
    state,
    selectGeneration,
    pullLatest,
    bumpEpoch: () => state.loadEpoch++,
    start,
    dispose,
  };
}
