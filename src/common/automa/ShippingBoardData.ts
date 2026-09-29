import {ColonyName} from '../colonies/ColonyName';
import {TURMOIL_REDUX_REPLACEMENTS} from '../colonies/AllColonies';
import {Tag} from '../cards/Tag';

/**
 * The MarsBot Colonies Shipping Board — 11 storage areas, one per base-Colonies colony tile,
 * plus one per Turmoil Redux ADDITION (Venus, Vesta — this fork's reading, see the entries).
 *
 * Rules source: TM-Automa-rulebook-C-11-14-2023 (Adding Expansions), pp.4–5:
 * - Build Colony: MarsBot gains 2 resources into the tile's storage area (ignores printed reward).
 * - MarsBot trades: −1 MC, +2 resources into the storage area (+1 more if MarsBot has a colony
 *   there). The human trading a tile where MarsBot has a colony: MarsBot gains +1 resource.
 * - "If at any point during MarsBot's Turn, MarsBot has 5 (or more) resources in a storage
 *   area, remove 5 resources from that area and advance the indicated track by one space.
 *   This does not apply to the Titan/Floater area."
 * - Europa: never stores resources. Build → place an ocean (+1 TR), Failed Action if
 *   impossible; trade → +1 TR (still −1 MC); colony bonus → +1 MC into MC supply.
 * - Pluto: "MarsBot does not gain cards for Pluto. Instead it gains [science]
 *   resources into the corresponding storage area" (RB-C p.5; the printed area
 *   reads "5 [science] → [science tag]"). Note Pluto is deliberately ABSENT
 *   from the steal/remove list below — its science is not targetable.
 * - Titan storage is used only when playing WITHOUT Venus Next (floaters); floaters are spent
 *   via the Research-Phase rule (5 floaters → an extra action-deck card), never via the
 *   5-resources track exchange.
 * - Human steal/remove effects may target these stored resources as the indicated type:
 *   RB-C p.5 lists Ceres, Luna, Io, Enceladus, Ganymede, Callisto, Miranda and Triton
 *   ("You may steal/remove from them as usual") — Europa never stores, and PLUTO is
 *   deliberately not in that list (its science area is not a steal/remove target).
 *
 * Exchange mapping source: transcription from the official component image
 * (TM-Automa-rulebook-A, p.2 "1 Colonies shipping board", rendered at high resolution).
 * Each storage area prints "5 [resource] → [circular tag icon]": the circular tag icon is the
 * "advance the track matching this tag" notation (same notation as the Advance Another Track
 * action). See docs/AUTOMA_DATA_AUDIT.md.
 */
export type ShippingAreaData = {
  readonly colony: ColonyName;
  /**
   * Tag whose MarsBot track is advanced when 5 stored resources are exchanged.
   * `undefined` for Titan (floater area — no exchange) and Europa (never stores resources).
   */
  readonly exchangeTag: Tag | undefined;
};

export const SHIPPING_BOARD_AREAS: ReadonlyArray<ShippingAreaData> = [
  {colony: ColonyName.CERES, exchangeTag: Tag.BUILDING}, // 5 steel → Building track
  {colony: ColonyName.LUNA, exchangeTag: Tag.EVENT}, // 5 M€ → Event track
  {colony: ColonyName.IO, exchangeTag: Tag.EARTH}, // 5 heat → Earth track
  {colony: ColonyName.ENCELADUS, exchangeTag: Tag.MICROBE}, // 5 microbes → Bio track
  {colony: ColonyName.GANYMEDE, exchangeTag: Tag.PLANT}, // 5 plants → Bio track
  {colony: ColonyName.CALLISTO, exchangeTag: Tag.POWER}, // 5 energy → Energy track
  {colony: ColonyName.MIRANDA, exchangeTag: Tag.ANIMAL}, // 5 animals → Bio track
  {colony: ColonyName.TRITON, exchangeTag: Tag.SPACE}, // 5 titanium → Space track
  {colony: ColonyName.PLUTO, exchangeTag: Tag.SCIENCE}, // 5 science → Science track (not steal-targetable, RB-C p.5)
  {colony: ColonyName.TITAN, exchangeTag: undefined}, // floater area — no track exchange
  {colony: ColonyName.EUROPA, exchangeTag: undefined}, // never stores resources
  // TURMOIL REDUX ADDITIONS (docs/TURMOIL_REDUX_MARSBOT.md §7, decision D7 — a project reading, the
  // Automa rulebook predates the expansion): an addition has no base twin to borrow an area from, so it
  // gets one of its own, keyed to the tile's printed tag. The bot builds and trades by the official
  // abstraction — resources into the area, the printed reward ignored — and exchanges 5 for a step of
  // the tag's track. The Venus tag's track exists only with Venus Next; without it the area simply
  // accumulates (the icon of an expansion not in play is ignored — like Titan's floaters, never an error).
  {colony: ColonyName.VENUS_REDUX, exchangeTag: Tag.VENUS}, // 5 floaters → Venus track (Venus Next only)
  {colony: ColonyName.VESTA, exchangeTag: Tag.SPACE}, // 5 asteroids / fighters → Space track
];

/**
 * The storage area of a colony tile. A Turmoil Redux REPLACEMENT (Pluto
 * Redux) stands in for its base twin and prints the same name, so it stores
 * in the twin's area; the key of the stored count stays the tile in play.
 */
export function shippingAreaFor(colony: ColonyName): ShippingAreaData | undefined {
  const twin = (Object.keys(TURMOIL_REDUX_REPLACEMENTS) as Array<ColonyName>)
    .find((base) => TURMOIL_REDUX_REPLACEMENTS[base] === colony);
  return SHIPPING_BOARD_AREAS.find((a) => a.colony === (twin ?? colony));
}
