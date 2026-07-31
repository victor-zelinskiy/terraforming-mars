import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {MarketingExperts} from '../../src/server/cards/ares/MarketingExperts';
import {setOxygenLevel} from '../TestingUtils';
import * as constants from '../../src/common/constants';
import {hazardSeverity} from '../../src/common/AresTileType';

describe('BoardInformationEngine — Ares', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  function allFacts(preview: ReturnType<typeof boardCellPreview>): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ];
  }

  function emptyLand(): Space {
    const s = game.board.spaces.find((x) => x.spaceType === SpaceType.LAND && x.tile === undefined);
    if (s === undefined) {
      throw new Error('no empty land');
    }
    return s;
  }

  it('adjacency bonus: placing next to an Ares tile credits the placer AND the tile owner', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    // An opponent's tile with a +1 M€ adjacency bonus.
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};

    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const facts = allFacts(boardCellPreview(player, place, 'greenery'));

    const mine = facts.find((f) => f.category === 'ares-adjacency-bonus');
    expect(mine, 'ares-adjacency-bonus for the placer').to.not.be.undefined;
    expect(mine!.recipient.kind).to.eq('current-player');
    expect(mine!.delta?.icon).to.eq('megacredits');

    const owner = facts.find((f) => f.category === 'tile-owner-benefit');
    expect(owner, 'tile-owner-benefit').to.not.be.undefined;
    expect(owner!.recipient).to.deep.eq({kind: 'tile-owner', color: player2.color});
    expect(owner!.delta?.amount).to.eq(1);
  });

  it('Marketing Experts doubles the adjacent tile owner M€ benefit', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    player2.playedCards.push(new MarketingExperts()); // tableau.has(MARKETING_EXPERTS) → owner bonus doubles

    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const owner = allFacts(boardCellPreview(player, place, 'greenery')).find((f) => f.category === 'tile-owner-benefit');
    expect(owner!.delta?.amount).to.eq(2);
  });

  it('hazard hover: shows identity, cleanup reward (+TR) and the adjacency penalty', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.EROSION_SEVERE, protectedHazard: false};

    const facts = boardCellInfo(player, hz).facts;
    const identity = facts.find((f) => f.id === 'hazard-identity');
    expect(identity?.title).to.eq('Erosion');
    const reward = facts.find((f) => f.id === 'hazard-cleanup-reward');
    expect(reward?.delta).to.deep.include({icon: 'tr', amount: 2, direction: 'gain'});
    expect(facts.some((f) => f.id === 'hazard-adjacency')).to.be.true;
  });

  it('hazard cleanup preview: building on a hazard surfaces the +TR cleanup reward', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};

    const cleanup = allFacts(boardCellPreview(player, hz, 'greenery')).find((f) => f.category === 'hazard-cleanup');
    expect(cleanup?.delta).to.deep.include({icon: 'tr', amount: 1, direction: 'gain'});
  });

  it('no leak: a non-Ares game produces NO ares-adjacency facts even if adjacency data is present', () => {
    [game, player, player2] = testGame(2); // Ares OFF
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const facts = allFacts(boardCellPreview(player, place, 'greenery'));
    expect(facts.some((f) => f.category === 'ares-adjacency-bonus' || f.category === 'tile-owner-benefit')).to.be.false;
  });

  it('placing next to a hazard surfaces the FORCED production-loss amount as a chip', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.EROSION_SEVERE, protectedHazard: false}; // severe → 2 production
    const place = game.board.getAdjacentSpaces(hz).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;

    const prod = boardCellPreview(player, place, 'city').costFacts.find((f) => f.id === 'cost-production');
    expect(prod, 'forced production-loss cost fact').to.not.be.undefined;
    expect(prod!.title).to.eq('Reduce production');
    expect(prod!.severity).to.eq('danger');
    // The TOTAL rides the premium chip, like every other cost on the panel.
    expect(prod!.delta).to.deep.eq({icon: '', amount: 2, direction: 'cost'});
    // …and the line under it says WHY, naming the count and the per-hazard rate.
    expect(prod!.description).to.eq('Your choice · adjacent hazards: ${0}, −${1} each');
    expect(prod!.params).to.deep.eq(['1', '2']); // 1 adjacent hazard, −2 each (severe)
  });

  /**
   * The bug this reworked copy exists to kill: "reduce ONE production" was simply
   * false the moment a second hazard touched the cell.
   */
  it('spells out the count and rate for SEVERAL adjacent hazards', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const place = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined &&
      game.board.getAdjacentSpaces(s).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined).length >= 2)!;
    const neighbours = game.board.getAdjacentSpaces(place)
      .filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined);
    neighbours[0].tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
    neighbours[1].tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};

    const prod = boardCellPreview(player, place, 'city').costFacts.find((f) => f.id === 'cost-production');
    expect(prod!.delta?.amount).to.eq(2);
    expect(prod!.description).to.eq('Your choice · adjacent hazards: ${0}, −${1} each');
    expect(prod!.params).to.deep.eq(['2', '1']); // 2 adjacent hazards, −1 each
  });

  it('names BOTH rates when the adjacent hazards differ in severity', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const place = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined &&
      game.board.getAdjacentSpaces(s).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined).length >= 2)!;
    const neighbours = game.board.getAdjacentSpaces(place)
      .filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined);
    neighbours[0].tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
    neighbours[1].tile = {tileType: TileType.EROSION_SEVERE, protectedHazard: false};

    const prod = boardCellPreview(player, place, 'city').costFacts.find((f) => f.id === 'cost-production');
    expect(prod!.delta?.amount).to.eq(3); // 1 + 2 — never averaged into a single rate
    expect(prod!.description).to.eq('Your choice · mild ×${0} (−1), severe ×${1} (−2)');
    expect(prod!.params).to.deep.eq(['1', '1']);
  });

  /**
   * PLANETARY EVENTS. One tile can rewrite the whole map: the ocean count wipes
   * every dust storm (and pays the placer +1 TR) or drops two new erosions, and
   * the oxygen / temperature thresholds turn every hazard of a kind severe. The
   * player used to meet all of it only AFTER confirming.
   */
  describe('Ares planetary events', () => {
    /**
     * Park every threshold out of reach and sweep the hazards the Ares SETUP
     * scatters, so each test arms exactly one threshold and seeds exactly the
     * hazards whose count it asserts on.
     */
    function disarmThresholds(): void {
      for (const key of ['erosionOceanCount', 'removeDustStormsOceanCount', 'severeErosionTemperature', 'severeDustStormOxygen'] as const) {
        game.aresData!.hazardData[key] = {threshold: 999, available: true};
      }
      for (const space of game.board.spaces) {
        if (space.tile !== undefined && hazardSeverity(space.tile.tileType) !== 'none') {
          space.tile = undefined;
        }
      }
    }
    function emptyOceanSpace(): Space {
      return game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
    }

    it('an OCEAN that clears the dust storms previews the event AND its +1 TR', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      game.aresData!.hazardData.removeDustStormsOceanCount =
        {threshold: game.board.getOceanSpaces().length + 1, available: true};
      emptyLand().tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};

      const preview = boardCellPreview(player, emptyOceanSpace(), 'ocean');
      const event = preview.immediateFacts.find((f) => f.id === 'ares-event-dust-storms-recede');
      expect(event, 'planetary-event fact').to.not.be.undefined;
      expect(event!.title).to.eq('Planetary event: dust storms recede');
      expect(event!.params).to.deep.eq(['1']); // the one storm on the board
      // The TR the event pays — the thing that was completely invisible before.
      const tr = preview.immediateFacts.find((f) => f.id === 'ares-event-dust-storms-tr');
      expect(tr?.delta).to.include({icon: 'tr', amount: 1, direction: 'gain'});
    });

    it('an OCEAN that drops new erosions warns about it', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      game.aresData!.hazardData.erosionOceanCount =
        {threshold: game.board.getOceanSpaces().length + 1, available: true};

      const warn = boardCellPreview(player, emptyOceanSpace(), 'ocean').warningFacts
        .find((f) => f.id === 'ares-event-erosions-appear');
      expect(warn, 'erosion-appearance warning').to.not.be.undefined;
      expect(warn!.description).to.eq('Two erosion tiles are placed on the map');
    });

    it('…and says SEVERE when the temperature threshold has already been consumed', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      game.aresData!.hazardData.erosionOceanCount =
        {threshold: game.board.getOceanSpaces().length + 1, available: true};
      game.aresData!.hazardData.severeErosionTemperature.available = false;

      const warn = boardCellPreview(player, emptyOceanSpace(), 'ocean').warningFacts
        .find((f) => f.id === 'ares-event-erosions-appear');
      expect(warn!.description).to.eq('Two SEVERE erosion tiles are placed on the map');
    });

    it('a GREENERY that crosses the oxygen threshold warns that dust storms intensify', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      game.aresData!.hazardData.severeDustStormOxygen = {threshold: game.getOxygenLevel() + 1, available: true};
      emptyLand().tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
      emptyLand().tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};

      const place = game.board.getAvailableSpacesOnLand(player)[0];
      const warn = boardCellPreview(player, place, 'greenery').warningFacts
        .find((f) => f.id === 'effect-ares-dust-storms-severe');
      expect(warn, 'dust-storm intensify warning').to.not.be.undefined;
      expect(warn!.params).to.deep.eq(['2']);
      expect(warn!.description).to.eq('Becomes severe: ${0} · building next to one then costs −2');
    });

    it('follows the 8% oxygen chain into the TEMPERATURE erosion event', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      setOxygenLevel(game, constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS - 1);
      // The chained temperature step is what trips this one.
      game.aresData!.hazardData.severeErosionTemperature = {threshold: game.getTemperature() + 2, available: true};
      emptyLand().tile = {tileType: TileType.EROSION_MILD, protectedHazard: false};

      const place = game.board.getAvailableSpacesOnLand(player)[0];
      const warn = boardCellPreview(player, place, 'greenery').warningFacts
        .find((f) => f.id === 'effect-oxygen-bonus-ares-erosions-severe');
      expect(warn, 'erosion intensify via the oxygen→temperature chain').to.not.be.undefined;
      expect(warn!.params).to.deep.eq(['1']);
    });

    it('says NOTHING when the threshold is already spent, or when no hazard would change', () => {
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      // Armed but ALREADY consumed → no promise.
      game.aresData!.hazardData.severeDustStormOxygen =
        {threshold: game.getOxygenLevel() + 1, available: false};
      emptyLand().tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
      const place = game.board.getAvailableSpacesOnLand(player)[0];
      expect(boardCellPreview(player, place, 'greenery').warningFacts
        .some((f) => f.id === 'effect-ares-dust-storms-severe')).to.be.false;

      // Available, but there is no mild dust storm to upgrade → a non-event
      // must not spend a line.
      [game, player] = testGame(2, {aresExtension: true});
      disarmThresholds();
      game.aresData!.hazardData.severeDustStormOxygen = {threshold: game.getOxygenLevel() + 1, available: true};
      const bare = game.board.getAvailableSpacesOnLand(player)[0];
      expect(boardCellPreview(player, bare, 'greenery').warningFacts
        .some((f) => f.id === 'effect-ares-dust-storms-severe')).to.be.false;
    });

    it('promises nothing when Ares is OFF', () => {
      [game, player] = testGame(2); // no Ares
      const oceanSpace = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
      const preview = boardCellPreview(player, oceanSpace, 'ocean');
      expect([...preview.immediateFacts, ...preview.warningFacts]
        .some((f) => f.id.startsWith('ares-event'))).to.be.false;
    });
  });

  it('hovering an adjacency-SOURCE tile explains the neighbour bonus AND the owner benefit', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const src = emptyLand();
    src.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    src.player = player2;
    src.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};

    const facts = boardCellInfo(player, src).facts;
    const neighbour = facts.find((f) => f.category === 'ares-adjacency-bonus');
    expect(neighbour, 'neighbour adjacency-bonus fact').to.not.be.undefined;
    expect(neighbour!.delta?.icon).to.eq('megacredits');
    const owner = facts.find((f) => f.category === 'tile-owner-benefit');
    expect(owner, 'owner benefit fact').to.not.be.undefined;
    expect(owner!.recipient).to.deep.eq({kind: 'tile-owner', color: player2.color});
    expect(owner!.delta?.amount).to.eq(1);
  });

  it('hovering an Ares resource tile surfaces EVERY neighbour bonus incl. card resources (Biofertilizer microbe / Ocean Sanctuary animal)', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const src = emptyLand();
    src.tile = {tileType: TileType.BIOFERTILIZER_FACILITY, card: undefined};
    src.player = player2;
    // Card-resource bonuses (microbe/animal) must NOT be silently dropped alongside plants.
    src.adjacency = {bonus: [SpaceBonus.PLANT, SpaceBonus.MICROBE, SpaceBonus.ANIMAL]};

    const icons = boardCellInfo(player, src).facts
      .filter((f) => f.category === 'ares-adjacency-bonus')
      .map((f) => f.delta?.icon);
    expect(icons).to.include('plants');
    expect(icons).to.include('microbe');
    expect(icons).to.include('animal');
  });

  it('hovering a cost-only adjacency tile (Nuclear Zone) warns about the placement cost, no owner bonus', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const nz = emptyLand();
    nz.tile = {tileType: TileType.NUCLEAR_ZONE, card: undefined};
    nz.player = player2;
    nz.adjacency = {bonus: [], cost: 2}; // Nuclear Zone — costs to build next to, no bonus

    const facts = boardCellInfo(player, nz).facts;
    const cost = facts.find((f) => f.id === 'ares-src-cost');
    expect(cost, 'adjacency cost fact').to.not.be.undefined;
    expect(cost!.delta).to.deep.include({icon: 'megacredits', amount: 2, direction: 'cost'});
    // No bonus → no owner benefit (mirrors earnAdjacencyBonus skipping an empty bonus).
    expect(facts.some((f) => f.category === 'tile-owner-benefit')).to.be.false;
  });

  it('a :variant tile label is stripped to its base name (no expansion suffix)', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const nz = emptyLand();
    nz.tile = {tileType: TileType.NUCLEAR_ZONE, card: CardName.NUCLEAR_ZONE_ARES};
    nz.player = player2;
    expect(boardCellInfo(player, nz).status.tileLabel).to.eq('Nuclear Zone'); // not "Nuclear Zone:ares"
  });

  it('cost breakdown: a hazard adjacent to a Nuclear Zone explains the composed cleanup price', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const hz = emptyLand();
    hz.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
    const nz = game.board.getAdjacentSpaces(hz).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    nz.tile = {tileType: TileType.NUCLEAR_ZONE, card: CardName.NUCLEAR_ZONE_ARES};
    nz.player = player2;
    nz.adjacency = {bonus: [], cost: 2};

    const facts = boardCellInfo(player, hz).facts;
    const total = facts.find((f) => f.id === 'cost-mc-total');
    expect(total, 'total cost fact').to.not.be.undefined;
    expect(total!.delta?.amount).to.eq(10); // cleanup 8 + Nuclear Zone +2
    expect(facts.find((f) => f.id === 'mc-cleanup')?.delta?.amount).to.eq(8);
    const adj = facts.find((f) => f.id.startsWith('mc-adj-'));
    expect(adj?.delta?.amount).to.eq(2);
    expect(adj?.title).to.eq('Nuclear Zone'); // the factor is NAMED (stripped) + translated client-side
  });

  it('is READ-ONLY: hover + preview on hazard/adjacency cells mutate nothing', () => {
    [game, player, player2] = testGame(2, {aresExtension: true});
    const adj = emptyLand();
    adj.tile = {tileType: TileType.NATURAL_PRESERVE, card: undefined};
    adj.player = player2;
    adj.adjacency = {bonus: [SpaceBonus.MEGACREDITS]};
    const place = game.board.getAdjacentSpaces(adj).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const hz = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== place.id)!;
    hz.tile = {tileType: TileType.EROSION_MILD, protectedHazard: false};

    const tr = player.terraformRating;
    const mc = player.megaCredits;
    const ownerMc = player2.megaCredits;
    boardCellInfo(player, hz);
    boardCellPreview(player, place, 'greenery');
    boardCellPreview(player, hz, 'greenery');
    expect(player.terraformRating).to.eq(tr);
    expect(player.megaCredits).to.eq(mc);
    expect(player2.megaCredits).to.eq(ownerMc);
  });
});
