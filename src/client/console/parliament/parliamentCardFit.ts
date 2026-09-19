import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, parliamentRootEl, parliamentSlotsCarried} from './consoleParliamentFlow';

/*
 * THE CARD FIT. The premium face is px-designed (`--pcard-w/h`) and integrates
 * through `zoom`; the zones it stands in are sized by the FRAME, never by the
 * cards — so the fit budgets from the zone minus its MEASURED chrome and
 * never reads its own output. One solver for the voting slots, the enacted
 * face and the vote row, published as the section's own zoom tokens.
 */
export const PCARD_W = 320;
export const PCARD_H = 460;
/** The overview's cards stop here so the vote mode can GROW them (never shrink the object the player picked up). */
export const MAX_CARD_ZOOM = 0.8;
/** …and a step lower on the couch: the 4K mode's card is HEIGHT-bound (its band and tally rows are taller in rem), so the size step the mode owes is bought on the overview's side. */
export const MAX_CARD_ZOOM_TV = 0.75;
export const MIN_CARD_ZOOM = 0.3;
/** The enacted face — the government's MAIN object. */
export const MAX_GOV_ZOOM = 0.72;
export const MIN_GOV_ZOOM = 0.2;
/** The payout stage's carried card — the scene's hero, beside the recipient zone. */
export const MAX_ENACT_ZOOM = 1.05;
/** …and at most this share of the layer's width (the recipient zone is the decision). */
export const ENACT_HERO_SHARE = 0.3;
/** The vote row's cards. */
export const MAX_VOTE_ZOOM = 1.05;
export const MIN_VOTE_ZOOM = 0.35;

/** Solve the card zooms (voting slots · the enacted face · the vote row) from the measured frame. */
export function fitParliamentCards(): void {
  const root = parliamentRootEl();
  if (root === undefined) {
    return;
  }
  const scale = conUiScale();
  const px = (v: string): number => parseFloat(v) || 0;
  // Layout heights (`offsetHeight`), never painted boxes: a FLIP in flight
  // scales these very elements, and a rect read then under-fits the card.
  const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
  const snap = (zoom: number, min: number): number => Math.max(min * scale, Math.floor(zoom * 1000) / 1000);
  const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
  const chromeOf = (slot: HTMLElement): number =>
    heightOf(slot, '.con-parl__slot-label') + heightOf(slot, '.con-parl__ribbon') + heightOf(slot, '.con-parl__tally');

  if (parliamentSlotsCarried()) {
    // THE VOTE ROW: each card takes its column's height minus the slot's
    // measured chrome (label · ribbon · tally) and its column's width.
    const vrow = root.querySelector<HTMLElement>('.con-parl__vrow');
    if (vrow !== null && slots.length > 0) {
      const slot = slots[0];
      const cs = getComputedStyle(slot);
      const chrome = Math.max(...slots.map(chromeOf));
      const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
      const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
      const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_VOTE_ZOOM * scale);
      root.style.setProperty('--con-parl-vote-zoom', String(snap(zoom, MIN_VOTE_ZOOM)));
    }
  } else if (slots.length > 0) {
    const slot = slots[0];
    const cs = getComputedStyle(slot);
    const chrome = Math.max(...slots.map(chromeOf));
    const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
    const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const cap = consoleLayoutState.profile === 'tv' ? MAX_CARD_ZOOM_TV : MAX_CARD_ZOOM;
    const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, cap * scale);
    root.style.setProperty('--con-parl-card-zoom', String(snap(zoom, MIN_CARD_ZOOM)));
  }

  // THE ENACTED FACE is the government's main object: it takes the ruling
  // row's height (the column minus its other blocks) and up to 52 % of
  // the row's width — the ruler's effect stands beside it.
  const gov = root.querySelector<HTMLElement>('.con-parl__gov');
  const ruling = root.querySelector<HTMLElement>('.con-parl__ruling');
  let govZoom = MAX_GOV_ZOOM * scale;
  if (gov !== null && ruling !== null) {
    const gcs = getComputedStyle(gov);
    const innerH = gov.clientHeight - px(gcs.paddingTop) - px(gcs.paddingBottom);
    const blocks = Array.from(gov.children).filter((child) => child !== ruling);
    const taken = blocks.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) + px(gcs.rowGap) * blocks.length;
    const rcs = getComputedStyle(ruling);
    const innerW = ruling.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight);
    govZoom = Math.min(govZoom, (innerH - taken - px(rcs.paddingTop) - px(rcs.paddingBottom)) / PCARD_H, (innerW * 0.52) / PCARD_W);
  }
  root.style.setProperty('--con-parl-gov-zoom', String(snap(govZoom, MIN_GOV_ZOOM)));

  // THE SITTING'S REWARD STAGE ON THE FIELD — the carried enacted card takes
  // the hero column's height minus the payout reading under it, and at most a
  // share of the layer's width (the recipient zone is the decision).
  if (parliamentFlow.stage === 'sitting' && parliamentFlow.sittingField) {
    const layer = root.querySelector<HTMLElement>('.con-sit__reward--field');
    const hero = root.querySelector<HTMLElement>('.con-sit__hero--field');
    if (layer !== null && hero !== null) {
      const hcs = getComputedStyle(hero);
      // EVERYTHING under the card is measured — the reading, the ruling party's
      // answer, the winner's tile, a skip plate, the wait line — with the
      // column's gap per item: measuring the reading alone let the card grow
      // over the rows beneath it on the Deck (a «1» peeking out from under the
      // card's bottom edge).
      const items = Array.from(hero.querySelectorAll<HTMLElement>('[data-parl-sit-item]'));
      const readingH = items.reduce((sum, item) => sum + item.offsetHeight, 0) + items.length * px(hcs.rowGap);
      const availH = hero.clientHeight - px(hcs.paddingTop) - px(hcs.paddingBottom) - readingH;
      const availW = layer.clientWidth * ENACT_HERO_SHARE;
      const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_ENACT_ZOOM * scale);
      root.style.setProperty('--con-parl-enact-zoom', String(snap(zoom, MIN_GOV_ZOOM)));
    }
  }
}
