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
import {CardModel} from '@/common/models/CardModel';
import {buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {InputResponse, SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import * as titles from '@/common/inputs/SelectInitialCards';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus, StatusPresentation} from '@/client/components/overview/playerStatusPresenter';
import {resetStartTransition, startTransitionActive} from '@/client/console/startStageDirector';

export type StartWizardStepId = 'corp' | 'prelude' | 'ceo' | 'projects';

export type StartWizardStep = {
  id: StartWizardStepId,
  input: SelectCardModel & {type: 'card'},
};

/**
 * The Game Start Workspace's FLOW STATE — the one motion director's phase.
 * Input gates on it (a press during a transfer can neither double-fire nor
 * act on geometry that is mid-flight):
 *  - 'idle'               — a live selection surface, everything pressable;
 *  - 'docking'            — RT collect: picks are flying into their pile;
 *  - 'returning'          — LT return: a pile is flying back into its slots;
 *  - 'revealing-summary'  — the piles are opening into the summary tiles;
 *  - 'stowing-summary'    — the summary is folding back into the piles;
 *  - 'committing'         — the initialCards response is on the wire;
 *  - 'materializing'      — GAME STATE MATERIALIZATION (status preview →
 *                           Top HUD + Player Rail, shell re-bounds);
 *  - 'deploying'          — the irreversible deployment is live (per-press
 *                           busy-ness rides playedHeroState, not this);
 *  - 'completing'         — every real effect settled; the flow commits its
 *                           final rail and consolidates to terminal READY;
 *  - 'releasing'          — the workspace's final dissolve back to the board.
 */
export type StartFlowState =
  | 'idle' | 'docking' | 'returning' | 'revealing-summary' | 'stowing-summary'
  | 'committing' | 'materializing' | 'deploying' | 'completing' | 'releasing';

/** The player's in-progress wizard picks (survives defer / re-renders). */
export const consoleStartState = reactive({
  ownerId: '',
  signature: '',
  /** Presentation structure of the canonical server deal. Kept after the
   *  `initialCards` prompt disappears so the committed selection phase can
   *  still name exactly the categories the player actually traversed. This
   *  stores no availability or completion truth. */
  stepIds: [] as Array<StartWizardStepId>,
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
  /** The motion director's phase (see StartFlowState). */
  flow: 'idle' as StartFlowState,
  /**
   * PHYSICAL pile-count drift — the shelf follows the CARDS, not the state
   * flip. A collect sets `-N` the instant the step advances (the backs are
   * still airborne) and each touchdown adds one back; a return sets `+N`
   * (the backs are still lying there) and each departure removes one. The
   * dock renders `target + drift` — a back can never appear before its card
   * lands, and never remains after its card left.
   */
  dockDrift: {} as Record<string, number>,
  /**
   * THE WORKSPACE LIFETIME HOLD. The root Game Start Workspace must survive
   * the COMMIT and every prompt gap of the deployment (submit round trips,
   * the pause between two start prompts): the shell keeps the scene mounted
   * while this is true, even when `waitingFor` momentarily names nothing.
   * Set at the summary commit; released only by the scene's own final
   * release beat (the deployment settled) — never by a prompt gap.
   */
  hold: false,
  /**
   * THE DEPLOYMENT HAS BEGUN — latched the first time the SERVER actually
   * hands this player their start sequence (the corporation play / a
   * prelude / a Merger pick).
   *
   * A submitted setup is NOT a started game: in a multiplayer table the
   * server holds everyone until the last player confirms, so between the
   * commit and the real start sequence the viewer has NO prompt at all.
   * Deriving the deployment from «the wizard input is gone» turned that gap
   * into an EMPTY deployment — no queue, no hand dock, and (once minimized)
   * no way back. The latch is the honest signal: until it flips, the player
   * is WAITING on their own summary; once it flips it never flips back (the
   * deployment's own prompt gaps must not undo it).
   */
  deploymentBegun: false,
  /**
   * THE FIRST-ACTION STAGE (the deployment's conditional last stage).
   *
   * MODULE state, not the scene's `data()`: the workspace UNMOUNTS when the
   * player collapses it (`workspaceFrameMounted` counts live frames only, and
   * a collapse PARKS the frame), so a stage machine living in the component
   * resets on every restore — the stage re-entered from scratch, replaying
   * the corporation's rise and the room's recede, which is exactly the
   * «РАЗЫГРАНО melькает» flash on restore. Everything that must survive the
   * collapse lives here, beside the picks and the lifetime hold.
   *  · 'idle'       — no stage;
   *  · 'staging'    — the corp card is rising into the source seat;
   *  · 'standing'   — the briefing stands (waiting for the turn, or live);
   *  · 'performing' — submitted; the action's own follow-ups are running;
   *  · 'leaving'    — the chain resolved; the card settles home.
   */
  firstAct: {
    stage: 'idle' as 'idle' | 'staging' | 'standing' | 'performing' | 'leaving',
    corp: undefined as CardName | undefined,
    /** The submit is on the wire — the one anti-double-press latch. */
    submitting: false,
  },
  /** The stage has stood at least once this game — keeps its journey chapter
   *  visible (completed) after the action resolves. */
  firstActionSeen: false,
  /**
   * THE BONUS-ACTION STAGE (Head Start's «immediately take 2 actions»).
   *
   * MODULE state for the same reason `firstAct` is: the workspace UNMOUNTS on
   * a collapse, and a latch living in the component would reset — the stage
   * would re-announce the hand-off the player already confirmed, over a board
   * they are already acting on.
   *  · 'idle'      — no bonuses owed;
   *  · 'staging'   — the granting card is rising out of «РАЗЫГРАНО» into the
   *                  stage's source seat (the briefing has a SUBJECT — that is
   *                  what makes it an embedded stage rather than a modal);
   *  · 'standing'  — the briefing stands, waiting for the player to confirm;
   *  · 'onboard'   — confirmed: the board has the screen, and the workspace
   *                  has let go of it entirely. This records the CONSENT, so a
   *                  restore does not ask twice.
   */
  bonusAct: {
    stage: 'idle' as 'idle' | 'staging' | 'standing' | 'onboard',
    /** The card that granted them — the stage's subject. */
    source: undefined as CardName | undefined,
  },
  /** The stage has stood at least once this game — keeps its journey chapter
   *  visible (completed) after the bonuses are spent, so the rail never
   *  shortens a chapter the player actually walked. */
  bonusActionSeen: false,
});

/** Reset picks when the prompt identity (player / deal) changes. */
export function ensureStartWizard(
  ownerId: string,
  signature: string,
  stepIds: ReadonlyArray<StartWizardStepId> = [],
): void {
  if (consoleStartState.ownerId === ownerId && consoleStartState.signature === signature) {
    if (stepIds.length > 0) {
      consoleStartState.stepIds = [...stepIds];
    }
    return;
  }
  consoleStartState.ownerId = ownerId;
  consoleStartState.signature = signature;
  consoleStartState.stepIds = [...stepIds];
  consoleStartState.stepIdx = 0;
  consoleStartState.corp = undefined;
  consoleStartState.preludes = [];
  consoleStartState.ceo = undefined;
  consoleStartState.projects = [];
  consoleStartState.visited = new Set<number>();
  consoleStartState.flow = 'idle';
  consoleStartState.dockDrift = {};
  // A FRESH deal identity is a fresh game start — a stale lifetime hold from
  // an earlier game (rematch) must never leak into this one's preparation.
  consoleStartState.hold = false;
  consoleStartState.deploymentBegun = false;
  consoleStartState.firstAct = {stage: 'idle', corp: undefined, submitting: false};
  consoleStartState.firstActionSeen = false;
  consoleStartState.bonusAct = {stage: 'idle', source: undefined};
  consoleStartState.bonusActionSeen = false;
  resetStartTransition();
}

/** Shift one pile's physical drift (see dockDrift). */
export function driftDockPile(id: string, delta: number): void {
  consoleStartState.dockDrift[id] = (consoleStartState.dockDrift[id] ?? 0) + delta;
}

/** A transfer finished — that pile's physique matches its state again. */
export function clearDockDrift(id?: string): void {
  if (id === undefined) {
    consoleStartState.dockDrift = {};
    return;
  }
  delete consoleStartState.dockDrift[id];
}

/**
 * The scene is mid-motion / mid-commit — selection input must wait.
 *
 * A live STAGE TRANSITION counts: the director owns the whole press-to-stable
 * -frame window, and input reopens only when it ends (its last phase). The
 * lock is never FELT, because the physical response to the press starts in
 * the same interaction frame — see `startStageDirector`.
 */
export function startFlowBusy(): boolean {
  return startTransitionActive() ||
    (consoleStartState.flow !== 'idle' && consoleStartState.flow !== 'deploying');
}

/** Keep the Game Start Workspace mounted across prompt gaps (the shell reads
 *  this beside its `startTask` serving predicate). */
export function holdStartScene(): void {
  consoleStartState.hold = true;
}

/** The deployment settled (or the commit was refused) — the shell may let the
 *  scene go the moment no start prompt is live. */
export function releaseStartScene(): void {
  consoleStartState.hold = false;
}

export function startSceneHeld(): boolean {
  return consoleStartState.hold;
}

/** The server handed this player their start sequence — see the latch. */
export function markStartDeploymentBegun(): void {
  consoleStartState.deploymentBegun = true;
}

export function startDeploymentBegun(): boolean {
  return consoleStartState.deploymentBegun;
}

/**
 * THE SETUP IS SENT AND THE TABLE IS STILL WAITING — the viewer has no
 * wizard input (their picks are final) and the deployment has not begun.
 * The one predicate both the scene (its waiting summary) and the shell (the
 * minimized announce) read, so they can never disagree about it.
 */
/**
 * The MINIMIZED start workspace's announcement copy — the one surface that
 * legitimately stands with no live prompt (the table is still confirming, or
 * the first-action stage is waiting out another player's move), so
 * `consoleTaskSummary` (which keys on a TaskKind) has nothing for it. Pure
 * + key-based, exactly like that module: the shell never writes a label.
 */
export type StartDeferredState = 'awaiting-table' | 'awaiting-first-action' | 'in-progress';

export function startDeferredSummary(state: StartDeferredState): {kickerKey: string, askKey: string, returnKey: string} {
  switch (state) {
  case 'awaiting-table':
    return {
      kickerKey: 'Start of the game · waiting',
      askKey: 'Waiting for the rest of the table',
      returnKey: 'Return to the start of the game',
    };
  case 'awaiting-first-action':
    // The deployment is through its cards; the corporation's mandatory first
    // action is the one thing left, and it unlocks on the player's own turn.
    return {
      kickerKey: 'Start of the game · first action',
      askKey: 'The first corporation action awaits your turn',
      returnKey: 'Return to the start of the game',
    };
  case 'in-progress':
    return {
      kickerKey: 'Start of the game',
      askKey: 'Continue the start of the game',
      returnKey: 'Return to the start of the game',
    };
  }
}

export function startAwaitingOthers(view: PlayerViewModel): boolean {
  // AWAITING means «my choices are in and the server asks NOTHING of me».
  // Any live prompt — a setup SelectColony, a prelude's follow-up — is the
  // opposite of waiting: the player IS the acting one, the hosting workspace
  // is the interaction owner, and painting «ожидаем других игроков» over an
  // active mandatory choice was a false blocked state (the embedded-colonies
  // field report). The one prompt that does NOT break the wait is the wizard
  // itself — that case is already excluded by the initialCards check.
  return consoleStartState.hold && !consoleStartState.deploymentBegun &&
    view.waitingFor === undefined;
}

/**
 * THE VIEWER'S OWN SETUP IS PLAYED — their chosen corporation is on the
 * table (the deferred `corporationPlay` has been answered).
 *
 * The SERVER-AUTHORITATIVE half of the deployment latch, and the one honest
 * personal reading of generation-1 RESEARCH: that phase is a TABLE state,
 * never a per-player one. `Game.playerIsFinishedWithResearchPhase` holds it
 * until the LAST seat has played AND paid, so between one player's own
 * payment and the table's release they sit in gen-1 RESEARCH with no prompt
 * at all — while owning a real hand whose bought cards are physically flying
 * into the dock. Solo vs MarsBot never shows that window: the bot is
 * pre-seeded into `researchedPlayers`, so the human's own confirm flips the
 * phase in the same response and the gap has zero length.
 *
 * Read via the PICKED corporation ∩ the tableau (both plain model fields —
 * no card manifest, so this stays testable under the server runner) and it
 * is monotone: unlike `deploymentBegun` it also survives a reload landing
 * straight in that wait.
 */
export function startCorporationPlayed(view: PlayerViewModel): boolean {
  if (view.pickedCorporationCard.length === 0) {
    return false;
  }
  const onTable = new Set(view.thisPlayer.tableau.map((c) => c.name));
  return view.pickedCorporationCard.some((c) => onTable.has(c.name));
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

/**
 * The DRAFT-voice availability of ONE start-wizard card — built by the SHARED
 * `cardAvailability` model, the very one the between-generation draft
 * workspace, the research buy and the fullscreen viewer already use. Nothing
 * is re-derived here: the input is the server's own `unplayableReasons`
 * (`SelectInitialCards` opts the project step in), and the initial hand is
 * bought FOR LATER, so only PRINTED REQUIREMENTS speak — amber «требование
 * пока не выполнено» while the game can still get there, red «уже не
 * выполнить» only where the server could PROVE it. Read against the global
 * parameters the game will actually start at (the server computes them at
 * that very moment, before a single track has moved).
 * `undefined` = nothing to say.
 */
export function startCardAvailability(card: CardModel | undefined): CardAvailabilityView | undefined {
  return buildCardAvailability({reasons: card?.unplayableReasons}, 'draft');
}

/**
 * Does this step reserve the status rail's TWO-ROW availability zone?
 *
 * Asked of the WHOLE step, never of the focused card: the reserve must not
 * change as the focus moves, or the card grid above would resize under the
 * player's hands (the draft's status rail reserves for exactly that reason).
 * And it is asked THROUGH the shared model rather than through a hand-rolled
 * reason filter, so the reserve and the block can never disagree about what
 * «has something to say» means. A step whose cards are all within reach — or
 * that has no project cards at all (corporations, preludes, CEOs) — keeps the
 * compact one-row rail and gives the pixels back to the cards.
 */
export function stepShowsAvailability(cards: ReadonlyArray<CardModel>): boolean {
  return cards.some((card) => startCardAvailability(card) !== undefined);
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
 * next step unlocks only when the current one satisfies its pick contract.
 * The SUMMARY additionally waits until the optional PROJECTS surface has
 * actually been visited once: choosing zero cards is valid, but the rail must
 * not visually offer a review screen beside an optional category the player
 * has not looked at yet.
 */
export function startJourneyItems(
  steps: ReadonlyArray<StartWizardStep>,
  picks: InitialCardsPicks,
  railPos: number,
  visitedSteps: ReadonlySet<number>,
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
  const projectsIndex = steps.findIndex((step) => step.id === 'projects');
  const projectsSeen = projectsIndex < 0 || visitedSteps.has(projectsIndex);
  items.push({
    id: 'summary',
    label: 'Summary',
    state: railPos >= steps.length ? 'current' : (allDone && projectsSeen ? 'available' : 'locked'),
  });
  return items;
}

/**
 * The server has accepted the initialCards response, so every category that
 * belonged to that exact deal is irreversibly complete. `stepIds` is only the
 * remembered shape of the canonical prompt; the commit itself is still the
 * real `hold/deploymentBegun` state, never a visual latch.
 */
export function committedStartJourneyItems(
  stepIds: ReadonlyArray<StartWizardStepId>,
): ReadonlyArray<StartJourneyItem> {
  return [
    ...stepIds.map((id) => ({id, label: JOURNEY_LABEL[id], state: 'completed' as const})),
    {id: 'summary', label: 'Summary', state: 'completed' as const},
  ];
}

/**
 * The DEPLOYMENT journey (progress mode): the irreversible start sequence as
 * a linear readout — corporation → payment (when cards were bought) →
 * preludes → first action (when the corporation owes one) → done. Every
 * middle stage is CONDITIONAL: it exists only when its work exists, so a
 * corp with no first action never shows an empty stage and an empty buy
 * never shows a payment. States derive from the live ceremony predicates
 * the scene already owns; this is presentation math only.
 */
export function deploymentJourneyItems(signals: {
  corpPending: boolean,
  payPending: boolean,
  boughtCards: boolean,
  preludesLeft: number,
  hasPreludes: boolean,
  /** A prelude granted BONUS ACTIONS (Head Start) — the deployment gains one
   *  more chapter, between the preludes and the first action. Conditional like
   *  every other middle stage: it exists only when its work exists. */
  hasBonusActions?: boolean,
  /** Those bonuses are not spent yet (the stage stands, or the player is out
   *  on the board spending them). */
  bonusActionsPending?: boolean,
  /** The corporation owes a mandatory first action (domain ledger / live
   *  prompt) OR its stage is still physically on screen. Absent → no stage. */
  hasFirstAction?: boolean,
  /** That first action is not resolved yet (waiting for the turn, live,
   *  or its causal chain still running). */
  firstActionPending?: boolean,
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
  const beforePreludes = signals.corpPending || signals.payPending;
  if (signals.hasPreludes) {
    items.push({
      id: 'preludes',
      label: 'Preludes',
      // `available` = STARTED BUT NOT WHERE YOU ARE. Exactly the prelude
      // chapter's state while the bonus actions it just handed out are being
      // spent: not finished (a prelude is still in hand), not current (the
      // player is out on the board), and never a ✓ that would have to be taken
      // back. Only ONE chapter is `current` at a time, which is what makes the
      // rail readable at couch distance.
      state: beforePreludes ? 'locked' :
        (signals.preludesLeft > 0 ?
          (signals.bonusActionsPending === true ? 'available' : 'current') :
          'completed'),
    });
  }
  // The BONUS chapter sits between the preludes and the first action — which is
  // exactly where it happens: Head Start's actions are taken immediately, ahead
  // of the player's remaining preludes… but the rail reads as a linear
  // PROGRESS, and the honest reading order for a player watching it is «прологи
  // → бонусные действия → первое действие». It is `current` while the bonuses
  // stand AND while the player is out on the board spending them, so the rail
  // never says «this chapter is over» while the board is still theirs.
  const beforeBonus = beforePreludes;
  if (signals.hasBonusActions === true) {
    items.push({
      id: 'bonusActions',
      label: 'Bonus actions',
      state: beforeBonus ? 'locked' : (signals.bonusActionsPending === true ? 'current' : 'completed'),
    });
  }
  const beforeFirstAction = beforePreludes || signals.preludesLeft > 0 ||
    signals.bonusActionsPending === true;
  if (signals.hasFirstAction === true) {
    items.push({
      id: 'firstAction',
      label: 'First action',
      state: beforeFirstAction ? 'locked' : (signals.firstActionPending === true ? 'current' : 'completed'),
    });
  }
  const allDone = !beforeFirstAction && signals.firstActionPending !== true;
  items.push({id: 'ready', label: 'Ready', state: allDone ? 'current' : 'locked'});
  return items;
}

// ── the workspace breadcrumb (СТАРТ ПАРТИИ › <ГРУППА> › <ЭТАП>) ────────────

export type StartCrumb = {
  /** The crumb's SUBJECT (i18n key) — the stable stage group. '' = root only. */
  subject: string,
  /** The mutable STAGE tail (i18n key) — the only animating segment. */
  stage: string,
};

const STEP_SUBJECT: Record<StartWizardStepId, string> = {
  corp: 'Corporation',
  prelude: 'Preludes',
  ceo: 'CEO',
  projects: 'Projects',
};

/**
 * The PREPARATION crumb: stable context BEFORE the mutable stage —
 * `СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ВЫБОР` … `СТАРТ ПАРТИИ › ПРОЕКТЫ › ПОКУПКА` →
 * `СТАРТ ПАРТИИ › СВОДКА`. The subject is the step GROUP (never the focused
 * card — focus moves every d-pad press, the line must not).
 */
export function wizardCrumb(stepId: StartWizardStepId | undefined): StartCrumb {
  if (stepId === undefined) {
    return {subject: 'Summary', stage: ''};
  }
  return {
    subject: STEP_SUBJECT[stepId],
    stage: stepId === 'projects' ? 'Purchase' : 'Selection',
  };
}

/**
 * The DEPLOYMENT crumb — the same grammar past the commit boundary (the
 * header renders it amber): `… › КОРПОРАЦИЯ › РОЗЫГРЫШ`, `… › ПРОЕКТЫ ›
 * ПОКУПКА`, `… › ПРОЛОГИ › РОЗЫГРЫШ`, and `… › <ГРУППА> › ДОБОР КАРТ` while
 * an embedded reveal presents inside the workspace. Signals are the live
 * ceremony predicates the scene already owns; this is presentation math only.
 */
export function deploymentCrumb(signals: {
  /** The embedded follow-up's OWN stage name (workspaceOutcomeState.phaseKey),
   *  '' when it published nothing — the crumb then says the honest generic. */
  embedPhase?: string,
  /** An embedded reveal is presenting (the source group keeps the subject). */
  embedActive: boolean,
  /** The embed's source group ('Corporation' | 'Preludes'), when known. */
  embedSubject?: string,
  corpPending: boolean,
  payPending: boolean,
  corpPick: boolean,
  /** The mandatory first-action stage owns the tail (preludes resolved). */
  firstAction?: boolean,
  /** The bonus-action stage owns the tail (a prelude granted extra actions). */
  bonusAction?: boolean,
  /** The card that granted them — the bonus stage's subject. */
  bonusSource?: string,
  /** The corp's mandatory first action is being spent AS bonus action #1 —
   *  the crumb keeps the WINDOW as its subject and only the tail names the
   *  nested item («СТАРТ ПАРТИИ › ФОРА › ПЕРВОЕ ДЕЙСТВИЕ»). */
  bonusNested?: boolean,
}): StartCrumb {
  if (signals.embedActive) {
    return {
      subject: signals.embedSubject ?? 'Preludes',
      stage: signals.embedPhase !== undefined && signals.embedPhase !== '' ? signals.embedPhase : 'Card draw',
    };
  }
  if (signals.payPending) {
    return {subject: 'Projects', stage: 'Purchase'};
  }
  if (signals.corpPending || signals.corpPick) {
    return {subject: 'Corporation', stage: 'Playing'};
  }
  // NESTED: the mandatory first action spent as bonus action #1. The WINDOW
  // keeps the subject (it is the flow the player is in) and only the tail
  // names the item — the workspace never appears to leave «Фора» for a
  // chapter of its own.
  if (signals.firstAction === true && signals.bonusAction === true) {
    return {
      subject: signals.bonusSource !== undefined && signals.bonusSource !== '' ?
        signals.bonusSource :
        'Preludes',
      stage: 'First action',
    };
  }
  // THE FIRST-ACTION STAGE — the same grammar one stage further: the subject
  // returns to the corporation (the card back on stage IS the corp), the
  // one-word tail names the stage. Never «ПЕРВОЕ ДЕЙСТВИЕ КОРПОРАЦИИ» — the
  // subject already says whose it is (never echo the subject's noun).
  if (signals.firstAction === true) {
    return {subject: 'Corporation', stage: 'First action'};
  }
  // THE BONUS-ACTION STAGE — the subject is the CARD that granted them (it is
  // what the whole stage is about, and it is what the player is looking at),
  // the one-word tail names the stage. «СТАРТ ПАРТИИ › ФОРА › ДЕЙСТВИЕ».
  if (signals.bonusAction === true) {
    return {
      subject: signals.bonusSource !== undefined && signals.bonusSource !== '' ?
        signals.bonusSource :
        'Preludes',
      stage: 'Action',
    };
  }
  return {subject: 'Preludes', stage: 'Playing'};
}

/**
 * The PLAY-FROM-HAND crumb («Эпатажный спонсор» / «Эксперты по экологии»).
 *
 * Stable context BEFORE the mutable stage, exactly like every other workspace
 * of the family: the SOURCE CARD is the subject and never changes for the
 * whole effect, while the tail advances КАРТЫ В РУКЕ → РОЗЫГРЫШ → РАЗЫГРАНО.
 * The stage names come from the composer itself (`setWorkspaceStageName`), so
 * the crumb can never disagree with the screen — it only supplies the honest
 * default for the browse layer, where no composer has published anything yet.
 */
export function sponsorCrumb(signals: {
  /** The card whose effect asked for the play ('' / undefined → generic). */
  source?: string,
  /** The composer's own published stage key ('' while browsing the hand). */
  stage: string,
  /** Past the commit boundary — the header renders the tail amber. */
  committed: boolean,
}): StartCrumb {
  return {
    subject: signals.source !== undefined && signals.source !== '' ? signals.source : 'Preludes',
    stage: signals.stage !== '' ? signals.stage : 'Cards in hand',
  };
}

export type StartDockPileModel = {
  id: StartWizardStepId,
  label: string,
  /** The INFORMATIONAL count (collected picks — the «КОРПОРАЦИЯ · 1» trace). */
  count: number,
  /** Backs PHYSICALLY lying in the pile right now (drift-adjusted — they
   *  follow the flying cards, never the state flip). */
  backs: number,
  /** The step whose picks these are has been collected past (i < railPos). */
  collected: boolean,
};

/**
 * The SELECTION DOCK piles. EVERY step's pile exists from the first frame —
 * a pile is a physical DESTINATION and a flight cannot target an element
 * that mounts only after the flight (the exact bug that turned the collect
 * into a teleport). A step's cards LIE in its pile only while the player
 * stands PAST it (collected on RT, returned on LT). ON THE SUMMARY the cards
 * themselves are laid out in the tiles — the backs have physically LEFT the
 * shelf (one visual owner, never a duplicate), and only the informational
 * count trace remains.
 */
export function startDockPiles(
  steps: ReadonlyArray<StartWizardStep>,
  picks: InitialCardsPicks,
  railPos: number,
  drift: Record<string, number> = {},
): ReadonlyArray<StartDockPileModel> {
  const onSummary = railPos >= steps.length;
  return steps.map((s, i) => {
    const collected = i < railPos;
    const picksN = picksForStep(picks, s.id).length;
    const targetBacks = collected && !onSummary ? picksN : 0;
    const backs = Math.max(0, targetBacks + (drift[s.id] ?? 0));
    return {
      id: s.id,
      label: JOURNEY_LABEL[s.id],
      count: onSummary ? picksN : backs,
      backs,
      collected,
    };
  });
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

/** One seat of the PREPARATION's compact participant strip. */
export type StartParticipant = {
  color: Color,
  /** RAW model name — the view resolves it (participantDisplayName). */
  name: string,
  isMarsBot: boolean,
  /** TRUE for the viewer's own seat (rendered first, with its own accent). */
  self: boolean,
  /** The SHARED status presentation (same brain as the in-game top strip). */
  status: StatusPresentation,
};

/**
 * PARTICIPANT READINESS for the full-bleed preparation. The standard top HUD
 * is deliberately hidden there (the player is not in the normal game state
 * yet — global parameters and deck counts must not compete with the pick),
 * but WHO is choosing and WHO is ready stays genuinely useful. This is that
 * information alone, through the SAME status brain the top strip reads
 * (`actionLabelForPlayer` + `presentPlayerStatus`), so the compact strip and
 * the future in-game presentation can never disagree about a seat's state.
 */
export function startParticipants(
  view: PlayerViewModel,
  livePlayersWaitingFor?: ReadonlyArray<Color>,
): ReadonlyArray<StartParticipant> {
  const viewer = view.thisPlayer.color;
  const live = liveWaitingSignal(livePlayersWaitingFor);
  const out: Array<StartParticipant> = [];
  for (const player of view.players) {
    const isMarsBot = player.isMarsBot === true;
    out.push({
      color: player.color,
      name: player.name,
      isMarsBot,
      self: player.color === viewer,
      status: presentPlayerStatus(actionLabelForPlayer(view, player, live), isMarsBot),
    });
  }
  // The viewer's seat leads the strip (their own state reads first).
  out.sort((a, b) => Number(b.self) - Number(a.self));
  return out;
}
