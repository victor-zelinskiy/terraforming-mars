import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {SeededRandom} from '../../src/common/utils/Random';
import {GameSetup} from '../../src/server/GameSetup';
import {IGame} from '../../src/server/IGame';
import {Board} from '../../src/server/boards/Board';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botCoveredIconMegacredits, botRewardIcons, isHellasSouthPole, isMslCuriosity, isVastitasNorthPole, vikingDelegateCount} from '../../src/server/automa/AutomaPlacementBonus';
import {MARSBOT_BOARDS} from '../../src/server/automa/boards/MarsBotMapProfile';
import {testAutomaGame} from './AutomaTestGame';

/**
 * «RANDOM TILE PLACEMENT» (`shuffleMapOption`) + MarsBot — supported since 2026-11-07 (the owner's question; the old
 * conflict «MarsBot tile placement uses the printed board» was a leftover of the UI rework's caution). The shuffle moves
 * the cells' TYPES and printed BONUSES and keeps the ids, the coordinates, the volcanoes and every `doNotShuffleLastSpace`
 * cell (Noctis, Hellas' South Pole, Curiosity, the North Pole). The bot never reads a printed layout: its candidates are
 * the board's live `getAvailableSpaces…`, its reward icons the cell's live `bonus`, its pay-to-use cells found by their
 * BONUS, its regions geometric. Proven here on every board the bot covers, with Venus + Colonies on.
 */
const SEED = 0.29;

function shuffledGame(boardName: BoardName, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({boardName, shuffleMapOption: true, venusNextExtension: true, coloniesExtension: true, seed: SEED}, `-shuffled-${boardName}${suffix}`);
}

/** How many cells carry a different bonus row or type than the printed board prints at that id. */
function movedCells(game: IGame): number {
  const printed = GameSetup.newBoard({...game.gameOptions, shuffleMapOption: false}, new SeededRandom(1));
  return game.board.spaces.filter((space) => {
    const p = printed.getSpaceOrThrow(space.id);
    return p.bonus.join(',') !== space.bonus.join(',') || p.spaceType !== space.spaceType;
  }).length;
}

describe('MarsBot on a SHUFFLED map — every board the bot covers', () => {
  for (const boardName of MARSBOT_BOARDS) {
    describe(boardName, () => {
      it('the shuffle took (bonuses lie elsewhere than printed) and the bot is seated', () => {
        const [game] = shuffledGame(boardName);
        expect(game.gameOptions.shuffleMapOption).is.true;
        expect(game.automa).is.not.undefined;
        expect(movedCells(game), 'cells whose bonus or type moved').is.greaterThan(10);
      });

      it('places a city, a greenery and an ocean — each on a cell the LIVE board offered', () => {
        const [game, , bot] = shuffledGame(boardName, '-tiles');
        const cities = game.board.getAvailableSpacesForCity(bot);
        expect(AutomaTilePlacer.placeCity(game)).is.true;
        const city = game.board.spaces.find((s) => s.player === bot && s.tile?.tileType === TileType.CITY)!;
        expect(city, 'a city stands').is.not.undefined;
        expect(cities, 'on a cell the board offered for a city').to.include(city);

        const greeneries = game.board.getAvailableSpacesForGreenery(bot);
        expect(AutomaTilePlacer.placeGreenery(game)).is.true;
        const greenery = game.board.spaces.find((s) => s.player === bot && s.tile?.tileType === TileType.GREENERY)!;
        expect(greenery, 'a greenery stands').is.not.undefined;
        expect(greeneries, 'on a cell the board offered for a greenery').to.include(greenery);

        const oceans = game.board.getAvailableSpacesForOcean(bot);
        AutomaTilePlacer.placeOcean(game);
        const ocean = game.board.spaces.find((s) => Board.isOceanSpace(s))!;
        expect(ocean, 'an ocean stands').is.not.undefined;
        expect(oceans, 'on an ocean cell of the SHUFFLED board').to.include(ocean);
      });

      it('resolves 30 track advances with Venus + Colonies without a dead end', () => {
        const [game] = shuffledGame(boardName, '-runs');
        const tracks = game.automa!.board.tracks.length;
        for (let i = 0; i < 30; i++) {
          expect(() => AutomaResolver.advanceTrack(game, i % tracks)).does.not.throw();
        }
        expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
      });
    });
  }
});

describe('MarsBot on a SHUFFLED map — the special cells are found where they LIE', () => {
  it('Tharsis: the tiebreakers read the live cell — the richer of two inland cells wins', () => {
    const [game, , bot] = shuffledGame(BoardName.THARSIS, '-tiebreak');
    const inland = (s: {id: string}) => !game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(s.id as never)).some(Board.isOceanSpace);
    const bare = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.bonus.length === 0 && inland(s) && s.id !== SpaceName.NOCTIS_CITY)!;
    const rich = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.bonus.length >= 2 && inland(s) && s.id !== SpaceName.NOCTIS_CITY)!;
    expect(bare, 'a bare inland cell').is.not.undefined;
    expect(rich, 'a rich inland cell').is.not.undefined;
    expect(botRewardIcons(game, bot, rich)).eq(rich.bonus.length);
    expect(AutomaTilePlacer.breakTie(game, [bare, rich])).eq(rich);
  });

  it('Hellas: the South Pole stays at its id, the one pay-to-use ocean cell', () => {
    const [game] = shuffledGame(BoardName.HELLAS, '-pole');
    const poles = game.board.spaces.filter((s) => isHellasSouthPole(game, s));
    expect(poles.map((s) => s.id)).deep.eq([SpaceName.HELLAS_OCEAN_TILE]);
  });

  it('Terra Cimmeria Nova: exactly one MSL Curiosity cell, found by its colony icon', () => {
    const [game] = shuffledGame(BoardName.TERRA_CIMMERIA_NOVA, '-curiosity');
    expect(game.board.spaces.filter(isMslCuriosity)).has.length(1);
  });

  it('Vastitas Borealis Nova: one North Pole by its icon; the two Viking sites by their delegate icons, wherever they moved', () => {
    const [game, , bot] = shuffledGame(BoardName.VASTITAS_BOREALIS_NOVA, '-vikings');
    expect(game.board.spaces.filter(isVastitasNorthPole)).has.length(1);
    const vikings = game.board.spaces.filter((s) => vikingDelegateCount(s) > 0);
    expect(vikings).has.length(2);
    for (const viking of vikings) {
      expect(botRewardIcons(game, bot, viking), 'no Parliament: considered empty').eq(0);
      expect(botCoveredIconMegacredits(game, viking)).eq(0);
    }
  });

  it('Amazonis Planitia: three standard-resource cells and four delegate icons, counted where they lie', () => {
    const [game, , bot] = shuffledGame(BoardName.AMAZONIS_PLANITIA, '-cells');
    const standard = game.board.spaces.filter((s) => s.bonus.includes(SpaceBonus.STANDARD_RESOURCE));
    expect(standard).has.length(3);
    for (const cell of standard) {
      expect(botRewardIcons(game, bot, cell), cell.id).eq(cell.bonus.length);
      expect(botCoveredIconMegacredits(game, cell), cell.id).eq(cell.bonus.length);
    }
    expect(game.board.spaces.reduce((n, s) => n + vikingDelegateCount(s), 0)).eq(4);
    expect(game.board.spaces.filter((s) => s.volcanic === true), 'the volcanoes stay').has.length(5);
  });
});
