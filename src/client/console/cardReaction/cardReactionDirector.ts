/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CARD-REACTION DIRECTOR — «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» (Turmoil
 * Redux TR80 Hartlan Heating, 2026-10-26; contract `docs/claude/console/
 * card-reaction.md`). The server's record (`GameModel.cardReactions`) says
 * WHICH card's printed effect fired and WHAT it paid; this module turns the
 * fresh records of a response into ONE scene, in two shapes:
 *
 *  ATTACHED  — a host already HOLDS the reaction's rows on the rail (the play
 *              scene's rail half, the action commit's — their «table's
 *              answer», promised by the forecast and verified against the two
 *              views): the host asks for an ANSWER FLIGHT and gets one whose
 *              tokens are born on the REACTOR — risen at `prepare`, out of its
 *              own place when the receiving stage holds it, else at a seat
 *              beside the rail — instead of on the cause (the played card's
 *              tag, the composer's chip — those are MARKED, the owner's
 *              decision 2). The rail module keeps its holds, its order and its
 *              release; this module keeps the faces.
 *  STANDALONE — nobody holds the rows (a standard project's city waking
 *              Tharsis, a reaction with no host scene): the seeder holds the
 *              viewer's own rows in the apply block and plays the chain itself
 *              after the board's own story — rise → birth on the effect row →
 *              fly → tick on touchdown → recede, group after group under the
 *              wall-clock ceiling (`planReactionChain`).
 *
 * Honesties: the amounts are the SERVER's (never a counter's delta read
 * back); an impact the scene cannot fly is named `elsewhere` and ticks; a
 * face that cannot be painted degrades THAT group by name; every hold is
 * bounded (the registry's ceiling) and NOTIFICATION-ONLY — a reaction never
 * holds a question; A / B hurries: whatever is left ticks at once; reduced
 * motion holds nothing and flies nothing.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {blockingAnimationHoldCount, registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {probeTick} from '@/client/console/probeTick';
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
import {RectLike} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {
  CardReactionGroup, ReactionTempo, freshCardReactions, groupCardReactions, planReactionChain, reactionImpactSpec, reactionSeatRect,
  reactionTempo, reactionTokensOf, reducedReactionTempo,
} from '@/client/console/cardReaction/cardReactionModel';
import {
  ReactorFace, cardReactionStageMounted, cardReactionStageRect, cardReactionState, killReactorTweens, reactorEl, recedeReactor, riseReactor, seatReactor,
  unseatAllReactors, unseatReactor,
} from '@/client/console/cardReaction/cardReactionStage';
import {resolveEffectIconEnds} from '@/client/console/cardReaction/effectIconEnds';
import {buildCardReactionSummaryNotification} from '@/client/console/cardReaction/cardReactionSummary';
import {pushTransient} from '@/client/components/notifications/notificationState';

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

/** A reactor's WAY ONTO THE SCREEN: out of its own place in a host's stage, or at a seat of this layer. */
export type ReactorEmergence = {
  /** The host's stage holds this card and can bring it forward out of its place. */
  standsIn: (card: CardName) => boolean;
  emergeTarget: (card: CardName) => Promise<void>;
  settleTarget: (card: CardName) => Promise<void>;
  /** The emerged face's element (the tokens are born on its effect row) — `undefined` degrades the group's births. */
  emergedFaceEl: (card: CardName) => HTMLElement | undefined;
};

type Attached = {
  group: CardReactionGroup;
  /** The rows of the group a host holds (its answer) — the join key for the host's flight. */
  rows: Set<string>;
  claimed: boolean;
};

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
  emergence?: ReactorEmergence;
};

const claimedSeqs = new Set<number>();
let attached: Array<Attached> = [];
const standaloneQueue: Array<Standalone> = [];
/** The batch the chain is playing right now — its `held` rows are exactly what has not touched down yet. */
let running: Array<Standalone> = [];

/**
 * A RIVAL's reactor (the record's owner is another seat — PL-1057): nothing of the viewer's is held; after the viewer's
 * own chain it rises COMPACTLY beside that seat's chip in the status strip and its tokens are born on its effect row
 * and land on the chip's INTAKE plaque (the owner's M1 — `statusIntake`), each ticking the plaque's number.
 */
type Rival = {group: CardReactionGroup; owner: Color; specs: Array<ResourceTransferSpec>};
const rivalQueue: Array<Rival> = [];
/** The last applied view — a rival's face is read off ITS seat's tableau. */
let lastView: PlayerViewModel | undefined;
/** A rival's rise waits for a screen with nothing over the strip — bounded; past it the rise is skipped (the feed tells it). */
const RIVAL_WAIT_MS = 8000;
/** The rival's face stands smaller than an own reactor's (a glance at the strip, never a protagonist). */
const RIVAL_SEAT_SCALE = 0.62;
/** The standalone chain plays after every BLOCKING scene (a sitting's beats, a landing) — bounded; then it plays anyway. */
const BLOCKING_QUIET_MAX_MS = 12000;
let epoch = 0;
let standaloneRunning = false;
let faceSeq = 0;

export function cardReactionPending(): boolean {
  return cardReactionState.phase !== 'idle' || standaloneQueue.length > 0 || rivalQueue.length > 0;
}

/** A rival's record is pending (its compact rise beside the seat chip is owed). */
export function rivalReactionPending(): boolean {
  return rivalQueue.length > 0;
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
  diagnose: () => ({phase: cardReactionState.phase, chain: cardReactionState.chain, faces: cardReactionState.faces.map((f) => f.name)}),
  expire: () => abortCardReactions(),
});

// The chain's rows survive a foreign scene's belt-and-braces clear (a tile scene's «safety» at its end — the first
// field run ticked Tharsis Republic's 3 M€ a beat before its tokens were born): released only by their touchdowns,
// A / B, or the registry's ceiling above.
registerRewardHoldKeeper(() => [...running, ...standaloneQueue].flatMap((entry) => entry.held));

/** The viewer's own LIVE model of a card (the capsule's count) — the pristine print when the tableau does not hold it. */
function liveModelOf(view: PlayerViewModel | undefined, card: CardName): CardModel | undefined {
  return view?.thisPlayer?.tableau.find((c) => c.name === card);
}

// ── SEED (the apply block) ─────────────────────────────────────────────────

/**
 * Called from the transport's apply block AFTER every host seeded its own rewards: the fresh records are claimed once
 * (by `seq`); a group whose rows a host holds is ATTACHED (the host's flight will ask for it); a group with rows nobody
 * holds is held here and queued for the STANDALONE chain. Reduced motion claims the records and holds nothing.
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
      hostHeld[row] = Math.max(0, heldNow[row] - (heldBefore[row] ?? 0));
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
      attached.push({group, rows, claimed: false});
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
  preloadPremiumCardArt([...groups.map((g) => g.card), ...rivals.map((r) => r.group.card)]);
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

// ── THE RISE (shared by both shapes) ───────────────────────────────────────

function tempo(): ReactionTempo {
  return consoleReducedMotionActive() ? reducedReactionTempo() : reactionTempo();
}

function measure(selector: string): RectLike | undefined {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 ? {left: r.left, top: r.top, width: r.width, height: r.height} : undefined;
}

/** The RECEIVER of a group's first token — its rail row, a holder's satellite cell (the whole rail when neither is painted). */
function receiverOf(group: CardReactionGroup): RectLike | undefined {
  const first = group.rail[0] ?? group.cards[0];
  const row = first === undefined ? undefined :
    first.channel === 'card-resource' ? measure(`.con-res-aux__cell[data-aux-resource="${first.resource}"]`) :
      first.resource === RATING_RAIL_KEY ? measure('.con-res .con-score__cell--tr') :
        measure(`.con-res .con-res__row--${first.resource}`);
  return row ?? measure('.con-res');
}

/**
 * The surfaces a seat must never cover: the hero, the composer's focus card, the reveal's row, the start stage, the
 * emergence layer — and the PARLIAMENT's sitting field (TR81: a Career step's TR wakes a rating reactor while the
 * sitting stands; the seat slides past its field, never over the plaques the player is reading).
 */
function avoidRects(): Array<RectLike> {
  const out: Array<RectLike> = [];
  for (const selector of ['.con-played-hero__proxy', '.con-composer__actcardwrap', '.con-reveal', '.con-start__firstact', '.con-recv__emerge', '.con-parl--sitting .con-parl__field']) {
    const r = measure(selector);
    if (r !== undefined) {
      out.push(r);
    }
  }
  return out;
}

/** The seat's height: a reading size beside the rail — a share of the stage, never the hero's. */
function seatHeight(stage: RectLike): number {
  return Math.min(stage.height * 0.22, 320 * conUiScale());
}

/** Bring ONE reactor forward — out of its place when a host's stage holds it, else at a seat of this layer. */
/**
 * A seat's WHOLE chip in the status strip (the rival's receiver): the seat stands right of the chip, hanging from the
 * strip — the intake plaque hangs under the chip itself, so the two never cover each other.
 */
function seatChipRect(color: Color): RectLike | undefined {
  const chip = document.querySelector<HTMLElement>(`.con-status__player[data-color="${color}"]:not(.con-status__pghost)`);
  const r = chip?.getBoundingClientRect();
  return r === undefined || r.width < 2 || r.height < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
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

type RiseOpts = {receiver?: RectLike; height?: number; model?: CardModel};

async function rise(group: CardReactionGroup, slot: 0 | 1, view: PlayerViewModel | undefined, emergence: ReactorEmergence | undefined, opts: RiseOpts = {}): Promise<Risen> {
  const key = `${group.record.seq}:${++faceSeq}`;
  if (emergence !== undefined && emergence.standsIn(group.card)) {
    await emergence.emergeTarget(group.card);
    return {group, key, face: emergence.emergedFaceEl(group.card), via: 'place', emergence};
  }
  if (!cardReactionStageMounted()) {
    return {group, key, face: undefined, via: 'none'};
  }
  const stage = cardReactionStageRect();
  const receiver = opts.receiver ?? receiverOf(group) ?? {left: stage.left, top: stage.top + stage.height / 2, width: 0, height: 0};
  const seat = reactionSeatRect(stage, receiver, avoidRects(), opts.height ?? seatHeight(stage), slot);
  const face: ReactorFace = {key, name: group.card, card: opts.model ?? liveModelOf(view, group.card), seat};
  const el = await seatReactor(face);
  if (el === undefined) {
    return {group, key, face: undefined, via: 'none'};
  }
  await riseReactor(el, seat, tempo(), consoleReducedMotionActive());
  return {group, key, face: el, via: 'seat'};
}

async function recede(risen: Risen): Promise<void> {
  if (risen.via === 'place' && risen.emergence !== undefined) {
    await risen.emergence.settleTarget(risen.group.card);
    return;
  }
  const el = reactorEl(risen.key);
  if (el !== undefined) {
    await recedeReactor(el, tempo(), consoleReducedMotionActive());
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
  /** The host's stage, when it can bring a reactor forward out of its own place (the play scene's receiving stage). */
  emergence?: ReactorEmergence;
  /** The viewer's view at the flight (the faces' live models). */
  view?: PlayerViewModel;
};

/**
 * THE ANSWER FLIGHT for a host that holds the reaction's rows (`railReward.answerRailReward`'s `RailAnswerFlight`):
 * `prepare` rises every claimed reactor (out of its place or at a seat), `tokensOf` splits a held answer into the
 * groups' own tokens (a wave of heat — one per unit), `originOf` births each on its group's effect row, `onDone`
 * recedes the faces. `undefined` when no fresh record is attached to the host's rows — the host keeps its old flight.
 */
export function cardReactionAnswerFlight(opts: ReactionAnswerOptions = {}): RailAnswerFlight | undefined {
  const rows = opts.rows === undefined ? undefined : new Set(opts.rows);
  const mine = attached.filter((a) => !a.claimed && (rows === undefined || [...a.rows].some((r) => rows.has(r))));
  if (mine.length === 0) {
    return undefined;
  }
  mine.forEach((a) => {
    a.claimed = true;
  });
  attached = attached.filter((a) => !a.claimed);
  const groups = mine.map((a) => a.group);
  const risen: Array<Risen> = [];
  const tokenGroup = new WeakMap<ResourceTransferSpec, CardReactionGroup>();
  const myEpoch = epoch;
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  let done = false;
  const finish = (): void => {
    if (done) {
      return;
    }
    done = true;
    const faces = [...risen];
    risen.length = 0;
    cardReactionState.phase = 'receding';
    void Promise.all(faces.map((r, i) => new Promise<void>((resolve) => {
      gsap.delayedCall(motionMs(60 * i) / 1000, () => {
        void recede(r).then(resolve);
      });
    }))).then(() => {
      if (epoch === myEpoch && cardReactionState.phase === 'receding') {
        cardReactionState.phase = 'idle';
      }
      cardReactionState.lastWallMs = typeof performance === 'undefined' ? undefined : Math.round(performance.now() - started);
      cardReactionState.runs++;
    });
  };
  return {
    prepare: async () => {
      if (epoch !== myEpoch || consoleReducedMotionActive()) {
        return;
      }
      cardReactionState.phase = 'rising';
      cardReactionState.chain = {cards: groups.map((g) => g.card), landed: 0, summarized: [], seats: groups.length >= 3 ? 2 : 1, pace: 1};
      // Every claimed reactor comes forward together, a beat apart — the answer's own stagger then orders the births.
      const rises = groups.map((group, i) => new Promise<Risen>((resolve) => {
        gsap.delayedCall(motionMs(80 * i) / 1000, () => {
          void rise(group, (i % 2) as 0 | 1, opts.view, opts.emergence).then(resolve);
        });
      }));
      const out = await Promise.all(rises);
      risen.push(...out);
      out.filter((r) => r.face === undefined).forEach((r) => noteDegrade(`${r.group.card}: no face to be born on`));
      cardReactionState.phase = 'paying';
      // The eye reads WHICH card before anything leaves it (the hold beat of the rise).
      await new Promise<void>((resolve) => {
        gsap.delayedCall(motionMs(tempo().holdMs) / 1000, () => resolve());
      });
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

function gsapWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, () => resolve());
  });
}

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
    await waitRatingStoryQuiet(myEpoch);
    if (epoch !== myEpoch) {
      return;
    }
    const batch = standaloneQueue.splice(0);
    running = batch;
    if (batch.length === 0) {
      await playRivals(myEpoch);
      if (epoch === myEpoch) {
        cardReactionState.phase = 'idle';
      }
      return;
    }
    const t = tempo();
    const plan = planReactionChain(
      batch.map((s) => ({tokens: s.held.flatMap((spec) => reactionTokensOf(spec)).length})),
      t, {popMs: TRANSFER_POP_MS, arcMs: TRANSFER_ARC_MS});
    const started = typeof performance === 'undefined' ? 0 : performance.now();
    cardReactionState.chain = {
      cards: batch.map((s) => s.group.card), landed: 0,
      summarized: plan.summarized.map((i) => batch[i].group.card), seats: plan.seats, pace: plan.pace,
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
    const scale = 1 / plan.pace;
    const steps = plan.steps.map((step) => (async () => {
      const entry = batch[step.index];
      await gsapWait(motionMs(step.riseAtMs));
      if (epoch !== myEpoch) {
        return;
      }
      const risen = await rise(entry.group, step.seat, undefined, undefined);
      if (epoch !== myEpoch) {
        return;
      }
      await gsapWait(motionMs(t.holdMs * scale));
      if (epoch !== myEpoch) {
        return;
      }
      cardReactionState.phase = 'paying';
      // From here the entry holds TOKEN by token — what has not touched down yet is exactly what stays held
      // (the keeper above re-seeds it across a foreign clear; a hurry releases it at once).
      const tokens = entry.held.flatMap((spec) => reactionTokensOf(spec));
      entry.held = [...tokens];
      const origins = birthEnds(risen, tokens);
      if (risen.face === undefined) {
        noteDegrade(`${entry.group.card}: no face to be born on`);
      }
      await runResourceTransfers({
        specs: tokens, source: {}, origins, arrival: 'auto', pace: plan.pace,
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
      await recede(risen);
    })());
    await Promise.all(steps);
    if (epoch === myEpoch) {
      cardReactionState.lastWallMs = typeof performance === 'undefined' ? undefined : Math.round(performance.now() - started);
      cardReactionState.runs++;
    }
    await playRivals(myEpoch);
    if (epoch === myEpoch) {
      cardReactionState.phase = 'idle';
    }
  } finally {
    running = [];
    standaloneRunning = false;
    if (standaloneQueue.length > 0 && epoch === myEpoch) {
      void runStandalone();
    }
  }
}

/** The next painted frame or the probe's fallback — never bare rAF (a quiet screen is the state these waits sit in). */
function nextProbeTick(): Promise<void> {
  return new Promise<void>((resolve) => probeTick(() => resolve()));
}

/** Wait out every BLOCKING animation hold (bounded) — the chain never cuts into a scene that owns the screen. */
async function waitBlockingQuiet(myEpoch: number): Promise<void> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  while (epoch === myEpoch && blockingAnimationHoldCount() > 0) {
    if (typeof performance !== 'undefined' && performance.now() - started > BLOCKING_QUIET_MAX_MS) {
      return;
    }
    await nextProbeTick();
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
    await nextProbeTick();
  }
}

/** A rival's rise waits for a screen with no workspace over the strip — bounded; `false` = skip the rise. */
async function waitStripClear(myEpoch: number): Promise<boolean> {
  const started = typeof performance === 'undefined' ? 0 : performance.now();
  while (epoch === myEpoch && document.querySelector('.con-ws') !== null) {
    if (typeof performance !== 'undefined' && performance.now() - started > RIVAL_WAIT_MS) {
      return false;
    }
    await nextProbeTick();
  }
  return epoch === myEpoch;
}

/**
 * THE RIVALS' TURN — after the viewer's own chain: each rival reactor in the records' order rises compactly beside
 * its seat's chip (the intake plaque opened first — EXPECTING), its tokens born on its effect row land on the
 * plaque's number (the chip's dot when no plaque is painted), the plaque ticks and folds, the face recedes. Nothing
 * of the viewer's is held; a covered strip skips the rise (the feed already tells it).
 */
async function playRivals(myEpoch: number): Promise<void> {
  while (rivalQueue.length > 0 && epoch === myEpoch) {
    const entry = rivalQueue.shift();
    if (entry === undefined) {
      break;
    }
    if (!(await waitStripClear(myEpoch))) {
      noteTransferTrail('reaction:rival-skipped', {card: entry.group.card, owner: entry.owner});
      continue;
    }
    cardReactionState.phase = 'rising';
    // The plaque reads STOCK (its items are a resource and a count); a production step lands on the chip's dot itself,
    // its token wearing the production frame — never a plaque that would print a step as money.
    const stock = entry.specs.filter((spec) => spec.channel === 'stock');
    if (stock.length > 0) {
      await openSeatIntake(entry.owner, stock);
    }
    if (epoch !== myEpoch) {
      return;
    }
    const stage = cardReactionStageMounted() ? cardReactionStageRect() : undefined;
    const risen = await rise(entry.group, 0, lastView, undefined, {
      receiver: seatChipRect(entry.owner),
      height: stage === undefined ? undefined : Math.round(seatHeight(stage) * RIVAL_SEAT_SCALE),
      model: seatModelOf(lastView, entry.owner, entry.group.card),
    });
    if (epoch !== myEpoch) {
      return;
    }
    await gsapWait(motionMs(tempo().holdMs));
    cardReactionState.phase = 'paying';
    const tokens = entry.specs.flatMap((spec) => reactionTokensOf(spec));
    const origins = birthEnds(risen, tokens);
    if (risen.face === undefined) {
      noteDegrade(`${entry.group.card}: no face to be born on`);
    }
    await runResourceTransfers({
      specs: tokens, source: {}, origins, arrival: 'auto',
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
    await recede(risen);
  }
}

// ── HURRY / ABORT ──────────────────────────────────────────────────────────

/** A / B while reactions fly: whatever is still owed ticks at once, the faces let go. The hosts' own holds are theirs. */
export function hurryCardReactions(): void {
  if (cardReactionState.phase === 'idle' && standaloneQueue.length === 0 && rivalQueue.length === 0) {
    return;
  }
  epoch++;
  // The queue AND the batch in flight: a step still waiting for its rise would otherwise keep its rows held for good.
  for (const entry of [...running.splice(0), ...standaloneQueue.splice(0)]) {
    entry.held.splice(0).forEach((spec) => releasePanelRewardHold(spec));
  }
  rivalQueue.splice(0);
  killReactorTweens();
  unseatAllReactors();
  cardReactionState.phase = 'idle';
}

/** The ceiling / a teardown: everything held here ticks, the faces leave, nothing can hang. */
export function abortCardReactions(): void {
  hurryCardReactions();
  attached = [];
}

/** Test-only reset. */
export function resetCardReactions(): void {
  abortCardReactions();
  claimedSeqs.clear();
  takeDeclaredAnswers();
  cardReactionState.chain = undefined;
  cardReactionState.degraded = undefined;
  cardReactionState.lastWallMs = undefined;
  cardReactionState.runs = 0;
}

/** The answer's beat after the cause (re-exported for the hosts' own waits). */
export const REACTION_ANSWER_GAP_MS = TOUCHDOWN_TICK_GAP_MS;
