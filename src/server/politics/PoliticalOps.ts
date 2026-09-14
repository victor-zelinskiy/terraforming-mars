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
import {normalizeReduxParty} from '../../common/parliament/ParliamentTypes';
import {isReduxPartyName, Parliament} from '../parliament/Parliament';

export type PoliticalDelegate = IPlayer | 'NEUTRAL';

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
  addInfluenceBonus(player: IPlayer, bonus?: number): void;
  /** The card REQUIREMENT reading (Redux: ruling OR ≥2 own delegates; a card-granted effect never counts). */
  satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean;
  /** The EFFECT reading (Redux: ruling OR ≥2 own delegates OR granted by a card). */
  hasPartyEffect(player: IPlayer, party: PartyName): boolean;
  /** How many parties `player` leads (classic party leaders / Redux resolution leaders). */
  partiesLedBy(player: IPlayer): number;
  delegatesInReserve(player: IPlayer): number;
  delegatesOf(player: IPlayer, party: PartyName): number;
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
  public addInfluenceBonus(player: IPlayer, bonus: number = 1): void {
    this.parliament.addInfluenceBonus(player, bonus);
  }
  public satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean {
    return this.parliament.satisfiesPartyRequirement(player, this.normalizeParty(party));
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
  public addInfluenceBonus(player: IPlayer, bonus: number = 1): void {
    this.turmoil.addInfluenceBonus(player, bonus);
  }
  public satisfiesPartyRequirement(player: IPlayer, party: PartyName): boolean {
    if (this.turmoil.rulingParty.name === party || player.alliedParty?.partyName === party) {
      return true;
    }
    return this.turmoil.getPartyByName(party).delegates.count(player) >= 2;
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
