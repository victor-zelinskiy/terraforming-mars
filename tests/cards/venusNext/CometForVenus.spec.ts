import {expect} from 'chai';
import {AerialMappers} from '../../../src/server/cards/venusNext/AerialMappers';
import {CometForVenus} from '../../../src/server/cards/venusNext/CometForVenus';
import {testGame} from '../../TestGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {CardName} from '../../../src/common/cards/CardName';
import {formatMessage} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';

describe('CometForVenus', () => {
  it('Should play — the follow-up is the premium FLAT attack shape', () => {
    const card = new CometForVenus();
    const card2 = new AerialMappers();
    const [game, player, player2] = testGame(2);
    player2.megaCredits = 10;
    player2.playedCards.push(card2);

    const action = cast(card.play(player), OrOptions);

    // One leaf option per victim + the deliberate skip — never a nested
    // SelectPlayer wizard (the console's one-press decision screen needs
    // every branch to be a leaf).
    expect(action.options).has.lengthOf(2);
    const remove = cast(action.options[0], SelectOption);
    expect(formatMessage(remove.title)).to.eq('Remove 4 M€ from ' + player2.color);
    expect(remove.metadata?.kind).to.eq('resourceRemoval');
    expect(remove.metadata?.player?.color).to.eq(player2.color);
    expect(remove.metadata?.player?.current).to.eq(10);
    expect(remove.metadata?.player?.resulting).to.eq(6);
    expect(cast(action.options[1], SelectOption).metadata?.kind).to.eq('skip');

    expect(action.choiceContext?.mode).to.eq('attack');
    expect(action.choiceContext?.source.card).to.eq(CardName.COMET_FOR_VENUS);

    remove.cb(undefined);
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(player2.megaCredits).to.eq(6);
  });

  it('The removal is honest about a target with fewer than 4 M€', () => {
    const card = new CometForVenus();
    const [/* game */, player, player2] = testGame(2);
    player2.megaCredits = 2;
    player2.playedCards.push(new AerialMappers());

    const action = cast(card.play(player), OrOptions);
    const remove = cast(action.options[0], SelectOption);
    expect(formatMessage(remove.title)).to.eq('Remove 2 M€ from ' + player2.color);

    remove.cb(undefined);
    expect(player2.megaCredits).to.eq(0);
  });

  it('An opponent without a Venus tag is a greyed target with a reason', () => {
    const card = new CometForVenus();
    const [/* game */, player, playerTagged, playerUntagged] = testGame(3);
    playerTagged.megaCredits = 5;
    playerTagged.playedCards.push(new AerialMappers());
    playerUntagged.megaCredits = 5;

    const action = cast(card.play(player), OrOptions);
    expect(action.options).has.lengthOf(2);
    expect(action.disabledOptions).has.lengthOf(1);
    expect(action.disabledOptions[0].metadata?.player?.color).to.eq(playerUntagged.color);
    expect(action.disabledOptions[0].reason).to.eq('No Venus tag');
  });

  it('A broke Venus-tagged opponent is greyed too — and alone yields no prompt', () => {
    const card = new CometForVenus();
    const [/* game */, player, playerRich, playerBroke] = testGame(3);
    playerRich.megaCredits = 5;
    playerRich.playedCards.push(new AerialMappers());
    playerBroke.megaCredits = 0;
    playerBroke.playedCards.push(new AerialMappers());

    const action = cast(card.play(player), OrOptions);
    expect(action.options).has.lengthOf(2);
    expect(action.disabledOptions.some((d) =>
      d.metadata?.player?.color === playerBroke.color && d.reason === 'No M€ to remove')).is.true;

    playerRich.megaCredits = 0;
    cast(card.play(player), undefined);
  });

  it('No prompt when no opponent has a Venus tag', () => {
    const card = new CometForVenus();
    const [/* game */, player, player2] = testGame(2);
    player2.megaCredits = 10;

    cast(card.play(player), undefined);
  });
});
