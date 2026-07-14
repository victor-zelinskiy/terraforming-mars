import {reactive} from 'vue';
import {terraformingProgress} from '@/client/components/gameProgress/terraformingProgress';

/**
 * terraformingCelebration — the shared "Terraforming complete / final
 * generation" brain for BOTH modes (desktop notification + sidebar glow,
 * console ceremony cinematic + HUD rail pulse).
 *
 * Module-level reactive (mirrors `journalState` / `notificationState`) so it
 * survives the App-level lifecycles and both surfaces read ONE truth.
 *
 * Detection is a pure client-side diff of the AUTHORITATIVE public game
 * state (server-computed temperature / oxygenLevel / oceans /
 * isTerraformed), observed from `NotificationLayer.update()` — the same
 * seed-silently-then-diff pattern as generation / pass / scale-bonus
 * highlights: the first observed view SEEDS the flags without celebrating
 * (reload / reconnect into an already-terraformed game shows only the
 * persistent state, never the cinematic), and only a live false→true
 * transition bumps `celebrationNonce` (exactly once — the parameters can
 * never un-max, and the seed flag survives the playerkey remount).
 *
 * TWO distinct truths, deliberately separate:
 *  - `complete`   — Temperature + Oxygen + Oceans are maxed (Venus NEVER
 *                   counts; this is what the progress rails show at 100%).
 *  - `finalGeneration` — this generation is authoritatively the game's
 *                   last: multiplayer → the server's `game.isTerraformed`
 *                   (which honours the Venus/Moon game-end VARIANT options);
 *                   solo → `generation >= lastSoloGeneration` (solo games
 *                   run to a fixed generation regardless of terraforming).
 * In a default multiplayer game both flip at the same moment, so the
 * cinematic carries the "this is the final generation" subtitle; under the
 * `requiresVenusTrackCompletion` variant (or in a mid-game solo) the event
 * still fires on three-parameter completion — per the design rule "never
 * wait for Venus" — but WITHOUT falsely claiming the last generation.
 */

/** The minimal structural slice of `PlayerViewModel` the observer reads —
 *  structural so tests can feed tiny fixtures. */
export type TerraformingObservationView = {
  game: {
    temperature: number;
    oxygenLevel: number;
    oceans: number;
    isTerraformed: boolean;
    generation: number;
    lastSoloGeneration: number;
  };
  players: {length: number};
};

type TerraformingCelebrationStore = {
  /** Whether the first (silent) observation has run. */
  seeded: boolean;
  /** Temperature + Oxygen + Oceans all maxed (Venus never counts). */
  complete: boolean;
  /** This generation is authoritatively the game's last one. */
  finalGeneration: boolean;
  /** Bumped exactly once, on the live not-complete → complete transition.
   *  Surfaces (desktop card / sidebar glow / console ceremony) watch it. */
  celebrationNonce: number;
  /** Whether the fresh celebration may honestly claim "this is the final
   *  generation" (captured at the transition moment). */
  celebrationFinal: boolean;
  /** The generation in which terraforming was completed. */
  celebrationGeneration: number;
};

export const terraformingCelebrationState = reactive<TerraformingCelebrationStore>({
  seeded: false,
  complete: false,
  finalGeneration: false,
  celebrationNonce: 0,
  celebrationFinal: false,
  celebrationGeneration: 0,
});

/**
 * Whether the CURRENT generation is authoritatively the game's last.
 * Multiplayer: the server's `isTerraformed` (the game-end condition,
 * variant-aware). Solo: solo games always run to `lastSoloGeneration`
 * regardless of terraforming, so the marker is generation-based.
 */
export function finalGenerationActive(view: TerraformingObservationView): boolean {
  if (view.players.length <= 1) {
    return view.game.generation >= view.game.lastSoloGeneration;
  }
  return view.game.isTerraformed;
}

/**
 * Observe one fresh `playerView`. Returns true when THIS observation is the
 * live completion transition (the caller may push the desktop notification);
 * the console ceremony / sidebar glow react to `celebrationNonce` themselves.
 */
export function observeTerraformingProgress(view: TerraformingObservationView): boolean {
  const state = terraformingCelebrationState;
  const complete = terraformingProgress(view.game).complete;
  const finalGeneration = finalGenerationActive(view);
  const fresh = state.seeded && !state.complete && complete;
  state.seeded = true;
  state.complete = complete;
  state.finalGeneration = finalGeneration;
  if (fresh) {
    state.celebrationNonce++;
    state.celebrationFinal = finalGeneration;
    state.celebrationGeneration = view.game.generation;
  }
  return fresh;
}

/** Full reset — a DIFFERENT game was opened in the same session (mirrors
 *  `resetNotifications`, called from the same generation-went-backwards
 *  guard). The nonce is deliberately kept monotonic so stale watchers can
 *  never re-fire on reset. */
export function resetTerraformingCelebration(): void {
  const state = terraformingCelebrationState;
  state.seeded = false;
  state.complete = false;
  state.finalGeneration = false;
  state.celebrationFinal = false;
  state.celebrationGeneration = 0;
}
