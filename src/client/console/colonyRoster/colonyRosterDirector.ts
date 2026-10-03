/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COLONY ROSTER CEREMONY — the DIRECTOR (GSAP; handles live outside
 * reactivity). Two phrases, two scales each; contract and laws:
 * docs/COLONY_ROSTER_CEREMONY.md.
 *
 *  THE TILE IS A PLACE, THE PLANET IS AN OBJECT. Only the planet's disc moves
 *  (`.con-planet` — the ONE disc the tile, the stage and the dossier render).
 *  A tile never flies, never scales and never pulses: its content lives inside
 *  a CSS `zoom`, where a fractional scale re-rasterizes every digit each
 *  frame. The tile ASSEMBLES around a planet that has docked and COMES APART
 *  around one that leaves — by opacity alone.
 *
 *  ONE GRAMMAR, MIRRORED. An arrival is «space → objects → WORDS» (the stage's
 *  own entry order); a departure is «words → objects → space».
 *
 *  EVERY HANDLE ENDS ONCE. `onDone` fires on completion AND on interruption
 *  (a killed timeline restores the final pose first), so a hold released by
 *  it can never be stranded by a kill.
 */
import gsap from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ROSTER_ARRIVE_MS, ROSTER_DEPART_MS} from '@/client/console/colonyRoster/colonyRosterModel';

export type RosterMotionHandle = {
  /** Jump to the final pose NOW (A during the ceremony — «дожать»): `onDone` fires. */
  finish(): void;
  /** Tear down (abort / unmount): the final pose is restored, `onDone` fires. */
  kill(): void;
};

/** Base ms → GSAP seconds through the one motion scale. */
function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** A timeline whose end — natural or forced — is reported exactly once, after its inline props are cleared. */
function once(build: (tl: gsap.core.Timeline) => void, owned: ReadonlyArray<Element>, onDone: () => void): RosterMotionHandle {
  let ended = false;
  const end = (): void => {
    if (ended) {
      return;
    }
    ended = true;
    if (owned.length > 0) {
      gsap.set(owned, {clearProps: 'transform,opacity,visibility'});
    }
    onDone();
  };
  const tl = gsap.timeline({onComplete: end, onInterrupt: end});
  build(tl);
  return {
    finish: () => {
      if (!ended) {
        tl.progress(1);
        end();
      }
    },
    kill: () => {
      tl.kill();
      end();
    },
  };
}

function all(root: Element, selector: string): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

/** The tile's three layers, by the grammar: WORDS · OBJECTS · (the planet is the heaviest object, alone). */
type TileLayers = {words: Array<HTMLElement>, objects: Array<HTMLElement>, planet: HTMLElement | null};

function tileLayers(tile: HTMLElement): TileLayers {
  return {
    words: all(tile, '.con-coltile__name, .con-coltile__rows, .con-coltile__status, .con-coltile__track-pos'),
    objects: all(tile, '.con-coltile__build, .con-coltile__track-cell, .con-coltile__dock'),
    planet: tile.querySelector<HTMLElement>('.con-coltile__planet'),
  };
}

/**
 * DEPART at the TILE's scale — the planet leaves its own disc «into depth»
 * (it shrinks, its light drifts off, it dissolves to a point); the words go
 * first, the track darkens right to left, the planet last. What stays is the
 * free orbit (the section's own pose once this handle ends).
 */
export function playTileDepart(tile: HTMLElement, onDone: () => void): RosterMotionHandle {
  const {words, objects, planet} = tileLayers(tile);
  // NOTHING is restored at the end: the tile stays dark until the table that still holds it is released (it then
  // unmounts, or its successor mounts in its slot). A departed planet that came back for a frame would be a blink.
  const owned: Array<Element> = [];
  return once((tl) => {
    if (words.length > 0) {
      tl.to(words, {opacity: 0, duration: s(140), ease: 'power1.in'}, 0);
    }
    if (objects.length > 0) {
      // Right to left: the track goes dark from its far end, the way a marker is taken off it.
      tl.to([...objects].reverse(), {opacity: 0, duration: s(120), ease: 'power1.in', stagger: {each: 0.012, from: 'start'}}, s(60));
    }
    if (planet !== null) {
      tl.to(planet, {
        scale: 0.55, y: -6, opacity: 0,
        transformOrigin: '50% 50%',
        duration: s(ROSTER_DEPART_MS - 160),
        ease: 'power2.in',
      }, s(160));
    }
  }, owned, onDone);
}

/** Before the first paint of an arriving tile: everything but the slot's own plate is held dark. */
export function holdTileForArrival(tile: HTMLElement): void {
  const {words, objects, planet} = tileLayers(tile);
  gsap.set([...words, ...objects], {opacity: 0});
  if (planet !== null) {
    gsap.set(planet, {opacity: 0, scale: 0.55, y: -6, transformOrigin: '50% 50%'});
  }
}

/**
 * ARRIVE at the TILE's scale — the planet comes «out of depth» over its own
 * slot and docks (the heaviest object, the slowest ease); then the STRUCTURE
 * lights up left to right in one pass; then the WORDS.
 */
export function playTileArrive(tile: HTMLElement, onDone: () => void): RosterMotionHandle {
  const {words, objects, planet} = tileLayers(tile);
  const owned = [...words, ...objects, ...(planet === null ? [] : [planet])];
  return once((tl) => {
    if (planet !== null) {
      tl.to(planet, {scale: 1, y: 0, opacity: 1, duration: s(460), ease: 'power3.inOut'}, s(80));
    }
    if (objects.length > 0) {
      tl.to(objects, {opacity: 1, duration: s(180), ease: 'power2.out', stagger: {each: 0.014, from: 'start'}}, s(520));
    }
    if (words.length > 0) {
      tl.to(words, {opacity: 1, duration: s(ROSTER_ARRIVE_MS - 760), ease: 'power2.out'}, s(760));
    }
  }, owned, onDone);
}

/**
 * DEPART at the STAGE's scale — the «outgoing seat» (the small disc of the
 * tile that leaves, in the hero column): its caption first, then the disc.
 */
export function playStageDepart(seat: HTMLElement, onDone: () => void): RosterMotionHandle {
  const caption = all(seat, '[data-roster-seat-caption]');
  const disc = seat.querySelector<HTMLElement>('.con-planet');
  // The seat is NOT restored at the end: the tile it named is gone — the stage hides the seat on this handle's end.
  return once((tl) => {
    if (caption.length > 0) {
      tl.to(caption, {opacity: 0, duration: s(140), ease: 'power1.in'}, 0);
    }
    if (disc !== null) {
      tl.to(disc, {scale: 0.55, y: -6, opacity: 0, transformOrigin: '50% 50%', duration: s(ROSTER_DEPART_MS - 160), ease: 'power2.in'}, s(160));
    } else {
      tl.to(seat, {opacity: 0, duration: s(ROSTER_DEPART_MS), ease: 'power1.in'}, 0);
    }
  }, [], onDone);
}

/**
 * DEPART of the stage's HERO (a bare removal — the solo trim): the same
 * phrase on the big disc; the stage then lets go where it stands.
 */
export function playHeroDepart(stage: HTMLElement, onDone: () => void): RosterMotionHandle {
  const late = all(stage, '[data-unfold-late]');
  const items = all(stage, '[data-unfold-item]');
  const disc = stage.querySelector<HTMLElement>('[data-colony-card-source] .con-planet, .con-colfocus__hero .con-planet');
  return once((tl) => {
    if (late.length > 0) {
      tl.to(late, {opacity: 0, duration: s(140), ease: 'power1.in'}, 0);
    }
    if (items.length > 0) {
      tl.to(items, {opacity: 0, duration: s(160), ease: 'power1.in'}, s(60));
    }
    if (disc !== null) {
      tl.to(disc, {scale: 0.55, y: -10, opacity: 0, transformOrigin: '50% 50%', duration: s(ROSTER_DEPART_MS - 160), ease: 'power2.in'}, s(160));
    }
  }, [], onDone);
}

/**
 * ARRIVE at the STAGE's scale — the hero stood in its PROJECTION pose (the
 * dashed orbit, the disc a step short of its place: CSS, `--projected`). It
 * docks: the disc settles to size on the heaviest ease, the orbit closes (the
 * stage drops the pose on this handle's `onDocked`), one pass of light runs
 * along the track left to right, the words arrive last.
 */
export function playStageArrive(stage: HTMLElement, onDocked: () => void, onDone: () => void): RosterMotionHandle {
  const disc = stage.querySelector<HTMLElement>('.con-colfocus__hero .con-planet');
  const cells = all(stage, '[data-colony-track-cell]');
  const late = all(stage, '[data-roster-late]');
  let docked = false;
  const dock = (): void => {
    if (!docked) {
      docked = true;
      onDocked();
    }
  };
  return once((tl) => {
    if (disc !== null) {
      // FROM the projection pose's own transform (CSS), TO rest — the class is dropped at the dock, in the same frame.
      tl.fromTo(disc, {scale: 0.9, y: -8}, {scale: 1, y: 0, duration: s(460), ease: 'power3.inOut', transformOrigin: '50% 50%'}, s(80));
    }
    tl.call(dock, undefined, s(540));
    if (cells.length > 0) {
      tl.fromTo(cells, {opacity: 0.35}, {opacity: 1, duration: s(160), ease: 'power2.out', stagger: {each: 0.03, from: 'start'}}, s(520));
    }
    if (late.length > 0) {
      tl.fromTo(late, {opacity: 0}, {opacity: 1, duration: s(ROSTER_ARRIVE_MS - 760), ease: 'power2.out'}, s(760));
    }
  }, [...(disc === null ? [] : [disc]), ...cells, ...late], () => {
    dock();
    onDone();
  });
}

/**
 * RESEAT — the grid changes its population. The CONTENT of the tiles lets go
 * (opacity only: text under a `zoom` never travels and never scales), the
 * caller swaps the table and waits for the one fit, and `playReseatIn` brings
 * the content back. Two halves, because the swap between them is the caller's.
 */
export function playReseatOut(grid: HTMLElement, onDone: () => void): RosterMotionHandle {
  const tiles = all(grid, '.con-coltile');
  return once((tl) => {
    if (tiles.length > 0) {
      tl.to(tiles, {opacity: 0, duration: s(140), ease: 'power1.in'}, 0);
    } else {
      tl.to({}, {duration: 0.001});
    }
  }, [], onDone);
}

export function playReseatIn(grid: HTMLElement, except: HTMLElement | null, onDone: () => void): RosterMotionHandle {
  const tiles = all(grid, '.con-coltile').filter((tile) => tile !== except);
  return once((tl) => {
    if (tiles.length > 0) {
      tl.fromTo(tiles, {opacity: 0}, {opacity: 1, duration: s(200), ease: 'power2.out', stagger: {each: 0.014, from: 'start'}}, 0);
    } else {
      tl.to({}, {duration: 0.001});
    }
  }, tiles, onDone);
}
