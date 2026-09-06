import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {TileType} from '../../../common/TileType';
import {IPlayer} from '../../IPlayer';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {message} from '../../logs/MessageBuilder';
import {LoseProduction} from '../../deferredActions/LoseProduction';
import {Resource} from '../../../common/Resource';
import {MarsBoard} from '../../boards/MarsBoard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class NoctisCity extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.NOCTIS_CITY,
      tags: [Tag.CITY, Tag.BUILDING],
      cost: 18,

      behavior: {
        production: {megacredits: 3},
      },

      metadata: {

        infoText: [

          {text: 'Decrease your energy production 1 step.', tokens: ['production(']},

          {text: 'Increase your M€ production 3 steps.', tokens: ['production(']},

          {text: 'Place a city tile on the reserved Noctis City area, disregarding normal placement restrictions.', tokens: ['city']},

        ],
        cardNumber: '017',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.minus().energy(1).br;
            pb.plus().megacredits(3);
          }).nbsp.city().asterix();
        }),
        description: 'Decrease your energy production 1 step and increase your M€ production 3 steps. Place a city tile ON THE RESERVED AREA, disregarding normal placement restrictions.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const noctisCitySpaceId = player.game.board.noctisCitySpaceId;
    if (noctisCitySpaceId !== undefined) {
      // Noctis reserved space has no energy production bonus; player must already have >= 1.
      return player.production.energy >= 1;
    }
    const availableSpaces = player.game.board.getAvailableSpacesForCity(player);
    if (availableSpaces.length === 0) {
      return false;
    }
    return MarsBoard.hasEnergyCoverage(player, availableSpaces);
  }

  // The bespoke block is the city placement gated by energy coverage — neither is
  // declarative, so name the precise blocker (no space, or no energy production).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const board = player.game.board;
    if (board.noctisCitySpaceId !== undefined) {
      return player.production.energy >= 1 ? undefined : reason.noEnergyProduction();
    }
    const spaces = board.getAvailableSpacesForCity(player);
    if (spaces.length === 0) {
      return reason.placementReason('No space available for the tile');
    }
    if (!MarsBoard.hasEnergyCoverage(player, spaces)) {
      return reason.noEnergyProduction();
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    const noctisCitySpaceId = player.game.board.noctisCitySpaceId;
    if (noctisCitySpaceId !== undefined) {
      const space = player.game.board.getSpaceOrThrow(noctisCitySpaceId);
      player.game.addCity(player, space);
      player.production.add(Resource.ENERGY, -1, {log: true});
    } else {
      const spaces = MarsBoard.filterForEnergy(player, player.game.board.getAvailableSpacesForCity(player));
      player.game.defer(
        new PlaceCityTile(player, {
          title: message('Select space for ${0}', (b) => b.card(this)),
          spaces,
          // Names the card to the placement preview, so its `placementPreview`
          // hook (the −1 energy production below) is reachable.
          sourceCard: this.name,
        }),
      ).andThen(() => {
        player.game.defer(new LoseProduction(player, Resource.ENERGY, {count: 1}));
      });
    }
    return undefined;
  }

  // The on-play preview: the declarative +3 M€ production chip auto-includes;
  // we add the bespoke −1 energy production (`bespokePlay`'s `LoseProduction` /
  // direct add, not in `behavior`) so the modal shows the full production swing.
  //
  // STAGED PLAY: on a board WITH the reserved Noctis area the cell is FIXED but
  // ON-GRID — the player still goes to the board to inspect it (Ares zones,
  // neighbours) and confirm; `fixed: true` means the batch carries NO space tail
  // (bespokePlay places it itself, no SelectSpace ever exists). On boards
  // without the area it is an ordinary staged city pick, mirroring
  // `bespokePlay`'s energy-coverage filter.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const board = player.game.board;
    const noctisCitySpaceId = board.noctisCitySpaceId;
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      effects: [actionPreviews.productionChange(player, Resource.ENERGY, -1)],
      staged: noctisCitySpaceId !== undefined ?
        {spaces: () => [board.getSpaceOrThrow(noctisCitySpaceId)], fixed: true} :
        {
          spaces: (canAffordOptions) =>
            MarsBoard.filterForEnergy(player, board.getAvailableSpacesForCity(player, canAffordOptions)),
          placementType: 'city',
        },
    });
  }

  /**
   * BOTH `bespokePlay` branches cost 1 energy production, and on the branch that
   * asks for a space it is applied only in the `andThen` — so the cell preview
   * would otherwise show the placement without its price.
   */
  public placementPreview(player: IPlayer): ReadonlyArray<BoardFact> {
    // No description: the title plus the chip's real `N → N-1 production` say it.
    return [placementPreviews.productionChange(player, this, Resource.ENERGY, -1,
      'Energy production decreases')];
  }
}
