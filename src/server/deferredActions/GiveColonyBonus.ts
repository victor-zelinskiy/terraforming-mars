import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {ColonyName} from '../../common/colonies/ColonyName';
import {Resource} from '../../common/Resource';
import {IColony} from '../colonies/IColony';
import {AutomaColonies} from '../automa/AutomaColonies';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {MultiSet} from 'mnemonist';

export class GiveColonyBonus extends DeferredAction {
  private waitingFor = new MultiSet<PlayerId>();
  private playersWithBonuses = new Set<PlayerId>();
  /** Cubes each recipient started with — the denominator of the ordinal. */
  private totals = new Map<PlayerId, number>();

  constructor(
    player: IPlayer,
    public colony: IColony,
    public selfish: boolean = false, // Used for CoordinatedRaid.
  ) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    if (this.colony.colonies.length === 0) {
      this.cb(undefined);
      return undefined;
    }

    for (const playerId of this.colony.colonies) {
      if (!this.selfish) {
        // Normal behavior; colony owners get their bonuses.
        this.waitingFor.add(playerId);
        this.playersWithBonuses.add(playerId);
      } else {
        // Selfish behavior, `player` gets all the colony bonuses.
        this.waitingFor.add(this.player.id);
        this.playersWithBonuses.add(this.player.id);
      }
    }

    for (const playerId of this.waitingFor.keys()) {
      this.totals.set(playerId, this.waitingFor.get(playerId) ?? 1);
    }
    for (const playerId of this.waitingFor.keys()) {
      const bonusPlayer = this.player.game.getPlayerById(playerId);
      this.giveColonyBonus(bonusPlayer);
    }

    return undefined;
  }

  private giveColonyBonus(player: IPlayer): void {
    const remaining = this.waitingFor.get(player.id) ?? 0;
    if (remaining > 0) {
      /*
       * ONE CUBE AT A TIME — the rules resolve each colony separately and in
       * full before the next one starts (Pluto: draw 1, discard 1, then the
       * next). The ordinal rides along so an interactive bonus can present
       * WHICH of the recipient's colonies is resolving.
       */
      const total = this.totals.get(player.id) ?? remaining;
      const ordinal = {index: total - remaining + 1, total};
      this.waitingFor.remove(player.id);
      // MarsBot never takes the printed colony bonus (nor any prompt): it gains
      // 1 resource into the matching storage area — Europa: 1 M€ into its
      // supply (Adding Expansions p.5).
      if (player.isMarsBot) {
        if (this.colony.name === ColonyName.EUROPA) {
          player.stock.add(Resource.MEGACREDITS, 1, {log: true});
        } else {
          AutomaColonies.addToStorage(player.game, this.colony.name, 1);
        }
        this.giveColonyBonus(player);
        return;
      }
      // The TRADER rides along: a bonus paid to somebody else is a DELIVERY
      // the recipient collects themselves (Colony.giveBonusImpl → DRAW_CARDS),
      // while the trader's own cube resolves inline on the stage they are
      // already watching. `selfish` (CoordinatedRaid) makes the trader the
      // recipient of every cube, so it is inline by construction.
      const input = this.colony.giveColonyBonus(player, true, ordinal, this.player);
      if (input !== undefined) {
        // The continuation must RESTORE this delivery's own captured scope:
        // `Player.process` deliberately runs `waitingForCb` OUTSIDE the
        // prompt's context (a continuation usually drives the rest of the
        // turn), so cube #2..n of a multi-colony payout would otherwise
        // resolve scope-less — its events minting orphan correlations
        // detached from the trade the player is watching.
        player.setWaitingFor(input, () => {
          const events = player.game?.events;
          if (events !== undefined) {
            events.runWithContext(this.eventContext, () => this.giveColonyBonus(player));
          } else {
            this.giveColonyBonus(player);
          }
        });
        // The drain is pausing on this recipient's prompt — the same realtime
        // blind spot as DeferredActionsQueue.run: without an invalidation an
        // off-turn recipient learns about the prompt only on the long poll.
        player.game.notifyStateChange();
      } else {
        this.giveColonyBonus(player);
      }
    } else {
      this.playersWithBonuses.delete(player.id);
      this.doneGettingBonus();
    }
  }

  private doneGettingBonus(): void {
    if (this.playersWithBonuses.size === 0) {
      this.cb(undefined);
    }
  }
}
