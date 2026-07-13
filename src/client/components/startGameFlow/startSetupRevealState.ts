/*
 * Start-of-game setup reveal — controller + reactive state.
 *
 * Turns the server's `startingSetup` snapshot into explicit, player-paced reveal
 * stages: the player presses A on their corporation to APPLY its starting
 * bonuses (M€ + resources + production + TR), then presses A again to PAY for the
 * project cards they bought — each step animating the left resource panel with
 * the existing AnimatedMetricValue delta chips. Only after both explicit steps do
 * the preludes become playable. Mirrors the module-state pattern of
 * energyConversionTransition.ts (dedup seen-set, panel-override reactive state)
 * so it survives the playerkey remount.
 *
 * Unlike the energy→heat gate this DOES NOT block the commit — the ceremony is
 * interactive and player-paced. It only activates the panel override
 * SYNCHRONOUSLY in the commit path (App.update / WaitingFor) so the panel shows
 * the baseline the instant the ceremony view lands, never a flash of the final
 * (corp-applied) numbers. The panels bind their resource `:value` to the staged
 * numbers, so advancing a stage fires the chips naturally.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {startGameFlowEligible} from './startGameFlowState';
import {
  StagedSetupNumbers,
  StartSetupEvent,
  StartSetupStage,
  hasPaymentStage,
  nextStartSetupStage,
  readStartSetupEvent,
  shouldRevealStartSetup,
  stagedNumbersFor,
} from './startSetupRevealModel';

type StartSetupRevealState = {
  /** True from `beginStartSetupReveal` until the reveal completes / resets. */
  active: boolean;
  /** Whose setup — matched against the panel's scopeKey (player color). */
  color: Color | '';
  /** The current reveal stage. */
  stage: StartSetupStage;
  /** The numbers the panels display for `color` while active (the current stage). */
  staged: StagedSetupNumbers | undefined;
  /** Bumped on each begin so any observer can re-key. */
  nonce: number;
};

export const startSetupRevealState = reactive<StartSetupRevealState>({
  active: false,
  color: '',
  stage: 'baseline',
  staged: undefined,
  nonce: 0,
});

// The resolved event backing the current reveal (stages are derived from it).
// Kept out of the reactive object — it never needs to trigger reactivity itself.
let currentEvent: StartSetupEvent | undefined;

// Replays of the same setup (the same ceremony view re-fetched by the poll loop)
// must not re-activate. Claimed exactly once in `detectStartSetupReveal`.
const seen = new Set<string>();

export function isStartSetupRevealActive(): boolean {
  return startSetupRevealState.active;
}

/**
 * Detect + activate the reveal for a prev→next commit in one call. Idempotent
 * (dedup seen-set), so every commit path that could land the ceremony view can
 * call it right before it commits — whichever fires first wins, the rest no-op.
 */
export function primeStartSetupReveal(
  prev: ViewModel | undefined,
  next: ViewModel | undefined): void {
  const event = detectStartSetupReveal(prev, next);
  if (event !== undefined) {
    beginStartSetupReveal(event);
  }
}

/**
 * Detect (and atomically CLAIM) a setup reveal for the prev→next view
 * transition. Returns the event only when it should reveal now; marks the dedup
 * key seen regardless so a subsequent poll doesn't replay it. Claiming here
 * (synchronously, before the commit) closes the race against a concurrent poll.
 */
export function detectStartSetupReveal(
  prev: ViewModel | undefined,
  next: ViewModel | undefined): StartSetupEvent | undefined {
  const event = readStartSetupEvent(next);
  if (event === undefined) {
    return undefined;
  }
  // Only reveal when the start ceremony will actually show (a prelude / corp
  // first-action / corp-select is owed) — otherwise the reveal would activate
  // with no UI to advance it, stranding the panel at the baseline. A corp with
  // no preludes AND no first action (e.g. Polyphemos, preludes off) goes
  // straight to the action menu: nothing to reveal, so we claim + skip.
  if (!startGameFlowEligible(next as PlayerViewModel)) {
    seen.add(event.dedupeKey);
    return undefined;
  }
  if (!shouldRevealStartSetup(prev, event, seen)) {
    // Claim it anyway (a fresh reload lands on the ceremony with no `prev`) so a
    // later poll doesn't reveal a setup the player never saw begin.
    seen.add(event.dedupeKey);
    return undefined;
  }
  seen.add(event.dedupeKey);
  return event;
}

/**
 * Activate the reveal at its baseline stage. Called SYNCHRONOUSLY in the commit
 * path right before the new view commits, so the panel's first render with the
 * ceremony view already shows the baseline (the pre-corp numbers), never the
 * final corp-applied values.
 */
export function beginStartSetupReveal(event: StartSetupEvent): void {
  currentEvent = event;
  startSetupRevealState.active = true;
  startSetupRevealState.color = event.color;
  startSetupRevealState.stage = 'baseline';
  startSetupRevealState.staged = stagedNumbersFor(event, 'baseline');
  startSetupRevealState.nonce++;
}

/**
 * Advance to the next reveal stage (baseline → corp → [payment] → done). Updates
 * the staged numbers so the panel fires the delta chips. Returns the new stage;
 * deactivates the override on 'done' (the staged numbers already equal the
 * committed final values, so rebinding the canonical view fires no extra chip).
 */
export function advanceStartSetupReveal(): StartSetupStage {
  const event = currentEvent;
  if (event === undefined || !startSetupRevealState.active) {
    return 'done';
  }
  const stage = nextStartSetupStage(startSetupRevealState.stage, event.snapshot);
  startSetupRevealState.stage = stage;
  if (stage === 'done') {
    // Release the override: the panel rebinds to the canonical view (== the final
    // numbers), so the value transition from the last staged step fires the final
    // delta chip (e.g. the −N M€ payment) with no extra flash.
    endStartSetupReveal();
    return 'done';
  }
  startSetupRevealState.staged = stagedNumbersFor(event, stage);
  return stage;
}

/** Release the panel override (the reveal is complete or superseded). */
export function endStartSetupReveal(): void {
  startSetupRevealState.active = false;
  startSetupRevealState.color = '';
  startSetupRevealState.staged = undefined;
  currentEvent = undefined;
}

/** Test-only full reset (state + dedup). */
export function resetStartSetupReveal(): void {
  seen.clear();
  currentEvent = undefined;
  startSetupRevealState.active = false;
  startSetupRevealState.color = '';
  startSetupRevealState.stage = 'baseline';
  startSetupRevealState.staged = undefined;
  startSetupRevealState.nonce = 0;
}

/**
 * The staged numbers a panel should display for `color`, or undefined when the
 * reveal isn't active for that player. Panels spread `{...player, ...override}`
 * so both the displayed value AND the AnimatedMetricValue `:value` track the
 * stage (the chips fire from the value watcher).
 */
export function startSetupOverrideFor(color: Color | string): StagedSetupNumbers | undefined {
  const s = startSetupRevealState;
  if (!s.active || s.color === '' || s.color !== color) {
    return undefined;
  }
  return s.staged;
}

// ── UI-facing getters (the ceremony reads these to drive the reveal affordance).

/** The corporation being revealed, or undefined. */
export function startSetupCorporation(): StartSetupEvent['snapshot']['corporation'] | undefined {
  return currentEvent?.snapshot.corporation;
}

/** Whether the current reveal has a payment stage (cards were bought). */
export function startSetupHasPayment(): boolean {
  return currentEvent !== undefined && hasPaymentStage(currentEvent.snapshot);
}

/** M€ paid for the bought cards (for the "pay for cards: −N" affordance). */
export function startSetupPaymentAmount(): number {
  return currentEvent?.snapshot.megacreditsPaid ?? 0;
}

/** Number of project cards bought at setup. */
export function startSetupCardsBought(): number {
  return currentEvent?.snapshot.cardsBought ?? 0;
}
