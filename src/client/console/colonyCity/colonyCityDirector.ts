/*
 * colonyCityDirector — the GSAP hands of «a city is laid on a colony tile»
 * (Turmoil Redux TR22 Nova City; docs/TURMOIL_REDUX_NOVA_CITY.md). Owns ONLY
 * the DOM / tween work on the fixed stage (ConsoleColonyCityLayer): the piece
 * materializing above its seat, the stillness, the accelerated descent, the
 * contact. No game state, no Vue.
 *
 * ONE OBJECT MOVES, ONE PLACE ANSWERS, ONCE:
 *  · the piece is the board's own tile proxy (`ConsoleTileProxy` — art, edge,
 *    touch overlay) and its CONTACT is the landing hero's own beat
 *    (`tilePlacementDirector.addTileTouch`) — a piece does not change the way
 *    it lands by what it is laid on;
 *  · the SHADOW is not the piece's — it lies on the seat for the whole scene:
 *    wide and faint under the hanging piece, tight and dark at contact. That
 *    is what carries the height;
 *  · the descent is ONE progress tween read through the model
 *    (`cityDescentAt`), with the resting pose WRITTEN at its end — three
 *    chained tweens would leave the piece hanging on a slow renderer;
 *  · the owner's cube is the colony build's own language
 *    (`colonyBuildDirector` — approach, drop, contact), played by the
 *    controller on the same stage, half as loud.
 *
 * Physics discipline: transform / opacity only; geometry measured BEFORE a
 * timeline starts; every entry point returns a handle whose END fires exactly
 * once — on completion, on `finish()` («дожать») and on `kill()`.
 */
import {gsap} from 'gsap';
import {CITY_CONTACT_AT, ColonyCityProfile, cityDescentAt} from '@/client/console/colonyCity/colonyCityModel';
import {addTileTouch} from '@/client/console/tilePlacement/tilePlacementDirector';
import {TILE_SETTLE_MS, TILE_SETTLE_PX} from '@/client/console/tilePlacement/tilePlacementModel';

/** A screen rect (real px). */
export type CityRect = {x: number, y: number, w: number, h: number};

export type ColonyCityStageEls = {
  /** The piece (`ConsoleTileProxy`'s root): art + thickness edge + touch overlay. */
  tile: HTMLElement,
  edge: HTMLElement | undefined,
  art: HTMLElement | undefined,
  touch: HTMLElement | undefined,
  /** The shadow that LIES ON THE SEAT (a layer element, never a child of the piece). */
  shadow: HTMLElement,
};

/** A beat in flight: `finish` jumps to its final pose («дожать»), `kill` drops it — either way its `done` fires once. */
export type CityMotionHandle = {finish(): void, kill(): void};

function handleOf(tl: gsap.core.Timeline, done: () => void): CityMotionHandle {
  let ended = false;
  const end = () => {
    if (!ended) {
      ended = true;
      done();
    }
  };
  tl.eventCallback('onComplete', end);
  // A killed timeline never completes — its promise must still resolve.
  tl.eventCallback('onInterrupt', end);
  return {
    finish: () => {
      tl.progress(1);
      end();
    },
    kill: () => {
      tl.kill();
      end();
    },
  };
}

/** The shadow's box on the seat: the hex's lower half, a little wider than the piece. */
function shadowBox(seat: CityRect): {x: number, y: number, w: number, h: number} {
  const w = seat.w * 1.04;
  const h = seat.h * 0.34;
  return {x: seat.x + (seat.w - w) / 2, y: seat.y + seat.h * 0.74, w, h};
}

function poseAt(els: ColonyCityStageEls, seat: CityRect, profile: ColonyCityProfile, q: number): void {
  const pose = cityDescentAt(q, profile);
  gsap.set(els.tile, {
    x: seat.x,
    y: seat.y - pose.lift * seat.h,
    scale: pose.scale,
    rotation: pose.tilt,
  });
  gsap.set(els.shadow, {scaleX: pose.shadowScale, scaleY: pose.shadowScale, opacity: pose.shadowAlpha});
}

/**
 * POSE the stage BEFORE its first visible frame: the piece sized to its seat
 * and hung a lift above it — INVISIBLE (the proxy is born hidden and is only
 * ever revealed by the materialization); the shadow laid on the seat, dark.
 * `false` when the seat cannot be measured (the caller degrades and confesses).
 */
export function placeCityProxy(els: ColonyCityStageEls, seat: CityRect, profile: ColonyCityProfile): boolean {
  if (seat.w < 4 || seat.h < 4) {
    return false;
  }
  gsap.set(els.tile, {width: seat.w, height: seat.h, autoAlpha: 0, transformOrigin: '50% 50%'});
  if (els.edge !== undefined) {
    // The thickness of an airborne piece: 3px under the face (the contact compresses it to 1).
    gsap.set(els.edge, {y: 3, opacity: 0});
  }
  if (els.art !== undefined) {
    gsap.set(els.art, {opacity: 0});
  }
  const box = shadowBox(seat);
  gsap.set(els.shadow, {x: box.x, y: box.y, width: box.w, height: box.h, opacity: 0, transformOrigin: '50% 50%'});
  poseAt(els, seat, profile, 0);
  gsap.set(els.shadow, {opacity: 0});
  return true;
}

/**
 * MATERIALIZE — the piece appears ABOVE its seat: the edge first (its outline,
 * 0 → `edgeMs`), then the art (`artFromMs` → `materializeMs`); on the seat a
 * wide soft shadow comes up with it. Nothing travels: in the colonies' world
 * an object arrives at its own place.
 */
export function playCityMaterialize(els: ColonyCityStageEls, profile: ColonyCityProfile, ms: (base: number) => number, done: () => void): CityMotionHandle {
  const tl = gsap.timeline();
  const total = ms(profile.materializeMs) / 1000;
  const edge = ms(profile.edgeMs) / 1000;
  const artFrom = ms(profile.artFromMs) / 1000;
  // The proxy itself becomes visible at once — what materializes is its content.
  tl.set(els.tile, {autoAlpha: 1}, 0);
  if (els.edge !== undefined) {
    tl.to(els.edge, {opacity: 1, duration: edge, ease: 'power1.out'}, 0);
  }
  if (els.art !== undefined) {
    tl.to(els.art, {opacity: 1, duration: Math.max(0.05, total - artFrom), ease: 'power2.out'}, artFrom);
  }
  tl.to(els.shadow, {opacity: cityDescentAt(0, profile).shadowAlpha, duration: total, ease: 'power1.out'}, 0);
  // The beat is as long as the profile says, whatever its last tween was.
  tl.set({}, {}, total);
  return handleOf(tl, done);
}

export type CityLandingOpts = {
  seat: CityRect,
  profile: ColonyCityProfile,
  /** `motionMs` — every base duration passes through it. */
  ms: (base: number) => number,
  /** `conUiScale()` — the settle's depth is a px constant. */
  uiScale: number,
  /** THE FRAME OF CONTACT — fired exactly once, when the piece touches. */
  onContact: () => void,
};

/**
 * LANDING — ONE progress tween (the model's accelerating fall, the scale and
 * the tilt unwinding, the shadow tightening) with the resting pose written at
 * its end; at the contact point the shared touch beat plays and `onContact`
 * fires — once, also when the beat is hurried or killed (the commit it gates
 * may never be lost).
 */
export function playCityLanding(els: ColonyCityStageEls, opts: CityLandingOpts, done: () => void): CityMotionHandle {
  const {seat, profile} = opts;
  const land = opts.ms(profile.landMs) / 1000;
  const settleMs = opts.ms(TILE_SETTLE_MS);
  const settlePx = Math.max(1, Math.round(TILE_SETTLE_PX * opts.uiScale));
  let contacted = false;
  const contact = () => {
    if (!contacted) {
      contacted = true;
      opts.onContact();
    }
  };
  const tl = gsap.timeline();
  const prog = {q: 0};
  tl.to(prog, {
    q: 1,
    duration: land,
    ease: 'none',
    onUpdate: () => {
      if (contacted) {
        // Past the contact the piece is the TOUCH beat's (its settle owns `y`) — the fall no longer poses it.
        return;
      }
      if (prog.q >= CITY_CONTACT_AT) {
        // The frame of contact: the seat's own pose, written — then the touch reads it.
        poseAt(els, seat, profile, 1);
        contact();
        return;
      }
      poseAt(els, seat, profile, prog.q);
    },
  }, 0);
  // CONTACT — the landing hero's own beat, at the moment the fall reaches the seat.
  addTileTouch(tl, els, {
    at: land * CITY_CONTACT_AT,
    settlePx,
    settleMs,
    shadowAlpha: cityDescentAt(1, profile).shadowAlpha,
  });
  return handleOf(tl, () => {
    // The resting pose is WRITTEN at the end — never left to the last update (a hurried or killed beat lands here too).
    gsap.killTweensOf(els.tile, 'y');
    poseAt(els, seat, profile, 1);
    if (els.edge !== undefined) {
      gsap.set(els.edge, {y: 1});
    }
    if (els.touch !== undefined) {
      gsap.set(els.touch, {autoAlpha: 0});
    }
    gsap.set(els.shadow, {opacity: cityDescentAt(1, profile).shadowAlpha});
    contact();
    done();
  });
}

/** The final poses at once (reduced motion, a degrade, an abort): the piece at rest on its seat. */
export function settleCityProxy(els: ColonyCityStageEls, seat: CityRect, profile: ColonyCityProfile): void {
  gsap.killTweensOf([els.tile, els.shadow, els.edge, els.art, els.touch].filter((el) => el !== undefined));
  gsap.set(els.tile, {width: seat.w, height: seat.h, autoAlpha: 1});
  if (els.edge !== undefined) {
    gsap.set(els.edge, {y: 1, opacity: 1});
  }
  if (els.art !== undefined) {
    gsap.set(els.art, {opacity: 1});
  }
  if (els.touch !== undefined) {
    gsap.set(els.touch, {autoAlpha: 0});
  }
  poseAt(els, seat, profile, 1);
}

/** Abort / unmount: kill every tween on the stage (idempotent). */
export function killColonyCityTweens(els: ColonyCityStageEls): void {
  gsap.killTweensOf([els.tile, els.shadow, els.edge, els.art, els.touch].filter((el) => el !== undefined));
}
