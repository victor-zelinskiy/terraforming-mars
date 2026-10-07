/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ДЕЛЕГАТЫ» — the PURE half of a card's RALLY OF NEUTRAL DELEGATES (Turmoil
 * Redux TR31 Nationalist Movement, docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md):
 * what the play PROMISED, what the answer CARRIED, who is to PLAY it, and the
 * DISPLAY HOLDS its beats consume. The sibling of `agendaWalk.ts` (TR04) —
 * the same five steps, one function each:
 *
 *  1. THE PROMISE (`promiseNeutralRally`, at A): the preview's `neutralRally`
 *     SHOW step says cubes will be placed and a recount paid — the hand the
 *     card is played from OWES that step (`owed-step`) until the record
 *     arrives. The play's own price rides along (`known`) for the rail's diff
 *     check: the M€ row moves by the recount AND the price in one response.
 *  2. THE DETECT + THE SEED (`seedNeutralRallyHolds`, in the SAME synchronous
 *     block as the view apply — the sitting's own law): the viewer's
 *     `lastRally` with a grown serial → a host (the hand's descent, an open
 *     Parliament, nobody) → the holds. Every new ribbon cube HIDDEN
 *     (`parliamentHolds.hiddenCubes`, the law of the sitting and the rival's
 *     arrival), every plaque at its OLD count (`supportIncoming`), the pool
 *     at its old count (`poolHeld` — it drops on each LIFT-OFF), the WINNING
 *     marker where it stood (`winnerShown` — it moves on the touchdown of the
 *     cube that moved it, decision 6), and the rail's M€ row held for the
 *     whole recount (`railReward` — the price known). Reduced motion holds
 *     nothing: the poses are final at once.
 *  3. THE ENTRANCE — the shell's (`enterHostedParliamentStep('rally')`).
 *  4. THE POSE — the section's (`openRallyFlow`), the beats the director's
 *     (`neutralRallyDirector.ts`): VOTES → SUPPORT → the RECOUNT → the COIN →
 *     the read. Each touchdown releases exactly its own hold through the
 *     functions below.
 *  5. THE END — the shell's (`endHandWithHostedStep`); the conclusion reads
 *     `neutralRallyOwedTo` / `neutralRallyLiveIn`.
 *
 * Pure + a reactive record: no DOM, no i18n, no timers.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentRallyModel, ParliamentRallySupportModel, ParliamentRallyVoteModel} from '@/common/models/ParliamentModel';
import {ReduxParty, ResolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {workspaceFrameDescended, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {parliamentHolds} from './parliamentDisplayHolds';

/** WHO PLAYS the rally: the hand that hosts the Parliament as a step, or a Parliament standing on its own. */
export type NeutralRallyHost = 'hand' | 'parliament';

/** The rally the answer carried for the viewer's own card, and who is to play it. */
export type OwedNeutralRally = ParliamentRallyModel & {host: NeutralRallyHost};

/** The beats of the pose, in order ('' before the pose opens). */
export type NeutralRallyBeat = '' | 'votes' | 'support' | 'count' | 'coin' | 'read' | 'done';

/** The rail reward's owner key — the M€ row held from the answer to the coin's touchdown. */
export const NEUTRAL_RALLY_RAIL_KEY = 'neutral-rally';

/** The recount's key of ONE neutral vote on the ribbon (`instance#seq`, as the hidden-cube law spells it). */
export function rallyVoteKey(instance: ResolutionInstanceId, seq: number): string {
  return `v:${instance}#${seq}`;
}

/** …and of ONE place of a party's support area (1-based, the plaque's own numbering). */
export function rallyPlaceKey(party: ReduxParty, place: number): string {
  return `s:${party}#${place}`;
}

function freshFlow() {
  return {
    promised: undefined as {card: CardName, host: NeutralRallyHost, known: Readonly<Record<string, number>>} | undefined,
    owed: undefined as OwedNeutralRally | undefined,
    live: false,
    beat: '' as NeutralRallyBeat,
    /** The votes LANDED so far, in order — the band grows a chip per touchdown. */
    landedVotes: [] as Array<ParliamentRallyVoteModel>,
    /** The areas READ so far — a cube landed, or the named zero shown on the plaque. */
    readSupport: [] as Array<ParliamentRallySupportModel>,
    /** The recount's marks so far (`rallyVoteKey` / `rallyPlaceKey`) and the number the kicker shows. */
    marked: new Set<string>(),
    counted: 0,
    /** Pool cubes the bench STILL PAINTS AND COUNTS (each lift-off takes one). */
    poolHeld: 0,
    /** Per party: cubes the plaque does NOT draw yet (each touchdown lands one). */
    supportIncoming: new Map<ReduxParty, number>(),
    /** THE WINNING MARKER as shown — where it stood before the first cube; moved by the touchdown of the cube that moved it. */
    winnerShown: undefined as {instance: ResolutionInstanceId | undefined} | undefined,
    /** Why a flight could not be flown ('' when every one flew) — CONFESSED on the section root, never silent. */
    degraded: '',
  };
}

export const neutralRallyFlow = reactive(freshFlow());

export function resetNeutralRallyFlow(): void {
  Object.assign(neutralRallyFlow, freshFlow());
}

// ── the promise (the press) ────────────────────────────────────────────────

/**
 * The play's preview says cubes will be placed and a recount paid: the flow
 * owes that step until the record arrives. `known` — the response's OTHER
 * moves on the rail's rows (the play's own price), so the seed's diff check
 * can tell the recount's M€ from the price paid in the same answer.
 */
export function promiseNeutralRally(card: CardName, host: NeutralRallyHost, known: Readonly<Record<string, number>> = {}): void {
  neutralRallyFlow.promised = {card, host, known};
}

/** The play was refused, or the answer carried no record: nothing is owed. */
export function dropNeutralRallyPromise(): void {
  neutralRallyFlow.promised = undefined;
}

// ── the detect and the seed (the SAME synchronous block as the view apply) ──

function parliamentOf(view: PlayerViewModel | undefined): ParliamentModel | undefined {
  return view?.game.parliament;
}

/**
 * DETECT (pure): the rally THIS response carries for the viewer's OWN card —
 * a record of the viewer's whose serial grew. `undefined` from a first view
 * (a reload has nothing to move from), for a rival's card (the rival module
 * plays theirs), and for an echo frame.
 */
export function detectNeutralRally(before: PlayerViewModel | undefined, after: PlayerViewModel): ParliamentRallyModel | undefined {
  const rally = parliamentOf(after)?.lastRally;
  const viewer = after.thisPlayer?.color;
  if (rally === undefined || rally.player !== viewer) {
    return undefined;
  }
  const was = parliamentOf(before)?.lastRally;
  if (before === undefined || (was !== undefined && was.seq >= rally.seq)) {
    return undefined;
  }
  return rally;
}

/**
 * WHO WOULD PLAY a rally that arrives now — read off the stack: the hand the
 * card was played from, with its descent standing; else a Parliament already
 * open on its own; else nobody. The same reading as the walk's.
 */
export function neutralRallyHostFor(): NeutralRallyHost | undefined {
  if (workspaceFrameDescended('hand')) {
    return 'hand';
  }
  if (workspaceFrameKnown('parliament')) {
    return 'parliament';
  }
  return undefined;
}

/**
 * SEED — the holds of the answer, in the SAME synchronous block that applies
 * the view: the new ribbon cubes hidden, the plaques and the pool at their old
 * counts, the winning marker where it stood, the M€ row held — but ONLY when
 * somebody is there to play it. Reduced motion holds nothing.
 */
export function seedNeutralRallyHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  const rally = detectNeutralRally(before, after);
  if (rally === undefined) {
    return;
  }
  // The promise is kept, whoever plays it: the record IS the answer.
  const promise = neutralRallyFlow.promised;
  neutralRallyFlow.promised = undefined;
  const host = neutralRallyHostFor();
  if (host === undefined || consoleReducedMotionActive()) {
    return;
  }
  releaseNeutralRallyHolds('re-seed');
  const flow = neutralRallyFlow;
  for (const vote of rally.votes) {
    parliamentHolds.hiddenCubes.add(`${vote.instance}#${vote.seq}`);
  }
  const incoming = new Map<ReduxParty, number>();
  let landing = 0;
  for (const entry of rally.support) {
    if (entry.gained > 0) {
      incoming.set(entry.party, entry.gained);
      landing += entry.gained;
    }
  }
  flow.supportIncoming = incoming;
  flow.poolHeld = rally.votes.length + landing;
  flow.winnerShown = {instance: rally.winnerBefore};
  if (rally.megacredits > 0) {
    // The M€ of the recount, held on the rail until the coin lands; the play's own price is the known move
    // of the same response (PL-001 for plays — the price is charged with the landing, the gain with its cause).
    seedRailReward(NEUTRAL_RALLY_RAIL_KEY, {
      cause: [{channel: 'stock', resource: 'megacredits', amount: rally.megacredits}],
      reactions: [],
      known: promise?.known ?? {},
    }, before, after);
  }
  flow.owed = {...rally, host};
  flow.live = false;
  flow.beat = '';
  flow.landedVotes = [];
  flow.readSupport = [];
  flow.marked = new Set();
  flow.counted = 0;
  flow.degraded = '';
}

// ── what the beats release, one touchdown at a time ────────────────────────

/** A cube LIFTED off the pool (its proxy stands over it): the bench stops painting it. */
export function rallyCubeLifted(): void {
  neutralRallyFlow.poolHeld = Math.max(0, neutralRallyFlow.poolHeld - 1);
}

/** A neutral vote LANDED on its ribbon place: the cube shows, the tally ticks, and the winning marker moves if THIS cube moved it. */
export function rallyVoteLanded(vote: ParliamentRallyVoteModel): void {
  const flow = neutralRallyFlow;
  parliamentHolds.hiddenCubes.delete(`${vote.instance}#${vote.seq}`);
  flow.landedVotes = [...flow.landedVotes, vote];
  if (flow.winnerShown !== undefined && flow.winnerShown.instance !== vote.winnerAfter) {
    flow.winnerShown = {instance: vote.winnerAfter};
  }
}

/** A support cube LANDED on its plaque's place: the plaque draws it. */
export function rallySupportLanded(entry: ParliamentRallySupportModel): void {
  const flow = neutralRallyFlow;
  const left = (flow.supportIncoming.get(entry.party) ?? 0) - 1;
  const next = new Map(flow.supportIncoming);
  if (left <= 0) {
    next.delete(entry.party);
  } else {
    next.set(entry.party, left);
  }
  flow.supportIncoming = next;
  if (left <= 0 && !flow.readSupport.some((s) => s.party === entry.party)) {
    flow.readSupport = [...flow.readSupport, entry];
  }
}

/** An area that took NOTHING has been READ (the named zero shown on its plaque for a beat). */
export function rallySupportRead(entry: ParliamentRallySupportModel): void {
  const flow = neutralRallyFlow;
  if (!flow.readSupport.some((s) => s.party === entry.party)) {
    flow.readSupport = [...flow.readSupport, entry];
  }
}

/** The recount MARKED one more cube: the kicker's number grows by one (a task per tick — the director's clock). */
export function rallyCounted(key: string): void {
  const flow = neutralRallyFlow;
  if (flow.marked.has(key)) {
    return;
  }
  const next = new Set(flow.marked);
  next.add(key);
  flow.marked = next;
  flow.counted = next.size;
}

/** Every hold this flow seeded, released at once (the flow ends, the section unmounts, the motion is cut). */
export function releaseNeutralRallyHolds(why: string): void {
  const flow = neutralRallyFlow;
  for (const vote of flow.owed?.votes ?? []) {
    parliamentHolds.hiddenCubes.delete(`${vote.instance}#${vote.seq}`);
  }
  releaseRailReward(NEUTRAL_RALLY_RAIL_KEY, why);
  const promised = flow.promised;
  Object.assign(flow, freshFlow());
  flow.promised = promised;
}

// ── what the tiers read ────────────────────────────────────────────────────

/** The pool cubes the bench still paints and counts above the model (0 outside a rally). */
export function rallyPoolHeld(): number {
  return neutralRallyFlow.owed === undefined ? 0 : neutralRallyFlow.poolHeld;
}

/** The cubes of `party`'s area the plaque does not draw yet (0 outside a rally). */
export function rallySupportIncoming(party: ReduxParty): number {
  return neutralRallyFlow.owed === undefined ? 0 : (neutralRallyFlow.supportIncoming.get(party) ?? 0);
}

/** THE WINNING MARKER as the rally shows it — `undefined` outside a rally (the live model answers then). */
export function rallyWinnerShown(): {instance: ResolutionInstanceId | undefined} | undefined {
  return neutralRallyFlow.owed === undefined ? undefined : neutralRallyFlow.winnerShown;
}

/**
 * A plaque's reading while the rally plays (the support-area mode's own row — TR12's `pick`): the area's
 * `current → resulting` for a party that takes a cube, its NAMED ZERO (the room's reason) for one that
 * takes none — shown only once that area's beat has been reached, never ahead of it. `undefined` for every
 * other party and outside the rally.
 */
export function rallySupportReading(party: ReduxParty): {current: number, resulting: number, available: boolean, reason?: string} | undefined {
  const flow = neutralRallyFlow;
  if (flow.owed === undefined || !flow.live) {
    return undefined;
  }
  const entry = flow.readSupport.find((s) => s.party === party);
  if (entry === undefined) {
    return undefined;
  }
  if (entry.gained > 0) {
    return {current: entry.current, resulting: entry.resulting, available: true};
  }
  // The named zero in the glossary's own words (§ 9 / 9-ter): «+0 · область заполнена» / «+0 · нейтральных не осталось».
  return {current: entry.current, resulting: entry.resulting, available: false, reason: entry.limit === 'supply' ? RALLY_ZERO_SUPPLY_KEY : RALLY_ZERO_AREA_KEY};
}

/** The plaque's named zero of an area the rally reached and could not pay — the forecast's tail, in the quiet register. */
export const RALLY_ZERO_AREA_KEY = '+0 · the area is full';
export const RALLY_ZERO_SUPPLY_KEY = '+0 · no neutral delegates left';

/** The recount has marked this cube / place (the voting area's and the plaques' `--counted` mark). */
export function rallyMarked(key: string): boolean {
  return neutralRallyFlow.marked.has(key);
}

/** How many of `party`'s places the recount has marked so far (the plaque's counted places, from the first). */
export function rallyCountedPlaces(party: ReduxParty): number {
  let n = 0;
  for (const key of neutralRallyFlow.marked) {
    if (key.startsWith(`s:${party}#`)) {
      n++;
    }
  }
  return n;
}

// ── what the workspace's conclusion reads ──────────────────────────────────

/**
 * A rally this workspace OWES is not on screen yet: the play promised one and
 * the record has not come, or it came and its host has not opened the pose
 * (the landing ritual is still playing). The conclusion's `owed-step`.
 */
export function neutralRallyOwedTo(host: NeutralRallyHost): boolean {
  const flow = neutralRallyFlow;
  return (flow.promised?.host === host && flow.owed === undefined) ||
    (flow.owed?.host === host && !flow.live);
}

/** The rally is PLAYING inside this workspace — a cube in the air, the recount, the coin, the read: the conclusion's `live-outcome`. */
export function neutralRallyLiveIn(host: NeutralRallyHost): boolean {
  const flow = neutralRallyFlow;
  return flow.owed?.host === host && flow.live && flow.beat !== 'done';
}
