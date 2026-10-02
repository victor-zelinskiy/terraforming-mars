import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {
  CityIgnoringRestrictionsOptions, cityIgnoringRestrictions, cityIgnoringRestrictionsReasoner,
} from '../../boards/ignoreRestrictionsCity';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The play's cell rule — the shared «city ignoring other placement restrictions», with NO adjacency. */
const PLACEMENT: CityIgnoringRestrictionsOptions = {};

/** The live prompt's title — mirrored by the staged preview. TR16's voice: it names the LIFTED rule, because the
 *  board lights cells beside other cities and the placement panel prints this title as its action line. */
export const SPONSORED_SETTLEMENT_TITLE = 'Select a non-reserved space — other placement restrictions do not apply';
/** Rule 4 — the city standard project's reason: no legal cell for a city tile is left. */
export const NO_SPACE_FOR_CITY_REASON = 'No space left for a city tile';

/**
 * TR19 — SPONSORED SETTLEMENT («Спонсируемое поселение»), the nineteenth
 * Turmoil Redux PROJECT card — TR16 Administration District's younger sister:
 * the same city «ON A NON-RESERVED SPACE, IGNORING OTHER PLACEMENT
 * RESTRICTIONS» (`boards/ignoreRestrictionsCity.ts`, ONE rule for the family),
 * WITHOUT TR16's «adjacent to one of your cities» — and a +2 M€ production
 * step in front of it (Urbanized Area's shape: a declarative `behavior` plus a
 * bespoke city).
 *
 * SCAN READING — cost 16, green (AUTOMATED); two tags in the corner, in this
 * order: City (the white skyline), Building (the brown roof). The orange MIN
 * plate beside the cost holds the MARS FIRST emblem: the REQUIREMENT
 * («Requires Mars First to be ruling or that you have 2 delegates there»),
 * never a tag. The VP badge prints 1 on a Mars disc (the disc is the badge's
 * background). The PLAY row: «[production: 2 M€] [city tile]*». The purple
 * Turmoil symbol at the bottom left is the module itself (no
 * `compatibility`). Flavour: «Eventually some of those people that bought land
 * on Mars will see dividends.» (`lore_texts.json` «TR19»).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SponsoredSettlement.spec.ts):
 *  1. The requirement is `{party: MARS}` — the TR15 class (emblem, named
 *     reason, the hand's counter). Checked at the play only.
 *  2. +2 M€ production — declarative (`behavior.production`), executed BEFORE
 *     the city is asked for (`Card.play`: behavior, then `bespokePlay`).
 *  3. The city: ANY non-reserved land cell — the engine's land set, the one
 *     every ordinary land placement starts from (no tile, not an ocean cell,
 *     not Noctis, not the Nomads camp, not another player's claim, the cell's
 *     price affordable; an unprotected Ares hazard is coverable as usual).
 *     «Ignoring other placement restrictions» lifts the city rule ONLY: a cell
 *     beside any city — one's own or another player's — is legal. Everything
 *     an ordinary city placement gives is given (`Game.addCity`): the cell's
 *     bonus, ocean adjacency, every city trigger (Rover Construction, Pets,
 *     TR15 Martian Census), chairman quests, Ares costs.
 *  4. No legal cell at all (practically impossible, but the rule is general)
 *     → unplayable, ONE reason — the city standard project's «No space left
 *     for a city tile». Every illegal cell keeps the generic per-cell reason
 *     (the shared reasoner adds none without the adjacency).
 *  5. 1 VP; tags City, Building — so with TR16 in the tableau this play draws
 *     a card (a Building card with a non-negative VP icon).
 *  6. MarsBot never plays the card.
 */
export class SponsoredSettlement extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SPONSORED_SETTLEMENT,
      type: CardType.AUTOMATED,
      tags: [Tag.CITY, Tag.BUILDING],
      cost: 16,
      requirements: {party: PartyName.MARS},
      victoryPoints: 1,

      behavior: {
        production: {megacredits: 2},
      },

      metadata: {
        cardNumber: 'TR19',
        // The declarative production + the bespoke city: one block per bonus, in the play's order (Urbanized Area).
        infoText: [
          {text: 'Increase your M€ production 2 steps.', tokens: ['production(']},
          {text: 'Place a city tile ON A NON-RESERVED SPACE, IGNORING OTHER PLACEMENT RESTRICTIONS.', tokens: ['city']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(2)).nbsp.city().asterix();
        }),
        description: 'Requires Mars First to be ruling or that you have 2 delegates there. Increase your M€ production 2 steps. Place a city tile ON A NON-RESERVED SPACE, IGNORING OTHER PLACEMENT RESTRICTIONS.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return cityIgnoringRestrictions(player, PLACEMENT, canAffordOptions).length > 0;
  }

  /** Rule 4 — ONE reason. */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (cityIgnoringRestrictions(player, PLACEMENT).length === 0) {
      return reason.placementReason(NO_SPACE_FOR_CITY_REASON);
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new PlaceCityTile(player, {
      title: SPONSORED_SETTLEMENT_TITLE,
      spaces: cityIgnoringRestrictions(player, PLACEMENT),
      // The address of the staged tail (docs/TILE_PLAY_STAGED_COMMIT.md §9-quater).
      sourceCard: this.name,
      customReasoner: cityIgnoringRestrictionsReasoner(player, PLACEMENT),
    }));
    return undefined;
  }

  /** The staged play: the SAME cell set and the SAME per-cell reason `bespokePlay` offers; the M€ production chip
   *  comes from `behavior`. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      constraint: 'on a non-reserved space, ignoring other placement restrictions',
      staged: {
        title: SPONSORED_SETTLEMENT_TITLE,
        spaces: (canAffordOptions) => cityIgnoringRestrictions(player, PLACEMENT, canAffordOptions),
        placementType: 'city',
        reasoner: cityIgnoringRestrictionsReasoner(player, PLACEMENT),
      },
    });
  }
}
