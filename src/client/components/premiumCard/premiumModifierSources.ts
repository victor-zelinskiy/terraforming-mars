/*
 * WHO BENDS A REQUIREMENT — the source side of «требование под эффектом» (TR49 class), read by every surface that
 * shows a bent requirement: the face's cassette (its seal), the hand tile's plate, the composer's requirement row,
 * the «Сработает» modifier chip. A source is a SYMBOL of what KIND of modifier it is — never its art, which is noise at
 * a seal's size: a permanent effect of a card on the table (a card silhouette; several stack), a ONE-PLAY effect (the
 * class's bolt), a party policy (the party's emblem), the rules themselves (±). WHICH card is named in words where
 * there is room (the verdict, the composer's row). Several sources stand as one seal beside the TOTAL bend, while the
 * bound itself is always the FINAL one (`RequirementEasingModel.effective` — the server's sum). Pure: no Vue, no DOM,
 * no i18n.
 */
import {CardName} from '@/common/cards/CardName';
import {EventSource} from '@/common/events/EventSource';
import {PartyName} from '@/common/turmoil/PartyName';
import {RequirementEasingModel, RequirementEasingSourceModel} from '@/common/models/ArmedPlayEffectModel';

/**
 * The seal's vocabulary — the KIND of a modifier, which is what the player needs at a glance (will it still bend the
 * next card?): `card` a standing effect of a card / corporation on the table, `once` spent by the next card played,
 * `party` a ruling party's policy, `system` a rule with no card behind it, `ally` (TR62 Tharsis Alliance) a PARTY
 * requirement met through the alliance's PARTNER — the partner's emblem with the link sign (WHO stands for this party).
 */
export type ModifierSymbol = 'card' | 'once' | 'party' | 'system' | 'ally';

export type ModifierSourceVM = {
  /** Stable render key. */
  key: string;
  symbol: ModifierSymbol;
  /** The source card (its NAME — the hint, the composer's share). Absent for a non-card source. */
  card?: CardName;
  /** The party behind a policy (its emblem). */
  party?: PartyName;
  kind: 'shift' | 'waive' | 'ally';
  /** For `shift`: the steps this source adds. */
  steps?: number;
  /** For `ally` (TR62): the partner party whose printed road meets this requirement — its emblem is the mark. */
  via?: PartyName;
  /** Spent by the next card played (an armed effect). */
  oneShot: boolean;
};

/** The card behind a modifier, when a card is what bends the requirement. */
export function modifierSourceCard(source: EventSource): CardName | undefined {
  return source.kind === 'card' || source.kind === 'corporation' ? source.card : undefined;
}

/** The symbol of one source: a one-play effect is a bolt whoever armed it; otherwise its kind. */
export function modifierSymbolOf(source: EventSource, oneShot: boolean): ModifierSymbol {
  if (oneShot) {
    return 'once';
  }
  if (source.kind === 'card' || source.kind === 'corporation') {
    return 'card';
  }
  return source.kind === 'party' ? 'party' : 'system';
}

function keyOf(source: EventSource, index: number): string {
  const card = modifierSourceCard(source);
  return card !== undefined ? `card:${card}` : `${source.kind}:${index}`;
}

export function modifierSourceOf(share: RequirementEasingSourceModel, index = 0): ModifierSourceVM {
  const card = modifierSourceCard(share.source);
  // An ALLIANCE (TR62) names its PARTNER, not its card's kind: the mark says WHO stands for this party.
  const symbol: ModifierSymbol = share.kind === 'ally' ? 'ally' : modifierSymbolOf(share.source, share.oneShot);
  const vm: ModifierSourceVM = {key: keyOf(share.source, index), symbol, kind: share.kind, oneShot: share.oneShot};
  if (share.kind === 'ally' && share.via !== undefined) {
    vm.via = share.via;
  }
  if (card !== undefined) {
    vm.card = card;
  }
  if (share.source.kind === 'party') {
    vm.party = share.source.name;
  }
  if (share.kind === 'shift' && share.steps !== undefined) {
    vm.steps = share.steps;
  }
  return vm;
}

/** Every source of one bent requirement, in the server's order (the order the breakdown names them). */
export function modifierSourcesOf(easing: Pick<RequirementEasingModel, 'sources'>): ReadonlyArray<ModifierSourceVM> {
  return easing.sources.map((share, i) => modifierSourceOf(share, i));
}

const SYMBOL_ORDER: Readonly<Record<ModifierSymbol, number>> = {card: 0, party: 1, ally: 2, system: 3, once: 4};

/** The seal's order: the standing cards first (they stack), the one-play bolt last — stable within a kind. */
export function sealOrder(sources: ReadonlyArray<ModifierSourceVM>): ReadonlyArray<ModifierSourceVM> {
  return sources.map((s, i) => ({s, i}))
    .sort((a, b) => SYMBOL_ORDER[a.s.symbol] - SYMBOL_ORDER[b.s.symbol] || a.i - b.i)
    .map(({s}) => s);
}

/**
 * MET ANYWAY — a SHIFTED requirement the scale already meets without the modifier: the bend changes nothing about this
 * card, so the face keeps its printed cassette and no surface lights it (a standing ±2 of Inventrix would otherwise
 * mark every card of the hand, drowning the cards it actually opens). A lifted requirement is never quiet — the
 * waiver is the one-play class's whole statement and the play spends it. An ALLIANCE (TR62) the party's own road
 * already meets is quiet the same way: it changes nothing about this card.
 */
export function easingIsQuiet(easing: Pick<RequirementEasingModel, 'effective' | 'met' | 'decisive'>): boolean {
  return easing.effective !== 'waived' && easing.met && !easing.decisive;
}
