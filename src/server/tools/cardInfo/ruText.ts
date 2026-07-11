/*
 * RU TEXT for generated card-information blocks (build-time only).
 *
 * The generator bakes CONCRETE numbers into English block texts ('Gain 2
 * titanium.'), so the Russian side needs real declension — done HERE, at
 * build time, with explicit form tables (never at runtime). The output is
 * written to src/locales/ru/card_info.json by the generator.
 *
 * Form convention: [one, few, many] — «1 титан / 2 титана / 5 титанов».
 * Quantified-genitive convention (after «не менее / не более»): [gen-sg,
 * gen-pl] — «не менее 1 метки / не менее 2 меток».
 */

import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';

export function plural(n: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}

/** «не менее N <gen>» — genitive after a quantifier. */
export function quantGen(n: number, [genSg, genPl]: readonly [string, string]): string {
  return n === 1 ? genSg : genPl;
}

/* ── standard resources ─────────────────────────────────────────────── */

/** Accusative forms after «получите / потратьте»: 1 титан / 2 титана / 5 титанов. */
const RESOURCE_ACC: Readonly<Record<Resource, readonly [string, string, string]>> = {
  [Resource.MEGACREDITS]: ['М€', 'М€', 'М€'],
  [Resource.STEEL]: ['сталь', 'стали', 'стали'],
  [Resource.TITANIUM]: ['титан', 'титана', 'титана'],
  [Resource.PLANTS]: ['растение', 'растения', 'растений'],
  [Resource.ENERGY]: ['энергию', 'энергии', 'энергии'],
  [Resource.HEAT]: ['тепло', 'тепла', 'тепла'],
};

/** Genitive singular — «производство титана». */
const RESOURCE_PROD_GEN: Readonly<Record<Resource, string>> = {
  [Resource.MEGACREDITS]: 'М€',
  [Resource.STEEL]: 'стали',
  [Resource.TITANIUM]: 'титана',
  [Resource.PLANTS]: 'растений',
  [Resource.ENERGY]: 'энергии',
  [Resource.HEAT]: 'тепла',
};

export function ruResourceAcc(resource: Resource, n: number): string {
  return plural(n, RESOURCE_ACC[resource]);
}

export function ruResourceProdGen(resource: Resource): string {
  return RESOURCE_PROD_GEN[resource];
}

/* ── card resources ─────────────────────────────────────────────────── */

/** Accusative after «добавьте / удалите»: 1 животное / 2 животных / 5 животных. */
const CARD_RESOURCE_ACC: Partial<Record<CardResource, readonly [string, string, string]>> = {
  [CardResource.ANIMAL]: ['животное', 'животных', 'животных'],
  [CardResource.MICROBE]: ['бактерию', 'бактерии', 'бактерий'],
  [CardResource.SCIENCE]: ['жетон науки', 'жетона науки', 'жетонов науки'],
  [CardResource.FLOATER]: ['аэростат', 'аэростата', 'аэростатов'],
  [CardResource.ASTEROID]: ['астероид', 'астероида', 'астероидов'],
  [CardResource.FIGHTER]: ['истребитель', 'истребителя', 'истребителей'],
  [CardResource.CAMP]: ['лагерь', 'лагеря', 'лагерей'],
  [CardResource.DISEASE]: ['болезнь', 'болезни', 'болезней'],
  [CardResource.PRESERVATION]: ['жетон сохранения', 'жетона сохранения', 'жетонов сохранения'],
  [CardResource.GRAPHENE]: ['графен', 'графена', 'графена'],
  [CardResource.HYDROELECTRIC_RESOURCE]: ['гидроресурс', 'гидроресурса', 'гидроресурсов'],
  [CardResource.RESOURCE_CUBE]: ['куб ресурса', 'куба ресурсов', 'кубов ресурсов'],
  [CardResource.DATA]: ['жетон данных', 'жетона данных', 'жетонов данных'],
};

export function ruCardResourceAcc(resource: CardResource, n: number): string {
  const forms = CARD_RESOURCE_ACC[resource];
  return forms === undefined ? resource.toLowerCase() : plural(n, forms);
}

/* ── tags (genitive after «меток») ──────────────────────────────────── */

const TAG_GEN: Readonly<Record<Tag, string>> = {
  [Tag.BUILDING]: 'строительства',
  [Tag.SPACE]: 'космоса',
  [Tag.SCIENCE]: 'науки',
  [Tag.POWER]: 'энергии',
  [Tag.EARTH]: 'Земли',
  [Tag.JOVIAN]: 'Юпитера',
  [Tag.VENUS]: 'Венеры',
  [Tag.PLANT]: 'растений',
  [Tag.MICROBE]: 'бактерий',
  [Tag.ANIMAL]: 'животных',
  [Tag.CITY]: 'города',
  [Tag.MOON]: 'Луны',
  [Tag.MARS]: 'Марса',
  [Tag.CRIME]: 'преступности',
  [Tag.WILD]: 'вопроса',
  [Tag.EVENT]: 'события',
  [Tag.CLONE]: 'клона',
};

export function ruTagGen(tag: Tag): string {
  return TAG_GEN[tag];
}

/** «метка/метки/меток» quantified-genitive: 1 метки / 2 меток. */
export const TAG_WORD_QGEN: readonly [string, string] = ['метки', 'меток'];

/* ── misc countables (quantified genitive) ──────────────────────────── */

export const OCEAN_TILE_QGEN: readonly [string, string] = ['тайла океана', 'тайлов океана'];
export const CITY_TILE_QGEN: readonly [string, string] = ['тайла города', 'тайлов города'];
export const GREENERY_TILE_QGEN: readonly [string, string] = ['тайла озеленения', 'тайлов озеленения'];
export const COLONY_QGEN: readonly [string, string] = ['колонии', 'колоний'];
export const FLOATER_QGEN: readonly [string, string] = ['аэростата', 'аэростатов'];
export const RESOURCE_TYPE_QGEN: readonly [string, string] = ['типа ресурсов', 'типов ресурсов'];

/** «карта» accusative after «возьмите»: 1 карту / 2 карты / 5 карт. */
export const CARD_ACC: readonly [string, string, string] = ['карту', 'карты', 'карт'];
/** «шаг» after «на»: на 1 шаг / на 2 шага / на 5 шагов (usually omitted — «на 1»). */
export const STEP_ACC: readonly [string, string, string] = ['шаг', 'шага', 'шагов'];
