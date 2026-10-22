import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {max} from '../Options';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {RedTourismWave} from '../turmoil/RedTourismWave';

export class HermeticOrderOfMars extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.HERMETIC_ORDER_OF_MARS,
      cost: 10,

      requirements: {oxygen: 4, max},

      behavior: {
        production: {megacredits: 2},
      },

      metadata: {

        infoText: [

          {text: 'Increase your M€ production 2 steps.', tokens: ['production(']},

          {text: 'Gain 1 M€ for each empty area adjacent to your tiles.', tokens: ['megacredits']},

        ],
        cardNumber: 'X56',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(2)).nbsp.megacredits(1).slash().emptyTile().asterix();
        }),
        description: 'Oxygen must be 4% or lower. Increase your M€ production 2 steps. Gain 1 M€ per empty area adjacent to your tiles.',
      },
    });
  }

  // The M€ gain (1 per empty area adjacent to your tiles) is a FIXED, computable
  // board-derived result that lives in bespokePlay, NOT in `behavior` (which only
  // carries the +2 M€ production). The rule is Red Tourism Wave's — ONE walk of
  // the board for the play, the preview and the cells (T12).
  public override bespokePlay(player: IPlayer) {
    player.stock.add(Resource.MEGACREDITS, RedTourismWave.getAdjacentEmptySpaces(player).length, {log: true});
    return undefined;
  }

  // The COUNTED play — the M€ gain with what it counted (the empty areas next to
  // the player's tiles, their cells for the board peek; the printed +2 production
  // is the declaration's): the hand tile's plate, the composer's chip and its
  // «ПОЧЕМУ» are this one reading.
  public countedPlayForecast(player: IPlayer): ReadonlyArray<ActionEffect> {
    return [RedTourismWave.emptyAreasGain(player)];
  }

  // The on-play preview: `playPreview` auto-includes the declarative +2 M€
  // production chip; we add the bespoke M€ gain so the modal shows the FULL result.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, this.countedPlayForecast(player));
  }
}
