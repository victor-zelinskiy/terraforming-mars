import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {ColonyName} from '../../../common/colonies/ColonyName';
import {BuildColony} from '../../deferredActions/BuildColony';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {max} from '../Options';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class PioneerSettlement extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 13,
      tags: [Tag.SPACE],
      name: CardName.PIONEER_SETTLEMENT,
      type: CardType.AUTOMATED,
      requirements: {colonies: 1, max},
      victoryPoints: 2,

      metadata: {
        cardNumber: 'C29',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(-2));
          b.nbsp.colonies(1);
        }),
        description: 'Requires that you have no more than 1 colony. Decrease your M€ production 2 steps. Place a colony.',
        infoText: [
          {text: 'Decrease your M€ production 2 steps.', tokens: ['production(megacredits', 'production(']},
          {text: 'Place a colony.', tokens: ['colonies']},
        ],
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (player.colonies.getPlayableColonies().length === 0) {
      return false;
    }

    let lunaIsAvailable = false;
    let coloniesCount = 0;
    const hasOneColonyMax = player.game.colonies.every((colony) => {
      if (colony.name === ColonyName.LUNA &&
          colony.isFull() === false &&
          colony.colonies.includes(player.id) === false) {
        lunaIsAvailable = true;
      }
      coloniesCount += colony.colonies.filter((owner) => owner === player.id).length;
      if (coloniesCount > 1) {
        return false;
      }
      return true;
    });

    if (hasOneColonyMax === false) {
      return false;
    }

    const megaCreditsProduction = player.production.megacredits;
    if (megaCreditsProduction === -4 && player.tableau.has(CardName.POSEIDON)) {
      return true;
    } else if (megaCreditsProduction <= -4) {
      if (lunaIsAvailable === false) {
        return false;
      }
      this.warnings.add('buildOnLuna');
    }

    return true;
  }

  // Neither the colony availability nor the M€-production floor is declarative, so
  // name the precise blocker (the ≤1-colony requirement is auto-explained).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.colonies.getPlayableColonies().length === 0) {
      return reason.targetReason('No colony available to build on');
    }
    const mcProduction = player.production.megacredits;
    if (mcProduction <= -4 && !(mcProduction === -4 && player.tableau.has(CardName.POSEIDON))) {
      const lunaIsAvailable = player.game.colonies.some((colony) =>
        colony.name === ColonyName.LUNA && colony.isFull() === false && colony.colonies.includes(player.id) === false);
      if (!lunaIsAvailable) {
        return reason.ruleReason('M€ production too low to build a colony');
      }
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    const openColonies = player.production.megacredits <= -4 ?
      player.game.colonies.filter((colony) => colony.name === ColonyName.LUNA) :
      undefined;
    player.game.defer(new BuildColony(player, {title: 'Select colony for Pioneer Settlement', colonies: openColonies}));
    player.production.add(Resource.MEGACREDITS, -2);
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {kind: 'colony'});
  }
}
