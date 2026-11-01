/*
 * THE SCREEN DIRECTOR — «правда сервера → одно состояние → один владелец экрана» for the WHOLE console (the owner,
 * 2026-10-31: «новый механизм дорабатывать и в итоге внедрять на 100% по всему консольному интерфейсу»). Phase 0 —
 * SHADOW: nothing on screen changes; a sustained disagreement is logged (`[screen-shadow]`).
 *
 * The console has had six nets, each answering a piece of ONE question — «who must serve the screen right now?»: the
 * stranded check (`consoleLeakDetector` — is ANYTHING serving?), the foreground watchdog, the liveness arbiter, the
 * beat stall guard, the start's strand watchdog and the start director. Every freeze of October walked between them.
 * This module states the question once, for every prompt kind:
 *
 *   · `expectedScreenOwners(task)` — WHO may serve the server's one question (a set: a payment is the task host's,
 *     whether standalone or teleported into a workspace's zone; a colony pick is the colonies' surface, standalone or
 *     hosted as a step). Exhaustive over `TaskKind` BY THE COMPILER (`Record<TaskKind, …>`) — a new prompt kind is a
 *     row here or the build fails;
 *   · `screenShadowVerdict(input)` — the verdict against what is ON SCREEN (the probe in the leak detector's 1 Hz DOM
 *     pass): `agree` · `beat` (a transient scene legitimately holds the prompt) · `held` (a named, bounded hold — the
 *     announce gate, a park, an admission block, a BLOCKING animation) · `unserved` (nothing at all — the stranded
 *     class, judged here WITHOUT the notification-only holds that mask it in the stranded check) · `misserved` (a
 *     surface stands, but not one that answers this question — the class no net judged).
 *
 * The start's own prompts stay the start director's (`startDirector.ts`); the plain action menu is out of scope (the
 * player is free to stand anywhere). Pure: no Vue, no DOM — `tests/console/screenDirector.spec.ts`.
 */
import type {ConsoleTask, TaskKind} from '@/client/console/consoleTaskRouter';
import type {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';

/** Who can serve the screen — a workspace, or a surface of its own. */
export type ScreenOwner =
  | WorkspaceFrameKind
  /** The generic task host (`ConsoleTaskHost` — standalone or teleported into a workspace zone). */
  | 'task'
  /** «Посмотри N, оставь K» — the deck pick. */
  | 'deck-pick'
  /** The optional EFFECT decision. */
  | 'decision'
  /** The MarsBot attack modal. */
  | 'bot-attack'
  /** Stormcraft's heat / the Venus alt-track bonus (one chassis). */
  | 'lanes'
  /** The Ares planetary thresholds. */
  | 'ares'
  /** The production-loss surface (an Ares hazard penalty). */
  | 'prod-loss'
  /** The World Government's support briefing. */
  | 'gov-support'
  /** A corporation's first-action confirm outside the start flow. */
  | 'corp-first'
  /** The optional draft re-pick banner. */
  | 'draft-wait'
  /** The generic bottom sheet. */
  | 'sheet'
  /** A live placement on the board. */
  | 'board';

/** Out of the shadow's scope: the start's own question (the start director judges it) or the free action menu. */
export type ScreenScope = 'start' | 'free' | 'unknown';

/** Every workspace kind — a `Record` so the compiler refuses a kind added to the stack and missed here. */
const WORKSPACE_KIND_SET: Record<WorkspaceFrameKind, true> = {
  'card-actions': true, 'hand': true, 'colonies': true, 'hydro': true, 'parliament': true, 'start': true, 'draft': true,
  'standard-projects': true, 'milestones': true, 'awards': true, 'repeat-pick': true, 'external-draw': true, 'endgame': true,
};
export const ALL_WORKSPACE_KINDS = Object.keys(WORKSPACE_KIND_SET) as ReadonlyArray<WorkspaceFrameKind>;

/**
 * The surfaces of their own — the probe's selectors per owner (a workspace is probed through the registry's root AND
 * its frame, never here). `.con-composer--play` is a PHASE of the hand's frame and reads as the hand.
 */
export const OWNER_SURFACES: Readonly<Record<Exclude<ScreenOwner, WorkspaceFrameKind>, string>> = {
  'task': '.con-task-host',
  'deck-pick': '.con-deckpick',
  'decision': '.con-decision',
  'bot-attack': '.con-botattack',
  'lanes': '.con-lanes',
  'ares': '.con-ares',
  'prod-loss': '.con-prodloss',
  'gov-support': '.con-govsupport',
  'corp-first': '.con-composer--corpfirst',
  'draft-wait': '.con-draftwait',
  'sheet': '.con-sheet',
  'board': '.con-board--placing',
};

/**
 * TRANSIENT SCENES — a prompt committed beside one of these is legitimately held behind it for the scene's bounded
 * phrase (the stranded check's own list of stages). A beat is never an owner: it explains a wait, it answers nothing.
 */
export const BEAT_SURFACES: ReadonlyArray<string> = [
  '.con-reveal', '.con-played-hero', '.con-sale-hero', '.con-tileplace', '.con-nomadmove', '.con-deckdraw',
  '.con-discard', '.con-macere', '.con-terraformed', '.con-mandatory', '.con-notif--holding', '.con-bot-review',
  'dialog[open]',
];

const TASK_FAMILY: ReadonlyArray<ScreenOwner> =['task', 'decision', 'prod-loss', 'gov-support', 'lanes', 'ares', 'bot-attack', 'deck-pick'];

/**
 * THE TABLE. One row per prompt kind — the compiler refuses a missing one. A row names every surface that is THE
 * answer to that question; the frames that EARNED the kind at runtime (`WorkspaceFrame.serves` — the Hydronetwork's
 * bonus offer, a landed stage's follow-up) are added by the caller (`frameServes`).
 */
const EXPECTED: {[K in TaskKind]: (task: Extract<ConsoleTask, {kind: K}>) => ReadonlyArray<ScreenOwner> | ScreenScope} = {
  actionMenu: () => 'free',
  space: () => ['board'],
  choice: (t) => t.flavor === 'wgt' ? ['gov-support', 'task'] : TASK_FAMILY,
  awardFunding: () => ['awards'],
  player: () => TASK_FAMILY,
  amount: () => TASK_FAMILY,
  resource: () => TASK_FAMILY,
  distribute: () => TASK_FAMILY,
  payment: () => TASK_FAMILY,
  draftWait: () => ['draft-wait', 'draft'],
  cardSelect: () => [...TASK_FAMILY, 'draft'],
  deckSelect: () => ['deck-pick', 'task'],
  handSelect: () => ['hand'],
  projectCard: (t) => t.mode === 'playFromHand' ? ['hand'] : t.mode === 'standardProject' ? ['standard-projects', 'sheet'] : ['task'],
  colony: () => ['colonies'],
  colonyBonus: () => ['colonies'],
  party: () => ['parliament'],
  parliamentPhase: () => ['parliament'],
  chairmanQuest: () => ['parliament'],
  externalDraw: () => ['external-draw'],
  venusBonus: () => ['lanes'],
  spendHeat: () => ['lanes'],
  botAttack: () => ['bot-attack'],
  composite: () => TASK_FAMILY,
  initialDraft: () => 'start',
  startSequence: () => 'start',
  corpFirstAction: () => ['start', 'corp-first'],
  aresGlobal: () => ['ares'],
  unknown: () => 'unknown',
};

/** The table's rows — the coverage report lists every one the suite never observed (an unverified row). */
export const SCREEN_TABLE_KINDS = Object.keys(EXPECTED) as ReadonlyArray<TaskKind>;

/**
 * A QUESTION ASKED AS A STEP OF A FLOW IS SERVED BY THAT FLOW'S HOST (step 1, the first map of 2026-11-01: under the
 * holds stood the Parliament for a law's take / tile / pick — 667 passes —, the hand for a play's effect and colony,
 * the card-actions for an action's discard). The host is the stack's own answer — `workspaceHostForStep()`, the top
 * frame while it hosts a step in its current phase — never a list per kind; this table says only which kinds CAN be
 * such a step. A kind whose surface is a modal or a screen of its own (the bot's attack, the lanes, the thresholds,
 * the awards' free funding, a colony bonus another seat's trade paid, the draft's wait) or the start's own is never
 * hosted — a flow standing over one of those is a foreign surface, never its answer.
 */
const HOSTABLE: {[K in TaskKind]: boolean} = {
  actionMenu: false, space: true, choice: true, awardFunding: false, player: true, amount: true, resource: true,
  distribute: true, payment: true, draftWait: false, cardSelect: true, deckSelect: true, handSelect: true,
  projectCard: true, colony: true, colonyBonus: false, party: true, parliamentPhase: true, chairmanQuest: true,
  externalDraw: true, venusBonus: false, spendHeat: false, botAttack: false, composite: true, initialDraft: false,
  startSequence: false, corpFirstAction: false, aresGlobal: false, unknown: false,
};

export function hostableStep(kind: TaskKind): boolean {
  return HOSTABLE[kind];
}

/** Why an owner is entitled: its row in the table (or a frame's `serves`), the host of the flow, the board under a
 *  task's nested placement. */
export type ScreenOwnerBasis = 'table' | 'host' | 'branch';

export function expectedScreenOwners(task: ConsoleTask): ReadonlyArray<ScreenOwner> | ScreenScope {
  const row = EXPECTED[task.kind] as (t: ConsoleTask) => ReadonlyArray<ScreenOwner> | ScreenScope;
  return row(task);
}

export type ScreenShadowInput = {
  /** The task the server asks (undefined = nothing asked / an optional input). */
  task: ConsoleTask | undefined;
  /** The start flow owns this question (the start director judges it — the corp's first action inside the opening). */
  startOwned: boolean;
  /** Workspaces entitled to the task kind beyond the table: the registry's default `serves` and every live / parked
   *  frame's runtime-earned ones (`workspaceSurfacesFor`'s two halves). */
  frameServes: ReadonlyArray<WorkspaceFrameKind>;
  /** The flow's HOST for a step right now (`workspaceHostForStep()`), undefined when the top frame hosts nothing. */
  host?: WorkspaceFrameKind;
  /** A task's nested placement is answered on the BOARD (the final greenery's branch, the WGT ocean). */
  boardBranch?: boolean;
  /** A named, bounded hold the prompt legitimately waits behind ('' = none). */
  held: string;
  /** The serving owners PAINTED now (the probe). */
  present: ReadonlyArray<ScreenOwner>;
  /** The transient scenes painted now (a reveal, a hero, a deck deal, the announce card …). */
  beats: ReadonlyArray<string>;
};

/** Why a question is not judged: nothing asked, the start's, out of the table's scope, or the shell gave no context. */
export type ScreenNoneScope = 'start-owned' | ScreenScope | 'no-context';

export type ScreenShadowVerdict =
  | {kind: 'none', scope: ScreenNoneScope}
  /** The expected owners that PAINT — the observed «who serves» map is built from these. */
  | {kind: 'agree', owners: ReadonlyArray<ScreenOwner>, basis: ScreenOwnerBasis}
  /** `present` — what stood UNDER the wait (never an expected owner: that would have agreed): `[]` = nothing, else a
   *  FOREIGN surface. The evidence a hold hides — a row the table is missing reads here, never as a finding. */
  | {kind: 'held', reason: string, present: ReadonlyArray<ScreenOwner>}
  | {kind: 'beat', beats: ReadonlyArray<string>, present: ReadonlyArray<ScreenOwner>}
  | {kind: 'unserved' | 'misserved', expected: ReadonlyArray<ScreenOwner>};

export function screenShadowVerdict(i: ScreenShadowInput): ScreenShadowVerdict {
  if (i.task === undefined) {
    return {kind: 'none', scope: 'free'};
  }
  if (i.startOwned) {
    return {kind: 'none', scope: 'start-owned'};
  }
  const row = expectedScreenOwners(i.task);
  if (typeof row === 'string') {
    return {kind: 'none', scope: row};
  }
  const table = [...new Set<ScreenOwner>([...row, ...i.frameServes])];
  const byTable = i.present.filter((o) => table.includes(o));
  if (byTable.length > 0) {
    return {kind: 'agree', owners: byTable, basis: 'table'};
  }
  const host = i.host !== undefined && HOSTABLE[i.task.kind] ? i.host : undefined;
  if (host !== undefined && i.present.includes(host)) {
    return {kind: 'agree', owners: [host], basis: 'host'};
  }
  if (i.boardBranch === true && i.present.includes('board')) {
    return {kind: 'agree', owners: ['board'], basis: 'branch'};
  }
  const expected = [...new Set<ScreenOwner>([
    ...table, ...(host === undefined ? [] : [host]), ...(i.boardBranch === true ? ['board' as const] : []),
  ])];
  if (i.held !== '') {
    return {kind: 'held', reason: i.held, present: i.present};
  }
  if (i.beats.length > 0) {
    return {kind: 'beat', beats: i.beats, present: i.present};
  }
  return {kind: i.present.length === 0 ? 'unserved' : 'misserved', expected};
}

/** A disagreement is a finding once it stood this many 1 Hz passes unchanged (the start shadow's 3 s). */
export const SCREEN_SHADOW_CONFIRM_TICKS = 3;

export type ScreenShadowFinding = {
  kind: 'unserved' | 'misserved';
  expected: ReadonlyArray<ScreenOwner>;
  present: ReadonlyArray<ScreenOwner>;
  /** `<taskKind>[:mode]#<promptId>` — the prompt id keeps one finding per prompt. */
  prompt: string;
  at: number;
};

/**
 * THE EVIDENCE THAT THE SHADOW LOOKS — every judged pass, counted. A run with no finding proves something only next to
 * these numbers: how many passes were judged at all (and why the rest were not), which holds and beats explained a
 * wait (and the LONGEST unbroken run of each — a hold that stands for minutes is a latch, not a beat), and WHO actually
 * served each prompt shape (the observed map the table is tightened against before any cure trusts it).
 */
export type ScreenShadowStats = {
  /** `agree` · `held` · `beat` · `unserved` · `misserved` · `none:<scope>` → passes. */
  verdicts: Record<string, number>;
  /** hold reason → passes. */
  held: Record<string, number>;
  /** hold reason → the longest unbroken run of passes. */
  heldMaxRun: Record<string, number>;
  /** beat selector → passes. */
  beats: Record<string, number>;
  /** prompt shape (`kind[:mode]`) → owner that served it → passes. */
  owners: Record<string, Record<string, number>>;
  /** prompt shape → passes judged (any verdict but `none`). */
  shapes: Record<string, number>;
  /** prompt shape → `held:<reason> | <on screen>` / `beat | <on screen>` → passes: what a wait HID. */
  masked: Record<string, Record<string, number>>;
};

function emptyStats(): ScreenShadowStats {
  return {verdicts: {}, held: {}, heldMaxRun: {}, beats: {}, owners: {}, shapes: {}, masked: {}};
}

/** The findings of this session (bounded) — `window.__conScreenShadow()` and the field export read them. */
export const screenShadowLog: {findings: Array<ScreenShadowFinding>, judged: number, stats: ScreenShadowStats} =
  {findings: [], judged: 0, stats: emptyStats()};
const MAX_FINDINGS = 60;
let heldRun: {reason: string, passes: number} = {reason: '', passes: 0};

function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

/** The prompt's SHAPE — its kind and the mode that decides its row (no prompt id: a shape is the table's unit). */
export function screenPromptShape(task: ConsoleTask): string {
  const mode = (task as {mode?: string}).mode ?? (task as {flavor?: string}).flavor;
  return mode === undefined ? task.kind : `${task.kind}:${mode}`;
}

/** Count one judged pass. `shape` is undefined for a pass with no task. */
export function noteScreenShadowPass(shape: string | undefined, verdict: ScreenShadowVerdict): void {
  const s = screenShadowLog.stats;
  bump(s.verdicts, verdict.kind === 'none' ? `none:${verdict.scope}` : verdict.kind);
  const reason = verdict.kind === 'held' ? verdict.reason : '';
  heldRun = reason === '' ? {reason: '', passes: 0} :
    reason === heldRun.reason ? {reason, passes: heldRun.passes + 1} : {reason, passes: 1};
  if (reason !== '') {
    bump(s.held, reason);
    s.heldMaxRun[reason] = Math.max(s.heldMaxRun[reason] ?? 0, heldRun.passes);
  }
  if (verdict.kind === 'none' || shape === undefined) {
    return;
  }
  screenShadowLog.judged++;
  bump(s.shapes, shape);
  if (verdict.kind === 'beat') {
    verdict.beats.forEach((b) => bump(s.beats, b));
  }
  if (verdict.kind === 'held' || verdict.kind === 'beat') {
    const row = s.masked[shape] ?? (s.masked[shape] = {});
    const head = verdict.kind === 'held' ? `held:${verdict.reason}` : 'beat';
    bump(row, `${head} | ${verdict.present.join(',') || 'nothing'}`);
  }
  if (verdict.kind === 'agree') {
    const row = s.owners[shape] ?? (s.owners[shape] = {});
    verdict.owners.forEach((o) => bump(row, verdict.basis === 'table' ? o : `${o}@${verdict.basis}`));
  }
}

export function screenShadowKey(f: Pick<ScreenShadowFinding, 'kind' | 'expected' | 'present' | 'prompt'>): string {
  return `${f.kind}|${f.expected.join(',')}|${f.present.join(',')}|${f.prompt}`;
}

/** Record a finding ONCE per (kind, owners, prompt); false = already known. */
export function recordScreenShadowFinding(f: ScreenShadowFinding): boolean {
  const key = screenShadowKey(f);
  if (screenShadowLog.findings.some((x) => screenShadowKey(x) === key)) {
    return false;
  }
  screenShadowLog.findings.push(f);
  if (screenShadowLog.findings.length > MAX_FINDINGS) {
    screenShadowLog.findings.shift();
  }
  return true;
}

export function resetScreenShadowLog(): void {
  screenShadowLog.findings.length = 0;
  screenShadowLog.judged = 0;
  screenShadowLog.stats = emptyStats();
  heldRun = {reason: '', passes: 0};
}

/**
 * The confirmation streak: a verdict signature must repeat `SCREEN_SHADOW_CONFIRM_TICKS` passes before it is a
 * finding (a hand-off frame never reports). Pure state in, state out.
 */
export type ScreenShadowStreak = {signature: string, ticks: number};

export function advanceScreenShadowStreak(prev: ScreenShadowStreak, signature: string): ScreenShadowStreak {
  return signature === '' ? {signature: '', ticks: 0} :
    signature === prev.signature ? {signature, ticks: prev.ticks + 1} : {signature, ticks: 1};
}

/** The prompt's token for a finding — kind, the mode that decides the row, the server's prompt id. */
export function screenPromptToken(task: ConsoleTask, promptId: number | undefined): string {
  return `${screenPromptShape(task)}#${promptId ?? ''}`;
}
