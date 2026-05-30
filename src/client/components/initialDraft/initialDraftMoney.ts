/*
 * Деньги стартового экрана.
 *
 * Подсчёт начальных мегакредитов после выбора корпорации (+ опционального
 * набора стартовых проектных карт) и бонусов от выбранных прологов.
 *
 * Логика byte-for-byte перенесена из legacy `SelectInitialCards.vue`
 * (`getStartingMegacredits` + `getAfterPreludes` + `extra`). Все «магические»
 * пары (corp × prelude / corp × N-cards) — те же, что в оригинале:
 *   - Manutech получает M€ за production-box prelude'а.
 *   - Tharsis Republic — за prelude'ы, размещающие city.
 *   - Splice / Pharmacy Union — за microbe-теги.
 *   - Aphrodite / Polaris — за Venus / Ocean placement prelude'ы.
 *   - Luna First Inc — за moon-rate prelude'ы.
 *   - Head Start — +2 M€ за каждую выбранную проектную карту.
 *   - Sagitta Frontier Services — +4 M€ за саму себя.
 *
 * Чистые функции без DOM-зависимостей: используются как в шагах модала
 * (live recompute при изменении выбора), так и в финальной плашке.
 */

import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {sum} from '@/common/utils/utils';
import * as constants from '@/common/constants';

// Стоимость покупки одной проектной карты у выбранной корпорации.
// Большинство корп используют дефолтный `constants.CARD_COST`, но
// Helion / Vital Air / ряд других переопределяют (читается из
// ClientCard.cardCost). Если корпорация ещё не выбрана, возвращаем
// дефолт — это безопасное предположение для предварительного UI.
export function cardCostForCorp(corp: CardName | undefined): number {
  if (corp === undefined) {
    return constants.CARD_COST;
  }
  const corporation = getCardOrThrow(corp);
  return corporation.cardCost ?? constants.CARD_COST;
}

export function startingMegacredits(
  corp: CardName | undefined,
  projectCardsCount: number,
): number | undefined {
  if (corp === undefined) {
    return undefined;
  }
  const corporation = getCardOrThrow(corp);
  let starting = corporation.startingMegaCredits ?? 0;
  const cardCost = corporation.cardCost === undefined ? constants.CARD_COST : corporation.cardCost;
  starting -= projectCardsCount * cardCost;
  if (corp === CardName.SAGITTA_FRONTIER_SERVICES) {
    starting += 4;
  }
  return starting;
}

export function afterPreludes(
  corp: CardName | undefined,
  preludes: ReadonlyArray<CardName>,
  selectedProjectCardsCount: number,
): number {
  return sum(preludes.map((prelude) => {
    const card = getCardOrThrow(prelude);
    const base = card.startingMegaCredits ?? 0;
    return base + preludeExtraForCorp(corp, prelude, selectedProjectCardsCount);
  }));
}

function preludeExtraForCorp(
  corp: CardName | undefined,
  prelude: CardName,
  selectedProjectCardsCount: number,
): number {
  const card = getCardOrThrow(prelude);
  switch (corp) {
  case CardName.MANUTECH:
    return card.productionBox?.megacredits ?? 0;
  case CardName.THARSIS_REPUBLIC:
    switch (prelude) {
    case CardName.SELF_SUFFICIENT_SETTLEMENT:
    case CardName.EARLY_SETTLEMENT:
    case CardName.STRATEGIC_BASE_PLANNING:
      return 3;
    }
    return 0;
  case CardName.PHARMACY_UNION: {
    const microbeTags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
    return -4 * microbeTags;
  }
  case CardName.SPLICE: {
    const microbeTags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
    return 2 * microbeTags;
  }
  case CardName.APHRODITE:
    switch (prelude) {
    case CardName.VENUS_FIRST:
      return 4;
    case CardName.HYDROGEN_BOMBARDMENT:
      return 2;
    }
    return 0;
  case CardName.LUNA_FIRST_INCORPORATED:
    switch (prelude) {
    case CardName.FIRST_LUNAR_SETTLEMENT:
    case CardName.CORE_MINE:
    case CardName.BASIC_INFRASTRUCTURE:
      return 1;
    case CardName.MINING_COMPLEX:
      return 2;
    }
    return 0;
  case CardName.POLARIS:
    switch (prelude) {
    case CardName.AQUIFER_TURBINES:
    case CardName.POLAR_INDUSTRIES:
      return 4;
    case CardName.GREAT_AQUIFER:
      return 8;
    }
    return 0;
  case CardName.HEAD_START:
    return selectedProjectCardsCount * 2;
  case CardName.SAGITTA_FRONTIER_SERVICES: {
    const count = card.tags.filter((tag) => tag !== Tag.WILD).length;
    if (count === 0) {
      return 4;
    }
    if (count === 1) {
      return 1;
    }
    return 0;
  }
  default:
    return 0;
  }
}
