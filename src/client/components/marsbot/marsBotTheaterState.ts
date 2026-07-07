/*
 * MarsBot turn theater — controller + reactive state (the conversion-gate
 * pattern of `energyConversionTransition.ts` applied to the bot's turn).
 *
 * The server resolves a bot turn synchronously and ships its typed script on
 * `GameModel.automa.lastTurn`. Both commit paths (the viewer's own submit in
 * WaitingFor.fetchPlayerInput — the main one, since ending your turn is what
 * lets the bot act — and App.update's poll) call:
 *
 *   detectMarsBotTurn(prev, next) → await runMarsBotTheater(turn, next) →
 *   <commit the new view> → nextTick(endMarsBotTheater())
 *
 * plus `isMarsBotTheaterActive()` as the poll re-entrancy guard. While the
 * theater plays, the PREVIOUS view stays committed — the board doesn't jump,
 * next prompts/modals stay closed — and the overlay narrates the turn step by
 * step. A skip affordance (click / gamepad A) resolves the gate immediately;
 * a safety timer guarantees resolution even with rAF/timers throttled.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {TheaterStep, buildTheaterSteps, marsBotOfView, theaterTotalMs, turnDedupeKey} from './marsBotTheaterModel';

type MarsBotTheaterState = {
  active: boolean;
  botColor: Color | '';
  botName: string;
  steps: Array<TheaterStep>;
  /** Steps with index ≤ currentIndex are visible (the newest one is "live"). */
  currentIndex: number;
  finished: boolean;
  reducedMotion: boolean;
  /** Bumped per run so surfaces reset their local presentation state. */
  nonce: number;
};

export const marsBotTheaterState = reactive<MarsBotTheaterState>({
  active: false,
  botColor: '',
  botName: '',
  steps: [],
  currentIndex: -1,
  finished: false,
  reducedMotion: false,
  nonce: 0,
});

// Replays of the same turn (poll re-fetches of the same view) never re-run.
const seen = new Set<string>();

let stepTimerId = 0;
let safetyTimerId = 0;
let resolveActive: (() => void) | undefined;

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

export function isMarsBotTheaterActive(): boolean {
  return marsBotTheaterState.active;
}

/**
 * Detect (and atomically CLAIM) a bot turn to replay for the prev→next view
 * transition. A fresh load / reconnect (no prev) claims the key SILENTLY so a
 * stale turn is never replayed to a player who just opened the game.
 */
export function detectMarsBotTurn(prev: ViewModel | undefined, next: ViewModel | undefined): MarsBotTurn | undefined {
  const turn = next?.game.automa?.lastTurn;
  if (turn === undefined || next === undefined) {
    return undefined;
  }
  const bot = marsBotOfView(next);
  const key = turnDedupeKey(turn, bot?.color ?? '');
  if (seen.has(key)) {
    return undefined;
  }
  seen.add(key);
  if (prev === undefined || bot === undefined) {
    return undefined; // silent seed — never replay into a fresh session
  }
  return turn;
}

/**
 * Play the turn theater; resolves when the last step has had its beat (or on
 * skip / the safety cap). `active` flips synchronously so the poll guard is
 * closed before the first await.
 */
export function runMarsBotTheater(turn: MarsBotTurn, next: ViewModel): Promise<void> {
  cancelTimers();
  const reduced = prefersReducedMotion();
  const bot = marsBotOfView(next);
  const steps = buildTheaterSteps(turn, next, reduced);

  marsBotTheaterState.active = true;
  marsBotTheaterState.botColor = bot?.color ?? '';
  marsBotTheaterState.botName = bot?.name ?? 'MarsBot';
  marsBotTheaterState.steps = steps;
  marsBotTheaterState.currentIndex = 0;
  marsBotTheaterState.finished = false;
  marsBotTheaterState.reducedMotion = reduced;
  marsBotTheaterState.nonce++;

  const promise = new Promise<void>((resolve) => {
    resolveActive = resolve;
  });

  const finish = () => {
    cancelTimers();
    marsBotTheaterState.currentIndex = steps.length - 1;
    marsBotTheaterState.finished = true;
    const r = resolveActive;
    resolveActive = undefined;
    r?.();
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

  // Timers can be throttled in background tabs — the gate must never hang the
  // commit (and therefore the next prompt) forever.
  safetyTimerId = window.setTimeout(finish, motionMs(theaterTotalMs(steps)) + 2500) as unknown as number;

  return promise;
}

/** The player skips the narration — resolve the gate right away. */
export function skipMarsBotTheater(): void {
  if (!marsBotTheaterState.active || resolveActive === undefined) {
    return;
  }
  cancelTimers();
  marsBotTheaterState.currentIndex = marsBotTheaterState.steps.length - 1;
  marsBotTheaterState.finished = true;
  const r = resolveActive;
  resolveActive = undefined;
  r?.();
}

/** Clear the overlay AFTER the new view committed (call on nextTick). Idempotent. */
export function endMarsBotTheater(): void {
  cancelTimers();
  marsBotTheaterState.active = false;
  marsBotTheaterState.steps = [];
  marsBotTheaterState.currentIndex = -1;
  marsBotTheaterState.finished = false;
}

/** Test-only full reset (state + dedup + timers). */
export function resetMarsBotTheater(): void {
  endMarsBotTheater();
  resolveActive = undefined;
  seen.clear();
  marsBotTheaterState.botColor = '';
  marsBotTheaterState.botName = '';
  marsBotTheaterState.nonce = 0;
}
