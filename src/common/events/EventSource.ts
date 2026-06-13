import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {GlobalParameter} from '../GlobalParameter';
import {MilestoneName} from '../ma/MilestoneName';
import {AwardName} from '../ma/AwardName';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalEventName} from '../turmoil/globalEvents/GlobalEventName';
import {PartyName} from '../turmoil/PartyName';

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
  | {kind: 'colony'; name: ColonyName}
  | {kind: 'globalEvent'; name: GlobalEventName}
  | {kind: 'party'; name: PartyName}
  | {kind: 'globalParameter'; parameter: GlobalParameter}
  | {kind: 'production'}
  | {kind: 'spaceBonus'} // a hex's printed placement bonus ("cell bonus")
  | {kind: 'oceanBonus'} // M€ for placing adjacent to oceans
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
  case 'globalParameter':
    return `${source.kind}:${source.parameter}`;
  default:
    return source.kind;
  }
}

export function isCorporationSource(source: EventSource | undefined): source is {kind: 'corporation'; card: CardName; owner?: Color} {
  return source?.kind === 'corporation';
}
