import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const BANK = 10;

/** A live Mining Guild game with the corporation seated (setup already run). */
function guildGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C06_MINING_GUILD): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Put the board in a quiet state: a full card, a building track with room. */
function armBank(game: IGame, position = 3) {
  const automa = game.automa!;
  automa.corpResources = BANK;
  automa.board.tracks[THARSIS_TRACK.BUILDING].position = position;
  automa.corpStats['miningGuildBanked'] = 0;
  automa.corpStats['miningGuildRefills'] = 0;
}

function bank(game: IGame): number {
  return game.automa!.corpResources;
}

function buildingTrack(game: IGame): number {
  return game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position;
}

describe('MarsBot Mining Guild (C06)', () => {
  describe('the printed card', () => {
    it('prints two building starting tags and a 10 M€ bank on the card', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C06_MINING_GUILD);
      expect(info.original).eq(CardName.MINING_GUILD);
      expect(info.cardNumber).eq('C06');
      expect(info.startingTags).deep.eq([Tag.BUILDING, Tag.BUILDING]);
      expect(info.resource).eq('megacredits');
      expect(info.mcBank).deep.eq({size: BANK, trackTag: Tag.BUILDING});
      expect(info.draftPriority).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });
  });

  describe('the SETUP box + starting tags', () => {
    it('stocks the card and resolves the two building tags', () => {
      const [game, , bot] = guildGame('-mg-setup');
      // Tharsis building track: 0 → 1 → 2 (the printed ocean space).
      expect(buildingTrack(game)).eq(2);
      // Every M€ the setup itself produced came off the card, so the bank plus
      // what it paid out always adds up to the stack(s) it was given.
      const banked = game.automa!.corpStats['miningGuildBanked'] ?? 0;
      const refills = game.automa!.corpStats['miningGuildRefills'] ?? 0;
      expect(banked).eq(refills * BANK + (BANK - bank(game)));
      expect(bot.megaCredits, 'the bot still received its M€').eq(banked);
    });

    it('another corporation has no bank at all', () => {
      const [game] = guildGame('-mg-other', MarsBotCorpId.C01_CREDICOR);
      const before = bank(game);
      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 3;
      const bot = game.players.find((p) => p.isMarsBot)!;
      bot.stock.add(Resource.MEGACREDITS, 7);
      expect(bank(game)).eq(before);
      expect(game.automa!.corpStats['miningGuildBanked']).is.undefined;
    });
  });

  describe('the EFFECT — the bot\'s income is taken from the card', () => {
    it('a gain smaller than the stack only drains it', () => {
      const [game, , bot] = guildGame('-mg-partial');
      armBank(game);
      const track = buildingTrack(game);

      bot.stock.add(Resource.MEGACREDITS, 4);

      expect(bot.megaCredits, 'the bot still gains the M€').is.greaterThan(0);
      expect(bank(game)).eq(6);
      expect(buildingTrack(game), 'nothing emptied — no advance').eq(track);
      expect(game.automa!.corpStats['miningGuildBanked']).eq(4);
    });

    it('emptying the card refills it and advances the building track', () => {
      const [game, , bot] = guildGame('-mg-empty');
      armBank(game);
      const track = buildingTrack(game);

      bot.stock.add(Resource.MEGACREDITS, BANK);

      expect(bank(game), 'refilled').eq(BANK);
      expect(buildingTrack(game)).eq(track + 1);
      expect(game.automa!.corpStats['miningGuildRefills']).eq(1);
    });

    it('a gain bigger than the stack carries over into the fresh one', () => {
      const [game, , bot] = guildGame('-mg-carry');
      armBank(game);
      const track = buildingTrack(game);

      bot.stock.add(Resource.MEGACREDITS, 12);

      expect(bank(game)).eq(BANK - 2);
      expect(buildingTrack(game), 'exactly one advance').eq(track + 1);
      expect(game.automa!.corpStats['miningGuildBanked']).eq(12);
    });

    it('a huge gain empties the card several times — one advance each', () => {
      const [game, , bot] = guildGame('-mg-multi');
      armBank(game);
      const track = buildingTrack(game);

      bot.stock.add(Resource.MEGACREDITS, 25);

      expect(bank(game)).eq(5);
      expect(buildingTrack(game)).eq(track + 2);
      expect(game.automa!.corpStats['miningGuildRefills']).eq(2);
    });

    it('losing M€ never touches the card', () => {
      const [game, , bot] = guildGame('-mg-loss');
      armBank(game);
      bot.stock.add(Resource.MEGACREDITS, 8); // Bank 2, bot 8.
      bot.stock.add(Resource.MEGACREDITS, -5);
      expect(bank(game), 'a loss is not a gain').eq(2);
      expect(game.automa!.corpStats['miningGuildBanked']).eq(8);
    });

    it('another resource never touches the card', () => {
      const [game, , bot] = guildGame('-mg-otherres');
      armBank(game);
      bot.stock.add(Resource.STEEL, 6);
      expect(bank(game)).eq(BANK);
    });

    it('a HUMAN gaining M€ never touches the bot card', () => {
      const [game, human] = guildGame('-mg-human');
      armBank(game);
      human.stock.add(Resource.MEGACREDITS, 12);
      expect(bank(game)).eq(BANK);
      expect(game.automa!.corpStats['miningGuildBanked']).eq(0);
    });
  });

  describe('re-entrancy — the advance itself can pay the bot', () => {
    it('an advance that grants M€ drains the FRESH stack, and the books still balance', () => {
      const [game, , bot] = guildGame('-mg-reentrant');
      const automa = game.automa!;
      armBank(game, 1); // Building #2 is the printed OCEAN space.

      bot.stock.add(Resource.MEGACREDITS, BANK);

      expect(buildingTrack(game)).eq(2);
      expect(game.board.getOceanSpaces(), 'the advance placed the printed ocean').is.not.empty;
      // The books: everything the card ever paid out equals the stacks it was
      // given, whatever the ocean's covered icons added on top.
      const banked = automa.corpStats['miningGuildBanked'] ?? 0;
      const refills = automa.corpStats['miningGuildRefills'] ?? 0;
      expect(banked).eq(refills * BANK + (BANK - bank(game)));
      expect(refills).is.at.least(1);
    });
  });

  describe('the printed off-switch — the building track at its end', () => {
    it('stops paying once the track is finished', () => {
      const [game, , bot] = guildGame('-mg-maxed');
      const automa = game.automa!;
      armBank(game);
      const track = automa.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = track.maxPosition;

      bot.stock.add(Resource.MEGACREDITS, 15);

      expect(bank(game), 'the card is frozen').eq(BANK);
      expect(track.position).eq(track.maxPosition);
      expect(game.automa!.corpStats['miningGuildBanked']).eq(0);
    });

    it('a drain that reaches the end mid-way stops there', () => {
      const [game, , bot] = guildGame('-mg-reach-end');
      const automa = game.automa!;
      armBank(game);
      const track = automa.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = track.maxPosition - 1; // One advance left.

      bot.stock.add(Resource.MEGACREDITS, 25);

      expect(track.position).eq(track.maxPosition);
      expect(game.automa!.corpStats['miningGuildRefills'], 'only the one advance it had room for').eq(1);
      // 10 M€ went through the card; the remaining 15 came from the supply.
      expect(game.automa!.corpStats['miningGuildBanked']).eq(BANK);
      expect(bank(game)).eq(BANK);
    });
  });

  describe('state', () => {
    it('the bank and its counters survive a save/load round trip', () => {
      const [game, , bot] = guildGame('-mg-serialize');
      armBank(game);
      bot.stock.add(Resource.MEGACREDITS, 13);
      const expected = bank(game);
      const stats = {...game.automa!.corpStats};

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C06_MINING_GUILD);
      expect(restored.automa!.corpResources).eq(expected);
      expect(restored.automa!.corpStats).deep.eq(stats);
    });

    it('the public model ships the bank as the corporation resource', () => {
      const [game] = guildGame('-mg-model');
      armBank(game);
      expect(marsBotCorpInfo(game.automa!.corporation!).resource).eq('megacredits');
      expect(game.automa!.corpResources).eq(BANK);
    });
  });
});
