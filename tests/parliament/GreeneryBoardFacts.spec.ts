import {expect} from 'chai';
import {testGame} from '../TestGame';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {addGreenery} from '../TestingUtils';

/**
 * THE GREENERY REVISION ON THE BOARD'S OWN EXPLANATIONS (Turmoil Redux): a
 * greenery is 1 TR at placement and NO endgame VP, so neither the placement
 * dossier nor the hover of a standing greenery may promise «+1 VP at game
 * end» — the city-per-adjacent-greenery VP stays (cities still score).
 */
describe('GreeneryBoardFacts', () => {
  it('a Redux placement preview names no greenery VP; a classic one does', () => {
    const [redux, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const land = redux.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0)!;
    const preview = boardCellPreview(player, land, 'greenery');
    const ids = [...preview.futureScoringFacts, ...preview.immediateFacts].map((f) => f.id);
    expect(ids, 'no «place-greenery-self» under Redux').not.include('place-greenery-self');

    const [classic, classicPlayer] = testGame(2);
    const classicLand = classic.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0)!;
    const classicPreview = boardCellPreview(classicPlayer, classicLand, 'greenery');
    expect(classicPreview.futureScoringFacts.map((f) => f.id), 'the classic rule keeps it').include('place-greenery-self');
  });

  it('a standing greenery is not read as scoring under Redux, while an adjacent city still scores it', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined))!;
    addGreenery(player, land.id);
    const info = boardCellInfo(player, land);
    const ids = info.facts.map((f) => f.id);
    expect(ids, 'no «score-greenery» hover fact under Redux').not.include('score-greenery');

    const cityLand = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    const cityPreview = boardCellPreview(player, cityLand, 'city');
    const city = cityPreview.futureScoringFacts.find((f) => f.id === 'place-city');
    expect(city, 'the city scores its adjacent greenery — cities keep their VP').not.undefined;
  });
});
