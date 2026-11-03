import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Board} from '../../src/server/boards/Board';
import {Space} from '../../src/server/boards/Space';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {FIELD_PRACTICE_TUITION, freeCampusSpaces} from '../../src/server/automa/corps/MarsBotFerrusAcademy';
import {FerrusAcademy} from '../../src/server/cards/turmoilRedux/FerrusAcademy';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF1 = MarsBotCorpId.CF1_FERRUS_ACADEMY;
const BC1 = BonusCardId.BC1_FIELD_PRACTICE;

/** A game with Ferrus Academy seated (setup + Before Action Phase already run). */
function academyGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF1}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** The Academy — the bot city whose neighbours carry the Campus cubes (the setup's only city of its own). */
function academyOf(game: IGame, bot: IPlayer): Space {
  const cities = game.board.spaces.filter((s) => Board.isCitySpace(s) && s.player?.id === bot.id);
  const academy = cities.find((city) => game.board.getAdjacentSpaces(city).some((n) => n.player?.id === bot.id && n.tile === undefined)) ?? cities[0];
  expect(academy, 'the Academy city stands').is.not.undefined;
  return academy;
}

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

function trackSum(game: IGame): number {
  return game.automa!.board.tracks.reduce((sum, t) => sum + t.position, 0);
}

describe('MarsBot Ferrus Academy (CF1, the fork\'s own card) + BC1 Field Practice — «the Campus»', () => {
  describe('the card', () => {
    it('science and city tags, a science priority, a setup / effect / before-action-phase box, its own BC1', () => {
      const info = marsBotCorpInfo(CF1);
      expect(info.original).eq(CardName.FERRUS_ACADEMY);
      expect(info.cardNumber).eq('CF1');
      expect(info.startingTags).deep.eq([Tag.SCIENCE, Tag.CITY]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SCIENCE]});
      expect(info.corpBonusCards).deep.eq([BC1]);
      expect(info.requiresModules, 'the Campus needs only the map').is.undefined;
      expect(info.resource).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Ferrus Academy', () => {
      const [game, human] = testAutomaGame({}, '-fa-collide');
      human.pickedCorporationCard = new FerrusAcademy();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF1);
    });
  });

  describe('SETUP — the Academy and its Campus', () => {
    it('one city, and the bot\'s cubes on every adjacent non-reserved land space — reserved against the human', () => {
      const [game, human, bot] = academyGame('-fa-setup');
      const stats = game.automa!.corpStats;
      expect(stats.ferrusFoundings).eq(1);
      const academy = academyOf(game, bot);
      const campus = freeCampusSpaces(game);
      // The ring as the human card reads it, read again here after the fact: every Campus cube touches the Academy,
      // and the count the setup reported is the ring it laid (a starting tag may already have built on one).
      for (const cell of campus) {
        expect(game.board.getAdjacentSpaces(academy), `${cell.id} borders the Academy`).contains(cell);
        expect(cell.spaceType).eq(SpaceType.LAND);
      }
      const built = game.board.getAdjacentSpaces(academy).filter((n) => n.player?.id === bot.id && n.tile !== undefined && !Board.isCitySpace(n));
      expect(campus.length + built.length, 'the reported Campus').to.be.at.most(stats.ferrusCampusSpaces ?? 0);
      expect(stats.ferrusCampusSpaces).to.be.at.most(6);
      // Reserved: none of the free Campus cells is legal for the human.
      const humanLegal = new Set(game.board.getAvailableSpacesOnLand(human).map((s) => s.id));
      for (const cell of campus) {
        expect(humanLegal.has(cell.id), `${cell.id} is closed to the human`).is.false;
      }
      expect(game.gameLog.some((m) => m.message === '${0} founded its Academy on ${1}: ${2} Campus space(s) reserved around it')).is.true;
    });

    it('the founding city\'s bonus icons pay the bot double (`printedBonusMultiplier` on the bot\'s icon M€)', () => {
      const [game, , bot] = testAutomaGame({}, '-fa-double');
      const space = game.board.getAvailableSpacesForCity(bot).find((s) => s.bonus.length >= 2);
      expect(space, 'a city space with two printed icons').is.not.undefined;
      const mc = bot.megaCredits;
      game.addTile(bot, space!, {tileType: TileType.CITY}, {printedBonusMultiplier: 2});
      const oceans = game.board.getAdjacentSpaces(space!).filter((s) => Board.isOceanSpace(s)).length;
      expect(bot.megaCredits - mc).eq(2 * space!.bonus.length + oceans * bot.oceanBonus);
    });
  });

  describe('EFFECT — Graduation', () => {
    it('a tile on a Campus cube advances the least advanced track', () => {
      const [game, , bot] = academyGame('-fa-grad');
      const cell = freeCampusSpaces(game)[0];
      expect(cell, 'a free Campus space').is.not.undefined;
      const automa = game.automa!;
      const least = automa.board.getLeastAdvancedTrackIndex();
      const before = automa.board.tracks[least].position;
      const grads = automa.corpStats.ferrusGraduations ?? 0;
      game.addGreenery(bot, cell);
      runAllActions(game);
      expect(automa.board.tracks[least].position, 'the weakest field got its graduate').to.be.greaterThan(before);
      expect(automa.corpStats.ferrusGraduations).eq(grads + 1);
      expect(game.gameLog.some((m) => m.message === '${0} graduated a class from its Academy: its least advanced track advances')).is.true;
    });

    it('a tile OFF the Campus graduates nobody', () => {
      const [game, , bot] = academyGame('-fa-off');
      const campus = new Set(freeCampusSpaces(game).map((s) => s.id));
      const elsewhere = game.board.getAvailableSpacesForGreenery(bot).find((s) => !campus.has(s.id) && s.player === undefined);
      expect(elsewhere).is.not.undefined;
      const grads = game.automa!.corpStats.ferrusGraduations ?? 0;
      game.addGreenery(bot, elsewhere!);
      runAllActions(game);
      expect(game.automa!.corpStats.ferrusGraduations ?? 0).eq(grads);
    });

    it('a holding never graduates — only the primary corporation hears its own cubes', () => {
      const [game, , bot] = testAutomaGame({}, '-fa-holding'); // C01 seated by default
      const cell = game.board.getAvailableSpacesForGreenery(bot)[0];
      cell.player = bot; // a cube of the bot's, the way a Campus cube is
      game.addGreenery(bot, cell);
      expect(game.automa!.corpStats.ferrusGraduations).is.undefined;
    });
  });

  describe('BC1 FIELD PRACTICE — paid practice on the Campus', () => {
    it('pays 10 M€, a greenery lands on a free Campus space, and its Graduation follows', () => {
      const [game, , bot] = academyGame('-fa-bc1');
      bot.megaCredits = 30;
      const free = freeCampusSpaces(game).length;
      expect(free).to.be.greaterThan(0);
      const tracks = trackSum(game);
      const grads = game.automa!.corpStats.ferrusGraduations ?? 0;
      expect(resolve(game, BC1)).eq('discard');
      runAllActions(game);
      expect(freeCampusSpaces(game).length).eq(free - 1);
      expect(game.automa!.corpStats.fieldPracticeGreeneries).eq(1);
      expect(game.automa!.corpStats.ferrusGraduations).eq(grads + 1);
      expect(trackSum(game)).to.be.greaterThan(tracks);
      expect(game.automa!.corpStats.fieldPracticeTuition).eq(FIELD_PRACTICE_TUITION);
      expect(game.automa!.recurringBonusCards).contains(BC1);
      expect(game.automa!.bonusDiscard).not.contains(BC1);
    });

    it('cannot pay the tuition → nothing at all (no tile, no Graduation, no Failed Action)', () => {
      const [game, , bot] = academyGame('-fa-poor');
      bot.megaCredits = FIELD_PRACTICE_TUITION - 1;
      const free = freeCampusSpaces(game).length;
      const failed = game.automa!.failedActions;
      resolve(game, BC1);
      expect(bot.megaCredits).eq(FIELD_PRACTICE_TUITION - 1);
      expect(freeCampusSpaces(game).length).eq(free);
      expect(game.automa!.failedActions).eq(failed);
      expect(game.automa!.corpStats.fieldPracticeGreeneries).is.undefined;
    });

    it('a full Campus → the tuition still buys a Graduation', () => {
      const [game, , bot] = academyGame('-fa-full');
      for (const cell of freeCampusSpaces(game)) {
        cell.player = undefined; // the Campus has been built over (the cubes gone with their cells)
      }
      bot.megaCredits = 20;
      const grads = game.automa!.corpStats.ferrusGraduations ?? 0;
      resolve(game, BC1);
      expect(bot.megaCredits).eq(20 - FIELD_PRACTICE_TUITION);
      expect(game.automa!.corpStats.ferrusGraduations).eq(grads + 1);
      expect(game.automa!.corpStats.fieldPracticeGreeneries).is.undefined;
    });

    it('recurs: every generation\'s deck deals it, once', () => {
      const [game] = academyGame('-fa-recur');
      AutomaResearch.finishActionDeck(game, []);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BC1)).has.length(1);
      AutomaCorporations.corpFor(CF1).beforeActionPhase!(game);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BC1)).has.length(1);
    });
  });

  describe('the dividend and its goal', () => {
    it('«Alma Mater»: 4 VP per bot tile around its best-surrounded city; the goal counts cards of 20 M€ or more', () => {
      const [game, , bot] = academyGame('-fa-div');
      const r = marsBotDividendInfo(CF1).rates;
      const academy = academyOf(game, bot);
      const around = game.board.getAdjacentSpaces(academy).filter((s) => s.tile !== undefined && s.player?.id === bot.id).length;
      const corp = AutomaCorporations.corpFor(CF1);
      expect(corp.dividend(game).terms[0].count).to.be.at.least(around);
      expect(corp.dividend(game).terms[0].vp).eq(corp.dividend(game).terms[0].count * r.each);
      const before = corp.goal(game);
      game.automa!.playedPile.push(CardName.SPACE_ELEVATOR); // 27 M€
      expect(corp.goal(game)).eq(before + 1);
    });
  });

  describe('save / load', () => {
    it('the Campus is board state: it survives a round trip', () => {
      const [game] = academyGame('-fa-save');
      const before = freeCampusSpaces(game).map((s) => s.id).sort();
      const copy = Game.deserialize(game.serialize());
      expect(freeCampusSpaces(copy).map((s) => s.id).sort()).deep.eq(before);
      expect(copy.automa!.corporation).eq(CF1);
      expect(copy.automa!.recurringBonusCards).contains(BC1);
    });
  });
});
