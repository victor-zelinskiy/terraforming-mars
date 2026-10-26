/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE FIRST ACTION'S RAIL HALF — the start stage «СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ» as the THIRD
 * ATTACHED host of «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» (TR81 Lotus Innovations, 2026-10-26; contract
 * `docs/claude/console/card-reaction.md`; the owner's decision 3).
 *
 * A corporation's first action that pays the rail (Lotus Innovations: «+2 TR») used to TICK with the commit — no
 * cause on screen — and the table's answer to it (Lotus' own «+2 [data]», «including from this») went to the
 * STANDALONE chain: the corporation surfaced at a seat beside the rail while its own card stood on the start stage
 * (law 3: a card standing on a stage comes forward OUT OF ITS PLACE). So the first action carries a rail half of its
 * own, the hero's and the action commit's shape:
 *
 *   ARM    — the stage's A (`performFirstAction`) builds the half off the briefing's own preview, pinned at the press
 *            (the chips the stage showed — `railRewardSpecs`; the table's answer — the forecast's exact facts addressed
 *            to the viewer, a card resource on its host card included);
 *   SEED   — the transport's apply block (`gameTransport.seedRewardHolds`, before the card-reaction seeder): the rail
 *            module checks the promise against the two views and holds the rows — and DECLARES the answer, so the
 *            reaction seeder ATTACHES the reactor's record to this host instead of queueing it standalone;
 *   FLY    — the stage plays it: each printed TR plate of the first action births its own token into the score cell
 *            (two plates, two tokens — the cause), then the reactor rises OUT OF ITS SEAT on the stage, its tokens are
 *            born on its printed effect row and land in its own capsule, ticking on each touchdown, and it settles
 *            back; the cause (the rating that just ticked) wears the one-shot kant.
 *
 * Honesties: nothing is held when the views do not bear the promise out (named by the rail module); a view applied
 * BEFORE the paying one keeps the half armed (owed); reduced motion holds nothing; the stage's completion barrier
 * waits for the half (`firstActionRailBusy`) — a notification-only reaction, never a question.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {RATING_RAIL_KEY, ResourceTransferSpec, TransferEndLike, mergeTransferSpecs, railRewardSpecs, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {RailAnswerFlight, RailReward, flyRailReward, railRewardOwed, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {reactionRailSpecs} from '@/client/console/colonyTrade/fleetDockModel';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/** One armed half: the corporation whose first action pays it, the rail reward, its key. */
export type FirstActionRail = {key: string, corp: CardName, reward: RailReward};

export type FirstActionRailPhase = 'idle' | 'armed' | 'seeded' | 'flying';

export const firstActionRailState = reactive({
  /** The corporation whose half is armed / held / in the air ('' when none). */
  corp: '' as string,
  phase: 'idle' as FirstActionRailPhase,
  /** Why the last half ended ('' after a full flight) — diagnostics and the e2e probe. */
  lastEnd: '',
  /** Halves flown since load — the probe's liveness witness. */
  flown: 0,
});

let armed: FirstActionRail | undefined;
let seeded: FirstActionRail | undefined;

/**
 * THE TABLE'S CARD ANSWER — an exact fact addressed to the viewer that lays a card resource on a NAMED host (the
 * chip's `host`, stamped by the server: Lotus Innovations' «+2 [data]» on itself): a capsule row of the rail reward.
 * A gain with no host (a target still to be chosen) is no promise of a row.
 */
export function cardAnswerSpecs(facts: ReadonlyArray<EffectForecastFact> | undefined): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const fact of facts ?? []) {
    if (fact.certainty !== 'exact' || fact.recipient.kind !== 'you') {
      continue;
    }
    for (const e of fact.effects) {
      if (e.direction === 'gain' && e.amount > 0 && e.host !== undefined && e.unit === undefined) {
        out.push({channel: 'card-resource', resource: e.icon, amount: e.amount, targetCard: e.host as CardName});
      }
    }
  }
  return mergeTransferSpecs(out);
}

/**
 * THE HALF (pure): the first action's own rail gains as the CAUSE — a rating gain split into ONE TOKEN PER STEP
 * (the corporation prints its steps as plates: two plates, two tokens, each ticking on its own touchdown) — and the
 * table's answer as the REACTIONS (its rail rows and its capsule rows). Undefined when the action pays the rail
 * nothing: the stage keeps its old phrase (a draw, a placement — their own scenes).
 */
export function firstActionRailOf(corp: CardName, branch: ActionPreviewBranch | undefined, forecast: EffectForecast | undefined): FirstActionRail | undefined {
  if (branch === undefined) {
    return undefined;
  }
  const cause: Array<ResourceTransferSpec> = [];
  for (const spec of railRewardSpecs(branch.effects)) {
    if (spec.channel === 'stock' && spec.resource === RATING_RAIL_KEY && spec.amount > 1) {
      for (let i = 0; i < spec.amount; i++) {
        cause.push({...spec, amount: 1});
      }
    } else {
      cause.push(spec);
    }
  }
  if (cause.length === 0) {
    return undefined;
  }
  const facts = forecast?.facts;
  const reactions = mergeTransferSpecs([...reactionRailSpecs(facts), ...cardAnswerSpecs(facts)]);
  return {key: `first-action:${corp}`, corp, reward: {cause, reactions}};
}

/** ARM — at the stage's press: the half waits for the view that pays it. */
export function armFirstActionRail(rail: FirstActionRail | undefined): void {
  if (rail === undefined) {
    return;
  }
  if (seeded !== undefined) {
    endHalf('superseded');
  }
  armed = rail;
  firstActionRailState.corp = rail.corp;
  firstActionRailState.phase = 'armed';
  firstActionRailState.lastEnd = '';
}

/** The rows the half holds as the table's answer — the card-reaction director's join key. */
function answerRows(rail: FirstActionRail): Array<string> {
  return [...new Set(rail.reward.reactions.map((spec) => railRowKey(spec)))];
}

/**
 * SEED — from the transport's apply block, BEFORE the card-reaction seeder (which then finds the reactor's rows held
 * and declared by this host). A view that paid nothing of the promise yet keeps the half armed.
 */
export function seedFirstActionRail(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const rail = armed;
  if (rail === undefined) {
    return;
  }
  if (railRewardOwed(rail.reward, before, after)) {
    noteTransferTrail('rail:seed', {key: rail.key, verdict: 'owed — waiting for the paying view'});
    return;
  }
  armed = undefined;
  if (!seedRailReward(rail.key, rail.reward, before, after)) {
    resetHalf('not held');
    return;
  }
  seeded = rail;
  firstActionRailState.phase = 'seeded';
}

/** The half holds the rail or flies — the stage's completion barrier waits for it. */
export function firstActionRailBusy(): boolean {
  const phase = firstActionRailState.phase;
  if (phase === 'flying') {
    return true;
  }
  // A seeded half the registry's ceiling (or a foreign release) already let go is over.
  return phase === 'seeded' && seeded !== undefined && railRewardPending(seeded.key);
}

function resetHalf(why: string): void {
  if (firstActionRailState.phase !== 'idle') {
    noteTransferTrail('rail:end', {card: firstActionRailState.corp, phase: firstActionRailState.phase, why: why === '' ? 'flown' : why});
  }
  firstActionRailState.corp = '';
  firstActionRailState.phase = 'idle';
  firstActionRailState.lastEnd = why;
  seeded = undefined;
}

function endHalf(why: string): void {
  const rail = seeded;
  armed = undefined;
  resetHalf(why);
  if (rail !== undefined) {
    releaseRailReward(rail.key, why);
  }
}

/** An interrupt (the stage left, a reload, a teardown): whatever is still held ticks now — honestly late, never lost. */
export function releaseFirstActionRail(why: string): void {
  if (firstActionRailState.phase === 'idle' && armed === undefined) {
    return;
  }
  endHalf(why);
}

export type FirstActionFlight = {
  /** The birth place of the k-th cause token — the corporation's k-th printed plate of that gain. */
  originOf: (spec: ResourceTransferSpec, index: number) => TransferEndLike | undefined;
  /** The table's answer flight (the card-reaction director's, composed by the stage) — undefined: the answer ticks. */
  answer?: RailAnswerFlight;
};

/** FLY — the stage plays the seeded half. Resolves once every token has touched down (or ticked) and the answer is done. */
export async function flyFirstActionRail(flight: (rows: ReadonlyArray<string>) => FirstActionFlight): Promise<void> {
  const rail = seeded;
  if (rail === undefined || firstActionRailState.phase !== 'seeded') {
    return;
  }
  firstActionRailState.phase = 'flying';
  try {
    const {originOf, answer} = flight(answerRows(rail));
    await flyRailReward(rail.key, originOf, answer);
    firstActionRailState.flown++;
  } finally {
    if (seeded === rail) {
      resetHalf('');
    }
  }
}

/** Test-only reset. */
export function resetFirstActionRail(): void {
  armed = undefined;
  seeded = undefined;
  firstActionRailState.corp = '';
  firstActionRailState.phase = 'idle';
  firstActionRailState.lastEnd = '';
  firstActionRailState.flown = 0;
}
