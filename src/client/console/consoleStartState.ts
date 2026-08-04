/*
 * CONSOLE START SCENE state + pure wizard logic — CTS T5
 * (docs/CONSOLE_MODE_CONCEPT.md §CTS-1). Serves the `initialCards` prompt (the
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
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {InputResponse, SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import * as titles from '@/common/inputs/SelectInitialCards';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus, StatusPresentation} from '@/client/components/overview/playerStatusPresenter';

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
  /**
   * Steps whose SURFACE has already presented once this setup session (the
   * deal cinematic + the CSS materialize stagger are FIRST-VISIT beats): a
   * revisited step is the same physical table the player left — its cards
   * stand, they never re-deal and never re-materialize.
   */
  visited: new Set<number>(),
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
  consoleStartState.visited = new Set<number>();
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

// ── the GAME START WORKSPACE view models (Journey Rail + Selection Dock) ────

export type StartJourneyItem = {
  id: string,
  label: string,
  state: 'completed' | 'current' | 'available' | 'locked',
};

const JOURNEY_LABEL: Record<StartWizardStepId, string> = {
  corp: 'Corporation',
  prelude: 'Preludes',
  ceo: 'CEO',
  projects: 'Projects',
};

/**
 * The PREPARATION journey (tabs mode): completed steps are revisitable, the
 * next step unlocks only when the current one satisfies its pick contract,
 * and the SUMMARY unlocks when every step does — the rail never promises a
 * stage its prerequisites don't allow.
 */
export function startJourneyItems(
  steps: ReadonlyArray<StartWizardStep>,
  picks: InitialCardsPicks,
  railPos: number,
): ReadonlyArray<StartJourneyItem> {
  const items: Array<StartJourneyItem> = steps.map((s, i) => {
    const complete = stepComplete(s, picks);
    let state: StartJourneyItem['state'];
    if (i === railPos) {
      state = 'current';
    } else if (i < railPos) {
      state = complete ? 'completed' : 'available';
    } else {
      // A future step is reachable only when every step BEFORE it is done.
      state = steps.slice(0, i).every((p) => stepComplete(p, picks)) ? 'available' : 'locked';
    }
    return {id: s.id, label: JOURNEY_LABEL[s.id], state};
  });
  const allDone = steps.every((s) => stepComplete(s, picks));
  items.push({
    id: 'summary',
    label: 'Summary',
    state: railPos >= steps.length ? 'current' : (allDone ? 'available' : 'locked'),
  });
  return items;
}

/**
 * The DEPLOYMENT journey (progress mode): the irreversible start sequence as
 * a linear readout — corporation → payment (when cards were bought) →
 * preludes → done. States derive from the live ceremony predicates the scene
 * already owns; this is presentation math only.
 */
export function deploymentJourneyItems(signals: {
  corpPending: boolean,
  payPending: boolean,
  boughtCards: boolean,
  preludesLeft: number,
  hasPreludes: boolean,
}): ReadonlyArray<StartJourneyItem> {
  const items: Array<StartJourneyItem> = [];
  const corpState = signals.corpPending ? 'current' : 'completed';
  items.push({id: 'corp', label: 'Corporation', state: corpState});
  if (signals.boughtCards) {
    items.push({
      id: 'pay',
      label: 'Projects',
      state: signals.corpPending ? 'locked' : (signals.payPending ? 'current' : 'completed'),
    });
  }
  if (signals.hasPreludes) {
    const before = signals.corpPending || signals.payPending;
    items.push({
      id: 'preludes',
      label: 'Preludes',
      state: before ? 'locked' : (signals.preludesLeft > 0 ? 'current' : 'completed'),
    });
  }
  const allDone = !signals.corpPending && !signals.payPending && signals.preludesLeft === 0;
  items.push({id: 'ready', label: 'Ready', state: allDone ? 'current' : 'locked'});
  return items;
}

export type StartDockPileModel = {
  id: StartWizardStepId,
  label: string,
  count: number,
};

/**
 * The SELECTION DOCK piles: one compact face-down pile per COLLECTED step —
 * a step's picks live in the dock only while the player stands PAST it
 * (collected on RT, returned on LT), and on the SUMMARY every pile is
 * conceptually open (counts stay — the piles are the summary's source).
 */
export function startDockPiles(
  steps: ReadonlyArray<StartWizardStep>,
  picks: InitialCardsPicks,
  railPos: number,
): ReadonlyArray<StartDockPileModel> {
  const out: Array<StartDockPileModel> = [];
  steps.forEach((s, i) => {
    if (i >= railPos) {
      return; // the live / future steps still hold their cards in the grid
    }
    out.push({id: s.id, label: JOURNEY_LABEL[s.id], count: picksForStep(picks, s.id).length});
  });
  return out;
}

/** One OTHER player at the table, as the summary's readiness readout sees them. */
export type StartCrewMate = {
  color: Color,
  /** The RAW model name — the view resolves it (participantDisplayName). */
  name: string,
  isMarsBot: boolean,
  /** The SHARED status presentation (same brain as the top status strip). */
  status: StatusPresentation,
  /** The server is STILL waiting on this player's setup pick. */
  picking: boolean,
};

/**
 * The summary's launch readout: WHO else the game is still waiting on, and
 * whether the viewer's confirm is the last input the game needs.
 */
export type StartLaunchState = {
  /** Every player EXCEPT the viewer, in seat order (empty in a solo game). */
  others: ReadonlyArray<StartCrewMate>,
  /** Those of `others` still owing a setup pick. */
  pending: ReadonlyArray<StartCrewMate>,
  /**
   * Nobody else owes anything → the viewer's confirm genuinely STARTS the
   * game (it is the last input the server needs), so it earns the «Begin the
   * game» CTA. While false the confirm merely SUBMITS the viewer's choice and
   * the wait continues — hence the two verbs.
   *
   * NEVER gate the submit itself on this: two humans sitting on their
   * summaries are BOTH pending for each other, so a hard gate would leave
   * them waiting forever.
   */
  launches: boolean,
};

/**
 * Derive the launch readout from the view + the LIVE `/api/waitingFor` poll.
 *
 * Reuses `actionLabelForPlayer` + `presentPlayerStatus` — the same brain the
 * top status strip and the desktop player cards read — so the summary rail
 * and the strip can never disagree about who is still choosing. The live poll
 * is load-bearing here: while the viewer holds the `initialCards` prompt the
 * playerView is deliberately NOT refreshed (it would drop their partial
 * picks), so the model's `isWaitingForInput` snapshot goes stale and only the
 * poll can tell that another player has since submitted.
 *
 * ⚠️ `waitingOnPlayers` sits at its `[]` default until the first (timer-armed)
 * poll lands, and a bare `[]` would read as "the server is waiting on nobody"
 * — the summary would flash the launch CTA while everyone is still choosing.
 * `liveWaitingSignal` is the shared normalization for exactly that.
 */
export function startLaunchState(
  view: PlayerViewModel,
  livePlayersWaitingFor?: ReadonlyArray<Color>,
): StartLaunchState {
  const viewer = view.thisPlayer.color;
  const live = liveWaitingSignal(livePlayersWaitingFor);
  const others: Array<StartCrewMate> = [];
  for (const player of view.players) {
    if (player.color === viewer) {
      continue;
    }
    const isMarsBot = player.isMarsBot === true;
    const status = presentPlayerStatus(
      actionLabelForPlayer(view, player, live), isMarsBot);
    others.push({
      color: player.color,
      name: player.name,
      isMarsBot,
      status,
      // 'active' is the one category that means "the server is waiting on
      // them" — during setup that can only be their own initial pick.
      picking: status.category === 'active',
    });
  }
  const pending = others.filter((mate) => mate.picking);
  return {others, pending, launches: pending.length === 0};
}
