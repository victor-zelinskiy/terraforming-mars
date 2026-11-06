import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {IProjectCard} from '../../cards/IProjectCard';
import {hasRequirement} from '../../cards/requirements/CardsWithRequirementsRequirement';
import {AmazonisEngineer} from '../../awards/amazonisPlanitia/AmazonisEngineer';
import {Warmonger} from '../../awards/terraCimmeria/Warmonger';
import {CosmicSettler} from '../../awards/arabiaTerra/CosmicSettler';

/**
 * The PREDICATES a bot rule asks of a project card — what a played-pile criterion counts and what a
 * «reveal until…» helper searches for. ONE id, ONE predicate, read by both sides of a rule (the award / milestone's
 * count and its Corporate Competition helper), so the two can never drift.
 *
 * Where the human milestone / award owns the predicate it is the class's own STATIC (`Warmonger.include`,
 * `AmazonisEngineer.altersProduction`, `CosmicSettler.placesCityOffMars` — inv. 8: co-located in the card file);
 * a bare printed TYPE or COST is answered by the card object itself, never by a UI colour or a stored label.
 */
export type PilePredicateId =
  | 'green' // automated
  | 'blue' // active
  | 'greenOrBlue' // the Tycoon family (never events)
  | 'event' // red
  | 'cost20plus' // Celebrity / Sponsor — base cost ≥ 20, events included (the official asymmetry)
  | 'cost10minus' // Incorporator — base cost ≤ 10, events included
  | 'hasRequirement' // Forecaster's search
  | 'altersProduction' // A. Engineer
  | 'warmonger' // Warmonger
  | 'cityOffMars'; // Cosmic Settler

const PREDICATES: Record<PilePredicateId, (card: IProjectCard) => boolean> = {
  green: (card) => card.type === CardType.AUTOMATED,
  blue: (card) => card.type === CardType.ACTIVE,
  greenOrBlue: (card) => card.type === CardType.AUTOMATED || card.type === CardType.ACTIVE,
  event: (card) => card.type === CardType.EVENT,
  cost20plus: (card) => card.cost >= 20,
  cost10minus: (card) => card.cost <= 10,
  hasRequirement: (card) => hasRequirement(card),
  altersProduction: (card) => AmazonisEngineer.altersProduction(card),
  warmonger: (card) => Warmonger.include(card),
  cityOffMars: (card) => CosmicSettler.placesCityOffMars(card),
};

export function pilePredicate(id: PilePredicateId): (card: IProjectCard) => boolean {
  return PREDICATES[id];
}

/** A per-card QUANTITY summed over the pile (the pile's other reading). */
export type PileAmountId =
  | 'marsTags'; // Martian — printed Mars tags

const AMOUNTS: Record<PileAmountId, (card: IProjectCard) => number> = {
  marsTags: (card) => card.tags.filter((tag) => tag === Tag.MARS).length,
};

export function pileAmount(id: PileAmountId): (card: IProjectCard) => number {
  return AMOUNTS[id];
}
