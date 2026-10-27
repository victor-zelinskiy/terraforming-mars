/*
 * THE AGENDA GRANT STEP (Turmoil Redux) — the ONE executor of a resolution's
 * `agendaGrant` declaration (`common/parliament/agendaGrant.ts`): the step of
 * the Career a law grants the seats — Reds Budget's «each player advances
 * their Agenda marker 1 step». A card declares the grant (HOW MANY steps and
 * WHO); this step is the same for every one of them, so the next grant adds
 * no code here.
 *
 * WHAT THE STEP FIXES:
 *  · WHO is the shared grant's ONE predicate (`agendaGrantEligibility` —
 *    `seatGrant.ts`); a seat the rule passes over is a NAMED skip of the rule.
 *  · THE WALK IS THE TRACK'S ONE WALK (`ChairmanSeat.walkAgenda`, the cause
 *    `resolution`): one step at a time, each step's bonus paid on the spot —
 *    a TR step +1 TR, a card step a card into the hand under the Agenda's own
 *    source (1 M€ for MarsBot, the Automa FAQ), an influence step the new
 *    level. A marker with no cube yet stands on position 1 after its first
 *    step (`Parliament.advanceAgenda`). The walk keeps the step's scope, so the
 *    journal names the LAW.
 *  · THE END OF THE TRACK → NOTHING, and it NAMES ITSELF
 *    (`AGENDA_GRANT_END_OF_TRACK_REASON`, a `skipped` record with the walk that
 *    did not happen); the seat's other parts are paid as usual.
 *  · ONE record per seat under `AGENDA_GRANT_STEP_KEY`: `kind: 'agenda'` with
 *    the WALK (from, to, every step with its bonus) and what it paid,
 *    measured around the walk (`tr`, `drawn`, `megacredits`). The sitting
 *    plays THESE records seat by seat — `parliament.lastAdvance` is one per
 *    game and a law walks several seats in one response.
 *  · THE INFLUENCE the record carries is the seat's influence at the step's
 *    start — the printed order: a payout before the step never sees the level
 *    the step reaches.
 *
 * The step MUTATES and never asks (a walk chooses nothing), so a reload never
 * finds it half-done: the driver's per-seat key makes it once. MarsBot is
 * walked by the SAME payer (`payAgendaGrant`) in its place in the seat order
 * (decision D11 — `ParliamentPhase.runBotSeatGrant`), never by a prompt.
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {
  AGENDA_GRANT_END_OF_TRACK_REASON, AGENDA_GRANT_NOT_ELIGIBLE_REASON, AGENDA_GRANT_STEP_KEY, AgendaGrantDeclaration, agendaGrantEligibility,
} from '../../../common/parliament/agendaGrant';
import {IPlayer} from '../../IPlayer';
import type {Parliament} from '../Parliament';
import {ChairmanSeat} from '../quests/ChairmanSeat';
import {EnactOutcome, EnactStep} from './IResolution';

/**
 * PAY ONE SEAT the walk `grant` declares — the human's step and the bot's
 * executor alike. Mutates; never asks; reports exactly once (`agenda` or the
 * named `skipped`). `winner` is the vote's winning seat (a threshold grant's
 * star), `influence` the seat's influence at the step's start.
 */
export function payAgendaGrant(
  seat: IPlayer,
  parliament: Parliament,
  resolution: ResolutionId,
  grant: AgendaGrantDeclaration,
  context: {winner: IPlayer | undefined, influence: number},
  report: (outcome: EnactOutcome) => void,
): void {
  const game = seat.game;
  const influence = context.influence;
  if (agendaGrantEligibility(grant, {winner: context.winner?.id === seat.id, influence}) === 'none') {
    // The rule passes the seat over — named as the rule, never as «no influence».
    game.log('${0} is below 2 influence and did not win the vote — no Agenda step from ${1}', (b) => b.player(seat).resolution(resolution));
    report({kind: 'skipped', influence, reason: AGENDA_GRANT_NOT_ELIGIBLE_REASON});
    return;
  }
  const from = parliament.agendaOf(seat);
  // WHAT THE WALK PAID is MEASURED around it (a card hook answering the rating counts honestly), never re-derived.
  const rating = seat.terraformRating;
  const hand = seat.cardsInHand.length;
  const cash = seat.megaCredits;
  const walk = ChairmanSeat.walkAgenda(seat, parliament, grant.steps, {reason: 'resolution', resolution});
  if (walk === undefined) {
    // The track's end took every step: the walk's own line is in the journal; the record names the skip.
    report({kind: 'skipped', influence, amount: 0, walk: {from, to: from, steps: []}, reason: AGENDA_GRANT_END_OF_TRACK_REASON});
    return;
  }
  const outcome: EnactOutcome = {
    kind: 'agenda',
    influence,
    amount: walk.steps.length,
    walk: {from: walk.from, to: walk.to, steps: walk.steps.map((step) => ({...step}))},
  };
  const tr = seat.terraformRating - rating;
  if (tr > 0) {
    outcome.tr = tr;
  }
  if (walk.steps.some((step) => step.bonus === 'card')) {
    if (seat.isMarsBot === true) {
      // The bot's card is 1 M€ under the hood (`megacredits`); the record speaks the card like every seat's (D16).
      const megacredits = seat.megaCredits - cash;
      if (megacredits > 0) {
        outcome.megacredits = megacredits;
        outcome.drawn = walk.steps.filter((step) => step.bonus === 'card').length;
      }
    } else {
      outcome.drawn = Math.max(0, seat.cardsInHand.length - hand);
    }
  }
  report(outcome);
}

/** THE SHARED AGENDA GRANT STEP of `resolution` — listed where the printed order puts the walk in `immediateSteps`. */
export function agendaGrantStep(resolution: ResolutionId, grant: AgendaGrantDeclaration): EnactStep {
  return {
    key: AGENDA_GRANT_STEP_KEY,
    run(ctx) {
      payAgendaGrant(ctx.player, ctx.parliament, resolution, grant, {winner: ctx.winner, influence: ctx.influence}, (outcome) => ctx.report(outcome));
      return undefined;
    },
  };
}
