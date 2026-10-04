import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {TileType} from '../../../common/TileType';
import {Size} from '../../../common/cards/render/Size';
import {CardRenderer} from '../render/CardRenderer';
import {Space} from '../../boards/Space';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {PlaceGreeneryTile, greeneryTargets} from '../../deferredActions/PlaceGreeneryTile';
import {adjacentCityPayoutFacts, adjacentCityPreviewSteps, adjacentCityTarget, payPerAdjacentCity} from '../adjacentCityPayout';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The live prompt's title — the staged twin mirrors it (the engine's own greenery title). */
export const ARBORETUM_GREENERY_TITLE = 'Select space for greenery tile';
/** The target step's title: the card is chosen first, the number comes from the cell. */
export const ARBORETUM_TARGET_TITLE = 'Select the card for the data — 1 for each adjacent city';
/** The composer's warning when no card can hold data (no number: the cell decides it). */
export const ARBORETUM_NO_HOLDER_WARNING = 'No card can hold data — the data for adjacent cities will have nowhere to go';
/** The engine's own wording for «no greenery cell» (the greenery standard project's). */
export const NO_SPACE_FOR_GREENERY_REASON = 'No space left for a greenery tile';

/**
 * TR21 — ARBORETUM («Дендрарий»).
 *
 * SCAN READING — cost 12, green (AUTOMATED); two tags in the corner, Plant and
 * Building (the scan's order). The orange MIN plate beside the cost holds the
 * MARS FIRST emblem: the REQUIREMENT, never a tag. One row: «[greenery with the
 * red O₂ dot]  X [data]*» — X is a variable count, the asterisk «for each
 * adjacent city, on ANY card». The «TR21» tab is the card number. 1 VP on the
 * Mars disc. Bottom left only the purple Turmoil symbol: the module itself is
 * the gate (no `compatibility`). Printed lore: «It's like an aquarium, but for
 * trees and loiterers.»
 *
 * THE OXYGEN IS PART OF THE GREENERY, NOT A SECOND EFFECT. The red dot on the
 * greenery glyph is the printed note «this greenery raises oxygen» — the
 * builder puts it on every `b.greenery()` (`AltSecondaryTag.OXYGEN`), and
 * Plantation / Mangrove / Protected Valley / Experimental Forest print the same
 * sentence while declaring only the greenery. The ENGINE raises it once
 * (`Game.addGreenery` → `increaseOxygenLevel`); at the maximum there is no step
 * and no TR, and the greenery is still placed. Separately, the Redux greenery
 * revision (rulebook p.3) pays +1 TR for the TILE itself
 * (`ParliamentHandler.onGreeneryPlaced`), at maximum oxygen too. The card adds
 * neither — it declares `tr: {oxygen: 1}` only so the Reds' price of the play
 * is known before it is paid (`Player.affordOptionsForCard`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/Arboretum.spec.ts):
 *  1. The requirement is `{party: MARS}` (the TR15 class): Mars First rules, or
 *     2 of your delegates on its resolution — checked at the play only.
 *  2. The greenery is an ordinary one, by the greenery rules (`greeneryTargets`
 *     — the engine's set, next to one's own tile when possible, the Red City
 *     exclusion), with everything a greenery gets: the cell's bonus, ocean
 *     adjacency, Ares, Mars First's +1 steel per tile on Mars. No legal cell —
 *     unplayable with the engine's reason (as Plantation).
 *  3. The adjacent cities are of ANY owner — a neutral solo city, the Capital,
 *     an Ocean City, New Holland (`Board.isCitySpace` asks no owner) — counted
 *     AFTER the tile lands, around the tile.
 *  4. A city STACK counts PER TIER: «for each city» is a quantity, and a
 *     quantity of cities sums the stacks (`adjacentCityTiers`, the one count
 *     Commercial District scores by).
 *  5. «ANY card» = ONE of the player's own data holders, all N at once
 *     (`AddResourcesToCard`'s candidates — TR02, TR05, TR15, TR18 in scope).
 *  6. The target is chosen BEFORE the cell (`SelectResourceTarget` at
 *     `Priority.PLAY_CARD_RESOURCE_CHOICE` — the fork's «card + tile» order),
 *     and only when SOME legal cell has an adjacent city; a single holder is
 *     still asked.
 *  7. N = 0 is the rule, not a loss: no data, no skip event; the dossier and
 *     the journal say «no adjacent city».
 *  8. N > 0 with no data holder is a NAMED skip with its size; the card stays
 *     playable (the greenery is the point) and the composer warns before it.
 *  9. Every reaction to «a resource was added» answers — Martian Fiber (TR18)
 *     pays +1 M€ per data. Nothing is programmed for it.
 * 10. The journal: ONE line and ONE event for the data, with its REASON
 *     («… for 3 adjacent cities»); the source is this card.
 * 11. MarsBot never plays the card; the bot's cities are ordinary neighbours.
 *
 * The whole reward is the shared class «a card reward the cell decides»
 * (`cards/adjacentCityPayout.ts`): this file holds no count, no `SelectCard`
 * and no adjacency of its own.
 */
export class Arboretum extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.ARBORETUM,
      type: CardType.AUTOMATED,
      tags: [Tag.PLANT, Tag.BUILDING],
      cost: 12,
      requirements: {party: PartyName.MARS},
      victoryPoints: 1,
      tr: {oxygen: 1},

      metadata: {
        cardNumber: 'TR21',
        // ONE block per bonus, in the order the play runs them: the greenery (its oxygen is part of it), then the data.
        infoText: [
          {text: 'Place a greenery tile and raise oxygen 1 step.', tokens: ['greenery']},
          {text: 'Add 1 data resource to ANY card for each city adjacent to this tile.', tokens: ['res-data']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.greenery().nbsp.nbsp.text('X', Size.LARGE).resource(CardResource.DATA).asterix();
        }),
        description: 'Requires Mars First to be ruling or that you have 2 delegates there. Place a greenery tile and raise oxygen 1 step. Add 1 data resource to ANY card for each city adjacent to this tile.',
      },
    });
  }

  /** Rule 2 — the engine's greenery cells, with the unpaid card's own cost folded in. */
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return greeneryTargets(player, 'greenery', canAffordOptions).length > 0;
  }

  /** Rule 2 — the engine's own reason (the greenery standard project's words). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (greeneryTargets(player).length === 0) {
      return reason.placementReason(NO_SPACE_FOR_GREENERY_REASON);
    }
    return undefined;
  }

  /** Rules 6, 2, 3–5, 7–10 — the target first (when some cell can pay), then the greenery; the data is paid around the tile it placed. */
  public override bespokePlay(player: IPlayer) {
    const target = adjacentCityTarget(player, this, CardResource.DATA, greeneryTargets(player), ARBORETUM_TARGET_TITLE);
    if (target !== undefined) {
      player.game.defer(target);
    }
    player.game.defer(new PlaceGreeneryTile(player, 'greenery', {sourceCard: this.name})
      .andThen((space) => {
        if (space !== undefined) {
          payPerAdjacentCity(player, this, space, CardResource.DATA, target);
        }
      }));
    return undefined;
  }

  /**
   * The staged play: the target step (or the named warning) BEFORE the cell —
   * the order the play defers them — then the SAME greenery cells and the SAME
   * title the live prompt offers.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const canAffordOptions = player.affordOptionsForCard(this);
    const target = adjacentCityTarget(player, this, CardResource.DATA, greeneryTargets(player, 'greenery', canAffordOptions), ARBORETUM_TARGET_TITLE);
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.GREENERY,
      steps: adjacentCityPreviewSteps(target, ARBORETUM_NO_HOLDER_WARNING),
      staged: {
        title: ARBORETUM_GREENERY_TITLE,
        spaces: (options) => greeneryTargets(player, 'greenery', options),
        placementType: 'greenery',
      },
    });
  }

  /** The dossier of the cell under the cursor: the data its cities pay, where it lands, and who answers it. */
  public placementPreview(player: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.placesTile) {
      return [];
    }
    return adjacentCityPayoutFacts(player, this, space, CardResource.DATA);
  }
}
