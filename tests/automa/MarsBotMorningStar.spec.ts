import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MARSBOT_SILVER_CUBE_MC, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B26 = BonusCardId.B26_VENUSIAN_LOBBY;
const LOBBYISTS = [BonusCardId.B06_LOBBYISTS, BonusCardId.B15_LOBBYISTS_VENUS];
/** The printed cube run — #10 is deliberately BARE. */
const CUBES = [5, 6, 7, 8, 9, 11, 12];

/** A live Morning Star game. Venus is on, or the corporation could not be seated. */
function morningGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C27_MORNING_STAR): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/** Park the Venus track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[VENUS_TRACK_INDEX].position = position - 1;
}

describe('MarsBot Morning Star Inc. (C27) + B26 Venusian Lobby', () => {
  describe('the printed card', () => {
    it('prints TWO Venus tags, no priority, a Venus module condition and owns B26', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C27_MORNING_STAR);
      expect(info.original).eq(CardName.MORNING_STAR_INC);
      expect(info.cardNumber).eq('C27');
      expect(info.startingTags, 'two of them — the corner shows V V').deep.eq([Tag.VENUS, Tag.VENUS]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.requiresModules).deep.eq(['venus']);
      expect(info.requiresAnyModule, 'this one is an AND of exactly one module').is.undefined;
      expect(info.corpBonusCards).deep.eq([B26]);
      expect(corpOwningBonusCard(B26)?.id).eq(MarsBotCorpId.C27_MORNING_STAR);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('the cube run SKIPS #10 — it is a list, not «from #5 on»', () => {
      const cubes = marsBotCorpInfo(MarsBotCorpId.C27_MORNING_STAR).trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.VENUS && c.cubeType === 'credit')).is.true;
      expect(cubes.map((c) => c.position)).deep.eq(CUBES);
      expect(cubes.map((c) => c.position), 'the printed gap').not.contains(10);
    });

    it('states the effect in EXACTLY the words C13 uses — one rule, one phrasing', () => {
      const morning = marsBotCorpInfo(MarsBotCorpId.C27_MORNING_STAR);
      const cheung = marsBotCorpInfo(MarsBotCorpId.C13_CHEUNG_SHING_MARS);
      const effectOf = (info: typeof morning) =>
        info.sections.find((s) => s.kind === 'effect')!.lines.map((l) => l.text);
      expect(effectOf(morning)).deep.eq(effectOf(cheung));
      expect(morning.cubeLegend).deep.eq(cheung.cubeLegend);
    });
  });

  describe('the SETUP box', () => {
    it('destroys Lobbyists — whichever printing this game carries', () => {
      const [game] = morningGame('-ms-lobby');
      const destroyed = game.automa!.destroyedBonusCards;
      expect(LOBBYISTS.some((id) => destroyed.includes(id)), 'one of the two variants went').is.true;
      for (const id of LOBBYISTS) {
        expect(bonusDeckIds(game)).not.contains(id);
        expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === id)).is.empty;
      }
    });

    it('shuffles its own B26 into the bonus deck — one copy, never recurring', () => {
      const [game] = morningGame('-ms-b26');
      expect(bonusDeckIds(game).filter((id) => id === B26)).has.length(1);
      expect(game.automa!.recurringBonusCards).not.contains(B26);
    });

    it('seeds seven silver cubes on the Venus track and nothing anywhere else', () => {
      const [game] = morningGame('-ms-cubes');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(CUBES.length);
      expect(cubes.every((c) => c.trackIndex === VENUS_TRACK_INDEX)).is.true;
      expect(cubes.map((c) => c.position).sort((a, b) => a - b)).deep.eq(CUBES);
    });

    it('its two Venus tags open the game two spaces up its own track', () => {
      const [game] = morningGame('-ms-tags');
      expect(game.automa!.board.tracks[VENUS_TRACK_INDEX].position,
        'and still short of the first cube at #5').is.at.least(2);
    });

    it('another corporation destroys nothing and seeds no cubes', () => {
      const [game] = morningGame('-ms-other', MarsBotCorpId.C01_CREDICOR);
      expect(bonusDeckIds(game)).not.contains(B26);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT — a silver cube is 5 M€', () => {
    it('reaching one pays the bot', () => {
      const [game, , bot] = morningGame('-ms-cube-pay');
      const before = bot.megaCredits;
      armCube(game, 6); // Venus #6 prints nothing of its own.

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(bot.megaCredits).is.at.least(before + MARSBOT_SILVER_CUBE_MC);
      expect(stat(game, 'morningCubesHit')).eq(1);
      expect(stat(game, 'morningMc')).eq(MARSBOT_SILVER_CUBE_MC);
    });

    it('the BARE #10 pays nothing', () => {
      const [game] = morningGame('-ms-bare');
      armCube(game, 10);

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(stat(game, 'morningCubesHit'), '#10 carries no cube').eq(0);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = morningGame('-ms-spent');
      armCube(game, 6);
      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);
      const hits = stat(game, 'morningCubesHit');

      game.automa!.board.tracks[VENUS_TRACK_INDEX].regress();
      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(stat(game, 'morningCubesHit')).eq(hits);
    });

    it('another corporation on the Venus track collects nothing', () => {
      const [game, , bot] = morningGame('-ms-cube-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      armCube(game, 6);

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['morningCubesHit']).is.undefined;
    });
  });

  describe('B26 Venusian Lobby', () => {
    it('raises Venus AND advances the Venus track', () => {
      const [game] = morningGame('-ms-lobby-run');
      game.automa!.board.tracks[VENUS_TRACK_INDEX].position = 0;
      const venus = game.getVenusScaleLevel();

      resolveBonusCard(game, B26);

      expect(game.getVenusScaleLevel(), 'the global parameter moved').is.greaterThan(venus);
      expect(game.automa!.board.tracks[VENUS_TRACK_INDEX].position, 'and so did its track').is.at.least(1);
      expect(stat(game, 'lobbyPlayed')).eq(1);
      expect(stat(game, 'lobbyVenus')).eq(1);
    });

    it('then pushes the furthest Martian parameter — the shared rule', () => {
      const [game] = morningGame('-ms-lobby-mars');
      const oxygen = game.getOxygenLevel();
      const oceans = game.board.getOceanSpaces().length;
      const temperature = game.getTemperature();

      resolveBonusCard(game, B26);

      const moved = game.getOxygenLevel() > oxygen ||
        game.board.getOceanSpaces().length > oceans ||
        game.getTemperature() > temperature;
      expect(moved, 'exactly one Martian parameter advanced').is.true;
      expect(stat(game, 'lobbyParameter')).eq(1);
    });

    it('the two sentences are INDEPENDENT — a maxed Venus does not stop Mars', () => {
      const [game, , bot] = morningGame('-ms-lobby-maxed');
      // Venus complete: its half becomes a Failed Action, and the card says
      // «then» — not «otherwise».
      while (game.getVenusScaleLevel() < 30) {
        game.increaseVenusScaleLevel(bot, 1);
      }
      const oxygen = game.getOxygenLevel();
      const oceans = game.board.getOceanSpaces().length;
      const temperature = game.getTemperature();

      resolveBonusCard(game, B26);

      const moved = game.getOxygenLevel() > oxygen ||
        game.board.getOceanSpaces().length > oceans ||
        game.getTemperature() > temperature;
      expect(moved, 'the Martian half ran anyway').is.true;
    });

    it('the loop closes: its own track advance can land on its own cube', () => {
      const [game, , bot] = morningGame('-ms-loop');
      armCube(game, 6); // The lobby's track advance lands on the cube at #6.
      const before = bot.megaCredits;

      resolveBonusCard(game, B26);

      expect(stat(game, 'morningCubesHit'), 'the card paid the corporation its own 5 M€').eq(1);
      expect(bot.megaCredits).is.at.least(before + MARSBOT_SILVER_CUBE_MC);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = morningGame('-ms-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });

    it('another corporation cannot resolve it', () => {
      const [game] = morningGame('-ms-lobby-other', MarsBotCorpId.C01_CREDICOR);
      expect(() => resolveBonusCard(game, B26)).to.throw();
    });
  });

  describe('state', () => {
    it('the cubes, the counters and the deck survive a save/load round trip', () => {
      const [game] = morningGame('-ms-serialize');
      armCube(game, 6);
      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C27_MORNING_STAR);
      expect(restored.automa!.corpStats['morningMc']).eq(MARSBOT_SILVER_CUBE_MC);
      expect(bonusDeckIds(restored).filter((id) => id === B26)).has.length(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent).map((c) => c.position))
        .deep.eq([6]);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = morningGame('-ms-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C27_MORNING_STAR);
    });
  });
});
