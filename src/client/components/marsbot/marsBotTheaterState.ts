/*
 * MarsBot turn theater — controller + reactive state.
 *
 * PRESENTATION-FLOW REWORK (notification-first): the theater is no longer an
 * auto-playing commit gate. A resolved bot turn arrives as a compact
 * turn-event NOTIFICATION (see `marsBotPresentation.ts`); the theater is its
 * EXPANDED form — a self-contained REPLAY of the archived turn script, opened
 * explicitly (the card's «Осмотреть», the journal's «Осмотреть ход», console
 * X) or automatically in the 'theater' presentation mode. The view commits
 * freely; while the theater is open the presentation orchestrator
 * (`presentationFlow.ts`) holds mandatory surfaces + notification delivery,
 * and `isMarsBotTheaterActive()` keeps the poll from re-committing mid-replay.
 *
 * Both surfaces (desktop overlay / console band) render this SAME state.
 * A replay that finishes stays on screen (`lingering`) until an explicit
 * close (desktop: Close/Esc; console: B); skipping counts as acknowledged
 * and closes fully.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {TheaterStep, buildTheaterStepsFromTags, theaterTotalMs} from './marsBotTheaterModel';

type MarsBotTheaterState = {
  active: boolean;
  /**
   * The narration finished replaying, but the player has not dismissed it
   * yet — the card/band STAYS readable until an explicit close (desktop: the
   * Close button / Esc; console: B). Skipping during the replay counts as
   * "read it" and never lingers.
   */
  lingering: boolean;
  botColor: Color | '';
  botName: string;
  steps: Array<TheaterStep>;
  /** Steps with index ≤ currentIndex are visible (the newest one is "live"). */
  currentIndex: number;
  finished: boolean;
  reducedMotion: boolean;
  /** The expansion context of the game — resolves bonus-card texts in steps. */
  ctx: BonusCardContext;
  /** Bumped per run so surfaces reset their local presentation state. */
  nonce: number;
};

export const marsBotTheaterState = reactive<MarsBotTheaterState>({
  active: false,
  lingering: false,
  botColor: '',
  botName: '',
  steps: [],
  currentIndex: -1,
  finished: false,
  reducedMotion: false,
  ctx: {venus: false, colonies: false},
  nonce: 0,
});

/** Everything a replay needs, captured at archive time (view-independent). */
export type MarsBotReplaySource = {
  botColor: Color | '';
  botName: string;
  ctx: BonusCardContext;
  turn: MarsBotTurn;
  /** Track index → identity tag, captured when the turn was archived. */
  trackTags: ReadonlyArray<Tag | undefined>;
};

let stepTimerId = 0;
let safetyTimerId = 0;
let runInFlight = false;
// The player pressed Skip during the replay — they've acknowledged the turn,
// so the run closes fully instead of entering the linger state.
let skipRequested = false;

function cancelTimers(): void {
  if (stepTimerId !== 0) {
    clearTimeout(stepTimerId);
    stepTimerId = 0;
  }
  if (safetyTimerId !== 0) {
    clearTimeout(safetyTimerId);
    safetyTimerId = 0;
  }
}

/** True while a replay is PLAYING (the poll's re-commit guard). Lingering is
 *  not "active" — the view is committed; only mandatory surfaces stay held. */
export function isMarsBotTheaterActive(): boolean {
  return marsBotTheaterState.active;
}

/**
 * Open the turn theater as a REPLAY of an archived turn script. Plays the
 * steps with client pacing, then LINGERS until the player closes it. A safety
 * timer guarantees the run always reaches its end state even with rAF/timers
 * throttled in a background tab.
 */
export function runMarsBotTheaterReplay(source: MarsBotReplaySource): void {
  cancelTimers();
  const reduced = prefersReducedMotion();
  const steps = buildTheaterStepsFromTags(source.turn, source.trackTags, reduced);

  skipRequested = false;
  runInFlight = true;
  marsBotTheaterState.active = true;
  marsBotTheaterState.lingering = false;
  marsBotTheaterState.botColor = source.botColor;
  marsBotTheaterState.botName = source.botName;
  marsBotTheaterState.steps = steps;
  marsBotTheaterState.currentIndex = 0;
  marsBotTheaterState.finished = false;
  marsBotTheaterState.reducedMotion = reduced;
  marsBotTheaterState.ctx = {...source.ctx};
  marsBotTheaterState.nonce++;

  const finish = () => {
    if (!runInFlight) {
      return;
    }
    runInFlight = false;
    cancelTimers();
    marsBotTheaterState.currentIndex = steps.length - 1;
    marsBotTheaterState.finished = true;
    endMarsBotTheater();
  };

  const scheduleNext = () => {
    const index = marsBotTheaterState.currentIndex;
    const step = steps[index];
    if (step === undefined) {
      finish();
      return;
    }
    stepTimerId = window.setTimeout(() => {
      stepTimerId = 0;
      if (index >= steps.length - 1) {
        finish();
        return;
      }
      marsBotTheaterState.currentIndex = index + 1;
      scheduleNext();
    }, motionMs(step.durationMs)) as unknown as number;
  };
  scheduleNext();

  // Timers can be throttled in background tabs — the run must never stay
  // "active" forever (it holds mandatory surfaces + the poll guard).
  safetyTimerId = window.setTimeout(finish, motionMs(theaterTotalMs(steps)) + 2500) as unknown as number;
}

/**
 * The player skips the narration mid-replay. A skip is an explicit
 * acknowledgement, so the surface closes fully instead of lingering.
 */
export function skipMarsBotTheater(): void {
  if (!marsBotTheaterState.active || !runInFlight) {
    return;
  }
  runInFlight = false;
  cancelTimers();
  skipRequested = true;
  marsBotTheaterState.currentIndex = marsBotTheaterState.steps.length - 1;
  marsBotTheaterState.finished = true;
  endMarsBotTheater();
}

/**
 * Transition out of the PLAYING state: a skipped replay was already
 * acknowledged and closes fully; a finished one STAYS on screen
 * (`lingering`) until the player dismisses it — a replay that vanishes on
 * its own is unreadable. Idempotent.
 */
export function endMarsBotTheater(): void {
  cancelTimers();
  marsBotTheaterState.active = false;
  if (skipRequested || marsBotTheaterState.steps.length === 0) {
    skipRequested = false;
    dismissMarsBotTheater();
    return;
  }
  marsBotTheaterState.finished = true;
  marsBotTheaterState.currentIndex = marsBotTheaterState.steps.length - 1;
  marsBotTheaterState.lingering = true;
}

/** The player closes the lingering narration (Close/Esc on desktop, B on console). */
export function dismissMarsBotTheater(): void {
  cancelTimers();
  runInFlight = false;
  marsBotTheaterState.active = false;
  marsBotTheaterState.lingering = false;
  marsBotTheaterState.steps = [];
  marsBotTheaterState.currentIndex = -1;
  marsBotTheaterState.finished = false;
}

/** Test-only full reset (state + timers). */
export function resetMarsBotTheater(): void {
  skipRequested = false;
  dismissMarsBotTheater();
  marsBotTheaterState.botColor = '';
  marsBotTheaterState.botName = '';
  marsBotTheaterState.ctx = {venus: false, colonies: false};
  marsBotTheaterState.nonce = 0;
}
