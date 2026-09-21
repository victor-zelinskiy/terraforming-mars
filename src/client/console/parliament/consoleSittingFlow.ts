/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING FLOW (Turmoil Redux — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §3.4, §6; docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md) — the PURE half of
 * «ПАРЛАМЕНТ › ЗАСЕДАНИЕ»: where the political phase stands on the SERVER, which
 * pages the viewer walks inside a step, which of them the walk turns by itself,
 * what the crumb's tail says, which phase B's verb comes from, and the mandatory
 * FLOW beat that opens the whole sitting once per generation.
 *
 * The sitting is ONE flow with TWO synchronous gates (`ParliamentPhase.ts`, v2):
 *
 *   winner → ▶ ASSEMBLY ◀ → agenda → support → enact → effects → refresh → lobby → ▶ ADJOURN ◀ → done
 *
 * The first gate stands BEFORE anything changes: at the VERDICT everything the
 * player sees is still the table as it was voted. One A answers it; the server
 * then runs the whole chain and the response (an own submit or a poll / WS
 * frame) carries the diffs. The client SEEDS its display holds in the same
 * synchronous block that applies the view (`parliamentSittingSeed.ts`) and
 * plays the beats from the old state to the new one: ПОВЕСТКА → ПОДДЕРЖКА →
 * ПРИНЯТИЕ → the reward's wave — with no press in between. The only real
 * stops of the walk are the verdict (gate 1), the viewer's own ask on the
 * reward page (a pick, a take, the winner's tile behind «К полю»), a wait on
 * another seat, and the RESULTS (gate 2 — «Закрыть заседание»).
 *
 * Every fact here is the server's: the phase's `step`, its `summary`, its
 * `awaiting` list, the viewer's own prompt and its STRUCTURAL markers
 * (`parliamentPhasePrompt`, a `choiceContext` / `externalDrawPrompt` /
 * `placementContext` whose source is a resolution) — never a title, never a
 * resolution name, never a client memory of «already seen».
 *
 * WHAT IS LOCAL, and why that is honest: inside one server step the viewer
 * sees up to three PAGES (the enactment's beats, the reward, the results).
 * Which page is on screen is presentation state — `parliamentFlow.sittingPage`
 * — and the pages `enact` / `reward` are turned by the director once their
 * beats have landed (`sittingPageAuto`). A reload lands on the step's LAST
 * page in its final poses (nothing replays); a seat that already answered a
 * gate lands on the gate's wait pose. Nothing is persisted on the device.
 */
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {PlayerInputType} from '@/common/input/PlayerInputType';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {ParliamentPhaseStage} from '@/common/parliament/ParliamentTypes';
import type {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';
import type {MandatoryFlowBeat} from '@/client/console/consoleMandatoryGate';
import {promptSourceResolution} from '@/client/console/promptSource';
import {externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';

/**
 * The sitting's STAGES, in the order the server produces their facts:
 *  · `verdict` — the assembly gate: who won, with how many delegates (A answers gate 1);
 *  · `enact`   — the chain after the barrier, as beats: the Agenda step, the popular support, the enactment;
 *  · `reward`  — what the law paid THIS seat (the wave), or the seat's own ask, or the wait on another;
 *  · `results` — the renewal's beats (the losers leave, the deal, the support seats, the lobby), then the
 *                results card; A answers gate 2 («Закрыть заседание»).
 */
export type SittingStage = 'verdict' | 'enact' | 'reward' | 'results';

/**
 * What the REWARD stage is doing for THIS seat right now.
 *  · `reading`   — before the effects: the reading of what is coming;
 *  · `choice` / `intake` / `placement` — the viewer's own ask, hosted in the stage's zone (or behind «К полю»);
 *  · `waiting`   — the effects ask ANOTHER seat (the honest wait line);
 *  · `received`  — the viewer's record is in: paid, or skipped with its reason (the plate names it);
 *  · `gate`      — the viewer answered the step's gate; the pose lists who is still awaited.
 */
export type SittingRewardStep = 'reading' | 'choice' | 'intake' | 'placement' | 'waiting' | 'received' | 'gate';

/**
 * WHERE THE SITTING STANDS, read off the server. `undefined` outside a live
 * political phase the viewer takes part in.
 */
export type SittingPosition = {
  generation: number;
  final: boolean;
  /** The server's step. */
  step: ParliamentPhaseModel['step'];
  /** The pages the viewer walks in this step, first to last (never empty). */
  pages: ReadonlyArray<SittingStage>;
  /** The gate this step ends in, when it is a gate step. */
  gate?: ParliamentPhaseStage;
  /** The viewer's own gate prompt stands — A on the step's last page answers it. */
  gateStanding: boolean;
  /** The viewer has answered the gate (or was never asked) and the phase still waits for these seats. */
  awaiting: ReadonlyArray<Color>;
  /** The REWARD stage's step for this seat (meaningful while `pages` includes `reward`, i.e. always past the verdict). */
  rewardStep: SittingRewardStep;
  /** The seat the effects are asking right now, when it is somebody else — and what kind of answer. */
  waitingFor?: {player: Color, input?: PlayerInputType};
};

/** The viewer's own resolution-sourced ask, by its structural markers — never a title. */
export function sittingAskOf(wf: PlayerInputModel | undefined): 'choice' | 'intake' | 'placement' | undefined {
  if (wf === undefined || promptSourceResolution(wf) === undefined) {
    return undefined;
  }
  if (externalDrawTakeOf(wf) !== undefined) {
    return 'intake';
  }
  if (wf.type === 'space') {
    return 'placement';
  }
  return 'choice';
}

/** The viewer's gate prompt, if it stands: the server's own marker. */
export function sittingGatePromptOf(wf: PlayerInputModel | undefined): ParliamentPhaseStage | undefined {
  return wf?.parliamentPhasePrompt?.stage;
}

/** The viewer's OWN records in the live phase (the effects so far). */
function viewerOutcomes(phase: ParliamentPhaseModel, viewer: Color | undefined): Array<ParliamentEnactOutcomeModel> {
  return viewer === undefined ? [] : (phase.outcomes ?? []).filter((o) => o.player === viewer);
}

/** The steps at which the verdict is known and NOTHING has changed yet (the assembly gate's own reading). */
const VERDICT_STEPS: ReadonlySet<string> = new Set(['winner', 'assembly']);

/**
 * The pages of a step. The ASSEMBLY gate (v2) stands before anything changes,
 * so its step is the verdict alone; the steps after the barrier are one chain
 * on the server, so the EFFECTS step (a resolution asking) reads the enactment's
 * beats and the reward; the ADJOURN gate stands after the refresh, so its step
 * reads the enactment, the reward and the RESULTS — in the FINAL phase there is
 * no refresh, and the results card simply lists nothing new. The transient
 * server steps (`agenda` / `support` / `enact`, `refresh` / `lobby`) are never
 * on the wire long enough to read; they map onto the page they belong to.
 */
export function sittingPagesOf(step: ParliamentPhaseModel['step'], _final: boolean): ReadonlyArray<SittingStage> {
  switch (step) {
  case 'winner':
  case 'assembly':
    return ['verdict'];
  case 'agenda':
  case 'support':
  case 'enact':
    return ['enact'];
  case 'effects':
    return ['enact', 'reward'];
  case 'refresh':
  case 'lobby':
  case 'adjourn':
  case 'done':
    return ['enact', 'reward', 'results'];
  }
}

/**
 * A page the walk turns BY ITSELF once its beats have landed (the enactment's
 * chain, the reward's wave) — the player presses nothing between the verdict
 * and the results. The verdict and the results are STOPS: a gate is answered
 * by A, never by the director.
 */
export function sittingPageAuto(stage: SittingStage): boolean {
  return stage === 'enact' || stage === 'reward';
}

/**
 * THE POSITION — the one derivation every sitting surface reads.
 * `undefined` when no political phase is live for this viewer (no phase, a
 * seat outside the parliament, a spectator).
 */
export function sittingPositionOf(
  model: ParliamentModel | undefined,
  wf: PlayerInputModel | undefined,
  viewer: Color | undefined,
): SittingPosition | undefined {
  const phase = model?.phase;
  if (model === undefined || phase === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  if (seat === undefined || !seat.participates) {
    return undefined;
  }
  const gate: ParliamentPhaseStage | undefined = phase.step === 'assembly' || phase.step === 'adjourn' ? phase.step : undefined;
  const gateStanding = gate !== undefined && sittingGatePromptOf(wf) === gate;
  const awaiting = phase.awaiting ?? [];
  const ask = sittingAskOf(wf);
  const pending = phase.pending;
  const waitingFor = phase.step === 'effects' && pending !== undefined && pending.player !== viewer ?
    {player: pending.player, input: pending.input} : undefined;
  let rewardStep: SittingRewardStep;
  if (ask !== undefined) {
    rewardStep = ask;
  } else if (gate !== undefined && !gateStanding) {
    rewardStep = 'gate';
  } else if (VERDICT_STEPS.has(phase.step) || phase.step === 'agenda' || phase.step === 'support' || phase.step === 'enact') {
    rewardStep = 'reading';
  } else if (waitingFor !== undefined) {
    rewardStep = 'waiting';
  } else if (viewerOutcomes(phase, viewer).length > 0 || phase.step !== 'effects') {
    rewardStep = 'received';
  } else {
    rewardStep = 'waiting';
  }
  return {
    generation: phase.generation,
    final: phase.final,
    step: phase.step,
    pages: sittingPagesOf(phase.step, phase.final),
    gate,
    gateStanding,
    awaiting,
    rewardStep,
    waitingFor,
  };
}

/**
 * WHERE A STEP'S WALK STARTS: on the first page whose beats have NOT played
 * this session (`played`) — unless the seat has already answered the step's
 * gate (a reload, a restore while the others are still reading): then there
 * is nothing left to turn to, and the walk starts on the gate's own wait pose.
 * Server-derived, so a reload never re-asks a question the seat has answered
 * and never skips one it has not; session-derived, so a page turned back and
 * forth replays nothing. A tile RECEIPT owed (the frame is back from the board
 * with the winner's tile placed) seats the walk on the REWARD page first —
 * «получено» is read before the results — unless the seat has already answered
 * the gate, where the wait pose is the only honest place.
 */
export function sittingStartPage(position: SittingPosition, played: (stage: SittingStage) => boolean = () => false, receiptOwed = false): number {
  const last = position.pages.length - 1;
  if (position.gate !== undefined && !position.gateStanding) {
    return last;
  }
  if (receiptOwed) {
    const reward = position.pages.indexOf('reward');
    if (reward !== -1) {
      return reward;
    }
  }
  const first = position.pages.findIndex((stage) => !played(stage));
  return first === -1 ? last : first;
}

/** The stage on screen for a position and the viewer's local page cursor (clamped — a shorter step never reads past its end). */
export function sittingStageAt(position: SittingPosition, page: number): SittingStage {
  const pages = position.pages;
  const index = Math.max(0, Math.min(pages.length - 1, page));
  return pages[index];
}

/**
 * ЛЕНТА И ТЕЛО («Заседание v5») — the middle zone is a BAND and a BODY, and the body has exactly THREE
 * states. The band above it never changes: it names the reason for what is happening and crossfades its
 * content, and nothing below it may move because of that.
 *
 * **РЯД ПАРТИЙ** — the default, and the state of every beat that MOVES an object the player must watch:
 * the verdict, the Agenda, the popular support, the enactment, and the whole physical part of the results
 * (the losers leaving, the deal, the lobby). The reward is one of them too: its chips fly to the rail and
 * its formula is read in the band, so nothing needs to take the row's place for it — which is what removed
 * the switching from a quiet resolution entirely.
 *
 * **ВСТРОЕННЫЙ ШАГ** — the player has to WORK: a pick of a card for a resource, a take of drawn cards.
 * Those are separate widgets and they need the площадь, so the zone becomes the work surface for as long
 * as the step stands (`sittingField` — the section's own fact: the seat's own ask, and only once the wave
 * that arrived with it has played).
 *
 * **ПАНЕЛЬ ИТОГОВ** — the sitting's last reading, and it does not fold back: the sitting ends after it.
 *
 * The law that follows and has not changed: a reading surface may never cover an object something is
 * flying to or from — which is why the results' physical part is the ROW and only the card after it is
 * the panel, and why placing the winner's tile is not a body state at all (the stack yields to the board
 * and comes back).
 */
export type SittingBody = 'parties' | 'step' | 'results';

/**
 * `resultsHidden` is the director's own fact: the results card waits while the renewal's beats play over
 * the table (and a reload that never played them lands with it already shown). `field` is the section's:
 * a hosted step of this seat's stands in the zone.
 */
export function sittingBodyOf(stage: SittingStage, resultsHidden: boolean, field: boolean): SittingBody {
  if (field) {
    return 'step';
  }
  return stage === 'results' && !resultsHidden ? 'results' : 'parties';
}

/** Is the local cursor on the step's LAST page (the page whose A answers the gate, or has nothing left to turn)? */
export function sittingAtLastPage(position: SittingPosition, page: number): boolean {
  return page >= position.pages.length - 1;
}

/**
 * MAY THE WALK LEAVE THE REWARD PAGE by itself? Only once nothing of this
 * seat's is still open there: no ask of its own (a pick, a take, the tile
 * behind «К полю»), no wait on another seat, no reading of a payout still to
 * come — and the caller adds «no wave owed or in the air» (the ledger's own
 * fact, not the position's).
 */
export function sittingRewardSettled(position: SittingPosition): boolean {
  return position.rewardStep === 'received' || position.rewardStep === 'gate';
}

/**
 * THE CRUMB'S TAIL — an i18n key per stage; the reward's tail names the STEP
 * the seat is actually in (a pick, a take, a placement), so the line reads
 * «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЫБОР» while the picker stands. One word each,
 * never echoing the root's noun (`consoleWorkspaceHeader` grammar).
 */
export function sittingStageKey(stage: SittingStage, rewardStep: SittingRewardStep): string {
  switch (stage) {
  case 'verdict': return 'Verdict';
  case 'enact': return 'Enactment';
  case 'reward':
    switch (rewardStep) {
    case 'choice': return 'Choice';
    case 'intake': return 'Intake';
    case 'placement': return 'Placement';
    default: return 'Reward';
    }
  case 'results': return 'Results';
  }
}

/** The crumb's SUBJECT while the sitting stands — one fixed word. */
export const SITTING_SUBJECT_KEY = 'Sitting';

/**
 * WHERE THE STAGE STANDS RELATIVE TO ITS COMMIT — the workspace phase B's verb
 * is derived from (`consoleWorkspaceFlow.backVerbFor`):
 *  · every stage up to the results is `committed` (the sitting cannot be
 *    unmade; B = «свернуть» — hide to read the board, the decision stays);
 *  · the RESULTS are a terminal `verdict` (nothing is chosen after them; B = none,
 *    A closes the sitting);
 *  · a gate answer in flight is `executing` (input absorbed by phase).
 */
export function sittingWorkspacePhase(stage: SittingStage, submitting: boolean): WorkspacePhase {
  if (submitting) {
    return 'executing';
  }
  return stage === 'results' ? 'verdict' : 'committed';
}

/**
 * THE A VERB on a page — an i18n key, or undefined when A does nothing here
 * (a page the director turns, a hosted step that owns the bar, a wait pose).
 *  · the VERDICT answers gate 1 («Продолжить» — the whole chain follows);
 *  · the REWARD's placement step offers the ONE door to the board («К полю» —
 *    the tile is placed only by that press, never by the prompt's arrival);
 *  · the RESULTS answer gate 2 («Закрыть заседание»).
 */
export function sittingPrimaryKey(position: SittingPosition, page: number): string | undefined {
  const stage = sittingStageAt(position, page);
  switch (stage) {
  case 'verdict':
    return position.gate === 'assembly' && position.gateStanding ? 'Continue' : undefined;
  case 'reward':
    return position.rewardStep === 'placement' ? 'Onto the board' : undefined;
  case 'results':
    return position.gate === 'adjourn' && position.gateStanding ? 'Close the sitting' : undefined;
  default:
    return undefined;
  }
}

/**
 * THE MANDATORY FLOW BEAT — one announcement per generation («Парламент
 * собрался · поколение N»), keyed on the phase's generation so it stays the
 * SAME beat through gate 1, every ask of the enacted resolution and gate 2:
 * acknowledged once at the open, gone with the phase. Derived from the
 * server's own phase record, exactly like the draft's `draft:gen<N>`.
 */
export function parliamentSittingFlowBeat(view: PlayerViewModel): MandatoryFlowBeat | undefined {
  if (view.game.phase !== Phase.PARLIAMENT) {
    return undefined;
  }
  const position = sittingPositionOf(view.game.parliament, view.waitingFor, view.thisPlayer?.color);
  if (position === undefined || position.step === 'done') {
    return undefined;
  }
  return {key: `parliament:gen${position.generation}`, taskKind: 'parliamentPhase', flow: 'parliament-phase'};
}

/** The sitting is LIVE for the viewer (the flow's frame anchor — the political phase itself). */
export function parliamentSittingLive(view: PlayerViewModel): boolean {
  return parliamentSittingFlowBeat(view) !== undefined;
}

/** The phase's steps BEFORE the refresh — the vote is decided and the table still shows the losers as they voted (P-17). */
const VOTE_DECIDED_STEPS: ReadonlySet<string> = new Set(['winner', 'agenda', 'support', 'enact', 'assembly', 'effects']);
export function voteDecidedAt(step: ParliamentPhaseModel['step'] | undefined): boolean {
  return step !== undefined && VOTE_DECIDED_STEPS.has(step);
}

/** The steps at which the verdict stands and the table is still exactly as voted (the assembly gate, v2). */
export function verdictStandsAt(step: ParliamentPhaseModel['step'] | undefined): boolean {
  return step !== undefined && VERDICT_STEPS.has(step);
}

/**
 * THE QUIET REWARD (final polish D) — the REWARD stage's pose for a resolution with no immediate step:
 * the passive that now stands, or the action to take from «Действия карт». Lives in `quietRewardPose.ts`
 * (the vote panel's reading prints the same kicker — one glossary); re-exported here for the sitting.
 */
export type {QuietRewardPose} from './quietRewardPose';
export {quietRewardPoseOf} from './quietRewardPose';
