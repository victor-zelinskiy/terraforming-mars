import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, parliamentRootEl, parliamentSlotsCarried} from './consoleParliamentFlow';
import {sittingMotion} from './sittingDirector';
import {MAX_VOTE_ZOOM, PCARD_W} from './parliamentArtTier';

/*
 * THE CARD FIT («Зал» v7). The premium face is px-designed (`--pcard-w/h`) and
 * integrates through `zoom`; the zones it stands in are sized by the FRAME,
 * never by the cards — so the fit budgets from the zone minus its MEASURED
 * chrome and never reads its own output. One solver for the voting slots (the
 * table — the chamber's hero), the enacted face (the government's column under
 * the ruler's medallion, over the «ВАШИ ЭФФЕКТЫ» strip) and the vote row,
 * published as the section's own zoom tokens. The party medallions are sized
 * by the stylesheet (rem per profile) and need no fit.
 */
export {MAX_VOTE_ZOOM, PCARD_W};
export const PCARD_H = 460;
/** The table's cards stop here so the vote mode can GROW them (never shrink the object the player picked up). */
export const MAX_CARD_ZOOM = 1.0;
/** …and a step lower on the couch: the 4K mode's card is HEIGHT-bound there (its band and tally rows are taller in rem), so the size step the mode owes is bought on the overview's side. */
export const MAX_CARD_ZOOM_TV = 1.0;
export const MIN_CARD_ZOOM = 0.3;
/** The enacted face — the government's second object, under the medallion. */
export const MAX_GOV_ZOOM = 1.0;
/** …and the EMPTY outline (no bill enacted yet) stops here — a prepared place, never a void the size of the column. */
export const MAX_GOV_EMPTY_ZOOM = 0.62;
export const MIN_GOV_ZOOM = 0.2;
/** The payout stage's carried card — the scene's hero, beside the recipient zone. */
export const MAX_ENACT_ZOOM = 1.05;
/** …and at most this share of the layer's width (the recipient zone is the decision). */
export const ENACT_HERO_SHARE = 0.3;
/** The vote row's cards (the cap — `MAX_VOTE_ZOOM` — lives in `parliamentArtTier.ts`: the art tier is decided by it). */
export const MIN_VOTE_ZOOM = 0.35;
/** The enacted face takes at most this share of the government column's width. */
const GOV_CARD_SHARE = 0.92;

/**
 * THE FIT IS FROZEN from a vote's submit until the flow leaves («Заседание v2» § Б5): a re-fit under the
 * delegate's flight jumped the very scene it measured (three cards shrinking for the cube's flight, the panel
 * growing). ONE point: the view watcher, the ResizeObserver and the bill's arrival all pass through here.
 */
let fitFrozen = false;

export function freezeParliamentFit(frozen: boolean): void {
  fitFrozen = frozen;
}

export function parliamentFitFrozen(): boolean {
  return fitFrozen;
}

/** Solve the card zooms (voting slots · the enacted face · the vote row) from the measured frame. */
export function fitParliamentCards(): void {
  const root = parliamentRootEl();
  if (root === undefined || fitFrozen) {
    return;
  }
  const scale = conUiScale();
  const px = (v: string): number => parseFloat(v) || 0;
  // Layout heights (`offsetHeight`), never painted boxes: a FLIP in flight
  // scales these very elements, and a rect read then under-fits the card.
  const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
  const snap = (zoom: number, min: number): number => Math.max(min * scale, Math.floor(zoom * 1000) / 1000);
  const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
  // Парламент v8: the bill stands over its VOTE RAIL — the tally's medallion and the ribbon share ONE row (one gap);
  // stacked (an older layout, the vote row) they are two rows and two gaps. Read off the layout, never assumed.
  const railOf = (slot: HTMLElement): {h: number, gaps: number} => {
    const ribbon = slot.querySelector<HTMLElement>('.con-parl__ribbon');
    const tally = slot.querySelector<HTMLElement>('.con-parl__tally');
    if (ribbon !== null && tally !== null && ribbon.offsetTop === tally.offsetTop) {
      return {h: Math.max(ribbon.offsetHeight, tally.offsetHeight), gaps: 1};
    }
    return {h: heightOf(slot, '.con-parl__ribbon') + heightOf(slot, '.con-parl__tally'), gaps: 2};
  };
  const chromeOf = (slot: HTMLElement): number => railOf(slot).h;

  if (parliamentSlotsCarried()) {
    // THE VOTE ROW: each card takes its column's height minus the slot's
    // measured chrome (label · ribbon · tally) and its column's width.
    const vrow = root.querySelector<HTMLElement>('.con-parl__vrow');
    if (vrow !== null && slots.length > 0) {
      const slot = slots[0];
      const cs = getComputedStyle(slot);
      const chrome = Math.max(...slots.map(chromeOf));
      const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * railOf(slot).gaps;
      const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
      const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_VOTE_ZOOM * scale);
      root.style.setProperty('--con-parl-vote-zoom', String(snap(zoom, MIN_VOTE_ZOOM)));
    }
  } else if (slots.length > 0) {
    const slot = slots[0];
    const cs = getComputedStyle(slot);
    const chrome = Math.max(...slots.map(chromeOf));
    const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * railOf(slot).gaps;
    // Парламент v8: the stand HUGS its bill inside the home column — the room is the HOME's (a fit never reads its output).
    const home = slot.closest<HTMLElement>('.con-parl__slot-home') ?? slot;
    const availW = home.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const cap = consoleLayoutState.profile === 'tv' ? MAX_CARD_ZOOM_TV : MAX_CARD_ZOOM;
    const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, cap * scale);
    root.style.setProperty('--con-parl-card-zoom', String(snap(zoom, MIN_CARD_ZOOM)));
  }

  // THE ENACTED FACE stands in the government's column under the ruler's medallion and over the effects strip:
  // it takes what those two leave of the column's height, and a share of its width.
  const ruling = root.querySelector<HTMLElement>('.con-parl__ruling');
  // THE SITTING KEEPS THE GOVERNMENT'S ZOOM through the beat that moves the set: a re-solve there would jump the
  // very scene being tweened (the medallion FLIPs across the stage, the card flies in).
  const govFrozen = sittingMotion.stage === 'enact' && root.style.getPropertyValue('--con-parl-gov-zoom') !== '';
  if (!govFrozen) {
    let govZoom = MAX_GOV_ZOOM * scale;
    if (ruling !== null) {
      const rcs = getComputedStyle(ruling);
      const innerH = ruling.clientHeight - px(rcs.paddingTop) - px(rcs.paddingBottom);
      const innerW = ruling.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight);
      const carry = ruling.querySelector<HTMLElement>('[data-parl-gov-carry], .con-parl__gov-empty');
      const others = Array.from(ruling.children).filter((child) => child !== carry) as Array<HTMLElement>;
      // Парламент v8: the dais is a ROW — the ruler's seal BESIDE the law, so the seal takes width, not height.
      if (rcs.flexDirection.startsWith('row')) {
        const taken = others.reduce((sum, child) => sum + child.offsetWidth, 0) + px(rcs.columnGap) * others.length;
        govZoom = Math.min(govZoom, innerH / PCARD_H, (innerW - taken) / PCARD_W);
      } else {
        const taken = others.reduce((sum, child) => sum + child.offsetHeight, 0) + px(rcs.rowGap) * others.length;
        govZoom = Math.min(govZoom, (innerH - taken) / PCARD_H, (innerW * GOV_CARD_SHARE) / PCARD_W);
      }
      if (carry !== null && carry.hasAttribute('data-parl-gov-empty')) {
        govZoom = Math.min(govZoom, MAX_GOV_EMPTY_ZOOM * scale);
      }
    }
    root.style.setProperty('--con-parl-gov-zoom', String(snap(govZoom, MIN_GOV_ZOOM)));
  }

  // THE EMBEDDED STEP'S CARRIER CARD (v5) — the hero column holds NOTHING but the card: the payout's
  // formula, the ruling party's answer, a skip and the wait all read in the BAND. So the card takes the
  // column's own height and at most a share of the layer's width — the work the player came here to do
  // is the decision, and it gets the rest.
  if (parliamentFlow.stage === 'sitting' && parliamentFlow.sittingField) {
    const layer = root.querySelector<HTMLElement>('.con-sit__reward--field');
    const hero = root.querySelector<HTMLElement>('.con-sit__hero--field');
    if (layer !== null && hero !== null) {
      const hcs = getComputedStyle(hero);
      const availH = hero.clientHeight - px(hcs.paddingTop) - px(hcs.paddingBottom);
      const availW = layer.clientWidth * ENACT_HERO_SHARE;
      const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_ENACT_ZOOM * scale);
      root.style.setProperty('--con-parl-enact-zoom', String(snap(zoom, MIN_GOV_ZOOM)));
    }
  }
}
