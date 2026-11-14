/*
 * THE DEVELOPER'S NOTICE — an error or a stall of the screen, shown ON the screen the moment it is recorded.
 *
 * Why it is NOT a card of the game's notification feed: that feed is a FIFO of the game's story, and its delivery is
 * blocked by exactly the things a stall is made of — an animation hold that never released, a result modal, the turn
 * theatre, a ceremony. A notice that waits for the screen to recover would arrive after the fact it exists to show.
 * This one has its own tiny state, its own layer (`ConsoleDevNotice`, app-level, above every game surface, outside the
 * shell) and its own input gate at the pad's funnel — it stands while the shell does not.
 *
 * TWO POSES, one place:
 *  · the PLATE — the newest record: its kind, what happened in a person's words, how it ended (an episode updates its
 *    plate in place), and the hold-X hint; it stands `NOTICE_PLATE_MS`, then folds into
 *  · the CHIP — «✕ 2 · ◷ 1»: how many errors and stalls the developer has not opened yet. It stays until the journal is
 *    opened (the notice is an opt-in instrument: what it showed is not taken back by a timer).
 *
 * HOLD X (`secondary`) — «как у событий»: a TAP stays the screen's own X (it is replayed to whatever is under the
 * notice); a HOLD of `NOTIF_HOLD_MS` opens the record's full text. The notice YIELDS the gesture to a card of the game's
 * feed standing on screen (that card's own hold-X detail comes first), and takes it when no card stands — which is the
 * very moment the feed is blocked.
 *
 * Off by default (`diagnosticsPrefs.ts`). State of the PAGE.
 */

import {reactive} from 'vue';
import {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {DiagChange} from '@/common/diagnostics/journal';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {NOTIF_HOLD_MS} from '@/client/console/consoleNotifHold';
import {consoleAppScope} from '@/client/console/session/consoleSession';
import {notificationState} from '@/client/components/notifications/notificationState';
import {onDiagnosticEntry} from '@/client/diagnostics/diagnosticsCapture';
import {devNoticeShows, devNoticeState} from '@/client/diagnostics/diagnosticsPrefs';
import {openDiagnosticsOverlay} from '@/client/diagnostics/diagnosticsOverlayBridge';
import {diagSurfaceState, holdDiagnosticsScreen} from '@/client/diagnostics/diagnosticsSurface';
import {tabOfKind} from '@/client/diagnostics/diagnosticsView';

/** How long the plate stands before it folds into the chip. */
export const NOTICE_PLATE_MS = 9_000;

export const devNoticeView = reactive({
  /** The record the plate shows ('' = nothing to show yet). */
  entryId: '',
  /** The plate folded into the chip. */
  folded: false,
  /** Records raised and not opened yet, by the tab they are filed under. */
  unseenErrors: 0,
  unseenStalls: 0,
  /** The X-hold is filling (the plate draws the fill for exactly `NOTIF_HOLD_MS`). */
  holding: false,
  /** Bumped by every raise: the plate replays its one-shot entry when a NEW record takes it. */
  raises: 0,
});

let installed = false;
let cancelFold: (() => void) | undefined;
let cancelHold: (() => void) | undefined;
let consumeRelease = false;
const counted = new Set<string>();

/** The notice is on screen in either pose. Reactive. */
export function devNoticeVisible(): boolean {
  return devNoticeState.mode !== 'off' && devNoticeView.entryId !== '' && !diagSurfaceState.shown;
}

/** A card of the game's feed stands — its own hold-X comes first. */
function feedCardStands(): boolean {
  return notificationState.transient.length > 0;
}

/** A decision surface is docked in the central opening (the shell's own presence class — `conWsPresenceBridge`). */
function workspaceDocked(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.con-root--ws-open') !== null;
}

function raise(entry: DiagEntry, change: DiagChange): void {
  if (!devNoticeShows(devNoticeState.mode, entry.kind) || entry.family === 'selftest') {
    return;
  }
  const v = devNoticeView;
  // A plain repeat of the record already on the plate changes its count, not the notice's pose.
  if (change === 'update' && entry.episode === undefined) {
    return;
  }
  if (!counted.has(entry.id)) {
    counted.add(entry.id);
    if (tabOfKind(entry.kind) === 'stalls') {
      v.unseenStalls++;
    } else {
      v.unseenErrors++;
    }
  }
  if (v.entryId !== entry.id) {
    v.raises++;
  }
  v.entryId = entry.id;
  // OVER A DOCKED WORKSPACE there is no free corner (the band is the workspace's): the notice arrives as its chip —
  // counted, holdable, and covering nothing but a hand's breadth.
  if (workspaceDocked()) {
    cancelFold?.();
    cancelFold = undefined;
    v.folded = true;
    return;
  }
  // An episode that moved (one more rung, its cure) brings the plate back; so does a new record.
  if (change !== 'update' || v.folded === false) {
    v.folded = false;
    cancelFold?.();
    // PACING: the fold is the notice's own pose — nothing outside waits for it.
    cancelFold = consoleAppScope().after(NOTICE_PLATE_MS, 'the developer\'s notice folds into its chip', () => {
      cancelFold = undefined;
      v.folded = true;
    });
  }
}

/** The journal was opened: what the notice counted has been seen. */
export function acknowledgeDevNotice(): void {
  const v = devNoticeView;
  cancelFold?.();
  cancelFold = undefined;
  cancelHoldFill();
  v.entryId = '';
  v.folded = false;
  v.unseenErrors = 0;
  v.unseenStalls = 0;
  counted.clear();
}

function cancelHoldFill(): boolean {
  const was = devNoticeView.holding;
  cancelHold?.();
  cancelHold = undefined;
  devNoticeView.holding = false;
  return was;
}

/**
 * THE PAD'S FUNNEL ASKS FIRST (`GamepadLayer` — pad and keyboard): is this X the notice's?
 *
 *  · press → the hold begins (consumed);
 *  · release before the threshold → a TAP: consumed here and REPLAYED (press, then release) to the screen under the
 *    notice, so X keeps its meaning there;
 *  · the threshold passes → the record opens; the release that follows is consumed once.
 *
 * Returns true when the intent was taken.
 */
export function interceptDevNoticeIntent(intent: GamepadIntent, replay: (intent: GamepadIntent) => void): boolean {
  if (intent.kind !== 'press' && intent.kind !== 'release') {
    return false;
  }
  if (intent.button !== 'secondary') {
    return false;
  }
  if (intent.kind === 'release') {
    if (consumeRelease) {
      consumeRelease = false;
      return true;
    }
    if (cancelHoldFill()) {
      replay({kind: 'press', button: 'secondary'});
      replay({kind: 'release', button: 'secondary'});
      return true;
    }
    return false;
  }
  if (!devNoticeVisible() || feedCardStands()) {
    return false;
  }
  const entryId = devNoticeView.entryId;
  devNoticeView.holding = true;
  consumeRelease = false;
  // PACING: a hold whose page left never fires. The duration is input cadence, not choreography — fixed, never
  // `motionMs`-scaled (the same constant the plate's fill animation takes).
  cancelHold = consoleAppScope().after(NOTIF_HOLD_MS, 'the X-hold on the developer\'s notice fills', () => {
    cancelHold = undefined;
    devNoticeView.holding = false;
    consumeRelease = true;
    void holdDiagnosticsScreen().then(() => openDiagnosticsOverlay({to: 'entry', id: entryId}));
  });
  return true;
}

/** Idempotent — called once by the app-level layer. */
export function installDevNotice(): void {
  if (installed) {
    return;
  }
  installed = true;
  onDiagnosticEntry(raise);
}

/** Spec seam. */
export function __resetDevNoticeForTesting(): void {
  acknowledgeDevNotice();
  consumeRelease = false;
  installed = false;
}
