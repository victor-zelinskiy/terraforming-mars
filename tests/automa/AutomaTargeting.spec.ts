import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {Counter} from '../../src/server/behavior/Counter';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {AutomaTargeting} from '../../src/server/automa/AutomaTargeting';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {CometForVenus} from '../../src/server/cards/venusNext/CometForVenus';
import {GalileanWaystation} from '../../src/server/cards/colonies/GalileanWaystation';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {Virus} from '../../src/server/cards/base/Virus';
import {Ceres} from '../../src/server/colonies/Ceres';
import {cast} from '../../src/common/utils/utils';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

function optionTitles(input: OrOptions): Array<string> {
  return input.options.map((o) => typeof o.title === 'string' ? o.title : o.title.message);
}

describe('Automa targeting — the human turn vs MarsBot', () => {
  describe('remove: the M€ supply as the matching resource type', () => {
    it('RemoveAnyPlants offers MarsBot and removes from its M€ supply', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 7;
      const options = cast(new RemoveAnyPlants(human, 5).execute(), OrOptions);
      const botOption = options.options[0];
      expect(optionTitles(options)[0]).contains('Remove ${0} plants');
      botOption.cb(undefined);
      expect(bot.megaCredits).eq(2);
      expect(human.plants).eq(0); // A removal, not a steal.
    });

    it('with Colonies the REAL storage plants (Ganymede) go first, the M€ proxy tops up', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 7;
      game.automa!.shippingStorage[ColonyName.GANYMEDE] = 2;
      expect(AutomaTargeting.attackableStock(bot, Resource.PLANTS)).eq(9);

      const options = cast(new RemoveAnyPlants(human, 5).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(game.automa!.shippingStorage[ColonyName.GANYMEDE]).eq(0);
      expect(bot.megaCredits).eq(4); // 2 from storage + 3 from the supply.
    });

    it('a broke MarsBot (0 M€, no storage) is not a removable target', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 0;
      expect(new RemoveAnyPlants(human, 5).execute()).is.undefined;
    });
  });

  describe('steal: the thief receives the STOLEN TYPE, MarsBot pays in M€', () => {
    it('stealing steel gives the human steel; the bot loses M€', () => {
      const [/* game */, human, bot] = testAutomaGame();
      bot.megaCredits = 3;
      const options = cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.steel).eq(2);
      expect(bot.megaCredits).eq(1);
    });

    it('the Ceres storage steel is stolen first ("as usual"), then the M€ proxy', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 3;
      game.automa!.shippingStorage[ColonyName.CERES] = 1;
      const options = cast(new StealResources(human, Resource.STEEL, 2).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.steel).eq(2);
      expect(game.automa!.shippingStorage[ColonyName.CERES]).eq(0);
      expect(bot.megaCredits).eq(2);
    });

    it('stealing M€ drains the supply first, then the Luna storage', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      bot.megaCredits = 3;
      game.automa!.shippingStorage[ColonyName.LUNA] = 4;
      const options = cast(new StealResources(human, Resource.MEGACREDITS, 5, undefined, true).execute(), OrOptions);
      options.options[0].cb(undefined);
      expect(human.megaCredits).eq(5);
      expect(bot.megaCredits).eq(0);
      expect(game.automa!.shippingStorage[ColonyName.LUNA]).eq(2);
    });
  });

  describe('decrease production → the mapped track regresses', () => {
    it('an energy production attack regresses the Energy track with the marker', () => {
      const [game, /* human */, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.ENERGY];
      track.position = 3;
      bot.production.add(Resource.ENERGY, -1, {log: true});
      expect(track.position).eq(2);
      expect(track.regressedPositions.has(3)).is.true;
      expect(bot.production.energy).eq(0); // Never a real production mutation.
    });

    it('a 2-step M€ production decrease regresses the Event track twice', () => {
      const [game, /* human */, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = 5;
      bot.production.add(Resource.MEGACREDITS, -2, {log: true});
      expect(track.position).eq(3);
      expect(track.regressedPositions).deep.eq(new Set([4, 5]));
    });

    it('canHaveProductionReduced mirrors the track position', () => {
      const [game, human, bot] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.BIO];
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 1, human)).is.false;
      track.position = 2;
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 1, human)).is.true;
      expect(bot.canHaveProductionReduced(Resource.PLANTS, 3, human)).is.false;
    });
  });

  describe('counting what all players have → the tracks', () => {
    it('an "all players" tag count reads the bot track position (current, post-regression)', () => {
      const [game, human] = testAutomaGame();
      const track = game.automa!.board.tracks[THARSIS_TRACK.EVENT];
      track.position = 5;
      track.regress(); // Position 4 — the CURRENT position counts.
      const counter = new Counter(human, fakeCard({}));
      expect(counter.count({tag: Tag.EVENT, all: true})).eq(4);
    });

    it('Galilean Waystation counts HALF the Jovian track, rounded down (FAQ)', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true});
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 5; // Jovian rides Energy.
      const counter = new Counter(human, new GalileanWaystation());
      expect(counter.count({tag: Tag.JOVIAN, all: true})).eq(2);

      const plain = new Counter(human, fakeCard({}));
      expect(plain.count({tag: Tag.JOVIAN, all: true})).eq(5);
    });
  });

  it('Comet for Venus targets MarsBot when its Venus track is above 0', () => {
    const [game, human, bot] = testAutomaGame({venusNextExtension: true});
    const card = new CometForVenus();
    expect(card.bespokePlay(human)).is.undefined; // Venus track 0 → no target.

    game.automa!.board.tracks[7].position = 2;
    bot.megaCredits = 6;
    const options = cast(card.bespokePlay(human), OrOptions);
    const selectPlayer = cast(options.options[0], SelectPlayer);
    expect(selectPlayer.players.map((p) => p.id)).contains(bot.id);
    selectPlayer.cb(bot);
    expect(bot.megaCredits).eq(2); // −4 M€ from the supply.
  });

  it('Sponsored Academies pays MarsBot 1 M€ instead of the free draw (FAQ)', () => {
    const [/* game */, human, bot] = testAutomaGame({venusNextExtension: true});
    new SponsoredAcademies().bespokePlay(human);
    expect(bot.megaCredits).eq(1);
    expect(bot.cardsInHand).is.empty;
  });

  it('Virus can remove 2 "animals" from MarsBot: Miranda storage first, then M€', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true});
    game.colonies.splice(0, game.colonies.length, new Ceres());
    bot.megaCredits = 5;
    game.automa!.shippingStorage[ColonyName.MIRANDA] = 1;

    const options = cast(new Virus().buildRemovalOptions(human), OrOptions);
    const botOption = options.options[options.options.length - 2]; // Before 'Skip removal'.
    botOption.cb(undefined);
    expect(game.automa!.shippingStorage[ColonyName.MIRANDA]).eq(0);
    expect(bot.megaCredits).eq(4);
  });
});
