import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {BREAKTHROUGH_DATA, BREAKTHROUGH_ESCALATION, DATA_PER_VP, SETUP_TR, breakthroughPrice} from '../../src/server/automa/corps/MarsBotLotusInnovations';
import {LotusInnovations} from '../../src/server/cards/turmoilRedux/LotusInnovations';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF7 = MarsBotCorpId.CF7_LOTUS_INNOVATIONS;
const BC7 = BonusCardId.BC7_LAB_BREAKTHROUGH;

function lotusGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF7}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function lab(game: IGame): number {
  return game.automa!.corpResources;
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC7);
  routeBonusCard(game, BC7, outcome);
  runAllActions(game);
  return outcome;
}

describe('MarsBot Lotus Innovations (CF7, the fork\'s own card) — «the Scientific Breakthrough»', () => {
  describe('the card', () => {
    it('Science, a Science draft plate, the lab of data, its own BC7, no module condition', () => {
      const info = marsBotCorpInfo(CF7);
      expect(info.original).eq(CardName.LOTUS_INNOVATIONS);
      expect(info.cardNumber).eq('CF7');
      expect(info.startingTags).deep.eq([Tag.SCIENCE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SCIENCE]});
      expect(info.resource).eq('data');
      expect(info.corpBonusCards).deep.eq([BC7]);
      expect(info.requiresModules).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Lotus Innovations', () => {
      const [game, human] = testAutomaGame({}, '-li-collide');
      human.pickedCorporationCard = new LotusInnovations();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF7);
    });
  });

  describe('SETUP + EFFECT — the rating feeds the lab', () => {
    it('the setup raised the TR 2 steps and those steps put their own data («including from this»)', () => {
      const [game] = lotusGame('-li-setup');
      expect(game.automa!.corpStats.lotusData).to.be.at.least(SETUP_TR);
    });

    it('every step of the bot\'s rating puts one datum, one dispatch per raise; a human\'s rating puts nothing', () => {
      const [game, human, bot] = lotusGame('-li-tr');
      const before = lab(game);
      bot.increaseTerraformRating(3);
      expect(lab(game)).eq(before + 3);
      human.increaseTerraformRating(2);
      expect(lab(game)).eq(before + 3);
    });

    it('the end of the game: 1 VP per 4 data left', () => {
      const [game] = lotusGame('-li-end');
      game.automa!.corpResources = 2 * DATA_PER_VP + 3;
      expect(AutomaCorporations.corpFor(CF7).endgameVictoryPoints!(game)).eq(2);
    });
  });

  describe('BC7 LAB BREAKTHROUGH — 4 data, +1 per breakthrough made', () => {
    it('9 data: two breakthroughs (4 then 5), the science track twice, 0 left; the card recurs', () => {
      const [game] = lotusGame('-li-leap');
      const automa = game.automa!;
      automa.corpStats.breakthroughs = 0;
      automa.corpResources = BREAKTHROUGH_DATA + (BREAKTHROUGH_DATA + BREAKTHROUGH_ESCALATION);
      const science = automa.board.getTrackIndexForTag(Tag.SCIENCE)!;
      const position = automa.board.tracks[science].position;
      expect(resolve(game)).eq('discard');
      expect(automa.corpStats.breakthroughs).eq(2);
      expect(automa.board.tracks[science].position, 'two science steps (a space may push further)').to.be.at.least(position + 2);
      expect(breakthroughPrice(game)).eq(BREAKTHROUGH_DATA + 2 * BREAKTHROUGH_ESCALATION);
      expect(automa.recurringBonusCards).contains(BC7);
    });

    it('below the price → nothing at all', () => {
      const [game] = lotusGame('-li-short');
      game.automa!.corpStats.breakthroughs = 0;
      game.automa!.corpResources = BREAKTHROUGH_DATA - 1;
      resolve(game);
      expect(lab(game)).eq(BREAKTHROUGH_DATA - 1);
      expect(game.automa!.corpStats.breakthroughs).eq(0);
    });

    it('a finished science track spreads the breakthrough to the least advanced track', () => {
      const [game] = lotusGame('-li-spread');
      const automa = game.automa!;
      const science = automa.board.getTrackIndexForTag(Tag.SCIENCE)!;
      const track = automa.board.tracks[science];
      while (track.canAdvance()) {
        track.position++;
      }
      automa.corpStats.breakthroughs = 0;
      automa.corpResources = BREAKTHROUGH_DATA;
      resolve(game);
      expect(automa.corpStats.breakthroughSpread).eq(1);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Research grants»: 4 VP per 5 science cards of the other players; the goal counts tag requirements; the lab survives a save', () => {
      const [game] = lotusGame('-li-div');
      const corp = AutomaCorporations.corpFor(CF7);
      const r = marsBotDividendInfo(CF7).rates;
      expect(r.each).eq(4);
      expect(r.per).eq(5);
      const goal = corp.goal(game);
      game.automa!.playedPile.push(CardName.GENE_REPAIR); // a tag requirement (3 science)
      game.automa!.playedPile.push(CardName.MINE); // no requirement
      expect(corp.goal(game)).eq(goal + 1);
      game.automa!.corpResources = 6;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(6);
      expect(copy.automa!.corporation).eq(CF7);
    });
  });
});
