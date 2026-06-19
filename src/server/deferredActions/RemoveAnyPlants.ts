import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardName} from '../../common/cards/CardName';
import {MessageBuilder, message} from '../logs/MessageBuilder';
import {Message} from '../../common/logs/Message';
import {disabledPlayerTarget, removeResourceFromPlayer, skip} from '../inputs/optionMetadata';
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
    let qtyToRemove = Math.min(target.plants, this.count);

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
      .withMetadata(removeResourceFromPlayer(target, Resource.PLANTS, qtyToRemove, target.plants))
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
   * SIDE-EFFECT-FREE construction of the (multiplayer) plant-removal OrOptions —
   * each option's attack lives in its `andThen`, so BUILDING it mutates nothing.
   * Shared by `execute()` and the read-only preview (`previewOptions`) so the live
   * prompt and the pre-collected play-modal step can't drift (the StealResources
   * pattern). The option ORDER (opponents, skip, self) is load-bearing: the play
   * modal captures the chosen INDEX and replays it against this same OrOptions
   * built live, so the two must enumerate identically. Returns `undefined` when no
   * opponent has removable plants (no prompt — the player never removes ONLY their
   * own plants).
   */
  public buildOptions(): OrOptions | undefined {
    const player = this.player;
    const candidates = player.opponents.filter((p) => !p.plantsAreProtected() && p.plants > 0);
    const removalOptions: Array<SelectOption> = candidates.map((target) => this.createOption(target));

    removalOptions.push(this.skipOption());

    if (removalOptions.length === 1) {
      return undefined;
    }

    if (player.plants > 0) {
      const ownOption = this.createOption(player);
      ownOption.warnings = ['removeOwnPlants'];
      removalOptions.push(ownOption);
    }

    // Surface opponents we can't take plants from as greyed cards with a reason.
    const disabled = player.opponents
      .filter((p) => p.plants === 0 || p.plantsAreProtected())
      .map((p) => disabledPlayerTarget(p, 'plants', p.plantsAreProtected() ? 'Plants are protected' : 'No plants to remove'));

    return new OrOptions(...removalOptions).setTitle(this.title).setDisabledOptions(disabled);
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
