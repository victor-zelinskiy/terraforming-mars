import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {ActionCentreLeaveFacts, actionCentreLeavesOnPromptChange} from '../../src/client/console/actionCentreLeave';

/*
 * THE VOLUNTARY ACTION CENTRE (T09 «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ», ledger BY — H6). The owner's field
 * report: Electro Catapult as the turn's SECOND action against MarsBot folded its workspace early and flew the price into
 * nowhere — the answer handed the turn to the bot, the prompt «moved off the menu», and the centre's leave rule tore the
 * workspace down in the very flush that resolved the commit. The rule now asks whether the commit still owns the surface.
 */
describe('actionCentreLeavesOnPromptChange', () => {
  const base: ActionCentreLeaveFacts = {
    mounted: true, menu: false, outcomeClaimed: false, nestedStep: false, lawStepOwed: false, commitOwnsSurface: false,
  };

  it('a prompt that moved off the menu takes the voluntary centre down (another surface serves it)', () => {
    expect(actionCentreLeavesOnPromptChange(base)).is.true;
  });

  it('the action menu again, an unmounted centre, a claimed outcome, a hosted step, an owed party flow — it stays', () => {
    expect(actionCentreLeavesOnPromptChange({...base, menu: true})).is.false;
    expect(actionCentreLeavesOnPromptChange({...base, mounted: false})).is.false;
    expect(actionCentreLeavesOnPromptChange({...base, outcomeClaimed: true})).is.false;
    expect(actionCentreLeavesOnPromptChange({...base, nestedStep: true})).is.false;
    expect(actionCentreLeavesOnPromptChange({...base, lawStepOwed: true})).is.false;
  });

  it('H6 — while the ACTION COMMIT owns the surface (its handoff stands) the leave is the commit\'s own fold, never this rule', () => {
    expect(actionCentreLeavesOnPromptChange({...base, commitOwnsSurface: true})).is.false;
  });

  it('the shell asks THIS function, with the commit\'s handoff, its owed fold and its parked dismissal as the one fact', () => {
    const shell = fs.readFileSync(path.resolve('src/client/components/console/ConsoleShell.vue'), 'utf8');
    expect(shell).to.include('actionCentreLeavesOnPromptChange({');
    expect(shell).to.match(/commitOwnsSurface: isSurfaceAwaitingHandoff\(\) \|\| this\.commitFoldOwed \|\| this\.pendingCommitDismiss !== undefined/);
    // No second hand-written copy of the rule beside it.
    expect(shell).not.to.match(/workspaceFrameMounted\('card-actions'\) &&\s*taskFor\(this\.playerView\)\?\.kind !== 'actionMenu'/);
  });
});
