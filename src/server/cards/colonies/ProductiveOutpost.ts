import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {allColonyBonusesEffects, allColonyBonusesLedger, gainAllColonyBonuses} from '../../colonies/allColonyBonuses';
import * as actionPreviews from '../actionPreviews';

export class ProductiveOutpost extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 0,
      name: CardName.PRODUCTIVE_OUTPOST,
      type: CardType.AUTOMATED,

      metadata: {

        infoText: [

          {text: 'Gain all your colony bonuses.', tokens: ['colonies']},

        ],
        cardNumber: 'C30',
        renderData: CardRenderer.builder((b) => {
          b.colonies().asterix();
        }),
      },
    });
  }

  // «Gain all your colony bonuses» is ONE rule with one module
  // (`colonies/allColonyBonuses.ts` — Habitat Science, Yvonne and the
  // resolution Colonial Affairs pay the same bonuses through it): every cube
  // of the player's pays its tile's printed colony bonus, one at a time, in
  // the order Titania → the table → Leavitt.
  //
  // TODO(kberg): Make it possible for Leavitt to resolve before Titania.

  public override bespokePlay(player: IPlayer) {
    gainAllColonyBonuses(player, {via: this.name});
    return undefined;
  }

  // PRE-COMPUTE the result IN the play modal: "Gain all your colony bonuses" is a
  // VARIABLE multi-resource bundle, but at modal-open time every owned colony's
  // FIXED `metadata.colony` bonus is known. So the modal shows EXACTLY what the
  // player gets (aggregated resource / production / draw / TR / Venus / card-resource
  // chips), the LEDGER behind those sums (a row per colony, in the order the
  // engine pays them) and the card target of every «add a resource to a card»
  // bonus as a step collected before the confirm. Built read-only (no mutation).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const options = {via: this.name};
    const {effects, steps} = allColonyBonusesEffects(player, options);
    return actionPreviews.playPreview(this, player, effects, steps, {colonyBonuses: allColonyBonusesLedger(player, options)});
  }
}
