/*
 * COLONIZATION FUNDING (Unity) — Turmoil Redux resolution RX08: the THIRD card
 * of the «counter + influence → capped production» family Architecture Award
 * opened and Central Power Grid proved a mechanism — and the first whose
 * counter reads THE BOARD instead of the tableau
 * (docs/TURMOIL_REDUX_COLONIZATION_FUNDING.md).
 *
 * Printed: «When enacted: Increase your M€ production 2 steps for every space
 * city you have + 1 more step per point of Influence. (Max. 6)» Chairman
 * quest: place 1 space city. A base card: the reserved areas off Mars are the
 * base game's own (Ganymede Colony, Phobos Space Haven).
 *
 * THE READINGS FIXED HERE:
 *  · The amount is min(6, 2 × S + I) for EVERY participant — voters or not,
 *    the Unity effect or not; a neutral winner cancels nothing. There is NO
 *    winner-only part.
 *  · S = the player's SPACE CITIES: their city tiles on the reserved areas
 *    OFF Mars (`SpaceType.COLONY` cells of the Mars board — Ganymede Colony,
 *    Phobos Space Haven, Stanford Torus, the Venus and Pathfinders areas).
 *    THE ENGINE COUNTS THEM (`MarsBoard.getCitiesOffMars(player)`, the very
 *    reading the Cosmic Settler award and the behavior counter stand on) —
 *    this card restates nothing. A city ON Mars is not a space city; a
 *    rival's space city is theirs; the Moon is another board and none of its
 *    tiles is a space city; an empty reserved area is nothing.
 *  · Influence pays on its own: no space city and influence 3 is +3 — the
 *    terms ADD, as everywhere in the family. The skip is only for a total of
 *    zero.
 *  · I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10).
 *  · «Max. 6» caps the INCREASE (2S + I), never the resulting production:
 *    production 8 becomes 14. A negative production rises the ordinary way.
 *  · It is a PRODUCTION increase through `production.add` (its events, the
 *    party reactions, the recorder) — never cash, never a field write.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:production`) makes a reload or
 *    a repeated handler call pay nothing twice; a later space city, a later
 *    influence and a change of government never recompute it (the outcome
 *    freezes S, the counted CELLS, I, the sum before the cap and the value
 *    before and after); a LATER enactment of the card is a new generation's
 *    key — a new application by the board as it stands then.
 *  · A result of 0 (no space city, no influence) is NAMED — a journal line
 *    and a `skipped` outcome — and changes nothing.
 *
 * THE STEP MUTATES (IResolution.ts): no question is asked, so `run` applies
 * the increase and reports it; the driver marks the key applied before
 * anything else can run.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect} from '../../../../common/parliament/influenceScaling';
import {ResolutionDefinition} from '../IResolution';
import {productionCountStep, ProductionCountWords} from '../ResolutionProductionCount';

export const COLONIZATION_FUNDING_ID: ResolutionId = 'RDX_UNITY_COLONIZATION_FUNDING';
export const COLONIZATION_FUNDING_CODE: ResolutionCode = 'RX08';
/** The printed «(Max. 6)» — a bound on the increase. */
export const COLONIZATION_FUNDING_CAP = 6;
/** The printed «2 steps for every space city». */
export const COLONIZATION_FUNDING_PER_CITY = 2;

/** THE FORMULA: +2 M€ production per space city + 1 per influence, at most +6, for every participant. */
export const COLONIZATION_FUNDING_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'spaceCities', per: COLONIZATION_FUNDING_PER_CITY},
  cap: COLONIZATION_FUNDING_CAP,
  recipient: 'each',
};

/** THE JOURNAL — the card's own sentence; the shared step supplies the numbers (`ProductionCountWords`). */
const WORDS: ProductionCountWords = {
  none: '${0} has no space city and no influence — no ${1} production from ${2}',
  reason: 'No space cities and no influence',
  gained: '${0} gained ${1} ${2} production from ${3}: ${4} space city(-ies) × 2 + ${5} influence (${6} → ${7})',
  capped: '${0} gained ${1} ${2} production from ${3}: ${4} space city(-ies) × 2 + ${5} influence = ${6}, limited to the maximum of ${1} (${7} → ${8})',
};

// THE STEP is the family's (`productionCountStep`): the engine's own count of
// the player's space cities, with the CELLS that made it — see
// `ResolutionCounts.ts` — paid through `production.add`, frozen in the record.
const PRODUCTION_STEP = productionCountStep(COLONIZATION_FUNDING_ID, COLONIZATION_FUNDING_PRODUCTION, WORDS);

export const COLONIZATION_FUNDING: ResolutionDefinition = {
  id: COLONIZATION_FUNDING_ID,
  code: COLONIZATION_FUNDING_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE, as printed: «2 [M€ production] / [city*] + [influence]» on one
  // row, the cap on the next — the counted object is the CITY tile with the
  // footnote spark (the physical card's «space city»: the same drawing the
  // chairman quest prints for one), never a bare city (that would read «every
  // city you have») and never a card glyph. The influence term's own rate is
  // the rule text's («+1 more step per point of influence»).
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.megacredits(COLONIZATION_FUNDING_PER_CITY)).slash().city({size: Size.SMALL}).asterix().plus().influence().br;
    b.text('max 6', Size.SMALL, true);
  }),
  text: {
    name: 'Colonization Funding',
    effect: 'Raise your M€ production 2 steps per space city you have, plus 1 per influence. Max 6.',
    quest: 'Place 1 space city',
  },
  quest: {goal: {kind: 'tile', tile: 'spaceCity'}, count: 1},
  scaled: [COLONIZATION_FUNDING_PRODUCTION],
  immediateSteps: [PRODUCTION_STEP],
};
