/*
 * THE SOFT GATES — «Закрыть заседание» is a PROMPT OF THE SEAT, not a barrier
 * of the phase (docs/claude/console/parliament-soft-gates.md).
 *
 * The political phase runs its steps in one chain (winner → agenda → support →
 * enact → effects → refresh → lobby → done) and waits only where the seats
 * depend on each other: a resolution's own questions, asked seat by seat. At
 * `done` the phase writes THE RECORD (`Parliament.sittingAcks`) of every seat
 * of the aspect `prompts` — MarsBot never — and asks each of them ONE
 * confirmation. The next generation does NOT wait for them: the World
 * Government, the draft and the research begin at once. What waits is the
 * SEAT: every publisher of its first prompt of N+1 asks
 * `Parliament.holdsSittingAck` and leaves that prompt to the seat's own
 * answer, which ADMITS it (`IGame.admitToGeneration`). The record is game
 * state, so a reload re-issues the confirmations FIRST and admits on the
 * answer exactly as live (`Game.deserialize`).
 *
 * The final sitting is the one barrier left: the final greeneries follow it
 * and they ask the seats in turn — its last confirmation moves the game on.
 *
 * THE EARLY CLOSE: while the chain waits on ANOTHER seat's question, a seat
 * nothing is asked of may close its sitting at once (`offerEarly` — the same
 * confirmation, marked `early`). It leaves the record before it is written:
 * `done` asks it nothing and the next generation admits it at once. A
 * question the law asks it later SUPERSEDES the early close (`Player` drops
 * an unanswered one silently) and comes as an ordinary prompt; the close is
 * offered again once that question is answered.
 *
 * Never a counter in memory, never a clock, never the browser: the answer is
 * the seat's, the record is the server's.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {SelectOption} from '../inputs/SelectOption';
import {message} from '../logs/MessageBuilder';
import {CapturedEventContext} from '../events/EventRecorder';
import {Parliament} from './Parliament';
import {SerializedPhaseSummary, SerializedSittingAcks} from './SerializedParliament';
import {PlayerId} from '../../common/Types';

export class SittingAcks {
  /**
   * Write the record at the sitting's end — every seat that is asked owes
   * the confirmation. Nothing owed (a table without a human) writes nothing.
   * Returns whether anybody owes it.
   */
  public static open(game: IGame, parliament: Parliament, summary: SerializedPhaseSummary | undefined, final: boolean,
    closedEarly: ReadonlyArray<PlayerId> = []): boolean {
    const pending = parliament.participants(game, 'prompts').map((seat) => seat.id).filter((id) => !closedEarly.includes(id));
    if (summary === undefined || pending.length === 0) {
      parliament.sittingAcks = undefined;
      return false;
    }
    parliament.sittingAcks = {
      generation: summary.generation,
      seq: summary.seq ?? 0,
      final,
      ...(summary.correlationId === undefined ? {} : {correlationId: summary.correlationId}),
      pending,
    };
    return true;
  }

  /** Ask every seat that owes the confirmation and holds no prompt — never over a standing one (a reload, the sitting's end). */
  public static issuePending(game: IGame): void {
    const acks = game.parliament?.sittingAcks;
    if (acks === undefined) {
      return;
    }
    for (const id of [...acks.pending]) {
      SittingAcks.offer(game.getPlayerById(id));
    }
  }

  /**
   * Ask ONE seat, if it owes the confirmation and its slot is free. A seat
   * whose slot holds a foreign prompt (a deferred tail the engine left it) is
   * asked when that prompt is answered — `Player.process` calls this again
   * once the slot is empty; nothing is ever written over.
   */
  public static offer(player: IPlayer): void {
    const game = player.game;
    const acks = game.parliament?.sittingAcks;
    if (acks === undefined || !acks.pending.includes(player.id)) {
      return;
    }
    const standing = player.getWaitingFor();
    if (standing !== undefined) {
      if (!isSittingAckPrompt(standing)) {
        console.warn(`[parliament] ${player.color} holds a "${standing.type}" prompt — the confirmation of the sitting waits for it`);
      }
      return;
    }
    const prompt = new SelectOption(message('The Mars Parliament of generation ${0} adjourns', (b) => b.number(acks.generation)), 'Close the sitting')
      .markParliamentPhase({stage: 'close', generation: acks.generation, final: acks.final, seq: acks.seq});
    // The prompt captures the SITTING's journal group, so the answer — after a reload too — stays in its chain.
    game.events.runWithContext(sittingContext(game, acks), () => {
      player.setWaitingFor(prompt, () => SittingAcks.answer(player, acks.seq));
    });
  }

  /** The seat closed the sitting: it leaves the record and is admitted to what the game already runs. */
  private static answer(player: IPlayer, seq: number): void {
    const game = player.game;
    const parliament = game.parliament;
    const acks = parliament?.sittingAcks;
    if (parliament === undefined || acks === undefined || acks.seq !== seq || !acks.pending.includes(player.id)) {
      return;
    }
    acks.pending = acks.pending.filter((id) => id !== player.id);
    game.events.runWithContext(sittingContext(game, acks), () => {
      game.log('${0} closed the sitting', (b) => b.player(player));
    });
    SittingAcks.settle(parliament);
    if (acks.final) {
      // THE FINAL BARRIER: the final greeneries ask the seats in turn — they follow the LAST confirmation.
      if (parliament.sittingAcks === undefined) {
        game.continueAfterParliamentPhase(true);
      } else {
        game.save();
      }
      return;
    }
    game.save();
    game.admitToGeneration(player);
  }

  /**
   * THE EARLY CLOSE — offered to every seat of the aspect `prompts` that has not closed yet and whose slot is FREE
   * (nothing is asked of it right now), while the sitting runs and waits on another seat. Never over a standing
   * prompt; a seat asked later loses the offer to that question (`Player.setWaitingFor`) and is offered it again
   * after its answer (the phase calls this after every pause).
   */
  public static offerEarly(game: IGame, parliament: Parliament, context: CapturedEventContext | undefined): void {
    const p = parliament.phase;
    if (p === undefined) {
      return;
    }
    const closed = p.closedEarly ?? [];
    for (const seat of parliament.participants(game, 'prompts')) {
      if (closed.includes(seat.id) || seat.getWaitingFor() !== undefined) {
        continue;
      }
      const prompt = new SelectOption(message('Nothing is asked of you in the sitting of generation ${0}', (b) => b.number(p.generation)), 'Close the sitting')
        .markParliamentPhase({stage: 'close', generation: p.generation, final: p.final, seq: p.summary?.seq ?? 0, early: true});
      // NOT THE SEAT'S TURN (the owner, 2026-10-28: «если ничего не требуется, то и промпта не должно быть»): the
      // offer is a courtesy standing in the slot — never a demand. `optional` is the engine's own word for it (the
      // draft re-pick's): `/api/waitingfor` never says GO for it, the chips never light the seat, the console never
      // announces it or strands on it — only the sitting's reward page offers it as its A.
      prompt.optional = true;
      game.events.runWithContext(context, () => {
        seat.setWaitingFor(prompt, () => SittingAcks.answerEarly(seat, p.generation, context));
      });
    }
  }

  /** The seat closed its sitting EARLY: it is written out of the record to come — the sitting runs on without it. */
  private static answerEarly(player: IPlayer, generation: number, context: CapturedEventContext | undefined): void {
    const game = player.game;
    const p = game.parliament?.phase;
    if (p === undefined || p.generation !== generation) {
      return;
    }
    const closed = (p.closedEarly ??= []);
    if (closed.includes(player.id)) {
      return;
    }
    closed.push(player.id);
    game.events.runWithContext(context, () => {
      game.log('${0} closed the sitting', (b) => b.player(player));
    });
    game.save();
  }

  /** At the sitting's end every unanswered early close goes — `done` writes the record and asks its own confirmation. */
  public static withdrawEarly(game: IGame): void {
    for (const seat of game.players) {
      if (isEarlySittingAck(seat.getWaitingFor())) {
        seat.clearWaitingFor();
      }
    }
  }

  /** The record goes when nothing is owed any more — no seat's confirmation, no World Government step. */
  public static settle(parliament: Parliament): void {
    const acks = parliament.sittingAcks;
    if (acks !== undefined && acks.pending.length === 0 && acks.owedWorldStep !== true) {
      parliament.sittingAcks = undefined;
    }
  }
}

/** Is `input` the EARLY close of a sitting still running — superseded silently by any question the seat is asked? */
export function isEarlySittingAck(input: PlayerInput | undefined): boolean {
  return input?.parliamentPhasePrompt?.stage === 'close' && input.parliamentPhasePrompt.early === true;
}

/** Is `input` the confirmation of a sitting — by the structural marker, never the title? */
export function isSittingAckPrompt(input: PlayerInput | undefined): boolean {
  return input?.parliamentPhasePrompt?.stage === 'close';
}

/** The sitting's journal group, rejoined; none on a record without a root. */
function sittingContext(game: IGame, acks: SerializedSittingAcks): CapturedEventContext | undefined {
  return acks.correlationId === undefined ? undefined : game.events.rejoinAction(acks.correlationId, {kind: 'parliament'}, 'political-phase');
}
