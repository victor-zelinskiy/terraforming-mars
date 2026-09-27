import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Phase} from '../../src/common/Phase';
import {runAllActions, setOxygenLevel} from '../TestingUtils';
import {Terraformer} from '../../src/server/milestones/Terraformer';
import {computeTerraformRatingBreakdown} from '../../src/server/game/calculateVictoryPoints';
import {buildStandardProjectPreview} from '../../src/server/models/standardProjectPreview';
import {GreeneryStandardProject} from '../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {GREENERY_TILE_TR_SOURCE_NAME, REDUX_GREENERY_TILE_TR} from '../../src/common/parliament/winnerReward';
import {sourceKey} from '../../src/common/events/EventSource';

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
    expect(p1.terraformRatingSources.filter((s) => s.sourceName === GREENERY_TILE_TR_SOURCE_NAME)).has.length(2);
  });

  it('the tiles\' TR is its OWN segment of the breakdown — never inside «Cards & effects»', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
    p1.increaseTerraformRating(1); // an ordinary card/effect TR beside them
    runAllActions(game);
    const b = computeTerraformRatingBreakdown(p1);
    expect(b.greeneries, 'one TR per tile').eq(2);
    expect(b.cards, 'the ordinary TR alone').eq(1);
    expect((b.cardEntries ?? []).some((e) => e.sourceType === 'greenery-tile' || e.sourceName === GREENERY_TILE_TR_SOURCE_NAME),
      'no tile entry leaks into the per-card list').is.false;
    expect((b.baseRating ?? 0) + (b.handicap ?? 0) + b.temperature + b.oxygen + b.oceans + b.venus + b.cards + (b.hazards ?? 0) + (b.greeneries ?? 0))
      .eq(p1.terraformRating);
    // A save written before the segment existed attributed the same rule as
    // `other` under the same stored key — it reads as the tiles', not as cards.
    p1.terraformRatingSources.push({sourceType: 'other', sourceName: GREENERY_TILE_TR_SOURCE_NAME, amount: 1});
    p1.terraformRatingFromCards += 1;
    p1.setTerraformRating(p1.terraformRating + 1);
    const legacy = computeTerraformRatingBreakdown(p1);
    expect(legacy.greeneries).eq(3);
    expect(legacy.cards).eq(1);
  });

  it('without the parliament the segment is 0 and a greenery pays only its oxygen', () => {
    const [classic, c1] = testGame(2);
    classic.phase = Phase.ACTION;
    classic.addGreenery(c1, classic.board.getAvailableSpacesForGreenery(c1)[0]);
    runAllActions(classic);
    const b = computeTerraformRatingBreakdown(c1);
    expect(b.greeneries).eq(0);
    expect(b.oxygen).eq(1);
    expect(b.cards).eq(0);
  });

  it('the standard project «Greenery» promises the tile\'s TR chip under the parliament — and nothing extra without it', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const redux = buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
    const trChip = redux.effects.find((e) => e.icon === 'tr');
    expect(trChip, 'the tile\'s own TR beside the oxygen chip').is.not.undefined;
    expect(trChip).to.deep.include({direction: 'gain', amount: REDUX_GREENERY_TILE_TR, current: p1.terraformRating, resulting: p1.terraformRating + REDUX_GREENERY_TILE_TR});
    expect(redux.effects.some((e) => e.icon === 'oxygen'), 'the oxygen chip stays').is.true;
    // With oxygen maxed the oxygen chip clamps to «no effect» — the tile still promises its TR.
    setOxygenLevel(game, 14);
    const maxed = buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
    expect(maxed.effects.find((e) => e.icon === 'tr')?.amount).eq(REDUX_GREENERY_TILE_TR);

    const [, c1] = testGame(2);
    const classic = buildStandardProjectPreview(c1, new GreeneryStandardProject(), 23);
    expect(classic.effects.some((e) => e.icon === 'tr'), 'classic: the oxygen chip alone').is.false;
  });

  it('the tile\'s TR event is sourced as the NAMED rule — the journal and the cause read «Greenery tile», never the institution', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    game.addGreenery(p1, game.board.getAvailableSpacesForGreenery(p1)[0]);
    runAllActions(game);
    const tileTr = game.events.events.filter((e) => e.type === 'tr-changed' && e.source?.kind === 'parliament');
    expect(tileTr, 'one TR event for the tile').has.length(1);
    expect(tileTr[0].source).deep.eq({kind: 'parliament', rule: 'greenery-tile'});
    expect(sourceKey(tileTr[0].source), 'every tile groups under one engine piece').eq('parliament:greenery-tile');
    expect(sourceKey({kind: 'parliament'}), 'the bare institution keeps its own key').eq('parliament');
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
