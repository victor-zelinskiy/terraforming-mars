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
import type {ZoomOrigin} from '@/client/console/consoleCardZoom';
import type {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';

/**
 * Which workspace holds the claim. A closed union on purpose: every host needs
 * its own embedded presentation, so a new one is a deliberate addition, not a
 * string that silently starts matching.
 *
 * Deliberately a SUBSET of `WorkspaceFrameKind`, not a parallel vocabulary: the
 * claim's end is a workspace's end, so the two have to be the same name (the
 * mapping was once an `if (host !== 'colonies' && host !== 'hydro')` beside a
 * hard-coded `'card-actions'`, which is how a NEW host silently concluded
 * somebody else's workspace — or nobody's).
 */
export type WorkspaceOutcomeHost = Extract<WorkspaceFrameKind,
  /** «Действия карт» → ACTION FOCUS (ConsoleCardActions + ConsoleActionComposer). */
  | 'card-actions'
  /** «КАРТЫ В РУКЕ» → the CARD PLAY. Everything the played card sets off — the
   *  cards it draws, the pick it raises — presents inside the workspace the
   *  player composed the play in, and that workspace does not leave until they
   *  have taken all of it. */
  | 'hand'
  /** The GAME START WORKSPACE — a start card (corporation / prelude) that
   *  draws or picks other cards hosts the follow-up in its own embed zone. */
  | 'start'
  /** The COLONY WORKSPACE — a trade the player confirmed there hosts its
   *  drawn-cards payout (Pluto's income / colony bonuses) in the section's
   *  own embed zone. `sourceCard` carries the COLONY name for this host. */
  | 'colonies'
  /** The HYDRO WORKSPACE — a committed advance hosts the landed stage's card
   *  payout (pos 5 draw-4-keep-2, a repeated action's own draws) in the
   *  track's commit scene. `sourceCard` is the Delta Project for the track's
   *  own rewards, or the repeated CARD for a stage-7 composed action. */
  | 'hydro'>;

/**
 * DOES THE END OF THIS HOST'S OUTCOME END ITS WORKSPACE?
 *
 * A card ACTIVATION and a card PLAY are flows whose workspace exists FOR that
 * flow: once the result has been taken there is nothing left inside them, so
 * they leave and the player lands on the board (the North Star conclusion). The
 * other three are not flows of that shape and must never be concluded by one
 * batch finishing:
 *  · 'start'    — a PHASE, not a flow: the opening decides its own next step;
 *  · 'colonies' — one batch is a LEG of a longer resolution (Pluto's draw →
 *                 discard → the next cube → the track reset);
 *  · 'hydro'    — the advance concludes through its own result stage.
 *
 * A `Record` rather than an exclusion list, so a new host cannot compile until
 * it has answered this question.
 */
const OUTCOME_HOST_CONCLUDES: Record<WorkspaceOutcomeHost, boolean> = {
  'card-actions': true,
  'hand': true,
  'start': false,
  'colonies': false,
  'hydro': false,
};

/** Is this host's workspace OVER when its outcome is? (See the record above.) */
export function outcomeHostConcludesFlow(host: WorkspaceOutcomeHost | undefined): boolean {
  return host !== undefined && OUTCOME_HOST_CONCLUDES[host];
}

/**
 * WHOSE draws this claim answers for.
 *
 *  · 'card'  — EXACTLY the named card. An activation draws for itself, so the
 *    server's attribution and the claim's key are the same name.
 *  · 'chain' — anything a CARD produced while this claim stands. Playing a card
 *    also runs OTHER cards' triggered effects, and the server attributes a draw
 *    to the card whose EFFECT ran: Point Luna's «сыграв метку Земли, возьмите
 *    карту» is attributed to POINT LUNA, never to the Earth-tag card the player
 *    pressed. Keyed on the pressed card alone, that batch matched no claim and
 *    left for a full-bleed viewer over a workspace that had already let go —
 *    which is the whole bug this scope exists for. The window is one submit
 *    wide, and the only card-sourced batch inside it is this play's own chain.
 */
export type WorkspaceOutcomeScope = 'card' | 'chain';

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
  | 'pick'
  /**
   * An OPTIONAL CARD EFFECT the same press triggered — «Марсианский
   * университет: вы разыграли научную метку, сбросить карту и взять новую?».
   *
   * The server marks it structurally (`choiceContext` on a top-level
   * `OrOptions`), and it is the one follow-up family that is not about the
   * cards this press produced but about a card the press WOKE UP. It belongs
   * to the workspace all the same: the player pressed «Разыграть» inside a
   * screen, and every question that press raises is that screen's next stage —
   * otherwise the workspace dissolves and an unrelated-looking window takes
   * its place, which is precisely the break the embedding removes.
   */
  | 'effect';

/**
 * The live claim. `sourceCard` is the key every predicate matches on; `kinds`
 * bounds what may be claimed; `stage` is observability (the shell's debug
 * readout and the specs read it — no behaviour hangs off it).
 */
export const workspaceOutcomeState = reactive({
  host: undefined as WorkspaceOutcomeHost | undefined,
  /** The CardName whose activation opened this outcome. '' = no claim. */
  sourceCard: '' as string,
  /**
   * Which action variant of `sourceCard` was performed. Part of the COMMITTED
   * DECISION MODEL, which lives here rather than in the surface: collapsing
   * genuinely leaves the workspace (that is the only way the board becomes
   * live and the restore prompt appears), so the component is destroyed and
   * anything it owned would be destroyed with it. Re-opening rebuilds the
   * stage from this state — same card, same variant, same committed phase.
   */
  nodeIndex: 0,
  kinds: [] as ReadonlyArray<WorkspaceOutcomeKind>,
  /** Whose card-sourced draws this claim answers for (see WorkspaceOutcomeScope). */
  scope: 'card' as WorkspaceOutcomeScope,
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
  /**
   * The server's answer has ARRIVED. Published by the shell the moment the
   * artifact exists (a drawn batch, a card prompt) — SEPARATELY from whether
   * it may be shown yet, because the execution beat uses this to decide when
   * to turn the card over.
   */
  answerIn: false,
  /**
   * The EXECUTION BEAT has played out — the card has physically come off the
   * deck, turned over, and settled. Until then the real surface is withheld.
   *
   * This is deliberately NOT a timer. A minimum dwell is just a stall: the
   * screen sits there doing nothing and the player waits on the UI rather than
   * on the game. The time is bought by the ANIMATION instead — the card peels
   * off the pile face-down immediately (a card back needs no data, so this
   * starts at confirm, not at the answer), travels, and turns over only once
   * `answerIn` lands. A fast server flips right after touchdown; a slow one
   * honestly holds the card face-down on the slot, which is a real "being
   * drawn" state rather than a fake delay — and it hides the latency inside a
   * beat the player wanted to watch anyway.
   *
   * Reactive because the hold that consumes it is a render-time predicate.
   */
  beatDone: false,
  /**
   * HOW MANY cards this activation promised, known at SUBMIT time from the
   * branch preview's `cards` gain amount (server-computed — the same numbers
   * the commit wave spends, never a client re-derivation).
   *
   * The batch arrival needs the COUNT before anything can move: the slots, the
   * layout and the focus target are all decided up front, and N flying cards
   * cannot be planned from an answer that has not come back yet. When the
   * answer IS already in (the common case — the beat is deliberately handed
   * off ~460 ms after the confirm) the real batch wins; this is what makes the
   * honest waiting case possible at all instead of a single card that later
   * multiplies. 0 = the preview promised nothing countable.
   */
  expectedCards: 0,
  /**
   * THE ARRIVAL HAS COMPLETED — every card has landed, opened, and the flight
   * proxies have handed over to the real cards.
   *
   * Deliberately LATER than `beatDone`: that one releases the surface (so it
   * can mount and be measured under the still-flying proxies), this one
   * releases the PLAYER. Between the two the real cards are held invisible
   * beneath their proxies, and a focus ring or an «A Взять» hint there would
   * point at an empty slot and accept a press for a card that is not yet
   * there. Every embedded stage gates its input on this.
   */
  arrivalDone: true,
  /**
   * THE CLAIM'S OWN BEAT HAS ALREADY FLOWN THESE CARDS OFF THE PILE.
   *
   * The card-actions composer pulls N cards off `.con-deckstack__pile` into its
   * prepared stage at CONFIRM — before the server has even said what they are —
   * and hands them to whatever surface lands in the zone. One of those
   * surfaces, «посмотри N карт колоды, оставь K», deals its own batch off the
   * SAME pile on mount, because standing on its own that is exactly its job.
   * Hosted, that made TWO flights for one draw with a hole between them: the
   * beat's cards landed, the handoff dissolved them onto slots the arriving
   * surface was holding invisible, and only then did a second batch peel off
   * the deck.
   *
   * PUBLISHED by whoever actually flew, never inferred from the host's name — a
   * beat that never ran (no DOM, a torn-down stage, a degenerate layout) must
   * leave the arriving surface dealing exactly as it does standalone.
   */
  arrivalFlown: false,
});

/**
 * Backstop only: the beat must never withhold the outcome forever if its
 * flight never runs (no DOM, a stalled GSAP timeline in a backgrounded tab).
 *
 * DELIBERATELY SHORT. A backstop is a failure path, and its duration is what
 * the player experiences WHEN IT FIRES — at 6 s the first bug in the release
 * chain read as an eight-second dead screen followed by the old animation,
 * which is far worse than no beat at all. The healthy flight settles in ~1.4 s,
 * so anything past ~2.5 s already means something is wrong; failing fast turns
 * a broken beat into a slightly abrupt one instead of a hang.
 *
 * The honest face-down hold on a genuinely slow server is NOT bounded by this:
 * that path ends when the answer lands, and this timer only releases the
 * OUTCOME gate — it never fakes a flip.
 */
const BEAT_SAFETY_MS = 2600;

let beatTimer: ReturnType<typeof setTimeout> | undefined;

function clearBeat(): void {
  if (beatTimer !== undefined) {
    clearTimeout(beatTimer);
    beatTimer = undefined;
  }
}

/**
 * The ARRIVAL's own backstop. The gate is a courtesy to the animation, never
 * its hostage: a flight that never launched, a killed timeline or a stage torn
 * down mid-air must not leave the player looking at a stage with no focus ring,
 * no verbs and every press swallowed.
 *
 * Armed from the ANSWER, not from the claim, because the surface cannot exist
 * before the answer does — an honest wait on a slow server is not the failure
 * this guards. Generous next to the batch it covers (~1.1 s for a pair, ~1.6 s
 * for the seven-card reveal once the landing cadence has spread it), and short
 * enough that the failure reads as an abrupt arrival rather than a dead screen.
 */
const ARRIVAL_SAFETY_MS = 5000;

let arrivalTimer: ReturnType<typeof setTimeout> | undefined;

function clearArrival(): void {
  if (arrivalTimer !== undefined) {
    clearTimeout(arrivalTimer);
    arrivalTimer = undefined;
  }
}

function armArrivalSafety(): void {
  if (workspaceOutcomeState.arrivalDone || typeof setTimeout !== 'function') {
    return;
  }
  clearArrival();
  arrivalTimer = setTimeout(() => {
    arrivalTimer = undefined;
    workspaceOutcomeState.arrivalDone = true;
  }, ARRIVAL_SAFETY_MS);
}

/** The shell: the artifact exists — the card may turn over. */
export function markWorkspaceOutcomeAnswerIn(): void {
  if (workspaceOutcomeState.sourceCard !== '') {
    workspaceOutcomeState.answerIn = true;
    if (arrivalTimer === undefined) {
      armArrivalSafety();
    }
  }
}

/** The execution beat finished (the flight settled, or the backstop fired). */
export function markWorkspaceOutcomeBeatDone(): void {
  clearBeat();
  workspaceOutcomeState.beatDone = true;
}

/** Is the execution beat still playing? */
export function workspaceOutcomeBeatPending(): boolean {
  return workspaceOutcomeState.sourceCard !== '' && !workspaceOutcomeState.beatDone;
}

/** The batch has fully arrived (landed, opened, handed over) — input may open. */
export function markWorkspaceOutcomeArrivalDone(): void {
  clearArrival();
  workspaceOutcomeState.arrivalDone = true;
}

/** The claim's own beat has physically launched this outcome's cards off the
 *  pile — an arriving surface must not deal them a second time. */
export function markWorkspaceOutcomeArrivalFlown(): void {
  if (workspaceOutcomeState.sourceCard !== '') {
    workspaceOutcomeState.arrivalFlown = true;
  }
}

/** Did the claiming workspace already fly this outcome's cards? (See the flag.) */
export function workspaceOutcomeArrivalFlown(): boolean {
  return workspaceOutcomeState.sourceCard !== '' && workspaceOutcomeState.arrivalFlown;
}

/**
 * Is a claimed batch still ARRIVING? Embedded stages ask this before they
 * draw a focus ring, name a focused card or accept a press.
 */
export function workspaceOutcomeArrivalPending(): boolean {
  return workspaceOutcomeState.sourceCard !== '' && !workspaceOutcomeState.arrivalDone;
}

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
    releaseWorkspaceOutcome('claim-safety');
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
  nodeIndex = 0,
  expectedCards = 0,
  scope: WorkspaceOutcomeScope = 'card',
): void {
  if (sourceCard === '' || kinds.length === 0) {
    releaseWorkspaceOutcome('empty-claim');
    return;
  }
  workspaceOutcomeState.host = host;
  workspaceOutcomeState.sourceCard = sourceCard;
  workspaceOutcomeState.nodeIndex = nodeIndex;
  workspaceOutcomeState.kinds = [...kinds];
  workspaceOutcomeState.scope = scope;
  workspaceOutcomeState.stage = 'awaiting';
  workspaceOutcomeState.expectedCards = Math.max(0, Math.floor(expectedCards));
  workspaceOutcomeState.arrivalFlown = false;
  clearArrival();
  // Only a CARD outcome arrives by flying; a deck-check presents in the
  // composer's own slot and must not leave the input gate closed behind it.
  workspaceOutcomeState.arrivalDone =
    !(kinds.includes('draw') || kinds.includes('pick'));
  // The execution beat starts owing its minimum time from the confirm — not
  // from when the answer happens to land, or a fast server would shorten the
  // very beat that explains what the action is doing.
  workspaceOutcomeState.answerIn = false;
  workspaceOutcomeState.beatDone = false;
  clearBeat();
  if (typeof setTimeout === 'function') {
    beatTimer = setTimeout(() => {
      markWorkspaceOutcomeBeatDone();
    }, BEAT_SAFETY_MS);
  } else {
    workspaceOutcomeState.beatDone = true;
  }
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
    // …and the ARRIVAL backstop restarts from HERE. It covers «the flight never
    // completed», and the flight cannot start before the surface it lands in
    // exists: a play's own cinematic (the card lifting out of the hand, landing
    // on its pile, paying its rewards) legitimately stands between the answer
    // and this moment, and armed from the answer alone the backstop could spend
    // itself during it — opening the input gate over slots that are still empty.
    armArrivalSafety();
  }
}

/**
 * THE CHAIN HAS ANOTHER BATCH QUEUED — the claim STAYS and re-arms for it
 * instead of dying with the batch just taken.
 *
 * One press's causal chain routinely produces SEVERAL drawn batches (a
 * traversal's stage draw and its repeat's own draw; a colony chain's cycles),
 * and the server queues them as separate reveal events. The claim used to end
 * at the first batch's take («the claim ENDS AT THE TAKE»), which was right
 * for a chain of one — and for a chain of two it stranded the second batch:
 * claimless, it failed `workspaceClaimsDrawReveal`, skipped the scene-exit
 * barrier (claim-gated) and rose as the STANDALONE band over the workspace
 * that was still finishing the first batch's exits — small ladder cards, no
 * dim, two batches on one frame (the 20260830201630/1638 defect).
 *
 * Re-arming keeps host / slot / kinds / scope — the identity of the LEASE —
 * and resets only the per-batch arrival lifecycle, so the queued batch waits
 * out the previous exits behind the same barrier and then presents EMBEDDED
 * in the same zone, exactly like its sibling.
 */
export function retainWorkspaceOutcomeForNextBatch(expectedCards = 0): void {
  if (workspaceOutcomeState.sourceCard === '') {
    return;
  }
  workspaceOutcomeState.stage = 'awaiting';
  workspaceOutcomeState.expectedCards = Math.max(0, Math.floor(expectedCards));
  workspaceOutcomeState.arrivalFlown = false;
  clearArrival();
  workspaceOutcomeState.arrivalDone =
    !(workspaceOutcomeState.kinds.includes('draw') || workspaceOutcomeState.kinds.includes('pick'));
  // The next batch is a fresh «claimed, and nothing came yet» question — the
  // backstop guards it exactly as it guarded the first one.
  armSafety();
}

/**
 * THE STEP ENDED, THE FLOW DID NOT — move a live claim UP to the workspace
 * that was hosting the step.
 *
 * A card can be played INSIDE a hosted step («Эпатажный спонсор» teleports the
 * hand into the Game Start Workspace), and the claim is placed on the DEEPEST
 * host by construction — the hand. But that step's whole purpose is the play,
 * so it unmounts the moment the card lands, several beats BEFORE the play's own
 * follow-up arrives. Released there, the pick the card raised belonged to
 * nobody: it opened as a standalone «ДОБОР КАРТ» band over a start workspace
 * that was still standing, and the deployment — no longer seeing an embedded
 * step — felt free to advance to its next stage ON TOP of it.
 *
 * The honest answer is the same «nearest live unfinished step» law the claim
 * was placed by, applied on the way OUT: the outcome belongs to the next host
 * still on screen, which for a hosted play is the workspace the player never
 * left.
 *
 * ⚠️ THE STAGE IS NOT RESET. It reads as an obvious courtesy — «the artifact is
 * not on screen in the NEW zone yet» — and it is a trap: the zone is published
 * on the claim, so `workspaceOutcomeEmbedded` is TRUE on both sides of the
 * move and never changes. The watcher that would restore `presenting` fires on
 * a CHANGE, so a stage put back to `awaiting` here stays there forever — and
 * `embedPresenting` is what makes the host's zone live, so the surface renders
 * into a zone that is still posed as empty (measured: the pick painted a sliver
 * behind the header). A claim that was on screen stays on screen; it merely
 * moved house.
 */
export function rehomeWorkspaceOutcome(host: WorkspaceOutcomeHost, slot: string): void {
  if (workspaceOutcomeState.sourceCard === '') {
    return;
  }
  workspaceOutcomeState.host = host;
  workspaceOutcomeState.embedSlot = slot;
}

/**
 * DIAGNOSTIC — WHO performed the LAST release, for the e2e lifecycle probes
 * (`__conColonyDiag`). A wrong release is a one-frame event that took three
 * instrumented e2e runs to localize once; a symbolic reason at each call site
 * names the culprit on the first look (a stack is minified in prod builds).
 */
export let lastOutcomeReleaseStack = '';

/** Drop the claim (the stage folded, the outcome was acknowledged, unmount). */
export function releaseWorkspaceOutcome(reason = 'unspecified'): void {
  lastOutcomeReleaseStack = `${reason} @${typeof performance !== 'undefined' ? Math.round(performance.now()) : 0}`;
  clearSafety();
  clearBeat();
  clearArrival();
  workspaceOutcomeState.answerIn = false;
  workspaceOutcomeState.beatDone = false;
  workspaceOutcomeState.expectedCards = 0;
  workspaceOutcomeState.arrivalDone = true;
  workspaceOutcomeState.arrivalFlown = false;
  workspaceOutcomeState.host = undefined;
  workspaceOutcomeState.sourceCard = '';
  workspaceOutcomeState.nodeIndex = 0;
  workspaceOutcomeState.kinds = [];
  workspaceOutcomeState.scope = 'card';
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
/**
 * The claiming workspace flies its OWN arrival beat for this batch — the
 * deck-draw scene must step aside (two flights for one card would aim at two
 * places). ONLY the card-actions composer owns such a beat (its prepared
 * `beatstage` + runBatchArrival); the START host deliberately has none — the
 * deck-draw scene SERVES it, flying the cards from the HUD pile into the
 * embedded reveal's own slots.
 */
export function workspaceClaimOwnsArrival(source: CardDrawRevealSource | undefined): boolean {
  return workspaceClaimsDrawReveal(source) && workspaceOutcomeState.host === 'card-actions';
}

export function workspaceClaimsDrawReveal(source: CardDrawRevealSource | undefined): boolean {
  if (!workspaceOutcomeAdmits('draw')) {
    return false;
  }
  // AN UNATTRIBUTED DRAW BELONGS TO THE OPEN WORKSPACE.
  //
  // The server names a draw's source from the running event scope, and not
  // every effect establishes one — a corporation's mandatory first action
  // calls `drawCard` outside any scope, so its batch arrives with NO source
  // at all (Celestic: «reveal until 2 floater cards»). Keyed on a NAME match
  // alone, that batch belonged to nobody and fell back to the standalone
  // full-bleed reveal — over an open workspace whose whole contract is to
  // host exactly this. A sourceless batch has no other owner by construction
  // (every presenter that competes for one — the tile bonus, the colony
  // payout, the global-parameter reward — is identified BY its source), so
  // «a workspace is open ⇒ the workspace takes it» is not a guess here, it
  // is the only reading available.
  if (source === undefined) {
    return true;
  }
  if (source.type !== 'card') {
    return false;
  }
  // A 'chain' claim answers for the whole causal chain of one press — the
  // server names the card whose EFFECT drew, which for a triggered effect is
  // not the card the player pressed (see WorkspaceOutcomeScope).
  return workspaceOutcomeState.scope === 'chain' ||
    source.cardName === workspaceOutcomeState.sourceCard;
}

/**
 * Does the COLONY WORKSPACE own this COLONY-sourced batch? The colony
 * analogue of `workspaceClaimsDrawReveal`: a trade the player confirmed in
 * the colonies section claims its own drawn payout (Pluto), keyed on the
 * server's own `CardDrawRevealSource {type:'colony', colonyName}` — an
 * OPPONENT's trade granting the viewer a colony bonus stays with the
 * standalone presenters (the claim only exists between the section's own
 * confirm and its outcome).
 */
export function workspaceClaimsColonyReveal(source: CardDrawRevealSource | undefined): boolean {
  return workspaceOutcomeState.host === 'colonies' &&
    workspaceOutcomeAdmits('draw') &&
    source?.type === 'colony' &&
    source.colonyName === workspaceOutcomeState.sourceCard;
}

/**
 * Does an open workspace own this DECK-CHECK result? `action` is
 * `lastReveal.action` — the acting card's name.
 *
 * SCOPE applies here exactly as it does to a draw. A REPEAT flow (Project
 * Inspection played from the hand, the Hydronetwork's stage-7 copy) commits one
 * card and the server attributes the verdict to the card whose action actually
 * ran — «Поиски жизни», never «Проверка проекта». Keyed on the name alone that
 * batch matched no claim and left for the full-bleed modal over the very
 * workspace whose press had produced it; a 'chain' claim answers for everything
 * one press set off, and its window is one submit wide.
 */
export function workspaceClaimsDeckCheck(action: string | undefined): boolean {
  return workspaceOutcomeAdmits('deck-check') &&
    action !== undefined &&
    (workspaceOutcomeState.scope === 'chain' || action === workspaceOutcomeState.sourceCard);
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

/**
 * Does an open workspace own the optional EFFECT DECISION the server just
 * raised? Same shape — and same safety — as `workspaceClaimsPick`: a
 * `choiceContext` carries no attribution to the card the player PRESSED (the
 * asking card is a third one entirely — Mars University answering somebody
 * else's science tag), so what makes this honest is the claim's narrowness. It
 * exists only between a workspace's submit and its outcome, and one press's
 * whole causal chain is exactly what a `'chain'` claim answers for.
 *
 * The CALLER still has to check that the prompt really is a decision this
 * console can present (`buildEffectDecision`): claiming a shape with no
 * embedded surface would suppress the standalone one and show the player
 * nothing at all.
 */
export function workspaceClaimsEffect(): boolean {
  return workspaceOutcomeAdmits('effect');
}

/** Full reset (game switch / test cleanup). */
export function resetWorkspaceOutcome(): void {
  releaseWorkspaceOutcome();
}

/**
 * THE PHYSICAL ORIGIN of the workspace's SOURCE card — one resolver, every
 * host that offers `L3 Источник`.
 *
 * The source card is a real object on screen: the action composer's hero
 * column holds it for the whole flow. So L3 must LIFT THAT CARD into the
 * fullscreen (the zoom motion holds its slot empty for the duration —
 * `.con-zoom-hold`), never open a second copy beside it. A textual origin
 * did exactly that: the hero stayed in its column while an identical card
 * rose in the middle of the screen, which reads as two of the same card and
 * breaks the console's physicality rule.
 *
 * Standalone hosts (a reveal the player did not open a workspace for) have no
 * composer on screen: `resolve` returns null and the viewer degrades to the
 * documented textual entrance by itself — one call site, both worlds.
 */
export function workspaceSourceZoomOrigin(name: string): ZoomOrigin {
  return {
    kind: 'physical',
    resolve: () => {
      if (typeof document === 'undefined' || name === '') {
        return null;
      }
      const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(name) : name.replace(/"/g, '\\"');
      // EVERY host that offers `L3 Источник`, in the order the card can be
      // standing in one of them. The card-actions composer holds it in its
      // hero column; the START workspace holds it in the step's source seat —
      // and that second one was missing, so a draw hosted by the start scene
      // degraded to the TEXTUAL entrance: the viewer rose out of nowhere while
      // the seat kept its card, and the player saw two of the same card. The
      // whole point of a physical origin is that there is only ever one.
      return document.querySelector<HTMLElement>(
        `[data-motion-surface="action-composer"] [data-zoom-slot="${key}"]`) ??
        document.querySelector<HTMLElement>(
          '[data-embed-source-slot] :is(.card-container, .pcard)');
    },
  };
}
