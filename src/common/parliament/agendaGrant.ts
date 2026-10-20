/*
 * A STEP OF THE CAREER A LAW GRANTS THE SEATS, AS DATA (Turmoil Redux — Reds
 * Budget RX39: «Each player advances their Agenda marker 1 step»).
 *
 * The second member of the family «a law hands the seat a DEED» (the tile is
 * the first — `tileGrant.ts`): what each recipient receives is not an amount
 * but a WALK of its own marker on the Career (Agenda) track, N steps, every
 * step paying its own bonus on the spot — the ONE walk of the track
 * (`ChairmanSeat.walkAgenda`, the winner's step, the chairman quest and TR04's
 * cards walk the same function). The declaration states only HOW MANY steps
 * and WHO walks them (the shared recipients — `seatGrant.ts`); the step the
 * engine pays it by is the family's ONE shared step
 * (`server/parliament/resolutions/ResolutionAgendaGrant.ts`).
 *
 * WHO INCLUDES MARSBOT (decision D11): the bot moves on the Career as a human
 * does (D3), so the step a law grants the seats is the bot's too — its card
 * step is 1 M€ (the Automa FAQ, `ChairmanSeat.payStep`).
 *
 * The forecast of a walk — WHAT the next steps of a seat give — is read off
 * the printed track here (`agendaWalkAhead`), the same table the engine
 * advances by; a reading never invents a step's bonus. Pure — no engine, no
 * i18n calls (the reasons are English keys).
 */
import {AGENDA_TRACK, AgendaStep, influenceAtAgenda, PARLIAMENT_AGENDA_STEPS} from './ParliamentTypes';
import {GRANT_NOT_ELIGIBLE_REASON, GrantEligibility, grantEligibility, GrantRecipients} from './seatGrant';

/** The step of the Career a law grants the seats: `steps` steps of the seat's own marker, to the shared recipients. */
export type AgendaGrantDeclaration = {
  steps: number;
  recipients: GrantRecipients;
};

/** The step key the grant's record is filed under — one key, whatever the card: the record IS the walk. */
export const AGENDA_GRANT_STEP_KEY = 'agenda';

/** WHO walks — the shared grant's predicate (a grant to everyone reaches every seat). */
export function agendaGrantEligibility(grant: AgendaGrantDeclaration, seat: {winner: boolean, influence: number}): GrantEligibility {
  return grantEligibility(grant.recipients, seat);
}

/** The skips' reasons — English keys the stage plate translates; the server records them, every reading prints them. */
export const AGENDA_GRANT_END_OF_TRACK_REASON = 'Already at the end of the Career track';
export const AGENDA_GRANT_NOT_ELIGIBLE_REASON = GRANT_NOT_ELIGIBLE_REASON;

/** ONE step ahead of a marker: the position it reaches and what the printed track pays there. */
export type AgendaStepAhead = {
  to: number;
  step: AgendaStep;
  /** The influence LEVEL the marker reads once it stands there (the track's part of the influence). */
  level: number;
};

/**
 * THE WALK AHEAD (pure): the next `steps` steps of a marker standing on
 * `position` (0 = no cube yet — the first step reaches position 1), cut by the
 * end of the track. An empty list is the marker already at the end — the
 * named skip of the step itself (`AGENDA_GRANT_END_OF_TRACK_REASON`).
 */
export function agendaWalkAhead(position: number, steps: number): Array<AgendaStepAhead> {
  const out: Array<AgendaStepAhead> = [];
  for (let to = Math.max(0, position) + 1; to <= PARLIAMENT_AGENDA_STEPS && out.length < steps; to++) {
    out.push({to, step: AGENDA_TRACK[to - 1], level: influenceAtAgenda(to)});
  }
  return out;
}
