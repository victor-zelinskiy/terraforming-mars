import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {delegateReserveReason} from '../../models/actionUnavailableReasons';

/** The printed delegates — read by the play, the gate and the burn's reason alike. */
const DELEGATES = 3;


export class RiseToPower extends PreludeCard {
  constructor() {
    super({
      name: CardName.RISE_TO_POWER,

      // DECLARATIVE WHOLE (P60 · ledger FW), Turmoil Redux voice. «Place them in separate parties» is a SERIES of
      // grants: the political FACADE asks each of the three delegates as its own decision onto a resolution of the
      // VOTING AREA (`PoliticalOps.placeDelegates {oneParty: false}` → three `PlaceDelegatesOnResolution(1)` marked
      // `votePrompt.series {index, of}` — never the enacted law). The reserve must cover all three (`canExecute`, the
      // named «Delegates in your reserve: N of 3»); the production resolves at play, the grants are deferred after it.
      // The scan's asterisk is printed and stays: its referent is the text's last clause.
      behavior: {
        production: {megacredits: 3},
        turmoil: {sendDelegates: {count: DELEGATES, manyParties: true}},
      },

      metadata: {
        cardNumber: 'P60',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(3)).delegates(3).asterix().br;
        }),
        description: 'Increase your M€ production 3 steps. Add 3 delegates — you may add them to different resolutions.',
      },
    });
  }

  /**
   * A BURN NAMES ITS CAUSE (the P59 · FV class): a prelude is no project card, so the hand's reason engine never asks
   * it — a prelude picked mid-game (WG Project, Board of Directors) whose reserve cannot cover the three delegates would
   * burn with no reason on its rail. The card states its own, through the ONE builder of the class (the facade's
   * reserve, the number `canExecute` gates on): «Delegates in your reserve: 2 of 3».
   */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return delegateReserveReason(player, DELEGATES);
  }
}
