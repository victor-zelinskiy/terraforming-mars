import {expect} from 'chai';
import {ICard} from '../../../src/server/cards/ICard';
import {AsteroidRights} from '../../../src/server/cards/promo/AsteroidRights';
import {CometAiming} from '../../../src/server/cards/promo/CometAiming';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';

describe('AsteroidRights', () => {
  let card: AsteroidRights;
  let player: TestPlayer;

  beforeEach(() => {
    card = new AsteroidRights();
    [/* game */, player/* , player2 */] = testGame(2);

    player.playedCards.push(card);
    card.play(player);
    runAllActions(player.game);
  });

  it('Should play', () => {
    expect(card.resourceCount).to.eq(2);
  });

  it('Can not act', () => {
    player.megaCredits = 0;
    card.resourceCount = 0;
    expect(card.canAct(player)).is.not.true;
  });

  it('Previews spend-asteroid branches as unavailable without asteroids', () => {
    player.megaCredits = 1;
    card.resourceCount = 0;

    const preview = card.actionPreview(player);

    expect(preview.branches[0].available).is.false;
    expect(preview.branches[0].unavailableReason).eq('Not enough resources on this card');
    expect(preview.branches[1].available).is.false;
    expect(preview.branches[1].unavailableReason).eq('Not enough resources on this card');
    expect(preview.branches[2].available).is.true;
  });

  it('Previews add-asteroid branch as unavailable without M€', () => {
    player.megaCredits = 0;
    card.resourceCount = 1;

    const preview = card.actionPreview(player);

    expect(preview.branches[0].available).is.true;
    expect(preview.branches[1].available).is.true;
    expect(preview.branches[2].available).is.false;
    expect(preview.branches[2].unavailableReason).eq('Need ${0} more M€');
    expect(preview.branches[2].unavailableReasonParams).deep.eq(['1']);
  });

  it('Should act - can auto spend asteroid resource', () => {
    player.megaCredits = 0;
    const action = cast(card.action(player), OrOptions);

    // Gain 1 M€ prod
    action.options[1].cb();
    expect(player.production.megacredits).to.eq(1);

    // Gain 2 titanium
    action.options[0].cb();
    expect(player.titanium).to.eq(2);
  });

  it('Should play - the single candidate (self) is STILL shown (no auto-select)', () => {
    player.megaCredits = 1;
    card.resourceCount = 0;

    // Even with one candidate (this card), the player picks it — no silent auto-add.
    const action = cast(card.action(player), SelectCard<ICard>);
    expect(action.cards).deep.eq([card]);
    action.cb([card]);
    runAllActions(player.game); // resolve the 1 M€ payment (deferred)
    expect(player.megaCredits).to.eq(0);
    expect(card.resourceCount).to.eq(1);
  });

  it('Should play - can add asteroid resource to other card', () => {
    player.megaCredits = 1;
    card.resourceCount = 0;
    const cometAiming = new CometAiming();
    player.playedCards.push(cometAiming);

    const action = cast(card.action(player), SelectCard<ICard>);
    action.cb([cometAiming]);
    expect(cometAiming.resourceCount).to.eq(1);
  });

  it('Should play - all options available', () => {
    player.megaCredits = 1;
    const cometAiming = new CometAiming();
    player.playedCards.push(cometAiming);

    const action = cast(card.action(player), OrOptions);
    expect(action.options[0] instanceof SelectOption).is.true;
    expect(action.options[1] instanceof SelectOption).is.true;
    expect(action.options[2] instanceof SelectCard).is.true;
  });
});
