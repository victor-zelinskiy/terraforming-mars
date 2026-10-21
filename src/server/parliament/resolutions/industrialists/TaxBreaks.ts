/*
 * TAX BREAKS (the Industrialists) — Turmoil Redux resolution RX41: an
 * ASSEMBLY, and nothing of its own but one word (docs/TURMOIL_REDUX_TAX_BREAKS.md).
 * The payout is Central Power Grid's (RX04) term for term — M€ production =
 * the count + influence, the cap on the increase — and the count stands on
 * Sponsored Projects' (RX40) reading of the seat's cards — the engine's
 * `Player.getCardsWithResources`. What is new is the MEASURE of that reading:
 *
 *   Sponsored Projects counts the HOLDERS (a card apiece — every one receives);
 *   Tax Breaks counts the different KINDS among them («Fish + Birds + Dirigibles»
 *   is 2) — the engine's own measure for Tradesman, Collector and the
 *   resource-type requirement.
 *
 * Printed: «When enacted: Each player increases their M€ production 1 step
 * for each different type of card resource they have + Influence. (Max. 5)»
 * Chairman quest: add 2 mech resources to your cards.
 *
 * THE READINGS FIXED HERE (each pinned by tests/parliament/TaxBreaks.spec.ts):
 *  · The amount is min(5, K + I) for EVERY participant — voters or not; no
 *    winner part, no passive, no action, nothing of the table's.
 *  · K = the DIFFERENT `resourceType`s among the seat's cards in play that
 *    HOLD at least one resource (decision Р2 — «a type they have» is a type
 *    with a resource on it): two animal cards are one kind; a holder at 0
 *    holds no kind yet; a corporation with resources is a card of the seat
 *    (Arklight's animals — RX40's Р2); another seat's cards never count. The
 *    count `cardResourceTypes` — the holders kind, measure `types` — through
 *    the ONE grouping (`holderKindsOf`); no walk of its own.
 *  · I = the seat's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10).
 *  · «Max. 5» caps the INCREASE (K + I), never the resulting production:
 *    production 10 becomes 15; the record keeps the sum before the cap.
 *  · A PRODUCTION increase through `production.add` (its events, the party
 *    reactions, the recorder) — the family's counted production step. The
 *    Industrialists' own Redux effect is an action and answers nothing here;
 *    a card of the table that answers a production increase answers.
 *  · ONCE per enactment (the driver's key); the record freezes K with the
 *    kinds and the cards that made it (`countedByCard`), I, the uncapped sum
 *    and the production before and after — a later resource never recomputes it.
 *  · A result of 0 (no resource on any card, no influence) is NAMED.
 *  · MARSBOT — nothing (D3: the bot has no production; this is a payout, and
 *    D11 hands the bot only a deed). Its quest is UNREACHABLE for the bot —
 *    no storage area of the bot holds mechs, and the quest block says so.
 *  · THE QUEST — 2 mechs added to the seat's cards by its own deeds; a mech a
 *    law's action adds (Manufacturing Run) is the law's, never the seat's (Q5).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {CardResource} from '../../../../common/CardResource';
import {Size} from '../../../../common/cards/render/Size';
import {AltSecondaryTag} from '../../../../common/cards/render/AltSecondaryTag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect} from '../../../../common/parliament/influenceScaling';
import {ResolutionDefinition} from '../IResolution';
import {productionCountStep, ProductionCountWords} from '../ResolutionProductionCount';

export const TAX_BREAKS_ID: ResolutionId = 'RDX_INDUSTRIALISTS_TAX_BREAKS';
export const TAX_BREAKS_CODE: ResolutionCode = 'RX41';
/** The printed «(Max. 5)» — a bound on the increase. */
export const TAX_BREAKS_CAP = 5;
/** The printed «2 [mech]» — the chairman quest's count. */
export const TAX_BREAKS_QUEST_MECHS = 2;
/** The skip's reason when the seat has no resource on any card and no influence — an English key. */
export const TAX_BREAKS_NO_KINDS_REASON = 'No resources on your cards and no influence';

/** THE FORMULA: +1 M€ production per different kind of resource on the seat's cards + 1 per influence, at most +5, for every participant. */
export const TAX_BREAKS_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'cardResourceTypes', per: 1},
  cap: TAX_BREAKS_CAP,
  recipient: 'each',
};

/** THE JOURNAL — the card's own sentence; the shared step supplies the numbers (`ProductionCountWords`). */
const WORDS: ProductionCountWords = {
  none: '${0} has no resource on their cards and no influence — no ${1} production from ${2}',
  reason: TAX_BREAKS_NO_KINDS_REASON,
  gained: '${0} gained ${1} ${2} production from ${3}: ${4} resource type(s) + ${5} influence (${6} → ${7})',
  capped: '${0} gained ${1} ${2} production from ${3}: ${4} resource type(s) + ${5} influence = ${6}, limited to the maximum of ${1} (${7} → ${8})',
};

// THE STEP is the family's (`productionCountStep`): the seat's holders by kind, the cap on the increase,
// `production.add` under the law, the kinds and their cards frozen in the record.
const PRODUCTION_STEP = productionCountStep(TAX_BREAKS_ID, TAX_BREAKS_PRODUCTION, WORDS);

export const TAX_BREAKS: ResolutionDefinition = {
  id: TAX_BREAKS_ID,
  code: TAX_BREAKS_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE, as printed: «1 [M€ production] / [a card holding a «?»] + [influence]» on one row, the cap on the
  // next. The counted object is the set's HOLDER glyph (TR53 / RX40's white card) carrying ONE «?» square instead
  // of RX40's three cubes — the WILD resource the premium set prints for «a kind of resource» (Tradesman's own
  // «?») — so the two laws read apart at a glance: three cubes = every card that holds, one «?» = every KIND held.
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.megacredits(1)).slash().resourceCard({secondaryTag: AltSecondaryTag.WILD_RESOURCE}).plus().influence().br;
    b.text('max 5', Size.SMALL, true);
  }),
  text: {
    name: 'Tax Breaks',
    effect: 'Raise your M€ production 1 step per different type of resource on your cards, plus 1 per influence. Max 5.',
    quest: 'Add 2 mech resources to your cards',
  },
  quest: {goal: {kind: 'cardResource', resource: CardResource.MECH}, count: TAX_BREAKS_QUEST_MECHS},
  scaled: [TAX_BREAKS_PRODUCTION],
  immediateSteps: [PRODUCTION_STEP],
};
