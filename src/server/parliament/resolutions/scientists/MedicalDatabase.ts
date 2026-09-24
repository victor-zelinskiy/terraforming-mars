/*
 * MEDICAL DATABASE (Scientists) — Turmoil Redux resolution RX18: the second
 * card of the Scientists and the first of the DISTRIBUTING family whose units
 * come in TWO KINDS — the recipients are the holders of data AND the holders
 * of microbes at once (docs/TURMOIL_REDUX_MEDICAL_DATABASE.md).
 *
 * Printed: «When enacted: Add 1 data or microbe resource to any card for
 * every Science tag you have + Influence. (Each resource can be different,
 * and can go on a different card.)» Chairman quest: play 2 science tags.
 *
 * THE READINGS FIXED HERE:
 *  · N = the player's SCIENCE tags + influence — for EVERY participant by
 *    THEIR OWN tags and influence (voters or not); a neutral winner cancels
 *    nothing. No winner-only part, no cap, no world step, no passive.
 *  · The tags are the project's canonical counter in the enactment's own
 *    context (`RESOLUTION_TAG_COUNTING_MODE` — `'raw'`, as Central Power
 *    Grid fixed it): every source in play, a card printing two science tags
 *    (Research) is 2, a WILD tag is not a science tag at an enactment. One
 *    tag, so the record keeps the card list with each card's contribution
 *    (`countedUnits`) and no per-tag breakdown.
 *  · «Data or microbe» is NOT a second question. A card has ONE storage
 *    rule (`resourceType`), so the kind of every unit follows from the CARD
 *    it is put on: the shared step spreads the units over the holders of
 *    EITHER kind (`AddResourcesToCards` over the list `[DATA, MICROBE]` —
 *    the union of the holders, in tableau order), the player lays them out,
 *    and the placement handed back names each card's own kind. The only
 *    card that holds «any» kind (`CardResource.WARE`) keeps a counter, not a
 *    kind, so a question about the kind would change nothing on it — its
 *    unit is journaled as the card's resource (the spec pins it).
 *  · «Each resource can go on a different card» — the units are
 *    DISTRIBUTED freely, 0…N per holder, the sum exactly N, all on one holder
 *    legal too: the SHARED step decides the shape exactly as for Cloud
 *    Development (a distribution with the structural
 *    `cardResourceDistributionPrompt` marker over ≥ 2 holders with N ≥ 2;
 *    the family's ordinary card pick with N = 1 or ONE holder, `autoSelect:
 *    false` — shown and confirmed, never applied behind the board). A wrong
 *    sum is an `InputError` and the prompt stands with nothing applied.
 *  · N = 0 asks nothing and is NAMED (no science tags and no influence);
 *    N > 0 with NO holder of either kind is NAMED with its size («5
 *    resources: no card can hold data or microbes») and forfeited — never
 *    banked, never converted, never silent, and never confused with «no
 *    influence».
 *  · The record: the declared kinds (`resources`), WHERE every unit landed
 *    with the kind ITS card took (`cards[].resource`), and the ONE `resource`
 *    only when every landed unit is of one kind (the ordinary game — data
 *    lives in Pathfinders / the Moon / Underworld, so in the premium scope
 *    every holder is a microbe holder and the record reads like Cloud
 *    Development's).
 *  · ONCE, at the enactment: the driver's idempotency keys make a reload or
 *    a repeated answer pay nothing twice; the amount and the count are
 *    fixed in `ctx.state` the first time the step runs.
 *  · No `compatibility`: microbes are a base resource, so the card is dealt
 *    in every Redux game; data holders only widen its recipients.
 *
 * THE STEP CONTRACT (IResolution.ts): a step MUTATES or ASKS, never both —
 * the driver re-runs `run` on a reload to rebuild the pending prompt. The
 * step therefore fixes its AMOUNT and its COUNT in `ctx.state` the first time
 * it runs and re-reads them afterwards, and every mutation happens inside
 * the prompt's own callback.
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

export const MEDICAL_DATABASE_ID: ResolutionId = 'RDX_SCIENTISTS_MEDICAL_DATABASE';
export const MEDICAL_DATABASE_CODE: ResolutionCode = 'RX18';

/** THE TWO KINDS of the unit, in the printed order: «[data] OR [microbe]». */
export const MEDICAL_DATABASE_KINDS: ReadonlyArray<CardResource> = [CardResource.DATA, CardResource.MICROBE];

/** THE FORMULA: 1 data-or-microbe unit per science tag + 1 per influence, spread over the player's holders of either, for every participant. */
export const MEDICAL_DATABASE_RESOURCES: InfluenceScaledEffect = {
  id: 'resources',
  unit: {kind: 'cardResource', resources: MEDICAL_DATABASE_KINDS, spread: true},
  perInfluence: 1,
  count: {id: 'scienceTags', per: 1},
  recipient: 'each',
};

/** WHO asks — the same source on the pick, the distribution and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: MEDICAL_DATABASE_ID};

/** The state keys the step fixes its amount and its count under (see the contract above). */
const RESOURCES_OWED_KEY = 'resourcesOwed';
const RESOURCES_COUNT_KEY = 'resourcesCount';

function isCountModel(value: unknown): value is ResolutionCountModel {
  return typeof value === 'object' && value !== null && typeof (value as ResolutionCountModel).count === 'number' &&
    Array.isArray((value as ResolutionCountModel).cards);
}

const RESOURCES_STEP: EnactStep = {
  key: 'resources',
  run(ctx) {
    const player = ctx.player;
    const effect = MEDICAL_DATABASE_RESOURCES;
    const influence = ctx.influence;
    // The canonical science-tag count in the enactment's own context, with the
    // cards that made it — fixed the first time, re-read after.
    const rememberedCount = ctx.state[RESOURCES_COUNT_KEY];
    const counted: ResolutionCountModel = isCountModel(rememberedCount) ? rememberedCount : resolutionCount(player, 'scienceTags');
    ctx.state[RESOURCES_COUNT_KEY] = counted;
    const rememberedOwed = ctx.state[RESOURCES_OWED_KEY];
    const owed = typeof rememberedOwed === 'number' ? rememberedOwed : scaledAmount(effect, influence, counted.count);
    ctx.state[RESOURCES_OWED_KEY] = owed;
    const recorded = {
      effect: effect.id,
      // THE KINDS the unit comes in — the record's name for it where no single kind can be named.
      resources: [...MEDICAL_DATABASE_KINDS],
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
    };
    if (owed <= 0) {
      ctx.game.log('${0} has no science tags and no influence — no resources from ${1}', (b) =>
        b.player(player).resolution(MEDICAL_DATABASE_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No science tags and no influence'});
      return undefined;
    }
    const step = new AddResourcesToCards(player, MEDICAL_DATABASE_KINDS, owed, {
      autoSelect: false,
      cause: SOURCE,
      from: {resolution: MEDICAL_DATABASE_ID},
      pickTitle: message('Add ${0} resource(s) to one of your cards', (b) => b.number(owed)),
      distributeTitle: message('Place ${0} resource(s) on your cards', (b) => b.number(owed)),
    });
    // NO HOLDER OF EITHER KIND: the payout is named with its size and forfeited
    // — its own reason, never «no influence», never a silent zero.
    if (step.getCards().length === 0) {
      ctx.game.log('${0} has no card that can hold data or microbes — ${1} resource(s) from ${2} are forfeited', (b) =>
        b.player(player).number(owed).resolution(MEDICAL_DATABASE_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: owed, reason: 'No card can hold data or microbes'});
      return undefined;
    }
    // THE SHARED DISTRIBUTION STEP over the LIST of kinds — it unites the
    // holders, decides the shape, validates the sum before a single unit
    // lands, applies through `addResourceTo` (the journal names each card's
    // own resource) and hands back WHERE everything landed with the kind
    // each card took, once.
    return step.andThen((placed) => {
      ctx.game.log('${0} placed ${1} resource(s) from ${2}: ${3} science tag(s) + ${4} influence', (b) =>
        b.player(player).number(owed).resolution(MEDICAL_DATABASE_ID).number(counted.count).number(influence));
      const cards = placed.map((p) => ({card: p.card.name, amount: p.amount, resource: p.resource}));
      // THE ONE KIND of the record — only when every landed unit is of it (the
      // premium scope's ordinary case: microbe holders alone); a mixed landing
      // names no single kind, its cards name their own.
      const kinds = new Set(cards.map((c) => c.resource));
      ctx.report({
        kind: 'cardResource',
        ...recorded,
        amount: owed,
        ...(kinds.size === 1 ? {resource: cards[0].resource} : {}),
        // ONE card only when the whole amount landed on it; the list is every reader's.
        ...(cards.length === 1 ? {card: cards[0].card} : {}),
        cards,
      });
      return undefined;
    }).execute();
  },
};

export const MEDICAL_DATABASE: ResolutionDefinition = {
  id: MEDICAL_DATABASE_ID,
  code: MEDICAL_DATABASE_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE, as printed: «[data] OR [microbe] / [science tag] + [influence]»
  // on one row — the unit is named by its two kinds, the counted object is
  // the printed TAG medallion (the card counts tags, not cards).
  renderData: CardRenderer.builder((b) => {
    b.resource(CardResource.DATA).or().resource(CardResource.MICROBE).slash().tag(Tag.SCIENCE).plus().influence();
  }),
  text: {
    name: 'Medical Database',
    effect: 'Add 1 data or microbe resource per science tag you have, plus 1 per influence, to your cards that can hold data or microbes. Each resource may go on a different card.',
    quest: 'Play 2 science tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2},
  scaled: [MEDICAL_DATABASE_RESOURCES],
  immediateSteps: [RESOURCES_STEP],
};
