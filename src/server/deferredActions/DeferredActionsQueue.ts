import {IDeferredAction} from './DeferredAction';
import {GiveColonyBonus} from './GiveColonyBonus';
import {IPlayer} from '../IPlayer';

export class DeferredActionsQueue {
  private insertId: number = 0;
  private queue: Array<IDeferredAction<any>> = [];

  get length(): number {
    return this.queue.length;
  }

  public push(action: IDeferredAction<any>): void {
    action.queueId = this.insertId++;
    // Capture the live analytics scope (by reference) so this action's impact
    // links to the action/effect that queued it, even though it runs later.
    action.eventContext = action.player.game?.events?.captureContext();
    this.queue.push(action);
  }

  /**
   * The correlation roots of every PENDING deferred action — the chains that
   * may still GROW when these actions run (each carries its captured event
   * context by reference). This is what lets the client hold a notification
   * in its PREPARED state until the causal chain is complete, instead of
   * presenting a half-story and enriching it on screen.
   */
  public openEventCorrelations(): Array<number> {
    const out: Array<number> = [];
    for (const action of this.queue) {
      const rootId = action.eventContext?.rootId;
      if (rootId !== undefined && !out.includes(rootId)) {
        out.push(rootId);
      }
    }
    return out;
  }

  public runAllFor(player: IPlayer, cb: () => void): void {
    let b: IDeferredAction | undefined;
    let j = -1;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const a = this.queue[i];
      if (a.player.id === player.id && (b === undefined || this.hasHigherPriority(a, b))) {
        b = a;
        j = i;
      }
    }
    if (b === undefined) {
      cb();
      return;
    }
    this.queue.splice(j, 1);
    this.run(b, () => this.runAllFor(player, cb));
  }

  private hasHigherPriority(a: IDeferredAction, b: IDeferredAction) {
    return a.priority < b.priority || (a.priority === b.priority && a.queueId < b.queueId);
  }

  private nextItemIndex(): number {
    if (this.queue.length === 0) {
      return -1;
    }
    let b = this.queue[0];
    let j = 0;
    for (let i = this.queue.length - 1; i >= 1; i--) {
      const a = this.queue[i];
      if (this.hasHigherPriority(a, b)) {
        b = a;
        j = i;
      }
    }
    return j;
  }

  private popNextItem(): IDeferredAction<any> | undefined {
    const next = this.nextItemIndex();
    const action = this.queue[next];
    if (action !== undefined) {
      this.queue.splice(next, 1);
    }
    return action;
  }

  public runAll(cb: () => void): void {
    const action = this.popNextItem();
    if (action !== undefined) {
      this.run(action, () => {
        this.runAll(cb);
      });
    } else {
      cb();
      return;
    }
  }

  // The following methods are used in tests
  public peek(): IDeferredAction<any> | undefined {
    return this.queue[this.nextItemIndex()];
  }

  public pop(): IDeferredAction<any> | undefined {
    return this.queue.splice(this.nextItemIndex(), 1)[0];
  }

  public run(action: IDeferredAction, cb: () => void): void {
    const events = action.player.game?.events;
    const runWith = <T>(fn: () => T): T => events !== undefined ?
      events.runWithContext(action.eventContext, fn) :
      fn();
    // Special hook for trade bonus deferred actions
    // So that they happen for all players at the same time
    if (action instanceof GiveColonyBonus) {
      action.andThen(cb);
      runWith(() => action.execute());
      return;
    }

    // Run execute — and register any follow-up prompt — INSIDE the action's
    // analytics scope, so the prompt captures it and the correlation chain
    // survives the player-input boundary. The continuation (cb) runs OUTSIDE the
    // scope: it drives the rest of the turn, not this action's effects.
    const waiting = runWith(() => {
      const input = action.execute();
      if (input !== undefined) {
        action.player.setWaitingFor(input, cb);
        return true;
      }
      return false;
    });
    if (waiting) {
      // The queue just PAUSED on this action's own player without reaching
      // `Player.takeAction` — the only other input-path site that emits the
      // realtime invalidation. When that player is NOT the one whose HTTP
      // request is being processed (an opponent's colony-bonus discard, a
      // forced reaction), nothing else tells their client to look: they sat
      // out the healthy-socket long poll (~20 s) while the server already
      // held a prompt for them. Announce the pause so every subscriber
      // re-checks `/api/waitingfor` now — the prompted player answers 'GO',
      // observers see the fresh gameAge as 'REFRESH'. An extra invalidation
      // for the submitter's own follow-up prompt is harmless (the client
      // coalesces and its own response already carries the prompt).
      action.player.game?.notifyStateChange();
    } else {
      cb();
    }
  }

  public runNext(): void {
    const action = this.pop();
    if (action !== undefined) {
      this.run(action, () => {});
    }
  }
}
