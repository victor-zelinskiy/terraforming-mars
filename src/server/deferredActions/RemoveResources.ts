import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {UnderworldExpansion} from '../underworld/UnderworldExpansion';
import {message} from '../logs/MessageBuilder';

export class RemoveResources extends DeferredAction<number> {
  constructor(
    private target: IPlayer,
    public perpetrator: IPlayer,
    public resource: Resource,
    public count: number = 1,
  ) {
    super(target, Priority.ATTACK_OPPONENT);
  }

  public execute() {
    // Scoped to the PERPETRATOR: this deferred also carries the «EVERY player
    // loses N» cards (Small Comet, Plant Tax), whose caster is their own
    // target — and no printed protection defends anyone from themselves.
    if (this.target.isProtectedFrom(this.resource, this.perpetrator)) {
      this.cb(0);
      return undefined;
    }

    let qtyLost = Math.min(this.target.stock.get(this.resource), this.count);

    // Botanical Experience hook (opponents only, same as the protections).
    if (this.resource === Resource.PLANTS && this.target.losesHalfFrom(this.perpetrator)) {
      qtyLost = Math.ceil(qtyLost / 2);
    }

    if (qtyLost === 0) {
      // Nothing to take is still an ANSWER: the protected branch above reports
      // it, so an empty stock must too — a caller chaining `andThen` otherwise
      // waits forever for a callback that never comes.
      this.cb(0);
      return undefined;
    }
    const msg = message('lose ${0} ${1}', (b) => b.number(qtyLost).string(this.resource));
    // Move to this.target.maybeBlockAttack?
    this.target.defer(UnderworldExpansion.maybeBlockAttack(this.target, this.perpetrator, msg, (proceed) => {
      if (proceed) {
        this.target.stock.deduct(this.resource, qtyLost, {log: true, from: {player: this.perpetrator}});
        this.cb(qtyLost);
      }
      return undefined;
    }));
    return undefined;
  }
}
