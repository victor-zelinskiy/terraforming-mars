import {nextTick, reactive} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {addCard3DTurn, FACE_DOWN_DEG, FACE_UP_DEG, readCard3DInner, setCard3DFace} from '@/client/console/cardFlight/card3dInner';
import {DEAL_TURN_GLINT} from '@/client/console/cardDeal/premiumTurn';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {CubeFlightHandle, Rect, runCardDealFlight, runDelegateCubeFlight} from './consoleParliamentVoteMotion';
import {RIBBON_CUBE} from './parliamentVoteView';

/** An element's rect as a plain `Rect`, or undefined when it is not laid out. */
export function rectOf(el: Element | null | undefined): Rect | undefined {
  const r = el?.getBoundingClientRect();
  return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
}

/**
 * A cube-sized rect ON a place of the delegates zone: the top cube of a
 * stack when one stands there, else the place's centre at the zone's cube
 * size — so a landing proxy is always the size of the cube that will
 * materialize under it, never the size of the socket around it.
 */
export function placeCubeRect(root: HTMLElement, selector: string): Rect | undefined {
  const place = root.querySelector<HTMLElement>(selector);
  if (place === null) {
    return undefined;
  }
  const cube = place.querySelector<HTMLElement>('.con-parl__stack-cube:last-child .player-cube') ?? place.querySelector<HTMLElement>('.player-cube');
  const r = (cube ?? place).getBoundingClientRect();
  if (r.width < 2) {
    return undefined;
  }
  if (cube !== null) {
    return {left: r.left, top: r.top, width: r.width, height: r.height};
  }
  const size = conLogicalPx(RIBBON_CUBE);
  return {left: r.left + r.width / 2 - size / 2, top: r.top + r.height / 2 - size / 2, width: size, height: size};
}

/*
 * THE PARLIAMENT'S FLIGHTS — the specifications of every proxy the workspace
 * flies (a delegate cube from a real place to a real place; a resolution's
 * back from the deck's top card into its slot; the enacted card's face from
 * its voting slot into the government) and the ONE place that owns their
 * lifecycle: birth (a spec pushed to the reactive list the section renders),
 * the proxy element (registered by the section's `:ref`), the running handle,
 * and the drop a frame after the touchdown.
 *
 * Today the section renders the proxies in its own body-level `<Teleport>`;
 * the shell-level flight layer of the sitting director (Э4) replaces THIS
 * module's renderer and nothing else — every caller speaks in specs and rects.
 * Staggers are parliament BEATS on the motion clock (`parliamentBeat.ts`),
 * never wall-clock timers.
 */

/** A delegate cube in flight — its colour and its logical size. */
export type FlightSpec = {id: string, color: Color | 'neutral', size: number};
/**
 * A card on its way — sized to the face it stands in for (the proxy scales
 * into it). With a `face` it is a PHYSICAL card body (the Card3DInner
 * chassis: the premium face, the back, the edge — the shell's flight layer
 * renders it), born face-up (`faceUp`, the enacted card moving, a parked
 * card) or face-down (a resolution being DEALT — it turns in flight); without
 * one it is a bare back.
 */
export type CardFlightSpec = {id: string, width: number, height: number, face?: PremiumCardVM, faceUp?: boolean};

/** A delegate cube's flight (the enactment's returns home, the seat pick's delegate to the chair). */
export const CUBE_FLIGHT_MS = 480;
/** One dealt card's flight (the deck's top → its slot). */
export const DEAL_FLIGHT_MS = 560;
export const DEAL_STAGGER_MS = 150;
/** The enacted card's move from its voting slot to the government. */
export const ENACT_MOVE_MS = 620;
/** The delegate's flight from its bench place to the card. */
export const VOTE_FLIGHT_MS = 540;

export const parliamentFlights = reactive({
  flights: [] as Array<FlightSpec>,
  cardFlights: [] as Array<CardFlightSpec>,
});

/** The proxy elements and the running handles, by flight id (DOM handles — never reactive). */
let flightEls: Record<string, HTMLElement | null> = {};
let flightHandles: Record<string, CubeFlightHandle> = {};
/** A flight's STAGGER beat (between its birth and its launch) — killed with the flight; «дожать» fires it at once. */
let flightBeats: Record<string, {beat: ParliamentBeat, fire: () => void}> = {};
let flightSerial = 0;
/**
 * «ДОЖАТЬ» IS ARMED: every flight born from now on launches at once and is
 * driven straight to its touchdown. The director's hurry fires the flights
 * that already exist (`finishParliamentFlights`); a flight born AFTER that
 * press — the second phrase of a chained flight, a launch that waited for a
 * tick — would otherwise play at full length after the player asked for the
 * poses. Cleared when a stage starts playing and when the motion is killed.
 */
let hurried = false;

export function setParliamentFlightsHurried(on: boolean): void {
  hurried = on;
}

/** Register a flight's launch beat — or fire it now under «дожать». */
function scheduleLaunch(id: string, delayMs: number, fire: () => void): void {
  if (hurried) {
    fire();
    return;
  }
  flightBeats[id] = {beat: scheduleParliamentBeat(delayMs, fire), fire};
}

/** Register a running handle — and drive it to rest at once under «дожать». */
function runHandle(id: string, handle: CubeFlightHandle): void {
  flightHandles[id] = handle;
  if (hurried) {
    handle.tween.progress(1);
  }
}

export function nextFlightId(prefix: string): string {
  return `${prefix}${++flightSerial}`;
}

/**
 * The layer's `:ref` callback for every proxy it renders. Vue calls it with
 * `null` on the element's UNMOUNT — after `dropFlight` removed the spec — and
 * re-registering the id as `null` kept a dropped flight «registered» forever:
 * the director's wait for its last touchdown never ended (measured: the
 * enactment's hold standing until its ceiling). An unmounted proxy is gone.
 */
export function setFlightEl(id: string, el: HTMLElement | null): void {
  if (el === null) {
    delete flightEls[id];
  } else {
    flightEls[id] = el;
  }
}

export function flightEl(id: string): HTMLElement | null | undefined {
  return flightEls[id];
}

/** Whether a flight is still REGISTERED (its key exists) — a dropped flight's delayed launch must not run. */
export function flightRegistered(id: string): boolean {
  return flightEls[id] !== undefined && flightEls[id] !== null;
}

export function registerFlightHandle(id: string, handle: CubeFlightHandle): void {
  flightHandles[id] = handle;
}

export function pushCubeFlight(spec: FlightSpec): void {
  parliamentFlights.flights.push(spec);
}

export function pushCardFlight(spec: CardFlightSpec): void {
  parliamentFlights.cardFlights.push(spec);
}

export function dropFlight(id: string): void {
  flightBeats[id]?.beat.kill();
  delete flightBeats[id];
  flightHandles[id]?.kill();
  delete flightHandles[id];
  delete flightEls[id];
  parliamentFlights.flights = parliamentFlights.flights.filter((f) => f.id !== id);
  parliamentFlights.cardFlights = parliamentFlights.cardFlights.filter((f) => f.id !== id);
}

/** Drop every flight whose id starts with `prefix` (the vote's landing clears its own delegate flights). */
export function dropFlightsWithPrefix(prefix: string): void {
  for (const id of Object.keys(flightHandles)) {
    if (id.startsWith(prefix)) {
      dropFlight(id);
    }
  }
}

export function killParliamentFlights(): void {
  hurried = false;
  for (const id of Object.keys(flightBeats)) {
    flightBeats[id].beat.kill();
  }
  flightBeats = {};
  for (const id of Object.keys(flightHandles)) {
    flightHandles[id]?.kill();
  }
  flightHandles = {};
  flightEls = {};
  parliamentFlights.flights = [];
  parliamentFlights.cardFlights = [];
}

/** Whether any proxy is on screen (the section's `--flying` class). */
export function parliamentFlightsAirborne(): boolean {
  return parliamentFlights.flights.length > 0 || parliamentFlights.cardFlights.length > 0;
}

/**
 * ONE cube from a real rect to a real rect (a sitting beat, the seat). The
 * proxy is born at the source's size and lands at the destination's.
 * Returns the flight's id — undefined when there is nothing measurable (the
 * caller settles the display holds itself). The id is known at BIRTH: the
 * element registers on the next render, so a caller that tracks the flight
 * (the director's «дожать») must not wait for the element to exist.
 */
export function flyCube(color: Color | 'neutral', from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void,
  opts: {/** The proxy stands over the source (the real cube may hide now — the frame it LEAVES its place). */ onLifted?: () => void} = {}): string | undefined {
  if (from === undefined || to === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
    opts.onLifted?.();
    onLanded();
    return undefined;
  }
  const id = nextFlightId('f');
  const size = Math.max(8, Math.round(Math.min(from.width, from.height)));
  pushCubeFlight({id, color, size});
  void nextTick(() => {
    const proxy = flightEls[id];
    if (proxy === null || proxy === undefined) {
      dropFlight(id);
      opts.onLifted?.();
      onLanded();
      return;
    }
    gsap.set(proxy, {autoAlpha: 0});
    // The STAGGER is a beat on the motion clock; dropping the flight kills it.
    const fire = () => {
      delete flightBeats[id];
      if (flightEls[id] === undefined) {
        return;
      }
      const handle = runDelegateCubeFlight({
        proxy,
        from,
        to,
        durationMs: CUBE_FLIGHT_MS,
        onLifted: opts.onLifted,
        onLanded: () => {
          onLanded();
          probeTick(() => dropFlight(id));
        },
      });
      runHandle(id, handle);
    };
    scheduleLaunch(id, delayMs, fire);
  });
  return id;
}

/** The chairman's delegate leaves the card it was taken from and settles on the seat mark of the ledger (`onLanded` pulses the chair). */
export function flySeatDelegate(root: HTMLElement | undefined, color: Color | undefined, from: Rect | undefined, onLanded: () => void): void {
  if (root === undefined || color === undefined || from === undefined) {
    onLanded();
    return;
  }
  const chair = root.querySelector<HTMLElement>(`[data-parl-seat-chair="${color}"]`);
  const r = chair?.getBoundingClientRect();
  const to = r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.height, height: r.height};
  if (flyCube(color, from, to, 0, onLanded) === undefined) {
    onLanded();
  }
}

/**
 * ONE RESOLUTION DEALT WITH A REAL TURN: a physical card body (its own
 * premium face — the same lightweight vm the slot draws, the deck's back, an
 * edge) is born FACE-DOWN scaled onto the pile's top card, flies to its slot
 * and TURNS on the way (`addCard3DTurn` — the face is readable only past
 * 90°, a one-shot glint as it comes round); the slot's own face shows on the
 * touchdown and the proxy leaves on the next frame. Returns the flight's id,
 * or undefined when nothing is measurable (the caller settles the holds).
 */
export function dealResolutionCard(args: {
  from: Rect | undefined, to: Rect | undefined, delayMs: number, durationMs?: number,
  face: PremiumCardVM | undefined, onLaunch?: () => void, onLanded: () => void, onSideCrossed?: () => void,
  /** The proxy STAYS after the touchdown (a chained phrase takes it from there — a revealed card that is refused); the caller drops it. */
  keep?: boolean, /** The id's prefix (`sit-deal` for a deal; a reveal that will be refused names itself). */ prefix?: string,
}): string | undefined {
  const {from, to, face} = args;
  if (from === undefined || to === undefined || to.width < 4 || face === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
    return undefined;
  }
  const id = nextFlightId(args.prefix ?? 'sit-deal');
  pushCardFlight({id, width: Math.round(to.width), height: Math.round(to.height), face, faceUp: false});
  const durationMs = args.durationMs ?? DEAL_FLIGHT_MS;
  void nextTick(() => {
    const proxy = flightEls[id];
    if (proxy === null || proxy === undefined) {
      dropFlight(id);
      args.onLaunch?.();
      args.onLanded();
      return;
    }
    gsap.set(proxy, {autoAlpha: 0});
    const card = readCard3DInner(proxy);
    if (card !== undefined) {
      setCard3DFace(card, false);
    }
    const fire = () => {
      delete flightBeats[id];
      if (flightEls[id] === undefined) {
        return;
      }
      args.onLaunch?.();
      const handle = runCardDealFlight({
        proxy,
        from,
        to,
        durationMs,
        onLanded: () => {
          args.onLanded();
          if (args.keep !== true) {
            probeTick(() => dropFlight(id));
          }
        },
      });
      if (card !== undefined) {
        // THE TURN, layered onto the flight's own timeline: one gesture.
        const dur = consoleMotionMs(durationMs) / 1000;
        addCard3DTurn(handle.tween, {
          card, at: dur * 0.24, dur: dur * 0.62, to: FACE_UP_DEG, from: FACE_DOWN_DEG,
          reduced: false, glintClass: DEAL_TURN_GLINT, onSideCrossed: args.onSideCrossed,
        });
      }
      runHandle(id, handle);
    };
    scheduleLaunch(id, args.delayMs, fire);
  });
  return id;
}

/** A card leaving the table: the turn face-DOWN before the carry, and the carry itself (base ms). */
export const LEAVE_TURN_MS = 340;
/** …the carry starts this far into the turn: the card is past its edge when it begins to travel. */
export const LEAVE_TURN_LEAD_MS = 190;
export const LEAVE_CARRY_MS = 460;
/** The pile's own gesture when the discard turns over into a new deck (base ms, the whole phrase). */
export const RESHUFFLE_MS = 760;

/**
 * A CARD LEAVES THE TABLE — a face-up proxy already standing over its card
 * (`parkFace`'s) is TURNED OVER where it lies (the physical turn: pitch and
 * push toward the viewer, the edge lit as it passes through its plane — the
 * same body, the same law: never opacity on the inner, never an overshoot on
 * the turn) and, past its edge, CARRIED off along a low arc onto the discard
 * pile, shrinking into the pile's top card. The touchdown is the event: the
 * proxy leaves on the next frame and the pile is one card thicker. No fade —
 * a card that is put away lands somewhere. `onLift` fires the frame the card
 * starts to turn (the slot under it may read as empty from here). False when
 * nothing is measurable: the caller settles its holds and says so.
 */
export function flyCardOffTable(args: {
  id: string, to: Rect | undefined, delayMs: number, onLift?: () => void, onLanded: () => void,
}): boolean {
  const {id, to} = args;
  const proxy = flightEls[id];
  const card = readCard3DInner(proxy);
  if (proxy === null || proxy === undefined || to === undefined || card === undefined || consoleReducedMotionActive()) {
    dropFlight(id);
    args.onLift?.();
    args.onLanded();
    return false;
  }
  const r = proxy.getBoundingClientRect();
  const from: Rect = {left: r.left, top: r.top, width: r.width, height: r.height};
  const fire = () => {
    delete flightBeats[id];
    if (flightEls[id] === undefined) {
      return;
    }
    args.onLift?.();
    const handle = runCardDealFlight({
      proxy, from, to, durationMs: LEAVE_CARRY_MS, leadInS: consoleMotionMs(LEAVE_TURN_LEAD_MS) / 1000,
      onLanded: () => {
        args.onLanded();
        probeTick(() => dropFlight(id));
      },
    });
    addCard3DTurn(handle.tween, {card, at: 0, dur: consoleMotionMs(LEAVE_TURN_MS) / 1000, to: FACE_DOWN_DEG, from: FACE_UP_DEG, reduced: false});
    runHandle(id, handle);
  };
  scheduleLaunch(id, args.delayMs, fire);
  return true;
}

/**
 * THE DISCARD TURNS OVER INTO A NEW DECK — the rule's own visible event: the
 * pile's top cards (up to three backs, the count the pile shows) LIFT off
 * the discard together, FAN a little and gather (the squaring of a pile
 * about to be shuffled — one gesture, never a riffle), and SLIDE as one
 * stack onto the deck's place, where they land: the deck reads its new count
 * and the discard its remainder on that touchdown. Returns the flights'
 * ids (empty when nothing is measurable — the caller settles and says so).
 */
export function runReshuffle(args: {from: Rect | undefined, to: Rect | undefined, cards: number, delayMs: number, onLanded: () => void}): Array<string> {
  const {from, to} = args;
  if (from === undefined || to === undefined || args.cards <= 0 || typeof window === 'undefined' || consoleReducedMotionActive()) {
    args.onLanded();
    return [];
  }
  const n = Math.min(3, args.cards);
  const ids: Array<string> = [];
  for (let i = 0; i < n; i++) {
    const id = nextFlightId('sit-shuffle');
    pushCardFlight({id, width: Math.round(from.width), height: Math.round(from.height)});
    ids.push(id);
  }
  void nextTick(() => {
    const proxies = ids.map((id) => flightEls[id]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    if (proxies.length !== ids.length) {
      ids.forEach(dropFlight);
      args.onLanded();
      return;
    }
    const ui = conLogicalPx(1);
    // Born on the pile, the top card last (the pile's own order), invisible until the launch.
    proxies.forEach((proxy, i) => {
      gsap.set(proxy, {x: from.left + i * 0.9 * ui, y: from.top - i * 0.9 * ui, rotation: 0, scale: 1, transformOrigin: '50% 50%', autoAlpha: 0});
    });
    const s = (ms: number) => consoleMotionMs(ms) / 1000;
    const key = ids[0];
    const fire = () => {
      delete flightBeats[key];
      if (flightEls[key] === undefined) {
        return;
      }
      const tl = gsap.timeline();
      tl.set(proxies, {autoAlpha: 1}, 0);
      // LIFT and FAN: the stack comes off the pile and spreads by a hand's width…
      proxies.forEach((proxy, i) => {
        const spread = (i - (n - 1) / 2);
        tl.to(proxy, {y: `-=${9 * ui}`, x: `+=${spread * 7 * ui}`, rotation: spread * 9, duration: s(RESHUFFLE_MS * 0.28), ease: 'power2.out'}, 0);
        // …and GATHERS square again (the shuffle's own squaring), then the whole stack SLIDES to the deck's place.
        tl.to(proxy, {x: from.left + i * 0.9 * ui, rotation: 0, duration: s(RESHUFFLE_MS * 0.22), ease: 'power2.inOut'}, s(RESHUFFLE_MS * 0.3));
        tl.to(proxy, {x: to.left + to.width / 2 - from.width / 2 + i * 0.9 * ui, y: to.top + to.height / 2 - from.height / 2 - i * 0.9 * ui, duration: s(RESHUFFLE_MS * 0.42), ease: 'power2.inOut'}, s(RESHUFFLE_MS * 0.56));
      });
      let landed = false;
      const land = () => {
        if (landed) {
          return;
        }
        landed = true;
        args.onLanded();
        probeTick(() => ids.forEach(dropFlight));
      };
      tl.eventCallback('onComplete', land);
      const handle: CubeFlightHandle = {tween: tl, kill: () => {
        tl.kill();
        gsap.set(proxies, {autoAlpha: 0});
      }};
      // ONE handle for the stack (the first id carries it; the rest are dropped with it).
      runHandle(key, handle);
    };
    scheduleLaunch(key, args.delayMs, fire);
  });
  return ids;
}

/**
 * «ДОЖАТЬ»: every flight still waiting for its stagger launches NOW, and
 * every flight in the air is driven to its touchdown — the landing callbacks
 * fire in order, the proxies leave on the next frame. The director's A-during-
 * a-beat; never a skipped touchdown, never a proxy left in the air.
 */
export function finishParliamentFlights(): void {
  for (const id of Object.keys(flightBeats)) {
    const pending = flightBeats[id];
    pending.beat.kill();
    delete flightBeats[id];
    pending.fire();
  }
  for (const id of Object.keys(flightHandles)) {
    flightHandles[id]?.tween.progress(1);
  }
}
