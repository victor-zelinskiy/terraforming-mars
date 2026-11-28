import {expect} from 'chai';
import * as path from 'path';
import {pathToFileURL} from 'url';
import {createDoorRun, DOOR_RUN_STUCK, doorScreenOf} from '../testing/autopilotDoor';

/*
 * THE DOOR UNDER ONE SCREEN (FREEZE ZERO, stage M — docs/claude/console/freeze-zero/PLAN.md § 8; the audit's A1): the
 * law both pilots end a game by (`tests/testing/autopilotDoor.ts`), and the report's own reading of a door's row
 * (`scripts/monkey-report.mjs`) — one reading, held together here.
 */
describe('the autopilot\'s door — a run under one screen is a screen that cannot be answered', () => {
  const bar = 'frames parliament:browse · bar «ПарламентAВыполняется…» · grey Enter';
  // (The rows of CI's browser game 632, run 46144276012 — the question, the generation and the owner's word differ.)
  const quest = `option «You completed the chairman quest» [chairmanQuestPrompt] · gen 4 · ${bar} · owner «parliament — frames [parliament] · serving parliament»`;
  const pass = `pass · gen 4 · ${bar} → after the gesture: ${bar} · owner «free»`;
  const draw = `card «Take \${0} card(s) drawn by \${1}» [externalDrawPrompt] · gen 5 · ${bar} · owner «parliament — frames [parliament] · serving parliament»`;
  // (The bottle's rows carry no owner's word.)
  const bottleRow = 'card · gen 3 · frames none · bar «RT Actions B Close»';

  it('reads the screen of a row — the frames and the bar, nothing of the question — as the report does', async () => {
    const report = await import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'monkey-report.mjs')).href) as {doorScreenOf: (row: string) => string | undefined, DOOR_STUCK_AT: number};
    for (const row of [quest, pass, draw, bottleRow, 'a row that names no screen']) {
      expect(doorScreenOf(row), row).to.eq(report.doorScreenOf(row));
    }
    expect([quest, pass, draw].map(doorScreenOf)).to.deep.eq([bar, bar, bar]);
    expect(doorScreenOf(bottleRow)).to.eq('frames none · bar «RT Actions B Close»');
    expect(doorScreenOf('a row that names no screen')).to.eq(undefined);
    expect(report.DOOR_STUCK_AT, 'the report names the softer form sooner than a pilot ends the game').to.be.lessThan(DOOR_RUN_STUCK);
  });

  it(`${DOOR_RUN_STUCK} answers in a row at one screen end the game, the screen named — an answer ON the screen, or another screen, starts the count again`, () => {
    const run = createDoorRun();
    const rows = [quest, pass, draw, quest, pass];
    expect(rows.map((row) => run.door(row)), 'five in a row: the game goes on').to.deep.eq([undefined, undefined, undefined, undefined, undefined]);
    expect(run.door(draw)).to.eq(`the door answered 6 questions in a row under one unchanged screen — «${bar}»: it could not be answered`);

    // The screen answered a question in between: the walk IS getting through — the run is over.
    const walked = createDoorRun();
    for (const row of rows) {
      walked.door(row);
    }
    walked.answeredOnScreen();
    expect(walked.door(draw)).to.eq(undefined);

    // Another screen in between is another place — and a row with no screen breaks a run too.
    const moved = createDoorRun(3);
    expect([quest, bottleRow, quest, pass].map((row) => moved.door(row))).to.deep.eq([undefined, undefined, undefined, undefined]);
    expect(moved.door(draw), 'three at the Parliament since the other screen').to.contain('3 questions in a row');
    const broken = createDoorRun(2);
    expect([quest, 'a row that names no screen', quest].map((row) => broken.door(row))).to.deep.eq([undefined, undefined, undefined]);
  });
});
