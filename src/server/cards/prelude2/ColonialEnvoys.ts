import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Card} from '../Card';
import {CardRenderer} from '../render/CardRenderer';
import {PartyName} from '../../../common/turmoil/PartyName';

export class ColonialEnvoys extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 4,
      name: CardName.COLONIAL_ENVOYS,
      type: CardType.EVENT,
      requirements: {party: PartyName.UNITY},

      behavior: {
        turmoil: {sendDelegates: {count: {colonies: {}}, manyParties: true}},
      },

      metadata: {
        cardNumber: 'P70',
        // Redux voice: «in a party» is «on a resolution of the VOTING AREA» (never the enacted law), and «you may
        // place them in separate parties» is a SERIES of grants — the political FACADE asks each delegate as its
        // own decision (`PoliticalOps.placeDelegates`, `votePrompt.series`). The scan's asterisk is printed and
        // stays: its referent («you may add them to different resolutions») is the text's last clause.
        description: 'Requires that Unity is ruling or that you have 2 delegates there. Add 1 delegate per colony you have — you may add them to different resolutions.',
        renderData: CardRenderer.builder((b) => {
          b.delegates(1).asterix().slash().colonies(1).br;
        }),
      },
    });
  }
}
