import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {TITAN_TAGS} from '../../src/common/cards/titanHoldingsTags';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {pileTagCount} from '../../src/server/automa/corps/MarsBotDividendReads';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {LEVERAGE_PER_MOVE, LEVERAGE_PER_TAG, delegateCanMatter, planetTrackIndex} from '../../src/server/automa/corps/MarsBotTitanHoldings';
import {TitanHoldings} from '../../src/server/cards/turmoilRedux/TitanHoldings';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const CF10 = MarsBotCorpId.CF10_TITAN_HOLDINGS;

function titanGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF10, coloniesExtension: true, turmoilReduxExpansion: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function leverage(game: IGame): number {
  return game.automa!.corpResources;
}

function corp() {
  return AutomaCorporations.corpFor(CF10);
}

describe('MarsBot Titan Holdings (CF10, the fork\'s own card) — «the Holding\'s Lobby»', () => {
  describe('the card', () => {
    it('Earth + Jovian, an Earth-then-Jovian plate, leverage on the card, no bonus card, the Mars Parliament required', () => {
      const info = marsBotCorpInfo(CF10);
      expect(info.original).eq(CardName.TITAN_HOLDINGS);
      expect(info.cardNumber).eq('CF10');
      expect(info.startingTags).deep.eq([Tag.EARTH, Tag.JOVIAN]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.EARTH, Tag.JOVIAN]});
      expect(info.requiresModules).deep.eq(['turmoilRedux']);
      expect(info.resource).eq('leverage');
      expect(info.corpBonusCards).deep.eq([]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Titan Holdings, and drops out of a game without Turmoil Redux', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true}, '-th-collide');
      human.pickedCorporationCard = new TitanHoldings();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF10);
      const [plain] = testAutomaGame({}, '-th-plain');
      expect(AutomaCorporations.eligibleCorpIds(plain)).not.contains(CF10);
    });

    it('reads the human card\'s own planet tags — one list for both', () => {
      expect(TITAN_TAGS).deep.eq([Tag.MARS, Tag.EARTH, Tag.VENUS, Tag.JOVIAN, Tag.MOON]);
    });
  });

  describe('EFFECT — a planet tag puts a leverage', () => {
    it('its own Earth + Jovian brought their leverage («including these»), spent at once by the before-action box', () => {
      const [game] = titanGame('-th-start');
      expect(game.automa!.corpStats.titanLeverage).to.be.at.least(2 * LEVERAGE_PER_TAG);
    });

    it('each planet tag puts 1 leverage; a science tag and the Wild put nothing', () => {
      const [game] = titanGame('-th-tags');
      const before = leverage(game);
      for (const tag of TITAN_TAGS) {
        corp().onTagResolved!(game, tag);
      }
      expect(leverage(game)).eq(before + TITAN_TAGS.length * LEVERAGE_PER_TAG);
      corp().onTagResolved!(game, Tag.SCIENCE);
      corp().onTagResolved!(game, Tag.WILD);
      expect(leverage(game)).eq(before + TITAN_TAGS.length * LEVERAGE_PER_TAG);
    });
  });

  describe('BEFORE ACTION PHASE — a delegate where it matters, the planet track otherwise', () => {
    it('a vote MarsBot does not lead takes a delegate; once it leads, the rest is invested in the least advanced planet track', () => {
      const [game, , bot] = titanGame('-th-spend');
      const automa = game.automa!;
      const parliament = game.parliament!;
      for (const slot of parliament.slots) {
        slot.votes = [];
      }
      automa.corpStats.titanDelegates = 0;
      automa.corpStats.titanInvestments = 0;
      automa.corpResources = 3 * LEVERAGE_PER_MOVE;
      expect(delegateCanMatter(game, bot), 'nobody leads the vote').is.true;
      corp().beforeActionPhase!(game);
      expect(leverage(game)).eq(0);
      expect(automa.corpStats.titanDelegates, 'one delegate makes MarsBot lead').eq(1);
      expect(automa.corpStats.titanInvestments, 'the rest is invested').eq(2);
      expect(parliament.winner()?.player).eq(bot.id);
    });

    it('an empty reserve invests every leverage', () => {
      const [game, , bot] = titanGame('-th-reserve');
      const automa = game.automa!;
      const parliament = game.parliament!;
      while (parliament.reserve(bot) > 0) {
        parliament.placeVote(bot, parliament.slots[0], 'reserve');
      }
      automa.corpStats.titanDelegates = 0;
      automa.corpStats.titanInvestments = 0;
      automa.corpResources = 2 * LEVERAGE_PER_MOVE;
      corp().beforeActionPhase!(game);
      expect(automa.corpStats.titanDelegates).eq(0);
      expect(automa.corpStats.titanInvestments).eq(2);
    });

    it('the investment pushes the least advanced track that carries a planet tag', () => {
      const [game] = titanGame('-th-track');
      const board = game.automa!.board;
      const index = planetTrackIndex(game);
      const track = board.tracks[index];
      expect(track.definition.tags.some((tag) => TITAN_TAGS.includes(tag))).is.true;
      for (const other of board.tracks) {
        if (other.canAdvance() && other.definition.tags.some((tag) => TITAN_TAGS.includes(tag))) {
          expect(track.position).to.be.at.most(other.position);
        }
      }
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Tenants»: 1 VP per 2 planet cards of the other players; the goal counts the planet tags of MarsBot\'s pile; the leverage survives a save', () => {
      const [game] = titanGame('-th-div');
      const r = marsBotDividendInfo(CF10).rates;
      expect(r.each).eq(1);
      expect(r.per).eq(2);
      expect(marsBotDividendInfo(CF10).goal?.tiers.map((t) => t.at)).deep.eq([12, 14, 16]);
      expect(corp().goal(game)).eq(pileTagCount(game, TITAN_TAGS));
      game.automa!.corpResources = 3;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(3);
      expect(copy.automa!.corporation).eq(CF10);
    });
  });
});
