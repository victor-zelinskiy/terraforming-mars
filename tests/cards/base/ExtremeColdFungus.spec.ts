import {expect} from 'chai';
import {churn, setTemperature} from '../../TestingUtils';
import {Ants} from '../../../src/server/cards/base/Ants';
import {ExtremeColdFungus} from '../../../src/server/cards/base/ExtremeColdFungus';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('ExtremeColdFungus', () => {
  let card: ExtremeColdFungus;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new ExtremeColdFungus();
    [game, player] = testGame(2);
  });

  it('Cannot play', () => {
    setTemperature(game, -8);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Can play', () => {
    setTemperature(game, -12);
    expect(card.canPlay(player)).is.true;
  });

  it('Should play', () => {
    cast(card.play(player), undefined);
  });

  it('Should act - single target', () => {
    const tardigrades = new Tardigrades();
    player.playedCards.push(tardigrades);

    const preview = card.actionPreview(player);
    expect(preview.branches[0].available).is.true;
    expect(preview.branches[1].available).is.true;

    const action = cast(churn(card.action(player), player), OrOptions);
    expect(action.options).has.lengthOf(2);

    // The single microbe target is STILL shown via a SelectCard (no auto-select).
    action.options[0].cb([tardigrades]);
    expect(tardigrades.resourceCount).to.eq(2);

    action.options[1].cb();
    expect(player.plants).to.eq(1);
  });

  it('Should act - multiple targets', () => {
    const tardigrades = new Tardigrades();
    const ants = new Ants();
    player.playedCards.push(tardigrades, ants);

    const action = cast(churn(card.action(player), player), OrOptions);
    expect(action.options).has.lengthOf(2);

    action.options[0].cb([tardigrades]);
    expect(tardigrades.resourceCount).to.eq(2);

    action.options[0].cb([ants]);
    expect(ants.resourceCount).to.eq(2);
  });

  it('previews the microbe branch as unavailable with a reason when there is no target', () => {
    const preview = card.actionPreview(player);
    expect(preview.branches[0].available).is.false;
    expect(preview.branches[0].unavailableReason).eq('No card to add microbes to');
    expect(preview.branches[1].available).is.true;
  });
});
