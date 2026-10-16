/*
 * CONSOLE PLAYED-CARD HERO — the animation TRANSACTION behind the signature
 * "the card physically lands on my tableau" scene (console-native only).
 *
 * The gate follows the established trade-fleet / hydro-marker contract, byte
 * for byte in spirit:
 *
 *   ConsoleShell ARMS the transaction at submit time (armPlayedHero — BEFORE
 *   the batch POST; nothing visual happens yet), WaitingFor DETECTS it once
 *   per response (detectPlayedHero — consumes the arm, and VERIFIES the
 *   server actually put the card into the tableau: no server success → no
 *   scene, ever), HOLDS the commit through the pre-commit half of the scene
 *   (await runPlayedHero — lift → overlay swap → hero arc → landing), then
 *   COMMITS the authoritative view (delta-chips fire HERE, strictly after
 *   touchdown — the chip gate IS the commit hold, the project idiom), and
 *   finally endPlayedHero() plays the post-commit half (frame-perfect proxy →
 *   real-slot swap, the result beat, the auto-close). abortPlayedHero() is
 *   wired into every error path and a safety timer — the gate can never hang
 *   and a failed play never leaves a ghost card or a stuck lock.
 *
 * Ownership map:
 *   - phases / geometry / speed profile → playedHeroModel (pure, tested);
 *   - GSAP work on the proxy            → playedHeroDirector;
 *   - the fixed proxy stage             → ConsolePlayedHeroLayer.vue;
 *   - the reserved slot + reveal        → ConsolePlayedOverlay (hero props);
 *   - composer close / table open      → ConsoleShell watchers on `phase`.
 *
 * TWO SCENERIES, one transaction (`host`, decided at arm):
 *   - 'overlay'   — the standalone table opens over the board (a play with
 *     no workspace behind it: the playFromHand band, the start scene, or a
 *     manually-open table);
 *   - 'workspace' — the CARD PLAY WORKSPACE final stage: the hand workspace
 *     never closes, its right zone becomes the EMBEDDED «Разыграно»
 *     (ConsolePlayedLandingStage inside the composer), the card is laid onto
 *     its real pile INSIDE the same frame, and the workspace folds to the
 *     board only after the result beat. The external overlay never opens.
 */

import {reactive, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {
  HeroRect, PlayedHeroPhase, planHeroPath,
  HERO_LIFT_MS, HERO_FLIGHT_MS, HERO_LAND_MS, HERO_CLOSE_MS,
  HERO_RESULT_PAUSE_MS, HERO_REDUCED_MS, HERO_REDUCED_PAUSE_MS, HERO_SAFETY_TIMEOUT_MS,
} from '@/client/console/played/playedHeroModel';
import {
  placeHeroProxy, playHeroLift, playHeroFlight, playHeroReducedHop, disposeHeroProxy, glideHeroOnto, hideHeroProxyNextFrame,
  killHeroTweens, HeroStageEls,
} from '@/client/console/played/playedHeroDirector';
import {
  runResourceTransfers, abortResourceTransfers, beginPanelRewardHold, releasePanelRewardHold,
  resetCardResourceLandings, noteCardResourceLanding,
  cardResourceLanded,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  ResourceTransferSpec, TRANSFER_BEAT_MS, TRANSFER_READ_MS, TRANSFER_RESIDUAL_PAUSE_MS, transferFlightBudgetMs, transferWaveDelayMs,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  abortPlayedCardReturns, capturePlayedCardReturnSource, hasPendingPlayedReturns, runPlayedCardReturns,
} from '@/client/console/played/playedCardReturn';
import {PlayReaction, splitPlayRewards, cardTargetGroups} from '@/client/console/played/receivingStageModel';
import {runCardReceive} from '@/client/console/cardReceive/cardReceiveDirector';
import {RailReward, flyRailReward, railRewardPending, releaseRailReward, seedRailReward, verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {TOUCHDOWN_TICK_GAP_MS, TransferPoint, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {bareWildIcons, iconNeedlesFor, resolveActionCommitAnchors, resolveSpendIconOrigins, wildChosen} from '@/client/console/consoleActionCommitMotion';
import type {PlayCardPrice} from '@/client/console/consoleActionCommit';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {armedEffectsChange, releaseArmedEffectHolds, releaseStagedArmedSpends, settleArmedEffectHolds, shipArmedEffects} from '@/client/console/armedEffectFlight';
import {Tag} from '@/common/cards/Tag';
import {VpShare} from '@/common/game/vpAttribution';
import {claimVpShares, dropVpClaim, flyVpShares, holdsVpShares, releaseVpShares} from '@/client/console/scoreCell/vpShareLedger';

/**
 * The score cell's ledger owner of this scene (TR55 — docs/claude/console/score-cell.md): the played card's own
 * share (its printed VP, a resource the play put on it) flies from its PRINTED badge after the card's own gains; a
 * card the play puts resources on, or wakes, has its share released on the touchdown of its last token.
 */
export const PLAYED_HERO_VP_OWNER = 'played-hero';
/** A card's own play outranks a tile scene of the same response (both may match the card's share). */
const PLAYED_HERO_VP_RANK = 10;

/** Is this share a card row of `cards`? */
function cardShareOf(cards: ReadonlySet<string>): (share: VpShare) => boolean {
  return (share) => share.source.kind === 'card' && cards.has(share.source.card);
}

/** The result beat is SHORT when the server already queued the next decision
 *  — the demonstration yields to the game (spec §13). */
const HERO_RESULT_PAUSE_FOLLOWUP_MS = 220;
/** The RESOLVED-TABLEAU beat of the workspace stage: everything has arrived,
 *  the table stands still, the eye reads the finished state — short. */
const HERO_RESOLVED_BEAT_MS = 260;
/** How long we wait for the table overlay to mount + register its measurer. */
const TARGET_WAIT_BUDGET_MS = 1600;

/**
 * THE PICTURE the proxy paints — the premium face's two identity axes that a
 * host may render differently from another (`ConsoleCardFaceLite`'s
 * contract: LITE is a cost budget, never a different picture). A flight
 * leaves wearing the SOURCE's face and lands wearing the DESTINATION's —
 * the swap rides the apex, the card's fastest frame — so the two copies at
 * the handoff are identical by construction.
 */
export type HeroFace = {
  /** The destination grid's quality tier (`pcard--tier-thumb`) vs the
   *  composer's stationary hero (`normal`). */
  lightweight: boolean,
  /** The live model the face draws its service anchors from (the
   *  stored-resource capsule, the discount chip); `undefined` = the printed
   *  name-only face, which is what a name-only host paints. */
  card?: CardModel,
};

/** How the LANDING face is resolved once the server has answered. */
export type HeroLandingFaceSpec = {
  lightweight: boolean,
  /** `'tableau'` — the committed tableau model of the played card (the
   *  receiving stage's capsule-honest face); `'none'` — the destination
   *  paints the name-only face (the start dock, the effect-source seat). */
  model: 'tableau' | 'none',
};

export type PlayedHeroProxy = {
  card: CardName,
  isEvent: boolean,
  rect: HeroRect,
  /** What the proxy paints RIGHT NOW (source face → landing face at the apex). */
  face: HeroFace,
};

/**
 * WHERE the scene presents its tableau:
 *  - 'overlay'   — the classic path: the system opens the standalone
 *    «Разыграно» table over the board (or lands into a manually-open one);
 *  - 'workspace' — the CARD PLAY WORKSPACE path: the hand workspace stays
 *    open, its right context becomes the EMBEDDED «Разыграно» stage, and the
 *    card is laid onto its pile INSIDE the same frame. No external overlay
 *    ever opens; the workspace folds only after the whole episode settles.
 */
export type PlayedHeroHost = 'overlay' | 'workspace';

export const playedHeroState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as PlayedHeroPhase,
  nonce: 0,
  card: undefined as CardName | undefined,
  isEvent: false,
  /** The scenery of this transaction (decided at arm — see PlayedHeroHost). */
  host: 'overlay' as PlayedHeroHost,
  /** The overlay's reserved slot turns visible ONLY here (post-landing). */
  revealed: false,
  /** The SYSTEM-opened table overlay is mounted (play-animation mode).
   *  NEVER true for the 'workspace' host — that is the whole point of it. */
  tableOpen: false,
  /** FALSE ⇔ the player had «Разыграно» open manually — never auto-close it. */
  autoClose: true,
  /** The flying proxy geometry (undefined → no-flight fallback path). */
  proxy: undefined as PlayedHeroProxy | undefined,
  /**
   * THE SHIPMENT BEAT's outcome, named ('' — the play takes nothing off the
   * rail): `flying` → `flown`, or why it was not shown as promised (`reduced`,
   * `mismatch: …`, `no-source`, `degraded: …`) — the rows ticked with the
   * commit then, honestly late. Read by the e2e probe through the readiness
   * snapshot.
   */
  shipment: '' as string,
  /**
   * THE TABLE'S ANSWER ON THE CARDS (К-S1 — PL-124), named: '' — the play woke no holder; `held` — the promised
   * holders verified and held for the beat; `mismatch: …` — a counter that moved otherwise is not flown (it
   * ticked with the commit, honestly late). Read by the e2e probe through the readiness snapshot.
   */
  reactions: '' as string,
  /**
   * THE CARD'S PRICE PAID WITH CARD RESOURCES (PL-163), named: '' — the play paid none; `flying` → `flown`; or why
   * it was not flown (`reduced`, `mismatch: …`, `no-row: <unit>` — the pay row was not on screen, `no-source`).
   */
  price: '' as string,
  /**
   * THE PRICE OFF A CARD THE COMPOSER CHOSE (PL-268, TR52), named: '' — none; `flying` → `flown`; or why it was not
   * flown (`reduced`, `mismatch: …` — the holder moved otherwise, `no-row` — the target row was not on screen).
   */
  targetSpend: '' as string,
});

/** One-shot claim per response (mirrors tradeFleet's `claimed`). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** Resolves the skippable result beat. */
let pauseResolve: (() => void) | undefined;
/** The server queued a follow-up decision → the result beat shortens. */
let followUpPending = false;
/** The composer card we visually blanked under the proxy (restored on abort). */
let heldSourceEl: HTMLElement | undefined;
/**
 * The play's IMMEDIATE resource gains (composer-extracted from the server
 * preview) — the REWARD BEAT of the scene: once the card has landed and been
 * read, these emerge from it as physical chips and land on the exact left-
 * panel zones; each touchdown releases its metric from the panel reward hold
 * (seeded just before the commit), firing that delta chip at the contact.
 */
let pendingRewards: ReadonlyArray<ResourceTransferSpec> = [];
/** The hold was seeded for THIS transaction (the commit path's one-shot). */
let rewardHoldSeeded = false;
/**
 * THE HOLDS THIS SCENE SEEDED AND HAS NOT RELEASED — released one by one at
 * each chip's touchdown, and whatever is left at the beat's end / an abort /
 * the finish. NEVER `clearPanelRewardHold()` here: that drops every hold on
 * the board, including one another flow seeded in the same response for a
 * chip of its own (the Parliament's Agenda walk holds the rating until the
 * marker has reached the step that pays it — TR04; the colony build learned
 * the same lesson). The scene lets go of its OWN and nobody else's.
 */
let heldRewards: Array<ResourceTransferSpec> = [];

/**
 * THE PLAY'S RAIL HALF (PL-001 for plays — `consoleActionCommit.playRailReward`):
 * the branch's DIRECT TR and the table's answer to it, promised at the arm,
 * checked against the two views in the apply block (`railReward.seedRailReward`
 * — a rating that moved otherwise is not held and names itself), flown by the
 * reward beat from the landed card's printed TR — the face-down pile for an
 * event — after the card's own gains, and released by this scene's every
 * ending. The rating, the VP cell derived from it and the table's answer tick
 * on their own touchdowns, never with the commit.
 */
let pendingRail: RailReward | undefined;
/** The rail reward this transaction SEEDED (its owner key) — undefined: nothing of it is held. */
let heldRailKey: string | undefined;

/**
 * THE TABLE'S ANSWER TO THE PLAY ON THE CARDS (К-S1 — PL-124): the HOLDERS of
 * the viewer's own tableau the play wakes (TR05's science data, Decomposers'
 * microbe, TR38's microbe / animal data), promised at the arm off the EXACT
 * forecast facts the composer showed (`receivingStageModel.playCardReactions`),
 * verified in the apply block against the two views EACH ON ITS OWN (the rail's
 * class, `verifyRailReward` on the holder's `card-resource:<kind>@<card>` row —
 * a counter that moved otherwise is never flown, it ticks with the commit and
 * names itself), and flown by the reward beat as FURTHER EFFECT RESOLUTION
 * groups after the card's own gains: the holder EMERGES from its strip, the
 * chip is born on the landed card's PRINTED TAG that woke it (the cause, where
 * the eye looks for it), lands on the holder's capsule — the capsule ticking on
 * the touchdown — and the holder settles back. A question, a deferred payout
 * and an uncomputed reaction never reach here (`playCardReactions` keeps only
 * the exact), so «honestly late» is the only other outcome. The rail's answers
 * (the Greens' M€) ride `pendingRail.reactions` as before — one beat after the
 * cause's last touchdown.
 */
let pendingReactions: ReadonlyArray<PlayReaction> = [];
/** The reactions that VERIFIED — their specs are in `heldRewards` too (released on touchdown / by every ending). */
let heldReactions: ReadonlyArray<PlayReaction> = [];
/**
 * THE TABLE'S ANSWER ON THE RAIL WITH NO RATING TO RIDE (PL-035 — the ruling
 * Greens' M€ production for a heat / plant production step, TR41 Plasma Fans):
 * the play's rail half carries the reactions with an EMPTY cause, which the
 * rail module refuses to hold (an answer needs a cause to be released by), so
 * the plate TICKED WITH THE COMMIT — a second before the production token it
 * answers had landed. Verified here against the two views (the reaction's row
 * moved by exactly the promise plus the known moves), held on the panel, and
 * released ONE BEAT after the scene's own wave has landed; every ending of the
 * scene releases them at once.
 */
let heldAnswers: Array<ResourceTransferSpec> = [];

/**
 * THE SHIPMENT BEAT (PL-107 — the rail-spend law, PL-099, at the play door):
 * the stock prices the play takes OFF THE RAIL as an EFFECT (X87 Shipment to
 * Earth's 3 plants and 3 steel, Moss's plant — a `cost` chip of a standard
 * resource, never the card's own price), promised at the arm
 * (`consoleActionCommit.playSpendReward`), checked against the two views
 * once the answer is in (`verifyRailReward` — a row that moved otherwise is
 * not flown and names itself), and flown BEFORE THE LIFT: the card still
 * stands in the composer, so each token is born on its row's digits, leaves
 * SIDEWAYS (PL-104) and is absorbed at the printed icon of that very
 * resource on the standing card — the shipment goes INTO the card, then the
 * card goes to the table, and only then the card pays back (the reward beat).
 *
 * The row ticks on the DEPARTURE through a DEPARTURE HOLD: the view is not
 * applied yet (the commit waits for the landing), so from the token's launch
 * the row reads `committed − amount` (a gain-shaped hold on the pre-commit
 * value — the only transition the rail makes, and it is the departure's own),
 * and the commit's block releases the hold against the applied view: the same
 * number, no transition, no second chip. An abort before the commit lets go of
 * it and the row returns to the truth — a failed play ships nothing.
 */
let pendingSpends: RailReward | undefined;
/**
 * THE CARD'S PRICE PAID WITH CARD RESOURCES (PL-163): a floater of Dirigibles, a mech of EVA Mechs — a counter the
 * player cannot see while the hand stands. Its visible double is the composer's own PAY ROW; the token is born on
 * that row's icon and absorbed into the standing card's printed COST badge in the same shipment beat as the stock
 * spends (in parallel — both go INTO the card), before the lift. Checked against the two views like the shipment
 * (`verifyRailReward` — a holder that moved otherwise is not flown and names itself in `playedHeroState.price`).
 */
let pendingPrice: PlayCardPrice | undefined;
/**
 * THE PRICE OFF A CARD THE COMPOSER CHOSE (PL-268, TR52): what the play takes off a holder picked in the composer's
 * own step — any seat's card. Flown in the shipment beat beside the rail's and the pay rows' tokens.
 */
let pendingTargetSpends: ReadonlyArray<ResourceTransferSpec> = [];
/** The departure holds this transaction seeded (gain-shaped) — released by the commit's block, or by an abort. */
const departureHolds: Array<ResourceTransferSpec> = [];
/** The applied view the answer is checked against (handed in with the answer — `runPlayedHero`). */
let beforeView: PlayerViewModel | undefined;

/** The shipment beat's longest run — one wave of tokens and the absorb beat — for the scene's safety net. */
function shipmentBudgetMs(): number {
  return motionMs(transferFlightBudgetMs() + transferWaveDelayMs(1, 2) + TRANSFER_BEAT_MS);
}

/** Let go of every departure hold this transaction seeded (the commit's block, an abort, the finish) — idempotent. */
function releaseDepartures(): void {
  const left = departureHolds.splice(0);
  for (const hold of left) {
    releasePanelRewardHold(hold);
  }
}

function playedHeroRailKey(card: CardName): string {
  return `played-hero:${card}`;
}

/** Let go of this scene's rail half (an ending that did not fly it): the rows tick now, honestly late. */
function releaseHeroRail(why: string): void {
  const key = heldRailKey;
  heldRailKey = undefined;
  pendingRail = undefined;
  if (key !== undefined) {
    releaseRailReward(key, why);
  }
}

/** Release ONE of this scene's holds (a chip's touchdown) — the spec's own metric ticks, the others stay held. */
function releaseHeroReward(spec: ResourceTransferSpec): void {
  const index = heldRewards.indexOf(spec);
  if (index !== -1) {
    heldRewards.splice(index, 1);
    releasePanelRewardHold(spec);
  }
}

/** Release every hold this scene still owns (the beat's end, an abort, the finish) — its chips fire late, never lost; foreign holds untouched. */
function releaseHeroRewards(): void {
  const left = heldRewards.splice(0);
  for (const spec of left) {
    releasePanelRewardHold(spec);
  }
  releaseHeroAnswers();
}

/** Release the table's rail answers at once (an ending) — idempotent. */
function releaseHeroAnswers(): void {
  const left = heldAnswers.splice(0);
  for (const spec of left) {
    releasePanelRewardHold(spec);
  }
}

/**
 * HOLD the table's rail answers of a play with no rating to ride (PL-035): each
 * answer's row checked against the two views with the rail's known moves — a
 * row that moved otherwise is not held, ticks with the commit and names itself.
 */
function holdHeroAnswers(rail: RailReward, before?: PlayerViewModel, after?: PlayerViewModel): void {
  const verdict = verifyRailReward({cause: [], reactions: rail.reactions, known: rail.known}, before, after);
  if (verdict.mismatches.length > 0) {
    playedHeroState.reactions = `mismatch: ${verdict.mismatches.join('; ')}`;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[played-hero] ${playedHeroState.card}: the table's rail answer was not shown as promised — ${verdict.mismatches.join('; ')}`);
    }
  }
  if (verdict.reactions.length === 0) {
    return;
  }
  heldAnswers = [...verdict.reactions];
  beginPanelRewardHold(heldAnswers);
}

/** The table's rail answers tick ONE BEAT after the scene's wave has landed (`TOUCHDOWN_TICK_GAP_MS`), on the animation clock. */
function answerHeroAfterWave(): void {
  const answers = heldAnswers.splice(0);
  if (answers.length === 0) {
    return;
  }
  gsap.delayedCall(motionMs(TOUCHDOWN_TICK_GAP_MS) / 1000, () => {
    for (const spec of answers) {
      releasePanelRewardHold(spec);
    }
  });
}

// ── stage / target registries (layer + overlay plug in) ────────────────────

type HeroStageHandle = {els: () => HeroStageEls | undefined};
let stage: HeroStageHandle | undefined;

export function registerPlayedHeroStage(handle: HeroStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

type HeroTargetMeasure = () => Promise<HeroRect | undefined>;
/** A SYNCHRONOUS read of the landing rect at REST (`restingRectOf`) — the
 *  final-approach retarget's one live look; `undefined` = not readable now. */
type HeroTargetPeek = () => HeroRect | undefined;
let targetMeasure: HeroTargetMeasure | undefined;
let targetPeek: HeroTargetPeek | undefined;

/**
 * The landing place registers its reserved-slot measurer here (the
 * stability-looped aim taken BEFORE the flight) and, optionally, a cheap
 * synchronous peek the flight re-reads once on its final approach.
 */
export function providePlayedHeroTarget(fn: HeroTargetMeasure, peek?: HeroTargetPeek): () => void {
  targetMeasure = fn;
  targetPeek = peek;
  return () => {
    if (targetMeasure === fn) {
      targetMeasure = undefined;
      targetPeek = undefined;
    }
  };
}

/**
 * THE EFFECT DELIVERY HOOKS — the workspace RECEIVING STAGE plugs its
 * physical target choreography in here. For every card the play sends a
 * resource to, the transaction asks the scene to EMERGE the target (the card
 * comes forward out of its strip / its compact mini family — resolved
 * instantly when the card is already open), flies the chips between the two
 * physical anchors, then asks the scene to SETTLE it back. Absent hooks (the
 * overlay host, a degraded scene) fall back to the classic single wave.
 */
export type ReceivingEffectHooks = {
  emergeTarget: (card: CardName) => Promise<void>,
  settleTarget: (card: CardName) => Promise<void>,
};
let effectHooks: ReceivingEffectHooks | undefined;

export function provideReceivingEffectHooks(hooks: ReceivingEffectHooks): () => void {
  effectHooks = hooks;
  return () => {
    if (effectHooks === hooks) {
      effectHooks = undefined;
    }
  };
}

/**
 * The card-resource TARGETS of the armed play, excluding the played card
 * itself — the receiving stage prepares their emergence anchors (and any
 * foreign owner's mini) at prewarm, so a delivery never mounts UI mid-beat.
 */
export function playedHeroCardTargets(): ReadonlyArray<CardName> {
  if (!playedHeroState.active) {
    return [];
  }
  const {cardSpecs} = splitPlayRewards(pendingWaveSpecs());
  const out: Array<CardName> = [];
  for (const spec of cardSpecs) {
    if (spec.targetCard !== undefined && spec.targetCard !== playedHeroState.card && !out.includes(spec.targetCard)) {
      out.push(spec.targetCard);
    }
  }
  return out;
}

/**
 * Per-card TOTALS of the armed play's card-resource gains (the played card
 * itself included). The receiving stage latches these at the arm and renders
 * every visible target's stored-resource capsule as `committed − still in
 * flight`, ticking it up on each chip's own touchdown
 * (`cardResourceLanded`) — the count changes exactly at the contact, never
 * before the flight.
 */
export function playedHeroCardGainTotals(): Readonly<Record<string, number>> {
  if (!playedHeroState.active) {
    return {};
  }
  const {cardSpecs} = splitPlayRewards(pendingWaveSpecs());
  const out: Record<string, number> = {};
  for (const spec of cardSpecs) {
    if (spec.targetCard !== undefined) {
      out[spec.targetCard] = (out[spec.targetCard] ?? 0) + spec.amount;
    }
  }
  return out;
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isPlayedHeroActive(): boolean {
  return playedHeroState.active;
}

/** TRUE while the scene owns the foreground (surfaces / prompts stay held).
 *  `armed` deliberately does NOT hold — nothing visual happened yet. */
export function playedHeroHolding(): boolean {
  const p = playedHeroState.phase;
  return playedHeroState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

/**
 * The WORKSPACE LANDING STAGE is presenting: the play composer's right zone
 * shows the embedded «Разыграно» tableau and the card is (about to be /
 * being / just) laid onto its pile. Exactly the holding window, gated on the
 * 'workspace' host — the composer renders its landing layer off this.
 */
export function playedHeroLandingUp(): boolean {
  // Not while the shipment leaves the rail: the card still STANDS in the composer then — the stage waits, mounted.
  return playedHeroState.host === 'workspace' && playedHeroHolding() && playedHeroState.phase !== 'shipping';
}

/**
 * The PREWARM window of the workspace landing: the submit is in flight
 * ('armed'), nothing visual has happened, but the embedded tableau should
 * already be MOUNTED (hidden) so the commit's unfold reveals settled
 * geometry — layout done, peek faces painted, arts decoding. After A nothing
 * heavy may happen for the first time.
 */
export function playedHeroLandingPrewarm(): boolean {
  return playedHeroState.host === 'workspace' && playedHeroState.active &&
    (playedHeroState.phase === 'armed' || playedHeroState.phase === 'shipping');
}

/**
 * The incoming card the tableau reserves a slot for — undefined outside the
 * visual window (armed/idle/failed). Shared by BOTH hosts (the shell's
 * standalone overlay and the workspace landing stage) so the two can never
 * disagree about when the reserved slot exists.
 */
export function playedHeroIncomingCard(): {name: CardName} | undefined {
  if (!playedHeroState.active || playedHeroState.card === undefined) {
    return undefined;
  }
  const p = playedHeroState.phase;
  if (p === 'armed' || p === 'shipping' || p === 'idle' || p === 'failed') {
    return undefined;
  }
  return {name: playedHeroState.card};
}

// The whole scene — incl. the POST-COMMIT reveal / reward beat — holds the
// presentation: notifications queue, mandatory surfaces wait. Releases the
// instant `finish`/`abort` drops the phase (the GSAP completion signal).
registerAnimationHoldSupplier('played-hero', playedHeroHolding);

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * Arm BEFORE the submit (the confirm handler of the composer OR a start-scene
 * press). Nothing visual happens until the server proves the play landed in
 * the tableau. `sourceSelector` overrides WHERE the card physically lifts
 * from (default: the play composer's card slot).
 */
export function armPlayedHero(card: CardName, isEvent: boolean, opts: {
  manualTableOpen: boolean,
  sourceSelector?: string,
  targetSelector?: string,
  rewards?: ReadonlyArray<ResourceTransferSpec>,
  /** The table's answer ON THE CARDS — the holders the forecast promised (see `pendingReactions`). */
  reactions?: ReadonlyArray<PlayReaction>,
  /** The play's rail half — its direct TR and the table's answer (see `pendingRail`). */
  rail?: RailReward,
  /** The stock prices the play takes OFF THE RAIL — the shipment beat before the lift (see `pendingSpends`). */
  spends?: RailReward,
  /** The card's price paid with CARD resources — a token off each pay row into the cost badge, before the lift (PL-163). */
  price?: PlayCardPrice,
  /** The price taken off a card the composer's own step chose — off the answered target row (PL-268). */
  targetSpends?: ReadonlyArray<ResourceTransferSpec>,
  host?: PlayedHeroHost,
  /** The picture the card wears where it LIFTS from (default: the composer's
   *  stationary hero — `normal` tier, no live model). */
  sourceFace?: HeroFace,
  /** The picture it must wear where it LANDS (default: the receiving stage's
   *  face — `thumb` tier over the committed tableau model). */
  landingFace?: HeroLandingFaceSpec,
}): void {
  clearTimers();
  claimed = false;
  followUpPending = false;
  pendingRewards = opts.rewards ?? [];
  pendingReactions = opts.reactions ?? [];
  // THE SCORE CELL (TR55): the card's own share and the shares of the cards this play feeds or wakes are this scene's
  // to show — claimed at the press, held by the ledger in the apply block, flown / released by the reward beat.
  releaseVpShares(PLAYED_HERO_VP_OWNER, {why: 're-armed'});
  claimVpShares(PLAYED_HERO_VP_OWNER, cardShareOf(new Set<string>([
    card,
    ...pendingRewards.flatMap((spec) => (spec.channel === 'card-resource' && spec.targetCard !== undefined ? [spec.targetCard] : [])),
    ...pendingReactions.flatMap((r) => (r.spec.targetCard !== undefined ? [r.spec.targetCard] : [])),
  ])), PLAYED_HERO_VP_RANK);
  heldReactions = [];
  playedHeroState.reactions = '';
  releaseHeroRail('re-armed');
  pendingRail = opts.rail;
  releaseDepartures();
  pendingSpends = opts.spends;
  pendingPrice = opts.price;
  pendingTargetSpends = opts.targetSpends ?? [];
  playedHeroState.price = '';
  playedHeroState.targetSpend = '';
  beforeView = undefined;
  playedHeroState.shipment = '';
  // THIS payout's touchdown tally starts empty (the colony flows arm the same
  // way) — a stale count would tick a fresh target before its chip ever flew.
  resetCardResourceLandings();
  rewardHoldSeeded = false;
  sourceSelector = opts.sourceSelector ?? COMPOSER_SOURCE_SELECTOR;
  targetSelectorOverride = opts.targetSelector;
  sourceFace = opts.sourceFace ?? {lightweight: false};
  landingFaceSpec = opts.landingFace ?? {lightweight: true, model: 'tableau'};
  landingView = undefined;
  playedHeroState.active = true;
  playedHeroState.phase = 'armed';
  playedHeroState.nonce++;
  playedHeroState.card = card;
  playedHeroState.isEvent = isEvent;
  playedHeroState.host = opts.host ?? 'overlay';
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.autoClose = !opts.manualTableOpen;
  playedHeroState.proxy = undefined;
  // A response that never detects (error path missed, network limbo) can
  // never wedge the game — the arm self-aborts.
  armSafety = window.setTimeout(() => abortPlayedHero(), HERO_SAFETY_TIMEOUT_MS);
  // THE AIM IS TAKEN DURING THE ROUND TRIP. The workspace landing places are
  // mounted (hidden) at the arm — the receiving stage's front anchor, the
  // start dock's prepared top slot, the effect-source seat — so their REST
  // geometry is measurable while the submit is on the wire. Measured here,
  // the flight starts the instant the lift ends: the card used to hover
  // 70–300 ms after the lift, waiting for a stability loop that was also
  // watching the stage's own entry tween. (The standalone overlay opens only
  // at `preparing`, so it keeps measuring at flight time.)
  prewarmedTarget = playedHeroState.host === 'workspace' ? prewarmTargetRect() : undefined;
  // …and the proxy's picture is DECODED before it is ever born: the flight
  // layer shows the art outright (no load-fade), so the bytes must be there
  // by the time the proxy mounts — the round trip is exactly where that cost
  // is free (the source slot paints the same webp, so this is a cache hit
  // in practice; a cold cache is the case it exists for).
  // Both tiers: the proxy lifts wearing the composer's full-res face and lands wearing the stage's thumb.
  preloadPremiumCardArt([card], ['full', 'thumb']);
}

/**
 * THE AIM, TAKEN AT REST DURING THE ROUND TRIP. The landing place mounts on
 * the arm's own flush (the receiving stage — hidden; the dock's armed slot),
 * so one painted frame later its rest rect is readable through the peek —
 * no stability loop (a loop that watches a stage still laying out at 4K
 * spends hundreds of ms on frames the flight then waits for; any residual
 * drift is the final-approach retarget's business). The looped measurer
 * stays the fallback for a place the peek cannot read yet.
 */
async function prewarmTargetRect(): Promise<HeroRect | undefined> {
  const deadline = Date.now() + TARGET_WAIT_BUDGET_MS;
  // The landing place mounts in the arm's own flush: after `nextTick` it is
  // registered and laid out (the rect read forces layout), and — this is the
  // point — the server cannot have answered yet, so the stage's ENTRY tween
  // has not started shaping the anchor. Read a frame later and a fast local
  // answer (~25 ms) had already flipped the scene to `presenting`: the peek
  // refused (mid-entry) and the flight fell back to the stability loop —
  // the hover this prewarm exists to remove.
  await nextTick();
  let rect = peekTargetRect();
  if (rect !== undefined) {
    return rect;
  }
  while (playedHeroState.active && targetPeek === undefined && targetSelectorOverride === undefined && Date.now() < deadline) {
    await frame();
  }
  if (!playedHeroState.active) {
    return undefined;
  }
  rect = peekTargetRect();
  if (rect !== undefined) {
    return rect;
  }
  return awaitTargetRect(Math.max(200, deadline - Date.now()));
}

/**
 * Consume the arm exactly once per response (WaitingFor). Returns undefined
 * — and fully aborts — unless the SERVER put the armed card into the
 * viewer's tableau (the authoritative success proof).
 */
export function detectPlayedHero(view: PlayerViewModel): {card: CardName} | undefined {
  if (!playedHeroState.active || claimed || playedHeroState.card === undefined) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const card = playedHeroState.card;
  const landed = view.thisPlayer?.tableau?.some((c) => c.name === card) === true;
  if (!landed) {
    abortPlayedHero();
    return undefined;
  }
  const task = taskFor(view);
  followUpPending = task !== undefined && task.kind !== 'actionMenu';
  return {card};
}

/**
 * The PRE-COMMIT half of the scene: lift off the composer, swap the scene
 * around the card (composer closes / table opens with the +1 layout), the
 * hero arc, the landing. Resolves at touchdown — the caller then commits the
 * view (delta-chips fire) and calls endPlayedHero() on nextTick.
 * NEVER rejects; every failure degrades to the no-flight fallback and the
 * promise still resolves (the commit gate can never hang).
 */
export function runPlayedHero(view: PlayerViewModel, before?: PlayerViewModel): Promise<void> {
  // The authoritative answer: the LANDING face is drawn from it (the
  // committed tableau model of the played card), so the picture the proxy
  // wears from the apex on is exactly what the destination will paint.
  landingView = view;
  // …and the view it REPLACES: the shipment beat's promise is checked against the diff of the two.
  beforeView = before;
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      // rAF stall / lost element — force the gate open, degrade gracefully.
      freeRunGate();
    }, motionMs(HERO_LIFT_MS + HERO_FLIGHT_MS + HERO_LAND_MS) + 3000 +
      (pendingSpends !== undefined ? shipmentBudgetMs() + 1000 : 0) +
      // The one-play class (TR49): a spend wave, then an arm wave.
      (armedEffectsChange(before, view) ? 2 * shipmentBudgetMs() + 1000 : 0));
    void executeFlight().finally(() => {
      // PRE-COMMIT, table on screen: measure where the cards this play sends
      // back to hand are lying. The commit removes them from the tableau one
      // frame later — a player whose last events these were loses the pile
      // element entirely, and with it any chance of an honest departure.
      capturePlayedCardReturnSource();
      freeRunGate();
    });
  });
}

/**
 * Seed the PANEL REWARD HOLD — the caller MUST call this in the SAME
 * SYNCHRONOUS BLOCK as `updatePlayerView` (WaitingFor's commit path), never
 * from inside the flight's promise chain.
 *
 * Why the same block: the panel renders `committed − held`. Seeding one
 * micro-task earlier lets Vue flush a frame where the value is still the
 * PRE-commit number while the hold is already subtracted — i.e. the panel
 * dips by exactly the reward (0 → −1 production) and AnimatedMetricValue
 * honestly fires a phantom −N chip, then the commit brings it back to 0 and
 * the touchdown fires +N. Seeding and committing in one block means Vue sees
 * ONE transition (pre-reward → pre-reward: no chip at all), and the only
 * real transition is the release at the chip's touchdown → +N.
 *
 * Idempotent + a no-op when the card grants nothing immediately, under
 * reduced motion, or after an abort (the chips then simply fire with the
 * commit — the honest default).
 *
 * The RAIL HALF (the direct TR) needs the two views: its promise is checked
 * against the diff the commit applies (`seedRailReward`), so a rating that
 * moved by anything else is never held — it ticks with the commit and names
 * itself.
 */
export function seedPlayedHeroRewardHold(before?: PlayerViewModel, after?: PlayerViewModel): void {
  // THE DEPARTURE HOLDS END HERE — in the commit's own block: the rows the shipment left already read the
  // applied number, so the release is no transition at all (and never a chip). Before the early returns: a
  // play with nothing else to hold still shipped.
  if (playedHeroState.active) {
    releaseDepartures();
    // The one-play class (TR49): the shipment presented what the answer arms / spends ahead of the view — the
    // applied view now draws exactly that, so its holds settle in this same block (an arm still in the air keeps the
    // view's own chip invisible until its touchdown).
    settleArmedEffectHolds();
  }
  if (!playedHeroState.active || rewardHoldSeeded || (pendingRewards.length === 0 && pendingRail === undefined && pendingReactions.length === 0)) {
    return;
  }
  if (consoleReducedMotionActive()) {
    pendingRewards = [];
    pendingRail = undefined;
    pendingReactions = [];
    return;
  }
  rewardHoldSeeded = true;
  if (pendingRewards.length > 0) {
    heldRewards = [...pendingRewards];
    beginPanelRewardHold(pendingRewards);
  }
  seedReactions(before, after);
  const rail = pendingRail;
  const card = playedHeroState.card;
  pendingRail = undefined;
  if (rail !== undefined && card !== undefined && rail.cause.length === 0 && rail.reactions.length > 0) {
    // No rating to ride: the answers are held here and tick one beat after the scene's own wave (PL-035).
    holdHeroAnswers(rail, before, after);
  } else if (rail !== undefined && card !== undefined && seedRailReward(playedHeroRailKey(card), rail, before, after)) {
    heldRailKey = playedHeroRailKey(card);
  }
}

function freeRunGate(): void {
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
  const r = runResolve;
  runResolve = undefined;
  r?.();
}

async function executeFlight(): Promise<void> {
  const card = playedHeroState.card;
  if (!playedHeroState.active || card === undefined) {
    return;
  }
  /**
   * THIS EPISODE, and nothing else.
   *
   * `active` alone is not a lifetime: `abortPlayedHero()` lowers it, but the
   * NEXT `armPlayedHero()` raises it again — so a continuation still suspended
   * on one of the awaits below wakes up inside a DIFFERENT play and happily
   * drives it (publishing `lifting`, blanking a source that is not its own).
   * The abort resolves the commit gate immediately, which is exactly why this
   * function routinely outlives the transaction that started it.
   *
   * `nonce` is bumped by every arm, so comparing it makes every await point
   * safe BY CONSTRUCTION rather than by remembering to add a check — which is
   * how the source-rect poll below came to be the one that was forgotten.
   */
  const episode = playedHeroState.nonce;
  const mine = () => playedHeroState.active && playedHeroState.nonce === episode;
  // THE SHIPMENT BEAT comes first — the price the play takes off the rail leaves into the card while it still
  // stands in the composer; only then does the card lift. Nothing of the scene below has started yet.
  await shipPrice(mine);
  if (!mine()) {
    return; // aborted during the shipment — the abort already cleaned up
  }
  playedHeroState.phase = 'preparing';
  // The table opens NOW (play-animation mode) so its +1 layout settles while
  // the card lifts; a manually-open table just gains the reserved slot. The
  // WORKSPACE host never opens the standalone overlay — its tableau is the
  // EMBEDDED stage the play composer reveals off this same phase, and the
  // landing target registers from there.
  if (playedHeroState.autoClose && playedHeroState.host === 'overlay') {
    playedHeroState.tableOpen = true;
  }
  const reduced = consoleReducedMotionActive();
  let sourceRect = captureSourceRect();
  // The source can be TRANSIENTLY unmeasurable: a fullscreen viewer's
  // close-flight still holds the slot empty (`con-zoom-hold`), a layout is a
  // frame from settling. A single-shot miss here used to degrade the whole
  // play to the no-flight fallback — the card TELEPORTED onto the tableau.
  // Poll briefly (≈430ms — covers the zoom return) before giving up; the
  // proxy then lifts from the settled slot, exactly where the card stands.
  if (sourceRect === undefined) {
    for (let i = 0; i < 26 && sourceRect === undefined && mine(); i++) {
      await frame();
      sourceRect = captureSourceRect();
    }
  }
  // ⚠️ THE POLL IS AN AWAIT POINT, so it needs the guard the scene's other await
  // points have (see the one before the flight below). An abort — an error path,
  // the 6 s arm safety, a play the server refused — can land INSIDE this loop, and
  // everything below then ran anyway: it published `phase = 'lifting'` ON TOP of
  // the abort's `failed`/`idle`, and the shell watches that phase to tear
  // `pendingPlayCard` down. So an aborted play went on driving the transaction it
  // had just cancelled.
  if (!mine()) {
    return; // aborted mid-scene — abort already cleaned up
  }

  if (sourceRect !== undefined) {
    playedHeroState.proxy = {card, isEvent: playedHeroState.isEvent, rect: sourceRect, face: {...sourceFace}};
    await nextTick();
  }
  const els = playedHeroState.proxy !== undefined ? stage?.els() : undefined;
  if (els !== undefined && playedHeroState.proxy !== undefined) {
    // Position the proxy pixel-perfect over the source, THEN blank the
    // source under it — same synchronous turn, no double vision, no flash.
    if (placeHeroProxy(els, playedHeroState.proxy.rect)) {
      holdSource();
    } else {
      playedHeroState.proxy = undefined;
    }
  } else {
    playedHeroState.proxy = undefined;
  }

  // The composer closes UNDER the (already independent) card; the shell
  // watcher on this phase tears pendingPlayCard down.
  playedHeroState.phase = 'lifting';

  // Lift and target preparation run in PARALLEL — the scene forms around
  // the moving card, never as sequential steps. The workspace hosts have
  // their aim ALREADY TAKEN (the arm measured the rest geometry during the
  // round trip), so the flight follows the lift with no hover; the standalone
  // overlay measures now, while the lift plays. Reduced motion skips the lift
  // beat (its hop below is the whole controlled transition). With no proxy
  // there is no flight — never stall waiting for a target it can't use.
  const hasProxy = playedHeroState.proxy !== undefined && els !== undefined;
  const prewarmed = prewarmedTarget;
  prewarmedTarget = undefined;
  const targetPromise = hasProxy ?
    (prewarmed !== undefined ? prewarmed.then((r) => r ?? awaitTargetRect()) : awaitTargetRect()) :
    Promise.resolve(undefined);
  if (hasProxy && els !== undefined && !reduced) {
    await playHeroLift(els, motionMs(HERO_LIFT_MS));
  }
  const target = await targetPromise;

  if (!mine()) {
    return; // aborted mid-scene — abort already cleaned up
  }
  if (playedHeroState.proxy === undefined || els === undefined) {
    // No-flight fallback (lost source element): the table is open, the
    // landing semantics stay — a short controlled beat, then commit.
    playedHeroState.phase = 'landing';
    await wait(reduced ? HERO_REDUCED_MS : 60);
    return;
  }
  if (target === undefined) {
    // Target never became measurable — dissolve the proxy in place and let
    // the reveal happen without a flight (never an approximate landing).
    playedHeroState.phase = 'landing';
    await disposeHeroProxy(els, motionMs(140));
    playedHeroState.proxy = undefined;
    return;
  }

  playedHeroState.phase = 'flying';
  const proxy = playedHeroState.proxy;
  const liveSource = currentProxyRect(els) ?? proxy.rect;
  const plan = planHeroPath({
    source: liveSource,
    // The scale ratio is measured against the box AT REST (the director's
    // base) — `liveSource` is the LIFTED proxy (×1.05), and planning the
    // scale against it landed every card 4.8 % short of its slot.
    sourceRest: proxy.rect,
    target,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    safeTop: 54 * conUiScale(),
  });
  // THE APEX SWAP: from the card's fastest frame on it wears the picture the
  // destination will paint, so the handoff compares two identical faces.
  const landing = landingFace();
  const onApex = () => {
    if (mine() && playedHeroState.proxy === proxy) {
      proxy.face = landing;
    }
  };
  if (reduced) {
    await playHeroReducedHop(els, target, HERO_REDUCED_MS, onApex);
  } else {
    await playHeroFlight(els, plan, {
      isEvent: playedHeroState.isEvent,
      durationMs: motionMs(HERO_FLIGHT_MS + HERO_LAND_MS),
      uiScale: conUiScale(),
      retarget: () => peekTargetRect(),
      onApex,
    });
  }
  playedHeroState.phase = 'landing';
}

/**
 * THE SHIPMENT BEAT (see `pendingSpends`): the price the play takes off the
 * rail flies into the standing card. Resolves when every token has been
 * absorbed (plus the absorb beat on the animation clock); a beat that cannot
 * be shown as promised resolves at once and names itself — the rows then tick
 * with the commit, honestly late. Never rejects.
 */
async function shipPrice(mine: () => boolean): Promise<void> {
  const price = pendingPrice;
  pendingPrice = undefined;
  const stock = shipStockSpends(mine);
  const cards = shipCardPrice(price, mine);
  const target = shipTargetSpends(mine);
  // THE ONE-PLAY CLASS (TR49): an armed effect this play spends is drawn into the card, and what the card arms
  // leaves its printed glyph for the dock — in the same beat, while the card stands in its composer.
  const armed = shipArmedEffects(standingSourceEl(), beforeView, landingView, mine);
  if (stock === undefined && cards === undefined && target === undefined && armed === undefined) {
    return;
  }
  playedHeroState.phase = 'shipping';
  await Promise.all([stock, cards, target, armed]);
  if (!mine()) {
    return;
  }
  // The absorb beat: the card takes the shipment in before it lifts — one beat of the animation clock (the runs
  // resolve at the TOUCHDOWN, so this beat is what keeps the card standing until the last token has been absorbed —
  // a shorter one lifted the card out from under a token still being absorbed: the TR52 transfer witness). An armed
  // spend alone resolves only once ABSORBED (its quick beat is its own) — no second beat (TR49, measured A/B).
  if (stock !== undefined || cards !== undefined || target !== undefined) {
    await new Promise<void>((resolve) => gsap.delayedCall(motionMs(TRANSFER_BEAT_MS) / 1000, resolve));
  }
  if (mine() && playedHeroState.shipment === 'flying') {
    playedHeroState.shipment = 'flown';
  }
  if (mine() && playedHeroState.price === 'flying') {
    playedHeroState.price = 'flown';
  }
  if (mine() && playedHeroState.targetSpend === 'flying') {
    playedHeroState.targetSpend = 'flown';
  }
}

/** A card's stored count in a view — on WHICHEVER seat's tableau holds it (an attack's target is a rival's). */
function cardCountIn(view: PlayerViewModel | undefined, card: string): number | undefined {
  for (const p of view?.players ?? []) {
    const model = p.tableau.find((c) => c.name === card);
    if (model !== undefined) {
      return model.resources ?? 0;
    }
  }
  return undefined;
}

/**
 * THE PRICE OFF A CARD THE COMPOSER CHOSE (PL-268, TR52 — «remove 2 data from ANY player's card»): one token per unit,
 * born on the answered target row's resource icon AS PAINTED (the row stands in the composer until the lift — the
 * visible double of a counter that lives on another seat's card), absorbed into the standing card's PRINTED icons of
 * that resource (the k-th token on the k-th icon — the action commit's icon grammar). Checked against the two views
 * first: the holder must have moved by exactly the promise (a card the same play also fed — TR05 answering this
 * card's own Science tag — moved otherwise, and flies nothing; `playedHeroState.targetSpend` names why). Undefined —
 * nothing to fly. Never rejects.
 */
function shipTargetSpends(mine: () => boolean): Promise<void> | undefined {
  const specs = pendingTargetSpends;
  pendingTargetSpends = [];
  const card = playedHeroState.card;
  if (specs.length === 0 || card === undefined || !mine()) {
    return undefined;
  }
  if (consoleReducedMotionActive()) {
    playedHeroState.targetSpend = 'reduced';
    return undefined;
  }
  const verified = specs.filter((spec) => {
    const a = cardCountIn(beforeView, spec.targetCard ?? '');
    const b = cardCountIn(landingView, spec.targetCard ?? '');
    const ok = a !== undefined && b !== undefined && a - b === spec.amount;
    if (!ok) {
      playedHeroState.targetSpend = `mismatch: ${spec.targetCard} ${a ?? '?'} → ${b ?? '?'} (promised −${spec.amount})`;
    }
    return ok;
  });
  if (verified.length === 0) {
    return undefined;
  }
  const el = standingSourceEl();
  if (el === undefined) {
    playedHeroState.targetSpend = 'no-source';
    return undefined;
  }
  // The birth: the card the units leave — the answered target row's MINIATURE of THAT card, as painted; the row's
  // resource icon when no miniature stands (a source-card target); a row not on screen flies nothing.
  const holder = String(verified[0].targetCard ?? '').replace(/["\\]/g, '');
  const icon = firstVisibleEnd(`.con-composer--play .con-composer__target [data-composer-card="${holder}"]`) ??
    firstVisibleEnd('.con-composer--play .con-composer__target .con-ptsel__imp-icon');
  if (icon === undefined) {
    playedHeroState.targetSpend = 'no-row';
    return undefined;
  }
  const r = icon.getBoundingClientRect();
  const anchors = resolveActionCommitAnchors(el, undefined);
  const origins = resolveSpendIconOrigins(anchors, verified);
  const body = anchors.cardEl.getBoundingClientRect();
  playedHeroState.targetSpend = 'flying';
  return runResourceTransfers({
    specs: verified,
    // A LOSS walks the geometry backwards: born at `destination` (the target row), absorbed at the printed icon.
    source: {point: {x: body.left + body.width / 2, y: body.top + body.height / 2}},
    origins,
    destination: {x: r.left + r.width / 2, y: r.top + r.height / 2},
    arrival: 'auto',
    // Drawn INTO the printed icons of the card they pay for: no settle, the short absorb (PL-140's spend grammar).
    absorb: 'quick',
    onDegrade: (spec, why) => {
      playedHeroState.targetSpend = `degraded: ${why} (${spec.resource})`;
    },
  });
}

/**
 * The CARD-RESOURCE price (PL-163): one token per paid unit, born on the composer's pay row of that unit (its icon —
 * the satellite's visible double), absorbed into the standing card's printed cost badge. Undefined — nothing to fly.
 */
function shipCardPrice(price: PlayCardPrice | undefined, mine: () => boolean): Promise<void> | undefined {
  const card = playedHeroState.card;
  if (price === undefined || card === undefined || !mine()) {
    return undefined;
  }
  if (consoleReducedMotionActive()) {
    playedHeroState.price = 'reduced';
    return undefined;
  }
  const verdict = verifyRailReward(price.reward, beforeView, landingView);
  if (verdict.cause.length === 0) {
    playedHeroState.price = `mismatch: ${verdict.mismatches.join('; ')}`;
    return undefined;
  }
  const el = standingSourceEl();
  if (el === undefined) {
    playedHeroState.price = 'no-source';
    return undefined;
  }
  // The absorb point: the printed COST badge of the standing card (its body when the face prints none).
  const badge = el.querySelector<HTMLElement>('.pcard__cost-badge') ?? el.querySelector<HTMLElement>('.pcard__cost') ?? el;
  const b = badge.getBoundingClientRect();
  const absorb: TransferPoint = {x: b.left + b.width / 2, y: b.top + b.height / 2};
  const flights: Array<Promise<void>> = [];
  for (const spec of verdict.cause) {
    const unit = price.units[price.reward.cause.indexOf(spec)];
    // The birth: the pay row's icon AS PAINTED (the law of visible ends) — a row not on screen flies nothing.
    const icon = unit === undefined ? undefined :
      firstVisibleEnd(`.con-composer--play .con-payrow[data-pay-unit="${unit}"] .con-payrow__icon`);
    if (icon === undefined) {
      playedHeroState.price = `no-row: ${unit ?? spec.resource}`;
      continue;
    }
    const r = icon.getBoundingClientRect();
    playedHeroState.price = 'flying';
    flights.push(runResourceTransfers({
      specs: [spec],
      // A LOSS walks the geometry backwards: born at `destination` (the pay row), absorbed at the source point.
      source: {point: absorb},
      destination: {x: r.left + r.width / 2, y: r.top + r.height / 2},
      arrival: 'auto',
      onDegrade: (_spec, why) => {
        playedHeroState.price = `degraded: ${why} (${spec.resource})`;
      },
    }));
  }
  return flights.length === 0 ? undefined : Promise.all(flights).then(() => undefined);
}

/** The STOCK spends of the play's effect (PL-107 — X87's plants and steel off the rail). Undefined — nothing to fly. */
function shipStockSpends(mine: () => boolean): Promise<void> | undefined {
  const reward = pendingSpends;
  pendingSpends = undefined;
  const card = playedHeroState.card;
  if (reward === undefined || card === undefined || !mine()) {
    return undefined;
  }
  if (consoleReducedMotionActive()) {
    playedHeroState.shipment = 'reduced';
    return undefined;
  }
  // The promise against the answer: every row the shipment names must have moved by exactly the shipment plus
  // the response's other known moves (the price). A row that disagrees is not flown — it ticks with the commit.
  const verdict = verifyRailReward(reward, beforeView, landingView);
  if (verdict.cause.length === 0) {
    playedHeroState.shipment = `mismatch: ${verdict.mismatches.join('; ')}`;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[played-hero] ${card}: the shipment was not shown as promised — ${verdict.mismatches.join('; ')}`);
    }
    return undefined;
  }
  // The standing card — the first MEASURABLE match of the source selector (a parked layer may hold the same
  // card identity with a zero rect). Its printed icons are where the tokens are absorbed: the k-th token of a
  // resource on the k-th icon that prints it (the action commit's own icon grammar), the card's body when the
  // face prints none.
  const el = standingSourceEl();
  if (el === undefined) {
    playedHeroState.shipment = 'no-source';
    return undefined;
  }
  const anchors = resolveActionCommitAnchors(el, undefined);
  const specs = verdict.cause;
  const origins = resolveSpendIconOrigins(anchors, specs);
  const body = anchors.cardEl.getBoundingClientRect();
  playedHeroState.shipment = 'flying';
  return runResourceTransfers({
    specs,
    source: {point: {x: body.left + body.width / 2, y: body.top + body.height / 2}},
    origins,
    arrival: 'auto',
    // A LOSS releases at its LAUNCH (the transfer language's own law): the row ticks the moment the token leaves
    // it — the departure hold is seeded right there, against the not-yet-applied view.
    onArrive: (spec) => {
      if (mine()) {
        seedDeparture(spec);
      }
    },
    onDegrade: (spec, why) => {
      playedHeroState.shipment = `degraded: ${why} (${spec.resource})`;
    },
  });
}

/** Seed ONE departure hold: from here the row reads `committed − amount` — the pre-commit value minus what just left. */
function seedDeparture(spec: ResourceTransferSpec): void {
  const hold: ResourceTransferSpec = {channel: 'stock', resource: spec.resource, amount: spec.amount};
  departureHolds.push(hold);
  beginPanelRewardHold([hold]);
}

/** The card standing in the composer (the lift's source) — the first measurable match, never just the first. */
function standingSourceEl(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const el of document.querySelectorAll<HTMLElement>(sourceSelector)) {
    const r = el.getBoundingClientRect();
    if (r.width >= 10 && r.height >= 10) {
      return el;
    }
  }
  return undefined;
}

/** The LANDING picture, resolved from the answer (see `HeroLandingFaceSpec`). */
function landingFace(): HeroFace {
  const spec = landingFaceSpec;
  const card = playedHeroState.card;
  const model = spec.model === 'tableau' && card !== undefined ?
    landingView?.thisPlayer?.tableau?.find((c) => c.name === card) : undefined;
  // THE CAPSULE THE STAGE WILL SHOW (PL-191): the committed count MINUS what is still to fly onto it — the receiving
  // stage's own reading (`capsuleModelFor`: committed − in flight). The committed model alone put the RESULT on the
  // landing proxy («14» on TR45's capsule while «+14» had not left yet), the real card under it then read «0», and the
  // capsule ticked to 14 again on the touchdown: a result before its cause, and a 14 → 0 → 14 flicker.
  const owed = card === undefined ? 0 : Math.max(0, (playedHeroCardGainTotals()[card] ?? 0) - cardResourceLanded(card));
  const face = model !== undefined && owed > 0 ? {...model, resources: Math.max(0, (model.resources ?? 0) - owed)} : model;
  return {lightweight: spec.lightweight, card: face};
}

/**
 * The POST-COMMIT half (called on nextTick after updatePlayerView): the
 * reserved slot turns real under the proxy (identical pixels), the proxy
 * dissolves, the result beat plays (delta-chips are already ticking on the
 * committed panel), then the system-opened table closes itself.
 */
export async function endPlayedHero(): Promise<void> {
  if (!playedHeroState.active) {
    return;
  }
  const episode = playedHeroState.nonce;
  const mine = () => playedHeroState.active && playedHeroState.nonce === episode;
  playedHeroState.phase = 'committing';
  const els = stage?.els();
  if (els !== undefined && playedHeroState.proxy !== undefined) {
    // THE CONTROL MEASURE — BEFORE the reveal, never after it. The in-flight
    // retarget lands the card on the slot's rest geometry by construction;
    // what this covers is a slot that moved AFTER the touchdown (a re-fit
    // between the landing and the commit — the embed seat's zoom re-solving
    // when a reveal mounts in the same zone was measured at 3–5 px). Any
    // remainder is TRAVELLED while the proxy is still the only card on
    // screen; a correction over an already painted card is a double image.
    // The read must happen here also because a landing place may stop being
    // addressable once it holds its card (the start dock's `[data-start-front]`
    // is the ARMED slot only).
    if (!consoleReducedMotionActive()) {
      const rest = peekTargetRect() ?? await awaitTargetRect(120);
      const cur = currentProxyRect(els);
      if (!mine()) {
        return;
      }
      if (rest !== undefined && cur !== undefined &&
          (Math.abs(rest.x - cur.x) > 1 || Math.abs(rest.y - cur.y) > 1 || Math.abs(rest.w - cur.w) > 1)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[played-hero] the landing slot moved after the touchdown — travelling the remainder before the reveal',
            {dx: Math.round(rest.x - cur.x), dy: Math.round(rest.y - cur.y), dw: Math.round(rest.w - cur.w)});
        }
        await glideHeroOnto(els, rest, motionMs(120));
        if (!mine()) {
          return;
        }
      }
    }
    // THE FRAME-EXACT HANDOFF: the real card paints UNDER the proxy with the
    // same geometry and the same face, and the proxy is removed on the NEXT
    // painted frame — two identical frames, never a crossfade (a crossfade is
    // exactly the window in which every difference between the two copies
    // becomes visible).
    playedHeroState.revealed = true;
    await nextTick();
    if (!mine()) {
      return;
    }
    await hideHeroProxyNextFrame(els);
  } else {
    playedHeroState.revealed = true;
    await nextTick();
  }
  if (!mine()) {
    return;
  }
  playedHeroState.proxy = undefined;
  playedHeroState.phase = 'showing-result';
  const railKey = heldRailKey !== undefined && railRewardPending(heldRailKey) ? heldRailKey : undefined;
  // THE CARD'S PRINTED POINTS (TR55): a card whose play changes nothing but the score (Reds News Outlet, a «2 VP»
  // card with no gain) still owes the beat — its token is the whole story of the landing's result.
  const vpOwed = holdsVpShares(PLAYED_HERO_VP_OWNER);
  if ((pendingRewards.length > 0 || heldReactions.length > 0 || railKey !== undefined || vpOwed) && !consoleReducedMotionActive()) {
    // THE REWARD BEAT — the final chord of the play: the landed card is read
    // for a quiet moment, then its immediate gains emerge from it as
    // physical resource chips and land where they belong. Each touchdown
    // releases its metric from the panel reward hold, firing that delta chip
    // at the contact — the card is the visible source of the reward until
    // the last transfer completes.
    const rewards = pendingRewards;
    pendingRewards = [];
    await wait(motionMs(TRANSFER_READ_MS));
    if (!playedHeroState.active) {
      return;
    }
    const source = {selectors: heroRewardSourceSelectors(playedHeroState.card ?? '')};
    // A card the play FEEDS or WAKES scores on the touchdown of its own last token (TR27's law, TR55's ledger).
    const releaseFedVp = vpReleaseOnTouchdown(playedHeroState.card ?? '', [...rewards, ...heldReactions.map((r) => r.spec)]);
    const release = (spec: ResourceTransferSpec) => {
      releaseHeroReward(spec);
      releaseFedVp(spec);
    };
    const hooks = effectHooks;
    if (playedHeroState.host === 'workspace' && hooks !== undefined) {
      // THE EFFECT RESOLUTION SEQUENCE (the receiving stage): card targets
      // first — each target physically EMERGES from its strip / its compact
      // mini family, the chips fly between the two card anchors, the target
      // SETTLES back with its gain; the rail wave then closes the beat. The
      // newly played card needs no emergence — it IS the front.
      const {railSpecs, cardSpecs} = splitPlayRewards(rewards);
      for (const group of cardTargetGroups(cardSpecs, playedHeroState.card as CardName)) {
        if (!playedHeroState.active) {
          return;
        }
        // The play's «+N» is born on the PRINTED icon of that resource in its on-play row — the icon the player read the
        // rule on: the card's OWN «+14 microbes» (TR45, PL-190) and a payload put on ANOTHER card alike (TR56 «КУДА
        // ЛЯЖЕТ», П6: «3 [мех] ИЛИ 3 [истребитель] ИЛИ 6 [аэростат]» — the chosen branch's own icon, never the row's
        // first); a card that prints none keeps the shared spawn point.
        const printedOrigins = group.specs.map((spec) => heroGainOrigin(playedHeroState.card ?? '', spec));
        const origins = printedOrigins.some((o) => o !== undefined) ? printedOrigins : undefined;
        await receiveOnStage(group, hooks, () =>
          runResourceTransfers({specs: group.specs, source, ...(origins !== undefined ? {origins} : {}), arrival: 'auto', onArrive: release}));
        if (!playedHeroState.active) {
          return;
        }
      }
      if (playedHeroState.active) {
        await railWaveWithPrintedVp(railSpecs, source, release);
      }
    } else {
      await railWaveWithPrintedVp(rewards, source, release);
    }
    if (!playedHeroState.active) {
      return;
    }
    // THE TABLE'S ANSWER ON THE CARDS (К-S1): the holders the play woke, each its own group after the card's own
    // gains — before the TR, which stays last.
    await flyHeroReactions(source, release, hooks);
    // THE TABLE'S ANSWER ON THE RAIL with no rating to ride (PL-035): one beat after the wave's last touchdown.
    answerHeroAfterWave();
    // Belt-and-braces: any hold of OURS a degraded transfer left behind snaps to
    // the committed truth now (its chip fires marginally late, never lost).
    releaseHeroRewards();
    // …and a fed card's points whose token never reached it tick now, NAMED beside the score cell (TR55).
    releaseVpShares(PLAYED_HERO_VP_OWNER, {why: 'a fed card was not reached by its token'});
    if (!playedHeroState.active) {
      return;
    }
    if (railKey !== undefined) {
      // THE TR, LAST: after the card's own gains, the token is born on the
      // printed TR of the card that just landed (the face-down pile for an
      // event — where that card now lies), the rating and its VP cell tick on
      // the touchdown, and the table's answer (the ruling Greens' M€) one beat
      // after — `flyRailReward` resolves once all of it has ticked.
      await flyRailReward(railKey, () => heroRailOrigin(playedHeroState.card ?? ''));
      heldRailKey = undefined;
      if (!playedHeroState.active) {
        return;
      }
    }
    await skippablePause(motionMs(TRANSFER_RESIDUAL_PAUSE_MS));
  } else {
    // The RESOLVED-TABLEAU beat: the workspace stage reads shorter than the
    // standalone overlay's result pause — the player is already inside the
    // scene, the state is on screen, a long hold would be a stall.
    const idlePause = playedHeroState.host === 'workspace' ? HERO_RESOLVED_BEAT_MS : HERO_RESULT_PAUSE_MS;
    const pauseMs = consoleReducedMotionActive() ? HERO_REDUCED_PAUSE_MS :
      (followUpPending ? HERO_RESULT_PAUSE_FOLLOWUP_MS : idlePause);
    await skippablePause(motionMs(pauseMs));
  }
  if (!playedHeroState.active) {
    return;
  }
  if (hasPendingPlayedReturns()) {
    // THE RETURN BEAT — the play's closing movement (Astra Mechanica): the
    // cards it sent back to hand rise out of the pile they were lying in,
    // turn face to the camera, and the standard intake carries them into the
    // dock. It runs INSIDE the still-open table (one continuous scene) and
    // the transaction finishes only after they have landed.
    playedHeroState.phase = 'returning';
    await runPlayedCardReturns();
    if (!playedHeroState.active) {
      return;
    }
  }
  playedHeroState.phase = 'closing';
  if (playedHeroState.autoClose && playedHeroState.tableOpen) {
    playedHeroState.tableOpen = false;
    await wait(motionMs(HERO_CLOSE_MS));
  } else if (playedHeroState.host === 'workspace') {
    // The WORKSPACE folds on this phase (the shell watcher tears the whole
    // hand workspace down to the board) — hold the transaction through its
    // dissolve so follow-up surfaces arrive onto a settled board, mirroring
    // the overlay's own close beat.
    await wait(motionMs(HERO_CLOSE_MS));
  }
  finish();
}

/** A / B during the result beat: accelerate the close — never a cancel. */
export function skipPlayedHeroResult(): void {
  pauseResolve?.();
}

// ── STAGED PLAY (docs/TILE_PLAY_STAGED_COMMIT.md §8-bis) ────────────────────
//
// The tabletop ritual is «карта ложится на стол → тайл на поле», so a STAGED
// play keeps the landing ceremony — the card physically lifts off the composer
// and lands on its family stack — BEFORE anything is submitted. The ceremony
// is the PRE-COMMIT half of this very transaction, run without a server
// response: no detect (there is nothing to verify — nothing happened), no
// reveal (the reserved slot never turns real: the proxy IS the landed card),
// no reward beat (the gains fly from the PLACED TILE after the real commit),
// and no counter ticks (the server was not touched). Reversibility rules:
// B later restores the composer whole; a mid-ceremony failure aborts through
// the ordinary abort (source restored, 'failed' re-arms the CTA).

/**
 * Run the staged landing: lift → arc → touchdown on the family stack.
 * Resolves TRUE when the ceremony completed (the proxy rests on the stack),
 * FALSE when it aborted mid-flight (the abort already cleaned up and the
 * composer is intact). Arm with `armPlayedHero` first (no rewards).
 */
export async function runStagedPlayedLanding(): Promise<boolean> {
  if (!playedHeroState.active || playedHeroState.card === undefined) {
    return false;
  }
  // No response will ever detect this transaction — consume the arm ourselves
  // and drop the arm safety (the scene safety below is the ceremony's bound).
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const episode = playedHeroState.nonce;
  sceneSafety = window.setTimeout(() => {
    // A stalled ceremony must not wedge the play — degrade to the abort,
    // which restores the composer for an honest retry.
    abortPlayedHero();
  }, motionMs(HERO_LIFT_MS + HERO_FLIGHT_MS + HERO_LAND_MS) + 3000);
  await executeFlight();
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
  return playedHeroState.active && playedHeroState.nonce === episode;
}

/**
 * End the staged landing at the HANDOFF to the board: the proxy — the one
 * visible body of the landed card — fades out while the workspace it lies in
 * plays its own leave, so the card dissolves WITH its context (never a lone
 * card floating over the board, never an emptied slot under a still-standing
 * stage). The transaction then finishes with zero reveal ever having
 * happened; the card's REAL tableau entry arrives with the commit, later,
 * on a screen where the tableau is not visible.
 */
export async function finishStagedPlayedLanding(): Promise<void> {
  if (!playedHeroState.active) {
    return;
  }
  const els = stage?.els();
  if (els !== undefined && playedHeroState.proxy !== undefined) {
    await disposeHeroProxy(els, motionMs(200));
  }
  playedHeroState.proxy = undefined;
  finish();
}

/**
 * Abort — server error, network failure, safety timer, unmount. Restores
 * the blanked composer card, drops the proxy, frees the commit gate, and
 * flags `failed` for one flush (the shell re-arms the composer CTA on it).
 */
export function abortPlayedHero(): void {
  if (!playedHeroState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killHeroTweens(els);
  }
  restoreSource();
  // The reward beat unwinds with the scene: mid-flight chips unmount with
  // zero trace and the panel snaps to the committed truth (any released
  // hold fires its chips in one honest transition — never a stale hold).
  abortResourceTransfers();
  // The return beat unwinds with the scene too — and its dock withhold is
  // released, so cards the server DID move into the hand can never be lost
  // behind a failed animation.
  abortPlayedCardReturns();
  releaseHeroRewards();
  releaseHeroRail('aborted');
  // The score cell's shares this scene held tick now, named (a play that landed and was not shown still scored).
  releaseVpShares(PLAYED_HERO_VP_OWNER, {why: 'the scene aborted'});
  dropVpClaim(PLAYED_HERO_VP_OWNER);
  releaseArmedEffectHolds();
  // An aborted ritual puts the card back in its composer — what it was drawing out of the dock is armed again.
  releaseStagedArmedSpends();
  pendingReactions = [];
  heldReactions = [];
  // A failed play ships nothing: the rows the shipment left return to the truth (one honest transition).
  releaseDepartures();
  pendingSpends = undefined;
  pendingPrice = undefined;
  beforeView = undefined;
  pendingRewards = [];
  rewardHoldSeeded = false;
  targetSelectorOverride = undefined;
  prewarmedTarget = undefined;
  landingView = undefined;
  playedHeroState.proxy = undefined;
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.active = false;
  playedHeroState.phase = 'failed';
  pauseResolve?.();
  freeRunGate();
  // One flush later the transaction is fully idle (watchers saw 'failed').
  void nextTick(() => {
    if (playedHeroState.phase === 'failed') {
      playedHeroState.phase = 'idle';
      playedHeroState.card = undefined;
      playedHeroState.host = 'overlay';
    }
  });
}

function finish(): void {
  clearTimers();
  restoreSource();
  // Safety — a beat that never ran (a path that skipped the return) must not
  // leave its dock withhold behind; a completed one already cleared itself.
  abortPlayedCardReturns();
  releaseHeroRewards(); // safety — the reward beat leaves it empty
  pendingReactions = [];
  heldReactions = [];
  releaseHeroRail('finished'); // safety — the reward beat flies it; an ending that skipped the beat lets go
  // …and the score cell's shares (TR55): the beat flies / releases them; an ending that skipped it names them.
  releaseVpShares(PLAYED_HERO_VP_OWNER, {why: 'the scene ended before its beat'});
  dropVpClaim(PLAYED_HERO_VP_OWNER);
  releaseDepartures(); // safety — the commit's block released them; an ending that skipped the commit lets go
  settleArmedEffectHolds(); // safety — the commit settled them; an ending that skipped the commit lets go (TR49 class)
  pendingSpends = undefined;
  pendingPrice = undefined;
  beforeView = undefined;
  pendingRewards = [];
  rewardHoldSeeded = false;
  targetSelectorOverride = undefined;
  prewarmedTarget = undefined;
  landingView = undefined;
  playedHeroState.active = false;
  playedHeroState.phase = 'idle';
  playedHeroState.card = undefined;
  playedHeroState.isEvent = false;
  playedHeroState.host = 'overlay';
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.proxy = undefined;
}

// ── internals ───────────────────────────────────────────────────────────────

const COMPOSER_SOURCE_SELECTOR = '.con-composer--play [data-zoom-handoff="play-card"] :is(.card-container, .pcard)';
/** WHERE the current transaction's card lifts from (set at arm). */
let sourceSelector: string = COMPOSER_SOURCE_SELECTOR;
/** An arm-scoped LANDING override (undefined → the registered tableau
 *  anchor). The start scene points a draw-effect play at its source column. */
let targetSelectorOverride: string | undefined;
/** The faces of the current transaction (set at arm — see `HeroFace`). */
let sourceFace: HeroFace = {lightweight: false};
let landingFaceSpec: HeroLandingFaceSpec = {lightweight: true, model: 'tableau'};
/** The authoritative answer the landing face is drawn from (set at run). */
let landingView: PlayerViewModel | undefined;
/** The aim taken during the round trip (workspace hosts — see the arm). */
let prewarmedTarget: Promise<HeroRect | undefined> | undefined;
/** The shared "slot is empty" cascade rule (cardExitDirector.HOLD_CLASS). */
const HOLD_CLASS = 'con-deal-hold';

function captureSourceRect(): HeroRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  // The first MEASURABLE match wins — never just the first match: a parked
  // (display:none) layer can legitimately hold the same card identity (the
  // Game Start Workspace parks its summary under the deployment), and its
  // zero-rect element shadowing the live slot silently degraded the whole
  // play to the no-flight fallback — the card TELEPORTED onto the tableau.
  const els = document.querySelectorAll<HTMLElement>(sourceSelector);
  for (const el of els) {
    // RAW on purpose: a SOURCE is measured at its current visual position —
    // the proxy must be born over the pixels the player sees. Only the
    // LANDING (awaitTargetRect) uses `restingRectOf`.
    const r = el.getBoundingClientRect();
    if (r.width >= 10 && r.height >= 10) {
      heldSourceEl = el;
      return {x: r.left, y: r.top, w: r.width, h: r.height};
    }
  }
  return undefined;
}

function holdSource(): void {
  heldSourceEl?.classList.add(HOLD_CLASS);
}

function restoreSource(): void {
  heldSourceEl?.classList.remove(HOLD_CLASS);
  heldSourceEl = undefined;
}

function currentProxyRect(els: HeroStageEls): HeroRect | undefined {
  const r = els.proxy.getBoundingClientRect();
  return r.width > 2 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

/** WHERE a play's reward chips are born, in resolution order: the receiving
 *  stage's front card / events pile (the workspace scene), else the landed
 *  card on the «Разыграно» table (the overlay scene). */
function heroRewardSourceSelectors(card: string): Array<string> {
  const esc = escapeName(card);
  return [
    // The start scene's EFFECT-SOURCE column — a draw-effect play lands (and
    // resolves its rewards) THERE, while its tableau face is still away.
    '[data-embed-source-slot]',
    // The receiving stage (the hand workspace's landing).
    '.con-recv [data-recv-front] .con-recv__face',
    '.con-recv [data-recv-front]',
    '.con-recv .con-recv__backpile',
    // The GAME START workspace's bottom «Разыграно» zone — a start play
    // docks directly into its family pile there.
    `.con-start__played [data-played-key="${esc}"] .con-played__face`,
    `.con-start__played [data-played-key="${esc}"]`,
    `.con-played [data-played-key="${esc}"] .con-played__face`,
    `.con-played [data-played-key="${esc}"]`,
    // An EVENT lands face-down on the events backstack — its rewards
    // emerge from the pile (the card's honest on-table location).
    '.con-played .con-played__family--event .con-played__backstack',
  ];
}

/**
 * WHERE THE PLAY'S TR TOKEN IS BORN — measured at fly time on the card that
 * has just landed: the first measurable place of the reward ladder
 * (`heroRewardSourceSelectors`), and inside it the PRINTED TR icon. A place
 * that prints none is the card's honest location with its face hidden — an
 * EVENT lies face-down on its pile — and the token is born on that place.
 * Undefined only when nothing is measurable: the rail reward names it.
 */
/** Every card-resource spec the beat will carry — the card's own gains and the promised holders' (К-S1). */
function pendingWaveSpecs(): ReadonlyArray<ResourceTransferSpec> {
  return [...pendingRewards, ...pendingReactions.map((r) => r.spec)];
}

/**
 * The play's OWN moves on the holders' counters (its own card-resource gains
 * to the same card), by the verifier's row key — what a reaction's check must
 * allow for beside the reaction itself.
 */
function knownCardRows(): Record<string, number> {
  const known: Record<string, number> = {};
  for (const spec of pendingRewards) {
    if (spec.channel === 'card-resource' && spec.targetCard !== undefined) {
      const row = `${railRowKey(spec)}@${spec.targetCard}`;
      known[row] = (known[row] ?? 0) + (spec.direction === 'loss' ? -spec.amount : spec.amount);
    }
  }
  return known;
}

/**
 * SEED the table's answer on the cards (К-S1): each promised holder checked ON
 * ITS OWN against the two views — a counter that moved by exactly the promise
 * (plus the play's own gain on it) is held for the beat; one that did not is
 * not flown, ticks with the commit, is tallied as landed (the stage's capsule
 * reads the committed count at once) and names itself.
 */
function seedReactions(before?: PlayerViewModel, after?: PlayerViewModel): void {
  const reactions = pendingReactions;
  pendingReactions = [];
  if (reactions.length === 0) {
    return;
  }
  const known = knownCardRows();
  const verified: Array<PlayReaction> = [];
  const mismatches: Array<string> = [];
  for (const reaction of reactions) {
    const verdict = verifyRailReward({cause: [reaction.spec], reactions: [], known}, before, after);
    if (verdict.cause.length > 0) {
      verified.push(reaction);
    } else {
      mismatches.push(...verdict.mismatches);
      noteCardResourceLanding(reaction.spec);
    }
  }
  if (mismatches.length > 0) {
    playedHeroState.reactions = `mismatch: ${mismatches.join('; ')}`;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[played-hero] ${playedHeroState.card}: the table's answer was not shown as promised — ${mismatches.join('; ')}`);
    }
  } else {
    playedHeroState.reactions = verified.length > 0 ? 'held' : '';
  }
  heldReactions = verified;
  if (verified.length > 0) {
    const specs = verified.map((r) => r.spec);
    heldRewards.push(...specs);
    beginPanelRewardHold(specs);
  }
}

/**
 * FLY the table's answer on the cards (К-S1): one EFFECT RESOLUTION group per
 * holder — the holder emerges from its strip (the receiving stage's hooks),
 * every chip of the group is born on the landed card's PRINTED TAG that woke
 * the holder (the card itself when the hook names no tag or the tag is not
 * on screen), lands on the holder's capsule, the holder settles back. The
 * overlay host (no hooks) flies the same chips as one wave.
 */
/**
 * ONE CARD-TARGET GROUP of the receiving stage, in the ONE grammar of «a
 * resource lands on a card» (`cardReceive/cardReceiveDirector.ts` — TR53
 * iteration): PRESENT = the target EMERGES out of its strip (the played card
 * itself needs none — it IS the front), PAY = the chips land on its capsule,
 * READ = the settle's confirmation press, RETURN = the settle back into its
 * band. The stage's own moves, unchanged — the director owns the order.
 */
async function receiveOnStage(
  group: {target: CardName, self: boolean},
  hooks: ReceivingEffectHooks,
  pay: () => Promise<void>,
): Promise<void> {
  await runCardReceive({
    host: 'played',
    card: group.target,
    alive: () => playedHeroState.active,
    present: async () => {
      if (!group.self) {
        await hooks.emergeTarget(group.target);
      }
      return true;
    },
    pay: async () => {
      await pay();
      return true;
    },
    ret: async () => {
      if (!group.self) {
        await hooks.settleTarget(group.target);
      }
    },
  });
}

async function flyHeroReactions(
  source: {selectors: Array<string>},
  release: (spec: ResourceTransferSpec) => void,
  hooks: ReceivingEffectHooks | undefined,
): Promise<void> {
  const reactions = heldReactions;
  heldReactions = [];
  if (reactions.length === 0 || !playedHeroState.active) {
    return;
  }
  const card = playedHeroState.card ?? '';
  const tagOf = (spec: ResourceTransferSpec): Tag | undefined => reactions.find((r) => r.spec === spec)?.tag;
  const originsOf = (specs: ReadonlyArray<ResourceTransferSpec>) => specs.map((spec) => {
    const tag = tagOf(spec);
    return tag === undefined ? undefined : heroTagOrigin(card, tag);
  });
  const specs = reactions.map((r) => r.spec);
  if (playedHeroState.host === 'workspace' && hooks !== undefined) {
    for (const group of cardTargetGroups(specs, playedHeroState.card as CardName)) {
      if (!playedHeroState.active) {
        return;
      }
      await receiveOnStage(group, hooks, () =>
        runResourceTransfers({specs: group.specs, source, origins: originsOf(group.specs), arrival: 'auto', onArrive: release}));
      if (!playedHeroState.active) {
        return;
      }
    }
    playedHeroState.reactions = 'flown';
    return;
  }
  await runResourceTransfers({specs, source, origins: originsOf(specs), arrival: 'auto', onArrive: release});
  playedHeroState.reactions = 'flown';
}

/**
 * WHERE a reaction's chip is born: the centre of the landed card's printed
 * tag medallion of `tag` — on the front card of the receiving stage, else on
 * the landed card of the «Разыграно» table (the overlay) — undefined when no
 * measurable face prints it (the transfer falls back to the card itself).
 */
function heroTagOrigin(card: string, tag: Tag): TransferPoint | undefined {
  if (typeof document === 'undefined' || card === '') {
    return undefined;
  }
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) {
        continue;
      }
      const medallion = el.querySelector<HTMLElement>(`.pcard-tag[data-tag="${tag}"]`);
      const mr = medallion?.getBoundingClientRect();
      if (mr !== undefined && mr.width > 4) {
        return {x: mr.left + mr.width / 2, y: mr.top + mr.height / 2};
      }
      return undefined;
    }
  }
  return undefined;
}

/**
 * WHERE THE PLAY'S CARD-RESOURCE GAIN IS BORN (PL-190 — the play's twin of PL-063; TR56 — a payload put on ANOTHER
 * card): on the landed card, the PRINTED icon of that resource in its ON-PLAY row — never one inside an action or
 * effect frame (TR45 prints two microbes in its action, «spend 2 microbes»; the play's «+14» is the third,
 * «[microbe] / [tile on Mars]»). A row of alternatives prints each branch's own resource («3 [мех]* OR 3 [истребитель]*
 * OR 6 [аэростат]*»), so the icon of the token's resource IS the chosen branch's. The first such icon of the first
 * measurable place of the reward ladder; undefined when the face prints none outside a frame (the shared spawn point
 * stands) or for any other channel.
 */
function heroGainOrigin(card: string, spec: ResourceTransferSpec): TransferPoint | undefined {
  if (typeof document === 'undefined' || card === '' || spec.channel !== 'card-resource') {
    return undefined;
  }
  const needles = iconNeedlesFor(spec.resource) ?? [];
  if (needles.length === 0) {
    return undefined;
  }
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) {
        continue;
      }
      const printed = Array.from(el.querySelectorAll<HTMLElement>('.pcard-ic'))
        .find((icon) => icon.closest('.pcard-effect') === null && needles.some((needle) => (icon.style.backgroundImage ?? '').includes(needle)));
      const ir = printed?.getBoundingClientRect();
      return ir !== undefined && ir.width > 4 ? {x: ir.left + ir.width / 2, y: ir.top + ir.height / 2} : undefined;
    }
  }
  return undefined;
}

/**
 * WHERE A STANDARD RESOURCE CHOSEN FROM THE FACE'S «?» IS BORN (TR54 — «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»): on the landed
 * card, its bare printed «?» outside every action / effect frame (never the «?» inside a production frame — that one
 * is the production it reads). The first measurable place of the reward ladder; undefined when that place prints no
 * bare «?» (the shared spawn point stands — the card).
 */
function heroWildOrigin(card: string): TransferPoint | undefined {
  if (typeof document === 'undefined' || card === '') {
    return undefined;
  }
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) {
        continue;
      }
      const printed = bareWildIcons(el).find((icon) => icon.closest('.pcard-effect') === null);
      const ir = printed?.getBoundingClientRect();
      return ir !== undefined && ir.width > 4 ? {x: ir.left + ir.width / 2, y: ir.top + ir.height / 2} : undefined;
    }
  }
  return undefined;
}

/**
 * A card the play FEEDS (a resource onto another card of the tableau) or WAKES (a reaction) scores its points on
 * the touchdown of ITS LAST token — the counter and the score are one event (TR27's law; TR55 — the ledger holds the
 * share, this releases it). The played card itself is not here: its share flies from its own printed badge.
 */
function vpReleaseOnTouchdown(played: string, specs: ReadonlyArray<ResourceTransferSpec>): (spec: ResourceTransferSpec) => void {
  const left = new Map<string, number>();
  for (const spec of specs) {
    if (spec.channel === 'card-resource' && spec.targetCard !== undefined && spec.targetCard !== played) {
      left.set(spec.targetCard, (left.get(spec.targetCard) ?? 0) + 1);
    }
  }
  return (spec) => {
    const card = spec.targetCard;
    if (spec.channel !== 'card-resource' || card === undefined || card === played || !left.has(card)) {
      return;
    }
    const n = (left.get(card) ?? 0) - 1;
    left.set(card, n);
    if (n <= 0) {
      releaseVpShares(PLAYED_HERO_VP_OWNER, {filter: cardShareOf(new Set([card])), named: false});
    }
  };
}

/**
 * THE CARD'S RAIL WAVE AND ITS PRINTED POINTS (TR55, the owner's decision 4): what the card IS follows what it GAVE —
 * as the NEXT TOKEN OF THE SAME WAVE, one stagger after the gains (`transferWaveDelayMs`), never as a beat of its own:
 * a whole second flight after the wave would lengthen every play by a flight. The token is born on the landed card's
 * printed VP badge (the face-down pile for an event), the badge answers with a short press, and the score cell ticks
 * on the touchdown; before the table's answer, before the TR. Resolves once both have touched down.
 */
async function railWaveWithPrintedVp(
  specs: ReadonlyArray<ResourceTransferSpec>,
  source: {selectors: Array<string>},
  release: (spec: ResourceTransferSpec) => void,
): Promise<void> {
  const card = playedHeroState.card ?? '';
  // A standard resource CHOSEN from the face's printed «?» (TR54) is born on that «?», never out of the plate.
  const wildAt = specs.some(wildChosen) ? heroWildOrigin(card) : undefined;
  const origins = wildAt !== undefined ? specs.map((spec) => (wildChosen(spec) ? wildAt : undefined)) : undefined;
  const wave = specs.length === 0 ? Promise.resolve() :
    runResourceTransfers({specs, source, ...(origins !== undefined ? {origins} : {}), arrival: 'auto', onArrive: release});
  const vp = (specs.length === 0 ? Promise.resolve() : wait(motionMs(transferWaveDelayMs(1, 2))))
    .then(() => (playedHeroState.active ? flyHeroCardVp(card) : undefined));
  await Promise.all([wave, vp]);
}

/** The landed card's own share — one token from its printed VP badge (TR55). Resolves at the touchdown. */
async function flyHeroCardVp(card: string): Promise<void> {
  const own = cardShareOf(new Set([card]));
  if (card === '' || !holdsVpShares(PLAYED_HERO_VP_OWNER, own)) {
    return;
  }
  const badge = heroVpBadgeEl(card);
  if (badge !== undefined) {
    // The badge ANSWERS the birth — one short press (an attribute: the badge's own `:class` never wipes it).
    badge.setAttribute('data-vp-emit', '');
    gsap.delayedCall(motionMs(VP_EMIT_PRESS_MS) / 1000, () => badge.removeAttribute('data-vp-emit'));
  }
  await flyVpShares(PLAYED_HERO_VP_OWNER, () => heroVpOrigin(card), {filter: own});
}

/** The press the printed badge plays as its token is born (ms @ motion scale 1). */
const VP_EMIT_PRESS_MS = 260;

/** The landed card's printed VP badge on the first measurable place of the reward ladder, if its face is up. */
function heroVpBadgeEl(card: string): HTMLElement | undefined {
  if (typeof document === 'undefined' || card === '') {
    return undefined;
  }
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) {
        continue;
      }
      const badge = el.querySelector<HTMLElement>('.pcard__vp');
      const br = badge?.getBoundingClientRect();
      return badge !== null && badge !== undefined && br !== undefined && br.width > 4 ? badge : undefined;
    }
  }
  return undefined;
}

/**
 * WHERE THE CARD'S POINTS ARE BORN (TR55): the centre of the landed card's printed VP badge — and, when the place
 * prints no face (an EVENT lies face-down on its pile), the centre of that place: the card's honest location.
 */
function heroVpOrigin(card: string): TransferPoint | undefined {
  const badge = heroVpBadgeEl(card);
  if (badge !== undefined) {
    const r = badge.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  }
  if (typeof document === 'undefined' || card === '') {
    return undefined;
  }
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      }
    }
  }
  return undefined;
}

function heroRailOrigin(card: string): TransferPoint | undefined {
  if (typeof document === 'undefined' || card === '') {
    return undefined;
  }
  const needles = iconNeedlesFor('tr') ?? [];
  const centre = (r: DOMRect): TransferPoint => ({x: r.left + r.width / 2, y: r.top + r.height / 2});
  for (const selector of heroRewardSourceSelectors(card)) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) {
        continue;
      }
      const printed = Array.from(el.querySelectorAll<HTMLElement>('.pcard-ic'))
        .find((icon) => needles.some((needle) => (icon.style.backgroundImage ?? '').includes(needle)));
      const ir = printed?.getBoundingClientRect();
      return ir !== undefined && ir.width > 4 ? centre(ir) : centre(r);
    }
  }
  return undefined;
}

/**
 * ONE synchronous look at the landing place's REST rect — the final-approach
 * retarget and the pre-reveal control measure. The arm-scoped override
 * (the effect-source seat) reads its first measurable match at rest; the
 * registered landing place answers through its own `peek`. `undefined` =
 * not readable right now (the caller keeps its plan / falls back to the
 * looped measurer).
 */
function peekTargetRect(): HeroRect | undefined {
  if (typeof document === 'undefined' || !playedHeroState.active) {
    return undefined;
  }
  const override = targetSelectorOverride;
  if (override !== undefined) {
    for (const el of document.querySelectorAll<HTMLElement>(override)) {
      const r = restingRectOf(el);
      if (r.width >= 10 && r.height >= 10) {
        return {x: r.left, y: r.top, w: r.width, h: r.height};
      }
    }
    return undefined;
  }
  try {
    return targetPeek?.();
  } catch {
    return undefined;
  }
}

async function awaitTargetRect(budgetMs = TARGET_WAIT_BUDGET_MS): Promise<HeroRect | undefined> {
  const deadline = Date.now() + budgetMs;
  // An ARM-SCOPED target override (the start scene's effect-source column):
  // this transaction's card deliberately lands at an INTERMEDIATE position —
  // the source seat of the effect it is about to run — instead of the
  // registered tableau anchor. Poll until it is measurable (it mounts in the
  // same press that armed us), first measurable match wins.
  const override = targetSelectorOverride;
  if (override !== undefined) {
    while (playedHeroState.active && Date.now() < deadline) {
      for (const el of document.querySelectorAll<HTMLElement>(override)) {
        // RESTING: the effect-source seat mounts inside a zone that is still
        // running `con-start-embed-in` (translate+scale) at this very frame —
        // a raw first-measurable rect made the hero land where the seat was
        // PASSING, then the card snapped the remaining entry travel.
        const r = restingRectOf(el);
        if (r.width >= 10 && r.height >= 10) {
          return {x: r.left, y: r.top, w: r.width, h: r.height};
        }
      }
      await frame();
    }
    return undefined;
  }
  while (playedHeroState.active && targetMeasure === undefined && Date.now() < deadline) {
    await frame();
  }
  const measure = targetMeasure;
  if (!playedHeroState.active || measure === undefined) {
    return undefined;
  }
  try {
    return await measure();
  } catch {
    return undefined;
  }
}

function frame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function skippablePause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      if (pauseResolve === done) {
        pauseResolve = undefined;
      }
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    pauseResolve = done;
  });
}

function clearTimers(): void {
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
}
