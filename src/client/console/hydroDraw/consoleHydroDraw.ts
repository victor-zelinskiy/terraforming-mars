/*
 * CONSOLE HYDRO DRAW — controller + reactive state for the «Гидромоделирование»
 * draw cinematic (Delta stage 5: "look at 4 cards, take up to 2"). The card-
 * lift sibling of the board card-bonus (consoleBoardCardBonus): four card
 * backs lift out of the reached track stop, fan out, flip open and land in the
 * pick-2-of-4 modal's exact slots — the modal materializes AROUND the landed
 * cards, then the player picks two.
 *
 * Unlike the board bonus (which claims a `cardDrawReveal`), the stage-5 reward
 * is a plain `SelectCard` served by ConsoleTaskHost — there is NO reveal to
 * match. So the scene is CLIENT-armed at the confirm (mirroring the marker
 * glide): the shell arms it when the confirmed advance lands on the draw
 * stage; the app-level layer then waits for the marker to settle + the select
 * modal's slots to mount (VEILED) and drives the lift → fan → handoff.
 *
 * This scene NEVER holds the commit — the commit is what produces the modal it
 * fans into. It only DECORATES the modal's arrival (like the board bonus), so
 * it registers a NOTIFICATION-ONLY animation hold (a blocking hold would refuse
 * to mount the very mandatory modal the scene needs on stage).
 *
 * DESKTOP SAFETY: `armHydroDraw` is only ever called by the console shell, so
 * `hydroDrawState.active` is false everywhere else and every gate is a no-op.
 */

import {reactive} from 'vue';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/**
 * lift  — a single cover rises off the reached stop (the "cards emerge");
 * fan   — N covers peel into the modal's exact slot rects, flipping open;
 * frame — the covers stand in the slots; the modal frame materializes around them;
 * handoff — the real modal cards fade in UNDER the proxies, which dissolve.
 */
export type HydroDrawPhase = 'idle' | 'lift' | 'fan' | 'frame' | 'handoff';

type HydroDrawState = {
  /** Any non-idle phase — the input gate + the task-host veil read this. */
  active: boolean;
  phase: HydroDrawPhase;
  /** The stop the cards lift off (the just-reached draw stage). */
  stopPosition: number;
  /** Bumped per arm — the layer (re)starts on this. */
  nonce: number;
  reducedMotion: boolean;
};

export const hydroDrawState = reactive<HydroDrawState>({
  active: false,
  phase: 'idle',
  stopPosition: -1,
  nonce: 0,
  reducedMotion: false,
});

type HydroDrawHandle = {abort: () => void};
let handle: HydroDrawHandle | undefined;
let armSafetyId = 0;
/** A leaked scene (the modal never mounted / a lost response) self-recalls. */
const ARM_SAFETY_MS = 15000;

export function isHydroDrawActive(): boolean {
  return hydroDrawState.active;
}

// The lift is visual from the moment the modal veils; the whole active window
// holds the presentation. NOTIFICATION-ONLY: the modal it fans into is a
// mandatory surface — a blocking hold would unmount its own stage.
registerAnimationHoldSupplier('hydro-draw', isHydroDrawActive, {scope: 'notification-only'});

/** The layer registers its abort handle so the controller can recall it. */
export function registerHydroDrawHandle(h: HydroDrawHandle | undefined): void {
  handle = h;
}

/** The layer reports phase transitions (lift → fan → frame → handoff). */
export function setHydroDrawPhase(phase: HydroDrawPhase): void {
  if (hydroDrawState.active) {
    hydroDrawState.phase = phase;
  }
}

function clearArmSafety(): void {
  if (armSafetyId !== 0) {
    clearTimeout(armSafetyId);
    armSafetyId = 0;
  }
}

/**
 * ARM (confirm modal, when the advance lands on the draw stage). Sets `active`
 * synchronously so the input gate closes and the task host mounts VEILED. The
 * layer waits for the marker to settle + the modal slots to appear, then runs
 * the lift/fan. A safety net recalls a scene whose modal never arrives.
 */
export function armHydroDraw(stopPosition: number): void {
  clearArmSafety();
  hydroDrawState.active = true;
  hydroDrawState.phase = 'lift';
  hydroDrawState.stopPosition = stopPosition;
  hydroDrawState.reducedMotion = consoleReducedMotionActive();
  hydroDrawState.nonce++;
  armSafetyId = setTimeout(() => abortHydroDraw(), ARM_SAFETY_MS) as unknown as number;
}

/** END (handoff complete) — the modal is materialized + interactive; drop the
 *  veil + the input gate. Idempotent. */
export function endHydroDraw(): void {
  clearArmSafety();
  handle = undefined;
  hydroDrawState.active = false;
  hydroDrawState.phase = 'idle';
  hydroDrawState.stopPosition = -1;
}

/** ABORT (safety / unmount / the modal degraded) — instantly reveal the modal
 *  (drop the veil) + tear down the flight. Idempotent. */
export function abortHydroDraw(): void {
  clearArmSafety();
  if (!hydroDrawState.active) {
    return;
  }
  const h = handle;
  handle = undefined;
  hydroDrawState.active = false;
  hydroDrawState.phase = 'idle';
  hydroDrawState.stopPosition = -1;
  h?.abort();
}

/** Test-only full reset. */
export function resetHydroDraw(): void {
  clearArmSafety();
  handle = undefined;
  hydroDrawState.active = false;
  hydroDrawState.phase = 'idle';
  hydroDrawState.stopPosition = -1;
  hydroDrawState.nonce = 0;
  hydroDrawState.reducedMotion = false;
}
