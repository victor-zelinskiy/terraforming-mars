/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CORPORATION RISES, THE CUBE LEAVES IT (Septem Tribus:redux — the owner, 2026-10-25: «поднимается карта
 * корпорации и с нее летит куб игрока на партию»).
 *
 * A cube on a banner is the work of a CARD — the first action of the corporation, or its effect answering a won
 * resolution. Flown from a seat on the bench it read as nothing: a small square crossing the hall while the eye was
 * on the enactment. So the cause stands up first, where the eye already is — the voting table's own cell (the bills
 * recede under it, nothing flies to or from them in this beat) — and the cube is BORN on the card's PRINTED cube
 * glyph (the effect row for a won resolution, the on-play row for the first action) and carried onto the party's
 * banner. The phrase, ONE per cube, played by the sitting's director and by the banner mode alike:
 *
 *   RISE (the card comes up out of the table's cell) · STAND (it fixes — the press of its printed effect) ·
 *   CARRY (the cube leaves the glyph for the plaque's socket — the hold drops on the touchdown) · READ · SINK (the
 *   card goes back down, the table comes back).
 *
 * Every wait rides the parliament's hurried beat (`scheduleHurriedParliamentBeat` — «дожать» cuts it), the carry is
 * the parliament's own flight (`landBannerCube` → `flyBannerCube`). Reduced motion plays no stage: the cubes are
 * released where they stand (the same numbers, no flight). `abortBannerCubeStage` ends a run at once (the director's
 * kill, the section's unmount) — every cube of the run shown, the card gone.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {BANNER_CUBE_FLIGHT_MS, rectOf, scheduleHurriedParliamentBeat} from './parliamentFlights';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {Rect} from './consoleParliamentVoteMotion';
import {landBannerCube, releaseBannerCube} from './bannerCubeScene';

/** Which printed row the cube leaves: the corporation's EFFECT (a won resolution) or its ON-PLAY row (the first action). */
export type BannerStageOrigin = 'effect' | 'play';

export type BannerStageCube = {party: ReduxParty, color: Color, card: CardName};

export type BannerStagePhase = '' | 'rise' | 'stand' | 'carry' | 'read' | 'sink';

/** The card comes up out of the table's cell. */
export const BANNER_STAGE_RISE_MS = 460;
/** It stands and fixes before the cube leaves (the printed effect's press). */
export const BANNER_STAGE_STAND_MS = 260;
/** The cube has landed: one read of the card and the seated cube together. */
export const BANNER_STAGE_READ_MS = 420;
/** The card goes back down, the table comes back. */
export const BANNER_STAGE_SINK_MS = 320;
/** The phrase's whole length for one cube — the storyboard's arithmetic (the director's master span). */
export const BANNER_STAGE_TOTAL_MS = BANNER_STAGE_RISE_MS + BANNER_STAGE_STAND_MS + BANNER_CUBE_FLIGHT_MS + BANNER_STAGE_READ_MS + BANNER_STAGE_SINK_MS;

export const bannerCubeStage = reactive({
  /** The card standing in the table's cell (undefined: no stage). */
  card: undefined as CardName | undefined,
  color: undefined as Color | undefined,
  party: undefined as ReduxParty | undefined,
  origin: 'effect' as BannerStageOrigin,
  phase: '' as BannerStagePhase,
  /** One per cube — the stage's key (a second cube is a second rise, never a re-pointed card). */
  serial: 0,
});

/** The stage stands (the table recedes under it, the section's class). */
export function bannerCubeStageUp(): boolean {
  return bannerCubeStage.card !== undefined;
}

type StageRun = {beats: Set<ParliamentBeat>, cubes: ReadonlyArray<BannerStageCube>, over: boolean, resolve: (result: 'played' | 'aborted') => void};
let current: StageRun | undefined;

function clearStage(): void {
  bannerCubeStage.card = undefined;
  bannerCubeStage.color = undefined;
  bannerCubeStage.party = undefined;
  bannerCubeStage.phase = '';
}

/**
 * How long past its nominal length any wait of the phrase may stand before its NET ends it. A wait is the parliament's
 * hurried beat («дожать» cuts it) — and that beat can be killed WITHOUT firing (`killParliamentFlights` /
 * `dropFlight` drop every beat and flight of the registry), which stood the card on the table for good (the field
 * report of 2026-10-26: «карта появлялась и workspace так и зависал — помогало только B»). The net is a beat of the
 * motion clock the registry does not own, so nothing but this run can kill it.
 */
export const BANNER_STAGE_NET_SLACK_MS = 900;

/**
 * ONE WAIT THAT ALWAYS ENDS: the hurried beat (the phrase's length, cut by «дожать»), raced with the net. Under an
 * ARMED hurry the beat fires synchronously inside its own scheduling call — `end` therefore reads nothing that is not
 * yet assigned (a `const` read there was a TDZ throw that killed the whole phrase with the card standing).
 */
function wait(run: StageRun, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let over = false;
    // A holder, never a `const` per handle: the beat may call `end` before its own handle exists.
    const h: {beat?: ParliamentBeat, net?: ParliamentBeat} = {};
    const end = (): void => {
      if (over) {
        return;
      }
      over = true;
      for (const b of [h.beat, h.net]) {
        if (b !== undefined) {
          b.kill();
          run.beats.delete(b);
        }
      }
      resolve();
    };
    h.beat = scheduleHurriedParliamentBeat(ms, end);
    if (over) {
      return;
    }
    h.net = scheduleParliamentBeat(ms + BANNER_STAGE_NET_SLACK_MS, end);
    run.beats.add(h.beat);
    run.beats.add(h.net);
  });
}

/**
 * THE CARRY THAT ALWAYS LANDS: the cube's flight onto the banner, raced with a net past its length. A flight dropped by
 * the registry never calls back; the net then SHOWS the cube where it stands (the same numbers, no flight — a hidden
 * cube is a worse lie than a missed one) and names itself.
 */
function carry(run: StageRun, cube: BannerStageCube, origin: BannerStageOrigin, onLanded: () => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let over = false;
    const h: {net?: ParliamentBeat} = {};
    const end = (how: 'landed' | 'net'): void => {
      if (over) {
        return;
      }
      over = true;
      if (h.net !== undefined) {
        h.net.kill();
        run.beats.delete(h.net);
      }
      if (how === 'net') {
        console.warn(`[banner-stage] the cube onto ${cube.party} never touched down — shown where it stands`);
        releaseBannerCube(cube.party, cube.color, true);
      }
      onLanded();
      resolve();
    };
    landBannerCube(cube.party, cube.color, bannerStageCubeOrigin(origin), () => end('landed'));
    if (over) {
      return;
    }
    h.net = scheduleParliamentBeat(BANNER_CUBE_FLIGHT_MS + BANNER_STAGE_NET_SLACK_MS * 2, () => end('net'));
    run.beats.add(h.net);
  });
}

function nextProbe(): Promise<void> {
  return new Promise<void>((resolve) => probeTick(() => resolve()));
}

/**
 * WHERE THE CUBE IS BORN: the card's PRINTED cube glyph on the stage — the corporation's effect row for a won
 * resolution, its on-play row for the first action (`.pcard-mech-group--corp-effect` / `--plain`), any printed cube
 * else; the face's centre as the last honest place (a cube-sized square — never the screen's middle).
 */
export function bannerStageCubeOrigin(origin: BannerStageOrigin): Rect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const stage = document.querySelector<HTMLElement>('[data-banner-stage]');
  if (stage === null) {
    return undefined;
  }
  const row = origin === 'effect' ? '.pcard-mech-group--corp-effect' : '.pcard-mech-group--plain';
  for (const selector of [`${row} .pbcube__cube`, `${row} .pbcube`, '.pbcube__cube', '.pbcube']) {
    const r = rectOf(stage.querySelector(selector));
    if (r !== undefined) {
      return r;
    }
  }
  const face = rectOf(stage.querySelector('.pcard'));
  if (face === undefined) {
    return undefined;
  }
  const size = 24 * conUiScale();
  return {left: face.left + face.width / 2 - size / 2, top: face.top + face.height / 2 - size / 2, width: size, height: size};
}

/**
 * PLAY THE PHRASE for every cube, in turn. `onLanded(cube)` fires on each touchdown (the hold has dropped — the
 * socket answers). Resolves `played` once the last card has gone back down, `aborted` when the run was cut.
 */
export function playBannerCubeStage(
  cubes: ReadonlyArray<BannerStageCube>, opts: {origin: BannerStageOrigin, onLanded?: (cube: BannerStageCube) => void},
): Promise<'played' | 'aborted'> {
  abortBannerCubeStage();
  if (cubes.length === 0) {
    return Promise.resolve('played');
  }
  if (consoleReducedMotionActive()) {
    for (const cube of cubes) {
      releaseBannerCube(cube.party, cube.color, true);
      opts.onLanded?.(cube);
    }
    return Promise.resolve('played');
  }
  return new Promise<'played' | 'aborted'>((resolve) => {
    const run: StageRun = {beats: new Set(), cubes, over: false, resolve};
    current = run;
    const finish = (result: 'played' | 'aborted'): void => {
      if (run.over) {
        return;
      }
      run.over = true;
      if (current === run) {
        current = undefined;
      }
      resolve(result);
    };
    run.resolve = finish;
    // THE PHRASE NEVER STRANDS ITS CARD: any throw inside it ends the run the way a cut does — every cube shown, the
    // card taken away — and the caller is answered (a phrase that dies silently is a workspace that stands forever).
    void (async () => {
      for (const cube of cubes) {
        if (run.over) {
          return;
        }
        bannerCubeStage.serial++;
        bannerCubeStage.card = cube.card;
        bannerCubeStage.color = cube.color;
        bannerCubeStage.party = cube.party;
        bannerCubeStage.origin = opts.origin;
        bannerCubeStage.phase = 'rise';
        await wait(run, BANNER_STAGE_RISE_MS);
        if (run.over) {
          return;
        }
        bannerCubeStage.phase = 'stand';
        await wait(run, BANNER_STAGE_STAND_MS);
        // The glyph is measured on a laid-out frame (the face mounted with the rise; a probe tick, never rAF alone).
        await nextProbe();
        if (run.over) {
          return;
        }
        bannerCubeStage.phase = 'carry';
        await carry(run, cube, opts.origin, () => opts.onLanded?.(cube));
        if (run.over) {
          return;
        }
        bannerCubeStage.phase = 'read';
        await wait(run, BANNER_STAGE_READ_MS);
        if (run.over) {
          return;
        }
        bannerCubeStage.phase = 'sink';
        await wait(run, BANNER_STAGE_SINK_MS);
        if (run.over) {
          return;
        }
        clearStage();
      }
      finish('played');
    })().catch((e: unknown) => {
      console.warn('[banner-stage] the phrase threw — the card goes, the cubes are shown', e);
      if (current === run) {
        abortBannerCubeStage();
      } else {
        finish('aborted');
      }
    });
  });
}

/** Cut the run (the director's kill, an unmount): every cube of it shown where it stands, the card gone at once. */
export function abortBannerCubeStage(): void {
  const run = current;
  if (run === undefined) {
    return;
  }
  for (const beat of run.beats) {
    beat.kill();
  }
  run.beats.clear();
  for (const cube of run.cubes) {
    releaseBannerCube(cube.party, cube.color);
  }
  clearStage();
  run.resolve('aborted');
}
