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
import {SelectCardModel} from '../../../common/models/PlayerInputModel';
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
  // ...opponent plant SelectOptions, MarsBot animal option?, skip].
  public buildRemovalOptions(player: IPlayer): OrOptions | undefined {
    // Extract the animal-CARD picker by TYPE (execute() may itself bundle a
    // MarsBot option now — we add the bot animal target separately below via the
    // shared helper so the tab classifies it cleanly by its 'animal' icon).
    const orOptionsAnimals = new RemoveResourcesFromCard(player, CardResource.ANIMAL, 2, {mandatory: false, log: true}).execute();
    const removeAnimals = orOptionsAnimals instanceof OrOptions ?
      orOptionsAnimals.options.find((o) => o instanceof SelectCard) :
      undefined;

    // The ACTIONABLE opponent plant-removal options directly (includes MarsBot as
    // a plant target via its M€-supply proxy). Immune to how the shared
    // RemoveAnyPlants prompt surfaces protected opponents (handled below).
    const removePlants = new RemoveAnyPlants(player, 5).opponentOptions();

    // MarsBot as an ANIMAL target: its Miranda shipping-board storage + the
    // M€-supply proxy (Automa rulebook, Adding Expansions p.5). The SAME shared
    // metadata-rich option Ants/Predators use, so the bot reads consistently; the
    // preview classifies it into the animal tab by its 'animal' icon. Appended
    // AFTER the plant options so the introspected tab option-indices stay stable.
    const botAnimals = RemoveResourcesFromCard.marsBotOption(player, CardResource.ANIMAL, 2);

    if (removeAnimals === undefined && removePlants.length === 0 && botAnimals === undefined) {
      return undefined;
    }

    const orOptions = new OrOptions();
    if (removeAnimals !== undefined) {
      orOptions.options.push(removeAnimals);
    }
    orOptions.options.push(...removePlants);
    if (botAnimals !== undefined) {
      orOptions.options.push(botAnimals);
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
    const animalTargets: Array<TabbedPlantTarget> = [];
    let animalCard: {branchIndex: number, input: SelectCardModel} | undefined;
    orOptions.options.forEach((opt, i) => {
      if (opt instanceof SelectCard) {
        // The animal removal from a CARD: a card pick (remove up to 2 from it).
        animalCard = {branchIndex: i, input: opt.toModel(player)};
      } else if (opt instanceof SelectOption && opt.metadata?.kind === 'resourceRemoval' && opt.metadata.player !== undefined) {
        // A player-target removal. Plants (icon 'plants') → the plant tab; MarsBot's
        // animal proxy (icon 'animal', its Miranda storage + M€ supply) → the animal
        // tab as a player-row, so the animal target is never silently dropped.
        const pl = opt.metadata.player;
        const target = player.game.players.find((p) => p.color === pl.color);
        const row: TabbedPlantTarget = {
          color: pl.color,
          name: target?.name ?? '',
          current: pl.current ?? 0,
          resulting: pl.resulting ?? 0,
          optionIndex: i,
        };
        (opt.metadata.icon === 'animal' ? animalTargets : plantTargets).push(row);
      }
    });
    // Append PROTECTED opponents as greyed, non-selectable rows, so the player sees
    // them (and won't wonder where a known opponent went / mistarget). The tab still
    // has at least one selectable target (an actionable plant opponent or — via the
    // animal tab — a card / the bot), so the mandatory step is always satisfiable.
    plantTargets.push(...protectedTargets);
    if (animalCard !== undefined || animalTargets.length > 0) {
      step.animal = {
        label: 'Animals', icon: 'animal', amount: 2,
        branchIndex: animalCard?.branchIndex, input: animalCard?.input,
        targets: animalTargets.length > 0 ? animalTargets : undefined,
      };
    }
    if (plantTargets.length > 0) {
      step.plant = {label: 'Plants', icon: 'plants', amount: 5, targets: plantTargets};
    }
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
