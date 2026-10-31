/*
 * «WHILE ENACTED» — what a law gives the reading's SEAT for as long as it stands (P77 · DH, the owner's 4K frame of
 * 2026-10-31: Trade Industries' vote panel read «ДЕЙСТВИЕ, ПОКА ПРИНЯТА» over an EMPTY plate).
 *
 * The vote panel's one number is the ENACTMENT's payout (`voteYieldsOf`). A law that pays nothing at the enactment and
 * then stands — a passive, an action — had nothing to say there, and a law that pays AND stands said only half. This
 * module is the other half, in the seat's own numbers wherever the declaration gives one, and in the law's own rule
 * wherever it does not:
 *   · AN ACTION — its PRICE at the seat's influence (`actionBillPrice`, the one function the bill is charged by) with
 *     what it buys, and HOW MANY TIMES a generation (`actionUsesFor` through `actionUsesReadingOf`); the win's change
 *     to either is the reading's suffix («−2 M€ если победите», «×3 если победите»), never a second plate. An action
 *     with neither declaration is its rule, once a generation (the family's rule).
 *   · A PASSIVE with a TERM (`passiveTerm.ts` — the number the engine charges by): a card discount and the cards of the
 *     viewer's hand it would cheapen; a unit's extra value and the seat's stock at the new rate; tags lent at the
 *     seat's influence, with the win's suffix. A passive with no term is its rule — the very sentence its surfaces print.
 * Pure: no Vue, no DOM, no i18n — English keys, numbers, icon keys. Never a rule re-implemented: every number is the
 * declaration's own function.
 */
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {ParliamentModel, seatEnacts} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {actionBillPrice} from '@/common/parliament/actionBill';
import {passiveCardDiscount, passiveTagBonus, passiveValueBonus} from '@/common/parliament/passiveTerm';
import {actionUsesReadingOf, influenceIfWinning} from './actionUsesReading';

/** The kicker of the «while enacted» part when the plate already carries an enactment reading above it. */
export const STANDING_KICKER = 'While enacted';
/** The once-a-generation rule of an action with no `actionUses` (the family's rule). */
export const ONCE_A_GENERATION = 'once a generation';
/** «×${0} a generation» — an action's count for the seat. */
export const USES_A_GENERATION = '×${0} a generation';
/** «in hand: ${0}» — the viewer's cards a discount would cheapen. */
export const DISCOUNT_IN_HAND = 'in hand: ${0}';
/** «when taking actions» — the scope of tags lent by influence. */
export const TAGS_WHEN_ACTING = 'when taking actions';
/** «your stock +${0} M€» — what the extra value adds to the seat's stock today. */
export const STOCK_GAIN = 'your stock +${0} M€';

export type StandingChip = {icon: string, amount: number, direction: 'cost' | 'gain'};

export type ActionStanding = {
  /** The bill at the seat's influence: the printed sum, what the seat pays, and what it would pay as the winner. */
  bill?: {printed: number, price: number, priceIfWin?: number};
  /** What the bill buys (the preview's gains) — present only beside a bill («pay → get»). */
  gains: ReadonlyArray<StandingChip>;
  /** A preview note that names what the bill buys when no chip can (Live Experiments' «then play a card…»). */
  buys?: string;
  /** Times a generation for the seat (declared, or once by the family's rule) and as the winner where it changes. */
  uses: {now: number, ifWin?: number, declared: boolean};
  /** The action's rule — printed where no number says what the action does (no bill). */
  rule?: string;
};

export type PassiveStanding =
  | {kind: 'cardDiscount', amount: number, tags: ReadonlyArray<Tag>, inHand?: number}
  | {kind: 'resourceValue', rows: ReadonlyArray<{resource: 'steel' | 'titanium', now: number, after: number}>, stockGain?: number}
  | {kind: 'tagsPerInfluence', tag: Tag, now: number, ifWin?: number}
  | {kind: 'rule', text: string};

export type LawStanding = {
  /** Present when the plate already reads an enactment payout — the standing part names itself. */
  kicker?: string;
  action?: ActionStanding;
  passive?: PassiveStanding;
};

/** The SUBJECT's public stock the value term reads (steel / titanium and their current per-unit values). */
export type StandingStock = {steel: number, titanium: number, steelValue: number, titaniumValue: number};

export type LawStandingInput = {
  resolution: IClientResolution | undefined;
  model: ParliamentModel | undefined;
  subject: Color | undefined;
  /** The reading speaks of another seat — no hand is read (it is not public). */
  rival: boolean;
  /** The plate above already carries an enactment reading (the standing then takes the «while enacted» kicker). */
  belowPayout: boolean;
  stock?: StandingStock;
  /** The VIEWER's hand, as each card's printed tags (absent for another seat's reading). */
  hand?: ReadonlyArray<ReadonlyArray<Tag>>;
};

export function lawStandingOf(input: LawStandingInput): LawStanding | undefined {
  const {resolution, model, subject} = input;
  if (resolution === undefined) {
    return undefined;
  }
  const player = subject === undefined ? undefined : model?.players.find((p) => p.color === subject);
  const seat = player !== undefined && seatEnacts(player) ? {influence: player.influence, agenda: player.agenda} : undefined;
  const winInfluence = seat === undefined ? undefined : influenceIfWinning(seat);
  const action = resolution.hasAction && resolution.text.action !== undefined && resolution.text.action !== '' ?
    actionStandingOf(resolution, seat?.influence, winInfluence) : undefined;
  // A rating-vetoing passive has its own live reading on the panel (`ratingVetoReadingOf`) — never a second line.
  const passive = resolution.hasPassive && resolution.vetoesRating !== true ? passiveStandingOf(resolution, input, seat?.influence, winInfluence) : undefined;
  if (action === undefined && passive === undefined) {
    return undefined;
  }
  return {
    ...(input.belowPayout ? {kicker: STANDING_KICKER} : {}),
    ...(action === undefined ? {} : {action}),
    ...(passive === undefined ? {} : {passive}),
  };
}

function actionStandingOf(resolution: IClientResolution, influence: number | undefined, winInfluence: number | undefined): ActionStanding {
  const preview = resolution.actionPreview ?? [];
  const usesReading = actionUsesReadingOf(resolution.actionUses, influence === undefined ? undefined : {influence, agenda: 0}, false);
  const declared = resolution.actionUses !== undefined;
  const now = usesReading?.uses ?? resolution.actionUses?.base ?? 1;
  const usesIfWin = declared && winInfluence !== undefined ?
    actionUsesReadingOf(resolution.actionUses, {influence: winInfluence, agenda: 0}, false)?.uses : undefined;
  const uses = {now, declared, ...(usesIfWin !== undefined && usesIfWin !== now ? {ifWin: usesIfWin} : {})};
  const billDecl = resolution.actionBill;
  if (billDecl === undefined) {
    return {gains: [], uses, rule: resolution.text.action};
  }
  const price = actionBillPrice(billDecl, influence ?? 0);
  const priceIfWin = winInfluence === undefined ? undefined : actionBillPrice(billDecl, winInfluence).price;
  const gains = preview.filter((e) => e.direction === 'gain').map((e) => ({icon: e.icon, amount: e.amount, direction: 'gain' as const}));
  const cost = preview.find((e) => e.direction === 'cost' && e.icon === 'megacredits');
  const buys = gains.length === 0 && cost?.note !== undefined && cost.note !== '' ? cost.note : undefined;
  return {
    bill: {printed: price.printed, price: price.price, ...(priceIfWin !== undefined && priceIfWin !== price.price ? {priceIfWin} : {})},
    gains,
    ...(buys === undefined ? {} : {buys}),
    uses,
  };
}

function passiveStandingOf(resolution: IClientResolution, input: LawStandingInput, influence: number | undefined, winInfluence: number | undefined): PassiveStanding | undefined {
  const term = resolution.passiveTerm;
  const rule = resolution.text.passive;
  if (term === undefined) {
    return rule === undefined || rule === '' ? undefined : {kind: 'rule', text: rule};
  }
  switch (term.kind) {
  case 'cardDiscount': {
    const inHand = input.rival || input.hand === undefined ? undefined : input.hand.filter((tags) => passiveCardDiscount(term, tags) > 0).length;
    return {kind: 'cardDiscount', amount: term.amount, tags: term.tags, ...(inHand === undefined ? {} : {inHand})};
  }
  case 'resourceValue': {
    const stock = input.stock;
    // No seat's stock to read (a spectator) — the law's rule, never a client constant for a unit's value.
    if (stock === undefined) {
      return rule === undefined || rule === '' ? undefined : {kind: 'rule', text: rule};
    }
    const rows = term.resources.map((resource) => {
      const now = resource === 'steel' ? stock.steelValue : stock.titaniumValue;
      return {resource, now, after: now + passiveValueBonus(term, resource)};
    });
    const stockGain = term.resources.reduce((sum, resource) => sum + (resource === 'steel' ? stock.steel : stock.titanium) * passiveValueBonus(term, resource), 0);
    // The stock line is the VIEWER's own («ваш запас») — another seat's reading keeps the rate alone.
    return {kind: 'resourceValue', rows, ...(stockGain > 0 && !input.rival ? {stockGain} : {})};
  }
  case 'tagsPerInfluence': {
    const now = passiveTagBonus(term, term.tag, influence ?? 0);
    const win = winInfluence === undefined ? undefined : passiveTagBonus(term, term.tag, winInfluence);
    return {kind: 'tagsPerInfluence', tag: term.tag, now, ...(win !== undefined && win !== now ? {ifWin: win} : {})};
  }
  }
}

/** Words the standing prints (the budget's own count — `voteInfoBudget`). */
export function lawStandingWords(standing: LawStanding | undefined, text: (key: string, params?: ReadonlyArray<string>) => string): Array<string> {
  if (standing === undefined) {
    return [];
  }
  const out: Array<string> = [];
  if (standing.kicker !== undefined) {
    out.push(text(standing.kicker));
  }
  const action = standing.action;
  if (action !== undefined) {
    out.push(action.uses.declared || action.bill !== undefined ? text(USES_A_GENERATION, [String(action.uses.now)]) : text(ONCE_A_GENERATION));
    if (action.rule !== undefined) {
      out.push(text(action.rule));
    }
    if (action.buys !== undefined) {
      out.push(text(action.buys));
    }
  }
  const passive = standing.passive;
  if (passive?.kind === 'rule') {
    out.push(text(passive.text));
  } else if (passive?.kind === 'cardDiscount' && passive.inHand !== undefined) {
    out.push(text(DISCOUNT_IN_HAND, [String(passive.inHand)]));
  } else if (passive?.kind === 'resourceValue' && passive.stockGain !== undefined) {
    out.push(text(STOCK_GAIN, [String(passive.stockGain)]));
  } else if (passive?.kind === 'tagsPerInfluence') {
    out.push(text(TAGS_WHEN_ACTING));
  }
  return out;
}
