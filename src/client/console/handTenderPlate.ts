/*
 * THE HAND'S TENDER PLATE — К-H1 (TR48 Supercomputer, the owner's decision
 * 2026-10-12): «what will pay for this card», on the hand tile, for a card that
 * M€ ALONE cannot pay.
 *
 * A Science card affordable only thanks to the data on Supercomputer used to
 * read as simply «playable»: the card's price and the data that would go were
 * two screens apart (the hand and the composer's payment block). The plate
 * names the CARD-BOUND tender the opening mix will spend — data on
 * Supercomputer, mechs on EVA / Construction Mechs, floaters on Dirigibles,
 * microbes on Psychrophiles, … — never steel or titanium (their rows stand on
 * the rail beside the hand and say it themselves).
 *
 * The number is the panel's own: the SAME pure functions the play composer
 * opens its payment block with (`projectCardPaymentPrompt` → `paymentLanes` →
 * `initialCounts`, the greedy order the owner set) — so the plate and the
 * panel can never disagree about what goes. Nothing here re-states a gate or
 * a rate: the tag gate is `projectCardPaymentOptions` (guarded against the
 * server's own copy, `paymentTagGateParity.spec`), the rates `rateFor`.
 *
 * Pure (the manifest is read for the card's printed tags), no Vue / DOM / i18n.
 */
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SPENDABLE_CARD_RESOURCES, SpendableCardResource} from '@/common/inputs/Spendable';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {initialCounts, megacreditsAvailable, paymentLanes, projectCardPaymentPrompt} from '@/client/console/paymentPlan';

/** One card-bound unit the opening mix spends on this card, how many, and the M€ they are worth there (count × rate). */
export type HandTenderItem = {unit: SpendableCardResource, count: number, megacredits: number};

/**
 * The card-bound tender the opening mix spends on `card` — empty when M€ alone
 * covers the price (the plate is about a card that would otherwise NOT be
 * paid), when the card is free, or when the mix needs no card resource at all.
 * In the panel's own order (the greedy order — the owner's decision 2026-10-12).
 */
export function handTenderItems(card: CardModel, player: PublicPlayerModel): ReadonlyArray<HandTenderItem> {
  const cost = card.calculatedCost ?? 0;
  const mc = megacreditsAvailable(player);
  if (cost <= 0 || mc >= cost) {
    return [];
  }
  let tags: ReadonlyArray<Tag> = [];
  try {
    tags = getCard(card.name)?.tags ?? [];
  } catch (err) {
    tags = [];
  }
  // The standing grants the play prompt would carry (Helion's heat, Luna Trade Federation's titanium, Martian
  // Lumber Corp's plants) — the same flags the rail's value badges read off the model.
  const grants = {
    heat: player.canUseHeatAsMegaCredits === true,
    lunaTradeFederationTitanium: player.canUseTitaniumAsMegacredits === true,
    plants: player.canUsePlantsAsMegacredits === true,
  };
  const prompt = projectCardPaymentPrompt(cost, tags, grants, player.lastCardPlayed, card.reserveUnits);
  const lanes = paymentLanes(prompt, player);
  if (!lanes.some((lane) => (SPENDABLE_CARD_RESOURCES as ReadonlyArray<string>).includes(lane.unit))) {
    return [];
  }
  const counts = initialCounts(cost, lanes, mc);
  return lanes
    .filter((lane): lane is typeof lane & {unit: SpendableCardResource} =>
      (SPENDABLE_CARD_RESOURCES as ReadonlyArray<string>).includes(lane.unit) && (counts[lane.unit] ?? 0) > 0)
    .map((lane) => ({unit: lane.unit, count: counts[lane.unit] ?? 0, megacredits: (counts[lane.unit] ?? 0) * lane.rate}));
}
