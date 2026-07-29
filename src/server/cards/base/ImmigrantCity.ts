import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {TileType} from '../../../common/TileType';
import {Priority} from '../../deferredActions/Priority';
import {GainProduction} from '../../deferredActions/GainProduction';
import {LoseProduction} from '../../deferredActions/LoseProduction';
import {Board} from '../../boards/Board';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {MarsBoard} from '../../boards/MarsBoard';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

export class ImmigrantCity extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.IMMIGRANT_CITY,
      tags: [Tag.CITY, Tag.BUILDING],
      cost: 13,

      metadata: {
        cardNumber: '200',
        renderData: CardRenderer.builder((b) => {
          b.effect('When a city tile is placed, including this, increase your M€ production 1 step.', (eb) => {
            eb.city({all}).startEffect.production((pb) => pb.megacredits(1));
          }).br;
          b.production((pb) => pb.minus().energy(1).megacredits(-2)).city();
        }),
        description: 'Decrease your energy production 1 step and decrease your M€ production 2 steps. Place a city tile.',
        infoText: [
          {text: 'Decrease your energy production 1 step.', tokens: ['production(energy', 'production(']},
          {text: 'Decrease your M€ production 2 steps.', tokens: ['production(megacredits', 'production(']},
          {text: 'Place a city tile.', tokens: ['city', 'tile-city']},
        ],
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const availableSpaces = player.game.board.getAvailableSpacesForCity(player);
    const hasEnergyProduction = MarsBoard.hasEnergyCoverage(player, availableSpaces);
    const canPlaceCityOnMars = availableSpaces.length > 0;
    const canDecreaseMcProduction = player.production.megacredits >= -4 || player.tableau.has(CardName.THARSIS_REPUBLIC);

    return hasEnergyProduction && canDecreaseMcProduction && canPlaceCityOnMars;
  }

  // None of the three blocks are declarative `behavior`, so name the precise one:
  // no city space, no energy production to cover the −1, or M€ production already
  // at the −5 floor (waived by Tharsis Republic).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const spaces = player.game.board.getAvailableSpacesForCity(player);
    if (spaces.length === 0) {
      return reason.placementReason('No space available for the tile');
    }
    if (!MarsBoard.hasEnergyCoverage(player, spaces)) {
      return reason.noEnergyProduction();
    }
    if (player.production.megacredits < -4 && !player.tableau.has(CardName.THARSIS_REPUBLIC)) {
      return reason.cannotReduceMcProduction();
    }
    return undefined;
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isCitySpace(space)) {
      cardOwner.game.defer(
        new GainProduction(cardOwner, Resource.MEGACREDITS),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
      );
    }
  }

  /** Mirrors `onTilePlaced`: ANY city, placed by anyone, pays the owner. */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, _space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.countsAsCity) {
      return [];
    }
    return [placementPreviews.productionChange(cardOwner, this, Resource.MEGACREDITS, 1, 'City placed anywhere', {
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }

  /**
   * The card's OWN follow-up (`bespokePlay`'s `.andThen`): the tile lands first,
   * then energy production drops 1 step and M€ production drops 2. Surfaced here
   * so the placement panel states the real net cost — the trigger above adds
   * exactly 1 M€ production back for this very city.
   */
  public placementPreview(player: IPlayer): ReadonlyArray<BoardFact> {
    return [
      placementPreviews.productionChange(player, this, Resource.ENERGY, -1,
        'Energy production paid for this city',
        {description: 'Applied right after the tile is placed.'}),
      placementPreviews.productionChange(player, this, Resource.MEGACREDITS, -2,
        'M€ production paid for this city',
        {description: 'Applied right after the tile is placed; this card\'s own trigger adds 1 M€ production back.'}),
    ];
  }

  public override bespokePlay(player: IPlayer) {
    const spaces = MarsBoard.filterForEnergy(player, player.game.board.getAvailableSpacesForCity(player));
    player.game.defer(new PlaceCityTile(player, {spaces, sourceCard: this.name})).andThen(() => {
      player.game.defer(new LoseProduction(player, Resource.ENERGY, {count: 1}));
      player.game.defer(new LoseProduction(player, Resource.MEGACREDITS, {count: 2}));
    });
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {tile: TileType.CITY});
  }
}
