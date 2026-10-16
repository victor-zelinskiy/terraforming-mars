import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
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
          {kind: 'effect-short', text: 'A player harms another: you pay the victim 3 M€'},
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
      // `from` is load-bearing: it is what makes this a recorded cross-player
      // ATTACK (the victim's client builds the hostile «you lost income» card
      // from that event). Without it — and outside a scope — the recorder
      // dropped the delta entirely and the victims were never told. Mirrors
      // Recession, the sibling everyone-loses-production card.
      p.production.add(Resource.MEGACREDITS, -2, {log: true, from: {player}});
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
        // recorded as a GameEvent — it shows in the journal / notifications. The
        // compensation is the INSURANCE's, never the attacker's (TR59): under the
        // attacker's scope it read «ИСТОЧНИК ‹карта атакующего›» beside the very loss it
        // repays. It is the insurer's effect reaching the claimant — the per-source
        // aggregate folds only the source owner's own deltas (`aggregate.ts`
        // `ownersOwn`), so the insurer's −3 is not cancelled by the claimant's +3.
        const credit = () => claimant.stock.add(Resource.MEGACREDITS, retribution);
        const events = player.game.events;
        if (events !== undefined) {
          const kind = this.type === CardType.CORPORATION ? 'corporation' : 'card';
          events.withEffectSource(claimant, {kind, card: this.name, owner: player.color}, 'insurance-claim', credit);
        } else {
          credit();
        }
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
