import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {SITTING_SUBJECT_KEY} from '@/client/console/parliament/consoleSittingFlow';

/*
 * THE PARLIAMENT WORKSPACE'S FLOW STATE (Turmoil Redux) — two records.
 *
 *  · `consoleParliamentUi` is the SHELL-FACING half: the live command contract
 *    the section publishes for the ONE command bar, and the standing of the
 *    zones the shell teleports into. Module state so it survives the section's
 *    own remounts; the section writes, the shell reads — the bar never guesses.
 *
 *  · `parliamentFlow` is the SECTION-INTERNAL half: the stage machine (zone ·
 *    stage · the stage a submit left) and the vote's transient presentation
 *    (its snapshot, the delegate in flight, the source the bench still paints)
 *    — shared by the root and its tier components, which read and write ONE
 *    record instead of threading the same six facts through props and emits.
 *    It is reset by the section on mount and on unmount, so its lifetime is
 *    the section's own: a re-opened Parliament always starts on its browse
 *    layer, exactly as a fresh component's `data()` did — and the SITTING
 *    re-derives its stage from the SERVER's step on every mount (there is no
 *    client memory of «already seen»: the political phase is game state, the
 *    section only reads it — docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §3).
 */
export const consoleParliamentUi = reactive({
  commands: [] as Array<ConsoleCommand>,
  /** The VOTE STEP stands (its payment zone `[data-embed-slot="parliament-vote"]` is in the DOM — published post-flush by the section). */
  voteStanding: false,
  /**
   * The SITTING'S STAGE stands (its zone `[data-embed-slot="parliament-stage"]`
   * is in the DOM — published post-flush by the section): the enacted
   * resolution's payout pick and the take of the cards it drew teleport there.
   */
  stageStanding: false,
  /**
   * The SITTING'S REWARD STAGE HOLDS THE FIELD — its recipient zone is OPEN
   * (published post-flush by the section, one beat after the stage itself):
   * the hosted step's door. It waits for what the field waits for — the
   * reward beat that arrived in the same response as the ask (a payout's wave
   * plays FIRST, then the take deals; «surfaces go in turn»).
   */
  fieldStanding: false,
  /** The Agenda marker is gliding along the track — an Agenda card reward's cover waits for it to settle. */
  agendaSettling: false,
  /**
   * THE DOOR TO THE BOARD IS OPEN (v2): the winner's tile is placed ONLY by the
   * player's own press on the sitting's reward stage («К полю»). Until then the
   * board placement the server raised is HELD (the shell's `placementHeld`
   * reads this): the hexes stay dark, the stack stays, the stage reads the
   * tile. The press opens the door; the placement's end (or the stage's
   * absence) closes it again.
   */
  boardDoorOpen: false,
});

export function resetConsoleParliamentUi(): void {
  consoleParliamentUi.commands = [];
  consoleParliamentUi.voteStanding = false;
  consoleParliamentUi.stageStanding = false;
  consoleParliamentUi.fieldStanding = false;
  consoleParliamentUi.agendaSettling = false;
  consoleParliamentUi.boardDoorOpen = false;
}

// ── the session's memory of PLAYED stages ──────────────────────────────────

/**
 * WHICH STAGES OF WHICH SITTING have already played their beats IN THIS
 * SESSION. Presentation memory, never game truth (the position is always the
 * server's step; `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` §3.1 names the
 * sitting's `seq` as exactly this key): the sitting's frame steps aside for
 * the winner's tile and comes back (`yieldsToBoard`), and a page turned back
 * and forth must not replay a card that already moved. A reload starts a
 * fresh session, so the compact replay (`resume`) still plays there.
 */
const playedStages = new Map<string, Set<string>>();

export function notePlayedSittingStage(sitting: string, stage: string): void {
  let set = playedStages.get(sitting);
  if (set === undefined) {
    set = new Set<string>();
    playedStages.clear();
    playedStages.set(sitting, set);
  }
  set.add(stage);
}

export function sittingStagePlayed(sitting: string, stage: string): boolean {
  return playedStages.get(sitting)?.has(stage) === true;
}

/** Has THIS session seen the sitting at all (any page played)? A reload has not — it lands in the final poses. */
export function sittingSessionKnown(sitting: string): boolean {
  return sitting !== '' && playedStages.has(sitting);
}

export function resetPlayedSittingStages(): void {
  playedStages.clear();
}

// ── the section-internal flow ──────────────────────────────────────────────

/** The browse layer's focus zones: the government's card · the RULING PARTY's tile in the government · the voting area · the five opposition tiles. */
export type ParliamentZone = 'voting' | 'government' | 'ruler' | 'parties';
/**
 * `vote` — the decision mode (a phase descent); `submitting` — sent;
 * `paying` — a paid vote's payment stands inside the mode; `landed` — the
 * answer arrived: the delegate settles on the card before the flow leaves.
 * `seat` — the chairman's mandatory pick; `sitting` — the political phase's
 * ONE flow («ЗАСЕДАНИЕ»: verdict → enactment → reward → renewal → closing),
 * whose stage is the server's step (`consoleSittingFlow`).
 */
export type ParliamentStage = 'browse' | 'vote' | 'seat' | 'submitting' | 'paying' | 'landed' | 'sitting';

/** The vote's numbers at the SUBMIT — the mode reads these until the delegate has landed (and the source the delegate leaves from). */
export type VoteSnapshot = {votes: number, mine: number, leader: Color | 'neutral' | undefined, winning: boolean, winner: string | undefined, source: 'lobby' | 'reserve'};

function freshFlow() {
  return {
    zone: 'voting' as ParliamentZone,
    stage: 'browse' as ParliamentStage,
    /** The stage the submit left — restored if the server refuses. */
    stageBeforeSubmit: 'browse' as ParliamentStage,
    /** The cursor inside the voting area: the vote mode's SELECTED card, the seat pick's candidate, the viewer's start. */
    slotIndex: 0,
    partyIndex: 0,
    /** The vote mode's entrance is playing — A is not a confirm yet. */
    voteEntering: false,
    /** The vote mode is folding back — its layer stays visible for the phrase. */
    voteLeaving: false,
    /** The vote's numbers at the submit (undefined = not sent yet). */
    voteSnapshot: undefined as VoteSnapshot | undefined,
    /** The bench keeps painting the source cube until its proxy stands over it. */
    sourceHold: undefined as 'lobby' | 'reserve' | undefined,
    /** …and the bench's WORDS (the lobby's note, the reserve's count) follow the cube only once it has visibly left its place. */
    sourceLeaving: undefined as 'lobby' | 'reserve' | undefined,
    /** The vote that just landed (its `seq`) — the cube the landing beat animates. */
    landedSeq: undefined as number | undefined,
    /** The vote whose cube is IN FLIGHT (hidden on the ribbon until the handoff). */
    flightSeq: undefined as number | undefined,
    /** The chair just received its delegate (the seat pick's landing) — the government's chair mark flashes (cleared by the flash's own `animationend`). */
    chairPulse: false,
    /**
     * THE SITTING'S LOCAL PAGE inside the server's step (v2: the verdict; then
     * the enactment → the reward → the results, turned by the director's
     * walk). Clamped by the step's page list, re-seated on every server step
     * change — presentation state, never a memory of the phase.
     */
    sittingPage: 0,
    /**
     * THE SITTING'S STAGE HAS TAKEN THE FIELD: a hosted step (the payout pick,
     * the take) stands in its zone, so the stage grows over the overview and
     * the enacted card is carried onto its hero slot — the tiers read it to
     * hand the card over (one DOM instance, teleported).
     */
    sittingField: false,
  };
}

export const parliamentFlow = reactive(freshFlow());

/** The seat / sitting stage's unfold / fold (the middle tier's stage zone). */
export const STAGE_UNFOLD_MS = 300;
export const STAGE_FOLD_MS = 220;

export function resetParliamentFlow(): void {
  Object.assign(parliamentFlow, freshFlow());
}

/** The chairman's delegate has landed on the seat mark: it flashes once (a CSS one-shot; the government clears the flag on `animationend`). */
export function pulseParliamentChair(): void {
  parliamentFlow.chairPulse = true;
}

/** The chair's flash has played out. */
export function settleParliamentChairPulse(): void {
  parliamentFlow.chairPulse = false;
}

// ── the crumb ──────────────────────────────────────────────────────────────

/**
 * ONE fixed line, two names: «Парламент › Осмотр» on the overview,
 * «Парламент › Голосование» in the vote mode, «Парламент › Заседание» for the
 * political phase — the MODE is the subject, never a card (a crumb that re-set
 * itself on every ◀ ▶ read as arriving somewhere else; a card name of any
 * length would move the zone beside it). The seat pick is a stage of the
 * overview; the sitting's stages are the phase's own (its tail advances,
 * `SITTING` never leaves the line).
 */
export function parliamentCrumbSubject(): string {
  switch (parliamentFlow.stage) {
  case 'vote':
  case 'paying':
  case 'landed':
    return 'Voting';
  case 'submitting':
    return parliamentFlow.stageBeforeSubmit === 'vote' ? 'Voting' :
      parliamentFlow.stageBeforeSubmit === 'sitting' ? SITTING_SUBJECT_KEY : 'Parliament overview';
  case 'sitting': return SITTING_SUBJECT_KEY;
  default: return 'Parliament overview';
  }
}

/**
 * The crumb's tail — the name of the place the player is in, never of a
 * beat: a submit is a transient beat, so the tail keeps the name of the
 * stage it left (the phase turns it amber) — relabelling it «Sending» for
 * the round-trip blinked the crumb three times. The sitting's tail is the
 * STAGE the sitting publishes (`sittingTail` — verdict, enactment, reward, a
 * hosted choice / take / placement, renewal, closing).
 */
export function parliamentCrumbStage(sittingTail: string): string {
  const stage = parliamentFlow.stage === 'submitting' ? parliamentFlow.stageBeforeSubmit : parliamentFlow.stage;
  switch (stage) {
  case 'paying': return 'Payment';
  case 'seat': return 'Seat';
  case 'sitting': return sittingTail;
  default: return '';
  }
}

export function parliamentCrumbCommitted(): boolean {
  const stage = parliamentFlow.stage;
  return stage === 'submitting' || stage === 'landed' || stage === 'paying' || stage === 'sitting';
}

/** The stage's CONTENT identity — a submit keeps the stage it left on screen (busy). */
export function parliamentStageKind(): ParliamentStage {
  return parliamentFlow.stage === 'submitting' ? parliamentFlow.stageBeforeSubmit : parliamentFlow.stage;
}

/** The vote mode stands over the overview. */
export function parliamentVoteUp(): boolean {
  const f = parliamentFlow;
  return f.stage === 'vote' || f.stage === 'paying' || f.stage === 'landed' || (f.stage === 'submitting' && f.stageBeforeSubmit === 'vote');
}

/** The three slots are in the vote row (up, or folding back — the leave animates them home first). */
export function parliamentSlotsCarried(): boolean {
  return parliamentVoteUp();
}

/** The seat / sitting stage stands in the middle tier. */
export function parliamentStageUp(): boolean {
  const kind = parliamentStageKind();
  return kind === 'seat' || kind === 'sitting';
}

/** The SITTING stands (its stage, or its gate answer in flight). */
export function parliamentSittingUp(): boolean {
  return parliamentStageKind() === 'sitting';
}

/**
 * THE VOTE IS IN THE AIR: from the submit to the cube's touchdown every
 * consequence the server already answered (the tally, the leader, the
 * winner badge on every card) keeps reading the pre-vote state — the
 * counters tick when the cube lands, not when the packet does.
 */
export function parliamentVoteInFlight(): boolean {
  const f = parliamentFlow;
  return f.voteSnapshot !== undefined &&
    (f.stage === 'submitting' || f.stage === 'paying' || (f.stage === 'landed' && f.landedSeq === undefined));
}

// ── the section's root element ─────────────────────────────────────────────

/** The section's own element — every measurement and every motion phrase is scoped to it; registered on mount, cleared on unmount. */
let rootEl: HTMLElement | undefined;

export function setParliamentRootEl(el: HTMLElement | undefined): void {
  rootEl = el;
}

export function parliamentRootEl(): HTMLElement | undefined {
  return rootEl;
}
