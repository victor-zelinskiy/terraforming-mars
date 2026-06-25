import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {BuildColonyStandardProject} from '../../../src/server/cards/colonies/BuildColonyStandardProject';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Payment} from '../../../src/common/inputs/Payment';

// Pay-on-commit for the Build-Colony standard project: the 17 M€ + the colony
// placement apply only when a colony is chosen, and the selection is cancellable
// before then (nothing spent, no colony built, action not consumed).
describe('BuildColonyStandardProject pay-on-commit', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {
      coloniesExtension: true,
      customColoniesList: [ColonyName.GANYMEDE, ColonyName.LUNA, ColonyName.PLUTO, ColonyName.TITAN, ColonyName.TRITON],
    });
  });

  it('not charged until a colony is committed', () => {
    player.megaCredits = 30;
    const card = new BuildColonyStandardProject();

    card.payAndExecute(player, Payment.of({megacredits: 17}));
    expect(player.megaCredits).eq(30);

    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectColony);
    expect(select.placementContext?.cancellable).is.true;
    const colony = select.colonies[0];
    expect(colony.colonies).to.not.include(player.id);

    select.process({type: 'colony', colonyName: colony.name});
    runAllActions(game);

    expect(player.megaCredits).eq(13);
    expect(colony.colonies).to.include(player.id);
  });

  it('cancelling spends nothing, builds nothing, and flags the action cancelled', () => {
    player.megaCredits = 30;
    const card = new BuildColonyStandardProject();

    card.payAndExecute(player, Payment.of({megacredits: 17}));
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectColony);
    const colony = select.colonies[0];

    select.process({type: 'cancel'});

    expect(player.megaCredits).eq(30);
    expect(colony.colonies).to.not.include(player.id);
    expect(player.pendingPlacementCancelled).is.true;
  });
});
