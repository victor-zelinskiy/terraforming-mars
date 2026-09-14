import {BonusCardId} from '../automa/AutomaTypes';
import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {GlobalParameter} from '../GlobalParameter';
import {MilestoneName} from '../ma/MilestoneName';
import {AwardName} from '../ma/AwardName';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalEventName} from '../turmoil/globalEvents/GlobalEventName';
import {PartyName} from '../turmoil/PartyName';

/**
 * Which colony mechanic produced a `colony`-sourced bonus. Lets analytics (the
 * insightEngine) cleanly separate a player's TRADE income from colony BUILD
 * bonuses and the colony-to-owner bonuses — all three are `kind:'colony'` (same
 * grouping / `sourceKey`), they differ only by this role. The trade FEE is NOT a
 * colony benefit (it is a `payment` source), so it is intentionally absent here.
 */
export type ColonyBenefitRole = 'build' | 'trade' | 'colonyBonus';

/**
 * Serializable projection of the server-side `From` type (src/server/logs/From.ts).
 *
 * Describes WHAT caused a {@link GameEvent}: a card, a corporation, a standard
 * project, a milestone/award, a colony, a global event, a party, a global
 * parameter (solar phase), production-phase income, or the system (setup /
 * neutral player). Corporations are a FIRST-CLASS source kind on purpose — the
 * insightEngine has a dedicated "corporation impact" section, so corp events
 * must be unambiguously identifiable and attributable to their owner.
 *
 * `owner` is filled by the recorder from the active action context (the live
 * `From` only carries a card NAME, not its owner); it is what lets aggregation
 * group a corporation's impact by player.
 */
export type EventSource =
  | {kind: 'card'; card: CardName; owner?: Color}
  | {kind: 'corporation'; card: CardName; owner?: Color}
  | {kind: 'standardProject'; card: CardName}
  | {kind: 'milestone'; name: MilestoneName}
  | {kind: 'award'; name: AwardName}
  | {kind: 'colony'; name: ColonyName; benefit?: ColonyBenefitRole}
  | {kind: 'globalEvent'; name: GlobalEventName}
  /**
   * A political PARTY's effect. `owner` names the player WHOSE access produced
   * the payout (Turmoil Redux grants one party's effect to several players at
   * once, each through their own delegates) so per-player effect statistics can
   * group a party effect exactly like a card in that player's tableau.
   */
  | {kind: 'party'; name: PartyName; owner?: Color}
  /**
   * An enacted RESOLUTION (Turmoil Redux). `id` is the catalog id (stable
   * across saves — see `common/parliament/ParliamentTypes.ts`); `owner` is the
   * player the effect paid, when it paid one player in particular.
   */
  | {kind: 'resolution'; id: string; owner?: Color}
  /**
   * The Mars Parliament itself as a RULE source (Turmoil Redux): the greenery
   * TR revision, an Agenda step bonus, the chairman's seat. Nothing a card or a
   * party did — the political rulebook did.
   */
  | {kind: 'parliament'}
  | {kind: 'globalParameter'; parameter: GlobalParameter}
  /**
   * A MarsBot BONUS CARD (Automa). Recorded at the moment the card RESOLVES,
   * so the event stream keeps the causal source even after the one-shot card
   * is destroyed and removed from the game — the id resolves to a name via the
   * pure static `bonusCardInfo(id)` table, never via a live collection.
   */
  | {kind: 'bonusCard'; bonusCard: BonusCardId; owner?: Color}
  | {kind: 'production'}
  | {kind: 'spaceBonus'} // a hex's printed placement bonus ("cell bonus")
  | {kind: 'oceanBonus'} // M€ for placing adjacent to oceans
  | {kind: 'payment'} // resources spent paying for a card / project
  | {kind: 'system'};

/**
 * Stable grouping key for aggregation. Two sources with the same key are the
 * same engine piece across the whole game (e.g. every Earth Catapult discount).
 */
export function sourceKey(source: EventSource | undefined): string {
  if (source === undefined) {
    return 'unknown';
  }
  switch (source.kind) {
  case 'card':
  case 'corporation':
  case 'standardProject':
    return `${source.kind}:${source.card}`;
  case 'milestone':
  case 'award':
  case 'colony':
  case 'globalEvent':
  case 'party':
    return `${source.kind}:${source.name}`;
  case 'resolution':
    return `${source.kind}:${source.id}`;
  case 'globalParameter':
    return `${source.kind}:${source.parameter}`;
  case 'bonusCard':
    return `${source.kind}:${source.bonusCard}`;
  default:
    return source.kind;
  }
}

export function isCorporationSource(source: EventSource | undefined): source is {kind: 'corporation'; card: CardName; owner?: Color} {
  return source?.kind === 'corporation';
}

/**
 * A source that is NOT a card in anybody's tableau yet still acts as an
 * effect engine of its own: a party effect, an enacted resolution, the
 * parliament's rules. Every surface that used to equate «no card name» with
 * «a bare rule» asks this instead of `kind === 'rule'`.
 */
export function isPoliticalSource(source: EventSource | undefined): source is {kind: 'party'; name: PartyName; owner?: Color} | {kind: 'resolution'; id: string; owner?: Color} | {kind: 'parliament'} {
  return source !== undefined && (source.kind === 'party' || source.kind === 'resolution' || source.kind === 'parliament');
}
