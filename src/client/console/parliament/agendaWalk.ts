/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «КАРЬЕРА» — the PURE half of a card's WALK OF THE AGENDA TRACK (Turmoil
 * Redux TR04 Minority Representation, docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md):
 * what the play PROMISED, what the answer CARRIED, who is to PLAY it, and
 * the DISPLAY HOLDS its beats consume.
 *
 * THE TRACK HAS THREE ENGINES AND ONE WALK. The sitting's winner step and the
 * chairman quest move the marker one step; a card moves it N and «collects
 * the bonus of each step». On the server the three are one function
 * (`ChairmanSeat.walkAgenda`) and one record (`lastAdvance.steps`); on the
 * client they are one phrase (`agendaWalkDirector.ts`) played by the Agenda
 * tier, and this module is the third engine's own bookkeeping — the other
 * two keep theirs (`consoleSittingFlow`, `consoleChairmanQuest`).
 *
 * THE PLAY IS AN OUTCOME, NOT A DOOR. The card asks nothing: «Разыграть
 * карту» is the play's one POST, the answer carries the walk's record, and
 * the Parliament is pushed INTO the hand's own zone as a SHOW step to play
 * it — the marker step by step, each step's reward on its own landing —
 * after which the flow LEAVES (the hand and the hosted Parliament as one
 * surface). Nothing here is a prompt; nothing here is chosen.
 *
 * THE HOLDS ARE SEEDED IN THE SAME SYNCHRONOUS BLOCK AS THE VIEW APPLY
 * (`seedAgendaWalkHolds`, from the transport's `seedRewardHolds` and from
 * `App.update` — the sitting's own law, for the same reason): seeded a tick
 * late, the marker paints one frame on its NEW step before the beat that
 * moves it, and the rail ticks a point nobody saw arrive. And they are
 * seeded ONLY when there is somebody to play them: the hand the card was
 * played from with its descent standing (the host), or a Parliament already
 * open on its own (its tier's watcher plays the record). With neither, a
 * hold nobody would ever consume would freeze the track for good — the state
 * simply updates, the rating ticks with its ordinary chip, the journal and
 * the notification tell.
 *
 * Pure + a reactive record: no DOM, no i18n, no timers.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentAdvanceModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {AgendaAdvanceStep} from '@/common/parliament/ParliamentTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {workspaceFrameDescended, workspaceFrameHost, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {parliamentHolds} from './parliamentDisplayHolds';
import {buildParliamentView, ParliamentQuestVm} from './consoleParliamentModel';
import {AgendaBonusOwed, flushAgendaBonus, queueAgendaBonuses, RATING_RAIL_KEY} from './parliamentRewardBeat';
import {detectChairmanChange} from './consoleChairmanQuest';

/**
 * THE TABLE'S ANSWER to the walk's TR step, promised at the press (PL-002):
 * the forecast's reaction specs (the ruling Greens' M€ for a rating step —
 * `reactionRailSpecs`, the landing scene's own reading) and the response's
 * other KNOWN moves on the rail's rows (the play's price), for the diff check
 * the seed makes. A reaction never ticks before its reason: the answer is
 * held with the TR step's rating and released a beat after its chip has
 * touched the rail (`parliamentRewardBeat` — `AgendaBonusOwed.reactions`).
 */
export type AgendaWalkRailPromise = {
  reactions: ReadonlyArray<ResourceTransferSpec>;
  known: Readonly<Record<string, number>>;
};

/**
 * WHO PLAYS the walk: the hand that hosts the Parliament as a step, a Parliament standing on its own — or the START
 * workspace (TRP1 Lobbying Campaign: a Prelude's walk, played in the Parliament the start hosts as a scene step; the
 * record rides the vote's answer, after its cubes have landed, or the play's own answer when no vote was asked).
 */
export type AgendaWalkHost = 'hand' | 'parliament' | 'start';

/** The walk as the tier plays it — the server's record, less the wire's identity. */
export type AgendaWalkRecord = {
  player: Color;
  from: number;
  to: number;
  steps: ReadonlyArray<AgendaAdvanceStep>;
};

/**
 * THE OFFICE THE SAME PLAY TOOK, before the walk it pays for (TR76 Vote Of No Confidence:redux — «remove the current
 * Chairman and move your own delegate (from the reserve) there instead. Advance your Agenda marker 1 step»): the
 * chair changed hands to the VIEWER in the very response that carried the viewer's card walk. Read off the two views
 * (`detectChairmanChange` — the quest's own detector), never off the card's name: any play that seats the player and
 * walks the marker is this one phrase, «КРЕСЛО» then «КАРЬЕРА» (the quest's order — the office before its reward).
 */
export type AgendaWalkSeat = {from: Color, to: Color};

/** The walk the answer carried for the viewer's own card, and who is to play it. */
export type OwedAgendaWalk = AgendaWalkRecord & {
  seq: number;
  card: CardName | undefined;
  generation: number;
  host: AgendaWalkHost;
  /** The chair the same play took — its beat («КРЕСЛО») plays before the walk's. */
  seat?: AgendaWalkSeat;
};

/** `seat` — the office changes hands (the beat before the walk, only when the play took the chair). */
export type AgendaWalkBeat = '' | 'seat' | 'walk' | 'read' | 'done';

export const agendaWalkFlow = reactive({
  /**
   * A WALK THIS PLAY PROMISED — the preview's `agendaWalk` step, armed at the
   * press for the workspace the play runs in. Until the answer's record
   * arrives the flow OWES a step (`owed-step`): the hand may not conclude,
   * and the crumb's tail already names the coming stage.
   */
  promised: undefined as {card: CardName, host: AgendaWalkHost, rail?: AgendaWalkRailPromise} | undefined,
  /** The walk the answer carried, seeded with its holds, waiting for (or being played by) its host. */
  owed: undefined as OwedAgendaWalk | undefined,
  /** The walk is the Parliament's subject right now (the section opened the walk pose on it). */
  live: false,
  beat: '' as AgendaWalkBeat,
  /** The steps the marker has LANDED on so far, in order — the band grows one chip per landing. */
  landed: [] as Array<AgendaAdvanceStep>,
});

function freshFlow() {
  return {promised: undefined, owed: undefined, live: false, beat: '' as AgendaWalkBeat, landed: [] as Array<AgendaAdvanceStep>};
}

export function resetAgendaWalkFlow(): void {
  Object.assign(agendaWalkFlow, freshFlow());
}

// ── the promise (the press) ────────────────────────────────────────────────

/** The play's preview says the marker will walk: the flow owes that step until the record arrives — with the table's answer to its TR step, if the press knew one. */
export function promiseAgendaWalk(card: CardName, host: AgendaWalkHost, rail?: AgendaWalkRailPromise): void {
  agendaWalkFlow.promised = rail === undefined ? {card, host} : {card, host, rail};
}

/** The play was refused, or the answer carried no walk (the track's end took every step): nothing is owed. */
export function dropAgendaWalkPromise(): void {
  agendaWalkFlow.promised = undefined;
}

// ── the detect and the seed (the SAME synchronous block as the view apply) ──

function parliamentOf(view: PlayerViewModel | undefined): ParliamentModel | undefined {
  return view?.game.parliament;
}

/**
 * DETECT (pure): the walk THIS response carries for the viewer's OWN card —
 * a `reason: 'card'` record of the viewer's whose serial grew. `undefined`
 * from a first view (a reload has nothing to move from), for a rival's card
 * (the tier's watcher plays theirs), for the quest's and the phase's own
 * steps, and for an echo frame.
 */
export function detectAgendaWalk(before: PlayerViewModel | undefined, after: PlayerViewModel): ParliamentAdvanceModel | undefined {
  const advance = parliamentOf(after)?.lastAdvance;
  const viewer = after.thisPlayer?.color;
  if (advance === undefined || advance.reason !== 'card' || advance.player !== viewer || advance.to === advance.from) {
    return undefined;
  }
  const was = parliamentOf(before)?.lastAdvance;
  if (before === undefined || (was !== undefined && was.seq >= advance.seq)) {
    return undefined;
  }
  return advance;
}

/**
 * WHO WOULD PLAY a walk that arrives now — read off the stack: the hand the
 * card was played from, with its descent standing (the Parliament is pushed
 * into its zone as a step); else a Parliament already open on its own (its
 * tier's watcher glides the record); else nobody.
 */
export function agendaWalkHostFor(): AgendaWalkHost | undefined {
  if (workspaceFrameDescended('hand')) {
    return 'hand';
  }
  if (workspaceFrameKnown('parliament')) {
    // A Parliament the START hosts as a scene step (a Prelude's vote — TRP1) plays the walk IN that step, as the
    // hand's hosted step does: the start is the host, never a Parliament «standing on its own».
    return workspaceFrameHost('parliament') === 'start' ? 'start' : 'parliament';
  }
  if (workspaceFrameKnown('start')) {
    // The opening, with no Parliament up (the Prelude's grant asked nothing — rule 3 of TRP1): the start hosts the
    // walk as a scene step of its own (`ConsoleShell.startWalkStepDue`).
    return 'start';
  }
  return undefined;
}

/**
 * The queue of a walk's bonuses, one entry per step that pays, in the walk's
 * order. `reactions` — the table's VERIFIED answer to the walk's rating — are
 * shared out over the walk's TR steps (`answersPerRatingStep`): each TR step's
 * entry carries ITS answer, held with its rating and released a beat after its
 * own chip has landed. A walk takes several TR steps once its length is
 * COUNTED (TR42 from step 0: ② and ④ — the ruling Greens' 2 M€ each); hung on
 * the first entry, the second rating's answer ticked on the FIRST rating's
 * touchdown, three seconds before its own cause (PL-151).
 */
export function agendaWalkBonuses(record: AgendaWalkRecord, generation: number, reactions: ReadonlyArray<ResourceTransferSpec> = []): Array<AgendaBonusOwed> {
  const out: Array<AgendaBonusOwed> = [];
  // A rating the law REFUSED (RX42 — `vetoed` on the step) never came: no token, no share of an answer.
  const trSteps = record.steps.filter((step) => step.bonus === 'tr' && step.vetoed !== true).length;
  const shares = answersPerRatingStep(reactions, trSteps);
  let rating = 0;
  for (const step of record.steps) {
    if (step.bonus === 'tr' && step.vetoed === true) {
      continue;
    }
    if (step.bonus === 'tr') {
      const spec: ResourceTransferSpec = {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1};
      const answer = shares[rating] ?? [];
      out.push(answer.length === 0 ?
        {generation, player: record.player, step: step.to, kind: 'tr', spec} :
        {generation, player: record.player, step: step.to, kind: 'tr', spec, reactions: answer});
      rating++;
    } else if (step.bonus === 'card') {
      out.push({generation, player: record.player, step: step.to, kind: 'card'});
    }
  }
  return out;
}

/**
 * THE TABLE'S ANSWER, ONE SHARE PER RATING STEP (pure): a reaction that answers
 * every walked rating alike (the Greens' 2 M€ per step — the forecast states
 * their SUM) is split evenly, one share per TR step; one that does not divide
 * evenly is never split by a guess — it rides the LAST TR step whole, after
 * every rating it may answer has landed (late, never early). `trSteps` 0 → no
 * share at all.
 */
export function answersPerRatingStep(reactions: ReadonlyArray<ResourceTransferSpec>, trSteps: number): Array<Array<ResourceTransferSpec>> {
  const shares: Array<Array<ResourceTransferSpec>> = Array.from({length: Math.max(0, trSteps)}, () => []);
  if (trSteps <= 0) {
    return shares;
  }
  for (const spec of reactions) {
    if (spec.amount % trSteps === 0) {
      shares.forEach((share) => share.push({...spec, amount: spec.amount / trSteps}));
    } else {
      shares[trSteps - 1].push({...spec});
    }
  }
  return shares;
}

/**
 * THE TABLE'S ANSWER THE SEED MAY HOLD (pure): the promised reactions, checked
 * against the two views by the rail reward's own verdict — the rating row must
 * have moved by exactly the walk's TR steps, and every reaction row by the
 * reaction plus the known moves (the price). A walk with no TR step, no
 * promise, or a row that moved otherwise holds no answer: the rows tick with
 * the commit, honestly (`verifyRailReward` names the mismatch).
 */
export function agendaWalkReactions(record: AgendaWalkRecord, rail: AgendaWalkRailPromise | undefined, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): Array<ResourceTransferSpec> {
  const trSteps = record.steps.filter((step) => step.bonus === 'tr' && step.vetoed !== true).length;
  if (rail === undefined || rail.reactions.length === 0 || trSteps === 0) {
    return [];
  }
  const verdict = verifyRailReward({
    cause: [{channel: 'stock', resource: RATING_RAIL_KEY, amount: trSteps}],
    reactions: rail.reactions,
    known: rail.known,
  }, before, after);
  return verdict.cause.length === 0 ? [] : verdict.reactions;
}

/**
 * SEED — the holds of the answer, in the SAME synchronous block that applies
 * the view. The marker stands on its OLD step (`agendaAwaits` — the very hold
 * the tier already reads: the cube on `from`, the influence at the old
 * level) and every paying step's bonus is OWED (the rail holds a point per
 * TR step, a card step parks its reveal) — but ONLY when somebody is there to
 * play it (`agendaWalkHostFor`). Reduced motion holds nothing: the poses are
 * final at once.
 */
export function seedAgendaWalkHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  const advance = detectAgendaWalk(before, after);
  if (advance === undefined) {
    return;
  }
  // The promise is kept, whoever plays it: the record IS the answer — and the table's answer it promised rides the
  // TR step's own entry (PL-002), checked against the two views below.
  const rail = agendaWalkFlow.promised?.rail;
  agendaWalkFlow.promised = undefined;
  const host = agendaWalkHostFor();
  if (host === undefined || consoleReducedMotionActive()) {
    return;
  }
  const record: AgendaWalkRecord = {player: advance.player, from: advance.from, to: advance.to, steps: advance.steps};
  // The КРЕСЛО beat is the HAND's step (the walk pose plays it before the walk); a Parliament standing on its own glides
  // the record with its tier's watcher and shows the new chairman as the view does — nothing would consume a seat hold.
  const seat = host === 'hand' ? agendaWalkSeatOf(before, after) : undefined;
  flushAgendaBonus('re-seed');
  if (seat !== undefined) {
    // The chair keeps its previous holder until the КРЕСЛО beat lifts the cube off it, and the outgoing owner's
    // reserve keeps its old count until the cube touches it — the quest's own holds (`seedChairmanQuestHolds`).
    parliamentHolds.chairAwaits = seat;
    parliamentHolds.returns.set(seat.from, (parliamentHolds.returns.get(seat.from) ?? 0) + 1);
  }
  parliamentHolds.agendaAwaits = {player: record.player, from: record.from, to: record.to};
  queueAgendaBonuses(agendaWalkBonuses(record, after.game.generation, agendaWalkReactions(record, rail, before, after)));
  // …and the chairman quest a step's TR moved keeps its old face until the walk's rewards have landed.
  parliamentHolds.questWalkBefore = questBeforeWalk(before, after);
  agendaWalkFlow.owed = {...record, seq: advance.seq, card: advance.card, generation: after.game.generation, host, ...(seat === undefined ? {} : {seat})};
  agendaWalkFlow.live = false;
  agendaWalkFlow.beat = '';
  agendaWalkFlow.landed = [];
}

/**
 * THE SEAT THE WALK'S PLAY TOOK (pure): the chair passed from ANOTHER seat to the viewer in this response — the walk's
 * owner (`detectAgendaWalk` already proved the walk is the viewer's own card). A chair taken from nobody (never by the
 * printed «remove the current Chairman») or kept by the viewer is no beat.
 */
export function agendaWalkSeatOf(before: PlayerViewModel | undefined, after: PlayerViewModel): AgendaWalkSeat | undefined {
  const change = detectChairmanChange(before, after);
  const viewer = after.thisPlayer?.color;
  if (change === undefined || change.from === undefined || viewer === undefined || change.to !== viewer) {
    return undefined;
  }
  return {from: change.from, to: change.to};
}

/**
 * THE QUEST BEFORE THE WALK (pure): the chairman quest as it stood in
 * `before`, when the answer CHANGED it (a step's TR advanced a progress or
 * closed it) — the government shows it until the walk's rewards have landed.
 * `undefined` when the walk left the quest as it was, or the quest itself is
 * another one (a new generation's): nothing to hold. Built by the quest's own
 * view builder from the server's numbers — which step moved it is never
 * re-derived here.
 */
export function questBeforeWalk(before: PlayerViewModel | undefined, after: PlayerViewModel): ParliamentQuestVm | undefined {
  const beforeModel = parliamentOf(before);
  const was = beforeModel?.quest;
  const now = parliamentOf(after)?.quest;
  if (before === undefined || beforeModel === undefined || was === undefined || now === undefined ||
      was.source !== now.source || was.generation !== now.generation) {
    return undefined;
  }
  const seats = new Set([...Object.keys(was.progress), ...Object.keys(now.progress)]);
  const changed = was.completedBy !== now.completedBy || [...seats].some((seat) => (was.progress[seat] ?? 0) !== (now.progress[seat] ?? 0));
  return changed ? buildParliamentView(beforeModel, after.thisPlayer?.color, before.players).quest : undefined;
}

/** The walk's rewards have landed: the chairman quest reads the server's answer now (its tick plays on the change). */
export function releaseAgendaWalkQuest(): void {
  parliamentHolds.questWalkBefore = undefined;
}

/** Every hold this flow seeded, released at once (the flow ends, the section unmounts, the motion is cut). */
export function releaseAgendaWalkHolds(why: string): void {
  const seat = agendaWalkFlow.owed?.seat;
  if (agendaWalkFlow.owed !== undefined) {
    parliamentHolds.agendaAwaits = undefined;
  }
  if (seat !== undefined) {
    parliamentHolds.chairAwaits = undefined;
    parliamentHolds.returns.delete(seat.from);
  }
  releaseAgendaWalkQuest();
  flushAgendaBonus(why);
  Object.assign(agendaWalkFlow, freshFlow());
}

// ── what the workspace's conclusion reads ──────────────────────────────────

/**
 * A walk this workspace OWES is not on screen yet: the play promised one and
 * the record has not come, or it came and its host has not opened the pose
 * (the landing ritual is still playing). The conclusion's `owed-step`.
 */
export function agendaWalkOwedTo(host: AgendaWalkHost): boolean {
  const flow = agendaWalkFlow;
  return (flow.promised?.host === host && flow.owed === undefined) ||
    (flow.owed?.host === host && !flow.live);
}

/** The walk is PLAYING inside this workspace — the marker moving, a chip in the air, the read beat: the conclusion's `live-outcome`. */
export function agendaWalkLiveIn(host: AgendaWalkHost): boolean {
  const flow = agendaWalkFlow;
  return flow.owed?.host === host && flow.live && flow.beat !== 'done';
}
