import {expect} from 'chai';
import {JupiterFloatingStation} from '../../../src/server/cards/colonies/JupiterFloatingStation';
import {TitanFloatingLaunchPad, TradeWithTitanFloatingLaunchPad} from '../../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {CardName} from '../../../src/common/cards/CardName';
import {ICard} from '../../../src/server/cards/ICard';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {TestPlayer} from '../../TestPlayer';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {testGame} from '../../TestGame';
import {Message} from '../../../src/common/logs/Message';
import {cast} from '../../../src/common/utils/utils';

describe('TitanFloatingLaunchPad', () => {
  let card: TitanFloatingLaunchPad;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new TitanFloatingLaunchPad();
    [game, player/* , player2 */] = testGame(2, {coloniesExtension: true});
  });

  it('Should act', () => {
    player.playedCards.push(card);
    expect(card.canAct()).is.true;
    expect(card.getVictoryPoints(player)).to.eq(1);
  });

  it('action with single targets', () => {
    player.game.colonies = []; // A way to simulate that no colonies are available.
    player.playedCards.push(card);
    game.colonies = []; // A way to fake out that no colonies are available.

    // No resource and no other card to add to. autoSelect:false — the player is still
    // asked where (this card is the only Jovian floater target).
    card.action(player);
    expect(game.deferredActions).has.lengthOf(1);
    const selectCard = cast(game.deferredActions.peek()!.execute(), SelectCard<ICard>);
    game.deferredActions.pop();
    selectCard.cb([card]);
    expect(card.resourceCount).to.eq(1);

    // No open colonies and no other card to add to
    card.action(player);
    expect(game.deferredActions).has.lengthOf(1);
    const selectCard2 = cast(game.deferredActions.peek()!.execute(), SelectCard<ICard>);
    game.deferredActions.pop();
    selectCard2.cb([card]);
    expect(card.resourceCount).to.eq(2);
  });

  it('action with multiple targets', () => {
    player.game.colonies = []; // A way to simulate that no colonies are available.

    const card2 = new JupiterFloatingStation();
    player.playedCards.push(card);
    player.playedCards.push(card2);

    card.action(player);
    expect(game.deferredActions).has.lengthOf(1);
    const selectCard = cast(game.deferredActions.peek()!.execute(), SelectCard<ICard>);
    selectCard.cb([card]);
    expect(card.resourceCount).to.eq(1);
  });

  it('action with multiple targets and colonies', () => {
    game.colonies = [new Luna(), new Triton()];

    const card2 = new JupiterFloatingStation();
    player.playedCards.push(card);
    player.playedCards.push(card2);
    player.addResourceTo(card, 7);

    const orOptions = cast(card.action(player), OrOptions);

    orOptions.options[1].cb(); // Add resource
    expect(game.deferredActions).has.lengthOf(1);
    const selectCard = cast(game.deferredActions.peek()!.execute(), SelectCard<ICard>);
    game.deferredActions.pop();
    selectCard.cb([card]);
    expect(card.resourceCount).to.eq(8);

    orOptions.options[0].cb(); // Trade for free
    expect(game.deferredActions).has.lengthOf(1);
    const selectColony = cast(game.deferredActions.peek()!.execute(), SelectColony);
    selectColony.cb(selectColony.colonies[0]);
    expect(card.resourceCount).to.eq(7);
    expect(player.megaCredits).to.eq(2);
  });

  /**
   * ONE IMPLEMENTATION OF THE TRADE. The card's action and the trade prompt's
   * floater fee are two entry points into the same move, so the action must run
   * through the SAME `IColonyTrader` — not a second copy of «spend a floater,
   * call colony.trade». The copy had already drifted: it opened no colony event
   * scope, so a trade taken from the card grouped differently in the journal,
   * and it did not mark the card used, so the fee stayed on offer in the
   * colonies screen after the action was spent.
   */
  it('the trade branch runs through the shared trader: one floater, the action marked used, the colony traded', () => {
    game.colonies = [new Luna(), new Triton()];
    player.playedCards.push(card);
    player.addResourceTo(card, 3);

    const orOptions = cast(card.action(player), OrOptions);
    orOptions.options[0].cb(); // Trade for free
    const selectColony = cast(game.deferredActions.peek()!.execute(), SelectColony);
    // The colony picker carries the TRADE button label, which is what the
    // console's trade orchestration (fleet flight, reward waves) keys on — the
    // old bespoke picker said 'Select' and every one of those beats was skipped.
    expect(selectColony.buttonLabel).to.eq('trade');
    selectColony.cb(selectColony.colonies[0]);

    expect(card.resourceCount).to.eq(2);
    expect(player.actionsThisGeneration.has(CardName.TITAN_FLOATING_LAUNCHPAD)).is.true;
    expect(player.megaCredits).to.eq(2);
    // …and the fee therefore disappears from the trade prompt: one use, both doors.
    expect(new TradeWithTitanFloatingLaunchPad(player).canUse()).is.false;
  });

  /** The branch DECLARES that it is the trade's second door — structurally, so
   *  the console can hand the player over instead of committing the action. */
  it('the trade branch previews a colonyTrade step naming its own payment path', () => {
    player.playedCards.push(card);
    player.addResourceTo(card, 1);
    const preview = card.actionPreview(player);
    const steps = preview.branches[0].steps;
    expect(steps).has.lengthOf(1);
    expect(steps[0]).deep.eq({kind: 'colonyTrade', card: CardName.TITAN_FLOATING_LAUNCHPAD});
  });

  it('Cannot take trade action during embargo #6348', () => {
    player.game.tradeEmbargo = true;

    game.colonies = [new Luna(), new Triton()];

    player.playedCards.push(card);
    player.addResourceTo(card, 7);

    // Embargo blocks the trade branch, so the action falls back to add-floater.
    cast(card.action(player), undefined);
    expect(game.deferredActions).has.lengthOf(1);
    // autoSelect:false → asked where (this card is the only Jovian floater target).
    const selectCard = cast(game.deferredActions.peek()!.execute(), SelectCard<ICard>);
    game.deferredActions.pop();
    selectCard.cb([card]);

    expect(game.deferredActions).has.lengthOf(0);
    expect(card.resourceCount).to.eq(8);
  });

  it('is available through standard trade action', () => {
    const luna = new Luna();
    player.game.colonies = [luna];

    const getTradeAction = () => player.getActions().options.find(
      (option) => option.title === 'Trade with a colony tile');

    expect(getTradeAction()).is.undefined;

    player.playedCards.push(card);

    expect(getTradeAction()).is.undefined;

    card.resourceCount = 1;
    const tradeAction = cast(getTradeAction(), AndOptions);

    const payAction = cast(tradeAction.options[0], OrOptions);
    expect(payAction.title).eq('Pay trade fee');
    expect(payAction.options).has.length(1);

    const floaterOption = cast(payAction, OrOptions).options[0];
    expect((floaterOption.title as Message).message).to.match(/Pay 1 floater/);

    floaterOption.cb();
    tradeAction.options[1].cb(luna);

    expect(card.resourceCount).eq(0);
    expect(player.megaCredits).eq(2);
  });
});
