import {IPlayer} from '../IPlayer';
import {CardName} from '../../common/cards/CardName';
import {PlayerId} from '../../common/Types';
import {
  NEUTRAL_DELEGATE_ICON, NEUTRAL_VOTE_LABEL, PARLIAMENT_NEUTRAL_DELEGATES, REDUX_PARTIES, ReduxParty, ResolutionInstanceId, SUPPORT_LIMIT_REASON,
  supportRoomOf,
} from '../../common/parliament/ParliamentTypes';
import {NeutralRallyModel, NeutralRallyVoteModel} from '../../common/models/ActionPreviewModel';
import {ParliamentRallyModel, ParliamentRallySupportModel, ParliamentRallyVoteModel} from '../../common/models/ParliamentModel';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import type {SkippedEffect} from '../cards/actionPreviews';
import {Parliament} from './Parliament';
import {payPopularSupport} from './PlaceDelegatesOnResolution';

/**
 * «ADD 1 NEUTRAL DELEGATE TO EACH <PARTY> RESOLUTION UP FOR VOTING, AND TO
 * EACH OF THEIR POPULAR SUPPORT AREAS AS WELL» (Turmoil Redux TR31 Nationalist
 * Movement, docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md) — the shared step any
 * card that RALLIES neutral delegates by name inherits. The form of the set's
 * other shared steps (TR03's grant, TR12's discard) WITHOUT a prompt: the card
 * asks nothing — the plan is read, then applied, by two functions with
 * nothing between them.
 *
 * ONE PLAN, TWO READINGS. `rallyPlan` is PURE («a hook that answers is not a
 * hook that acts»): it walks the PRINTED order — every named party's
 * resolution in the voting area, then every named party's support area —
 * judging the common supply AS IT GOES, so a supply of two gives two votes and
 * no support, in that order, and the forecast says so before the press.
 * `applyRally` executes THAT plan with the table's existing writers
 * (`addNeutralVote`, `addPopularSupport` through `payPopularSupport`) and
 * records what it did; a plan the table could not honour is an illegal state
 * written to the log, never a silent difference. The play preview and the
 * play itself call `rallyPlan` at the same moment (there is no prompt between
 * them), so the plan the player read IS the fact.
 *
 * WHAT A NEUTRAL VOTE DOES — and does not: it is the neutral player's cube on
 * the card. It never takes the lead while a player's cube stands there
 * (`leaderOf` skips it), so nobody's access to the party moves; but it is a
 * vote, so the card may BECOME the winning one (more votes, or equal votes
 * closer to ENACTED — `winnerAmong`). The plan reads both off a THROWAWAY
 * TABLE (`Parliament.projection`), the model's own technique, accumulating
 * cube by cube so the k-th entry's verdict stands on the k−1 before it.
 *
 * NAMED, NEVER SILENT: a party with no resolution in the area is a NAMED ZERO
 * (`missing` — nothing was lost: zero resolutions × one cube); a vote the
 * empty supply cut is a NAMED SKIP (`recordSkippedEffect`, the supply's
 * reason); an area that takes nothing is the support payout's own named skip
 * (the area's ceiling or the supply, judged in that order — `supportRoomOf`).
 *
 * THE RECOUNT: «neutral delegates in use (not in the reserve)» is derived —
 * `PARLIAMENT_NEUTRAL_DELEGATES − neutralSupply()` — every neutral cube on any
 * of the three resolutions plus every one in the six areas, AFTER the rally.
 * The M€ is the CARD's to pay (it is the card's printed effect); the plan
 * carries the number, the record carries the FULL list the recount marks.
 */

/** What the card prints per resolution and per area. */
export type RallyPrint = {perResolution: number, perArea: number};

/** Whose deed the rally is — only a card rallies today; the record names it. */
export type RallyCause = {kind: 'card', card: CardName};

/** The server's record — the model's shape with the seat as a PlayerId (`ParliamentModel` colours it). */
export type ParliamentRallyRecord = Omit<ParliamentRallyModel, 'player'> & {player: PlayerId};

/** What a lost neutral vote is NAMED by — the one description the forecast and the record share. */
export function skippedNeutralVote(): {reason: string, skipped: SkippedEffect} {
  return {reason: SUPPORT_LIMIT_REASON.supply, skipped: {label: NEUTRAL_VOTE_LABEL, effect: {direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: 1}}};
}

/**
 * THE PLAN (pure): the printed order over the live table, the supply spent
 * step by step, the winner read on a copy. Nothing is mutated, logged or
 * recorded — the play preview calls this as freely as the play does.
 */
export function rallyPlan(parliament: Parliament, parties: ReadonlyArray<ReduxParty>, print: RallyPrint = {perResolution: 1, perArea: 1}): NeutralRallyModel {
  const supplyBefore = Math.max(0, parliament.neutralSupply());
  let supply = supplyBefore;
  const copy = parliament.projection();
  const votes: Array<NeutralRallyVoteModel> = [];
  const missing: Array<ReduxParty> = [];
  for (const party of parties) {
    const slot = parliament.slotOf(party);
    if (slot === undefined) {
      missing.push(party);
      continue;
    }
    const target = copy.slotByInstance(slot.instance);
    if (target === undefined) {
      throw new Error('slot vanished from the projection');
    }
    const resolution = parliament.resolutionOf(slot.instance).id;
    for (let i = 0; i < print.perResolution; i++) {
      const votesBefore = target.votes.length;
      const winningBefore = copy.winner()?.instance === slot.instance;
      if (supply <= 0) {
        votes.push({party, instance: slot.instance, resolution, placed: false, limit: 'supply', votesBefore, votesAfter: votesBefore, winningBefore, winningAfter: winningBefore});
        continue;
      }
      target.votes.push({owner: 'NEUTRAL', seq: ++copy.voteSeq});
      supply--;
      const verdict = copy.winner();
      const winningAfter = verdict?.instance === slot.instance;
      const entry: NeutralRallyVoteModel = {party, instance: slot.instance, resolution, placed: true, votesBefore, votesAfter: target.votes.length, winningBefore, winningAfter};
      if (winningAfter && verdict?.tieBreak === 'slot-priority') {
        entry.tieNote = 'slot-priority';
      }
      votes.push(entry);
    }
  }
  // THE AREAS, from what the votes left. `popularSupportRoom` reads the LIVE supply, which the planned votes have
  // not spent yet — the one place a running supply is legal, and it is the same arithmetic (`supportRoomOf`),
  // pinned by the step's spec: the plan equals the fact on a short supply.
  const areas = new Map<ReduxParty, number>();
  const support: Array<NeutralRallyModel['support'][number]> = [];
  for (const party of parties) {
    const current = areas.get(party) ?? parliament.popularSupportOf(party);
    const room = supportRoomOf(current, supply, print.perArea);
    supply -= room.gained;
    areas.set(party, room.resulting);
    support.push({party, ...room});
  }
  const inUse = {before: PARLIAMENT_NEUTRAL_DELEGATES - supplyBefore, after: PARLIAMENT_NEUTRAL_DELEGATES - supply};
  return {parties: [...parties], votes, missing, support, supply: {before: supplyBefore, after: supply}, inUse, megacredits: inUse.after};
}

/**
 * THE EXECUTION of a plan, by the table's own writers, in the plan's order:
 * each neutral vote (the journal line, the typed fact), each area (the support
 * payout — TR03's), every cut a named skip; then the record the client plays.
 * The plan was read on the same table a moment ago; a vote the supply cannot
 * give now is an illegal state, logged, and the cube is recorded as cut.
 * Returns the record it wrote (`parliament.lastRally`).
 */
export function applyRally(player: IPlayer, parliament: Parliament, plan: NeutralRallyModel, cause: RallyCause): ParliamentRallyRecord {
  const game = player.game;
  const winnerBefore = parliament.winner()?.instance;
  const votes: Array<ParliamentRallyVoteModel> = [];
  const votesCut: Array<{party: ReduxParty, instance: ResolutionInstanceId, resolution: ParliamentRallyVoteModel['resolution']}> = [];
  const cut = (step: NeutralRallyVoteModel) => {
    const lost = skippedNeutralVote();
    recordSkippedEffect(player, lost.reason, lost.skipped);
    votesCut.push({party: step.party, instance: step.instance, resolution: step.resolution});
  };
  for (const step of plan.votes) {
    const slot = parliament.slotByInstance(step.instance);
    if (slot === undefined) {
      game.logIllegalState('neutral rally: the planned resolution is no longer in the voting area', {card: cause.card, instance: step.instance});
      continue;
    }
    if (!step.placed) {
      cut(step);
      continue;
    }
    const vote = parliament.addNeutralVote(slot);
    if (vote === undefined) {
      game.logIllegalState('neutral rally: the plan placed a vote the supply could not give', {card: cause.card, instance: step.instance});
      cut(step);
      continue;
    }
    const definition = parliament.resolutionOf(slot.instance);
    game.log('${0} adds 1 neutral delegate to ${1}', (b) => b.player(player).resolution(definition.id));
    game.events.recordNeutralDelegatesPlaced(player, 1, definition.id);
    const verdict = parliament.winner();
    const entry: ParliamentRallyVoteModel = {
      instance: slot.instance, resolution: definition.id, party: definition.party, seq: vote.seq, votes: slot.votes.length,
      winnerAfter: verdict?.instance,
    };
    if (verdict?.instance === slot.instance && verdict.tieBreak === 'slot-priority') {
      entry.tieNote = 'slot-priority';
    }
    votes.push(entry);
  }
  const support: Array<ParliamentRallySupportModel> = [];
  for (const step of plan.support) {
    const room = payPopularSupport(player, parliament, step.party, step.printed);
    if (room.gained !== step.gained) {
      game.logIllegalState('neutral rally: the area took a different number than planned', {card: cause.card, party: step.party, planned: step.gained, paid: room.gained});
    }
    support.push({party: step.party, ...room});
  }
  const inUseAfter = PARLIAMENT_NEUTRAL_DELEGATES - parliament.neutralSupply();
  if (inUseAfter !== plan.inUse.after) {
    game.logIllegalState('neutral rally: the recount disagrees with the plan', {card: cause.card, planned: plan.inUse.after, counted: inUseAfter});
  }
  const record: ParliamentRallyRecord = {
    // Monotonic across a restart (`gameAge` — the ring law) and across two rallies inside one age.
    seq: Math.max(game.gameAge, (parliament.lastRally?.seq ?? 0) + 1),
    player: player.id,
    card: cause.card,
    winnerBefore,
    votes,
    missing: [...plan.missing],
    votesCut,
    support,
    counted: {
      votes: parliament.slots
        .map((slot) => ({instance: slot.instance, seqs: slot.votes.filter((v) => v.owner === 'NEUTRAL').map((v) => v.seq)}))
        .filter((entry) => entry.seqs.length > 0),
      support: REDUX_PARTIES.map((party) => ({party, count: parliament.popularSupportOf(party)})).filter((entry) => entry.count > 0),
    },
    inUse: {before: plan.inUse.before, after: inUseAfter},
    megacredits: inUseAfter,
    generation: game.generation,
  };
  parliament.lastRally = record;
  return record;
}
