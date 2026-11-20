/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHO SERVES THE QUESTION — ONE pure, TOTAL function (FREEZE ZERO, the second phase, stage 2 —
 * docs/claude/console/freeze-zero/PLAN.md § 8: «one owner per question, by a total function»).
 *
 * The server asks a seat ONE question at a time. Who answers it on screen is decided today in about twenty-five
 * computeds of the shell's controllers (each surface's own `v-if`), re-derived in the pad's ladder (33 ordered rungs)
 * and twice more in the command bar (≈ 35 and ≈ 60 ordered branches) — and CHECKED from the outside by three nets that
 * hold a second opinion: the screen shadow (`screenDirector.ts` — a table of the owners that MAY serve each kind),
 * the start shadow, the leak detector's stranded check. Every disagreement between those copies is a freeze class
 * («the pad goes to a surface that is not mounted», «the start serves nothing», «misserved»), and the map of
 * 2026-11-19 found the copies already apart: the pad and the bar write the task host's condition with half of the
 * terms its own `v-if` has; the bar and the pad order the composites differently.
 *
 * This function is the ONE opinion: for the facts of a question it names EXACTLY ONE owner — never «unknown», never
 * a set — and, when that owner may not stand yet, the ONE reason it is held and by what. The surfaces, the pad and the
 * bar are to be DERIVED from it (the wiring is the stage's second half; until then nothing reads this module but its
 * spec and the shadow that measures it against the screen).
 *
 * WHAT IT IS MADE OF. The owner of a kind is the shadow's own table narrowed to a decision: where a row holds two
 * owners, the fact that chooses between them is an input here (`effectDecision`, `draftFrame`, `startFlow`, …) — the
 * spec proves the function never names an owner the table does not allow (`tests/console/servingOwner.spec.ts`). The
 * holds are the shell's own, in ONE order: the player's park first (their choice outranks everything), then the
 * task's own nested placement (the board answers a branch of the question), a bounded scene of the game, a claim
 * whose zone is not standing, an admission block.
 *
 * Pure: no Vue, no DOM, no clock.
 */
import type {ConsoleTask} from '@/client/console/consoleTaskRouter';
import type {PromptSurface} from '@/client/console/consolePromptAdmission';
import type {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {hostableStep} from '@/client/console/screenDirector';
import type {ScreenOwner} from '@/client/console/screenDirector';

/** The facts of the question — everything the decision reads, as plain data (the shell gathers them once). */
export type QuestionFacts = {
  /** The server's one question as the router classifies it (`taskFor`) — `undefined`: nothing is asked of this seat, or only an optional input. */
  task: ConsoleTask | undefined;
  /** The opening owns the question: the start's frame is live and the question is one of its own (`startOwned`). */
  startFlow: boolean;
  /** `buildEffectDecision` builds a decision for this prompt (a contextual choice with its marker). */
  effectDecision: boolean;
  /** The draft workspace's frame is known to the stack. */
  draftFrame: boolean;
  /** The draft claims this task (`draftClaimsTask` — the research buy inside the draft workspace). */
  draftClaims: boolean;
  /** An external draw asked by a resolution of the Parliament (the sitting hosts it). */
  resolutionDraw: boolean;
  /** A live or parked frame that EARNED the task's kind at runtime (its `serves` — the Hydronetwork's bonus offer, the
   *  colony resolution's discard, a party action's discard in the action centre) — `frameServing(kind)`. */
  servingFrame: WorkspaceFrameKind | undefined;
  /** The flow's host for a step right now (`workspaceHostForStep()` — the top frame while it hosts). */
  host: WorkspaceFrameKind | undefined;
  /** The workspaces whose frame STANDS on the live stack — admission is a door: one that is in is not held at it. */
  frames: ReadonlyArray<WorkspaceFrameKind>;
  /** The workspaces whose ENTRY waits for the screen's hand-over (`handoffPendingEntries` — the sitting handing the
   *  screen to the draft): the surface on screen is the one that is leaving. */
  handoff: ReadonlyArray<WorkspaceFrameKind>;
  /** The player set the question aside («свернуть» — `consoleState.task.deferred`, a collapsed stack that serves it). */
  aside: boolean;
  /** THE PLAYER'S OWN LOOK OVER A LIVE PLACEMENT — the reversible workspace they opened over the cells ('' — none):
   *  one B back to the board, and until then the cells wait for the player (the shadow's `lateral`). */
  lateral: string;
  /** The task's own nested placement stands on the board (`taskSpacePending` — the WGT ocean, the final greenery). */
  boardBranch: boolean;
  /** A bounded scene of the game holds the screen, by its name ('' — none): the final greenery, the scale focus, the
   *  energy conversion, a client hand pick, the finale. */
  scene: string;
  /** The question is claimed by a workspace whose zone does not stand yet, or whose beat still plays (`…HeldForWorkspace`). */
  claimHeld: boolean;
  /** The admission block of each surface that could admit an owner ('' or absent — admitted). */
  blocks: Partial<Record<PromptSurface, string>>;
};

/** Why the owner does not stand yet — ONE reason, the first of the order in `servingOwnerOf`. */
export type OwnerHoldKind = 'aside' | 'scene' | 'claim' | 'admission';

export type ServingOwner = {
  /** The ONE surface that answers this question. */
  owner: ScreenOwner;
  /** The workspace whose zone hosts it as a step of its flow — absent: it stands on its own. */
  host?: WorkspaceFrameKind;
  /** Why this owner: the kind's row · a frame that earned the kind · the opening · the board under a nested placement · a
   *  kind no surface was ever written for (the task host's native renderer takes it, never «nobody»). */
  basis: 'row' | 'serves' | 'start' | 'branch' | 'fallback';
  /** The admission surface that governs it (what `blocks` is read by) — absent: nothing admits it, it stands at once. */
  admission?: PromptSurface;
  /**
   * THE ROUTER's DOOR — a workspace the router OPENS for the question (`openShellTaskSurface`) enters through the
   * arrival chain's admission too (`followUp`: what came with the question plays first), beside its own. The pad's
   * first whole reading named it (the bottle, 606 tables, 2026-11-20 — «says parliament, the pad gave the board»: the
   * sitting's door behind a card still arriving); the look's measure had met the same picture a second at a time.
   */
  door?: PromptSurface;
  /** Held — and by what. Absent: it SERVES. */
  hold?: {kind: OwnerHoldKind, by: string};
};

export type Ownership = {asked: false} | ({asked: true} & ServingOwner);

/** The PHASE ROOTS — a screen of their own for a whole phase: never a step in somebody's zone, whatever stands on top. */
const ROOT_OWNERS: ReadonlySet<ScreenOwner> = new Set<ScreenOwner>(['draft', 'start', 'endgame']);

/** The owner of the kind — the table's row narrowed to ONE by the fact that chooses. */
function ownerOfKind(task: ConsoleTask, f: QuestionFacts): {owner: ScreenOwner, basis: ServingOwner['basis'], admission?: PromptSurface, door?: PromptSurface} {
  switch (task.kind) {
  case 'actionMenu':
    // (Never reached — the caller answers «not asked»: the player is free to stand anywhere.)
    return {owner: 'board', basis: 'row'};
  case 'space':
    return {owner: 'board', basis: 'row', admission: 'placement'};
  case 'choice':
    switch (task.flavor) {
    case 'wgt': return {owner: 'gov-support', basis: 'row', admission: 'host'};
    case 'contextual': return {owner: f.effectDecision ? 'decision' : 'task', basis: 'row', admission: 'host'};
    case 'deltaBonus':
    case 'espionage': return {owner: 'hydro', basis: 'row', admission: 'followUp'};
    // The start hosts it as its own step in the opening; past it, the task host (teleported into the chain's zone).
    case 'placementOrder': return f.startFlow ? {owner: 'start', basis: 'start', admission: 'scene'} : {owner: 'task', basis: 'row', admission: 'host'};
    default: return {owner: 'task', basis: 'row', admission: 'host'};
    }
  case 'awardFunding': return {owner: 'awards', basis: 'row', admission: 'section', door: 'followUp'};
  case 'player':
  case 'amount':
  case 'resource':
  case 'payment': return {owner: 'task', basis: 'row', admission: 'host'};
  case 'distribute': return {owner: task.mode === 'production' ? 'prod-loss' : 'task', basis: 'row', admission: 'host'};
  // (The draft workspace is entered through the announce's door — a flow beat: its admission is the section's.)
  case 'draftWait': return f.draftFrame ? {owner: 'draft', basis: 'row', admission: 'section'} : {owner: 'draft-wait', basis: 'row'};
  case 'cardSelect':
    if (task.mode === 'draft') {
      return {owner: 'draft', basis: 'row', admission: 'section'};
    }
    return task.mode === 'buy' && f.draftClaims ? {owner: 'draft', basis: 'row', admission: 'section'} : {owner: 'task', basis: 'row', admission: 'host'};
  case 'deckSelect': return {owner: 'deck-pick', basis: 'row', admission: 'host'};
  case 'handSelect': return {owner: 'hand', basis: 'row', admission: 'section', door: 'followUp'};
  case 'projectCard':
    if (task.mode === 'playFromHand') {
      return {owner: 'hand', basis: 'row', admission: 'section', door: 'followUp'};
    }
    return task.mode === 'standardProject' ? {owner: 'standard-projects', basis: 'row', admission: 'section', door: 'followUp'} : {owner: 'task', basis: 'row', admission: 'host'};
  case 'colony':
  case 'colonyBonus': return {owner: 'colonies', basis: 'row', admission: 'section', door: 'followUp'};
  case 'party':
  case 'parliamentPhase':
  case 'chairmanQuest': return {owner: 'parliament', basis: 'row', admission: 'section', door: 'followUp'};
  // (A resolution's draw is the SAME surface, standing in the sitting's stage — `servingOwnerOf` names that host.)
  case 'externalDraw': return {owner: 'external-draw', basis: 'row', admission: 'section', door: 'followUp'};
  case 'venusBonus': return {owner: 'lanes', basis: 'row', admission: 'scaleBonus'};
  case 'spendHeat': return {owner: 'lanes', basis: 'row', admission: 'host'};
  case 'botAttack': return {owner: 'bot-attack', basis: 'row', admission: 'host'};
  case 'aresGlobal': return {owner: 'ares', basis: 'row', admission: 'host'};
  case 'initialDraft':
  case 'startSequence': return {owner: 'start', basis: 'start', admission: 'scene'};
  // Inside the opening the start serves it; past it (a merger) — its own confirm.
  case 'corpFirstAction': return f.startFlow ? {owner: 'start', basis: 'start', admission: 'scene'} : {owner: 'corp-first', basis: 'row', admission: 'standaloneModal'};
  // A KIND NO SURFACE WAS WRITTEN FOR is never «nobody»: the task host's native renderer takes it (a bare AndOptions,
  // a prompt type the router does not know) — the shell's own computeds answer `undefined` there today, which is a
  // question standing with no owner by construction.
  case 'composite':
  case 'unknown': return {owner: 'task', basis: 'fallback', admission: 'host'};
  }
}

/**
 * WHO SERVES THE QUESTION. TOTAL: every input names one answer — «not asked», or ONE owner with at most ONE hold.
 *
 * The order of the holds is the shell's own, written once:
 *   1. ASIDE     — the player parked the question: their choice outranks every scene and every block;
 *   2. the BOARD — the task's own nested placement stands: a branch of the question is answered on the board (that
 *                  is an owner, not a hold);
 *   3. a SCENE   — a bounded scene of the game has the screen;
 *   4. a CLAIM   — a workspace owns the question and its zone does not stand yet;
 *   5. ADMISSION — the surface that admits the owner names a block, and the owner is still to ENTER (a workspace
 *                  whose frame already stands was let in: a block is a door, never a presence).
 */
export function servingOwnerOf(f: QuestionFacts): Ownership {
  const task = f.task;
  if (task === undefined || task.kind === 'actionMenu') {
    return {asked: false};
  }
  const row = ownerOfKind(task, f);
  // A FRAME THAT EARNED THE KIND at runtime answers before the kind's own row (the Hydronetwork's bonus offer, the
  // colony resolution's discard): the flow that asked is the flow that hears the answer. Never over the opening's own.
  const earned = row.basis !== 'start' && f.servingFrame !== undefined && f.servingFrame !== row.owner;
  const base: ServingOwner = earned ?
    {owner: f.servingFrame as WorkspaceFrameKind, basis: 'serves', ...(row.admission !== undefined ? {admission: row.admission} : {}), ...(row.door !== undefined ? {door: row.door} : {})} :
    {owner: row.owner, basis: row.basis, ...(row.admission !== undefined ? {admission: row.admission} : {}), ...(row.door !== undefined ? {door: row.door} : {})};
  // A step of a flow stands in that flow's zone — for the kinds that CAN be a step (the shadow's `HOSTABLE`: a modal
  // or a screen of its own never is), never inside itself, never the opening's own surface. A resolution's draw is a
  // step of the SITTING whatever stands on top: the Parliament hosts it in its stage.
  const host = task.kind === 'externalDraw' && f.resolutionDraw ? 'parliament' : f.host;
  const hosted = host !== undefined && host !== base.owner && base.basis !== 'start' && !ROOT_OWNERS.has(base.owner) && hostableStep(task.kind);
  const owner: ServingOwner = hosted ? {...base, host} : base;

  // SET ASIDE — unless the player STANDS ON THE SURFACE THAT ANSWERS IT (the record's own «on-its-surface»,
  // `setAside.ts`): a workspace whose frame is on the live stack serves its question whatever the record still says —
  // the third reading in a real browser (CI `fz3` · duo, 2026-11-19): the Parliament serving its sitting for eight
  // looks under a record nobody had taken up yet. A parked or a yielded frame is not on the live stack; the board
  // under the task's own placement is no frame at all — a placement set aside is aside.
  if (f.aside && (f.boardBranch || !f.frames.includes(owner.owner as WorkspaceFrameKind))) {
    return {asked: true, ...owner, hold: {kind: 'aside', by: 'the player set it aside'}};
  }
  if (f.lateral !== '') {
    const placed: ServingOwner = f.boardBranch ? {owner: 'board', basis: 'branch', admission: 'placement'} : owner;
    return {asked: true, ...placed, hold: {kind: 'aside', by: `lateral:${f.lateral}`}};
  }
  if (f.boardBranch) {
    return {asked: true, owner: 'board', basis: 'branch', admission: 'placement', ...holdOf('placement', f)};
  }
  if (f.scene !== '') {
    return {asked: true, ...owner, hold: {kind: 'scene', by: f.scene}};
  }
  // THE SCREEN IS BEING HANDED OVER to this very owner: what stands is the surface that is leaving (the measure's
  // second disagreement — the research buy the draft claims, with the sitting still on screen).
  if (f.handoff.includes(owner.owner as WorkspaceFrameKind)) {
    return {asked: true, ...owner, hold: {kind: 'scene', by: 'handoff'}};
  }
  if (f.claimHeld) {
    return {asked: true, ...owner, hold: {kind: 'claim', by: owner.host ?? 'the claiming workspace'}};
  }
  // ADMISSION IS A DOOR, NOT A PRESENCE: a workspace whose frame already stands on the stack was let in — a scene that
  // begins beside it does not take it off the screen (the first disagreement the measure named, 2026-11-19: the
  // Parliament standing under a `presentation` block of its own sitting). Only an owner still to ENTER is held.
  if (owner.admission === undefined || f.frames.includes(owner.owner as WorkspaceFrameKind)) {
    return {asked: true, ...owner};
  }
  const own = holdOf(owner.admission, f);
  // (Its own admission first; then the door the router opens it through.)
  return {asked: true, ...owner, ...(own.hold !== undefined || owner.door === undefined ? own : holdOf(owner.door, f))};
}

function holdOf(surface: PromptSurface, f: QuestionFacts): {hold?: {kind: OwnerHoldKind, by: string}} {
  const block = f.blocks[surface] ?? '';
  return block === '' ? {} : {hold: {kind: 'admission', by: block}};
}

/** The facts of one look, in one line — the evidence a disagreement of the measure is read by (only what is set). */
export function questionFactsDigest(f: QuestionFacts): string {
  const blocks = Object.entries(f.blocks).filter(([, by]) => by !== undefined && by !== '').map(([surface, by]) => `${surface}:${by}`);
  return [
    `frames [${f.frames.join(',')}]`,
    f.host !== undefined ? `host ${f.host}` : '',
    f.servingFrame !== undefined ? `serving ${f.servingFrame}` : '',
    f.handoff.length > 0 ? `handoff [${f.handoff.join(',')}]` : '',
    blocks.length > 0 ? `blocks [${blocks.join(',')}]` : '',
    f.scene !== '' ? `scene ${f.scene}` : '',
    f.lateral !== '' ? `lateral ${f.lateral}` : '',
    ...(['startFlow', 'effectDecision', 'draftFrame', 'draftClaims', 'resolutionDraw', 'aside', 'boardBranch', 'claimHeld'] as const).filter((k) => f[k]),
  ].filter((part) => part !== '').join(' · ');
}

/** The function's ANSWER in one line — who, in whose zone, held by what (the measure's key of «the same answer»). */
export function ownershipDigest(o: Ownership): string {
  if (!o.asked) {
    return 'free';
  }
  return `${o.owner}${o.host !== undefined ? `@${o.host}` : ''}${o.hold !== undefined ? ` held ${o.hold.kind}:${o.hold.by}` : ''}`;
}

/** Does the question's owner SERVE right now (asked, and nothing holds it)? */
export function ownerServes(o: Ownership): o is {asked: true} & ServingOwner {
  return o.asked && o.hold === undefined;
}
