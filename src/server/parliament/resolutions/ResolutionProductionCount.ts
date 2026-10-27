/*
 * THE COUNTED PRODUCTION STEP (Turmoil Redux) — the ONE executor of «raise
 * your [resource] production 1 step per X you have (+ influence), max N»:
 * Architecture Award (RX02, building cards with a VP icon), Central Power Grid
 * (RX04, power tags), Colonization Funding (RX08, space cities × 2), Jovian Tax
 * Rights (RX17, colonies, no influence term) and Tax Breaks (RX41, the
 * different kinds of resource on the seat's cards). The body was written four
 * times, word for word but for the count and the journal's sentence; a card
 * now declares the effect and its WORDS, and this step is the same for all.
 *
 * WHAT THE STEP FIXES (each card's spec pins it for its own count):
 *  · THE COUNT IS THE SERVER'S ONE READING (`resolutionCount`) of the effect's
 *    own count id — the number AND what explains it, frozen into the record:
 *    the counted cards, and every breakdown the model carries (a tag count's
 *    `units`, a board count's cells, the colonies' tiles, the holders by card
 *    — whichever the count has, and nothing it does not).
 *  · THE ARITHMETIC IS THE FAMILY'S (`scaledAmount` / `uncappedAmount`): the
 *    cap bounds the INCREASE, never the production — 10 becomes 15 at max 5;
 *    the record keeps the sum before the cap beside the amount.
 *  · THROUGH `production.add` under the law's source (`from: {resolution}`):
 *    its events, the party reactions and the recorder see it; the add itself
 *    is silent, because ONE journal line carries the whole calculation — in
 *    the card's own words, capped or not, with the influence where influence
 *    is a term of the part (Jovian Tax Rights prints none).
 *  · ZERO IS NAMED — a journal line and a `skipped` record with the card's own
 *    reason, the amount 0, nothing changed.
 *
 * The step MUTATES and never asks (IResolution.ts): the driver's per-seat key
 * makes it once, so a reload finds it done or not yet run — never half-done,
 * and never recomputed from a later tableau.
 */
import {Resource} from '../../../common/Resource';
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount, uncappedAmount} from '../../../common/parliament/influenceScaling';
import {ResolutionCountModel} from '../../../common/parliament/resolutionCounts';
import {EnactOutcome, EnactStep} from './IResolution';
import {resolutionCount} from './ResolutionCounts';

/**
 * A counted production card's JOURNAL — English templates (i18n keys), the
 * sentence only the card can say. The params, in order:
 *   · `none`   — `${0}` the seat · `${1}` the resource · `${2}` the law;
 *   · `gained` — `${0}` the seat · `${1}` the amount · `${2}` the resource · `${3}` the law · `${4}` the count ·
 *                [`${5}` the influence, where influence is a term] · then the production before and after;
 *   · `capped` — the same, with the sum before the cap between the influence (or the count) and the edges.
 */
export type ProductionCountWords = {
  none: string;
  /** The skip's reason — an English key the reward stage translates. */
  reason: string;
  gained: string;
  capped: string;
};

/** Everything the count model explains its number with, renamed to the record's fields — present only where the count has it. */
export function countedBreakdown(counted: ResolutionCountModel): Partial<EnactOutcome> {
  return {
    ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
    ...(counted.byTag === undefined ? {} : {countedByTag: counted.byTag.map((entry) => ({...entry}))}),
    ...(counted.byResource === undefined ? {} : {countedByResource: counted.byResource.map((entry) => ({...entry}))}),
    ...(counted.spaces === undefined ? {} : {countedSpaces: [...counted.spaces]}),
    ...(counted.tiers === undefined ? {} : {countedTiers: [...counted.tiers]}),
    ...(counted.metric === undefined ? {} : {countedMetric: {...counted.metric}}),
    ...(counted.colonies === undefined ? {} : {countedColonies: [...counted.colonies]}),
    ...(counted.byCard === undefined ? {} : {countedByCard: counted.byCard.map((entry) => ({...entry}))}),
  };
}

/**
 * THE STEP paying `effect` — a PRODUCTION unit with a COUNT term — for
 * `resolution`, keyed by the effect's id. Refuses any other declaration at
 * construction: the step and its declaration are one thing.
 */
export function productionCountStep(resolution: ResolutionId, effect: InfluenceScaledEffect, words: ProductionCountWords): EnactStep {
  const unit = effect.unit;
  const count = effect.count;
  if (unit.kind !== 'production' || count === undefined) {
    throw new Error(`${resolution}: the counted production step pays a PRODUCTION unit with a count term (effect '${effect.id}')`);
  }
  const resource: Resource = unit.resource;
  // Influence is a TERM of the part only at a rate above 0 — the journal then names it; a rate of 0 prints none.
  const influenceEnters = effect.perInfluence !== 0;
  return {
    key: effect.id,
    run(ctx) {
      const player = ctx.player;
      const counted = resolutionCount(player, count.id);
      const influence = ctx.influence;
      const uncapped = uncappedAmount(effect, influence, counted.count);
      const amount = scaledAmount(effect, influence, counted.count);
      const recorded = {
        effect: effect.id,
        production: resource,
        influence,
        count: counted.count,
        counted: [...counted.cards],
        ...countedBreakdown(counted),
        uncapped,
      };
      if (amount <= 0) {
        ctx.game.log(words.none, (b) => b.player(player).resource(resource).resolution(resolution));
        ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: words.reason});
        return undefined;
      }
      const before = player.production.get(resource);
      // The standard increase: its events, the party reactions and the
      // recorder see it under this resolution's source. The ONE journal line
      // below carries the whole calculation, so the add itself stays silent.
      player.production.add(resource, amount, {log: false, from: {resolution}});
      const after = player.production.get(resource);
      ctx.game.log(uncapped > amount ? words.capped : words.gained, (b) => {
        b.player(player).number(amount).resource(resource).resolution(resolution).number(counted.count);
        if (influenceEnters) {
          b.number(influence);
        }
        if (uncapped > amount) {
          b.number(uncapped);
        }
        b.number(before).number(after);
      });
      ctx.report({kind: 'production', ...recorded, amount, before, after});
      return undefined;
    },
  };
}
