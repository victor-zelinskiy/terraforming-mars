import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Space} from '../../boards/Space';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {BoardType} from '../../boards/BoardType';
import {all} from '../Options';
import {SelectResources} from '../../inputs/SelectResources';
import {cardEffect} from '../../inputs/choiceContext';
import {message} from '../../logs/MessageBuilder';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {TileType} from '../../../common/TileType';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';

/**
 * The tile types `Game.simpleAddTile` leaves UNOWNED (`space.player = undefined`).
 * The live `onTilePlaced` reads `space.player` to decide whether a tile was
 * placed at all; at preview time the tile is not on the board yet, so the
 * preview mirrors the rule that WOULD set that field.
 */
const UNOWNED_TILE_TYPES: ReadonlySet<TileType> = new Set([
  TileType.OCEAN,
  TileType.MARTIAN_NATURE_WONDERS,
  TileType.REY_SKYWALKER,
]);

export class Philares extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.PHILARES,
      tags: [Tag.BUILDING],
      startingMegaCredits: 47,

      firstAction: {
        text: 'Place a greenery tile and raise the oxygen 1 step',
        greenery: {},
      },

      metadata: {
        cardNumber: 'R25',
        description: 'You start with 47 M€. As your first action, place a greenery tile and raise the oxygen 1 step.',
        infoText: [
          {text: 'As your first action, place a greenery tile and raise the oxygen level 1 step.', tokens: ['greenery']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(47).nbsp.greenery();
          b.corpBox('effect', (ce) => {
            ce.effect('Each new adjacency between your tile and an opponent\'s tile gives you a standard resource of your choice [regardless of who just placed a tile].', (eb) => {
              eb.emptyTile('normal', {size: Size.SMALL, all}).nbsp;
              eb.emptyTile('normal', {size: Size.SMALL}).startEffect.wild(1);
            });
          });
        }),
      },
    });
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType) {
    // Nerfing on The Moon.
    if (boardType !== BoardType.MARS) {
      return;
    }

    if (space.player === undefined) {
      return;
    }
    const adjacentSpaces = cardOwner.game.board.getAdjacentSpaces(space);
    const adjacentSpacesWithPlayerTiles = adjacentSpaces.filter((space) => space.tile !== undefined && space.player !== undefined);

    const eligibleTiles = (cardOwner.id === activePlayer.id) ?
      adjacentSpacesWithPlayerTiles.filter((space) => space.player?.id !== cardOwner.id) :
      adjacentSpacesWithPlayerTiles.filter((space) => space.player?.id === cardOwner.id);

    const count = eligibleTiles.length;
    if (count > 0) {
      const bySomeoneElse = cardOwner.id !== activePlayer.id;
      cardOwner.defer(() => {
        cardOwner.game.log('${0} must select ${1} bonus resource(s) from ${2}\' ability', (b) => b.player(cardOwner).number(count).card(this));
        return new SelectResources(message('Gain ${0} standard resources', (b) => b.number(count)), count)
          // WHY this prompt appeared. Philares is the fork's purest "prompt out
          // of nowhere": it fires on an OPPONENT's placement too, so without the
          // marker the player is handed a resource dial with no attribution at
          // all. The context names the corporation (source-card dock + L3
          // inspect + the deferred band's source line) and the trigger says
          // which placement caused it — both phrasings are gender-neutral in
          // Russian by attaching the verb to «тайл», never to the player.
          .markChoiceContext(cardEffect(this, bySomeoneElse ?
            message('${0}\'s tile landed next to yours. New adjacencies: ${1}', (b) => b.player(activePlayer).number(count)) :
            message('Your tile landed next to another player\'s. New adjacencies: ${0}', (b) => b.number(count)), 'reward'))
          .andThen((units) => {
            cardOwner.stock.adjust(units, {log: true});
            return undefined;
          });
      },
      cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : Priority.GAIN_RESOURCE_OR_PRODUCTION,
      );
    }
  }

  /**
   * Read-only mirror of `onTilePlaced` — the one hook whose payout is entirely a
   * function of WHICH cell is picked, so the placement panel is the only place a
   * player can see it before committing.
   *
   * Two conditions, mirroring the live order:
   *  - the placed tile must be OWNED. The live check is `space.player === undefined`,
   *    which the placement has not written yet, so mirror `Game.simpleAddTile`'s
   *    ownership rule instead ({@link UNOWNED_TILE_TYPES} stay unowned; everything
   *    else becomes the ACTIVE player's tile).
   *  - at least one adjacent cell holds a qualifying owned tile: another player's
   *    when the card owner is placing, the card OWNER's when someone else is.
   *
   * The `boardType !== BoardType.MARS` early return needs no mirror: the board
   * explainer only ever previews the Mars board.
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (ctx.tileType === undefined || UNOWNED_TILE_TYPES.has(ctx.tileType)) {
      return [];
    }
    const adjacentSpaces = cardOwner.game.board.getAdjacentSpaces(space);
    const adjacentSpacesWithPlayerTiles = adjacentSpaces.filter((adjacent) => adjacent.tile !== undefined && adjacent.player !== undefined);

    const eligibleTiles = (cardOwner.id === activePlayer.id) ?
      adjacentSpacesWithPlayerTiles.filter((adjacent) => adjacent.player?.id !== cardOwner.id) :
      adjacentSpacesWithPlayerTiles.filter((adjacent) => adjacent.player?.id === cardOwner.id);

    const count = eligibleTiles.length;
    if (count === 0) {
      return [];
    }
    // No delta chip: the reward is N resources of the player's CHOICE, so there
    // is no single pool and no honest icon — the count rides the title instead.
    return [placementPreviews.upcomingChoice(this, 'Gain ${0} standard resources of your choice', {
      description: 'One per new adjacency between your tile and another player\'s.',
      params: [String(count)],
      severity: 'positive',
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }
}
