/*
 * THE POLITICAL PHASE — the parliament's end-of-generation steps (rulebook
 * pp.10–12), as a RESUMABLE driver.
 *
 * Steps: winner → ASSEMBLY → agenda → support → enact → effects → refresh →
 * lobby → ADJOURN → done (the final generation: … → effects → ADJOURN → done).
 * Every operation has an idempotency key recorded in `phase.applied` (a
 * per-seat one under its player in `phase.appliedBySeat`), the
 * effects step keeps a per-player cursor and the pending step key, and the
 * whole progress is game state (`Parliament.phase`) — so a game saved while a
 * resolution asks a player something reloads INTO that question: no reward
 * is paid twice, none is lost, nothing is re-randomized (`Game.deserialize`
 * → `ParliamentPhase.resume`).
 *
 * THE SITTING'S TWO GATES (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §3; the
 * first one MOVED by «Заседание v2» — docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md):
 * `assembly` stands right after the VERDICT and BEFORE anything changes —
 * every participant confirms the verdict, and only then the winner's Agenda
 * moves, the support is granted, the law is enacted and pays. Everything a
 * player sees at the gate is still the table as it was voted: the marker on
 * its old step, the winning card in its slot, the previous government. The
 * RULES are untouched — the winner's Agenda still moves strictly before the
 * support, the enactment and the rewards, in one chain of `drive()` after the
 * barrier; the gate only moves the MOMENT the players are asked. A save from
 * before this order (its `assembly` standing after the enactment) resumes
 * correctly: `agenda` / `support` / `enact` are idempotent by their keys and
 * find themselves already done. `adjourn` stands after the lobby (after the
 * effects in the final generation) — every participant confirms the
 * refreshed area, and only then the next generation begins. A gate is one `SelectOption` per participant
 * (the `parliamentPhasePrompt` marker), the barrier is the per-seat key —
 * never a counter in memory — so a clone, a reload and a doubled answer are
 * safe by construction, and a resume re-issues only to the seats without
 * the key. The phase's whole journal is ONE group (`political-phase`):
 * every step's scope, every gate's answer and every resolution's prompt
 * joins the convening's root (see `convene`).
 *
 * Two modes: the ordinary end of generation (all steps) and the FINAL one
 * (project decision Q1: the winner is enacted and its effect applied, the
 * voting area is not refreshed and the lobby not refilled; the game then goes
 * on to the final greeneries).
 *
 * The phase runs under `Phase.PARLIAMENT`: tiles get owners and bonuses,
 * global parameters pay TR (unlike `Phase.SOLAR`), and action-phase card
 * hooks stay quiet. `activePlayer` is NOT reassigned to whoever is asked — a
 * prompt (a gate's or a resolution's) goes straight to that player's
 * `setWaitingFor`.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {Color} from '../../common/Color';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import {PartyName} from '../../common/turmoil/PartyName';
import {EventTrigger} from '../../common/events/GameEvent';
import {PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_VOTING_SLOTS, ParliamentPhaseStage, ReduxParty, REDUX_PARTIES} from '../../common/parliament/ParliamentTypes';
import {CapturedEventContext} from '../events/EventRecorder';
import {SelectOption} from '../inputs/SelectOption';
import {message} from '../logs/MessageBuilder';
import {PlayerInput} from '../PlayerInput';
import {Parliament, Slot} from './Parliament';
import {EnactContext, EnactOutcome, EnactStep} from './resolutions/IResolution';
import {EnactOutcomePart, SerializedDelegateOwner, SerializedEnactOutcome, SerializedPhaseProgress, SerializedPhaseSummary} from './SerializedParliament';
import {ChairmanSeat} from './quests/ChairmanSeat';

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
   * turn); the gates and the resolution's prompts capture it, so an answer —
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
      return;
    }
    const finished = this.game.events.runWithContext(this.rootContext(), () => this.drive());
    if (finished !== undefined) {
      // Reported OUTSIDE the sitting's context: what follows (the final
      // greeneries, the next generation) is not the parliament's business.
      this.onDone(finished.final);
    }
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

  /** The step machine: every case advances the persisted step; a gate or an ask returns `undefined` (waiting); `done` returns the finish. */
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
        p.step = 'assembly';
        break;
      case 'assembly':
        // GATE 1 stands BEFORE the table changes (v2): the verdict is the only
        // fact the summary carries here; everything after it runs in ONE chain.
        if (this.stepGate('assembly') === 'waiting') {
          return undefined;
        }
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
        p.step = p.final ? 'adjourn' : 'refresh';
        break;
      case 'refresh':
        this.stepRefresh();
        p.step = 'lobby';
        break;
      case 'lobby':
        this.stepLobby();
        p.step = 'adjourn';
        break;
      case 'adjourn':
        if (this.stepGate('adjourn') === 'waiting') {
          return undefined;
        }
        p.step = 'done';
        break;
      case 'done':
        return this.finish();
      }
      // A step's own deferred work runs — and may wait — before the next step, exactly as before.
      if (this.drainDeferred() === 'waiting') {
        return undefined;
      }
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
      const advance = ChairmanSeat.advanceAgenda(player, this.parliament, 'phase');
      if (advance !== undefined) {
        this.summary.agenda = {player: player.id, from: advance.from, to: advance.to, bonus: advance.bonus};
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

  // ───────────────────────── the gates: assembly · adjourn ─────────────────────────

  /**
   * A GATE: every participant without the gate's key gets ONE prompt; the
   * answer writes the key and saves; the LAST answer moves the phase on. The
   * barrier is the per-seat keys (a clone, a reload or a doubled answer are
   * safe by construction — no counter in memory); a resume re-issues only to
   * the seats still without the key and never writes over a standing prompt.
   * `activePlayer` is untouched — the prompt goes to the seat itself.
   */
  private stepGate(stage: ParliamentPhaseStage): 'waiting' | 'done' {
    const p = this.progress;
    const pending = parliamentGatePending(this.game, this.parliament, stage);
    if (pending.length === 0) {
      return 'done';
    }
    const key = gateKey(stage, p.generation);
    for (const seat of pending) {
      const standing = seat.getWaitingFor();
      if (standing !== undefined) {
        // Already issued (a resume re-entered the gate) — or a foreign prompt
        // stands, which the engine's own flow never leaves here (the queue
        // drains, pausing on its prompts, before a gate is reached). Never
        // written over: the seat is asked when the gate is next entered —
        // every continuation of the phase re-enters it, and a seat freed by
        // its own prompt's callback comes back through `continue()`.
        if (!isGatePrompt(standing, stage, p.generation)) {
          console.warn(`[parliament] ${seat.color} holds a "${standing.type}" prompt at the ${stage} gate — the gate waits for it`);
        }
        continue;
      }
      seat.setWaitingFor(this.gatePrompt(stage), () => this.onGateAnswered(seat, stage, key));
    }
    this.game.save();
    return 'waiting';
  }

  private onGateAnswered(seat: IPlayer, stage: ParliamentPhaseStage, key: string): void {
    this.markSeatApplied(seat.id, key);
    this.game.save();
    if (parliamentGatePending(this.game, this.parliament, stage).length === 0) {
      this.continue();
    }
  }

  /** The gate's prompt — a bare confirm carrying the structural marker; the title is for the journal and a plain renderer, never for detection. */
  private gatePrompt(stage: ParliamentPhaseStage): PlayerInput {
    const p = this.progress;
    const title = stage === 'assembly' ?
      message('The Mars Parliament of generation ${0} is in session: the verdict', (b) => b.number(p.generation)) :
      message('The Mars Parliament of generation ${0} adjourns', (b) => b.number(p.generation));
    return new SelectOption(title, 'Continue')
      .markParliamentPhase({stage, generation: p.generation, final: p.final, seq: p.summary?.seq ?? 0});
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
      // Nothing to walk: a passive or an action works from the ENACTED slot.
      return 'done';
    }
    // EVERY seat is walked from the first on each entry: the per-seat keys make
    // a finished seat a no-op, and a resumed save whose seat order moved (a
    // clone with another first player) can never skip one. The index stays a
    // progress marker only.
    for (let index = 0; index < players.length; index++) {
      cursor.playerIndex = index;
      const player = players[index];
      // WHICH PART each step belongs to rides every record it makes: the
      // client tells «everyone's effect» from «the winner's part» by it,
      // never by a step key.
      const plan: Array<{step: EnactStep, part: EnactOutcomePart}> = [
        ...immediate.map((step) => ({step, part: 'effect' as const})),
        ...(winner !== undefined && winner.id === player.id ? winnerSteps.map((step) => ({step, part: 'winner' as const})) : []),
      ];
      for (const {step, part} of plan) {
        const key = `effect:${p.generation}:${instance}:${step.key}`;
        if (this.seatApplied(player.id, key, `effect:${p.generation}:${instance}:${player.id}:${step.key}`)) {
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
            continue;
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
    }
    return 'done';
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
    // The two losers leave; their delegates go home (derived). The sitting's
    // renewal beat flies them off the table, so the summary names them.
    this.summary.discarded = parliament.slots.map((slot) => slot.instance);
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

  /** Close the sitting: the summary becomes `lastPhase` and joins the history; the caller reports the end OUTSIDE the sitting's journal context. */
  private finish(): {final: boolean} {
    const p = this.progress;
    const summary = p.summary;
    this.parliament.lastPhase = summary;
    if (summary !== undefined) {
      this.parliament.recordPhase(summary);
    }
    const final = p.final;
    this.parliament.phase = undefined;
    this.parliament.assertLedger(this.game);
    return {final};
  }
}

/** The per-seat key a gate writes (`assembly:<generation>` / `adjourn:<generation>`). */
export function gateKey(stage: ParliamentPhaseStage, generation: number): string {
  return `${stage}:${generation}`;
}

/** The participants whose answer to `stage`'s gate the phase still waits for — from the save's own keys, never a counter. */
export function parliamentGatePending(game: IGame, parliament: Parliament, stage: ParliamentPhaseStage): Array<IPlayer> {
  const p = parliament.phase;
  if (p === undefined) {
    return [];
  }
  const key = gateKey(stage, p.generation);
  return parliament.participants(game).filter((seat) => !(p.appliedBySeat?.[seat.id] ?? []).includes(key));
}

/** …as colours, for the wire (the gate marker's `awaiting`, the phase model). Empty outside a political phase. */
export function parliamentGateAwaiting(game: IGame, stage: ParliamentPhaseStage): Array<Color> {
  const parliament = game.parliament;
  return parliament === undefined ? [] : parliamentGatePending(game, parliament, stage).map((seat) => seat.color);
}

/** Is `input` the gate prompt of `stage` for `generation` — by the structural marker, never the title? */
export function isGatePrompt(input: PlayerInput, stage: ParliamentPhaseStage, generation: number): boolean {
  const marker = input.parliamentPhasePrompt;
  return marker !== undefined && marker.stage === stage && marker.generation === generation;
}

/** Neutral or player — the shape the summary carries. */
export type PhaseWinnerOwner = PartyName | 'NEUTRAL';

/** Exposed for tests: the players a resolution's immediate effect visits, in order. */
export function effectRecipients(game: IGame, parliament: Parliament): Array<IPlayer> {
  return parliament.participants(game);
}
