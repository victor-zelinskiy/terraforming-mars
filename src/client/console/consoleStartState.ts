/*
 * CONSOLE START SCENE state + pure wizard logic — CTS T5
 * (CONSOLE_MODE_CONCEPT.md §CTS-1). Serves the `initialCards` prompt (the
 * game-opening corporation / preludes / CEO / project-buy composite) as a
 * console-native multi-step wizard.
 *
 * The MODULE STATE holds the player's in-progress picks so a defer
 * (B → inspect the board / Info Mode) or a playerView-driven re-render can
 * never lose them (the same survival pattern as journalState / sale mode).
 *
 * The PURE helpers mirror the desktop InitialDraftFlowOverlay contracts:
 *  - steps are identified by the STABLE server title constants
 *    (`common/inputs/SelectInitialCards` — plain strings, never mutated
 *    by i18n, exactly what the desktop overlay matches on);
 *  - the submitted `SelectInitialCardsResponse` is built by iterating the
 *    SERVER's option order — byte-identical to the desktop overlay's
 *    corp → preludes → ceo → projects shape;
 *  - money math is REUSED from `initialDraft/initialDraftMoney.ts`
 *    (one brain — Manutech/Tharsis/… corp×prelude pairs never fork).
 *
 * Unit-tested under the server runner
 * (tests/client/components/console/consoleStartState.spec.ts).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {InputResponse, SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import * as titles from '@/common/inputs/SelectInitialCards';

export type StartWizardStepId = 'corp' | 'prelude' | 'ceo' | 'projects';

export type StartWizardStep = {
  id: StartWizardStepId,
  input: SelectCardModel & {type: 'card'},
};

/** The player's in-progress wizard picks (survives defer / re-renders). */
export const consoleStartState = reactive({
  ownerId: '',
  signature: '',
  /** Index into wizardSteps(); === steps.length → the SUMMARY step. */
  stepIdx: 0,
  corp: undefined as CardName | undefined,
  preludes: [] as Array<CardName>,
  ceo: undefined as CardName | undefined,
  projects: [] as Array<CardName>,
});

/** Reset picks when the prompt identity (player / deal) changes. */
export function ensureStartWizard(ownerId: string, signature: string): void {
  if (consoleStartState.ownerId === ownerId && consoleStartState.signature === signature) {
    return;
  }
  consoleStartState.ownerId = ownerId;
  consoleStartState.signature = signature;
  consoleStartState.stepIdx = 0;
  consoleStartState.corp = undefined;
  consoleStartState.preludes = [];
  consoleStartState.ceo = undefined;
  consoleStartState.projects = [];
}

function rawTitle(t: string | Message | undefined): string {
  if (t === undefined) {
    return '';
  }
  return typeof t === 'string' ? t : t.message;
}

/**
 * The wizard's card steps, derived from the SERVER's options (title
 * constants — the same identification the desktop overlay uses). Order is
 * the server's (corp → prelude → ceo → projects).
 */
export function wizardSteps(input: SelectInitialCardsModel): Array<StartWizardStep> {
  const steps: Array<StartWizardStep> = [];
  for (const option of input.options) {
    if (option.type !== 'card') {
      continue;
    }
    switch (rawTitle(option.title)) {
    case titles.SELECT_CORPORATION_TITLE:
      steps.push({id: 'corp', input: option});
      break;
    case titles.SELECT_PRELUDE_TITLE:
      steps.push({id: 'prelude', input: option});
      break;
    case titles.SELECT_CEO_TITLE:
      steps.push({id: 'ceo', input: option});
      break;
    case titles.SELECT_PROJECTS_TITLE:
      steps.push({id: 'projects', input: option});
      break;
    default:
      break;
    }
  }
  return steps;
}

export type InitialCardsPicks = {
  corp: CardName | undefined,
  preludes: ReadonlyArray<CardName>,
  ceo: CardName | undefined,
  projects: ReadonlyArray<CardName>,
};

/** The current picks for one step (single-pick steps normalize to arrays). */
export function picksForStep(picks: InitialCardsPicks, id: StartWizardStepId): ReadonlyArray<CardName> {
  switch (id) {
  case 'corp':
    return picks.corp !== undefined ? [picks.corp] : [];
  case 'prelude':
    return picks.preludes;
  case 'ceo':
    return picks.ceo !== undefined ? [picks.ceo] : [];
  case 'projects':
    return picks.projects;
  }
}

/** Is this step's pick complete per the SERVER's min/max? */
export function stepComplete(step: StartWizardStep, picks: InitialCardsPicks): boolean {
  const n = picksForStep(picks, step.id).length;
  return n >= step.input.min && n <= step.input.max;
}

/**
 * The aggregated response, byte-identical to the desktop overlay's shape:
 * one `{type:'card', cards}` per PRESENT option, in the SERVER's order.
 */
export function buildInitialCardsResponse(
  input: SelectInitialCardsModel,
  picks: InitialCardsPicks,
): SelectInitialCardsResponse {
  const responses: Array<InputResponse> = [];
  for (const option of input.options) {
    if (option.type !== 'card') {
      continue;
    }
    switch (rawTitle(option.title)) {
    case titles.SELECT_CORPORATION_TITLE:
      if (picks.corp !== undefined) {
        responses.push({type: 'card', cards: [picks.corp]});
      }
      break;
    case titles.SELECT_PRELUDE_TITLE:
      responses.push({type: 'card', cards: [...picks.preludes]});
      break;
    case titles.SELECT_CEO_TITLE:
      if (picks.ceo !== undefined) {
        responses.push({type: 'card', cards: [picks.ceo]});
      }
      break;
    case titles.SELECT_PROJECTS_TITLE:
      responses.push({type: 'card', cards: [...picks.projects]});
      break;
    default:
      break;
    }
  }
  return {type: 'initialCards', responses};
}

/** A stable prompt signature (dealt sets identify the deal). */
export function initialCardsSignature(input: SelectInitialCardsModel): string {
  const parts: Array<string> = [];
  for (const option of input.options) {
    if (option.type === 'card') {
      parts.push(`${rawTitle(option.title)}:${option.cards.map((c) => c.name).join(',')}`);
    }
  }
  return parts.join('|');
}

/** Convenience narrowing for the shell / scene. */
export function initialCardsInputOf(wf: PlayerInputModel | undefined): SelectInitialCardsModel | undefined {
  return wf !== undefined && wf.type === 'initialCards' ? wf : undefined;
}
