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

export const GENERIC_PAYMENT_ORDER: ReadonlyArray<SpendableResource> = [
  'steel',
  'titanium',
  'heat',
  'seeds',
  'auroraiData',
  'kuiperAsteroids',
  'spireScience',
  'graphene',
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

export function buildStandardProjectPaymentOptions(
  baseOptions: Partial<PaymentOptions>,
  card: CardModel,
): Partial<PaymentOptions> {
  const canPayWith = card.standardProjectCanPayWith ?? {};
  return {
    ...baseOptions,
    steel: canPayWith.steel === true,
    titanium: canPayWith.titanium === true,
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
  };
}

export function standardProjectPaymentTitle(cardName: CardName): Message {
  return {
    message: 'Pay for ${0}',
    data: [{type: LogMessageDataType.CARD as const, value: cardName}],
  };
}
