/*
 * THE PARLIAMENT SECTION'S DECISIONS — the members of `ConsoleParliamentSection.vue` its unit spec runs against a stub
 * (`tests/client/console/parliamentQuestionDoor.spec.ts` — what the question door DECIDES and touches, and which run of
 * a card's walk a callback may end; never the mount of the section): the question door and the checks it stands on,
 * the folds it closes a finished stage by, and the walk run's own identity.
 *
 * Each function is the member's body with the section handed in as a PORT (`self`) — exactly the fields that body
 * reads, writes and calls. A body that calls another of these members calls it THROUGH the port, so a stub may answer
 * for it. The component builds the port once (accessors over its props, refs and computeds, arrows over its functions)
 * and each member there is a one-line delegate; the spec hands a stub. A body that reads nothing of the section
 * (`retireFinishedFlows`, `walkRunAlive`) takes no port.
 */
import {ParliamentPromptBridge} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentFlow, parliamentStageKind} from '@/client/console/parliament/consoleParliamentFlow';
import {chairmanQuestFlow, releaseChairmanQuestHolds, resetChairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {killChairmanQuestBeats} from '@/client/console/parliament/chairmanQuestDirector';
import {killSittingMotion} from '@/client/console/parliament/sittingDirector';
import {agendaWalkFlow, releaseAgendaWalkHolds} from '@/client/console/parliament/agendaWalk';
import {neutralRallyFlow} from '@/client/console/parliament/neutralRally';
import {tableAnswerOwedTo, takeTableAnswer, TableAnswer} from '@/client/console/parliament/tableAnswerBeat';
import {setWorkspaceFramePhase} from '@/client/console/consoleWorkspaceStack';

/**
 * THE PORT — what the bodies below read, write and call of the section. The component serves it with accessors over
 * its props, refs and computeds (read lazily) and arrows over its functions; the spec serves a stub.
 */
export type ParliamentSectionPort = {
  // ── props
  readonly warm: boolean,
  readonly leaving: boolean,
  readonly embedded: boolean,
  // ── computeds the bodies read
  readonly sittingUp: boolean,
  readonly questGate: {generation: number} | undefined,
  readonly bridge: Pick<ParliamentPromptBridge, 'seat' | 'grant' | 'supportPick' | 'bannerPick' | 'delegatePick'>,
  // ── state the bodies WRITE
  reconciledKey: string,
  walkOwed: boolean,
  // ── the mode stages standing on the section's template refs, by their ref keys (a mode that is not mounted is absent)
  readonly refs: {
    readonly supportMode?: {closeFinished?: () => void},
    readonly bannerMode?: {closeFinished?: () => void},
    readonly delegateMode?: {closeFinished?: () => void},
  },
  // ── the members below, called through the port
  standingDoorOwed(): boolean,
  standingQuestionServed(): boolean,
  overviewServesQuestion(): boolean,
  foldFinishedStage(): boolean,
  retireFinishedFlows(): void,
  retireQuestFlow(): void,
  closeStage(): void,
  walkRunAlive(seq: number): boolean,
  // ── the section's other members
  /** The vote mode standing on its ref (undefined while it is not mounted) — the door folds a finished vote by its own leave. */
  voteModeNow(): {closeVote(): void} | undefined,
  reconcileStandingPrompts(): void,
  playHostedAnswer(answer: TableAnswer, alive: () => boolean, done: () => void): void,
  $nextTick(fn: () => void): Promise<void>,
};

/**
 * A STANDING PROMPT ONE OF THE OVERVIEW'S DOORS OPENS — the same set `reconcileStandingPrompts` asks (a staged
 * door the player walked back out of is theirs to reopen, never a debt).
 */
export function standingDoorOwed(self: ParliamentSectionPort): boolean {
  const b = self.bridge;
  return self.questGate !== undefined || b.seat !== undefined || (b.grant !== undefined && b.grant.staged !== true) ||
    (b.supportPick !== undefined && b.supportPick.staged !== true) || b.bannerPick !== undefined ||
    (b.delegatePick !== undefined && b.delegatePick.staged !== true);
}

/**
 * THE QUESTION DOOR (`frameQuestionDoor.ts`, ledger HC — the field lock of 2026-11-07): the shell's guarded
 * conclusion HELD this Parliament for a question it serves. The vote that completed the chairman's quest reported
 * its flow finished from `landed` — and the quest's stage opens only from the OVERVIEW, which the finished vote
 * never folded back to: the conclusion waited for the answer, the door waited for the conclusion. So the flow does
 * not leave, it goes on IN PLACE: a finished stage folds back (the vote's own leave, a mode's own close), the
 * overview's doors open the question's stage.
 *
 * «SERVED» MUST BE TRUE (wait graph W2 / R1): the shell DROPS its owe on `true` — the question's own flow is trusted
 * to report its ending. So `true` only when, after this door's action, a stage of this section really serves the
 * question (`standingQuestionServed` — the quest stage for the gate, the seat / grant / pick mode for those), or
 * will by its own pending fold (a finished stage folding to the overview whose door opens the question on the next
 * tick). A door that cannot serve — embedded, warm, leaving, a stage at work for something else, an overview whose
 * door stays shut (a walk owed in front of the quest gate) — does NOTHING and answers `false`: the conclusion stays
 * owed, never an orphan the owe no longer tracks.
 */
export function serveStandingQuestion(self: ParliamentSectionPort): boolean {
  if (self.warm || self.leaving || self.embedded || !self.standingDoorOwed()) {
    return false;
  }
  // A stage at work FOR this very question serves it already — nothing to do.
  if (self.standingQuestionServed()) {
    return true;
  }
  // Everything below folds back to the overview and asks its doors: worth doing only when a door there OPENS it.
  if (!self.overviewServesQuestion()) {
    return false;
  }
  const stage = parliamentFlow.stage;
  if (stage === 'landed' || stage === 'access') {
    // The vote is over and read: its own leave brings the overview back, and the overview's doors are asked at once
    // (never only through the stage watcher — a pass already spent on this server position would skip it).
    self.voteModeNow()?.closeVote();
    if (parliamentFlow.stage !== 'browse') {
      self.closeStage();
    }
    self.retireFinishedFlows();
    self.reconciledKey = '';
    void self.$nextTick(() => self.reconcileStandingPrompts());
    return true;
  }
  if (stage !== 'browse') {
    // A FINISHED stage folds back by its own close (the mode unmounts before the overview's door re-arms it); a
    // stage still at work for something else is not this door's to cut.
    if (!self.foldFinishedStage()) {
      return false;
    }
    self.retireFinishedFlows();
    self.reconciledKey = '';
    void self.$nextTick(() => self.reconcileStandingPrompts());
    return true;
  }
  self.retireFinishedFlows();
  self.reconciledKey = '';
  self.reconcileStandingPrompts();
  return self.standingQuestionServed();
}

/**
 * DOES A STAGE OF THIS SECTION SERVE THE STANDING QUESTION NOW? Per door, the stage that answers it: the quest's own
 * flow (its stage, its seat pick, its submit) for the gate; the seat pick for a stand-alone seat; the vote mode (its
 * pick, its payment, its submit) for a live grant; the support / banner / delegate mode — not yet `done` — for its
 * live pick. A SITTING standing serves every door: the phase's asks are hosted in its own field, and its end folds
 * back to the overview by its own hand (`endSitting` → `closeStage`, the overview's doors asked on the way back).
 */
export function standingQuestionServed(self: ParliamentSectionPort): boolean {
  const f = parliamentFlow;
  const b = self.bridge;
  const kind = parliamentStageKind();
  if (self.sittingUp && kind === 'sitting') {
    return true;
  }
  const questUp = chairmanQuestFlow.live && chairmanQuestFlow.beat !== 'done';
  if (self.questGate !== undefined && questUp && (kind === 'quest' || kind === 'seat')) {
    return true;
  }
  if (b.seat !== undefined && kind === 'seat') {
    return true;
  }
  if (b.grant !== undefined && b.grant.staged !== true && (kind === 'vote' || f.stage === 'paying')) {
    return true;
  }
  if (b.supportPick !== undefined && b.supportPick.staged !== true && kind === 'support' && f.supportBeat !== 'done') {
    return true;
  }
  if (b.bannerPick !== undefined && kind === 'banner' && f.bannerBeat !== 'done') {
    return true;
  }
  return b.delegatePick !== undefined && b.delegatePick.staged !== true && kind === 'delegate' && f.delegateBeat !== 'done';
}

/**
 * WOULD THE OVERVIEW'S DOOR OPEN THE STANDING QUESTION? The same conditions its watchers read, with a FINISHED walk
 * or quest counted as gone (the fold retires them — `retireFinishedFlows`): the quest gate opens only in a
 * Parliament the player walked into, with no walk owed in front of it and no quest flow still running; the seat, a
 * live grant and a live pick always open.
 */
export function overviewServesQuestion(self: ParliamentSectionPort): boolean {
  const b = self.bridge;
  const walkInFront = agendaWalkFlow.owed !== undefined && agendaWalkFlow.beat !== 'done';
  const questRunning = chairmanQuestFlow.live && chairmanQuestFlow.beat !== 'done';
  if (self.questGate !== undefined && !self.embedded && !walkInFront && !questRunning) {
    return true;
  }
  return b.seat !== undefined || (b.grant !== undefined && b.grant.staged !== true) ||
    (b.supportPick !== undefined && b.supportPick.staged !== true) || b.bannerPick !== undefined ||
    (b.delegatePick !== undefined && b.delegatePick.staged !== true);
}

/**
 * FOLD A FINISHED STAGE back to the overview through its own close: a support / banner / delegate mode whose beat
 * reads `done` (its `flow-complete` was reported, the conclusion held), the chairmanship flow that has played every
 * beat, a card's walk or rally that has ended. `false` — the stage is still at work: nothing is touched.
 */
export function foldFinishedStage(self: ParliamentSectionPort): boolean {
  const f = parliamentFlow;
  type ModeRef = {closeFinished?: () => void} | undefined;
  switch (f.stage) {
  case 'support':
  case 'banner':
  case 'delegate': {
    const beat = f.stage === 'support' ? f.supportBeat : f.stage === 'banner' ? f.bannerBeat : f.delegateBeat;
    if (beat !== 'done') {
      return false;
    }
    const ref = f.stage === 'support' ? 'supportMode' : f.stage === 'banner' ? 'bannerMode' : 'delegateMode';
    ((self.refs[ref] ?? undefined) as ModeRef)?.closeFinished?.();
    self.closeStage();
    return true;
  }
  case 'quest':
    if (!chairmanQuestFlow.live || chairmanQuestFlow.beat === 'done') {
      self.retireQuestFlow();
      return true;
    }
    return false;
  case 'walk':
    if (!agendaWalkFlow.live || agendaWalkFlow.beat === 'done') {
      self.closeStage();
      return true;
    }
    return false;
  case 'rally':
    if (!neutralRallyFlow.live || neutralRallyFlow.beat === 'done') {
      self.closeStage();
      return true;
    }
    return false;
  default:
    return false;
  }
}

/**
 * A FINISHED walk's record (its beat `done` — the support mode's step, a walk pose that ended) and a finished
 * chairmanship flow still standing as records would keep the quest gate's door shut for good: they are retired
 * here, their holds already consumed (released again — honestly idempotent).
 */
export function retireFinishedFlows(): void {
  if (agendaWalkFlow.owed !== undefined && agendaWalkFlow.beat === 'done') {
    releaseAgendaWalkHolds('walk-retired');
  }
  if (chairmanQuestFlow.live && chairmanQuestFlow.beat === 'done' && parliamentFlow.stage !== 'quest') {
    killChairmanQuestBeats();
    releaseChairmanQuestHolds('quest-retired');
    resetChairmanQuestFlow();
  }
}

/**
 * IS THE WALK RUN `seq` STILL THE ONE PLAYING? (wait graph R5) The run's own record is still the owed one and the
 * flow still plays it — a callback of a run that was released, or replaced by the next queued record, ends nothing.
 */
export function walkRunAlive(seq: number): boolean {
  return agendaWalkFlow.live && agendaWalkFlow.owed?.seq === seq;
}

/** …after a card's walk: the table's receipt plays on the section's own stage before the walk reads «done». */
export function playWalkAnswer(self: ParliamentSectionPort, seq: number, onDone: () => void): void {
  // A run that is no longer the one playing ends nothing (and takes no receipt that belongs to the next walk).
  if (!self.walkRunAlive(seq)) {
    return;
  }
  const answer = tableAnswerOwedTo('walk') ? takeTableAnswer('walk') : undefined;
  if (answer === undefined) {
    onDone();
    return;
  }
  agendaWalkFlow.beat = 'answer';
  self.playHostedAnswer(answer, () => self.walkRunAlive(seq), () => {
    if (self.walkRunAlive(seq)) {
      onDone();
    }
  });
}

/** The chairmanship's teardown without the report (the question door folds a finished flow in place). */
export function retireQuestFlow(self: ParliamentSectionPort): void {
  killChairmanQuestBeats();
  releaseChairmanQuestHolds('quest-closed');
  resetChairmanQuestFlow();
  self.closeStage();
}

export function closeStage(self: ParliamentSectionPort): void {
  killSittingMotion();
  self.walkOwed = false;
  // The retired government zone (a sitting, a quest, a walk park the cursor there) folds onto the tile that
  // replaced it — never a ring on the government plate until the first d-pad press (PL-509).
  if (parliamentFlow.zone === 'government') {
    parliamentFlow.zone = 'ruler';
  }
  parliamentFlow.stage = 'browse';
  setWorkspaceFramePhase('parliament', 'browse');
}
