import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {Space} from '../../boards/Space';
import {TileType} from '../../../common/TileType';
import {Resource} from '../../../common/Resource';
import {PlaceOceanTile} from '../../deferredActions/PlaceOceanTile';
import {intersection} from '../../../common/utils/utils';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {Size} from '../../../common/cards/render/Size';
import {Tag} from '../../../common/cards/Tag';
import {Phase} from '../../../common/Phase';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

// TODO(kberg): PolderTech is not yet compatible with Ares or Red City.
export class PolderTechDutch extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.POLDERTECH_DUTCH,
      tags: [Tag.EARTH],
      startingMegaCredits: 35,

      initialActionText: 'Place an ocean tile and a greenery tile next to each other',

      metadata: {
        cardNumber: 'X-3',
        description: 'You start with 35 M€. As your first action, place an ocean tile and a greenery tile next to each other IGNORING GREENERY PLACEMENT RESTRICTIONS. Raise oxygen 1 step.',
        infoText: [
          {text: 'As your first action, place an ocean tile and an adjacent greenery tile, ignoring greenery placement restrictions, and raise the oxygen level 1 step.', tokens: ['oceans']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(35).oceans(1, {size: Size.SMALL}).greenery({size: Size.SMALL}).asterix().br;
          b.effect('When you place an ocean tile, gain 1 energy.', (eb) => eb.oceans(1, {size: Size.SMALL}).startEffect.energy(1)).br;
          b.effect('When you place a greenery, gain 1 plant.', (eb) => eb.greenery({size: Size.SMALL}).startEffect.plants(1)).br;
        }),
      },
    });
  }

  public override initialAction(player: IPlayer) {
    const board = player.game.board;

    // Find valid ocean space. They have to be next to a place to put the greenery.
    // Greenery spaces can be any space because this corp ignores greenery placement restrictions.
    const oceanSpaces = board.getAvailableSpacesForOcean(player);
    const greenerySpaces = board.getAvailableSpacesOnLand(player);
    const oceanSpacesNextToGreenerySpaces = oceanSpaces.filter((space) => {
      return board.getAdjacentSpaces(space).some((adjacentSpace) => greenerySpaces.includes(adjacentSpace));
    });

    player.game.defer(new PlaceOceanTile(player, {
      sourceCard: this.name,
      spaces: oceanSpacesNextToGreenerySpaces,
      customReasoner: (space) => {
        // Ocean-placeable cell that isn't next to a land cell where the paired
        // greenery could go — the one rule for this step.
        if (oceanSpaces.includes(space) && !board.getAdjacentSpaces(space).some((a) => greenerySpaces.includes(a))) {
          return 'ocean-requires-adjacent-greenery';
        }
        return undefined;
      },
    }))
      .andThen((space) => {
        // Should not happen.
        if (space === undefined) {
          return;
        }
        const greenerySpaces = board.getAvailableSpacesOnLand(player);
        const adjacentSpaces = board.getAdjacentSpaces(space);
        const validGreenerySpaces = intersection(greenerySpaces, adjacentSpaces);
        const adjacentIds = new Set(adjacentSpaces.map((s) => s.id));
        player.defer(
          createMarsSelectSpace(player, 'Select space for greenery tile', validGreenerySpaces, {
            placementType: 'land', // ignores greenery adjacency-to-yours rule
            // `placementType` is the ELIGIBILITY kind here, so without the tile
            // the preview could not tell it is a greenery — and stayed mute about
            // the oxygen/TR bump, its VP, and this corp's own +1 plant.
            tileType: TileType.GREENERY,
            sourceCard: this.name,
            customReasoner: (cell) => {
              // Land cell, empty, correct owner but not adjacent to the
              // just-placed ocean — that's the unique reason for this step.
              if (cell.tile === undefined &&
                  cell.player === undefined &&
                  cell.spaceType === 'land' &&
                  cell.id !== board.noctisCitySpaceId &&
                  !adjacentIds.has(cell.id)) {
                return 'not-adjacent-to-new-ocean';
              }
              return undefined;
            },
          })
            .andThen((greenerySpace) => {
              player.game.addGreenery(player, greenerySpace);
              return undefined;
            }));
      });

    return undefined;
  }

  // Two chained placements (ocean → adjacent greenery). The tiles' own O2/TR
  // consequences surface in the per-cell board preview, matching the
  // declarative placement corps (Tharsis / Philares).
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [], [
      actionPreviews.boardPlacementStep('ocean', {tileType: TileType.OCEAN}),
      actionPreviews.boardPlacementStep('greenery', {tileType: TileType.GREENERY}),
    ]);
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space): void {
    if (cardOwner !== activePlayer) {
      return;
    }
    // During World Government Terraforming the active player places the ocean but
    // it is not "their" placement, so the effect should not trigger.
    if (cardOwner.game.phase === Phase.SOLAR) {
      return;
    }
    if (space.tile?.tileType === TileType.OCEAN) {
      cardOwner.stock.add(Resource.ENERGY, 1, {log: true, from: {card: this}});
    }
    if (space.tile?.tileType === TileType.GREENERY) {
      cardOwner.stock.add(Resource.PLANTS, 1, {log: true, from: {card: this}});
    }
  }

  /**
   * Read-only mirror of `onTilePlaced`. Both early returns are mirrored as-is:
   * only the OWNER's own placement pays, and never during World Government
   * terraforming (the active player places the ocean, but it is not "their"
   * placement).
   *
   * The live code keys on the EXACT `space.tile.tileType`, not on what the tile
   * counts as — an Ocean City / Wetlands "counts as" an ocean but is not
   * `TileType.OCEAN`, so it pays nothing. Mirrored with `ctx.tileType`, never
   * with `ctx.countsAsOcean` / `ctx.countsAsGreenery`.
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, _space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (cardOwner !== activePlayer) {
      return [];
    }
    if (cardOwner.game.phase === Phase.SOLAR) {
      return [];
    }
    const recipient = placementPreviews.recipientOf(activePlayer, cardOwner);
    if (ctx.tileType === TileType.OCEAN) {
      return [placementPreviews.stockChange(cardOwner, this, Resource.ENERGY, 1, 'You place an ocean tile', {recipient})];
    }
    if (ctx.tileType === TileType.GREENERY) {
      return [placementPreviews.stockChange(cardOwner, this, Resource.PLANTS, 1, 'You place a greenery tile', {recipient})];
    }
    return [];
  }
}
