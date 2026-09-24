/*
 * CLOUD DEVELOPMENT (Unity) — Turmoil Redux resolution RX06: the FIRST card of
 * the Unity party, the first that DEPENDS ON AN EXPANSION (Venus Next), and
 * the first whose payout is DISTRIBUTED over several cards
 * (docs/TURMOIL_REDUX_CLOUD_DEVELOPMENT.md).
 *
 * Printed: «When enacted: Add 1 floater resource to any card per Venus and
 * Jovian tag you have + Influence. (Each resource can go on a different
 * card.)» Chairman quest: play 2 Venus tags. Venus Next marker on the edge.
 *
 * THE READINGS FIXED HERE:
 *  · N = the player's VENUS tags + JOVIAN tags + influence — for EVERY
 *    participant by THEIR OWN tags and influence (voters or not, the Unity
 *    effect or not); a neutral winner cancels nothing. There is NO
 *    winner-only part and no cap.
 *  · The tags are the project's canonical counter in the enactment's own
 *    context (`RESOLUTION_TAG_COUNTING_MODE` — `'raw'`, as Central Power
 *    Grid fixed it): every source in play (projects, the corporation(s),
 *    preludes, CEOs, permanent modifiers such as the Delta Project's jovian),
 *    nothing out of play (the hand, a played event face down unless Odyssey);
 *    a WILD tag is not a Venus or a Jovian tag at an enactment. One term over
 *    TWO tags: a card printing both is worth 2 (`venusJovianTags`), and the
 *    record keeps the per-tag breakdown beside the sum.
 *  · «To any card» is onto the player's OWN cards that can hold floaters
 *    (`getResourceCards(FLOATER)`, the corporation included — Celestic): the
 *    printed floater carries no rival-target frame, and nothing in Venus Next
 *    reads «any card» as another player's. A holder with 0 floaters is a
 *    fine target; a Venus TAG is not storage.
 *  · «Each resource can go on a different card» — the units are DISTRIBUTED
 *    freely, 0…N per holder, the sum exactly N, all on one holder legal too.
 *    The SHARED step decides the shape (`AddResourcesToCards`): with N ≥ 2
 *    over ≥ 2 holders it asks the DISTRIBUTION prompt (the structural
 *    `cardResourceDistributionPrompt` marker, the console's layout mode);
 *    with N = 1, or ONE holder (all N go there), it asks the family's ordinary
 *    card pick (`resourceGainPrompt`, `autoSelect: false` — a single holder
 *    is SHOWN and confirmed, never applied behind the board). A wrong sum is
 *    an `InputError` and the prompt stands with nothing applied.
 *  · The units land through `addResourceTo` (the ordinary triggers and the
 *    journal line per card). The chairman quest never counts them: the shared
 *    tracker refuses the political phase and any resolution source on the
 *    stack (decision Q5) — pinned by spec, never by a special case here.
 *  · N = 0 asks nothing and is NAMED (no Venus or Jovian tags and no
 *    influence); N > 0 with no holder is NAMED with its size («3 floaters:
 *    no card can hold floaters») and forfeited — never banked, never
 *    converted, never silent.
 *  · ONCE, at the enactment: the driver's idempotency keys make a reload or a
 *    repeated answer pay nothing twice; the record freezes N, the influence,
 *    the count with its cards, units and per-tag totals, and WHERE every unit
 *    landed (the list — one recipient is the list of one).
 *  · Without Venus Next the card is nowhere: not in the deck, not in the
 *    discard, not on the stand as a dealt card (`compatibility: ['venus']` —
 *    the deal's filter). A Venus save from before this card loads and deals
 *    the newcomer into its deck (`Parliament.deserialize`'s top-up).
 *
 * THE STEP CONTRACT (IResolution.ts): a step MUTATES or ASKS, never both —
 * the driver re-runs `run` on a reload to rebuild the pending prompt. The
 * step therefore fixes its AMOUNT and its COUNT in `ctx.state` the first time
 * it runs and re-reads them afterwards (the number the question was built
 * with is the number the answer pays), and every mutation happens inside the
 * prompt's own callback.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionCountModel} from '../../../../common/parliament/resolutionCounts';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {message} from '../../../logs/MessageBuilder';
import {AddResourcesToCards} from '../../../deferredActions/AddResourcesToCards';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const CLOUD_DEVELOPMENT_ID: ResolutionId = 'RDX_UNITY_CLOUD_DEVELOPMENT';
export const CLOUD_DEVELOPMENT_CODE: ResolutionCode = 'RX06';

/** THE FORMULA: 1 floater per Venus or Jovian tag + 1 per influence, spread over the player's holders, for every participant. */
export const CLOUD_DEVELOPMENT_FLOATERS: InfluenceScaledEffect = {
  id: 'floaters',
  unit: {kind: 'cardResource', resources: [CardResource.FLOATER], spread: true},
  perInfluence: 1,
  count: {id: 'venusJovianTags', per: 1},
  recipient: 'each',
};

/** WHO asks — the same source on the pick, the distribution and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: CLOUD_DEVELOPMENT_ID};

/** The state keys the step fixes its amount and its count under (see the contract above). */
const FLOATERS_OWED_KEY = 'floatersOwed';
const FLOATERS_COUNT_KEY = 'floatersCount';

function isCountModel(value: unknown): value is ResolutionCountModel {
  return typeof value === 'object' && value !== null && typeof (value as ResolutionCountModel).count === 'number' &&
    Array.isArray((value as ResolutionCountModel).cards);
}

const FLOATERS_STEP: EnactStep = {
  key: 'floaters',
  run(ctx) {
    const player = ctx.player;
    const effect = CLOUD_DEVELOPMENT_FLOATERS;
    const influence = ctx.influence;
    // The canonical tag count in the enactment's own context, with the cards
    // that made it and the per-tag totals — fixed the first time, re-read after.
    const rememberedCount = ctx.state[FLOATERS_COUNT_KEY];
    const counted: ResolutionCountModel = isCountModel(rememberedCount) ? rememberedCount : resolutionCount(player, 'venusJovianTags');
    ctx.state[FLOATERS_COUNT_KEY] = counted;
    const rememberedOwed = ctx.state[FLOATERS_OWED_KEY];
    const owed = typeof rememberedOwed === 'number' ? rememberedOwed : scaledAmount(effect, influence, counted.count);
    ctx.state[FLOATERS_OWED_KEY] = owed;
    const recorded = {
      effect: effect.id,
      resource: CardResource.FLOATER,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
      ...(counted.byTag === undefined ? {} : {countedByTag: counted.byTag.map((entry) => ({tag: entry.tag, count: entry.count}))}),
    };
    if (owed <= 0) {
      ctx.game.log('${0} has no Venus or Jovian tags and no influence — no floaters from ${1}', (b) =>
        b.player(player).resolution(CLOUD_DEVELOPMENT_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No Venus or Jovian tags and no influence'});
      return undefined;
    }
    const holders = player.getResourceCards(CardResource.FLOATER);
    if (holders.length === 0) {
      ctx.game.log('${0} has no card that can hold floaters — ${1} floater(s) from ${2} are forfeited', (b) =>
        b.player(player).number(owed).resolution(CLOUD_DEVELOPMENT_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: owed, reason: 'No card can hold floaters'});
      return undefined;
    }
    // THE SHARED DISTRIBUTION STEP — it decides the shape (a distribution over
    // ≥ 2 holders, or the family's ordinary pick), validates the sum before a
    // single unit lands, applies through `addResourceTo` and hands back WHERE
    // everything landed, once. The titles state the ASK alone; WHO asks is the
    // prompt's source (the dock / the stage name the resolution).
    return new AddResourcesToCards(player, CardResource.FLOATER, owed, {
      autoSelect: false,
      cause: SOURCE,
      from: {resolution: CLOUD_DEVELOPMENT_ID},
      pickTitle: message('Add ${0} floater(s) to one of your cards', (b) => b.number(owed)),
      distributeTitle: message('Place ${0} floater(s) on your cards', (b) => b.number(owed)),
    }).andThen((placed) => {
      ctx.game.log('${0} placed ${1} floater(s) from ${2}: ${3} Venus and Jovian tag(s) + ${4} influence', (b) =>
        b.player(player).number(owed).resolution(CLOUD_DEVELOPMENT_ID).number(counted.count).number(influence));
      const cards = placed.map((p) => ({card: p.card.name, amount: p.amount, resource: p.resource}));
      ctx.report({
        kind: 'cardResource',
        ...recorded,
        amount: owed,
        // ONE card only when the whole amount landed on it; the list is every reader's.
        ...(cards.length === 1 ? {card: cards[0].card} : {}),
        cards,
      });
      return undefined;
    }).execute();
  },
};

export const CLOUD_DEVELOPMENT: ResolutionDefinition = {
  id: CLOUD_DEVELOPMENT_ID,
  code: CLOUD_DEVELOPMENT_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  compatibility: ['venus'],
  // THE FACE, as printed: «[floater] / [Venus tag] + [Jovian tag] + [influence]»
  // on one row — the counted objects are the two printed TAG medallions (the
  // card counts tags, not cards, and never the floater as a resource of the
  // rule's input). The «each on a different card» reading is the rule text's.
  renderData: CardRenderer.builder((b) => {
    b.resource(CardResource.FLOATER, 1).slash().tag(Tag.VENUS).plus().tag(Tag.JOVIAN).plus().influence();
  }),
  text: {
    name: 'Cloud Development',
    effect: 'Add 1 floater per Venus and Jovian tag you have, plus 1 per influence, to your cards that can hold floaters. Each floater may go on a different card.',
    quest: 'Play 2 Venus tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.VENUS}, count: 2},
  scaled: [CLOUD_DEVELOPMENT_FLOATERS],
  immediateSteps: [FLOATERS_STEP],
};
