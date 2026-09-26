/*
 * GREENS BUDGET (the Greens) — Turmoil Redux resolution RX34: the FIFTH card
 * of the BUDGET family, and the one the shared count module PREDICTED — its
 * header listed «plant + microbe + animal tags» as the next budget's TAG count
 * before this file existed (docs/TURMOIL_REDUX_GREENS_BUDGET.md).
 *
 * Printed: «When enacted: Lose 10 M€. Gain M€ equal to your Plant, Microbe,
 * and Animal tags combined + Influence. Each player adds 2 animals to any
 * card, and 3 microbes to any card.» Chairman quest: play 2 plant tags. A
 * base card: no expansion is needed.
 *
 * EVERY part is a declaration of something already built: the LEVY is the
 * family's member and its ONE shared step (RX15), the payout is a TAG count
 * over three tags + influence (the form Unity Budget declared, RX29), and the
 * two flat payouts onto a card are Aquifer Contest's picker (RX01) — twice.
 * This file writes no mechanism: it states the sums, the tags and the steps.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: levy → payout → animals →
 *    microbes, for EVERY participant in turn (voters or not, the party effect
 *    or not; a neutral winner cancels nothing). Never reordered so that a
 *    seat can afford the levy.
 *  · THE LEVY IS THE FAMILY'S, whole: bounded by the seat (4 M€ pays 4 of 10
 *    and the record names the shortfall; 0 M€ pays nothing, a named skip),
 *    `from: {resolution}` on the take, and both still receive every later
 *    part — the card asks no solvency.
 *  · THE COUNT IS THREE TAGS ADDED UP — plant, microbe and animal, the
 *    project's canonical counter of EACH in the enactment's own context
 *    (`RESOLUTION_TAG_COUNTING_MODE` = `'raw'`): every source in play, a card
 *    printing two of them (Pets: Earth + animal is 1; Ecological Zone: plant +
 *    animal is 2) is 2, a wild tag is none of them, a played event's tags are
 *    face down, and the record keeps the per-tag totals beside the sum
 *    (`countedByTag`). Influence pays on its own; the terms add; no cap.
 *    Skipped — named — only when count and influence are both zero.
 *  · «TO ANY CARD» IS ONE CARD, NOT A LAYOUT. The whole of each portion lands
 *    on ONE own card the player picks (Aquifer Contest's reading of the same
 *    words — `AddResourcesToCard`, the singular), never spread over holders
 *    (that is Cloud Development's «each resource can go on a different card»
 *    — `spread` is NOT declared here). The two portions are TWO independent
 *    choices: the animals' card and the microbes' card are picked apart, each
 *    among that kind's own holders (the card's storage rule — a tag is not
 *    storage; a 0-resource holder is a fine target).
 *  · THE PORTIONS ARE FLAT: 2 animals and 3 microbes for every seat, influence
 *    does not touch them (`base`, a rate of 0 — Scientists Budget's flat
 *    draw), and they are never added to the money.
 *  · FOUR DIFFERENT ZEROS, each named as ITSELF: a short levy («pays only 4
 *    of 10»), a payout of nothing (no tags AND no influence), no card that can
 *    hold animals («2 animals are forfeited»), no card that can hold microbes
 *    («3 microbes are forfeited»). Never one «nothing happened».
 *  · TWO QUESTIONS TO ONE SEAT, IN A ROW — new to the catalog. The driver's
 *    idempotency keys (`…:<player>:animals`, `…:<player>:microbes`) make the
 *    second prompt follow the first's ANSWER, a reload between them re-ask
 *    the second and never the first, and the sitting wait for both before the
 *    next seat is visited.
 *  · MarsBot takes no seat: never levied, never paid, never asked.
 *
 * THE STEP CONTRACT (IResolution.ts): the levy and the payout MUTATE; each
 * portion step ASKS — it fixes its amount in `ctx.state` the first time it
 * runs and re-reads it afterwards (the number the question was built with is
 * the number the answer pays), and every mutation happens inside the prompt's
 * own callback.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {message} from '../../../logs/MessageBuilder';
import {AddResourcesToCard} from '../../../deferredActions/AddResourcesToCard';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';

export const GREENS_BUDGET_ID: ResolutionId = 'RDX_GREENS_GREENS_BUDGET';
export const GREENS_BUDGET_CODE: ResolutionCode = 'RX34';
/** The printed «Lose 10 M€». */
export const GREENS_BUDGET_LEVY_AMOUNT = 10;
/** The printed «adds 2 animals to any card» — the first flat portion. */
export const GREENS_BUDGET_ANIMALS_AMOUNT = 2;
/** The printed «and 3 microbes to any card» — the second flat portion. */
export const GREENS_BUDGET_MICROBES_AMOUNT = 3;

/** THE LEVY, as data: 10 M€ from every participant, first. */
export const GREENS_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: GREENS_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per plant, microbe and animal tag, plus 1 per influence, no cap, for every participant. */
export const GREENS_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'plantMicrobeAnimalTags', per: 1},
  recipient: 'each',
};

/** THE FIRST FLAT PORTION: 2 animals onto ONE own card, for every participant — a rate of 0 per influence, a base of 2. */
export const GREENS_BUDGET_ANIMALS: InfluenceScaledEffect = {
  id: 'animals',
  unit: {kind: 'cardResource', resources: [CardResource.ANIMAL]},
  base: GREENS_BUDGET_ANIMALS_AMOUNT,
  perInfluence: 0,
  recipient: 'each',
};

/** THE SECOND FLAT PORTION: 3 microbes onto ONE own card (picked apart from the animals'), for every participant. */
export const GREENS_BUDGET_MICROBES: InfluenceScaledEffect = {
  id: 'microbes',
  unit: {kind: 'cardResource', resources: [CardResource.MICROBE]},
  base: GREENS_BUDGET_MICROBES_AMOUNT,
  perInfluence: 0,
  recipient: 'each',
};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const GREENS_BUDGET_NO_TAGS_REASON = 'No plant, microbe or animal tags and no influence';
/** The server's own reasons for a forfeited portion — one per kind, the picker family's own words (RX01). */
export const GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON = 'No card can hold animals';
export const GREENS_BUDGET_NO_MICROBE_HOLDER_REASON = 'No card can hold microbes';

/** WHO asks — the same source on both pickers and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: GREENS_BUDGET_ID};

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = GREENS_BUDGET_MEGACREDITS;
    // The canonical count of each of the three tags in the enactment's own
    // context — the PRINTED tags, with the cards that made them and the
    // per-tag totals the reading explains the sum by.
    const counted = resolutionCount(player, 'plantMicrobeAnimalTags');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
      ...(counted.byTag === undefined ? {} : {countedByTag: counted.byTag.map((entry) => ({...entry}))}),
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no plant, microbe or animal tags and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(GREENS_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: GREENS_BUDGET_NO_TAGS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: GREENS_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} plant, microbe and animal tag(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(GREENS_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

/**
 * ONE FLAT PORTION ONTO ONE CARD — Aquifer Contest's animals step, whole,
 * written once for both kinds: the amount fixed in `ctx.state` under the
 * step's own key (a reload re-runs `run` and must rebuild the SAME question),
 * the holders by the card's own storage rule, the shared picker with
 * `autoSelect: false` (a single candidate is still SHOWN and confirmed —
 * invariant 3), the record inside the answer. A missing holder is NAMED with
 * the portion's size — the kind's own reason, never a shared «nothing».
 */
function portionStep(
  key: string,
  effect: InfluenceScaledEffect,
  resource: CardResource,
  words: {noHolder: string, forfeitedLog: string, title: string},
): EnactStep {
  const owedKey = `${key}Owed`;
  return {
    key,
    run(ctx) {
      const player = ctx.player;
      const remembered = ctx.state[owedKey];
      // FLAT: the ONE formula with a rate of 0 per influence yields the base, so
      // a seat with no influence at all is still owed its whole portion.
      const owed = typeof remembered === 'number' ? remembered : scaledAmount(effect, ctx.influence);
      ctx.state[owedKey] = owed;
      const cards = player.getResourceCards(resource);
      if (cards.length === 0) {
        ctx.game.log(words.forfeitedLog, (b) => b.player(player).number(owed).resolution(GREENS_BUDGET_ID));
        ctx.report({kind: 'skipped', effect: effect.id, resource, amount: owed, influence: ctx.influence, reason: words.noHolder});
        return undefined;
      }
      // THE SHARED PICKER — the same `AddResourcesToCard` every card, corporation
      // and colony bonus uses: the candidates (0-resource holders included), the
      // «current → resulting» and VP readings and the source dock all come from
      // it. The title states the ASK alone; WHO asks is the prompt's source.
      return new AddResourcesToCard(player, resource, {
        count: owed,
        autoSelect: false,
        title: message(words.title, (b) => b.number(owed)),
        cause: SOURCE,
        from: {resolution: GREENS_BUDGET_ID},
      }).andThen((card) => {
        ctx.report({kind: 'cardResource', effect: effect.id, resource, amount: owed, card: card.name, influence: ctx.influence});
      }).execute();
    },
  };
}

const ANIMALS_STEP = portionStep('animals', GREENS_BUDGET_ANIMALS, CardResource.ANIMAL, {
  noHolder: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON,
  forfeitedLog: '${0} has no card that can hold animals — ${1} animal(s) from ${2} are forfeited',
  title: 'Add ${0} animal(s) to one of your cards',
});

const MICROBES_STEP = portionStep('microbes', GREENS_BUDGET_MICROBES, CardResource.MICROBE, {
  noHolder: GREENS_BUDGET_NO_MICROBE_HOLDER_REASON,
  forfeitedLog: '${0} has no card that can hold microbes — ${1} microbe(s) from ${2} are forfeited',
  title: 'Add ${0} microbe(s) to one of your cards',
});

export const GREENS_BUDGET: ResolutionDefinition = {
  id: GREENS_BUDGET_ID,
  code: GREENS_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE, as printed: «−10 [M€]» (the negative INSIDE the tile) beside the
  // two portions «2 [animal] · 3 [microbe]» (the resource SQUARES — a payout
  // onto a card) on the first row; the rate «1 [M€] / [animal] + [plant] +
  // [microbe] + [influence]» on the second, the medallions in the scan's own
  // order. The counted objects are the printed TAG medallions — the card
  // counts tags, not cards.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(-GREENS_BUDGET_LEVY_AMOUNT).nbsp.resource(CardResource.ANIMAL, GREENS_BUDGET_ANIMALS_AMOUNT).nbsp
      .resource(CardResource.MICROBE, GREENS_BUDGET_MICROBES_AMOUNT).br;
    b.megacredits(1).slash().tag(Tag.ANIMAL).plus().tag(Tag.PLANT).plus().tag(Tag.MICROBE).plus().influence();
  }),
  text: {
    name: 'Greens Budget',
    effect: 'Lose 10 M€. Then gain 1 M€ per plant, microbe and animal tag you have, plus 1 per influence. Then add 2 animals to one of your cards and 3 microbes to one of your cards.',
    quest: 'Play 2 plant tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.PLANT}, count: 2},
  levy: GREENS_BUDGET_LEVY,
  scaled: [GREENS_BUDGET_MEGACREDITS, GREENS_BUDGET_ANIMALS, GREENS_BUDGET_MICROBES],
  // THE PRINTED ORDER: the levy first, the payout second, the animals third, the microbes last — for every seat.
  immediateSteps: [levyStep(GREENS_BUDGET_ID, GREENS_BUDGET_LEVY), MEGACREDITS_STEP, ANIMALS_STEP, MICROBES_STEP],
};
