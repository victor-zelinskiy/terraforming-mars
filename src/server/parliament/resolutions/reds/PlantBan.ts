/*
 * PLANT BAN (the Reds) — Turmoil Redux resolution RX25: the exact MIRROR of
 * RX16 Joint Research. There the player is brought UP to a level by drawing;
 * here they are CUT DOWN to one by losing (docs/TURMOIL_REDUX_PLANT_BAN.md).
 *
 * Printed: «When enacted: Lose all plants except 2 + Influence.» Chairman
 * quest: send 4 delegates. A base card: no expansion is needed.
 *
 * SO THIS FILE BUILDS NO MECHANISM OF ITS OWN. The level member it declares is
 * the ONE the catalog already had (`InfluenceScaledEffect.level`), pointed the
 * other way (`direction: 'down'`) — one declaration, one arithmetic
 * (`levelAmount`), one set of readings. A second field beside `upTo` would
 * have been two roads to the same question «bring the player to the level»,
 * and they would have parted on the first change to the readings.
 *
 * THE READINGS FIXED HERE:
 *  · THE LIMIT IS 2 + INFLUENCE, each seat's own; what LEAVES is
 *    max(0, plants − limit). The formula (`scaledAmount`) yields the LIMIT,
 *    the ONE division yields the loss, and every surface prints all three
 *    numbers — «max 4 · 7 of yours → −3». The limit alone would answer «you
 *    keep 4» to a player who asked how many are taken.
 *  · A ZERO IS A STANDARD OUTCOME, NOT A REGRET. A seat at or below the limit
 *    loses nothing, and the record says exactly that («Plants already at or
 *    below the limit») — never «no influence». Influence 0 does not cancel
 *    the card: the limit is still 2, and 7 plants still lose 5.
 *  · THE PROTECTION DOES NOT APPLY, and that is the rule, not an oversight.
 *    Protected Habitats and its kin protect «from removal by OTHER PLAYERS»,
 *    and the engine says so literally: `Player.isProtectedFrom` is false
 *    unless an ATTACKER other than the owner is named. A resolution is not a
 *    player, so the guard is never consulted — a seat holding Protected
 *    Habitats loses plants like everybody else. The same reason keeps the
 *    ATTACK hooks quiet: `Stock.add` gates Law Suit, the insurance and the
 *    rest on `isFromPlayer(from)`, and the source here is the RESOLUTION.
 *    Nothing is called «just in case»: calling it would change the rule.
 *  · IT IS A LOSS OF THE SUPPLY, under the law's own source:
 *    `stock.add(PLANTS, −N, {from: {resolution}})`. The `from` is mandatory
 *    even for an exact N (the journal, the source, and RX15's own trap: the
 *    engine writes `logIllegalState` for a deduction with no source). The
 *    take can never exceed the supply — it IS the difference to the limit —
 *    so the record's `owed` equals what was taken: this law is never short.
 *  · THE SIGN IS THE ADDRESS'S. The record is the ordinary `stock` kind with
 *    a NEGATIVE amount; `rewardAddressOf` reads it as `direction: 'loss'` and
 *    the sitting flies the levy's own wave BACKWARDS — out of the rail, onto
 *    the law's printed graphic, the counter ticking on DEPARTURE. No kind of
 *    its own, no choreography of its own.
 *  · MarsBot takes no seat: its plants are never touched.
 *  · THE CHAIRMAN QUEST asks for 4 DELEGATES — the figure ×4 the face prints,
 *    never the influence starburst (which prints a black star around the
 *    figure). The tracker already reports it (`ParliamentHandler` on a
 *    delegate sent by the player in their own turn); this is the first card
 *    to ask for it.
 *
 * THE STEP CONTRACT (IResolution.ts): the one step MUTATES (it never asks)
 * and reports exactly once — the zero included.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Size} from '../../../../common/cards/render/Size';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, levelAmount, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const PLANT_BAN_ID: ResolutionId = 'RDX_REDS_PLANT_BAN';
export const PLANT_BAN_CODE: ResolutionCode = 'RX25';
/** The printed «except 2» — the limit's base, before the influence. */
export const PLANT_BAN_LIMIT_BASE = 2;
/** The printed «4 delegates» — the chairman quest's count. */
export const PLANT_BAN_QUEST_DELEGATES = 4;

/**
 * THE LEVEL, POINTED DOWN: every participant is cut to 2 + influence plants.
 * `base` + `perInfluence` yield the LIMIT; the `level` term — direction
 * `down` — says what moves is the difference above it.
 */
export const PLANT_BAN_LIMIT: InfluenceScaledEffect = {
  id: 'plants',
  unit: {kind: 'stock', resource: Resource.PLANTS},
  base: PLANT_BAN_LIMIT_BASE,
  perInfluence: 1,
  level: {total: {kind: 'stock', resource: Resource.PLANTS}, direction: 'down'},
  recipient: 'each',
};

/** The server's own reason for a zero — the rule working, never a want of influence. */
export const PLANT_BAN_AT_LIMIT_REASON = 'Plants already at or below the limit';

const LIMIT_STEP: EnactStep = {
  key: 'plants',
  run(ctx) {
    const player = ctx.player;
    const effect = PLANT_BAN_LIMIT;
    const influence = ctx.influence;
    const limit = scaledAmount(effect, influence);
    // THE SUPPLY AS THE ENGINE KEEPS IT at the step — the sitting runs AFTER
    // the production phase, so the plants this generation's income brought in
    // are counted, and spending them on a greenery before the sitting is a
    // legal tactic the vote panel reads against the very same number.
    const before = player.plants;
    const lost = levelAmount(effect, influence, before);
    if (lost <= 0) {
      // THE PARENTHESIS: at or below the limit already. Named as the rule
      // working — with the supply and the limit it was read against.
      ctx.game.log('${0} has ${1} plant(s) — no more than the ${2} allowed by ${3}, so nothing is taken', (b) =>
        b.player(player).number(before).number(limit).resolution(PLANT_BAN_ID));
      ctx.report({
        kind: 'skipped', effect: effect.id, stock: Resource.PLANTS, amount: 0, influence, target: limit,
        total: {before, after: before}, reason: PLANT_BAN_AT_LIMIT_REASON,
      });
      return undefined;
    }
    // The standard deduction under the resolution's source (its events, the
    // recorder, the party reactions); `from` is what keeps it a deduction
    // rather than an illegal-state line. No protection is consulted: the law
    // is not a player, and the engine's own guard says so (see the header).
    player.stock.add(Resource.PLANTS, -lost, {log: false, from: {resolution: PLANT_BAN_ID}});
    const after = player.plants;
    ctx.game.log('${0} loses ${1} plant(s) to ${2}: the limit is ${3} (2 + influence ${4}) — ${5} → ${6}', (b) =>
      b.player(player).number(lost).resolution(PLANT_BAN_ID).number(limit).number(influence).number(before).number(after));
    // THE SIGN IS THE ADDRESS'S: a `stock` record with a NEGATIVE amount is a
    // LOSS, read backwards by the reward beat. `owed` rides it as the levy's
    // does — here it always equals what was taken: the cut can never be short.
    ctx.report({
      kind: 'stock', effect: effect.id, stock: Resource.PLANTS, amount: -lost, owed: lost, influence, target: limit,
      total: {before, after}, before, after,
    });
    return undefined;
  },
};

export const PLANT_BAN: ResolutionDefinition = {
  id: PLANT_BAN_ID,
  code: PLANT_BAN_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE as printed: «max 2 [plant] + [influence]» — the number is the
  // LIMIT the player keeps, which is why the word «max» stands before it and
  // not a «−»: nothing on this face is an amount taken. The 2 is a DIGIT
  // (`{digit: true}`), as the card prints it — the renderer's default for a
  // small amount is a chain of icons, and two leaves side by side read as
  // «two plants are taken», which is the one thing this face must not say.
  renderData: CardRenderer.builder((b) => {
    b.text('max', Size.LARGE).plants(PLANT_BAN_LIMIT_BASE, {digit: true}).plus().influence();
  }),
  text: {
    name: 'Plant Ban',
    effect: 'Lose all plants above 2 plus 1 per influence. If you have no more than that, lose nothing.',
    quest: 'Send 4 delegates to resolutions',
  },
  quest: {goal: {kind: 'delegates'}, count: PLANT_BAN_QUEST_DELEGATES},
  scaled: [PLANT_BAN_LIMIT],
  immediateSteps: [LIMIT_STEP],
};
