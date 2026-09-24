/*
 * GENEROUS FUNDING (Greens) — Turmoil Redux resolution RX13: the FOURTH card
 * of the «counter + influence» family (Architecture Award opened it over
 * CARDS, Central Power Grid over TAGS, Colonization Funding over the BOARD) —
 * and the first whose counter reads ONE PLAYER METRIC by threshold and step
 * (docs/TURMOIL_REDUX_GENEROUS_FUNDING.md).
 *
 * Printed: «When enacted: Gain 2 M€ for each point of Influence and each
 * complete set of 5 TR over 15.» Chairman quest: raise your TR 3 steps. A
 * base card: no expansion is needed for a terraform rating.
 *
 * THE READINGS FIXED HERE:
 *  · The amount is 2 × (S + I) for EVERY participant — voters or not, the
 *    Greens' effect or not; a neutral winner cancels nothing. There is NO
 *    winner-only part and NO cap («max» is not printed).
 *  · S = the player's COMPLETE SETS OF 5 TR OVER 15: `⌊max(0, TR − 15) / 5⌋`
 *    — TR 15 → 0, 19 → 0, 20 → 1, 24 → 1, 25 → 2, 30 → 3. The remainder pays
 *    nothing. The rating is THE ENGINE's (`player.terraformRating`), never
 *    rebuilt from its parts; the division is the family's ONE function
 *    (`thresholdSets` in `common/parliament/resolutionCounts.ts`) — this card
 *    restates nothing.
 *  · 15 is the CARD's constant, not «the starting rating»: a solo game or a
 *    handicap variant starts elsewhere, the threshold does not move.
 *  · Influence pays on its own: TR below 20 and influence 3 is +6 — the terms
 *    ADD, as everywhere in the family. The skip is only for a total of zero.
 *  · I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10; a TR
 *    step of the Agenda raises the rating BEFORE the effect reads it).
 *  · It is CASH into the supply through `stock.add` (its events, the party
 *    reactions, the recorder) — never production, never a field write.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:megacredits`) makes a reload or
 *    a repeated handler call pay nothing twice; a later rating, a later
 *    influence and a change of government never recompute it (the outcome
 *    freezes S WITH THE BREAKDOWN of the rating — value, threshold, step,
 *    sets, distance to the next set — I, and the supply before and after); a
 *    LATER enactment of the card is a new generation's key — a new
 *    application by the rating as it stands then.
 *  · A result of 0 (no full set, no influence) is NAMED — a journal line and
 *    a `skipped` outcome carrying the breakdown — and changes nothing.
 *  · MarsBot takes no seat in the parliament: it is never counted, never paid.
 *
 * THE STEP MUTATES (IResolution.ts): no question is asked, so `run` pays the
 * supply and reports it; the driver marks the key applied before anything
 * else can run.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {TERRAFORM_RATING_SETS_STEP} from '../../../../common/parliament/resolutionCounts';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const GENEROUS_FUNDING_ID: ResolutionId = 'RDX_GREENS_GENEROUS_FUNDING';
export const GENEROUS_FUNDING_CODE: ResolutionCode = 'RX13';
/** The printed «2 M€» — per point of influence AND per complete set. */
export const GENEROUS_FUNDING_PER_UNIT = 2;
/** The printed «+3 TR» of the chairman quest. */
export const GENEROUS_FUNDING_QUEST_STEPS = 3;

/** THE FORMULA: 2 M€ per complete set of 5 TR over 15 + 2 M€ per influence, no cap, for every participant. */
export const GENEROUS_FUNDING_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: GENEROUS_FUNDING_PER_UNIT,
  count: {id: 'terraformRatingSets', per: GENEROUS_FUNDING_PER_UNIT},
  recipient: 'each',
};

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = GENEROUS_FUNDING_MEGACREDITS;
    // The engine's rating, divided by the family's one rule, with the
    // BREAKDOWN that explains it — see `ResolutionCounts.ts`.
    const counted = resolutionCount(player, 'terraformRatingSets');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.metric === undefined ? {} : {countedMetric: {...counted.metric}}),
    };
    const rating = counted.metric?.value ?? player.terraformRating;
    if (amount <= 0) {
      ctx.game.log('${0} has no complete set of 5 TR over 15 (TR ${1}) and no influence — no M€ from ${2}', (b) =>
        b.player(player).number(rating).resolution(GENEROUS_FUNDING_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No TR sets and no influence'});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain: its events, the party reactions and the recorder see
    // it under this resolution's source. The ONE journal line below carries
    // the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: GENEROUS_FUNDING_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} set(s) of 5 TR over 15 (TR ${4}) × 2 + ${5} influence × 2 (${6} → ${7})', (b) =>
      b.player(player).number(amount).resolution(GENEROUS_FUNDING_ID)
        .number(counted.count).number(rating).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

export const GENEROUS_FUNDING: ResolutionDefinition = {
  id: GENEROUS_FUNDING_ID,
  code: GENEROUS_FUNDING_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE, as printed: «2 [M€] / [influence] + [TR 5]» on one row, «over 15»
  // under it — the counted object is the TR badge carrying the set's size (the
  // physical card's «5» inside the rating icon), never a bare rating (that
  // would read «per TR») and never a card glyph. One rate for both terms, as
  // the rule text says («2 M€ for each … and each …»).
  renderData: CardRenderer.builder((b) => {
    b.megacredits(GENEROUS_FUNDING_PER_UNIT).slash().influence().plus().tr(TERRAFORM_RATING_SETS_STEP).br;
    // A literal key (the locale greps it) — the spec pins it to `TERRAFORM_RATING_SETS_OVER`.
    b.text('over 15', Size.SMALL, true);
  }),
  text: {
    name: 'Generous Funding',
    effect: 'Gain 2 M€ per influence and 2 M€ per full 5 TR you have above 15.',
    quest: 'Raise your TR 3 steps',
  },
  quest: {goal: {kind: 'tr'}, count: GENEROUS_FUNDING_QUEST_STEPS},
  scaled: [GENEROUS_FUNDING_MEGACREDITS],
  immediateSteps: [MEGACREDITS_STEP],
};
