/*
 * REDS BUDGET (the Reds) — Turmoil Redux resolution RX39: the SEVENTH and last
 * card of the BUDGET family, and the first law that walks EVERY seat's marker
 * on the Career (Agenda) track (docs/TURMOIL_REDUX_REDS_BUDGET.md).
 *
 * Printed: «When enacted: Lose 10 M€. Gain M€ equal to your Space and Mars
 * tags combined + Influence. Each player advances their Agenda marker 1
 * step.» Chairman quest: play 2 space tags. A base card: no expansion is
 * needed.
 *
 * EVERY part is a declaration of something already built: the LEVY is the
 * family's member and its ONE shared step (RX15), the payout is a TAG count
 * over two tags + influence (Mars First Budget's form, RX38), and the step of
 * the Career is the second member of the family «a law hands the seat a DEED»
 * (`agendaGrant` — the tile is the first), paid by its ONE shared step on the
 * track's ONE walk (`ResolutionAgendaGrant.ts` → `ChairmanSeat.walkAgenda`,
 * TR04's walk). This file writes no mechanism: it states the sums, the tags and
 * the steps.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER, seat by seat: levy → payout →
 *    the step of the Career for the first seat, then all three for the next —
 *    the driver walks the seats in generation order. Never reordered so that a
 *    seat can afford the levy.
 *  · THE LEVY IS THE FAMILY'S, whole: bounded by the seat (4 M€ pays 4 of 10
 *    and the record names the shortfall; 0 M€ pays nothing, a named skip), and
 *    both still receive every later part.
 *  · THE COUNT IS TWO TAGS ADDED UP — space and Mars, the canonical counter of
 *    each in the enactment's own context (`'raw'`): every source in play, a
 *    card printing both is 2 (Mars Army Ships), a wild tag is neither, and the
 *    space tags of the played EVENTS (the asteroids, the comets — this card's
 *    most common case) lie face down and count nothing; the record keeps the
 *    per-tag totals beside the sum (`countedByTag`). Skipped — named — only
 *    when count and influence are both zero.
 *  · THE PAYOUT READS THE INFLUENCE BEFORE THIS LAW'S STEP: the step comes
 *    after it on the card, so a step that raises the level (onto an influence
 *    step) is not seen by this enactment's payout. The winner's influence
 *    already includes the winner's own step of the sitting (rulebook p.10:
 *    step 1 before step 3) — as for every law.
 *  · «EACH PLAYER ADVANCES THEIR AGENDA MARKER 1 STEP» is every PARTICIPANT,
 *    voter or not — a neutral winner cancels nothing — and the WINNER walks
 *    TWICE in one sitting: its winner's step and this law's (a consequence of
 *    the rules, never a double). Each step pays its bonus on the spot: a TR
 *    step +1 TR, a card step a card into the hand (the Agenda's own source),
 *    an influence step the new level. A marker with no cube yet stands on
 *    position 1. A marker at the end of the track takes nothing — a NAMED skip,
 *    the seat's money paid as usual.
 *  · MARSBOT WALKS TOO (decisions D3 + D11): never levied, never paid (a
 *    payout «per tag» would need an invented translation of its track
 *    positions), but the bot moves on the Career as a human does, so the step
 *    a law grants every seat is its own — in ITS place in the order, its card
 *    step 1 M€ (the Automa FAQ). It ignores the ruling party (the Reds have no
 *    passive in Redux anyway: the TR of a step is taxed by nobody).
 *  · The chairman quest never counts the sitting's step (the political phase —
 *    `QuestTracker.eligible`), nor its TR.
 *  · THE FACE prints the step as the CAREER INSIGNIA (`b.agendaStep(1)` — the
 *    owner's decision 2026-10-20: the scan's starred square reads as titanium
 *    at chip size beside «−10 M€»).
 *
 * THE STEP CONTRACT (IResolution.ts): all three steps MUTATE; none asks — a
 * reload never finds a half-done seat (the driver's per-seat keys).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {AgendaGrantDeclaration} from '../../../../common/parliament/agendaGrant';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';
import {agendaGrantStep} from '../ResolutionAgendaGrant';

export const REDS_BUDGET_ID: ResolutionId = 'RDX_REDS_REDS_BUDGET';
export const REDS_BUDGET_CODE: ResolutionCode = 'RX39';
/** The printed «Lose 10 M€». */
export const REDS_BUDGET_LEVY_AMOUNT = 10;

/** THE LEVY, as data: 10 M€ from every participant, first. */
export const REDS_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: REDS_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per space and Mars tag, plus 1 per influence, no cap, for every participant. */
export const REDS_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'spaceMarsTags', per: 1},
  recipient: 'each',
};

/** THE GRANT: one step of the Career for EVERY participant, the bot included. */
export const REDS_BUDGET_GRANT: AgendaGrantDeclaration = {
  steps: 1,
  recipients: {kind: 'everyone'},
};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const REDS_BUDGET_NO_TAGS_REASON = 'No space or Mars tags and no influence';

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = REDS_BUDGET_MEGACREDITS;
    // The canonical count of each of the two tags in the enactment's own
    // context — the PRINTED tags, with the cards that made them and the
    // per-tag totals the reading explains the sum by.
    const counted = resolutionCount(player, 'spaceMarsTags');
    // The influence at the step's start: this law's own Career step comes AFTER the payout.
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
      ctx.game.log('${0} has no space or Mars tags and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(REDS_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: REDS_BUDGET_NO_TAGS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: REDS_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} space and Mars tag(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(REDS_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

export const REDS_BUDGET: ResolutionDefinition = {
  id: REDS_BUDGET_ID,
  code: REDS_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE, as printed: «−10 [M€]» (the negative INSIDE the tile) beside the
  // step of the Career on the first row — the CAREER INSIGNIA, never the scan's
  // starred square (the owner's decision 2026-10-20); the rate «1 [M€] /
  // [space] + [Mars] + [influence]» on the second, in the scan's own order.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(-REDS_BUDGET_LEVY_AMOUNT).nbsp.nbsp.agendaStep(REDS_BUDGET_GRANT.steps).br;
    b.megacredits(1).slash().tag(Tag.SPACE).plus().tag(Tag.MARS).plus().influence();
  }),
  text: {
    name: 'Reds Budget',
    effect: 'Lose 10 M€. Then gain 1 M€ per space and Mars tag you have, plus 1 per influence. Then every player advances their Agenda marker 1 step.',
    quest: 'Play 2 space tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SPACE}, count: 2},
  levy: REDS_BUDGET_LEVY,
  scaled: [REDS_BUDGET_MEGACREDITS],
  agendaGrant: REDS_BUDGET_GRANT,
  // THE PRINTED ORDER: the levy first, the payout second, the step of the Career last — for every seat in turn.
  immediateSteps: [levyStep(REDS_BUDGET_ID, REDS_BUDGET_LEVY), MEGACREDITS_STEP, agendaGrantStep(REDS_BUDGET_ID, REDS_BUDGET_GRANT)],
};
