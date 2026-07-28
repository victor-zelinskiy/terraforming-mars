/*
 * QUICK-WHEEL FLIGHT — the runtime half of the wheel's shared-element
 * transitions (reactive state + the GSAP director; the pure declarations
 * live in wheelFlightModel.ts).
 *
 * Lifecycle of one commit:
 *  1. `beginWheelFlight` — called by the shell in the SAME tick as the
 *     commit, while the wheel is still mounted: measures the chosen slot's
 *     icon, blanks it (the proxy becomes the one physical icon) and arms the
 *     request. The action itself is ALREADY dispatched — the flight never
 *     delays logic, data loading or the destination surface's own entry.
 *  2. The always-mounted ConsoleWheelFlightLayer sees the nonce, poses its
 *     proxy over the source rect and runs the director: a short DETACH lift,
 *     an rAF acquisition loop for `[data-wheel-anchor="<id>"]` (the incoming
 *     surface mounts in parallel), then the character's travel leg into the
 *     anchor's live rect.
 *  3. Landing: 'become' anchors were concealed at acquisition and take over
 *     at touchdown (one object, never two); 'absorb' anchors stay live and
 *     swallow the proxy with a pulse. A missing anchor dissolves the proxy
 *     mid-air — decoration degrades, logic never notices.
 *
 * Episode-guarded like every console director: a new commit kills the live
 * flight (restoring any concealed anchor), a safety timer bounds every run,
 * reduced motion skips flights entirely. Transform/opacity only — perf-lite
 * keeps the full choreography.
 */

import {reactive} from 'vue';
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {QuickSlot} from '@/client/console/consoleQuickModel';
import {
  FLIGHT_ACQUIRE_TIMEOUT_MS,
  FLIGHT_DETACH_SCALE,
  FlightPoint,
  WheelFlightSpec,
  flightArcPoint,
  flightBulgeOf,
  flightTravelMsOf,
  wheelFlightSpecFor,
} from '@/client/console/quickWheel/wheelFlightModel';

export type WheelFlightVisual = {barIcon?: string, iconClass?: string, glyph?: string};

type FlightRect = {x: number, y: number, w: number, h: number};

export type WheelFlightRequest = {
  entryId: string,
  visual: WheelFlightVisual,
  from: FlightRect,
  slot: QuickSlot,
  spec: WheelFlightSpec,
};

export const wheelFlightState = reactive({
  /** Bumped per request — the layer's watcher runs the director on it. */
  nonce: 0,
  request: undefined as WheelFlightRequest | undefined,
});

// ── the live episode (module-scoped: exactly one proxy exists) ──────────────

type LiveFlight = {
  tl: gsap.core.Timeline | undefined,
  raf: number,
  safety: number,
  /** A 'become' anchor concealed at acquisition — restored on kill. */
  concealed: HTMLElement | undefined,
  finished: boolean,
};
let live: LiveFlight | undefined;

function finishLive(): void {
  if (live === undefined) {
    return;
  }
  const f = live;
  live = undefined;
  f.finished = true;
  f.tl?.kill();
  if (typeof window !== 'undefined') {
    window.cancelAnimationFrame(f.raf);
    window.clearTimeout(f.safety);
  }
  if (f.concealed !== undefined) {
    gsap.set(f.concealed, {clearProps: 'opacity,transform,visibility'});
  }
  wheelFlightState.request = undefined;
}

/** True while a proxy is posed or travelling (the layer keeps it mounted). */
export function isWheelFlightActive(): boolean {
  return wheelFlightState.request !== undefined;
}

/**
 * Arm a flight for a committed wheel entry. Call while the wheel is STILL
 * mounted (the source icon must be measurable). No-ops without a declared
 * spec, under reduced motion, or without a DOM.
 */
export function beginWheelFlight(entryId: string, slot: QuickSlot, slotEl: Element | null, visual: WheelFlightVisual): void {
  finishLive();
  if (typeof window === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  const spec = wheelFlightSpecFor(entryId);
  if (spec === undefined || slotEl === null) {
    return;
  }
  const iconEl = slotEl.querySelector<HTMLElement>('.con-quick__slot-icon');
  if (iconEl === null) {
    return;
  }
  const r = iconEl.getBoundingClientRect();
  if (r.width < 6 || r.height < 6) {
    return;
  }
  // The proxy is now the one physical icon — the tile's own icon goes dark
  // before the wheel's leave flash (the element unmounts with the wheel).
  gsap.set(iconEl, {opacity: 0});
  wheelFlightState.request = {
    entryId,
    visual,
    from: {x: r.left, y: r.top, w: r.width, h: r.height},
    slot,
    spec: {...spec},
  };
  wheelFlightState.nonce++;
}

/**
 * Redirect an armed flight BEFORE its travel leg begins (same tick as the
 * commit): the shell retargets pass / max-temp heat into the confirm card's
 * emblem. Harmless when nothing is armed.
 */
export function retargetWheelFlight(spec: WheelFlightSpec): void {
  if (wheelFlightState.request !== undefined) {
    wheelFlightState.request.spec = {...spec};
  }
}

/** Dissolve an armed/travelling flight (a guarded execute path refused). */
export function cancelWheelFlight(): void {
  finishLive();
}

/** Game-switch / shell-unmount reset. */
export function resetWheelFlight(): void {
  finishLive();
}

// ── the director (driven by ConsoleWheelFlightLayer) ────────────────────────

export type WheelFlightStage = {
  /** The travelling icon proxy (posed over the source rect). */
  proxy: HTMLElement,
  /** The small ember spark (the heat conversion's second leg). */
  ember: HTMLElement,
};

function centerOf(rect: FlightRect): FlightPoint {
  return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
}

function anchorElOf(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-wheel-anchor="${id}"]`);
}

function measurable(el: HTMLElement | null): FlightRect | undefined {
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width >= 6 && r.height >= 6 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** Replace the episode's safety timer (never two ticking at once). */
function armSafety(flight: LiveFlight, fn: () => void, ms: number): void {
  window.clearTimeout(flight.safety);
  flight.safety = window.setTimeout(fn, ms);
}

/** The proxy's LIVE centre — travel legs continue from wherever the detach
 *  lift actually is (acquisition can outrun the 90 ms lift). */
function liveCenter(proxy: HTMLElement, from: FlightRect): FlightPoint {
  return {
    x: Number(gsap.getProperty(proxy, 'x')) + from.w / 2,
    y: Number(gsap.getProperty(proxy, 'y')) + from.h / 2,
  };
}

/** Pose + run the armed request on the layer's stage. */
export function runWheelFlight(stage: WheelFlightStage): void {
  const request = wheelFlightState.request;
  if (request === undefined || typeof window === 'undefined') {
    return;
  }
  const flight: LiveFlight = {tl: undefined, raf: 0, safety: 0, concealed: undefined, finished: false};
  live = flight;

  const from = request.from;
  const proxy = stage.proxy;
  gsap.set(stage.ember, {autoAlpha: 0});
  gsap.set(proxy, {
    autoAlpha: 1,
    width: from.w,
    height: from.h,
    x: from.x,
    y: from.y,
    scale: 1,
    rotation: 0,
    transformOrigin: '50% 50%',
  });

  // DETACH — the icon lifts off the tile the moment the commit lands.
  const detach = gsap.timeline();
  detach.to(proxy, {scale: FLIGHT_DETACH_SCALE, y: from.y - from.h * 0.18, duration: s(90), ease: 'power2.out'});
  flight.tl = detach;

  const character = () => wheelFlightState.request?.spec.character ?? request.spec.character;

  // Self-contained beats (no destination): play out at the tile and end.
  if (character() === 'stamp') {
    runStamp(flight, proxy, request, from);
    return;
  }
  if (character() === 'sprout') {
    runSprout(flight, proxy, from);
    return;
  }

  // ACQUISITION — rAF-poll the destination anchor while the incoming surface
  // mounts in parallel; require one stable frame so the travel leg aims at
  // settled geometry. The spec is re-read every frame (retarget window).
  const startedAt = performance.now();
  let lastRect: FlightRect | undefined;
  const poll = () => {
    if (flight.finished) {
      return;
    }
    const req = wheelFlightState.request;
    const anchorId = req?.spec.anchor;
    if (req === undefined || anchorId === undefined) {
      dissolve(flight, proxy);
      return;
    }
    const el = anchorElOf(anchorId);
    const rect = measurable(el);
    if (rect !== undefined && lastRect !== undefined &&
        Math.abs(rect.x - lastRect.x) < 1 && Math.abs(rect.y - lastRect.y) < 1) {
      travel(flight, stage, req, from, el as HTMLElement, rect);
      return;
    }
    lastRect = rect;
    if (performance.now() - startedAt > FLIGHT_ACQUIRE_TIMEOUT_MS) {
      dissolve(flight, proxy); // destination never appeared — degrade honestly
      return;
    }
    flight.raf = window.requestAnimationFrame(poll);
  };
  flight.raf = window.requestAnimationFrame(poll);
  flight.safety = window.setTimeout(() => dissolve(flight, proxy), FLIGHT_ACQUIRE_TIMEOUT_MS + motionMs(900));
}

/** The travel leg into an acquired anchor. */
function travel(flight: LiveFlight, stage: WheelFlightStage, request: WheelFlightRequest, from: FlightRect, anchorEl: HTMLElement, to: FlightRect): void {
  const proxy = stage.proxy;
  const spec = request.spec;
  const landing = spec.landing ?? 'become';
  if (landing === 'become') {
    // The anchor is the SAME object — it stays dark until the icon arrives.
    flight.concealed = anchorEl;
    gsap.set(anchorEl, {opacity: 0});
  }
  const fromC = liveCenter(proxy, from);
  const toC = centerOf(to);
  // 'become' matches the anchor icon's size on arrival; 'absorb' melts INTO
  // a live zone whose box may be far wider than an icon — never inflate.
  const endScale = landing === 'become' ?
    Math.max(0.4, Math.min(2.2, to.w / from.w)) : 0.9;
  const bulge = flightBulgeOf(spec.character);
  const travelMs = flightTravelMsOf(spec.character);
  const ease =
    spec.character === 'surge' ? 'power3.inOut' :
      spec.character === 'deal' ? 'power2.in' :
        spec.character === 'forge' ? 'power3.inOut' : 'power2.inOut';

  const tl = gsap.timeline({onComplete: () => land(flight, stage, request, anchorEl, toC)});
  flight.tl?.kill();
  flight.tl = tl;
  const state = {t: 0};
  tl.to(state, {
    t: 1,
    duration: s(travelMs),
    ease,
    onUpdate: () => {
      const p = bulge === 0 ?
        {x: fromC.x + (toC.x - fromC.x) * state.t, y: fromC.y + (toC.y - fromC.y) * state.t} :
        flightArcPoint(state.t, fromC, toC, bulge);
      gsap.set(proxy, {x: p.x - from.w / 2, y: p.y - from.h / 2});
    },
  }, 0);
  tl.to(proxy, {scale: endScale, duration: s(travelMs), ease: 'power2.inOut'}, 0);
  if (bulge !== 0) {
    // A hint of roll along the arc — the icon banks into its turn.
    tl.to(proxy, {rotation: bulge > 0 ? 10 : -10, duration: s(travelMs * 0.55), ease: 'power1.in'}, 0)
      .to(proxy, {rotation: 0, duration: s(travelMs * 0.45), ease: 'power1.out'}, s(travelMs * 0.55));
  }
  armSafety(flight, () => dissolve(flight, proxy), motionMs(travelMs) + 1200);
}

/** Touchdown: the anchor takes over (become) or swallows the proxy (absorb). */
function land(flight: LiveFlight, stage: WheelFlightStage, request: WheelFlightRequest, anchorEl: HTMLElement, at: FlightPoint): void {
  if (flight.finished) {
    return;
  }
  const proxy = stage.proxy;
  const landing = request.spec.landing ?? 'become';
  const tl = gsap.timeline({onComplete: () => {
    if (request.spec.character === 'ember') {
      runEmberSpark(flight, stage, at);
      return;
    }
    finishLive();
  }});
  flight.tl?.kill();
  flight.tl = tl;
  if (landing === 'become') {
    flight.concealed = undefined;
    tl.set(anchorEl, {opacity: 1}, 0);
    tl.fromTo(anchorEl, {scale: 1.12}, {scale: 1, duration: s(170), ease: 'power2.out', clearProps: 'transform,opacity'}, 0);
    tl.to(proxy, {autoAlpha: 0, duration: s(70), ease: 'power1.in'}, 0);
  } else {
    // absorb: the proxy melts into the live element, which answers with a pulse.
    tl.to(proxy, {autoAlpha: 0, scale: 0.6, duration: s(120), ease: 'power2.in'}, 0);
    tl.fromTo(anchorEl, {scale: 1.1}, {scale: 1, duration: s(200), ease: 'power2.out', clearProps: 'transform'}, s(40));
  }
}

/** Heat's second leg: a spark continues from the heat row up to the
 *  temperature readout — the stored heat visibly becomes temperature. */
function runEmberSpark(flight: LiveFlight, stage: WheelFlightStage, from: FlightPoint): void {
  const tempRect = measurable(anchorElOf('temp'));
  if (tempRect === undefined) {
    finishLive();
    return;
  }
  const tempEl = anchorElOf('temp') as HTMLElement;
  const to = centerOf(tempRect);
  const ember = stage.ember;
  gsap.set(ember, {autoAlpha: 0, x: from.x, y: from.y, scale: 0.7});
  const tl = gsap.timeline({onComplete: () => {
    gsap.fromTo(tempEl, {scale: 1.16}, {scale: 1, duration: s(220), ease: 'power2.out', clearProps: 'transform'});
    finishLive();
  }});
  flight.tl = tl;
  const state = {t: 0};
  tl.to(ember, {autoAlpha: 1, scale: 1, duration: s(80), ease: 'power1.out'}, 0);
  tl.to(state, {
    t: 1,
    duration: s(300),
    ease: 'power2.inOut',
    onUpdate: () => {
      const p = flightArcPoint(state.t, from, to, -0.2);
      gsap.set(ember, {x: p.x, y: p.y});
    },
  }, s(30));
  tl.to(ember, {autoAlpha: 0, scale: 0.5, duration: s(90), ease: 'power1.in'}, s(280));
  armSafety(flight, () => finishLive(), motionMs(600) + 800);
}

/** Skip turn: a directional dash at the tile (its slot's own direction). */
function runStamp(flight: LiveFlight, proxy: HTMLElement, request: WheelFlightRequest, from: FlightRect): void {
  const dir = request.slot;
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : dir === 'center' ? -0.4 : 0;
  const push = from.h * 1.5;
  const tl = gsap.timeline({onComplete: () => finishLive()});
  flight.tl?.kill();
  flight.tl = tl;
  tl.to(proxy, {
    x: from.x + dx * push,
    y: from.y - from.h * 0.18 + dy * push,
    scale: 1.05,
    autoAlpha: 0,
    duration: s(flightTravelMsOf('stamp')),
    ease: 'power2.in',
  });
  armSafety(flight, () => finishLive(), motionMs(600) + 600);
}

/** Plants: the icon dives toward the board and dissolves into the placement
 *  glow — the conversion CONTINUES as the greenery placement mode. */
function runSprout(flight: LiveFlight, proxy: HTMLElement, from: FlightRect): void {
  const board = measurable(document.querySelector<HTMLElement>('.con-board'));
  const to: FlightPoint = board !== undefined ?
    {x: board.x + board.w / 2, y: board.y + board.h * 0.46} :
    {x: window.innerWidth * 0.42, y: window.innerHeight * 0.45};
  const fromC = liveCenter(proxy, from);
  const tl = gsap.timeline({onComplete: () => finishLive()});
  flight.tl?.kill();
  flight.tl = tl;
  const state = {t: 0};
  const travelMs = flightTravelMsOf('sprout');
  tl.to(state, {
    t: 1,
    duration: s(travelMs),
    ease: 'power2.in',
    onUpdate: () => {
      const p = flightArcPoint(state.t, fromC, to, 0.1);
      gsap.set(proxy, {x: p.x - from.w / 2, y: p.y - from.h / 2});
    },
  }, 0);
  // The dive shrinks INTO the field, then blooms out as a soft green pulse
  // right where the placement highlights are lighting up.
  tl.to(proxy, {scale: 0.55, duration: s(travelMs), ease: 'power2.in'}, 0);
  tl.to(proxy, {scale: 1.7, autoAlpha: 0, duration: s(200), ease: 'power2.out'}, s(travelMs));
  armSafety(flight, () => finishLive(), motionMs(travelMs + 400) + 800);
}

/** No destination — the proxy lets go mid-air, quietly. */
function dissolve(flight: LiveFlight, proxy: HTMLElement): void {
  if (flight.finished) {
    return;
  }
  const tl = gsap.timeline({onComplete: () => finishLive()});
  flight.tl?.kill();
  flight.tl = tl;
  tl.to(proxy, {autoAlpha: 0, scale: 0.82, duration: s(150), ease: 'power2.in'});
}
