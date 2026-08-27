import {CardName} from '../../../common/cards/CardName';
import {ModuleManifest} from '../ModuleManifest';
import {DeltaProject} from './DeltaProject';
import {QuantumResearch} from './QuantumResearch';
import {DynamicOceanBarrier} from './DynamicOceanBarrier';
import {StormSurgeBarrier} from './StormSurgeBarrier';

/**
 * THE DELTA PROJECT («Гидросеть») CARD MANIFEST.
 *
 * CARD NUMBER NAMESPACE — `DP##`, zero-padded to two digits.
 * `metadata.cardNumber` is the module's card ID, and in this fork it is also
 * the ART key (`assets/card-images/<cardNumber>.webp` + `thumb/`) and the LORE
 * key (`assets/text/lore_texts.json`) — see `client/cards/cardArt.ts` and
 * `client/cards/cardLore.ts`. Every other module owns a prefix the same way
 * (`U##`/`UC##`/`UP##` underworld, `M##`/`MC##`/`MP##` moon, `Pf##`… …), so
 * Delta Project cards MUST stay inside `DP##` and MUST NOT reuse a number.
 *   DP01 — the subsystem card below (taken).
 *   DP02+ — the fork's own Delta Project project cards.
 * `tests/cards/delta/DeltaProjectCardManifest.spec.ts` enforces both halves
 * (namespace membership, and no collision with any other module's number).
 */
export const DELTA_PROJECT_CARD_MANIFEST = new ModuleManifest({
  module: 'deltaProject',
  projectCards: {
    [CardName.QUANTUM_RESEARCH]: {Factory: QuantumResearch},
    [CardName.DYNAMIC_OCEAN_BARRIER]: {Factory: DynamicOceanBarrier},
    [CardName.STORM_SURGE_BARRIER]: {Factory: StormSurgeBarrier},
  },
  preludeCards: {
    // NEVER DEALT. The Delta Project is a global subsystem every player shares
    // (Game.newInstance seeds `deltaProjectData`; the advance is a standard
    // action built in `Player.getActions`, not a card play) — `Game` even
    // rejects it in `customPreludes` / `bannedCards`. It stays in the manifest
    // only so `newCard`/`export_card_rendering` resolve its name and render
    // data for the client (journal chips, the Hydronetwork surfaces), and
    // `instantiate: false` is what keeps it out of the prelude deck now that
    // this manifest is wired into `GameCards`.
    [CardName.DELTA_PROJECT]: {Factory: DeltaProject, instantiate: false},
  },
});
