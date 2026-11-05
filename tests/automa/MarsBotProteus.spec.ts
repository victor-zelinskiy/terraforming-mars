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
import {AutomaState} from '../../src/server/automa/AutomaState';
import {DATA_PER_MATCH, DEEP_RUN_DATA, IMPRINT_CARDS, STARTING_DATA, imprintMatches} from '../../src/server/automa/corps/MarsBotProteus';
import {Proteus} from '../../src/server/cards/turmoilRedux/Proteus';
import {TestPlayer} from '../TestPlayer';
import {maxOutOceans, runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF8 = MarsBotCorpId.CF8_PROTEUS;
const BC8 = BonusCardId.BC8_DEEP_RUN;

function proteusGame(suffix: string, colonies = false): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF8, ...(colonies ? {coloniesExtension: true} : {})}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function data(game: IGame): number {
  return game.automa!.corpResources;
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC8);
  routeBonusCard(game, BC8, outcome);
  runAllActions(game);
  return outcome;
}

/** A tag whose track is NOT on the imprint (undefined when the imprint covers every track). */
function tagOffImprint(game: IGame): Tag | undefined {
  const candidates = [Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.EVENT];
  return candidates.find((tag) => game.automa!.board.getTrackIndexForTag(tag) !== undefined && !imprintMatches(game, tag));
}

describe('MarsBot Proteus (CF8, the fork\'s own card) — «the Imprint of Form»', () => {
  describe('the card', () => {
    it('Wild, the imprint\'s draft plate and markers decided in play, data, its own BC8, no module condition', () => {
      const info = marsBotCorpInfo(CF8);
      expect(info.original).eq(CardName.PROTEUS);
      expect(info.cardNumber).eq('CF8');
      expect(info.startingTags).deep.eq([Tag.WILD]);
      // The plate is the IMPRINT's — decided in play, so nothing is printed in the data.
      expect(info.draftPriority).is.undefined;
      expect(info.whiteMarkerTracks).is.undefined;
      expect(info.markerTracksInPlay).is.true;
      expect(info.markerLegend).is.a('string').and.not.empty;
      expect(info.resource).eq('data');
      expect(info.corpBonusCards).deep.eq([BC8]);
      expect(info.requiresModules).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Proteus', () => {
      const [game, human] = testAutomaGame({}, '-pr-collide');
      human.pickedCorporationCard = new Proteus();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF8);
    });
  });

  describe('SETUP — the imprint', () => {
    it('reads one tag per track off the revealed cards, paints those tracks, starts the card with 2 data', () => {
      const [game] = proteusGame('-pr-setup');
      const automa = game.automa!;
      const imprint = automa.corpImprint;
      const tracks = imprint.map((tag) => automa.board.getTrackIndexForTag(tag));
      expect(imprint).not.contains(Tag.WILD);
      expect(tracks.every((t) => t !== undefined), 'every imprinted tag stands on a track').is.true;
      expect(new Set(tracks).size, 'one entry per track').eq(tracks.length);
      expect(automa.corpStats.proteusImprint).eq(imprint.length);
      // The mat paints exactly those tracks.
      expect([...AutomaCorporations.whiteMarkerTrackIndexes(game)].sort()).deep.eq([...tracks].sort());
      expect(data(game)).to.be.at.least(STARTING_DATA);
    });

    it('the revealed cards go to the open discard — never into the bot\'s deck', () => {
      const [game] = proteusGame('-pr-discard');
      const revealed = game.gameLog.filter((m) => m.message === '${0} revealed ${1} as the imprint of its corporation ${2}');
      expect(revealed).has.length(IMPRINT_CARDS);
      for (const message of revealed) {
        const name = message.data[1].value as CardName;
        expect(game.projectDeck.discardPile.map((c) => c.name), name).contains(name);
        expect(game.automa!.actionDeck.some((e) => e.kind === 'project' && e.name === name), name).is.false;
      }
    });

    it('the draft priority is the imprint\'s tags, in their order', () => {
      const [game] = proteusGame('-pr-draft');
      const imprint = game.automa!.corpImprint;
      expect(AutomaCorporations.draftPriorityOf(game)).deep.eq(imprint.length === 0 ? undefined : {type: 'tags', tags: imprint});
    });
  });

  describe('EFFECT — a matching tag feeds the card', () => {
    it('a tag on a track of the imprint puts 1 datum; a tag off it and the Wild put nothing', () => {
      const [game] = proteusGame('-pr-match');
      const corp = AutomaCorporations.corpFor(CF8);
      const imprinted = game.automa!.corpImprint[0];
      const before = data(game);
      corp.onTagResolved!(game, imprinted);
      expect(data(game)).eq(before + DATA_PER_MATCH);
      corp.onTagResolved!(game, Tag.WILD);
      expect(data(game)).eq(before + DATA_PER_MATCH);
      const off = tagOffImprint(game);
      if (off !== undefined) {
        corp.onTagResolved!(game, off);
        expect(data(game), `${off} is off the imprint`).eq(before + DATA_PER_MATCH);
      }
    });

    it('the match is the TRACK: a second tag riding an imprinted track pays too', () => {
      const [game] = proteusGame('-pr-track');
      const automa = game.automa!;
      automa.corpImprint = [Tag.EARTH];
      const sharing = [Tag.CITY, Tag.EARTH, Tag.POWER, Tag.JOVIAN].filter((tag) =>
        automa.board.getTrackIndexForTag(tag) === automa.board.getTrackIndexForTag(Tag.EARTH));
      for (const tag of sharing) {
        expect(imprintMatches(game, tag), `${tag} rides the Earth track`).is.true;
      }
    });
  });

  describe('BC8 DEEP RUN — 6 data: a colony, or an ocean', () => {
    it('with Colonies: 12 data → two colonies, 0 left; the card recurs', () => {
      const [game] = proteusGame('-pr-colony', true);
      const automa = game.automa!;
      automa.corpResources = 2 * DEEP_RUN_DATA;
      expect(resolve(game)).eq('discard');
      expect(automa.corpStats.deepRunColonies).eq(2);
      expect(data(game)).eq(0);
      expect(automa.recurringBonusCards).contains(BC8);
    });

    it('without Colonies: 6 data → an ocean (its TR comes with it)', () => {
      const [game, , bot] = proteusGame('-pr-ocean');
      const automa = game.automa!;
      automa.corpResources = DEEP_RUN_DATA;
      const oceans = game.board.getOceanSpaces().length;
      const tr = bot.terraformRating;
      resolve(game);
      expect(game.board.getOceanSpaces().length).eq(oceans + 1);
      expect(bot.terraformRating).to.be.at.least(tr + 1);
      expect(data(game)).eq(0);
    });

    it('no colony and no ocean left → the data wait; below the price → nothing at all', () => {
      const [game, human] = proteusGame('-pr-wait');
      const automa = game.automa!;
      maxOutOceans(human);
      automa.corpResources = DEEP_RUN_DATA;
      resolve(game);
      expect(data(game), 'the data wait on the card').eq(DEEP_RUN_DATA);
      automa.corpResources = DEEP_RUN_DATA - 1;
      resolve(game);
      expect(data(game)).eq(DEEP_RUN_DATA - 1);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Many forms»: 1 VP per card of two or more tags; the goal counts microbe tags; the imprint survives a save', () => {
      const [game] = proteusGame('-pr-div');
      const corp = AutomaCorporations.corpFor(CF8);
      expect(marsBotDividendInfo(CF8).rates.each).eq(1);
      const formula = corp.dividend(game).vp;
      const goal = corp.goal(game);
      game.automa!.playedPile.push(CardName.RESEARCH_OUTPOST); // science + city + building — a card of many forms
      game.automa!.playedPile.push(CardName.MINE); // one tag — not
      game.automa!.playedPile.push(CardName.DECOMPOSERS); // one microbe tag — the goal's, not the formula's
      expect(corp.dividend(game).vp).eq(formula + 1);
      expect(corp.goal(game)).eq(goal + 1);
      const imprint = [...game.automa!.corpImprint];
      game.automa!.corpResources = 5;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpImprint).deep.eq(imprint);
      expect(copy.automa!.corpResources).eq(5);
      expect(copy.automa!.corporation).eq(CF8);
    });

    it('an old save without the imprint reads as none', () => {
      const [game] = proteusGame('-pr-old');
      const serialized = game.automa!.serialize();
      delete serialized.corpImprint;
      expect(AutomaState.deserialize(serialized, game.gameOptions).corpImprint).deep.eq([]);
    });
  });
});
