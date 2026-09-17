/*
 * ARCHITECTURE AWARD (Mars First) — Turmoil Redux resolution RX02: the first
 * resolution whose amount depends on the player's TABLEAU and their influence
 * together, and then meets a cap. The template for every «per X you have +
 * influence (max N)» resolution after it (docs/TURMOIL_REDUX_ARCHITECTURE_AWARD.md).
 *
 * Printed: «When enacted: Increase your M€ production 1 step for every
 * Building card with a NON-NEGATIVE VP icon you have in play + Influence.
 * (Max. 5)» Chairman quest: play 2 building tags.
 *
 * THE READINGS FIXED HERE:
 *  · The amount is min(5, B + I) for EVERY participant — voters or not, with
 *    the party effect or not. B = the player's own cards in play that print a
 *    building tag AND a non-negative VP icon (the shared predicate,
 *    `common/parliament/resolutionCounts.ts` over `victoryPointsIcon.ts`):
 *      – the icon is REQUIRED: a Building card with no VP icon scores 0 but
 *        does not count (Q-8 settled literally);
 *      – a fixed icon counts when ≥ 0; a variable icon counts by its SIGN
 *        (a «1 per science resource» card with none counts; a penalty
 *        formula at 0 does not); a bespoke icon by its declared sign;
 *      – one card is one unit, however many building tags or VP it has;
 *      – played events are face down (their tags are out of play) unless
 *        Odyssey; wild tags never make a card a Building card.
 *    I = the player's influence through the Redux ledger (`ctx.influence`,
 *    read AFTER the winner's Agenda step of the phase — rulebook p.10).
 *  · «Max. 5» caps the INCREASE (B + I), never the resulting production:
 *    production 10 becomes 15. A negative production rises the ordinary way.
 *  · It is a PRODUCTION increase through `production.add` (its events, the
 *    party reactions, the recorder), never a stock payment and never a field
 *    write. No winner part: the winner gets only the phase's general rewards.
 *  · ONCE, at the enactment: the driver's idempotency key
 *    (`effect:<generation>:<instance>:<player>:production`) makes a reload or
 *    a repeated handler call pay nothing twice; a later production or tableau
 *    change never recomputes it (the outcome freezes B, I, the counted cards,
 *    the sum before the cap, the value before and after); a LATER enactment
 *    of the card is a new generation's key — a new application.
 *  · A result of 0 (no counted card, no influence) is NAMED — a journal line
 *    and a `skipped` outcome — and changes nothing.
 *
 * THE STEP MUTATES (IResolution.ts): no question is asked, so `run` applies
 * the increase and reports it; the driver marks the key applied before
 * anything else can run.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount, uncappedAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const ARCHITECTURE_AWARD_ID: ResolutionId = 'RDX_MARS_ARCHITECTURE_AWARD';
export const ARCHITECTURE_AWARD_CODE: ResolutionCode = 'RX02';
/** The printed «(Max. 5)» — a bound on the increase. */
export const ARCHITECTURE_AWARD_CAP = 5;

/** THE FORMULA: +1 M€ production per counted card + 1 per influence, at most +5, for every participant. */
export const ARCHITECTURE_AWARD_PRODUCTION: InfluenceScaledEffect = {
  id: 'production',
  unit: {kind: 'production', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'buildingCardsWithNonNegativeVp', per: 1},
  cap: ARCHITECTURE_AWARD_CAP,
  recipient: 'each',
};

const PRODUCTION_STEP: EnactStep = {
  key: 'production',
  run(ctx) {
    const player = ctx.player;
    const effect = ARCHITECTURE_AWARD_PRODUCTION;
    const counted = resolutionCount(player, 'buildingCardsWithNonNegativeVp');
    const influence = ctx.influence;
    const uncapped = uncappedAmount(effect, influence, counted.count);
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      production: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      uncapped,
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no Building card with a non-negative VP icon and no influence — no ${1} production from ${2}', (b) =>
        b.player(player).resource(Resource.MEGACREDITS).resolution(ARCHITECTURE_AWARD_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: 'No qualifying cards and no influence'});
      return undefined;
    }
    const before = player.production.megacredits;
    // The standard increase: its events, the party reactions and the
    // recorder see it under this resolution's source. The ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.production.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: ARCHITECTURE_AWARD_ID}});
    const after = player.production.megacredits;
    if (uncapped > amount) {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: ${4} Building card(s) with a non-negative VP icon + ${5} influence = ${6}, limited to the maximum of ${1} (${7} → ${8})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(ARCHITECTURE_AWARD_ID)
          .number(counted.count).number(influence).number(uncapped).number(before).number(after));
    } else {
      ctx.game.log('${0} gained ${1} ${2} production from ${3}: ${4} Building card(s) with a non-negative VP icon + ${5} influence (${6} → ${7})', (b) =>
        b.player(player).number(amount).resource(Resource.MEGACREDITS).resolution(ARCHITECTURE_AWARD_ID)
          .number(counted.count).number(influence).number(before).number(after));
    }
    ctx.report({kind: 'production', ...recorded, amount, before, after});
    return undefined;
  },
};

export const ARCHITECTURE_AWARD: ResolutionDefinition = {
  id: ARCHITECTURE_AWARD_ID,
  code: ARCHITECTURE_AWARD_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE: «1 [M€ production] / [Building card with a VP icon] + [influence]»
  // on one row, the cap on the next — the counted object is the CARD glyph
  // (cover + building bubble + VP plate), never a bare building tag, which
  // would read as «every building tag you have».
  renderData: CardRenderer.builder((b) => {
    b.production((pb) => pb.megacredits(1)).slash().vpCard(Tag.BUILDING).plus().influence().br;
    b.text('max 5', Size.SMALL, true);
  }),
  text: {
    name: 'Architecture Award',
    effect: 'Every player raises their M€ production by the number of their cards in play with a building tag and a non-negative VP icon, plus their influence. At most +5.',
    quest: 'Play 2 building tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2},
  scaled: [ARCHITECTURE_AWARD_PRODUCTION],
  immediateSteps: [PRODUCTION_STEP],
};
