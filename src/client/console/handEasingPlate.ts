/*
 * THE HAND'S «REQUIREMENT UNDER AN EFFECT» PLATE (TR49 class) — the third
 * reader of the hand tile's plate (`countedPlay.handForecastPlate` reads a
 * walk / a counted play, `handTenderPlate` the tender): a hand card whose
 * printed global requirement a modifier bends says so ON THE TILE, before
 * the player focuses it — «[t°] ±2» (shifted), «[t°]» struck (ignored), a
 * check when the card is playable ONLY thanks to it. Pure: every number is
 * the server's `CardModel.requirementEasing`; nothing is compared here.
 */
import {CardModel} from '@/common/models/CardModel';
import {RequirementEasingModel} from '@/common/models/ArmedPlayEffectModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {ModifierSourceVM, easingIsQuiet, modifierSourcesOf} from '@/client/components/premiumCard/premiumModifierSources';

/** One bent requirement on the plate: its scale's icon and the bend — «±2» or the strike of a waiver. */
export type HandEasingItem = {
  /** The scale's icon (the board's own art). */
  iconClass: string;
  /** `waived` draws the icon struck through (the scan's red diagonal); `shift` prints «±N». */
  kind: 'shift' | 'waive';
  /** The TOTAL bend (every source summed). */
  steps: number;
  /** WHAT bends it — one mark per source (a card on the table / the one-play bolt / a policy), before the player focuses it. */
  sources: ReadonlyArray<ModifierSourceVM>;
};

export type HandEasingPlate = {
  items: ReadonlyArray<HandEasingItem>;
  /** The card is playable ONLY thanks to a modifier — the plate ends with a check (form, not colour). */
  decisive: boolean;
  /** A modifier here is spent by the next play (an armed effect) — the plate wears the one-play mark. */
  oneShot: boolean;
};

/** At most this many bent requirements on one plate (cards print one or two global requirements). */
const MAX_ITEMS = 2;

function itemOf(easing: RequirementEasingModel): HandEasingItem {
  const steps = easing.sources.reduce((sum, s) => sum + (s.steps ?? 0), 0);
  return {
    iconClass: iconClassFor(easing.parameter),
    kind: easing.effective === 'waived' ? 'waive' : 'shift',
    steps,
    sources: modifierSourcesOf(easing),
  };
}

/**
 * The plate a hand card wears for its bent requirements, or none. Every bent
 * requirement is listed (a permanent ±2 of Inventrix included — «требование
 * под эффектом» is one language), the decisive state is the card's.
 */
export function handEasingPlate(card: CardModel): HandEasingPlate | undefined {
  // A requirement met ANYWAY under a shift says nothing on the tile (`easingIsQuiet`): a standing ±2 would mark the
  // whole hand and drown the cards it actually opens.
  const easings = (card.requirementEasing ?? []).filter((e) => !easingIsQuiet(e));
  if (easings.length === 0) {
    return undefined;
  }
  return {
    items: easings.slice(0, MAX_ITEMS).map(itemOf),
    decisive: easings.some((e) => e.decisive),
    oneShot: easings.some((e) => e.sources.some((s) => s.oneShot)),
  };
}
