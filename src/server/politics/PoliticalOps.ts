/*
 * POLITICAL OPERATIONS FOR CONTENT — the ONE facade cards, requirements,
 * milestones and awards call when they need politics.
 *
 * Two engines implement it: `ReduxPoliticalOps` over the Mars Parliament
 * (Turmoil Redux — the fork's engine) and `ClassicPoliticalOps`, a thin
 * adapter over the upstream `Turmoil` (kept for upstream compatibility and for
 * tests; the classic engine is not selectable in the console creator).
 * New content reads `game.politics`; `Turmoil.getTurmoil` is legacy.
 *
 * Adapting a piece of classic Turmoil content to Redux therefore means:
 * implement it through this facade, and mark its manifest entry
 * `politics: 'redux' | 'both'` (see `CardFactorySpec`) — never flip the
 * classic option on, and never widen the Redux pool by API presence alone.
 */
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {PartyName} from '../../common/turmoil/PartyName';
import {Turmoil} from '../turmoil/Turmoil';
import {normalizeReduxParty, PARTY_EFFECT_DELEGATES} from '../../common/parliament/ParliamentTypes';
import {isReduxPartyName, Parliament} from '../parliament/Parliament';

export type PoliticalDelegate = IPlayer | 'NEUTRAL';

/**
 * WHERE A PLAYER STANDS AGAINST A PARTY REQUIREMENT — the two roads of the
 * printed rule («Requires Mars First to be ruling or that you have 2 delegates
 * there»), each with its «now». The REQUIREMENT reading only: a card-granted
 * effect is not a road (rulebook FAQ p.19), so it is not here at all.
 */
export type PartyRequirementStanding = {
  /** The party as the engine reads it (Redux: Kelvinists → Greens). */
  party: PartyName;
  /** Road 1 — the party rules. */
  ruling: boolean;
  /** Road 2 — the player's own delegates on the party's resolution in the voting area… */
  delegates: number;
  /** …against the number the rule asks for. */
  required: number;
  /** The party's resolution stands in the voting area — without it road 2 is closed this generation, not «0 of 2». */
  onVote: boolean;
};

export interface PoliticalOps {
  readonly engine: 'classic' | 'redux';
  /** The engine's reading of a party name (Redux: Kelvinists → Greens). */
  normalizeParty(party: PartyName): PartyName;
  rulingParty(): PartyName;
  /** Classic: the dominant party. Redux: the party of the resolution that would win now. */
  dominantParty(): PartyName | undefined;
  /** Classic: the party leader. Redux: the leader of the party's resolution in the voting area. */
  partyLeader(party: PartyName): PoliticalDelegate | undefined;
  chairman(): PoliticalDelegate | undefined;
  isChairman(player: IPlayer): boolean;
  influence(player: IPlayer): number;
  /**
   * `source` is the giver's NAME, for the engines that keep one (Redux lists
   * what a player's influence is made of); classic Turmoil ignores it.
   */
  addInfluenceBonus(player: IPlayer, bonus?: number, source?: string): void;
  /** The card REQUIREMENT reading (Redux: ruling OR ≥2 own delegates; a card-granted effect never counts). */
  satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean;
  /**
   * …and the same reading TOLD, road by road (Turmoil Redux TR15 — the hand's
   * named reason «Mars First is not ruling · your delegates on its resolution:
   * 1 of 2»). Redux: the numbers `Parliament.access` already counts for
   * `satisfiesPartyRequirement` — never a second count. Classic: `undefined`
   * — its requirement keeps the old line (the classic engine is upstream's).
   */
  partyRequirementStanding(player: IPlayer, party: PartyName): PartyRequirementStanding | undefined;
  /** The EFFECT reading (Redux: ruling OR ≥2 own delegates OR granted by a card). */
  hasPartyEffect(player: IPlayer, party: PartyName): boolean;
  /** How many parties `player` leads (classic party leaders / Redux resolution leaders). */
  partiesLedBy(player: IPlayer): number;
  delegatesInReserve(player: IPlayer): number;
  delegatesOf(player: IPlayer, party: PartyName): number;
  /**
   * The player's own delegates ON RESOLUTIONS in the voting area — the card
   * requirement reading («Requires 3 delegates on resolutions», TR02). Redux:
   * `Parliament.votesOf` over the three slots (the lobby, the chairman's seat
   * and the reserve never count — the info panel's «On resolutions»). Classic:
   * 0 — there is no voting area, and a card of the Redux set is gated by its
   * module, so the facade stays honest instead of pretending parties are it.
   */
  delegatesOnResolutions(player: IPlayer): number;
}

export class ReduxPoliticalOps implements PoliticalOps {
  public readonly engine = 'redux';
  constructor(private readonly parliament: Parliament, private readonly game: IGame) {}

  public normalizeParty(party: PartyName): PartyName {
    return normalizeReduxParty(party);
  }
  public rulingParty(): PartyName {
    return this.parliament.rulingParty();
  }
  public dominantParty(): PartyName | undefined {
    const verdict = this.parliament.winner();
    return verdict === undefined ? undefined : this.parliament.resolutionOf(verdict.instance).party;
  }
  public partyLeader(party: PartyName): PoliticalDelegate | undefined {
    if (!isReduxPartyName(party)) {
      return undefined;
    }
    const slot = this.parliament.slotOf(party);
    if (slot === undefined) {
      return undefined;
    }
    const leader = this.parliament.leaderOf(slot);
    if (leader === undefined) {
      return undefined;
    }
    return leader.owner === 'NEUTRAL' ? 'NEUTRAL' : this.game.getPlayerById(leader.owner);
  }
  public chairman(): PoliticalDelegate | undefined {
    return this.parliament.chairman === undefined ? undefined : this.game.getPlayerById(this.parliament.chairman);
  }
  public isChairman(player: IPlayer): boolean {
    return this.parliament.isChairman(player);
  }
  public influence(player: IPlayer): number {
    return this.parliament.influence(player);
  }
  public addInfluenceBonus(player: IPlayer, bonus: number = 1, source?: string): void {
    this.parliament.addInfluenceBonus(player, bonus, source);
  }
  public satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean {
    return this.parliament.satisfiesPartyRequirement(player, this.normalizeParty(party));
  }
  public partyRequirementStanding(player: IPlayer, party: PartyName): PartyRequirementStanding | undefined {
    const normalized = this.normalizeParty(party);
    if (!isReduxPartyName(normalized)) {
      return undefined;
    }
    const access = this.parliament.access(player, normalized);
    return {party: normalized, ruling: access.ruling, delegates: access.delegates, required: PARTY_EFFECT_DELEGATES, onVote: access.onVote};
  }
  public hasPartyEffect(player: IPlayer, party: PartyName): boolean {
    return this.parliament.hasPartyEffect(player, this.normalizeParty(party));
  }
  public partiesLedBy(player: IPlayer): number {
    return this.parliament.slots.filter((slot) => this.parliament.leaderOf(slot)?.owner === player.id).length;
  }
  public delegatesInReserve(player: IPlayer): number {
    return this.parliament.reserve(player);
  }
  public delegatesOf(player: IPlayer, party: PartyName): number {
    if (!isReduxPartyName(party)) {
      return 0;
    }
    const slot = this.parliament.slotOf(party);
    return slot === undefined ? 0 : this.parliament.votesOf(player, slot);
  }
  public delegatesOnResolutions(player: IPlayer): number {
    return this.parliament.votesOf(player);
  }
}

export class ClassicPoliticalOps implements PoliticalOps {
  public readonly engine = 'classic';
  constructor(private readonly turmoil: Turmoil) {}

  public normalizeParty(party: PartyName): PartyName {
    return party;
  }
  public rulingParty(): PartyName {
    return this.turmoil.rulingParty.name;
  }
  public dominantParty(): PartyName | undefined {
    return this.turmoil.dominantParty.name;
  }
  public partyLeader(party: PartyName): PoliticalDelegate | undefined {
    return this.turmoil.getPartyByName(party).partyLeader;
  }
  public chairman(): PoliticalDelegate | undefined {
    return this.turmoil.chairman;
  }
  public isChairman(player: IPlayer): boolean {
    return this.turmoil.chairman === player;
  }
  public influence(player: IPlayer): number {
    return this.turmoil.getInfluence(player);
  }
  public addInfluenceBonus(player: IPlayer, bonus: number = 1, _source?: string): void {
    // Classic Turmoil keeps a bare sum — the source has nowhere to live and nothing reads it.
    this.turmoil.addInfluenceBonus(player, bonus);
  }
  public satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean {
    if (this.turmoil.rulingParty.name === party || player.alliedParty?.partyName === party) {
      return true;
    }
    return this.turmoil.getPartyByName(party).delegates.count(player) >= 2;
  }
  public partyRequirementStanding(_player: IPlayer, _party: PartyName): PartyRequirementStanding | undefined {
    // The classic engine has an alliance road (Mars Frontier Alliance) and no voting area: its
    // requirement keeps upstream's line rather than a Redux sentence that would misdescribe it.
    return undefined;
  }
  public hasPartyEffect(_player: IPlayer, party: PartyName): boolean {
    // Classic Turmoil has no per-player party effects: only the ruling policy applies.
    return this.turmoil.rulingParty.name === party;
  }
  public partiesLedBy(player: IPlayer): number {
    return this.turmoil.parties.filter((party) => party.partyLeader === player).length;
  }
  public delegatesInReserve(player: IPlayer): number {
    return this.turmoil.getAvailableDelegateCount(player);
  }
  public delegatesOf(player: IPlayer, party: PartyName): number {
    return this.turmoil.getPartyByName(party).delegates.count(player);
  }
  public delegatesOnResolutions(_player: IPlayer): number {
    // Classic Turmoil has no voting area and no resolutions: nothing stands «on a resolution».
    return 0;
  }
}

/** The facade for a game, or `undefined` when it has no political engine at all. */
export function politicalOpsOf(game: IGame): PoliticalOps | undefined {
  if (game.parliament !== undefined) {
    return new ReduxPoliticalOps(game.parliament, game);
  }
  if (game.turmoil !== undefined) {
    return new ClassicPoliticalOps(game.turmoil);
  }
  return undefined;
}
