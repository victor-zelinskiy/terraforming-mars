import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {SelectPlayer} from '../inputs/SelectPlayer';
import {ChoiceContextSource, SelectPlayerModel} from '../../common/models/PlayerInputModel';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
// Runtime-only reads (a late-bound circular import, like AddResourcesToCard's).
import {SKIP_REASON, SKIPPED_LABEL, skippedAttackChip} from '../cards/actionPreviews';
import {recordSkippedEffect} from './skippedEffect';

export type Options = {
  count: number,
  stealing?: boolean,
  /** WHO caused this attack — see `inputs/choiceContext.ts`. */
  cause?: ChoiceContextSource,
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
      // No silent loss: the attack the preview warned about names itself in the record.
      recordSkippedEffect(this.player, SKIP_REASON.noTarget, {
        label: SKIPPED_LABEL.reduceProduction,
        effect: skippedAttackChip(this.resource, this.options.count, 'production'),
      });
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
    const select = new SelectPlayer(targets, this.title, 'Decrease', {
      icon: this.resource,
      amount: this.options.count,
      scope: 'production',
      disabled: this.blockedTargets(targets),
    });
    return this.options.cause === undefined ?
      select :
      select.markChoiceContext({source: this.options.cause, mode: 'attack'});
  }

  /**
   * READ-ONLY: the `SelectPlayerModel` the live path WOULD present, or `undefined`
   * ONLY when there is genuinely NO choice (solo mode, or no valid target). A single
   * opponent is STILL shown (no auto-attack) so the modal always reveals WHO loses
   * production and its `current → resulting`. Used by the action-preview builder to
   * host the target picker INSIDE the confirmation modal — no mutation. Mirrors
   * `execute` exactly so the pre-collected pick replays byte-for-byte.
   *
   * `ownGain` — the steps of THIS production the player gains BEFORE the decrease runs («gain your own in order to
   * lose it»: Energy Tapping / Power Supply Consortium when nobody holds energy production — the box's count on
   * `b9254000a8`, game 2181: the preview said «no production can be reduced», and the live path then asked the
   * player to pick THEMSELVES after the commit). The preview counts that gain, so the picker it hosts is the very one
   * the live path asks after it, and the player's own `current → resulting` reads the production the gain leaves.
   */
  public previewSelectPlayer(ownGain: number = 0): SelectPlayerModel | undefined {
    if (this.player.game.isSoloMode()) {
      return undefined;
    }
    const floor = this.resource === Resource.MEGACREDITS ? -5 : 0;
    const gainedSelf = (p: IPlayer): boolean => ownGain > 0 && p === this.player && !p.isMarsBot &&
      p.production[this.resource] + ownGain - floor >= this.options.count;
    const targets = this.player.game.players.filter((p) => p.canHaveProductionReduced(this.resource, this.options.count, this.player) || gainedSelf(p));
    if (targets.length === 0) {
      return undefined;
    }
    const model = this.buildSelectPlayer(targets).toModel();
    if (ownGain === 0 || model.targetImpacts === undefined) {
      return model;
    }
    const count = this.options.count;
    return {
      ...model,
      targetImpacts: model.targetImpacts.map((impact) => impact.color !== this.player.color ? impact : {
        ...impact,
        changes: impact.changes.map((change) => change.scope !== 'production' ? change :
          {...change, from: change.from + ownGain, to: Math.max(floor, change.from + ownGain - count)}),
      }),
    };
  }

  /**
   * Players who are relevant but can't have this production reduced, with a
   * user-facing reason (mirrors Player.canHaveProductionReduced).
   *
   * Walks `game.players`, NOT `opponents` — the candidate list at the call site
   * is `game.players` (self-targeting is legal for several cards), so iterating
   * opponents made the VIEWER vanish from their own picker with no explanation
   * whenever their own production sat at the minimum.
   */
  private blockedTargets(valid: ReadonlyArray<IPlayer>): Array<{player: IPlayer, reason: string | Message}> {
    const result: Array<{player: IPlayer, reason: string | Message}> = [];
    for (const target of this.player.game.players) {
      if (valid.includes(target)) {
        continue;
      }
      // Same order as canHaveProductionReduced: the minimum first, then the two
      // protections — and protection from an attacker never applies to yourself.
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
