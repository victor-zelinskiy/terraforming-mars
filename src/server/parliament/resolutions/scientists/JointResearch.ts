/*
 * JOINT RESEARCH (the Scientists) — Turmoil Redux resolution RX16, the first
 * card of the party and the first whose value is a LEVEL, not an amount
 * (docs/TURMOIL_REDUX_JOINT_RESEARCH.md).
 *
 * Printed: «When enacted: Each player draws cards until they have 6 cards in
 * hand + Influence. (Draw no cards if you already had that number of cards
 * in hand, or more.)» Chairman quest: discard 2 cards.
 *
 * THE READINGS FIXED HERE:
 *  · THE FORMULA IS A TARGET. «6 + influence» is the hand size every
 *    participant is brought UP TO, each by their own influence — never a
 *    number of cards paid outright. The declaration says so (`upTo`), so the
 *    one formula (`scaledAmount`) yields the target and the ONE top-up
 *    division (`topUpAmount` = max(0, target − hand)) yields the payout, on
 *    the server, in every reading and on the stand alike. A surface that
 *    printed the target alone would promise «+9 cards» to a player who is
 *    owed four.
 *  · THE HAND IS THE ENGINE'S, at the step (`player.cardsInHand.length`) —
 *    the hand the player left themselves by their own turn, since the sitting
 *    runs AFTER the production phase. Emptying the hand before the sitting to
 *    draw more is a legal tactic, and the vote panel's estimate stands on the
 *    same count. Cards withheld in a pending intake are not in the hand — nor
 *    does the step see them.
 *  · THE PARENTHESIS IS THE FORMULA, NOT AN EXCEPTION: a hand at or above
 *    the target draws zero, and that zero NAMES ITSELF as the rule working
 *    («already at the target hand size») — never as «no influence», never as
 *    a lost payout. Influence 0 does not cancel the card: the target is
 *    still 6, and a hand of 2 still draws 4.
 *  · THE CARDS come from the PROJECT DECK through the shared external-draw
 *    intake (`ExternalDrawIntake`): they leave the deck at the enactment, in
 *    seat order (deck order can never depend on when anybody answers — which
 *    seat gets the top cards is decided by the order of the seats and nothing
 *    else); they are WITHHELD from the hand until the mandatory take; the
 *    prompt is a projection of serialized state, so a reload inside the take
 *    draws nothing twice and loses nothing. The political phase owns the
 *    wait: the step keeps the prompt instead of deferring it.
 *  · A SHORT DECK delivers what it has: the record keeps both the amount owed
 *    and `drawn`, and the shortfall is journaled — never silent.
 *  · CARD NAMES ARE PRIVATE: a seat sees its own draw as cards, another's as
 *    a number (the intake's journal line is reserved for the recipient).
 *  · MarsBot takes no seat: nothing is drawn for it, and its hand is counted
 *    for nobody.
 *  · THE CHAIRMAN QUEST asks the player to DISCARD 2 cards from their hand by
 *    their OWN action — the patent sale counts by itself (it discards the
 *    cards sold), a card play is not a discard, a discard demanded by another
 *    player's effect or by a resolution is not the player's own (the shared
 *    tracker's eligibility rule, never a rule of this card).
 *
 * THE STEP CONTRACT (IResolution.ts): the draw step is the one documented
 * exception the intake makes safe — it takes the cards off the deck and asks
 * in the same breath, and re-entry (a reload) is idempotent because the
 * intake it remembers IS game state.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount, topUpAmount} from '../../../../common/parliament/influenceScaling';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const JOINT_RESEARCH_ID: ResolutionId = 'RDX_SCIENTISTS_JOINT_RESEARCH';
export const JOINT_RESEARCH_CODE: ResolutionCode = 'RX16';
/** The printed «6 cards in hand» — the target's base, before the influence. */
export const JOINT_RESEARCH_HAND_BASE = 6;

/**
 * THE LEVEL: every participant is brought up to 6 + influence cards in hand.
 * `base` + `perInfluence` yield the TARGET; `upTo` says the payout is the
 * difference to the hand.
 */
export const JOINT_RESEARCH_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  base: JOINT_RESEARCH_HAND_BASE,
  perInfluence: 1,
  upTo: {total: {kind: 'cards'}},
  recipient: 'each',
};

/** The server's own reason for a zero — the rule working, never a loss. */
export const JOINT_RESEARCH_AT_TARGET_REASON = 'Already at the target hand size';

/** The intake the draw step opened — the proof it already drew (game state carries the cards). */
const INTAKE_KEY = 'drawIntake';

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = JOINT_RESEARCH_DRAW;
    // RE-ENTRY (a reload inside the take): the cards already left the deck and
    // sit in the intake — game state. Nothing is drawn again; the mandatory
    // prompt is re-derived from the intake.
    const remembered = ctx.state[INTAKE_KEY];
    if (typeof remembered === 'number') {
      const pending = ExternalDrawIntake.pendingOf(player, remembered);
      return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
    }
    const influence = ctx.influence;
    const target = scaledAmount(effect, influence);
    // THE HAND AS THE ENGINE KEEPS IT — never a projection, never a count
    // that includes cards still owed in another intake.
    const before = player.cardsInHand.length;
    const owed = topUpAmount(effect, influence, before);
    if (owed <= 0) {
      // THE PARENTHESIS: at or above the target already. Named as the rule
      // working — with the hand and the target it was read against.
      ctx.game.log('${0} has ${1} card(s) in hand — at least ${2} already, so ${3} draws none', (b) =>
        b.player(player).number(before).number(target).resolution(JOINT_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: effect.id, amount: 0, influence, target, total: {before, after: before}, reason: JOINT_RESEARCH_AT_TARGET_REASON});
      return undefined;
    }
    // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
    // the cards withheld from the hand until taken, the prompt re-derivable.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: JOINT_RESEARCH_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence, target, total: {before, after: before}, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: up to ${3} card(s) in hand (6 + influence ${4}), had ${5}', (b) =>
      b.player(player).number(intake.count).resolution(JOINT_RESEARCH_ID).number(target).number(influence).number(before));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    // `total.after` is the hand the take will leave — what actually landed,
    // never the target (a short deck reaches less).
    ctx.report({
      kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence, target,
      total: {before, after: before + intake.count},
    });
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

export const JOINT_RESEARCH: ResolutionDefinition = {
  id: JOINT_RESEARCH_ID,
  code: JOINT_RESEARCH_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE as printed: «[influence] + 6 [project card]*» — the spark refers
  // the reader to the parenthesis (a hand already there draws nothing).
  renderData: CardRenderer.builder((b) => {
    b.influence().plus().cards(JOINT_RESEARCH_HAND_BASE).asterix();
  }),
  text: {
    name: 'Joint Research',
    effect: 'Draw cards until you have 6 cards in hand plus 1 per influence. If you already have that many or more, draw none.',
    quest: 'Discard 2 cards',
  },
  quest: {goal: {kind: 'cardsDiscarded'}, count: 2},
  scaled: [JOINT_RESEARCH_DRAW],
  immediateSteps: [DRAW_STEP],
};
