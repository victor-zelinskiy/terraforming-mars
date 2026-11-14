/*
 * THE CLASSES, REPLAYED (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4: every class closed gets a law, a
 * guard and a REPLAY). Each test here is one cause class the monkey or the field named, stood up in the bottle — the
 * real application against the real server, on the manual clock — by the presses that produced it, and held to the
 * property the fix established. Seconds each, no box, no chance: a class that comes back turns its replay red before
 * any monkey walks into it again.
 *
 * A replay asserts on the PRODUCT's own journal (`bottle.liveness().defects` — every defect-tier record by its cause
 * class) and on what the player has on screen (the frames, the command bar) — never on a net's wording.
 */
import {expect} from 'chai';
import {bootBottle, ConsoleBottle} from './consoleBottle';
import {bottleServer} from './bottleNode';

describe('THE CLASSES, REPLAYED — each cause class of the worklist, in the bottle', function() {
  // A bottle boots a whole application; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(600_000);
  let bottle: ConsoleBottle | undefined;

  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
  });

  const classes = (): Array<string> => (bottle?.liveness().defects ?? []).map((d) => d.cls);

  /*
   * `start-shadow/finding/disagree/firstaction/game` — the monkey's baseline, seed `fz0` · `hydro-terminal-surge`.
   * The first press of the walk was B on the start workspace standing on the corporation's first action: the player
   * MINIMIZES it («B Свернуть»), the frame leaves the stack and the board stands with the restore card. The shadow
   * of the start director read the missing frame as «the game on screen for the start's own question» and filed a
   * defect for a screen the player had asked for. The law: a question the player set aside is `parked`, whether or
   * not the start's frame is mounted (`startDirector.actualStartOwner`).
   */
  it('B on the corporation\'s first action is the player\'s own minimize: the restore card stands, nothing is filed, A returns', async () => {
    const table = await bottleServer().bootFixture('hydro-terminal-surge');
    bottle = await bootBottle(table);
    await bottle.advance(4_000);
    expect(bottle.frames(), 'the start workspace stands on the first action').to.deep.equal(['start:browse']);
    expect(bottle.bar(), 'B minimizes — the verb is on the bar').to.match(/Minimize/);

    expect(await bottle.press('Escape')).to.equal('consumed');
    // Past the shadow's own confirmation (3 s) and the arbiter's grace (10 s): whatever judges the screen has judged it.
    await bottle.advance(15_000);
    expect(bottle.frames(), 'the frame left with the minimize').to.deep.equal([]);
    expect(bottle.bar(), 'the way back is on screen').to.match(/Return to the decision/);
    expect(bottle.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes(), 'a screen the player asked for is nobody\'s finding').to.deep.equal([]);

    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(3_000);
    expect(bottle.frames(), 'A on the restore card brings the first action back').to.deep.equal(['start:browse']);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/surface:parliament` — the monkey's baseline,
   * seed `fz0` · `eden-alliance-enact-remote`. The other seat's pass is the last: the sitting reaches the viewer by
   * the poll and its PLATE «ПАРЛАМЕНТ · Заседание» is the door in. The walk did not press A on it — it opened the
   * Parliament from the quick wheel (RT → ▼). That stood a lateral Parliament BESIDE the door: the beat stayed held
   * behind the workspace that hid its plate, the question waited for the gate, the frame for its question — a dead
   * screen until the wait graph named the cycle and acknowledged the beat. The law: while a flow's plate stands,
   * every road into that flow's workspace IS the plate's door (`workspaceController.enterOrRestoreWorkspace`).
   */
  it('the sitting\'s plate stands and the Parliament is opened from the WHEEL: that press is the plate\'s door — no cycle for a net to cure', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    expect(await bottle.otherSeatMoves(1), 'the other seat passes — the last pass of the generation').to.equal('pass');
    const announced = await bottle.until(() => document.querySelectorAll('.con-mandatory').length > 0, 60_000);
    expect(announced, 'the sitting is announced: its plate stands on the board').to.equal(true);
    expect(bottle.frames(), 'nothing is open yet').to.deep.equal([]);

    // THE OTHER ROAD: RT (the quick wheel) → ▼ «Парламент» — never the plate's A.
    await bottle.press('Period');
    await bottle.advance(600);
    await bottle.press('ArrowDown');
    const opened = await bottle.until(() => bottle?.frames().some((f) => f.startsWith('parliament:')) === true, 20_000);
    expect(opened, `the Parliament opened (frames: ${bottle.frames().join(' ')})`).to.equal(true);
    // Past the graph's confirmation of a cycle and the arbiter's grace: whatever would have judged the screen has.
    await bottle.advance(20_000);
    expect(document.querySelectorAll('.con-mandatory').length, 'the plate is answered by that press').to.equal(0);
    expect(document.querySelectorAll('.con-parl[data-sitting-stage]').length, 'the Parliament that stands IS the sitting').to.equal(1);
    expect(classes().filter((cls) => !cls.startsWith('wait-graph/ceiling/') && !cls.startsWith('animation-hold/ceiling/')),
      'no cycle, no stranded question, no stall (the bottle has no layout: a ceiling of a wait for a rect is its own blind spot)').to.deep.equal([]);
  });
});
