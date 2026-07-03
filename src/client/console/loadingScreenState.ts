/*
 * PREMIUM LOADING SCREEN state — the console-native pre-game shell (P10).
 *
 * The GAME BOUNDARY is a deliberate full reload (App.navigateInApp doc:
 * a fresh page guarantees clean per-game module state). This module makes
 * that boundary SEAMLESS instead of raw:
 *
 *  - `navigateWithCurtain(url)` raises the curtain FIRST (one painted
 *    frame), hands the flags to the NEXT page via sessionStorage
 *    (curtain-on-boot + fullscreen-was-on), then navigates. The player
 *    never sees the outgoing page tear down.
 *  - On the next page, App reads `consumeBootFlags()` during mount —
 *    BEFORE the first route resolution — so the curtain is up from the
 *    very first Vue paint (no raw texture / empty screen while the
 *    playerView + board load).
 *  - `fullscreenLost` drives the RESTORE prompt inside the loading screen:
 *    a browser drops fullscreen on navigation BY SPEC (it can only come
 *    back from a user gesture — a click / key press; Xbox controllers
 *    send real key events in the TV browser, so A works there). Inside
 *    Electron the window fullscreen survives the reload natively.
 *
 * Module-level reactive — survives the playerkey remount like every other
 * console state.
 */

import {reactive} from 'vue';

const BOOT_FLAG = 'tm_boot_curtain';
const FS_FLAG = 'tm_fs_restore';

export type LoadingStage =
  | 'expedition' // «Подготовка экспедиции…» — leaving for a game
  | 'sync' // «Синхронизация состояния партии…» — fetching the player view
  | 'map' // «Загрузка марсианской карты…» — assets / board
  | 'draft' // «Подготовка драфта…»
  | 'interface' // «Инициализация игрового интерфейса…»
  | 'controls'; // «Определение режима управления…» — runtime/gamepad bootstrap

export const LOADING_STAGE_TEXT: Record<LoadingStage, string> = {
  expedition: 'Preparing the expedition…',
  sync: 'Synchronizing the game state…',
  map: 'Loading the Martian map…',
  draft: 'Preparing the draft…',
  interface: 'Initializing the game interface…',
  controls: 'Detecting the control mode…',
};

/** The auto-advance order (indeterminate loads walk it slowly, never past the end). */
export const LOADING_STAGE_ORDER: ReadonlyArray<LoadingStage> =
  ['expedition', 'sync', 'map', 'interface'];

export const loadingScreenState = reactive({
  active: false,
  stage: 'sync' as LoadingStage,
  /** A failed load — the curtain becomes the premium error/retry state. */
  error: '' as string,
  /** The previous page was fullscreen → offer the gesture-based restore. */
  fullscreenLost: false,
});

export function beginLoading(stage: LoadingStage = 'sync'): void {
  loadingScreenState.active = true;
  loadingScreenState.stage = stage;
  loadingScreenState.error = '';
}

export function setLoadingStage(stage: LoadingStage): void {
  if (loadingScreenState.active) {
    loadingScreenState.stage = stage;
  }
}

export function endLoading(): void {
  loadingScreenState.active = false;
  loadingScreenState.error = '';
}

export function failLoading(message: string): void {
  loadingScreenState.active = true;
  loadingScreenState.error = message;
}

export function clearFullscreenLost(): void {
  loadingScreenState.fullscreenLost = false;
}

/**
 * The GAME-BOUNDARY navigation: curtain up → flags handed to the next
 * page → hard navigate (the deliberate reload). The double-rAF guarantees
 * the curtain actually PAINTS before the browser tears the page down.
 */
export function navigateWithCurtain(url: string, stage: LoadingStage = 'expedition'): void {
  beginLoading(stage);
  try {
    sessionStorage.setItem(BOOT_FLAG, stage);
    if (typeof document !== 'undefined' && document.fullscreenElement !== null) {
      sessionStorage.setItem(FS_FLAG, '1');
    }
  } catch {
    // sessionStorage unavailable — the next page just boots without the handoff.
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.location.assign(url);
  }));
}

/**
 * Read + CLEAR the boot handoff (called once from App.mounted, before the
 * first route resolution). Returns the stage to open the curtain on, or
 * undefined when this is a plain page load.
 */
export function consumeBootFlags(): LoadingStage | undefined {
  try {
    const stage = sessionStorage.getItem(BOOT_FLAG) as LoadingStage | null;
    const fs = sessionStorage.getItem(FS_FLAG);
    sessionStorage.removeItem(BOOT_FLAG);
    sessionStorage.removeItem(FS_FLAG);
    if (fs === '1' && typeof document !== 'undefined' && document.fullscreenElement === null) {
      loadingScreenState.fullscreenLost = true;
    }
    return stage ?? undefined;
  } catch {
    return undefined;
  }
}
