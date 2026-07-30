/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WORKSPACE OUTCOME CLAIM — the ONE answer to «does an open workspace own the
 * thing that just arrived?».
 *
 * THE PRINCIPLE (project NORTH STAR, see docs/claude/console/workspace-band.md
 * § EMBEDDED OUTCOMES). When the player ENTERS a workspace themselves and
 * starts a flow inside it, every subsequent stage of that flow — the reveal,
 * the drawn cards, the follow-up decision, the result — belongs to that
 * workspace and is presented INSIDE it. A standalone modal is for what the
 * player did NOT open: a board event, another player's turn, a result with no
 * natural parent surface.
 *
 * WHY A CLAIM AND NOT A FLAG. One server response routinely carries a finished
 * effect AND the next prompt (see consolePromptAdmission), and the console has
 * several always-listening presenters — the standalone reveal overlay, the task
 * host, the deck-draw cinematic. Each of them decides on its own whether to come
 * alive. So a workspace cannot simply "stay open": it has to SAY, structurally,
 * that the incoming artifact is its own. That is a claim.
 *
 * THE CLAIM KEY IS THE SERVER'S. Every card-sourced draw already carries
 * `CardDrawRevealSource = {type:'card', cardName}` (DrawCards resolves it from
 * the live analytics scope), and a deck-check result carries `lastReveal.action`.
 * Both name the CARD whose activation produced them — which is exactly what a
 * card workspace knows about itself. Nothing new is sent, nothing is guessed
 * from a title, and no per-card table exists: a card that starts producing cards
 * tomorrow is claimed by construction.
 *
 * Same shape as the two claims that came before it (`boardCardBonusClaimsReveal`,
 * `colonyTradeClaimsReveal`) — a scene that armed itself answers whether a batch
 * is its own — generalized so any workspace can be the claimant.
 */
import {reactive} from 'vue';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

/**
 * Which workspace holds the claim. A closed union on purpose: every host needs
 * its own embedded presentation, so a new one is a deliberate addition, not a
 * string that silently starts matching.
 */
export type WorkspaceOutcomeHost =
  /** «Действия карт» → ACTION FOCUS (ConsoleCardActions + ConsoleActionComposer). */
  | 'card-actions';

/**
 * What an outcome can BE. The claimant declares which kinds it can host, so a
 * workspace never swallows an artifact it has no surface for (the classic way a
 * prompt strands).
 */
export type WorkspaceOutcomeKind =
  /** `lastReveal` — the deck-check verdict (Search For Life). */
  | 'deck-check'
  /** A `CardDrawRevealModel` batch — cards physically drawn from the deck. */
  | 'draw'
  /** A follow-up card PICK the same activation produced (buy / keep-some). */
  | 'pick';

/**
 * The live claim. `sourceCard` is the key every predicate matches on; `kinds`
 * bounds what may be claimed; `stage` is observability (the shell's debug
 * readout and the specs read it — no behaviour hangs off it).
 */
export const workspaceOutcomeState = reactive({
  host: undefined as WorkspaceOutcomeHost | undefined,
  /** The CardName whose activation opened this outcome. '' = no claim. */
  sourceCard: '' as string,
  kinds: [] as ReadonlyArray<WorkspaceOutcomeKind>,
  /** 'awaiting' — submitted, nothing has arrived yet; 'presenting' — on screen. */
  stage: 'idle' as 'idle' | 'awaiting' | 'presenting',
  /**
   * The CSS selector of the workspace's outcome zone — the teleport target a
   * re-homed presenter lands in. Published by the workspace while that zone is
   * actually in the DOM, and empty otherwise.
   *
   * REACTIVE on purpose: the host's mount is what makes the target real, and a
   * `document.querySelector` in a consumer's computed would not re-run when it
   * appears (computeds track reactive reads, not the DOM). A teleport whose
   * target does not exist yet drops its content on the floor, so this has to be
   * a value the renderer can depend on.
   */
  embedSlot: '' as string,
  /**
   * The NAME of the stage the re-homed surface is showing, as an i18n key —
   * «Покупка», «Добор карт», … Published by the host that embeds, consumed by
   * the WORKSPACE's breadcrumb.
   *
   * This is what makes the flow read as one thing. The embedded surface stops
   * announcing itself («◈ ПОКУПКА» over its own title, detached from
   * everything) and instead hands its name UP, so the workspace can say
   * «ДЕЙСТВИЯ КАРТ › ПОКУПКА · Коммерческая сеть» — same line, same place,
   * same card, one step further along. A surface that titles itself inside
   * someone else's frame is exactly how a stage starts reading as a modal.
   */
  phaseKey: '' as string,
});

/** The workspace's outcome zone is mounted (or gone) — publish the target. */
export function setWorkspaceOutcomeSlot(selector: string): void {
  workspaceOutcomeState.embedSlot = selector;
}

/** The embedded surface names its stage for the workspace breadcrumb. */
export function setWorkspaceOutcomePhase(key: string): void {
  workspaceOutcomeState.phaseKey = key;
}

/**
 * A claim can never outlive its flow. The surface's own unmount releases it in
 * the normal case; this backstop covers the abnormal ones (a lost response, a
 * server that answers with nothing card-shaped, a torn-down component whose
 * hook did not run). It is deliberately LONGER than the surface-motion awaiting
 * safety (6 s) — that one dismisses the stage, and only once the stage is gone
 * does an orphaned claim start suppressing standalone presenters.
 */
const CLAIM_SAFETY_MS = 20_000;

let safetyTimer: ReturnType<typeof setTimeout> | undefined;

function clearSafety(): void {
  if (safetyTimer !== undefined) {
    clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }
}

function armSafety(): void {
  clearSafety();
  if (typeof setTimeout !== 'function') {
    return;
  }
  safetyTimer = setTimeout(() => {
    safetyTimer = undefined;
    releaseWorkspaceOutcome();
  }, CLAIM_SAFETY_MS);
}

/**
 * A workspace COMMITS an action and claims whatever it produces. Called
 * synchronously at submit time — before the response can land — so no artifact
 * can slip past the claim and open a standalone surface for one frame.
 *
 * `kinds` comes from the branch preview (structural), never from the card's
 * identity: `reveal` present → 'deck-check', a `cards` gain effect → 'draw' +
 * 'pick'. An empty list is a legal no-op claim (nothing to host).
 */
export function claimWorkspaceOutcome(
  host: WorkspaceOutcomeHost,
  sourceCard: string,
  kinds: ReadonlyArray<WorkspaceOutcomeKind>,
): void {
  if (sourceCard === '' || kinds.length === 0) {
    releaseWorkspaceOutcome();
    return;
  }
  workspaceOutcomeState.host = host;
  workspaceOutcomeState.sourceCard = sourceCard;
  workspaceOutcomeState.kinds = [...kinds];
  workspaceOutcomeState.stage = 'awaiting';
  armSafety();
}

/**
 * The claimed artifact is now ON SCREEN inside the workspace.
 *
 * This DISARMS the backstop rather than re-arming it. The timer guards exactly
 * one failure — «claimed, and nothing ever came» — and that question is settled
 * the moment something is on screen. Leaving it armed (or restarting it here)
 * would put a wall clock on the player: read a revealed card for twenty
 * seconds and the claim would drop underneath them, folding the workspace
 * mid-decision. From here the artifact's own lifecycle ends the claim.
 */
export function markWorkspaceOutcomePresenting(): void {
  if (workspaceOutcomeState.sourceCard !== '') {
    workspaceOutcomeState.stage = 'presenting';
    clearSafety();
  }
}

/** Drop the claim (the stage folded, the outcome was acknowledged, unmount). */
export function releaseWorkspaceOutcome(): void {
  clearSafety();
  workspaceOutcomeState.host = undefined;
  workspaceOutcomeState.sourceCard = '';
  workspaceOutcomeState.kinds = [];
  workspaceOutcomeState.stage = 'idle';
  workspaceOutcomeState.embedSlot = '';
  workspaceOutcomeState.phaseKey = '';
}

/** Is ANY workspace holding a claim right now? */
export function workspaceOutcomeClaimed(): boolean {
  return workspaceOutcomeState.sourceCard !== '';
}

/** Does the live claim admit this kind of outcome? */
export function workspaceOutcomeAdmits(kind: WorkspaceOutcomeKind): boolean {
  return workspaceOutcomeState.sourceCard !== '' && workspaceOutcomeState.kinds.includes(kind);
}

/**
 * Does an open workspace own this DRAWN batch? True only for a card-sourced
 * draw naming the claimed card — a tile bonus, a colony bonus, a global-parameter
 * reward and an untagged draw all stay with their own presenters.
 */
export function workspaceClaimsDrawReveal(source: CardDrawRevealSource | undefined): boolean {
  return workspaceOutcomeAdmits('draw') &&
    source?.type === 'card' &&
    source.cardName === workspaceOutcomeState.sourceCard;
}

/**
 * Does an open workspace own this DECK-CHECK result? `action` is
 * `lastReveal.action` — the acting card's name.
 */
export function workspaceClaimsDeckCheck(action: string | undefined): boolean {
  return workspaceOutcomeAdmits('deck-check') &&
    action !== undefined &&
    action === workspaceOutcomeState.sourceCard;
}

/**
 * Does an open workspace own the follow-up card PICK the server just raised?
 *
 * Unlike the two above, a prompt carries NO source attribution — the server has
 * no reason to tag a `SelectCard` with the card that caused it. What makes this
 * safe is the claim's own narrowness: it exists only between a workspace's
 * submit and its outcome, it is admitted only for an action whose preview
 * PROMISED cards, and it covers exactly one prompt family. A placement, a
 * payment, an OrOptions branch — anything else the same response may carry —
 * is untouched and routes normally.
 */
export function workspaceClaimsPick(): boolean {
  return workspaceOutcomeAdmits('pick');
}

/** Full reset (game switch / test cleanup). */
export function resetWorkspaceOutcome(): void {
  releaseWorkspaceOutcome();
}
