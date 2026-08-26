/*
 * HAND REVEAL DIRECTOR v2 — the dock ⇄ album transition over the SINGLE
 * OWNER of the hand's cards (handBodies.ts + ConsoleHandRevealLayer, the
 * bodies layer).
 *
 * THE REWORK'S CONTRACT. Every hand card is ONE persistent element on the
 * bodies layer for its whole life: the docked pack, the flights, the album
 * shelf and the page packets are STATES of the same element, never
 * different elements swapped under each other. An episode therefore never
 * spawns, hides, samples or materializes anything — it SEIZES the live
 * bodies wherever they stand (raised, hover, mid-ride — the exact pixels on
 * screen), flies them, and releases them into their next state. «Карта
 * исчезла/появилась при свапе» is inexpressible by construction.
 *
 * WHAT EACH DIRECTION DOES.
 *  OPEN  — seize all bodies IN PLACE (their current poses ARE frame one),
 *          lift, then a contiguous left→right PEEL: the page's own cards fly
 *          to their slot rects (back→face 3D turn through the flight's
 *          heart), the rest slide out through the STAGE WINDOW to their
 *          page-packet anchors. At the end the interactive slots take over
 *          under the page bodies (the one pixel-true no-dip handoff) and
 *          the packet bodies stay PARKED beyond the window.
 *  CLOSE — the mirror, LIFO: page bodies un-hide at their slot rects (the
 *          reverse handoff, same flush the slots hold), packets re-enter
 *          through the window, and everything flies onto its ANALYTIC dock
 *          pose (handBodies.dockedBodyPose — a pure function, no DOM reads,
 *          no measure races, no magnets). Arrival just flips the mode back
 *          to `docked`; the layer's reconcile heals any pose drift.
 *
 * THE CLOCK (kept from the continuity rework): the timeline never rides
 * GSAP's ticker — it stays paused and the episode's own driver steps it,
 * PAINT-LOCKED (one bounded ≤28 ms step per painted frame; a slow machine
 * gets a slower, continuous flight), with a dead-compositor watchdog and a
 * progress-aware safety. The ignition gate lets the album's mount storm
 * paint before the clock starts. `[hand-reveal]` warns mark every degrade;
 * the arm log names the core revision (`handRevealState.rev`).
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {beginDockIntakeAccent} from '@/client/console/handDock/consoleDockAccent';
import {handRevealState, RevealVisual} from '@/client/console/handDock/handRevealState';
import {
  handBodiesOracle, handBodyEl, handBodyMode, setHandBodiesFlying, ensureHandBodyFaces,
  setHandBodyMode, resetHandBodies,
} from '@/client/console/handDock/handBodies';
import {dockFaceRotation} from '@/client/console/handDock/handDockPresentation';

export type RevealRect = {left: number, top: number, width: number, height: number};

/** Kept for the section's `transitionTargets` shape (the stage window does
 *  the erasing now — per-pair clips are informational only). */
export type RevealClip = {top: number, bottom: number, left?: number, right?: number};

/** One hand card's album destination (open) / origin (close). */
export type RevealPair = {
  name: CardName,
  /** Legacy dock rect — unused by v2 (the bodies stand where they stand;
   *  the close lands on the analytic pose). Kept optional for callers. */
  source?: RevealRect,
  /** The album home: the page slot rect, or the page-packet anchor. */
  target: RevealRect,
  /** The target is a visible page slot (face card) vs a packet anchor. */
  visible: boolean,
  clip?: RevealClip,
  /** The landed presentation the flying face carries. */
  visual?: RevealVisual,
};

export type RevealHooks = {
  setSection: (s: 'hand' | 'board') => void,
  restoreScroll: (px: number) => void,
};

export type StageBounds = {left: number, right: number};

type Episode = {
  kind: 'open' | 'close' | 'filter',
  tl: gsap.core.Timeline,
  els: Array<HTMLElement>,
  pairs: ReadonlyArray<RevealPair>,
  safety: number,
  onResize: () => void,
  scrollTop: number,
  finished: boolean,
  stopDriver?: () => void,
  accentRelease?: () => void,
};

let episode: Episode | undefined;
let hooks: RevealHooks | undefined;
let buildingKind: Episode['kind'] | undefined;
let building = false;
let pendingReverse = false;
/** Build epoch — a reset mid-build must not install a dead episode. */
let buildSeq = 0;

export function setHandRevealHooks(h: RevealHooks): void {
  hooks = h;
}

export function isHandRevealEpisodeRunning(): boolean {
  return building || (episode !== undefined && !episode.finished);
}

export function runningHandRevealKind(): Episode['kind'] | undefined {
  if (building) {
    return buildingKind;
  }
  return episode !== undefined && !episode.finished ? episode.kind : undefined;
}

/* ── choreography constants (base ms — motionMs scales them) ────────── */
const LIFT_MS = 120;
const OPEN_FLIGHT_MS = 560;
const CLOSE_FLIGHT_MS = 480;
const HANDOFF_MS = 180; // body fade over the identical materialized slot
const LIFT_PX = 18;
const FILTER_MOVE_MS = 340;
const FILTER_LEAVE_MS = 420;
const FILTER_ENTER_MS = 480;

/** The peel window: bounded regardless of hand size — brisk, readable. */
function spreadMs(count: number): number {
  return count <= 4 ? 130 : count <= 8 ? 180 : 230;
}

function spawnBudget(count: number, flightMs: number): number {
  return motionMs(LIFT_MS + flightMs + spreadMs(count)) + 1500;
}

/** 0..1 left-to-right sequence by CURRENT x — the pack peels contiguously
 *  from one edge and rebuilds LIFO from the other, so the visible backs are
 *  always one solid run (never a fan with holes in its middle). */
function peelByX(els: ReadonlyArray<HTMLElement | undefined>): Array<number> {
  const xs = els.map((el) => el === undefined ? 0 : Number(gsap.getProperty(el, 'x')));
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const seq = new Array<number>(els.length).fill(0);
  const n = Math.max(1, els.length - 1);
  order.forEach((idx, k) => {
    seq[idx] = k / n;
  });
  return seq;
}

/* ── ignition gate + the paint-locked episode clock ─────────────────── */

const IGNITION_MAX_WAIT_MS = 240;

/** Two painted frames OR the wall backstop, whichever first. Every measure
 *  wait on the hand's open/close paths must ride this (never a bare double
 *  rAF): a fully idle headless/background compositor withholds frames, and
 *  a hung measure leaves `phase: 'opening'` + holdSlots latched forever. */
export function settledPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        clearTimeout(backstop);
        resolve();
      }
    };
    const backstop = window.setTimeout(finish, IGNITION_MAX_WAIT_MS);
    requestAnimationFrame(() => requestAnimationFrame(finish));
  });
}

const DRIVER_INTERVAL_MS = 40;
/** One bounded clock step per painted frame (~120 px at the fastest leg) —
 *  a stall or a slow machine slides the flight later in time, never through
 *  space. */
const MAX_STEP_MS = 28;
/** The compositor counts as DEAD only after this long without a rAF tick —
 *  below it the watchdog must NOT advance the clock (ticks between paints
 *  are exactly the reported «веер прореживается за один кадр»). */
const RAF_DEAD_MS = 260;

function startEpisodeDriver(ep: Episode): void {
  const tl = ep.tl;
  let last = performance.now();
  let rafId = 0;
  let iv = 0;
  let running = true;
  let expectedTime = tl.time();
  const stop = () => {
    if (running) {
      running = false;
      window.clearInterval(iv);
      window.cancelAnimationFrame(rafId);
    }
  };
  ep.stopDriver = stop;
  const step = () => {
    if (!running) {
      return;
    }
    if (episode !== ep || ep.finished) {
      stop();
      return;
    }
    const now = performance.now();
    const rawDt = now - last;
    if (rawDt < 12) {
      return; // coalesce back-to-back interval+rAF ticks
    }
    const dt = Math.min(rawDt, MAX_STEP_MS) / 1000;
    last = now;
    const dur = Math.max(0.001, tl.duration());
    const rev = tl.reversed();
    const cur = tl.time();
    if (Math.abs(cur - expectedTime) > 0.012) {
      console.warn(`[hand-reveal] foreign clock moved tl by ${Math.round((cur - expectedTime) * 1000)}ms (paused=${String(tl.paused())})`);
    }
    const next = rev ? cur - dt : cur + dt;
    if (rev ? next <= 0 : next >= dur) {
      stop();
      if (Math.abs((rev ? 0 : dur) - cur) > (MAX_STEP_MS + 2) / 1000) {
        console.warn(`[hand-reveal] driver boundary jump ${Math.round(Math.abs((rev ? 0 : dur) - cur) * 1000)}ms`);
      }
      expectedTime = rev ? 0 : dur;
      tl.time(rev ? 0 : dur, false);
      const cb = tl.eventCallback(rev ? 'onReverseComplete' : 'onComplete') as (() => void) | null;
      cb?.();
      return;
    }
    expectedTime = next;
    tl.time(next, false);
  };
  let lastRafAt = performance.now();
  const loop = () => {
    if (!running) {
      return;
    }
    lastRafAt = performance.now();
    step();
    rafId = window.requestAnimationFrame(loop);
  };
  iv = window.setInterval(() => {
    if (running && performance.now() - lastRafAt > RAF_DEAD_MS) {
      step();
    }
  }, DRIVER_INTERVAL_MS);
  rafId = window.requestAnimationFrame(loop);
}

/* ── seize / release ────────────────────────────────────────────────── */

/**
 * SEIZE the bodies for an episode: mark them flying (adds the probes'
 * `data-reveal-card`), mount faces for the page cards, stamp the flight
 * visuals, and stop any layer pose tween so the timeline owns the element
 * from its CURRENT pixels. Returns els in pair order.
 */
function seizeBodies(pairs: ReadonlyArray<RevealPair>): Array<HTMLElement | undefined> {
  setHandBodiesFlying(pairs.map((p) => p.name as string));
  // EVERY seized body needs its face: the album's physical model lays the
  // whole hand out FACE-UP (packet spreads included — a face-less flip
  // turning to 0 shows a transparent card), and the close's approach turn
  // starts from a face too. A mounted face is a warm cache, never churn.
  ensureHandBodyFaces(pairs.map((p) => p.name as string));
  const visuals: Record<string, RevealVisual> = {};
  for (const p of pairs) {
    if (p.visual !== undefined) {
      visuals[p.name as string] = p.visual;
    }
  }
  handRevealState.flightVisuals = visuals;
  return pairs.map((p) => {
    const el = handBodyEl(p.name as string);
    if (el !== undefined) {
      gsap.killTweensOf(el);
      setHandBodyMode(p.name as string, 'flying');
    }
    return el;
  });
}

/** Release every seized body into its post-episode mode. */
function releaseBodies(ep: Episode, mode: (p: RevealPair) => 'docked' | 'shelf' | 'packet'): void {
  ep.pairs.forEach((p, i) => {
    const el = ep.els[i];
    if (el === undefined) {
      return;
    }
    const m = mode(p);
    setHandBodyMode(p.name as string, m);
    if (m === 'shelf') {
      // The no-dip handoff: the slot snapped visible under the body (the
      // caller released holdSlots in the same flush) — the body fades ON
      // TOP of the identical picture, then hides for the shelf's lifetime.
      gsap.to(el, {
        autoAlpha: 0, duration: motionMs(HANDOFF_MS) / 1000, ease: 'power1.out',
        onComplete: () => gsap.set(el, {autoAlpha: 0}),
      });
      // Wall-clock backstop: a starved fade must not leave a half-faded
      // body over the slot forever.
      window.setTimeout(() => {
        if (handBodyMode(p.name as string) === 'shelf') {
          gsap.killTweensOf(el, 'opacity,visibility');
          gsap.set(el, {autoAlpha: 0});
        }
      }, motionMs(HANDOFF_MS) + 300);
    } else {
      gsap.set(el, {autoAlpha: 1});
    }
  });
  setHandBodiesFlying([]);
  handRevealState.flightVisuals = {};
}

function teardown(): void {
  const ep = episode;
  if (ep === undefined) {
    return;
  }
  clearTimeout(ep.safety);
  ep.stopDriver?.();
  window.removeEventListener('resize', ep.onResize);
  ep.accentRelease?.();
  ep.accentRelease = undefined;
  ep.tl.kill();
  episode = undefined;
}

/* ── OPEN: pack → album ─────────────────────────────────────────────── */

export async function runHandOpenEpisode(allPairs: ReadonlyArray<RevealPair>, stage?: StageBounds): Promise<void> {
  if (allPairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.stageClip = stage;
    for (const p of allPairs) {
      const el = handBodyEl(p.name as string);
      if (el !== undefined) {
        const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
        if (flip !== null) {
          gsap.set(flip, {rotationY: 0}); // the album lays every card FACE-UP
        }
        if (p.visible) {
          setHandBodyMode(p.name as string, 'shelf');
          gsap.set(el, {autoAlpha: 0});
        } else {
          setHandBodyMode(p.name as string, 'packet');
          gsap.set(el, {x: p.target.left, y: p.target.top, scale: p.target.width / naturalWOf(el), autoAlpha: 1});
        }
      }
    }
    handRevealState.phase = 'open';
    handRevealState.holdSlots = false;
    return;
  }
  building = true;
  buildingKind = 'open';
  pendingReverse = false;
  const seq = ++buildSeq;
  handRevealState.phase = 'opening';
  handRevealState.holdSlots = true;
  handRevealState.stageClip = stage;
  const els = seizeBodies(allPairs);
  await nextTick(); // faces mount under their flips before anything turns
  if (seq !== buildSeq) {
    return;
  }

  const s = (ms: number) => motionMs(ms) / 1000;
  const peel = peelByX(els);
  const spread = spreadMs(allPairs.length);
  const tl = gsap.timeline({paused: true});

  allPairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const scaleTo = p.target.width / naturalWOf(el);
    // Frame one IS the pack as painted (the bodies stand wherever the pose
    // ride left them — raised, hover, mid-ride). The lift answers the press
    // as one mass; the PEEL then runs left→right, so the tray empties from
    // one edge — never out of its middle.
    const at = s(LIFT_MS) + s(spread) * peel[i];
    const flight = s(OPEN_FLIGHT_MS);
    tl.to(el, {y: `-=${LIFT_PX * conUiScale()}`, duration: s(LIFT_MS), ease: 'power1.out'}, 0);
    tl.to(el, {
      x: p.target.left, y: p.target.top, scale: scaleTo, rotation: 0,
      duration: flight, ease: 'power2.inOut',
    }, at);
    // EVERY card turns face-up — the album's physical model lays the whole
    // hand out FACE-UP, page cards and packet spreads alike (a packet that
    // stayed back-side later re-entered on a filter «рубашкой и вдруг
    // лицом», and a close from a visited page flew stale faces home). The
    // 3D turn is the flight's heart — slow enough to READ; packet-bound
    // bodies play the same turn while the stage window wipes them out
    // through the boundary.
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      tl.to(flip, {rotationY: 0, duration: flight * 0.62, ease: 'power2.inOut'}, at + flight * 0.08);
    }
  });

  await settledPaint();
  if (seq !== buildSeq) {
    tl.kill();
    return;
  }
  installEpisode('open', tl, els, allPairs, 0, spawnBudget(allPairs.length, OPEN_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeOpenForward());
  tl.eventCallback('onReverseComplete', () => finalizeOpenReverse());
}

function naturalWOf(el: HTMLElement): number {
  const w = Number.parseFloat(el.style.width);
  return Number.isFinite(w) && w > 1 ? w : 320;
}

function finalizeOpenForward(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots snap visible under the bodies
  releaseBodies(ep, (p) => p.visible ? 'shelf' : 'packet');
  teardown();
}

function finalizeOpenReverse(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.finished = true;
  handRevealState.phase = 'docked';
  handRevealState.holdSlots = false;
  handRevealState.stageClip = undefined;
  releaseBodies(ep, () => 'docked');
  hooks?.setSection('board');
  teardown();
  // The pack pose may have moved on while the cancel flew — heal softly.
  handBodiesOracle()?.reconcile();
}

/* ── CLOSE: album → pack ────────────────────────────────────────────── */

export async function runHandCloseEpisode(allPairs: ReadonlyArray<RevealPair>, scrollTop: number, stage?: StageBounds): Promise<void> {
  const oracle = handBodiesOracle();
  if (allPairs.length === 0 || consoleReducedMotionActive() || oracle === undefined) {
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    handRevealState.stageClip = undefined;
    for (const p of allPairs) {
      setHandBodyMode(p.name as string, 'docked');
      const el = handBodyEl(p.name as string);
      if (el !== undefined) {
        gsap.set(el, {autoAlpha: 1});
        const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
        if (flip !== null) {
          gsap.set(flip, {rotationY: dockFaceRotation()}); // docked presentation, instantly
        }
      }
    }
    void nextTick().then(() => hooks?.setSection('board'));
    oracle?.reconcile();
    return;
  }
  building = true;
  buildingKind = 'close';
  pendingReverse = false;
  const seq = ++buildSeq;
  handRevealState.phase = 'closing';
  handRevealState.holdSlots = true; // slots hide; the bodies take over
  handRevealState.stageClip = stage;
  const els = seizeBodies(allPairs);
  // THE REVERSE HANDOFF, same flush as the hold: page bodies un-hide AT
  // their slot rects (pixel-identical to the card the slot just stopped
  // painting); every NON-active-page body SEATS at its packet-target
  // anchor, face-up. Seating is load-bearing, not cosmetic: a page the
  // player VISITED left its bodies in shelf mode at STALE slot rects with
  // their faces out — released with a bare alpha, they popped mid-screen
  // and flew home face-up («карты залетают в док лицом» when closing from
  // a later page). The pairs already carry the packet rects; the stage
  // clip erases the seated packets until their LIFO entry.
  allPairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    gsap.set(el, {
      x: p.target.left, y: p.target.top,
      scale: p.target.width / naturalWOf(el), rotation: 0, autoAlpha: 1,
    });
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: 0}); // the album holds every card face-up
    }
  });
  // The board is the backdrop of the gather from the first flight frame —
  // and the hook fires ONE TICK LATE by contract: `collapseWithHandGather`
  // starts the episode and THEN parks the stack, relying on the exit verb
  // resolving against the already-empty live stack (a no-op). Synchronous,
  // the hook popped the hosted hand frame BEFORE the park, so the parked
  // start came back without its step («the hand came back OUTSIDE the
  // workspace»). The first painted flight frame is still later than this
  // (settledPaint gates ignition), so the backdrop contract holds.
  void nextTick().then(() => hooks?.setSection('board'));

  const s = (ms: number) => motionMs(ms) / 1000;
  const spread = spreadMs(allPairs.length) * 0.6;
  const tl = gsap.timeline({paused: true});
  // LIFO of the open's left→right peel: the pack rebuilds right→left, every
  // landing extending its one growing edge — never a fan with holes.
  const targets = allPairs.map((p) => oracle.poseFor(p.name as string));
  const xs = targets.map((t) => t?.x ?? 0);
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const seqByBerth = new Array<number>(allPairs.length).fill(0);
  order.forEach((idx, k) => {
    seqByBerth[idx] = allPairs.length <= 1 ? 0 : k / (allPairs.length - 1);
  });

  allPairs.forEach((_p, i) => {
    const el = els[i];
    const to = targets[i];
    if (el === undefined || to === undefined) {
      return;
    }
    const at = s(spread) * (1 - seqByBerth[i]);
    const flight = s(CLOSE_FLIGHT_MS);
    tl.to(el, {
      x: to.x, y: to.y, scale: to.scale, rotation: to.rotation,
      duration: flight, ease: 'power2.in',
    }, at);
    // EVERY card turns to the dock's resting presentation on approach —
    // packets fly in face-up off their spreads and turn with the page
    // cards (only the visible ones used to turn; a card from a visited
    // page landed face-up in a fan of backs).
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      tl.to(flip, {rotationY: dockFaceRotation(), duration: flight * 0.55, ease: 'power2.inOut'}, at + flight * 0.38);
    }
  });

  await settledPaint();
  if (seq !== buildSeq) {
    tl.kill();
    return;
  }
  installEpisode('close', tl, els, allPairs, scrollTop, spawnBudget(allPairs.length, CLOSE_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeCloseForward());
  tl.eventCallback('onReverseComplete', () => finalizeCloseReverse());
}

function finalizeCloseForward(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.finished = true;
  handRevealState.phase = 'docked';
  handRevealState.holdSlots = false;
  handRevealState.stageClip = undefined;
  releaseBodies(ep, () => 'docked');
  teardown();
  handBodiesOracle()?.reconcile();
}

function finalizeCloseReverse(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots snap back under the page bodies
  releaseBodies(ep, (p) => p.visible ? 'shelf' : 'packet');
  teardown();
}

/* ── FILTER: re-pagination while the album stays open ───────────────── */

export type FilterSlot = {name: CardName, rect: RevealRect, visible: boolean, clip?: RevealClip};

export type HandFilterInput = {
  before: ReadonlyArray<FilterSlot>,
  /** Packet anchors for leavers/enterers (the section's packetHomeRects —
   *  the historical param name `dock` is kept). */
  dock: ReadonlyMap<string, RevealRect>,
  newNames: ReadonlyArray<CardName>,
  measureAfter: () => ReadonlyArray<FilterSlot>,
  visualFor?: (name: CardName) => RevealVisual | undefined,
};

export async function runHandFilterEpisode(input: HandFilterInput): Promise<void> {
  if (consoleReducedMotionActive() || isHandRevealEpisodeRunning()) {
    return;
  }
  const newSet = new Set<string>(input.newNames);
  const beforeByName = new Map(input.before.map((p) => [p.name as string, p]));
  const leavers = input.before.filter((p) => !newSet.has(p.name));
  const enterNames = input.newNames.filter((n) => beforeByName.get(n) === undefined);
  const moverNames = input.newNames.filter((n) => beforeByName.get(n) !== undefined);
  if (leavers.length === 0 && enterNames.length === 0) {
    return;
  }
  building = true;
  buildingKind = 'filter';
  pendingReverse = false;
  const seq = ++buildSeq;
  handRevealState.holdSlots = true;
  handRevealState.filterActive = true;
  const visualFor = input.visualFor ?? (() => undefined);
  const involved: Array<RevealPair> = [
    ...leavers.map((p) => ({name: p.name, target: p.rect, visible: p.visible, visual: visualFor(p.name)})),
    ...moverNames.map((n) => {
      const from = beforeByName.get(n);
      return {name: n, target: from === undefined ? {left: 0, top: 0, width: 1, height: 1} : from.rect, visible: true, visual: visualFor(n)};
    }),
    ...enterNames.map((n) => ({name: n, target: input.dock.get(n as string) ?? {left: 0, top: 0, width: 1, height: 1}, visible: true, visual: visualFor(n)})),
  ];
  const els = seizeBodies(involved);
  // Seat every involved body where its journey starts, in the hold's flush.
  involved.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const from = beforeByName.get(p.name as string);
    if (from !== undefined) {
      gsap.set(el, {x: from.rect.left, y: from.rect.top, scale: from.rect.width / naturalWOf(el), rotation: 0, autoAlpha: 1});
    } else {
      gsap.set(el, {autoAlpha: 1}); // an enterer starts at its packet anchor
    }
    // The whole album is FACE-UP — packets included (the spreads are laid
    // out face-up), so a filter episode never turns a card: an enterer
    // arrives showing its face from the first frame («залетали рубашкой и
    // одним кадром переворачивались» was a packet still carrying its back).
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      gsap.set(flip, {rotationY: 0});
    }
  });
  await nextTick();
  if (seq !== buildSeq) {
    return;
  }
  const after = input.measureAfter();
  const afterByName = new Map(after.map((p) => [p.name as string, p]));

  const s = (ms: number) => motionMs(ms) / 1000;
  const tl = gsap.timeline({paused: true});
  const stagger = s(spreadMs(input.before.length + enterNames.length) * 0.5);
  let cursor = 0;

  leavers.forEach((p, i) => {
    const el = els[cursor++];
    const home = input.dock.get(p.name as string);
    if (el === undefined || home === undefined) {
      return;
    }
    const at = stagger * (i / Math.max(1, leavers.length - 1)) * 0.6;
    const flight = s(FILTER_LEAVE_MS);
    // A leaver GLIDES onto its spread face-up — no turn: the packet it
    // joins is laid out face-up like every page.
    tl.to(el, {x: home.left, y: home.top, scale: home.width / naturalWOf(el), duration: flight, ease: 'power2.inOut'}, at);
  });
  moverNames.forEach((n) => {
    const el = els[cursor++];
    const to = afterByName.get(n);
    if (el === undefined || to === undefined) {
      return;
    }
    tl.to(el, {x: to.rect.left, y: to.rect.top, scale: to.rect.width / naturalWOf(el), duration: s(FILTER_MOVE_MS), ease: 'power2.inOut'}, 0);
  });
  enterNames.forEach((n, i) => {
    const el = els[cursor++];
    const slot = afterByName.get(n);
    if (el === undefined || slot === undefined) {
      return;
    }
    const at = s(80) + stagger * (i / Math.max(1, enterNames.length - 1)) * 0.6;
    const flight = s(FILTER_ENTER_MS);
    // Face-up from the first frame — the seat above already aligned the
    // flip; an enterer slides in off its spread, never turns.
    tl.to(el, {x: slot.rect.left, y: slot.rect.top, scale: slot.rect.width / naturalWOf(el), rotation: 0, duration: flight, ease: 'power2.inOut'}, at);
  });

  await settledPaint();
  if (seq !== buildSeq) {
    tl.kill();
    return;
  }
  installEpisode('filter', tl, els, involved, 0, spawnBudget(input.before.length + enterNames.length, FILTER_ENTER_MS));
  tl.eventCallback('onComplete', () => finalizeFilter(new Set(input.newNames.map((n) => n as string))));
}

function finalizeFilter(visibleNow: ReadonlySet<string>): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.finished = true;
  handRevealState.holdSlots = false;
  handRevealState.filterActive = false;
  releaseBodies(ep, (p) => visibleNow.has(p.name as string) ? 'shelf' : 'packet');
  teardown();
}

/* ── shared plumbing ────────────────────────────────────────────────── */

function installEpisode(kind: Episode['kind'], tl: gsap.core.Timeline, els: Array<HTMLElement | undefined>, pairs: ReadonlyArray<RevealPair>, scrollTop: number, budgetMs: number): void {
  const onResize = () => finishInstant();
  // PROGRESS-AWARE SAFETY: the paint-locked clock may legitimately run
  // slower than wall time — only a genuinely STOPPED playhead is snapped,
  // judged across a REAL interval (a long block drains queued checks
  // back-to-back over the same progress).
  let lastProgress = -1;
  let checks = 0;
  let lastCheckAt = performance.now();
  const safetyCheck = () => {
    const cur = episode;
    if (cur === undefined || cur.tl !== tl || cur.finished) {
      return;
    }
    const now = performance.now();
    if (now - lastCheckAt < 350) {
      cur.safety = window.setTimeout(safetyCheck, Math.max(400, budgetMs / 2));
      return;
    }
    lastCheckAt = now;
    const p = tl.progress();
    const moving = p !== lastProgress;
    lastProgress = p;
    checks++;
    if (moving && checks < 6) {
      cur.safety = window.setTimeout(safetyCheck, Math.max(400, budgetMs / 2));
      return;
    }
    console.warn(`[hand-reveal] safety snap kind=${kind} progress=${p.toFixed(2)} moving=${String(moving)}`);
    finishInstant();
  };
  const safety = window.setTimeout(safetyCheck, budgetMs);
  window.addEventListener('resize', onResize);
  const ep: Episode = {
    kind, tl, scrollTop, onResize, finished: false, safety, pairs,
    els: els.map((e) => e as HTMLElement),
  };
  episode = ep;
  console.info(`[hand-reveal] arm ${kind} n=${pairs.length} rev=${handRevealState.rev}`);
  building = false;
  buildingKind = undefined;
  if (pendingReverse) {
    pendingReverse = false;
    reverseHandReveal();
  }
  startEpisodeDriver(ep);
}

/** Snap to the CURRENT direction's end state (resize / safety / unmount). */
export function finishInstant(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  ep.tl.progress(ep.tl.reversed() ? 0 : 1, true);
  if (ep.kind === 'filter') {
    finalizeFilter(new Set(ep.pairs.filter((p) => p.visible).map((p) => p.name as string)));
    return;
  }
  if (ep.kind === 'open') {
    (ep.tl.reversed() ? finalizeOpenReverse : finalizeOpenForward)();
  } else {
    (ep.tl.reversed() ? finalizeCloseReverse : finalizeCloseForward)();
  }
}

/**
 * Flip the running episode's direction from its CURRENT progress — the
 * `B`-mid-opening / reopen-mid-closing contract.
 */
export function reverseHandReveal(): boolean {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    if (building && buildingKind !== 'filter') {
      pendingReverse = true;
      return true;
    }
    return false;
  }
  if (ep.kind === 'filter') {
    return false;
  }
  const nowReversed = !ep.tl.reversed();
  ep.tl.reversed(nowReversed);
  if (ep.kind === 'open') {
    handRevealState.phase = nowReversed ? 'closing' : 'opening';
    if (nowReversed) {
      ep.accentRelease ??= beginDockIntakeAccent('hand-open-cancel');
    } else {
      ep.accentRelease?.();
      ep.accentRelease = undefined;
    }
  } else {
    handRevealState.phase = nowReversed ? 'opening' : 'closing';
    if (nowReversed) {
      hooks?.setSection('hand');
      void nextTick().then(() => hooks?.restoreScroll(ep.scrollTop));
    } else {
      hooks?.setSection('board');
    }
  }
  return true;
}

/**
 * A non-choreographed path closed/replaced the hand (sale cancel, a task
 * surface, a game switch): reconcile the presentation state so the pack
 * never sticks in a foreign mode. Safe to call any time.
 */
export function resetHandReveal(): void {
  finishInstant();
  buildSeq++;
  building = false;
  buildingKind = undefined;
  pendingReverse = false;
  handRevealState.phase = 'docked';
  handRevealState.holdSlots = false;
  handRevealState.filterActive = false;
  handRevealState.flightVisuals = {};
  handRevealState.stageClip = undefined;
  resetHandBodies();
  handBodiesOracle()?.reconcile();
}
