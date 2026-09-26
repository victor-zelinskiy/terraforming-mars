/*
 * VERTICAL INTEGRATION (the Industrialists) — Turmoil Redux resolution RX32,
 * and the SMALLEST card the family has: every part of it is already written.
 * The formula is Scientists Budget's (RX27) without the levy and without the
 * draw — «1 M€ per counted thing + 1 per influence, no cap, for everyone» —
 * and the chairman quest is R&D Funding's (RX26), the SAME object and the
 * SAME i18n key. One thing is new, and it is in the shared count, not here:
 * a count that asks the card's TYPE (docs/TURMOIL_REDUX_VERTICAL_INTEGRATION.md).
 *
 * Printed: «When enacted: Gain 1 M€ for each blue project card you have in
 * play + Influence.» Chairman quest: play 2 blue cards. A base card: no
 * expansion is needed.
 *
 * THE READINGS FIXED HERE:
 *  · A BLUE CARD IS `CardType.ACTIVE`, and that is the whole predicate. Not a
 *    tag, not a VP icon, not a cost, not the colour of the art. A corporation,
 *    a prelude, a CEO, an event and a green (AUTOMATED) card are not blue —
 *    the type answers each of them by itself.
 *    ⚠ THE ENGINE'S OWN «BLUE» COUNTERS ARE NOT THIS ONE. Tycoon (the
 *    milestone) and Celebrity (the award) count `ACTIVE || AUTOMATED` — blue
 *    AND green. Reaching for one of them would not fail; it would quietly pay
 *    a different rule's number, so the spec pins the divergence directly.
 *  · «IN PLAY» IS THE TABLEAU, and the definition is the shared walk's
 *    (`ResolutionCounts.ts`): corporations, preludes, CEOs, played projects
 *    and events, minus a disabled Pharmacy Union. The HAND, the discard and a
 *    card hosted under another (Self-Replicating Robots) are not in the
 *    tableau at all — this card writes no walk of its own.
 *  · ONE CARD IS ONE UNIT (the count's kind is CARDS): there is no «twice as
 *    blue», so the reading explains the number with the LIST OF CARDS and no
 *    per-card column. «4» is always four names.
 *  · INFLUENCE PAYS ON ITS OWN; the terms ADD (never multiply); there is no
 *    cap («max» is not printed). The payout is skipped — NAMED — only when the
 *    count and the influence are both zero.
 *  · MarsBot takes no seat: never counted, never paid.
 *
 * THE STEP MUTATES (IResolution.ts): nothing is asked, so `run` adds the M€
 * and reports once; the driver's idempotency key makes a reload or a repeated
 * call pay nothing twice.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {AltSecondaryTag} from '../../../../common/cards/render/AltSecondaryTag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const VERTICAL_INTEGRATION_ID: ResolutionId = 'RDX_INDUSTRIALISTS_VERTICAL_INTEGRATION';
export const VERTICAL_INTEGRATION_CODE: ResolutionCode = 'RX32';

/** THE FORMULA: 1 M€ per blue card in play, plus 1 per influence, no cap, for every participant. */
export const VERTICAL_INTEGRATION_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'blueCards', per: 1},
  recipient: 'each',
};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const VERTICAL_INTEGRATION_NO_CARDS_REASON = 'No blue cards and no influence';

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = VERTICAL_INTEGRATION_MEGACREDITS;
    // The shared walk of the seat's TABLEAU through the shared predicate —
    // the cards that made the number ride along so «4» is always four names.
    const counted = resolutionCount(player, 'blueCards');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no blue cards and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(VERTICAL_INTEGRATION_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: VERTICAL_INTEGRATION_NO_CARDS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: VERTICAL_INTEGRATION_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} blue card(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(VERTICAL_INTEGRATION_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

export const VERTICAL_INTEGRATION: ResolutionDefinition = {
  id: VERTICAL_INTEGRATION_ID,
  code: VERTICAL_INTEGRATION_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE, as the scan prints it: ONE row — «1 [M€] / [blue card] +
  // [influence]». The counted object is the CARD wearing its type's header
  // band (the physical game's own «blue card» glyph, the very item the
  // chairman quests print) — never a tag medallion, which would state a rule
  // about tags, and never a bare card, which would read «per card you have».
  renderData: CardRenderer.builder((b) => {
    b.megacredits(1).slash().cards(1, {secondaryTag: AltSecondaryTag.BLUE}).plus().influence();
  }),
  text: {
    name: 'Vertical Integration',
    effect: 'Gain 1 M€ per blue card you have in play, plus 1 per influence.',
    // THE SAME KEY R&D Funding (RX26) prints — one quest, one sentence.
    quest: 'Play 2 blue cards',
  },
  // BY TYPE: a blue card is an ACTIVE card — the same declaration RX26 makes.
  quest: {goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2},
  scaled: [VERTICAL_INTEGRATION_MEGACREDITS],
  immediateSteps: [MEGACREDITS_STEP],
};
