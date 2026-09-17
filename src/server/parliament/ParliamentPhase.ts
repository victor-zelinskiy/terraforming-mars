/*
 * THE POLITICAL PHASE — the parliament's end-of-generation steps (rulebook
 * pp.10–12), as a RESUMABLE driver.
 *
 * Steps: winner → agenda → support → enact → effects → refresh → lobby → done.
 * Every operation has an idempotency key recorded in `phase.applied`, the
 * effects step keeps a per-player cursor and the pending step key, and the
 * whole progress is game state (`Parliament.phase`) — so a game saved while a
 * resolution asks a player something reloads INTO that question: no reward
 * is paid twice, none is lost, nothing is re-randomized (`Game.deserialize`
 * → `ParliamentPhase.resume`).
 *
 * Two modes: the ordinary end of generation (all steps) and the FINAL one
 * (project decision Q1: steps 1–3 only — the winner is enacted and its effect
 * applied, the voting area is not refreshed and the lobby not refilled; the
 * game then goes on to the final greeneries).
 *
 * The phase runs under `Phase.PARLIAMENT`: tiles get owners and bonuses,
 * global parameters pay TR (unlike `Phase.SOLAR`), and action-phase card
 * hooks stay quiet. `activePlayer` is NOT reassigned to whoever is asked — a
 * prompt goes straight to that player's `setWaitingFor`.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Phase} from '../../common/Phase';
import {PartyName} from '../../common/turmoil/PartyName';
import {PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_VOTING_SLOTS, ReduxParty, REDUX_PARTIES} from '../../common/parliament/ParliamentTypes';
import {Parliament, Slot} from './Parliament';
import {EnactContext, EnactOutcome, EnactStep} from './resolutions/IResolution';
import {SerializedDelegateOwner, SerializedPhaseProgress, SerializedPhaseSummary} from './SerializedParliament';
import {ChairmanSeat} from './quests/ChairmanSeat';

export class ParliamentPhase {
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
    game.log('The Mars Parliament convenes', (b) => b.announcement());
    new ParliamentPhase(game, parliament, onDone).continue();
  }

  /** Pick the phase up where a save left it (a reload). */
  public static resume(game: IGame, parliament: Parliament, onDone: (final: boolean) => void): void {
    if (parliament.phase === undefined) {
      throw new Error('No political phase to resume');
    }
    game.phase = Phase.PARLIAMENT;
    new ParliamentPhase(game, parliament, onDone).continue();
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

  private get summary(): SerializedPhaseSummary {
    const p = this.progress;
    if (p.summary === undefined) {
      throw new Error('The phase summary is not initialised');
    }
    return p.summary;
  }

  private continue(): void {
    if (this.game.deferredActions.length > 0) {
      this.game.deferredActions.runAll(() => this.continue());
      return;
    }
    const p = this.parliament.phase;
    if (p === undefined) {
      return;
    }
    switch (p.step) {
    case 'winner':
      this.stepWinner();
      p.step = 'agenda';
      this.continue();
      return;
    case 'agenda':
      this.stepAgenda();
      p.step = 'support';
      this.continue();
      return;
    case 'support':
      this.stepSupport();
      p.step = 'enact';
      this.continue();
      return;
    case 'enact':
      this.stepEnact();
      p.step = 'effects';
      p.effects = {playerIndex: 0};
      this.continue();
      return;
    case 'effects':
      if (this.stepEffects() === 'waiting') {
        return;
      }
      p.step = p.final ? 'done' : 'refresh';
      this.continue();
      return;
    case 'refresh':
      this.stepRefresh();
      p.step = 'lobby';
      this.continue();
      return;
    case 'lobby':
      this.stepLobby();
      p.step = 'done';
      this.continue();
      return;
    case 'done':
      this.finish();
      return;
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
    const key = `agenda:${p.generation}:${winner}`;
    if (this.applied(key)) {
      return;
    }
    const player = this.game.getPlayerById(winner);
    const events = this.game.events;
    events.beginAction(player, {kind: 'parliament'}, {category: 'political-phase'});
    try {
      const advance = ChairmanSeat.advanceAgenda(player, this.parliament, 'phase');
      if (advance !== undefined) {
        this.summary.agenda = {player: player.id, from: advance.from, to: advance.to, bonus: advance.bonus};
      }
    } finally {
      events.endScope();
    }
    this.markApplied(key);
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
    const returned: Array<{owner: SerializedDelegateOwner; count: number}> = [];
    for (const vote of slot.votes) {
      const entry = returned.find((r) => r.owner === vote.owner);
      if (entry === undefined) {
        returned.push({owner: vote.owner, count: 1});
      } else {
        entry.count++;
      }
    }
    this.summary.returned = returned;
    slot.votes = [];
    const previous = parliament.enacted;
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
    if (!p.final) {
      parliament.setQuestFromEnacted(p.generation + 1);
      this.game.log('Chairman quest for generation ${0}: ${1}', (b) => b.number(p.generation + 1).string(definition.text.quest));
    }
    this.markApplied(key);
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
    const players = parliament.participants(this.game);
    const immediate = definition.immediateSteps ?? [];
    const winnerSteps = definition.winnerSteps ?? [];
    if (immediate.length === 0 && winnerSteps.length === 0) {
      const key = `effect:${p.generation}:${instance}:none`;
      if (!this.applied(key)) {
        this.game.log('Resolution ${0} has no effect of its own', (b) => b.resolution(definition.id));
        this.markApplied(key);
      }
      return 'done';
    }
    for (; cursor.playerIndex < players.length; cursor.playerIndex++) {
      const player = players[cursor.playerIndex];
      const plan: Array<EnactStep> = [...immediate, ...(winner !== undefined && winner.id === player.id ? winnerSteps : [])];
      for (const step of plan) {
        const key = `effect:${p.generation}:${instance}:${player.id}:${step.key}`;
        if (this.applied(key)) {
          continue;
        }
        const state = (p.effectState ??= {})[player.id] ??= {};
        const ctx: EnactContext = {
          game: this.game,
          parliament,
          player,
          winner,
          influence: parliament.influence(player),
          source: {kind: 'resolution', id: definition.id, owner: player.color},
          state,
          report: (outcome) => this.recordOutcome(player, step.key, outcome),
        };
        const events = this.game.events;
        events.beginAction(player, ctx.source, {category: 'political-phase'});
        try {
          const prompt = step.run(ctx);
          if (prompt === undefined) {
            this.markApplied(key);
            continue;
          }
          // AN ASK: the step changed nothing; its prompt's answer will. The
          // prompt is set INSIDE the scope so the answer's mutations keep the
          // resolution's chain, and the game is saved so a reload rebuilds
          // exactly this question.
          cursor.pending = {player: player.id, key: step.key};
          player.setWaitingFor(prompt, () => {
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
    }
    return 'done';
  }

  /**
   * A step's RECORD of what it did, stamped with the player and the step. One
   * record per (player, step): a step that reports twice (a defensive
   * re-run) keeps the first — the outcome is what happened, not a counter.
   */
  private recordOutcome(player: IPlayer, stepKey: string, outcome: EnactOutcome): void {
    const summary = this.parliament.phase?.summary;
    if (summary === undefined) {
      return;
    }
    const outcomes = (summary.outcomes ??= []);
    if (outcomes.some((o) => o.player === player.id && o.step === stepKey)) {
      return;
    }
    outcomes.push({player: player.id, step: stepKey, ...outcome});
  }

  // ───────────────────────── step 5: refresh the voting area ─────────────────────────

  private stepRefresh(): void {
    const p = this.progress;
    const key = `refresh:${p.generation}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    // The two losers leave; their delegates go home (derived).
    for (const slot of parliament.slots) {
      const definition = parliament.resolutionOf(slot.instance);
      parliament.discard.push(slot.instance);
      this.game.log('Resolution ${0} leaves the voting area', (b) => b.resolution(definition.id));
    }
    parliament.slots = [];
    // Deal three fresh resolutions, closest slot first; no party may repeat a
    // party already in the area or the enacted party.
    for (let i = 0; i < PARLIAMENT_VOTING_SLOTS; i++) {
      const instance = this.dealSlot();
      if (instance === undefined) {
        this.game.log('The resolution deck has no card for voting slot ${0}', (b) => b.number(i + 1));
        continue;
      }
      const slot: Slot = {instance, votes: []};
      parliament.slots.push(slot);
      const definition = parliament.resolutionOf(instance);
      this.game.log('Resolution ${0} enters the voting area', (b) => b.resolution(definition.id));
      // Popular Support of the card's party becomes immediate votes.
      const moved = parliament.moveSupportToSlot(definition.party, slot);
      this.summary.refreshed.push({instance, neutralVotes: moved});
      if (moved > 0) {
        this.game.log('${0} neutral delegate(s) from ${1} Popular Support vote for ${2}', (b) =>
          b.number(moved).partyName(definition.party).resolution(definition.id));
      }
    }
    this.markApplied(key);
  }

  private dealSlot(): string | undefined {
    const parliament = this.parliament;
    const excluded = new Set<ReduxParty>(parliament.partiesInVotingArea());
    const enacted = parliament.enactedDefinition();
    if (enacted !== undefined) {
      excluded.add(enacted.party);
    }
    // `drawDistinct` is private to the ledger; the phase reaches it through
    // the deal helper below (same rules: rejected → discard, empty deck →
    // reshuffled discard, nothing fits → undefined).
    return parliament.dealForVotingArea(this.game.rng, Array.from(excluded));
  }

  // ───────────────────────── step 5b: the lobby ─────────────────────────

  private stepLobby(): void {
    const p = this.progress;
    const key = `lobby:${p.generation}`;
    if (this.applied(key)) {
      return;
    }
    const parliament = this.parliament;
    for (const player of parliament.participants(this.game)) {
      if (!parliament.lobby.has(player.id) && parliament.reserve(player) > 0) {
        parliament.lobby.add(player.id);
        this.summary.lobbyRefilled.push(player.id);
      }
    }
    parliament.resetGenerationUses();
    this.game.log('Every player\'s free delegate returns to the lobby');
    this.markApplied(key);
  }

  // ───────────────────────── done ─────────────────────────

  private finish(): void {
    const p = this.progress;
    this.parliament.lastPhase = p.summary;
    const final = p.final;
    this.parliament.phase = undefined;
    this.parliament.assertLedger(this.game);
    this.onDone(final);
  }
}

/** Neutral or player — the shape the summary carries. */
export type PhaseWinnerOwner = PartyName | 'NEUTRAL';

/** Exposed for tests: the players a resolution's immediate effect visits, in order. */
export function effectRecipients(game: IGame, parliament: Parliament): Array<IPlayer> {
  return parliament.participants(game);
}
