/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WILD-RESOURCE CHOICE IN A COMPOSER (P43 · ledgers EN / EO): an action whose `or` is «the same price → a standard
 * resource OR a resource on any card» (the server stamps each branch's ROLE — `ActionPreviewBranch.wildChoice`, never a
 * title) is ONE printed row, «[science] −1 → ?», whose door opens the shared exclusive inner step
 * (`ConsoleWildChoiceStep`). The step's answer IS the composer's own state — no second draft to drift:
 *  · the plate = the selected BRANCH (`selectedPos`);
 *  · the slot = the answer of that branch's own input step (`resource` → `{type: 'resource', resource}`; `card` →
 *    `{type: 'card', cards: [name]}`), captured at the step's index and addressed at the commit like any step.
 * Pure: the plan, the specification, the parts read back, the row's answer.
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ActionPreviewBranch, VictoryPointsDelta} from '@/common/models/ActionPreviewModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {WildChoiceSpec, WildKind, WildParts} from '@/client/console/wildChoice/wildChoiceInner';

/** Where the two branches stand and which of their steps the slot answers. */
export type WildBranchPlan = {
  standardPos: number,
  cardPos: number,
  /** The index of the standard branch's `resource` step (its `captured` key). */
  resourceStep: number | undefined,
  /** The index of the card branch's `card` step. */
  cardStep: number | undefined,
};

/** The plan of a composer's branches — undefined unless the server stamped exactly the two roles among `positions`. */
export function wildBranchPlan(branches: ReadonlyArray<ActionPreviewBranch>, positions: ReadonlyArray<number>): WildBranchPlan | undefined {
  if (positions.length !== 2) {
    return undefined;
  }
  const standardPos = positions.find((p) => branches[p]?.wildChoice === 'standard');
  const cardPos = positions.find((p) => branches[p]?.wildChoice === 'onCard');
  if (standardPos === undefined || cardPos === undefined) {
    return undefined;
  }
  const stepOf = (pos: number, type: string): number | undefined => {
    const at = branches[pos]?.steps.findIndex((s) => s.kind === 'input' && s.input.type === type) ?? -1;
    return at >= 0 ? at : undefined;
  };
  return {standardPos, cardPos, resourceStep: stepOf(standardPos, 'resource'), cardStep: stepOf(cardPos, 'card')};
}

/** The card branch's live pick (its candidates and their readings), when the rules leave it one. */
export function wildCardPick(plan: WildBranchPlan, branches: ReadonlyArray<ActionPreviewBranch>): {input: SelectCardModel, vpBox?: Partial<Record<CardName, VictoryPointsDelta>>} | undefined {
  const step = plan.cardStep === undefined ? undefined : branches[plan.cardPos]?.steps[plan.cardStep];
  return step?.kind === 'input' && step.input.type === 'card' ? {input: step.input as SelectCardModel, ...(step.vpBox !== undefined ? {vpBox: step.vpBox} : {})} : undefined;
}

/** The standard branch's resource budget (the prompt's own amount, 1 by default). */
export function wildStandardAmount(plan: WildBranchPlan, branches: ReadonlyArray<ActionPreviewBranch>): number {
  const step = plan.resourceStep === undefined ? undefined : branches[plan.standardPos]?.steps[plan.resourceStep];
  const amount = step?.kind === 'input' ? (step.input as {amount?: number}).amount : undefined;
  return amount ?? 1;
}

/**
 * THE SPECIFICATION of an exclusive wild choice: the OR always asked, «on a card» refused WITH ITS REASON when the card
 * branch is (never hidden — invariant 2), the candidates the server's pick lists, the grid a RADIO for the standard
 * branch's budget and nothing for «a card».
 */
export function wildComposerSpec(plan: WildBranchPlan, branches: ReadonlyArray<ActionPreviewBranch>): WildChoiceSpec {
  const card = branches[plan.cardPos];
  const pick = wildCardPick(plan, branches);
  const amount = wildStandardAmount(plan, branches);
  return {
    or: card?.available === true && pick !== undefined ? {} : {onCardOff: 'No card with a resource'},
    holders: pick?.input.cards.map((c) => c.name) ?? [],
    amount: (wild) => wild === 'asStandard' ? amount : 0,
    exclusive: true,
    lanes: 'radio',
  };
}

/** The candidates' live models (the server's), for their faces. */
export function wildCandidates(plan: WildBranchPlan, branches: ReadonlyArray<ActionPreviewBranch>): ReadonlyArray<CardModel> {
  return wildCardPick(plan, branches)?.input.cards ?? [];
}

/** The parts READ BACK from the composer's own state — the branch and the step answers. */
export function wildPartsFrom(plan: WildBranchPlan, selectedPos: number | undefined, captured: Readonly<Record<number, unknown>>): WildParts {
  if (selectedPos === plan.standardPos) {
    const answer = plan.resourceStep === undefined ? undefined : captured[plan.resourceStep] as {type?: string, resource?: string} | undefined;
    return {wild: {wild: 'asStandard'}, ...(answer?.type === 'resource' && answer.resource !== undefined ? {spread: {[answer.resource]: 1}} : {})};
  }
  if (selectedPos === plan.cardPos) {
    const answer = plan.cardStep === undefined ? undefined : captured[plan.cardStep] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
    const card = answer?.type === 'card' ? answer.cards?.[0] : undefined;
    return {wild: {wild: 'onCard', ...(card !== undefined ? {card} : {})}};
  }
  return {};
}

/** The branch position a plate answers. */
export function wildPosOf(plan: WildBranchPlan, kind: WildKind): number {
  return kind === 'asStandard' ? plan.standardPos : plan.cardPos;
}

/** The ROW's answer read back in chips: «[сталь] +1» or «[животное] +1 · Птицы» — undefined while open. */
export type WildRowAnswer = {kind: 'standard', resource: string, amount: number} | {kind: 'card', card: CardName, amount: number};

export function wildRowAnswer(plan: WildBranchPlan, branches: ReadonlyArray<ActionPreviewBranch>, parts: WildParts): WildRowAnswer | undefined {
  if (parts.wild?.wild === 'asStandard') {
    const entry = Object.entries(parts.spread ?? {}).find(([, n]) => n > 0);
    return entry === undefined ? undefined : {kind: 'standard', resource: entry[0], amount: wildStandardAmount(plan, branches)};
  }
  if (parts.wild?.wild === 'onCard' && parts.wild.card !== undefined) {
    return {kind: 'card', card: parts.wild.card, amount: 1};
  }
  return undefined;
}
