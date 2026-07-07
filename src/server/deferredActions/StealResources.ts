import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {disabledPlayerTarget, stealResourceFromPlayer, skip} from '../inputs/optionMetadata';
import {AutomaTargeting} from '../automa/AutomaTargeting';

export class StealResources extends DeferredAction {
  constructor(
    player: IPlayer,
    public resource: Resource,
    public count: number = 1,
    public title: string | Message = message('Select player to steal up to ${0} ${1} from', (b) => b.number(count).string(resource)),
    public mandatory: boolean = false,
  ) {
    super(player, Priority.ATTACK_OPPONENT);
  }

  public static getCandidates(
    player: IPlayer,
    resource: Resource,
    count: number,
    mandatory: boolean = false): Array<IPlayer> {
    return player.opponents.filter((p) => {
      const minimum = mandatory ? count : 1;
      // MarsBot's stealable stock = the matching storage area + its M€-supply proxy.
      const amt = AutomaTargeting.attackableStock(p, resource);
      if (amt < minimum) {
        return false;
      }
      if (resource === Resource.PLANTS) {
        if (p.plantsAreProtected()) {
          return false;
        }
        if (p.tableau.has(CardName.BOTANICAL_EXPERIENCE)) {
          if (amt < minimum * 2) {
            return false;
          }
        }
      }
      if ((resource === Resource.STEEL || resource === Resource.TITANIUM)) {
        if (p.alloysAreProtected()) {
          return false;
        }
      }
      return true;
    });
  }

  public execute() {
    if (this.player.game.isSoloMode()) {
      this.player.stock.add(this.resource, this.count);
      this.player.resolveInsuranceInSoloGame();
      return undefined;
    }
    return this.buildOptions();
  }

  /**
   * SIDE-EFFECT-FREE construction of the steal OrOptions (each option's attack
   * lives in its `andThen`, so building it mutates nothing). Shared by `execute()`
   * and the read-only preview (`previewOptions`), so the live prompt and the
   * pre-collected play-modal step can't drift. Returns `undefined` when there's no
   * valid target.
   */
  public buildOptions(): OrOptions | undefined {
    const candidates = StealResources.getCandidates(this.player, this.resource, this.count, this.mandatory);

    if (candidates.length === 0) {
      return undefined;
    }

    const stealOptions = candidates.map((target) => {
      const stealable = AutomaTargeting.attackableStock(target, this.resource);
      let qtyToSteal = Math.min(stealable, this.count);

      // Botanical Experience hook.
      if (this.resource === Resource.PLANTS && target.tableau.has(CardName.BOTANICAL_EXPERIENCE)) {
        qtyToSteal = Math.ceil(qtyToSteal / 2);
      }

      return new SelectOption(
        message('Steal ${0} ${1} from ${2}', (b) => b.number(qtyToSteal).string(this.resource).player(target)),
        'Steal')
        .withMetadata(stealResourceFromPlayer(target, this.resource, qtyToSteal, stealable))
        .andThen(() => {
          target.attack(this.player, this.resource, qtyToSteal, {log: true, stealing: true});
          return undefined;
        });
    });

    if (!this.mandatory) {
      stealOptions.push(new SelectOption('Do not steal').withMetadata(skip()));
    }

    // Surface opponents we can't steal from as greyed cards with a reason. A
    // mandatory steal needs the FULL `count` (Air Raid: 5 M€), so a player with
    // SOME but fewer than that reads "Not enough to steal" — not the misleading
    // "Nothing to steal" (which is only true at 0).
    const disabled = this.player.opponents
      .filter((p) => !candidates.includes(p))
      .map((p) => {
        const protectedResource =
          (this.resource === Resource.PLANTS && p.plantsAreProtected()) ||
          ((this.resource === Resource.STEEL || this.resource === Resource.TITANIUM) && p.alloysAreProtected());
        let reason: string;
        if (protectedResource) {
          reason = 'Resources are protected';
        } else if (AutomaTargeting.attackableStock(p, this.resource) === 0) {
          reason = 'Nothing to steal';
        } else {
          reason = 'Not enough to steal';
        }
        return disabledPlayerTarget(p, this.resource, reason);
      });

    return new OrOptions(...stealOptions).setDisabledOptions(disabled);
  }

  /** READ-ONLY preview of the steal OrOptions (no solo-mode mutation) — for the
   *  play modal to host the SAME picker the live follow-up would. */
  public previewOptions(): OrOptions | undefined {
    if (this.player.game.isSoloMode()) {
      return undefined;
    }
    return this.buildOptions();
  }
}
