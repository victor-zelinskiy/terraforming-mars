/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «МАРС ТЕРРАФОРМИРОВАН» — THE PLANET SHOWS (TR70's iteration, 2026-10-17).
 *
 * The single biggest event of the game used to be a SURROGATE: a 600 px CSS
 * globe with three lines of text, painted over whatever the player was doing —
 * a received card, the Information dossier, the hand album — for 6.7 s, hiding
 * nothing and knowing nothing about the real planet below it. The owner's
 * accent: «wherever the player is, take them to the PLANET ITSELF; the
 * interface steps aside, the planet comes into focus and SHOWS the ceremony;
 * the text is readable from the couch; it is short; and the player returns
 * exactly where they were.»
 *
 * ONE OBJECT — the real Mars in the central opening; ONE PHRASE, in tacts:
 *
 *   0 · ARMED    — the scene is DETECTED off the SERVER's word (`game.isTerraformed`
 *                  flipping in the applied view — `seedTerraformedScene`, called in
 *                  the transport's apply block for every road a view arrives by;
 *                  never the three parameters, never the announcement's text),
 *                  and the scales' LAST STEP is held in the board-beat park
 *                  (`holdBoardScaleForScene`): the arcs keep the numbers the
 *                  player last saw (the HUD reads the truth — STATE DELIVERY). It then WAITS for a quiet world
 *                  (the shell's probe: the field's story over, no reveal standing,
 *                  no cards in flight, no camera in motion) — a board beat waits
 *                  for a board the player can see.
 *   1 · RECEDE   — the interface steps aside by OPACITY (`.con-root--terraformed`):
 *                  both rails, the command bar, every workspace band, the
 *                  Information dossier, the played table, a reveal, the journal,
 *                  the shade, the toasts, the hand dock. The status strip STAYS —
 *                  its chips are part of the show. A SECTION standing where the
 *                  board stands (the hand, the colonies, the hydro) is faded out,
 *                  then the stage is flipped under it and the board fades IN
 *                  (`--terraformed-stage`, `--terraformed-stage-lit`): the board's
 *                  box is its board-home box, never a re-fit.
 *   2 · FOCUS    — the Planet Focus camera, in its `ceremony` mode: the same
 *                  deterministic fit, the same box, the arcs STAYING (they are the
 *                  story) — only the off-Mars flanks recede.
 *   3 · SHOW     — the park releases the held values ON THE FOCUSED STAGE
 *                  (`releaseBoardScaleForScene`): the markers glide to their
 *                  maximum, the fills close, the changed scales pulse their accent,
 *                  the HUD chips flip to 100 % and gold; the atmosphere BREATHES on
 *                  the real disc (the board section's limb layer) and the shared
 *                  `ceremonyFx` burst detonates over the real planet; the title
 *                  plate rises UNDER the disc, in the bleed zone (never over it).
 *   4 · RETURN   — the camera exits (the planet glides back to the pixel it left
 *                  from), the surfaces return from the park by opacity into the
 *                  SAME pose (nothing was unmounted, nothing re-entered), the HUD
 *                  already gold. The scene ends on the camera's own landing —
 *                  the hold's release IS that signal, never a timer of pacing.
 *
 * Every tact is BOUNDED by its own signal with a leak net on the animation
 * clock; the registry's ceiling ends a WEDGE (`expire`). A press after the
 * camera has come in SKIPS: one atomic finish — values released, title gone,
 * the return played once. Reduced motion: no camera, no breath, no burst — the
 * surfaces fade in 120 ms, the scales snap, the title reads, the surfaces
 * return. A reload into a terraformed game seeds silently and plays nothing.
 */
import {reactive, shallowRef} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {finalGenerationActive} from '@/client/components/gameProgress/terraformingCelebration';
import {
  PLANET_ARCS_RETURN_MS, PLANET_FOCUS_ENTER_MS, PLANET_FOCUS_EXIT_MS,
  beginPlanetFocusExit, enterPlanetFocus, isPlanetFocusEngaged, planetFocusState,
} from '@/client/console/planetFocus';
import {boardBeatParkState, holdBoardScaleForScene, releaseBoardScaleForScene} from '@/client/console/boardBeatPark';
import {probeTick} from '@/client/console/probeTick';

export type TerraformedScenePhase = 'idle' | 'armed' | 'recede' | 'focus' | 'show' | 'return';

/** The interface's recede (the surfaces' opacity fade). */
export const TERRAFORMED_RECEDE_MS = 500;
/** The board fading in where a SECTION stood (the hand, the colonies …), and out again on the way back. */
export const TERRAFORMED_STAGE_FADE_MS = 300;
/** The planet shows: the markers' glide (≤ 1280) + the breath + the burst, the title rising inside it. */
export const TERRAFORMED_SHOW_MS = 1700;
/** The title plate rises this long after the show starts (the markers are already moving). */
export const TERRAFORMED_TITLE_DELAY_MS = 400;
/** The surfaces' return fade (the camera's exit runs before it). */
export const TERRAFORMED_RETURN_MS = 400;
/** Reduced motion: the recede / return fades and the title's read. */
export const TERRAFORMED_REDUCED_FADE_MS = 120;
export const TERRAFORMED_REDUCED_SHOW_MS = 1100;
/** The camera's own settle margin (the focus module's). */
const CAMERA_SETTLE_MS = 60;
/** The longest the armed scene waits for a quiet world before it plays anyway (a wedged field never withholds the finale's announce). */
export const TERRAFORMED_ARMED_WAIT_MAX_MS = 20_000;

export const terraformedSceneState = reactive({
  phase: 'idle' as TerraformedScenePhase,
  /** The surfaces are receded (`.con-root--terraformed`) — from the recede to the return's fade-in. */
  receded: false,
  /** The return fade is running (`.con-root--terraformed-returning` carries the transition the receded class declared). */
  returning: false,
  /**
   * The board STANDS IN for a section (`.con-root--terraformed-stage`): `dark` — displayed at zero opacity (the
   * flip's frame, and the fade-out's end), `lit` — fading in / standing. `off` — the section is back.
   */
  stage: 'off' as 'off' | 'dark' | 'lit',
  /** The honest claim: this generation is authoritatively the game's last. */
  final: false,
  /** The generation the planet was finished in. */
  generation: 0,
  /** Bumped per scene (the e2e probe's clock). */
  nonce: 0,
  /** Bumped at tact 3 — the HUD's pulse and the title ride it. */
  showNonce: 0,
  /** Why the last scene ended (diagnostics; '' after a full phrase). */
  lastEnd: '',
  /** The player skipped (a press after the camera came in). */
  skipped: false,
});

/** The shell's injected verdicts (console domain this module must not import). */
export type TerraformedSceneProbes = {
  /** The world is quiet: the field's story over, no reveal standing, no cards in flight, no camera in motion. */
  quiet: () => boolean;
  /** A SECTION stands where the board stands (the board is `v-show`n away). */
  sectionCovered: () => boolean;
  /**
   * A surface the PLAYER must answer stands (a received-cards reveal to take): the armed wait is theirs, and the scene
   * holds nothing over it — a blocking hold would hold the very prompts that let them finish. Absent, the armed wait
   * is on cinematics only (the tile's landing, the field's story, the camera) and the scene owns the foreground from
   * its arm: the finale's announce, the feed and the bot's story wait for the planet (PL-660 — the announce once
   * slipped in under the recede).
   */
  playerOwned?: () => boolean;
};

/**
 * The shell's probes — a SHALLOW REF, never a plain `let`: `terraformedSceneUp` (a hold supplier — a cache's predicate)
 * reads them, and a registration that lands while the scene is `armed` must reach every cache (`reactivityWitness.ts`).
 */
const probesRef = shallowRef<TerraformedSceneProbes | undefined>(undefined);

export function registerTerraformedSceneProbes(next: TerraformedSceneProbes | undefined): void {
  probesRef.value = next;
}

// The scene owns the foreground from its ARM to the camera's landing — the next prompt, the feed, the finale's
// announce and the bot's story wait for the planet. The one exception is an armed wait on a surface the PLAYER owns
// (a reveal to take — `playerOwned`): there the scene holds nothing, or it would hold the press that ends the wait.
// Bounded by the armed cap and the registry's ceiling; `expire` ends the WEDGE, not just the hold.
registerAnimationHoldSupplier('terraformed-scene', terraformedSceneUp, {
  diagnose: () => ({
    phase: terraformedSceneState.phase, stage: terraformedSceneState.stage, receded: terraformedSceneState.receded,
    camera: planetFocusState.phase, sceneHeld: boardBeatParkState.sceneHeld,
  }),
  expire: () => endTerraformedScene('expired'),
});

let seeded = false;
let wasTerraformed = false;
let wake: (() => void) | undefined;
let timers: Array<ReturnType<typeof setTimeout>> = [];

/**
 * DETECT (and arm) off the SERVER's word — `game.isTerraformed` flipping between the view on screen and the view
 * being applied. Called in the transport's apply block BEFORE the view is applied (the held scales must be seeded
 * against the OLD view), for every road a view arrives by: an own submit, a poll, a WebSocket wake, a staged bot
 * turn. The first observation seeds silently (a reload into a finished planet shows no cinematic); a scene
 * already standing refuses a second. Returns whether THIS observation armed the scene.
 */
export function seedTerraformedScene(prev: PlayerViewModel | undefined, next: PlayerViewModel | undefined): boolean {
  const now = next?.game?.isTerraformed === true;
  if (next === undefined || prev?.game === undefined || !seeded) {
    seeded = true;
    wasTerraformed = now;
    return false;
  }
  const fresh = !wasTerraformed && now;
  wasTerraformed = now;
  if (!fresh || terraformedSceneState.phase !== 'idle') {
    return false;
  }
  // The scales' last step is HELD until the stage stands (the board's arcs keep the player's numbers; the HUD reads the truth — STATE DELIVERY).
  holdBoardScaleForScene(prev.game, next.game);
  terraformedSceneState.final = finalGenerationActive(next);
  terraformedSceneState.generation = next.game.generation;
  terraformedSceneState.skipped = false;
  terraformedSceneState.lastEnd = '';
  terraformedSceneState.nonce++;
  terraformedSceneState.phase = 'armed';
  scheduleStart(terraformedSceneState.nonce);
  return true;
}

/** Is the scene on screen (its surfaces receded, its camera in, its title up)? The pad is the scene's then. */
export function terraformedSceneUp(): boolean {
  const phase = terraformedSceneState.phase;
  if (phase === 'idle') {
    return false;
  }
  return phase !== 'armed' || !(probesRef.value?.playerOwned?.() ?? false);
}

/** A press on the scene: after the camera has come in it SKIPS — one atomic finish. Before that it is absorbed. */
export function skipTerraformedScene(): boolean {
  if (!terraformedSceneUp()) {
    return false;
  }
  if (terraformedSceneState.phase === 'focus' || terraformedSceneState.phase === 'show') {
    terraformedSceneState.skipped = true;
    wake?.();
  }
  return true;
}

/** The armed scene waits for a quiet world on the probe's clock (bounded), then plays. */
function scheduleStart(nonce: number): void {
  const started = Date.now();
  const tick = (): void => {
    if (terraformedSceneState.phase !== 'armed' || terraformedSceneState.nonce !== nonce) {
      return;
    }
    const quiet = probesRef.value?.quiet() ?? true;
    if (quiet || Date.now() - started > TERRAFORMED_ARMED_WAIT_MAX_MS) {
      void play(nonce);
      return;
    }
    probeTick(tick);
  };
  tick();
}

/** One bounded wait on the animation clock; a skip wakes it early. */
function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(t);
      timers = timers.filter((x) => x !== t);
      if (wake === finish) {
        wake = undefined;
      }
      resolve();
    };
    const t = setTimeout(finish, Math.max(0, ms));
    timers.push(t);
    wake = finish;
  });
}

function clearTimers(): void {
  for (const t of timers) {
    clearTimeout(t);
  }
  timers = [];
  wake = undefined;
}

/** The fade's grace past its own duration before the flip goes ahead anyway (a bound, never a beat). */
const SECTION_FADE_GRACE_MS = 600;

/**
 * THE FLIP HAPPENS UNDER A SECTION THE PLAYER NO LONGER SEES — read off the section's PAINTED opacity, never a clock alone.
 * The recede fades the section by a CSS transition while the scene waited a wall-clock `TERRAFORMED_RECEDE_MS`: under load
 * the transition starts frames late, the timer fired first and the slot flipped while the album still painted (the
 * 2026-10-30 whole-suite run: the flip 211 ms after the recede, the fade 250 ms — «faded OUT before it left the row» red at
 * 4 workers). Bounded: a section that never reaches 0 (a stuck style) flips at the ceiling rather than holding the scene.
 */
async function sectionFadedOut(alive: () => boolean): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }
  const deadline = Date.now() + consoleMotionMs(TERRAFORMED_RECEDE_MS) + SECTION_FADE_GRACE_MS;
  while (alive() && Date.now() < deadline) {
    const section = document.querySelector('.con-main > .con-hand, .con-main > .con-colonies, .con-main > .con-hydro');
    if (section === null || Number(getComputedStyle(section).opacity) <= 0.02) {
      return;
    }
    await frame();
  }
}


/** One painted frame (or the fallback) — the flip's frame between «displayed, dark» and «lit». */
function frame(): Promise<void> {
  return new Promise<void>((resolve) => probeTick(() => resolve()));
}

async function play(nonce: number): Promise<void> {
  const alive = () => terraformedSceneState.nonce === nonce && terraformedSceneState.phase !== 'idle';
  const reduced = consoleReducedMotionActive();
  const sectioned = probesRef.value?.sectionCovered() ?? false;
  try {
    // 1 · RECEDE — the interface steps aside; the status strip stays.
    terraformedSceneState.phase = 'recede';
    terraformedSceneState.receded = true;
    await wait(consoleMotionMs(reduced ? TERRAFORMED_REDUCED_FADE_MS : TERRAFORMED_RECEDE_MS));
    if (!alive()) {
      return;
    }
    if (sectioned) {
      // …and the section IS fully transparent: its own painted opacity is the signal, the wait above only its floor.
      await sectionFadedOut(alive);
      if (!alive()) {
        return;
      }
      // The flip under a fully transparent section: the board displayed dark, then lit on the next frame.
      terraformedSceneState.stage = 'dark';
      await frame();
      if (!alive()) {
        return;
      }
      terraformedSceneState.stage = 'lit';
      await wait(consoleMotionMs(reduced ? TERRAFORMED_REDUCED_FADE_MS : TERRAFORMED_STAGE_FADE_MS));
      if (!alive()) {
        return;
      }
    }
    // 2 · FOCUS — the camera comes in (reduced motion: no camera).
    terraformedSceneState.phase = 'focus';
    if (!reduced) {
      enterPlanetFocus('ceremony');
      await wait(consoleMotionMs(PLANET_FOCUS_ENTER_MS) + CAMERA_SETTLE_MS);
      if (!alive()) {
        return;
      }
    }
    // 3 · SHOW — the planet shows: the held scales let go on the stage, the HUD flips, the title rises inside it.
    terraformedSceneState.phase = 'show';
    terraformedSceneState.showNonce++;
    releaseBoardScaleForScene();
    if (!terraformedSceneState.skipped) {
      await wait(consoleMotionMs(reduced ? TERRAFORMED_REDUCED_SHOW_MS : TERRAFORMED_SHOW_MS));
    }
    if (!alive()) {
      return;
    }
    // 4 · RETURN — the camera exits; the surfaces return into the same pose; the scene ends on the landing.
    terraformedSceneState.phase = 'return';
    if (isPlanetFocusEngaged()) {
      beginPlanetFocusExit();
      const exitMs = consoleMotionMs(PLANET_FOCUS_EXIT_MS) + CAMERA_SETTLE_MS;
      if (sectioned) {
        // The board dissolves over the last part of the glide; the section comes back under a dark frame.
        const fade = consoleMotionMs(TERRAFORMED_STAGE_FADE_MS);
        await waitUnskippable(Math.max(0, exitMs - fade));
        terraformedSceneState.stage = 'dark';
        await waitUnskippable(fade);
      } else {
        await waitUnskippable(exitMs);
      }
      if (!alive()) {
        return;
      }
    } else if (sectioned) {
      terraformedSceneState.stage = 'dark';
      await waitUnskippable(consoleMotionMs(reduced ? TERRAFORMED_REDUCED_FADE_MS : TERRAFORMED_STAGE_FADE_MS));
      if (!alive()) {
        return;
      }
    }
    terraformedSceneState.stage = 'off';
    if (sectioned) {
      // The section is back in the row still TRANSPARENT (the recede class holds it at 0); its fade-in may only start
      // once the browser has COMPUTED that transparent style — an element displayed and faded in one style recalc has no
      // before-change style, so the transition never runs and the album POPS in whole (the e2e's «came back still
      // faded» sample caught it). One rAF is not enough: it fires BEFORE the frame's style recalc, so the flip would
      // still share the recalc with the display — the second painted frame is the first with the style on record.
      await frame();
      await frame();
      if (!alive()) {
        return;
      }
    }
    terraformedSceneState.receded = false;
    terraformedSceneState.returning = true;
    await waitUnskippable(consoleMotionMs(reduced ? TERRAFORMED_REDUCED_FADE_MS : TERRAFORMED_RETURN_MS) + PLANET_ARCS_RETURN_MS);
    if (!alive()) {
      return;
    }
    endTerraformedScene('concluded');
  } catch (e) {
    console.warn('[terraformed-scene] the phrase threw — ending honestly', e);
    endTerraformedScene('error');
  }
}

/** A wait of the RETURN — a skip never cuts the return short (the camera must land where it left from). */
function waitUnskippable(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      timers = timers.filter((x) => x !== t);
      resolve();
    }, Math.max(0, ms));
    timers.push(t);
  });
}

/**
 * END — every path out (the phrase's own end, a skip's finish, the ceiling, a game switch): the held scales let
 * go if they still stand, the camera exits if it is still in, every flag drops, the hold falls. Idempotent.
 */
export function endTerraformedScene(reason: string): void {
  if (terraformedSceneState.phase === 'idle') {
    return;
  }
  clearTimers();
  if (boardBeatParkState.sceneHeld) {
    releaseBoardScaleForScene();
  }
  if (reason !== 'concluded' && isPlanetFocusEngaged() && planetFocusState.mode === 'ceremony') {
    beginPlanetFocusExit();
  }
  terraformedSceneState.stage = 'off';
  terraformedSceneState.receded = false;
  terraformedSceneState.returning = false;
  terraformedSceneState.phase = 'idle';
  terraformedSceneState.lastEnd = reason;
}

/** Game-switch boundary / shell unmount / tests: a full reset — the seed too (the next game's first view seeds afresh). */
export function resetTerraformedScene(): void {
  endTerraformedScene('reset');
  seeded = false;
  wasTerraformed = false;
  terraformedSceneState.final = false;
  terraformedSceneState.generation = 0;
  terraformedSceneState.lastEnd = '';
  terraformedSceneState.skipped = false;
  terraformedSceneState.returning = false;
}
