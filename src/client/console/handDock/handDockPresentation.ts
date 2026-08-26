/**
 * HAND DOCK PRESENTATION — how the docked pack shows its cards.
 *
 * Two voices, one knob («Настройки» → ИНТЕРФЕЙС → «Карты в доке»):
 *  - BACKS (default): the pack is a fan of card backs — the premium,
 *    poker-hand read; every arrival turns back-side-out on approach.
 *  - FACES: the tabletop feel — «да это мои карты, я их реально держу»:
 *    cards rest face-up in the tray, arrivals land face-up.
 *
 * The facing is a DOCKED-POSE fact, consumed wherever a card's flip is
 * aimed at the dock: the bodies layer's fresh seat + reconcile, the
 * open/close episodes' flip targets and the delivery director's landing
 * turn. The ALBUM and the page packets are always face-up regardless (the
 * spreads are laid out face-up by the album's physical model).
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_dock_faces';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const handDockPresentation = reactive({
  faceUp: typeof window === 'undefined' ? false : readStored(),
});

export function setHandDockFaceUp(faceUp: boolean): void {
  handDockPresentation.faceUp = faceUp;
  try {
    if (faceUp) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable — the in-session choice still applies
  }
}

/** The flip rotationY of a card RESTING IN THE DOCK (and the target of
 *  every flight that ends there). 180 = back-side-out, 0 = face-up. */
export function dockFaceRotation(): number {
  return handDockPresentation.faceUp ? 0 : 180;
}
