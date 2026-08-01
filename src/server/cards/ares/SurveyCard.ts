import {Card, StaticCardProperties} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {Phase} from '../../../common/Phase';
import {IProjectCard} from '../IProjectCard';
import {BoardType} from '../../boards/BoardType';
import {SpaceType} from '../../../common/boards/SpaceType';
import {PartyHooks} from '../../turmoil/parties/PartyHooks';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Board} from '../../boards/Board';
import {AresHandler} from '../../ares/AresHandler';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';
import {cardSource} from '../../inputs/choiceContext';

/**
 * ONE (resource, printed bonus) pair a survey card watches, declared so the
 * READ-ONLY placement preview can mirror `checkForBonuses` GENERICALLY. `kind`
 * picks which of the two live grant paths applies: `stock` →
 * {@link SurveyCard.maybeRewardStandardResource} (which carries the two extra
 * fallbacks), `card` → {@link SurveyCard.maybeRewardCardResource} (which also
 * requires the owner to hold a card able to store the resource).
 */
export type SurveyBonus =
  | {kind: 'stock', resource: Resource, bonus: SpaceBonus}
  | {kind: 'card', resource: CardResource, bonus: SpaceBonus};

/**
 * Abstraction for cards that give rewards based on tile placement.  (e.g. Ecological Survey, Geological Survey.)
 */
export abstract class SurveyCard extends Card implements IProjectCard {
  constructor(properties: StaticCardProperties) {
    super(properties);
  }

  /**
   * Returns true if this space yields an adjacency bonus.
   */
  private anyAdjacentSpaceGivesBonus(board: Board, space: Space, bonus: SpaceBonus): boolean {
    return board.getAdjacentSpaces(space).some((adj) => adj.adjacency?.bonus.includes(bonus));
  }

  /**
   * Returns true if the tile just placed gives a bonus of a given type.
   */
  private grantsBonusNow(space: Space, bonus: SpaceBonus) {
    return space.tile?.covers === undefined && space.bonus.includes(bonus);
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType) {
    // Adjacency bonuses are only available on Mars.
    if (boardType !== BoardType.MARS) {
      return;
    }
    if (cardOwner.game.phase === Phase.SOLAR || cardOwner.id !== activePlayer.id) {
      return;
    }

    this.checkForBonuses(cardOwner, space);
  }

  protected abstract checkForBonuses(cardOwner: IPlayer, space: Space): void;

  /**
   * The (resource, bonus) pairs `checkForBonuses` tests — declared separately so
   * the preview can build its facts without running the granting code. Kept
   * ALONGSIDE `checkForBonuses` (which is untouched): both live in the subclass
   * file, so a card that gains/loses a pair changes them in the same diff.
   */
  protected abstract previewBonuses(): ReadonlyArray<SurveyBonus>;

  /**
   * READ-ONLY mirror of {@link onTilePlaced} + {@link checkForBonuses}: the extra
   * resource this survey hands its owner for the tile they are about to place.
   * The board-type guard has no preview analog — the placement preview only ever
   * runs against the Mars board.
   */
  public tilePlacedPreview(
    cardOwner: IPlayer,
    activePlayer: IPlayer,
    space: Space,
    ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (cardOwner.game.phase === Phase.SOLAR || cardOwner.id !== activePlayer.id) {
      return [];
    }
    const recipient = placementPreviews.recipientOf(activePlayer, cardOwner);
    const title = 'Extra resource from the placement bonus';
    const description = 'You gain one additional resource of each type this placement grants you.';
    const facts: Array<BoardFact> = [];
    for (const entry of this.previewBonuses()) {
      if (!this.previewGrants(cardOwner, space, ctx, entry)) {
        continue;
      }
      const options = {id: `card-${this.name}-${entry.resource}`, recipient, description};
      facts.push(entry.kind === 'stock' ?
        placementPreviews.stockChange(cardOwner, this, entry.resource, 1, title, options) :
        placementPreviews.cardResourceGain(this, entry.resource, 1, title, options));
    }
    return facts;
  }

  /**
   * The preview mirror of the grant test inside {@link maybeRewardStandardResource}
   * / {@link maybeRewardCardResource}. `grantsBonusNow` reads `space.tile?.covers`,
   * which does not exist yet at preview time — `ctx.covering` is the same statement
   * about the placement that is about to happen.
   */
  private previewGrants(cardOwner: IPlayer, space: Space, ctx: PlacementPreviewContext, entry: SurveyBonus): boolean {
    const board = cardOwner.game.board;
    const printed = !ctx.covering && space.bonus.includes(entry.bonus);
    if (entry.kind === 'card') {
      return cardOwner.playedCards.some((card) => card.resourceType === entry.resource) &&
        (printed || AresHandler.anyAdjacentSpaceGivesBonus(board, space, entry.bonus));
    }
    if (printed || this.anyAdjacentSpaceGivesBonus(board, space, entry.bonus)) {
      return true;
    }
    // The two fallbacks of `maybeRewardStandardResource`, reusing its rule sources.
    switch (entry.resource) {
    case Resource.STEEL:
      return space.spaceType !== SpaceType.COLONY &&
        PartyHooks.shouldApplyPolicy(cardOwner, PartyName.MARS, 'mp01');
    case Resource.PLANTS:
      return placementPreviews.placesUncoveredOcean(ctx) && cardOwner.tableau.has(CardName.ARCTIC_ALGAE);
    default:
      return false;
    }
  }

  private log(cardOwner: IPlayer, resource: Resource | CardResource): void {
    cardOwner.game.log(
      '${0} gained a bonus ${1} because of ${2}',
      (b) => b.player(cardOwner).string(resource).cardName(this.name));
  }

  /**
   * Optionally grants a unit of `resource` (which matches `bonus`) based on `cardOwner` having placed a tile on `space`.
   */
  protected maybeRewardStandardResource(cardOwner: IPlayer, space: Space, resource: Resource, bonus: SpaceBonus): void {
    const board = cardOwner.game.board;
    let grant = this.grantsBonusNow(space, bonus) || this.anyAdjacentSpaceGivesBonus(board, space, bonus);
    if (!grant) {
      switch (resource) {
      case Resource.STEEL:
        grant = space.spaceType !== SpaceType.COLONY &&
            PartyHooks.shouldApplyPolicy(cardOwner, PartyName.MARS, 'mp01');
        break;
      case Resource.PLANTS:
        grant = Board.isUncoveredOceanSpace(space) &&
          cardOwner.tableau.has(CardName.ARCTIC_ALGAE);
      }
    }
    if (grant) {
      cardOwner.stock.add(resource, 1);
      this.log(cardOwner, resource);
    }
  }

  /**
   * Optionally grants a unit of `resource` (which matches `bonus`) based on `cardOwner` having placed a tile on `space`.
   */
  protected maybeRewardCardResource(cardOwner: IPlayer, space: Space, resource: CardResource, bonus: SpaceBonus) {
    const board = cardOwner.game.board;
    if (cardOwner.playedCards.some((card) => card.resourceType === resource) &&
        (this.grantsBonusNow(space, bonus) || AresHandler.anyAdjacentSpaceGivesBonus(board, space, bonus))) {
      cardOwner.game.defer(new AddResourcesToCard(
        cardOwner,
        resource,
        {log: true, cause: cardSource(this)}))
        .andThen(() => this.log(cardOwner, resource));
    }
  }
}
