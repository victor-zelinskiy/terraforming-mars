import {expect} from 'chai';
import {playWarmsParliamentArt} from '../../src/client/console/consolePlayCardComposer';

/**
 * THE GRANT'S DOOR OPENS WITH ITS FACES PAINTED (PL-1168 · P72, ledger CZ): the play's composer warms the voting
 * area's art exactly when its preview carries a LIVE grant — one point for every card, read off the preview.
 */
describe('playWarmsParliamentArt — the live grant warms the voting area at the composer', () => {
  it('a preview with a live grant (`delegateGrantFollowUp`) warms', () => {
    expect(playWarmsParliamentArt([{steps: [{kind: 'delegateGrantFollowUp'}]}])).is.true;
    expect(playWarmsParliamentArt([{steps: []}, {steps: [{kind: 'note'}, {kind: 'delegateGrantFollowUp'}]}]), 'any branch').is.true;
  });

  it('a preview without one warms nothing — a staged door warms at its own press, a plain play never', () => {
    expect(playWarmsParliamentArt([])).is.false;
    expect(playWarmsParliamentArt([{steps: [{kind: 'boardPlacement'}, {kind: 'note'}]}])).is.false;
    expect(playWarmsParliamentArt([{steps: [{kind: 'delegateGrant'}]}]), 'the staged door has its own warm-up').is.false;
  });
});
