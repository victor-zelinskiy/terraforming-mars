import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from './CorporationCard';
import {Phase} from '../../../common/Phase';
import {Space} from '../../boards/Space';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {GainProduction} from '../../deferredActions/GainProduction';
import {CardRenderer} from '../render/CardRenderer';
import {BoardType} from '../../boards/BoardType';
import {digit} from '../Options';
import {AresHandler} from '../../ares/AresHandler';
import {ICorporationCard} from './ICorporationCard';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';

export class MiningGuild extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.MINING_GUILD,
      tags: [Tag.BUILDING, Tag.BUILDING],
      startingMegaCredits: 30,

      behavior: {
        production: {steel: 1},
        stock: {steel: 5},
      },

      metadata: {
        cardNumber: 'R24',
        description: 'You start with 30 M€, 5 steel and 1 steel production.',
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(30).nbsp.steel(5, {digit}).nbsp.production((pb) => pb.steel(1));
          b.corpBox('effect', (ce) => {
            ce.effect('Each time you place a tile on an area with a steel or titanium placement bonus, increase your steel production 1 step', (eb) => {
              eb.steel(1).asterix().slash().titanium(1).asterix();
              eb.startEffect.production((pb) => pb.steel(1));
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
    if (cardOwner.id !== activePlayer.id || cardOwner.game.phase === Phase.SOLAR) {
      return;
    }
    // Don't grant a bonus for Mars Nomads (no tile actually placed)
    if (cardOwner.game.nomadSpace === space.id && space.tile === undefined) {
      return;
    }
    // Don't grant a bonus if the card is overplaced (like Ares Ocean City)
    if (space.tile?.covers !== undefined) {
      return;
    }
    const board = cardOwner.game.board;
    const grant = space.bonus.some((bonus) => bonus === SpaceBonus.STEEL || bonus === SpaceBonus.TITANIUM) ||
      AresHandler.anyAdjacentSpaceGivesBonus(board, space, SpaceBonus.STEEL) ||
      AresHandler.anyAdjacentSpaceGivesBonus(board, space, SpaceBonus.TITANIUM);
    if (grant) {
      cardOwner.game.defer(new GainProduction(cardOwner, Resource.STEEL));
    }
  }

  /**
   * The read-only mirror of `onTilePlaced` — the SAME early returns and the SAME
   * grant condition (reusing `AresHandler.anyAdjacentSpaceGivesBonus` rather than
   * re-deriving adjacency). The `BoardType` guard has no mirror: the placement
   * preview is always the Mars board.
   *
   * The bonus is entirely space-dependent, which makes it exactly what the cell
   * preview owes the player — so an area that grants nothing SAYS so instead of
   * showing an empty block.
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (cardOwner.id !== activePlayer.id || cardOwner.game.phase === Phase.SOLAR) {
      return [];
    }
    // Mars Nomads moves onto a space without placing any tile.
    if (cardOwner.game.nomadSpace === space.id && space.tile === undefined) {
      return [];
    }
    // Overplaced tile (Ares Ocean City and friends). At preview time the new
    // tile's `covers` doesn't exist yet, so read the context flag.
    if (ctx.covering) {
      return [];
    }
    const board = cardOwner.game.board;
    const grant = space.bonus.some((bonus) => bonus === SpaceBonus.STEEL || bonus === SpaceBonus.TITANIUM) ||
      AresHandler.anyAdjacentSpaceGivesBonus(board, space, SpaceBonus.STEEL) ||
      AresHandler.anyAdjacentSpaceGivesBonus(board, space, SpaceBonus.TITANIUM);
    const recipient = placementPreviews.recipientOf(activePlayer, cardOwner);
    if (!grant) {
      return [placementPreviews.noEffectHere(this,
        'No steel or titanium bonus here — no steel production',
        {
          description: 'This corporation raises steel production only for a tile placed on an area with a steel or titanium placement bonus.',
          recipient,
        })];
    }
    return [placementPreviews.productionChange(cardOwner, this, Resource.STEEL, 1,
      'Steel or titanium bonus on this area', {recipient})];
  }
}
