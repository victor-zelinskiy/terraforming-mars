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
 * …AND THE GOVERNMENT'S COLUMN KEEPS ITS WIDEST WIDTH, for the same layout's life. The card only ever shrinks
 * (the reserve above), and the ruler's slot — the box the ruling party's tile FLIPs into — stands right of the
 * card's column: a column that shrank WITH the card moved that slot by the card's lost width in the very sitting
 * that changes the government (1.183 → 1.179 at 4K, 2 px, `console-parliament-stability` § the sitting). The card
 * shrinks inside a column that does not; the same layout key as the quest's reserve re-takes the mark from scratch.
 */
let govColumn = {innerH: 0, zoom: 0};

function govColumnZoomFor(innerH: number, zoom: number): number {
  if (Math.abs(govColumn.innerH - innerH) > 1) {
    govColumn = {innerH, zoom};
    return zoom;
  }
  govColumn.zoom = Math.max(govColumn.zoom, zoom);
  return govColumn.zoom;
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
      // ⚠️ THE TILE ASKS FIRST — the own effect is what YIELDS (2026-09-28). The
      // slot used to take whatever the enacted card's own effect left over, so
      // ONE block read once decided the size of the chassis SIX plaques share:
      // at 4K it left 188–254 px for a plaque that needs 240, the measured fit
      // shrank every tile to 63 %, and the printed formulas — the tiles' whole
      // content — became unreadable chips. Now the plaque states its natural
      // height (`plaqueNaturalHeight`, the profile's own sizes), the slot takes
      // exactly that, and the effect fits the remainder by its own token.
      const slot = ruler.querySelector<HTMLElement>('[data-parl-ruler-slot]');
      const own = ruler.querySelector<HTMLElement>('.con-parl__ruler-own');
      if (slot !== null) {
        const kicker = ruler.querySelector<HTMLElement>('.con-parl__ruler-kicker')?.offsetHeight ?? 0;
        const inner = Math.max(0, ruler.clientHeight - px(rcs.paddingTop) - px(rcs.paddingBottom) -
          kicker - px(rcs.rowGap) * (own === null ? 1 : 2));
        const wants = plaqueNaturalHeight(root);
        // The effect keeps its natural height only past the tile's own need — and
        // never yields below a FLOOR of it: the tile asking for exactly what it
        // needs and the effect taking the whole remainder left the 4K tiles as
        // thin strips in a 407 px band, which is the same defect from the other
        // side. The floor splits the shortfall where it is honest: six plaques
        // read constantly against one block read once.
        const ownNatural = own?.offsetHeight ?? 0;
        const ownFloor = Math.min(ownNatural, Math.round(ownNatural * OWN_EFFECT_FLOOR));
        const ownRoom = own === null ? 0 :
          Math.min(ownNatural, Math.max(ownFloor, Math.max(0, inner - wants)));
        tileH = Math.max(0, inner - ownRoom);
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
      root.style.setProperty('--con-parl-gov-col-zoom', String(govColumnZoomFor(innerH, snap(govZoom, MIN_GOV_ZOOM))));
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
  fitPartyPlaques(root);
  fitRulerOwnEffect(root);
}

/** The share of its natural height the enacted effect keeps even when the tile wants more. */
const OWN_EFFECT_FLOOR = 0.45;

/**
 * THE PLAQUE'S NATURAL BOX, and the fit that guarantees it (2026-09-28).
 *
 * The six party plaques share ONE box (`--con-parl-tile-h` × `--con-parl-tile-w`)
 * and their chassis is sized per PROFILE in rem, so «does the content fit» is a
 * MEASURED question, never an authored one. Since the tile lies down
 * (`console_party_plaque.less` § THE TILE IS A WIDE, SHORT BOX) its rows are:
 *
 *   row 1 — the NAME and the FOOT side by side   (the taller of the two)
 *   row 2 — the FORMULA, across the whole width
 *   …both beside the SEAL, which spans them.
 *
 * `plaqueNaturalHeight` is what that asks for at the profile's own sizes — it is
 * what the ruler's slot is sized from, so the tile never has to shrink to fit a
 * leftover. `fitPartyPlaques` is the SAFETY on top: a starved profile (the Deck's
 * short government block) gets a small honest plaque instead of a cut one, via
 * ONE `zoom` on the plaque's children, so seal · name · formula · foot shrink as
 * one object. It is ≤ 1 — a plaque never GROWS past its profile — and it is
 * measured once per box height and REUSED, so the government's change and the
 * vote's re-asks move nothing (`console-parliament-stability`).
 */
type PlaqueParts = {
  seal: number, head: number, state: number, formula: number,
  formulaW: number, stateW: number, headW: number,
  /** The foot shares the NAME's line (the wide box's variant) — read off the live layout, never assumed. */
  footOnHeadLine: boolean,
};

function plaqueParts(plaque: HTMLElement): PlaqueParts {
  const el = (sel: string): HTMLElement | null => plaque.querySelector<HTMLElement>(sel);
  const tall = (sel: string): number => el(sel)?.offsetHeight ?? 0;
  const wide = (sel: string): number => el(sel)?.offsetWidth ?? 0;
  // WHICH variant is live is a question about the rendered grid (a container query
  // decides it — `console_party_plaque.less` § …AND THE FOOT JOINS THE NAME'S LINE),
  // so it is read as geometry: two parts on one line share a top edge.
  const head = el('.con-pseal__head');
  const state = el('.con-pseal__state');
  const footOnHeadLine = head !== null && state !== null &&
    Math.abs(head.offsetTop - state.offsetTop) < Math.max(4, head.offsetHeight / 2);
  return {
    seal: tall('.con-pseal__seal'),
    head: tall('.con-pseal__head'),
    state: tall('.con-pseal__state'),
    formula: tall('.con-pseal__formula'),
    formulaW: wide('.con-pseal__formula'),
    stateW: wide('.con-pseal__state'),
    headW: wide('.con-pseal__head'),
    footOnHeadLine,
  };
}

/** The right column's stacked height for the variant that is actually laid out. */
function plaqueColumnHeight(p: PlaqueParts, rowGap: number): number {
  return p.footOnHeadLine ?
    Math.max(p.head, p.state) + rowGap + p.formula :
    p.head + rowGap + p.formula + rowGap + p.state;
}

/** The height the lying-down tile genuinely needs, at the profile's own sizes (0 = nothing to measure). */
function plaqueNaturalHeight(root: HTMLElement): number {
  const plaque = root.querySelector<HTMLElement>('.con-parl__party > .con-pseal');
  if (plaque === null || plaque.clientWidth === 0) {
    return 0;
  }
  // Measured at the profile's own sizes — the fit is reset first, so this can
  // never read its own output (and the fit below re-solves against the result).
  root.style.setProperty('--con-parl-tile-fit', '1');
  const cs = getComputedStyle(plaque);
  const p = plaqueParts(plaque);
  const rows = plaqueColumnHeight(p, parseFloat(cs.rowGap || '0'));
  return Math.ceil(Math.max(p.seal, rows) + parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0'));
}

let plaqueFitMemo: {root: HTMLElement, tileH: number, fit: number} | undefined;

function fitPartyPlaques(root: HTMLElement): void {
  const plaques = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__party > .con-pseal'));
  const tileH = plaques[0]?.clientHeight ?? 0;
  if (plaques.length === 0 || tileH === 0) {
    return;
  }
  if (plaqueFitMemo !== undefined && plaqueFitMemo.root === root && Math.abs(plaqueFitMemo.tileH - tileH) <= 1) {
    root.style.setProperty('--con-parl-tile-fit', String(plaqueFitMemo.fit));
    return;
  }
  root.style.setProperty('--con-parl-tile-fit', '1');
  const px = (v: string): number => parseFloat(v) || 0;
  let fit = 1;
  for (const plaque of plaques) {
    if (plaque.clientHeight === 0 || plaque.clientWidth === 0) {
      continue;
    }
    const cs = getComputedStyle(plaque);
    const p = plaqueParts(plaque);
    const innerH = plaque.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
    const naturalH = Math.max(p.seal, plaqueColumnHeight(p, px(cs.rowGap)));
    if (innerH > 0 && naturalH > 0) {
      fit = Math.min(fit, innerH / naturalH);
    }
    // Widthwise the SEAL plus the widest thing beside it is the hard part — the
    // NAME is the one member allowed to ellipsize in its own box, so it counts
    // only where it shares a line with the foot (there it must not eat it).
    const innerW = plaque.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
    const beside = p.footOnHeadLine ?
      Math.max(p.formulaW, p.stateW + px(cs.columnGap)) :
      Math.max(p.formulaW, p.stateW);
    const naturalW = p.seal + px(cs.columnGap) + beside;
    if (innerW > 0 && naturalW > 0) {
      fit = Math.min(fit, innerW / naturalW);
    }
  }
  // Snapped DOWN onto a 0.5 % grid (a budget: smaller only fits better) and never below a
  // readable floor — a starved box shows a small honest plaque, never a cut one.
  const snapped = Math.max(0.5, Math.min(1, Math.floor(fit * 200) / 200));
  plaqueFitMemo = {root, tileH, fit: snapped};
  root.style.setProperty('--con-parl-tile-fit', String(snapped));
}

/**
 * THE ENACTED CARD'S OWN EFFECT FITS THE ROOM THE TILE LEAVES. It reads at the
 * profile's size whenever the ruler block can afford it (`--con-parl-ruler-own-zoom`)
 * and yields by this fit alone — the tile is the chassis of six plaques and this
 * block is one reading, so the yielding order is fixed, not negotiated per profile.
 */
function fitRulerOwnEffect(root: HTMLElement): void {
  const own = root.querySelector<HTMLElement>('.con-parl__ruler-own');
  const ruler = root.querySelector<HTMLElement>('[data-parl-ruler]');
  if (own === null || ruler === null || ruler.clientHeight === 0) {
    return;
  }
  root.style.setProperty('--con-parl-ruler-own-fit', '1');
  const px = (v: string): number => parseFloat(v) || 0;
  const rcs = getComputedStyle(ruler);
  const kicker = ruler.querySelector<HTMLElement>('.con-parl__ruler-kicker')?.offsetHeight ?? 0;
  const slot = ruler.querySelector<HTMLElement>('[data-parl-ruler-slot]')?.offsetHeight ?? 0;
  const room = ruler.clientHeight - px(rcs.paddingTop) - px(rcs.paddingBottom) - kicker - slot - px(rcs.rowGap) * 2;
  const natural = own.offsetHeight;
  if (room <= 0 || natural <= 0) {
    return;
  }
  root.style.setProperty('--con-parl-ruler-own-fit', String(Math.max(0.4, Math.min(1, Math.floor((room / natural) * 200) / 200))));
}
