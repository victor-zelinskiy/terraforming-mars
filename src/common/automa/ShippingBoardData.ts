import {ColonyName} from '../colonies/ColonyName';
import {Tag} from '../cards/Tag';

/**
 * The MarsBot Colonies Shipping Board — 11 storage areas, one per base-Colonies colony tile.
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
 * - Pluto: MarsBot does not gain cards; it gains resources into the storage area.
 * - Titan storage is used only when playing WITHOUT Venus Next (floaters); floaters are spent
 *   via the Research-Phase rule (5 floaters → an extra action-deck card), never via the
 *   5-resources track exchange.
 * - Human steal/remove effects may target these stored resources as the indicated type
 *   (Ceres steel, Luna M€, etc.) — except Europa (empty) and per normal targeting rules.
 *
 * Exchange mapping source: transcription from the official component image
 * (TM-Automa-rulebook-A, p.2 "1 Colonies shipping board", rendered at high resolution).
 * Each storage area prints "5 [resource] → [circular tag icon]": the circular tag icon is the
 * "advance the track matching this tag" notation (same notation as the Advance Another Track
 * action). See AUTOMA_DATA_AUDIT.md.
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
  {colony: ColonyName.PLUTO, exchangeTag: Tag.SCIENCE}, // 5 "cards" → Science track
  {colony: ColonyName.TITAN, exchangeTag: undefined}, // floater area — no track exchange
  {colony: ColonyName.EUROPA, exchangeTag: undefined}, // never stores resources
];

export function shippingAreaFor(colony: ColonyName): ShippingAreaData | undefined {
  return SHIPPING_BOARD_AREAS.find((a) => a.colony === colony);
}
