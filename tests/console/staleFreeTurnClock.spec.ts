import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONCLUSION_DOOR_QUIET_FRAMES, CONCLUSION_DOOR_QUIET_MS, conclusionDoorInit, freeTurnConclusionCandidate, observeConclusionDoor, observeStaleFreeTurn,
  staleFreeTurnClockInit, staleFreeTurnHeld,
} from '@/client/console/supervisor/staleFreeTurnClock';
import {causeOf} from '@/common/diagnostics/cause';
import {workingAreaSettled} from '@/client/console/colonyTrade/workingAreaBack';

/*
 * A FINISHED FRAME OVER THE FREE TURN IS REAPED ON ITS OWN QUIET — never on a progress stamp one tick old, never
 * through a hold, never on the tick a new question arrived (CI 2026-11-11, run 42998242617 — `console-colony-pluto-
 * embed` :329: the Pluto payout waited on the player's take, the reaper's conclusion was HELD on `live-outcome`, the
 * take asked a new free-turn prompt and on that very tick the reaper read «9 s quiet», released the claim and
 * concluded the colonies under the trade's own closing beat — the track reset glided over a dissolving stage).
 * And the closing beat's stage gate waits for the working area's OWN return transitions, not for a wall-clock dwell.
 */
const STALE = 8_000;
const source = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'client', ...p), 'utf8').replace(/\r\n/g, '\n');

describe('the stale free-turn clock', () => {
  it('is due only after a whole quiet span on ONE key', () => {
    let clock = staleFreeTurnClockInit(0);
    let r = observeStaleFreeTurn(clock, {now: 1_000, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'a key first seen starts the clock').to.equal(false);
    clock = r.clock;
    r = observeStaleFreeTurn(clock, {now: 8_500, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due).to.equal(false);
    r = observeStaleFreeTurn(r.clock, {now: 9_100, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, '8 s after the key was first seen').to.equal(true);
  });

  it('THE PLUTO TAKE: a held conclusion, then a NEW prompt with the arbiter\'s stamp one tick old — not due', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE).clock;
    let r = observeStaleFreeTurn(clock, {now: 9_000, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'quiet 9 s on the payout — the reaper asks').to.equal(true);
    clock = staleFreeTurnHeld(r.clock, 9_000); // held: live-outcome (the take is owed)
    // The player takes the card: the server asks a NEW free-turn prompt; the arbiter has not observed it yet.
    r = observeStaleFreeTurn(clock, {now: 10_000, key: 'colonies|p2', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'a new question is progress — in this very tick').to.equal(false);
    r = observeStaleFreeTurn(r.clock, {now: 14_000, key: 'colonies|p2', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'the flow owns its closing beat for a whole span').to.equal(false);
  });

  it('a hold waits a whole quiet span again — never re-asked on the next tick', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).clock;
    clock = staleFreeTurnHeld(clock, 8_000);
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).due).to.equal(false);
    expect(observeStaleFreeTurn(clock, {now: 16_000, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).due).to.equal(true);
  });

  it('anything in flight and a non-candidate restart the clock; the arbiter\'s later progress still counts', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'k', inFlight: false, progressAt: 0}, STALE).clock;
    clock = observeStaleFreeTurn(clock, {now: 7_000, key: 'k', inFlight: true, progressAt: 0}, STALE).clock;
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'k', inFlight: false, progressAt: 0}, STALE).due).to.equal(false);
    clock = observeStaleFreeTurn(clock, {now: 9_000, key: undefined, inFlight: false, progressAt: 0}, STALE).clock;
    expect(clock.key).to.equal('');
    clock = observeStaleFreeTurn(staleFreeTurnClockInit(0), {now: 0, key: 'k', inFlight: false, progressAt: 0}, STALE).clock;
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'k', inFlight: false, progressAt: 5_000}, STALE).due,
      'the arbiter saw the picture move at 5 s').to.equal(false);
  });

  it('the reaper decides on the clock, never on the raw progress stamp', () => {
    const src = source('console', 'supervisor', 'supervisorController.ts');
    const start = src.indexOf('function reapStaleFreeTurnFrame(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    expect(body).to.contain('observeStaleFreeTurn(');
    expect(body, 'a held conclusion restarts the clock').to.contain('staleFreeTurnHeld(');
    expect(body, 'no stale verdict off `progressAt` alone').to.not.match(/Date\.now\(\) - livenessStateSnapshot\(\)\.progressAt >= STALE_FREE_TURN_MS/);
  });
});

describe('the working area is back when its own transitions ran out', () => {
  type Fake = {getAnimations?: () => Array<{transitionProperty?: string, finished: Promise<unknown>}>};
  const settled = (el: Fake, ms: number) => workingAreaSettled(el as unknown as Element, ms);

  it('nothing running (or no animation API) — at once', async () => {
    await settled({}, 5_000);
    await settled({getAnimations: () => []}, 5_000);
  });

  it('waits for a pending opacity transition, not for the dwell', async () => {
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => finish = resolve);
    let done = false;
    const p = settled({getAnimations: () => [{transitionProperty: 'opacity', finished}]}, 5_000).then(() => done = true);
    await new Promise((r) => setTimeout(r, 20));
    expect(done, 'still fading back').to.equal(false);
    finish();
    await p;
    expect(done).to.equal(true);
  });

  it('a cancelled transition is an ending; a transition that never ends is bounded', async () => {
    await settled({getAnimations: () => [{transitionProperty: 'transform', finished: Promise.reject(new Error('cancel'))}]}, 5_000);
    const t0 = Date.now();
    await settled({getAnimations: () => [{transitionProperty: 'opacity', finished: new Promise(() => undefined)}]}, 60);
    expect(Date.now() - t0).to.be.lessThan(2_000);
  });

  it('the stage gate releases through it, after the dwell, for THIS fall only', () => {
    const src = source('components', 'console', 'ConsoleColonyFocusStage.vue');
    const start = src.indexOf('watch(() => stageBusy.value, ');
    expect(start, 'the stage still watches `stageBusy`').to.be.greaterThan(-1);
    const body = src.slice(start, src.indexOf('\n}, {immediate: true});\n', start));
    expect(body).to.contain('workingAreaSettled(');
    expect(body.indexOf('workingAreaSettled('), 'the settle is asked before the release').to.be.lessThan(body.lastIndexOf('setColonyStageYielded(false)'));
    expect(body, 'a pose re-raised meanwhile owns the stage again').to.contain('back === stageBackToken.value');
  });
});

/*
 * THE CONCLUSION's CANDIDATE IS ONE PREDICATE (FREEZE ZERO, stage 2 - S5-rest): the reaper acts on it once a second, the
 * conclusion door's measure reads it every frame - beside the decision, in the outcome controller, never as one more
 * fact of the supervisor's port.
 */
describe('the conclusion\'s candidate - a committed frame over the free turn', () => {
  const frame = (over: Partial<{phase: string, anchor: {type: string}, serves: ReadonlyArray<string>}> = {}) =>
    ({phase: 'committed', anchor: {type: 'always'}, serves: [] as ReadonlyArray<string>, ...over});
  const table = (over: Partial<{asksFreeTurn: boolean, collapsed: boolean, yieldedToBoard: boolean, placement: boolean}> = {}) =>
    () => ({asksFreeTurn: true, collapsed: false, yieldedToBoard: false, placement: false, ...over});

  it('stands for a frame past its commit that does not serve the free turn the server asks', () => {
    expect(freeTurnConclusionCandidate(frame(), table())).is.true;
  });

  it('never for a frame still before its commit, a frame of a phase, or one that serves the turn itself', () => {
    expect(freeTurnConclusionCandidate(undefined, table()), 'no frame').is.false;
    for (const phase of ['browse', 'configure', 'executing', 'completing', 'verdict']) {
      expect(freeTurnConclusionCandidate(frame({phase}), table()), phase).is.false;
    }
    expect(freeTurnConclusionCandidate(frame({anchor: {type: 'phase'}}), table()), 'a frame of a phase: its life is the anchor rule\'s').is.false;
    expect(freeTurnConclusionCandidate(frame({serves: ['actionMenu']}), table()), 'the turn\'s own surface').is.false;
  });

  it('never when another question is asked, the stack is set aside or aside for the board, or a placement is live', () => {
    expect(freeTurnConclusionCandidate(frame(), table({asksFreeTurn: false}))).is.false;
    expect(freeTurnConclusionCandidate(frame(), table({collapsed: true}))).is.false;
    expect(freeTurnConclusionCandidate(frame(), table({yieldedToBoard: true}))).is.false;
    expect(freeTurnConclusionCandidate(frame(), table({placement: true}))).is.false;
  });

  it('the table is not even read when the frame says no (the measure asks every frame)', () => {
    let read = 0;
    freeTurnConclusionCandidate(frame({phase: 'browse'}), () => {
      read++;
      return {asksFreeTurn: true, collapsed: false, yieldedToBoard: false, placement: false};
    });
    expect(read).eq(0);
  });

  it('the reaper and the measure read the SAME predicate - and the measure lives with the conclusion\'s owner', () => {
    const supervisor = source('console', 'supervisor', 'supervisorController.ts');
    const outcome = source('console', 'shell', 'outcomeController.ts');
    expect(supervisor).to.contain('return freeTurnConclusionCandidate(workspaceStackTop(), ');
    expect(outcome).to.contain('const candidate = freeTurnConclusionCandidate(top, ');
    expect(outcome).to.contain('flow.everyFrame(\'the conclusion\\\'s door, by level\', lookAtConclusionDoor);');
    expect(supervisor, 'the supervisor\'s port takes no verdict of the conclusion').to.not.contain('conclusionVerdictNow');
    // Stats only: the measure concludes nothing.
    const body = outcome.slice(outcome.indexOf('function measureConcludeDoor('), outcome.indexOf('* THE CONCLUSION\'s LEVEL DOOR (`staleFreeTurnClock.observeConclusionDoor`'));
    expect(body.length, 'the measure is read').to.be.greaterThan(400);
    expect(body).to.not.match(/concludeWorkspaceFlow|closeWorkspaceRoot|goBoardHome|popWorkspaceFrame/);
    // …and the DOOR, beside it, ends a frame through the ONE guarded conclusion and nothing else.
    const door = outcome.slice(outcome.indexOf('function lookAtConclusionDoor('), outcome.indexOf('/** The ghost test\'s read of the table'));
    expect(door).to.contain('const door = observeConclusionDoor(before, {key: seen?.key, quiet: seen?.quiet === true, now});');
    expect(door).to.contain('const left = concludeWorkspaceFlow(seen.kind);');
    expect(door, 'never a bare close').to.not.match(/closeWorkspaceRoot|goBoardHome|popWorkspaceFrame|releaseWorkspaceOutcome/);
    // The door's «quiet» is the measure's three terms: the guarded verdict, no look the player reads, nothing in flight.
    expect(body).to.contain('quiet: conclusion.verdict === \'dismiss\' && look === \'\' && flight === \'\',');
  });
});

/*
 * THE CONCLUSION's LEVEL DOOR — the rule (pure). A finished frame over the free turn that stands dismissible, unread
 * and with nothing in flight for the door's frames LEAVES; anything moving, held or read starts the quiet again; one
 * opening per standing candidate.
 */
describe('the conclusion\'s level door — quiet for its frames, once per standing candidate', () => {
  const walk = (looks: ReadonlyArray<{key: string | undefined, quiet: boolean, now: number}>) => {
    let state = conclusionDoorInit();
    const opened: Array<number> = [];
    looks.forEach((look, i) => {
      const seen = observeConclusionDoor(state, look);
      state = seen.state;
      if (seen.open) {
        opened.push(i);
      }
    });
    return {state, opened};
  };
  const frames = (n: number, from: number, over: Partial<{key: string | undefined, quiet: boolean}> = {}, step = 16) =>
    Array.from({length: n}, (_v, i) => ({key: 'colonies|7' as string | undefined, quiet: true, now: from + i * step, ...over}));

  it('opens after the door\'s frames of quiet — and not a frame sooner', () => {
    expect(walk(frames(CONCLUSION_DOOR_QUIET_FRAMES - 1, 1_000, {}, 40)).opened, 'one frame short').to.deep.eq([]);
    // At 60 Hz the frames come first; the door then waits for its wall-clock floor (250 ms ≈ the 17th frame).
    const at60 = walk(frames(40, 1_000));
    expect(at60.opened.length, 'ONCE').to.eq(1);
    expect(at60.opened[0]).to.eq(Math.ceil(CONCLUSION_DOOR_QUIET_MS / 16));
    // On a slow page (40 ms a frame) the floor is long past: the twelfth frame opens it.
    expect(walk(frames(40, 1_000, {}, 40)).opened).to.deep.eq([CONCLUSION_DOOR_QUIET_FRAMES - 1]);
    // A 120 Hz page does not halve the wait: the floor holds.
    const at120 = walk(frames(80, 1_000, {}, 8));
    expect(at120.opened[0] * 8, 'no sooner than the floor').to.be.at.least(CONCLUSION_DOOR_QUIET_MS);
  });

  it('anything in flight, a hold or a look starts the quiet again', () => {
    const looks = [...frames(10, 1_000, {}, 40), ...frames(1, 1_400, {quiet: false}), ...frames(11, 1_440, {}, 40)];
    expect(walk(looks).opened, 'ten quiet frames, one busy, eleven quiet: never twelve in a row').to.deep.eq([]);
    expect(walk([...looks, ...frames(1, 1_880, {}, 40)]).opened, 'the twelfth after the break').to.deep.eq([looks.length]);
  });

  it('one opening per standing candidate; a NEW question on the same frame is a new candidate; no candidate forgets all', () => {
    // The door opened and the frame still stands (the conclusion held): it does not open again every twelve frames.
    expect(walk(frames(200, 1_000, {}, 40)).opened).to.deep.eq([CONCLUSION_DOOR_QUIET_FRAMES - 1]);
    // …even across a busy spell of the same candidate.
    expect(walk([...frames(20, 1_000, {}, 40), ...frames(3, 1_800, {quiet: false}, 40), ...frames(40, 1_920, {}, 40)]).opened.length).to.eq(1);
    // A new prompt on the same frame restarts the count — and may open once more.
    const again = walk([...frames(20, 1_000, {}, 40), ...frames(20, 1_800, {key: 'colonies|8'}, 40)]);
    expect(again.opened).to.deep.eq([CONCLUSION_DOOR_QUIET_FRAMES - 1, 20 + CONCLUSION_DOOR_QUIET_FRAMES - 1]);
    // The candidate gone: the state is the empty one (the next candidate starts from nothing).
    expect(walk([...frames(20, 1_000, {}, 40), ...frames(1, 1_800, {key: undefined})]).state).to.deep.eq(conclusionDoorInit());
  });

  it('the door\'s line is the trail of which flow left its ending to the level — counted, never a defect', () => {
    const line = '[workspace-conclusion] «colonies» left by the level door — finished over the free turn and quiet for 16 frames / 256 ms (frames: colonies:committed)';
    expect(causeOf(line, 'warn')).to.deep.include({cls: 'workspace-conclusion/level-door/colonies', tier: 'info'});
  });
});
