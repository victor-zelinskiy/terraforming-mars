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
 * PLAN-derived rects (the grid's math is pure) and their proxies fade at
 * the viewport boundary — physically "into the scroll". The off-window
 * tail is back-only AND sampled down to `OFFSCREEN_PROXY_CAP` flyers (the
 * pack's overlap hides the difference; 30 composited tail layers don't).
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
import {
  clearRevealFlights, handRevealState, nextRevealId, revealEl, RevealVisual,
} from '@/client/console/handDock/handRevealState';

export type RevealRect = {left: number, top: number, width: number, height: number};

/** Screen-px overflow of a slot rect beyond the grid viewport — the real
 *  slot renders CLIPPED by exactly that much (the grid's overflow). */
export type RevealClip = {top: number, bottom: number};

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
 * Off-window proxies a single episode may fly. The scroll tail fades at the
 * grid boundary anyway (back-only flyers), and the dock pack's backs are
 * heavily overlapped — a handful of sampled flyers reads exactly like the
 * whole tail while a 30-proxy tail costs real compositor layers on a TV.
 * Visible cards ALWAYS fly 1:1.
 */
const OFFSCREEN_PROXY_CAP = 8;

/** Sample the off-window tail down to the cap (even stride, order kept). */
function boundedPairs(pairs: ReadonlyArray<RevealPair>): ReadonlyArray<RevealPair> {
  const off = pairs.filter((p) => !p.visible);
  if (off.length <= OFFSCREEN_PROXY_CAP) {
    return pairs;
  }
  const keep = new Set<RevealPair>();
  for (let k = 0; k < OFFSCREEN_PROXY_CAP; k++) {
    keep.add(off[Math.floor((k * off.length) / OFFSCREEN_PROXY_CAP)]);
  }
  return pairs.filter((p) => p.visible || keep.has(p));
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
  return `inset(${Math.max(0, clip.top / s)}px 0px ${Math.max(0, clip.bottom / s)}px 0px)`;
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
 */
async function spawnProxies(pairs: ReadonlyArray<RevealPair>, from: 'source' | 'target', sizeTo: 'source' | 'target'): Promise<Array<HTMLElement | undefined>> {
  const els = await spawnFlights(pairs.map((p) => ({name: p.name, face: p.visible, visual: p.visual})));
  pairs.forEach((p, i) => {
    const el = els[i];
    if (el === undefined) {
      return;
    }
    // Open starts back-side-out (from the dock); close starts face-out.
    placeProxy(el, p[from], p[sizeTo], from === 'target', from === 'target' && !p.visible ? 0 : 1);
    seatChipZoom(el, p.target.width);
    // A close episode starts AT the slot: spawn pre-clipped exactly like the
    // real (grid-clipped) slot renders — released as the card lifts away.
    if (from === 'target' && p.clip !== undefined) {
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
  window.removeEventListener('resize', ep.onResize);
  ep.tl.kill();
  const els = ep.els.filter((e): e is HTMLElement => e !== undefined);
  if (instant || els.length === 0) {
    gsap.set(els, {autoAlpha: 0});
    clearRevealFlights();
  } else {
    // The materialization: the real elements SNAPPED fully visible under
    // the proxies (the hold release happened in the caller; hand slots have
    // no opacity transition — the no-dip handoff), and the proxies fade out
    // on top of the identical image. Outside the reversible window by design.
    // The deferred clear is EPOCH-GUARDED: it only fires while this fade is
    // still the current handoff — a new episode spawned inside the window
    // kills the fade (spawnProxies) and owns the flights from then on.
    const fade = gsap.to(els, {
      autoAlpha: 0,
      duration: motionMs(HANDOFF_MS) / 1000,
      ease: 'power1.out',
      onComplete: () => {
        if (handoffFade === fade) {
          handoffFade = undefined;
          clearRevealFlights();
        }
      },
    });
    handoffFade = fade;
  }
  episode = undefined;
}

/* ── OPEN: dock pack → overlay slots ────────────────────────────────── */

/**
 * The shell has ALREADY set section='hand' (slots render held via
 * `holdSlots`) and measured both ends; this builds + plays the episode.
 */
export async function runHandOpenEpisode(allPairs: ReadonlyArray<RevealPair>): Promise<void> {
  if (allPairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.phase = 'open';
    handRevealState.holdSlots = false;
    return;
  }
  building = true;
  buildingKind = 'open';
  pendingReverse = false;
  handRevealState.phase = 'opening';
  handRevealState.holdSlots = true;
  // The off-window tail is SAMPLED down (uncovered backs vanish under the
  // pack's lift-off — the overlap hides them; see OFFSCREEN_PROXY_CAP).
  const pairs = boundedPairs(allPairs);
  // The dock backs hide via the shell's derived `dockLiftedNames` the moment
  // the flights exist — same flush as the proxies' first paint, so the pack
  // vanishes the frame its proxies stand over it, never both at once.
  const els = await spawnProxies(pairs, 'source', 'target');

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
    tl.to(el, {y: p.source.top - LIFT_PX * conUiScale(), duration: s(LIFT_MS), ease: 'power1.out'}, 0);
    // The fan-out: ONE combined tween (x/y/scale share the start, duration
    // and ease — three separate tweens per card were pure overhead) — a
    // calm, rising, opening gesture ending at the slot's real size.
    tl.to(el, {x: p.target.left, y: p.target.top, scale: scaleTo, duration: flight, ease: 'power2.inOut'}, at);
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
    } else {
      // The scroll tail: the card exits through the grid's lower boundary.
      tl.to(el, {autoAlpha: 0, duration: flight * 0.35, ease: 'power1.in'}, at + flight * 0.55);
    }
  });

  installEpisode('open', tl, els, 0, spawnBudget(pairs.length, OPEN_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeOpenForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeOpenReverse(false));
  tl.play(0);
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
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'docked'; // the pack materializes under the proxies
  handRevealState.holdSlots = false;
  hooks?.setSection('board');
  teardown(instant);
}

/* ── CLOSE: overlay slots → dock pack ───────────────────────────────── */

export async function runHandCloseEpisode(allPairs: ReadonlyArray<RevealPair>, scrollTop: number): Promise<void> {
  if (allPairs.length === 0 || consoleReducedMotionActive()) {
    handRevealState.phase = 'docked';
    handRevealState.holdSlots = false;
    hooks?.setSection('board');
    return;
  }
  building = true;
  buildingKind = 'close';
  pendingReverse = false;
  handRevealState.phase = 'closing';
  handRevealState.holdSlots = true; // same-flush: slots hide under their proxies
  const pairs = boundedPairs(allPairs);
  const els = await spawnProxies(pairs, 'target', 'source');
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
    if (!p.visible) {
      // The scroll tail re-enters through the grid's lower boundary.
      tl.to(el, {autoAlpha: 1, duration: flight * 0.3, ease: 'power1.out'}, at);
    } else if (p.clip !== undefined) {
      // Spawned pre-clipped like the real slot — the clip releases as the
      // card lifts off the boundary (the exact reverse of the landing clip).
      tl.to(el, {clipPath: 'inset(0px 0px 0px 0px)', duration: flight * 0.3, ease: 'power1.out'}, at);
    }
    tl.to(el, {x: p.source.left, y: p.source.top, scale: scaleTo, duration: flight, ease: 'power2.inOut'}, at);
    if (p.visible) {
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        // Face → back on approach: the pack turns back-side-out at the tray.
        tl.to(flip, {rotationY: 180, duration: flight * 0.55, ease: 'power2.inOut'}, at + flight * 0.38);
      }
    }
  });

  installEpisode('close', tl, els, scrollTop, spawnBudget(pairs.length, CLOSE_FLIGHT_MS));
  tl.eventCallback('onComplete', () => finalizeCloseForward(false));
  tl.eventCallback('onReverseComplete', () => finalizeCloseReverse(false));
  tl.play(0);
}

function finalizeCloseForward(instant: boolean): void {
  if (episode === undefined || episode.finished) {
    return;
  }
  episode.finished = true;
  handRevealState.phase = 'docked'; // the pack materializes under the proxies
  handRevealState.holdSlots = false;
  teardown(instant);
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
    tl.to(el, {x: home.left, y: home.top, scale: home.width / CARD_NATURAL_W, duration: flight, ease: 'power2.inOut'}, at);
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
    // A beat after the movers open room; centre-first fan (the open feel).
    const at = s(80) + stagger * enterRanks[i];
    const flight = s(FILTER_ENTER_MS);
    tl.to(el, {x: slot.rect.left, y: slot.rect.top, scale: slot.rect.width / CARD_NATURAL_W, duration: flight, ease: 'power2.inOut'}, at);
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
  tl.play(0);
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
  const safety = window.setTimeout(() => finishInstant(), budgetMs);
  window.addEventListener('resize', onResize);
  episode = {
    kind, tl, scrollTop, onResize, finished: false,
    safety,
    els: els.filter((e): e is HTMLElement => e !== undefined),
  };
  building = false;
  buildingKind = undefined;
  // A `B` landed during the build window (measures/spawn): honour it now —
  // the timeline reverses from ~0 progress, an immediate graceful cancel.
  if (pendingReverse) {
    pendingReverse = false;
    reverseHandReveal();
  }
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
  } else {
    handRevealState.phase = nowReversed ? 'opening' : 'closing';
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
  building = false;
  buildingKind = undefined;
  pendingReverse = false;
  handRevealState.phase = 'docked';
  handRevealState.holdSlots = false;
  handRevealState.dockExtraLift = [];
  handRevealState.filterActive = false;
  clearRevealFlights();
}
