import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {LoseProduction} from '../../deferredActions/LoseProduction';
import {Resource} from '../../../common/Resource';
import {Units} from '../../../common/Units';
import {MarsBoard} from '../../boards/MarsBoard';
import {Space} from '../../boards/Space';
import {TileType} from '../../../common/TileType';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {message} from '../../logs/MessageBuilder';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

/** «Gain the printed placement bonus 2 additional times» — the cell's printed bonus pays this many times in all. */
export const FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER = 3;

/**
 * P74 — FRONTIER TOWN («Пограничный город»), the fourteenth Prelude 2 card and the series' first city with a
 * MULTIPLIED printed bonus (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 3 + 5).
 *
 * RULE READINGS (pinned by tests/cards/prelude2/FrontierTown.spec.ts — the upstream block byte for byte):
 *  1. «Gain the printed placement bonus 2 additional times» = the cell's PRINTED bonus × 3 in ONE payout, through the
 *     fork's one multiplier thread (TR79 Ferrus Academy): the prompt's marker (`printedBonusMultiplier` — the dossier's
 *     numbers and the board's «×N» marks) → `addTile` → `grantSpaceBonuses(…, 3)` → the tile language's record (the
 *     landing wave) → the enacted law's repeat. The ocean adjacency and the Ares neighbours stay × 1 (upstream «2, not
 *     6»); a pay-to-use bonus (the Hellas ocean) is offered once per multiple and every cell's price is tripled
 *     (`getAvailableSpacesForCity({bonusMultiplier: 3})` — upstream).
 *  2. The energy production step is lost AFTER the city (`andThen` — Urbanized Area's shape), so the law and the
 *     table's answers to the city come first.
 *  3. Under Development Craze the law repeats the payout WITH its multiple — the Redux FAQ: «six times» (RX10).
 */
export class FrontierTown extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.FRONTIER_TOWN,
      type: CardType.AUTOMATED,
      // The printed class «a card that places a tile» (`cards/cardPlacesTile.ts`): the placement is bespoke, so the
      // declaration says it here, beside `bespokePlay` — TR80 Hartlan Heating reads it live and in the forecast.
      placesTile: true,
      cost: 11,
      tags: [Tag.CITY, Tag.BUILDING],

      requirements: {party: PartyName.MARS},

      metadata: {
        infoText: [
          {text: 'Decrease your energy production 1 step.', tokens: ['production(']},
          {text: 'Place a city tile and gain its printed placement bonus 2 additional times.', tokens: ['city']},
        ],
        cardNumber: 'P74',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.minus().energy(1)).city().asterix();
        }),
        // Redux voice (the party's resolutions, never «delegates in it»), the multiplied bonus said as a rule.
        description: 'Requires that Mars First is ruling or that you have 2 delegates there. Decrease your energy production 1 step. ' +
          'Place a city tile and gain its printed placement bonus 2 additional times.',
      },
    });
  }

  public productionBox() {
    return Units.of({energy: -1});
  }

  private availableSpaces(player: IPlayer, cost: number | CanAffordOptions) {
    const options = typeof cost === 'number' ? {cost} : cost;
    return player.game.board.getAvailableSpacesForCity(
      player, {...options, bonusMultiplier: FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER});
  }

  /** The exact set the live prompt offers — energy-covered cells, every price tripled. Shared by the play and the staged preview. */
  private placeableSpaces(player: IPlayer, cost: number | CanAffordOptions): ReadonlyArray<Space> {
    return MarsBoard.filterForEnergy(player, this.availableSpaces(player, cost));
  }

  public override bespokeCanPlay(player: IPlayer) {
    const available = this.availableSpaces(player, player.getCardCost(this));
    if (available.length === 0) {
      return false;
    }
    return MarsBoard.hasEnergyCoverage(player, available);
  }

  // The bespoke block: a city cell the player can pay for (every price × 3), gated by energy coverage — name whichever
  // is missing rather than the generic fallback.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const spaces = this.availableSpaces(player, player.getCardCost(this));
    if (spaces.length === 0) {
      return reason.placementReason('No space left for a city tile');
    }
    if (!MarsBoard.hasEnergyCoverage(player, spaces)) {
      return reason.noEnergyProduction();
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new PlaceCityTile(player, {
      spaces: this.placeableSpaces(player, 0),
      // Names the card to the placement preview (its `placementPreview` — the energy step lost after the city).
      sourceCard: this.name,
      printedBonusMultiplier: FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER,
    })).andThen(() => {
      player.game.defer(new LoseProduction(player, Resource.ENERGY, {count: 1}));
    });
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      // The step names the multiple in the dossier's own words («Печатный бонус клетки ×3»).
      constraint: message('Printed cell bonus ×${0}', (b) => b.number(FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER)),
      effects: [actionPreviews.productionChange(player, Resource.ENERGY, -1)],
      staged: {
        // The unpaid card's price is folded into the cells (the live prompt is raised after paying).
        spaces: (canAffordOptions) => this.placeableSpaces(player, canAffordOptions ?? player.getCardCost(this)),
        placementType: 'city',
        printedBonusMultiplier: FRONTIER_TOWN_PRINTED_BONUS_MULTIPLIER,
      },
    });
  }

  /** The energy production step is lost in `bespokePlay`'s `andThen` — after the cell — so the cell says it. */
  public placementPreview(player: IPlayer): ReadonlyArray<BoardFact> {
    return [placementPreviews.productionChange(player, this, Resource.ENERGY, -1,
      'Energy production decreases')];
  }
}
