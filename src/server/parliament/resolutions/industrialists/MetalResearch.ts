/*
 * METAL RESEARCH (the Industrialists) — Turmoil Redux resolution RX19: two
 * payouts the family has written twice already (steel by influence — Development
 * Craze; titanium by influence — Colony Contest / Jovian Tax Rights) and ONE new
 * mechanism — a passive that changes the VALUE OF A RESOURCE. It is the second
 * law that reaches into the economy after Heat Capture's discount, and a more
 * dangerous one: a discount is a computation, while a resource's value in this
 * engine is a MUTABLE, SERIALIZED FIELD of the player. The whole design of this
 * card is that the field is never touched (docs/TURMOIL_REDUX_METAL_RESEARCH.md).
 *
 * Printed: «When enacted: Gain steel and titanium both equal to your Influence.
 * Effect: Each unit of steel and titanium is worth 1 M€ extra.» Chairman quest:
 * raise your titanium production 1 step (the titanium square in the brown
 * production frame — the spec's §4.1.1 reading, Industrialist Budget's kind).
 *
 * THE READINGS FIXED HERE:
 *  · TWO PAYOUTS, TWO STEPS, TWO RECORDS: steel = influence and titanium =
 *    influence, each into the supply, for EVERY participant, by each seat's
 *    OWN influence, no cap. Influence 0 → two NAMED skips, one per step — never
 *    one shared skip (the contract: one step, one record).
 *  · THE PASSIVE IS A VALUE, NOT A DISCOUNT. A unit of steel does not get
 *    cheaper; it BUYS MORE: while the law stands, a participant's steel pays
 *    3 M€ instead of 2 and titanium 4 instead of 3 — on ANY payment where the
 *    resource is accepted (a card, a standard project, anything that reads
 *    `payingAmount`), and it STACKS with the cards that raise the value
 *    (Advanced Alloys and its kin): additively — the base, plus the player's
 *    cards, plus 1 from the law. Advanced Alloys under the law pays steel at 4.
 *  · THE BONUS LIVES ON THE READ, NEVER IN THE FIELD. `Player.steelValue` /
 *    `titaniumValue` are serialized; a law that wrote them would have to
 *    remember it had («did I already add mine?» — a second state beside the
 *    first), `decreaseSteelValue` has a floor and knows nothing about WHOSE
 *    unit it removes, and every path (a seat joining later, a re-enactment
 *    generations apart, a cancelled phase) desynchronizes the pair «gave /
 *    took back» — invisibly: the price is just quietly wrong. So the hook is
 *    a pure QUERY (`resourceValueBonus`) that the ONE value accessor asks
 *    (`Player.getSteelValue` / `getTitaniumValue` → `ParliamentHandler
 *    .resourceValueBonus`): the field is never written, the save format does
 *    not change by a byte, a save from under the law loads right by
 *    construction, and a law that leaves the ENACTED slot takes its bonus with
 *    it at the same instant — no «rollback» exists because nothing was rolled
 *    forward. The rule of the fork: A HOOK THAT ANSWERS IS NOT A HOOK THAT ACTS.
 *  · EVERY PARTICIPANT holds the law; MarsBot never (`parliament.participates`),
 *    and a seat outside the parliament is untouched by a single unit.
 *  · THE LUNA TRADE FEDERATION branch (titanium as M€ outside Space cards at
 *    value − 1) applies AFTER the value, as it always did: 4 − 1 = 3.
 *  · THE FORECAST TWIN of a value is the rate itself, printed where the
 *    decision is made (the rail's value badge, the payment panel's «×3»): the
 *    passive states no FACT (Heat Capture's precedent — a fact would print the
 *    same number a second time, with no `effect-triggered` event to match).
 *  · NOTHING HERE GIVES TR, moves a parameter or asks the player: both steps
 *    MUTATE.
 *
 * THE STEP CONTRACT (IResolution.ts): both steps MUTATE (nothing here asks),
 * and each reports exactly once — the skips included.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {IPlayer} from '../../../IPlayer';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const METAL_RESEARCH_ID: ResolutionId = 'RDX_INDUSTRIALISTS_METAL_RESEARCH';
export const METAL_RESEARCH_CODE: ResolutionCode = 'RX19';

/** THE STEEL: 1 per point of influence, for every participant — no count, no cap (Development Craze's formula). */
export const METAL_RESEARCH_STEEL: InfluenceScaledEffect = {
  id: 'steel',
  unit: {kind: 'stock', resource: Resource.STEEL},
  perInfluence: 1,
  recipient: 'each',
};

/** THE TITANIUM: 1 per point of influence, for every participant — no count, no cap (Colony Contest's formula). */
export const METAL_RESEARCH_TITANIUM: InfluenceScaledEffect = {
  id: 'titanium',
  unit: {kind: 'stock', resource: Resource.TITANIUM},
  perInfluence: 1,
  recipient: 'each',
};

/** THE PASSIVE'S RATE: 1 M€ more per unit of steel and of titanium, while the law stands. */
export const METAL_RESEARCH_VALUE_BONUS = 1;

/**
 * THE M€ the law ADDS to what one unit of `resource` buys for `player` — the
 * one function the value accessors read (never a second reading of the rule).
 * Steel and titanium only; every other resource is untouched. Pure: it reads
 * nothing but the resource, never mutates, never logs.
 */
export function metalResearchValueBonus(_player: IPlayer, resource: Resource): number {
  return resource === Resource.STEEL || resource === Resource.TITANIUM ? METAL_RESEARCH_VALUE_BONUS : 0;
}

const STEEL_STEP: EnactStep = {
  key: 'steel',
  run(ctx) {
    const player = ctx.player;
    const effect = METAL_RESEARCH_STEEL;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no steel from ${1}', (b) => b.player(player).resolution(METAL_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.STEEL, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.steel;
    // The standard gain under the resolution's source; the ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.STEEL, amount, {log: false, from: {resolution: METAL_RESEARCH_ID}});
    const after = player.steel;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.STEEL).resolution(METAL_RESEARCH_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.STEEL, amount, influence, before, after});
    return undefined;
  },
};

const TITANIUM_STEP: EnactStep = {
  key: 'titanium',
  run(ctx) {
    const player = ctx.player;
    const effect = METAL_RESEARCH_TITANIUM;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no titanium from ${1}', (b) => b.player(player).resolution(METAL_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.TITANIUM, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.titanium;
    player.stock.add(Resource.TITANIUM, amount, {log: false, from: {resolution: METAL_RESEARCH_ID}});
    const after = player.titanium;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.TITANIUM).resolution(METAL_RESEARCH_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.TITANIUM, amount, influence, before, after});
    return undefined;
  },
};

export const METAL_RESEARCH: ResolutionDefinition = {
  id: METAL_RESEARCH_ID,
  code: METAL_RESEARCH_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE, as printed: the two resources over the influence on one row
  // («[steel][titanium] / [influence]» — one formula, two units), and the
  // passive as a RULE in the game's own dictionary — «[steel][titanium] : +1 M€»,
  // Advanced Alloys' drawing with both units on the cause side. One drawing
  // serves the bill, the effects list and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.steel(1).titanium(1).slash().influence().br;
    b.effect(undefined, (eb) => eb.steel(1).titanium(1).startEffect.plus(Size.SMALL).megacredits(1));
  }),
  text: {
    name: 'Metal Research',
    effect: 'Gain 1 steel and 1 titanium for every point of your influence.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'Each unit of your steel and titanium is worth 1 M€ more.',
    quest: 'Raise your titanium production 1 step',
  },
  quest: {goal: {kind: 'production', resource: Resource.TITANIUM}, count: 1},
  scaled: [METAL_RESEARCH_STEEL, METAL_RESEARCH_TITANIUM],
  // THE PRINTED ORDER: the steel first, the titanium second.
  immediateSteps: [STEEL_STEP, TITANIUM_STEP],
  passive: {
    resourceValueBonus: metalResearchValueBonus,
    // The value's forecast twin is the RATE where the decision is made (the
    // rail's value badge, the payment panel's «×3») — see the header: no fact
    // of its own, and nothing else of this law fires on a play.
    forecast() {
      return [];
    },
  },
};
