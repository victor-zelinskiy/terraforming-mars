import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {forceGenerationEnd, runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';

// The premium "Energy → Heat" transition animation reads the converted amount
// from a server snapshot (a client diff of before/after-production stocks can't
// isolate it — production income muddies both counters). These tests pin the
// snapshot the standard end-of-generation conversion produces.
describe('Energy→Heat conversion snapshot', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
    cast(player.popWaitingFor(), undefined);
  });

  it('snapshots the conversion with the PRE-conversion stocks', () => {
    player.production.override({energy: 3, heat: 4});
    player.energy = 8;
    player.heat = 12;

    forceGenerationEnd(game);
    runAllActions(game);

    const snapshot = player.energyHeatConversion;
    expect(snapshot).to.not.be.undefined;
    // Amount + stocks captured BEFORE production income was added.
    expect(snapshot).to.deep.include({amount: 8, energyBefore: 8, heatBefore: 12});
    expect(snapshot!.generation).to.be.a('number');

    // Conversion runs first, then production income is added on top.
    expect(player.energy).eq(3); // 0 (all converted) + 3 production
    expect(player.heat).eq(24); // 12 + 8 converted + 4 production

    // Still selecting research cards — the snapshot survives until the next input.
    cast(player.popWaitingFor(), SelectCard);
  });

  it('leaves no snapshot when there is nothing to convert', () => {
    player.production.override({energy: 2, heat: 1});
    player.energy = 0;
    player.heat = 5;

    forceGenerationEnd(game);
    runAllActions(game);

    expect(player.energyHeatConversion).to.be.undefined;
    expect(player.energy).eq(2); // 0 + 2 production
    expect(player.heat).eq(6); // 5 + 0 converted + 1 production
  });

  it('clears the snapshot on the next input (transient, like lastReveal)', () => {
    player.energy = 4;
    player.heat = 0;
    forceGenerationEnd(game);
    runAllActions(game);
    expect(player.energyHeatConversion).to.not.be.undefined;

    // Resolving the next prompt (the research card selection) starts a new input,
    // which consumes the one-shot snapshot. Process WITHOUT popping first, so the
    // waitingFor is still set when process() runs (and clears the snapshot).
    cast(player.getWaitingFor(), SelectCard);
    player.process({type: 'card', cards: []});
    expect(player.energyHeatConversion).to.be.undefined;
  });
});
