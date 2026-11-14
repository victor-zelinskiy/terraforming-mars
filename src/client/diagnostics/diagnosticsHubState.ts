/*
 * WHAT THE HUB SAYS ABOUT ITSELF — its status, as the page shows it, and the one setting that lives there.
 *
 * «Автоотчёты об ошибках» is the player's consent to AUTOMATIC reports. It is kept by the hub (a file of the app's
 * data), not by the page: the main process's own signals and the native crash uploader must obey it before any page
 * exists, and two windows of one app must not disagree. The page reads it, shows it, and asks the hub to change it.
 *
 * State of the PAGE (it outlives every game screen); with no hub (a browser page of a server that runs none) the
 * status stays `undefined` and every surface says «недоступно в этой сборке» instead of showing a dead switch.
 */

import {reactive} from 'vue';
import {DiagHubStatus} from '@/common/diagnostics/protocol';
import {diagnosticsTransport} from '@/client/diagnostics/diagnosticsTransport';

export const diagHubState = reactive({
  /** The hub's last answer (undefined = not asked yet, or no hub). */
  status: undefined as DiagHubStatus | undefined,
  /** Asked at least once. */
  known: false,
});

/** A hub exists on this device (the desktop app). */
export function diagnosticsHubPresent(): boolean {
  return diagnosticsTransport().kind !== 'none';
}

export function noteDiagnosticsHubStatus(status: DiagHubStatus | undefined): void {
  if (status !== undefined) {
    diagHubState.status = status;
  }
  diagHubState.known = true;
}

/** Ask the hub (the surfaces call it when they open). Never throws. */
export async function refreshDiagnosticsHubStatus(): Promise<void> {
  noteDiagnosticsHubStatus(await diagnosticsTransport().invoke('status', undefined));
}

/** The player's choice for automatic reports. */
export async function setDiagnosticsConsent(consent: boolean): Promise<void> {
  // Shown at once (the stepper must not wait for a round trip); the hub's answer is the truth that replaces it.
  if (diagHubState.status !== undefined) {
    diagHubState.status = {...diagHubState.status, consent, sendingOff: diagHubState.status.sendingOff === 'environment' ? 'environment' : (consent ? '' : 'consent')};
  }
  noteDiagnosticsHubStatus(await diagnosticsTransport().invoke('set-consent', consent));
}
