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
import {monkeyWalk} from './monkeyWalk';

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

  /*
   * `animation-hold/ceiling/parliament-chairman-quest` — the monkey's baseline, seed `fz0` ·
   * `parliament-chairman-quest-last-action`. The plate's A opens the Parliament on the chairman's quest and the answer
   * rides that press; the walk pressed A AGAIN 0.9 s later — «дожать» with the answer still on the wire. The hurry
   * killed the reading's own timer and ran nothing in its place (`answered` was false), so when the answer came the
   * flow found its reading «not done» for ever: two blocking holds, the bar reading «Выполняется», until the 20 s
   * ceiling settled the chairmanship without its beats. Bisected HERE in 16 s (A alone: done in 2 s; A + ▼ / B / X:
   * done; A + A: the ceiling). The law: a cut step is never dropped — whoever kills a scheduled beat applies its
   * effect (`chairmanQuestDirector.finishChairmanQuestBeats`).
   */
  it('a second A inside the round trip of the chairman\'s quest: the chairmanship still plays to its end — no hold left for the ceiling', async () => {
    const table = await bottleServer().bootFixture('parliament-chairman-quest-last-action');
    bottle = await bootBottle(table);
    await bottle.advance(4_000);
    expect(bottle.bar(), 'the quest is announced: its plate stands').to.match(/Open the Parliament/);
    const beat = (): string => document.querySelector('.con-parl')?.getAttribute('data-quest-beat') ?? '(no parliament)';

    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(930);
    expect(bottle.frames(), 'the Parliament stands on the quest').to.deep.equal(['parliament:committed']);
    expect(await bottle.press('Enter'), 'the second A — 0.9 s in').to.equal('consumed');
    const done = await bottle.until(() => beat() === 'done', 8_000, 250);
    expect(done, `the chairmanship reached its end by itself (beat: ${beat()}, holds: ${JSON.stringify(bottle.ready().holds)})`).to.equal(true);
    // Past the ceiling the flow's hold used to reach: nothing is left for it to cut.
    await bottle.advance(22_000);
    expect(bottle.ready().holds.filter((hold) => hold.startsWith('parliament-chairman-quest')), 'the flow\'s hold is released').to.deep.equal([]);
    expect(classes(), 'no hold outlived its ceiling').to.deep.equal([]);
    expect(bottle.bar(), 'the finished chairmanship is the player\'s to close').to.match(/Close/);
  });

  /*
   * `wait-graph/ceiling/scale-step-rating:stage` · `wait-graph/ceiling/card-reaction:rating-story-quiet` — the monkey
   * in the bottle, seed `fz0` · `terraforming-deal-start-nodraw`, confirmed by the box monkey's spec in a real browser.
   * A prelude played inside the START workspace steps a scale; the step's rating is told on the board — which the
   * player keeps covered by the start workspace for as long as they read. The story is OWED, bounded by its due, and
   * at the due the rating is applied untold: the board's own bounded, ledgered story, and the ledger's line said so
   * (`planned`). The wait graph's two lines of the SAME incident were filed as DEFECTS — noise under a class's name,
   * an event of the quota for the player's own reading time. The law: a ceiling says WHY it was the wait's honest end
   * at the moment it comes (`CeilingWait.ceiling(planned)`, read from the rating's own beat —
   * `scaleStepRatingStageCovered`); with the board in plain view the same ceiling is still a defect.
   * …AND ONE DUE (the row's second half): the card that ANSWERS the rating had a clock of its own — 12 s — and ran out
   * twenty seconds before the rating it answers was applied: it paid first. Its clock no longer runs while the
   * rating's stage is covered (`ratingTouchdownStep`): the wait is the story's, the story's due ends both, and the
   * reactor's own ceiling is not reached at all — it stays what it was meant to be, a defect on a stage in plain view.
   * (The walk is the monkey's own, by its seed — `monkeyWalk.ts`.)
   */
  it('a scale step\'s rating owed under the start workspace: the story ends as PLANNED at its due — and the card that answers it waits with it', async () => {
    const table = await bottleServer().bootFixture('terraforming-deal-start-nodraw');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    bottle = (await monkeyWalk(bottle, table.seats.length, 'fz0:terraforming-deal-start-nodraw', 60)).bottle;
    await bottle.advance(14_000);
    const waits = bottle.journal().filter((entry) => (entry.cause?.cls ?? '').startsWith('wait-graph/ceiling/scale-step-rating') ||
      (entry.cause?.cls ?? '').startsWith('wait-graph/ceiling/card-reaction:rating-story'));
    expect(waits.map((entry) => entry.cause?.cls), 'the walk reaches the wait; ONE ceiling — the story\'s own, at its due')
      .to.deep.equal(['wait-graph/ceiling/scale-step-rating:stage']);
    expect(waits.map((entry) => entry.cause?.tier), 'the player kept the board covered: an honest end, said by the line').to.deep.equal(['planned']);
    expect(waits.every((entry) => /\(planned: .*the player keeps the board covered/.test(entry.text)), 'the reason is in the line').to.equal(true);
    // The reactor waited WITH the story (no ceiling of its own, neither under its old name nor its new one) and is
    // not left waiting: the due that ended the story ended its wait.
    const graph = (window as unknown as {__conWaitGraph?: () => {nodes: Array<{id: string}>}}).__conWaitGraph?.();
    expect(graph, 'the wait graph\'s probe answers').to.not.equal(undefined);
    expect((graph?.nodes ?? []).map((node) => node.id).filter((id) => id.includes('card-reaction:rating-story')), 'no reactor wait is left standing').to.deep.equal([]);
    expect(classes(), 'nothing of this walk is a defect').to.deep.equal([]);
  });
});
