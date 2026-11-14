/*
 * THE DOOR INTO THE DIAGNOSTICS SURFACE — for whoever is not the overlay's owner.
 *
 * The system overlay (the system menu, the settings console, the diagnostics surface) is owned by `GamepadLayer`,
 * which sits on the raw pad stream outside every screen. Three callers need to open the diagnostics surface from
 * somewhere else — the developer's notice (hold X), the main menu's «Сообщить о проблеме» item, the developer's key
 * (F12, pushed by the main process) — and none of them may reach into the layer: they ask here, and the layer, while
 * it is mounted, answers (the same seam as `consoleSystemMenuBridge.ts` for the keyboard).
 */

import {DiagOpenTarget} from '@/client/diagnostics/diagnosticsSurface';

type Opener = (target: DiagOpenTarget) => void;

let opener: Opener | undefined;

/** The overlay's owner registers while it is mounted (undefined on unmount). */
export function setDiagnosticsOverlayOpener(open: Opener | undefined): void {
  opener = open;
}

/** Open the diagnostics surface over whatever screen stands. False when nobody can (no layer is mounted). */
export function openDiagnosticsOverlay(target: DiagOpenTarget): boolean {
  if (opener === undefined) {
    return false;
  }
  opener(target);
  return true;
}
