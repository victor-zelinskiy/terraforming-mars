/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DISCARD'S FLIGHTS — the DOM half of `supportDiscard.ts` (Turmoil Redux
 * TR12 Party Sanctions). The mirror of a support landing (TR03, the sitting's
 * support scene): every neutral cube leaves ITS OWN place on the party's
 * plaque — the places from the right, the last one laid down going first — and
 * flies to the common supply on the bench (`[data-parl-neutral-cube]`), one
 * after another at the support scene's rhythm (law 12: a cube every ≥ 90 ms).
 * The place goes dark on the LIFT-OFF and answers once (`--left`, ended by its
 * own `animationend`); the pool's count grows on the TOUCHDOWN. Nothing flies
 * without a measured source and destination: a miss is CONFESSED (the caller
 * publishes it on the section root) and the cube simply lands.
 *
 * Every proxy rides the shell-mounted flight layer (`flyCube`): born invisible,
 * positioned on the next tick (law 14), its stagger a beat on the motion clock.
 */
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {flyCube, placeCubeRect} from './parliamentFlights';
import {SUPPORT_CUBE_STAGGER_MS} from './consoleParliamentModel';
import {supportDiscardOrder} from './supportPickModel';

/** The selector of a plaque's support place — the plaque's OWN block (`data-parl-support`), never the vote panel's. */
export function plaquePlaceSelector(party: ReduxParty, place: number): string {
  return `[data-parl-support="${party}"] [data-support-place="${place}"]`;
}

export type SupportDiscardHooks = {
  /** A cube lifted off `place` — the plaque stops drawing it. */
  onLifted: (place: number) => void;
  /** A cube landed in the pool — the pool counts it. */
  onLanded: () => void;
  /** Every cube has landed. */
  onDone: () => void;
  /** A flight could not be measured — named, never silent. */
  onDegraded: (why: string) => void;
};

/** The ONE place that let its cube go answers, once — a one-shot that ends on its own (law 11). */
function answerPlaceLeft(root: HTMLElement, party: ReduxParty, place: number): void {
  if (consoleReducedMotionActive()) {
    return;
  }
  const el = root.querySelector<HTMLElement>(plaquePlaceSelector(party, place));
  if (el === null) {
    return;
  }
  el.classList.remove('con-pseal__support-place--left');
  void el.offsetWidth;
  el.classList.add('con-pseal__support-place--left');
  el.addEventListener('animationend', () => el.classList.remove('con-pseal__support-place--left'), {once: true});
}

/**
 * FLY the area's `count` cubes into the common supply. Returns the flights' ids
 * (the caller drops them on an abort). Measured ONCE, at the launch: from the
 * press to the leave the geometry is frozen (law 8), so a place measured now
 * is where its cube stands.
 */
export function flySupportDiscard(root: HTMLElement, party: ReduxParty, count: number, hooks: SupportDiscardHooks): Array<string> {
  const ids: Array<string> = [];
  const order = supportDiscardOrder(count);
  if (order.length === 0) {
    hooks.onDone();
    return ids;
  }
  const reduced = typeof window === 'undefined' || consoleReducedMotionActive();
  const to = placeCubeRect(root, '[data-parl-neutral-cube]');
  let remaining = order.length;
  order.forEach((place, i) => {
    const from = placeCubeRect(root, plaquePlaceSelector(party, place));
    if (!reduced && (from === undefined || to === undefined)) {
      hooks.onDegraded(from === undefined ? `discard: ${party} place ${place} has no measurable cube` : 'discard: the neutral supply has no measurable place');
    }
    const id = flyCube('neutral', from, to, i * SUPPORT_CUBE_STAGGER_MS, () => {
      hooks.onLanded();
      remaining--;
      if (remaining === 0) {
        hooks.onDone();
      }
    }, {
      onLifted: () => {
        hooks.onLifted(place);
        answerPlaceLeft(root, party, place);
      },
    });
    if (id !== undefined) {
      ids.push(id);
    }
  });
  return ids;
}
