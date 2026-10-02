import {IProjectCard} from '../IProjectCard';
import {ICard} from '../ICard';
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
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {hasNonNegativeVictoryPointsIcon} from '../../../common/cards/victoryPointsIcon';
import {
  CityIgnoringRestrictionsOptions, cityIgnoringRestrictions, cityIgnoringRestrictionsReasoner,
} from '../../boards/ignoreRestrictionsCity';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The play's cell rule — the shared «city ignoring other placement restrictions», next to one's OWN city. */
const PLACEMENT: CityIgnoringRestrictionsOptions = {adjacentToOwnCity: true};

/** The live prompt's title — mirrored by the staged preview. It names the LIFTED rule too: the board lights cells
 *  beside another player's city, and the placement panel prints this title as its action line. */
export const ADMINISTRATION_DISTRICT_TITLE = 'Select space adjacent to one of your cities — other placement restrictions do not apply';
export const NO_CITY_ON_MARS_REASON = 'No city of yours on Mars';
export const NO_SPACE_BESIDE_YOUR_CITY_REASON = 'No free space adjacent to one of your cities';

/** Rule 5 — the trigger: the played card prints a Building tag AND a non-negative VP icon. */
export function isBuildingCardWithNonNegativeVpIcon(card: ICard): boolean {
  return card.tags.includes(Tag.BUILDING) && hasNonNegativeVictoryPointsIcon(card);
}

/**
 * TR16 — ADMINISTRATION DISTRICT («Административный район»), the sixteenth
 * Turmoil Redux PROJECT card — the set's first city «IGNORING OTHER PLACEMENT
 * RESTRICTIONS» (the rule `boards/ignoreRestrictionsCity.ts`, which the
 * sisters take too) and its first trigger on «a Building card with a
 * NON-NEGATIVE VP icon» (Architecture Award's wording, read by the same
 * `hasNonNegativeVictoryPointsIcon`).
 *
 * SCAN READING — cost 18; three tags in the corner, in this order: Mars (the
 * red planet), City (the white skyline), Building (the brown roof). The orange
 * MIN plate beside the cost holds the MARS FIRST emblem: the REQUIREMENT
 * («Requires Mars First to be ruling or that you have 2 delegates there»),
 * never a tag. No VP badge. The EFFECT row: «[? on a Mars disc + a small
 * Building tag] : [card]» — the «?» VP plate is «any non-negative VP icon»;
 * the face draws it with the premium «Building card with a VP icon» glyph
 * (`vpCard`, Architecture Award's — one drawing for one concept). The PLAY
 * row: «[city tile]*». The purple Turmoil symbol at the bottom left is the
 * module itself (no `compatibility`). No lore printed.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AdministrationDistrict.spec.ts):
 *  1. The requirement is `{party: MARS}` — the TR15 class (emblem, named
 *     reason, the hand's counter). Checked at the play only.
 *  2. The city is part of the play: a NON-RESERVED land cell (the engine's
 *     land set — no tile, not an ocean cell, not Noctis, not the Nomads camp,
 *     not another player's claim; an unprotected Ares hazard is coverable as
 *     usual) ADJACENT to at least one city of the player's own on Mars (the
 *     Capital counts, a Skyscrapers stack is still their city, another
 *     player's city gives no adjacency, an off-Mars city has no neighbour).
 *     «Ignoring other placement restrictions» lifts the city rule ONLY: a
 *     cell beside another player's city is legal when one's own is beside it
 *     too.
 *  3. No city of one's own on Mars, or no such cell → unplayable, ONE reason
 *     in that order («No city of yours on Mars» / «No free space adjacent to
 *     one of your cities»).
 *  4. Everything an ordinary city placement gives is given (`Game.addCity`):
 *     the cell's bonus, ocean adjacency, every city trigger (Rover
 *     Construction, Pets, TR15 Martian Census), chairman quests, Ares costs.
 *  5. The trigger: the OWNER's own plays (`onCardPlayed`) — a played card with
 *     a Building tag AND a non-negative VP icon draws the owner 1 card, at
 *     once. A wild tag never makes a card a Building card; a played EVENT
 *     counts (the rule is «a card played», not «a card in play»). This card
 *     prints no VP icon, so it never triggers itself.
 *  6. Non-negative is the shared module's: a fixed VP ≥ 0 (0 included), a
 *     variable icon by the sign of its formula, a bespoke ('special') icon by
 *     its declared `victoryPointsSign` — an undeclared one never counts.
 *  7. MarsBot never plays the card.
 *
 * SISTERS: TR19 Sponsored Settlement (the same cell rule without the
 * adjacency — `cityIgnoringRestrictions(player, {})`), TR14 Re-settlement
 * (move one's city to an adjacent non-reserved cell).
 */
export class AdministrationDistrict extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.ADMINISTRATION_DISTRICT,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.CITY, Tag.BUILDING],
      cost: 18,
      requirements: {party: PartyName.MARS},

      metadata: {
        cardNumber: 'TR16',
        infoText: [
          {kind: 'effect-short', text: 'Building card with VP ≥ 0 played: draw a card'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('After you play a Building card that has a NON-NEGATIVE VP icon, draw a card.', (eb) => {
            eb.vpCard(Tag.BUILDING).startEffect.cards(1);
          }).br;
          b.city().asterix();
        }),
        description: 'Requires Mars First to be ruling or that you have 2 delegates there. Place a city tile ON A NON-RESERVED SPACE ADJACENT TO ONE OF YOUR CITIES, IGNORING OTHER PLACEMENT RESTRICTIONS.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return cityIgnoringRestrictions(player, PLACEMENT, canAffordOptions).length > 0;
  }

  /** Rule 3 — ONE reason, the more fundamental first. */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.board.getCitiesOnMars(player).length === 0) {
      return reason.placementReason(NO_CITY_ON_MARS_REASON);
    }
    if (cityIgnoringRestrictions(player, PLACEMENT).length === 0) {
      return reason.placementReason(NO_SPACE_BESIDE_YOUR_CITY_REASON);
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new PlaceCityTile(player, {
      title: ADMINISTRATION_DISTRICT_TITLE,
      spaces: cityIgnoringRestrictions(player, PLACEMENT),
      // The address of the staged tail (docs/TILE_PLAY_STAGED_COMMIT.md §9-quater).
      sourceCard: this.name,
      customReasoner: cityIgnoringRestrictionsReasoner(player, PLACEMENT),
    }));
    return undefined;
  }

  /** The staged play: the SAME cell set and the SAME per-cell reason `bespokePlay` offers. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      constraint: 'adjacent to one of your cities, ignoring other placement restrictions',
      staged: {
        title: ADMINISTRATION_DISTRICT_TITLE,
        spaces: (canAffordOptions) => cityIgnoringRestrictions(player, PLACEMENT, canAffordOptions),
        placementType: 'city',
        reasoner: cityIgnoringRestrictionsReasoner(player, PLACEMENT),
      },
    });
  }

  /** Rule 5 — at once, the reveal naming this card. */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    if (isBuildingCardWithNonNegativeVpIcon(card)) {
      player.drawCard(1, {source: {type: 'card', cardName: this.name}});
    }
  }

  /** Mirrors `onCardPlayed` by the same predicate: an EXACT draw, at once. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (!isBuildingCardWithNonNegativeVpIcon(card)) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.drawGain(1)],
      'You play a Building card with a non-negative VP icon',
      {reasonTag: Tag.BUILDING})];
  }
}
