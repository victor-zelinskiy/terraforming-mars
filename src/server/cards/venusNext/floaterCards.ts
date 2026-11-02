import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';

export const floaterCards: ReadonlySet<CardName> = new Set([
  // Venus
  CardName.AEROSPORT_TOURNAMENT,
  CardName.AIR_SCRAPPING_EXPEDITION,
  CardName.ATMOSCOOP,
  CardName.HYDROGEN_TO_VENUS,
  CardName.STRATOSPHERIC_BIRDS,

  // Colonies
  CardName.AIRLINERS,
  CardName.AIR_RAID,
  CardName.FLOATER_LEASING,
  CardName.FLOATER_PROTOTYPES,
  CardName.FLOATER_TECHNOLOGY,
  CardName.NITROGEN_FROM_TITAN,

  // Prelude 2
  CardName.GHG_SHIPMENT,
  CardName.STRATOSPHERIC_EXPEDITION,
  CardName.VENUS_SHUTTLES,

  // Pathfinders
  CardName.CASSINI_STATION,
  CardName.FLOATER_URBANISM,
  CardName.NOBEL_LABS,
  CardName.SECRET_LABS,
  CardName.VENERA_BASE,

  // Star Wars
  CardName.CLOUD_CITY,

  // Underworld
  CardName.SOIL_EXPORT,

  // Turmoil Redux — TR56 prints «6 floaters to ANY card» (Celestic reveals it as a floater card)
  CardName.ROBOTICS_FACTORY,
  // TR58 prints «3 floaters to ANY card» as its action's one result
  CardName.REPROCESSING_PLANT,
]);


/**
 * «A card WITH A FLOATER ICON» — the search rule Celestic and P44 Atmospheric Enhancers print: a card that prints the
 * floater icon without holding floaters (the list above) or a card that collects them. ONE reader for the draw that
 * performs the search (`DrawCards`, the `floaterIcon` descriptor — `DrawSearchModel.floaterIcon`); the client is sent
 * the flag, never the list.
 */
export function hasFloaterIcon(card: {name: CardName, resourceType?: CardResource}): boolean {
  return floaterCards.has(card.name) || card.resourceType === CardResource.FLOATER;
}
