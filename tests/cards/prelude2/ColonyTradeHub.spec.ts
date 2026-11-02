import {expect} from 'chai';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {ColonyTradeHub} from '../../../src/server/cards/prelude2/ColonyTradeHub';
import {Callisto} from '../../../src/server/colonies/Callisto';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Units} from '../../../src/common/Units';
import {Resource} from '../../../src/common/Resource';
import {CardName} from '../../../src/common/cards/CardName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {Luna} from '../../../src/server/colonies/Luna';
import {AutomaColonies} from '../../../src/server/automa/AutomaColonies';
import {testAutomaGame} from '../../automa/AutomaTestGame';


describe('ColonyTradeHub', () => {
  let card: ColonyTradeHub;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new ColonyTradeHub();
    [game, player, player2] = testGame(2, {ceoExtension: true, coloniesExtension: true});
    // Setup some colonies that can be built independently of cards
    game.colonies = [new Callisto(), new Ceres()];
  });

  it('play', () => {
    card.play(player);
    expect(player.stock.asUnits()).deep.eq(Units.of({titanium: 2}));
    expect(player.production.asUnits()).deep.eq(Units.of({energy: 1}));
  });

  const onColonyAddedRuns = [
    {player: 0, colony: 0, expected: [2, 0]},
    {player: 0, colony: 1, expected: [2, 0]},
    {player: 1, colony: 0, expected: [2, 0]},
    {player: 1, colony: 1, expected: [2, 0]},
  ] as const;
  for (const run of onColonyAddedRuns) {
    it('Gains 2 M€ when any colony is added building a colony ' + JSON.stringify(run), () => {
      const players = game.players;
      players[0].playedCards.push(card);

      expect(player.stock.asUnits()).deep.eq(Units.of({}));
      expect(player2.stock.asUnits()).deep.eq(Units.of({}));

      game.colonies[run.colony].addColony(players[run.player]);

      expect(players[0].stock.asUnits()).deep.eq(Units.of({megacredits: run.expected[0]}));
      expect(players[1].stock.asUnits()).deep.eq(Units.of({megacredits: run.expected[1]}));
    });
  }

  describe('the forecast twin (grantForecast)', () => {
    it('every colony the operation builds pays 2 M€ on the stock — one exact fact on the printed effect', () => {
      const facts = card.grantForecast(player, player2, {kind: 'colony', count: 2});
      expect(facts).to.have.lengthOf(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].source.channel).eq('colony-added');
      expect(facts[0].source.printedEffect).eq(0);
      expect(facts[0].effects.map((e) => [e.icon, e.amount, e.note])).deep.eq([[Resource.MEGACREDITS, 4, undefined]]);
    });

    it('states nothing for an operation that builds no colony, or for another grant kind', () => {
      expect(card.grantForecast(player, player, {kind: 'colony', count: 0})).deep.eq([]);
      expect(card.grantForecast(player, player, {kind: 'tr', amount: 1})).deep.eq([]);
    });
  });

  describe('the reaction record names the colony and its builder (cause.colony)', () => {
    it('a rival builds: the record is MINE (the owner), the actor is the builder, the cause names the tile', () => {
      player.playedCards.push(card);
      game.colonies[0].addColony(player2);
      const records = game.cardReactions.filter((r) => r.card === CardName.COLONY_TRADE_HUB);
      expect(records).to.have.lengthOf(1);
      expect(records[0].owner).eq(player.color);
      expect(records[0].channel).eq('colony-added');
      expect(records[0].cause).deep.eq({colony: {name: game.colonies[0].name, builder: player2.color}});
      expect(records[0].impacts).deep.eq([{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: player.color}]);
    });

    it('MarsBot builds (botBuildColony): the human hub pays, the cause names the tile and the bot', () => {
      const [botGame, human, bot] = testAutomaGame({coloniesExtension: true});
      botGame.colonies.splice(0, botGame.colonies.length, new Luna());
      AutomaColonies.setupColonies(botGame);
      human.playedCards.push(new ColonyTradeHub());
      const before = human.megaCredits;
      expect(AutomaColonies.botBuildColony(botGame)).is.true;
      expect(human.megaCredits - before).eq(2);
      const records = botGame.cardReactions.filter((r) => r.card === CardName.COLONY_TRADE_HUB);
      expect(records).to.have.lengthOf(1);
      expect(records[0].owner).eq(human.color);
      expect(records[0].cause).deep.eq({colony: {name: ColonyName.LUNA, builder: bot.color}});
    });
  });
});
