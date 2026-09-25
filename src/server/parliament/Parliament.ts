/*
 * THE MARS PARLIAMENT — Turmoil Redux game state and its pure rules.
 *
 * ONE authoritative delegate ledger: the votes on the three voting-area slots
 * (each an ordered list of `{owner, seq}`), the chairman's seat and the lobby
 * set. Everything else about delegates is DERIVED from those — a player's
 * reserve is `7 − votes − chairman − lobby`, the neutral supply is
 * `14 − neutral votes − popular support`. There is no second list that could
 * disagree with the first.
 *
 * This class holds state and rules only. Prompts, payments, logging and event
 * scopes live in `ParliamentHandler` (in-turn) and `ParliamentPhase` (the
 * end-of-generation driver).
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {PartyName} from '../../common/turmoil/PartyName';
import {
  AGENDA_TRACK, AgendaStep, BotParliamentMode, influenceAtAgenda, PARLIAMENT_AGENDA_STEPS, PARLIAMENT_DELEGATES_PER_PLAYER,
  PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_NEUTRAL_DELEGATES, PARLIAMENT_VOTE_COST, PARLIAMENT_VOTING_SLOTS, PARTY_ACTION_OWNER,
  PARTY_EFFECT_DELEGATES, PartyActionId, QuestDefinition, ReduxParty, REDUX_PARTIES, ResolutionId, ResolutionInstanceId, STARTER_QUEST,
} from '../../common/parliament/ParliamentTypes';
import {ResolutionDefinition} from './resolutions/IResolution';
import {REDUX_RESOLUTION_CATALOG, RETIRED_RESOLUTION_IDS, ResolutionCatalog} from './resolutions/ResolutionCatalog';
import {
  PARLIAMENT_PHASE_HISTORY_CAP, PARLIAMENT_SAVE_VERSION, SerializedAdvance, SerializedParliament, SerializedPendingAction,
  SerializedPhaseProgress, SerializedPhaseSummary, SerializedQuest, SerializedSlot,
} from './SerializedParliament';
import {IncompatibleParliamentSaveError} from './ParliamentErrors';
import {BotParliamentPolicy, botParliamentPolicy} from './BotParliamentPolicy';
import {Random} from '../../common/utils/Random';
import {Expansion} from '../../common/cards/GameModule';

export type Delegate = PlayerId | 'NEUTRAL';
export type Vote = {owner: Delegate; seq: number};
export type Slot = {instance: ResolutionInstanceId; votes: Array<Vote>};

/**
 * What a load needs from the game it loads into. Only an OLDER save that
 * carried retired resolutions uses it (`rebuildAfterRetirement`): the deal's
 * expansion filter and the game's seeded RNG.
 */
export type ParliamentLoadTable = {
  expansions: Readonly<Record<Expansion, boolean>>;
  rng: Random;
};

export type QuestState = {
  definition: QuestDefinition;
  source: 'starter' | ResolutionId;
  generation: number;
  progress: Map<PlayerId, number>;
  completedBy?: PlayerId;
};

/** Who leads a resolution right now (rulebook p.8): most delegates, ties to the EARLIER first delegate. */
export type Leader = {
  owner: Delegate;
  votes: number;
  tieBreak?: 'earlier-delegate';
};

export type WinnerVerdict = {
  slotIndex: number;
  instance: ResolutionInstanceId;
  votes: number;
  /** Another slot had as many votes; this one won by standing closer to ENACTED. */
  tieBreak?: 'slot-priority';
  /** The winning player, or the neutral player when no player delegate stands on the card. */
  player: Delegate;
  playerTieBreak?: 'earlier-delegate';
};

/** Every reason a player holds a party's effect — each one stands on its own. */
export type PartyAccess = {
  party: ReduxParty;
  ruling: boolean;
  delegates: number;
  byDelegates: boolean;
  granted: ReadonlyArray<string>;
  hasEffect: boolean;
  satisfiesRequirement: boolean;
};

export type VoteAvailability =
  | {ok: true; source: 'lobby' | 'reserve'; cost: number}
  /** `source` names the path that WOULD apply (reserve when only the money is missing). */
  | {ok: false; reason: string; source: 'lobby' | 'reserve' | 'none'; cost: number};

export type AgendaAdvance = {from: number; to: number; bonus?: 'tr' | 'card'};

/** What a deal for the voting area reports as it happens (the refresh journal's source). */
export type DealObserver = {
  /**
   * The deck ran out: the discard of `size` cards becomes the deck. A card
   * rejected earlier in the SAME draw is held aside and is not among them (it
   * could only be rejected again) — it joins the discard once the draw ends.
   */
  onReshuffle?: (size: number) => void;
  /** A card was revealed and does not fit — it goes to the discard, the next is drawn. */
  onReject?: (instance: ResolutionInstanceId) => void;
};

export class Parliament {
  public readonly catalog: ResolutionCatalog;
  public readonly policy: BotParliamentPolicy;
  public slots: Array<Slot> = [];
  public enacted: ResolutionInstanceId | undefined = undefined;
  public quest: QuestState | undefined = undefined;
  public chairman: PlayerId | undefined = undefined;
  public lobby = new Set<PlayerId>();
  public voteSeq = 0;
  public popularSupport = new Map<ReduxParty, number>();
  public agenda = new Map<PlayerId, number>();
  /**
   * INFLUENCE BEYOND THE AGENDA TRACK, per player — the twin of
   * `grantedEffects`: a LIST of entries, each with the source that gave it,
   * so the Information zone can name what a number is made of instead of
   * asking the player to take it on faith. An entry with no source is a
   * nameless bonus (an older save, or a caller that does not name itself).
   */
  public influenceBonus = new Map<PlayerId, Array<{amount: number; source?: string}>>();
  public grantedEffects = new Map<PlayerId, Array<{party: ReduxParty; source: string}>>();
  public partyActionUses = new Map<PlayerId, Map<ReduxParty, number>>();
  public resolutionActionUses = new Map<PlayerId, number>();
  public deck: Array<ResolutionInstanceId> = [];
  public discard: Array<ResolutionInstanceId> = [];
  public phase: SerializedPhaseProgress | undefined = undefined;
  public lastPhase: SerializedPhaseSummary | undefined = undefined;
  /** Sittings numbered so far — `SerializedPhaseSummary.seq` is monotonic across the game. */
  public phaseSeq = 0;
  /** The finished sittings, oldest first, at most `PARLIAMENT_PHASE_HISTORY_CAP` (the protocol's source). */
  public phaseHistory: Array<SerializedPhaseSummary> = [];
  /** The last Agenda advance (mid-generation quest or the phase) — the client presents it once by `seq`. */
  public lastAdvance: SerializedAdvance | undefined = undefined;
  public pendingActions: Array<SerializedPendingAction> = [];

  constructor(botMode: BotParliamentMode = 'none', catalog: ResolutionCatalog = REDUX_RESOLUTION_CATALOG) {
    this.catalog = catalog;
    this.policy = botParliamentPolicy(botMode);
  }

  public get botMode(): BotParliamentMode {
    return this.policy.mode;
  }

  // ───────────────────────── setup ─────────────────────────

  public static newInstance(game: IGame): Parliament {
    const parliament = new Parliament('none');
    parliament.deck = shuffle(parliament.catalog.dealtInstances(compatibleWith(game.gameOptions.expansions)), game.rng);
    // Setup: three resolutions of DIFFERENT parties in the voting area (the
    // Greens are allowed at setup — rulebook FAQ p.17).
    for (let i = 0; i < PARLIAMENT_VOTING_SLOTS; i++) {
      const instance = parliament.drawDistinct(game.rng, parliament.slots.map((slot) => parliament.resolutionOf(slot.instance).party));
      if (instance !== undefined) {
        parliament.slots.push({instance, votes: []});
      }
    }
    for (const player of game.players) {
      if (parliament.participates(player)) {
        parliament.lobby.add(player.id);
      }
    }
    // The printed quest of the empty ENACTED slot (generation 1 only).
    parliament.quest = {definition: STARTER_QUEST, source: 'starter', generation: 1, progress: new Map()};
    return parliament;
  }

  /** Deal one resolution for the voting area during the refresh step (rulebook p.11–12). */
  public dealForVotingArea(rng: Random, excludedParties: ReadonlyArray<ReduxParty>, observer?: DealObserver): ResolutionInstanceId | undefined {
    return this.drawDistinct(rng, excludedParties, observer);
  }

  /**
   * Draw the next resolution whose party is not in `excludedParties`; rejected
   * cards go to the discard, an empty deck is refilled from the shuffled
   * discard (rulebook p.11–12). `undefined` when no such card exists anywhere
   * — the slot then stays empty rather than looping.
   *
   * The `observer` sees every PHYSICAL event in the order it happens (the
   * refresh step journals them): the discard turning into the deck, a card
   * revealed and rejected. A rejected card is held aside until the draw ends
   * and only then joins the discard — physically it lies on the discard from
   * the moment it is rejected, but a reshuffle mid-draw must not deal it
   * again (it cannot fit), which is what bounds the loop by `budget`.
   */
  private drawDistinct(rng: Random, excludedParties: ReadonlyArray<ReduxParty>, observer?: DealObserver): ResolutionInstanceId | undefined {
    const excluded = new Set<ReduxParty>(excludedParties);
    const budget = this.deck.length + this.discard.length;
    const rejected: Array<ResolutionInstanceId> = [];
    for (let attempts = 0; attempts < budget; attempts++) {
      if (this.deck.length === 0) {
        if (this.discard.length === 0) {
          break;
        }
        observer?.onReshuffle?.(this.discard.length);
        this.deck = shuffle(this.discard, rng);
        this.discard = [];
      }
      const candidate = this.deck.shift();
      if (candidate === undefined) {
        break;
      }
      if (excluded.has(this.resolutionOf(candidate).party)) {
        rejected.push(candidate);
        observer?.onReject?.(candidate);
        continue;
      }
      this.discard.push(...rejected);
      return candidate;
    }
    // Nothing fits: every rejected card goes back to the discard.
    this.discard.push(...rejected);
    return undefined;
  }

  // ───────────────────────── participation ─────────────────────────

  public participates(player: IPlayer): boolean {
    return this.policy.participates(player);
  }

  /** The seats that take part, in generation order. */
  public participants(game: IGame): Array<IPlayer> {
    return game.playersInGenerationOrder.filter((player) => this.participates(player));
  }

  // ───────────────────────── catalog lookups ─────────────────────────

  public resolutionOf(instance: ResolutionInstanceId): ResolutionDefinition {
    return this.catalog.ofInstance(instance);
  }

  public enactedDefinition(): ResolutionDefinition | undefined {
    return this.enacted === undefined ? undefined : this.resolutionOf(this.enacted);
  }

  public enactedInstanceOrThrow(): ResolutionInstanceId {
    if (this.enacted === undefined) {
      throw new Error('No resolution is enacted');
    }
    return this.enacted;
  }

  /** The party whose effect EVERY participant holds: the enacted card's party, the Greens while the slot is empty (rulebook p.8). */
  public rulingParty(): ReduxParty {
    return this.enactedDefinition()?.party ?? PartyName.GREENS;
  }

  public slotOf(party: ReduxParty): Slot | undefined {
    return this.slots.find((slot) => this.resolutionOf(slot.instance).party === party);
  }

  public slotIndexOf(instance: ResolutionInstanceId): number {
    return this.slots.findIndex((slot) => slot.instance === instance);
  }

  public slotByInstance(instance: ResolutionInstanceId): Slot | undefined {
    return this.slots.find((slot) => slot.instance === instance);
  }

  public partiesInVotingArea(): Array<ReduxParty> {
    return this.slots.map((slot) => this.resolutionOf(slot.instance).party);
  }

  // ───────────────────────── the delegate ledger (derived) ─────────────────────────

  public votesOf(player: IPlayer | PlayerId, slot?: Slot): number {
    const id = typeof player === 'string' ? player : player.id;
    const slots = slot === undefined ? this.slots : [slot];
    let count = 0;
    for (const s of slots) {
      for (const vote of s.votes) {
        if (vote.owner === id) {
          count++;
        }
      }
    }
    return count;
  }

  public neutralVotes(slot?: Slot): number {
    const slots = slot === undefined ? this.slots : [slot];
    let count = 0;
    for (const s of slots) {
      count += s.votes.filter((vote) => vote.owner === 'NEUTRAL').length;
    }
    return count;
  }

  /** Delegates of `player` still in their personal supply. */
  public reserve(player: IPlayer): number {
    if (!this.participates(player)) {
      return 0;
    }
    return PARLIAMENT_DELEGATES_PER_PLAYER -
      this.votesOf(player) -
      (this.chairman === player.id ? 1 : 0) -
      (this.lobby.has(player.id) ? 1 : 0);
  }

  public totalPopularSupport(): number {
    let total = 0;
    for (const value of this.popularSupport.values()) {
      total += value;
    }
    return total;
  }

  /** Neutral delegates still in the common supply. */
  public neutralSupply(): number {
    return PARLIAMENT_NEUTRAL_DELEGATES - this.neutralVotes() - this.totalPopularSupport();
  }

  /** The ledger invariant: every player's seven delegates are accounted for exactly once. Throws when broken. */
  public assertLedger(game: IGame): void {
    for (const player of this.participants(game)) {
      const reserve = this.reserve(player);
      if (reserve < 0 || reserve > PARLIAMENT_DELEGATES_PER_PLAYER) {
        throw new Error(`Delegate ledger broken for ${player.id}: reserve ${reserve}`);
      }
    }
    if (this.neutralSupply() < 0) {
      throw new Error(`Neutral delegate supply broken: ${this.neutralSupply()}`);
    }
  }

  // ───────────────────────── leaders and the winner ─────────────────────────

  public leaderOf(slot: Slot): Leader | undefined {
    if (slot.votes.length === 0) {
      return undefined;
    }
    const counts = new Map<Delegate, {votes: number; firstSeq: number}>();
    for (const vote of slot.votes) {
      const entry = counts.get(vote.owner);
      if (entry === undefined) {
        counts.set(vote.owner, {votes: 1, firstSeq: vote.seq});
      } else {
        entry.votes++;
      }
    }
    let best: {owner: Delegate; votes: number; firstSeq: number} | undefined;
    let tied = false;
    for (const [owner, entry] of counts) {
      if (owner === 'NEUTRAL') {
        continue;
      }
      if (best === undefined || entry.votes > best.votes) {
        best = {owner, ...entry};
        tied = false;
      } else if (entry.votes === best.votes) {
        tied = true;
        if (entry.firstSeq < best.firstSeq) {
          best = {owner, ...entry};
        }
      }
    }
    if (best === undefined) {
      // Only neutral delegates stand on the card.
      const neutral = counts.get('NEUTRAL');
      return neutral === undefined ? undefined : {owner: 'NEUTRAL', votes: neutral.votes};
    }
    return tied ? {owner: best.owner, votes: best.votes, tieBreak: 'earlier-delegate'} : {owner: best.owner, votes: best.votes};
  }

  /** The resolution that would be enacted now, and who wins it (rulebook p.8, p.10). */
  public winner(): WinnerVerdict | undefined {
    if (this.slots.length === 0) {
      return undefined;
    }
    let bestIndex = 0;
    let tied = false;
    for (let i = 1; i < this.slots.length; i++) {
      const votes = this.slots[i].votes.length;
      const bestVotes = this.slots[bestIndex].votes.length;
      if (votes > bestVotes) {
        bestIndex = i;
        tied = false;
      } else if (votes === bestVotes) {
        tied = true;
      }
    }
    const slot = this.slots[bestIndex];
    const leader = this.leaderOf(slot);
    const verdict: WinnerVerdict = {
      slotIndex: bestIndex,
      instance: slot.instance,
      votes: slot.votes.length,
      player: leader?.owner ?? 'NEUTRAL',
    };
    if (tied) {
      verdict.tieBreak = 'slot-priority';
    }
    if (leader?.tieBreak !== undefined) {
      verdict.playerTieBreak = leader.tieBreak;
    }
    return verdict;
  }

  // ───────────────────────── access ─────────────────────────

  public access(player: IPlayer, party: ReduxParty): PartyAccess {
    const participates = this.participates(player);
    const ruling = participates && this.rulingParty() === party;
    const slot = this.slotOf(party);
    const delegates = participates && slot !== undefined ? this.votesOf(player, slot) : 0;
    const byDelegates = delegates >= PARTY_EFFECT_DELEGATES;
    const granted = participates ?
      (this.grantedEffects.get(player.id) ?? []).filter((grant) => grant.party === party).map((grant) => grant.source) :
      [];
    return {
      party,
      ruling,
      delegates,
      byDelegates,
      granted,
      hasEffect: ruling || byDelegates || granted.length > 0,
      // A card-granted effect never satisfies a card REQUIREMENT (rulebook FAQ p.19).
      satisfiesRequirement: ruling || byDelegates,
    };
  }

  public hasPartyEffect(player: IPlayer, party: PartyName): boolean {
    return isReduxPartyName(party) && this.access(player, party).hasEffect;
  }

  public satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean {
    return isReduxPartyName(party) && this.access(player, party).satisfiesRequirement;
  }

  public grantPartyEffect(player: IPlayer, party: ReduxParty, source: string): void {
    const grants = this.grantedEffects.get(player.id) ?? [];
    if (!grants.some((grant) => grant.party === party && grant.source === source)) {
      grants.push({party, source});
    }
    this.grantedEffects.set(player.id, grants);
  }

  public revokePartyEffect(player: IPlayer, party: ReduxParty, source: string): void {
    const grants = (this.grantedEffects.get(player.id) ?? []).filter((grant) => !(grant.party === party && grant.source === source));
    this.grantedEffects.set(player.id, grants);
  }

  public isChairman(player: IPlayer): boolean {
    return this.chairman === player.id;
  }

  // ───────────────────────── influence ─────────────────────────

  public agendaOf(player: IPlayer | PlayerId): number {
    return this.agenda.get(typeof player === 'string' ? player : player.id) ?? 0;
  }

  public influence(player: IPlayer): number {
    if (!this.participates(player)) {
      return 0;
    }
    let influence = influenceAtAgenda(this.agendaOf(player)) + this.influenceBonusOf(player);
    for (const card of player.tableau) {
      influence += card.getInfluenceBonus?.(player) ?? 0;
    }
    return influence;
  }

  /** The SUM of a player's influence beyond the track (what the rule adds up). */
  public influenceBonusOf(player: IPlayer | PlayerId): number {
    const id = typeof player === 'string' ? player : player.id;
    return (this.influenceBonus.get(id) ?? []).reduce((sum, entry) => sum + entry.amount, 0);
  }

  /** …and WHAT it is made of, in the order it was given (an entry keeps the name of whoever gave it). */
  public influenceSourcesOf(player: IPlayer | PlayerId): ReadonlyArray<{amount: number; source?: string}> {
    return this.influenceBonus.get(typeof player === 'string' ? player : player.id) ?? [];
  }

  /**
   * `source` is the giver's NAME (a card's, a colony's) — optional, because the
   * shared `PoliticalOps.addInfluenceBonus` is classic Turmoil's too and that
   * engine keeps no sources. A nameless entry still counts; it just reads as
   * «прочее» where the sources are listed.
   */
  public addInfluenceBonus(player: IPlayer, bonus: number = 1, source?: string): void {
    const entries = this.influenceBonus.get(player.id) ?? [];
    entries.push(source === undefined ? {amount: bonus} : {amount: bonus, source});
    this.influenceBonus.set(player.id, entries);
  }

  /** Move the player's Agenda marker one step (if any is left) and report the step's bonus. */
  public advanceAgenda(player: IPlayer): AgendaAdvance | undefined {
    const from = this.agendaOf(player);
    if (from >= PARLIAMENT_AGENDA_STEPS) {
      return undefined;
    }
    const to = from + 1;
    this.agenda.set(player.id, to);
    const step: AgendaStep = AGENDA_TRACK[to - 1];
    return {from, to, bonus: step.kind === 'influence' ? undefined : step.kind};
  }

  // ───────────────────────── uses ─────────────────────────

  public partyActionUsesOf(player: IPlayer, party: ReduxParty): number {
    return this.partyActionUses.get(player.id)?.get(party) ?? 0;
  }

  public partyActionUsesLeft(player: IPlayer, party: ReduxParty): number {
    return Math.max(0, PARTY_ACTION_USES_PER_GENERATION - this.partyActionUsesOf(player, party));
  }

  public recordPartyActionUse(player: IPlayer, party: ReduxParty): void {
    const uses = this.partyActionUses.get(player.id) ?? new Map<ReduxParty, number>();
    uses.set(party, (uses.get(party) ?? 0) + 1);
    this.partyActionUses.set(player.id, uses);
  }

  public resolutionActionUsesOf(player: IPlayer): number {
    return this.resolutionActionUses.get(player.id) ?? 0;
  }

  /**
   * The uses of the ENACTED resolution's action the seat has left this
   * generation — 0 when no enacted law has an action (the party action's
   * `partyActionUsesLeft`, for the law). The limit is the action's own
   * declaration (`usesPerGeneration`), reset at the generation boundary.
   */
  public resolutionActionUsesLeft(player: IPlayer): number {
    const action = this.enactedDefinition()?.action;
    if (action === undefined) {
      return 0;
    }
    return Math.max(0, action.usesPerGeneration(player) - this.resolutionActionUsesOf(player));
  }

  public recordResolutionActionUse(player: IPlayer): void {
    this.resolutionActionUses.set(player.id, this.resolutionActionUsesOf(player) + 1);
  }

  /** Generation boundary: every action use is available again. Access is NOT touched — it is always live. */
  public resetGenerationUses(): void {
    this.partyActionUses.clear();
    this.resolutionActionUses.clear();
  }

  public partyOfAction(actionId: PartyActionId): ReduxParty {
    return PARTY_ACTION_OWNER[actionId];
  }

  // ───────────────────────── voting ─────────────────────────

  public canVote(player: IPlayer): VoteAvailability {
    if (!this.participates(player)) {
      return {ok: false, reason: 'MarsBot takes no part in the parliament', source: 'none', cost: 0};
    }
    if (this.slots.length === 0) {
      return {ok: false, reason: 'No resolution is up for a vote', source: 'none', cost: 0};
    }
    if (this.lobby.has(player.id)) {
      return {ok: true, source: 'lobby', cost: 0};
    }
    if (this.reserve(player) <= 0) {
      return {ok: false, reason: 'All your delegates are in play', source: 'none', cost: PARLIAMENT_VOTE_COST};
    }
    if (!player.canAfford(PARLIAMENT_VOTE_COST)) {
      return {ok: false, reason: 'Not enough M€ to send a delegate from the reserve', source: 'reserve', cost: PARLIAMENT_VOTE_COST};
    }
    return {ok: true, source: 'reserve', cost: PARLIAMENT_VOTE_COST};
  }

  /**
   * THE LEDGER MUTATION of a vote — the delegate leaves the lobby or the
   * reserve and joins the card's ordered vote list. Payment and logging are
   * the handler's; this only moves the cube.
   */
  public placeVote(player: IPlayer, slot: Slot, source: 'lobby' | 'reserve'): Vote {
    if (source === 'lobby') {
      if (!this.lobby.has(player.id)) {
        throw new Error(`${player.id} has no delegate in the lobby`);
      }
      this.lobby.delete(player.id);
    } else if (this.reserve(player) <= 0) {
      throw new Error(`${player.id} has no delegate in reserve`);
    }
    const vote: Vote = {owner: player.id, seq: ++this.voteSeq};
    slot.votes.push(vote);
    player.totalDelegatesPlaced++;
    return vote;
  }

  public addNeutralVote(slot: Slot): Vote | undefined {
    if (this.neutralSupply() <= 0) {
      return undefined;
    }
    const vote: Vote = {owner: 'NEUTRAL', seq: ++this.voteSeq};
    slot.votes.push(vote);
    return vote;
  }

  /** Remove the player's LATEST delegate from `slot` (keeps their earliest — the tie-breaker). */
  public removeLatestVote(player: IPlayer, slot: Slot): Vote | undefined {
    for (let i = slot.votes.length - 1; i >= 0; i--) {
      if (slot.votes[i].owner === player.id) {
        return slot.votes.splice(i, 1)[0];
      }
    }
    return undefined;
  }

  // ───────────────────────── popular support ─────────────────────────

  public popularSupportOf(party: ReduxParty): number {
    return this.popularSupport.get(party) ?? 0;
  }

  /** Add up to `n` neutral delegates to a party's support area (cap 3, supply permitting). Returns how many landed. */
  public addPopularSupport(party: ReduxParty, n: number): number {
    let gained = 0;
    for (let i = 0; i < n; i++) {
      if (this.popularSupportOf(party) >= PARLIAMENT_MAX_POPULAR_SUPPORT || this.neutralSupply() <= 0) {
        break;
      }
      this.popularSupport.set(party, this.popularSupportOf(party) + 1);
      gained++;
    }
    return gained;
  }

  /** Move every neutral delegate of a party's support area onto `slot` as votes (rulebook p.12). */
  public moveSupportToSlot(party: ReduxParty, slot: Slot): number {
    const count = this.popularSupportOf(party);
    this.popularSupport.set(party, 0);
    for (let i = 0; i < count; i++) {
      slot.votes.push({owner: 'NEUTRAL', seq: ++this.voteSeq});
    }
    return count;
  }

  // ───────────────────────── the chairman quest ─────────────────────────

  public questProgressOf(player: IPlayer | PlayerId): number {
    const id = typeof player === 'string' ? player : player.id;
    return this.quest?.progress.get(id) ?? 0;
  }

  /**
   * Count `amount` toward the current quest. Returns 'completed' exactly once
   * per generation (the first player to reach the count); 'ignored' when there
   * is no open quest.
   */
  public addQuestProgress(player: IPlayer, amount: number): 'progress' | 'completed' | 'ignored' {
    const quest = this.quest;
    if (quest === undefined || quest.completedBy !== undefined || amount <= 0) {
      return 'ignored';
    }
    const progress = Math.min(quest.definition.count, this.questProgressOf(player) + amount);
    quest.progress.set(player.id, progress);
    if (progress >= quest.definition.count) {
      quest.completedBy = player.id;
      return 'completed';
    }
    return 'progress';
  }

  /** The quest of the coming generation: the enacted resolution's own. */
  public setQuestFromEnacted(generation: number): void {
    const definition = this.enactedDefinition();
    if (definition === undefined) {
      return;
    }
    this.quest = {definition: definition.quest, source: definition.id, generation, progress: new Map()};
  }

  /** A finished sitting joins the history; the oldest leaves past the cap (`automa.turnHistory`'s own rule). */
  public recordPhase(summary: SerializedPhaseSummary): void {
    this.phaseHistory.push(summary);
    if (this.phaseHistory.length > PARLIAMENT_PHASE_HISTORY_CAP) {
      this.phaseHistory.splice(0, this.phaseHistory.length - PARLIAMENT_PHASE_HISTORY_CAP);
    }
  }

  // ───────────────────────── serialization ─────────────────────────

  public serialize(): SerializedParliament {
    const quest: SerializedQuest | undefined = this.quest === undefined ? undefined : {
      definition: this.quest.definition,
      source: this.quest.source,
      generation: this.quest.generation,
      progress: Object.fromEntries(this.quest.progress),
      completedBy: this.quest.completedBy,
    };
    const partyActionUses: Record<PlayerId, Partial<Record<PartyName, number>>> = {};
    for (const [player, uses] of this.partyActionUses) {
      partyActionUses[player] = Object.fromEntries(uses);
    }
    const result: SerializedParliament = {
      version: PARLIAMENT_SAVE_VERSION,
      slots: this.slots.map((slot): SerializedSlot => ({instance: slot.instance, votes: slot.votes.map((vote) => ({...vote}))})),
      enacted: this.enacted,
      quest,
      chairman: this.chairman,
      lobby: Array.from(this.lobby),
      voteSeq: this.voteSeq,
      popularSupport: Object.fromEntries(this.popularSupport),
      agenda: Object.fromEntries(this.agenda),
      influenceBonus: Object.fromEntries(Array.from(this.influenceBonus, ([player, entries]) => [player, entries.map((entry) => ({...entry}))])),
      grantedEffects: Object.fromEntries(Array.from(this.grantedEffects, ([player, grants]) => [player, grants.map((grant) => ({...grant}))])),
      partyActionUses,
      resolutionActionUses: Object.fromEntries(this.resolutionActionUses),
      deck: [...this.deck],
      discard: [...this.discard],
      phase: this.phase === undefined ? undefined : JSON.parse(JSON.stringify(this.phase)),
      lastPhase: this.lastPhase === undefined ? undefined : JSON.parse(JSON.stringify(this.lastPhase)),
      phaseSeq: this.phaseSeq,
      phaseHistory: this.phaseHistory.length === 0 ? undefined : JSON.parse(JSON.stringify(this.phaseHistory)),
      lastAdvance: this.lastAdvance === undefined ? undefined : {...this.lastAdvance},
      pendingActions: this.pendingActions.length > 0 ? this.pendingActions.map((action) => ({...action})) : undefined,
      botMode: this.botMode,
    };
    return result;
  }

  public static deserialize(d: SerializedParliament, table: ParliamentLoadTable, catalog: ResolutionCatalog = REDUX_RESOLUTION_CATALOG): Parliament {
    if (d.version > PARLIAMENT_SAVE_VERSION) {
      throw new IncompatibleParliamentSaveError(`save version ${d.version} is newer than the supported ${PARLIAMENT_SAVE_VERSION}`);
    }
    const parliament = new Parliament(d.botMode, catalog);
    const known = (instance: ResolutionInstanceId): ResolutionInstanceId => {
      if (catalog.get(resolutionIdOfInstance(instance)) === undefined) {
        throw new IncompatibleParliamentSaveError(`unknown resolution ${instance}`);
      }
      return instance;
    };
    // THE RETIRED IDS ARE STRIPPED, NEVER REJECTED (`RETIRED_RESOLUTION_IDS` —
    // iteration 0's dummies). An older save loads without them: they leave
    // the deck and the discard, a voting slot holding one is gone (its
    // delegates are simply home again — the reserve is derived), an enacted
    // one leaves the ENACTED slot empty (the Greens rule, as at the start),
    // the chairman quest it posted ends with it, and a recap that names one is
    // not shown — then the table is dealt back to full
    // (`rebuildAfterRetirement`). The one thing that cannot be rebuilt is a
    // political phase caught IN PROGRESS around such a card — that save fails
    // explicitly.
    const retired = (instance: ResolutionInstanceId | undefined): boolean =>
      instance !== undefined && RETIRED_RESOLUTION_IDS.has(resolutionIdOfInstance(instance));
    const carriedRetired = retired(d.enacted) || d.slots.some((slot) => retired(slot.instance)) ||
      (d.deck ?? []).some((instance) => retired(instance)) || (d.discard ?? []).some((instance) => retired(instance));
    if (d.phase !== undefined &&
        (retired(d.enacted) || d.slots.some((slot) => retired(slot.instance)) || summaryNamesAny(d.phase.summary, retired))) {
      throw new IncompatibleParliamentSaveError('a political phase in progress around a retired resolution');
    }
    parliament.slots = d.slots
      .filter((slot) => !retired(slot.instance))
      .map((slot) => ({instance: known(slot.instance), votes: slot.votes.map((vote) => ({owner: vote.owner, seq: vote.seq}))}));
    parliament.enacted = d.enacted === undefined || retired(d.enacted) ? undefined : known(d.enacted);
    if (d.quest !== undefined && !(d.quest.source !== 'starter' && RETIRED_RESOLUTION_IDS.has(d.quest.source))) {
      parliament.quest = {
        definition: d.quest.definition,
        source: d.quest.source,
        generation: d.quest.generation,
        progress: playerMap(d.quest.progress),
        completedBy: d.quest.completedBy,
      };
    }
    parliament.chairman = d.chairman;
    parliament.lobby = new Set(d.lobby ?? []);
    parliament.voteSeq = d.voteSeq ?? 0;
    for (const [party, count] of Object.entries(d.popularSupport ?? {})) {
      if (isReduxPartyName(party as PartyName) && count !== undefined) {
        parliament.popularSupport.set(party as ReduxParty, count);
      }
    }
    parliament.agenda = playerMap(d.agenda);
    // BOTH SHAPES: an older save's bare sum is ONE nameless entry — exactly what it was.
    for (const [player, entry] of playerEntries(d.influenceBonus)) {
      const entries = typeof entry === 'number' ?
        (entry === 0 ? [] : [{amount: entry}]) :
        entry.map((one) => (one.source === undefined ? {amount: one.amount} : {amount: one.amount, source: one.source}));
      parliament.influenceBonus.set(player, entries);
    }
    for (const [player, grants] of playerEntries(d.grantedEffects)) {
      parliament.grantedEffects.set(player, grants.filter((grant) => isReduxPartyName(grant.party)).map((grant) => ({party: grant.party as ReduxParty, source: grant.source})));
    }
    for (const [player, uses] of playerEntries(d.partyActionUses)) {
      const map = new Map<ReduxParty, number>();
      for (const [party, count] of Object.entries(uses)) {
        if (isReduxPartyName(party as PartyName) && count !== undefined) {
          map.set(party as ReduxParty, count);
        }
      }
      parliament.partyActionUses.set(player, map);
    }
    parliament.resolutionActionUses = playerMap(d.resolutionActionUses);
    parliament.deck = (d.deck ?? []).filter((instance) => !retired(instance)).map(known);
    parliament.discard = (d.discard ?? []).filter((instance) => !retired(instance)).map(known);
    parliament.phase = d.phase;
    parliament.lastPhase = summaryNamesAny(d.lastPhase, retired) ? undefined : d.lastPhase;
    // The history: a sitting that names a retired card is dropped (as `lastPhase` is), the cap re-applied.
    parliament.phaseSeq = d.phaseSeq ?? 0;
    parliament.phaseHistory = (d.phaseHistory ?? []).filter((summary) => !summaryNamesAny(summary, retired)).slice(-PARLIAMENT_PHASE_HISTORY_CAP);
    parliament.lastAdvance = d.lastAdvance;
    parliament.pendingActions = [...(d.pendingActions ?? [])];
    if (carriedRetired) {
      parliament.rebuildAfterRetirement(table);
    }
    return parliament;
  }

  /**
   * AN OLDER SAVE, STRIPPED OF RETIRED IDS, IS DEALT BACK TO A FULL TABLE. Its
   * pool is what its own deal made — mostly retired cards, and none of the
   * resolutions shipped since — so every dealt resolution it holds nowhere is
   * shuffled into the deck, and a voting area the strip thinned is dealt back
   * up by the refresh's own rule (distinct parties, never the enacted one's).
   * Without it a save whose three slots were all retired would reach the
   * political phase with an EMPTY area. A phase in progress keeps its area —
   * its own refresh deals.
   */
  private rebuildAfterRetirement(table: ParliamentLoadTable): void {
    const held = new Set<ResolutionInstanceId>([...this.deck, ...this.discard, ...this.slots.map((slot) => slot.instance)]);
    if (this.enacted !== undefined) {
      held.add(this.enacted);
    }
    const missing = this.catalog.dealtInstances(compatibleWith(table.expansions)).filter((instance) => !held.has(instance));
    if (missing.length > 0) {
      this.deck = shuffle([...this.deck, ...missing], table.rng);
    }
    if (this.phase !== undefined) {
      return;
    }
    while (this.slots.length < PARLIAMENT_VOTING_SLOTS) {
      const excluded = this.slots.map((slot) => this.resolutionOf(slot.instance).party);
      if (this.enacted !== undefined) {
        excluded.push(this.resolutionOf(this.enacted).party);
      }
      const instance = this.drawDistinct(table.rng, excluded);
      if (instance === undefined) {
        break;
      }
      this.slots.push({instance, votes: []});
    }
  }
}

/**
 * The deal's filter: a resolution that needs an expansion is dealt only in a
 * game that has it. Exported so a spec derives «every dealt card» from the
 * SAME filter the deal used, never from the whole catalog (a Venus-only card
 * is in the catalog and in no deck of a game without Venus Next).
 */
export function compatibleWith(expansions: Readonly<Record<Expansion, boolean>>): (definition: ResolutionDefinition) => boolean {
  return (definition) => (definition.compatibility ?? []).every((expansion) => expansions[expansion] === true);
}

/** Every party action is once per generation in iteration 0 (rulebook p.3–5). */
export const PARTY_ACTION_USES_PER_GENERATION = 1;

export function isReduxPartyName(party: PartyName): party is ReduxParty {
  return (REDUX_PARTIES as ReadonlyArray<PartyName>).includes(party);
}

/** `Object.entries` over a record keyed by PlayerId (the template-literal key type is lost by `Object.entries`). */
function playerEntries<T>(record: Record<PlayerId, T> | undefined): Array<[PlayerId, T]> {
  return Object.entries(record ?? {}) as Array<[PlayerId, T]>;
}

function playerMap<T>(record: Record<PlayerId, T> | undefined): Map<PlayerId, T> {
  return new Map(playerEntries(record));
}

/** Does a phase summary name any resolution instance `matches` accepts? */
function summaryNamesAny(summary: SerializedPhaseSummary | undefined, matches: (instance: ResolutionInstanceId) => boolean): boolean {
  if (summary === undefined) {
    return false;
  }
  return matches(summary.winner.instance) || matches(summary.enacted) ||
    (summary.discardedEnacted !== undefined && matches(summary.discardedEnacted)) ||
    summary.refreshed.some((entry) => matches(entry.instance)) ||
    (summary.discarded ?? []).some((instance) => matches(instance)) ||
    (summary.renewal ?? []).some((event) => 'instance' in event && matches(event.instance));
}

function resolutionIdOfInstance(instance: ResolutionInstanceId): ResolutionId {
  const idx = instance.lastIndexOf('#');
  return idx < 0 ? instance : instance.substring(0, idx);
}

/** Fisher–Yates over the game's seeded RNG — deterministic per seed, like the decks. */
export function shuffle<T>(items: ReadonlyArray<T>, rng: Random): Array<T> {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
