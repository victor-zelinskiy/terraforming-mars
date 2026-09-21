/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПРЕДСЕДАТЕЛЬСТВО» — the PURE half of the chairman-quest flow
 * (docs/claude/prompts/parliament-chairman-quest.md §3): where the flow
 * stands, what its crumb says, and the DISPLAY HOLDS its beats consume.
 *
 * WHY IT EXISTS AT ALL. The presentation of the Agenda step was already
 * written — `ConsoleParliamentAgenda`'s `lastAdvanceSeq` watcher glides the
 * marker for a live `reason: 'quest'` advance, `ConsoleBoardCardBonusLayer`
 * lifts a card reward's cover off the very step it reached. It played into
 * NOTHING: the player was standing on the board, the Parliament section was
 * not in the DOM, `parliamentRootEl()` was undefined and the glide collapsed
 * into an instant assignment. The fix is not a second presentation — it is the
 * server's GATE (`ChairmanSeat.questPrompt`), which brings the player to the
 * stage the beats already live on, and this flow, which walks them through it.
 *
 * THE HOLDS ARE SEEDED IN THE SAME SYNCHRONOUS BLOCK AS THE VIEW APPLY
 * (`seedChairmanQuestHolds`, called from the transport's `seedRewardHolds`
 * and `App.update` beside `seedParliamentSittingHolds` — the sitting's own
 * law, for the same reason): seeded a tick late, the marker paints one frame
 * on its NEW step before the beat that moves it, and the chair changes hands
 * with no cube ever crossing the screen.
 *
 * Pure + a reactive record: no DOM, no i18n, no timers (the beats live in
 * `chairmanQuestDirector.ts`).
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {parliamentHolds} from './parliamentDisplayHolds';
import {AgendaMove} from './consoleParliamentModel';
import {flushAgendaBonus, parliamentRewardState, RATING_RAIL_KEY} from './parliamentRewardBeat';
import {beginPanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/**
 * THE FLOW'S STAGES — the crumb's tail, one word each
 * («ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО › ЗАДАНИЕ»):
 *  · `task`   — what was closed and who closed it, and the office changing hands;
 *  · `agenda` — the marker's step and the bonus it pays.
 */
export type ChairmanQuestStage = 'task' | 'agenda';

/** The beat the director is playing ('' before it starts, `done` when everything has landed). */
export type ChairmanQuestBeat = '' | 'task' | 'seat' | 'agenda' | 'done';

/** The crumb's SUBJECT while the flow stands — one fixed word (the glossary's «председательство»). */
export {CHAIRMAN_QUEST_SUBJECT_KEY} from './consoleParliamentFlow';

/** The crumb's tail per stage — one word, never echoing the subject's noun. */
export function chairmanQuestStageKey(stage: ChairmanQuestStage): string {
  return stage === 'agenda' ? 'Agenda' : 'Quest';
}

export const chairmanQuestFlow = reactive({
  /** The flow is the Parliament's subject right now (the section opened it on the gate). */
  live: false,
  stage: 'task' as ChairmanQuestStage,
  beat: '' as ChairmanQuestBeat,
  /** The answer is in flight (the gate was sent, nothing has come back yet). */
  sent: false,
  /** The answer has come back — the beats past the reading may run. */
  answered: false,
  /** Who closed the quest — read at the open, so the reading survives the answer that closes the quest record. */
  player: undefined as Color | undefined,
  /** The office as it stood AT THE OPEN: who held it (undefined = empty seat)… */
  seatWas: undefined as Color | undefined,
  /** …and which of the new chairman's own places the delegate leaves. */
  seatSource: 'reserve' as 'reserve' | 'lobby',
  /** The Agenda move the answer produced (the ПОВЕСТКА beat plays it); undefined until the server answers. */
  move: undefined as AgendaMove | undefined,
  /** …and what its step pays, for the band's reading. */
  bonus: undefined as 'tr' | 'card' | undefined,
});

function freshFlow() {
  return {
    live: false, stage: 'task' as ChairmanQuestStage, beat: '' as ChairmanQuestBeat, sent: false, answered: false,
    player: undefined, seatWas: undefined, seatSource: 'reserve' as const, move: undefined, bonus: undefined,
  };
}

export function resetChairmanQuestFlow(): void {
  Object.assign(chairmanQuestFlow, freshFlow());
}

/** The flow stands (its stage, or its answer in flight) — the section's stage machine and the band read this. */
export function chairmanQuestUp(): boolean {
  return chairmanQuestFlow.live;
}

// ── the gate, by its STRUCTURAL marker ──────────────────────────────────────

/** The viewer's chairman-quest gate, if it stands: the server's own marker — never a title. */
export function chairmanQuestGateOf(wf: PlayerInputModel | undefined): {generation: number} | undefined {
  return wf?.chairmanQuestPrompt;
}

// ── the open: the office as it stands BEFORE the answer ─────────────────────

/**
 * ARM the flow from the live model — called by the section the moment the gate
 * takes the stage, while the model still reads the state the server has NOT
 * changed: the quest closed by this seat, the previous chairman still in the
 * chair, the delegate still in its place.
 */
export function armChairmanQuestFlow(model: ParliamentModel | undefined, viewer: Color | undefined): void {
  const player = model?.quest?.completedBy ?? viewer;
  const seat = model?.players.find((p) => p.color === player);
  Object.assign(chairmanQuestFlow, freshFlow(), {
    live: true,
    player,
    seatWas: model?.chairman,
    // The rulebook's own order: the reserve first, then the lobby (an eighth
    // delegate is never created). A seat with neither is the corner case the
    // server asks about — its own prompt follows this flow's first stage.
    seatSource: (seat?.reserve ?? 0) > 0 ? 'reserve' : 'lobby',
  });
}

// ── the seed (the SAME synchronous block as the view apply) ─────────────────

function parliamentOf(view: PlayerViewModel | undefined): ParliamentModel | undefined {
  return view?.game.parliament;
}

/**
 * DETECT (pure): the Agenda move THIS response carries for the quest — a
 * `reason: 'quest'` record whose serial grew. `undefined` from a first view,
 * for the political phase's own step, or when nothing moved.
 */
export function detectChairmanQuestAdvance(
  before: PlayerViewModel | undefined,
  after: PlayerViewModel,
): {move: AgendaMove, bonus?: 'tr' | 'card'} | undefined {
  const advance = parliamentOf(after)?.lastAdvance;
  if (advance === undefined || advance.reason !== 'quest' || advance.to === advance.from) {
    return undefined;
  }
  const was = parliamentOf(before)?.lastAdvance;
  if (before === undefined || (was !== undefined && was.seq >= advance.seq)) {
    return undefined;
  }
  return {
    move: {player: advance.player, from: advance.from, to: advance.to},
    ...(advance.bonus === undefined ? {} : {bonus: advance.bonus}),
  };
}

/** DETECT (pure): the office changed hands in THIS response. */
export function detectChairmanChange(
  before: PlayerViewModel | undefined,
  after: PlayerViewModel,
): {from: Color | undefined, to: Color} | undefined {
  const was = parliamentOf(before)?.chairman;
  const now = parliamentOf(after)?.chairman;
  if (before === undefined || now === undefined || now === was) {
    return undefined;
  }
  return {from: was, to: now};
}

/**
 * SEED — the holds of the answer, written in the SAME synchronous block that
 * applies the view. Only while the flow is live: outside it the marker's own
 * watcher plays whatever it can, and a hold nobody would ever consume would
 * freeze the track for good.
 */
export function seedChairmanQuestHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (!chairmanQuestFlow.live || after === undefined || consoleReducedMotionActive()) {
    return;
  }
  const seat = detectChairmanChange(before, after);
  if (seat !== undefined) {
    parliamentHolds.chairAwaits = seat;
    if (seat.from !== undefined) {
      // The outgoing delegate is on its way HOME: the reserve keeps its old
      // count (and shows the «←» mark) until the cube touches it.
      parliamentHolds.returns.set(seat.from, (parliamentHolds.returns.get(seat.from) ?? 0) + 1);
    }
  }
  const advance = detectChairmanQuestAdvance(before, after);
  if (advance === undefined) {
    return;
  }
  chairmanQuestFlow.move = advance.move;
  chairmanQuestFlow.bonus = advance.bonus;
  // The marker stands on its OLD step until the ПОВЕСТКА beat glides it — the
  // very hold `ConsoleParliamentAgenda` already knows how to read and release.
  parliamentHolds.agendaAwaits = advance.move;
  seedQuestAgendaBonus(after, advance.move.to, advance.bonus);
}

/**
 * The step's own bonus rides the SITTING's ledger (`parliamentRewardBeat`):
 * a TR step holds the rating on the rail until its chip touches the row, a
 * CARD step parks the `agenda`-sourced reveal until the cover can lift off
 * the step the marker reached. Same records, same release — the quest's
 * advance simply is not part of a political phase, so it seeds them itself.
 */
function seedQuestAgendaBonus(after: PlayerViewModel, step: number, bonus: 'tr' | 'card' | undefined): void {
  const viewer = after.thisPlayer?.color;
  if (viewer === undefined || chairmanQuestFlow.move?.player !== viewer || bonus === undefined) {
    return;
  }
  flushAgendaBonus('re-seed');
  const generation = after.game.generation;
  if (bonus === 'tr') {
    const spec = {channel: 'stock' as const, resource: RATING_RAIL_KEY, amount: 1};
    beginPanelRewardHold([spec]);
    parliamentRewardState.agendaBonus = {generation, player: viewer, step, kind: 'tr', spec};
  } else {
    parliamentRewardState.agendaBonus = {generation, player: viewer, step, kind: 'card'};
  }
}

/** Every hold this flow seeded, released at once (the flow ends, the section unmounts, the motion is cut). */
export function releaseChairmanQuestHolds(why: string): void {
  parliamentHolds.chairAwaits = undefined;
  parliamentHolds.agendaAwaits = undefined;
  parliamentHolds.returns.clear();
  flushAgendaBonus(why);
}
