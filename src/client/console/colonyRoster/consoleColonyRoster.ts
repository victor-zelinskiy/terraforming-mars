/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COLONY ROSTER CEREMONY — the CONTROLLER (reactive state, the two tempos,
 * the hold). A colony tile entering the game, leaving it, or being replaced in
 * its slot is an EVENT on screen: the planet leaves its place as an object and
 * the new one arrives as an object, docks in its slot, and the tile assembles
 * around it. Contract and the eleven laws: docs/COLONY_ROSTER_CEREMONY.md.
 *
 * TWO TEMPOS, ONE OWNER EACH — never two gates racing for one answer:
 *
 *  · THE PLAYER'S OWN FLOW is a client-ARMED transport gate, the colony
 *    build's shape: `armColonyRosterChange` at A (before the POST) →
 *    `detectColonyRosterChange` on the answer (the views' diff must BE the
 *    armed change, or the arm is dropped and the view simply applies) →
 *    `runColonyRosterCeremony` with the COMMIT HELD (the stage still shows what
 *    was confirmed: the leaving tile's seat, the hero in its projection pose)
 *    → the commit lands under the docked planet → the shell plays the LANDING.
 *
 *  · A WATCHER (somebody else changed the table while this screen shows the
 *    colony grid) is SEEDED from the views' diff in the transport's apply
 *    block (`seedColonyRosterHolds`): the table as PRESENTED stays the old one
 *    (`presentedColonyRoster`), the ceremony is owed and plays on the grid.
 *    With no grid on screen nothing is seeded — a hold nobody will release
 *    does not exist; the table is simply new.
 *
 * THE PRESENTED ROSTER IS ONE: `presentedColonyRoster(colonies)` is the only
 * reader of «which tiles stand on the grid» while a ceremony is owed or live.
 *
 * THE HOLD IS NAMED, REACTIVE AND BOUNDED: supplier `colony-roster`, released
 * by the landing (a handle's end fires on completion AND on interruption),
 * with an owner recovery (`expire`) and a diagnosis. Never a `setTimeout` as
 * the release. Input during the ceremony is `none`; A «presses it through»
 * (`hurryColonyRoster` — final poses at once, never a skipped beat's state
 * and never a second submit).
 */
import {nextTick, reactive} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {ColonyRosterChange} from '@/common/colonies/ColonyRoster';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ROSTER_REDUCED_MS, rosterBeats, rosterCeremonyMs, rosterDiff} from '@/client/console/colonyRoster/colonyRosterModel';
import {
  RosterMotionHandle, holdTileForArrival, playHeroDepart, playReseatIn, playReseatOut, playStageArrive, playStageDepart,
  playTileArrive, playTileDepart,
} from '@/client/console/colonyRoster/colonyRosterDirector';

/** What the player confirmed at A — the change the answer must carry. */
export type ColonyRosterArm = {
  kind: ColonyRosterChange['kind'];
  removed?: ColonyName;
  added?: ColonyName;
  /** The same answer also builds the player's colony on the entering tile (the build hero then lands on this stage). */
  builds: boolean;
};

/** What the grid shows once the stage has folded home — the receipt of a finished change. */
export type ColonyRosterReceipt = {removed?: ColonyName, added?: ColonyName, built: boolean};

export const colonyRosterState = reactive({
  /** OWN FLOW: the confirmed change, awaiting its answer. */
  armed: undefined as ColonyRosterArm | undefined,
  /** The change being played (own flow or a watcher's). */
  change: undefined as ColonyRosterChange | undefined,
  /** A ceremony is on screen — input is `none`, the hold stands. */
  live: false,
  /** Which beat is playing ('' between them). */
  beat: '' as '' | 'depart' | 'reseat' | 'arrive',
  /** Where it plays: the tile's stage (the player's own flow) or the grid (a watcher). */
  scale: 'stage' as 'stage' | 'tile',
  /** A WATCHER's table as PRESENTED while its ceremony is owed / live — the models «before» (undefined = the live table). */
  held: undefined as ReadonlyArray<ColonyModel> | undefined,
  /** The slot that stands EMPTY right now — the free orbit ('' = none): the tile left, its successor has not docked. */
  orbit: '' as ColonyName | '',
  /** STAGE: the leaving tile's seat has let go (the seat hides). */
  seatGone: false,
  /** STAGE: the hero has DOCKED — the projection pose is dropped (orbit closed, rim up). */
  docked: false,
  /** OWN FLOW, after the commit: what the grid states while it stands as a receipt (no cursor, no verbs). */
  receipt: undefined as ColonyRosterReceipt | undefined,
  /** Why the last ceremony could not be flown ('' = it flew). CONFESSED on the section root. */
  degraded: '',
});

/** THE DRAFT of a replacement: the tile chosen to LEAVE (level 1 → 2). Survives a park; cleared by the flow's end and the abort battery. */
export const colonyRosterDraft = reactive({
  outgoing: undefined as ColonyName | undefined,
});

let handle: RosterMotionHandle | undefined;
let runResolve: (() => void) | undefined;
let safety: number | undefined;
/** The change the player's OWN gate just played — the apply block that follows it must not seed it again for the grid. */
let ownPlayed: string | undefined;

function signature(change: ColonyRosterChange): string {
  return `${change.kind}|${change.removed ?? ''}|${change.added ?? ''}|${change.slot}`;
}

/** «Is the colony GRID standing on screen right now (browse, not a stage, not the viewer's own transaction)?» — registered by the shell. */
let gridProbe: () => boolean = () => false;

export function registerColonyRosterHost(probe: (() => boolean) | undefined): void {
  gridProbe = probe ?? (() => false);
}

registerAnimationHoldSupplier('colony-roster', () => colonyRosterState.live, {
  diagnose: () => ({beat: colonyRosterState.beat, scale: colonyRosterState.scale, change: colonyRosterState.change}),
  expire: () => abortColonyRoster('expired'),
});

/** The pad is the ceremony's: every verb is `none` (A hurries it through). */
export function isColonyRosterInputLocked(): boolean {
  return colonyRosterState.live;
}

/** A change is confirmed and its answer has not been played yet (the stage is pinned). */
export function colonyRosterPending(): boolean {
  return colonyRosterState.armed !== undefined || colonyRosterState.live;
}

/**
 * THE ONE READER of which tiles stand on the grid: the live table — or, while
 * a watcher's ceremony is owed / live, the table as it stood before.
 */
export function presentedColonyRoster(colonies: ReadonlyArray<ColonyModel>): ReadonlyArray<ColonyModel> {
  return colonyRosterState.held ?? colonies;
}

// ── element resolution ──────────────────────────────────────────────────────

function quoted(name: string): string {
  return name.replace(/["\\]/g, '\\$&');
}

function gridEl(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.con-colonies .con-colonies__grid');
}

function tileEl(name: string): HTMLElement | null {
  return gridEl()?.querySelector<HTMLElement>(`[data-test="con-colony-${quoted(name)}"]`) ?? null;
}

function stageEl(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.con-colonies .con-colfocus');
}

function seatEl(): HTMLElement | null {
  return stageEl()?.querySelector<HTMLElement>('[data-roster-outgoing-seat]') ?? null;
}

/** A beat as a promise: resolved by the handle's end — natural, hurried or killed. */
function beat(play: (done: () => void) => RosterMotionHandle | undefined): Promise<void> {
  return new Promise<void>((resolve) => {
    const started = play(() => {
      handle = undefined;
      resolve();
    });
    if (started === undefined) {
      resolve();
      return;
    }
    handle = started;
  });
}

function reducedBeat(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, motionMs(ROSTER_REDUCED_MS));
  });
}

function begin(change: ColonyRosterChange, scale: 'stage' | 'tile'): void {
  colonyRosterState.change = change;
  colonyRosterState.scale = scale;
  colonyRosterState.live = true;
  colonyRosterState.beat = '';
  colonyRosterState.degraded = '';
}

function end(): void {
  colonyRosterState.live = false;
  colonyRosterState.beat = '';
  colonyRosterState.change = undefined;
  colonyRosterState.orbit = '';
  if (safety !== undefined) {
    window.clearTimeout(safety);
    safety = undefined;
  }
  const resolve = runResolve;
  runResolve = undefined;
  resolve?.();
}

// ── THE PLAYER'S OWN FLOW — the armed transport gate ────────────────────────

/** ARM (A on the stage, BEFORE the POST). */
export function armColonyRosterChange(arm: ColonyRosterArm): void {
  colonyRosterState.armed = arm;
  colonyRosterState.seatGone = false;
  colonyRosterState.docked = false;
  colonyRosterState.receipt = undefined;
  colonyRosterState.degraded = '';
}

/**
 * DETECT (the transport's commit path) — consume the arm exactly once. The
 * answer must really carry the armed change (the views' diff IS it): a parked
 * tail, a re-ask or a refusal carries none, the arm is dropped and the view
 * applies as it is.
 */
export function detectColonyRosterChange(prevView: ViewModel | undefined, newView: ViewModel | undefined): ColonyRosterChange | undefined {
  const arm = colonyRosterState.armed;
  if (arm === undefined) {
    return undefined;
  }
  const before = (prevView?.game?.colonies ?? []).map((c) => c.name);
  const after = (newView?.game?.colonies ?? []).map((c) => c.name);
  const change = rosterDiff(before, after);
  if (change === undefined || change.kind !== arm.kind || change.removed !== arm.removed || change.added !== arm.added) {
    // Not landed with this answer. The arm stays for a PARKED tail's later answer only while the flow that made it
    // stands — the shell clears it when the flow ends (`clearColonyRoster`).
    return undefined;
  }
  colonyRosterState.armed = undefined;
  return change;
}

/**
 * RUN (the transport awaits it with the commit HELD) — the stage's ceremony:
 * the leaving tile's seat lets go, then the hero docks. Resolves once the
 * planet has docked (the build hero and the commit follow). NEVER rejects: a
 * stage that cannot be measured is CONFESSED and lands in its final pose.
 */
export function runColonyRosterCeremony(change: ColonyRosterChange, builds: boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    ownPlayed = signature(change);
    begin(change, 'stage');
    colonyRosterState.receipt = {removed: change.removed, added: change.added, built: builds};
    safety = window.setTimeout(() => abortColonyRoster('safety'), motionMs(rosterCeremonyMs(change)) + 4000);
    void playOnStage(change).finally(() => end());
  });
}

async function playOnStage(change: ColonyRosterChange): Promise<void> {
  const stage = stageEl();
  if (consoleReducedMotionActive() || stage === null) {
    if (stage === null) {
      colonyRosterState.degraded = `${change.kind}: no stage`;
    }
    colonyRosterState.seatGone = true;
    colonyRosterState.docked = true;
    await reducedBeat();
    return;
  }
  for (const step of rosterBeats(change)) {
    if (!colonyRosterState.live) {
      return;
    }
    if (step === 'depart') {
      colonyRosterState.beat = 'depart';
      const seat = seatEl();
      // A replacement lets the leaving tile's SEAT go; a bare removal lets the HERO itself go.
      await beat((done) => change.kind === 'replace' ?
        (seat === null ? undefined : playStageDepart(seat, done)) :
        playHeroDepart(stage, done));
      colonyRosterState.seatGone = true;
    } else if (step === 'arrive') {
      colonyRosterState.beat = 'arrive';
      await beat((done) => playStageArrive(stage, () => {
        colonyRosterState.docked = true;
      }, done));
      colonyRosterState.docked = true;
    }
    // (RESEAT is never played on the stage: the grid is parked under it, and its one fit happens there, unseen.)
  }
}

// ── A WATCHER — seeded from the views' diff ─────────────────────────────────

/**
 * THE APPLY-BLOCK SEED (`gameTransport.seedRewardHolds`, and `App.update` for
 * a poll / WS view): the table changed, nobody on this screen armed it, and
 * the colony grid stands → hold the presented table at «before» and owe the
 * ceremony. No grid → nothing is seeded. A no-op for every other view.
 */
export function seedColonyRosterHolds(before: PlayerViewModel | ViewModel | undefined, after: PlayerViewModel | ViewModel | undefined): void {
  if (colonyRosterState.live || colonyRosterState.armed !== undefined || colonyRosterState.held !== undefined) {
    return; // the player's own flow owns this answer — never seeded a second time
  }
  const was = before?.game?.colonies;
  const now = after?.game?.colonies;
  if (was === undefined || now === undefined || was.length === 0) {
    return;
  }
  const change = rosterDiff(was.map((c) => c.name), now.map((c) => c.name));
  if (change === undefined) {
    return;
  }
  if (ownPlayed === signature(change)) {
    // The player's own gate played this very change with the commit held — it is not a watcher's.
    ownPlayed = undefined;
    return;
  }
  if (!gridProbe()) {
    return;
  }
  colonyRosterState.held = was;
  begin(change, 'tile');
  safety = window.setTimeout(() => abortColonyRoster('safety'), motionMs(rosterCeremonyMs(change)) + 4000);
  // After the view applied and the DOM patched: the grid still shows the held table.
  void nextTick(() => {
    void playOnGrid(change).finally(() => {
      colonyRosterState.held = undefined;
      end();
    });
  });
}

/** Two frames: the released table has rendered and the section's one fit has landed. */
function settled(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

async function playOnGrid(change: ColonyRosterChange): Promise<void> {
  const grid = gridEl();
  if (consoleReducedMotionActive() || grid === null) {
    if (grid === null) {
      colonyRosterState.degraded = `${change.kind}: no grid`;
    }
    colonyRosterState.held = undefined;
    await reducedBeat();
    return;
  }
  const release = async (): Promise<void> => {
    colonyRosterState.held = undefined;
    await nextTick();
  };
  for (const step of rosterBeats(change)) {
    if (!colonyRosterState.live) {
      return;
    }
    colonyRosterState.beat = step;
    if (step === 'depart') {
      const tile = change.removed === undefined ? null : tileEl(change.removed);
      if (tile === null) {
        colonyRosterState.degraded = `${change.kind}: no tile ${change.removed}`;
      } else {
        await beat((done) => playTileDepart(tile, done));
      }
      if (change.kind === 'replace' && change.added !== undefined) {
        // THE SLOT EXISTS BEFORE THE OBJECT: the new tile mounts in the very slot, dark — the free orbit.
        colonyRosterState.orbit = change.added;
        await release();
        const arriving = tileEl(change.added);
        if (arriving !== null) {
          holdTileForArrival(arriving);
        }
      }
    } else if (step === 'reseat') {
      // The NUMBER of tiles changes: content lets go, the table is released, the ONE fit lands, content returns.
      await beat((done) => playReseatOut(grid, done));
      if (change.kind === 'add' && change.added !== undefined) {
        colonyRosterState.orbit = change.added;
      }
      await release();
      await settled();
      const arriving = change.kind === 'add' && change.added !== undefined ? tileEl(change.added) : null;
      if (arriving !== null) {
        holdTileForArrival(arriving);
      }
      await beat((done) => playReseatIn(grid, arriving, done));
    } else {
      const tile = change.added === undefined ? null : tileEl(change.added);
      if (tile === null) {
        colonyRosterState.degraded = `${change.kind}: no tile ${change.added}`;
      } else {
        await beat((done) => playTileArrive(tile, done));
      }
      colonyRosterState.orbit = '';
    }
  }
}

// ── hurry · abort · clear ───────────────────────────────────────────────────

/** A during the ceremony — «дожать»: the playing beat jumps to its final pose (the next beat then plays; never a second submit). */
export function hurryColonyRoster(): void {
  handle?.finish();
}

/** ABORT — a refusal, a safety, an expired hold, an unmount: final poses, every hold of its own released. */
export function abortColonyRoster(why: string = 'abort'): void {
  if (colonyRosterState.live && why !== 'abort') {
    colonyRosterState.degraded = `${colonyRosterState.change?.kind ?? ''}: ${why}`;
  }
  const playing = handle;
  handle = undefined;
  playing?.kill();
  colonyRosterState.held = undefined;
  colonyRosterState.seatGone = true;
  colonyRosterState.docked = true;
  if (colonyRosterState.live || runResolve !== undefined) {
    end();
  }
}

/**
 * The flow that armed the change is over (or was refused / cancelled): the
 * arm, the draft and the receipt go; a ceremony mid-flight ends in its final
 * pose. Idempotent — the transport's abort battery calls it on every refusal.
 */
export function clearColonyRoster(): void {
  abortColonyRoster();
  colonyRosterState.armed = undefined;
  colonyRosterState.receipt = undefined;
  colonyRosterState.seatGone = false;
  colonyRosterState.docked = false;
  colonyRosterDraft.outgoing = undefined;
  ownPlayed = undefined;
}

/** A refused submit: the arm goes, the DRAFT stays (the player is still choosing — B walks back as before). */
export function disarmColonyRoster(): void {
  abortColonyRoster();
  colonyRosterState.armed = undefined;
  colonyRosterState.receipt = undefined;
  colonyRosterState.seatGone = false;
  colonyRosterState.docked = false;
}

/** Test-only reset. */
export function resetColonyRoster(): void {
  clearColonyRoster();
  colonyRosterState.degraded = '';
  gridProbe = () => false;
}
