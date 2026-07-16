import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';

export class MonsInsurance extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.MONS_INSURANCE,
      startingMegaCredits: 48,

      behavior: {
        production: {megacredits: 4},
      },

      metadata: {
        cardNumber: 'R46',
        description: 'You start with 48 M€. Increase your M€ production 4 steps. ALL OPPONENTS DECREASE THEIR M€ production 2 STEPS. THIS DOES NOT TRIGGER THE EFFECT BELOW.',
        infoText: [
          {text: 'All opponents decrease their M€ production 2 steps. This does not trigger the effect below.', tokens: ['production(']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(48).production((pb) => {
            pb.megacredits(4).nbsp.megacredits(-2, {all}).asterix();
          });
          b.corpBox('effect', (cb) => {
            cb.vSpace(Size.SMALL);
            cb.effect('When a player causes another player to decrease production or lose resources, pay 3M€ to the victim, or as much as possible.', (eb) => {
              eb.production((pb) => pb.wild(1, {all})).or().minus().wild(1, {all});
              eb.startEffect.text('pay', Size.SMALL, true).megacredits(3);
            });
          });
        }),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    for (const p of player.opponents) {
      p.production.add(Resource.MEGACREDITS, -2, {log: true});
    }
    player.game.monsInsuranceOwner = player;
    return undefined;
  }

  // When `claimant` is undefined, it's the neutral player.
  public payDebt(player: IPlayer, claimant : IPlayer | undefined) {
    if (player !== claimant) {
      const retribution = Math.min(player.megaCredits, 3);
      if (claimant) {
        // stock.add (NOT `claimant.megaCredits +=`) so the victim's compensation is
        // recorded as a GameEvent — it shows in the journal / notifications, mirroring
        // the owner's recorded `deduct` below. Left under the active (attacker) scope:
        // attributing this GAIN to MonsInsurance too would CANCEL the owner's payout in
        // the per-source effect aggregate (same source, opposite stock M€).
        claimant.stock.add(Resource.MEGACREDITS, retribution);
      }
      // Attribute the owner's payout to MonsInsurance as a passive effect so the effects
      // overlay shows the compensation actually paid (it otherwise read as "never
      // triggered" — the deduct ran under the attacker's scope, not the owner's effect).
      const events = player.game.events;
      if (events !== undefined) {
        events.withEffect(player, this, 'insurance-claim', () => player.stock.deduct(Resource.MEGACREDITS, retribution));
      } else {
        player.stock.deduct(Resource.MEGACREDITS, retribution);
      }
      if (retribution > 0) {
        if (claimant !== undefined) {
          player.game.log('${0} received ${1} M€ from ${2} owner (${3})', (b) =>
            b.player(claimant)
              .number(retribution)
              .cardName(CardName.MONS_INSURANCE)
              .player(player));
        } else {
          player.game.log('Neutral player received ${0} M€ from ${1} owner (${2})', (b) =>
            b.number(retribution)
              .cardName(CardName.MONS_INSURANCE)
              .player(player));
        }
      }
    }
  }
}
