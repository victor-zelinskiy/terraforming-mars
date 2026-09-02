import {expect} from 'chai';
import {cast, toName} from '@/common/utils/utils';
import {CardName} from '../../src/common/cards/CardName';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../src/server/createCard';
import {ChooseCards} from '../../src/server/deferredActions/ChooseCards';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';

describe('ChooseCards', () => {
  let player: TestPlayer;
  let aquiferPumping: IProjectCard;
  let ioMiningIndustries: IProjectCard;

  beforeEach(() => {
    [/* game */, player] = testGame(1);
    aquiferPumping = newProjectCard(CardName.AQUIFER_PUMPING)!;
    ioMiningIndustries = newProjectCard(CardName.IO_MINING_INDUSTRIES)!;
    player.megaCredits = 100;
  });

  it('shows calculated project costs when paying for cards', () => {
    player.megaCredits = player.cardCost;
    player.playedCards.push(newProjectCard(CardName.EARTH_CATAPULT)!);

    const selectCard = cast(
      new ChooseCards(player, [aquiferPumping, ioMiningIndustries], {paying: true}).execute(),
      SelectCard<IProjectCard>,
    );

    expect(selectCard.config.min).to.eq(0);
    expect(selectCard.config.max).to.eq(1);
    expect(selectCard.config.played).is.false;
    expect(selectCard.cards.map((card) => card.name)).deep.eq([
      CardName.AQUIFER_PUMPING,
      CardName.IO_MINING_INDUSTRIES,
    ]);

    const model = selectCard.toModel(player);

    expect(model.cards.map((card) => ({name: card.name, calculatedCost: card.calculatedCost}))).deep.eq([
      {name: CardName.AQUIFER_PUMPING, calculatedCost: 16},
      {name: CardName.IO_MINING_INDUSTRIES, calculatedCost: 39},
    ]);
  });

  // The availability contract: EVERY ChooseCards selection (the paying buy
  // AND the keep-some pick) carries the structured unplayableReasons — the
  // console's «оставь K из N» surface speaks the same requirement voice as
  // the research buy, so a keep prompt without reasons is a regression.
  it('keep-mode selection carries unplayableReasons', () => {
    const lakeMarineris = newProjectCard(CardName.LAKE_MARINERIS)!; // requires 0°C
    const selectCard = cast(
      new ChooseCards(player, [lakeMarineris, ioMiningIndustries], {keepMax: 1}).execute(),
      SelectCard<IProjectCard>,
    );
    expect(selectCard.config.showUnplayableReasons).is.true;

    const model = selectCard.toModel(player);
    const lake = model.cards.find((card) => card.name === CardName.LAKE_MARINERIS)!;
    expect((lake.unplayableReasons ?? []).some((r) => r.requirement === true)).is.true;
  });

  it('logBoughtCards logs bought cards publicly by name', () => {
    const game = player.game;
    game.gameLog = [];
    const selectCard = cast(
      new ChooseCards(player, [aquiferPumping, ioMiningIndustries], {paying: true, logBoughtCards: true}).execute(),
      SelectCard<IProjectCard>,
    );

    selectCard.cb([aquiferPumping]);
    runAllActions(game);

    const publicMessages = game.gameLog.filter((entry) => entry.playerId === undefined);
    const bought = publicMessages.find((msg) => msg.message === '${0} bought ${1}')!;
    expect(bought.data[1].type).eq(LogMessageDataType.CARDS);
    expect(bought.data[1].value).to.have.members([aquiferPumping].map(toName));
  });
});
