import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {SelectPlayer} from '../../inputs/SelectPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {any} from '../render/DynamicVictoryPoints';
import {all} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class LawSuit extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.LAW_SUIT,
      tags: [Tag.EARTH],
      cost: 2,
      victoryPoints: 'special',

      metadata: {
        cardNumber: 'X06',
        renderData: CardRenderer.builder((b) => {
          b.text('steal', Size.SMALL, true).megacredits(3, {all}).asterix();
        }),
        description: 'Steal 3 M€ from a player that REMOVED YOUR RESOURCES OR DECREASED YOUR PRODUCTION this generation. Place this card face down in THAT PLAYER\'S EVENT PILE.',
        victoryPoints: any(-1),
      },
    });
  }

  private targets(player: IPlayer) {
    return player.removingPlayers.map((id) => player.game.getPlayerById(id));
  }

  public override bespokeCanPlay(player: IPlayer) {
    return this.targets(player).length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.targets(player).length === 0) {
      return reason.targetReason('No player removed your resources or reduced your production this generation');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    return new SelectPlayer(this.targets(player), 'Select player to sue (steal 3 M€ from)', 'Steal M€', {icon: 'megacredits', amount: 3})
      .andThen((suedPlayer: IPlayer) => {
        const amount = Math.min(3, suedPlayer.megaCredits);
        if (amount === 0) {
          player.game.log('${0} sued ${1} who had 0 MC.', (b) => b.player(player).player(suedPlayer));
        }
        suedPlayer.playedCards.push(this);
        player.warmongerCards++;
        suedPlayer.maybeBlockAttack(player, 'lose 3 M€', (proceed) => {
          if (proceed) {
            suedPlayer.stock.deduct(Resource.MEGACREDITS, amount, {log: true, from: {player}, stealing: true});
          }
          player.stock.add(Resource.MEGACREDITS, amount);
          return undefined;
        });
        return undefined;
      });
  }
  // The on-play preview: the SAME owner-aware target picker `bespokePlay` builds,
  // so the player chooses WHOM to sue (steal 3 M€ from) inside the play modal.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const targets = this.targets(player);
    const step = targets.length > 0 ?
      actionPreviews.selectPlayerStep(targets, 'Select player to sue (steal 3 M€ from)', 'Steal M€', {icon: 'megacredits', amount: 3}) :
      undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  public override getVictoryPoints() {
    return -1;
  }

  public static resourceHook(player: IPlayer, amount: number, from: IPlayer) {
    if (from === player || amount >= 0) {
      return;
    }
    if (player.removingPlayers.includes(from.id) === false) {
      player.removingPlayers.push(from.id);
    }
  }
}

