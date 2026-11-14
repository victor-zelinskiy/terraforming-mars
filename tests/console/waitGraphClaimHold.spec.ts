import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {judgeWaitGraph, WaitNode, WaitWorld} from '@/client/console/waitGraph/waitGraphModel';
import {codeOnly} from './shellSource';

/*
 * A QUESTION ITS WORKSPACE'S CLAIM HOLDS IS NO DEAD END (docs/claude/console/wait-graph.md § 2c; CI 2026-11-14,
 * `console-venus-orbital-survey` — «the purchase is EMBEDDED in the workspace»).
 *
 * A press that draws-then-asks claims its outcome; the purchase the same response asks renders NOWHERE until the claimed
 * stage's execution beat has played. Read as «nothing holds it», that question was a `dead-end` once the beat outlasted
 * the confirmation (a slow frame), and its armed door — `question-open` → the router's `openShellTaskSurface` → the
 * layers closed — took the workspace away under its own live claim: the purchase rose as a standalone band.
 *
 * ① the MECHANISM, on the graph's pure half: the same question is a dead end with nothing holding it, and none when it
 *    waits on the claim's bounded node;
 * ② the PRODUCT's wiring: the shell's source names the claim as the question's holder, and the door refuses a question
 *    held for its workspace before it reaches the router.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const supervisor = codeOnly(fs.readFileSync(path.join(ROOT, 'src', 'client', 'console', 'supervisor', 'supervisorController.ts'), 'utf8'));

const world = (over: Partial<WaitWorld> = {}): WaitWorld => ({now: 10_000, accepting: false, requestInFlight: false, serverOwes: false, ...over});
const node = (id: string, family: WaitNode['family'], targets: WaitNode['targets'], over: Partial<WaitNode> = {}): WaitNode =>
  ({id, family, owner: 'test', since: 8_000, targets, ...over});

describe('waitGraph — a question its workspace\'s claim holds waits on the claim', () => {
  const claim = node('claim:card-actions', 'claim', [{kind: 'motion', what: 'the claimed outcome presents (or the reconciler lets it go)'}],
    {boundMs: 20_000, recovery: 'workspace-outcome'});

  it('① with NOTHING holding it the question is a dead end — and its door is the router\'s (the red: the workspace closed under its claim)', () => {
    const question = node('question:cardSelect#13', 'question', [{kind: 'player', what: 'answer the question'}], {recovery: 'question-open'});
    const findings = judgeWaitGraph([question, claim], world());
    expect(findings.filter((f) => f.kind === 'dead-end').map((f) => f.members[0]), 'nothing accepts, nothing holds').to.include('question:cardSelect#13');
  });

  it('① held by the CLAIM it is no finding at all: the claim\'s node carries the wait, bounded', () => {
    const question = node('question:cardSelect#13', 'question', [{kind: 'node', id: 'claim:card-actions'}]);
    const findings = judgeWaitGraph([question, claim], world({motionInFlight: true}));
    expect(findings.filter((f) => f.members.includes('question:cardSelect#13')), 'the question waits on a node that stands').to.deep.eq([]);
  });

  it('② the shell\'s source: the question\'s holder chain ends with the claim that holds it for its stage', () => {
    expect(supervisor, 'the claim is the holder only while the router holds the question for its workspace AND a claim lives')
      .to.match(/const claimHoldsQuestion = shell\.taskHeldForWorkspace && workspaceOutcomeClaimed\(\) \? `claim:\$\{workspaceOutcomeState\.host\}` : undefined;/);
    expect(supervisor, 'the plate, «set aside» and an admission block first — then the claim')
      .to.match(/const held = announceId \?\? deferredId \?\? admission\([^\n]+\) \?\? claimHoldsQuestion;/);
    expect(supervisor, 'a held question carries no door of its own').to.match(/\.\.\.\(held === undefined \? \{recovery: 'question-open'\} : \{\}\)/);
  });

  it('② the door: a question held for its workspace never reaches the router\'s surface', () => {
    const start = supervisor.indexOf('function reopenOrphanQuestion(');
    expect(start, 'the door').to.be.greaterThan(0);
    const body = supervisor.slice(start, supervisor.indexOf('\n  }\n', start));
    const guard = body.indexOf('if (shell.taskHeldForWorkspace) {');
    const open = body.indexOf('shell.openShellTaskSurface(task);');
    expect(guard, 'the guard').to.be.greaterThan(0);
    expect(open, 'the router\'s door').to.be.greaterThan(0);
    expect(guard, 'the guard stands before the door').to.be.lessThan(open);
  });
});
