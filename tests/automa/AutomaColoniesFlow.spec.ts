import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {IColony} from '../../src/server/colonies/IColony';
import {AutomaColonies} from '../../src/server/automa/AutomaColonies';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {Tag} from '../../src/common/cards/Tag';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Europa} from '../../src/server/colonies/Europa';
import {Triton} from '../../src/server/colonies/Triton';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/** Pin a deterministic colony lineup (active, tracker on the automa start = 2). */
function setColonies(game: IGame, ...colonies: Array<IColony>) {
  game.colonies.splice(0, game.colonies.length, ...colonies);
  AutomaColonies.setupColonies(game);
}

describe('Automa Colonies', () => {
  it('setup: every colony tile is active with its tracker on the highlighted second step', () => {
    const [game] = testAutomaGame({coloniesExtension: true});
    expect(game.colonies).has.length(5);
    for (const colony of game.colonies) {
      expect(colony.isActive, colony.name).is.true;
      expect(colony.trackPosition, colony.name).eq(2);
    }
  });

  describe('shipping storage + the 5-resources exchange', () => {
    it('accumulates below 5; at 5+ removes 5 and advances the tag-mapped track', () => {
      const [game] = testAutomaGame({coloniesExtension: true});
      const automa = game.automa!;
      setColonies(game, new Ceres(), new Luna());

      AutomaColonies.addToStorage(game, ColonyName.CERES, 2);
      expect(automa.shippingStorage[ColonyName.CERES]).eq(2);
      expect(automa.board.tracks[THARSIS_TRACK.BUILDING].position).eq(0);

      AutomaColonies.addToStorage(game, ColonyName.CERES, 3); // 5 → exchange.
      expect(automa.shippingStorage[ColonyName.CERES]).eq(0);
      expect(automa.board.tracks[THARSIS_TRACK.BUILDING].position).eq(1);
    });

    it('a big grant exchanges repeatedly', () => {
      const [game] = testAutomaGame({coloniesExtension: true});
      const automa = game.automa!;
      setColonies(game, new Luna());
      AutomaColonies.addToStorage(game, ColonyName.LUNA, 11);
      // Luna → Event tag → Event track: 0→1 ('advance' → 2) then 2→3 ('ocean' — a real action!).
      // Keep it simpler: 11 = two exchanges, remainder 1.
      expect(automa.shippingStorage[ColonyName.LUNA]).eq(1);
    });
  });

  describe('building colonies', () => {
    it('picks a random eligible tile via the flip method and gains 2 storage resources', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Ceres(), new Luna(), new Triton());
      game.projectDeck.drawPile.push(fakeCard({cost: 2})); // Count 1,2 → the 2nd tile: Luna.

      expect(AutomaColonies.botBuildColony(game)).is.true;
      const luna = game.colonies[1];
      expect(luna.colonies).deep.eq([bot.id]);
      expect(luna.trackPosition).eq(2); // max(2, 1 colony) — unchanged.
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(2);
    });

    it('Europa: an ocean (+1 TR) instead of storage resources', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Europa());
      expect(AutomaColonies.botBuildColony(game)).is.true;
      expect(game.colonies[0].colonies).deep.eq([bot.id]);
      expect(game.board.getOceanSpaces()).has.length(1);
      expect(bot.terraformRating).eq(21);
      expect(game.automa!.shippingStorage[ColonyName.EUROPA]).is.undefined; // Never stores.
    });

    it('no eligible tile (all full or already its own) → false', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna());
      game.colonies[0].colonies.push(bot.id);
      expect(AutomaColonies.botBuildColony(game)).is.false;
    });
  });

  describe('trading (B19/B20)', () => {
    it('trades with the most-advanced track: −1 M€, +2 storage, visitor set, track resets', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Ceres(), new Luna());
      game.colonies[1].trackPosition = 5; // Luna leads.
      bot.megaCredits = 3;

      expect(AutomaColonies.botTrade(game)).is.true;
      const luna = game.colonies[1];
      expect(bot.megaCredits).eq(2);
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(2);
      expect(luna.visitor).eq(bot.id);
      expect(luna.trackPosition).eq(0); // Reset to the colony count.
      expect(game.automa!.shippingStorage[ColonyName.CERES] ?? 0).eq(0);
    });

    it('its own colony there adds +1 (3 total) and breaks track ties', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Ceres(), new Luna());
      game.colonies[1].colonies.push(bot.id); // A bot colony on Luna; tracks tied at 2.
      bot.megaCredits = 1;

      expect(AutomaColonies.botTrade(game)).is.true;
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(3);
      expect(game.colonies[1].trackPosition).eq(1); // Reset to 1 colony.
    });

    it('Europa: +1 TR instead of storage (the 1 M€ still paid)', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Europa());
      bot.megaCredits = 1;
      expect(AutomaColonies.botTrade(game)).is.true;
      expect(bot.terraformRating).eq(21);
      expect(bot.megaCredits).eq(0);
    });

    it('a human colony on the tile receives its colony bonus per the core rules', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna()); // Luna colony bonus: +2 M€.
      game.colonies[0].colonies.push(human.id);
      bot.megaCredits = 1;
      const before = human.megaCredits;

      expect(AutomaColonies.botTrade(game)).is.true;
      runAllActions(game);
      expect(human.megaCredits).eq(before + 2);
    });

    it('every tile visited / not enough M€ → no trade', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna());
      game.colonies[0].visitor = human.id;
      bot.megaCredits = 5;
      expect(AutomaColonies.botTrade(game)).is.false;

      game.colonies[0].visitor = undefined;
      bot.megaCredits = 0;
      expect(AutomaColonies.botTrade(game)).is.false;
    });

    it('the human trading a tile with a MarsBot colony feeds its storage (+1)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Ceres());
      const ceres = game.colonies[0];
      ceres.colonies.push(bot.id);
      ceres.trade(human);
      runAllActions(game);
      expect(game.automa!.shippingStorage[ColonyName.CERES]).eq(1);
    });

    it('the human trading Europa with a MarsBot colony pays the bot 1 M€ instead', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Europa());
      const europa = game.colonies[0];
      europa.colonies.push(bot.id);
      europa.trade(human);
      runAllActions(game);
      expect(bot.megaCredits).eq(1);
      expect(game.automa!.shippingStorage[ColonyName.EUROPA]).is.undefined;
    });
  });

  describe('bonus cards B17/B18/B19', () => {
    it('B17: no city spot + 0 colonies → builds a colony; the card is NOT destroyed', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna());
      const outcome = resolveBonusCard(game, BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
      routeBonusCard(game, BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, outcome);
      expect(outcome).eq('discard');
      expect(game.colonies[0].colonies).deep.eq([bot.id]);
      expect(game.automa!.bonusDiscard).contains(BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES);
    });

    it('B17: with 2+ colonies and no city spot, nothing happens', () => {
      const [game, /* human */, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna(), new Ceres(), new Triton());
      game.colonies[0].colonies.push(bot.id);
      game.colonies[1].colonies.push(bot.id);
      expect(resolveBonusCard(game, BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES)).eq('discard');
      expect(game.colonies[2].colonies).is.empty;
    });

    it('B18: builds a colony, then thins the bonus deck by one unresolved card', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Ceres());
      human.plants = 5;
      game.automa!.bonusDeck = [BonusCardId.B01_METEOR_SHOWER];

      expect(resolveBonusCard(game, BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD)).eq('discard');
      expect(game.colonies[0].colonies).has.length(1);
      expect(game.automa!.shippingStorage[ColonyName.CERES]).eq(2);
      // B01 went to the discard WITHOUT resolving — the human kept every plant.
      expect(game.automa!.bonusDiscard).contains(BonusCardId.B01_METEOR_SHOWER);
      expect(human.plants).eq(5);
      expect(game.automa!.bonusDeck).is.empty;
    });

    it('B19 rides a full MarsBot turn', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      setColonies(game, new Luna());
      game.playerIsFinishedWithResearchPhase(human);
      bot.megaCredits = 1;
      game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B19_SHIPPING_LINES}];
      human.popWaitingFor();
      game.playerIsFinishedTakingActions();

      expect(game.colonies[0].visitor).eq(bot.id);
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(2);
      expect(game.automa!.bonusDiscard).contains(BonusCardId.B19_SHIPPING_LINES);
    });
  });

  it('reaching the 9th space of the Energy track unlocks the 2nd trade fleet (plus the space effect)', () => {
    const [game] = testAutomaGame({coloniesExtension: true});
    const automa = game.automa!;
    automa.board.tracks[THARSIS_TRACK.ENERGY].position = 8;
    AutomaResolver.resolveTag(game, Tag.POWER);
    expect(automa.board.tracks[THARSIS_TRACK.ENERGY].position).eq(9);
    expect(automa.secondFleetUnlocked).is.true;
    expect(game.getTemperature()).eq(-28); // Energy[9] = 'temperature' resolved too.
  });
});
