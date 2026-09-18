import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';

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
 *    layer, exactly as a fresh component's `data()` did.
 */
export const consoleParliamentUi = reactive({
  commands: [] as Array<ConsoleCommand>,
  /** The results scene already played for this `<viewer>:<generation>` — it plays ONCE per generation. */
  recapSeen: '' as string,
  /** The VOTE STEP stands (its payment zone `[data-embed-slot="parliament-vote"]` is in the DOM — published post-flush by the section). */
  voteStanding: false,
  /** The ENACTMENT STAGE stands (its zone `[data-embed-slot="parliament-enact"]` is in the DOM — the enacted resolution's payout pick teleports there). */
  enactStanding: false,
  /** The Agenda marker is gliding along the track — an Agenda card reward's cover waits for it to settle. */
  agendaSettling: false,
});

export function resetConsoleParliamentUi(): void {
  consoleParliamentUi.commands = [];
  consoleParliamentUi.recapSeen = '';
  consoleParliamentUi.voteStanding = false;
  consoleParliamentUi.enactStanding = false;
  consoleParliamentUi.agendaSettling = false;
}

/*
 * «ONCE PER GENERATION» OUTLIVES A RELOAD. The results scene retells what
 * already happened; replaying it because the page reloaded (or the app
 * resumed the game) is replaying history. The marks live on this device,
 * bounded — the newest few `<viewer>:<generation>` keys — and a storage that
 * cannot be read degrades to the in-memory mark alone.
 */
const RECAP_SEEN_STORAGE = 'tm_parliament_recap_seen';
const RECAP_SEEN_LIMIT = 24;

function storedRecapMarks(): Array<string> {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(RECAP_SEEN_STORAGE);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function parliamentRecapSeen(key: string): boolean {
  return consoleParliamentUi.recapSeen === key || storedRecapMarks().includes(key);
}

export function markParliamentRecapSeen(key: string): void {
  consoleParliamentUi.recapSeen = key;
  try {
    const marks = storedRecapMarks().filter((mark) => mark !== key);
    marks.push(key);
    window.localStorage.setItem(RECAP_SEEN_STORAGE, JSON.stringify(marks.slice(-RECAP_SEEN_LIMIT)));
  } catch {
    // No storage on this host: the in-memory mark still holds for the session.
  }
}

// ── the section-internal flow ──────────────────────────────────────────────

export type ParliamentZone = 'voting' | 'government' | 'parties';
/**
 * `vote` — the decision mode (a phase descent); `submitting` — sent;
 * `paying` — a paid vote's payment stands inside the mode; `landed` — the
 * answer arrived: the delegate settles on the card before the flow leaves.
 * `seat` — the chairman's mandatory pick; `recap` — the RESULTS scene;
 * `enact` — the enacted resolution's payout stage.
 */
export type ParliamentStage = 'browse' | 'vote' | 'seat' | 'submitting' | 'paying' | 'landed' | 'recap' | 'enact';

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
    /** The landed scene is dissolving — the flow's last beat before the workspace leaves. */
    concluded: false,
    /** The chair just received its delegate (the seat pick's landing) — the government's chair mark flashes. */
    chairPulse: false,
  };
}

export const parliamentFlow = reactive(freshFlow());

/** The seat / recap stage's unfold / fold (the middle tier's stage zone). */
export const STAGE_UNFOLD_MS = 300;
export const STAGE_FOLD_MS = 220;

let chairTimer: number | undefined;

export function resetParliamentFlow(): void {
  if (chairTimer !== undefined) {
    window.clearTimeout(chairTimer);
    chairTimer = undefined;
  }
  Object.assign(parliamentFlow, freshFlow());
}

/** The chairman's delegate has landed on the seat mark: it flashes once. */
export function pulseParliamentChair(): void {
  parliamentFlow.chairPulse = true;
  if (chairTimer !== undefined) {
    window.clearTimeout(chairTimer);
  }
  chairTimer = window.setTimeout(() => {
    parliamentFlow.chairPulse = false;
    chairTimer = undefined;
  }, consoleMotionMs(1400));
}

// ── the crumb ──────────────────────────────────────────────────────────────

/**
 * ONE fixed line, two names: «Парламент › Осмотр» on the overview,
 * «Парламент › Голосование» in the vote mode — the MODE is the subject,
 * never a card (a crumb that re-set itself on every ◀ ▶ read as
 * arriving somewhere else; a card name of any length would move the
 * zone beside it). The seat pick and the results are stages of the
 * overview and of the phase: short, fixed words.
 */
export function parliamentCrumbSubject(): string {
  switch (parliamentFlow.stage) {
  case 'vote':
  case 'paying':
  case 'landed':
    return 'Voting';
  case 'submitting':
    return parliamentFlow.stageBeforeSubmit === 'vote' ? 'Voting' : 'Parliament overview';
  case 'recap': return 'Results';
  case 'enact': return 'Enactment';
  default: return 'Parliament overview';
  }
}

/**
 * The crumb's tail — the name of the place the player is in, never of a
 * beat: a submit is a transient beat, so the tail keeps the name of the
 * stage it left (the phase turns it amber) — relabelling it «Sending» for
 * the round-trip blinked the crumb three times. The enactment's tail names
 * the STAGE the seat is actually in: a payout pick, or the mandatory take of
 * the cards the resolution drew (`enactDrawStanding` — the live prompt's own
 * marker, never a resolution name).
 */
export function parliamentCrumbStage(enactDrawStanding: boolean): string {
  const stage = parliamentFlow.stage === 'submitting' ? parliamentFlow.stageBeforeSubmit : parliamentFlow.stage;
  switch (stage) {
  case 'paying': return 'Payment';
  case 'seat': return 'Seat';
  case 'enact': return enactDrawStanding ? 'Intake' : 'Payout';
  default: return '';
  }
}

export function parliamentCrumbCommitted(): boolean {
  const stage = parliamentFlow.stage;
  return stage === 'submitting' || stage === 'landed' || stage === 'paying';
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

/** The seat / recap stage stands in the middle tier. */
export function parliamentStageUp(): boolean {
  const f = parliamentFlow;
  return f.stage === 'seat' || f.stage === 'recap' || (f.stage === 'submitting' && f.stageBeforeSubmit === 'seat');
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
