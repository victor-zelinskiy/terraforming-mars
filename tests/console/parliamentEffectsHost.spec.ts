import {expect} from 'chai';
import {
  actionsZoneStep,
  closeParliamentEffectsHost,
  openParliamentEffectsHost,
  parliamentEffectsExplorerUi,
  parliamentEffectsHost,
} from '@/client/console/parliament/parliamentEffectsHost';
import {effectsExplorerUi} from '@/client/console/consoleEffectsExplorer';

/*
 * «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» IS A HOST (ONE FRAMEWORK С6, decision Р4): the actions column is the «Действия карт» tiles,
 * the standing effects are the effects explorer — its OWN cursor state, never Information's. The zone rule is pure.
 */
describe('parliamentEffectsHost — the inner step hosts the two shared surfaces', () => {
  afterEach(() => closeParliamentEffectsHost());

  it('opens on the actions when there are any, else on the explorer; nothing to show opens nothing', () => {
    expect(openParliamentEffectsHost(2, 3)).is.true;
    expect(parliamentEffectsHost.zone).eq('actions');
    expect(parliamentEffectsHost.actionCursor).eq(0);
    expect(openParliamentEffectsHost(0, 3)).is.true;
    expect(parliamentEffectsHost.zone, 'no action of the seat\'s: the explorer owns the cursor').eq('effects');
    expect(openParliamentEffectsHost(0, 0)).is.false;
  });

  it('the explorer state is the step\'s own (two hosts, two cursors) and the open resets it', () => {
    expect(parliamentEffectsExplorerUi).not.eq(effectsExplorerUi);
    parliamentEffectsExplorerUi.focusKey = 'party:Reds:0';
    parliamentEffectsExplorerUi.familyFilter = 'discounts';
    parliamentEffectsExplorerUi.detail = {cardName: '' as never, effectKey: 'party:Reds:0', title: 'Reds'};
    openParliamentEffectsHost(1, 1);
    expect([parliamentEffectsExplorerUi.focusKey, parliamentEffectsExplorerUi.familyFilter, parliamentEffectsExplorerUi.detail]).deep.eq(['', 'all', undefined]);
  });

  it('the actions column: ↑↓ walk and clamp, → crosses into the explorer only when it holds an effect, ← stays', () => {
    expect(actionsZoneStep(0, 3, 2, 'down')).deep.eq({zone: 'actions', cursor: 1});
    expect(actionsZoneStep(2, 3, 2, 'down'), 'clamps at the last').deep.eq({zone: 'actions', cursor: 2});
    expect(actionsZoneStep(0, 3, 2, 'up'), 'never up out of the step').deep.eq({zone: 'actions', cursor: 0});
    expect(actionsZoneStep(1, 3, 2, 'right')).deep.eq({zone: 'effects', cursor: 1});
    expect(actionsZoneStep(1, 3, 0, 'right'), 'no effect to cross into').deep.eq({zone: 'actions', cursor: 1});
    expect(actionsZoneStep(1, 3, 2, 'left')).deep.eq({zone: 'actions', cursor: 1});
  });
});
