/*
 * HAND REVEAL DIRECTOR — the physical dock ↔ hand-overlay transition
 * (the flagship "the hand OPENS" beat of the console footer).
 *
 * CONCEPT. The compact pack in the footer dock and the open hand overlay
 * are THE SAME physical cards. Opening: the pack lifts off the tray as one
 * mass, the backs flip to faces around the edge mid-flight, and the cards
 * fan out CENTRE-FIRST into the overlay's real slot positions; the overlay
 * chrome materializes around them. Closing: the spread converges back to
 * the centre axis, flips back-side-out on approach and lands exactly on
 * the dock's back positions.
 *
 * ONE CARD — ONE VISIBLE REPRESENTATION. For the whole episode the dock
 * pack (the shell's derived `dockLiftedNames` — the visible entries while
 * the overlay owns them, plus `dockExtraLift` for airborne filter-leavers)
 * and the overlay slots (`handRevealState.holdSlots` → `.con-hand--transit`)
 * are Vue-held invisible; the flying proxies are the only version of every
 * card. The OVERLAY handoff is a NO-DIP swap: the slots SNAP fully visible
 * (no opacity transition — console.less) UNDER the still-opaque proxies at
 * an IDENTICAL rect, then the proxies fade out ON TOP — the combined image
 * never dips below the settled card, so nothing blinks at the landing.
 *
 * THE STATE FLIES WITH THE CARD. Each proxy face carries the card's LANDED
 * presentation (`RevealVisual`: unplayable/select-disabled dim + the compact
 * blocker chip) — the face flips into view mid-flight already in its true
 * state, so disabled dims and «why not» chips never pop at the settle.
 * Slots that cross the grid's viewport edge hand their overflow down as
 * `clip` — the proxy CLIPS to the boundary on approach (and releases it on
 * departure), so a boundary card lands exactly as clipped as its real slot
 * (never a whole card that "sinks" under the status rail after the flight).
 * Z-ORDER: the flight stage (11645) sits UNDER the hand's own status rail —
 * `.con-main--hand` lifts the rail's 11711 into the root stacking context
 * while the hand section is open (console.less) — and UNDER the footer band,
 * so flights dive BEHIND the HUD chrome, never over its text.
 *
 * THE TAG-FILTER EPISODE (`runHandFilterEpisode`) rides the same machinery
 * while the hand stays OPEN: cards leaving the filter fly slot → dock (the
 * close language), cards entering fly dock → slot (the open language), and
 * the surviving cards GLIDE to their re-planned slots — all as proxies over
 * an all-held grid, finalized by the same holdSlots release + teardown fade.
 * Only the FILTERED entries ever lift out of the dock, so a card outside
 * the filter keeps its back physically in the tray the whole time.
 *
 * REVERSIBILITY (the hard requirement). One GSAP timeline per episode —
 * `B` mid-flight calls `reverseHandReveal()` → `tl.reversed(!reversed)`
 * from the CURRENT progress; reopening mid-close reverses the close
 * timeline the same way. No setTimeout choreography anywhere. Section
 * switching is owned here: an open episode keeps `section='hand'` mounted
 * from frame 0 (targets are measured off the real grid) and only returns
 * to 'board' when a reverse completes; a close episode returns to 'board'
 * immediately (the board is the backdrop of the gather) and re-mounts
 * 'hand' + restores the grid scroll the moment its direction flips back.
 *
 * EVERY VISIBLE card participates 1:1: backs visible in the dock fly from
 * their real rects, the thickness tail from near-stacked positions at the
 * pack's left flank; overlay slots beyond the visible window get
 * PLAN-derived rects (the grid's math is pure). A card bound for a page
 * PACKET is erased by THE STAGE WINDOW ITSELF — a static `clip-path` on
 * the whole reveal layer (`handRevealState.stageClip`, the album's
 * x-range): the proxy slides across the boundary and the browser clips it
 * by position, both directions, with zero per-frame style writes.
 *
 * IGNITION IS PAINT-GATED (the fix for the reported «карты
 * телепортируются за один кадр»). The episode's spawn flush is the
 * heaviest work this flow does — the hand section mounts/unmounts around
 * it, the board returns, 15 proxies mount — and a GSAP timeline started in
 * that same task spends its first N hundred milliseconds being eaten by
 * the stall: ticks arrive late and each advances the clock by the WHOLE
 * missed interval, so the convoy's launch (open) or the packets' re-entry
 * (close — they depart FIRST by rank) plays between two painted frames.
 * The timeline therefore arms only after the stage has actually PAINTED
 * (double-rAF with a wall-clock backstop for starved compositors); the
 * pack answering the input instantly is the dock accent's job, not the
 * flight's. And the timeline never rides GSAP's wall-clock ticker at all:
 * it stays PAUSED and the episode's OWN driver steps it (rAF + interval
 * co-driver, per-tick dt bounded — startEpisodeDriver), so a mid-flight
 * stall slides the flight later in time instead of skipping it through
 * space, and a starved compositor still advances it at real-time pace.
 *
 * Perf: transform/opacity only; one read batch before spawning; no
 * per-frame Vue writes; will-change scoped by the proxy class; safety
 * timeout + resize → instant reconcile to the current direction's end
 * state. Reduced motion: no proxies — instant state flips (the project
 * convention across all directors).
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {beginDockIntakeAccent} from '@/client/console/handDock/consoleDockAccent';
import {
  clearRevealFlights, handRevealState, nextRevealId, revealEl, RevealVisual,
} from '@/client/console/handDock/handRevealState';

export type RevealRect = {left: number, top: number, width: number, height: number};

/** Screen-px overflow of a card beyond the album viewport. Historically the
 *  scroll-grid's top/bottom boundary; the ALBUM adds the horizontal sides —
 *  a card flying to a page PACKET wipes out behind the stage edge instead of
 *  sliding visibly over the HUD beside the album. */
export type RevealClip = {top: number, bottom: number, left?: number, right?: number};

/** One hand card's two homes (overlay order — the grid's own order). */
export type RevealPair = {
  name: CardName,
  /** Where the card lives in the DOCK (real back rect / thickness slot). */
  source: RevealRect,
  /** Where the card lives in the OVERLAY (real slot rect / plan-derived). */
  target: RevealRect,
  /** The target slot is inside the grid's visible window. */
  visible: boolean,
  /** The slot crosses the grid's viewport edge: the proxy CLIPS to match on
   *  approach (open) / releases the clip on departure (close), so the landed
   *  card never "sinks" under the boundary after the flight. */
  clip?: RevealClip,
  /** The landed presentation (dim + blocker chip) — the flying face carries
   *  the TRUE state, so nothing snaps at the handoff. */
  visual?: RevealVisual,
};

export type RevealHooks = {
  /** Switch the shell section — the director owns WHEN. */
  setSection: (s: 'hand' | 'board') => void,
  /** Restore the hand grid's scroll after a mid-close reopen remount. */
  restoreScroll: (px: number) => void,
};

type Episode = {
  kind: 'open' | 'close' | 'filter',
  tl: gsap.core.Timeline,
  els: Array<HTMLElement>,
  safety: number,
  onResize: () => void,
  /** The grid scrollTop captured when the close episode began. */
  scrollTop: number,
  finished: boolean,
  /** Stops the episode's own clock (see startEpisodeDriver). */
  stopDriver?: () => void,
  /** The intake-accent lease of a CANCELLED open (released on every exit). */
  accentRelease?: () => void,
  /** Per-card GATHER landings (magnet promise + the proxy's handoff fade) —
   *  the fan materializes card by card; a reversed gather un-lands them. */
  landings?: Map<string, {p: Promise<void>, fade?: gsap.core.Tween}>,
};

let episode: Episode | undefined;
let hooks: RevealHooks | undefined;
/** The kind of the episode currently in its BUILD window (see `building`). */
let buildingKind: Episode['kind'] | undefined;
/** The teardown's deferred handoff fade (proxies over the materializing real
 *  elements). Tracked so a NEW episode starting inside the handoff window can
 *  kill it — its delayed `clearRevealFlights()` would otherwise unmount the
 *  new episode's proxies mid-flight (cards blink out, then pop into place). */
let handoffFade: gsap.core.Tween | undefined;
/** An episode is being BUILT (measures / proxy spawn — a few frames before
 *  its timeline exists). Guards the window against a racing 2nd episode. */
let building = false;
/** A reverse requested during the build window — applied at install. */
let pendingReverse = false;

export function setHandRevealHooks(h: RevealHooks): void {
  hooks = h;
}

export function isHandRevealEpisodeRunning(): boolean {
  return building || (episode !== undefined && !episode.finished);
}

/** The RUNNING episode's kind (build window included) — the shell branches
 *  its input handling on it: a `filter` episode is snapped (`finishInstant`)
 *  by any hand input, open/close keep their blocking/reverse contracts. */
export function runningHandRevealKind(): Episode['kind'] | undefined {
  if (building) {
    return buildingKind;
  }
  return episode !== undefined && !episode.finished ? episode.kind : undefined;
}

/* ── choreography constants (base ms — motionMs scales them) ──────────
   Tuned UNHURRIED: the rise starts on the input frame (responsiveness),
   but the flight itself is long enough to READ — the player must see the
   pack lift, turn and fan out, not deduce it. The lift and the flight are
   BUTT-JOINED per card (never overlapping y-tweens — two live tweens on
   one channel jitter). */
const LIFT_MS = 140; // the pack's "answers the input" rise (starts frame 1)
const OPEN_FLIGHT_MS = 600;
const CLOSE_FLIGHT_MS = 500;
const HANDOFF_MS = 200; // proxy fade over the materializing real card
const LIFT_PX = 18;
/* Filter-episode flights: brisker than the full open/close (the player is
   mid-browse and just narrowed the view — the answer must feel immediate,
   §"переключение фильтров должно оставаться отзывчивым"). */
const FILTER_MOVE_MS = 340; // surviving cards glide to their re-planned slots
const FILTER_LEAVE_MS = 420; // filtered-out cards gather back into the dock
const FILTER_ENTER_MS = 480; // newly-matching cards fan out of the dock

/** The centre-out fan window: bounded regardless of hand size. */
function spreadMs(count: number): number {
  return count <= 4 ? 150 : count <= 8 ? 200 : 240;
}

/**
 * EVERY CARD HAS A BODY — the old OFFSCREEN_PROXY_CAP (sample the off-window
 * tail down to 8) was built for the 5×2 album where the tail is a few cards
 * hidden under the pack's overlap. Under «Крупные карты» (4 per page) the
 * tail IS the hand: 11 of 15 cards got sampled/dropped, so a chunk of the
 * pack vanished in ONE FRAME at the open and popped from nowhere at the
 * close materialization (the reported «из воздуха»). A pathological bound
 * remains purely as a runaway guard — far above any real hand.
 */
const OFFSCREEN_PROXY_HARD_MAX = 60;

function boundedPairs(pairs: ReadonlyArray<RevealPair>): ReadonlyArray<RevealPair> {
  const off = pairs.filter((p) => !p.visible);
  if (off.length <= OFFSCREEN_PROXY_HARD_MAX) {
    return pairs;
  }
  const keep = new Set<RevealPair>();
  for (let k = 0; k < OFFSCREEN_PROXY_HARD_MAX; k++) {
    keep.add(off[Math.floor((k * off.length) / OFFSCREEN_PROXY_HARD_MAX)]);
  }
  return pairs.filter((p) => p.visible || keep.has(p));
}

/** The album stage's x-range — the physical boundary packet flights cross.
 *  Applied as ONE static `clip-path` on the reveal layer for the episode's
 *  lifetime (`handRevealState.stageClip`): a packet-bound proxy is erased/
 *  revealed by WHERE IT IS, both directions, magnets and reversals included
 *  — no per-frame clip writes, no stale clip after a killed tween. */
export type StageBounds = {left: number, right: number};

/**
 * PAINT-GATED IGNITION: resolve once the spawn flush has actually painted
 * (two frames), so the timeline's clock starts on a quiet stage instead of
 * inside the mount stall — where GSAP's wall-clock catch-up turns the
 * flight's whole head into one teleport frame. The wall-clock backstop
 * covers starved compositors (headless / backgrounded): waiting forever for
 * a frame that is not coming would strand the episode in its build window.
 */
const IGNITION_MAX_WAIT_MS = 240;

function settledPaint(): Promise<void> {
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

/** The build epoch — bumped by every new build AND by `resetHandReveal`, so
 *  an async build continuation (spawn flush / ignition gate) can detect that
 *  a reset/reconcile swept the state from under it and must not install a
 *  dead episode over the fresh state. */
let buildSeq = 0;

/*
 * THE EPISODE CLOCK — self-driven, stall-proof. GSAP's global ticker rides
 * rAF and wall time: on a starved compositor (headless, a backgrounded
 * window, a main thread mid-recalc-storm) ticks arrive rarely and each one
 * advances a PLAYING timeline by the whole missed stretch — the convoy
 * teleports (measured: 11 packet cards moved ~260 px between two adjacent
 * probe samples). Tightening global lagSmoothing just trades the jump for
 * a crawl that the safety timeout then snaps — the same teleport one level
 * up. So an episode's timeline stays PAUSED and this driver steps
 * `tl.time()` itself: rAF for full frame rate where frames flow, an
 * interval co-driver where they do not (the magnetToBerth discipline), and
 * every step bounded by MAX_STEP_MS — a stall slides the flight later in
 * time instead of skipping it through space. The driver lives only for the
 * episode (no standing cost while the hand is docked).
 */
const DRIVER_INTERVAL_MS = 40;
/** The per-tick clock cap. Bounds how far ONE tick may advance the flight —
 *  the fastest leg in these timelines peaks at ~4.2 px/ms, so 28 ms keeps a
 *  sparse-tick step near ~120 logical px: one honest fast frame, never a
 *  skip across the screen. (At a healthy 60 fps ticks are 16 ms and the cap
 *  never engages; under starvation the flight runs slightly slower instead
 *  — which the progress-aware safety is built to tolerate.) */
const MAX_STEP_MS = 28;

function startEpisodeDriver(ep: Episode): void {
  const tl = ep.tl;
  let last = performance.now();
  let rafId = 0;
  let iv = 0;
  let running = true;
  // FOREIGN-CLOCK AUDIT (dev diagnostic): the driver is the ONLY sanctioned
  // clock — if tl.time() ever drifts from what the driver last wrote, some
  // other ticker is playing this timeline and every bounded-step guarantee
  // is void. One warn names it instead of a silent teleport hunt.
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
    // COALESCE back-to-back ticks: the interval and a rAF routinely land
    // within a few ms of each other, and rendering both doubles the visual
    // step inside one painted frame (measured: 2 × 28 ms of peak-speed
    // motion read as one ~270 px jump on a starved run) — besides being
    // wasted work. One step per ~frame is the contract.
    if (rawDt < 12) {
      return;
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
      // time() fires the boundary callback itself when the playhead CROSSES
      // it; when it was already AT the boundary (a build-window reverse from
      // progress 0) nothing crosses — invoke explicitly. The finalizers are
      // idempotent, so a double call is harmless.
      const cb = tl.eventCallback(rev ? 'onReverseComplete' : 'onComplete') as (() => void) | null;
      cb?.();
      return;
    }
    expectedTime = next;
    // RENDER-STEP WITNESS (dev diagnostic): one driver render may move a
    // card at most one bounded step of the flow's fastest leg — ~16 px per
    // clock-ms at the close's power2.in end phase, times the UI scale
    // (4K doubles every distance). Anything past that is a broken bound.
    const witness = ep.els[ep.els.length - 1];
    const wx = witness === undefined ? 0 : Number(gsap.getProperty(witness, 'x'));
    tl.time(next, false);
    if (witness !== undefined) {
      const moved = Math.abs(Number(gsap.getProperty(witness, 'x')) - wx);
      if (moved > 16 * MAX_STEP_MS * conUiScale()) {
        console.warn(`[hand-reveal] driver render moved witness ${Math.round(moved)}px in one ${Math.round(dt * 1000)}ms step (t=${next.toFixed(3)})`);
      }
    }
  };
  const loop = () => {
    if (!running) {
      return;
    }
    step();
    rafId = window.requestAnimationFrame(loop);
  };
  iv = window.setInterval(step, DRIVER_INTERVAL_MS);
  rafId = window.requestAnimationFrame(loop);
}

/**
 * clip-path inset for a proxy in its NATURAL box: the screen-px overflow is
 * divided by the slot's scale (transforms scale the clip with the element).
 */
function clipInset(clip: RevealClip | undefined, slotW: number): string {
  if (clip === undefined) {
    return 'inset(0px 0px 0px 0px)';
  }
  const s = Math.max(0.01, slotW / CARD_NATURAL_W);
  const px = (v: number | undefined) => Math.max(0, (v ?? 0) / s);
  return `inset(${px(clip.top)}px ${px(clip.right)}px ${px(clip.bottom)}px ${px(clip.left)}px)`;
}

/** 0..1 rank of a card's distance from the centre axis (row-weighted). */
function centreRank(pairs: ReadonlyArray<RevealPair>): Array<number> {
  const cx = window.innerWidth / 2;
  const rowH = pairs.reduce((m, p) => Math.max(m, p.target.height), 1);
  const dist = pairs.map((p) => {
    const c = p.target.left + p.target.width / 2;
    const row = Math.max(0, Math.round((p.target.top - pairs[0].target.top) / rowH));
    return Math.abs(c - cx) + row * 220;
  });
  const max = Math.max(1, ...dist);
  return dist.map((d) => d / max);
}

function spawnBudget(count: number, flightMs: number): number {
  return motionMs(LIFT_MS + flightMs + spreadMs(count)) + 1500;
}

/**
 * Position one spawned proxy over `at`, sized to the MATERIALIZATION end's
 * aspect (`size`) so the handoff rect matches the real element exactly.
 * `faceOut` seats the flip chassis (false = back-side-out, rotationY 180).
 */
function placeProxy(el: HTMLElement, at: RevealRect, size: RevealRect, faceOut: boolean, alpha: number): void {
  gsap.set(el, {
    width: CARD_NATURAL_W,
    height: size.height / (size.width / CARD_NATURAL_W),
    x: at.left,
    y: at.top,
    scale: at.width / CARD_NATURAL_W,
    autoAlpha: alpha,
    transformOrigin: 'top left',
  });
  const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
  if (flip !== null) {
    gsap.set(flip, {rotationY: faceOut ? 0 : 180});
  }
}

/**
 * Replace the flight list (killing a pending handoff fade first — its
 * deferred clear would otherwise unmount the NEW proxies mid-flight) and
 * return the mounted proxy elements in flight order (missing = skipped).
 */
async function spawnFlights(flights: ReadonlyArray<{name: CardName, face: boolean, visual?: RevealVisual}>): Promise<Array<HTMLElement | undefined>> {
  // A previous episode's handoff fade may still be pending: kill it BEFORE
  // replacing the flights, so its onComplete can't clear the new proxies.
  // (kill() suppresses onComplete; the old, nearly-transparent proxies are
  // replaced by the new flight list in this same flush.)
  handoffFade?.kill();
  handoffFade = undefined;
  handRevealState.landedNames.splice(0);
  handRevealState.flights = flights.map((f) => ({id: nextRevealId(), name: f.name, face: f.face, visual: f.visual}));
  const ids = handRevealState.flights.map((f) => f.id);
  await nextTick();
  return ids.map((id) => revealEl(id));
}

/** Size the proxy's blocker CHIP to the slot's counter-zoomed chip: the slot
 *  rule is `zoom: 0.99 / handZoom`, and the slot's zoom = slotW / natural. */
function seatChipZoom(el: HTMLElement, slotW: number): void {
  el.style.setProperty('--reveal-chip-zoom', String((0.99 * CARD_NATURAL_W) / Math.max(1, slotW)));
}

/**
 * Spawn one proxy per pair, position each over `from`, size it to the
 * MATERIALIZATION end's aspect (`sizeTo`) so the handoff rect matches the
 * real element exactly. Returns elements in pair order (missing = skipped).
 *
 * `stageClipped` — the layer-wide stage window is active (album episodes):
 * an off-page proxy spawns FULLY OPAQUE at its packet anchor beyond the
 * boundary (the layer clip is what hides it there), and no per-element
 * pre-clip is seeded for it — a static local clip would keep the card
 * invisible for its whole return leg.
 */
async function spawnProxies(pairs: ReadonlyArray<RevealPair>, from: 'source' | 'target', sizeTo: 'source' | 'target', stageClipped = false): Promise<Array<HTMLElement | undefined>> {
  const els = await spawnFlights(pairs.map((p) => ({name: p.name, face: p.visible, visual: p.visual})));
  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    // Open starts back-side-out (from the dock); close starts face-out.
    // A close-side off-page proxy is transparent only on the DEGRADE path
    // (no stage window) — its legacy re-entry is an alpha fade.
    placeProxy(el, p[from], p[sizeTo], from === 'target', from === 'target' && !p.visible && !stageClipped ? 0 : 1);
    seatChipZoom(el, p.target.width);
    // A close episode starts AT the slot: spawn pre-clipped exactly like the
    // real (grid-clipped) slot renders — released as the card lifts away.
    // (Never for a packet pair under the stage window — see above.)
    if (from === 'target' && p.clip !== undefined && !(stageClipped && !p.visible)) {
      gsap.set(el, {clipPath: clipInset(p.clip, p.target.width)});
    }
  });
  return els;
}

function teardown(instant: boolean): void {
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
  const els = ep.els.filter((e): e is HTMLElement => e !== undefined);
  if (instant || els.length === 0) {
    gsap.set(els, {autoAlpha: 0});
    clearRevealFlights();
    handRevealState.stageClip = undefined;
  } else {
    // The materialization: the real elements SNAPPED fully visible under
    // the proxies (the hold release happened in the caller; hand slots have
    // no opacity transition — the no-dip handoff), and the proxies fade out
    // on top of the identical image. Outside the reversible window by design.
    // The deferred clear is EPOCH-GUARDED: it only fires while this fade is
    // still the current handoff — a new episode spawned inside the window
    // kills the fade (spawnProxies) and owns the flights from then on.
    const settle = () => {
      if (handoffFade === fade) {
        handoffFade = undefined;
        fade.kill();
        clearRevealFlights();
        // The stage window outlives the fade on purpose: packet proxies
        // parked beyond the boundary must stay erased while the on-stage
        // proxies hand off — clearing it here, with the flights gone, is
        // the first frame it cannot un-hide anything.
        handRevealState.stageClip = undefined;
      }
    };
    const fade = gsap.to(els, {
      autoAlpha: 0,
      duration: motionMs(HANDOFF_MS) / 1000,
      ease: 'power1.out',
      onComplete: settle,
    });
    handoffFade = fade;
    // HARD BACKSTOP on a WALL-CLOCK timer: GSAP ticks on rAF, and a quiet
    // headless/backgrounded compositor can stop delivering frames the moment
    // the screen goes still — which is exactly when this fade runs (the
    // episode's own driver is gone by now, so nothing else wakes it).
    // Without it the (already invisible) proxy corpses linger on the layer;
    // kept TIGHT — a long linger reads as «hidden back with no live proxy»
    // to the identity probes. Same epoch guard: a normal completion no-ops.
    window.setTimeout(settle, motionMs(HANDOFF_MS) + 300);
  }
  episode = undefined;
}

/* ── OPEN: dock pack → overlay slots ────────────────────────────────── */

/**
 * The shell has ALREADY set section='hand' (slots render held via
 * `holdSlots`) and measured both ends; this builds + plays the episode.
 */
export async function runHandOpenEpisode(allPairs: ReadonlyArray<RevealPair>, stage?: StageBounds): Promise<void> {
  if (allPairs.length === 0 || consoleReducedMotionActive()) {
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
  // The stage window arms in the SAME flush as the flights: a packet-bound
  // proxy must never paint a single frame beyond the boundary unclipped.
  handRevealState.stageClip = stage;
  const pairs = boundedPairs(allPairs);
  // The dock backs hide via the shell's derived `dockLiftedNames` the moment
  // the flights exist — same flush as the proxies' first paint, so the pack
  // vanishes the frame its proxies stand over it, never both at once.
  const els = await spawnProxies(pairs, 'source', 'target', stage !== undefined);
  if (seq !== buildSeq) {
    return; // a reset swept the state mid-build — the flights are gone
  }
  // The first frame must BE the fan: each proxy re-poses onto its berth's
  // TRUE pose (tilt included) before paint — an upright copy over a tilted
  // back straightens the whole fan in one frame at the episode's very start.
  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const pose = berthPoseFor(p.name as string, CARD_NATURAL_W, proxyNatH(el));
    if (pose !== undefined && Math.abs(pose.rotation) > 0.2) {
      gsap.set(el, pose);
    }
  });

  const s = (ms: number) => motionMs(ms) / 1000;
  const ranks = centreRank(pairs);
  const spread = spreadMs(pairs.length);
  const tl = gsap.timeline({paused: true});

  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const scaleTo = p.target.width / CARD_NATURAL_W;
    // The flight BUTT-JOINS the lift (same y channel — overlapping tweens
    // on one property fight each other and read as a jitter).
    const at = s(LIFT_MS) + s(spread) * ranks[i];
    const flight = s(OPEN_FLIGHT_MS);
    // The input-answer beat: the whole pack rises off the tray as one
    // mass — soft out, so the hold at the top blends into the launch.
    tl.to(el, {y: `-=${LIFT_PX * conUiScale()}`, duration: s(LIFT_MS), ease: 'power1.out'}, 0);
    // The fan-out: ONE combined tween (x/y/scale share the start, duration
    // and ease — three separate tweens per card were pure overhead) — a
    // calm, rising, opening gesture ending at the slot's real size. The
    // card STRAIGHTENS out of its fan tilt in the same gesture.
    // A packet-bound card needs NO code of its own here: it flies whole and
    // opaque, and the layer's static stage window erases exactly the part
    // of it that is past the boundary — the card leaves THROUGH the edge,
    // like a card slid into a sleeve, at zero per-frame cost.
    const fan: gsap.TweenVars = {x: p.target.left, y: p.target.top, scale: scaleTo, rotation: 0, duration: flight, ease: 'power2.inOut'};
    tl.to(el, fan, at);
    if (p.visible) {
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        // Back → face strictly around the edge, through the flight's heart —
        // slow enough that the turn itself is the readable event. (A faceless
        // scroll-tail proxy shows its back either way — no tween wasted.)
        tl.to(flip, {rotationY: 0, duration: flight * 0.62, ease: 'power2.inOut'}, at + flight * 0.08);
      }
      if (p.clip !== undefined) {
        // The landing CLIP: the card slides under the grid's viewport edge
        // exactly as the real (clipped) slot renders — never a whole card
        // that "sinks" behind the boundary after the handoff.
        gsap.set(el, {clipPath: 'inset(0px 0px 0px 0px)'});
        tl.to(el, {clipPath: clipInset(p.clip, p.target.width), duration: flight * 0.3, ease: 'power1.inOut'}, at + flight * 0.7);
      }
    } else if (stage === undefined) {
      // No stage bounds from the caller — the legacy time-based wipe (kept
      // only as a degrade path; every album caller threads the bounds).
      if (p.clip !== undefined) {
        gsap.set(el, {clipPath: 'inset(0px 0px 0px 0px)'});
        tl.to(el, {clipPath: clipInset(p.clip, p.target.width), duration: flight * 0.34, ease: 'power1.in'}, at + flight * 0.62);
      }
      tl.to(el, {autoAlpha: 0, duration: flight * 0.26, ease: 'power1.in'}, at + flight * 0.72);
    }
  });

  // IGNITION: the spawn flush above is the flow's heaviest patch — let it
  // PAINT before the clock starts, so the launch is never eaten by its own
  // mount stall (see the header). `building` stays true across the gate; a
  // B landing inside it is honoured by installEpisode's pendingReverse.
  await settledPaint();
  if (seq !== buildSeq) {
    tl.kill();
    return;
  }
  installEpisode('open', tl, els, 0, spawnBudget(pairs.length, OPEN_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeOpenForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeOpenReverse(false));
}

function finalizeOpenForward(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots fade in under the proxies
  teardown(instant);
}

function finalizeOpenReverse(instant: boolean): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  // A CANCELLED OPEN REWINDS TO ITS LAUNCH SNAPSHOT — and the dock has
  // routinely re-posed since (the album bay swaps the footer's composition,
  // the pack rides its own 460ms pose transitions, which the section's
  // return to 'board' RESTARTS in this very patch). The magnet conclusion
  // tracks each proxy onto its LIVE berth until the berth stops moving, and
  // only then lets the backs materialize — one discipline with the close.
  concludeGatherOntoDock(ep, instant);
}

/** Selector-safe card name (CSS.escape with a quote-only fallback). */
function cssEscape(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

/** A proxy pose that lands EXACTLY on a dock berth — rotation included. */
type BerthPose = {x: number, y: number, scale: number, rotation: number};

/**
 * THE FAN IS A POSE, NOT A RECTANGLE. A dock back carries its own tilt
 * (`rotate(--hd-tilt · --hd-fan)`), so its AABB lies: an upright proxy
 * scaled to the AABB width is larger than the real card and lands
 * straightened — the materialization then snaps it into the tilt («карта
 * вложена в веер не на свою позицию»). This reads the berth's TRUE pose:
 * θ from the back's OWN computed matrix (the pack above only translates /
 * scales, axis-aligned), the painted size from the untransformed layout
 * box times the composed scale solved out of the AABB, and the top-left
 * the proxy needs so its ROTATED body is concentric with the berth
 * (`transformOrigin: top left` — rotation swings about the corner).
 */
function berthPoseFor(name: string, proxyNatW: number, proxyNatH: number): BerthPose | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const back = document.querySelector<HTMLElement>(`[data-hand-dock-card="${cssEscape(name)}"]`);
  if (back === null) {
    return undefined;
  }
  const r = back.getBoundingClientRect();
  if (r.width < 8 || back.offsetWidth < 1) {
    return undefined;
  }
  let theta = 0;
  const tf = getComputedStyle(back).transform;
  if (tf !== 'none' && typeof DOMMatrix !== 'undefined') {
    const m = new DOMMatrix(tf);
    theta = Math.atan2(m.b, m.a);
  }
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  // Composed ancestor scale out of the AABB: aabbW = (w·cos + h·sin)·s.
  const s = r.width / (back.offsetWidth * cos + back.offsetHeight * sin);
  const paintedW = back.offsetWidth * s;
  const scale = paintedW / proxyNatW;
  const w = proxyNatW * scale;
  const h = proxyNatH * scale;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return {
    x: cx - (cosT * w / 2 - sinT * h / 2),
    y: cy - (sinT * w / 2 + cosT * h / 2),
    scale,
    rotation: theta * 180 / Math.PI,
  };
}

/** The proxy's natural box height (width is CARD_NATURAL_W, aspect = berth). */
function proxyNatH(el: HTMLElement): number {
  const h = Number.parseFloat(el.style.height);
  return Number.isFinite(h) && h > 1 ? h : CARD_NATURAL_W * 1.4375;
}

/**
 * THE MAGNET — the gather's final approach onto a berth whose pose is STILL
 * RIDING. With the intake snap gone (the snap itself was the one-frame fan
 * break) the pack's compact↔full / fan↔straight transitions run physically
 * through every intake, so a single read of the berth mid-ride lands the
 * card in a 5%-pose and the materialization snaps the rest. The magnet
 * converges exponentially onto the LIVE pose each frame and resolves only
 * once the card is ON the berth and the berth has STOPPED — so the
 * materialization always swaps two identical poses. Driven by rAF with an
 * interval co-driver (headless compositors starve rAF exactly when the
 * screen goes quiet) and wall-clock bounded: on budget it snaps to the live
 * pose and resolves.
 */
function magnetToBerth(el: HTMLElement, name: string, natH: number, budgetMs: number, alive?: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let stable = 0;
    let last: BerthPose | undefined;
    const t0 = performance.now();
    let prevT = t0;
    const finish = () => {
      if (!done) {
        done = true;
        window.clearInterval(iv);
        resolve();
      }
    };
    const step = () => {
      if (done || !el.isConnected || alive?.() === false) {
        finish();
        return;
      }
      const now = performance.now();
      const dt = Math.max(1, Math.min(64, now - prevT));
      prevT = now;
      const pose = berthPoseFor(name, CARD_NATURAL_W, natH);
      if (pose === undefined) {
        finish();
        return;
      }
      // BOUNDED APPROACH: the convergence tightens as the budget runs out
      // (τ 70 → 24 ms), but every tick's DISPLACEMENT is absolutely capped —
      // under sparse ticks «converge faster» would otherwise be exactly a
      // jump (a rare tick with k→1 moved a card 300 px into the dock in one
      // painted frame). With the cap the worst case is a brisk, continuous
      // final approach; the budget stops the clock only at 2×, by which
      // point the cap has delivered the card within a hop of its berth.
      const frac = Math.min(1, (now - t0) / budgetMs);
      const tau = frac < 0.6 ? 70 : 70 - (70 - 24) * ((frac - 0.6) / 0.4);
      const k = 1 - Math.exp(-dt / tau);
      const cx = Number(gsap.getProperty(el, 'x'));
      const cy = Number(gsap.getProperty(el, 'y'));
      const stepCap = 110 * conUiScale();
      let mx = (pose.x - cx) * k;
      let my = (pose.y - cy) * k;
      const stepLen = Math.hypot(mx, my);
      const capScale = stepLen > stepCap ? stepCap / stepLen : 1;
      mx *= capScale;
      my *= capScale;
      const kk = k * capScale; // scale/rotation ride the same bounded fraction
      const nx = cx + mx;
      const ny = cy + my;
      const ns = Number(gsap.getProperty(el, 'scale')) + (pose.scale - Number(gsap.getProperty(el, 'scale'))) * kk;
      const nr = Number(gsap.getProperty(el, 'rotation')) + (pose.rotation - Number(gsap.getProperty(el, 'rotation'))) * kk;
      gsap.set(el, {x: nx, y: ny, scale: ns, rotation: nr});
      const dist = Math.abs(pose.x - nx) + Math.abs(pose.y - ny) +
        Math.abs(pose.scale - ns) * CARD_NATURAL_W + Math.abs(pose.rotation - nr);
      const targetMoved = last !== undefined &&
        (Math.abs(pose.x - last.x) + Math.abs(pose.y - last.y) + Math.abs(pose.rotation - last.rotation)) > 0.25;
      last = pose;
      // The hard wall is deliberately FAR out (×4): with the step cap the
      // magnet is always continuous, so the wall only exists for a genuine
      // wedge — under a starved-tick run the approach may take a couple of
      // seconds, and snapping it earlier from 300 px out was itself the
      // teleport this flow forbids. The conclusion's own backstop is sized
      // above this wall.
      if (now - t0 > budgetMs * 4) {
        if (dist > 24) {
          console.warn(`[hand-reveal] magnet wall snap ${name} ${Math.round(dist)}px`);
        }
        gsap.set(el, pose);
        finish();
        return;
      }
      if (dist < 0.6 && !targetMoved) {
        stable++;
        if (stable >= 2) {
          gsap.set(el, pose);
          finish();
          return;
        }
      } else {
        stable = 0;
      }
      requestAnimationFrame(step);
    };
    // The interval CO-DRIVES the rAF loop (a quiet headless/backgrounded
    // compositor stops delivering frames exactly when the pose settles).
    // Declared after `step` on purpose: `finish` closes over it and can only
    // ever run from a callback this line has already scheduled.
    const iv = window.setInterval(step, 40);
    requestAnimationFrame(step);
  });
}

/**
 * ONE CARD'S GATHER LANDING: its magnet settles it onto the live berth,
 * the back materializes UNDER the still-standing proxy the same flush
 * (`landedNames` → the shell's lift set releases exactly this name), and
 * the proxy fades ON TOP — the no-dip handoff, per card. The fan therefore
 * ASSEMBLES piece by piece, pixel-under-proxy, instead of popping whole in
 * the teardown frame.
 */
function beginLanding(ep: Episode, el: HTMLElement, name: string, alive: () => boolean): void {
  if (ep.landings === undefined) {
    ep.landings = new Map();
  }
  if (ep.landings.has(name)) {
    return;
  }
  {
    const pose = berthPoseFor(name, CARD_NATURAL_W, proxyNatH(el));
    if (pose !== undefined) {
      const far = Math.hypot(pose.x - Number(gsap.getProperty(el, 'x')), pose.y - Number(gsap.getProperty(el, 'y')));
      if (far > 220 * conUiScale()) {
        console.warn(`[hand-reveal] magnet far start ${name} ${Math.round(far)}px`);
      }
    }
  }
  const rec: {p: Promise<void>, fade?: gsap.core.Tween} = {p: Promise.resolve()};
  rec.p = magnetToBerth(el, name, proxyNatH(el), motionMs(520), alive).then(() => {
    if (episode !== ep || !alive()) {
      return;
    }
    if (!handRevealState.landedNames.includes(name)) {
      handRevealState.landedNames.push(name);
    }
    rec.fade = gsap.to(el, {autoAlpha: 0, duration: motionMs(140) / 1000, ease: 'power1.out'});
  });
  ep.landings.set(name, rec);
}

/**
 * The shared gather CONCLUSION: disarm the episode's own safety/resize,
 * land every still-unlanded proxy onto its live berth (each back
 * materializes under its own proxy as its magnet settles), and only then
 * tear down. Used by the close's forward finish AND the cancelled open's
 * rewind — one discipline, both doors.
 */
function concludeGatherOntoDock(ep: Episode, instant: boolean): void {
  ep.finished = true;
  if (instant) {
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    hooks?.setSection('board');
    teardown(true);
    return;
  }
  clearTimeout(ep.safety);
  window.removeEventListener('resize', ep.onResize);
  hooks?.setSection('board');
  let done = false;
  const conclude = () => {
    if (done) {
      return;
    }
    done = true;
    ep.accentRelease?.();
    ep.accentRelease = undefined;
    if (episode !== ep) {
      return; // a newer episode owns the stage and the flight list
    }
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    teardown(false);
  };
  // Wall-clock backstop ABOVE the magnets' own hard wall (×4 of their
  // budget) + the handoff fade: concluding earlier fades still-airborne
  // cards mid-air, which is a vanish by another name.
  window.setTimeout(() => {
    if (!done) {
      console.warn('[hand-reveal] gather conclude backstop fired');
    }
    conclude();
  }, motionMs(520) * 4 + 900);
  void nextTick().then(() => {
    if (done || episode !== ep) {
      conclude();
      return;
    }
    const aliveHere = () => episode === ep;
    for (const el of ep.els) {
      const name = el.dataset.revealCard;
      if (name === undefined || handRevealState.landedNames.includes(name)) {
        continue;
      }
      if (Number(gsap.getProperty(el, 'opacity')) < 0.05 && ep.landings?.has(name) !== true) {
        continue; // an invisible non-landed proxy has nothing to land
      }
      if (ep.landings?.has(name) !== true) {
        gsap.killTweensOf(el); // the magnet owns the final approach alone
      }
      beginLanding(ep, el, name, aliveHere);
    }
    const all = [...(ep.landings?.values() ?? [])].map((r) => r.p);
    if (all.length === 0) {
      conclude();
      return;
    }
    // A short tail lets the LAST card's handoff fade breathe before the
    // teardown sweeps the leftovers.
    void Promise.all(all).then(() => window.setTimeout(conclude, motionMs(150)));
  });
}

/* ── CLOSE: overlay slots → dock pack ───────────────────────────────── */

export async function runHandCloseEpisode(allPairs: ReadonlyArray<RevealPair>, scrollTop: number, stage?: StageBounds): Promise<void> {
  if (allPairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    hooks?.setSection('board');
    return;
  }
  building = true;
  buildingKind = 'close';
  pendingReverse = false;
  const seq = ++buildSeq;
  handRevealState.phase = 'closing';
  handRevealState.holdSlots = true; // same-flush: slots hide under their proxies
  // Same flush as the flights: packet proxies spawn AT their anchors beyond
  // the boundary, and the stage window is what keeps that first paint clean.
  handRevealState.stageClip = stage;
  const pairs = boundedPairs(allPairs);
  const els = await spawnProxies(pairs, 'target', 'source', stage !== undefined);
  if (seq !== buildSeq) {
    return; // a reset swept the state mid-build — the flights are gone
  }
  // The board is the backdrop of the gather from the first flight frame.
  hooks?.setSection('board');

  const s = (ms: number) => motionMs(ms) / 1000;
  const ranks = centreRank(pairs);
  const spread = spreadMs(pairs.length) * 0.6; // gathering is brisker (§11)
  const tl = gsap.timeline({paused: true});

  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    const scaleTo = p.source.width / CARD_NATURAL_W;
    // Outer cards start first; the centre card caps the pack last.
    const at = s(spread) * (1 - ranks[i]);
    const flight = s(CLOSE_FLIGHT_MS);
    // PACKET PHYSICS (the return leg): the card starts parked BEYOND the
    // stage edge — erased by the layer's static stage window — and slides
    // IN through it, emerging progressively by position (never an alpha
    // fade-in / a mid-air unclip «из воздуха»). No per-card code needed.
    if (stage === undefined) {
      if (!p.visible) {
        // Degrade path (no stage bounds): the legacy fade re-entry.
        tl.to(el, {autoAlpha: 1, duration: flight * 0.3, ease: 'power1.out'}, at);
      }
      if (p.clip !== undefined) {
        // Spawned pre-clipped (a boundary slot) — the clip releases as the
        // card lifts away from it (the reverse of the landing clip).
        tl.to(el, {clipPath: 'inset(0px 0px 0px 0px)', duration: flight * 0.3, ease: 'power1.out'}, at);
      }
    } else if (p.visible && p.clip !== undefined) {
      // A boundary slot under the stage window still seeded its own local
      // pre-clip — release it as the card lifts away.
      tl.to(el, {clipPath: 'inset(0px 0px 0px 0px)', duration: flight * 0.3, ease: 'power1.out'}, at);
    }
    // THE DOCK BERTH IS PROVISIONAL — the pack's POSE is routinely still
    // settling when the gather is measured (compact → full rides the pack's
    // own 460ms transform transition, and the flip begins in the very flush
    // the episode arms). Aiming the whole flight at that snapshot landed the
    // hand in the miniature pose, and the real backs then materialized
    // full-size in one frame. So the carry flies the first ~72% toward the
    // snapshot, and the MAGNET flies the final leg onto the LIVE berth.
    tl.to(el, {
      x: p.source.left, y: p.source.top, scale: scaleTo,
      duration: flight * 0.72, ease: 'power2.in',
    }, at);
    // THE FINAL APPROACH IS THE LANDING — one mechanism, the magnet: it
    // re-reads the live back every tick (the retarget discipline), its
    // per-tick displacement is bounded (a separate corrective tween rode
    // GSAP's starved global ticker and caught up in 300-px frames), the
    // card rotates INTO its fan tilt on the way, and when it settles ON the
    // stopped berth the back materializes under it (`landedNames`) and the
    // proxy fades on top — the fan assembles card by card, in flight order.
    // Reversible until it actually lands (the reverse branch un-lands).
    tl.call(() => {
      const ep = episode;
      if (ep === undefined || ep.tl !== tl || ep.finished || tl.reversed()) {
        return;
      }
      beginLanding(ep, el, p.name as string, () => episode === ep && !tl.reversed());
    }, undefined, at + flight * 0.72);
    // The timeline's own length still covers the approach window — its
    // completion is what starts the conclusion, and the conclusion awaits
    // every landing, so the handoff can never begin under a still-
    // travelling final approach.
    tl.set({}, {}, at + flight);
    if (p.visible) {
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        // Face → back on approach: the pack turns back-side-out at the tray.
        tl.to(flip, {rotationY: 180, duration: flight * 0.55, ease: 'power2.inOut'}, at + flight * 0.38);
      }
    }
  });

  // IGNITION: the board's return patch above is exactly the stall that used
  // to eat the packets' whole re-entry (they depart FIRST by rank) — let it
  // paint before the clock starts. `building` covers the gate; a reopen (B)
  // landing inside it is honoured by installEpisode's pendingReverse.
  await settledPaint();
  if (seq !== buildSeq) {
    tl.kill();
    return;
  }
  installEpisode('close', tl, els, scrollTop, spawnBudget(pairs.length, CLOSE_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeCloseForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeCloseReverse(false));
}

function finalizeCloseForward(instant: boolean): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  // The gather's 72% corrective aimed at a pose that may STILL be riding
  // (the pack's transitions run physically through the intake now) — the
  // magnet conclusion closes the last few px against the live berth and
  // materializes only once proxy and berth agree.
  concludeGatherOntoDock(ep, instant);
}

function finalizeCloseReverse(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'open';
  handRevealState.holdSlots = false; // slots fade in under the proxies
  teardown(instant);
}

/* ── FILTER: overlay slots ⇄ dock, hand stays open ──────────────────── */

/** One slot's live geometry (real rect or plan-derived for off-window). */
export type FilterSlot = {name: CardName, rect: RevealRect, visible: boolean, clip?: RevealClip};

export type HandFilterInput = {
  /** The OLD layout, pre-change (the section's `transitionTargets`). */
  before: ReadonlyArray<FilterSlot>,
  /** Every involved card's DOCK back rect (leaver landings + enterer origins). */
  dock: ReadonlyMap<string, RevealRect>,
  /** The names visible under the NEW filter (grid order). */
  newNames: ReadonlyArray<CardName>,
  /** Measure the NEW layout — called after the patch, before first paint
   *  (the closure seats the grid scroll first, then reads the rects). */
  measureAfter: () => ReadonlyArray<FilterSlot>,
  /** The landed presentation per card (dim + blocker chip) — carried by the
   *  proxies so the settled state never pops at the materialization. */
  visualFor?: (name: CardName) => RevealVisual | undefined,
};

/**
 * The tag-filter transition while the hand is OPEN. The SHELL has already
 * applied the new filter (same tick — the state writes below ride the same
 * patch flush, so nothing flashes): leavers fly slot → dock (face flips to
 * back on approach), enterers fly dock → slot (back flips to face), the
 * surviving cards glide to their re-planned slots — all proxies over the
 * all-held grid, released by the standard holdSlots + teardown handoff.
 * NOT reversible (a filter answer is a state, not a journey) — any hand
 * input snaps it via `finishInstant` and proceeds.
 */
export async function runHandFilterEpisode(input: HandFilterInput): Promise<void> {
  if (consoleReducedMotionActive() || isHandRevealEpisodeRunning()) {
    return; // the state is already applied — nothing to choreograph
  }
  const newSet = new Set<string>(input.newNames);
  const beforeByName = new Map(input.before.map((p) => [p.name as string, p]));
  const leavers = input.before.filter((p) => !newSet.has(p.name));
  const enterNames = input.newNames.filter((n) => beforeByName.get(n) === undefined);
  const moverNames = input.newNames.filter((n) => beforeByName.get(n) !== undefined);
  if (leavers.length === 0 && enterNames.length === 0) {
    return; // same visible set — the grid geometry didn't change either
  }
  building = true;
  buildingKind = 'filter';
  pendingReverse = false;
  handRevealState.holdSlots = true; // same-flush: every slot hides under a proxy
  handRevealState.filterActive = true; // the status rail holds its text
  // Leaver backs STAY hidden while airborne (they just left the derived
  // visible-entries lift set) — released at the finalize materialization.
  handRevealState.dockExtraLift = leavers.map((p) => p.name as string);

  // One flight per involved card: leavers first, then movers, then enterers
  // (mover/enterer target visibility is only known post-measure → face on).
  const visualFor = input.visualFor ?? (() => undefined);
  const els = await spawnFlights([
    ...leavers.map((p) => ({name: p.name, face: p.visible, visual: visualFor(p.name)})),
    ...moverNames.map((n) => ({name: n, face: true, visual: visualFor(n)})),
    ...enterNames.map((n) => ({name: n, face: true, visual: visualFor(n)})),
  ]);
  const after = input.measureAfter();
  const afterByName = new Map(after.map((p) => [p.name as string, p]));

  const s = (ms: number) => motionMs(ms) / 1000;
  const tl = gsap.timeline({paused: true});
  const stagger = s(spreadMs(input.before.length + enterNames.length) * 0.5);
  let cursor = 0;

  // LEAVERS — the close language: gather into the dock, flip to back.
  const leaveRanks = centreRank(leavers.map((p) => ({target: p.rect} as RevealPair)));
  leavers.forEach((p, i) => {
    const el = els[cursor++];
    const home = input.dock.get(p.name);
    if (el === undefined || home === undefined) {
      return;
    }
    placeProxy(el, p.rect, home, true, p.visible ? 1 : 0);
    seatChipZoom(el, p.rect.width);
    const at = stagger * (1 - leaveRanks[i]); // outer first, centre caps last
    const flight = s(FILTER_LEAVE_MS);
    if (!p.visible) {
      // The scroll tail re-enters through the grid's lower boundary.
      tl.to(el, {autoAlpha: 1, duration: flight * 0.3, ease: 'power1.out'}, at);
    } else if (p.clip !== undefined) {
      // Boundary slot: spawn pre-clipped like the real slot, release on lift.
      gsap.set(el, {clipPath: clipInset(p.clip, p.rect.width)});
      tl.to(el, {clipPath: 'inset(0px 0px 0px 0px)', duration: flight * 0.3, ease: 'power1.out'}, at);
    }
    // The leaver lands the berth's TRUE pose (fan tilt included) — the
    // materialized back is then the same object at the same angle.
    const home2: BerthPose = berthPoseFor(p.name as string, CARD_NATURAL_W, proxyNatH(el)) ??
      {x: home.left, y: home.top, scale: home.width / CARD_NATURAL_W, rotation: 0};
    tl.to(el, {...home2, duration: flight, ease: 'power2.inOut'}, at);
    if (p.visible) {
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        tl.to(flip, {rotationY: 180, duration: flight * 0.55, ease: 'power2.inOut'}, at + flight * 0.38);
      }
    }
  });

  // MOVERS — the surviving cards GLIDE to their re-planned slots (no flip).
  moverNames.forEach((n) => {
    const el = els[cursor++];
    const from = beforeByName.get(n);
    const to = afterByName.get(n);
    if (el === undefined || from === undefined || to === undefined) {
      return;
    }
    if (!from.visible && !to.visible) {
      gsap.set(el, {autoAlpha: 0}); // both ends off-window — nothing to show
      return;
    }
    placeProxy(el, from.rect, to.rect, true, from.visible ? 1 : 0);
    seatChipZoom(el, to.rect.width);
    const flight = s(FILTER_MOVE_MS);
    if (!from.visible && to.visible) {
      tl.to(el, {autoAlpha: 1, duration: flight * 0.35, ease: 'power1.out'}, 0);
    }
    if (from.visible && from.clip !== undefined) {
      gsap.set(el, {clipPath: clipInset(from.clip, from.rect.width)});
      tl.to(el, {clipPath: 'inset(0px 0px 0px 0px)', duration: flight * 0.3, ease: 'power1.out'}, 0);
    }
    tl.to(el, {x: to.rect.left, y: to.rect.top, scale: to.rect.width / CARD_NATURAL_W, duration: flight, ease: 'power2.inOut'}, 0);
    if (from.visible && !to.visible) {
      // Exits through the grid's boundary — "into the scroll".
      tl.to(el, {autoAlpha: 0, duration: flight * 0.35, ease: 'power1.in'}, flight * 0.55);
    } else if (to.visible && to.clip !== undefined) {
      // Lands on the boundary: clip in on approach (matches the real slot).
      if (!(from.visible && from.clip !== undefined)) {
        gsap.set(el, {clipPath: 'inset(0px 0px 0px 0px)'});
      }
      tl.to(el, {clipPath: clipInset(to.clip, to.rect.width), duration: flight * 0.3, ease: 'power1.inOut'}, flight * 0.7);
    }
  });

  // ENTERERS — the open language: fan out of the dock, flip back → face.
  const enterSlots = enterNames
    .map((n, i) => ({el: els[cursor + i], slot: afterByName.get(n), home: input.dock.get(n)}));
  const enterRanks = centreRank(enterSlots
    .map((e) => ({target: e.slot?.rect ?? {left: 0, top: 0, width: 1, height: 1}} as RevealPair)));
  enterSlots.forEach((e, i) => {
    const {el, slot, home} = e;
    if (el === undefined || slot === undefined || home === undefined) {
      if (el !== undefined) {
        gsap.set(el, {autoAlpha: 0});
      }
      return;
    }
    placeProxy(el, home, slot.rect, false, 1);
    seatChipZoom(el, slot.rect.width);
    // The enterer's first frame IS its fan pose — it straightens in flight.
    const pose = berthPoseFor(slot.name as string, CARD_NATURAL_W, proxyNatH(el));
    if (pose !== undefined && Math.abs(pose.rotation) > 0.2) {
      gsap.set(el, pose);
    }
    // A beat after the movers open room; centre-first fan (the open feel).
    const at = s(80) + stagger * enterRanks[i];
    const flight = s(FILTER_ENTER_MS);
    tl.to(el, {x: slot.rect.left, y: slot.rect.top, scale: slot.rect.width / CARD_NATURAL_W, rotation: 0, duration: flight, ease: 'power2.inOut'}, at);
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flip !== null) {
      tl.to(flip, {rotationY: 0, duration: flight * 0.62, ease: 'power2.inOut'}, at + flight * 0.08);
    }
    if (!slot.visible) {
      // The scroll tail: exits through the grid's lower boundary.
      tl.to(el, {autoAlpha: 0, duration: flight * 0.35, ease: 'power1.in'}, at + flight * 0.55);
    } else if (slot.clip !== undefined) {
      gsap.set(el, {clipPath: 'inset(0px 0px 0px 0px)'});
      tl.to(el, {clipPath: clipInset(slot.clip, slot.rect.width), duration: flight * 0.3, ease: 'power1.inOut'}, at + flight * 0.7);
    }
  });

  installEpisode('filter', tl, els, 0, spawnBudget(input.before.length + enterNames.length, FILTER_ENTER_MS));
  tl.eventCallback('onComplete', () => finalizeFilter(false));
}

function finalizeFilter(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  // The hand stays open: slots + leaver dock backs materialize under the
  // proxies' teardown fade (phase was 'open' the whole time); the status
  // rail's text fades back in with them.
  handRevealState.holdSlots = false;
  handRevealState.dockExtraLift = [];
  handRevealState.filterActive = false;
  teardown(instant);
}

/* ── shared episode plumbing ────────────────────────────────────────── */

function installEpisode(kind: Episode['kind'], tl: gsap.core.Timeline, els: Array<HTMLElement | undefined>, scrollTop: number, budgetMs: number): void {
  const onResize = () => finishInstant();
  // PROGRESS-AWARE SAFETY. The episode clock deliberately runs SLOWER than
  // wall time under load (bounded steps — a stall must not become a jump),
  // so a fixed wall-clock timeout would snap a perfectly healthy, merely
  // slowed flight to its end state — the exact mass-vanish this rework
  // removes, re-introduced by its own watchdog. The safety therefore only
  // kills an episode whose playhead has genuinely STOPPED; a moving one is
  // re-checked, with a hard cap (~3.5× budget) as the absolute backstop.
  let lastProgress = -1;
  let checks = 0;
  const safetyCheck = () => {
    const cur = episode;
    if (cur === undefined || cur.tl !== tl || cur.finished) {
      return;
    }
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
    kind, tl, scrollTop, onResize, finished: false,
    safety,
    els: els.filter((e): e is HTMLElement => e !== undefined),
  };
  episode = ep;
  building = false;
  buildingKind = undefined;
  // A `B` landed during the build window (measures/spawn/ignition): honour it
  // now — the timeline reverses from progress 0, an immediate graceful cancel.
  if (pendingReverse) {
    pendingReverse = false;
    reverseHandReveal();
  }
  // The timeline stays PAUSED for its whole life — the episode's own clock
  // (rAF + interval co-driver, bounded step) is what advances it.
  startEpisodeDriver(ep);
}

/** Snap to the CURRENT direction's end state (resize / safety / unmount). */
export function finishInstant(): void {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    return;
  }
  if (ep.kind === 'filter') {
    finalizeFilter(true);
    return;
  }
  const toStart = ep.tl.reversed();
  if (ep.kind === 'open') {
    (toStart ? finalizeOpenReverse : finalizeOpenForward)(true);
  } else {
    (toStart ? finalizeCloseReverse : finalizeCloseForward)(true);
  }
}

/**
 * Flip the running episode's direction from its CURRENT progress — the
 * `B`-mid-opening / reopen-mid-closing contract. Returns false when no
 * episode is running (the caller falls through to its normal handling).
 */
export function reverseHandReveal(): boolean {
  const ep = episode;
  if (ep === undefined || ep.finished) {
    if (building && buildingKind !== 'filter') {
      pendingReverse = true; // applied the moment the timeline installs
      return true;
    }
    return false;
  }
  if (ep.kind === 'filter') {
    return false; // a filter answer is a state, not a journey — never reversed
  }
  const nowReversed = !ep.tl.reversed();
  ep.tl.reversed(nowReversed);
  if (ep.kind === 'open') {
    handRevealState.phase = nowReversed ? 'closing' : 'opening';
    // The cancel is an INTAKE (cards physically return to the dock): the
    // accent freezes the pack's pose transitions for the gather, so the
    // final-approach glide in finalizeOpenReverse lands on a still target.
    if (nowReversed) {
      ep.accentRelease ??= beginDockIntakeAccent('hand-open-cancel');
    } else {
      ep.accentRelease?.();
      ep.accentRelease = undefined;
    }
  } else {
    handRevealState.phase = nowReversed ? 'opening' : 'closing';
    if (nowReversed) {
      // UN-LAND: cards that already gathered stand ON their berths with the
      // back visible and the proxy faded — reversing swaps the two back at
      // the SAME pose (pixel-identical), kills their handoff fades, and
      // resets the ledger so a resumed gather re-lands them cleanly.
      for (const rec of ep.landings?.values() ?? []) {
        rec.fade?.kill();
      }
      ep.landings = undefined;
      for (const el of ep.els) {
        if (el.dataset.revealCard !== undefined) {
          gsap.set(el, {autoAlpha: 1});
        }
      }
      handRevealState.landedNames.splice(0);
    }
    // A close gather flips back toward the OPEN hand: the overlay must be
    // there to land in — remount it held + restore the exact scroll the
    // targets were measured at.
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
 * surface, a game switch): reconcile the presentation state so the dock
 * never sticks empty. Safe to call any time.
 */
export function resetHandReveal(): void {
  finishInstant();
  buildSeq++; // a mid-build continuation must not install over this reset
  building = false;
  buildingKind = undefined;
  pendingReverse = false;
  handRevealState.phase = 'docked';
  handRevealState.holdSlots = false;
  handRevealState.dockExtraLift = [];
  handRevealState.filterActive = false;
  handRevealState.landedNames.splice(0);
  handRevealState.stageClip = undefined;
  clearRevealFlights();
}
