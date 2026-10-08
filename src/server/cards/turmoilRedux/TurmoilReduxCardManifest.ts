import {CardName} from '../../../common/cards/CardName';
import {ModuleManifest} from '../ModuleManifest';
import {EvaMechs} from './EvaMechs';
import {FormulaZero} from './FormulaZero';
import {AutomatedConvoys} from './AutomatedConvoys';
import {PoliticalScience} from './PoliticalScience';
import {SupremeExpertise} from './SupremeExpertise';
import {VectorComputations} from './VectorComputations';
import {PoliticalDonation} from './PoliticalDonation';
import {MinorityRepresentation} from './MinorityRepresentation';
import {WaterHauling} from './WaterHauling';
import {ColonySponsors} from './ColonySponsors';
import {MechSports} from './MechSports';
import {PoliticalThinkTank} from './PoliticalThinkTank';
import {MartianCensus} from './MartianCensus';
import {ConstructionMechs} from './ConstructionMechs';
import {PartySanctions} from './PartySanctions';
import {AdministrationDistrict} from './AdministrationDistrict';
import {MartianFiber} from './MartianFiber';
import {SponsoredSettlement} from './SponsoredSettlement';
import {FringeColony} from './FringeColony';
import {MartianRoads} from './MartianRoads';
import {ReSettlement} from './ReSettlement';
import {Arboretum} from './Arboretum';
import {NovaCity} from './NovaCity';
import {HabitatScience} from './HabitatScience';
import {VenusianCensus} from './VenusianCensus';
import {ExclusiveColony} from './ExclusiveColony';
import {UnmiLiner} from './UnmiLiner';
import {AuroraStation} from './AuroraStation';
import {EarthArmyContract} from './EarthArmyContract';
import {SpaceshipRecycling} from './SpaceshipRecycling';
import {RedMuseum} from './RedMuseum';
import {NationalistMovement} from './NationalistMovement';
import {RedTechConvention} from './RedTechConvention';
import {RedsNewsOutlet} from './RedsNewsOutlet';

/**
 * TURMOIL REDUX («Кризис: Возвращение») — the PROJECT CARD manifest.
 *
 * The expansion's RESOLUTIONS are not cards of this manifest: they live in
 * `src/server/parliament/resolutions/**` and reach the client through
 * `ParliamentCatalog`. This manifest carries the set's 70 PROJECT CARDS
 * (TR01…TR70), shipped ONE AT A TIME like the resolutions were, plus the six
 * REPLACEMENT cards the set prints for the base Turmoil ones (Aerial Lenses,
 * Banned Delegate, Political Alliance, Recruitment, Sponsored Mohole, Vote of
 * No Confidence) — RESERVED, not yet authored.
 *
 * CARD NUMBER NAMESPACE — `TR##`, zero-padded to two digits (TR01…TR70).
 * `metadata.cardNumber` is the module's card ID, and in this fork it is also
 * the ART key (`assets/card-images/<cardNumber>.webp` + `thumb/`) and the LORE
 * key (`assets/text/lore_texts.json`) — see `client/cards/cardArt.ts` and
 * `client/cards/cardLore.ts`. Every other module owns a prefix the same way
 * (`DP##` delta, `U##`/`UC##`/`UP##` underworld, `M##`… moon, `Pf##`…), so
 * Turmoil Redux cards MUST stay inside `TR##` and MUST NOT reuse a number.
 * `tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts` enforces both
 * halves (namespace membership, and no collision with any other module's
 * number) and the deck gate (`gameOptions.turmoilReduxExpansion`).
 *
 * Author's checklist for the next card: `docs/claude/turmoil-redux-card-checklist.md`.
 */
export const TURMOIL_REDUX_CARD_MANIFEST = new ModuleManifest({
  module: 'turmoilRedux',
  projectCards: {
    [CardName.FORMULA_ZERO]: {Factory: FormulaZero},
    [CardName.EVA_MECHS]: {Factory: EvaMechs},
    // The ▲ printed beside the art: the card needs Colonies (Delta Works precedent).
    [CardName.AUTOMATED_CONVOYS]: {Factory: AutomatedConvoys, compatibility: 'colonies'},
    // The purple Turmoil symbol at the bottom left: the card needs the political engine — which for a
    // card of THIS manifest is the module itself (the deck gate), never `compatibility: 'turmoil'`
    // (the upstream-adaptation marker that demands `politics: 'redux'`).
    [CardName.POLITICAL_SCIENCE]: {Factory: PoliticalScience},
    // The purple Turmoil symbol at the bottom left again — the module is the gate (see TR02 above).
    [CardName.SUPREME_EXPERTISE]: {Factory: SupremeExpertise},
    // The purple Turmoil symbol at the bottom left once more — the module is the gate (see TR02 above).
    [CardName.VECTOR_COMPUTATIONS]: {Factory: VectorComputations},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above): the card is
    // dealt only into a game with the Mars Parliament, so its delegate always has a voting area to go to.
    [CardName.POLITICAL_DONATION]: {Factory: PoliticalDonation},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above): the card is
    // dealt only into a game with the Mars Parliament, so its Agenda marker always has a track to walk.
    [CardName.MINORITY_REPRESENTATION]: {Factory: MinorityRepresentation},
    // The grey ▲ at the bottom left: the card needs Colonies (it IS a destination of the trade action —
    // a fleet dock, `colonies/FleetDock.ts`). The purple Turmoil symbol below it is the module itself.
    [CardName.WATER_HAULING]: {Factory: WaterHauling, compatibility: 'colonies'},
    // The grey ▲ at the bottom left: the card needs Colonies (it moves a colony TILE's track, and its
    // requirement is a colony of one's own). The purple Turmoil symbol below it is the module itself.
    [CardName.COLONY_SPONSORS]: {Factory: ColonySponsors, compatibility: 'colonies'},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲, so the
    // card needs nothing else.
    [CardName.MECH_SPORTS]: {Factory: MechSports},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. Its check
    // (a card with a PARTY REQUIREMENT) can succeed only once such cards join the Redux deck (TR14–TR27).
    [CardName.POLITICAL_THINK_TANK]: {Factory: PoliticalThinkTank},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // FIRST card with a PARTY REQUIREMENT (the Mars First emblem in the MIN plate) — TR13's check can now hit.
    [CardName.MARTIAN_CENSUS]: {Factory: MartianCensus},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. TR09's
    // twin for Building / City tags: the second mech payment pool (`constructionMechs`), and the second card
    // with a PARTY REQUIREMENT (Mars First).
    [CardName.CONSTRUCTION_MECHS]: {Factory: ConstructionMechs},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // first card with a CHAIRMAN requirement and the first that strips a Popular Support area.
    [CardName.PARTY_SANCTIONS]: {Factory: PartySanctions},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // first city IGNORING OTHER PLACEMENT RESTRICTIONS (`boards/ignoreRestrictionsCity.ts`), Mars First's plate.
    [CardName.ADMINISTRATION_DISTRICT]: {Factory: AdministrationDistrict},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. Meat
    // Industry's twin for data (+1 M€ per data added to any of your cards), the set's fourth data holder.
    [CardName.MARTIAN_FIBER]: {Factory: MartianFiber},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. TR16's younger
    // sister: the same city ignoring other placement restrictions, without the adjacency; +2 M€ production.
    [CardName.SPONSORED_SETTLEMENT]: {Factory: SponsoredSettlement},
    // The grey ▲ at the bottom left: the card needs Colonies (it REPLACES a colony tile and builds on the new
    // one — the colony roster's first card, `docs/COLONY_ROSTER_CEREMONY.md`). The purple Turmoil symbol below
    // it is the module itself. The set's first GENERATION requirement («GEN 4+»).
    [CardName.FRINGE_COLONY]: {Factory: FringeColony, compatibility: 'colonies'},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // first card with NO effect graphic: Mars First's plate, two tags and «1 VP for every 3 Building tags».
    [CardName.MARTIAN_ROADS]: {Factory: MartianRoads},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // first card that MOVES a tile: one's own city travels to an adjacent non-reserved cell
    // (`Game.moveCityTile`, `docs/TURMOIL_REDUX_RE_SETTLEMENT.md`), Mars First's plate.
    [CardName.RE_SETTLEMENT]: {Factory: ReSettlement},
    // The purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲. The set's
    // first card whose reward THE CELL DECIDES: a greenery, then 1 data on ANY card per adjacent city
    // (`cards/adjacentCityPayout.ts`, docs/TURMOIL_REDUX_ARBORETUM.md), Mars First's plate.
    [CardName.ARBORETUM]: {Factory: Arboretum},
    // The grey ▲ at the bottom left: the card needs Colonies (its city is placed ON A COLONY TILE — the set's
    // first tile on a colony tile, `docs/TURMOIL_REDUX_NOVA_CITY.md`). The purple Turmoil symbol below it is
    // the module itself. The set's first card under Unity's plate; «2 VP per space city you own».
    [CardName.NOVA_CITY]: {Factory: NovaCity, compatibility: 'colonies'},
    // The grey ▲ at the bottom left: the card needs Colonies (it counts the colonies in play and its action pays
    // «all your colony bonuses» — the set's first card that does, `docs/TURMOIL_REDUX_HABITAT_SCIENCE.md`). The
    // purple Turmoil symbol below it is the module itself. Unity's plate.
    [CardName.HABITAT_SCIENCE]: {Factory: HabitatScience, compatibility: 'colonies'},
    // The Venus Next icon at the bottom left: the card needs Venus Next (rulebook p.8 — «remove the
    // appropriate Turmoil Redux cards… the Venus cards in question have a Venus Next icon on them»). The
    // purple Turmoil symbol below it is the module itself. The set's first Venus tag; Unity's plate; its
    // effect answers EVERY Venus step (`ICard.onGlobalParameterRaised`, docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
    [CardName.VENUSIAN_CENSUS]: {Factory: VenusianCensus, compatibility: 'venus'},
    // The grey ▲ at the bottom left: the card needs Colonies (it places a colony — and may place it BEYOND THE
    // 3-COLONY LIMIT, the set's first build that does, `docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md`). The purple
    // Turmoil symbol below it is the module itself. Unity's plate.
    [CardName.EXCLUSIVE_COLONY]: {Factory: ExclusiveColony, compatibility: 'colonies'},
    // The grey ▲ at the bottom left: the card needs Colonies (it is a destination of the trade action — the
    // set's SECOND fleet dock, `colonies/FleetDock.ts`; its reward is +1 TR). The purple Turmoil symbol below
    // it is the module itself. Unity's plate.
    [CardName.UNMI_LINER]: {Factory: UnmiLiner, compatibility: 'colonies'},
    // The grey ▲ at the bottom left: the card needs Colonies (it is a destination of the trade action — the
    // set's THIRD fleet dock, `colonies/FleetDock.ts`; its reward asks for a Venus card). The scan carries NO
    // Venus Next icon, yet the card cannot work without it (a Venus tag, «the Venus track», «any Venus card»):
    // owner's decision 3 gates it on BOTH. The purple Turmoil symbol below it is the module itself. Unity's plate.
    [CardName.AURORA_STATION]: {Factory: AuroraStation, compatibility: ['colonies', 'venus']},
    // Only the purple Turmoil symbol at the bottom left — the module is the gate (see TR02 above); no ▲, no Venus
    // icon. The set's first action with a CONDITIONAL second beat: +1 fighter, and at two, −2 fighters for 1 TR.
    // Unity's plate.
    [CardName.EARTH_ARMY_CONTRACT]: {Factory: EarthArmyContract},
    // Only the module's icon at the bottom left — no ▲, no Venus icon: the module is the gate. The set's first action
    // with ONE price taken from a card the player chooses and TWO outcomes (+2 titanium OR a mech on any card).
    // Unity's plate.
    [CardName.SPACESHIP_RECYCLING]: {Factory: SpaceshipRecycling},
    // Only the module's icon at the bottom left — no ▲, no Venus icon: the module is the gate. The set's first card
    // under the REDS' plate, and its first tile trigger the CELL decides («a city or special tile on Mars adjacent to
    // no greeneries or oceans» → +2 data here; `cards/tilePayout.ts`, the scene «ТАЙЛ ПЛАТИТ»).
    [CardName.RED_MUSEUM]: {Factory: RedMuseum},
    // Only the module's icon at the bottom left — no ▲, no Venus icon: the module is the gate. The Reds' plate
    // again, and the set's first card that places a NEUTRAL vote — the shared step `parliament/RallyNeutralDelegates`
    // (a pure plan, no prompt), the rally hosted by the hand on the console («ДЕЛЕГАТЫ»).
    [CardName.NATIONALIST_MOVEMENT]: {Factory: NationalistMovement},
    // Only the module's icon at the bottom left — no ▲, no Venus icon: the module is the gate. The Reds' plate
    // again, and the set's first draw with a NEGATIVE filter — the DSL's `drawCard.withoutTags`, one descriptor of
    // the search for the chip, the text, the reveal's summary and its discard tray (`deferredActions/drawSearch.ts`).
    [CardName.RED_TECH_CONVENTION]: {Factory: RedTechConvention},
    // Only the module's icon at the bottom left — no ▲, no Venus icon: the module is the gate. The Reds' plate
    // again over the TR20 class («VP for tags», no effect row) — the set's first VP count of its own MARS tag, one
    // for one: the standard `{tag, per}`, read RAW by every surface that shows the number.
    [CardName.REDS_NEWS_OUTLET]: {Factory: RedsNewsOutlet},
  },
});
