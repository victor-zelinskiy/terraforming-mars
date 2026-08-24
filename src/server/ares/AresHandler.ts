import {CardName} from '../../common/cards/CardName';
import {IGame} from '../IGame';
import {SelectCard} from '../inputs/SelectCard';
import {Space} from '../boards/Space';
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {HAZARD_STEPS, HazardSeverity, hazardSeverity} from '../../common/AresTileType';
import {TileType} from '../../common/TileType';
import {AresData, MilestoneCount} from '../../common/ares/AresData';
import {
  AresAdjacencyDelivery, AresAdjacencyGrantEntry, AresAdjacencyGrantModel, AresAdjacencyOwnerPayout,
} from '../../common/models/AresAdjacencyGrantModel';
import {AdjacencyCost} from './AdjacencyCost';
import {MultiSet} from 'mnemonist';
import {Phase} from '../../common/Phase';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {SelectProductionToLoseDeferred} from '../deferredActions/SelectProductionToLoseDeferred';
import {AutomaAres} from '../automa/AutomaAres';
import {AresHazards} from './AresHazards';
import {CrashlandingBonus} from '../pathfinders/CrashlandingBonus';
import {Board} from '../boards/Board';
import {PartyHooks} from '../turmoil/parties/PartyHooks';

export class AresHandler {
  private constructor() {}

  public static ifAres(game: IGame, cb: (aresData: AresData) => void) {
    if (game.gameOptions.aresExtension) {
      if (game.aresData === undefined) {
        throw new Error('Assertion failure: game.aresData is undefined');
      }
      cb(game.aresData);
    }
  }

  public static earnAdjacencyBonuses(player: IPlayer, space: Space, options?: {giveAresTileOwnerBonus?: boolean}) {
    // The presentation manifest of THIS placement's adjacency payouts —
    // recorded beside the grants themselves so it can never drift from what
    // was actually paid (see AresAdjacencyGrantModel).
    const grants: Array<AresAdjacencyGrantEntry> = [];
    const ownerPayouts: Array<AresAdjacencyOwnerPayout> = [];
    for (const adjacentSpace of player.game.board.getAdjacentSpaces(space)) {
      this.earnAdacencyBonus(space, adjacentSpace, player, options?.giveAresTileOwnerBonus, {grants, ownerPayouts});
    }
    if (grants.length > 0 || ownerPayouts.length > 0) {
      this.recordAdjacencyGrant(player.game, {
        spaceId: space.id,
        placerColor: player.color,
        grants,
        ownerPayouts,
      });
    }
  }

  /** Bounded ring: enough for one busy response (a MarsBot turn batch), never
   *  a leak. `seq` derives from the serialized `gameAge`, so it stays
   *  monotonic across a server restart and a client can consume each grant
   *  exactly once. */
  private static recordAdjacencyGrant(game: IGame, grant: Omit<AresAdjacencyGrantModel, 'seq'>): void {
    const base = game.gameAge * 100;
    const n = game.aresAdjacencyGrants.filter((g) => g.seq >= base).length;
    game.aresAdjacencyGrants.push({...grant, seq: base + Math.min(n, 99)});
    while (game.aresAdjacencyGrants.length > 8) {
      game.aresAdjacencyGrants.shift();
    }
  }

  // |player| placed a tile at |space| next to |adjacentSpace|.
  // Returns true if the adjacent space contains a bonus for adjacency.
  private static earnAdacencyBonus(
    newTileSpace: Space,
    adjacentSpace: Space,
    player: IPlayer,
    giveAresTileOwnerBonus: boolean = true,
    out?: {grants: Array<AresAdjacencyGrantEntry>, ownerPayouts: Array<AresAdjacencyOwnerPayout>},
  ): void {
    if (adjacentSpace.adjacency === undefined || adjacentSpace.adjacency.bonus.length === 0) {
      return;
    }
    const adjacentPlayer = adjacentSpace.player;
    if (adjacentPlayer === undefined) {
      throw new Error(`A tile with an adjacency bonus must have an owner (${adjacentSpace.x}, ${adjacentSpace.y}, ${adjacentSpace.adjacency.bonus}`);
    }

    const addResourceToCard = function(player: IPlayer, resourceType: CardResource, resourceAsText: string):
      {delivery: AresAdjacencyDelivery, targetCard?: CardName} {
      const availableCards = player.getResourceCards(resourceType);
      if (availableCards.length === 0) {
        // No silent loss: the skipped effect names itself in the log.
        player.game.log('${0} loses the ${1} adjacency bonus (no card can hold it)', (b) =>
          b.player(player).string(resourceAsText));
        return {delivery: 'none'};
      } else if (availableCards.length === 1) {
        player.addResourceTo(availableCards[0], {log: true});
        return {delivery: 'card-resource', targetCard: availableCards[0].name};
      }
      player.defer(new SelectCard(
        'Select a card to add an ' + resourceAsText,
        'Add ' + resourceAsText + 's',
        availableCards)
        .andThen((selected) => {
          player.addResourceTo(selected[0], {log: true});
          return undefined;
        }));
      return {delivery: 'prompt'};
    };

    const bonuses = new MultiSet<SpaceBonus>();

    for (const bonus of adjacentSpace.adjacency.bonus) {
      if (bonus !== 'callback') {
        bonuses.add(bonus);
        continue;
      }
      // Special case for Crashlanding
      const cardName = adjacentSpace.tile?.card;
      if (cardName !== CardName.CRASHLANDING) {
        throw new Error('\'callback\' only applies to Crashlanding now.');
      }
      const adjacentBonuses =
        CrashlandingBonus.onTilePlacedAdjacentToCrashlanding(
          player.game, adjacentSpace, newTileSpace);
      adjacentBonuses.forEach((bonus) => bonuses.add(bonus));
    }

    // MarsBot house rule (mirrors the printed-icon conversion of
    // Game.grantPlacementBonuses): the bot gains 1 M€ per adjacency-bonus unit
    // instead of the actual resources — it has no use for plants/energy/cards
    // and must never be prompted for a card target. The tile OWNER's income
    // below is untouched. No grant entries are recorded — the bot has no
    // screen, and the human viewers' interest (the owner income) is.
    if (player.isMarsBot) {
      const units = bonuses.size;
      if (units > 0) {
        player.stock.add(Resource.MEGACREDITS, units, {log: false});
        player.game.log('${0} gained ${1} M€ for the Ares adjacency bonus', (b) =>
          b.player(player).number(units));
      }
    } else {
      AresHandler.grantAdjacencyBonuses(player, adjacentSpace, bonuses, addResourceToCard, out?.grants);
      const bonusText = Array.from(bonuses.multiplicities())
        .map(([bonus, count]) => `${count} ${SpaceBonus.toString(bonus)}`)
        .join(', ');
      const adjacentTile = adjacentSpace.tile;
      if (adjacentTile !== undefined) {
        // A typed tile token — the premium journal renders it as a chip.
        player.game.log('${0} gains ${1} for placing next to ${2}', (b) => b.player(player).string(bonusText).tileType(adjacentTile.tileType));
      } else {
        player.game.log('${0} gains ${1} for placing next to ${2}', (b) => b.player(player).string(bonusText).string('no tile'));
      }
    }

    if (giveAresTileOwnerBonus) {
      let ownerBonus = 1;
      if (adjacentPlayer.tableau.has(CardName.MARKETING_EXPERTS)) {
        ownerBonus = 2;
      }

      adjacentPlayer.stock.add(Resource.MEGACREDITS, ownerBonus, {log: false});
      const adjacentTile = adjacentSpace.tile;
      if (adjacentTile !== undefined) {
        player.game.log('${0} gains ${1} M€ for a tile placed next to ${2}', (b) => b.player(adjacentPlayer).number(ownerBonus).tileType(adjacentTile.tileType));
      } else {
        player.game.log('${0} gains ${1} M€ for a tile placed next to ${2}', (b) => b.player(adjacentPlayer).number(ownerBonus).string('no tile'));
      }
      out?.ownerPayouts.push({
        sourceSpaceId: adjacentSpace.id,
        ownerColor: adjacentPlayer.color,
        megacredits: ownerBonus,
      });
    }
  }

  private static grantAdjacencyBonuses(
    player: IPlayer,
    adjacentSpace: Space,
    bonuses: MultiSet<SpaceBonus>,
    addResourceToCard: (player: IPlayer, resourceType: CardResource, resourceAsText: string) => {delivery: AresAdjacencyDelivery, targetCard?: CardName},
    grants?: Array<AresAdjacencyGrantEntry>): void {
    const record = (entry: Omit<AresAdjacencyGrantEntry, 'sourceSpaceId' | 'bonus'>, bonus: SpaceBonus) => {
      grants?.push({sourceSpaceId: adjacentSpace.id, bonus, ...entry});
    };
    for (const [bonus, qty] of bonuses.multiplicities()) {
      for (let idx = 0; idx < qty; idx++) {
        switch (bonus) {
        case SpaceBonus.ANIMAL: {
          const r = addResourceToCard(player, CardResource.ANIMAL, 'animal');
          record({delivery: r.delivery, cardResource: CardResource.ANIMAL, targetCard: r.targetCard}, bonus);
          break;
        }

        case SpaceBonus.MEGACREDITS:
          // Route through stock.add (NOT player.megaCredits++) so the adjacency
          // gain reaches the event stream / premium journal. log:false keeps the
          // single summary log below (no double-logging).
          player.stock.add(Resource.MEGACREDITS, 1, {log: false});
          record({delivery: 'stock', resource: Resource.MEGACREDITS}, bonus);
          break;

        case SpaceBonus.ENERGY:
          player.stock.add(Resource.ENERGY, 1, {log: false});
          record({delivery: 'stock', resource: Resource.ENERGY}, bonus);
          break;

        case SpaceBonus.MICROBE: {
          const r = addResourceToCard(player, CardResource.MICROBE, 'microbe');
          record({delivery: r.delivery, cardResource: CardResource.MICROBE, targetCard: r.targetCard}, bonus);
          break;
        }

        default: {
          // The grant itself reports its channel (SpaceBonusGrant) — the
          // manifest mirrors what actually happened, never a second rule.
          const granted = player.game.grantSpaceBonus(player, bonus, 1, {spaceId: adjacentSpace.id});
          if (granted.kind === 'stock') {
            record({delivery: 'stock', resource: granted.resource}, bonus);
          } else if (granted.kind === 'draw') {
            record({delivery: 'draw'}, bonus);
          } else {
            record({delivery: 'prompt'}, bonus);
          }
          break;
        }
        }
      }
    }
  }

  public static maybeIncrementMilestones(aresData: AresData, player: IPlayer, space: Space, hazardSeverity: HazardSeverity) {
    const entry : MilestoneCount | undefined = aresData.milestoneResults.find((e) => e.id === player.id);
    if (entry === undefined) {
      throw new Error('Player ID not in the Ares milestone results map: ' + player.id);
    }

    const hasAdjacencyBonus = player.game.board.getAdjacentSpaces(space).some((adjacentSpace) => {
      return (adjacentSpace.adjacency?.bonus?? []).length > 0;
    });

    if (hasAdjacencyBonus) {
      entry.networkerCount++;
    }
    if (hazardSeverity !== 'none') {
      entry.purifierCount++;
    }
  }

  public static incrementPurifier(aresData: AresData, player: IPlayer) {
    const entry : MilestoneCount | undefined = aresData.milestoneResults.find((e) => e.id === player.id);
    if (entry === undefined) {
      throw new Error('Player ID not in the Ares milestone results map: ' + player.id);
    }
    entry.purifierCount++;
  }

  public static hasHazardTile(space: Space): boolean {
    return hazardSeverity(space.tile?.tileType) !== 'none';
  }

  /**
   * Whether this placement pays the hazard-ADJACENCY production penalty.
   *
   * The ONE predicate for the rule: `Game.addTile` charges by it and the
   * read-only placement PREVIEW (`MarsBoard.placementCostInfo`) gates by it, so
   * the preview can never promise a cost the commit path waives. Two waivers:
   * an OCEAN tile is exempt, and Athena's owner is never subject.
   *
   * An UNKNOWN tile (a card-specific special tile the caller couldn't name)
   * resolves to the charged default — never silently free.
   */
  public static subjectToHazardAdjacency(player: IPlayer, tileType: TileType | undefined): boolean {
    if (tileType === TileType.OCEAN) {
      return false;
    }
    return !player.tableau.has(CardName.ATHENA);
  }

  /**
   * Ares placement costs are waived WHOLESALE during the solar phase (World
   * Government Terraforming places its tiles for free). Mirrors the early
   * return in {@link assertCanPay} — the preview reads the same predicate.
   */
  public static placementCostsWaived(game: IGame): boolean {
    return game.phase === Phase.SOLAR;
  }

  private static computePlacementCosts(player: IPlayer, space: Space, subjectToHazardAdjacency: boolean): AdjacencyCost {
    // Defence in depth: every caller already resolves the flag through
    // `subjectToHazardAdjacency()`, but a direct `assertCanPay(…, true)` must
    // not charge Athena's owner either.
    if (player.tableau.has(CardName.ATHENA)) {
      subjectToHazardAdjacency = false;
    }

    const game = player.game;
    // Summing up production cost isn't really the way to do it, because each tile could
    // reduce different production costs. Oh well.
    let megaCreditCost = 0;
    let productionCost = 0;
    game.board.getAdjacentSpaces(space).forEach((adjacentSpace) => {
      megaCreditCost += adjacentSpace.adjacency?.cost || 0;
      if (subjectToHazardAdjacency === true) {
        const severity = hazardSeverity(adjacentSpace.tile?.tileType);
        productionCost += HAZARD_STEPS[severity];
      }
    });

    const severity = hazardSeverity(space.tile?.tileType);
    megaCreditCost += HAZARD_STEPS[severity] * 8;
    const tr = HAZARD_STEPS[severity];

    return {megacredits: megaCreditCost, production: productionCost, tr};
  }

  public static assertCanPay(player: IPlayer, space: Space, subjectToHazardAdjacency: boolean): AdjacencyCost {
    if (AresHandler.placementCostsWaived(player.game)) {
      return {megacredits: 0, production: 0, tr: 0};
    }
    const cost = AresHandler.computePlacementCosts(player, space, subjectToHazardAdjacency);


    // Make this more sophisticated, a player can pay for different adjacencies
    // with different production units, and, a severe hazard can't split payments.
    const availableProductionUnits = (player.production.megacredits + 5) +
            player.production.steel +
            player.production.titanium +
            player.production.plants +
            player.production.energy +
            player.production.heat;

    // MarsBot has no production — its hazard-adjacency cost is the random
    // tag-track regression house rule (see AutomaAres), so the production
    // affordability math never gates the bot. The M€ costs stay real.
    const productionPayable = player.isMarsBot || availableProductionUnits >= cost.production;
    if (productionPayable && player.canAfford({cost: cost.megacredits, tr: {tr: cost.tr}})) {
      return cost;
    }
    const messages = [];
    if (cost.production > 0) {
      messages.push(`${cost.production} units of production`);
    }
    if (cost.megacredits > 0) {
      messages.push(`${cost.megacredits} M€`);
    }
    if (cost.tr > 0 && PartyHooks.reds01PolicyInEffect(player)) {
      messages.push(`additional M€ for ${cost.tr} TR`);
    }
    throw new Error(`Placing here costs ${messages.join(', ')}`);
  }

  public static payAdjacencyAndHazardCosts(player: IPlayer, space: Space, subjectToHazardAdjacency: boolean) {
    const cost = this.assertCanPay(player, space, subjectToHazardAdjacency);

    // MarsBot never answers prompts — its costs resolve immediately: the M€
    // adjacency cost is a direct deduction (bot M€ = its open supply; canAfford
    // above guaranteed it), and the hazard-adjacency production cost becomes
    // the house-rule consequence — ONE random tag track regresses one step per
    // placement (see AutomaAres.applyHazardConsequence).
    if (player.isMarsBot) {
      if (cost.megacredits > 0) {
        player.game.log('${0} placing a tile here costs ${1} M€', (b) => b.player(player).number(cost.megacredits));
        player.stock.deduct(Resource.MEGACREDITS, cost.megacredits, {log: false});
      }
      if (cost.production > 0) {
        AutomaAres.applyHazardConsequence(player.game);
      }
      return;
    }

    if (cost.production > 0) {
      // TODO(kberg): don't send interrupt if total is available.
      player.game.defer(new SelectProductionToLoseDeferred(player, cost.production, {type: 'hazard'}));
    }
    if (cost.megacredits > 0) {
      player.game.log('${0} placing a tile here costs ${1} M€', (b) => b.player(player).number(cost.megacredits));
      player.game.defer(new SelectPaymentDeferred(player, cost.megacredits, {title: 'Select how to pay additional placement costs.'}));
    }
  }

  public static onTemperatureChange(game: IGame, aresData: AresData, player: IPlayer) {
    AresHazards.onTemperatureChange(game, aresData, player);
  }

  public static onOceanPlaced(aresData: AresData, player: IPlayer) {
    AresHazards.onOceanPlaced(aresData, player);
  }

  public static onOxygenChange(game: IGame, aresData: AresData, player: IPlayer) {
    AresHazards.onOxygenChange(game, aresData, player);
  }

  public static grantBonusForRemovingHazard(player: IPlayer, initialTileType: TileType) {
    if (player.game.phase === Phase.SOLAR) {
      return;
    }
    const steps = HAZARD_STEPS[hazardSeverity(initialTileType)];
    if (steps > 0) {
      // Attribute to the hazard-clearing VP segment, NOT the card/action whose
      // tile placement happened to cover the hazard.
      player.increaseTerraformRating(steps, {trAttribution: {sourceType: 'ares-hazard', sourceName: 'Hazard cleanup'}});
      player.game.log('${0}\'s TR increases ${1} step(s) for removing ${2}', (b) => b.player(player).number(steps).tileType(initialTileType));
    }
  }

  public static anyAdjacentSpaceGivesBonus(board: Board, space: Space, bonus: SpaceBonus): boolean {
    return board.getAdjacentSpaces(space).some((adj) => adj.adjacency?.bonus.includes(bonus));
  }
}
