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

    const orOptionsPlants = new RemoveAnyPlants(player, 5).execute();
    const removePlants = orOptionsPlants !== undefined ?
      orOptionsPlants.options.slice(0, -1) :
      undefined;

    if (removeAnimals === undefined && removePlants === undefined) {
      return undefined;
    }

    const orOptions = new OrOptions();
    if (removeAnimals !== undefined) {
      orOptions.options.push(removeAnimals);
    }
    if (removePlants !== undefined) {
      orOptions.options.push(...removePlants);
    }
    orOptions.options.push(new SelectOption('Skip removal'));

    return orOptions;
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
    if (orOptions === undefined) {
      return actionPreviews.playPreview(this, player);
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
    if (plantTargets.length > 0) {
      step.plant = {label: 'Plants', icon: 'plants', amount: 5, targets: plantTargets};
    }
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
