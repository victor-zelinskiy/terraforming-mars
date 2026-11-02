/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VENUS BONUS, PRE-SELECTED (P89 · ledger EL — the owner, 2026-11-02: «для розыгрыша карт либо активации действий
 * синих карт реализовать полноценный pre-select на бонус шкалы Венеры (если проходит несколько делений — так же
 * распределить LB/RB) … последнее деление сделать отдельным pre-select, т.к. у него вложенный шаг (либо на карту, либо
 * стандартный ресурс)»). The PURE half both composers stand on — the play sheet and the blue action's setup — so the
 * two can never answer the bonus differently.
 *
 * The server's preview step (`ActionPreviewStep` `venusBonus`) carries the VERY prompt it will ask. A composer reads it
 * as up to TWO rows, each its own pre-select, both answering ONE response at the step's index:
 *  · the WILD (30 % only, with a card that can hold it) — a card pick with a decline: «on a card» picks through the
 *    target row's own grammar, RT «a standard resource instead» declines (the optional-choice law: a choice whose one
 *    answer is a pick IS that pick, the refusal a button). Its model is SYNTHESISED from the live branch-0 `SelectCard`
 *    beside a skip-marked option (`venusWildChoiceModel`) — the composer's existing `or` door answers it as it answers
 *    any optional pick;
 *  · the SPREAD — the standard resources laid out over the six gain lanes, the LAYOUT row's grammar (TR78): ←→ between
 *    the lanes, LB/RB one unit, RT the rest, the commit held until the sum is exact. Its sum is the base, +1 when the
 *    wild is taken as a standard resource.
 * The composed answer is `venusBonusResponse` — byte-identical to what the live surface (`ConsoleVenusBonus`) POSTs —
 * and rides the batch ADDRESSED (role `venusBonus` + the raising card). A state that moved since the preview is
 * refused by the live prompt and asked for real: the hosted step stays the fallback.
 */
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel, SelectCardModel, VenusBonusPromptMeta, AndOptionsModel} from '@/common/models/PlayerInputModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {VenusWildChoice, venusBaseCount, venusBonusResponse, venusWildTargets} from '@/client/console/compositePrompts';
import {SpreadState, spreadComplete} from '@/client/console/cardResourceDistribution';
import {STANDARD_UNITS} from '@/client/console/taskResponses';
import {VenusBonusCellArm} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {translateText} from '@/client/directives/i18n';

/** «Шкала Венеры 16 % → 18 %» — the raise that earned the bonus (`VenusBonusPromptMeta.step`), or '' (an older save). ONE reading for the hosted surface and the composers' row. */
export function venusStepReading(meta: VenusBonusPromptMeta | undefined): string {
  const step = meta?.step;
  return step === undefined ? '' : `${translateText('Venus scale')} ${step.from} % → ${step.to} %`;
}

/** The two parts of the step a composer draws as rows. */
export type VenusBonusPart = 'wild' | 'spread';

/** What a composer collected for ONE bonus step: the wild's answer (when it asks) and the spread. */
export type VenusBonusParts = {
  wild?: {wild: VenusWildChoice, card?: CardName},
  spread?: SpreadState,
};

/** The marker of a step's prompt (`venusBonusPrompt`) — undefined for anything else. */
export function venusBonusMetaOf(input: PlayerInputModel | undefined): VenusBonusPromptMeta | undefined {
  return input?.venusBonusPrompt;
}

/** Does the step ask the WILD as its own part (30 % with a card able to hold it)? With no such card the server asks the bare `base + 1`. */
export function venusWildAsks(meta: VenusBonusPromptMeta): boolean {
  return meta.kind === 'final' && venusWildTargets(meta).length > 0;
}

/** The parts a composer draws, in order: the wild first (it decides the spread's sum), then the spread. */
export function venusBonusParts(meta: VenusBonusPromptMeta): ReadonlyArray<VenusBonusPart> {
  return venusWildAsks(meta) ? ['wild', 'spread'] : ['spread'];
}

/** The live branch-0 card pick (`AndOptions(SelectCard, GainResources)`), as the server serialised it. */
function wildCardModel(input: PlayerInputModel): SelectCardModel | undefined {
  if (input.type !== 'or') {
    return undefined;
  }
  const onCard = (input as OrOptionsModel).options[0];
  if (onCard?.type !== 'and') {
    return undefined;
  }
  const pick = (onCard as AndOptionsModel).options.find((o) => o.type === 'card');
  return pick as SelectCardModel | undefined;
}

/** The decline's words — the wild taken as one more standard resource. */
export const VENUS_WILD_STANDARD_KEY = 'Take one more standard resource';

/**
 * THE WILD'S ROW MODEL — an OPTIONAL CHOICE (`optionalChoice.ts`): the live card pick beside ONE skip-marked option.
 * The composer's `or` door answers it the way it answers every optional pick (the target row; RT declines). Undefined
 * when the step asks no wild.
 */
export function venusWildChoiceModel(input: PlayerInputModel): OrOptionsModel | undefined {
  const meta = venusBonusMetaOf(input);
  const pick = wildCardModel(input);
  if (meta === undefined || !venusWildAsks(meta) || pick === undefined) {
    return undefined;
  }
  const decline = {type: 'option', title: VENUS_WILD_STANDARD_KEY, buttonLabel: VENUS_WILD_STANDARD_KEY, metadata: {kind: 'skip'}} as unknown as PlayerInputModel;
  return {
    type: 'or',
    title: 'Wild resource',
    buttonLabel: 'Confirm',
    options: [{...pick, title: 'Put it on a card'} as PlayerInputModel, decline],
  } as unknown as OrOptionsModel;
}

/** Read the wild row's `or` answer back into the bonus's own terms. */
export function venusWildOfAnswer(answer: unknown): VenusBonusParts['wild'] {
  const or = answer as {type?: string, index?: number, response?: {type?: string, cards?: ReadonlyArray<CardName>}} | undefined;
  if (or?.type !== 'or') {
    return undefined;
  }
  if (or.index === 0 && or.response?.type === 'card' && or.response.cards?.[0] !== undefined) {
    return {wild: 'onCard', card: or.response.cards[0]};
  }
  if (or.index === 1) {
    return {wild: 'asStandard'};
  }
  return undefined;
}

/** The spread's sum — the base, +1 once the wild is declined into a standard resource (or always, with no wild row). */
export function venusSpreadAmount(meta: VenusBonusPromptMeta, parts: VenusBonusParts): number {
  if (meta.kind === 'final' && !venusWildAsks(meta)) {
    return meta.baseCount + 1;
  }
  return venusBaseCount(meta, parts.wild?.wild);
}

/** The six lane keys, in the order the server's `GainResources` builds them. */
export const VENUS_SPREAD_LANES: ReadonlyArray<string> = STANDARD_UNITS;

/** Is a part answered? The wild — chosen; the spread — its sum exact (an empty spread of a zero sum is complete). */
export function venusPartAnswered(meta: VenusBonusPromptMeta, parts: VenusBonusParts, part: VenusBonusPart): boolean {
  if (part === 'wild') {
    return parts.wild !== undefined;
  }
  return spreadComplete(venusSpreadAmount(meta, parts), parts.spread ?? {});
}

/** THE STEP'S ANSWER once every part stands — undefined before (the commit is held). */
export function venusPreselectResponse(meta: VenusBonusPromptMeta, parts: VenusBonusParts): unknown | undefined {
  if (!venusBonusParts(meta).every((part) => venusPartAnswered(meta, parts, part))) {
    return undefined;
  }
  return venusBonusResponse(meta, parts.spread ?? {}, parts.wild?.wild, parts.wild?.card);
}

/**
 * THE CELL BEAT'S PROMISE (PL-1437) for a pre-selected answer — the rows and the card the wild lands on, flown off the
 * cell the step reaches once the board tells it. `preselected`: no bonus prompt will stand (`venusBonusAnswerApplied`).
 */
export function venusPreselectArm(meta: VenusBonusPromptMeta, parts: VenusBonusParts): VenusBonusCellArm {
  const units: Partial<Record<string, number>> = {};
  for (const [key, n] of Object.entries(parts.spread ?? {})) {
    if (n > 0) {
      units[key] = n;
    }
  }
  const card = parts.wild?.wild === 'onCard' ? parts.wild.card : undefined;
  const resource = card !== undefined ? getCard(card)?.resourceType : undefined;
  return {
    units,
    ...(card !== undefined && resource !== undefined ? {card: {name: card, resource: cardResourceKey(String(resource))}} : {}),
    ...(meta.step !== undefined ? {step: meta.step} : {}),
    preselected: true,
  };
}
