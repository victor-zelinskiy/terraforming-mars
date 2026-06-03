import {OCEAN_UPGRADE_TILES, TileType} from '../../common/TileType';
import {SpaceType} from '../../common/boards/SpaceType';
import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Board} from './Board';
import {Space} from './Space';
import {PlacementType} from './PlacementType';
import {AresHandler} from '../ares/AresHandler';
import {CardName} from '../../common/cards/CardName';
import {SpaceId} from '../../common/Types';
import {oneWayDifference} from '../../common/utils/utils';
import {Tile} from '../Tile';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {PlacementIllegalReason, PlacementIllegalSpace} from '../../common/inputs/PlacementIllegalReason';
import * as constants from '../../common/constants';

export class MarsBoard extends Board {
  private readonly edges: ReadonlyArray<Space>;

  public constructor(
    spaces: ReadonlyArray<Space>,
    noctisCitySpaceId?: SpaceId | undefined) {
    super(spaces, noctisCitySpaceId);
    this.edges = this.computeEdges();
  }

  public getCitiesOffMars(player?: IPlayer): Array<Space> {
    return this.getCities(player).filter((space) => space.spaceType === SpaceType.COLONY);
  }

  public getCitiesOnMars(player?: IPlayer): Array<Space> {
    return this.getCities(player).filter((space) => space.spaceType !== SpaceType.COLONY);
  }

  public getCities(player?: IPlayer): Array<Space> {
    let cities = this.spaces.filter(Board.isCitySpace);
    if (player !== undefined) {
      cities = cities.filter(Board.ownedBy(player));
    }
    return cities;
  }

  public getGreeneries(player?: IPlayer): Array<Space> {
    let greeneries = this.spaces.filter((space) => Board.isGreenerySpace(space));
    if (player !== undefined) {
      greeneries = greeneries.filter(Board.ownedBy(player));
    }
    return greeneries;
  }

  public getAvailableSpacesForType(player: IPlayer, type: PlacementType, canAffordOptions?: CanAffordOptions | undefined): ReadonlyArray<Space> {
    switch (type) {
    case 'land': return this.getAvailableSpacesOnLand(player, canAffordOptions);
    case 'ocean': return this.getAvailableSpacesForOcean(player);
    case 'greenery': return this.getAvailableSpacesForGreenery(player, canAffordOptions);
    case 'city': return this.getAvailableSpacesForCity(player, canAffordOptions);
    case 'away-from-cities': return this.getSpacesAwayFromCities(player, canAffordOptions);
    case 'isolated': return this.getAvailableIsolatedSpaces(player, canAffordOptions);
    case 'volcanic': return this.getAvailableVolcanicSpaces(player, canAffordOptions);
    case 'upgradeable-ocean': return this.getOceanSpaces({upgradedOceans: false});
    case 'upgradeable-ocean-new-holland': {
      const oceanSpaces = this.getOceanSpaces({upgradedOceans: false});
      const filtered = this.getAvailableSpacesForCity(player, undefined, oceanSpaces);
      return filtered;
    }
    default: throw new Error('unknown type ' + type);
    }
  }

  /*
   * Returns spaces on the board with ocean tiles.
   *
   * The default condition is to return those oceans used to count toward the global parameter, so
   * upgraded oceans are included, but Wetlands is not. That's why the boolean values have different defaults.
   */
  public getOceanSpaces(include?: {upgradedOceans?: boolean, wetlands?: boolean}): ReadonlyArray<Space> {
    const spaces = this.spaces.filter((space) => {
      if (!Board.isOceanSpace(space)) {
        return false;
      }
      if (space.tile?.tileType === undefined) {
        return false;
      }

      const tileType = space.tile.tileType;
      if (OCEAN_UPGRADE_TILES.has(tileType)) {
        return include?.upgradedOceans ?? true;
      }
      if (tileType === TileType.WETLANDS) {
        return include?.wetlands ?? false;
      }
      return true;
    });
    return spaces;
  }

  public getAvailableSpacesForCity(player: IPlayer, canAffordOptions?: CanAffordOptions, spaces?: ReadonlyArray<Space>): ReadonlyArray<Space> {
    const spacesOnLand = spaces ?? this.getAvailableSpacesOnLand(player, canAffordOptions);
    // Gordon CEO can ignore placement restrictions for Cities+Greenery
    if (player.tableau.has(CardName.GORDON)) {
      return spacesOnLand;
    }
    // Kingdom of Tauraro can place cities next to cities, but also must place them
    // next to tiles they own or have an excavation marker, if possible.
    if (player.tableau.has(CardName.KINGDOM_OF_TAURARO)) {
      const spacesNextToMySpaces = spacesOnLand.filter(
        (space) => this.getAdjacentSpaces(space).some(
          (adj) => (adj.tile !== undefined && adj.player === player || adj.excavator?.id === player.id)));

      return (spacesNextToMySpaces.length > 0) ? spacesNextToMySpaces : spacesOnLand;
    }
    // A city cannot be adjacent to another city
    return spacesOnLand.filter(
      (space) => this.getAdjacentSpaces(space).some((adjacentSpace) => Board.isCitySpace(adjacentSpace)) === false,
    );
  }

  public hasAvailableCitySpaceWithBonus(player: IPlayer, bonus: SpaceBonus): boolean {
    return this.getAvailableSpacesForCity(player).some((s) => s.bonus.includes(bonus));
  }

  /**
   * Returns true when the player can cover -1 energy production cost via
   * an available city space that carries an ENERGY_PRODUCTION bonus.
   */
  public static hasEnergyCoverage(player: IPlayer, spaces: ReadonlyArray<Space>): boolean {
    return player.production.energy >= 1 ||
      spaces.some((s) => s.bonus.includes(SpaceBonus.ENERGY_PRODUCTION));
  }

  /**
   * When a player has 0 energy production (relying on a placement bonus to cover
   * the -1 cost), constrain city placement to only energy-production spaces.
   * Otherwise returns the full set unchanged.
   */
  public static filterForEnergy(player: IPlayer, spaces: ReadonlyArray<Space>): ReadonlyArray<Space> {
    if (player.production.energy > 0) {
      return spaces;
    }
    return spaces.filter((s) => s.bonus.includes(SpaceBonus.ENERGY_PRODUCTION));
  }

  public getSpacesAwayFromCities(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
    const spacesOnLand = this.getAvailableSpacesOnLand(player, canAffordOptions);

    return spacesOnLand.filter(
      (space) => this.getAdjacentSpaces(space).some((adjacentSpace) => Board.isCitySpace(adjacentSpace)) === false,
    );
  }

  public filterSpacesAroundRedCity(spaces: ReadonlyArray<Space>): ReadonlyArray<Space> {
    const redCity = this.getSpaceByTileCard(CardName.RED_CITY);
    if (redCity === undefined) {
      return spaces;
    }
    const adjacentSpaces = this.getAdjacentSpaces(redCity);
    return oneWayDifference(spaces, adjacentSpaces);
  }

  public getAvailableSpacesForGreenery(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
    let availableLandSpaces = this.getAvailableSpacesOnLand(player, canAffordOptions);
    // Gordon CEO can ignore placement restrictions for Cities+Greenery
    if (player.tableau.has(CardName.GORDON)) {
      return availableLandSpaces;
    }
    // Spaces next to Red City are always unavialable for Greeneries.
    availableLandSpaces = this.filterSpacesAroundRedCity(availableLandSpaces);

    // player can place a greenery in an available land space that is next
    // to a tile the player already owns.
    const spacesForGreenery = availableLandSpaces.filter((space) => {
      return this.getAdjacentSpaces(space).some((adj) => {
        return MarsBoard.hasRealTile(adj) && adj.player === player;
      });
    });

    // Spaces next to tiles you own
    if (spacesForGreenery.length > 0) {
      return spacesForGreenery;
    }
    // Place anywhere if no space owned
    return availableLandSpaces;
  }

  public getAvailableSpacesForOcean(player: IPlayer): ReadonlyArray<Space> {
    return this.getSpaces(SpaceType.OCEAN)
      .filter((space) => space.tile === undefined && (space.player === undefined || space.player === player));
  }

  /**
   * Returns true when the player can afford the M€ (and Reds TR tax) that each of the
   * space's placement bonuses will charge.
   *
   * Used by cards that hand the player a non-tile-placement choice of space and then call
   * `grantSpaceBonuses` (Mars Nomads, Gagarin Mobile Base, Survey Mission). Without this
   * filter, picking e.g. the Hellas ocean space without 6 M€ leaves the player stuck on
   * the ocean-bonus prompt because `SelectPaymentDeferred` throws. See #7218.
   *
   * Tile placement itself goes through `Board.canAfford`/`spaceCosts` and is unaffected.
   */
  public static canAffordPlacementBonuses(player: IPlayer, space: Space): boolean {
    const game = player.game;
    if (space.bonus.includes(SpaceBonus.OCEAN) && game.canAddOcean()) {
      if (!player.canAfford({cost: constants.HELLAS_BONUS_OCEAN_COST, tr: {oceans: 1}})) {
        return false;
      }
    }
    if (space.bonus.includes(SpaceBonus.TEMPERATURE) && game.getTemperature() < constants.MAX_TEMPERATURE) {
      if (!player.canAfford({cost: constants.VASTITAS_BOREALIS_BONUS_TEMPERATURE_COST, tr: {temperature: 1}})) {
        return false;
      }
    }
    if (space.bonus.includes(SpaceBonus.TEMPERATURE_4MC) && game.getTemperature() < constants.MAX_TEMPERATURE) {
      if (!player.canAfford({cost: constants.VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST, tr: {temperature: 1}})) {
        return false;
      }
    }
    if (space.bonus.includes(SpaceBonus.COLONY)) {
      if (!player.canAfford({cost: constants.TERRA_CIMMERIA_COLONY_COST})) {
        return false;
      }
    }
    return true;
  }

  private computeEdges(): ReadonlyArray<Space> {
    return this.spaces.filter((space) => {
      if (space.y === 0 || space.y === 8 || space.x === 8) {
        return true;
      }
      // left side is tricky.
      // top-left is easy with math. Look at the map.
      if (space.y + space.x === 4) {
        return true;
      }
      // bottom-left is also easy with math. Look at the map.
      if (space.y - space.x === 4) {
        return true;
      }
      return false;
    });
  }

  public getEdges(): ReadonlyArray<Space> {
    return this.edges;
  }

  public getAvailableIsolatedSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
    return this.getAvailableSpacesOnLand(player, canAffordOptions)
      .filter((space: Space) => this.getAdjacentSpaces(space).every((space) => space.tile === undefined));
  }

  public getAvailableVolcanicSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
    const spaces = this.getAvailableSpacesOnLand(player, canAffordOptions);
    if (this.volcanicSpaceIds.length > 0) {
      return spaces.filter((space) => space.volcanic === true);
    }
    return spaces;
  }

  /**
   * Almost the same as getAvailableSpacesOnLand, but doesn't apply to any player.
   */
  public getNonReservedLandSpaces(): ReadonlyArray<Space> {
    return this.spaces.filter((space) => {
      if (space.id === this.noctisCitySpaceId) {
        return false;
      }
      return (space.spaceType === SpaceType.LAND || space.spaceType === SpaceType.COVE || space.spaceType === SpaceType.DEFLECTION_ZONE) &&
        (space.tile === undefined || AresHandler.hasHazardTile(space)) &&
        space.player === undefined;
    });
  }

  /**
   * For each board space NOT in `legalSpaces`, derive a structured reason
   * it's not a valid placement target. Used by the client to render a
   * native-tooltip explanation + a `cursor: not-allowed` cue on illegal
   * cells during placement.
   *
   * Best-effort heuristic: the same filter logic that
   * `getAvailableSpacesForX()` runs is re-walked here, returning the
   * FIRST (most specific) failure reason per cell. Cells with no
   * derivable reason get `'unavailable'` as the generic fallback.
   *
   * Extensible: add new `PlacementIllegalReason` values + corresponding
   * checks below. Keep priority order most-specific-first so the
   * tooltip text always answers "WHY is this cell off-limits" cleanly.
   *
   * `placementType` is optional because some custom placement paths
   * (cards that pass `spaces` directly to `PlaceTile`) don't have a
   * single PlacementType — for those the type-specific branches just
   * fall through to the generic fallback.
   */
  public computeIllegalReasons(
    player: IPlayer,
    placementType: PlacementType | undefined,
    legalSpaces: ReadonlyArray<Space>,
    options?: {
      canAffordOptions?: CanAffordOptions,
      /**
       * Optional card-specific reasoner. Runs PER illegal cell BEFORE the
       * generic pipeline. Return a `PlacementIllegalReason` to use it; return
       * `undefined` to fall through to the generic derivation (occupied /
       * reserved-* / wrong-terrain / cannot-afford / etc.).
       *
       * Use this for filters the generic helper can't see (card-state-
       * dependent, like Gagarin's `visited` history or St Joseph's cathedral
       * set). Return undefined for cells where a more basic reason (like
       * `occupied`) should win — the generic pipeline will catch them.
       */
      customReasoner?: (space: Space) => PlacementIllegalReason | undefined,
    }): ReadonlyArray<PlacementIllegalSpace> {
    const legalIds = new Set(legalSpaces.map((s) => s.id));
    const out: Array<PlacementIllegalSpace> = [];
    for (const space of this.spaces) {
      if (legalIds.has(space.id)) {
        continue;
      }
      const custom = options?.customReasoner?.(space);
      const reason = custom ?? this.deriveIllegalReason(player, placementType, space, options?.canAffordOptions);
      const entry: PlacementIllegalSpace = {spaceId: space.id, reason};
      // Mirror the hand card's "Need X more M€": attach the exact M€ gap for
      // affordability blocks so the placement popover can show it.
      if (reason === 'cannot-afford' || reason === 'cannot-afford-bonus') {
        const deficit = this.placementMegacreditDeficit(player, space, reason, options?.canAffordOptions);
        if (deficit > 0) {
          entry.deficit = deficit;
        }
      }
      out.push(entry);
    }
    return out;
  }

  /**
   * M€-equivalent shortfall to place on `space` given an affordability block.
   * `cannot-afford` reflects the tile's own placement cost (Ares hazard
   * removal / adjacency); `cannot-afford-bonus` reflects the special-space
   * bonus costs (Hellas ocean, Vastitas temperature, Terra Cimmeria colony).
   * Read-only. Reds TR tax is intentionally omitted — the figure is an honest
   * lower bound on the M€ still needed. Returns 0 when the block isn't a pure
   * M€ gap (e.g. a production-cost block), so the popover keeps the generic
   * "can't afford" line in that case.
   */
  private placementMegacreditDeficit(
    player: IPlayer,
    space: Space,
    reason: PlacementIllegalReason,
    canAffordOptions?: CanAffordOptions): number {
    const spendable = player.spendableMegacredits();
    if (reason === 'cannot-afford') {
      const costs = this.computeAdditionalCosts(space, player.game.gameOptions.aresExtension, canAffordOptions?.bonusMultiplier);
      let cost = costs.megacredits;
      if (space.undergroundResources === 'place6mc') {
        cost -= 6;
      }
      return Math.max(0, cost - spendable);
    }
    // cannot-afford-bonus — sum the M€ bonus costs this space would charge
    // (mirrors MarsBoard.canAffordPlacementBonuses).
    const game = player.game;
    let cost = 0;
    if (space.bonus.includes(SpaceBonus.OCEAN) && game.canAddOcean()) {
      cost += constants.HELLAS_BONUS_OCEAN_COST;
    }
    if (space.bonus.includes(SpaceBonus.TEMPERATURE) && game.getTemperature() < constants.MAX_TEMPERATURE) {
      cost += constants.VASTITAS_BOREALIS_BONUS_TEMPERATURE_COST;
    }
    if (space.bonus.includes(SpaceBonus.TEMPERATURE_4MC) && game.getTemperature() < constants.MAX_TEMPERATURE) {
      cost += constants.VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST;
    }
    if (space.bonus.includes(SpaceBonus.COLONY)) {
      cost += constants.TERRA_CIMMERIA_COLONY_COST;
    }
    return Math.max(0, cost - spendable);
  }

  /** @returns the first applicable reason this cell is illegal. */
  private deriveIllegalReason(
    player: IPlayer,
    placementType: PlacementType | undefined,
    space: Space,
    canAffordOptions?: CanAffordOptions): PlacementIllegalReason {
    // Already-placed tiles (special-case Ares protected hazards first).
    if (space.tile !== undefined) {
      if (AresHandler.hasHazardTile(space) && space.tile.protectedHazard === true) {
        return 'protected-hazard';
      }
      return 'occupied';
    }
    if (space.id === player.game.nomadSpace) {
      return 'nomad-occupies';
    }
    if (space.id === this.noctisCitySpaceId) {
      return 'reserved-noctis';
    }
    if (space.spaceType === SpaceType.COLONY) {
      return 'reserved-colony';
    }
    if (space.player !== undefined && space.player !== player) {
      return 'owned-by-other';
    }

    // Placement-type-specific terrain checks.
    if (placementType === 'ocean') {
      if (space.spaceType !== SpaceType.OCEAN) {
        // Placing an ocean on a non-ocean (land) cell.
        return 'needs-ocean-space';
      }
      if (!MarsBoard.canAffordPlacementBonuses(player, space)) {
        return 'cannot-afford-bonus';
      }
      // Empty + ocean-type + correct owner + affordable bonus → must be
      // excluded for a reason we can't easily classify (e.g. board
      // variant restriction).
      return 'unavailable';
    }

    if (placementType === 'volcanic' && this.volcanicSpaceIds.length > 0 && space.volcanic !== true) {
      return 'not-volcanic';
    }

    if (placementType === 'isolated' &&
        this.getAdjacentSpaces(space).some((adj) => adj.tile !== undefined)) {
      return 'not-isolated';
    }

    // Land-type checks (city / greenery / land / volcanic / isolated all
    // need a land-ish space). The common non-land cell is an ocean reserve —
    // call that out specifically; only truly exotic cells fall back to the
    // generic wrong-terrain.
    if (space.spaceType !== SpaceType.LAND &&
        space.spaceType !== SpaceType.COVE &&
        space.spaceType !== SpaceType.DEFLECTION_ZONE) {
      return space.spaceType === SpaceType.OCEAN ? 'ocean-only' : 'wrong-terrain';
    }

    // Affordability (Ares hazard removal cost, etc.).
    if (!this.canAfford(player, space, canAffordOptions)) {
      return 'cannot-afford';
    }

    if (placementType === 'city') {
      if (this.getAdjacentSpaces(space).some((adj) => Board.isCitySpace(adj))) {
        return 'adjacent-to-city';
      }
    }

    if (placementType === 'greenery') {
      const redCity = this.getSpaceByTileCard(CardName.RED_CITY);
      if (redCity !== undefined &&
          this.getAdjacentSpaces(space).some((adj) => adj.id === redCity.id)) {
        return 'adjacent-to-red-city';
      }
      // Greenery must be adjacent to a tile YOU own — but only if you
      // have at least one such adjacency option available across the
      // board. Otherwise greenery is allowed anywhere (server matches).
      const youOwnATile = this.spaces.some((s) => s.player === player && s.tile !== undefined);
      if (youOwnATile) {
        const adjacentToYours = this.getAdjacentSpaces(space)
          .some((adj) => MarsBoard.hasRealTile(adj) && adj.player === player);
        if (!adjacentToYours) {
          return 'not-adjacent-to-yours';
        }
      }
    }

    // Last specific check before the generic fallback: cells whose
    // placement bonuses (Hellas ocean cost, Vastitas temperature cost,
    // Terra Cimmeria colony cost, ± Reds TR tax) the player can't pay.
    // Used by the upstream affordability filter (#8179) on Mars Nomads /
    // Gagarin Mobile Base / Survey Mission / Jansson — when one of those
    // cards forwards its filtered space list through computeIllegalReasons,
    // this branch gives the player a precise tooltip on the dimmed cells.
    if (!MarsBoard.canAffordPlacementBonuses(player, space)) {
      return 'cannot-afford-bonus';
    }

    return 'unavailable';
  }

  // Returns true if |newTile| can cover go on |space|, particularly if |space| already has a tile.
  public static canCover(space: Space, newTile: Tile): boolean {
    if (space.tile === undefined) {
      return true;
    }

    // A hazard protected by the Desperate Measures action can't be covered.
    if (AresHandler.hasHazardTile(space) && space.tile.protectedHazard !== true) {
      return true;
    }
    if (space.tile.tileType === TileType.OCEAN && OCEAN_UPGRADE_TILES.has(newTile.tileType)) {
      return true;
    }
    return false;
  }
}
