import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {Resource} from '../../../common/Resource';
import {Size} from '../../../common/cards/render/Size';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {GainProduction} from '../../deferredActions/GainProduction';
import {EffectForecastContext} from '../EffectForecastContext';
import {cardPlacesTile} from '../cardPlacesTile';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Gain 6 heat» — the effect's heat. */
export const HARTLAN_HEAT_PER_TILE_CARD = 6;
/** «Increase your M€ production 1 step» — the effect's production. */
export const HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD = 1;
/** «Pay 12 heat» — the action's price. */
export const HARTLAN_ACTION_HEAT = 12;
/** «Draw 2 cards» — the action's draw. */
export const HARTLAN_ACTION_CARDS = 2;
/** The forecast's reason — ONE i18n key (RU in `effect_forecast.json`). */
export const HARTLAN_REASON = 'You play a green card that places a tile';

/**
 * TR80 — HARTLAN HEATING («Hartlan Heating»), the THIRD of the eight NEW corporations of Turmoil Redux (not a
 * replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR80 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR80; no `reimplements`.
 *
 * SCAN READING — the Space tag (the white star on black) and the Building tag (the brown house) in the corner; «48»
 * + TWO heat production boxes («You start with 48 M€ and 2 heat production»). The EFFECT box, one row: «[empty hex
 * with a green card's tab] : 6 [heat] [M€ production 1]» — «After you play a green project card that places a tile,
 * gain 6 heat and increase your M€ production 1 step». The ACTION box: «12 [heat] → [card][card]» — «Pay 12 heat to
 * draw 2 cards». Printed lore: «Space is very cold. Hence the dawn of space travel brought with it an enormous demand
 * for heating solutions…». No VP, no first action. The purple Turmoil diamond at the bottom left is the module itself
 * (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/HartlanHeating.spec.ts):
 *  1. «A GREEN PROJECT CARD THAT PLACES A TILE» is a PRINTED CLASS of the card, not a fact of the board: the one
 *     predicate `cards/cardPlacesTile.cardPlacesTile` (a declarative `behavior.tile` / `city` / `greenery` / `ocean`,
 *     or the co-located `placesTile: true` of a bespoke placement) AND `CardType.AUTOMATED`. The ocean card played at
 *     the ninth ocean still pays (the owner's decision 1 — the class, not «a tile really landed»); a card with two
 *     tiles pays ONCE (per card, never per tile); a blue card, an event, a prelude or a standard project with a tile
 *     pays nothing; a card that only MOVES a tile (TR14, TR39) is not of the class. A rival's play is nobody's here
 *     (`onCardPlayed` — the owner's own plays only).
 *  2. «AFTER YOU PLAY» — the two gains are deferred at `Priority.GAIN_RESOURCE_OR_PRODUCTION` (the Tharsis / Point
 *     Luna family), so they land after the card's own placement prompt and every `DEFAULT` question of the play:
 *     the journal shows them under the corporation's chip, after the tile. The live hook fires inside
 *     `events.withEffect(…, 'card-played')` (`Player.onCardPlayed`), so the effect's record names this card.
 *  3. THE FORECAST TWIN (`cardPlayedForecast`) reads the SAME predicate as the live hook — never the operation's tile
 *     list (`ctx.tiles` is clamped at the ocean ceiling and split by branch; the class is not). One `exact` fact
 *     addressed to the owner, timed `after-card` at the gain's own priority, attributed to printed block #0 (the
 *     effect row), with the bare deltas `+6 heat` and `+1 M€ production`. A green card without a tile forecasts
 *     NOTHING (no `no` fact — Hartlan is not «almost» on it).
 *  4. THE ACTION is declarative — `{spend: {heat: 12}, drawCard: 2}` (Development Center's draw, Caretaker Contract's
 *     heat): unavailable with the engine's own «Not enough heat» reason below 12 (Stormcraft floaters count through
 *     `spendHeat`); the two cards come as ONE batch of the action (`enqueueCardDrawReveal`, source — this card).
 *     Once per generation, as every card action.
 *  5. MarsBot never holds the card (no twin).
 */
export class HartlanHeating extends ActiveCorporationCard {
  constructor() {
    super({
      name: CardName.HARTLAN_HEATING,
      tags: [Tag.SPACE, Tag.BUILDING],
      startingMegaCredits: 48,

      behavior: {
        production: {heat: 2},
      },

      action: {
        spend: {heat: HARTLAN_ACTION_HEAT},
        drawCard: HARTLAN_ACTION_CARDS,
      },

      metadata: {
        cardNumber: 'TR80',
        description: 'You start with 48 M€ and 2 heat production.',
        // ONE effect and ONE action: each caption addresses its frame without `tokens` (the generator's unambiguous case).
        infoText: [
          {kind: 'effect-short', text: 'Green tile card played: +6 heat, +1 M€ prod'},
          {kind: 'action-short', text: 'Pay 12 heat to draw 2 cards'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(48).nbsp.production((pb) => pb.heat(2));
          b.corpBox('effect-action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.effect('After you play a green project card that places a tile, gain 6 heat and increase your M€ production 1 step.', (eb) => {
              // The scan's own glyph: an empty tile wearing the GREEN CARD's tab — the existing corner mark
              // (`AltSecondaryTag.GREEN`, the chairman quests' «green card»), never a text plate.
              eb.emptyTile('normal', {secondaryTag: AltSecondaryTag.GREEN}).startEffect.heat(HARTLAN_HEAT_PER_TILE_CARD).production((pb) => pb.megacredits(HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD));
            });
            ce.vSpace();
            ce.action('Pay 12 heat to draw 2 cards.', (eb) => {
              eb.heat(HARTLAN_ACTION_HEAT).startAction.cards(HARTLAN_ACTION_CARDS);
            });
          });
        }),
      },
    });
  }

  /** Rule 1 — THE class, read by the live hook and its forecast twin alike. */
  public static answersTo(card: ICard): boolean {
    return card.type === CardType.AUTOMATED && cardPlacesTile(card);
  }

  /** Rule 2 — the two gains, deferred behind the play's own prompts, under this card's effect scope. */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    if (!HartlanHeating.answersTo(card)) {
      return;
    }
    player.game.defer(new GainResourcesDeferred(player, Resource.HEAT, {count: HARTLAN_HEAT_PER_TILE_CARD, log: true}));
    player.game.defer(new GainProduction(player, Resource.MEGACREDITS, {count: HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD, log: true}));
  }

  /** Rule 3 — the mirror: the same predicate, one exact fact on the effect row. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, playedCard: ICard, _ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    if (!HartlanHeating.answersTo(playedCard)) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0},
      [
        actionPreviews.stockGain(cardOwner, Resource.HEAT, HARTLAN_HEAT_PER_TILE_CARD),
        actionPreviews.productionChange(cardOwner, Resource.MEGACREDITS, HARTLAN_MEGACREDIT_PRODUCTION_PER_TILE_CARD),
      ],
      HARTLAN_REASON,
      {...forecast.AFTER_CARD_GAIN})];
  }
}
