/*
 * CONSOLE HYDRO DRAW — controller + reactive state for the «Гидромоделирование»
 * draw cinematic (Delta stage 5: "look at 4 cards, take up to 2"). The card-
 * lift sibling of the board card-bonus (consoleBoardCardBonus): the marker
 * glides to its new stop, and the four cards then come OUT OF THAT CELL — a
 * face-down stack rises from it, opens into a fan, holds a beat and travels
 * into the pick-2-of-4 modal's exact slots, flipping face-up on the way; the
 * modal materializes AROUND the landed cards, then the player picks two.
 * Choreography: hydroDrawModel.ts (pure) + hydroDrawDirector.ts (GSAP).
 *
 * Unlike the board bonus (which claims a `cardDrawReveal`), the stage-5 reward
 * is a plain `SelectCard` served by ConsoleTaskHost — there is NO reveal to
 * match. So the scene is CLIENT-armed at the confirm (mirroring the marker
 * glide): the shell arms it when the confirmed advance lands on the draw
 * stage; the app-level layer then waits for the marker to SETTLE + the select
 * modal's slots to mount (VEILED) and drives the flight → handoff.
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
 * lift  — the stack is staged inside the reached track cell (the stop the
 *         marker just landed on — where the player is already looking);
 * fan   — the flight: the stack rises out of that cell, opens into a fan,
 *         holds a beat, then travels into the modal's exact slots, flipping;
 * frame — the cards stand in the slots; the modal frame materializes around them;
 * handoff — the real modal cards fade in UNDER the proxies, which dissolve.
 */
export type HydroDrawPhase = 'idle' | 'lift' | 'fan' | 'frame' | 'handoff';

type HydroDrawState = {
  /** Any non-idle phase — the input gate + the task-host veil read this. */
  active: boolean;
  phase: HydroDrawPhase;
  /**
   * The layer actually TOOK the scene (its `beginScene` ran). The task host
   * veils ONLY on a claimed scene: an armed-but-never-claimed scene (the layer
   * unmounted / a non-console host / a broken wiring) would otherwise hold the
   * pick modal invisible with nothing flying into it — a black, inert screen.
   * The claim safety below turns that into an instant, honest modal instead.
   */
  claimed: boolean;
  /**
   * The track cell the cards come out of — the stop the marker advances to.
   * The scene deliberately waits for the marker to SETTLE there before the
   * cards appear: that landing is what puts the cell in focus, and the cards
   * must read as its payout rather than pre-empt it.
   */
  stopPosition: number;
  /** Bumped per arm — the layer (re)starts on this. */
  nonce: number;
  reducedMotion: boolean;
};

export const hydroDrawState = reactive<HydroDrawState>({
  active: false,
  phase: 'idle',
  claimed: false,
  stopPosition: -1,
  nonce: 0,
  reducedMotion: false,
});

type HydroDrawHandle = {abort: () => void};
let handle: HydroDrawHandle | undefined;
let armSafetyId = 0;
let claimSafetyId = 0;
/** A leaked scene (the modal never mounted / a lost response) self-recalls. */
const ARM_SAFETY_MS = 15000;
/**
 * The layer claims the scene on the very next tick after the arm, so anything
 * past this is a scene NOBODY is playing — recall it at once rather than let
 * the veil hold an invisible pick modal for the full arm safety.
 */
const CLAIM_SAFETY_MS = 1200;

export function isHydroDrawActive(): boolean {
  return hydroDrawState.active;
}

/** The scene is LIVE on stage (armed AND taken by the layer) — the veil gate. */
export function isHydroDrawClaimed(): boolean {
  return hydroDrawState.active && hydroDrawState.claimed;
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
  if (claimSafetyId !== 0) {
    clearTimeout(claimSafetyId);
    claimSafetyId = 0;
  }
}

/**
 * ARM (confirm modal, when the advance lands on the draw stage). Sets `active`
 * synchronously so the input gate closes. The layer then waits for the marker
 * to SETTLE on `stopPosition` and for the modal slots to appear, and only then
 * flies the cards out of that cell. Two safety nets: an unclaimed scene (no
 * layer) and a scene whose modal never arrives.
 */
export function armHydroDraw(stopPosition: number): void {
  clearArmSafety();
  hydroDrawState.active = true;
  hydroDrawState.phase = 'lift';
  hydroDrawState.claimed = false;
  hydroDrawState.stopPosition = stopPosition;
  hydroDrawState.reducedMotion = consoleReducedMotionActive();
  hydroDrawState.nonce++;
  armSafetyId = setTimeout(() => abortHydroDraw(), ARM_SAFETY_MS) as unknown as number;
  claimSafetyId = setTimeout(() => {
    if (!hydroDrawState.claimed) {
      abortHydroDraw();
    }
  }, CLAIM_SAFETY_MS) as unknown as number;
}

/** The layer TOOK the scene — from here the task host may veil for it. */
export function markHydroDrawClaimed(): void {
  if (hydroDrawState.active) {
    hydroDrawState.claimed = true;
    if (claimSafetyId !== 0) {
      clearTimeout(claimSafetyId);
      claimSafetyId = 0;
    }
  }
}

/** END (handoff complete) — the modal is materialized + interactive; drop the
 *  veil + the input gate. Idempotent. */
export function endHydroDraw(): void {
  clearArmSafety();
  handle = undefined;
  hydroDrawState.active = false;
  hydroDrawState.phase = 'idle';
  hydroDrawState.claimed = false;
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
  hydroDrawState.claimed = false;
  hydroDrawState.stopPosition = -1;
  h?.abort();
}

/** Test-only full reset. */
export function resetHydroDraw(): void {
  clearArmSafety();
  handle = undefined;
  hydroDrawState.active = false;
  hydroDrawState.phase = 'idle';
  hydroDrawState.claimed = false;
  hydroDrawState.stopPosition = -1;
  hydroDrawState.nonce = 0;
  hydroDrawState.reducedMotion = false;
}
