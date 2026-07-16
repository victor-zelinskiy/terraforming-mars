import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {groupFactsByRecipient, BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {AresHandler} from '../../src/server/ares/AresHandler';
import {Athena} from '../../src/server/cards/community/Athena';
import {Phase} from '../../src/common/Phase';

describe('BoardInformationEngine', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function emptyLand(predicate: (s: Space) => boolean): Space {
    const space = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching empty land space');
    }
    return space;
  }

  function allFacts(preview: ReturnType<typeof boardCellPreview>): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ];
  }

  it('ocean adjacency: one adjacent ocean grants +2 M€ to the current player', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player, ocean);

    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(fact, 'ocean-adjacency fact').to.not.be.undefined;
    expect(fact!.recipient.kind).to.eq('current-player');
    expect(fact!.delta?.amount).to.eq(2);
    expect(fact!.delta?.direction).to.eq('gain');
  });

  it('ocean adjacency: two adjacent oceans grant +4 M€', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length >= 2);
    const oceans = game.board.getAdjacentSpaces(land).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).slice(0, 2);
    oceans.forEach((o) => game.addOcean(player, o));

    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(fact?.delta?.amount).to.eq(4);
  });

  it('printed bonus: surfaces the cell bonus as a current-player gain', () => {
    const land = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'printed-placement-bonus' && f.delta?.icon === 'plants');
    expect(fact, 'plant printed-bonus fact').to.not.be.undefined;
    expect(fact!.delta?.direction).to.eq('gain');
  });

  it('covering an existing tile suppresses printed bonuses with an explanatory rule', () => {
    const land = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    game.addGreenery(player, land);

    const preview = boardCellPreview(player, land, 'greenery');
    expect(preview.legal, 'occupied cell is not legal').to.be.false;
    expect(preview.illegalReason).to.eq('occupied');
    expect(preview.ruleFacts.some((f) => f.id === 'cover-no-bonus')).to.be.true;
    expect(preview.immediateFacts.some((f) => f.category === 'printed-placement-bonus')).to.be.false;
  });

  it('greenery next to an OPPONENT city scores endgame VP for the OPPONENT', () => {
    const cityCandidates = game.board.getAvailableSpacesForCity(player2);
    const city = cityCandidates[0];
    game.addCity(player2, city);
    const target = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;

    const preview = boardCellPreview(player, target, 'greenery');
    const oppFact = preview.recipientFacts.find((f) =>
      f.category === 'city-greenery-scoring' && f.recipient.kind === 'tile-owner');
    expect(oppFact, 'opponent tile-owner scoring fact').to.not.be.undefined;
    expect((oppFact!.recipient as {color: string}).color).to.eq(player2.color);
    expect(oppFact!.timing).to.eq('endgame');
    expect(oppFact!.vp).to.deep.eq({from: 0, to: 1});
  });

  it('greenery next to YOUR OWN city scores for you (no opponent recipient)', () => {
    const city = game.board.getAvailableSpacesForCity(player)[0];
    game.addCity(player, city);
    const target = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;

    const preview = boardCellPreview(player, target, 'greenery');
    expect(preview.recipientFacts.length, 'no opponent recipients').to.eq(0);
    expect(preview.futureScoringFacts.some((f) => f.recipient.kind === 'current-player')).to.be.true;
  });

  it('city placement previews future greenery scoring for the current player', () => {
    const city = game.board.getAvailableSpacesForCity(player)[0];
    const preview = boardCellPreview(player, city, 'city');
    const fact = preview.futureScoringFacts.find((f) => f.id === 'place-city');
    expect(fact, 'city scoring fact').to.not.be.undefined;
    expect(fact!.recipient.kind).to.eq('current-player');
  });

  it('surfaces the Hellas special ocean placement cost (6 M€)', () => {
    const [hellasGame, hellasPlayer] = testGame(2, {boardName: BoardName.HELLAS});
    const space = hellasGame.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const preview = boardCellPreview(hellasPlayer, space, 'land');
    const cost = preview.costFacts.find((f) => f.delta?.icon === 'megacredits');
    expect(cost, 'placement cost fact').to.not.be.undefined;
    expect(cost!.delta?.amount).to.eq(6);
    expect(cost!.delta?.direction).to.eq('cost');
  });

  it('hover info reports the cell status and standing rules', () => {
    const noctis = game.board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);
    const info = boardCellInfo(player, noctis);
    expect(info.status.reserved).to.eq('noctis');
    expect(info.status.header).to.eq('Reserved area');
    expect(info.facts.some((f) => f.category === 'reserved-area')).to.be.true;
  });

  it('remove-and-replace city preview (cleared) grants the cell bonus + is legal', () => {
    const land = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    land.tile = {tileType: TileType.GREENERY};
    land.player = player;

    // Without `cleared`: placing over the existing greenery reads as a covering
    // placement → "No placement bonus" + the occupied cell is illegal for a city.
    const covering = boardCellPreview(player, land, 'city');
    expect(covering.legal, 'covering placement is illegal').to.be.false;
    expect(allFacts(covering).some((f) => f.id === 'cover-no-bonus'), 'covering → "no bonus" fact').to.be.true;
    expect(allFacts(covering).some((f) => f.category === 'printed-placement-bonus'), 'covering → no printed bonus').to.be.false;

    // With `cleared` (KaguyaTech): the greenery is removed first → grant the cell
    // bonus "as usual", shown as a legal placement (it bypasses placement rules).
    const cleared = boardCellPreview(player, land, 'city', {cleared: true});
    expect(cleared.legal, 'cleared placement is legal').to.be.true;
    expect(cleared.illegalReason, 'no illegal reason when cleared').to.be.undefined;
    expect(allFacts(cleared).some((f) => f.id === 'cover-no-bonus'), 'cleared drops the "no bonus" fact').to.be.false;
    const bonus = allFacts(cleared).find((f) => f.category === 'printed-placement-bonus');
    expect(bonus, 'cleared → the cell bonus is shown').to.not.be.undefined;
    expect(bonus!.delta?.icon).to.eq('plants');
    // The placed city scores for adjacent greeneries at game end.
    expect(allFacts(cleared).some((f) => f.id === 'place-city'), 'city scoring fact present').to.be.true;
  });

  it('over-ocean overlay preview: ocean kept (no re-granted bonus) + city VP only when the tile counts as a city', () => {
    const ocean = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined))!;
    ocean.tile = {tileType: TileType.OCEAN};
    const adj = game.board.getAdjacentSpaces(ocean).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    adj.tile = {tileType: TileType.GREENERY};
    adj.player = player;

    // The ocean is NOT removed (overlay, tile.covers) → covering → no re-granted bonus.
    const newHolland = boardCellPreview(player, ocean, 'upgradeable-ocean-new-holland', {tileType: TileType.NEW_HOLLAND});
    expect(allFacts(newHolland).some((f) => f.id === 'cover-no-bonus'), 'overlay keeps the ocean → no re-granted bonus').to.be.true;
    // New Holland counts as a CITY → +VP per adjacent greenery shown.
    expect(allFacts(newHolland).some((f) => f.id === 'place-city'), 'New Holland city VP shown').to.be.true;

    // Ocean City shares the `upgradeable-ocean` kind but ALSO counts as a city.
    const oceanCity = boardCellPreview(player, ocean, 'upgradeable-ocean', {tileType: TileType.OCEAN_CITY});
    expect(allFacts(oceanCity).some((f) => f.id === 'place-city'), 'Ocean City city VP shown').to.be.true;

    // Ocean Farm shares the SAME kind but does NOT count as a city → no city VP.
    const oceanFarm = boardCellPreview(player, ocean, 'upgradeable-ocean', {tileType: TileType.OCEAN_FARM});
    expect(allFacts(oceanFarm).some((f) => f.id === 'place-city'), 'Ocean Farm shows no city VP').to.be.false;

    // No tile type given → the kind alone can't decide → no composite city VP.
    const noTile = boardCellPreview(player, ocean, 'upgradeable-ocean-new-holland');
    expect(allFacts(noTile).some((f) => f.id === 'place-city'), 'without tileType → no composite city VP').to.be.false;
  });

  it('volcanic placement rule shows on an EMPTY volcanic cell, suppressed once a tile covers it', () => {
    const volcanic = game.board.getSpaceOrThrow(game.board.volcanicSpaceIds[0]);
    expect(volcanic.tile, 'precondition: empty volcanic cell').to.be.undefined;
    expect(boardCellInfo(player, volcanic).facts.some((f) => f.id === 'volcanic'),
      'empty volcanic cell shows the placement rule').to.be.true;

    // Cover it with a tile — the "only volcanic cards can place here" rule is now stale.
    volcanic.tile = {tileType: TileType.GREENERY};
    volcanic.player = player;
    expect(boardCellInfo(player, volcanic).facts.some((f) => f.id === 'volcanic'),
      'occupied volcanic cell hides the stale placement rule').to.be.false;
  });

  it('volcanic rule still shows in the placement preview (you are deciding to place here)', () => {
    const volcanic = game.board.getSpaceOrThrow(game.board.volcanicSpaceIds[0]);
    expect(allFacts(boardCellPreview(player, volcanic, 'greenery')).some((f) => f.id === 'volcanic'),
      'placement preview keeps the volcanic rule').to.be.true;
  });

  it('reserved-area rule is suppressed once the reserved cell is occupied', () => {
    const noctis = game.board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);
    expect(boardCellInfo(player, noctis).facts.some((f) => f.category === 'reserved-area'),
      'empty reserved cell shows the rule').to.be.true;

    noctis.tile = {tileType: TileType.CITY, card: CardName.NOCTIS_CITY};
    noctis.player = player;
    expect(boardCellInfo(player, noctis).facts.some((f) => f.category === 'reserved-area'),
      'occupied reserved cell hides the stale rule').to.be.false;
  });

  it('every cell gets a header — empty land, land-with-bonus, ocean reserve', () => {
    const plain = emptyLand((s) => s.bonus.length === 0);
    expect(boardCellInfo(player, plain).status.header).to.eq('Empty land');
    expect(boardCellInfo(player, plain).description).to.eq('A tile can be placed here when an action allows it.');

    const withBonus = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    expect(boardCellInfo(player, withBonus).status.header).to.eq('Land with a bonus');

    const oceanReserve = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
    const info = boardCellInfo(player, oceanReserve);
    expect(info.status.header).to.eq('Ocean area');
    expect(info.description).to.eq('Only an ocean tile can be placed here.');
  });

  it('hovering an ocean tile explains it is an adjacency source', () => {
    const oceanSpace = game.board.getAvailableSpacesForOcean(player)[0];
    game.addOcean(player, oceanSpace);
    const info = boardCellInfo(player, oceanSpace);
    expect(info.status.header).to.eq('Ocean');
    expect(info.description).to.eq('This cell is occupied by an ocean.');
    const rule = info.facts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(rule, 'ocean adjacency rule fact').to.not.be.undefined;
    expect(rule!.delta?.amount).to.eq(player.oceanBonus);
  });

  it('special tile hover shows the source card name', () => {
    const space = emptyLand(() => true);
    space.tile = {tileType: TileType.COMMERCIAL_DISTRICT, card: CardName.COMMERCIAL_DISTRICT};
    space.player = player;
    const info = boardCellInfo(player, space);
    expect(info.status.content).to.eq('special-tile');
    expect(info.status.special).to.be.true;
    expect(info.status.header).to.eq('Special tile');
    expect(info.status.tileLabel).to.eq(CardName.COMMERCIAL_DISTRICT);
    expect(info.status.countsAs).to.deep.eq([]);
  });

  it('Neural Instance (MarsBot) hover explains its unoccupied-neighbour scoring', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).length === 6);
    land.tile = {tileType: TileType.NEURAL_INSTANCE, card: undefined};
    land.player = player2; // placed by the bot
    const expected = game.board.getAdjacentSpaces(land)
      .filter((adj) => adj.tile === undefined || adj.player?.color === player2.color).length;

    const info = boardCellInfo(player, land);
    expect(info.status.special).to.be.true;
    expect(info.status.tileLabel).to.eq('Neural Instance');
    const nf = info.facts.find((f) => f.id === 'score-neural-instance');
    expect(nf, 'neural-instance scoring fact').to.not.be.undefined;
    expect(nf!.category).to.eq('future-scoring');
    expect(nf!.vp).to.deep.eq({from: 0, to: expected});
    // Scores for the bot (an opponent from the viewer's seat), not the viewer.
    expect(nf!.recipient.kind).to.not.eq('current-player');
  });

  it('a SPECIAL CITY (Capital) never degrades to "City" — name + own ocean scoring', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player, ocean);
    land.tile = {tileType: TileType.CAPITAL, card: CardName.CAPITAL};
    land.player = player;

    const info = boardCellInfo(player, land);
    expect(info.status.special, 'is special').to.be.true;
    expect(info.status.content, 'counts as a city').to.eq('city');
    expect(info.status.countsAs).to.include('city');
    expect(info.status.header).to.eq('Special city');
    expect(info.status.tileLabel).to.eq(CardName.CAPITAL);

    const cap = info.facts.find((f) => f.id === 'score-capital');
    expect(cap, 'capital ocean-scoring fact').to.not.be.undefined;
    expect(cap!.category).to.eq('future-scoring');
    expect(cap!.vp).to.deep.eq({from: 0, to: 1});
    // the ordinary city-greenery scoring is shown SEPARATELY (own row), not merged.
    expect(info.facts.some((f) => f.id === 'score-city'), 'separate city scoring').to.be.true;
  });

  it('a composite tile (New Holland) ON the Mars grid keeps countsAs AND real scoring', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.LAND && a.tile === undefined));
    const adj = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.addGreenery(player, adj);
    land.tile = {tileType: TileType.NEW_HOLLAND, card: CardName.NEW_HOLLAND};
    land.player = player;

    const info = boardCellInfo(player, land);
    expect(info.status.special).to.be.true;
    expect(info.status.external, 'on the Mars grid').to.not.be.true;
    expect(info.status.header).to.eq('Special city');
    expect(info.status.countsAs).to.have.members(['city', 'ocean']);
    // On-grid → REAL city-greenery scoring is shown (NOT suppressed); no external note.
    expect(info.facts.some((f) => f.id === 'score-city'), 'city scoring present on-grid').to.be.true;
    expect(info.facts.some((f) => f.category === 'external-area'), 'no external note on-grid').to.be.false;
  });

  it('an OFF-Mars city (no Mars adjacency) shows NO false city-greenery scoring', () => {
    const offMars = game.board.spaces.find((s) => s.spaceType === SpaceType.COLONY);
    expect(offMars, 'off-Mars colony space exists').to.not.be.undefined;
    expect(game.board.getAdjacentSpaces(offMars!).length, 'off-grid: no adjacency').to.eq(0);
    // Maxwell Base / Ganymede Colony place an ordinary CITY tile OFF the grid.
    offMars!.tile = {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY};
    offMars!.player = player;

    const info = boardCellInfo(player, offMars!);
    expect(info.status.external, 'flagged external').to.be.true;
    expect(info.status.special, 'an external city is special, not ordinary').to.be.true;
    expect(info.status.content).to.eq('city');
    expect(info.status.countsAs).to.include('city');
    expect(info.status.tileLabel).to.eq(CardName.GANYMEDE_COLONY);
    // countsAs a city, but NO false Mars city-greenery scoring...
    expect(info.facts.some((f) => f.category === 'city-greenery-scoring'), 'no false city scoring').to.be.false;
    // ...instead an honest "external area" note.
    expect(info.facts.some((f) => f.category === 'external-area'), 'external-area note').to.be.true;
  });

  it('city placement with no adjacent greeneries shows a count line, NOT a +0 VP badge', () => {
    const city = game.board.getAvailableSpacesForCity(player)
      .find((s) => game.board.getAdjacentSpaces(s).filter((a) => a.tile?.tileType === TileType.GREENERY).length === 0)!;
    const preview = boardCellPreview(player, city, 'city');
    const fact = preview.futureScoringFacts.find((f) => f.id === 'place-city');
    expect(fact, 'place-city fact').to.not.be.undefined;
    expect(fact!.vp, 'no vp badge for 0 greeneries').to.be.undefined;
    expect(fact!.description).to.not.be.undefined;
  });

  it('is read-only: deriving facts mutates no game state', () => {
    const before = JSON.stringify(game.board.serialize());
    const mc = player.megaCredits;
    const deferred = game.deferredActions.length;

    for (const space of game.board.spaces.slice(0, 20)) {
      boardCellInfo(player, space);
      boardCellPreview(player, space, 'greenery');
      boardCellPreview(player, space, 'city');
      boardCellPreview(player, space, 'ocean');
    }

    expect(JSON.stringify(game.board.serialize())).to.eq(before);
    expect(player.megaCredits).to.eq(mc);
    expect(game.deferredActions.length).to.eq(deferred);
  });

  describe('Ares hazard adjacency', () => {
    let aGame: IGame;
    let aPlayer: TestPlayer;
    /** An empty land cell next to a hazard — the penalty case. */
    let target: Space;

    beforeEach(() => {
      [aGame, aPlayer] = testGame(2, {aresExtension: true});
      const found = aGame.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined &&
        aGame.board.getAdjacentSpaces(s).some((a) => AresHandler.hasHazardTile(a)));
      if (found === undefined) {
        throw new Error('no empty land space adjacent to a hazard');
      }
      target = found;
    });

    function productionFact(kind: Parameters<typeof boardCellPreview>[2] = 'greenery') {
      return boardCellPreview(aPlayer, target, kind).costFacts.find((f) => f.id === 'cost-production');
    }

    it('placing next to a hazard costs a production the player must reduce', () => {
      const fact = productionFact();

      // The penalty is a COST (it is paid to place), never a soft warning —
      // and the console/desktop panels only render it via boardCellPreview.
      expect(fact).to.not.be.undefined;
      expect(fact!.category).to.eq('placement-penalty');
      expect(fact!.severity).to.eq('danger');
      expect(fact!.recipient.kind).to.eq('current-player');
    });

    // The preview must not promise a cost Game.addTile waives. Each case below
    // is a waiver the commit path applies via AresHandler.
    it('an OCEAN tile pays no hazard-adjacency penalty', () => {
      expect(productionFact('ocean')).to.be.undefined;
    });

    it("Athena's owner pays no hazard-adjacency penalty", () => {
      aPlayer.playedCards.push(new Athena());
      expect(productionFact()).to.be.undefined;
    });

    it('the solar phase (WGT) waives the Ares placement costs', () => {
      aGame.phase = Phase.SOLAR;
      expect(productionFact()).to.be.undefined;
    });

    it('the waivers are the shared predicate the commit path charges by', () => {
      // Guards the divergence class itself: preview and commit must agree.
      expect(AresHandler.subjectToHazardAdjacency(aPlayer, TileType.GREENERY)).to.be.true;
      expect(AresHandler.subjectToHazardAdjacency(aPlayer, TileType.OCEAN)).to.be.false;
      // An unknown (card-specific) tile stays charged — never silently free.
      expect(AresHandler.subjectToHazardAdjacency(aPlayer, undefined)).to.be.true;
      aPlayer.playedCards.push(new Athena());
      expect(AresHandler.subjectToHazardAdjacency(aPlayer, TileType.GREENERY)).to.be.false;
    });
  });

  describe('Asteroid Deflection Zone (Hollandia)', () => {
    let hGame: IGame;
    let hP1: TestPlayer;
    let hP2: TestPlayer;

    beforeEach(() => {
      [hGame, hP1, hP2] = testGame(2, {boardName: BoardName.HOLLANDIA});
    });

    function zones(empty = true): ReadonlyArray<Space> {
      return hGame.board.spaces.filter((s) => s.spaceType === SpaceType.DEFLECTION_ZONE && (!empty || s.tile === undefined));
    }

    it('hover shows the REAL plant-protection rule (not a random-map note)', () => {
      const info = boardCellInfo(hP1, zones()[0]);
      expect(info.status.header).to.eq('Deflection Zone');
      const rule = info.facts.find((f) => f.id === 'deflection-zone');
      expect(rule, 'deflection rule fact').to.not.be.undefined;
      expect(rule!.description).to.eq('Protects you from plant destruction while ALL your tiles are inside this zone.');
      // The wrong "random map / fixed position" rule is gone.
      expect(JSON.stringify(rule)).to.not.match(/randomized|fixed position/i);
    });

    it('the ongoing deflection rule SURVIVES an occupied zone cell (not a stale placement rule)', () => {
      const zone = zones()[0];
      zone.tile = {tileType: TileType.GREENERY};
      zone.player = hP1;
      // Unlike volcanic / reserved, the deflection zone is an ONGOING protection
      // rule, so it stays even when the cell holds a tile.
      expect(boardCellInfo(hP1, zone).facts.some((f) => f.id === 'deflection-zone'),
        'occupied deflection cell keeps the ongoing rule').to.be.true;
    });

    it('hover reports per-player protection status (active / no-tiles / tiles-outside)', () => {
      const z = zones();
      // hP1 owns a tile INSIDE the zone (and nothing else) → protected.
      z[0].tile = {tileType: TileType.GREENERY};
      z[0].player = hP1;

      const byColor = (p: TestPlayer) => {
        const info = boardCellInfo(p, z[1]);
        expect(info.zoneProtection, 'zoneProtection present').to.not.be.undefined;
        return new Map(info.zoneProtection!.statuses.map((s) => [s.color, s.status]));
      };
      let map = byColor(hP1);
      expect(map.get(hP1.color)).to.eq('active');
      expect(map.get(hP2.color)).to.eq('inactive-no-zone-tiles');

      // give hP1 a tile OUTSIDE the zone → protection drops.
      const outside = hGame.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      outside.tile = {tileType: TileType.GREENERY};
      outside.player = hP1;
      map = byColor(hP1);
      expect(map.get(hP1.color)).to.eq('inactive-has-tiles-outside');

      // the viewing player is listed first.
      expect(boardCellInfo(hP1, z[1]).zoneProtection!.statuses[0].color).to.eq(hP1.color);
    });

    it('placement preview: placing in the zone reports a protection impact', () => {
      const preview = boardCellPreview(hP1, zones()[0], 'greenery');
      const impact = allFacts(preview).find((f) => f.id === 'deflection-impact');
      expect(impact, 'in-zone protection impact').to.not.be.undefined;
    });

    it('placement preview: placing OUTSIDE while protected warns it disables protection', () => {
      hP1.withinDeflectionZone = true;
      const land = hGame.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      const warn = allFacts(boardCellPreview(hP1, land, 'greenery')).find((f) => f.id === 'deflection-impact');
      expect(warn, 'off-zone disables-protection warning').to.not.be.undefined;
      expect(warn!.timing).to.eq('warning');
    });
  });

  describe('groupFactsByRecipient', () => {
    const current: BoardFact = {id: 'a', category: 'printed-placement-bonus', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: 'a'};
    const opp: BoardFact = {id: 'b', category: 'city-greenery-scoring', timing: 'endgame', severity: 'warning', recipient: {kind: 'tile-owner', color: 'red'}, title: 'b'};
    const neutral: BoardFact = {id: 'c', category: 'map-special-zone', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'c'};

    it('orders current player first, then others, then neutral', () => {
      const groups = groupFactsByRecipient([neutral, opp, current]);
      expect(groups.map((g) => g.recipient.kind)).to.deep.eq(['current-player', 'tile-owner', 'neutral']);
    });

    it('collapses the viewer-owned recipient into current-player', () => {
      const groups = groupFactsByRecipient([opp], 'red');
      expect(groups).to.have.lengthOf(1);
      expect(groups[0].recipient.kind).to.eq('current-player');
    });
  });
});
