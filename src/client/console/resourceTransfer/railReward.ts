/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A REWARD ON THE RAIL — «a gain is a reward, wherever in a flow it lands».
 *
 * A gain the server has ALREADY committed (a rating step, a stock or a
 * production step of a standard resource) used to arrive, outside the
 * surfaces that fly their own waves, as a NUMBER THAT CHANGED: the rail's
 * counter ticked in the frame the view applied — before the thing that paid it
 * had answered on screen, with no visible cause. This module is the ONE beat
 * that shows such a gain ARRIVING, for any owner that can name where it comes
 * from:
 *
 *   SEED     — in the transport's apply block (the SAME synchronous block as
 *              the view apply — a hold seeded a tick late flushes a phantom
 *              −N chip): the rail keeps the pre-gain value of every row the
 *              reward touches (`committed − held`);
 *   FLY      — a token is born on a MEASURED source (the printed icon of the
 *              card that paid — never a synthetic point) and flies the shared
 *              transfer language to its row; the row ticks ON THE TOUCHDOWN
 *              and its delta chip is born there (THE DELTA-CHIP ANCHOR LAW);
 *   ANSWER   — what the table paid BECAUSE of that gain (the ruling Greens'
 *              M€ on a rating step) is released only after the cause has
 *              landed: a reaction never ticks before its reason. An owner
 *              whose surface still SHOWS the promise (the composer's
 *              «Сработает» chip — PL-220) has the answer FLY from it to its
 *              row instead (`RailAnswerFlight`); a reaction with no chip on
 *              screen ticks as before.
 *
 * It is split from its owners the way every reward beat in this console is
 * (`startBonusGain.ts`, `parliamentRewardBeat.ts`): the owner decides WHEN
 * (its own scene) and WHERE FROM (its own measured node); this module owns the
 * holds, their order and their release, so the chain survives the owner's
 * surface leaving the screen mid-flight.
 *
 * Honesties:
 *  · the AMOUNTS are never guessed — the owner hands in specs read off the
 *    server's own chips (`railRewardSpecs` over a preview pinned at the commit
 *    boundary), and the seed checks them against the DIFF of the two views
 *    (`verifyRailReward`): a row whose applied change is not what the reward
 *    promised is not held at all — it ticks with the commit, and says why;
 *  · a flight that cannot be measured (no source, no row, no layer) or stalls
 *    is a NAMED degradation (`railRewardState.degraded`, a dev warn): the
 *    counter ticks, nothing hangs;
 *  · every hold is bounded and names itself: an interrupt releases at once
 *    (`releaseRailReward`), and the registry's ceiling is the last net;
 *  · reduced motion holds nothing and flies nothing.
 *
 * Its first owner outside the Parliament is the fleet dock's scene (TR26 UNMI
 * Liner: the trade's +1 TR — `colonyTrade/fleetDockScene.ts`).
 */
import {reactive} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, TransferEndLike, mergeTransferSpecs, railRowKey,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  TransferDegradeReason, beginPanelRewardHold, beginPanelVpHold, noteTransferTrail, releasePanelRewardHold, releasePanelVpHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {noteVpHeldElsewhere} from '@/client/console/scoreCell/vpShareLedger';
import type {Tag} from '@/common/cards/Tag';

/** One printed cause of a card's answer on a played card: the tag that woke it and the share it pays (T06). */
export type RailAnswerCause = {tag: Tag, amount: number};

/** What an owner promises the rail: the gains it will FLY, and the table's answer to them. */
export type RailReward = {
  /**
   * The gains the paying object's own icons give — flown, each ticking on its
   * touchdown. NEVER merged: two printed icons are two tokens (TR27's two
   * floaters), each released on its own touchdown. A `card-resource` spec
   * lands on its `targetCard` — the card's own counter is its row.
   */
  cause: ReadonlyArray<ResourceTransferSpec>;
  /** What the table pays BECAUSE of them — never flown from the object, released after the last touchdown. */
  reactions: ReadonlyArray<ResourceTransferSpec>;
  /**
   * The OTHER moves of the same response on the rail's rows, by `railRowKey`
   * (a trade's fee as a negative, its flat bonus as a positive) — what the
   * diff check must allow for beside the reward itself.
   */
  known?: Readonly<Record<string, number>>;
  /**
   * DERIVED POINTS, aligned with `cause`: the victory points each cause token
   * brings at its touchdown (a floater onto a «1 VP / 2» card). The rail's VP
   * cell is the score INCLUDING those points, so it is held with them and
   * ticks on the same touchdowns — never a result announced ahead of its
   * cause. Checked against the views' own score like every row.
   */
  vp?: ReadonlyArray<number>;
  /**
   * THE ANSWER'S PRINTED CAUSES ON A PLAYED CARD (T06 GMO Contract): by the answer's rail row (`railRowKey`), the
   * TAGS of the played card that woke a card's answer, each with its share («+2 M€» per plant / animal / microbe tag) —
   * the play scene births one token per cause on the landed card's printed tag, the row ticking on each touchdown
   * (`receivingStageModel.railAnswerTags`). What the causes do not cover (a party's share, nothing printed to be born on)
   * keeps the tick a beat after the cause.
   */
  answerTags?: Readonly<Partial<Record<string, ReadonlyArray<RailAnswerCause>>>>;
};

/**
 * THE ANSWER FLIES (PL-220 — the owner's decision 2026-10-12). The table's answer to a card action used to tick one
 * beat after the cause's touchdown — by then the workspace was dissolving and its cause, the composer's «Сработает»
 * chip, had left the screen: «+2 M€» changed with nothing on screen saying why. An owner whose surface still shows
 * the promise hands the answer's ORIGIN in: each held reaction is born on the chip that promised it (measured at the
 * launch, as painted then) and flies to its row, which ticks on the touchdown; a reaction with no chip ticks as before.
 */
export type RailAnswerFlight = {
  /** Asked at the answer's launch, per held reaction — undefined: that reaction ticks instead of flying. */
  originOf: (spec: ResourceTransferSpec) => TransferEndLike | undefined;
  /** The answer has LEFT its chips (one pop after its birth) — or ticked, or was released: the surface may let go. */
  onLeft: () => void;
};

/** WHY a rail reward was not shown as promised. */
export type RailRewardDegrade = TransferDegradeReason | 'mismatch' | 'no-origin';

export type RailRewardOutcome = 'landed' | 'degraded' | 'none';

type Entry = {
  key: string;
  /** Still held on the rail, per spec (released one by one). */
  cause: Array<ResourceTransferSpec>;
  reactions: Array<ResourceTransferSpec>;
  /** The derived points each cause token releases at its touchdown (by the spec object). */
  vp: Map<ResourceTransferSpec, number>;
  phase: 'held' | 'flying' | 'answering';
};

export const railRewardState = reactive({
  /** The rewards whose rows are still held (seeded, in the air, or waiting for their reaction's beat). */
  entries: [] as Array<Entry>,
  /** The last reward that was NOT shown as promised: whose, and why (read by its owner's surface and by the e2e probe). */
  degraded: undefined as {key: string, why: RailRewardDegrade, detail?: string} | undefined,
  /** The last ANSWER and how it arrived: the rows that flew from their chips, the rows that ticked (PL-220 — the e2e probe). */
  lastAnswer: undefined as {key: string, flown: Array<string>, ticked: Array<string>} | undefined,
});

/** The pending reaction beats (the GSAP clock), per owner key — a release kills its own and settles its promise. */
const reactionCalls = new Map<string, {call: gsap.core.Tween, settle: () => void}>();

// A reward seeded and not yet landed holds the foreground: the next prompt, the notification feed and the bot's
// turn wait for the gain's own story. Bounded by the registry's ceiling, whose `expire` releases every row honestly.
registerAnimationHoldSupplier('rail-reward', () => railRewardState.entries.length > 0, {
  diagnose: () => railRewardState.entries.map((entry) => ({
    key: entry.key, phase: entry.phase,
    cause: entry.cause.map(describe), reactions: entry.reactions.map(describe),
  })),
  expire: () => [...railRewardState.entries].forEach((entry) => releaseRailReward(entry.key, 'ceiling')),
});

function describe(spec: ResourceTransferSpec): string {
  return `${spec.channel}:${spec.resource}+${spec.amount}`;
}

const PRODUCTION_FIELDS: Readonly<Record<string, keyof PublicPlayerModel>> = {
  megacredits: 'megacreditProduction',
  steel: 'steelProduction',
  titanium: 'titaniumProduction',
  plants: 'plantProduction',
  energy: 'energyProduction',
  heat: 'heatProduction',
};
const STOCK_FIELDS: Readonly<Record<string, keyof PublicPlayerModel>> = {
  megacredits: 'megacredits',
  steel: 'steel',
  titanium: 'titanium',
  plants: 'plants',
  energy: 'energy',
  heat: 'heat',
  [RATING_RAIL_KEY]: 'terraformRating',
};

/** The viewer's value on one rail row, or undefined for a row the rail does not carry. */
function rowValue(player: PublicPlayerModel | undefined, row: string): number | undefined {
  if (player === undefined) {
    return undefined;
  }
  // A CARD's counter (`card-resource:<kind>@<card>`): the stored resources the views carry on the card itself.
  if (row.startsWith('card-resource:')) {
    const card = row.slice(row.indexOf('@') + 1);
    const model = row.includes('@') ? player.tableau.find((c) => c.name === card) : undefined;
    return model === undefined ? undefined : (model.resources ?? 0);
  }
  const [channel, resource] = row.split(':');
  const field = channel === 'production' ? PRODUCTION_FIELDS[resource] : channel === 'stock' ? STOCK_FIELDS[resource] : undefined;
  const value = field === undefined ? undefined : player[field];
  return typeof value === 'number' ? value : undefined;
}

export type RailRewardVerdict = {
  cause: Array<ResourceTransferSpec>;
  reactions: Array<ResourceTransferSpec>;
  /** The derived points held with the cause (0 when the score's own change did not agree, or none were promised). */
  vp: Array<number>;
  /** The rows whose applied change was not the promised one: `row: expected N, applied M`. */
  mismatches: Array<string>;
  /**
   * NOTHING of the cause has been applied yet — every cause row stands exactly
   * where it stood: the reward is still OWED (its question was re-asked live,
   * or another question went first and the rest is parked). Not a mismatch: the
   * owner waits for the response that pays it.
   */
  owed: boolean;
};

/** The row a spec lands on, for the diff check: a card's counter is its own row (`card-resource:floater@Aurora Station`). */
function verifyRowKey(spec: ResourceTransferSpec): string {
  return spec.channel === 'card-resource' && spec.targetCard !== undefined ?
    `${railRowKey(spec)}@${spec.targetCard}` :
    railRowKey(spec);
}

function scoreOf(player: PublicPlayerModel | undefined): number | undefined {
  const total = player?.victoryPointsBreakdown?.total;
  return typeof total === 'number' ? total : undefined;
}

/**
 * THE PROMISE AGAINST THE APPLIED VIEW (pure). Per rail row: the change the
 * response applied must be exactly the reward's own gains on that row plus the
 * moves the owner declared (`known`). A row that disagrees is NOT held — its
 * specs are dropped from the verdict and named. A reaction is the answer to a
 * cause: when any CAUSE row disagrees, nothing is held at all (an answer shown
 * arriving after a cause that was not shown is a second lie).
 */
export function verifyRailReward(reward: RailReward, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): RailRewardVerdict {
  // The cause is checked per ROW (summed) but held per TOKEN (as given): two printed icons stay two flights.
  const cause = reward.cause.filter((spec) => spec.amount > 0);
  const reactions = mergeTransferSpecs(reward.reactions);
  const was = before?.thisPlayer;
  const now = after?.thisPlayer;
  if (was === undefined || now === undefined || before?.id !== after?.id) {
    return {cause: [], reactions: [], vp: [], mismatches: ['no pair of views of one seat'], owed: false};
  }
  const promised = new Map<string, number>();
  for (const spec of [...cause, ...reactions]) {
    const row = verifyRowKey(spec);
    promised.set(row, (promised.get(row) ?? 0) + (spec.direction === 'loss' ? -spec.amount : spec.amount));
  }
  const mismatches: Array<string> = [];
  const bad = new Set<string>();
  const applied = new Map<string, number>();
  for (const [row, amount] of promised) {
    const a = rowValue(was, row);
    const b = rowValue(now, row);
    const expected = amount + (reward.known?.[row] ?? 0);
    if (a === undefined || b === undefined) {
      bad.add(row);
      mismatches.push(`${row}: not a rail row`);
    } else {
      applied.set(row, b - a);
      if (b - a !== expected) {
        bad.add(row);
        mismatches.push(`${row}: expected ${expected >= 0 ? '+' : ''}${expected}, applied ${b - a >= 0 ? '+' : ''}${b - a}`);
      }
    }
  }
  // OWED, not wrong: no row of the cause has moved by anything but the trade's own known moves — the reward has
  // not been paid in this response at all (its question stands, or waits behind another).
  const owed = cause.length > 0 && cause.every((spec) => {
    const row = verifyRowKey(spec);
    return applied.get(row) === (reward.known?.[row] ?? 0);
  });
  if (cause.some((spec) => bad.has(verifyRowKey(spec)))) {
    return {cause: [], reactions: [], vp: [], mismatches, owed};
  }
  // THE DERIVED POINTS: the score's own change must be the promised points plus the rating the reward moves (the
  // score includes the rating point for point); a score that moved otherwise holds no point and says why.
  const points = (reward.vp ?? []).reduce((sum, v) => sum + v, 0);
  let vp: Array<number> = [];
  // Held when ANY token moves points — never by the SUM: a spend off a scoring card and a landing on another
  // (TR29: Formula Zero −1, Mech Sports +1) net to zero, and the cell still dips at the departure and recovers at
  // the touchdown, because that is what happened.
  if ((reward.vp ?? []).some((v) => v !== 0)) {
    const rating = promised.get(railRowKey({channel: 'stock', resource: RATING_RAIL_KEY})) ?? 0;
    const sa = scoreOf(was);
    const sb = scoreOf(now);
    if (sa !== undefined && sb !== undefined && sb - sa === points + rating) {
      vp = cause.map((_, i) => reward.vp?.[i] ?? 0);
    } else {
      mismatches.push(`vp: expected +${points + rating}, applied ${sa === undefined || sb === undefined ? '?' : (sb - sa >= 0 ? '+' : '') + (sb - sa)}`);
    }
  }
  return {
    cause,
    reactions: reactions.filter((spec) => !bad.has(verifyRowKey(spec))),
    vp,
    mismatches,
    owed,
  };
}

/** Is the reward still OWED by this response — nothing of its cause applied yet (see `RailRewardVerdict.owed`)? Pure. */
export function railRewardOwed(reward: RailReward, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  return verifyRailReward(reward, before, after).owed;
}

function entryOf(key: string): Entry | undefined {
  return railRewardState.entries.find((entry) => entry.key === key);
}

function dropEntry(key: string): void {
  railRewardState.entries = railRewardState.entries.filter((entry) => entry.key !== key);
}

function noteDegrade(key: string, why: RailRewardDegrade, detail?: string): void {
  railRewardState.degraded = {key, why, ...(detail !== undefined ? {detail} : {})};
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[rail-reward] ${key}: not shown as promised — ${why}${detail !== undefined ? ` (${detail})` : ''}`);
  }
}

/** Release ONE held spec of an entry (idempotent per spec: a spec leaves the entry as it is released) — and the points it carried. */
function releaseSpec(list: Array<ResourceTransferSpec>, spec: ResourceTransferSpec, vp?: Map<ResourceTransferSpec, number>): void {
  // The very object first (a token's own spec), else the first of the same row (a spec re-built by a caller).
  let index = list.indexOf(spec);
  if (index === -1) {
    index = list.findIndex((held) => held.channel === spec.channel && held.resource === spec.resource &&
      held.targetCard === spec.targetCard && (held.direction ?? 'gain') === (spec.direction ?? 'gain'));
  }
  if (index === -1) {
    return;
  }
  const [held] = list.splice(index, 1);
  releasePanelRewardHold(held);
  const points = vp?.get(held) ?? 0;
  if (points !== 0) {
    vp?.delete(held);
    releasePanelVpHold(points);
  }
}

/**
 * SEED — called from the transport's apply block, by the owner's own seeder,
 * ONLY when somebody will play the flight (a hold nobody releases is the one
 * thing this module must never create). Verifies the promise against the two
 * views and holds what verified. Returns whether anything is held.
 */
export function seedRailReward(key: string, reward: RailReward, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  releaseRailReward(key, 're-seed');
  if (railRewardState.degraded?.key === key) {
    railRewardState.degraded = undefined;
  }
  if (consoleReducedMotionActive()) {
    return false;
  }
  const verdict = verifyRailReward(reward, before, after);
  // THE SEED'S VERDICT, in the flights' own trail (T09, decision 8): «held» or WHY not — the rows that moved otherwise,
  // or «owed» (nothing of the cause applied yet) — so a report from the field names the refusal beside the flights.
  noteTransferTrail('rail:seed', {
    key, verdict: verdict.cause.length > 0 ? 'held' : verdict.owed ? 'owed' : 'refused',
    ...(verdict.mismatches.length > 0 ? {mismatches: verdict.mismatches} : {}),
  });
  if (verdict.mismatches.length > 0) {
    noteDegrade(key, 'mismatch', verdict.mismatches.join('; '));
  }
  if (verdict.cause.length === 0) {
    return false;
  }
  beginPanelRewardHold([...verdict.cause, ...verdict.reactions]);
  const vp = new Map<ResourceTransferSpec, number>();
  verdict.cause.forEach((spec, i) => {
    const points = verdict.vp[i] ?? 0;
    if (points !== 0) {
      vp.set(spec, points);
      beginPanelVpHold(points);
      // The score cell's ledger nets these points out of the card's share — this token brings them (TR55).
      if (spec.targetCard !== undefined) {
        noteVpHeldElsewhere({kind: 'card', card: spec.targetCard}, points);
      }
    }
  });
  railRewardState.entries.push({key, cause: verdict.cause, reactions: verdict.reactions, vp, phase: 'held'});
  return true;
}

/** A reward of `key` is seeded and has not fully landed. */
export function railRewardPending(key: string): boolean {
  return entryOf(key) !== undefined;
}

/** A reward of `key` still holds a TABLE'S ANSWER — what an owner offering `RailAnswerFlight` asks before it waits for one. */
export function railRewardHoldsAnswer(key: string): boolean {
  return (entryOf(key)?.reactions.length ?? 0) > 0;
}

/**
 * FLY — the owner's scene calls it when its object has ANSWERED (the impulse
 * sat on the printed icon). `originOf` is asked per cause spec for the point
 * the token is born on — a MEASURED node of the paying object; `undefined`
 * degrades that token by name (its row ticks at once). Resolves when every
 * row of the reward has ticked: the cause on its touchdowns, the reactions one
 * beat of the animation clock after the last of them.
 */
export function flyRailReward(
  key: string,
  originOf: (spec: ResourceTransferSpec, index: number) => TransferEndLike | undefined,
  answer?: RailAnswerFlight,
  /** Every token of the cause has LEFT its origin (popped or never born) — the owner's surface may fold now. */
  onLeft?: () => void,
  /** The wave's tempo (`ResourceTransferRun.pace` — the generation scene's hook token flies at the featured pace). */
  opts: {pace?: number} = {},
): Promise<RailRewardOutcome> {
  const entry = entryOf(key);
  if (entry === undefined || entry.phase !== 'held') {
    onLeft?.();
    answer?.onLeft();
    return Promise.resolve('none');
  }
  entry.phase = 'flying';
  const specs = [...entry.cause];
  const origins = specs.map((spec, index) => originOf(spec, index));
  let degraded = false;
  origins.forEach((origin, index) => {
    if (origin === undefined) {
      degraded = true;
      noteDegrade(key, 'no-origin', describe(specs[index]));
    }
  });
  return runResourceTransfers({
    specs,
    source: {},
    origins,
    arrival: 'auto',
    ...(opts.pace !== undefined ? {pace: opts.pace} : {}),
    ...(onLeft !== undefined ? {onLeft} : {}),
    onArrive: (spec) => {
      const live = entryOf(key);
      if (live !== undefined) {
        releaseSpec(live.cause, spec, live.vp);
      }
    },
    onDegrade: (spec, why) => {
      // A token with no origin was named above — the framework reports it as «no source» again.
      if (!(why === 'no-source' && origins[specs.indexOf(spec)] === undefined)) {
        noteDegrade(key, why, describe(spec));
      }
      degraded = true;
    },
  }).then(() => answerRailReward(key, answer)).then(() => (degraded ? 'degraded' : 'landed'));
}

/**
 * FLY ONE LINK — a PART of the held cause, for an owner whose reward is a
 * TIMELINE (TR28's «[fighter] , −2 [fighter] : [TR]»: the fighter lands, then
 * two leave the card, then the TR is born). Each token of `specs` (the held
 * spec objects) is released on its own touchdown — a LOSS on its departure,
 * the transfer language's own law — and the entry stays held for the rest; the
 * table's answer waits for `flyRailReward`, which flies whatever is left and
 * answers after it. `destination` — an explicit point the link's tokens land on
 * (a loss is born there): the capsule of a card standing in the owner's own
 * surface, which the transfer framework's address ladder does not know.
 */
export function flyRailRewardLink(
  key: string,
  specs: ReadonlyArray<ResourceTransferSpec>,
  originOf: (spec: ResourceTransferSpec, index: number) => TransferEndLike | undefined,
  opts: {
    destination?: TransferEndLike, destinationOf?: (spec: ResourceTransferSpec) => TransferEndLike | undefined, absorb?: 'quick',
    onLeft?: () => void,
    /** Every token of the link has been ABSORBED at its destination (or never flew) — the owner's «the card received it». */
    onAbsorbed?: () => void,
  } = {},
): Promise<RailRewardOutcome> {
  const entry = entryOf(key);
  const held = entry === undefined ? [] : specs.filter((spec) => entry.cause.includes(spec));
  if (entry === undefined || entry.phase !== 'held' || held.length === 0) {
    opts.onLeft?.();
    opts.onAbsorbed?.();
    return Promise.resolve('none');
  }
  entry.phase = 'flying';
  const origins = held.map((spec, index) => originOf(spec, index));
  let degraded = false;
  origins.forEach((origin, index) => {
    if (origin === undefined) {
      degraded = true;
      noteDegrade(key, 'no-origin', describe(held[index]));
    }
  });
  return runResourceTransfers({
    specs: held,
    source: {},
    origins,
    arrival: 'auto',
    ...(opts.destination !== undefined ? {destination: opts.destination} : {}),
    // Two tokens of one link may land on two different cards the surface shows (TR44: the hero's capsule and a
    // chosen card's miniature) — each spec names its own touchdown.
    ...(opts.destinationOf !== undefined ? {destinationOf: (spec: ResourceTransferSpec) => opts.destinationOf?.(spec)} : {}),
    ...(opts.absorb !== undefined ? {absorb: opts.absorb} : {}),
    // The link's destinations are the card's own capsule on the surface (the hero's, a composer row's miniature): a
    // double of the spec's home — gone on the final approach, the token re-homes there (T06), never into the old pose.
    homeStandIn: true,
    ...(opts.onLeft !== undefined ? {onLeft: opts.onLeft} : {}),
    ...(opts.onAbsorbed !== undefined ? {onAbsorbed: opts.onAbsorbed} : {}),
    onArrive: (spec) => {
      const live = entryOf(key);
      if (live !== undefined) {
        releaseSpec(live.cause, spec, live.vp);
      }
    },
    onDegrade: (spec, why) => {
      if (!(why === 'no-source' && origins[held.indexOf(spec)] === undefined)) {
        noteDegrade(key, why, describe(spec));
      }
      degraded = true;
    },
  }).then(() => {
    const live = entryOf(key);
    if (live !== undefined) {
      // Whatever of this link the wave left held (it never does — the framework's safety releases every spec).
      held.filter((spec) => live.cause.includes(spec)).forEach((spec) => releaseSpec(live.cause, spec, live.vp));
      live.phase = 'held';
    }
    return degraded ? 'degraded' : 'landed';
  });
}

/**
 * THE ANSWER AFTER THE CAUSE: one beat of the animation clock after the last
 * touchdown the reactions' rows tick — a separate tick from the cause's own,
 * never before it. With an `answer` flight (PL-220) the reactions whose chip
 * is on screen are BORN there at that beat and tick on their own touchdowns;
 * the rest tick at the beat as before. A killed beat (an interrupt released the
 * entry) resolves all the same — and lets the surface go: nothing here can hang.
 */
function answerRailReward(key: string, answer?: RailAnswerFlight): Promise<void> {
  const entry = entryOf(key);
  if (entry === undefined) {
    answer?.onLeft();
    return Promise.resolve();
  }
  // Whatever the wave left held (it never does — the framework's safety releases every spec) goes first.
  [...entry.cause].forEach((spec) => releaseSpec(entry.cause, spec, entry.vp));
  if (entry.reactions.length === 0) {
    dropEntry(key);
    answer?.onLeft();
    return Promise.resolve();
  }
  entry.phase = 'answering';
  return new Promise<void>((resolve) => {
    const settle = () => {
      answer?.onLeft();
      resolve();
    };
    const call = gsap.delayedCall(motionMs(TOUCHDOWN_TICK_GAP_MS) / 1000, () => {
      reactionCalls.delete(key);
      const live = entryOf(key);
      if (live === undefined) {
        settle();
        return;
      }
      const launch = answer === undefined ? [] : live.reactions
        .map((spec) => ({spec, origin: answer.originOf(spec)}))
        .filter((f): f is {spec: ResourceTransferSpec, origin: TransferEndLike} => f.origin !== undefined);
      const flown = launch.map((f) => f.spec);
      const ticked = live.reactions.filter((spec) => !flown.includes(spec));
      railRewardState.lastAnswer = {key, flown: flown.map(railRowKey), ticked: ticked.map(railRowKey)};
      ticked.forEach((spec) => releaseSpec(live.reactions, spec));
      if (launch.length === 0) {
        dropEntry(key);
        settle();
        return;
      }
      // The tokens POP out of their chips first: the surface the chips stand on is let go once EVERY token has left
      // it (the run's own `onLeft` — T06: a clock beside a staggered wave let the surface go under the later births),
      // and the rows tick on the touchdowns, the answer's own rhythm.
      void runResourceTransfers({
        specs: flown,
        source: {},
        origins: launch.map((f) => f.origin),
        arrival: 'auto',
        onLeft: () => answer?.onLeft(),
        onArrive: (spec) => {
          const now = entryOf(key);
          if (now !== undefined) {
            releaseSpec(now.reactions, spec);
          }
        },
        onDegrade: (spec, why) => noteDegrade(key, why, describe(spec)),
      }).then(() => {
        const now = entryOf(key);
        if (now !== undefined) {
          [...now.reactions].forEach((spec) => releaseSpec(now.reactions, spec));
          dropEntry(key);
        }
        resolve();
      });
    });
    // A release from outside kills the beat — it settles the promise itself (a killed call fires nothing).
    reactionCalls.set(key, {call, settle});
  });
}

/**
 * RELEASE — an interrupt (the owner's surface left, its scene ended early, the
 * ceiling): every row the reward still holds ticks at once, honestly late and
 * never lost. A token already in the air lands on a row that has ticked. Idempotent.
 */
export function releaseRailReward(key: string, why: string): void {
  const entry = entryOf(key);
  if (entry === undefined) {
    return;
  }
  const pending = reactionCalls.get(key);
  reactionCalls.delete(key);
  [...entry.cause].forEach((spec) => releaseSpec(entry.cause, spec, entry.vp));
  [...entry.reactions].forEach((spec) => releaseSpec(entry.reactions, spec));
  dropEntry(key);
  pending?.call.kill();
  pending?.settle();
  if (process.env.NODE_ENV !== 'production' && why !== 're-seed') {
    console.warn(`[rail-reward] ${key}: released before its flight had finished — ${why}`);
  }
}

export type RailRewardDiag = {
  pending: Array<{key: string, phase: string, cause: Array<string>, reactions: Array<string>}>,
  degraded: {key: string, why: string, detail?: string} | undefined,
  lastAnswer: {key: string, flown: Array<string>, ticked: Array<string>} | undefined,
};

/** The rewards still held, the last one that was not shown as promised and how the last answer arrived — one snapshot for a diagnostic (`window.__conReady().railReward`). */
export function railRewardDiag(): RailRewardDiag {
  const answer = railRewardState.lastAnswer;
  return {
    pending: railRewardState.entries.map((entry) => ({key: entry.key, phase: entry.phase, cause: entry.cause.map(describe), reactions: entry.reactions.map(describe)})),
    degraded: railRewardState.degraded === undefined ? undefined : {...railRewardState.degraded},
    lastAnswer: answer === undefined ? undefined : {key: answer.key, flown: [...answer.flown], ticked: [...answer.ticked]},
  };
}

/** Test-only reset. */
export function resetRailRewards(): void {
  [...railRewardState.entries].forEach((entry) => releaseRailReward(entry.key, 're-seed'));
  reactionCalls.forEach((pending) => {
    pending.call.kill();
    pending.settle();
  });
  reactionCalls.clear();
  railRewardState.entries = [];
  railRewardState.degraded = undefined;
  railRewardState.lastAnswer = undefined;
}
