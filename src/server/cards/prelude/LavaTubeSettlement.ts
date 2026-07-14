import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {CardRenderer} from '../render/CardRenderer';
import {Space} from '../../boards/Space';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class LavaTubeSettlement extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.LAVA_TUBE_SETTLEMENT,
      tags: [Tag.BUILDING, Tag.CITY],
      cost: 15,

      behavior: {
        production: {energy: -1, megacredits: 2},
      },

      metadata: {

        infoText: [

          {text: 'Decrease your energy production 1 step.', tokens: ['production(']},

          {text: 'Increase your M€ production 2 steps.', tokens: ['production(']},

          {text: 'Place a city tile on a volcanic area, regardless of adjacent cities.', tokens: ['city']},

        ],
        cardNumber: 'P37',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.minus().energy(1).br;
            pb.plus().megacredits(2);
          }).br;
          b.city().asterix();
        }),
        description: 'Decrease your energy production 1 step and increase your M€ production 2 steps. Place a city tile on a VOLCANIC AREA regardless of adjacent cities.',
      },
    });
  }

  private getSpacesForCity(player: IPlayer): ReadonlyArray<Space> {
    // https://boardgamegeek.com/thread/1953628/article/29627211#29627211
    const spaceType = player.game.board.volcanicSpaceIds.length === 0 ? 'city' : 'volcanic';
    return player.game.board.getAvailableSpacesForType(player, spaceType);
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.getSpacesForCity(player).length > 0 && player.production.energy >= 1;
  }

  // The −1 energy production block is auto-explained (declarative behavior). The
  // bespoke volcanic-city placement isn't — name it (falls back to the normal city
  // message on boards with no volcanic spaces).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getSpacesForCity(player).length === 0) {
      const volcanicMode = player.game.board.volcanicSpaceIds.length > 0;
      return reason.placementReason(volcanicMode ? 'No volcanic area available for the city' : 'No space available for the tile');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    const board = player.game.board;
    const volcanicMode = board.volcanicSpaceIds.length > 0;
    const cityPlaceable = new Set(board.getAvailableSpacesForType(player, 'city').map((s) => s.id));
    player.game.defer(
      new PlaceCityTile(
        player,
        {
          spaces: this.getSpacesForCity(player),
          title: 'Select either Tharsis Tholus, Ascraeus Mons, Pavonis Mons or Arsia Mons',
          // When volcanic spaces exist the city must go on one — a city-placeable
          // non-volcanic cell is off-limits for that reason.
          customReasoner: (space) => {
            if (volcanicMode && cityPlaceable.has(space.id) && !board.volcanicSpaceIds.includes(space.id)) {
              return 'not-volcanic';
            }
            return undefined;
          },
        }));
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {text: 'After confirming, place the city on a volcanic area.'});
  }
}
