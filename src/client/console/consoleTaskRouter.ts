/*
 * CONSOLE TASK ROUTER — CTS phase T0 (docs/CONSOLE_MODE_CONCEPT.md §CTS-1/2).
 *
 * The ONE place that knows which console surface owns a server prompt.
 * `taskFor(view)` maps `playerView.waitingFor` to a typed `ConsoleTask` —
 * re-centralizing the routing knowledge that is scattered across
 * `WaitingFor.useModalForCurrentInput`, PlayerHome's dedicated-surface
 * predicates and the App-level flow gates, as one PURE, exhaustively
 * tested table (tests/client/components/console/consoleTaskRouter.spec.ts
 * enumerates every CTS-2 row; its printed red list IS the work queue).
 *
 * `TaskKind` is a CLOSED union — the completeness anchor: a new server
 * prompt shape must either map to a kind or land on the honest `unknown`
 * guard (never a silent pill). The router NEVER mutates anything and NEVER
 * submits — it only classifies.
 */

import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {inputTitleText} from '@/client/console/turnIntents';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';

export type CardSelectMode = 'draft' | 'buy' | 'target';

export type ConsoleTask =
  /** The per-turn action menu — natively handled by the Turn verbs. */
  | {kind: 'actionMenu'}
  /** Board placement — natively handled by the console placement mode. */
  | {kind: 'space'}
  | {kind: 'choice', flavor: 'generic' | 'contextual' | 'wgt' | 'confirm'}
  /** FREE award funding (Vitor's start action) — served by the premium
   *  awards MA screen in free-sponsorship mode, NOT the generic task host
   *  (the desktop routes it to AwardsOverlay for the same reason). */
  | {kind: 'awardFunding'}
  | {kind: 'player'}
  | {kind: 'amount', flavor: 'generic' | 'delta'}
  | {kind: 'resource'}
  | {kind: 'distribute', mode: 'resources' | 'production'}
  | {kind: 'payment'}
  /** OPTIONAL draft re-pick (server lets you change until all pick) — the fork
   *  does NOT surface re-pick; the shell shows a calm "waiting for others" state
   *  (mirrors the desktop DraftFlowOverlay suppression). */
  | {kind: 'draftWait'}
  | {kind: 'cardSelect', mode: CardSelectMode}
  /**
   * LOOK AT N CARDS OFF THE DECK AND KEEP K — «Корпоративные архивы» (7→2),
   * «Деловые контакты» (4→2), «Конкурс изобретений» (3→1), the Leavitt colony,
   * the Delta science stage, the discard-pile diggers.
   *
   * A family of its own, not a `cardSelect` flavour, because it is a different
   * OBJECT: these cards belong to nobody. They came out of the deck a moment
   * ago for this one decision, the picks go to the hand and the rest is
   * discarded — so the surface owes the player a deck to come out of, a source
   * card that explains why, and a physical journey into the dock. The generic
   * card browser can honour none of that, and `mode: 'target'` (its `else`
   * branch) said the opposite of the truth: nothing is being targeted.
   *
   * Routed off the SERVER's `deckPickPrompt` marker — never off the title.
   */
  | {kind: 'deckSelect'}
  /**
   * MANDATORY "pick from your OWN hand" (discard / reveal / keep / copy /
   * place onto Self-Replicating Robots): every candidate is already in the
   * player's hand, so it is served by the HAND SECTION in select mode — the
   * console twin of the desktop КАРТЫ В РУКЕ select overlay — NOT the generic
   * card browser. The player picks on the real hand carousel; a narrowed
   * (conditional) prompt opens with a "suitable only" filter and a single-card
   * pick submits on one A press (no toggle-then-confirm). A shell-section kind.
   */
  | {kind: 'handSelect'}
  | {kind: 'projectCard', mode: 'playFromHand' | 'standardProject'}
  | {kind: 'colony'}
  /**
   * COLLECT THE COLONY BONUS ANOTHER PLAYER'S TRADE PAID YOU (Miranda's «take
   * a card»). A one-press delivery, but a real prompt: the server draws the
   * cards inside the answer, so nothing lands in a hand its owner has not
   * looked at. Served by the COLONY WORKSPACE — answering takes the player to
   * the colony that paid, where the payout presents like every other one.
   * Routed off the server's `colonyBonusPrompt` marker, never the title.
   */
  | {kind: 'colonyBonus'}
  /**
   * The Venus ALT-TRACK bonus. Two server SHAPES for one decision — the base
   * bonus is an `and` of six amounts, the 30 % final bonus is an `or` whose
   * branches decide where the extra WILD resource goes — so the MARKER routes
   * it, never the type (the same structural rule `startGamePrompt` follows).
   */
  | {kind: 'venusBonus', mode: 'standard' | 'final'}
  /** Stormcraft: cover N heat with stock heat (1 each) and floaters (2 each). */
  | {kind: 'spendHeat'}
  /**
   * A MARSBOT ATTACK the player must answer — «выберите свою карту и снимите с
   * неё ресурс». On the wire it is an ordinary `SelectCard` over the victim's
   * own tableau, which the router used to classify as `cardSelect: 'target'`
   * and serve through the generic full-screen card browser: one card blown up
   * to half a 4K screen, under a raw English title whose only mention of the
   * attacker was the source card's English name in brackets.
   *
   * Its own family, because it is a different EVENT: nothing is being gained,
   * the player did not ask for it, and the three questions it owes — who did
   * this, with what, and what does it cost me — are answered by nothing in the
   * generic browser. Routed off the SERVER's `botAttackPrompt` marker.
   */
  | {kind: 'botAttack'}
  | {kind: 'composite'}
  | {kind: 'initialDraft'}
  | {kind: 'startSequence', prompt: 'corporationPlay' | 'corporationPay' | 'corporationSelection' | 'preludeSelection'}
  /**
   * The corporation's MANDATORY FIRST ACTION ('Take first action of X') —
   * it arrives on the player's own FIRST TURN (after the opponent moved).
   * Inside the START FLOW (`corpFirstActionInStartFlow`) it is the Game
   * Start Workspace's own final conditional stage — the scene serves it
   * seamlessly after the preludes. Outside the start flow (a mid-game
   * merger chain acquiring a corp with a first action) the dedicated
   * confirm modal serves it, exactly as before.
   */
  | {kind: 'corpFirstAction'}
  | {kind: 'aresGlobal'}
  /** Out-of-scope / unmapped — renders the honest guard panel, NEVER silence. */
  | {kind: 'unknown', inputType: string};

export type TaskKind = ConsoleTask['kind'];

/**
 * Kinds served natively today: the shell's own surfaces (actionMenu/space)
 * + the T1 ConsoleTaskHost primitives + T2 cardSelect + T3 payment/
 * projectCard + T4 colony + T5 initialDraft/startSequence (the start
 * scene). The red-list spec mirrors this set.
 */
export const NATIVE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>([
  'actionMenu', 'space',
  'choice', 'player', 'amount', 'resource', 'distribute',
  'cardSelect', 'deckSelect', 'handSelect', 'payment', 'draftWait',
  'projectCard', 'colony', 'colonyBonus', 'awardFunding',
  'initialDraft', 'startSequence', 'corpFirstAction',
  // The three that used to fall through to the DESKTOP modal inside the
  // console shell — each now has its own console-native surface.
  'venusBonus', 'spendHeat', 'aresGlobal',
  // …and the MarsBot attack, which used to be served by the generic card
  // browser with none of its context.
  'botAttack',
]);

/** Kinds handled by shell surfaces that need NO task host (detector base). */
export const SHELL_NATIVE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['actionMenu', 'space']);

/**
 * Kinds served by SHELL SECTIONS (not the task host): the play-from-hand /
 * standard-project prompts ride the hand carousel & the standard-projects
 * sheet; a MANDATORY hand pick (`handSelect` — discard / reveal / place)
 * rides the hand carousel in select mode; a colony pick rides the colonies
 * rail in pick mode; FREE award funding (Vitor) rides the premium awards MA
 * screen in free-sponsorship mode. The shell auto-opens the surface;
 * navigating away DEFERS the task (amber chip).
 */
export const SHELL_SECTION_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['projectCard', 'handSelect', 'colony', 'colonyBonus', 'awardFunding', 'corpFirstAction']);

/**
 * …of those, the kinds whose console surface ALWAYS exists — the answer to
 * «may the DESKTOP fallback modal rise for this prompt?».
 *
 * A section prompt has a deliberate window in which none of its DOM is
 * mounted: it is ANNOUNCED first (`consoleMandatoryGate`) and its screen opens
 * on the player's press. Judging «is this served?» by what is on screen makes
 * that window look unserved, and the legacy `MandatoryInputModal` rises into
 * it — which is how the remote colony-bonus collect («Заберите 1 карту с
 * колонии Миранда») shipped as a legacy dialog over the board, and answering
 * it THERE bypassed the console's own door: no entry armed, no claim, so the
 * card flew to a full-bleed reveal instead of into the colony that paid it.
 *
 * `projectCard` is deliberately ABSENT. Its two real shapes (play from hand /
 * a standard project) suppress the modal through `useModalForCurrentInput`
 * already; the DEGENERATE third (candidates that are neither) has no console
 * screen at all, and the legacy modal is its honest fallback — suppressing it
 * would leave the player with a prompt and nowhere to answer it.
 */
export const SECTION_SERVED_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['handSelect', 'colony', 'colonyBonus', 'awardFunding', 'corpFirstAction']);

/** Where the player is standing right now, as the surface map sees it. */
export type ShellSurfaceContext = {
  /** `consoleState.section`. */
  section: string,
  /** `consoleState.sheet` (undefined = no sheet open). */
  sheet: string | undefined,
  /** The corporation's first-action confirm is up (it has no section). */
  corpFirstActionOpen: boolean,
  /*
   * (`handEmbedded` / `coloniesEmbedded` are GONE. They existed for exactly one
   * reason: `section` used to LIE when a screen was hosted as a step of another
   * flow — the hand teleported into the start still reported `section: 'board'`,
   * so the central ask banner painted itself across the host's breadcrumb tail.
   * `section` is a projection of the workspace stack now, and the DEEPEST
   * projecting frame wins, so «the player is standing where the pick is
   * answered» is what it already says.)
   */
};

/**
 * IS THE PLAYER STANDING WHERE THIS TASK IS ANSWERED?
 *
 * Every shell-section kind has exactly ONE target surface — the screen
 * `openShellTaskSurface` opens for it. This is that map, stated once.
 *
 * It exists because the alternative is an inline gate expression, and the
 * console has already paid for four of those drifting apart
 * (`consolePromptAdmission`). Its consumer is the central ask BANNER, whose
 * whole meaning is «what you owe is NOT on the screen you are looking at»:
 * on the target surface the ask is already stated by that surface's own
 * header and command bar, so repeating it is noise; anywhere else it is the
 * only thing that says where to go back to.
 */
export function shellTaskOnSurface(task: ConsoleTask | undefined, ctx: ShellSurfaceContext): boolean {
  if (task === undefined) {
    return false;
  }
  switch (task.kind) {
  case 'projectCard':
    return task.mode === 'playFromHand' ?
      ctx.section === 'hand' :
      ctx.sheet === 'standardProjects';
  case 'handSelect':
    return ctx.section === 'hand';
  case 'colony':
  case 'colonyBonus':
    return ctx.section === 'colonies';
  case 'awardFunding':
    return ctx.sheet === 'awards';
  case 'corpFirstAction':
    return ctx.corpFirstActionOpen;
  default:
    // Not a shell-section kind — it has no surface of this family at all.
    return false;
  }
}

/**
 * A FOLLOW-UP STEP — the prompt kinds whose surface opens as a STEP INSIDE the
 * flow that produced it, together with the crumb tail that step carries.
 *
 * ONE PRESS CAN PRODUCE SEVERAL EFFECTS, and the server sends them in one
 * response: «Научная колония» draws 2 cards and defers a `SelectColony`. The
 * draw's surface must be worked through first (`followUp` in
 * consolePromptAdmission holds the step's door), which makes «a step is OWED»
 * a real state of the flow — and while it lasts:
 *
 *   · the flow may not CONCLUDE (`owed-step` in consoleWorkspaceFlow) — its
 *     workspace is the step's host-to-be;
 *   · the host may not fold its descent — the zone the step will teleport into
 *     is that descent's own;
 *   · the CRUMB names the step already, because a breadcrumb only ever moves
 *     FORWARD: falling back to «РОЗЫГРЫШ» for the gap between the batch leaving
 *     and the door opening would step backwards through a flow that does not.
 *     The value is the SAME key `openColoniesForPrompt` pushes as the frame's
 *     stage, so the line animates once and then stands still.
 *
 * A table rather than a `=== 'colony'` at three call sites: a new step-shaped
 * follow-up is a row here, and the crumb / the hold / the door read the one
 * answer. Deliberately NOT `handSelect` — a discard the played card forced is
 * not a step of the play (it needs the hand's own browse layer, which the
 * play's descent has parked; see `servedPromptHolds` in `concludeWorkspaceFlow`).
 */
const FOLLOW_UP_STEP_STAGES: Partial<Record<TaskKind, string>> = {
  // The name `ConsoleColoniesSection` publishes UP for an embedded pick (its
  // `embeddedCrumb` default) and the one `openColoniesForPrompt` pushes — ONE
  // stage, ONE word, so the tail animates once and then stands still. It said
  // «КОЛОНИИ» here and the section corrected it to «ВЫБОР КОЛОНИИ» a frame
  // later: two animations to say one thing.
  colony: 'Colony selection',
};

/** Does this prompt open as a step INSIDE the flow that produced it, and under
 *  what crumb tail? `undefined` = not a step-shaped follow-up. */
export function followUpStepStage(kind: TaskKind | undefined): string | undefined {
  return kind === undefined ? undefined : FOLLOW_UP_STEP_STAGES[kind];
}

/**
 * Kinds served by the full-screen START SCENE (T5): the `initialCards`
 * wizard (corporation / preludes / CEO / project buy / summary) and the
 * marked start-sequence prompts (play preludes one by one, apply the corp
 * first action, Merger's corp pick). The shell mounts ConsoleStartScene
 * and routes input to it; B defers to the amber chip like every task.
 */
export const SCENE_KINDS: ReadonlySet<TaskKind> = new Set<TaskKind>(['initialDraft', 'startSequence']);

/**
 * The DEDICATED COMPOSITE surfaces — the prompts that used to fall through to
 * the desktop modal inside the console shell and now each have a console-native
 * band surface of their own: the Venus alt-track bonus, Stormcraft's spend-heat,
 * the planetary-event thresholds and «посмотри N карт колоды, оставь K».
 *
 * They are their OWN family: not host-served (`taskServedByHost` returns
 * undefined for every one of them), not a shell section, not a scene.
 * Membership says three things: the desktop fallback modal stays suppressed for
 * them, the shell counts them as a busy screen (footer under-scene, hand dock
 * compact), and — the one that was missing — they can be MINIMIZED, so the
 * shell owes them a way back. It lived as a private const inside ConsoleShell,
 * which is exactly how the shell's «where do I come back to?» predicate came to
 * enumerate three families and miss the fourth — see `taskMinimizable`.
 */
export const NATIVE_COMPOSITE_KINDS: ReadonlySet<TaskKind> =
  new Set<TaskKind>(['venusBonus', 'spendHeat', 'aresGlobal', 'deckSelect', 'botAttack']);

/**
 * CAN THE PLAYER MINIMIZE THIS PROMPT — and therefore, must the shell offer a
 * way BACK to it? The completeness anchor for «B СВЕРНУТЬ».
 *
 * Every surface that advertises «свернуть» hides itself on
 * `consoleState.task.deferred`, so the ONLY door back is the board-home
 * restore card (`.con-mandatory`), which renders on the shell's
 * `mandatoryDeferredActive`. A kind that can be minimized but is NOT
 * represented there is a SOFT-LOCK, and a silent one: the surface unmounts, no
 * card offers the return, B on the board home does nothing, and the leak
 * detector stays quiet on purpose (a deferred task is deliberately set aside,
 * never stranded). Only a reload recovers.
 *
 * That shipped for the whole NATIVE COMPOSITE family: the predicate listed the
 * task host, the shell sections and the start scene, and «Разместите бонус
 * шкалы Венеры» belongs to none of the three — one press of B and the bonus was
 * unreachable for the rest of the session.
 *
 * TRUE for the four families the shell reads live, in this order:
 *  · the ConsoleTaskHost (and every panel that cascades off it — Government
 *    Support, production loss, the effect decision, the finale);
 *  · a SHELL SECTION (`SHELL_SECTION_KINDS`);
 *  · the full-screen START SCENE (`SCENE_KINDS`);
 *  · a DEDICATED COMPOSITE (`NATIVE_COMPOSITE_KINDS`).
 *
 * FALSE for the rest, and each for its own reason: `actionMenu` / `space` are
 * served by an ALWAYS-MOUNTED surface (there is no panel to fold, so there is
 * nothing to come back to); `draftWait` minimizes as a WORKSPACE, where the
 * parked stack is what offers the way back; `composite` / `unknown` have no
 * console surface at all (the desktop fallback modal / the honest stranded
 * guard), and neither offers «свернуть».
 *
 * Exhaustive over `TaskKind` (no default): a new kind does not compile until it
 * declares which side it is on.
 */
export function taskMinimizable(kind: TaskKind): boolean {
  switch (kind) {
  case 'choice':
  case 'player':
  case 'amount':
  case 'resource':
  case 'distribute':
  case 'payment':
  case 'cardSelect':
  case 'projectCard':
  case 'handSelect':
  case 'colony':
  case 'colonyBonus':
  case 'awardFunding':
  case 'corpFirstAction':
  case 'initialDraft':
  case 'startSequence':
  case 'venusBonus':
  case 'spendHeat':
  case 'aresGlobal':
  case 'deckSelect':
  case 'botAttack':
    return true;
  case 'actionMenu':
  case 'space':
  case 'draftWait':
  case 'composite':
  case 'unknown':
    return false;
  }
}

/**
 * Is a `corpFirstAction` prompt part of the GAME START FLOW — i.e. served by
 * the Game Start Workspace's own «ПЕРВОЕ ДЕЙСТВИЕ» stage rather than the
 * standalone confirm modal?
 *
 * The honest domain discriminator, not a client latch (it must survive a
 * reload): GENERATION 1 *is* the start of the game. Deliberately NOT
 * `actionsTakenThisGame === 0` — this fork counts the deferred corporation
 * play and every prelude as taken actions (`Player.incrementActionsTaken`
 * fires inside their own runWhenEmpty), so the counter is already past zero
 * when the first-action prompt stands. A first-action prompt in a LATER
 * generation can only be a mid-game acquisition chain (a merger picking up
 * a corp that still owes its opening move) — that one keeps the dedicated
 * modal: resurrecting the start workspace mid-game would be a lie about
 * where the player is.
 */
export function corpFirstActionInStartFlow(view: PlayerViewModel): boolean {
  return view.game.generation === 1;
}

const WGT_TITLE = 'Select action for World Government Terraforming';

/**
 * Option types the task host can serve inside a `choice` (T9 one-level
 * wizard): leaves, board picks, and every nested input it has a native
 * body for. NOT here (→ the desktop modal): `and` composites (combined
 * multi-child submit) and deeper `or` nesting.
 */
const NESTABLE_OPTION_TYPES: ReadonlySet<string> = new Set([
  'option', 'space',
  'card', 'payment', 'amount', 'player', 'resource', 'resources', 'productionToLose',
]);

function isHandSubset(view: PlayerViewModel, cards: ReadonlyArray<{name: string}> | undefined): boolean {
  if (cards === undefined || cards.length === 0) {
    return false;
  }
  const hand = new Set<string>([
    ...view.cardsInHand.map((c) => c.name),
    ...(view.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
  ]);
  return cards.every((c) => hand.has(c.name));
}

/**
 * Classify the CURRENT top-level server prompt. `undefined` = nothing
 * pending (client-initiated flows — play card, trade, sale — are owned by
 * the shell, not derived here).
 */
export function taskFor(view: PlayerViewModel): ConsoleTask | undefined {
  const wf: PlayerInputModel | undefined = view.waitingFor;
  if (wf === undefined) {
    return undefined;
  }

  // MARKERS outrank the raw type — the structural rule. The Venus alt-track
  // bonus takes TWO shapes (`and` for the base, `or` for the final wild step)
  // and the spend-heat prompt is an `and` that is really a payment; classifying
  // either by type would drop both back onto the generic composite carve-out.
  if (wf.venusBonusPrompt !== undefined) {
    return {kind: 'venusBonus', mode: wf.venusBonusPrompt.kind};
  }
  if (wf.spendHeatPrompt !== undefined) {
    return {kind: 'spendHeat'};
  }
  // A MARSBOT ATTACK — an ordinary `SelectCard` on the wire, and the marker is
  // the ONLY thing that says the player is being attacked rather than choosing
  // where to put something. Classified by type it lands in the generic card
  // browser (which is exactly where it used to land).
  if (wf.botAttackPrompt !== undefined) {
    return {kind: 'botAttack'};
  }
  // A colony bonus another player's trade owes the viewer: a bare
  // `SelectOption` on the wire, and its whole meaning is the MARKER (which
  // colony pays, whose trade, which cube). Classified by type it would be an
  // anonymous «Подтвердить» with nowhere to go.
  if (wf.colonyBonusPrompt !== undefined) {
    return {kind: 'colonyBonus'};
  }

  // Start-of-game markers outrank the raw type (a marked SelectCard is the
  // START SEQUENCE's, not a generic card pick) — the structural-marker rule.
  const start = wf.startGamePrompt;
  if (start !== undefined) {
    // The corp FIRST ACTION is a first-TURN prompt, not a start-scene one:
    // it rides the «Разыграно» overlay's action mode (spec: the mandatory
    // first action belongs to the player's first turn, after the opponent).
    if (start.kind === 'corporationInitialAction') {
      return {kind: 'corpFirstAction'};
    }
    return {kind: 'startSequence', prompt: start.kind};
  }

  switch (wf.type) {
  case 'initialCards':
    return {kind: 'initialDraft'};

  case 'or': {
    const title = inputTitleText(wf.title) ?? '';
    if (isActionMenuTitle(title)) {
      return {kind: 'actionMenu'};
    }
    if (wf.awardFundingPrompt?.free === true) {
      return {kind: 'awardFunding'};
    }
    if (title === WGT_TITLE) {
      return {kind: 'choice', flavor: 'wgt'};
    }
    return {kind: 'choice', flavor: wf.choiceContext !== undefined ? 'contextual' : 'generic'};
  }

  case 'option':
    return {kind: 'choice', flavor: 'confirm'};
  case 'player':
    return {kind: 'player'};
  case 'amount':
    return {kind: 'amount', flavor: 'generic'};
  case 'deltaProject':
    // The Hydronetwork energy stepper — the amount family (normally
    // pre-answered by the hydro confirm batch; standalone = a divergence).
    return {kind: 'amount', flavor: 'delta'};
  case 'resource':
    return {kind: 'resource'};
  case 'resources':
    return {kind: 'distribute', mode: 'resources'};
  case 'productionToLose':
    return {kind: 'distribute', mode: 'production'};
  case 'payment':
    return {kind: 'payment'};

  case 'projectCard': {
    // Play-from-hand (EccentricSponsor/EcologyExperts) vs the standalone
    // standard-project prompt (EstablishedMethods) — the PlayerHome
    // dedicated-overlay split, reproduced structurally.
    return {kind: 'projectCard', mode: isHandSubset(view, wf.cards) ? 'playFromHand' : 'standardProject'};
  }

  case 'card': {
    // OPTIONAL draft re-pick (the ONLY place the server sets `optional`,
    // Draft.ts): the fork deliberately does NOT offer re-picking — surface a
    // calm "waiting for the other players" state instead (desktop parity —
    // DraftFlowOverlay.cardInput suppresses the grid on `optional === true`).
    if (wf.optional === true) {
      return {kind: 'draftWait'};
    }
    // THE DRAFT PICK — the server's own structural marker (Draft.askPlayerToDraft
    // attaches it to every variant's pick), checked before the hand-subset
    // heuristic on purpose: a prelude/CEO draft's candidates can coincide with
    // dealt cards, and a draft pick is never a hand selection. The old
    // `buttonLabel === 'Keep'` sniff (a dead branch — the real prompt says
    // 'Select') is replaced by the marker, so the mode is finally LIVE.
    if (wf.draftPrompt !== undefined) {
      return {kind: 'cardSelect', mode: 'draft'};
    }
    const buttonLabel = wf.buttonLabel ?? '';
    // Every candidate already in hand (incl. Self-Replicating Robots hosts) =>
    // a "pick from your hand" prompt (discard / reveal / keep / place) => the
    // hand section's select mode, NOT the generic card browser.
    if (isHandSubset(view, wf.cards)) {
      return {kind: 'handSelect'};
    }
    if (buttonLabel === 'Keep') {
      return {kind: 'cardSelect', mode: 'draft'};
    }
    // THE DECK REVEAL — the server's own structural marker, checked before the
    // `buyMode` split and before the generic fallthrough.
    //
    // Scoped to the KEEP grammar on purpose. A PAYING reveal (Inventors' Guild,
    // the research buy, Tate) is already a first-class flow — the card-actions
    // workspace's embedded «ПОКУПКА» stage and the research rise — with cost
    // badges, an affordability check and a payment prompt behind it. Those are
    // not missing anything, so they keep their home; the marker rides along on
    // them anyway (it describes what the cards ARE), which is what will let a
    // later iteration unify the two without another server change.
    if (wf.deckPickPrompt?.mode === 'keep') {
      return {kind: 'deckSelect'};
    }
    // Structural buy marker (ChooseCards) — NOT a `title.includes('buy')` sniff,
    // which broke once i18n rewrote the translatable title in place.
    if (wf.buyMode === true) {
      return {kind: 'cardSelect', mode: 'buy'};
    }
    return {kind: 'cardSelect', mode: 'target'};
  }

  case 'space':
    return {kind: 'space'};
  case 'colony':
    return {kind: 'colony'};
  case 'and':
    return {kind: 'composite'};
  case 'aresGlobalParameters':
    return {kind: 'aresGlobal'};

  // Out-of-module-scope prompt families (Turmoil / Underworld / global
  // events) — the honest guard, never a silent dead end.
  case 'delegate':
  case 'party':
  case 'globalEvent':
  case 'claimedUndergroundToken':
  default:
    return {kind: 'unknown', inputType: wf.type};
  }
}

/**
 * Is the current prompt served natively by the console shell already?
 * (Everything else must show SOME surface — a fallback modal during the
 * CTS rollout, the guard panel when nothing exists — the leak detector's
 * stranded-prompt check enforces exactly that.)
 */
export function isNativelyHandled(task: ConsoleTask | undefined): boolean {
  return task !== undefined && NATIVE_KINDS.has(task.kind);
}

/**
 * Does the ConsoleTaskHost FULLY serve this prompt? True for the T1
 * primitives + the T2 card browser + the T3 payment lanes + (T9) a
 * `choice` whose options nest HOSTABLE inputs — the host opens them as a
 * ONE-LEVEL wizard step (pick the branch → complete the nested input →
 * the response is or-wrapped; B returns to the list). The remaining
 * honest carve-out is COMPOSITES: an `and` option (combined multi-child
 * submit — the same gap the desktop premium system defers to its legacy
 * AndOptions.vue) and DEEPER `or` nesting stay on the desktop modal.
 * Leaf options (`option`) and board picks (`space` — routed through the
 * shell's headless SelectSpace) are served as before. The shell
 * suppresses the desktop modal EXACTLY when this returns a task (no dead
 * ends, ever). SHELL_SECTION_KINDS (projectCard / handSelect / colony /
 * awardFunding) are native too but served by shell SECTIONS, not this host.
 */
export function taskServedByHost(view: PlayerViewModel): ConsoleTask | undefined {
  const task = taskFor(view);
  if (task === undefined) {
    return undefined;
  }
  switch (task.kind) {
  case 'player':
  case 'amount':
  case 'resource':
  case 'distribute':
  case 'cardSelect': // T2: the card browser (draft / buy / select / target)
  case 'payment': // T3: the native payment lanes (SelectPayment prompts)
    return task;
  case 'choice': {
    const wf = view.waitingFor;
    if (wf?.type === 'option') {
      return task; // bare confirm — always a leaf
    }
    if (wf?.type === 'or') {
      const served = wf.options.every((o) => NESTABLE_OPTION_TYPES.has(o.type));
      return served ? task : undefined;
    }
    return undefined;
  }
  default:
    return undefined;
  }
}
