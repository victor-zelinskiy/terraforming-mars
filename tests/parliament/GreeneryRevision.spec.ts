import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Phase} from '../../src/common/Phase';
import {runAllActions, setOxygenLevel} from '../TestingUtils';
import {Terraformer} from '../../src/server/milestones/Terraformer';

describe('Turmoil Redux greenery revision', () => {
  it('a greenery pays 1 TR of its own on top of the oxygen — still 1 TR once oxygen is maxed', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const tr = p1.terraformRating;
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
    runAllActions(game);
    expect(p1.terraformRating).eq(tr + 2);
    setOxygenLevel(game, 14);
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
    runAllActions(game);
    expect(p1.terraformRating).eq(tr + 3);
    expect(p1.terraformRatingSources.filter((s) => s.sourceName === 'Greenery tile')).has.length(2);
  });

  it('a final greenery (no oxygen) still pays its 1 TR', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.PRODUCTION;
    const tr = p1.terraformRating;
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0], false);
    runAllActions(game);
    expect(p1.terraformRating).eq(tr + 1);
  });

  it('scores no greenery victory points, keeps city adjacency points, and leaves the classic game untouched', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const city = game.board.getAvailableSpacesOnLand(p1)[0];
    game.addCity(p1, city);
    const adjacent = game.board.getAdjacentSpaces(city).find((s) => game.board.getAvailableSpacesForGreenery(p1).includes(s))!;
    game.addGreenery(p1, adjacent);
    runAllActions(game);
    const vp = p1.getVictoryPoints();
    expect(vp.greenery).eq(0);
    expect(vp.city).eq(1);

    const [classic, c1] = testGame(2);
    classic.phase = Phase.ACTION;
    classic.addGreenery(c1, classic.board.getAvailableSpacesForGreenery(c1)[0]);
    runAllActions(classic);
    expect(c1.getVictoryPoints().greenery).eq(1);
  });

  it('keeps the Terraformer milestone at 35 (decision Q12)', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const terraformer = new Terraformer();
    p1.setTerraformRating(34);
    expect(terraformer.canClaim(p1)).is.false;
    p1.setTerraformRating(35);
    expect(terraformer.canClaim(p1)).is.true;
    expect(game.turmoil).is.undefined;
  });
});
