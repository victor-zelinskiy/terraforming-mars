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

/** A results-scene cube's flight. */
export const RECAP_FLIGHT_MS = 480;
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
export function flyCube(color: Color | 'neutral', from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void): string | undefined {
  if (from === undefined || to === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
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
        durationMs: RECAP_FLIGHT_MS,
        onLanded: () => {
          onLanded();
          probeTick(() => dropFlight(id));
        },
      });
      flightHandles[id] = handle;
    };
    flightBeats[id] = {beat: scheduleParliamentBeat(delayMs, fire), fire};
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
}): string | undefined {
  const {from, to, face} = args;
  if (from === undefined || to === undefined || to.width < 4 || face === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
    return undefined;
  }
  const id = nextFlightId('sit-deal');
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
          probeTick(() => dropFlight(id));
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
      flightHandles[id] = handle;
    };
    flightBeats[id] = {beat: scheduleParliamentBeat(args.delayMs, fire), fire};
  });
  return id;
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
