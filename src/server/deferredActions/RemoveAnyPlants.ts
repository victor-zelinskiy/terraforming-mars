import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardName} from '../../common/cards/CardName';
import {MessageBuilder, message} from '../logs/MessageBuilder';
import {Message} from '../../common/logs/Message';
import {DisabledOptionModel} from '../../common/models/PlayerInputModel';
import {disabledPlayerTarget, removeResourceFromPlayer, skip} from '../inputs/optionMetadata';
import {AutomaTargeting} from '../automa/AutomaTargeting';
export class RemoveAnyPlants extends DeferredAction {
  private title: string | Message;
  private count: number;

  constructor(player: IPlayer, count: number = 1, title?: string | Message, priority: Priority = Priority.ATTACK_OPPONENT) {
    // Default ATTACK_OPPONENT. A card that ALSO places a tile passes
    // `Priority.PLAY_CARD_PLANT_REMOVAL` so the OrOptions prompts BEFORE the
    // placement and the play modal can pre-collect it (see Executor.execute).
    super(player, priority);
    this.count = count;
    this.title = title ?? message('Select player to remove up to ${0} plants', (b) => b.number(count));
  }

  private createOption(target: IPlayer) {
    // MarsBot's removable "plants" = the Ganymede storage + its M€-supply proxy
    // (attack() applies the composite removal).
    const removable = AutomaTargeting.attackableStock(target, Resource.PLANTS);
    let qtyToRemove = Math.min(removable, this.count);

    // Botanical Experience hook.
    if (target.tableau.has(CardName.BOTANICAL_EXPERIENCE)) {
      qtyToRemove = Math.ceil(qtyToRemove / 2);
    }

    const message =
      new MessageBuilder('Remove ${0} plants from ${1}')
        .number(qtyToRemove)
        .player(target)
        .getMessage();

    return new SelectOption(message, 'Remove plants')
      .withMetadata(removeResourceFromPlayer(target, Resource.PLANTS, qtyToRemove, removable))
      .andThen(() => {
        target.attack(this.player, Resource.PLANTS, qtyToRemove, {log: true});
        return undefined;
      });
  }

  public execute() {
    const player = this.player;
    const game = player.game;

    if (game.isSoloMode()) {
      const option = new SelectOption(
        'Remove plants from the neutral oppponent',
        'Remove plants')
        .andThen(() => {
          game.someoneHasRemovedOtherPlayersPlants = true;
          player.resolveInsuranceInSoloGame();
          return undefined;
        });

      // Shortcut. Only provide the opportunity if the player is playing Mons Insurance.
      if (game.monsInsuranceOwner !== player) {
        option.cb(undefined);
        return undefined;
      }

      const removalOptions: Array<SelectOption> = [option, this.skipOption()];
      if (player.plants > 0) {
        const ownOption = this.createOption(player);
        ownOption.warnings = ['removeOwnPlants'];
        removalOptions.push(ownOption);
      }
      return new OrOptions(...removalOptions).setTitle(this.title);
    }

    return this.buildOptions();
  }

  private skipOption(): SelectOption {
    return new SelectOption('Skip removing plants').withMetadata(skip()).andThen(() => {
      return undefined;
    });
  }

  /**
   * The ACTIONABLE opponent plant-removal options — one `SelectOption` per opponent
   * whose plants can actually be taken (NOT protected, has plants). NO skip / own /
   * disabled entries. Side-effect-free (each attack lives in its `andThen`). Exposed
   * so consumers that compose their own picker (Virus's two-tab Animals/Plants modal)
   * get exactly the live opponent options WITHOUT having to slice them out of the
   * full prompt — which silently broke when the prompt's tail wasn't `skip`.
   */
  public opponentOptions(): Array<SelectOption> {
    return this.player.opponents
      .filter((p) => !p.plantsAreProtected() && AutomaTargeting.attackableStock(p, Resource.PLANTS) > 0)
      .map((target) => this.createOption(target));
  }

  /**
   * Opponents shown as greyed, NON-selectable targets (with a reason) — a PROTECTED
   * opponent, or one with no plants. Surfaced so a protected opponent is never hidden
   * / silently auto-skipped: the attacker must SEE why those plants can't be taken
   * (and so can't mistakenly target themselves). Protection wins the reason when both
   * apply.
   */
  public disabledOpponents(): Array<DisabledOptionModel> {
    return this.player.opponents
      .filter((p) => p.plantsAreProtected() || AutomaTargeting.attackableStock(p, Resource.PLANTS) === 0)
      .map((p) => disabledPlayerTarget(p, 'plants', p.plantsAreProtected() ? 'Plants are protected' : 'No plants to remove'));
  }

  /**
   * SIDE-EFFECT-FREE construction of the (multiplayer) plant-removal OrOptions —
   * each option's attack lives in its `andThen`, so BUILDING it mutates nothing.
   * Shared by `execute()` and the read-only preview (`previewOptions`) so the live
   * prompt and the pre-collected play-modal step can't drift (the StealResources
   * pattern). The option ORDER (opponents, skip, self) is load-bearing: the play
   * modal captures the chosen INDEX and replays it against this same OrOptions
   * built live, so the two must enumerate identically.
   *
   * Returns `undefined` ONLY when there's nothing to ACT ON and nothing to INFORM
   * about — i.e. no opponent has removable plants AND none is protected. When an
   * opponent IS protected, the prompt is STILL shown (with the protected opponent as
   * a greyed, non-selectable target) instead of being silently skipped — so the
   * attacker learns the plants are protected rather than the effect vanishing without
   * a trace. An opponent that merely has 0 plants (and nobody is protected) stays a
   * silent no-op (an expected, non-informative situation — no modal spam every time
   * an opponent happens to be out of plants).
   */
  public buildOptions(): OrOptions | undefined {
    const player = this.player;
    const opponentOptions = this.opponentOptions();
    const hasProtectedOpponent = player.opponents.some((p) => p.plantsAreProtected());

    if (opponentOptions.length === 0 && !hasProtectedOpponent) {
      return undefined;
    }

    const removalOptions: Array<SelectOption> = [...opponentOptions, this.skipOption()];

    if (player.plants > 0) {
      const ownOption = this.createOption(player);
      ownOption.warnings = ['removeOwnPlants'];
      removalOptions.push(ownOption);
    }

    return new OrOptions(...removalOptions)
      .setTitle(this.title)
      .setDisabledOptions(this.disabledOpponents());
  }

  /** READ-ONLY preview of the plant-removal OrOptions (no solo-mode mutation) — lets
   *  the play modal host the SAME picker the live follow-up would, BEFORE confirm. */
  public previewOptions(): OrOptions | undefined {
    if (this.player.game.isSoloMode()) {
      return undefined;
    }
    return this.buildOptions();
  }
}
