/*
 * SCIENTISTS BUDGET (the Scientists) — Turmoil Redux resolution RX27: the
 * SECOND card of the BUDGET family, and the one that proves the family is a
 * DECLARATION. Every part of it already exists: the LEVY is the family's own
 * member and its ONE shared step (RX15 Industrialist Budget), the count is
 * the science tags Medical Database declared (RX18), and the draw is the
 * shared external intake three cards already use (RX05 / RX16 / RX24). This
 * file therefore writes no mechanism at all — it states the sums, the count
 * and the number of cards (docs/TURMOIL_REDUX_SCIENTISTS_BUDGET.md).
 *
 * Printed: «When enacted: Lose 10 M€. Gain M€ equal to your Science tags +
 * Influence. Each player draws 2 cards.» Chairman quest: play 2 science tags.
 * A base card: no expansion is needed.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: levy → payout → draw, for EVERY
 *    participant in turn (voters or not, the party effect or not; a neutral
 *    winner cancels nothing). Never reordered so that a seat can afford the
 *    levy — that would change the outcome of the seat that is short.
 *  · THE LEVY IS THE FAMILY'S, whole: bounded by the seat (4 M€ pays 4 of 10
 *    and the record names the shortfall; 0 M€ pays nothing, a named skip),
 *    `from: {resolution}` on the take, and both still receive the payout and
 *    the cards. The card asks no solvency, and it asks nothing of `levyStep`.
 *  · THE COUNT IS SCIENCE TAGS — the project's canonical counter in the
 *    enactment's own context (`RESOLUTION_TAG_COUNTING_MODE` = `'raw'`): every
 *    source in play, a card printing two science tags (Research) is 2, a WILD
 *    tag is not a science tag at an enactment.
 *    ⚠ AND NEITHER IS A LAW'S TAG BONUS. R&D Funding (RX26) grants extra
 *    science tags «when taking actions» — a hook inside `includeTagSubstitutions`,
 *    which `'raw'` never asks. A RESOLUTION'S PAYOUT IS NOT AN ACTION, so this
 *    budget pays by the PRINTED tags even while that law stands, and the
 *    reading says so rather than quietly matching the tag zone's «2 +2».
 *    Pinned by `ScientistsBudget.spec.ts` § THE TAG BONUS OF R&D FUNDING.
 *  · INFLUENCE PAYS ON ITS OWN; the terms add; there is no cap («max» is not
 *    printed). The payout is skipped — named — only when count and influence
 *    are both zero.
 *  · THE 2 CARDS ARE FLAT: «each player draws 2», influence does not touch
 *    them, and they are never added to the money (today's pocket and a hand of
 *    cards are two different things — the net line is the levy's alone). They
 *    come from the PROJECT DECK through the shared external-draw intake: they
 *    leave the deck at the enactment in seat order, are WITHHELD from the hand
 *    until the mandatory take, and the prompt is a projection of serialized
 *    state, so a reload inside the take draws nothing twice and loses nothing.
 *    A short deck delivers what it has and the record keeps both `amount` and
 *    `drawn`; an empty one is a NAMED skip.
 *  · MarsBot takes no seat: never levied, never paid, never dealt to.
 *
 * THE STEP CONTRACT (IResolution.ts): the levy and the payout MUTATE; the draw
 * step is the one documented exception the intake makes safe — it takes the
 * cards off the deck and asks in the same breath, and re-entry (a reload) is
 * idempotent because the intake it remembers IS game state.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';

export const SCIENTISTS_BUDGET_ID: ResolutionId = 'RDX_SCIENTISTS_SCIENTISTS_BUDGET';
export const SCIENTISTS_BUDGET_CODE: ResolutionCode = 'RX27';
/** The printed «Lose 10 M€». */
export const SCIENTISTS_BUDGET_LEVY_AMOUNT = 10;
/** The printed «Each player draws 2 cards» — the flat part. */
export const SCIENTISTS_BUDGET_DRAW_CARDS = 2;

/** THE LEVY, as data: 10 M€ from every participant, first. */
export const SCIENTISTS_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: SCIENTISTS_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per science tag, plus 1 per influence, no cap, for every participant. */
export const SCIENTISTS_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'scienceTags', per: 1},
  recipient: 'each',
};

/** THE FLAT PART: 2 cards for every participant — a rate of 0 per influence, a base of 2. */
export const SCIENTISTS_BUDGET_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  base: SCIENTISTS_BUDGET_DRAW_CARDS,
  perInfluence: 0,
  recipient: 'each',
};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const SCIENTISTS_BUDGET_NO_TAGS_REASON = 'No science tags and no influence';

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = SCIENTISTS_BUDGET_MEGACREDITS;
    // The canonical science-tag count in the enactment's own context — the
    // PRINTED tags, with the cards that made them. A law's «when taking
    // actions» bonus is not asked here and must not be (see the header).
    const counted = resolutionCount(player, 'scienceTags');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no science tags and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(SCIENTISTS_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: SCIENTISTS_BUDGET_NO_TAGS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: SCIENTISTS_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} science tag(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(SCIENTISTS_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

/** The intake the draw step opened — the proof it already drew (game state carries the cards). */
const INTAKE_KEY = 'drawIntake';

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = SCIENTISTS_BUDGET_DRAW;
    // RE-ENTRY (a reload inside the take): the cards already left the deck and
    // sit in the intake — game state. Nothing is drawn again; the mandatory
    // prompt is re-derived from the intake.
    const remembered = ctx.state[INTAKE_KEY];
    if (typeof remembered === 'number') {
      const pending = ExternalDrawIntake.pendingOf(player, remembered);
      return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
    }
    const influence = ctx.influence;
    // FLAT: the ONE formula with a rate of 0 per influence yields the base, so
    // a seat with no influence at all is still dealt its two cards.
    const owed = scaledAmount(effect, influence);
    // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
    // the cards withheld from the hand until taken, the prompt re-derivable.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: SCIENTISTS_BUDGET_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: 2 for every player', (b) =>
      b.player(player).number(intake.count).resolution(SCIENTISTS_BUDGET_ID));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    ctx.report({kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence});
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

export const SCIENTISTS_BUDGET: ResolutionDefinition = {
  id: SCIENTISTS_BUDGET_ID,
  code: SCIENTISTS_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE, as printed: the two cards on their own row, then «−10 [M€]» (the
  // negative printed INSIDE the tile, as on the card) beside the rate «1 [M€] /
  // [science tag] + [influence]». The counted object is the printed TAG
  // medallion — the card counts tags, not cards.
  renderData: CardRenderer.builder((b) => {
    b.cards(SCIENTISTS_BUDGET_DRAW_CARDS).br;
    b.megacredits(-SCIENTISTS_BUDGET_LEVY_AMOUNT).nbsp.megacredits(1).slash().tag(Tag.SCIENCE).plus().influence();
  }),
  text: {
    name: 'Scientists Budget',
    effect: 'Lose 10 M€. Then gain 1 M€ per science tag you have, plus 1 per influence. Then draw 2 cards.',
    quest: 'Play 2 science tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2},
  levy: SCIENTISTS_BUDGET_LEVY,
  scaled: [SCIENTISTS_BUDGET_MEGACREDITS, SCIENTISTS_BUDGET_DRAW],
  // THE PRINTED ORDER: the levy first, the payout second, the cards last.
  immediateSteps: [levyStep(SCIENTISTS_BUDGET_ID, SCIENTISTS_BUDGET_LEVY), MEGACREDITS_STEP, DRAW_STEP],
};
