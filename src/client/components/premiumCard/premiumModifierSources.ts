/*
 * WHO BENDS A REQUIREMENT — the source side of «требование под эффектом» (TR49 class), read by every surface that
 * shows a bent requirement: the face's cassette (its coin seal), the hand tile's plate, the composer's requirement row,
 * the «Сработает» modifier chip. One source = one COIN (the source card's own art in a ring; a one-play effect wears the
 * class's ⚡ pip); several sources stack into one seal beside the TOTAL bend, while the bound itself is always the
 * FINAL one (`RequirementEasingModel.effective` — the server's sum). Pure: no Vue, no DOM, no i18n.
 */
import {CardName} from '@/common/cards/CardName';
import {EventSource} from '@/common/events/EventSource';
import {RequirementEasingModel, RequirementEasingSourceModel} from '@/common/models/ArmedPlayEffectModel';

export type ModifierSourceVM = {
  /** Stable render key. */
  key: string;
  /** The source card (its art is the coin; its name the hint). Absent for a non-card source (a party policy). */
  card?: CardName;
  kind: 'shift' | 'waive';
  /** For `shift`: the steps this source adds. */
  steps?: number;
  /** Spent by the next card played (an armed effect) — the coin wears the ⚡ pip. */
  oneShot: boolean;
};

/** The card behind a modifier, when a card is what bends the requirement. */
export function modifierSourceCard(source: EventSource): CardName | undefined {
  return source.kind === 'card' || source.kind === 'corporation' ? source.card : undefined;
}

function keyOf(source: EventSource, index: number): string {
  const card = modifierSourceCard(source);
  return card !== undefined ? `card:${card}` : `${source.kind}:${index}`;
}

export function modifierSourceOf(share: RequirementEasingSourceModel, index = 0): ModifierSourceVM {
  const card = modifierSourceCard(share.source);
  const vm: ModifierSourceVM = {key: keyOf(share.source, index), kind: share.kind, oneShot: share.oneShot};
  if (card !== undefined) {
    vm.card = card;
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

/**
 * MET ANYWAY — a SHIFTED requirement the scale already meets without the modifier: the bend changes nothing about this
 * card, so the face keeps its printed cassette and no surface lights it (a standing ±2 of Inventrix would otherwise
 * mark every card of the hand, drowning the cards it actually opens). A lifted requirement is never quiet — the
 * waiver is the one-play class's whole statement and the play spends it.
 */
export function easingIsQuiet(easing: Pick<RequirementEasingModel, 'effective' | 'met' | 'decisive'>): boolean {
  return easing.effective !== 'waived' && easing.met && !easing.decisive;
}
