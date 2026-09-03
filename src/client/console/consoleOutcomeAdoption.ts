/*
 * @console-shared LIVE — console native stands on this file.
 *
 * OUTCOME ADOPTION — the safety net under the workspace outcome claim, and the
 * inversion of the console's old default.
 *
 * THE OLD DEFAULT WAS «OPT-IN OR STANDALONE». Every submit site had to arm a
 * claim by hand (thirteen call sites, five of them deriving `kinds` from a
 * preview branch), and any miss — a derivation bug, a source type no predicate
 * matched, a host frame torn down under a live claim — fell into the RESIDUAL
 * branch: the standalone «Получены карты» band over the very workspace whose
 * press produced the batch. Two shipped defects of that exact shape:
 *
 *  · the Hydronetwork's stage-7 copy of «Центр ИИ» armed NO claim (a preview
 *    branch addressed by array subscript where `-1` means «single action»), so
 *    its draw went standalone over the track;
 *  · a Pluto colony built during a start-flow bonus action HAD its claim, but
 *    the start workspace's return truncated the colonies frame in the very
 *    response carrying the payout — the claim froze with an empty zone for its
 *    whole 20 s backstop and the batch then went standalone over the start.
 *
 * THE NEW DEFAULT (project NORTH STAR, `.claude/rules/console-ui.md` § EMBEDDED
 * OUTCOMES): a drawn batch addressed to the viewer belongs to the workspace
 * they are standing in. The standalone band is for what the player did NOT
 * open — a board pickup (`tile` / `globalParameter` sources), an external
 * delivery with its own announce-gated door, or a batch arriving over a bare
 * board home. Concretely:
 *
 *  · a batch a live claim answers for whose HOST FRAME IS GONE re-homes to the
 *    workspace actually on screen (the same «nearest live unfinished step» law
 *    `rehomePlayOutcome` applies on a step's exit) — and when no workspace can
 *    take it, the claim is released AT ONCE, so the batch presents standalone
 *    immediately instead of after a 20-second frozen screen;
 *  · a batch NO claim answers for, with a `card` / `colony` source and a
 *    workspace the player is inside, gets a LATE CLAIM keyed on the batch's
 *    own source name — the same claim the submit site should have armed, so
 *    every existing mechanism (the embed teleport, the conclusion holds, the
 *    arrival gates, `retainWorkspaceOutcomeForNextBatch`) works unchanged.
 *
 * The DECISION is pure (`resolveOutcomeAdoption`) and spec'd; the APPLICATION
 * (`applyOutcomeAdoption`) owns the zone dance: re-home with an EMPTY slot and
 * publish the real selector on `nextTick` — never name a node the host has not
 * rendered (the `rehomePlayOutcome` trap ①) — and only when the host's own
 * publication watcher has not beaten us to it (colonies and the hand publish
 * their zones themselves the moment the claim names them).
 */
import {nextTick} from 'vue';
import type {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {
  WorkspaceOutcomeHost,
  claimWorkspaceOutcome,
  markWorkspaceOutcomeAnswerIn,
  markWorkspaceOutcomeBeatDone,
  rehomeWorkspaceOutcome,
  releaseWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
  workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {
  workspaceFrameDescended,
  workspaceStackTop,
} from '@/client/console/consoleWorkspaceStack';

/**
 * The workspaces a batch may be ADOPTED into, and the zone each presents it
 * in. Deliberately NOT every `WorkspaceOutcomeHost`: «ДЕЙСТВИЯ КАРТ» renders
 * its outcome zone only for a flow its own composer opened (`outcomeFlow`), so
 * adopting into it would teleport the batch at a node that never mounts — its
 * claims are armed at commit by construction (`branchOutcomeClaimPlan`), and a
 * miss there degrades to whatever OTHER workspace is standing, else standalone.
 *
 * The selector is a DEFAULT: colonies and the hand publish their own zone the
 * moment the claim names them (host-keyed watchers), and the applier defers to
 * whatever they published. The start scene and the hydro track do not watch
 * the claim's host, so for them this table is the publication.
 */
const ADOPTION_ZONES: Partial<Record<WorkspaceOutcomeHost, string>> = {
  'start': '.con-start__embed',
  'hand': '[data-embed-slot="hand-outcome"]',
  'colonies': '[data-embed-slot="colonies-reveal"]',
  'hydro': '[data-embed-slot="hydro"]',
};

/**
 * WHICH WORKSPACE MAY ADOPT RIGHT NOW — the TOP frame or nobody (a batch
 * presents in the zone of the surface the player actually sees; anything
 * deeper is covered by it). The start workspace adopts at any stage (it is a
 * phase root — its queue IS the flow); every other host only while the player
 * is genuinely INSIDE a flow there (`descended`), so a browse layer never
 * swallows an artifact that is not its own.
 */
export function outcomeAdoptionHost(): WorkspaceOutcomeHost | undefined {
  const top = workspaceStackTop();
  if (top === undefined || ADOPTION_ZONES[top.kind as WorkspaceOutcomeHost] === undefined) {
    return undefined;
  }
  const kind = top.kind as WorkspaceOutcomeHost;
  if (kind === 'start') {
    return 'start';
  }
  return workspaceFrameDescended(kind) ? kind : undefined;
}

export type OutcomeAdoptionDecision =
  /** Healthy (claimed and hosted), foreign, or nothing pending — hands off. */
  | {kind: 'none'}
  /** A live claim whose host frame is GONE and nobody can take it — free the
   *  batch NOW so it presents standalone at once, never after the 20 s backstop. */
  | {kind: 'release'}
  /** A live claim whose host frame is GONE — move it to the live workspace. */
  | {kind: 'rehome', host: WorkspaceOutcomeHost}
  /** An unowned viewer batch over an open workspace — the late claim. */
  | {kind: 'claim', host: WorkspaceOutcomeHost, sourceCard: string};

/** The facts the decision reads — assembled by the shell, which owns all of
 *  the live signals (claims, scenes, the stack). Pure so it is spec-able. */
export type OutcomeAdoptionCtx = {
  /** A drawn batch is pending for the viewer (`rawDrawnRevealPending` — the
   *  remote-delivery park, the tile/nomad heroes and the deck deal already
   *  subtracted upstream). */
  pending: boolean;
  source: CardDrawRevealSource | undefined;
  /** A claim is live (`workspaceOutcomeClaimed()`). */
  claimLive: boolean;
  claimHost: WorkspaceOutcomeHost | undefined;
  /** The claim's host frame stands OR is parked (`workspaceFrameKnown`) — a
   *  park deliberately counts: the batch waits for the player's own return. */
  claimHostKnown: boolean;
  /** The live claim answers for THIS batch (`workspaceClaimsDrawReveal` ∨
   *  `workspaceClaimsColonyReveal`). */
  claimMatchesBatch: boolean;
  /** The board card-bonus cover lift owns the batch (`boardCardBonusClaimsReveal`)
   *  — the ONE flow that stays with the standalone-family presentation. */
  boardSceneOwns: boolean;
  /** A live colony-trade transaction dresses this batch's arrival
   *  (`colonyTradeClaimsReveal`) — its own director brings the section home. */
  tradeSceneOwns: boolean;
  /** `outcomeAdoptionHost()`. */
  adoptionHost: WorkspaceOutcomeHost | undefined;
  /**
   * The live claim is SERVING A PROMPT right now (`workspaceOutcomePromptServed`
   * — the raw `waitingFor` names a kind the claim admits). A prompt cannot be
   * degraded to a standalone card band the way a batch can: releasing its claim
   * mid-decision re-opens the very question the player is answering as a
   * full-bleed modal and folds the workspace under them. So a serving claim is
   * never orphan-RELEASED here — it either re-homes (the claim survives, the
   * prompt follows it) or waits for its host to settle.
   */
  claimServesLivePrompt: boolean;
};

/** The pure decision. See the module header for the law it implements. */
export function resolveOutcomeAdoption(ctx: OutcomeAdoptionCtx): OutcomeAdoptionDecision {
  if (!ctx.pending) {
    return {kind: 'none'};
  }
  if (ctx.claimLive && ctx.claimMatchesBatch) {
    if (ctx.claimHostKnown) {
      return {kind: 'none'};
    }
    if (ctx.adoptionHost !== undefined) {
      return {kind: 'rehome', host: ctx.adoptionHost};
    }
    // A claim SERVING A LIVE PROMPT is never orphan-released (see the ctx
    // field's doc): with nobody to re-home to, the honest answer is to WAIT —
    // the host-unknown state is either a one-flush transition (the frame is
    // back next flush) or the prompt's own answering will end the serving,
    // at which point this same decision resolves to 'release' and the batch
    // presents standalone as designed.
    if (ctx.claimServesLivePrompt) {
      return {kind: 'none'};
    }
    return {kind: 'release'};
  }
  if (ctx.claimLive) {
    // A live claim that does NOT answer for this batch: the batch is somebody
    // else's business (or a claim mismatch a submit site owes a fix for) —
    // adopting it here would put one flow's name on another flow's artifact.
    return {kind: 'none'};
  }
  if (ctx.boardSceneOwns || ctx.tradeSceneOwns) {
    return {kind: 'none'};
  }
  const name = ctx.source?.type === 'card' ? ctx.source.cardName :
    ctx.source?.type === 'colony' ? ctx.source.colonyName : undefined;
  if (name === undefined || name === '' || ctx.adoptionHost === undefined) {
    // A `tile` / `globalParameter` / unattributed batch keeps its standalone
    // presenters — the board pickup is the modal's one legitimate home.
    return {kind: 'none'};
  }
  return {kind: 'claim', host: ctx.adoptionHost, sourceCard: name};
}

/**
 * ARE TWO ADOPTION VERDICTS THE SAME DECISION? The applier's stability check:
 * a destructive decision (a re-home, a release, a late claim) is applied only
 * when the SAME verdict stands across two settled flushes — a one-flush
 * `workspaceFrameKnown` gap (a frame popped and re-pushed inside one
 * transition, a park racing a truncation) must never move or kill a live
 * claim. Pure so the spec can pin it.
 */
export function sameAdoptionDecision(a: OutcomeAdoptionDecision, b: OutcomeAdoptionDecision): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'rehome' && b.kind === 'rehome') {
    return a.host === b.host;
  }
  if (a.kind === 'claim' && b.kind === 'claim') {
    return a.host === b.host && a.sourceCard === b.sourceCard;
  }
  return true;
}

/**
 * Publish the adopted host's zone a tick late (the host renders it in this
 * very patch; naming it now would leave the teleported content where it
 * stands), and only if the host's OWN publication has not landed meanwhile.
 */
function publishAdoptionZone(host: WorkspaceOutcomeHost): void {
  void nextTick(() => {
    const zone = ADOPTION_ZONES[host];
    if (zone !== undefined && workspaceOutcomeState.host === host &&
        workspaceOutcomeState.sourceCard !== '' && workspaceOutcomeState.embedSlot === '') {
      setWorkspaceOutcomeSlot(zone);
    }
  });
}

/** Apply a decision. Idempotent per state — re-running on an already-applied
 *  state resolves to `none` and does nothing. */
export function applyOutcomeAdoption(decision: OutcomeAdoptionDecision): void {
  switch (decision.kind) {
  case 'none':
    return;
  case 'release':
    releaseWorkspaceOutcome('adoption-no-host');
    return;
  case 'rehome':
    rehomeWorkspaceOutcome(decision.host, '');
    publishAdoptionZone(decision.host);
    return;
  case 'claim':
    claimWorkspaceOutcome(decision.host, decision.sourceCard, ['draw', 'pick'], 0, 0, 'card');
    // The batch already exists and no commit beat was ever played for it — an
    // adopted claim owes neither the flip gate nor the 2.6 s beat backstop.
    markWorkspaceOutcomeAnswerIn();
    markWorkspaceOutcomeBeatDone();
    publishAdoptionZone(decision.host);
    return;
  }
}
