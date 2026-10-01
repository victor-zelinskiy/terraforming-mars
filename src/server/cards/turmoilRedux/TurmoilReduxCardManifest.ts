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
  },
});
