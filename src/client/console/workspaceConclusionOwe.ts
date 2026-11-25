/*
 * @console-shared LIVE — console native stands on this file.
 *
 * AN OWED CONCLUSION IS A RUN IN ITS FRAME'S SCOPE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md
 * §5 · S5).
 *
 * A flow reports its ending exactly ONCE (the last card taken, a flow-complete report) and the one guarded conclusion
 * (`concludeWorkspaceFlow`) legitimately refuses on a transient hold — a claim still presenting, a step still owed, a
 * batch in the air. The ending is then OWED, and it used to be a mailbox: one data field for the whole console
 * (`owedConclusion` — a second workspace's debt overwrote the first), re-driven by a watcher over a HAND-WRITTEN
 * signal string of the hold's ingredients. Every ingredient the list forgot was a workspace standing finished and
 * empty until some unrelated 20 – 30 s safety (the board-beat park's drain, 2026-09-11; the parliament's chairmanship;
 * the hidden-scene class) — so a time net re-asked the same question every half second, a wait-graph door re-asked
 * it again, and each fix added a term to the string.
 *
 * Here the debt is a RUN:
 *  · it lives in the scope of the FRAME that owes it — one per frame, so two workspaces owe independently, and a
 *    frame that goes (by any verb, from any of its three homes) takes its debt with it: there is no «gone» to detect;
 *  · it is re-asked when THE DECISION'S OWN FACTS move: the owner hands ONE object to the policy that decides and its
 *    key to this module (`facts`), and a debt is asked again whenever that key differs from the one it was last
 *    refused with. A term cannot be missing from a list, because there is no second list — a fact the decision gains
 *    is a fact the wake has;
 *  · it is BOUNDED: what the facts cannot say reactively (a claim that became releasable with no write behind it) is
 *    re-asked on the run's own cadence — the old time net, now the debt's own beat — and a workspace that still holds
 *    with nothing the player could act on is a ghost, torn down by the owner's force path — BY LEVEL (FREEZE ZERO,
 *    stage 2 — the tail): the debt's own door, in the debt's own scope. It used to be two clocks (eight seconds owed,
 *    two and a half read a ghost): a real ghost was ten seconds of a dead workspace, and what kept the test off a
 *    scene that was merely PLAYING was only that no scene plays two and a half seconds without a hold. The door asks
 *    the thing itself: a ghost, with NOTHING IN FLIGHT under the debt's own waits and no look of the player's over
 *    it, for the door's bar — `OWED_GHOST_DOOR_*`, below.
 *
 * WHEN IN THE TICK IT ASKS IS THE SHELL'S: THE WAKE IS A ROW OF ITS WATCH TABLE (`owedConclusionFacts`), exactly where
 * the old signal's watcher stood. The facts of a conclusion routinely move in TWO steps inside one tick — an owed
 * step's door falls (`owedStep: false`) and a reaction of the shell then pushes the step's frame (`nested: true`);
 * between the two the decision reads «nothing holds». Two forms that took the wake off the table were tried on the
 * box, and both were wrong in a way no unit spec shows:
 *  · a watcher that belongs to no component, pre-flush — Vue 3.5 queues such a job BEFORE every watcher of every
 *    component, so it asked between the two steps and closed the hand under its own colony step
 *    (`console-multi-effect-sequence`);
 *  · the same, post-flush — after the RENDER: the conclusion's DOM came one patch late (two patches in a tick run the
 *    leave / enter hooks of what flickered between them) and the trade's closing beat split the workspace
 *    (`console-colony-pluto-embed`).
 * The place that is right — after the reactions the same write woke, before the render — is a watcher OF THE SHELL,
 * queued among its own; the row reproduces the old watcher's shape (a computed key, subscribed when a debt begins)
 * and so its place. What changed is what the key IS: the decision's own facts, not a list kept beside them.
 * `owedConclusionFactsKey()` is what the row watches, `reaskMovedConclusions()` what it calls.
 */
import {shallowRef} from 'vue';
import {flowClock} from '@/client/console/kernel/flowClock';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {WorkspaceFrameKind, workspaceFrameScope} from '@/client/console/consoleWorkspaceStack';
import {conclusionRefusalOf} from '@/client/console/shell/shellFlowState';
import {levelDoorInit, observeLevelDoor} from '@/client/console/levelDoor';

/** The cadence an owed conclusion is re-asked on when nothing it reads has moved (the old truth witness's beat). */
export const CONCLUSION_REASK_MS = 500;
/** …and how long a hold stands before that cadence starts (a transient refusal settles by itself well inside it). */
export const CONCLUSION_REASK_GRACE_MS = 2500;

/**
 * THE GHOST's DOOR — a debt whose workspace reads a ghost and stands QUIET this long is torn down (`levelDoor.ts`).
 *
 * ITS BAR IS ITS OWN, AND LONGER THAN A CONCLUSION's: the cure is a teardown. What it stands on (the OWED track,
 * 2026-11-23 — the whole e2e suite in a real browser, the gate's 1 212 walks, the box's two-seat pass): a healthy
 * table reads «ghost» only UNDER A SCENE THAT IS PLAYING (seven ways, 644 ms at the longest — a hold or a ceiling
 * wait stands under each, so the door, which asks for quiet, does not look at them at all), and «ghost and quiet»
 * NOWHERE — the one such reading the suite had was a defect, a step the player was answering in the workspace's own
 * zone that nothing vouched for (`outcomeController.workspaceOutcomePromptServed`, the prelude chain's term). A second
 * of painted quiet is past every transient between an answer and what it starts, and a tenth of what the two clocks
 * took.
 */
export const OWED_GHOST_DOOR_QUIET_FRAMES = 60;
export const OWED_GHOST_DOOR_QUIET_MS = 1000;

/** What a re-ask did: the flow is over (`done`), went on into its own question in place (`handed`), or still holds. */
export type ConclusionReask = 'done' | 'handed' | 'held';

/** What the debts need of the workspace's owner (the outcome controller). */
export type ConclusionOwePort = {
  /**
   * THE FACTS THE DECISION IS MADE OF, as a key — pure and reactive, built from the SAME object the guarded conclusion
   * hands its policy (plus what the claim's reconcile reads). A debt is asked again when it differs from the key it
   * was last refused with.
   */
  facts(kind: WorkspaceFrameKind, servedPromptHolds: boolean): string,
  /** Ask again, with effects: reconcile a claim that may answer for nothing now, then conclude. */
  reask(kind: WorkspaceFrameKind, servedPromptHolds: boolean): ConclusionReask,
  /**
   * May the CADENCE re-ask (nothing it reads moved)? Not while the hold is the player's own time — a nested step being
   * answered, a parked flow, a claim serving a prompt on screen: those end by their own facts, and a re-ask every beat
   * would only print a lie into the field log.
   */
  cadenceApplies(kind: WorkspaceFrameKind): boolean,
  /** A workspace that keeps holding with NOTHING the player could act on. */
  ghost(kind: WorkspaceFrameKind): boolean,
  /**
   * NOTHING IS IN FLIGHT under the debt's own waits (its conclusion's node, its claim's, its frame's, its cadence) and
   * no look of the player's stands over the workspace — what the ghost's door waits out. A debt is itself a wait: asked
   * «does anything move under it», it is the question, never an answer.
   */
  quiet(kind: WorkspaceFrameKind): boolean,
  /** Tear a proven ghost down (the owner names what it tore). */
  force(kind: WorkspaceFrameKind, owedForMs: number): void,
};

type OwedRun = {
  kind: WorkspaceFrameKind,
  frame: FlowScope,
  servedPromptHolds: boolean,
  /** When the debt began (a re-owe of the same frame keeps it) — the cadence's grace, and what a teardown names. */
  since: number,
  withdrawn: boolean,
  /** The facts' key the conclusion was last asked (and refused) with. */
  askedWith: string,
  /** The run's own scope (a child of the frame's) — ended the moment the debt is withdrawn. */
  scope: FlowScope | undefined,
};

const runs = new Map<WorkspaceFrameKind, OwedRun>();
/** Bumped whenever a debt begins or ends: «which debts stand» is a REACTIVE fact (the shell's row watches their key). */
const epoch = shallowRef(0);
let port: ConclusionOwePort | undefined;

/** The owner registers how the conclusion is decided and made (the outcome controller, for the shell's life). */
export function registerConclusionOwePort(next: ConclusionOwePort | undefined): void {
  port = next;
  if (next === undefined) {
    for (const run of [...runs.values()]) {
      withdrawConclusionOwe(run.kind);
    }
  }
}

function live(kind: WorkspaceFrameKind): OwedRun | undefined {
  const run = runs.get(kind);
  if (run !== undefined && (run.withdrawn || run.frame.ended !== undefined)) {
    runs.delete(kind);
    return undefined;
  }
  return run;
}

/**
 * THE ENDING OF `kind` IS OWED — its one guarded conclusion just refused. Starts the frame's run, or (the same frame
 * owing again) keeps the one that stands with its clock: a re-owe is the same debt still unpaid.
 */
export function oweConclusion(kind: WorkspaceFrameKind, servedPromptHolds: boolean): void {
  const frame = workspaceFrameScope(kind);
  if (port === undefined || frame === undefined || frame.ended !== undefined) {
    return; // no frame owes it: a flow whose frame is on no stack has nothing left to end
  }
  const standing = live(kind);
  if (standing !== undefined && standing.frame === frame) {
    standing.servedPromptHolds = servedPromptHolds;
    standing.askedWith = port.facts(kind, servedPromptHolds); // refused again, just now, with these
    return;
  }
  const run: OwedRun = {
    kind, frame, servedPromptHolds, since: flowClock().now(), withdrawn: false, scope: undefined,
    // The refusal that owes it was made with the facts as they stand in this very call.
    askedWith: port.facts(kind, servedPromptHolds),
  };
  runs.set(kind, run);
  epoch.value++;
  void frame.run(`conclusion owed`, (scope) => drive(run, scope)).then(() => {
    // The frame went (or the run ended by itself): the debt is gone with it.
    if (runs.get(kind) === run) {
      runs.delete(kind);
      epoch.value++;
    }
  });
}

/** Ask one debt again, and settle it when the answer is not «held». */
function ask(run: OwedRun): ConclusionReask {
  if (port === undefined || run.withdrawn) {
    return 'done';
  }
  const asked = port.reask(run.kind, run.servedPromptHolds);
  if (asked === 'held') {
    if (port !== undefined) {
      run.askedWith = port.facts(run.kind, run.servedPromptHolds); // what it was refused with — wait for these to move
    }
  } else {
    withdrawConclusionOwe(run.kind);
  }
  return asked;
}

/**
 * THE RUN — the debt's own beat: the cadence for what the facts cannot say reactively, and the escalation. (The wake on
 * the facts themselves is the shell's row — `reaskMovedConclusions`.) It ends with its scope: the frame going, or the
 * debt being withdrawn.
 */
async function drive(run: OwedRun, scope: FlowScope): Promise<void> {
  run.scope = scope;
  // THE GHOST's DOOR, BY LEVEL — looked at every painted frame for the debt's whole life (a loop of this scope: it
  // ends with the debt). ONE opening per standing ghost; a ghost that stops being one, or anything in flight under
  // it, starts the quiet again.
  let door = levelDoorInit();
  scope.everyFrame('the ghost\'s door of an owed conclusion, by level', () => {
    if (run.withdrawn || port === undefined) {
      return false;
    }
    const now = flowClock().now();
    const ghost = port.ghost(run.kind);
    const seen = observeLevelDoor(door, {key: ghost ? run.kind : undefined, quiet: ghost && port.quiet(run.kind), now},
      {frames: OWED_GHOST_DOOR_QUIET_FRAMES, ms: OWED_GHOST_DOOR_QUIET_MS});
    door = seen.state;
    if (!seen.open) {
      return true;
    }
    const owner = port;
    withdrawConclusionOwe(run.kind);
    owner.force(run.kind, now - run.since);
    return false;
  });
  for (;;) {
    if (!(await scope.sleep(CONCLUSION_REASK_MS)) || run.withdrawn || port === undefined) {
      return;
    }
    const now = flowClock().now();
    if (now - run.since >= CONCLUSION_REASK_GRACE_MS && port.cadenceApplies(run.kind)) {
      const heldOn = conclusionRefusalOf(run.kind);
      const asked = ask(run);
      if (asked !== 'held') {
        // NAMED (invariant 4, and the field log's only word on it): the ending came on the CADENCE — nothing its facts
        // read had moved. Either a term of the decision is not reactive (the reactivity witness names which), or a
        // claim became releasable with no write behind it; the cost was at most one cadence, and it is said.
        console.warn(`[workspace-conclusion] «${run.kind}» ${asked === 'done' ? 'concluded' : 'went on into its question'} on the re-ask cadence, ` +
          `${Math.round((now - run.since) / 1000)}s after its ending was owed — nothing its facts read had moved; it last held on: ${heldOn}`);
        return;
      }
    }
    if (run.withdrawn || port === undefined) {
      return;
    }
  }
}

/**
 * THE KEY THE SHELL'S ROW WATCHES: the facts of every debt that stands (`''` — nothing is owed, so the row is inert for
 * the whole ordinary life of the console). Reactive: the debts themselves (`epoch`) and whatever `facts` reads.
 */
export function owedConclusionFactsKey(): string {
  void epoch.value;
  if (port === undefined || runs.size === 0) {
    return '';
  }
  const parts: Array<string> = [];
  for (const kind of [...runs.keys()]) {
    const run = live(kind);
    if (run !== undefined) {
      parts.push(`${kind}=${port.facts(kind, run.servedPromptHolds)}`);
    }
  }
  return parts.join('‖');
}

/**
 * THE FACTS MOVED (the shell's row, in its place in the tick): every debt whose facts differ from the ones it was last
 * refused with is asked again. Idempotent — a debt asked with the facts as they stand is not asked twice.
 */
export function reaskMovedConclusions(): void {
  if (port === undefined) {
    return;
  }
  for (const kind of [...runs.keys()]) {
    const run = live(kind);
    if (run !== undefined && port !== undefined && port.facts(kind, run.servedPromptHolds) !== run.askedWith) {
      ask(run);
    }
  }
}

/** Nothing is owed for `kind` any more (it concluded by another road, was handed to its question, or was torn down). */
export function withdrawConclusionOwe(kind: WorkspaceFrameKind): void {
  const run = runs.get(kind);
  if (run !== undefined) {
    run.withdrawn = true;
    runs.delete(kind);
    epoch.value++;
    run.scope?.end({how: 'cancelled', reason: 'nothing is owed any more'});
  }
}

/** Ask the owed conclusion of `kind` again NOW (a recovery door that just opened something for it). */
export function reaskOwedConclusion(kind: WorkspaceFrameKind): ConclusionReask | undefined {
  const run = live(kind);
  return run === undefined || port === undefined ? undefined : ask(run);
}

/** The debts that stand — diagnostics, and the wait graph's `conclusion:<kind>` nodes. */
export function owedConclusions(): ReadonlyArray<{kind: WorkspaceFrameKind, since: number, servedPromptHolds: boolean}> {
  void epoch.value;
  const out: Array<{kind: WorkspaceFrameKind, since: number, servedPromptHolds: boolean}> = [];
  for (const kind of [...runs.keys()]) {
    const run = live(kind);
    if (run !== undefined) {
      out.push({kind, since: run.since, servedPromptHolds: run.servedPromptHolds});
    }
  }
  return out;
}

/** Is the ending of `kind` owed right now? */
export function conclusionOwed(kind: WorkspaceFrameKind): boolean {
  void epoch.value;
  return live(kind) !== undefined;
}

/** Specs. */
export function resetConclusionOwes(): void {
  for (const run of [...runs.values()]) {
    withdrawConclusionOwe(run.kind);
  }
  runs.clear();
}
