/*
 * THE POLITICAL PHASE — the parliament's end-of-generation steps (rulebook
 * pp.10–12), as a RESUMABLE driver.
 *
 * Steps: winner → agenda → support → enact → effects → refresh → lobby →
 * done (the final generation: … → effects → done). Every operation has an
 * idempotency key recorded in `phase.applied` (a per-seat one under its
 * player in `phase.appliedBySeat`), the effects step keeps a per-player
 * cursor and the pending step key, and the whole progress is game state
 * (`Parliament.phase`) — so a game saved while a resolution asks a player
 * something reloads INTO that question: no reward is paid twice, none is
 * lost, nothing is re-randomized (`Game.deserialize` →
 * `ParliamentPhase.resume`).
 *
 * THE SOFT GATES (docs/claude/console/parliament-soft-gates.md — the two
 * barrier gates of docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §3 are RETIRED):
 * the phase asks nobody but the questions of the enacted law, which are
 * asked seat by seat and hold it — the seats depend on each other there.
 * Every other step runs in ONE chain of `drive()`, in the rules' order (the
 * winner's Agenda strictly before the support, the enactment and the
 * rewards), and everything a player is shown afterwards is the summary's
 * RECORD. At `done` the phase writes who still has to CLOSE the sitting
 * (`SittingAcks`) and asks each of those seats ONE confirmation — a prompt
 * of the seat, not of the phase: the next generation begins at once, and a
 * seat is admitted to it on its own answer. The final sitting alone waits
 * for every confirmation (the final greeneries follow it). A save from
 * before (its step `assembly` or `adjourn`) resumes into the next step
 * and re-issues no old gate — the keys make every step idempotent. The
 * phase's whole journal is ONE group (`political-phase`): every step's
 * scope, every resolution's prompt and every confirmation's answer joins
 * the convening's root (see `convene`).
 *
 * Two modes: the ordinary end of generation (all steps) and the FINAL one
 * (project decision Q1: the winner is enacted and its effect applied, the
 * voting area is not refreshed and the lobby not refilled; the game then goes
 * on to the final greeneries).
 *
 * The phase runs under `Phase.PARLIAMENT`: tiles get owners and bonuses,
 * global parameters pay TR (unlike `Phase.SOLAR`), and action-phase card
 * hooks stay quiet. `activePlayer` is NOT reassigned to whoever is asked — a
 * prompt (a resolution's or the confirmation) goes straight to that player's
 * `setWaitingFor`.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import {copyStandardMoves, probeStandardMoves, StandardMovesProbe, standardMovesSince} from './standardMoves';
import {PartyName} from '../../common/turmoil/PartyName';
import {EventTrigger} from '../../common/events/GameEvent';
import {
  PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_VOTING_SLOTS, ReduxParty, REDUX_PARTIES, ResolutionId, ResolutionInstanceId,
} from '../../common/parliament/ParliamentTypes';
import {CapturedEventContext} from '../events/EventRecorder';
import {Parliament, Slot, Vote} from './Parliament';
import {EnactContext, EnactOutcome, EnactStep, hasImmediateSteps, immediateStepsOf, ResolutionDefinition} from './resolutions/IResolution';
import {
  EnactOutcomePart, SerializedDelegateOwner, SerializedEnactOutcome, SerializedPhaseProgress, SerializedPhaseSummary, SerializedRenewalEvent,
  SerializedRulingAnswer,
} from './SerializedParliament';
import {CardName} from '../../common/cards/CardName';
import {ChairmanSeat} from './quests/ChairmanSeat';
import {botWinnerRewardPlan, declaresWinnerPass, NO_BOT_EXECUTOR_REASON, payBotWinnerReward} from '../automa/BotWinnerReward';
import {payBotTileGrant} from '../automa/BotTileGrant';
import {botPayoutSteps} from '../automa/BotResolutionPayout';
import {payAgendaGrant} from './resolutions/ResolutionAgendaGrant';
import {SeatGrantDeed, seatGrantsOf} from './resolutions/SeatGrants';
import {SittingAcks} from './SittingAcks';
import {isBannerCubeSource} from '../../common/parliament/bannerCubes';
import {agendaReactionPending} from './AgendaWalkReactions';

/**
 * THE HANDLE OF A WORLD STEP — the seat the engine's parameter API is handed
 * and, when the step ASKS, the seat that answers: the first player in
 * generation order (the World Government's own precedent — `SnowCover`,
 * `MagneticFieldStimulationDelays`, Dry Deserts' «First Player»), which is
 * also who the printed rule of Water Export names by POSITION.
 *
 * MARSBOT NEVER HOLDS IT. The bot is a full seat of `playersInGenerationOrder`
 * and can be first — but it takes no decision at the Parliament's table (it
 * does not participate) and the Automa has no rule for «which ocean to
 * remove»; a prompt sent to it is a sitting that never moves. So the right
 * PASSES to the nearest human in generation order (a project decision,
 * pinned by its own spec — `docs/TURMOIL_REDUX_WATER_EXPORT.md` § the bot).
 * A mutating world step attributes nothing to the handle either way, so the
 * shift changes nothing for the parameter moves that came before.
 */
export function worldStepHandle(game: IGame): IPlayer {
  const order = game.playersInGenerationOrder;
  return order.find((player) => player.isMarsBot !== true) ?? order[0];
}

export class ParliamentPhase {
  /** The sitting's journal root, captured at the convening — the summary carries it from the first step on. */
  private rootId: number | undefined = undefined;

  constructor(
    private readonly game: IGame,
    private readonly parliament: Parliament,
    private readonly onDone: (final: boolean) => void,
  ) {}

  /** Begin the phase for the current generation. */
  public static start(game: IGame, parliament: Parliament, final: boolean, onDone: (final: boolean) => void): void {
    if (parliament.phase !== undefined) {
      throw new Error('A political phase is already in progress');
    }
    parliament.phase = {generation: game.generation, final, step: 'winner', applied: []};
    game.phase = Phase.PARLIAMENT;
    new ParliamentPhase(game, parliament, onDone).convene();
  }

  /** Pick the phase up where a save left it (a reload). */
  public static resume(game: IGame, parliament: Parliament, onDone: (final: boolean) => void): void {
    if (parliament.phase === undefined) {
      throw new Error('No political phase to resume');
    }
    game.phase = Phase.PARLIAMENT;
    new ParliamentPhase(game, parliament, onDone).continue();
  }

  /**
   * ONE JOURNAL GROUP FOR THE WHOLE SITTING. The convening line is the
   * group's header; every step's own scope JOINS it (the recorder coalesces a
   * nested action inside a `political-phase` scope exactly as inside a bot
   * turn); the resolution's prompts and the confirmation capture it, so an answer —
   * after a reload too — stays in the chain. The live scope is open only for
   * the header line: everything after runs under a REJOINED context of the
   * same root (`rootContext`), which is how a continuation after an input
   * boundary or a reload finds its way back into the group — and how the
   * phase's end (`onDone`: the final greeneries, the next generation) runs
   * OUTSIDE it.
   */
  private convene(): void {
    const events = this.game.events;
    events.beginAction(undefined, {kind: 'parliament'}, {category: 'political-phase'});
    try {
      this.rootId = events.captureContext()?.rootId;
      this.game.log('The Mars Parliament of generation ${0} convenes', (b) => b.number(this.game.generation).announcement());
    } finally {
      events.endScope();
    }
    this.continue();
  }

  /** The sitting's journal context, rejoined for every continuation; none on a save from before the sittings (its steps root their own groups, as they did). */
  private rootContext(): CapturedEventContext | undefined {
    const rootId = this.parliament.phase?.summary?.correlationId ?? this.rootId;
    return rootId === undefined ? undefined : this.game.events.rejoinAction(rootId, {kind: 'parliament'}, 'political-phase');
  }

  private get progress(): SerializedPhaseProgress {
    const progress = this.parliament.phase;
    if (progress === undefined) {
      throw new Error('No political phase in progress');
    }
    return progress;
  }

  private applied(key: string): boolean {
    return this.progress.applied.includes(key);
  }

  private markApplied(key: string): void {
    if (!this.applied(key)) {
      this.progress.applied.push(key);
    }
  }

  /**
   * A PER-SEAT key: stored under the player (a structural record the cloner
   * remaps), never as a string embedding the id. `legacy` is the same key as
   * an older save wrote it into `applied`, still honoured.
   */
  private seatApplied(player: PlayerId, key: string, legacy: string): boolean {
    return (this.progress.appliedBySeat?.[player] ?? []).includes(key) || this.applied(legacy);
  }

  private markSeatApplied(player: PlayerId, key: string): void {
    const bySeat = (this.progress.appliedBySeat ??= {});
    const keys = (bySeat[player] ??= []);
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }

  private get summary(): SerializedPhaseSummary {
    const p = this.progress;
    if (p.summary === undefined) {
      throw new Error('The phase summary is not initialised');
    }
    return p.summary;
  }

  /** Drive the phase until a step waits — deferred work first, the whole run inside the sitting's journal context. */
  private continue(): void {
    if (this.drainDeferred() === 'waiting') {
      this.offerEarlyCloses();
      return;
    }
    const finished = this.game.events.runWithContext(this.rootContext(), () => this.drive());
    if (finished !== undefined) {
      // Reported OUTSIDE the sitting's context: what follows (the final
      // greeneries, the next generation) is not the parliament's business.
      this.onDone(finished.final);
    } else {
      this.offerEarlyCloses();
    }
  }

  /**
   * THE CHAIN WAITS ON A SEAT: every OTHER seat nothing is asked of may close its sitting now (`SittingAcks.offerEarly`)
   * — never held on a screen that only says «waiting». Only while the phase still runs (the final barrier's own wait
   * at `done` is the record's confirmation, not this).
   */
  private offerEarlyCloses(): void {
    if (this.parliament.phase === undefined) {
      return;
    }
    if (agendaReactionPending(this.parliament, undefined, 'phase') !== undefined) {
      // THE WINNER'S TABLE ANSWERS ITS STEP OF THE CAREER (TR78): the support and the enactment are still ahead of
      // every seat — nobody can say yet that nothing is asked of them.
      return;
    }
    SittingAcks.offerEarly(this.game, this.parliament, this.rootContext());
    this.game.save();
  }

  /**
   * THE SEATS WHOSE PART OF THE LAW IS STILL AHEAD — a seat with a step of its plan (its own, the winner's) not yet
   * applied, and the world-step handle while a world step is. READ-ONLY: the same plan the effects step walks
   * (`immediateStepsOf`, the winner's steps, the idempotency keys), never a second rule. A step ahead MAY ask; the
   * waiting seat reads «you may still be asked» from it, never a promise.
   */
  public static seatsAhead(game: IGame, parliament: Parliament): ReadonlySet<PlayerId> {
    return new ParliamentPhase(game, parliament, () => undefined).seatsStillAhead();
  }

  private seatsStillAhead(): Set<PlayerId> {
    const out = new Set<PlayerId>();
    const p = this.parliament.phase;
    if (p === undefined || p.summary === undefined || !STEPS_BEFORE_THE_EFFECTS_END.has(p.step)) {
      return out;
    }
    const instance = p.summary.winner.instance;
    const definition = this.parliament.resolutionOf(instance);
    const winnerId = p.summary.winner.player;
    const winner = winnerId === undefined || winnerId === 'NEUTRAL' ? undefined : this.game.getPlayerById(winnerId);
    const deeds = seatGrantsOf(definition);
    const winnerSteps = definition.winnerSteps ?? [];
    const unapplied = (player: IPlayer, stepKey: string) =>
      !this.seatApplied(player.id, `effect:${p.generation}:${instance}:${stepKey}`, `effect:${p.generation}:${instance}:${player.id}:${stepKey}`);
    for (const player of this.parliament.participants(this.game, deeds.length === 0 ? 'enactment' : 'seat-grant')) {
      if (!this.parliament.participates(player, 'enactment')) {
        continue;
      }
      const steps = [
        ...immediateStepsOf(definition, player, this.parliament, this.game),
        ...(winner !== undefined && winner.id === player.id ? winnerSteps : []),
      ];
      if (steps.some((step) => unapplied(player, step.key))) {
        out.add(player.id);
      }
    }
    if ((definition.worldSteps ?? []).some((step) => !this.applied(`world:${p.generation}:${instance}:${step.key}`))) {
      out.add(worldStepHandle(this.game).id);
    }
    return out;
  }

  /**
   * Run the deferred queue. A queue that empties on the spot reports
   * `drained` and the caller goes on in its own frame; one that pauses on a
   * prompt re-enters `continue()` when the answer lands. (Re-entering
   * synchronously from inside the run would nest the phase's context under
   * itself and let its end run inside the sitting's journal scope.)
   */
  private drainDeferred(): 'drained' | 'waiting' {
    if (this.game.deferredActions.length === 0) {
      return 'drained';
    }
    let drained = false;
    let synchronous = true;
    this.game.deferredActions.runAll(() => {
      drained = true;
      if (!synchronous) {
        this.continue();
      }
    });
    synchronous = false;
    return drained ? 'drained' : 'waiting';
  }

  /** The step machine: every case advances the persisted step; an ask returns `undefined` (waiting); `done` returns the finish (or waits — the final barrier). */
  private drive(): {final: boolean} | undefined {
    for (;;) {
      const p = this.parliament.phase;
      if (p === undefined) {
        return undefined;
      }
      // A step's deferred tail (a tile's bonuses, a draw) may have carried the ruling party's answer past the step's own record.
      this.readReactions();
      switch (p.step) {
      case 'winner':
        this.stepWinner();
        p.step = 'agenda';
        break;
      case 'assembly':
        // LEGACY: a save standing at the retired verdict gate goes on — the old gate is re-issued to nobody.
        p.step = 'agenda';
        break;
      case 'agenda':
        this.stepAgenda();
        p.step = 'support';
        break;
      case 'support':
        this.stepSupport();
        p.step = 'enact';
        break;
      case 'enact':
        this.stepEnact();
        p.step = 'effects';
        // A save from the old order already carries its cursor — never reset it.
        p.effects ??= {playerIndex: 0};
        break;
      case 'effects':
        if (this.stepEffects() === 'waiting') {
          return undefined;
        }
        p.step = p.final ? 'done' : 'refresh';
        break;
      case 'refresh':
        this.stepRefresh();
        p.step = 'lobby';
        break;
      case 'lobby':
        this.stepLobby();
        p.step = 'done';
        break;
      case 'adjourn':
        // LEGACY: a save standing at the retired closing gate goes on — the confirmation is asked at `done`.
        p.step = 'done';
        break;
      case 'done':
        return this.finish();
      }
      // A step's own deferred work runs — and may wait — before the next step, exactly as before.
      if (this.drainDeferred() === 'waiting') {
        return undefined;
      }
      // THE LAW OF ACCESS, DIFFED after every step of the sitting (PL-112): the refresh that discarded a seat's
      // resolution took its cubes' road away; the enactment's change is everyone's and moves only the snapshot.
      this.parliament.announceAccessChanges(this.game);
    }
  }

  // ───────────────────────── step 1: the winner ─────────────────────────

  private stepWinner(): void {
    const p = this.progress;
    const verdict = this.parliament.winner();
    if (verdict === undefined) {
      throw new Error('The voting area is empty');
    }
    const definition = this.parliament.resolutionOf(verdict.instance);
    p.summary = {
      generation: p.generation,
      final: p.final,
      winner: {
        instance: verdict.instance,
        votes: verdict.votes,
        player: verdict.player,
        tieBreak: verdict.tieBreak ?? verdict.playerTieBreak,
        // Where the card physically stood — the results scene moves it from there.
        slot: verdict.slotIndex,
      },
      support: [],
      enacted: verdict.instance,
      refreshed: [],
      lobbyRefilled: [],
    };
    // The sitting's number and its journal group — the client's «played once» key and the protocol's key.
    p.summary.seq = ++this.parliament.phaseSeq;
    const rootId = this.rootId ?? this.game.events.captureContext()?.rootId;
    if (rootId !== undefined) {
      p.summary.correlationId = rootId;
    }
    this.game.log('Resolution ${0} wins the vote with ${1} delegate(s)', (b) => b.resolution(definition.id).number(verdict.votes));
    if (verdict.tieBreak === 'slot-priority') {
      this.game.log('Tie among resolutions: ${0} stands closer to the ENACTED slot', (b) => b.resolution(definition.id));
    }
    if (verdict.player === 'NEUTRAL') {
      this.game.log('The neutral player wins ${0}', (b) => b.resolution(definition.id));
    } else {
      const player = this.game.getPlayerById(verdict.player);
      this.game.log('${0} is the winning player of ${1}', (b) => b.player(player).resolution(definition.id));
      if (verdict.playerTieBreak === 'earlier-delegate') {
        this.game.log('Tie among players: ${0} placed a delegate earlier', (b) => b.player(player));
      }
    }
  }

  // ───────────────────────── step 1b: the winner's Agenda ─────────────────────────

  private stepAgenda(): void {
    const p = this.progress;
    const winner = this.summary.winner.player;
    if (winner === undefined || winner === 'NEUTRAL') {
      return;
    }
    const key = `agenda:${p.generation}`;
    if (this.seatApplied(winner, key, `agenda:${p.generation}:${winner}`)) {
      return;
    }
    const player = this.game.getPlayerById(winner);
    const events = this.game.events;
    events.beginAction(player, {kind: 'parliament'}, {category: 'political-phase'});
    try {
      // The winner's ONE step — the same walk a card takes for N (TR04); the summary keeps its one-step shape.
      const walk = ChairmanSeat.walkAgenda(player, this.parliament, 1, {reason: 'phase'});
      if (walk !== undefined) {
        const last = walk.steps[walk.steps.length - 1];
        // …with THE TABLE'S ANSWER to the step (the ruling Greens' 2 M€ for its rating — measured by the walk): the
        // console's ПОВЕСТКА tells it a beat after the step's chip, the record attached to the step (never the reaction
        // chain's second story at the rail's edge).
        this.summary.agenda = {
          player: player.id, from: walk.from, to: walk.to, bonus: last.bonus,
          ...(last.answer === undefined ? {} : {answer: copyStandardMoves(last.answer)}),
        };
      }
    } finally {
      events.endScope();
    }
    this.markSeatApplied(winner, key);
  }

  // ───────────────────────── step 2: popular support ─────────────────────────

  private stepSupport(): void {
    const p = this.progress;
    const key = `support:${p.generation}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    const present = new Set<ReduxParty>(parliament.partiesInVotingArea());
    const enactedParty = parliament.enactedDefinition()?.party;
    if (enactedParty !== undefined) {
      present.add(enactedParty);
    }
    // 2a — every party represented neither in the voting area nor in ENACTED.
    for (const party of REDUX_PARTIES) {
      if (!present.has(party)) {
        this.grantSupport(party, 1, 'absent');
      }
    }
    // 2b — each of the two resolutions that did NOT win: +1 for its party, +1
    // more when a player (not only the neutral player) voted for it.
    for (const slot of parliament.slots) {
      if (slot.instance === this.summary.winner.instance) {
        continue;
      }
      const party = parliament.resolutionOf(slot.instance).party;
      const withPlayerVote = slot.votes.some((vote) => vote.owner !== 'NEUTRAL');
      this.grantSupport(party, withPlayerVote ? 2 : 1, withPlayerVote ? 'lost-with-player-vote' : 'lost');
    }
    this.markApplied(key);
  }

  private grantSupport(party: ReduxParty, count: number, reason: 'absent' | 'lost' | 'lost-with-player-vote'): void {
    const gained = this.parliament.addPopularSupport(party, count);
    const total = this.parliament.popularSupportOf(party);
    this.summary.support.push({party, gained, total, reason});
    if (gained > 0) {
      this.game.log('${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})', (b) =>
        b.partyName(party).number(gained).number(total).number(PARLIAMENT_MAX_POPULAR_SUPPORT));
    } else if (total >= PARLIAMENT_MAX_POPULAR_SUPPORT) {
      this.game.log('${0} Popular Support is full — the neutral delegate is discarded', (b) => b.partyName(party));
    }
  }

  // ───────────────────────── step 3: enactment ─────────────────────────

  private stepEnact(): void {
    const p = this.progress;
    const instance = this.summary.winner.instance;
    const key = `enact:${p.generation}:${instance}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    const slot = parliament.slotByInstance(instance);
    if (slot === undefined) {
      throw new Error(`Winning resolution ${instance} is not in the voting area`);
    }
    // Delegates leave the card (players' → their reserve, neutral → the
    // supply): both are DERIVED, so emptying the list is the whole move. The
    // summary keeps WHO went home (per owner) so the client can play the
    // return from the card to each reserve as a physical move.
    this.summary.returned = ownersOf(slot.votes);
    slot.votes = [];
    const previous = parliament.enacted;
    // The party in power BEFORE this card — the starting rule's Greens when nothing was enacted yet.
    const previousRuling = parliament.rulingParty();
    if (previous !== undefined) {
      parliament.discard.push(previous);
      this.summary.discardedEnacted = previous;
      this.game.log('Resolution ${0} leaves the ENACTED slot', (b) => b.resolution(parliament.resolutionOf(previous).id));
    }
    parliament.enacted = instance;
    // The slot itself stays (empty) until the refresh step deals into it; in
    // the final phase it simply stays empty.
    parliament.slots = parliament.slots.filter((s) => s !== slot);
    const definition = parliament.resolutionOf(instance);
    this.game.log('Resolution ${0} is enacted', (b) => b.resolution(definition.id));
    this.game.log('${0} is now the ruling party — every player has its effect', (b) => b.partyName(definition.party));
    this.fireRulingPartyChanged(definition.party, previousRuling);
    this.fireResolutionWon(instance, definition.id, definition.party);
    if (!p.final) {
      parliament.setQuestFromEnacted(p.generation + 1);
      this.game.log('Chairman quest for generation ${0}: ${1}', (b) => b.number(p.generation + 1).string(definition.text.quest));
    }
    this.markApplied(key);
  }

  /**
   * THE CARDS ANSWER A CHANGE OF POWER (`ICard.onRulingPartyChanged` — TR62
   * Tharsis Alliance): every participant of the party effects has every card
   * of its tableau carrying the hook called ONCE, in generation order, under
   * the card's own effect scope (the journal, the notifications and the stats
   * read the card as the source). Inside the step's own `enact:` key, so a
   * reload mid-sitting never calls it twice; MarsBot (outside the aspect) is
   * never asked. The hook decides what a change means to it — the same party
   * enacted twice in a row cannot happen (the refresh never deals the enacted
   * party's card), but the hook is told both parties and judges for itself.
   */
  private fireRulingPartyChanged(next: ReduxParty, previous: ReduxParty): void {
    for (const player of this.parliament.participants(this.game, 'party-effects')) {
      for (const card of player.tableau) {
        if (card.onRulingPartyChanged === undefined) {
          continue;
        }
        // The answer is MEASURED around the hook (the rating, the hand, the standard stock) — the summary's record the
        // client presents at the enactment's tail, never a client re-derivation of what the card did.
        const before = rulingAnswerProbe(player);
        this.game.events.withEffect(player, card, 'ruling-party-changed', () => card.onRulingPartyChanged?.(player, next, previous));
        const answer = rulingAnswerOf(player, card.name, next, before);
        if (answer !== undefined) {
          (this.summary.rulingAnswers ??= []).push(answer);
        }
      }
    }
  }

  /**
   * THE WINNER'S CARDS ANSWER THE WIN (`ICard.onResolutionWon` — Septem Tribus:redux). The winning PLAYER only —
   * never the neutral player, never a seat outside the party effects (MarsBot) — every card of their tableau
   * carrying the hook, ONCE, under the card's own effect scope; inside the step's own `enact:` key, so a reload
   * mid-sitting never calls it twice. A banner cube the hook places is MEASURED into the summary (a banner grant
   * that was not there before) — the client's «куб на знамя» beat reads that record, never a re-derivation.
   */
  private fireResolutionWon(instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty): void {
    const winnerId = this.summary.winner.player;
    if (winnerId === undefined || winnerId === 'NEUTRAL') {
      return;
    }
    const player = this.game.getPlayerById(winnerId);
    if (!this.parliament.participates(player, 'party-effects')) {
      return;
    }
    for (const card of player.tableau) {
      if (card.onResolutionWon === undefined) {
        continue;
      }
      const before = new Set((this.parliament.grantedEffects.get(player.id) ?? []).map((g) => `${g.party}|${g.source}`));
      this.game.events.withEffect(player, card, 'resolution-won', () => card.onResolutionWon?.(player, {instance, resolution, party}));
      for (const grant of this.parliament.grantedEffects.get(player.id) ?? []) {
        if (!before.has(`${grant.party}|${grant.source}`) && isBannerCubeSource(grant.source)) {
          (this.summary.bannerCubes ??= []).push({player: player.id, party: grant.party, card: card.name});
        }
      }
    }
  }

  // ───────────────────────── step 3b: the enacted resolution's effects ─────────────────────────

  private stepEffects(): 'waiting' | 'done' {
    const p = this.progress;
    const cursor = p.effects ?? (p.effects = {playerIndex: 0});
    const parliament = this.parliament;
    const instance = this.summary.winner.instance;
    const definition = parliament.resolutionOf(instance);
    const winnerId = this.summary.winner.player;
    const winner = winnerId === undefined || winnerId === 'NEUTRAL' ? undefined : this.game.getPlayerById(winnerId);
    // THE SEAT LOOP IS THE PAYOUT'S: every seat a law PAYS is walked — the
    // humans through the law's own steps, a MarsBot under `'politics'`
    // through ITS adapter (decision D16, `botPayoutSteps`: the levy, then
    // every scaled part by its own counts, converted to M€). A MarsBot WINNER's
    // part is not a seat step at all but the bot's own primitives, paid by a
    // separate pass after the world's (`BotWinnerReward`).
    //
    // …EXCEPT THE DEEDS A LAW GRANTS THE SEATS (decision D11 — `seatGrantsOf`:
    // the tile of `tileGrant`, the step of the Career of `agendaGrant`): a
    // definition that declares one walks every seat of the aspect
    // `seat-grant` — the enactment's seats plus a MarsBot under `'politics'`
    // — in generation order, so the bot stands in ITS PLACE in «clockwise from
    // the first player» (a first-player bot places / walks first). A seat the
    // law pays walks its whole plan; a seat it does not (the bot) walks the
    // deeds alone, each by the bot's own primitive, never a prompt. ONE seat
    // loop for every deed; every other card walks exactly the seats it always
    // did.
    const deeds = seatGrantsOf(definition);
    const players = parliament.participants(this.game, deeds.length === 0 ? 'payout' : 'seat-grant');
    const winnerEnacts = winner !== undefined && parliament.participates(winner, 'enactment');
    const winnerSteps = definition.winnerSteps ?? [];
    const worldSteps = definition.worldSteps ?? [];
    if (!hasImmediateSteps(definition) && worldSteps.length === 0 && winnerSteps.length === 0) {
      // Nothing to walk: a passive or an action works from the ENACTED slot.
      return 'done';
    }
    // THE WALK, IN THE CARD'S OWN ORDER. Every seat's own part first; then
    // what the enactment does to the TABLE (once, for nobody); then the
    // winner's. A world step must not run per seat — «reduce oxygen 1 step»
    // inside the seat loop would lower it once per player.
    //
    // WHERE THE WINNER'S PART GOES. Historically it is walked INLINE with its
    // seat (the winner picks its payout and is sent straight to the board,
    // while the seats after it wait) — the shipped grammar of Aquifer /
    // Biodome / Colony Contest, and nothing about a world part changes it. But
    // an enactment that MOVES THE WORLD must have moved it before the winner
    // puts a tile on that world: so a definition that declares `worldSteps`
    // defers its winner part past them. The card's own declaration decides,
    // and a card with no world part walks exactly as it always did.
    const deferWinner = worldSteps.length > 0;
    //
    // EVERY pass is walked from the first entry each time: the idempotency
    // keys make a finished step a no-op, and a resumed save whose seat order
    // moved (a clone with another first player) can never skip one. The index
    // stays a progress marker only.
    for (let index = 0; index < players.length; index++) {
      cursor.playerIndex = index;
      const player = players[index];
      if (!parliament.participates(player, 'enactment')) {
        // A seat that does not RUN the law's own steps (MarsBot): its payout through its adapter (D16) — the
        // levy, then every scaled part — and then each deed by its own primitive, in the printed order; after
        // each, the deferred tail it set off (a human card answering the bot's city) runs, and may wait, before
        // the next deed or the next seat.
        if (parliament.participates(player, 'payout')) {
          for (const step of botPayoutSteps(definition)) {
            if (this.runSeatStep(definition, instance, player, winner, step, 'effect') === 'waiting' || this.drainDeferred() === 'waiting') {
              return 'waiting';
            }
          }
        }
        for (const deed of deeds) {
          this.runBotSeatGrant(definition, instance, player, winner, deed);
          if (this.drainDeferred() === 'waiting') {
            return 'waiting';
          }
        }
        continue;
      }
      // THE SEAT'S OWN STEPS — the static list, or the definition's per-player
      // PLAN (one step per colony tile the seat has a cube on): re-derived on
      // every entry from the same table, so a reload finds the same keys.
      const plan: Array<{step: EnactStep, part: Exclude<EnactOutcomePart, 'world'>}> = [
        ...immediateStepsOf(definition, player, parliament, this.game).map((step) => ({step, part: 'effect' as const})),
        ...(!deferWinner && winner !== undefined && winner.id === player.id ? winnerSteps.map((step) => ({step, part: 'winner' as const})) : []),
      ];
      for (const {step, part} of plan) {
        if (this.runSeatStep(definition, instance, player, winner, step, part) === 'waiting') {
          return 'waiting';
        }
        // A MUTATING step's deferred TAIL runs — and may wait — BEFORE the next step is walked, exactly as
        // an asking step's tail is drained before the answer's `continue` goes on: the 0 °C ocean the
        // winner's temperature step sets off (Mohole Contest) is the WINNER's placement, made while the
        // seats after it wait — never a question that surfaces once everybody else has been paid.
        if (this.drainDeferred() === 'waiting') {
          return 'waiting';
        }
      }
    }
    for (const step of worldSteps) {
      if (this.runWorldStep(definition, instance, winner, step) === 'waiting' || this.drainDeferred() === 'waiting') {
        return 'waiting';
      }
    }
    if (deferWinner && winner !== undefined && winnerEnacts) {
      for (const step of winnerSteps) {
        if (this.runSeatStep(definition, instance, winner, winner, step, 'winner') === 'waiting' || this.drainDeferred() === 'waiting') {
          return 'waiting';
        }
      }
    }
    // THE BOT WINNER'S PASS — a winner outside the enactment (MarsBot under
    // `'politics'`) is paid its winner's part HERE, after the world's, by its
    // own primitives (`BotWinnerReward`): the order «world → winner» holds, and
    // the seat loop above never saw it.
    if (winner !== undefined && !winnerEnacts && parliament.participates(winner, 'winner-reward')) {
      if (this.runBotWinnerPass(definition, instance, winner) === 'waiting') {
        return 'waiting';
      }
    }
    return 'done';
  }

  /**
   * THE WINNER'S PART FOR A MARSBOT WINNER (docs/TURMOIL_REDUX_MARSBOT.md §4):
   * ONE executor by the card's DECLARATION (`winnerReward` / `tileGrant`),
   * never a seat step — the bot receives no prompt, so the human's step
   * (which may ask) is never run for it. The record wears the card's own
   * step key and part (`botWinnerRewardPlan`), the idempotency key lives
   * under the bot's seat exactly as a human winner's would, the scope is the
   * resolution's with the bot as owner — so a reload inside the sitting pays
   * nothing twice and the results read the bot's reward as one more seat's.
   * A card whose winner's part the bot cannot execute is a NAMED skip here
   * and a red guard in `tests/parliament/BotWinnerReward.spec.ts`.
   */
  private runBotWinnerPass(definition: ResolutionDefinition, instance: ResolutionInstanceId, bot: IPlayer): 'waiting' | 'done' {
    // A tile grant is never this pass's: the seat loop paid it to every recipient, the winner included (D11).
    if (!declaresWinnerPass(definition)) {
      return 'done';
    }
    const p = this.progress;
    const plan = botWinnerRewardPlan(definition) ?? {kind: undefined, key: definition.winnerSteps?.[0]?.key ?? 'winner', part: 'winner' as const};
    const key = `effect:${p.generation}:${instance}:${plan.key}`;
    if (this.seatApplied(bot.id, key, `effect:${p.generation}:${instance}:${bot.id}:${plan.key}`)) {
      return 'done';
    }
    const events = this.game.events;
    events.beginAction(bot, {kind: 'resolution', id: definition.id, owner: bot.color}, {category: 'political-phase'});
    try {
      if (plan.kind === undefined) {
        this.game.log('${0} has no way to take the winner\'s reward of ${1} — it is skipped', (b) => b.player(bot).resolution(definition.id));
        this.recordOutcome(bot, plan.key, plan.part, {kind: 'skipped', reason: NO_BOT_EXECUTOR_REASON});
      } else {
        payBotWinnerReward(this.game, bot, definition, {kind: plan.kind, key: plan.key, part: plan.part},
          (outcome) => this.recordOutcome(bot, plan.key, plan.part, outcome));
      }
      this.markSeatApplied(bot.id, key);
    } finally {
      events.endScope();
    }
    // The primitive's deferred tail (a human card reacting to the bot's tile) runs — and may wait — before the walk goes on.
    return this.drainDeferred() === 'waiting' ? 'waiting' : 'done';
  }

  /**
   * A DEED A LAW GRANTS THE SEATS, FOR A SEAT THE LAW DOES NOT PAY (MarsBot
   * under `'politics'` — decision D11): ONE executor per deed by its
   * declaration, never a prompt — the TILE by `payBotTileGrant` (the same
   * recipients rule as a human's step, the bot's own placement rule, no Failed
   * Action), the STEP OF THE CAREER by `payAgendaGrant` (the human's own payer:
   * the track's one walk with the cause `resolution`, the bot's card step 1 M€).
   * The record wears the deed's step key and the effect's part, the
   * idempotency key lives under the bot's seat exactly as a human's step's
   * does, the scope is the resolution's with the bot as owner — a reload inside
   * the sitting performs nothing twice, and the results read the bot's deed as
   * one more seat's.
   */
  private runBotSeatGrant(
    definition: ResolutionDefinition,
    instance: ResolutionInstanceId,
    bot: IPlayer,
    winner: IPlayer | undefined,
    deed: SeatGrantDeed,
  ): void {
    const p = this.progress;
    const stepKey = deed.key;
    const key = `effect:${p.generation}:${instance}:${stepKey}`;
    if (this.seatApplied(bot.id, key, `effect:${p.generation}:${instance}:${bot.id}:${stepKey}`)) {
      return;
    }
    const events = this.game.events;
    const report = (outcome: EnactOutcome) => this.recordOutcome(bot, stepKey, 'effect', outcome);
    events.beginAction(bot, {kind: 'resolution', id: definition.id, owner: bot.color}, {category: 'political-phase'});
    try {
      switch (deed.kind) {
      case 'tile':
        payBotTileGrant(this.game, bot, definition, deed.grant, winner, report);
        break;
      case 'agenda':
        payAgendaGrant(bot, this.parliament, definition.id, deed.grant, {winner, influence: this.parliament.influence(bot)}, report);
        break;
      }
      this.markSeatApplied(bot.id, key);
    } finally {
      events.endScope();
    }
  }

  /**
   * THE INFLUENCE A LAW READ, AND WHAT IT WAS MADE OF — snapshotted ONCE per seat per sitting, at the seat's first
   * step (every step of one enactment reads the same number: the winner's Career step has already moved, nothing
   * of the influence changes inside the phase). The results' breakdown prints it («влияние 2 = Карьера 1 +
   * Колониальное представительство +1») and must never read the LIVE sources: a card played after the sitting
   * would rewrite what the law read. Read-only — the composition is the same function `influence` adds up.
   */
  private noteInfluenceRead(player: IPlayer): void {
    const summary = this.progress.summary;
    if (summary === undefined || summary.influenceRead?.some((entry) => entry.player === player.id)) {
      return;
    }
    const composition = this.parliament.influenceComposition(player);
    (summary.influenceRead ??= []).push({player: player.id, ...composition});
  }

  /**
   * ONE STEP OF ONE SEAT (the seat's own part, or the winner's). Returns
   * `waiting` when the step ASKED — the caller stops the walk there.
   */
  private runSeatStep(
    definition: ResolutionDefinition,
    instance: ResolutionInstanceId,
    player: IPlayer,
    winner: IPlayer | undefined,
    step: EnactStep,
    part: Exclude<EnactOutcomePart, 'world'>,
  ): 'waiting' | 'done' {
    const p = this.progress;
    const cursor = p.effects ?? (p.effects = {playerIndex: 0});
    const key = `effect:${p.generation}:${instance}:${step.key}`;
    if (this.seatApplied(player.id, key, `effect:${p.generation}:${instance}:${player.id}:${step.key}`)) {
      return 'done';
    }
    const state = (p.effectState ??= {})[player.id] ??= {};
    const influence = this.parliament.influence(player);
    this.noteInfluenceRead(player);
    const ctx: EnactContext = {
      game: this.game,
      parliament: this.parliament,
      player,
      winner,
      influence,
      source: {kind: 'resolution', id: definition.id, owner: player.color},
      state,
      report: (outcome) => this.recordOutcome(player, step.key, part, outcome),
    };
    const events = this.game.events;
    // THE REACTION WINDOW opens with the step: the ruling party's answers
    // to what the step changes are read off the recorder from here on
    // (`readReactions`) and folded under the step's own record. A step
    // RE-ENTERED (a reload inside its question) keeps the window it opened —
    // the progress resumes exactly as it was saved.
    if (cursor.scan?.player !== player.id || cursor.scan.key !== step.key) {
      cursor.scan = {player: player.id, key: step.key, part, sinceEvent: events.sequence};
    }
    events.beginAction(player, ctx.source, {category: 'political-phase'});
    try {
      const prompt = step.run(ctx);
      if (prompt === undefined) {
        this.markSeatApplied(player.id, key);
        this.readReactions();
        return 'done';
      }
      // AN ASK: the step changed nothing; its prompt's answer will. The
      // prompt is set INSIDE the scope so the answer's mutations keep the
      // resolution's chain, and the game is saved so a reload rebuilds
      // exactly this question.
      cursor.pending = {player: player.id, key: step.key};
      player.setWaitingFor(prompt, () => {
        this.markSeatApplied(player.id, key);
        cursor.pending = undefined;
        this.readReactions();
        this.continue();
      });
    } finally {
      events.endScope();
    }
    this.game.save();
    return 'waiting';
  }

  /**
   * ONE WORLD STEP — the enactment's own change to the table, run ONCE per
   * enactment (its key lives in `applied`, not in any seat's list) and
   * attributed to NOBODY: the scope carries the resolution with no owner, the
   * record carries no player, and the step is handed the first player in
   * generation order purely as the engine's handle (the World Government's own
   * precedent — `worldStepHandle`, which is also the seat a world step that
   * ASKS is answered by). No reaction window: the ruling party answers what
   * happens to a PLAYER, and nothing here happens to one.
   */
  private runWorldStep(
    definition: ResolutionDefinition,
    instance: ResolutionInstanceId,
    winner: IPlayer | undefined,
    step: EnactStep,
  ): 'waiting' | 'done' {
    const p = this.progress;
    const key = `world:${p.generation}:${instance}:${step.key}`;
    if (this.applied(key)) {
      return 'done';
    }
    const handle = worldStepHandle(this.game);
    const state = (p.worldState ??= {});
    const ctx: EnactContext = {
      game: this.game,
      parliament: this.parliament,
      player: handle,
      winner,
      influence: 0,
      // NO `owner`: the law did this, not the handle it was given.
      source: {kind: 'resolution', id: definition.id},
      state,
      report: (outcome) => this.recordWorldOutcome(step.key, outcome),
    };
    const events = this.game.events;
    events.beginAction(undefined, ctx.source, {category: 'political-phase'});
    try {
      const prompt = step.run(ctx);
      if (prompt === undefined) {
        this.markApplied(key);
        return 'done';
      }
      // A world step that ASKS (Water Export: «the First Player removes 1
      // ocean tile») is answered by the HANDLE seat — the executor the printed
      // rule names by position; the mark lands on the phase's own list all
      // the same (one answer for the table). The ask is PUBLISHED as the
      // phase's pending question (`effects.pending`, the seat step's own
      // door), so every other seat reads the honest wait («blue is choosing a
      // cell») and the executor's own sitting reads a step of the sitting —
      // never an ask from nowhere. The game is saved so a reload rebuilds
      // exactly this question for exactly this seat.
      const cursor = p.effects ?? (p.effects = {playerIndex: 0});
      cursor.pending = {player: handle.id, key: step.key};
      handle.setWaitingFor(prompt, () => {
        this.markApplied(key);
        cursor.pending = undefined;
        this.continue();
      });
    } finally {
      events.endScope();
    }
    this.game.save();
    return 'waiting';
  }

  /**
   * A step's RECORD of what it did, stamped with the player and the step. One
   * record per (player, step): a step that reports twice (a defensive
   * re-run) keeps the first — the outcome is what happened, not a counter.
   * (The ruling party's `reaction` under the same step is a record of its
   * own, never the step's.)
   */
  private recordOutcome(player: IPlayer, stepKey: string, part: EnactOutcomePart, outcome: EnactOutcome): void {
    const summary = this.parliament.phase?.summary;
    if (summary === undefined) {
      return;
    }
    const outcomes = (summary.outcomes ??= []);
    if (outcomes.some((o) => o.kind !== 'reaction' && o.player === player.id && o.step === stepKey)) {
      return;
    }
    outcomes.push({player: player.id, step: stepKey, part, ...outcome});
  }

  /**
   * A WORLD STEP'S RECORD — the same ledger, with NO seat: the planet moved,
   * and it moved for everybody. One record per step key (a defensive re-run
   * keeps the first), so a reload can never write the change down twice.
   */
  private recordWorldOutcome(stepKey: string, outcome: EnactOutcome): void {
    const summary = this.parliament.phase?.summary;
    if (summary === undefined) {
      return;
    }
    const outcomes = (summary.outcomes ??= []);
    if (outcomes.some((o) => o.player === undefined && o.step === stepKey)) {
      return;
    }
    outcomes.push({step: stepKey, part: 'world', ...outcome});
  }

  /**
   * THE RULING PARTY'S ANSWERS, read off the recorder (decision Q6). Inside a
   * step's window (`effects.scan`) every `party`-sourced production / supply
   * change of the step's player is the party's own hook answering what the
   * step did — the Greens' M€ production for a heat-production raise, their
   * M€ for the TR of a placed ocean — and any reaction a later party
   * declares rides the same funnel: nothing is re-stated by a resolution.
   * Each is folded into ONE `reaction` record per (party, trigger, resource)
   * under the step, the window moves past what was read — a deferred tail
   * read later adds to the same record, nothing is counted twice — and a
   * reload continues the window (event ids persist with the save).
   */
  private readReactions(): void {
    const scan = this.progress.effects?.scan;
    const summary = this.parliament.phase?.summary;
    if (scan === undefined || summary === undefined) {
      return;
    }
    const color = this.game.getPlayerById(scan.player).color;
    const markers = new Map<number, EventTrigger | undefined>();
    // The window moves past what was FOLDED, not past what was seen: a
    // resumed save's re-issued prompt emits its own marker, and the progress
    // must serialize the same before and after such a resume.
    let last = scan.sinceEvent;
    for (const e of this.game.events.events) {
      if (e.id <= scan.sinceEvent) {
        continue;
      }
      const source = e.source;
      if (source?.kind !== 'party') {
        continue;
      }
      if (e.type === 'effect-triggered') {
        markers.set(e.id, e.trigger);
        continue;
      }
      if ((e.type !== 'production-changed' && e.type !== 'resource-changed') || e.player !== color) {
        continue;
      }
      const production = e.type === 'production-changed';
      const units = production ? e.impact.production : e.impact.stock;
      const trigger = e.parentId === undefined ? undefined : markers.get(e.parentId);
      const snapshot = e.impact.snapshot;
      for (const [name, amount] of Object.entries(units ?? {})) {
        if (amount === undefined || amount === 0) {
          continue;
        }
        const resource = name as Resource;
        last = Math.max(last, e.id);
        const outcomes = (summary.outcomes ??= []);
        const existing = outcomes.find((o) => o.kind === 'reaction' && o.player === scan.player && o.step === scan.key &&
          o.party === source.name && o.trigger === trigger && (production ? o.production === resource : o.stock === resource));
        if (existing === undefined) {
          const record: SerializedEnactOutcome = {player: scan.player, step: scan.key, part: scan.part, kind: 'reaction', party: source.name, amount};
          if (trigger !== undefined) {
            record.trigger = trigger;
          }
          if (production) {
            record.production = resource;
          } else {
            record.stock = resource;
          }
          if (snapshot !== undefined) {
            record.before = snapshot.before;
            record.after = snapshot.after;
          }
          outcomes.push(record);
        } else {
          existing.amount = (existing.amount ?? 0) + amount;
          if (snapshot !== undefined) {
            existing.after = snapshot.after;
          }
        }
      }
    }
    scan.sinceEvent = last;
  }

  // ───────────────────────── step 5: refresh the voting area ─────────────────────────

  private stepRefresh(): void {
    const p = this.progress;
    const key = `refresh:${p.generation}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    // THE RENEWAL JOURNAL: every physical event, in the order it happens. The
    // client's renewal beat plays it and nothing else (the flat lists below
    // are derived — they cannot say the order, the reshuffle, the rejects nor
    // whose delegates came home off a loser).
    const journal = (this.summary.renewal ??= []);
    // The two losers leave; their delegates go home (derived — the record is
    // what lets the client fly them, per owner, BEFORE the card goes). The
    // slot recorded is the PHYSICAL one the card stood in as voted (the
    // winner's own slot is already out of the array).
    const winnerSlot = this.summary.winner.slot;
    this.summary.discarded = parliament.slots.map((slot) => slot.instance);
    parliament.slots.forEach((slot, index) => {
      const definition = parliament.resolutionOf(slot.instance);
      const returned = ownersOf(slot.votes);
      journal.push({
        kind: 'leave', instance: slot.instance,
        slot: winnerSlot !== undefined && index >= winnerSlot ? index + 1 : index,
        returned,
      });
      parliament.discard.push(slot.instance);
      this.game.log('Resolution ${0} leaves the voting area', (b) => b.resolution(definition.id));
      this.fireDelegatesDiscarded(slot.instance, definition.id, returned, journal);
    });
    parliament.slots = [];
    // Deal three fresh resolutions, closest slot first; no party may repeat a
    // party already in the area or the enacted party.
    for (let i = 0; i < PARLIAMENT_VOTING_SLOTS; i++) {
      const dealt = this.dealSlot(i, journal);
      if (dealt === undefined) {
        journal.push({kind: 'empty', slot: i});
        this.game.log('The resolution deck has no card for voting slot ${0}', (b) => b.number(i + 1));
        continue;
      }
      const {instance, source} = dealt;
      const slot: Slot = {instance, votes: []};
      parliament.slots.push(slot);
      const definition = parliament.resolutionOf(instance);
      journal.push({kind: 'deal', instance, slot: i, source});
      this.game.log('Resolution ${0} enters the voting area', (b) => b.resolution(definition.id));
      // Popular Support of the card's party becomes immediate votes.
      const moved = parliament.moveSupportToSlot(definition.party, slot);
      this.summary.refreshed.push({instance, neutralVotes: moved});
      if (moved > 0) {
        journal.push({kind: 'support', party: definition.party, instance, count: moved});
        this.game.log('${0} neutral delegate(s) from ${1} Popular Support vote for ${2}', (b) =>
          b.number(moved).partyName(definition.party).resolution(definition.id));
      }
    }
    this.markApplied(key);
  }

  /**
   * THE CARDS ANSWER A LOSER'S LEAVE (`ICard.onDelegatesDiscarded` — TR02
   * Political Science): for every PLAYER whose delegates just went home off
   * this UNENACTED resolution, every card of that player's tableau carrying
   * the hook is called once with the count, under the card's own effect scope
   * (the journal, the notifications and the stats read the card as the
   * source). Neutral delegates belong to nobody and fire nothing. The phase
   * measures what the hook did to the card's resources and journals the
   * DELTA as a `card-effect` event right after the `leave` — the hook may
   * belong to any card with any resource, and a hook that changed nothing
   * writes nothing. Idempotent with the step: it runs inside the
   * `refresh:<generation>` key, so a reload mid-sitting never collects twice.
   */
  private fireDelegatesDiscarded(
    instance: ResolutionInstanceId, resolution: ResolutionId,
    returned: ReadonlyArray<{owner: SerializedDelegateOwner; count: number}>, journal: Array<SerializedRenewalEvent>,
  ): void {
    for (const entry of returned) {
      if (entry.owner === 'NEUTRAL' || entry.count <= 0) {
        continue;
      }
      const player = this.game.getPlayerById(entry.owner);
      for (const card of player.tableau) {
        if (card.onDelegatesDiscarded === undefined) {
          continue;
        }
        const before = card.resourceCount;
        this.game.events.withEffect(player, card, 'delegates-discarded', () =>
          card.onDelegatesDiscarded?.(player, entry.count, {instance, resolution}));
        const delta = card.resourceCount - before;
        if (delta > 0 && card.resourceType !== undefined) {
          journal.push({kind: 'card-effect', player: player.id, card: card.name, resource: card.resourceType, count: delta, instance});
        }
      }
    }
  }

  /**
   * ONE slot's deal, journalled as it happens: the reshuffle (the deck ran
   * out — the discard becomes the deck, possibly mid-deal), every card
   * revealed and rejected (with WHY: its party is in the area, or it is the
   * enacted party's), and where the dealt card came from (the deck as it
   * was, or the reshuffled one).
   */
  private dealSlot(slotIndex: number, journal: Array<SerializedRenewalEvent>): {instance: ResolutionInstanceId, source: 'deck' | 'reshuffled'} | undefined {
    const parliament = this.parliament;
    const inArea = new Set<ReduxParty>(parliament.partiesInVotingArea());
    const enactedParty = parliament.enactedDefinition()?.party;
    const excluded = new Set<ReduxParty>(inArea);
    if (enactedParty !== undefined) {
      excluded.add(enactedParty);
    }
    let reshuffled = journal.some((event) => event.kind === 'reshuffle');
    // `drawDistinct` is private to the ledger; the phase reaches it through
    // the deal helper (same rules: rejected → discard, empty deck →
    // reshuffled discard, nothing fits → undefined) and journals what it sees.
    const instance = parliament.dealForVotingArea(this.game.rng, Array.from(excluded), {
      onReshuffle: (size) => {
        reshuffled = true;
        journal.push({kind: 'reshuffle', size});
        this.game.log('The resolution deck is empty: the discard pile is reshuffled into a new deck of ${0}', (b) => b.number(size));
      },
      onReject: (rejected) => {
        const party = parliament.resolutionOf(rejected).party;
        // The enacted party's card is refused for that reason first — the area may hold no card of it either way.
        const reason = party === enactedParty ? 'party-enacted' : 'party-in-area';
        journal.push({kind: 'reject', instance: rejected, slot: slotIndex, reason});
        this.game.log('Resolution ${0} is revealed and discarded: its party is already represented', (b) =>
          b.resolution(parliament.resolutionOf(rejected).id));
      },
    });
    return instance === undefined ? undefined : {instance, source: reshuffled ? 'reshuffled' : 'deck'};
  }

  // ───────────────────────── step 5b: the lobby ─────────────────────────

  private stepLobby(): void {
    const p = this.progress;
    const key = `lobby:${p.generation}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    // The lobby step is the renewal's last movement: it joins the same journal, in seat order.
    const journal = (this.summary.renewal ??= []);
    for (const player of parliament.participants(this.game, 'delegates')) {
      if (!parliament.lobby.has(player.id) && parliament.reserve(player) > 0) {
        parliament.lobby.add(player.id);
        this.summary.lobbyRefilled.push(player.id);
        journal.push({kind: 'lobby', player: player.id});
      }
    }
    parliament.resetGenerationUses();
    this.game.log('Every player\'s free delegate returns to the lobby');
    this.markApplied(key);
  }

  // ───────────────────────── done ─────────────────────────

  /**
   * Close the sitting: the summary becomes `lastPhase` and joins the history,
   * the RECORD of the seats still to close it is written and each of them is
   * asked its confirmation (`SittingAcks`). The ordinary sitting returns at
   * once — the caller reports the end OUTSIDE the sitting's journal context
   * and the next generation begins while the seats read; the FINAL one waits
   * (`undefined`): its last confirmation moves the game to the final
   * greeneries.
   */
  private finish(): {final: boolean} | undefined {
    const p = this.progress;
    const summary = p.summary;
    this.parliament.lastPhase = summary;
    if (summary !== undefined) {
      this.parliament.recordPhase(summary);
    }
    const final = p.final;
    const closedEarly = p.closedEarly ?? [];
    this.parliament.phase = undefined;
    this.parliament.announceAccessChanges(this.game);
    this.parliament.assertLedger(this.game);
    // The early closes still standing go: the record is written now, and a seat that closed early owes it nothing.
    SittingAcks.withdrawEarly(this.game);
    const owed = SittingAcks.open(this.game, this.parliament, summary, final, closedEarly);
    SittingAcks.issuePending(this.game);
    this.game.save();
    return owed && final ? undefined : {final};
  }
}

/** The delegates of a card grouped by OWNER, in first-placement order — who goes home, and how many, when the card leaves. */
function ownersOf(votes: ReadonlyArray<Vote>): Array<{owner: SerializedDelegateOwner; count: number}> {
  const returned: Array<{owner: SerializedDelegateOwner; count: number}> = [];
  for (const vote of votes) {
    const entry = returned.find((r) => r.owner === vote.owner);
    if (entry === undefined) {
      returned.push({owner: vote.owner, count: 1});
    } else {
      entry.count++;
    }
  }
  return returned;
}

/** The steps up to (and including) the effects — a seat's part of the law can still be ahead only there. */
const STEPS_BEFORE_THE_EFFECTS_END: ReadonlySet<string> = new Set(['winner', 'assembly', 'agenda', 'support', 'enact', 'effects']);

/** Neutral or player — the shape the summary carries. */
export type PhaseWinnerOwner = PartyName | 'NEUTRAL';

/** What a seat stands at before a card answers a change of power — the rating, the hand, the standard stock, the production. */
type RulingAnswerProbe = {tr: number, hand: number, moves: StandardMovesProbe};

function rulingAnswerProbe(player: IPlayer): RulingAnswerProbe {
  return {tr: player.terraformRating, hand: player.cardsInHand.length, moves: probeStandardMoves(player)};
}

/** The card's answer as MEASURED around its hook — undefined when it changed nothing the record carries. */
function rulingAnswerOf(player: IPlayer, card: CardName, party: ReduxParty, before: RulingAnswerProbe): SerializedRulingAnswer | undefined {
  const tr = player.terraformRating - before.tr;
  const cards = player.cardsInHand.length - before.hand;
  // The standard stock and production — the ONE measure the Career's step answers are read by too (`standardMoves.ts`).
  const moves = standardMovesSince(player, before.moves);
  if (tr === 0 && cards === 0 && moves === undefined) {
    return undefined;
  }
  return {
    player: player.id, card, party,
    ...(tr === 0 ? {} : {tr}),
    ...(cards === 0 ? {} : {cards}),
    ...moves,
  };
}

/** Exposed for tests: the players a resolution's immediate effect visits, in order. */
export function effectRecipients(game: IGame, parliament: Parliament): Array<IPlayer> {
  return parliament.participants(game, 'payout');
}
