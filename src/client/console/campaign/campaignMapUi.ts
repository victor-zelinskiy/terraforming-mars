// Campaign Map — the tiny UI mirror the EMBEDDED host reads. The endgame
// workspace owns the one command bar while the map is its scene, but a
// component cannot reactively read another component's `$refs` state — so the
// map publishes what the host's bar needs here (the journalState
// module-reactive pattern). The standalone map keeps reading its own state.
//
// The mirror carries the map's WHOLE command list, published from the map's
// own `commands` computed — the host re-labels only the root B («Main menu» →
// «Game results») and renders the rest verbatim. A hand-copied verb list in
// the host is the drift class this replaces: it kept advertising overlays the
// map had already deleted.

import {reactive} from 'vue';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';

export type CampaignMapOverlayKind = 'mission' | 'carryover';

export const campaignMapUi = reactive<{
  /** The overlay the map currently shows (undefined = the route stage). */
  overlay: CampaignMapOverlayKind | undefined,
  /** The carryover picker's confirm verb (English i18n key, no params). */
  carryConfirmLabel: string,
  /** The map's OWN command list, mirrored verbatim for the embedded host. */
  commands: ReadonlyArray<ConsoleCommand>,
}>({
  overlay: undefined,
  carryConfirmLabel: 'Keep the selection',
  commands: [],
});

export function resetCampaignMapUi(): void {
  campaignMapUi.overlay = undefined;
  campaignMapUi.carryConfirmLabel = 'Keep the selection';
  campaignMapUi.commands = [];
}
