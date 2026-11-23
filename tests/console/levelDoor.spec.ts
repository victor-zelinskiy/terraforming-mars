import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {levelDoorInit, observeLevelDoor} from '@/client/console/levelDoor';
import {START_STRAND_DOOR_QUIET_FRAMES, START_STRAND_DOOR_QUIET_MS} from '@/client/console/startServing';
import {CONCLUSION_DOOR_QUIET_FRAMES, CONCLUSION_DOOR_QUIET_MS, conclusionDoorInit, observeConclusionDoor} from '@/client/console/supervisor/staleFreeTurnClock';

/*
 * A DOOR BY LEVEL (FREEZE ZERO, stage 2 — `levelDoor.ts`): a decision right as a function of what STANDS is executed
 * when that state has stood quiet for the door's frames — once per standing state — and never left to an edge that
 * can be missed. One rule for the console's doors; each door brings its bar.
 */
describe('levelDoor — quiet for the bar, once per standing state', () => {
  const BAR = {frames: 4, ms: 100};
  const walk = (looks: ReadonlyArray<{key: string | undefined, quiet: boolean, now: number}>, bar = BAR) => {
    let state = levelDoorInit();
    const opened: Array<number> = [];
    looks.forEach((look, i) => {
      const seen = observeLevelDoor(state, look, bar);
      state = seen.state;
      if (seen.open) {
        opened.push(i);
      }
    });
    return {state, opened};
  };
  const frames = (n: number, from: number, step: number, over: Partial<{key: string | undefined, quiet: boolean}> = {}) =>
    Array.from({length: n}, (_v, i) => ({key: 'a' as string | undefined, quiet: true, now: from + i * step, ...over}));

  it('counts FRAMES, with a floor of wall-clock time: a slow page waits as many frames, a fast one no less than the floor', () => {
    expect(walk(frames(3, 0, 50)).opened, 'one frame short').to.deep.eq([]);
    expect(walk(frames(10, 0, 50)).opened, 'a slow page: the fourth frame').to.deep.eq([3]);
    expect(walk(frames(40, 0, 10)).opened, 'a fast page: the floor — 100 ms after the quiet began').to.deep.eq([10]);
  });

  it('anything that is not quiet starts the count again; a new state is a new count; nothing standing forgets all', () => {
    expect(walk([...frames(3, 0, 50), ...frames(1, 150, 50, {quiet: false}), ...frames(3, 200, 50)]).opened).to.deep.eq([]);
    expect(walk([...frames(3, 0, 50), ...frames(4, 150, 50, {key: 'b'})]).opened, 'three of `a`, four of `b`').to.deep.eq([6]);
    expect(walk([...frames(6, 0, 50), ...frames(1, 300, 50, {key: undefined})]).state).to.deep.eq(levelDoorInit());
  });

  it('opens ONCE per standing state — through a busy spell too; the state returning after it left is a new one', () => {
    expect(walk(frames(50, 0, 50)).opened).to.deep.eq([3]);
    expect(walk([...frames(6, 0, 50), ...frames(2, 300, 50, {quiet: false}), ...frames(20, 400, 50)]).opened).to.deep.eq([3]);
    expect(walk([...frames(6, 0, 50), ...frames(1, 300, 50, {key: undefined}), ...frames(6, 350, 50)]).opened).to.deep.eq([3, 10]);
  });

  it('the conclusion\'s door is this rule with the conclusion\'s bar', () => {
    let a = conclusionDoorInit();
    let b = levelDoorInit();
    for (let i = 0; i < 40; i++) {
      const look = {key: 'colonies|7', quiet: i !== 5, now: 1_000 + i * 20};
      const seenA = observeConclusionDoor(a, look);
      const seenB = observeLevelDoor(b, look, {frames: CONCLUSION_DOOR_QUIET_FRAMES, ms: CONCLUSION_DOOR_QUIET_MS});
      expect(seenA, `look ${i}`).to.deep.eq(seenB);
      a = seenA.state;
      b = seenB.state;
    }
    expect(a.opened, 'it opened on the way').is.true;
  });
});

/*
 * THE STRAND's DOOR (stage 2b) — the watchdog's own cure, executed by level: the heal when the strand has stood quiet
 * for the bar, the yield when it STILL stands quiet for the bar again. The door is the cure's ONE caller: the two
 * timers that stood behind it (2.5 s + 2.5 s) are retired — each verb runs once per strand.
 */
describe('the strand\'s level door — the watchdog\'s cure, by level (the wiring)', () => {
  const start = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/shell/startController.ts'), 'utf8').replace(/\r\n/g, '\n');
  const body = start.slice(start.indexOf('function whenStartStrandedNowChanges('), start.indexOf('THE START SHADOW\'s judge (phase 0)'));

  it('the bar is far past the longest healthy quiet (one frame) and its two openings fit well inside a second', () => {
    expect(START_STRAND_DOOR_QUIET_FRAMES).to.be.at.least(8);
    expect(START_STRAND_DOOR_QUIET_MS * 2, 'the heal AND the yield — where the timers took five seconds').to.be.at.most(1_000);
  });

  it('the door reads the strand by frame: quiet for the bar → the heal; healed and still quiet for the bar → the yield', () => {
    expect(body.length, 'the function is read').to.be.greaterThan(2_000);
    expect(body).to.contain('const seen = observeLevelDoor(door, {key: strandCure.healed() ? `${stood} · healed` : stood, quiet: flight === \'\', now: Date.now()},');
    expect(body).to.contain('{frames: START_STRAND_DOOR_QUIET_FRAMES, ms: START_STRAND_DOOR_QUIET_MS});');
    expect(body).to.match(/if \(seen\.open\) \{\s+if \(strandCure\.healed\(\)\) \{\s+strandCure\.yieldToShell\('level'\);\s+\} else \{\s+strandCure\.heal\('level'\);/);
    // «Quiet» is the one reader of what is in flight — the same as the other two doors'.
    expect(body).to.contain('const flight = flightsInTheAir();');
  });

  it('ONE cure, ONE caller: each verb runs once per strand and only while the strand stands; no timer is left behind the door', () => {
    expect(body).to.match(/const heal = \(by: 'level'\): void => \{\s+if \(healedBy !== undefined \|\| !startStrandedNow\.value\) \{\s+return;/);
    expect(body).to.match(/const yieldToShell = \(by: 'level'\): void => \{\s+if \(yielded \|\| healedBy === undefined \|\| !startStrandedNow\.value\) \{\s+return;/);
    expect(start, 'the watchdog\'s timers and the shadow\'s confirm are gone from the controller').to.not.match(/START_STRAND_CONFIRM_MS|START_STRAND_YIELD_MS|START_SHADOW_CONFIRM_MS|START_SHADOW_HELD_MS|cancelStartStrand|cancelStartShadow/);
    // The line says who acted (the same two shapes — every e2e test is red on either).
    expect(body).to.contain('report(\'confirmed\', {heal: healed, by});');
    expect(body).to.contain('report(\'yielded to the shell (the heal did not end it)\', {heal: healed, by});');
    // A strand that cleared takes its verbs away: a late look of the door can cure nothing.
    expect(body).to.match(/cancelStrandLook = \(\) => \{\};\s+strandCure\.heal = \(\) => \{\};\s+strandCure\.yieldToShell = \(\) => \{\};\s+strandCure\.healed = \(\) => false;/);
  });
});
