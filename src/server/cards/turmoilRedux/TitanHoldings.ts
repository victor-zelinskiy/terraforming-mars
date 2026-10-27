import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {DeclaredHolderRole} from '../../../common/cards/holderRole';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {EffectForecastContext} from '../EffectForecastContext';
import {digit} from '../Options';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Spend 2 leverage from here to add 1 delegate» — and 4 for two: ONE price per delegate. */
export const TITAN_LEVERAGE_PER_DELEGATE = 2;
/** The action's two variants, in the printed row order — the option titles. */
export const TITAN_ONE_DELEGATE_TITLE = 'Spend 2 leverage from here to add 1 delegate to a resolution';
export const TITAN_TWO_DELEGATES_TITLE = 'Spend 4 leverage from here to add 2 delegates to a resolution';

/**
 * The printed effect — FULL (the Moon and Venus in the game) and the variants that drop what the game cannot play
 * (`metadata.textVariants` — the owner: the text names only the tags this game can play; the Moon first, Venus by the
 * same law).
 */
export const TITAN_EFFECT_TEXT = 'After you play a Mars, Earth, Venus, Jovian, or Moon tag (including these), add 1 leverage resource to this card.';
export const TITAN_EFFECT_TEXT_NO_MOON = 'After you play a Mars, Earth, Venus, or Jovian tag (including these), add 1 leverage resource to this card.';
export const TITAN_EFFECT_TEXT_NO_VENUS = 'After you play a Mars, Earth, Jovian, or Moon tag (including these), add 1 leverage resource to this card.';
export const TITAN_EFFECT_TEXT_NO_MOON_NO_VENUS = 'After you play a Mars, Earth, or Jovian tag (including these), add 1 leverage resource to this card.';

/** The PLANET TAGS the effect answers — the five the scan's ringed-planet disc stands for. */
export const TITAN_TAGS: ReadonlyArray<Tag> = [Tag.MARS, Tag.EARTH, Tag.VENUS, Tag.JOVIAN, Tag.MOON];

/**
 * THE ONE MATCH PREDICATE (rule 2) — read by the live hook AND its forecast twin; never a second copy (client, preview
 * or text). The PRINTED planet tags of `card`, duplicates kept (two Jovian tags are two leverage). The wild tag
 * matches nothing (it is not a planet on the print), and the letter of the print is compared — never
 * `Tags.cardTagCount`. The Moon is always in the set: the TEXT drops it in a game without the Moon (there is no Moon
 * tag to play there), the rule does not need to.
 */
export function titanTags(card: ICard): ReadonlyArray<Tag> {
  return card.tags.filter((tag) => TITAN_TAGS.includes(tag));
}

/**
 * TR84 — TITAN HOLDINGS («Titan Holdings»), the SEVENTH of the eight NEW corporations of Turmoil Redux (not a
 * replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR84 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR84; no `reimplements`.
 *
 * SCAN READING — the Earth (globe) and Jovian (banded sphere) tags in the corner; «50» + a production plate with «2» —
 * «You start with 50 M€ and 2 M€ production». The EFFECT box: «[white disc with a ringed planet] : [leverage]» —
 * «After you play a Mars, Earth, Venus, Jovian, or Moon tag (including these), add 1 leverage resource to this card».
 * The ACTION box, two rows: «2 [leverage] → [figure] OR» / «4 [leverage] → [figure][figure]» — «Spend 2 leverage from
 * here to add 1 delegate to a resolution, OR spend 4 leverage to add 2 delegates». Printed lore: «Habitats and space
 * stations are real estate…». No VP, no first action. The purple Turmoil diamond at the bottom left is the module
 * itself; no Prelude / Colonies / Moon mark (the Moon is an option of the effect, not a condition of the card — no
 * `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/TitanHoldings.spec.ts):
 *  1. «LEVERAGE» is a NEW card resource (`CardResource.LEVERAGE` — the EVA §2 table of points). Never a payment unit,
 *     never VP, and never «influence» (that is the Parliament's word — glossary §3).
 *  2. «A MARS, EARTH, VENUS, JOVIAN, OR MOON TAG» — `titanTags` above: one leverage per matching PRINTED tag of the
 *     played card (Earth + Jovian → two), at once (`addResourceTo` — the Arklight form, one call under the card's own
 *     `card-played` scope, so ONE reaction record for the play). An event's tags count (they are played). A rival's
 *     play is nobody's here (`onCardPlayed`).
 *  3. «(INCLUDING THESE)» — the corporation's own Earth + Jovian: `Player.playCorporationCardScoped` calls
 *     `onCardPlayed(corporation)` on the owner's table, the corporation already on it — so the card answers its OWN
 *     play through the same hook: +2 leverage, no `addResources`, no special case (TR81's «including from this»).
 *  4. THE FORECAST TWIN reads the same predicate: ONE `exact` fact PER MATCHING TAG (the GMO convention), each naming
 *     its tag (`reasonTag`) on the effect row (`printedEffect: 0`); no match → no fact.
 *  5. THE ACTION is declarative — `or` [2 leverage → 1 delegate | 4 leverage → 2 delegates], each branch with its OWN
 *     `spend.resourcesHere`. The delegate is each branch's WHOLE result, so the shared laws hold for free:
 *     (a) with no resolution up for a vote a branch is refused — never paid for nothing
 *     (`delegateIsTheActionsResult` reads `or` branches); (b) the leverage is the grant's PRICE — it leaves the card
 *     inside the vote's answer (`PlaceDelegatesOnResolution` CHECK → PAY → PLACE), the preview's door asking the very
 *     same grant. Below 2 the action is closed («N of 2 leverage on this card»); 2–3 — the one live branch IS the
 *     action (no prompt; the other shown disabled with its reason); 4+ — an `OrOptions` marked `effect-choice`, never
 *     auto-selected. Two delegates land on ONE resolution; a reserve of one refuses the second branch (the Executor's
 *     own reserve gate — a price for two buys two, or nothing).
 *  6. THE TEXT names the Moon only when the Moon is in the game, Venus only with Venus (the owner): `metadata.textVariants` — the face prints
 *     the planet disc alone, the client prints the variant (`cardTextVariants.ts`); the captions never list the tags.
 *  7. MarsBot never holds the card (no twin).
 */
export class TitanHoldings extends ActiveCorporationCard {
  /** One delegate per 2 leverage, in either branch — the satellite's «a delegate per 2 leverage», the target step's reach. */
  public readonly resourceRole: DeclaredHolderRole = {kind: 'delegate', price: TITAN_LEVERAGE_PER_DELEGATE};

  constructor() {
    super({
      name: CardName.TITAN_HOLDINGS,
      tags: [Tag.EARTH, Tag.JOVIAN],
      startingMegaCredits: 50,
      resourceType: CardResource.LEVERAGE,

      behavior: {
        production: {megacredits: 2},
      },

      action: {
        or: {
          behaviors: [
            {
              title: TITAN_ONE_DELEGATE_TITLE,
              spend: {resourcesHere: TITAN_LEVERAGE_PER_DELEGATE},
              turmoil: {sendDelegates: {count: 1}},
            },
            {
              title: TITAN_TWO_DELEGATES_TITLE,
              spend: {resourcesHere: 2 * TITAN_LEVERAGE_PER_DELEGATE},
              turmoil: {sendDelegates: {count: 2}},
            },
          ],
          // ONE live branch IS the action — no question asked (the `OrOptions.reduce()` exemption of invariant 3).
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR84',
        description: 'You start with 50 M€ and 2 M€ production.',
        textVariants: [
          {text: 'Effect: ' + TITAN_EFFECT_TEXT, unless: ['moon'], variant: 'Effect: ' + TITAN_EFFECT_TEXT_NO_MOON},
          {text: 'Effect: ' + TITAN_EFFECT_TEXT, unless: ['venus'], variant: 'Effect: ' + TITAN_EFFECT_TEXT_NO_VENUS},
          {text: 'Effect: ' + TITAN_EFFECT_TEXT, unless: ['moon', 'venus'], variant: 'Effect: ' + TITAN_EFFECT_TEXT_NO_MOON_NO_VENUS},
        ],
        // The captions never list the planets (a caption never carries the Moon). Both action rows are over the
        // browser's caption budget — curated shorts, each on its own row (in the printed order).
        infoText: [
          {kind: 'effect-short', text: 'A planet tag played: +1 leverage here'},
          {kind: 'action-short', text: '2 leverage here: 1 delegate'},
          {kind: 'action-short', text: '4 leverage here: 2 delegates'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          // The scan's «50», then the production plate with «2».
          b.megacredits(50).nbsp.production((pb) => pb.megacredits(2));
          b.corpBox('effect-action', (ce) => {
            ce.effect(TITAN_EFFECT_TEXT, (eb) => {
              eb.planetTag().startEffect.resource(CardResource.LEVERAGE);
            });
            ce.vSpace();
            // Each row describes ITSELF (the scan's one sentence covers both): one information group per console
            // variant, so a caption never names the wrong branch (the TFLP / census contract).
            ce.action(TITAN_ONE_DELEGATE_TITLE + '.', (eb) => {
              eb.resource(CardResource.LEVERAGE, {amount: TITAN_LEVERAGE_PER_DELEGATE, digit}).startAction.delegates(1).or();
            });
            ce.vSpace();
            ce.action(TITAN_TWO_DELEGATES_TITLE + '.', (eb) => {
              eb.resource(CardResource.LEVERAGE, {amount: 2 * TITAN_LEVERAGE_PER_DELEGATE, digit}).startAction.delegates(2);
            });
          });
        }),
      },
    });
  }

  /** Rules 2–3 — one leverage per printed planet tag, at once (the corporation's own play included). */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const qty = titanTags(card).length;
    if (qty > 0) {
      player.addResourceTo(this, {qty, log: true});
    }
  }

  /** Rule 4 — the mirror: the same predicate, one exact fact per matching tag on the effect row. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, playedCard: ICard, _ctx?: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    const source = {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0};
    return titanTags(playedCard).map((tag, i) => forecast.exact(source,
      [actionPreviews.cardGain(this, 1)],
      forecast.tagReason(tag),
      {id: `titan-${i}`, reasonTag: tag}));
  }
}
