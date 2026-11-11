import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE NAMED HOLDS OF A WORKSPACE'S ENDING ARE ONE TABLE (architecture v2 — PLAN §5 · S5; `FRAME_HOLDS` in
 * `console/shell/outcomeController.ts`).
 *
 * The guarded conclusion holds a finished workspace for a step it owes, an outcome still playing inside it, a step of
 * its own. The forced teardown's GHOST TEST (`stuckWorkspaceIsGhost`, the supervisor) must refuse on the very same
 * things — and it used to keep its own copy of the list, which called a working flow a phantom every time the copy
 * missed a term (the Reds' payout, field 2026-10-24 / 25). Now both read the table; this guard keeps it that way:
 * the ghost test names no hold of its own, and every row of the table says whether a phantom can hide behind it.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('workspace holds — the conclusion and the ghost test read ONE table', () => {
  const outcome = read('src/client/console/shell/outcomeController.ts');
  const supervisor = read('src/client/console/supervisor/supervisorController.ts');
  const table = outcome.slice(outcome.indexOf('const FRAME_HOLDS: ReadonlyArray<FrameHold> = ['), outcome.indexOf('function workspaceHeldForThePlayer('));
  const ghost = supervisor.slice(supervisor.indexOf('function stuckWorkspaceIsGhost('), supervisor.indexOf('function forceRecoverStuckWorkspace('));

  it('reads the real code (anti-vacuous)', () => {
    expect(table.length, 'the table').to.be.greaterThan(400);
    expect(ghost.length, 'the ghost test').to.be.greaterThan(200);
  });

  it('every hold is a ROW that says what it is to the conclusion AND whether a phantom can hide behind it', () => {
    const rows = table.match(/\{name: '[^\n]*/g) ?? [];
    expect(rows.length, 'rows').to.be.at.least(8);
    for (const row of rows) {
      expect(row, 'a row names its fact').to.match(/\bas: '(?:owedStep|outcomeLive|ownsPrompt)'/);
      expect(row, 'a row decides the ghost question').to.match(/\bghost: '(?:never|may)'/);
    }
  });

  it('the conclusion\'s three facts are read off the table', () => {
    for (const fact of ['owedStep', 'outcomeLive', 'ownsPrompt']) {
      expect(outcome, fact).to.include(`held('${fact}')`);
    }
  });

  it('the ghost test asks the table — it names no hold of its own (a private copy is how one went missing)', () => {
    const code = ghost.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).to.include('!shell.workspaceHeldForThePlayer(kind)');
    expect(code, 'no hold named here').to.not.match(/followUpStepOwed|politicalDiscardOwed|politicalPayoutOwed|lawStepOwed|colonyBonusPayoutLive|hostedStep(?:OwedTo|LiveIn)|chairmanQuestFlow/);
  });
});
