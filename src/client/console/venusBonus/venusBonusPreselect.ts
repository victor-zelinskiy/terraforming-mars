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
 * as ONE row (its answer read back in chips) and answers it in an INNER step (`venusBonusInner.ts` — ledger EM): the
 * 30 % wild's OR (only where it is really taken), «put it on a card» or one more standard resource, the six standard
 * lanes on a fixed 2 × 3 grid (LB/RB one unit, RT the rest), its own confirm leaving the step.
 * The composed answer is `venusBonusResponse` — byte-identical to what the live surface (`ConsoleVenusBonus`) POSTs —
 * and rides the batch ADDRESSED (role `venusBonus` + the raising card). A state that moved since the preview is
 * refused by the live prompt and asked for real: the hosted step stays the fallback.
 *
 * A bonus earned by ONE option of an `or` step (Atmoscoop's «temperature OR Venus», PL-1505) is CONDITIONAL
 * (`step.when`): the row stands, and the answer rides, only while that option is the answer (`venusWhenHolds`).
 */
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, PlayerInputModel, SelectCardModel, VenusBonusPromptMeta, AndOptionsModel} from '@/common/models/PlayerInputModel';
import {CardModel} from '@/common/models/CardModel';
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
export function wildCardModel(input: PlayerInputModel): SelectCardModel | undefined {
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

/** The wild's candidates as the server serialised them (their live faces and counts) — undefined for no wild. */
export function venusWildCandidates(input: PlayerInputModel | undefined): ReadonlyArray<CardModel> | undefined {
  return input === undefined ? undefined : wildCardModel(input)?.cards;
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
    return parts.wild?.wild === 'asStandard' || (parts.wild?.wild === 'onCard' && parts.wild.card !== undefined);
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

/**
 * A CONDITIONAL bonus (PL-1505): `when` names the `or` step and the option that earns it. Holds while the captured
 * answer of that step IS that option (`{type: 'or', index}`); no `when` — always.
 */
export function venusWhenHolds(when: {step: number, option: number} | undefined, captured: Readonly<Record<number, unknown>>): boolean {
  if (when === undefined) {
    return true;
  }
  const answer = captured[when.step] as {type?: string, index?: number} | undefined;
  return answer?.type === 'or' && answer.index === when.option;
}

/** The row's reading of an answer: the units per lane (in lane order) and the card the wild lands on. */
export type VenusBonusSummary = {units: ReadonlyArray<{key: string, n: number}>, card?: CardName};

export function venusBonusSummary(parts: VenusBonusParts): VenusBonusSummary {
  const units = VENUS_SPREAD_LANES.flatMap((key) => {
    const n = parts.spread?.[key] ?? 0;
    return n > 0 ? [{key, n}] : [];
  });
  const card = parts.wild?.wild === 'onCard' ? parts.wild.card : undefined;
  return {units, ...(card !== undefined ? {card} : {})};
}
