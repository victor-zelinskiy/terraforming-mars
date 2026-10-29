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
 * The sitting is ONE flow with ONE confirmation — the SOFT GATES
 * (docs/claude/console/parliament-soft-gates.md; `ParliamentPhase.ts`):
 *
 *   winner → agenda → support → enact → effects → refresh → lobby → done ▶ «Закрыть заседание» ◀
 *
 * The server runs the whole chain in one go and stops only where the law ASKS
 * a seat (a pick, a take, a tile — asked seat by seat, the one honest wait on
 * another). Its end is a PROMPT OF THE SEAT, not a barrier of the phase: the
 * next generation already runs, and this seat is admitted to it on its own
 * answer — so for a seat that has not closed it the sitting stands at `done`
 * (the server's per-seat `phase`, the finished summary). The response that
 * carries the sitting carries the WHOLE of it: the client SEEDS its display
 * holds in the same synchronous block that applies the view
 * (`parliamentSittingSeed.ts`) — from the table as it stood before the sitting
 * — and the walk plays it from its records: ВЕРДИКТ → ПОВЕСТКА → ПОДДЕРЖКА →
 * ПРИНЯТИЕ → the reward's wave → ОБНОВЛЕНИЕ → ИТОГИ, with no press in between.
 * The only real stops are the viewer's own ask on the reward page (a pick, a
 * take, the winner's tile behind «К полю»), a wait on another seat, and the
 * RESULTS — A «Закрыть заседание» answers the confirmation.
 *
 * Every fact here is the server's: the phase's `step`, its `summary`, the
 * viewer's own prompt and its STRUCTURAL markers (`parliamentPhasePrompt`,
 * a `choiceContext` / `externalDrawPrompt` / `placementContext` whose
 * source is a resolution) — never a title, never a resolution name, never a
 * client memory of «already seen».
 *
 * WHAT IS LOCAL, and why that is honest: inside one server step the viewer
 * sees up to three PAGES (the enactment's beats, the reward, the results).
 * Which page is on screen is presentation state — `parliamentFlow.sittingPage`
 * — and every page but the results is turned by the director once its beats
 * have landed (`sittingPageAuto`). A reload lands on the step's LAST page in
 * its final poses (nothing replays). Nothing is persisted on the device.
 */
import {Color} from '@/common/Color';
import {PlayerInputType} from '@/common/input/PlayerInputType';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {ParliamentPhaseStage} from '@/common/parliament/ParliamentTypes';
import type {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';
import type {MandatoryFlowBeat} from '@/client/console/consoleMandatoryGate';
import {sittingAskResolution} from '@/client/console/promptSource';
import {careerPausedAt, sittingReactionOf} from './agendaReaction';
import {externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';
import {isDiscardPrompt} from '@/client/console/cardDiscard/discardIntent';

/**
 * The sitting's STAGES, in the order the server produces their facts:
 *  · `verdict` — who won, with how many delegates (a page of the director: read, then the walk goes on);
 *  · `enact`   — the chain after the barrier, as beats: the Agenda step, the popular support, the enactment;
 *  · `reward`  — what the law paid THIS seat (the wave), or the seat's own ask, or the wait on another;
 *  · `renewal` — the voting area is RENEWED («Обновление»): the losers leave (their delegates home
 *                first), the discard turns over when the deck is empty, revealed cards are rejected,
 *                the fresh ones are dealt with a real turn, the support seats on them, the lobby
 *                refills — the whole of it on the TABLE, played from the server's journal, turned by
 *                the director; a FINAL sitting has no such page at all;
 *  · `results` — the results card; A answers the confirmation («Закрыть заседание»).
 */
export type SittingStage = 'verdict' | 'enact' | 'reward' | 'renewal' | 'results';

/**
 * What the REWARD stage is doing for THIS seat right now.
 *  · `reading`   — before the effects: the reading of what is coming;
 *  · `choice` / `distribution` / `intake` / `discard` / `colony` / `placement` — the viewer's own ask, hosted in
 *                  the stage's zone (or behind «К полю»): a pick of ONE recipient, a LAYOUT of a payout over
 *                  several holders (the shared distribution step's marker), a take, a DISCARD from hand
 *                  (the second half of Pluto's «draw 1, then discard 1» — the hand as a hosted step), the
 *                  winner's COLONY (Colony Contest — the colonies screen as a hosted step, its whole build
 *                  chain inside it), a tile;
 *  · `waiting`   — the effects ask ANOTHER seat (the honest wait line);
 *  · `received`  — the viewer's record is in: paid, or skipped with its reason (the plate names it).
 */
export type SittingRewardStep = 'reading' | 'choice' | 'distribution' | 'intake' | 'discard' | 'colony' | 'placement' | 'waiting' | 'received';

/**
 * The steps in which the seat WORKS in the stage's zone — a hosted surface stands there (the field). The picker,
 * the layout and the take are the TASK HOST's; the discard and the colony are workspace FRAMES (the hand, the
 * colonies) teleported into the same zone through the Parliament frame's slot.
 */
export const SITTING_HOSTED_STEPS: ReadonlySet<SittingRewardStep> = new Set<SittingRewardStep>(['choice', 'distribution', 'intake', 'discard', 'colony']);

/**
 * THE FIELD AND THE STEP'S DOOR — two facts of the reward stage, derived once for the section, the shell
 * and the specs (Colonial Affairs, block C):
 *  · `pose` — the stage takes the FIELD (the overview recedes, the enacted card is carried onto the hero
 *    slot, the zone opens): for a HOSTED STEP once the wave that arrived with it has flown, and for the
 *    whole reward page when the resolution reads a LEDGER (the colony bonuses — its rows are the wave's
 *    sources, so the body must stand BEFORE the wave, not after it);
 *  · `stepOpen` — a hosted step may teleport INTO the zone: the ask stands and nothing is owed to the
 *    ledger or in the air (one press, several effects — the surfaces go in turn). With a ledger body the
 *    two differ for the length of the wave: the field stands, the door is still shut.
 *
 * `hosting` — a step that is a workspace FRAME still stands inside the Parliament (`workspaceFrameHasNested`):
 * the colonies after the winner's pick was answered — its build scene flying the cube, the tile's own bonus
 * asking where the floaters go — while the server's position already reads «received». A host may not drop
 * its zone under a step standing in it (the stack's own law), so the field and the door stay open until the
 * frame has LEFT; the walk holds the page for the same reason (`mayLeave`). The frame is PUSHED the moment the
 * prompt is admitted — before the wave that arrived with it has flown — so `hosting` never opens the door on its
 * own: the wave still comes first (measured: the grid stood 2.4 s before the titanium touched the rail).
 */
export function sittingFieldOf(stage: SittingStage, rewardStep: SittingRewardStep, rewardPending: boolean, ledger: boolean, hosting = false, receipt = false,
  answer = false): {pose: boolean, stepOpen: boolean} {
  // «ОТВЕТ СТОЛА» (TR78 Arwind Inc.): the winner's table answers its step of the Career ON THE ENACTMENT PAGE, after
  // its ПОВЕСТКА — a receipt playing, or a question the chain waits on (`answer` = the answer stage stands as a layer
  // of the reward chassis): the field opens for it; the support and the enactment play on the same page after it.
  if (stage === 'enact' && answer) {
    return {pose: true, stepOpen: !rewardPending};
  }
  if (stage !== 'reward') {
    return {pose: false, stepOpen: false};
  }
  const stepOpen = (SITTING_HOSTED_STEPS.has(rewardStep) || hosting) && !rewardPending;
  // A RECEIPT OF THE TABLE (Sponsored Projects — a card payout that asked nobody) holds the field from the record's
  // arrival to the receipt's departure: the take leaves the zone and the receipt stands in it — one field, never a
  // fold between the two. The answer stage (a law's step of the Career answered by the table) holds it the same way.
  return {pose: stepOpen || ledger || receipt || answer, stepOpen};
}

/**
 * A STEP THAT IS A WHOLE WORKSPACE TAKES THE STAGE WHOLE (the owner, 2026-10-29 — law 22's «a full-size step takes the
 * whole stage», on the sitting's own zone): the colonies grid of the winner's free colony (Colony Contest) — the step
 * the server names `colony`, or the colonies FRAME standing on the Parliament (its build scene, its bonus's own pick,
 * after the server's position already reads «received») — is never squeezed into the column beside the carrier card.
 * The picker, the take and the hand's discard keep the hero column (their ledger / their card row reads beside it).
 */
export function sittingStepTakesStage(field: boolean, rewardStep: SittingRewardStep, coloniesHostedHere: boolean): boolean {
  return field && (rewardStep === 'colony' || coloniesHostedHere);
}

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
  /** The confirmation this step ends in — the sitting's `done`, «Закрыть заседание». */
  gate?: ParliamentPhaseStage;
  /** The viewer's own confirmation stands — A on the results answers it. */
  gateStanding: boolean;
  /** The REWARD stage's step for this seat (meaningful while `pages` includes `reward`, i.e. always past the verdict). */
  rewardStep: SittingRewardStep;
  /** The seat the effects are asking right now, when it is somebody else — and what kind of answer. */
  waitingFor?: {player: Color, input?: PlayerInputType};
  /**
   * THE CHAIN IS PAUSED AT THE CAREER (TR78 Arwind Inc.): a card of the winner's table answers its step of the Career
   * with a question, and the support and the enactment wait for the answer (`phase.pending` — `careerPausedAt`). The
   * enactment page stops after its ПОВЕСТКА; `waitingFor` names the asked seat for every other one.
   */
  career?: true;
  /**
   * The viewer's placement is the ENGINE's own follow-up of the seat's own step (the 0 °C ocean the winner's
   * temperature step set off — Mohole Contest), not a question the resolution raised: the server names this
   * seat as asked at that step (`pending`) and the prompt is a board placement with no resolution source. It
   * stands behind the SAME door as the resolution's own tile (a placement admitted at once took the screen
   * before the step's wave had flown) — but the sitting's WALK opens that door once its page is quiet, never
   * a press — and it holds the reward page exactly as the tile would (a step is owed until it is placed).
   */
  tail?: boolean;
  /**
   * THE EARLY CLOSE stands for the viewer (the soft gates): the chain waits on another seat and nothing is asked of
   * this one — A on the reward page closes its sitting now; a question the law asks it later comes as a prompt.
   */
  earlyClose?: true;
  /** The viewer CLOSED this sitting early and the law asks it a question now — a fresh beat (it stands in no sitting otherwise). */
  closed?: true;
  /** The viewer's part of the law is still AHEAD (a step of its plan not yet applied — it MAY be asked). */
  askedLater?: true;
};

/** The viewer's own resolution-sourced ask, by its structural markers — never a title. */
export function sittingAskOf(wf: PlayerInputModel | undefined): 'choice' | 'distribution' | 'intake' | 'discard' | 'colony' | 'placement' | undefined {
  // A table's answer to the winner's step of the Career (TR78) is a step of the sitting's own (the chain waits on
  // it): the family's pick, or its LAYOUT when the walk owed several units over several holders.
  if (sittingReactionOf(wf) !== undefined) {
    return wf?.type === 'and' ? 'distribution' : 'choice';
  }
  if (wf === undefined || sittingAskResolution(wf) === undefined) {
    return undefined;
  }
  if (externalDrawTakeOf(wf) !== undefined) {
    return 'intake';
  }
  if (wf.type === 'space') {
    return 'placement';
  }
  // The winner's COLONY (Colony Contest): a `SelectColony` the resolution raised — the colonies SCREEN is the
  // hosted step (a frame in the Parliament's slot, like the hand's discard), never the task host's picker.
  if (wf.type === 'colony') {
    return 'colony';
  }
  // The shared discard's marker (`DiscardCards` → `discardPrompt`): a card LEAVES the hand — the hand
  // itself is the hosted step (its discard mode), never the recipient picker.
  if (isDiscardPrompt(wf)) {
    return 'discard';
  }
  // The shared distribution step's marker: a LAYOUT over several holders, not a pick of one recipient.
  if (wf.cardResourceDistributionPrompt !== undefined) {
    return 'distribution';
  }
  return 'choice';
}

/**
 * A PLACEMENT THAT IS THE STEP'S OWN TAIL — the engine's follow-up of a step of THIS seat's (the ocean of
 * 0 °C after the winner's temperature step; Europa's ocean under the winner's colony): the prompt carries
 * no resolution source, but the server's position names this seat as the one its step is asking
 * (`phase.pending`, published from the driver's own step window), and the ask is a board placement.
 * Structural on both sides — the position and the prompt's type — never a title.
 */
export function sittingTailPlacementOf(wf: PlayerInputModel | undefined, phase: ParliamentPhaseModel | undefined, viewer: Color | undefined): boolean {
  if (wf === undefined || phase === undefined || viewer === undefined || wf.type !== 'space' || sittingAskResolution(wf) !== undefined) {
    return false;
  }
  const pending = phase.pending;
  return phase.step === 'effects' && pending !== undefined && pending.player === viewer && pending.input === 'space';
}

/** The viewer's confirmation, if it stands: the server's own marker. */
export function sittingGatePromptOf(wf: PlayerInputModel | undefined): ParliamentPhaseStage | undefined {
  return wf?.parliamentPhasePrompt?.stage;
}

/** The viewer's OWN records in the live phase (the effects so far). */
function viewerOutcomes(phase: ParliamentPhaseModel, viewer: Color | undefined): Array<ParliamentEnactOutcomeModel> {
  return viewer === undefined ? [] : (phase.outcomes ?? []).filter((o) => o.player === viewer);
}

/** The steps at which the verdict is known and NOTHING has changed yet — never on the wire since the soft gates (the legacy step maps here). */
const VERDICT_STEPS: ReadonlySet<string> = new Set(['winner', 'assembly']);

/**
 * The pages of a step. The chain runs in one go on the server, so the
 * response that brings the sitting brings everything up to the law's first
 * ask, or up to its end: every step's walk STARTS on the verdict (played from
 * the summary, the table held as it was voted). The EFFECTS step (a law
 * asking) reads the verdict, the enactment's beats and the reward; `done` — a
 * seat that has not closed its sitting — reads the whole: the RENEWAL and the
 * RESULTS too; in the FINAL phase nothing is renewed, so that page does not
 * exist (neither a beat nor a band line — the rules run no refresh, and the
 * walk shows none). The transient server steps (`agenda` / `support` /
 * `enact`, `refresh` / `lobby`) are never on the wire; they map onto the
 * page they belong to, and so do the legacy gates of an older save.
 */
export function sittingPagesOf(step: ParliamentPhaseModel['step'], final: boolean): ReadonlyArray<SittingStage> {
  switch (step) {
  case 'winner':
  case 'assembly':
    return ['verdict'];
  case 'agenda':
  case 'support':
  case 'enact':
    return ['verdict', 'enact'];
  case 'effects':
    return ['verdict', 'enact', 'reward'];
  case 'refresh':
  case 'lobby':
  case 'adjourn':
  case 'done':
    return final ? ['verdict', 'enact', 'reward', 'results'] : ['verdict', 'enact', 'reward', 'renewal', 'results'];
  }
}

/**
 * A page the walk turns BY ITSELF once its beats have landed (the verdict's
 * reading, the enactment's chain, the reward's wave, the renewal's tact) — the
 * player presses nothing between the verdict and the results. The RESULTS are
 * the one STOP: the confirmation is answered by A, never by the director.
 */
export function sittingPageAuto(stage: SittingStage): boolean {
  return stage !== 'results';
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
  const gate: ParliamentPhaseStage | undefined = phase.step === 'done' ? 'close' : undefined;
  const gateStanding = gate !== undefined && sittingGatePromptOf(wf) === gate;
  const tail = sittingTailPlacementOf(wf, phase, viewer);
  const ask = sittingAskOf(wf) ?? (tail ? 'placement' : undefined);
  // A seat that CLOSED this sitting early stands in it no more — unless the law asks it a question now (the soft gates).
  if (ask === undefined && (phase.closed ?? []).includes(viewer)) {
    return undefined;
  }
  const pending = phase.pending;
  const career = careerPausedAt(phase);
  // …and while the chain is paused at the CAREER (TR78), the asked seat is named the same way.
  const waitingFor = (phase.step === 'effects' || career) && pending !== undefined && pending.player !== viewer ?
    {player: pending.player, input: pending.input} : undefined;
  let rewardStep: SittingRewardStep;
  if (ask !== undefined) {
    rewardStep = ask;
  } else if (VERDICT_STEPS.has(phase.step) || phase.step === 'agenda' || phase.step === 'support' || phase.step === 'enact') {
    rewardStep = 'reading';
  } else if (waitingFor !== undefined) {
    rewardStep = 'waiting';
  } else if (viewerOutcomes(phase, viewer).length > 0 || phase.step !== 'effects') {
    rewardStep = 'received';
  } else {
    rewardStep = 'waiting';
  }
  const early = phase.step !== 'done' && wf?.parliamentPhasePrompt?.stage === 'close' && wf.parliamentPhasePrompt.early === true;
  return {
    generation: phase.generation,
    final: phase.final,
    step: phase.step,
    pages: sittingPagesOf(phase.step, phase.final),
    gate,
    gateStanding,
    rewardStep,
    waitingFor,
    ...(tail ? {tail: true} : {}),
    ...(career ? {career: true} : {}),
    ...(early ? {earlyClose: true} : {}),
    ...((phase.closed ?? []).includes(viewer) ? {closed: true} : {}),
    ...((phase.ahead ?? []).includes(viewer) ? {askedLater: true} : {}),
  };
}

/**
 * WHERE A STEP'S WALK STARTS: on the first page whose beats have NOT played
 * this session (`played`) — unless the sitting is at its end and the seat's
 * confirmation does not stand (a foreign prompt still holds its slot): then
 * the results are the only honest place. Server-derived, so a reload never
 * re-asks a question the seat has answered and never skips one it has not;
 * session-derived, so a page turned back and forth replays nothing. A tile
 * RECEIPT owed (the frame is back from the board with the winner's tile
 * placed) seats the walk on the REWARD page first — «получено» is read before
 * the results.
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
 * flying to or from — which is why the RENEWAL is a page of its own with the ROW for its body (the
 * losers leave, the deck turns over, the deal, the support, the lobby — every one of them flies to or
 * from an object of the table) and only the card AFTER it is the panel, and why placing the winner's tile
 * is not a body state at all (the stack yields to the board and comes back).
 */
export type SittingBody = 'parties' | 'step' | 'results';

/**
 * `field` is the section's own fact: a hosted step of this seat's stands in the zone. The results page
 * is the panel from its first frame — the physical part of the sitting ended on the renewal page, so
 * nothing is left to fly under it (the card's rows still REVEAL inside it, by the director's cascade).
 */
export function sittingBodyOf(stage: SittingStage, field: boolean): SittingBody {
  if (field) {
    return 'step';
  }
  return stage === 'results' ? 'results' : 'parties';
}

/** Is the local cursor on the step's LAST page (the page whose A answers the confirmation, or has nothing left to turn)? */
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
  return position.rewardStep === 'received';
}

/**
 * THE CRUMB'S TAIL — an i18n key per stage; the reward's tail names the STEP
 * the seat is actually in (a pick, a take, a placement), so the line reads
 * «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЫБОР» while the picker stands. One word each,
 * never echoing the root's noun (`consoleWorkspaceHeader` grammar).
 */
export function sittingStageKey(stage: SittingStage, rewardStep: SittingRewardStep, removal = false): string {
  switch (stage) {
  case 'verdict': return 'Verdict';
  case 'enact': return 'Enactment';
  case 'reward':
    switch (rewardStep) {
    case 'choice': return 'Choice';
    case 'distribution': return 'Distribution';
    case 'intake': return 'Intake';
    case 'discard': return 'Discarding';
    case 'colony': return 'Colonies';
    // A board step that TAKES a tile off (Water Export's ocean — the server's `placementEffect: 'remove'`)
    // is the same door and the same pose as the winner's tile, but the tail must not promise a placement.
    case 'placement': return removal ? 'Removal' : 'Placement';
    default: return 'Reward';
    }
  case 'renewal': return 'Renewal';
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
 *  · the confirmation's answer in flight is `executing` (input absorbed by phase).
 */
export function sittingWorkspacePhase(stage: SittingStage, submitting: boolean): WorkspacePhase {
  if (submitting) {
    return 'executing';
  }
  return stage === 'results' ? 'verdict' : 'committed';
}

/**
 * THE A VERB on a page — an i18n key, or undefined when A does nothing here
 * (a page the director turns — the verdict among them —, a hosted step that
 * owns the bar, a wait pose; A during a beat is «дожать», the motion's own).
 *  · the REWARD's placement step offers the ONE door to the board («К полю» —
 *    the tile is placed only by that press, never by the prompt's arrival);
 *  · the RESULTS answer the confirmation («Закрыть заседание»).
 */
export function sittingPrimaryKey(position: SittingPosition, page: number): string | undefined {
  const stage = sittingStageAt(position, page);
  switch (stage) {
  case 'reward':
    // The resolution's own tile waits behind the door for the player's press; the engine's TAIL (the 0 °C
    // ocean of the winner's step) waits behind it for the WALK — nothing to press.
    if (position.rewardStep === 'placement' && position.tail !== true) {
      return 'Onto the board';
    }
    // THE EARLY CLOSE (the soft gates): the chain waits on another seat and nothing is asked of this one — A closes.
    return position.earlyClose === true ? 'Close the sitting' : undefined;
  case 'results':
    return position.gate === 'close' && position.gateStanding ? 'Close the sitting' : undefined;
  default:
    return undefined;
  }
}

/**
 * THE MANDATORY FLOW BEAT — one announcement per sitting («Парламент
 * собрался · поколение N»), keyed on the SITTING's generation so it stays the
 * SAME beat through every ask of the enacted resolution and the confirmation:
 * acknowledged once at the open, gone when this seat has closed it. Derived
 * from the server's own phase record — the seat's own (`done` until its
 * «Закрыть заседание» answers, while the next generation already runs around
 * it) — exactly like the draft's `draft:gen<N>`.
 */
export function parliamentSittingFlowBeat(view: PlayerViewModel): MandatoryFlowBeat | undefined {
  const position = sittingPositionOf(view.game.parliament, view.waitingFor, view.thisPlayer?.color);
  if (position === undefined) {
    return undefined;
  }
  // A seat that CLOSED the sitting early stands in it only while the law asks it a question (`sittingPositionOf`): that
  // is a FRESH beat — its own key, so the plate announces it anew and A opens the sitting on that very step.
  if (position.closed === true) {
    return {key: `parliament:gen${position.generation}:ask`, taskKind: 'parliamentPhase', flow: 'parliament-phase'};
  }
  return {key: `parliament:gen${position.generation}`, taskKind: 'parliamentPhase', flow: 'parliament-phase'};
}

/**
 * THE GENERATION THE SEAT IS IN — the sitting's while it still stands for this
 * seat (the next generation does not begin for it before its own close), the
 * game's otherwise. The counter on the strip and the generation scene's flip
 * read THIS, so the flip plays at the seat's own «Закрыть заседание».
 */
export function presentedGeneration(view: PlayerViewModel | undefined): number {
  return view?.game.parliament?.phase?.generation ?? view?.game.generation ?? 0;
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

/** The steps at which the verdict stands and the table is still exactly as voted (never on the wire since the soft gates). */
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
