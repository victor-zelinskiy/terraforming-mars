import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {Priority} from './Priority';
import {CapturedEventContext} from '../events/EventRecorder';

export interface AndThen<T> {
  andThen(cb: (param: T) => void): this;
}

export interface IDeferredAction <T = undefined> extends AndThen<T> {
  queueId: number;
  player: IPlayer;
  priority: Priority;
  // Analytics correlation scope captured when this action was deferred, so its
  // impact links back to the action/effect that queued it. Not serialized.
  eventContext?: CapturedEventContext;
  /**
   * It may move a delegate on a resolution of the voting area (a grant, a removal) — MarsBot's vote
   * stakes read it to tell a passed seat that still owes such a move (D15, `automa/BotVoteStakes.ts`).
   */
  readonly changesVotes?: boolean;
  execute(): PlayerInput | undefined;
}

export abstract class DeferredAction<T = undefined> implements IDeferredAction<T> {
  // The position in the queue. Do not set directly.
  public queueId: number = -1;
  // Analytics correlation scope; set by the queue when this action is pushed.
  public eventContext?: CapturedEventContext;
  constructor(
    public player: IPlayer,
    public priority: Priority = Priority.DEFAULT,
  ) {}

  public abstract execute(): PlayerInput | undefined;
  protected cb: (param: T) => PlayerInput | undefined | void = () => {};
  private callbackSet = false;

  public andThen(cb: (param: T) => void): this {
    if (this.callbackSet) {
      throw new Error('Cannot call andThen twice for the same object.');
    }
    this.cb = cb;
    this.callbackSet = true;
    return this;
  }
}

export class SimpleDeferredAction<T> extends DeferredAction<T> {
  constructor(
    player: IPlayer,
    public execute: () => PlayerInput | undefined,
    priority?: Priority,
  ) {
    super(player, priority);
  }
}
