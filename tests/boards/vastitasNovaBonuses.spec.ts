import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';
import {boardCellInfo} from '../../src/server/boards/BoardInformationEngine';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {cast} from '../../src/common/utils/utils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions, setTemperature} from '../TestingUtils';

/**
 * VASTITAS BOREALIS NOVA — the two printed bonuses the TABLE decides, for a HUMAN: what the commit pays and what the
 * cell's dossier promises, read off the same game.
 *
 *  · the NORTH POLE (TEMPERATURE_4MC): 4 M€ for one temperature step (+1 TR); with the scale full the bonus does
 *    nothing — and the dossier says so instead of promising a step;
 *  · a VIKING site (DELEGATE): under Turmoil Redux the delegate is the Parliament's own grant onto a resolution
 *    (the dossier says «Делегат на резолюцию», or names why it is lost); without any Turmoil the printed rule says
 *    «ignore».
 */
const VASTITAS = {boardName: BoardName.VASTITAS_BOREALIS_NOVA} as const;

function cellWith(game: IGame, bonus: SpaceBonus): Space {
  const space = game.board.spaces.find((s) => s.bonus.includes(bonus) && s.tile === undefined);
  expect(space, `a cell printing ${bonus}`).is.not.undefined;
  return space!;
}

function factIds(player: TestPlayer, space: Space): Array<string> {
  return boardCellInfo(player, space).facts.map((f) => f.id);
}

describe('Vastitas Borealis Nova — the North Pole for a human', () => {
  it('a greenery on the pole charges 4 M€ and raises the temperature 1 step (+1 TR)', () => {
    const [game, player] = testGame(1, VASTITAS) as [IGame, TestPlayer];
    const pole = cellWith(game, SpaceBonus.TEMPERATURE_4MC);
    player.megaCredits = 10;
    const temperature = game.getTemperature();
    const tr = player.terraformRating;
    game.addGreenery(player, pole);
    runAllActions(game);
    const pay = player.popWaitingFor();
    if (pay !== undefined) {
      // A payment prompt only when another currency could pay — M€ alone pays at once.
      cast(pay, SelectPaymentDeferred);
    }
    expect(game.getTemperature(), 'one temperature step').eq(temperature + 2);
    expect(player.megaCredits, '10 − 4').eq(6);
    // Greenery: +1 oxygen step (+1 TR) — the pole: +1 temperature step (+1 TR).
    expect(player.terraformRating).eq(tr + 2);
  });

  it('the dossier names the step (°C, TR) beside the bonus', () => {
    const [game, player] = testGame(1, VASTITAS) as [IGame, TestPlayer];
    const ids = factIds(player, cellWith(game, SpaceBonus.TEMPERATURE_4MC));
    expect(ids).to.include('printed-temperature');
    expect(ids).to.include('printed-temperature-temperature');
    expect(ids).to.include('printed-temperature-tr-temperature');
  });

  it('with the temperature MAXED the bonus does nothing — and the dossier says so instead of promising a step', () => {
    const [game, player] = testGame(1, VASTITAS) as [IGame, TestPlayer];
    setTemperature(game, 8);
    const pole = cellWith(game, SpaceBonus.TEMPERATURE_4MC);
    const ids = factIds(player, pole);
    expect(ids).to.include('printed-temperature-maxed');
    expect(ids).to.not.include('printed-temperature-temperature');
    player.megaCredits = 10;
    game.addGreenery(player, pole);
    runAllActions(game);
    expect(player.megaCredits, 'nothing is charged for a step that cannot happen').eq(10);
  });
});

describe('Vastitas Borealis Nova — a Viking site for a human', () => {
  it('under Turmoil Redux a tile there asks for a resolution — the Parliament\'s own grant, named by the cell', () => {
    const [game, player] = testGame(2, {...VASTITAS, coloniesExtension: true, turmoilReduxExpansion: true}) as [IGame, TestPlayer];
    const viking = cellWith(game, SpaceBonus.DELEGATE);
    const before = game.parliament!.votesOf(player);
    game.addGreenery(player, viking);
    runAllActions(game);
    const prompt = cast(player.popWaitingFor(), SelectParty);
    expect(prompt.choiceContext?.source).deep.include({kind: 'space', space: viking.id});
    prompt.cb(prompt.parties[0]);
    runAllActions(game);
    expect(game.parliament!.votesOf(player), 'the delegate stands on the chosen resolution').eq(before + 1);
  });

  it('the dossier promises a delegate onto a resolution, with the delegate chip', () => {
    const [game, player] = testGame(2, {...VASTITAS, coloniesExtension: true, turmoilReduxExpansion: true}) as [IGame, TestPlayer];
    const fact = boardCellInfo(player, cellWith(game, SpaceBonus.DELEGATE)).facts.find((f) => f.id === 'printed-delegate');
    expect(fact?.title).eq('Add a delegate to a resolution');
    expect(fact?.delta).deep.include({icon: 'delegate', amount: 1, direction: 'gain'});
  });

  it('an EMPTY reserve: the dossier names the loss, and the tile asks nothing', () => {
    const [game, player] = testGame(2, {...VASTITAS, coloniesExtension: true, turmoilReduxExpansion: true}) as [IGame, TestPlayer];
    const parliament = game.parliament!;
    while (parliament.reserve(player) > 0) {
      parliament.placeVote(player, parliament.slots[0], 'reserve');
    }
    const viking = cellWith(game, SpaceBonus.DELEGATE);
    const fact = boardCellInfo(player, viking).facts.find((f) => f.id === 'printed-delegate-skipped');
    expect(fact?.description).eq('No delegate in your reserve');
    game.addGreenery(player, viking);
    runAllActions(game);
    expect(player.popWaitingFor()).is.undefined;
  });

  it('without any Turmoil the bonus is ignored — and the dossier says so', () => {
    const [game, player] = testGame(1, VASTITAS) as [IGame, TestPlayer];
    const viking = cellWith(game, SpaceBonus.DELEGATE);
    expect(factIds(player, viking)).to.include('printed-delegate-ignored');
    game.addGreenery(player, viking);
    runAllActions(game);
    expect(player.popWaitingFor()).is.undefined;
    expect(viking.tile?.tileType).eq(TileType.GREENERY);
  });
});

describe('a printed bonus that CANNOT happen costs nothing to stand on (legality = the commit)', () => {
  it('the North Pole with the temperature maxed is LEGAL for a player without 4 M€', () => {
    const [game, player] = testGame(1, VASTITAS) as [IGame, TestPlayer];
    const pole = cellWith(game, SpaceBonus.TEMPERATURE_4MC);
    player.megaCredits = 0;
    expect(game.board.getAvailableSpacesForGreenery(player), 'cold: the 4 M€ are owed').to.not.include(pole);
    setTemperature(game, 8);
    expect(game.board.getAvailableSpacesForGreenery(player), 'maxed: nothing is owed').to.include(pole);
  });

  it('Hellas\' South Pole with every ocean down is LEGAL for a player without 6 M€', () => {
    const [game, player] = testGame(1, {boardName: BoardName.HELLAS}) as [IGame, TestPlayer];
    const pole = cellWith(game, SpaceBonus.OCEAN);
    player.megaCredits = 0;
    expect(game.board.getAvailableSpacesForGreenery(player), 'oceans left: the 6 M€ are owed').to.not.include(pole);
    for (const space of game.board.getAvailableSpacesForOcean(player).slice(0, 9)) {
      if (game.canAddOcean()) {
        game.simpleAddTile(player, space, {tileType: TileType.OCEAN});
      }
    }
    expect(game.canAddOcean()).is.false;
    expect(game.board.getAvailableSpacesForGreenery(player), 'all nine down: nothing is owed').to.include(pole);
  });
});
