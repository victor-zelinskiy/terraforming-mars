import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {SelectPlayer} from '../inputs/SelectPlayer';
import {SelectPlayerModel} from '../../common/models/PlayerInputModel';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';

export type Options = {
  count: number,
  stealing?: boolean
}

export class DecreaseAnyProduction extends DeferredAction<boolean> {
  constructor(
    player: IPlayer,
    public resource: Resource,
    public options: Options = {
      count: 1,
      stealing: false,
    },
    public title: string | Message = message('Select player to decrease ${0} production by ${1} step(s)', (b) => b.string(resource).number(options.count)),
  ) {
    super(player, Priority.ATTACK_OPPONENT);
  }

  private attack(target: IPlayer): void {
    const msg = message('lose ${0} ${1} production', (b) => b.number(this.options.count).string(this.resource));
    target.maybeBlockAttack(this.player, msg, (proceed: boolean) => {
      if (proceed) {
        target.production.add(this.resource, -this.options.count, {log: true, from: {player: this.player}, stealing: this.options.stealing});
      }
      this.cb(proceed);
      return undefined;
    });
  }

  public execute() {
    if (this.player.game.isSoloMode()) {
      this.player.resolveInsuranceInSoloGame();
      this.cb(true);
      return undefined;
    }
    const targets = this.player.game.players.filter((p) => p.canHaveProductionReduced(this.resource, this.options.count, this.player));

    if (targets.length === 0) {
      this.cb(false);
      return undefined;
    }
    // ALWAYS ask which player — EVEN a single opponent — so the player SEES the
    // target and its production `current → resulting` before committing. The old
    // "single non-self target → auto-attack" was a silent auto-select (the legacy
    // anti-pattern this fork removed everywhere — see AddResourcesToCard). The
    // premium play / action modal pre-collects this SelectPlayer; the legacy path
    // shows it live.
    return this.buildSelectPlayer(targets)
      .andThen((candidate) => {
        this.attack(candidate);
        return undefined;
      });
  }

  /**
   * Resource enum values double as standard-resource icon keys, so the premium
   * player picker shows a per-target "production: X → Y" preview. Opponents who
   * CAN'T be reduced are surfaced as disabled cards with a reason instead of
   * silently vanishing. Shared by the live path and the read-only preview so the
   * two never drift.
   */
  private buildSelectPlayer(targets: ReadonlyArray<IPlayer>): SelectPlayer {
    return new SelectPlayer(targets, this.title, 'Decrease', {
      icon: this.resource,
      amount: this.options.count,
      scope: 'production',
      disabled: this.blockedTargets(targets),
    });
  }

  /**
   * READ-ONLY: the `SelectPlayerModel` the live path WOULD present, or `undefined`
   * ONLY when there is genuinely NO choice (solo mode, or no valid target). A single
   * opponent is STILL shown (no auto-attack) so the modal always reveals WHO loses
   * production and its `current → resulting`. Used by the action-preview builder to
   * host the target picker INSIDE the confirmation modal — no mutation. Mirrors
   * `execute` exactly so the pre-collected pick replays byte-for-byte.
   */
  public previewSelectPlayer(): SelectPlayerModel | undefined {
    if (this.player.game.isSoloMode()) {
      return undefined;
    }
    const targets = this.player.game.players.filter((p) => p.canHaveProductionReduced(this.resource, this.options.count, this.player));
    if (targets.length === 0) {
      return undefined;
    }
    return this.buildSelectPlayer(targets).toModel();
  }

  /** Opponents who are relevant but can't have this production reduced, with a
   *  user-facing reason (mirrors Player.canHaveProductionReduced). */
  private blockedTargets(valid: ReadonlyArray<IPlayer>): Array<{player: IPlayer, reason: string | Message}> {
    const result: Array<{player: IPlayer, reason: string | Message}> = [];
    for (const target of this.player.opponents) {
      if (valid.includes(target)) {
        continue;
      }
      const reducable = target.production[this.resource] + (this.resource === Resource.MEGACREDITS ? 5 : 0);
      let reason: string | Message = 'Production is protected';
      if (reducable < this.options.count) {
        reason = 'Production already at minimum';
      }
      result.push({player: target, reason});
    }
    return result;
  }
}
