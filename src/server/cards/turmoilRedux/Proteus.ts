import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {EffectForecastContext} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «You start with … 2 data resources on this card». */
export const PROTEUS_STARTING_DATA = 2;
/** «Spend 6 data from here» — the action's price. */
export const PROTEUS_ACTION_DATA = 6;
/** The action's two variants, in the printed order — existing i18n keys (`ui.json` / `colonies.json`). */
export const PROTEUS_COLONY_TITLE = 'Place a colony';
export const PROTEUS_OCEAN_TITLE = 'Place an ocean tile';

/**
 * THE ONE MATCH PREDICATE (rule 1) — read by the live hook AND its forecast twin; never a second copy (client, preview
 * or text). The PRINTED non-wild tags of `card` (duplicates kept — two Space tags are two matches), each of which is
 * printed on one of the player's OTHER played Preludes. The played card is already in `playedCards` when the hook
 * fans out, so a Prelude never matches itself (the owner's decision 1). The wild tag matches nothing on either side,
 * and the letter of the print is compared — never `Tags.cardTagCount` (Habitat Marte would read MARS as SCIENCE).
 */
export function matchingPreludeTags(player: IPlayer, card: ICard): ReadonlyArray<Tag> {
  const pool = new Set<Tag>();
  for (const prelude of player.playedCards.preludes()) {
    if (prelude.name === card.name) {
      continue;
    }
    for (const tag of prelude.tags) {
      if (tag !== Tag.WILD) {
        pool.add(tag);
      }
    }
  }
  if (pool.size === 0) {
    return [];
  }
  return card.tags.filter((tag) => tag !== Tag.WILD && pool.has(tag));
}

/**
 * TR82 — PROTEUS («Proteus»), the FIFTH of the eight NEW corporations of Turmoil Redux (not a replacement —
 * `common/cards/turmoilReduxCorporations.ts`, numbered TR82 by the order of the scan folder). Its own art and its own
 * printed lore, both keyed TR82; no `reimplements`.
 *
 * SCAN READING — the Wild tag («?») in the corner; «45» + TWO data plates — «You start with 45 M€ and 2 data
 * resources on this card» (the plates drawn as printed: two plates, never one «2»). The EFFECT box: «[?]* : [data]» —
 * «After you play a non-wild tag that matches a non-wild tag on your Preludes, add 1 data resource to this card. (Your
 * Preludes count.)». The ACTION box: «6 [data] → [colony] OR [ocean]» — «Spend 6 data from here to place a colony or
 * ocean tile». Printed lore: «Proteus was formed by a co-founder of Vitor…». No VP, no first action, no production. On
 * the left edge the PRELUDE («<») and COLONIES («▲») marks — the card needs both modules (`compatibility`); the purple
 * Turmoil diamond is the module itself.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/Proteus.spec.ts):
 *  1. «A NON-WILD TAG THAT MATCHES A NON-WILD TAG ON YOUR PRELUDES» — `matchingPreludeTags` above: one data per
 *     matching PRINTED tag of the played card (two Space tags → two), against the tags of the owner's OTHER played
 *     Preludes. «Your Preludes count»: a Prelude's own play is a play of its tags — the second Prelude whose tag
 *     matches the first pays; the first pays nothing (the pool is empty without itself). An event's tags count (they
 *     are played). The corporation itself (Wild) pays nothing; a rival's play is nobody's here (`onCardPlayed`).
 *  2. The data land at once (`addResourceTo` — the Arklight form, one call of N under the corporation's own
 *     `card-played` scope, so ONE reaction record for the play).
 *  3. THE FORECAST TWIN reads the same predicate: ONE `exact` fact PER MATCHING TAG (the T06 convention of a hook that
 *     pays per printed tag — GMO Contract), each naming its tag (`reasonTag`, `tagReason(tag)`) on the effect row
 *     (`printedEffect: 0`); no match → no fact (not a `no` — Proteus is not «almost» on it).
 *  4. THE ACTION is declarative — `{spend: {resourcesHere: 6}, or: [a colony, an ocean]}`: below 6 data the engine's
 *     own refusal; the colony variant is refused with no colony to build on (`getPlayableColonies`); the ocean
 *     variant stays EXECUTABLE at the ninth ocean (`maxoceans` warning — the futility verdict, never a block: the
 *     player may spend a turn). Both live → an `OrOptions` marked `effect-choice`, never auto-selected.
 *  5. The 2 starting data — `behavior: {addResources: 2}` (Astrodrill's form).
 *  6. MarsBot never holds the card (no twin).
 */
export class Proteus extends ActiveCorporationCard {
  constructor() {
    super({
      name: CardName.PROTEUS,
      tags: [Tag.WILD],
      startingMegaCredits: 45,
      resourceType: CardResource.DATA,

      behavior: {
        addResources: PROTEUS_STARTING_DATA,
      },

      action: {
        spend: {resourcesHere: PROTEUS_ACTION_DATA},
        or: {
          behaviors: [
            {title: PROTEUS_COLONY_TITLE, colonies: {buildColony: {}}},
            {title: PROTEUS_OCEAN_TITLE, ocean: {}},
          ],
        },
      },

      metadata: {
        cardNumber: 'TR82',
        description: 'You start with 45 M€ and 2 data resources on this card.',
        // ONE effect and ONE action: each caption addresses its frame without `tokens` (the generator's unambiguous case).
        infoText: [
          {kind: 'effect-short', text: 'Tag matching a Prelude tag: +1 data here'},
          {kind: 'action-short', text: '6 data here: a colony or an ocean'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          // The scan's TWO data plates, as printed.
          b.megacredits(45).nbsp.resource(CardResource.DATA).resource(CardResource.DATA);
          b.corpBox('effect-action', (ce) => {
            ce.effect('After you play a non-wild tag that matches a non-wild tag on your Preludes, add 1 data resource to this card. (Your Preludes count.)', (eb) => {
              eb.tag(Tag.WILD).asterix().startEffect.resource(CardResource.DATA);
            });
            ce.vSpace();
            ce.action('Spend 6 data from here to place a colony or ocean tile.', (eb) => {
              eb.resource(CardResource.DATA, PROTEUS_ACTION_DATA).startAction.colonies(1).or().oceans(1);
            });
          });
        }),
      },
    });
  }

  /** Rules 1–2 — one data per matching printed tag, at once. */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const qty = matchingPreludeTags(player, card).length;
    if (qty > 0) {
      player.addResourceTo(this, {qty, log: true});
    }
  }

  /** Rule 3 — the mirror: the same predicate, one exact fact per matching tag on the effect row. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, playedCard: ICard, _ctx?: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    const source = {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0};
    return matchingPreludeTags(cardOwner, playedCard).map((tag, i) => forecast.exact(source,
      [actionPreviews.cardGain(this, 1)],
      forecast.tagReason(tag),
      {id: `proteus-${i}`, reasonTag: tag}));
  }
}
