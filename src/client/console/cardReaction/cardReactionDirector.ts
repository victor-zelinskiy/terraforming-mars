/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CARD-REACTION DIRECTOR — «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» (Turmoil
 * Redux TR80 Hartlan Heating, 2026-10-26; iteration 3 «МЕСТО · ТЕМП ·
 * НЕПРЕРЫВНОСТЬ», the owner's field report of 2026-10-27; contract
 * `docs/claude/console/card-reaction.md`). The server's record
 * (`GameModel.cardReactions`) says WHICH card's printed effect fired and WHAT
 * it paid; this module turns the fresh records of a response into ONE scene,
 * in two shapes:
 *
 *  ATTACHED  — a host already HOLDS the reaction's rows on the rail (the play
 *              scene's rail half, the action commit's — their «table's
 *              answer», promised by the forecast and verified against the two
 *              views): the host asks for an ANSWER FLIGHT and gets one whose
 *              tokens are born on the REACTOR — risen at `prepare`, IN ITS
 *              PLACE when its face stands on screen, else at THE STAGE —
 *              instead of on the cause (the played card's tag, the composer's
 *              chip — those are MARKED, the owner's decision 2). The rail
 *              module keeps its holds, its order and its release; this module
 *              keeps the faces.
 *  STANDALONE — nobody holds the rows (a standard project's city waking
 *              Tharsis, a reaction with no host scene): the seeder holds the
 *              viewer's own rows in the apply block and plays the chain itself
 *              after the board's own story — rise → read → birth on the effect
 *              row → fly → tick on touchdown → settle → recede, group after
 *              group, each step started by the PREVIOUS step's event (its last
 *              birth, its slot's recede) under the wall-clock ceiling
 *              (`planReactionChain`).
 *
 * The laws of iteration 3:
 *  - ONE PLACE. A reactor whose face is on screen (`reactorPlaces`) lifts
 *    THAT face — never a second instance; every other reactor rises at the
 *    centre of the central opening (`reactionStageSlots`), in a workspace's
 *    band too, a rival's at the same stage with its seat's caption.
 *  - TWO TEMPI. One or two reactors play CALM (≈ 2.2 s a card: the lift, a
 *    READ beat with the effect row lit, the births, the touchdowns, a settle,
 *    the recede); from three the chain is QUICK and overlaps.
 *  - A HURRY IS A PACE, NEVER A CUT. A press or a navigation while the chain
 *    plays makes what is left play at `REACTION_HURRY_PACE` — every face
 *    still rises, every token still flies; a SECOND hurry completes at once.
 *  - A RISE STARTS ON A PAINTED FACE. The faces are WARMED at the seed and
 *    the tweens begin on a painted frame; the chain is sequenced by EVENTS,
 *    never by absolute times — a slow device stretches it, it never swallows
 *    a rise.
 *
 * Honesties: the amounts are the SERVER's (never a counter's delta read
 * back); an impact the scene cannot fly is named `elsewhere` and ticks; a
 * face that cannot be painted degrades THAT group by name; every hold is
 * bounded (the registry's ceiling) and NOTIFICATION-ONLY — a reaction never
 * holds a question; reduced motion holds nothing and flies nothing.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {activeAnimationHoldLabels, blockingAnimationHoldCount, registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {cssLengthPx} from '@/client/console/cssUnits';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {markReactionTold, registerReactionScenePlays} from '@/client/console/cardReaction/reactionToldOnStage';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {acceptSeatIntake, foldSeatIntake, openSeatIntake, seatIntakeEnd} from '@/client/console/statusIntake';
import {CardResource} from '@/common/CardResource';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, TRANSFER_ARC_MS, TRANSFER_POP_MS, TransferEndLike, cardResourceKey, railRowKey,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  beginPanelRewardHold, heldCardResource, heldProduction, heldStock, noteTransferTrail, registerRewardHoldKeeper, releasePanelRewardHold, runResourceTransfers,
  takeDeclaredAnswers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RailAnswerFlight} from '@/client/console/resourceTransfer/railReward';
import {waitRewardPayoutQuiet} from '@/client/console/rewardPayoutQuiet';
import {scaleStepRatingBusy} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {hydroCeremonyOwed, hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroTraversalPending, isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {RectLike} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {
  CardReactionGroup, REACTION_HURRY_PACE, REACTION_RIVAL_SCALE, ReactionTempo, freshCardReactions, groupCardReactions, planReactionChain,
  reactionImpactSpec, reactionStageSlots, reactionTempo, reactionTokensOf, reducedReactionTempo,
} from '@/client/console/cardReaction/cardReactionModel';
import {
  ReactorCaption, ReactorFace, cardReactionStageMounted, cardReactionStageRect, cardReactionState, dropWarmReactors, killReactorTweens, markReactionRow,
  nextPaintedFrame, paceReactorTweens, reactorEl, recedeReactor, riseReactor, seatReactor, unseatAllReactors, unseatReactor, warmReactorFaces,
} from '@/client/console/cardReaction/cardReactionStage';
import {ReactorEmergence, describeReactorPlaces, findReactorPlace, reactorPlaceArriving} from '@/client/console/cardReaction/reactorPlaces';
import {resolveEffectIconEnds} from '@/client/console/cardReaction/effectIconEnds';
import {buildCardReactionSummaryNotification} from '@/client/console/cardReaction/cardReactionSummary';
import {pushTransient} from '@/client/components/notifications/notificationState';

export type {ReactorEmergence} from '@/client/console/cardReaction/reactorPlaces';

/** The rail rows the seeder measures: the six resources' stock and production, and the rating. */
const RAIL_RESOURCES = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/**
 * THE ROWS HELD RIGHT NOW, by `railRowKey` (a card resource by its kind — the satellite's cell) — the transport
 * snapshots it before the hosts seed, so the seeder can tell a row a host holds from a row nobody does.
 */
export function snapshotRailHolds(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const resource of RAIL_RESOURCES) {
    out[railRowKey({channel: 'stock', resource})] = heldStock(resource);
    out[railRowKey({channel: 'production', resource})] = heldProduction(resource);
  }
  out[railRowKey({channel: 'stock', resource: RATING_RAIL_KEY})] = heldStock(RATING_RAIL_KEY);
  for (const kind of Object.values(CardResource)) {
    const resource = cardResourceKey(kind);
    out[railRowKey({channel: 'card-resource', resource})] = heldCardResource(resource);
  }
  return out;
}

type Attached = {
  group: CardReactionGroup;
  /** The rows of the group a host holds (its answer) — the join key for the host's flight. */
  rows: Set<string>;
  claimed: boolean;
  /**
   * RESERVED for ONE host (TR78 — «ОТВЕТ СТОЛА»): a group the answer stage will play itself, or one the player's own
   * scene has already told. An unfiltered claim (the play scene's — «every attached group») skips it; only a flight
   * asking with the same reservation takes it. Set at the seed from `reserveCardReaction`.
   */
  reserved?: string;
};

/** The reservations the hosts stated BEFORE the seed, by the record's `seq` (bounded like the claimed set). */
const reservations = new Map<number, string>();

/**
 * A host that will play a record's reaction ITSELF — or whose scene has already told it — reserves the record by `seq`
 * before the seeder runs (its own seed is earlier in the apply block): the attached group is then skipped by every
 * unfiltered claim and taken only by a flight asking with the same `reserved` name.
 */
export function reserveCardReaction(seq: number, host: string): void {
  reservations.set(seq, host);
  if (reservations.size > 64) {
    const keep = [...reservations.entries()].slice(-32);
    reservations.clear();
    keep.forEach(([k, v]) => reservations.set(k, v));
  }
}

type Standalone = {
  group: CardReactionGroup;
  /** The group's rail specs nobody else held — held here, released on the touchdowns. */
  held: Array<ResourceTransferSpec>;
};

/** A reactor on stage: how it came forward and the face its tokens are born on. */
type Risen = {
  group: CardReactionGroup;
  key: string;
  face: HTMLElement | undefined;
  via: 'place' | 'seat' | 'none';
  seat?: RectLike;
  emergence?: ReactorEmergence;
};

const claimedSeqs = new Set<number>();
let attached: Array<Attached> = [];
const standaloneQueue: Array<Standalone> = [];
/** The batch the chain is playing right now — its `held` rows are exactly what has not touched down yet. */
let running: Array<Standalone> = [];

/**
 * A RIVAL's reactor (the record's owner is another seat — PL-1057): nothing of the viewer's is held; after the viewer's
 * own chain it rises at the same stage, a step smaller, under a caption naming its seat (the owner, 2026-10-27 — one
 * place for everyone), and its tokens are born on its effect row and land on the chip's INTAKE plaque (the owner's M1
 * — `statusIntake`), each ticking the plaque's number.
 */
type Rival = {group: CardReactionGroup; owner: Color; specs: Array<ResourceTransferSpec>};
const rivalQueue: Array<Rival> = [];
/** The last applied view — a rival's face is read off ITS seat's tableau, its caption off its seat's name. */
let lastView: PlayerViewModel | undefined;
/** The standalone chain plays after every BLOCKING scene (a sitting's beats, a landing) — bounded; then it plays anyway. */
const BLOCKING_QUIET_MAX_MS = 12000;
/** The sitting's beats are each bounded by their own ceiling — a longer wait on them than the generic one is safe. */
const SITTING_QUIET_MAX_MS = 40000;
/** …and after a DECISION standing at the centre (a drawn card to take, a deck pick) — a reactor never covers a card the player is choosing; bounded. */
const DECISION_WAIT_MAX_MS = 6000;
/** How long a reactor waits for its own face being dealt in before it rises at the stage instead (PL-1098). */
const PLACE_ARRIVAL_WAIT_MS = 2400;
const DECISION_SURFACES = '.con-reveal, .con-deckpick';
/** A handheld's opening holds two slots; every other profile up to the model's cap. */
const HANDHELD_MAX_SLOTS = 2;
let epoch = 0;
let standaloneRunning = false;
let faceSeq = 0;
/** THE HURRY: a press / a navigation while the chain plays. Reset when the chain goes idle. */
let hurried = false;
let hurriedEpoch = -1;
let hurriedAt = 0;
/** One gesture, one hurry: a press that opens a sheet is a press AND a navigation — within this window the second call is the same gesture. */
const HURRY_REPEAT_WINDOW_MS = 700;

export function cardReactionPending(): boolean {
  return cardReactionState.phase !== 'idle' || standaloneQueue.length > 0 || rivalQueue.length > 0;
}

/** A rival's record is pending (its rise at the stage is owed). */
export function rivalReactionPending(): boolean {
  return rivalQueue.length > 0;
}

/** The chain plays hurried right now (a probe's read). */
export function cardReactionHurried(): boolean {
  return hurried;
}

/** The gains a RIVAL's reactor paid that seat — the impacts addressed to the record's owner, as transfer specs. */
export function rivalSpecsOf(group: CardReactionGroup): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const impact of group.elsewhere) {
    if (impact.to !== group.record.owner || (impact.kind !== 'stock' && impact.kind !== 'production' && impact.kind !== 'tr')) {
      continue;
    }
    const spec = reactionImpactSpec(impact);
    if (spec !== undefined && spec.direction !== 'loss') {
      out.push(spec);
    }
  }
  return out;
}

registerAnimationHoldSupplier('card-reaction', () => cardReactionState.phase !== 'idle', {
  scope: 'notification-only',
  diagnose: () => ({phase: cardReactionState.phase, chain: cardReactionState.chain, hurried, faces: cardReactionState.faces.map((f) => f.name)}),
  expire: () => abortCardReactions(),
});

// The chain's rows survive a foreign scene's belt-and-braces clear (a tile scene's «safety» at its end — the first
// field run ticked Tharsis Republic's 3 M€ a beat before its tokens were born): released only by their touchdowns,
// a second hurry, or the registry's ceiling above.
registerRewardHoldKeeper(() => [...running, ...standaloneQueue].flatMap((entry) => entry.held));

// The feed's order-independent half (PL-1090): the server's ring tells a reaction only while THIS client can play it.
registerReactionScenePlays(() => cardReactionStageMounted() && !consoleReducedMotionActive());

/** The viewer's own LIVE model of a card (the capsule's count) — the pristine print when the tableau does not hold it. */
function liveModelOf(view: PlayerViewModel | undefined, card: CardName): CardModel | undefined {
  return view?.thisPlayer?.tableau.find((c) => c.name === card);
}

// ── SEED (the apply block) ─────────────────────────────────────────────────

/**
 * Called from the transport's apply block AFTER every host seeded its own rewards: the fresh records are claimed once
 * (by `seq`); a group whose rows a host holds is ATTACHED (the host's flight will ask for it); a group with rows nobody
 * holds is held here and queued for the STANDALONE chain. The faces are WARMED here (the layer mounts them hidden at
 * the stage's size, the art decoded) so a rise starts on a laid-out face. Reduced motion claims the records and holds
 * nothing.
 */
export function seedCardReactionHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined, heldBefore: Record<string, number>): void {
  // The answers the hosts PROMISED in this block — taken every block, so a declaration never outlives its response.
  const declared = takeDeclaredAnswers();
  if (after === undefined) {
    return;
  }
  const viewer = after.thisPlayer?.color;
  const sameSeat = before !== undefined && before.thisPlayer?.color === viewer;
  const fresh = freshCardReactions(before?.game?.cardReactions, after.game?.cardReactions, sameSeat).filter((r) => !claimedSeqs.has(r.seq));
  if (fresh.length === 0) {
    return;
  }
  fresh.forEach((r) => claimedSeqs.add(r.seq));
  if (claimedSeqs.size > 128) {
    const keep = [...claimedSeqs].slice(-64);
    claimedSeqs.clear();
    keep.forEach((s) => claimedSeqs.add(s));
  }
  lastView = after;
  const all = groupCardReactions(fresh, viewer);
  const groups = all.filter((g) => g.own && (g.rail.length > 0 || g.cards.length > 0));
  const rivals: Array<Rival> = all.filter((g) => !g.own && g.record.owner !== viewer)
    .map((g) => ({group: g, owner: g.record.owner, specs: rivalSpecsOf(g)}))
    .filter((r) => r.specs.length > 0);
  if ((groups.length === 0 && rivals.length === 0) || consoleReducedMotionActive() || typeof document === 'undefined') {
    return;
  }
  // TOLD BY THE SCENE (iteration 4): every OWN reaction this block admits is marked for the feed NOW — a standalone
  // group plays through the chain, an attached one through the host that DECLARED its rows (a declaration is the
  // host's word that it presents that payout itself); the feed, which ingests this response after the apply block
  // (and holds a chain the applied view still lists as open — PL-1090), builds no «Сработал эффект» card for it. A
  // rival's reaction keeps its card: that card is about the rival's move, not the reactor. No layer, no face: not told.
  if (cardReactionStageMounted()) {
    groups.forEach((g) => markReactionTold(g.record));
  }
  const heldNow = snapshotRailHolds();
  // What a host holds OF THE REACTIONS in this block, per row. A rail row counts only what a host DECLARED as a
  // promised answer (`declareHeldAnswers` — the rail module's verified reactions, the hero's PL-035 answers): a host's
  // OWN promise on the same row (a standard project's production step beside Tharsis Republic's, the first field
  // run) is never the reaction's share — attributed to it, the share ticked unseen under the host's release. A
  // holder's cell keeps the raw-hold attribution: the hero's card half and the board's cell scene hold AND fly those
  // themselves (the cell scene from the CELL — named in the contract as not migrated).
  const hostHeld: Record<string, number> = {};
  for (const spec of declared) {
    const row = railRowKey(spec);
    hostHeld[row] = Math.max(0, (hostHeld[row] ?? 0) + (spec.direction === 'loss' ? -spec.amount : spec.amount));
  }
  for (const row of Object.keys(heldNow)) {
    if (row.startsWith('card-resource:')) {
      // …never LESS than a host's declaration on the same row: a scene that told the answer with the commit held (the
      // live pick's receive — TR78) declares the row and holds nothing, and used to be zeroed here into a second chain.
      hostHeld[row] = Math.max(hostHeld[row] ?? 0, heldNow[row] - (heldBefore[row] ?? 0));
    }
  }
  let queued = false;
  for (const group of groups) {
    const rows = new Set<string>();
    const own: Array<ResourceTransferSpec> = [];
    // The rail rows AND the holders' cells (a card resource the reactor pays onto a card — its satellite cell / capsule).
    for (const spec of [...group.rail, ...group.cards]) {
      const row = railRowKey(spec);
      const signed = spec.direction === 'loss' ? -spec.amount : spec.amount;
      if (signed > 0 && (hostHeld[row] ?? 0) >= signed) {
        hostHeld[row] -= signed;
        rows.add(row);
      } else if (signed > 0) {
        own.push(spec);
      }
      // A LOSS a reaction took is the counter's own departure — not flown from here (it ticked with the commit).
    }
    if (rows.size > 0) {
      const reserved = reservations.get(group.record.seq);
      attached.push({group, rows, claimed: false, ...(reserved === undefined ? {} : {reserved})});
    }
    if (own.length > 0) {
      beginPanelRewardHold(own);
      standaloneQueue.push({group, held: own});
      queued = true;
    }
  }
  // The trail names a standalone row some host ALSO holds undeclared — a second flight in the making (the audit of
  // 2026-10-26 found four such hosts; a new one shows up here first).
  const overRaw = standaloneQueue.flatMap((s) => s.held.map((spec) => railRowKey(spec)))
    .filter((row) => !row.startsWith('card-resource:') && (heldNow[row] ?? 0) - (heldBefore[row] ?? 0) > 0);
  noteTransferTrail('reaction:seed', {
    attached: attached.filter((a) => !a.claimed).map((a) => a.group.card), standalone: standaloneQueue.map((s) => s.group.card),
    ...(overRaw.length > 0 ? {standaloneOverRawHold: [...new Set(overRaw)]} : {}),
  });
  // A resolution's / a party's face is built from the parliament manifest (`resolutionPremiumVm` / `partyPremiumVm`),
  // not the card art index.
  preloadPremiumCardArt([...groups, ...rivals.map((r) => r.group)].filter((g) => g.record.kind === 'card' || g.record.kind === 'corporation').map((g) => g.card));
  // THE FACES ARE WARMED NOW (iteration 3): mounted hidden in the layer at the stage's size — the layout and the
  // decode happen under the cause's own scene, never in the rise's first frame. A card that will rise in its place
  // never needs the warm face; it is dropped unused when the chain ends.
  warmFaces([
    ...groups.map((g) => ({name: g.card, kind: g.record.kind, card: liveModelOf(after, g.card)})),
    ...rivals.map((r) => ({name: r.group.card, kind: r.group.record.kind, card: seatModelOf(after, r.owner, r.group.card)})),
  ]);
  // Attached groups nobody claims within the response's own scene are let go (no hold of ours stands behind them).
  if (attached.length > 24) {
    attached = attached.slice(-12);
  }
  if (rivals.length > 0) {
    rivalQueue.push(...rivals);
    noteTransferTrail('reaction:rivals', {cards: rivals.map((r) => `${r.owner}:${r.group.card}`)});
    queued = true;
  }
  if (queued) {
    void runStandalone();
  }
}

function warmFaces(faces: Array<Pick<ReactorFace, 'name' | 'card' | 'kind'>>): void {
  if (!cardReactionStageMounted()) {
    return;
  }
  const [slot] = stageSlotsFor(1);
  if (slot !== undefined) {
    warmReactorFaces(faces, slot);
  }
}

// ── THE STAGE AND THE TEMPO ────────────────────────────────────────────────

/** The current tempo: reduced → the crossfade; hurried → the quick numbers; else by the chain's size. */
function tempoFor(groups: number): ReactionTempo {
  if (consoleReducedMotionActive()) {
    return reducedReactionTempo();
  }
  return hurried ? reactionTempo(Number.MAX_SAFE_INTEGER) : reactionTempo(groups);
}

/** The pace multiplier of every wait and tween right now (1 = as planned; the hurry divides). */
function paceNow(planPace = 1): number {
  return planPace * (hurried ? REACTION_HURRY_PACE : 1);
}

/** A wait that follows the pace LIVE: a hurry arriving mid-wait shortens what is left. Never bare rAF. */
async function pacedWait(baseMs: number, planPace = 1): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  for (;;) {
    const need = motionMs(baseMs) / paceNow(planPace);
    const elapsed = typeof performance === 'undefined' ? need : performance.now() - started;
    if (elapsed >= need) {
      return;
    }
    await nextPaintedFrame();
  }
}

/**
 * THE CENTRAL OPENING — the box the four hull members enclose, as the band geometry mirror publishes it
 * (`--con-stage-t/-b/-l/-r` on `<html>`; a workspace's band stands in the same box, so the stage is the same place
 * in every state). The layer's own rect (the viewport) is the pre-mount fallback.
 */
function openingRect(): RectLike {
  const stage = cardReactionStageRect();
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return stage;
  }
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string): number => cssLengthPx(cs.getPropertyValue(name).trim(), NaN);
  const t = read('--con-stage-t');
  const b = read('--con-stage-b');
  const l = read('--con-stage-l');
  const r = read('--con-stage-r');
  if ([t, b, l, r].some((v) => !Number.isFinite(v))) {
    return stage;
  }
  const width = stage.width - l - r;
  const height = stage.height - t - b;
  return width > 40 && height > 40 ? {left: stage.left + l, top: stage.top + t, width, height} : stage;
}

/**
 * THE HERO COLUMNS a workspace stands at the band's left edge — the stage starts PAST them (the owner, 2026-10-27:
 * «сдвиг за героя» — one place by meaning: the free canvas's edge). Judged by the one visibility verdict: a hero
 * parked under a hosted step (faded) does not move the edge.
 */
const STAGE_EDGE_OCCUPANTS = ['.con-composer__actcardwrap', '.con-composer__actlaw', '.con-composer__actparty', '.con-composer__playcard', '.con-hydro__ctx'];

/**
 * THE RAIL'S EDGE AND LINE (iteration 5): the row starts at the opening's left edge past any hero column standing
 * there, and stands on the rail's resource block (the M€ … heat rows' span) — the line every token lands on.
 */
function stageAnchor(opening: RectLike): {left: number, centreY?: number} {
  const pad = Math.max(8, opening.width * 0.012);
  let left = opening.left + pad;
  if (typeof document === 'undefined') {
    return {left};
  }
  for (const selector of STAGE_EDGE_OCCUPANTS) {
    const r = firstVisibleEnd(selector)?.getBoundingClientRect();
    if (r !== undefined && r.width > 4 && r.left < opening.left + opening.width * 0.45 && r.right + pad > left) {
      left = r.right + pad;
    }
  }
  const first = document.querySelector('.con-res__row--megacredits')?.getBoundingClientRect();
  const last = document.querySelector('.con-res__row--heat')?.getBoundingClientRect();
  if (first !== undefined && last !== undefined && first.height > 0 && last.height > 0) {
    return {left, centreY: (Math.min(first.top, last.top) + Math.max(first.bottom, last.bottom)) / 2};
  }
  return {left};
}

/** The slots of the stage for `n` reactors (a rival's at its own scale) — at the rail's edge, on its line. */
function stageSlotsFor(n: number, scale = 1): Array<RectLike> {
  const opening = openingRect();
  return reactionStageSlots(opening, n, {
    uiScale: conUiScale(), scale, maxSlots: consoleLayoutState.profile === 'handheld' ? HANDHELD_MAX_SLOTS : undefined,
    anchor: stageAnchor(opening),
  });
}

/** The chip's dot as a flight end — a rival's token lands on it when no intake plaque is painted. */
function seatChipFallbackEnd(color: Color): TransferEndLike | undefined {
  const dot = document.querySelector<HTMLElement>(`.con-status__player .player_bg_color_${color}`);
  const r = dot?.getBoundingClientRect();
  return dot === null || dot === undefined || r === undefined || r.width < 2 ? undefined : {el: dot, fx: 0.5, fy: 0.5};
}

/** A seat's LIVE model of a card (a rival's reactor is read off that seat's tableau). */
function seatModelOf(view: PlayerViewModel | undefined, owner: Color, card: CardName): CardModel | undefined {
  return view?.players?.find((p) => p.color === owner)?.tableau.find((c) => c.name === card);
}

/** A rival's caption: its seat's colour and name. */
function seatCaptionOf(view: PlayerViewModel | undefined, owner: Color): ReactorCaption {
  return {color: owner, name: view?.players?.find((p) => p.color === owner)?.name ?? owner};
}

// ── THE RISE (shared by both shapes) ───────────────────────────────────────

type RiseOpts = {
  /** The stage's slots for this chain (`stageSlotsFor`) — the group takes `slot % slots.length`. */
  slots: ReadonlyArray<RectLike>;
  model?: CardModel;
  caption?: ReactorCaption;
  /** The read beat the effect row is lit for. */
  readMs: number;
};

/**
 * Bring ONE reactor forward: IN ITS PLACE when a host's stage or a painted face holds it (the host's own emergence
 * first — the receiving stage, the start seat — then the DOM's: the composer's hero, a target miniature, the played
 * table), else at the stage. The effect row that fired is lit for the read beat either way.
 */
async function rise(group: CardReactionGroup, slot: number, view: PlayerViewModel | undefined, emergence: ReactorEmergence | undefined, opts: RiseOpts): Promise<Risen> {
  const key = `${group.record.seq}:${++faceSeq}`;
  const specs = [...group.rail, ...group.cards];
  const place = emergence !== undefined && emergence.standsIn(group.card) ? emergence : findReactorPlace(group.card);
  if (place !== undefined) {
    await place.emergeTarget(group.card);
    const face = place.emergedFaceEl(group.card);
    markReactionRow(face, group.record.printedEffect, specs, opts.readMs);
    noteTransferTrail('reaction:rise', {card: group.card, via: 'place'});
    return {group, key, face, via: 'place', emergence: place};
  }
  if (!cardReactionStageMounted() || opts.slots.length === 0) {
    return {group, key, face: undefined, via: 'none'};
  }
  const seat = opts.slots[slot % opts.slots.length];
  const face: ReactorFace = {key, name: group.card, kind: group.record.kind, card: opts.model ?? liveModelOf(view, group.card), seat, caption: opts.caption};
  const seated = await seatReactor(face);
  if (seated === undefined) {
    return {group, key, face: undefined, via: 'none'};
  }
  await riseReactor(seated.el, seat, tempoFor(cardReactionState.chain?.cards.length ?? 1), consoleReducedMotionActive());
  markReactionRow(seated.el, group.record.printedEffect, specs, opts.readMs);
  noteTransferTrail('reaction:rise', {card: group.card, via: 'stage', places: describeReactorPlaces(group.card)});
  return {group, key: seated.key, face: seated.el, via: 'seat', seat};
}

async function recede(risen: Risen): Promise<void> {
  if (risen.via === 'place' && risen.emergence !== undefined) {
    await risen.emergence.settleTarget(risen.group.card);
    return;
  }
  const el = reactorEl(risen.key);
  if (el !== undefined) {
    await recedeReactor(el, risen.seat, tempoFor(cardReactionState.chain?.cards.length ?? 1), consoleReducedMotionActive());
  }
  unseatReactor(risen.key);
}

function birthEnds(risen: Risen, specs: ReadonlyArray<ResourceTransferSpec>): Array<TransferEndLike | undefined> {
  if (risen.face === undefined) {
    return specs.map(() => undefined);
  }
  return resolveEffectIconEnds(risen.face, risen.group.record.printedEffect, specs);
}

// ── ATTACHED: the host's answer flight ─────────────────────────────────────

export type ReactionAnswerOptions = {
  /** The rail rows the host holds as its answer — the attached groups on these rows are this flight's; omitted: every attached group. */
  rows?: ReadonlyArray<string>;
  /** The host's RESERVATION (`reserveCardReaction`): a reserved group is this flight's only under the same name. */
  reserved?: string;
  /** The host's stage, when it can bring a reactor forward out of its own place (the play scene's receiving stage). */
  emergence?: ReactorEmergence;
  /** The viewer's view at the flight (the faces' live models). */
  view?: PlayerViewModel;
};

/**
 * THE ANSWER FLIGHT for a host that holds the reaction's rows (`railReward.answerRailReward`'s `RailAnswerFlight`):
 * `prepare` rises every claimed reactor (in its place or at the stage), `tokensOf` splits a held answer into the
 * groups' own tokens (a wave of heat — one per unit), `originOf` births each on its group's effect row, `onDone`
 * settles and recedes the faces. `undefined` when no fresh record is attached to the host's rows — the host keeps its
 * old flight.
 */
export function cardReactionAnswerFlight(opts: ReactionAnswerOptions = {}): RailAnswerFlight | undefined {
  const rows = opts.rows === undefined ? undefined : new Set(opts.rows);
  const mine = attached.filter((a) => !a.claimed && a.reserved === opts.reserved && (rows === undefined || [...a.rows].some((r) => rows.has(r))));
  if (mine.length === 0) {
    return undefined;
  }
  mine.forEach((a) => {
    a.claimed = true;
  });
  attached = attached.filter((a) => !a.claimed);
  // Claimed = played: the host brings the reactor forward and births on it — the feed's card about the same chain is
  // not built (iteration 4). Not under reduced motion (nothing rises), not without the layer (nothing can).
  if (cardReactionStageMounted() && !consoleReducedMotionActive()) {
    mine.forEach((a) => markReactionTold(a.group.record));
  }
  const groups = mine.map((a) => a.group);
  const risen: Array<Risen> = [];
  const tokenGroup = new WeakMap<ResourceTransferSpec, CardReactionGroup>();
  const myEpoch = epoch;
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  let done = false;
  let prepared = false;
  const finish = (): void => {
    if (done) {
      return;
    }
    done = true;
    if (!prepared) {
      // CLAIMED AND FINISHED without a rise (the enactment tail's `rulingChangeDraw`, the reward wave's plaque — the
      // host tells the answer its own way): the record is told, the phase was never touched — nothing to settle, nothing
      // to recede. The settle's own wait used to flip the phase 'receding' → 'idle' a beat later: a `card-reaction` hold
      // rising out of nothing after the host had moved on (and after a spec had ended).
      return;
    }
    const faces = [...risen];
    risen.length = 0;
    void (async () => {
      // The settle: the counters' deltas land under the eye before the faces let go. Every write past an await is
      // guarded by the epoch — a cut in the settle (a reset, a second press) owns the phase from then on; a stale
      // continuation that wrote `receding` after it left the `card-reaction` hold standing for good.
      await pacedWait(tempoFor(groups.length).settleMs);
      if (epoch !== myEpoch) {
        return;
      }
      cardReactionState.phase = 'receding';
      await Promise.all(faces.map((r, i) => new Promise<void>((resolve) => {
        gsap.delayedCall(motionMs(60 * i) / paceNow() / 1000, () => {
          void recede(r).then(resolve);
        });
      })));
      if (epoch === myEpoch && cardReactionState.phase === 'receding' && !standaloneRunning) {
        cardReactionState.phase = 'idle';
        hurried = false;
        cardReactionState.hurried = false;
        dropWarmReactors();
      }
      cardReactionState.lastWallMs = typeof performance === 'undefined' ? undefined : Math.round(performance.now() - started);
      cardReactionState.runs++;
    })();
  };
  return {
    prepare: async () => {
      if (epoch !== myEpoch || consoleReducedMotionActive()) {
        return;
      }
      const t = tempoFor(groups.length);
      const slots = stageSlotsFor(groups.length);
      prepared = true;
      cardReactionState.phase = 'rising';
      cardReactionState.chain = {cards: groups.map((g) => g.card), landed: 0, summarized: [], seats: slots.length, pace: 1};
      // Every claimed reactor comes forward together, a beat apart — the answer's own stagger then orders the births.
      const rises = groups.map((group, i) => new Promise<Risen>((resolve) => {
        gsap.delayedCall(motionMs(80 * i) / paceNow() / 1000, () => {
          void rise(group, i, opts.view, opts.emergence, {slots, readMs: t.holdMs + TRANSFER_POP_MS}).then(resolve);
        });
      }));
      const out = await Promise.all(rises);
      risen.push(...out);
      out.filter((r) => r.face === undefined).forEach((r) => noteDegrade(`${r.group.card}: no face to be born on`));
      if (epoch !== myEpoch) {
        return; // cut while rising — the cut owns the phase
      }
      cardReactionState.phase = 'paying';
      // The eye reads WHICH card and WHY before anything leaves it (the read beat of the rise — the effect row is lit).
      await pacedWait(t.holdMs);
    },
    tokensOf: (spec) => {
      // The shares are the RECORDS' (the server's numbers) — a group whose face could not be painted still gets its
      // tokens, which then tick with no birth place, by name.
      const row = railRowKey(spec);
      const out: Array<ResourceTransferSpec> = [];
      let left = spec.amount;
      for (const group of groups) {
        const share = [...group.rail, ...group.cards].filter((s) => railRowKey(s) === row && s.direction !== 'loss').reduce((sum, s) => sum + s.amount, 0);
        const take = Math.min(left, share);
        if (take <= 0) {
          continue;
        }
        for (const token of reactionTokensOf({...spec, amount: take})) {
          tokenGroup.set(token, group);
          out.push(token);
        }
        left -= take;
      }
      if (left > 0) {
        // What no reactor of this flight paid (a party's share, a rule's) keeps the tick.
        out.push({...spec, amount: left});
      }
      return out;
    },
    originOf: (spec) => {
      // A token `tokensOf` split belongs to its group; a host flying a CAUSE spec as given (the generation scene's
      // hook payout — one token of six) finds the risen group whose record moves that row.
      const row = railRowKey(spec);
      const group = tokenGroup.get(spec) ?? groups.find((g) => [...g.rail, ...g.cards].some((s) => railRowKey(s) === row));
      const r = group === undefined ? undefined : risen.find((x) => x.group === group);
      if (group === undefined) {
        return undefined;
      }
      if (r === undefined) {
        return undefined;
      }
      const end = birthEnds(r, [spec])[0];
      if (end === undefined) {
        noteDegrade(`${r.group.card}: its effect row prints no ${spec.resource}`);
      }
      return end;
    },
    onLeft: () => {},
    onDone: finish,
  };
}

/**
 * Two flights as one: the PRIMARY answers first (a reactor's birth), the FALLBACK takes what it declines (the cause's
 * own tag / chip). `prepare` / `onLeft` / `onDone` reach both; `tokensOf` is the primary's (the fallback keeps the
 * merged token). `undefined` when neither is given.
 */
export function composeAnswerFlights(primary: RailAnswerFlight | undefined, fallback: RailAnswerFlight | undefined): RailAnswerFlight | undefined {
  if (primary === undefined) {
    return fallback;
  }
  if (fallback === undefined) {
    return primary;
  }
  return {
    prepare: async () => {
      await primary.prepare?.();
      await fallback.prepare?.();
    },
    tokensOf: (spec) => primary.tokensOf?.(spec) ?? fallback.tokensOf?.(spec),
    originOf: (spec) => primary.originOf(spec) ?? fallback.originOf(spec),
    onLeft: () => {
      primary.onLeft();
      fallback.onLeft();
    },
    onDone: () => {
      primary.onDone?.();
      fallback.onDone?.();
    },
  };
}

/**
 * MARK THE CAUSE (the owner's decision 2): the element that woke the reactor — the played card's tag, the composer's
 * «Сработает» chip — wears a one-shot kant while the token is born on the reactor. Idempotent per element.
 */
export function markReactionCause(el: Element | null | undefined): void {
  if (el === null || el === undefined || !(el instanceof HTMLElement)) {
    return;
  }
  el.removeAttribute('data-reaction-cause');
  // Re-trigger the one-shot animation on a re-mark (a reflow between the removal and the set).
  void el.offsetWidth;
  el.setAttribute('data-reaction-cause', '1');
  window.setTimeout(() => el.removeAttribute('data-reaction-cause'), motionMs(700));
}

// ── STANDALONE: the chain ──────────────────────────────────────────────────

function noteDegrade(why: string): void {
  cardReactionState.degraded = why;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[card-reaction] not shown as recorded — ${why}`);
  }
}

/** One step of the chain in flight: its last token has LEFT the face (the next may rise), its slot is free again. */
type StepRun = {launched: Promise<void>; done: Promise<void>};

async function runStandalone(): Promise<void> {
  if (standaloneRunning) {
    return;
  }
  standaloneRunning = true;
  const myEpoch = epoch;
  try {
    cardReactionState.phase = 'waiting';
    // The board's own story first (a tile's landing, its cell's payout) — a reaction never cuts into the cause's scene;
    // and every BLOCKING scene (a sitting's beats, a landing) plays out before the chain — bounded, never a session.
    await waitRewardPayoutQuiet({alive: () => epoch === myEpoch && (standaloneQueue.length > 0 || rivalQueue.length > 0)});
    await waitBlockingQuiet(myEpoch);
    await waitSittingQuiet(myEpoch);
    await waitRatingStoryQuiet(myEpoch);
    await waitHydroStoryQuiet(myEpoch);
    await waitDecisionClear(myEpoch);
    if (epoch !== myEpoch) {
      return;
    }
    const batch = standaloneQueue.splice(0);
    running = batch;
    if (batch.length === 0) {
      await playRivals(myEpoch);
      endChain(myEpoch);
      return;
    }
    const t = tempoFor(batch.length);
    const slots = stageSlotsFor(batch.length);
    const plan = planReactionChain(
      batch.map((s) => ({tokens: s.held.flatMap((spec) => reactionTokensOf(spec)).length})),
      t, {popMs: TRANSFER_POP_MS, arcMs: TRANSFER_ARC_MS}, {slots: slots.length});
    const started = typeof performance === 'undefined' ? 0 : performance.now();
    cardReactionState.chain = {
      cards: batch.map((s) => s.group.card), landed: 0,
      summarized: plan.summarized.map((i) => batch[i].group.card), seats: slots.length, pace: plan.pace,
    };
    // Past the ceiling: the counters tick now, the names stand on the state and ONE feed card tells them (PL-1056 —
    // the viewer's merged deltas leading, a line per reactor; never a card per reactor, never a silent tick).
    for (const i of plan.summarized) {
      batch[i].held.splice(0).forEach((spec) => releasePanelRewardHold(spec));
      noteTransferTrail('reaction:summarized', {card: batch[i].group.card});
    }
    if (plan.summarized.length > 0) {
      const summarized = plan.summarized.map((i) => batch[i].group);
      const card = buildCardReactionSummaryNotification(summarized, summarized[0]?.record.owner, Date.now(), lastView?.game.generation ?? 0);
      if (card !== undefined) {
        pushTransient(card);
      }
    }
    cardReactionState.phase = 'rising';
    // THE STEPS GO BY EVENT (iteration 3): the next group rises once the previous group's last token has LEFT its
    // face and the overlap's share of the flight has passed (never at a time computed at the plan's start — a slow
    // device stretches the chain, it never bunches the rises), and never before its own slot has receded.
    const slotFree: Array<Promise<void>> = new Array(Math.max(1, slots.length)).fill(Promise.resolve());
    const dones: Array<Promise<void>> = [];
    let prev: StepRun | undefined;
    for (const step of plan.steps) {
      if (epoch !== myEpoch) {
        break;
      }
      if (prev !== undefined) {
        await prev.launched;
        await pacedWait(Math.max(0, TRANSFER_POP_MS + TRANSFER_ARC_MS - t.overlapMs), plan.pace);
      }
      await slotFree[step.seat % slotFree.length];
      if (epoch !== myEpoch) {
        break;
      }
      const run = runStep(batch[step.index], step.seat, t, slots, plan.pace, myEpoch);
      slotFree[step.seat % slotFree.length] = run.done;
      dones.push(run.done);
      prev = run;
    }
    await Promise.all(dones);
    if (epoch === myEpoch) {
      cardReactionState.lastWallMs = typeof performance === 'undefined' ? undefined : Math.round(performance.now() - started);
      cardReactionState.runs++;
    }
    await playRivals(myEpoch);
    endChain(myEpoch);
  } finally {
    running = [];
    standaloneRunning = false;
    if (standaloneQueue.length > 0 && epoch === myEpoch) {
      void runStandalone();
    }
  }
}

/** The chain is over: idle, the hurry forgotten, the warm faces nobody rose dropped. */
function endChain(myEpoch: number): void {
  if (epoch !== myEpoch) {
    return;
  }
  cardReactionState.phase = 'idle';
  hurried = false;
  cardReactionState.hurried = false;
  dropWarmReactors();
}

/** ONE step of the chain: rise → read → births on the effect row → the touchdowns → settle → recede. */
function runStep(entry: Standalone, slot: number, t: ReactionTempo, slots: ReadonlyArray<RectLike>, planPace: number, myEpoch: number): StepRun {
  let launchedResolve: () => void = () => {};
  const launched = new Promise<void>((resolve) => {
    launchedResolve = resolve;
  });
  const done = (async () => {
    try {
      await waitPlaceArrival(entry.group.card, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      const risen = await rise(entry.group, slot, undefined, undefined, {slots, readMs: t.holdMs + TRANSFER_POP_MS});
      if (epoch !== myEpoch) {
        return;
      }
      // The read beat is measured from a PAINTED frame of the risen face (a stall before it never eats the read).
      await nextPaintedFrame();
      await pacedWait(t.holdMs, planPace);
      if (epoch !== myEpoch) {
        return;
      }
      cardReactionState.phase = 'paying';
      // From here the entry holds TOKEN by token — what has not touched down yet is exactly what stays held
      // (the keeper above re-seeds it across a foreign clear; a cut releases it at once).
      const tokens = entry.held.flatMap((spec) => reactionTokensOf(spec));
      entry.held = [...tokens];
      const origins = birthEnds(risen, tokens);
      if (risen.face === undefined) {
        noteDegrade(`${entry.group.card}: no face to be born on`);
      }
      await runResourceTransfers({
        specs: tokens, source: {}, origins, arrival: 'auto', pace: 1 / paceNow(planPace),
        onLeft: () => launchedResolve(),
        onArrive: (spec) => {
          const at = entry.held.indexOf(spec);
          if (at >= 0) {
            entry.held.splice(at, 1);
            releasePanelRewardHold(spec);
          }
          if (cardReactionState.chain !== undefined) {
            cardReactionState.chain.landed++;
          }
        },
        onDegrade: (spec, why) => noteDegrade(`${entry.group.card}: ${spec.resource} ${why}`),
      });
      // Whatever the wave left held (it never does — the framework releases every spec) ticks now.
      entry.held.splice(0).forEach((spec) => releasePanelRewardHold(spec));
      if (epoch !== myEpoch) {
        return;
      }
      // The settle: the counter's delta lands under the eye before the card lets go.
      await pacedWait(t.settleMs, planPace);
      await recede(risen);
    } finally {
      launchedResolve();
    }
  })();
  return {launched, done};
}

/** Wait out every BLOCKING animation hold (bounded) — the chain never cuts into a scene that owns the screen. */
async function waitBlockingQuiet(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  while (epoch === myEpoch && blockingAnimationHoldCount() > 0) {
    if (typeof performance !== 'undefined' && performance.now() - started > BLOCKING_QUIET_MAX_MS) {
      return;
    }
    await nextPaintedFrame();
  }
}

/**
 * THE SITTING'S OWN BEATS FIRST (TR78's regression run, 2026-10-28): a record of the sitting's response nobody's wave
 * declared — the ruling Greens' M€ for the winner's TR step (the summary's `agenda` carries no answer, so ПОВЕСТКА cannot
 * fly it attached the way a card's walk does) — rises at the rail's edge only once the sitting's own beats have played,
 * never INTO them: the generic blocking wait above is capped at 12 s and a sitting (the verdict's read, ПОВЕСТКА,
 * ПОДДЕРЖКА, ПРИНЯТИЕ, НАГРАДА) runs longer, so the charter rose BESIDE the plaque's own chip of the reward wave
 * (`console-parliament-sitting-reward` RX05). Read off the sitting's hold labels (`sittingHoldLabel`), every one of
 * which is bounded by its own ceiling; bounded here too.
 */
async function waitSittingQuiet(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  const sittingPlays = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith('parliament-sitting:'));
  while (epoch === myEpoch && sittingPlays()) {
    if (typeof performance !== 'undefined' && performance.now() - started > SITTING_QUIET_MAX_MS) {
      return;
    }
    await nextPaintedFrame();
  }
}

/**
 * THE HYDRONETWORK'S OWN STORY FIRST (iteration 6 — the owner, 2026-10-27: «после результата»): an advance's commit is
 * the marker's glide onto the stage, a traversal's legs, the terminal ceremony — and its reward wave, which
 * `waitRewardPayoutQuiet` above already waits out — and only THEN the table's answer to that reward (the ruling Greens'
 * M€ production for a heat production step) rises at the rail's edge: never over the glide, never over the wave. The
 * flow's RESULT stage is deliberately NOT waited for: it opens on the falling edge of the rail's holds, and the chain
 * holds the party's row until its token lands — a wait for `result` was a mutual wait, broken only by the bound
 * (the charter rose 13 s into `resolving` on the box). The hydro ceremony's hold is notification-only (the blocking
 * wait above never sees it), so the flow's own facts are asked. Bounded like the blocking wait.
 */
async function waitHydroStoryQuiet(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  const busy = (): boolean => hydroFlowState.commit !== undefined &&
    (hydroFlowState.commit.phase === 'moving' || isHydroMarkerActive() || hydroTraversalPending() || hydroFlowState.ceremonyActive || hydroCeremonyOwed());
  while (epoch === myEpoch && busy()) {
    if (typeof performance !== 'undefined' && performance.now() - started > BLOCKING_QUIET_MAX_MS) {
      return;
    }
    await nextPaintedFrame();
  }
}

/**
 * A RATING reactor answers the rating's OWN touchdown (TR81 Lotus Innovations — `onIncreaseTerraformRatingByAnyPlayer`):
 * a scale step's TR is the scale-step rating beat's, born on the marker once it has ARRIVED — a NOTIFICATION-ONLY hold
 * the blocking wait above never sees, so the chain rose and paid before its cause had landed. Bounded like that wait.
 */
async function waitRatingStoryQuiet(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  while (epoch === myEpoch && scaleStepRatingBusy() && standaloneQueue.some((s) => s.group.record.channel === 'tr-increase')) {
    if (typeof performance !== 'undefined' && performance.now() - started > BLOCKING_QUIET_MAX_MS) {
      return;
    }
    await nextPaintedFrame();
  }
}

/** A decision surface stands at the centre (a drawn card to take, a deck pick). */
function decisionStands(): boolean {
  const el = document.querySelector<HTMLElement>(DECISION_SURFACES);
  if (el === null) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

/**
 * A REACTOR'S OWN PLACE IS ARRIVING (PL-1098 — TR84 Titan Holdings answers its own play in the SAME response that seats
 * it and opens the solo colony step): its face is mounted but still under the deal's hold. The chain waits for the
 * landing — bounded; past the bound the reactor rises at the stage as before — so it lifts IN its place and its tokens
 * find their capsule (one physical card, law 3).
 */
async function waitPlaceArrival(card: CardName, myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  let waited = false;
  while (epoch === myEpoch && findReactorPlace(card) === undefined && reactorPlaceArriving(card)) {
    if (typeof performance !== 'undefined' && performance.now() - started > PLACE_ARRIVAL_WAIT_MS) {
      noteTransferTrail('reaction:place-late', {card});
      return;
    }
    waited = true;
    await nextPaintedFrame();
  }
  if (waited) {
    noteTransferTrail('reaction:place-landed', {card});
  }
}

/**
 * A reactor never covers a card the player is choosing (the stage is the opening's centre — where a drawn card
 * stands for its take): the chain waits for the decision, bounded — past the bound it plays (the take's press
 * hurries it).
 */
async function waitDecisionClear(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  while (epoch === myEpoch && decisionStands()) {
    if (typeof performance !== 'undefined' && performance.now() - started > DECISION_WAIT_MAX_MS) {
      return;
    }
    await nextPaintedFrame();
  }
}

/**
 * THE RIVALS' TURN — after the viewer's own chain: each rival reactor in the records' order rises at the stage a step
 * smaller under its seat's caption (the intake plaque opened first — EXPECTING), its tokens born on its effect row
 * land on the plaque's number (the chip's dot when no plaque is painted), the plaque ticks and folds, the face
 * recedes. Nothing of the viewer's is held.
 */
async function playRivals(myEpoch: number): Promise<void> {
  while (rivalQueue.length > 0 && epoch === myEpoch) {
    const entry = rivalQueue.shift();
    if (entry === undefined) {
      break;
    }
    const t = tempoFor(1);
    cardReactionState.phase = 'rising';
    cardReactionState.chain = {cards: [entry.group.card], landed: 0, summarized: [], seats: 1, pace: 1};
    // The plaque reads STOCK (its items are a resource and a count); a production step lands on the chip's dot itself,
    // its token wearing the production frame — never a plaque that would print a step as money.
    const stock = entry.specs.filter((spec) => spec.channel === 'stock');
    if (stock.length > 0) {
      await openSeatIntake(entry.owner, stock);
    }
    if (epoch !== myEpoch) {
      return;
    }
    const risen = await rise(entry.group, 0, lastView, undefined, {
      slots: stageSlotsFor(1, REACTION_RIVAL_SCALE),
      model: seatModelOf(lastView, entry.owner, entry.group.card),
      caption: seatCaptionOf(lastView, entry.owner),
      readMs: t.holdMs + TRANSFER_POP_MS,
    });
    if (epoch !== myEpoch) {
      return;
    }
    await nextPaintedFrame();
    await pacedWait(t.holdMs);
    cardReactionState.phase = 'paying';
    const tokens = entry.specs.flatMap((spec) => reactionTokensOf(spec));
    const origins = birthEnds(risen, tokens);
    if (risen.face === undefined) {
      noteDegrade(`${entry.group.card}: no face to be born on`);
    }
    await runResourceTransfers({
      specs: tokens, source: {}, origins, arrival: 'auto', pace: 1 / paceNow(),
      destinationOf: (spec) => (spec.channel === 'stock' ? seatIntakeEnd(entry.owner, spec.resource) : undefined) ?? seatChipFallbackEnd(entry.owner),
      onArrive: (spec) => {
        if (spec.channel === 'stock') {
          acceptSeatIntake(entry.owner, spec);
        }
      },
      onDegrade: (spec, why) => noteDegrade(`${entry.group.card}: ${spec.resource} ${why}`),
    });
    if (stock.length > 0) {
      foldSeatIntake(entry.owner);
    }
    await pacedWait(t.settleMs);
    await recede(risen);
  }
}

// ── HURRY / CUT / ABORT ────────────────────────────────────────────────────

/**
 * A PRESS or a NAVIGATION while reactions play (the owner, 2026-10-27): the FIRST hurry is a PACE — what is left plays
 * at `REACTION_HURRY_PACE` (the read beats shorten, the tweens in flight speed up, every face still rises, every
 * token still flies); the SECOND completes at once (`cutCardReactions`). The hosts' own holds are theirs.
 */
export function hurryCardReactions(reason = 'press'): void {
  if (cardReactionState.phase === 'idle' && standaloneQueue.length === 0 && rivalQueue.length === 0) {
    return;
  }
  const now = typeof performance === 'undefined' ? 0 : performance.now();
  if (hurried && hurriedEpoch === epoch) {
    if (now - hurriedAt < HURRY_REPEAT_WINDOW_MS) {
      return; // the same gesture (a press that opened a sheet reports twice)
    }
    cutCardReactions(`${reason}:again`);
    return;
  }
  hurried = true;
  hurriedEpoch = epoch;
  hurriedAt = now;
  cardReactionState.hurried = true;
  paceReactorTweens(REACTION_HURRY_PACE);
  noteTransferTrail('reaction:hurry', {reason, phase: cardReactionState.phase});
}

/** Whatever is still owed ticks at once, the faces let go — a second hurry, the ceiling, a teardown. */
export function cutCardReactions(reason = 'cut'): void {
  if (cardReactionState.phase === 'idle' && standaloneQueue.length === 0 && rivalQueue.length === 0) {
    return;
  }
  noteTransferTrail('reaction:cut', {reason, phase: cardReactionState.phase});
  epoch++;
  // The queue AND the batch in flight: a step still waiting for its rise would otherwise keep its rows held for good.
  for (const entry of [...running.splice(0), ...standaloneQueue.splice(0)]) {
    entry.held.splice(0).forEach((spec) => releasePanelRewardHold(spec));
  }
  rivalQueue.splice(0);
  killReactorTweens();
  unseatAllReactors();
  hurried = false;
  cardReactionState.hurried = false;
  cardReactionState.phase = 'idle';
}

/** The ceiling / a teardown: everything held here ticks, the faces leave, nothing can hang. */
export function abortCardReactions(): void {
  cutCardReactions('abort');
  attached = [];
  reservations.clear();
}

/** Test-only reset. */
export function resetCardReactions(): void {
  abortCardReactions();
  claimedSeqs.clear();
  takeDeclaredAnswers();
  unseatAllReactors();
  cardReactionState.chain = undefined;
  cardReactionState.degraded = undefined;
  cardReactionState.lastWallMs = undefined;
  cardReactionState.runs = 0;
}

/** The answer's beat after the cause (re-exported for the hosts' own waits). */
export const REACTION_ANSWER_GAP_MS = TOUCHDOWN_TICK_GAP_MS;
