import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {PlayerInput} from '../../PlayerInput';
import {CardName} from '../../../common/cards/CardName';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {CardResource} from '../../../common/CardResource';
import {RemoveAnyPlants} from '../../deferredActions/RemoveAnyPlants';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import {CardRenderer} from '../render/CardRenderer';
import {all, digit} from '../Options';
import {ActionPreview, TabbedPlantTarget, TabbedTargetsStep} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {AutomaTargeting} from '../../automa/AutomaTargeting';
import {ColonyName} from '../../../common/colonies/ColonyName';
import {message} from '../../logs/MessageBuilder';

export class Virus extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.VIRUS,
      tags: [Tag.MICROBE],
      cost: 1,

      metadata: {
        cardNumber: '050',
        renderData: CardRenderer.builder((b) => {
          b.minus().resource(CardResource.ANIMAL, {amount: 2, all, digit}).nbsp;
          b.or().nbsp.minus().plants(5, {all, digit});
        }),
        description: 'Remove up to 2 animals or 5 plants from any player.',
      },
    });
  }
  public override bespokePlay(player: IPlayer): PlayerInput | undefined {
    if (player.game.isSoloMode()) {
      // TODO(kberg): Special case for Mons Insurance owner.
      player.game.someoneHasRemovedOtherPlayersPlants = true;
      return undefined;
    }

    const orOptions = this.buildRemovalOptions(player);
    if (orOptions === undefined) {
      // If no other player has resources to remove.
      player.game.log('There was nobody to steal plants or animals from.');
      return undefined;
    }
    return orOptions;
  }

  // SIDE-EFFECT-FREE (non-solo) construction of the "remove up to 2 animals OR 5
  // plants" OrOptions — the removals live in each option's `andThen`, so building
  // it mutates nothing. Shared by `bespokePlay` and the read-only `cardPlayPreview`
  // so the live prompt and the pre-collected tabbed step can't drift. Returns
  // undefined when there's nobody to remove from. Structure: [animal SelectCard?,
  // ...opponent plant SelectOptions, skip].
  public buildRemovalOptions(player: IPlayer): OrOptions | undefined {
    const orOptionsAnimals = new RemoveResourcesFromCard(player, CardResource.ANIMAL, 2, {mandatory: false, log: true}).execute() as OrOptions;
    const removeAnimals = orOptionsAnimals !== undefined ?
      orOptionsAnimals.options[0] :
      undefined;

    // The ACTIONABLE opponent plant-removal options directly (no skip/own/disabled to
    // slice off): this keeps the structure EXACTLY [animal?, ...opponent plants, skip]
    // so the pre-collected tab indices line up, and is immune to how the shared
    // RemoveAnyPlants prompt surfaces protected opponents (which is handled below).
    const removePlants = new RemoveAnyPlants(player, 5).opponentOptions();

    if (removeAnimals === undefined && removePlants.length === 0) {
      return undefined;
    }

    const orOptions = new OrOptions();
    if (removeAnimals !== undefined) {
      orOptions.options.push(removeAnimals);
    }
    orOptions.options.push(...removePlants);
    // MarsBot as an animal target: the Miranda storage animals ("as usual",
    // Adding Expansions p.5) + the M€-supply proxy (rulebook p.4). Appended
    // AFTER the plant options so the two-tab preview's introspected indices
    // for animals/plants stay untouched.
    const bot = player.opponents.find((p) => p.isMarsBot);
    if (bot !== undefined) {
      const removable = Math.min(2, AutomaTargeting.cardResourceLikeStock(player.game, ColonyName.MIRANDA));
      if (removable > 0) {
        orOptions.options.push(new SelectOption(
          message('Remove ${0} animals from ${1}', (b) => b.number(removable).player(bot)), 'Remove animals')
          .andThen(() => {
            AutomaTargeting.removeCardResourceLikeFromBot(player.game, removable, ColonyName.MIRANDA);
            return undefined;
          }));
      }
    }
    orOptions.options.push(new SelectOption('Skip removal'));

    return orOptions;
  }

  /** Opponents whose plants are PROTECTED — shown as greyed, non-selectable rows in
   *  the plant tab so the player SEES the protection rather than the opponent silently
   *  missing from the list (mirrors the standard plant-attack modal's disabled
   *  targets). They carry no `optionIndex` (never submitted). */
  private protectedPlantTargets(player: IPlayer): Array<TabbedPlantTarget> {
    return player.opponents
      .filter((p) => p.plantsAreProtected())
      .map((p) => ({color: p.color, name: p.name, current: p.plants, resulting: p.plants, optionIndex: -1, disabled: true, reason: 'Plants are protected'}));
  }

  // PRE-COLLECT the removal choice IN the play modal as a TWO-TAB picker (Animals /
  // Plants): each tab shows its valid targets — animal-holding cards grouped by
  // owner, or player plant targets — with a `current → resulting` impact, so the
  // player sees EXACTLY what is removed and from whom BEFORE the single submit. The
  // tab/target → OrOptions-index mapping is read from the SAME OrOptions bespokePlay
  // builds (introspected by type + metadata), so the pre-collected pick replays
  // byte-for-byte. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const orOptions = this.buildRemovalOptions(player);
    const protectedTargets = this.protectedPlantTargets(player);
    if (orOptions === undefined) {
      // Nothing actionable. If an opponent's plants are PROTECTED, say so with a
      // warning (a mandatory tab can't be all-disabled, and a silent no-op would
      // leave the player wondering why nothing happened); otherwise nobody had
      // anything to take — emit the generic "no valid target" warning (outside
      // solo) so the modal is never blank about the skipped removal.
      const steps = protectedTargets.length > 0 ?
        [actionPreviews.warningNote('Plants are protected')] :
        [actionPreviews.targetStepOrWarning(player, undefined)];
      return actionPreviews.playPreview(this, player, [], steps);
    }
    const step: TabbedTargetsStep = {kind: 'tabbedTargets'};
    const plantTargets: Array<TabbedPlantTarget> = [];
    orOptions.options.forEach((opt, i) => {
      if (opt instanceof SelectCard) {
        // The animal removal: a card pick (remove up to 2 from the chosen card).
        step.animal = {label: 'Animals', icon: 'animal', amount: 2, branchIndex: i, input: opt.toModel(player)};
      } else if (opt instanceof SelectOption && opt.metadata?.kind === 'resourceRemoval' && opt.metadata.player !== undefined) {
        // A plant removal from a specific player.
        const pl = opt.metadata.player;
        const target = player.game.players.find((p) => p.color === pl.color);
        plantTargets.push({
          color: pl.color,
          name: target?.name ?? '',
          current: pl.current ?? 0,
          resulting: pl.resulting ?? 0,
          optionIndex: i,
        });
      }
    });
    // Append PROTECTED opponents as greyed, non-selectable rows, so the player sees
    // them (and won't wonder where a known opponent went / mistarget). The tab still
    // has at least one selectable target (an actionable plant opponent or — via the
    // animal tab — a card), so the mandatory step is always satisfiable.
    plantTargets.push(...protectedTargets);
    if (plantTargets.length > 0) {
      step.plant = {label: 'Plants', icon: 'plants', amount: 5, targets: plantTargets};
    }
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
