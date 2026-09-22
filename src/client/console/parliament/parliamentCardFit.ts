import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, parliamentRootEl, parliamentSlotsCarried} from './consoleParliamentFlow';
import {sittingMotion} from './sittingDirector';
import {MAX_VOTE_ZOOM, PCARD_W} from './parliamentArtTier';

/*
 * THE CARD FIT. The premium face is px-designed (`--pcard-w/h`) and integrates
 * through `zoom`; the zones it stands in are sized by the FRAME, never by the
 * cards — so the fit budgets from the zone minus its MEASURED chrome and
 * never reads its own output. One solver for the voting slots, the enacted
 * face and the vote row, published as the section's own zoom tokens.
 */
export {MAX_VOTE_ZOOM, PCARD_W};
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
/** The vote row's cards (the cap — `MAX_VOTE_ZOOM` — lives in `parliamentArtTier.ts`: the art tier is decided by it). */
export const MIN_VOTE_ZOOM = 0.35;

/**
 * THE QUEST'S ROOM IS A HIGH-WATER MARK (v4 §2.4). The enacted face's zoom is solved from what the chairman
 * quest LEAVES, and that block legitimately changes height mid-sitting: a new generation's condition is a
 * different sentence, and its foot says «НАГРАДА …» where the closed one said nothing. Solved against the
 * SHORTER of the two, the card then overflowed its block by 51 px at 4K the moment the taller quest unfolded
 * (measured by `console-parliament-sitting-v4` § Г-П4) — and a re-solve at that instant is worse than the
 * overflow: the government's own card would change size while the set is still landing.
 *
 * So the budget only ever SHRINKS the card, never grows it back: the reserve is the tallest quest this layout
 * has shown. The mark belongs to ONE layout — a profile change / resize moves `innerH`, and there the mark is
 * re-taken from scratch (an old 4K reserve would starve the Deck's card). The card is at most a few per cent
 * smaller than it could be, which nobody can see; a clipped card is what everybody sees.
 */
let questReserve = {innerH: 0, questH: 0};

function questReserveFor(innerH: number, questH: number): number {
  if (Math.abs(questReserve.innerH - innerH) > 1) {
    questReserve = {innerH, questH};
    return questH;
  }
  questReserve.questH = Math.max(questReserve.questH, questH);
  return questReserve.questH;
}

/**
 * THE FIT IS FROZEN from a vote's submit until the flow leaves (v2, «Заседание v2» § Б5): a re-fit under the
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
  // THE PARTY TILE'S WIDTH (v2): the ruling party's tile in the government stands on the same chassis at the
  // same size as the five in the opposition row — ONE token both read. It is the SMALLER of the row's column
  // and the room the government's ruler block has for it (measured: at 1080 the block holds 281 px against
  // the row's 327 — clamped by `max-width` alone, the ruler's tile was 46 px narrower than its siblings);
  // the row then lays its five tiles at that width and spends the rest on its gaps.
  const parties = root.querySelector<HTMLElement>('.con-parl__parties');
  if (parties !== null && parties.clientWidth > 0) {
    const pcs = getComputedStyle(parties);
    const columns = Math.max(1, parties.children.length || 5);
    let tileW = (parties.clientWidth - px(pcs.columnGap) * (columns - 1)) / columns;
    let tileH = 0;
    const ruler = root.querySelector<HTMLElement>('[data-parl-ruler]');
    if (ruler !== null && ruler.clientWidth > 0) {
      const rcs = getComputedStyle(ruler);
      tileW = Math.min(tileW, ruler.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight));
      // …and the HEIGHT the same way (v3 В5): the row's tile is as tall as the middle tier, the ruler's
      // slot sits in the TOP tier under its own kicker, and the slot then clipped the very tile it hosts.
      // ONE token both honour: the smaller room, measured — never two sizes of one chassis.
      const slot = ruler.querySelector<HTMLElement>('[data-parl-ruler-slot]');
      const own = ruler.querySelector<HTMLElement>('.con-parl__ruler-own');
      if (slot !== null) {
        const taken = (ruler.querySelector<HTMLElement>('.con-parl__ruler-kicker')?.offsetHeight ?? 0) +
          (own?.offsetHeight ?? 0) + px(rcs.rowGap) * (own === null ? 1 : 2);
        tileH = Math.max(0, ruler.clientHeight - px(rcs.paddingTop) - px(rcs.paddingBottom) - taken);
      }
    }
    if (tileW > 0) {
      root.style.setProperty('--con-parl-tile-w', String(Math.floor(tileW)) + 'px');
    }
    if (tileH > 0) {
      root.style.setProperty('--con-parl-tile-h', String(Math.floor(Math.min(tileH, parties.clientHeight))) + 'px');
    }
  }
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
  // THE SITTING KEEPS THE GOVERNMENT'S ZOOM («Заседание v2»): the chairman's quest changes WITH the government in
  // the middle of the walk, and the zoom is solved from the room the quest leaves — on the Deck a shorter quest
  // freed a line, the re-solve widened the enacted card by 36 px and pushed the ruler's tile sideways in the very
  // beat that FLIPs it (measured by `console-parliament-stability`). The zoom solved when the sitting opens stands
  // until the surface leaves; the browse layer re-solves on its next mount.
  // …and the freeze is scoped to the BEAT that moves the set (v4 §2.4): freezing it for the whole sitting
  // let the card keep a zoom solved against a taller quest, so the face overflowed its block and painted over
  // the quest's own head. The enactment's beat is the only window where a re-solve could jump the scene.
  const govFrozen = sittingMotion.stage === 'enact' && root.style.getPropertyValue('--con-parl-gov-zoom') !== '';
  if (!govFrozen) {
    let govZoom = MAX_GOV_ZOOM * scale;
    if (gov !== null && ruling !== null) {
      const gcs = getComputedStyle(gov);
      const innerH = gov.clientHeight - px(gcs.paddingTop) - px(gcs.paddingBottom);
      const blocks = Array.from(gov.children).filter((child) => child !== ruling);
      const quest = gov.querySelector<HTMLElement>('[data-parl-quest]');
      const others = blocks.filter((child) => child !== quest)
        .reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
      // …and the SAME reserve is published as the quest's own floor, so the column's geometry stops moving at
      // all: without it the quest released its 7–23 px to the ruling row instead, the ruler block grew with it
      // and `--con-parl-tile-h` (derived from that block's room) resized all six party tiles mid-sitting.
      const reserve = questReserveFor(innerH, quest?.getBoundingClientRect().height ?? 0);
      if (quest !== null && reserve > 0) {
        root.style.setProperty('--con-parl-quest-h', String(Math.round(reserve)) + 'px');
      }
      const taken = others + reserve + px(gcs.rowGap) * blocks.length;
      const rcs = getComputedStyle(ruling);
      const innerW = ruling.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight);
      govZoom = Math.min(govZoom, (innerH - taken - px(rcs.paddingTop) - px(rcs.paddingBottom)) / PCARD_H, (innerW * 0.52) / PCARD_W);
    }
    root.style.setProperty('--con-parl-gov-zoom', String(snap(govZoom, MIN_GOV_ZOOM)));
  }

  // THE EMBEDDED STEP'S CARRIER CARD (v5) — the hero column holds NOTHING but the card: the payout's
  // formula, the ruling party's answer, a skip and the wait all read in the BAND above the zone now. So
  // the card takes the column's own height and at most a share of the layer's width — the work the player
  // came here to do is the decision, and it gets the rest.
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
