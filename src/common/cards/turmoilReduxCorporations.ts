import {CardName} from './CardName';

/**
 * THE NEW CORPORATIONS OF THE TURMOIL REDUX SET — a fact of the printed set,
 * never a worklist (rulebook p.1: «8 new Corporation cards (and 1 replacement
 * corporation)»). The replacement (Septem Tribus, TR77) is a row of
 * `turmoilReduxReplacements.ts`; these eight are the set's OWN corporations: no
 * `reimplements`, their own art and their own printed lore, keyed by their own
 * number.
 *
 * CARD NUMBERS — the scans print no number. The new corporations take
 * `TR78…TR85` IN THE ORDER OF THE ROWS BELOW — the order of the scan folder
 * (`…/TM Turmoil Redux/Corporations/`, alphabetical), decided 2026-10-26 with
 * Arwind Inc., the first one authored: one prefix, one namespace (the TR77
 * decision). The manifest guard pins that a number past TR77 belongs to exactly
 * the row it counts to and is a CORPORATION
 * (`tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts`).
 *
 * `scan` is relative to `…/TM Turmoil Redux/`; `authored` names the card once it
 * is registered (`CardName`), so the guard can tell a row still to come from a
 * row whose card carries a wrong number.
 */
export type ReduxCorporationRow = {
  /** The printed name. */
  name: string;
  scan: string;
  /** The registered card — absent while the corporation is still to come. */
  authored?: CardName;
};

export const TURMOIL_REDUX_NEW_CORPORATIONS: ReadonlyArray<ReduxCorporationRow> = [
  // TR78 — AUTHORED 2026-10-26 (`turmoilRedux/ArwindInc.ts`): the Career step's reactor + the fighters' payment unit.
  {name: 'Arwind Inc.', scan: 'Corporations/Corporation - Arwind Inc.png', authored: CardName.ARWIND_INC},
  // TR79 — AUTHORED 2026-10-26 (`turmoilRedux/FerrusAcademy.ts`): the first city's printed bonus ×2 + a ring of cubes;
  // a tile on an own cube → 3 data or a card. The scan's text says 45 M€ — the plate's 40 is right (the owner).
  {name: 'Ferrus Academy', scan: 'Corporations/Corporation - Ferrus Academy.png', authored: CardName.FERRUS_ACADEMY},
  // TR80 — AUTHORED 2026-10-26 (`turmoilRedux/HartlanHeating.ts`): a green card that places a tile → 6 heat + 1 M€
  // production (the printed class `cards/cardPlacesTile.ts`); 12 heat → 2 cards.
  {name: 'Hartlan Heating', scan: 'Corporations/Corporation - Hartlan Heating.png', authored: CardName.HARTLAN_HEATING},
  // TR81 — AUTHORED 2026-10-26 (`turmoilRedux/LotusInnovations.ts`): +2 TR as the first action; a data here for every
  // step of the owner's rating (the first action's two included); 1 VP per 4 data.
  {name: 'Lotus Innovations', scan: 'Corporations/Corporation - Lotus Innovations.png', authored: CardName.LOTUS_INNOVATIONS},
  // TR82 — AUTHORED 2026-10-27 (`turmoilRedux/Proteus.ts`): a data here for every played tag that matches a tag on the
  // owner's other Preludes (one predicate, `matchingPreludeTags`); 6 data → a colony or an ocean.
  {name: 'Proteus', scan: 'Corporations/Corporation - Proteus.png', authored: CardName.PROTEUS},
  // TR83 — AUTHORED 2026-10-27 (`turmoilRedux/TheDeimosGroup.ts`): a delegate on any resolution as the first action,
  // +2 influence (the named ledger), every party requirement on cards lifted (the TR70 waiver, standing).
  {name: 'The Deimos Group', scan: 'Corporations/Corporation - The Deimos Group.png', authored: CardName.THE_DEIMOS_GROUP},
  {name: 'Titan Holdings', scan: 'Corporations/Corporation - Titan Holdings.png'},
  {name: 'Veynon Dynamics', scan: 'Corporations/Corporation - Veynon Dynamics.png'},
];

/** The first card number past the replacement corporation (TR77). */
export const FIRST_NEW_CORPORATION_CARD_NUMBER = 78;

/** The `TR##` number of the new corporation `name`; undefined for a card that is not one of the eight. */
export function newCorporationCardNumber(name: CardName): string | undefined {
  const index = TURMOIL_REDUX_NEW_CORPORATIONS.findIndex((row) => row.authored === name);
  return index < 0 ? undefined : `TR${FIRST_NEW_CORPORATION_CARD_NUMBER + index}`;
}
