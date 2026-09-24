/*
 * HEAT CAPTURE (the Reds) — Turmoil Redux resolution RX14: three mechanisms
 * the family already has (a supply payout by influence, a WORLD step that
 * LOWERS a parameter for nobody, a live passive) and ONE new form of passive —
 * a DISCOUNT on playing cards. It is the first law that reaches into the
 * ECONOMY of cards rather than the board or a payout, so it must be visible
 * where the player decides to buy: in the price and its explanation, not only
 * as a row in the effects list (docs/TURMOIL_REDUX_HEAT_CAPTURE.md).
 *
 * Printed: «When enacted: Gain 2 M€ per point of Influence. If the global
 * temperature is not at maximum, reduce it 2 steps. Effect: When playing a
 * Building tag, you pay 3 M€ less.» Chairman quest: play 2 Building tags.
 *
 * THE READINGS FIXED HERE:
 *  · M€: 2 × the player's influence for EVERY participant — the family's
 *    ordinary supply payout (Gas Export's row, word for word). Influence 0 →
 *    nothing, NAMED.
 *  · THE WORLD'S PART is Gas Export's procedure with another parameter and
 *    another size: the temperature goes down TWO steps (2 °C apiece), ONCE
 *    per enactment, after every seat's M€, whoever won and even when the
 *    NEUTRAL player did; its record carries no player. The card's own clause
 *    is checked FIRST («if not at maximum» — a rule of the resolution, not a
 *    limit of the arithmetic: there is plenty of room below), the floor of the
 *    scale second, and both are NAMED (the engine's negative branch would do
 *    nothing silently in either case). One step from the floor, one step
 *    happens and the record carries the step actually made.
 *  · NOBODY LOSES A TERRAFORM RATING. A lowering never paid a rating to begin
 *    with; ratings are not touched, and `unrewarded` keeps the political phase
 *    from crediting the engine's handle player with anything (WGT parity, the
 *    decision D1 of RX12).
 *  · THE DISCOUNT, while the card stands enacted: 3 M€ off the printed cost of
 *    a card with a Building tag, on any play in any phase a play is possible,
 *    for every participant holding the law — asked by the ONE price function
 *    (`Player.getCardCostBreakdown` → `ParliamentHandler.cardDiscount`) and
 *    itemized there under THIS resolution's source. The price never goes below
 *    zero (the breakdown's own floor). A card without the tag pays its price.
 *    Ends with the law: the handler reads the ENACTED definition at the query.
 *  · THE FORECAST TWIN of a discount is the price breakdown itself: the play
 *    forecast's discount group reads `getCardCostBreakdown` at the same moment
 *    the payment head does, so the law is named there with the same 3 M€. The
 *    passive's `forecast` therefore states no FACT for it (a fact would print
 *    the same number a second time, with no `effect-triggered` event to match).
 *  · MARSBOT is outside the parliament: no M€, no discount. The planet is
 *    shared like everybody's.
 *  · THE PRODUCTION BONUSES of the temperature track (−24 / −20 °C) are
 *    claimed on the way UP by the engine's own rule; a lowering through them
 *    re-arms nothing and pays nothing — the card keeps no register.
 *
 * THE STEP CONTRACT (IResolution.ts): both steps MUTATE (nothing here asks),
 * and each reports exactly once — including the branch where the temperature
 * is at its limit.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {WorldParameterMove, parameterRoom} from '../../../../common/parliament/parameterMove';
import {IPlayer} from '../../../IPlayer';
import {IProjectCard} from '../../../cards/IProjectCard';
import {EnactContext, EnactStep, ResolutionDefinition} from '../IResolution';

export const HEAT_CAPTURE_ID: ResolutionId = 'RDX_REDS_HEAT_CAPTURE';
export const HEAT_CAPTURE_CODE: ResolutionCode = 'RX14';

/** THE FORMULA: 2 M€ per point of influence, for every participant — no count, no cap. */
export const HEAT_CAPTURE_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 2,
  recipient: 'each',
};

/** THE WORLD'S PART, as data: the temperature down two steps — and nobody is credited (a lowering never is). */
export const HEAT_CAPTURE_TEMPERATURE: WorldParameterMove = {parameter: 'temperature', steps: -2, terraformRating: false};

/** THE PASSIVE'S RATE: 3 M€ off a card with a Building tag, while the law stands. */
export const HEAT_CAPTURE_BUILDING_DISCOUNT = 3;

/**
 * THE DISCOUNT the law takes off `card` for `player` — the one function the
 * price, its breakdown and the play forecast read (never a second reading of
 * the rule). Printed tags only: the card's own Building tag, as the Unity
 * policy reads a Space tag.
 */
export function heatCaptureDiscount(_player: IPlayer, card: IProjectCard): number {
  return card.tags.includes(Tag.BUILDING) ? HEAT_CAPTURE_BUILDING_DISCOUNT : 0;
}

/** The table as the engine has it right now — the ONE reader for the world step below. */
function tableOf(ctx: EnactContext) {
  return {
    oxygenLevel: ctx.game.getOxygenLevel(),
    temperature: ctx.game.getTemperature(),
    oceans: ctx.game.board.getOceanSpaces().length,
    venusScaleLevel: ctx.game.gameOptions.venusNextExtension ? ctx.game.getVenusScaleLevel() : undefined,
  };
}

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = HEAT_CAPTURE_MEGACREDITS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no M€ from ${1}', (b) => b.player(player).resolution(HEAT_CAPTURE_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.MEGACREDITS, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.megaCredits;
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: HEAT_CAPTURE_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: 2 per point of influence, influence ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resolution(HEAT_CAPTURE_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.MEGACREDITS, amount, influence, before, after});
    return undefined;
  },
};

/**
 * TEMPERATURE −2, once, for the table. The step reads the ROOM first (the
 * shared `parameterRoom`, the same arithmetic the vote panel printed) so a move
 * that cannot happen is NAMED — never left to the engine's silent early return.
 */
const TEMPERATURE_STEP: EnactStep = {
  key: 'temperature',
  run(ctx) {
    const move = HEAT_CAPTURE_TEMPERATURE;
    const room = parameterRoom(move, tableOf(ctx));
    // THE CARD'S OWN CLAUSE FIRST — «if the global temperature is not at
    // maximum»: a maxed temperature is a rule of this resolution, not an
    // arithmetic limit (there is room BELOW it). The floor is the arithmetic
    // one, and both are NAMED: the engine's own negative branch would do
    // nothing in either case, and leaning on that silence is the defect this
    // guards against.
    const atMaximum = room.current >= room.max;
    if (atMaximum || !room.moves) {
      const reason = atMaximum ? 'Temperature is at its maximum — it is not reduced' : 'Temperature is already at its minimum';
      if (atMaximum) {
        ctx.game.log('Temperature is at its maximum — ${0} does not reduce it', (b) => b.resolution(HEAT_CAPTURE_ID));
      } else {
        ctx.game.log('Temperature is already at its minimum — ${0} cannot reduce it', (b) => b.resolution(HEAT_CAPTURE_ID));
      }
      ctx.report({kind: 'skipped', amount: 0, parameter: {id: 'temperature', before: room.current, after: room.current}, unrewarded: true, reason});
      return undefined;
    }
    // The HANDLE is the engine's argument, not the author: the scope carries
    // the resolution with no owner, so the change is recorded without a player.
    // One step from the floor the room says −1, and that is what is asked.
    ctx.game.increaseTemperature(ctx.player, room.applied === -1 ? -1 : -2, {unrewarded: true});
    const after = ctx.game.getTemperature();
    ctx.game.log('${0} reduced the temperature ${1} step(s) (${2}°C → ${3}°C)', (b) =>
      b.resolution(HEAT_CAPTURE_ID).number(-room.applied).number(room.current).number(after));
    ctx.report({kind: 'globalParameter', amount: room.applied, parameter: {id: 'temperature', before: room.current, after}, unrewarded: true});
    return undefined;
  },
};

export const HEAT_CAPTURE: ResolutionDefinition = {
  id: HEAT_CAPTURE_ID,
  code: HEAT_CAPTURE_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row, the world's
  // move on the next («− [temperature] ×2» — the scale's icon twice, with the
  // asterisk that points at the rule's «unless at maximum»), and the passive as
  // a RULE in the game's own dictionary — a Building tag → 3 M€ less (Earth
  // Office's drawing for its Earth tag). One drawing serves the bill, the
  // effects list and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(2).slash().influence().br;
    b.minus().temperature(2).asterix().br;
    b.effect(undefined, (eb) => eb.tag(Tag.BUILDING).startEffect.megacredits(-HEAT_CAPTURE_BUILDING_DISCOUNT));
  }),
  text: {
    name: 'Heat Capture',
    effect: 'Gain 2 M€ for every point of your influence.',
    world: 'The temperature is reduced 2 steps unless it is already at its maximum. Nobody loses or gains TR for this.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'When you play a card with a building tag, you pay 3 M€ less for it.',
    quest: 'Play 2 building tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2},
  scaled: [HEAT_CAPTURE_MEGACREDITS],
  worldMoves: [HEAT_CAPTURE_TEMPERATURE],
  immediateSteps: [MEGACREDITS_STEP],
  worldSteps: [TEMPERATURE_STEP],
  passive: {
    cardDiscount: heatCaptureDiscount,
    // The discount's forecast twin is the price breakdown (see the header):
    // no fact of its own, and nothing else of this law fires on a play.
    forecast() {
      return [];
    },
  },
};
