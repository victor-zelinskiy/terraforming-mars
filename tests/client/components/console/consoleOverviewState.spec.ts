import {expect} from 'chai';
import {
  consoleOverviewUi, openEndgameOverview, closeEndgameOverview, overviewSceneUp,
  nextOverviewTab, resetConsoleOverview,
} from '@/client/console/endgame/consoleOverviewState';
import {consoleEndgameUi, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';

describe('consoleOverviewState', () => {
  // Module state is bundle-shared — leave nothing behind for later specs.
  afterEach(() => {
    resetConsoleOverview();
  });

  it('open → entering (input lands from the first frame); close → leaving', () => {
    expect(consoleOverviewUi.phase).to.eq('closed');
    expect(overviewSceneUp()).to.eq(false);
    openEndgameOverview();
    expect(consoleOverviewUi.phase).to.eq('entering');
    expect(overviewSceneUp()).to.eq(true);
    closeEndgameOverview();
    expect(consoleOverviewUi.phase).to.eq('leaving');
    expect(overviewSceneUp()).to.eq(true); // the leave still owns the stage crossfade
  });

  it('open is idempotent mid-entrance; close drops the nested detail first', () => {
    openEndgameOverview();
    openEndgameOverview();
    expect(consoleOverviewUi.phase).to.eq('entering');
    consoleOverviewUi.detail = {kind: 'card', rowId: 'x'};
    closeEndgameOverview();
    expect(consoleOverviewUi.detail).to.eq(undefined);
    closeEndgameOverview(); // idempotent mid-leave
    expect(consoleOverviewUi.phase).to.eq('leaving');
  });

  it('a rapid re-open DURING the leave retargets back to entering (no stranded phase)', () => {
    openEndgameOverview();
    closeEndgameOverview();
    openEndgameOverview();
    expect(consoleOverviewUi.phase).to.eq('entering');
  });

  it('LB/RB walk the tab ring both ways and WRAP', () => {
    expect(nextOverviewTab('digest', 1)).to.eq('score');
    expect(nextOverviewTab('digest', -1)).to.eq('players'); // wrap left
    expect(nextOverviewTab('players', 1)).to.eq('digest'); // wrap right
    expect(nextOverviewTab('timeline', -1)).to.eq('score');
  });

  it('re-entry restores tab and focus (the memory survives a scene close)', () => {
    openEndgameOverview();
    consoleOverviewUi.tab = 'cards';
    consoleOverviewUi.cardsIdx = 5;
    consoleOverviewUi.cardsFilter = 1;
    consoleOverviewUi.revealed['timeline'] = true;
    closeEndgameOverview();
    openEndgameOverview();
    expect(consoleOverviewUi.tab).to.eq('cards');
    expect(consoleOverviewUi.cardsIdx).to.eq(5);
    expect(consoleOverviewUi.cardsFilter).to.eq(1);
    expect(consoleOverviewUi.revealed['timeline']).to.eq(true); // a chart never replays its draw
  });

  it('resetConsoleEndgame resets the overview with the workspace (a new party is a fresh story)', () => {
    openEndgameOverview();
    consoleOverviewUi.tab = 'players';
    consoleOverviewUi.playerIdx = 2;
    consoleOverviewUi.revealed['parameters'] = true;
    resetConsoleEndgame();
    expect(consoleOverviewUi.phase).to.eq('closed');
    expect(consoleOverviewUi.tab).to.eq('digest');
    expect(consoleOverviewUi.playerIdx).to.eq(0);
    expect(consoleOverviewUi.revealed['parameters']).to.eq(undefined);
    // …and it did not disturb the ceremony's own reset contract.
    expect(consoleEndgameUi.phase).to.eq('idle');
  });
});
