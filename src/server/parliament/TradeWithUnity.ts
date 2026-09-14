import {IPlayer} from '../IPlayer';
import {IColony} from '../colonies/IColony';
import {IColonyTrader} from '../colonies/IColonyTrader';
import {PartyName} from '../../common/turmoil/PartyName';
import {message} from '../logs/MessageBuilder';
import {partySource} from './parties/PartyEffects';

/**
 * THE UNITY PARTY ACTION as a colony-trade payment path (rulebook p.3, project
 * decision Q6): once per generation the player trades for FREE; a free trade
 * still needs a free trade fleet and respects a busy colony — both are the
 * ordinary trade action's own gates, which this trader rides instead of
 * restating. The «you may advance the track 1 step before the trade» rides
 * `Colony.trade`'s `bonusTradeOffset`, which asks the player when the choice
 * matters (the same path Trading Colony uses).
 */
export class TradeWithUnity implements IColonyTrader {
  constructor(private player: IPlayer) {}

  private hasAccess(): boolean {
    return this.player.game.parliament?.hasPartyEffect(this.player, PartyName.UNITY) === true;
  }

  public canUse(): boolean {
    const parliament = this.player.game.parliament;
    return parliament !== undefined && this.hasAccess() && parliament.partyActionUsesLeft(this.player, PartyName.UNITY) > 0;
  }

  public optionText() {
    return message('Trade for free (${0} action)', (b) => b.partyName(PartyName.UNITY));
  }

  public optionMetadata() {
    // `party` is the path's STRUCTURAL identity (the card-powered paths carry
    // `card` for the same reason): the console's Unity door locks the trade to
    // this very option without reading its translated label.
    return {kind: 'generic' as const, icon: 'megacredits', amount: 0, party: PartyName.UNITY, description: 'Free trade — the Unity party action, once per generation. You may advance the colony track 1 step first.'};
  }

  /** `undefined` (hidden) without access — there is no option to explain; a used action is shown greyed with its reason. */
  public disabledReason() {
    if (!this.hasAccess()) {
      return undefined;
    }
    return 'The Unity action was already used this generation';
  }

  public trade(colony: IColony) {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      throw new Error('No parliament');
    }
    const events = this.player.game.events;
    events.withSource(partySource(PartyName.UNITY, this.player), () => {
      parliament.recordPartyActionUse(this.player, PartyName.UNITY);
      this.player.game.log('${0} used the ${1} action to trade for free with ${2}', (b) => b.player(this.player).partyName(PartyName.UNITY).colony(colony));
    });
    colony.trade(this.player, {}, 1);
  }
}
