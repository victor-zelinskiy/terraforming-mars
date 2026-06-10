import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {Space} from '../../boards/Space';
import {cathedral} from '../render/DynamicVictoryPoints';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {Board} from '../../boards/Board';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectPayment} from '../../inputs/SelectPayment';
import {TITLES} from '../../inputs/titles';
import {message} from '../../logs/MessageBuilder';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

const ACTION_COST = 5;

export class StJosephOfCupertinoMission extends Card implements IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ST_JOSEPH_OF_CUPERTINO_MISSION,
      cost: 7,
      victoryPoints: 'special',

      metadata: {
        cardNumber: 'X64',
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 5 M€ (STEEL MAY BE USED) to build  1 Cathedral in a city. Max 1 per city. City owner can pay 2 M€  to draw 1 card.', (eb) => {
            eb.megacredits(5).super((b) => b.steel(1)).startAction.cathedral().asterix();
          });
        }),
        description: '1 VP per City with a Cathedral in it.',
        victoryPoints: cathedral(),
      },
    });
  }

  private getEligibleCities(game: IGame): Array<Space> {
    return game.board.getCities().filter((space) => !game.stJosephCathedrals.includes(space.id));
  }

  canAct(player: IPlayer): boolean {
    return this.getEligibleCities(player.game).length > 0 && player.canAfford({cost: 5, steel: true});
  }

  actionUnavailableReason(player: IPlayer) {
    // canAct fails if EITHER there's no eligible city OR you can't pay; if you
    // CAN pay, the blocker is the city, otherwise it's M€.
    return player.canAfford({cost: 5, steel: true}) ?
      actionReason.placementReason('No eligible city for this mission') :
      actionReason.notEnoughMC();
  }

  // Pay 5 M€ (steel usable) then place a Cathedral in a city. When steel is
  // usable the payment is dialed INSIDE the confirm modal (no separate
  // SelectPayment follow-up); otherwise a flat M€ cost chip. The city placement
  // is an after-submit SelectSpace shown as a board-placement note.
  public actionPreview(player: IPlayer) {
    const pay = actionPreviews.paymentStep(player, ACTION_COST, {canUseSteel: true, title: TITLES.payForCardAction(this.name)});
    const place = actionPreviews.boardPlacementStep('city');
    if (pay !== undefined) {
      return actionPreviews.singleBranch(this, player, [pay, place]);
    }
    return actionPreviews.singleBranch(this, player, [place], [
      actionPreviews.stockCost(player, Resource.MEGACREDITS, ACTION_COST),
    ]);
  }

  action(player: IPlayer): undefined {
    const cities = this.getEligibleCities(player.game);
    if (cities.length === 0) {
      return undefined;
    }

    player.game.defer(new SelectPaymentDeferred(player, 5, {canUseSteel: true, title: TITLES.payForCardAction(this.name)}))
      .andThen(() => {
        const cathedralIds = new Set(player.game.stJosephCathedrals);
        player.defer(createMarsSelectSpace(
          player,
          message('Select new space for ${0}', (b) => b.card(this)),
          cities,
          {
            customReasoner: (space) => {
              // Operates on city tiles, not empty cells. Two reasons:
              if (space.tile === undefined || !Board.isCitySpace(space)) {
                return 'not-a-city';
              }
              if (cathedralIds.has(space.id)) {
                return 'already-has-cathedral';
              }
              return undefined;
            },
          })
          .andThen((space) => {
            player.game.stJosephCathedrals.push(space.id);
            const spaceOwner = space.player;
            if (spaceOwner === undefined || spaceOwner.color === 'neutral') {
              return undefined;
            }
            if (spaceOwner.canAfford(2)) {
              spaceOwner.defer(
                new OrOptions(
                  new SelectPayment('Pay 2 M€ to draw a card', 2, {})
                    .andThen((payment) => {
                    // TODO(kberg): pay should have an afterPay for the heat / floaters costs.
                      spaceOwner.pay(payment);
                      spaceOwner.drawCard();
                      return undefined;
                    }),
                  new SelectOption('Do not buy a card'),
                ));
            }
            return undefined;
          }));
      });
    return undefined;
  }

  public override getVictoryPoints(player: IPlayer) {
    return player.game.stJosephCathedrals.length;
  }
}
