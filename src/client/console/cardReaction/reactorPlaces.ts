/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A CARD THAT STANDS ON SCREEN REACTS IN ITS PLACE — never a second instance
 * («СРАБАТЫВАНИЕ КАРТЫ», iteration 3; the owner's field report of 2026-10-27:
 * TR18 Martian Fiber's «+1 data here» woke its OWN «data added: +1 M€» while
 * the card stood as the composer's hero, and the framework rose a COPY of it
 * beside the rail — two instances of one physical card). The law of physical
 * causality: ONE object per card on screen; a reaction LIFTS the face the
 * player already sees and births its tokens on THAT face's effect row.
 *
 * Two ways a place is known:
 *  1. A REGISTERED place — a host whose stage brings a card forward in its own
 *     choreography (the receiving stage's `emergeTarget`, the start seat):
 *     `registerReactorPlace` while the host is mounted.
 *  2. The DOM — any VISIBLE face that carries the card's identity on the
 *     product's own hooks: `data-reaction-home` (the action composer's hero),
 *     `data-composer-card` (a target miniature in the composer), `data-played-key`
 *     (the played table's stacks, the start dock, the city payout plate, the
 *     patent sale's answerers…), judged by the ONE visibility verdict every
 *     flight end uses (`transferEndVerdict` — a covered, hidden or receded face
 *     is no place), lifted in place by the generic lift (transform only).
 *
 * The layer's own faces never count (a reactor is not its own place), and a
 * sliver (a strip in a cascade — its title band) is not a face.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {firstVisibleEnd, transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';

/** A reactor's WAY ONTO THE SCREEN: out of its own place in a host's stage, or at the stage of the reaction layer. */
export type ReactorEmergence = {
  /** The host's stage holds this card and can bring it forward out of its place. */
  standsIn: (card: CardName) => boolean;
  emergeTarget: (card: CardName) => Promise<void>;
  settleTarget: (card: CardName) => Promise<void>;
  /** The emerged face's element (the tokens are born on its effect row) — `undefined` degrades the group's births. */
  emergedFaceEl: (card: CardName) => HTMLElement | undefined;
};

export type ReactorPlace = ReactorEmergence & {id: string};

const places: Array<ReactorPlace> = [];

/** A host declares that it holds cards a reaction may lift in place. Returns the unregister. */
export function registerReactorPlace(place: ReactorPlace): () => void {
  places.push(place);
  return () => {
    const at = places.indexOf(place);
    if (at >= 0) {
      places.splice(at, 1);
    }
  };
}

/** The selectors a painted face of `card` answers to, most specific first. */
export function reactorHomeSelectors(card: CardName): Array<string> {
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(card) : card.replace(/"/g, '\\"');
  return [`[data-reaction-home="${esc}"]`, `[data-composer-card="${esc}"]`, `[data-played-key="${esc}"]`];
}

/** A face shorter than this (natural px × the UI scale) is a sliver, not a place — a cascade's title band. */
const MIN_PLACE_H = 72;

/** The lift of a face in place and its settle — transform only, a short phrase (the receiving stage's own numbers). */
export const PLACE_LIFT_MS = 220;
export const PLACE_SETTLE_MS = 200;
const PLACE_LIFT_SCALE = 1.05;
const PLACE_LIFT_SHARE = 0.03;

function liftTargetOf(el: HTMLElement): HTMLElement {
  // The face's body when the hook stands on a wrapper (the composer's hero slot) — a wrapper may be a layout anchor.
  return el.querySelector<HTMLElement>('[data-reaction-lift]') ?? el;
}

export function liftInPlace(el: HTMLElement): Promise<void> {
  const target = liftTargetOf(el);
  const h = target.getBoundingClientRect().height;
  gsap.killTweensOf(target);
  target.setAttribute('data-reaction-lifted', '1');
  return new Promise<void>((resolve) => {
    gsap.to(target, {
      scale: PLACE_LIFT_SCALE, y: -Math.round(h * PLACE_LIFT_SHARE),
      duration: motionMs(PLACE_LIFT_MS) / 1000, ease: 'power2.out', overwrite: 'auto', onComplete: resolve, onInterrupt: resolve,
    });
  });
}

export function settleInPlace(el: HTMLElement): Promise<void> {
  const target = liftTargetOf(el);
  gsap.killTweensOf(target);
  return new Promise<void>((resolve) => {
    gsap.to(target, {
      scale: 1, y: 0, duration: motionMs(PLACE_SETTLE_MS) / 1000, ease: 'power2.inOut', overwrite: 'auto', clearProps: 'transform',
      onComplete: () => {
        target.removeAttribute('data-reaction-lifted');
        resolve();
      },
      onInterrupt: () => {
        target.removeAttribute('data-reaction-lifted');
        resolve();
      },
    });
  });
}

/** The VISIBLE painted face of `card` on the product's own hooks — never the reaction layer's, never a sliver. */
export function visibleReactorHome(card: CardName): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const selector of reactorHomeSelectors(card)) {
    const el = firstVisibleEnd(selector);
    if (!(el instanceof HTMLElement) || el.closest('.con-reaction') !== null) {
      continue;
    }
    if (el.getBoundingClientRect().height < MIN_PLACE_H * conUiScale()) {
      continue;
    }
    return el;
  }
  return undefined;
}

/** A place built on a painted face: lift it, birth on it, settle it. */
export function domReactorPlace(card: CardName): ReactorEmergence | undefined {
  const el = visibleReactorHome(card);
  if (el === undefined) {
    return undefined;
  }
  return {
    standsIn: (c) => c === card,
    emergeTarget: () => liftInPlace(el),
    settleTarget: () => settleInPlace(el),
    emergedFaceEl: () => (el.isConnected ? el : undefined),
  };
}

/**
 * `card`'s face is being DEALT IN right now — mounted on one of the product's hooks but still under the deal's hold
 * (`.con-deal-hold`: the start seat a corporation lands in while the same response opens the solo colony step —
 * PL-1098). Its place is a beat away: the chain waits for it instead of raising a second instance at the stage.
 */
export function reactorPlaceArriving(card: CardName): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return reactorHomeSelectors(card).some((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector))
    .some((el) => el.closest('.con-reaction') === null && el.closest('.con-deal-hold') !== null));
}

/** WHERE `card` stands on screen right now — a registered host's place first, else a painted face; `undefined` = the stage. */
export function findReactorPlace(card: CardName): ReactorEmergence | undefined {
  for (const place of places) {
    if (place.standsIn(card)) {
      return place;
    }
  }
  return domReactorPlace(card);
}

/** Diagnostics only: every painted face of `card` on the product's hooks and why it is no place right now. */
export function describeReactorPlaces(card: CardName): Array<{sel: string, why: string, h: number, hold: boolean}> {
  if (typeof document === 'undefined') {
    return [];
  }
  return reactorHomeSelectors(card).flatMap((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => {
    const verdict = transferEndVerdict(el);
    return {
      sel: sel.slice(0, 24),
      why: verdict.visible ? 'visible' : `${verdict.why}${verdict.by === undefined ? '' : ':' + verdict.by}`,
      h: Math.round(el.getBoundingClientRect().height),
      hold: el.closest('.con-deal-hold') !== null,
    };
  }));
}

/** Test-only reset. */
export function resetReactorPlaces(): void {
  places.splice(0);
}
