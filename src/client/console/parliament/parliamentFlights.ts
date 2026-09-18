import {nextTick, reactive} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
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
 * the shell-level flight layer of the sitting director replaces THIS module's
 * renderer and nothing else — every caller speaks in specs and rects.
 */

/** A delegate cube in flight — its colour and its logical size. */
export type FlightSpec = {id: string, color: Color | 'neutral', size: number};
/** A card back on its way from the deck to a slot — sized to the slot's face (the proxy scales up into it); with a face it is the enacted card moving. */
export type CardFlightSpec = {id: string, width: number, height: number, face?: PremiumCardVM};

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
let flightSerial = 0;

export function nextFlightId(prefix: string): string {
  return `${prefix}${++flightSerial}`;
}

/** The section's `:ref` callback for every proxy it renders. */
export function setFlightEl(id: string, el: HTMLElement | null): void {
  flightEls[id] = el;
}

export function flightEl(id: string): HTMLElement | null | undefined {
  return flightEls[id];
}

/** Whether a flight is still REGISTERED (its key exists) — a dropped flight's delayed launch must not run. */
export function flightRegistered(id: string): boolean {
  return flightEls[id] !== undefined;
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
 * ONE cube from a real rect to a real rect (a results beat, the seat). The
 * proxy is born at the source's size and lands at the destination's.
 * Returns false when there is nothing measurable — the caller settles the
 * display holds itself.
 */
export function flyCube(color: Color | 'neutral', from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void): boolean {
  if (from === undefined || to === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
    onLanded();
    return false;
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
    window.setTimeout(() => {
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
    }, consoleMotionMs(delayMs));
  });
  return true;
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
  if (!flyCube(color, from, to, 0, onLanded)) {
    onLanded();
  }
}

/**
 * ONE card dealt from the deck: a back-faced proxy the size of the slot's
 * face is born over the pile's top card (scaled down to it) and grows
 * into the slot; the face beneath reveals on the touchdown and the
 * proxy leaves the next frame. Returns false when nothing is measurable —
 * the caller settles the display holds itself.
 */
export function flyCard(from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void, onLaunch?: () => void): boolean {
  if (from === undefined || to === undefined || to.width < 4 || typeof window === 'undefined' || consoleReducedMotionActive()) {
    onLanded();
    return false;
  }
  const id = nextFlightId('deal');
  pushCardFlight({id, width: Math.round(to.width), height: Math.round(to.height)});
  void nextTick(() => {
    const proxy = flightEls[id];
    if (proxy === null || proxy === undefined) {
      dropFlight(id);
      onLaunch?.();
      onLanded();
      return;
    }
    gsap.set(proxy, {autoAlpha: 0});
    window.setTimeout(() => {
      if (flightEls[id] === undefined) {
        return;
      }
      onLaunch?.();
      const handle = runCardDealFlight({
        proxy,
        from,
        to,
        durationMs: DEAL_FLIGHT_MS,
        onLanded: () => {
          onLanded();
          probeTick(() => dropFlight(id));
        },
      });
      flightHandles[id] = handle;
    }, consoleMotionMs(delayMs));
  });
  return true;
}
