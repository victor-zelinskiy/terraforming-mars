import {Card, productionBoxWithBonusResource} from '../Card';
import {CardMetadata} from '../../../common/cards/CardMetadata';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {AdjacencyBonus} from '../../ares/AdjacencyBonus';
import {IProjectCard} from '../../cards/IProjectCard';
import {Space} from '../../boards/Space';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {SelectSpace} from '../../inputs/SelectSpace';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {Tag} from '../../../common/cards/Tag';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {TileType} from '../../../common/TileType';
import {SelectResourceTypeDeferred} from '../../deferredActions/SelectResourceTypeDeferred';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export abstract class MiningCard extends Card implements IProjectCard {
  public bonusResource: Array<Resource> | undefined;
  protected abstract readonly title: string;
  protected readonly isAres: boolean = false;
  protected readonly placeTile: boolean = true;
  // Hand-overlay "can't play" message when no qualifying space is left. The base
  // (Mining Rights) just needs a steel/titanium-bonus cell; Mining Area overrides
  // this to add the "adjacent to your tiles" clause.
  protected readonly placementUnavailableMessage: string = 'No space with a steel or titanium bonus';

  constructor(
    name: CardName,
    cost: number,
    metadata: CardMetadata) {
    super({
      type: CardType.AUTOMATED,
      name,
      tags: [Tag.BUILDING],
      cost,
      metadata,
    });
  }
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return this.getAvailableSpaces(player, canAffordOptions).length > 0;
  }

  // The tile is placed bespoke (not declarative `behavior.tile`), so the generic
  // explainer can't see the steel/titanium-bonus (and, for Mining Area, adjacency)
  // requirement — name it instead of the generic "unmet conditions".
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getAvailableSpaces(player).length === 0) {
      return reason.placementReason(this.placementUnavailableMessage);
    }
    return undefined;
  }

  // The tile is placed bespoke (a `SelectSpace`, not declarative `behavior.tile`),
  // so the generic preview walker can't emit the "you'll place a tile" note. Surface
  // it here so the play modal isn't mute about the board interaction that follows
  // confirming (the matching steel/titanium production is chosen after placement).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      text: 'After confirming, place the tile on a steel or titanium bonus area.',
    });
  }

  private getAdjacencyBonus(bonusType: SpaceBonus): AdjacencyBonus | undefined {
    if (this.isAres) {
      return {bonus: [bonusType]};
    }
    return undefined;
  }
  protected getAvailableSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
    return player.game.board.getAvailableSpacesOnLand(player, canAffordOptions)
      // Ares-only: exclude spaces already covered (which is only returned if the tile is a hazard tile.)
      .filter((space) => space.tile === undefined)
      .filter((space) => space.bonus.includes(SpaceBonus.STEEL) || space.bonus.includes(SpaceBonus.TITANIUM));
  }

  private getTileType(bonus: SpaceBonus.STEEL | SpaceBonus.TITANIUM): TileType {
    if (this.isAres) {
      return bonus === SpaceBonus.STEEL ? TileType.MINING_STEEL_BONUS : TileType.MINING_TITANIUM_BONUS;
    }
    if (this.name === CardName.MINING_RIGHTS) {
      return TileType.MINING_RIGHTS;
    }
    return TileType.MINING_AREA;
  }

  public productionBox() {
    return productionBoxWithBonusResource(this);
  }

  public override bespokePlay(player: IPlayer): SelectSpace {
    // Every cell the player COULD build on (empty, non-reserved land). A cell
    // here that isn't offered is illegal for exactly one reason: it lacks the
    // required steel/titanium placement bonus → 'wrong-bonus-type'. Reserved /
    // occupied / ocean cells aren't in this set and fall through to their
    // generic reason.
    const placeable = new Set(player.game.board.getAvailableSpacesOnLand(player).map((s) => s.id));
    return createMarsSelectSpace(player, this.title, this.getAvailableSpaces(player), {
      placementType: 'land',
      customReasoner: (space) => {
        // 'wrong-bonus-type' ONLY for a genuinely placeable land cell (not
        // reserved / occupied / ocean — those fall through to generic) that
        // simply lacks the steel/titanium bonus. A cell that HAS the bonus but
        // is illegal for another reason (e.g. MiningArea's adjacency rule)
        // keeps its generic reason rather than a misleading "no bonus".
        if (placeable.has(space.id) &&
            !space.bonus.includes(SpaceBonus.STEEL) &&
            !space.bonus.includes(SpaceBonus.TITANIUM)) {
          return 'wrong-bonus-type';
        }
        return undefined;
      },
    })
      .andThen((space) => {
        this.spaceSelected(player, space);
        return undefined;
      });
  }

  protected spaceSelected(player: IPlayer, space: Space): void {
    const bonusResources = [];
    if (space.bonus.includes(SpaceBonus.STEEL)) {
      bonusResources.push(Resource.STEEL);
    }
    if (space.bonus.includes(SpaceBonus.TITANIUM)) {
      bonusResources.push(Resource.TITANIUM);
    }

    player.game.defer(
      new SelectResourceTypeDeferred(
        player,
        bonusResources,
        'Select a resource to gain 1 unit of production'))
      .andThen((resource) => {
        player.production.add(resource, 1, {log: true});
        this.bonusResource = [resource];
        if (this.placeTile) {
          const spaceBonus = resource === Resource.TITANIUM ? SpaceBonus.TITANIUM : SpaceBonus.STEEL;
          player.game.addTile(player, space, {tileType: this.getTileType(spaceBonus)});
          space.adjacency = this.getAdjacencyBonus(spaceBonus);
        }
      });
  }
}
