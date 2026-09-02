import {CardName} from '@/common/cards/CardName';
import {PaymentOptions} from '@/common/inputs/Payment';
import {
  CARD_FOR_SPENDABLE_RESOURCE,
  SPENDABLE_CARD_RESOURCES,
  SpendableCardResource,
  SpendableResource,
} from '@/common/inputs/Spendable';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {Units} from '@/common/Units';

export type SpendablePaymentAmounts = Record<SpendableResource, number>;

/**
 * EVERY way a generic (project-card / SelectPayment) price can be paid, in
 * panel order. A unit MISSING here is a unit the payment surface cannot even
 * offer — `paymentLanes` iterates exactly this list — so the list must stay a
 * superset of `SPENDABLE_RESOURCES`; `paymentOptionsAllowResource` + a
 * 0-balance check are what narrow it per prompt. Dropping `plants`,
 * `microbes`, `floaters` and `lunaArchivesScience` here (they were only ever
 * absent by omission) silently disabled Martian Lumber Corp, Psychrophiles,
 * Dirigibles and Luna Archives in EVERY console payment: the server offered
 * `paymentOptions.plants`, and the client had nowhere to put the lane.
 *
 * Order carries the DEFAULT allocation too (computeDefaultPayment spends
 * alternates in this sequence), so it mirrors the upstream project-card order.
 */
export const GENERIC_PAYMENT_ORDER: ReadonlyArray<SpendableResource> = [
  'steel',
  'titanium',
  'heat',
  'plants',
  'microbes',
  'floaters',
  'lunaArchivesScience',
  'seeds',
  'auroraiData',
  'kuiperAsteroids',
  'spireScience',
  'graphene',
  // Modular Floodgates stored steel — LAST among the alternates on purpose:
  // it is a strategically protected source (`initialCounts` never seeds it;
  // the player raises the dial explicitly), so the default allocation must
  // exhaust every ordinary source before the panel even reaches it.
  'floodgateSteel',
  'megacredits',
];

export const STANDARD_PROJECT_PAYMENT_ORDER: ReadonlyArray<SpendableResource> = [
  'steel',
  'titanium',
  'heat',
  'seeds',
  'auroraiData',
  'kuiperAsteroids',
  'spireScience',
  'megacredits',
];

export function spendableCardResourceAmount(
  player: PublicPlayerModel,
  resource: SpendableCardResource,
): number {
  const cardName = CARD_FOR_SPENDABLE_RESOURCE[resource];
  return player.tableau.find((card) => card.name === cardName)?.resources ?? 0;
}

export function paymentAvailableHeat(player: PublicPlayerModel): number {
  const stormcraft = player.tableau.find((card) => card.name === CardName.STORMCRAFT_INCORPORATED);
  if (stormcraft?.resources !== undefined) {
    return (player.heat ?? 0) + (stormcraft.resources * 2);
  }
  return player.heat ?? 0;
}

export function getSpendablePaymentAmounts(player: PublicPlayerModel): SpendablePaymentAmounts {
  const cardResources = Object.fromEntries(
    SPENDABLE_CARD_RESOURCES.map((resource) => [resource, spendableCardResourceAmount(player, resource)]),
  ) as Record<SpendableCardResource, number>;

  return {
    megacredits: player.megacredits ?? 0,
    heat: paymentAvailableHeat(player),
    steel: player.steel ?? 0,
    titanium: player.titanium ?? 0,
    plants: player.plants ?? 0,
    ...cardResources,
  };
}

export function paymentOptionsAllowResource(
  options: Partial<PaymentOptions>,
  unit: SpendableResource,
): boolean {
  if (unit === 'megacredits') {
    return true;
  }
  if (unit === 'titanium') {
    return options.titanium === true || options.lunaTradeFederationTitanium === true;
  }
  return options[unit] === true;
}

/**
 * A standard project's ways to pay — a CLOSED list mirroring the server's own
 * (`SelectStandardProjectToPlay.process`), deliberately NOT a spread of the
 * card-play options.
 *
 * `baseOptions` is the PROJECT-CARD grant set, and it carries units a standard
 * project does not accept: Martian Lumber Corp's `plants` rides in on
 * `SelectCardToPlay.toModel` and the server's standard-project branch has no
 * `plants` term at all, so a spread would offer the player a lane the submit is
 * then rejected for («Did not spend enough to pay for standard project»).
 * Everything this list omits is denied by construction rather than by whichever
 * units happen to be missing upstream.
 */
export function buildStandardProjectPaymentOptions(
  baseOptions: Partial<PaymentOptions>,
  card: CardModel,
): Partial<PaymentOptions> {
  const canPayWith = card.standardProjectCanPayWith ?? {};
  return {
    heat: baseOptions.heat === true,
    steel: canPayWith.steel === true,
    titanium: canPayWith.titanium === true,
    lunaTradeFederationTitanium: baseOptions.lunaTradeFederationTitanium === true,
    seeds: canPayWith.seeds === true,
    kuiperAsteroids: canPayWith.kuiperAsteroids === true,
    auroraiData: true,
    spireScience: true,
  };
}

export function hasUsableStandardProjectAlternativeResources(
  player: PublicPlayerModel,
  card: CardModel,
  baseOptions: Partial<PaymentOptions>,
): boolean {
  const paymentOptions = buildStandardProjectPaymentOptions(baseOptions, card);
  const available = getSpendablePaymentAmounts(player);
  return STANDARD_PROJECT_PAYMENT_ORDER
    .filter((unit) => unit !== 'megacredits')
    .some((unit) => paymentOptionsAllowResource(paymentOptions, unit) && available[unit] > 0);
}

export function buildStandardProjectPaymentModel(
  playerView: PlayerViewModel,
  actionInput: SelectProjectCardToPlayModel,
  card: CardModel,
  title: string | Message,
  amount: number,
): SelectPaymentModel {
  const available = getSpendablePaymentAmounts(playerView.thisPlayer);
  return {
    type: 'payment',
    title,
    buttonLabel: 'Pay',
    amount,
    paymentOptions: buildStandardProjectPaymentOptions(actionInput.paymentOptions ?? {}, card),
    seeds: available.seeds,
    auroraiData: available.auroraiData,
    kuiperAsteroids: available.kuiperAsteroids,
    spireScience: available.spireScience,
    reserveUnits: card.reserveUnits ?? Units.EMPTY,
    floaters: available.floaters,
    microbes: available.microbes,
    graphene: available.graphene,
    floodgateSteel: available.floodgateSteel,
  };
}

export function standardProjectPaymentTitle(cardName: CardName): Message {
  return {
    message: 'Pay for ${0}',
    data: [{type: LogMessageDataType.CARD as const, value: cardName}],
  };
}
