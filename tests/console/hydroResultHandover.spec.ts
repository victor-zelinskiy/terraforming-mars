import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {shellCode} from './shellSource';

/*
 * THE HYDRONETWORK'S RESULT IS READ ON A STAGE THE PLAYER SEES — and the table's answer rises AFTER it.
 *
 * CI 2026-11-05 (`console-delta-surge`, `console-hydro-copied-tile` — red since PL-1799 stopped a press with nothing on
 * stage from hurrying a waiting chain): the chain's wait for the flow's story fell on the very edge that opens the
 * result, so the reaction rose at the opening's centre 10–17 ms after it and the result's read hold ran out under it;
 * and on the stage-7 copy the result was walked to while the stack stood ASIDE for the placement — read by nobody, the
 * frame coming back wearing the `executing` it left with (the beat-stall guard tore it down). Source guard: the shell
 * and the director are DOM + reactivity; the journeys are those two e2e specs, the pure half is `consoleHydroFlow.spec`.
 */
const ROOT = path.resolve(__dirname, '..', '..', 'src', 'client');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

describe('the hydro result is handed over — never spent off screen, never under the table\'s answer', () => {
  it('the chain waits THROUGH a standing result (past its opening nothing of the flow waits for the chain)', () => {
    const director = read('console/cardReaction/cardReactionDirector.ts');
    const start = director.indexOf('async function waitHydroStoryQuiet(');
    expect(start, 'the director still waits for the hydro story').to.be.greaterThan(-1);
    const body = director.slice(start, director.indexOf('\n}\n', start));
    expect(body).to.include("hydroFlowState.commit.phase === 'result'");
  });

  it('the settle refuses a hidden stage through the ONE predicate, and the frame\'s return re-syncs and re-asks', () => {
    const shell = shellCode({comments: true});
    const settle = shell.slice(shell.indexOf('settleHydroResolution(): void {'));
    expect(settle.slice(0, settle.indexOf('\n    },\n')), 'a park, a deferred task and a yield alike').to.include('if (hydroFlowSetAside() || this.hydroResolutionBusy) {');
    // The watch table delegates (architecture v2): the reaction's body is the method the `hydroFrameStands` row calls.
    expect(shell, 'the frame\'s return is watched').to.include('=> this.whenHydroFrameStandsChanges(stands)');
    const watcher = shell.slice(shell.indexOf('whenHydroFrameStandsChanges(stands: boolean): void {'));
    expect(watcher.indexOf('whenHydroFrameStandsChanges(stands: boolean): void {'), 'the reaction has a body').to.be.greaterThan(-1);
    const arm = watcher.slice(0, watcher.indexOf('\n    },\n'));
    expect(arm, 'a phase written while away is re-read').to.include('this.syncHydroFramePhase();');
    expect(arm, 'the refused settle is asked again').to.include('this.settleHydroResolution()');
    // A frame aside for the board is a hidden stage — asked through the STACK's one answer (the hidden-scene class,
    // `hiddenSceneGuard.spec`): the flow asks `workspaceSceneHidden`, and the stack's off-stage set reads the yield.
    const flow = read('console/hydroFlow/consoleHydroFlow.ts');
    const aside = flow.slice(flow.indexOf('export function hydroFlowSetAside('));
    expect(aside.slice(0, aside.indexOf('\n}\n')), 'the flow asks the stack\'s one answer').to.include("workspaceSceneHidden('hydro')");
    const stack = read('console/consoleWorkspaceStack.ts');
    const hidden = stack.slice(stack.indexOf('export function workspaceSceneHidden('));
    expect(hidden.slice(0, hidden.indexOf('\n}\n')), 'a hidden scene includes a frame off the live stack').to.include('workspaceFrameOffStage(kind)');
    const offStage = stack.slice(stack.indexOf("const offStageKinds = reactivePredicate('workspace-off-stage'"));
    expect(offStage.slice(0, offStage.indexOf('\n});\n')), 'a frame aside for the board is off stage').to.include('for (const f of boardYielded) {');
  });
});
