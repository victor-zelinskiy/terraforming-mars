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
import {workspaceFrameDescended, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {parliamentHolds} from './parliamentDisplayHolds';
import {buildParliamentView, ParliamentQuestVm} from './consoleParliamentModel';
import {AgendaBonusOwed, flushAgendaBonus, queueAgendaBonuses, RATING_RAIL_KEY} from './parliamentRewardBeat';

/** WHO PLAYS the walk: the hand that hosts the Parliament as a step, or a Parliament standing on its own. */
export type AgendaWalkHost = 'hand' | 'parliament';

/** The walk as the tier plays it — the server's record, less the wire's identity. */
export type AgendaWalkRecord = {
  player: Color;
  from: number;
  to: number;
  steps: ReadonlyArray<AgendaAdvanceStep>;
};

/** The walk the answer carried for the viewer's own card, and who is to play it. */
export type OwedAgendaWalk = AgendaWalkRecord & {
  seq: number;
  card: CardName | undefined;
  generation: number;
  host: AgendaWalkHost;
};

export type AgendaWalkBeat = '' | 'walk' | 'read' | 'done';

export const agendaWalkFlow = reactive({
  /**
   * A WALK THIS PLAY PROMISED — the preview's `agendaWalk` step, armed at the
   * press for the workspace the play runs in. Until the answer's record
   * arrives the flow OWES a step (`owed-step`): the hand may not conclude,
   * and the crumb's tail already names the coming stage.
   */
  promised: undefined as {card: CardName, host: AgendaWalkHost} | undefined,
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

/** The play's preview says the marker will walk: the flow owes that step until the record arrives. */
export function promiseAgendaWalk(card: CardName, host: AgendaWalkHost): void {
  agendaWalkFlow.promised = {card, host};
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
    return 'parliament';
  }
  return undefined;
}

/** The queue of a walk's bonuses, one entry per step that pays, in the walk's order. */
export function agendaWalkBonuses(record: AgendaWalkRecord, generation: number): Array<AgendaBonusOwed> {
  const out: Array<AgendaBonusOwed> = [];
  for (const step of record.steps) {
    if (step.bonus === 'tr') {
      out.push({generation, player: record.player, step: step.to, kind: 'tr', spec: {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}});
    } else if (step.bonus === 'card') {
      out.push({generation, player: record.player, step: step.to, kind: 'card'});
    }
  }
  return out;
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
  // The promise is kept, whoever plays it: the record IS the answer.
  agendaWalkFlow.promised = undefined;
  const host = agendaWalkHostFor();
  if (host === undefined || consoleReducedMotionActive()) {
    return;
  }
  const record: AgendaWalkRecord = {player: advance.player, from: advance.from, to: advance.to, steps: advance.steps};
  flushAgendaBonus('re-seed');
  parliamentHolds.agendaAwaits = {player: record.player, from: record.from, to: record.to};
  queueAgendaBonuses(agendaWalkBonuses(record, after.game.generation));
  // …and the chairman quest a step's TR moved keeps its old face until the walk's rewards have landed.
  parliamentHolds.questWalkBefore = questBeforeWalk(before, after);
  agendaWalkFlow.owed = {...record, seq: advance.seq, card: advance.card, generation: after.game.generation, host};
  agendaWalkFlow.live = false;
  agendaWalkFlow.beat = '';
  agendaWalkFlow.landed = [];
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
  if (agendaWalkFlow.owed !== undefined) {
    parliamentHolds.agendaAwaits = undefined;
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
