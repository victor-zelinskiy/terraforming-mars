// Campaign Map — the tiny UI mirror the EMBEDDED host reads. The endgame
// workspace owns the one command bar while the map is its scene, but a
// component cannot reactively read another component's `$refs` state — so the
// map publishes the two facts the host's bar needs here (the journalState
// module-reactive pattern). The standalone map keeps reading its own state.

import {reactive} from 'vue';

export type CampaignMapOverlayKind = 'mission' | 'dossier' | 'carryover' | 'launch';

export const campaignMapUi = reactive<{
  /** The overlay the map currently shows (undefined = the route stage). */
  overlay: CampaignMapOverlayKind | undefined,
  /** The carryover picker's confirm verb (English i18n key, no params). */
  carryConfirmLabel: string,
}>({
  overlay: undefined,
  carryConfirmLabel: 'Keep the selection',
});

export function resetCampaignMapUi(): void {
  campaignMapUi.overlay = undefined;
  campaignMapUi.carryConfirmLabel = 'Keep the selection';
}
