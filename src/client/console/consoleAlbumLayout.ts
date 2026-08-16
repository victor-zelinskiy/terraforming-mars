/**
 * @console-shared LIVE — the hand ALBUM's layout preference.
 *
 * Two compositions of the same Album Framework (consoleHandAlbum.ts):
 *
 *  - `adaptive` (default) — the profile's full page (5×2 on tv/desktop, up
 *    to 10 cards) with SHOWCASE single-row pages for 1–5-card pages;
 *  - `large`   — «Крупные карты»: always ONE row of at most 4, every page
 *    a showcase (the player trades capacity for couch readability).
 *
 * READ SYNCHRONOUSLY AT IMPORT: the album's first layout measure (and the
 * HandDock → Album flight that aims at it) must already be in the chosen
 * composition — a 5×2 frame that snaps to 4×1 after the preference loads is
 * exactly the artifact this module exists to prevent.
 *
 * Config: localStorage `tm_console_album` → default 'adaptive'. Pure client
 * presentation — never part of game state, never sent to the server.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_album';

export type ConsoleAlbumLayout = 'adaptive' | 'large';
export const ALBUM_LAYOUT_CHOICES: ReadonlyArray<ConsoleAlbumLayout> = ['adaptive', 'large'];

/** English i18n keys for the settings ring (translated at render). */
export const ALBUM_LAYOUT_LABELS: Readonly<Record<ConsoleAlbumLayout, string>> = {
  adaptive: 'Adaptive',
  large: 'Large cards',
};

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): ConsoleAlbumLayout {
  const raw = storage()?.getItem(STORAGE_KEY);
  return raw === 'large' ? 'large' : 'adaptive';
}

/** Reactive so the Options row + the album's plans react to a change. */
export const albumLayoutState = reactive({layout: readInitial()});

/**
 * A LIVE-RECOMPOSE hook: when the album is OPEN, an in-place layout flip is
 * a teleport — the shell registers a wrapper that runs the change through
 * the same measured FLIP episode a filter change uses (cards glide and
 * scale to their new slots; focus keeps its CARD, and the page containing
 * it opens by derivation). Without a registrar the change applies directly
 * (the next open lands in the chosen composition).
 */
let recomposer: ((apply: () => void) => void) | undefined;

export function setAlbumLayoutRecomposer(fn: ((apply: () => void) => void) | undefined): void {
  recomposer = fn;
}

/** Persist + apply the album layout preference. */
export function setConsoleAlbumLayout(layout: ConsoleAlbumLayout): void {
  const apply = () => {
    albumLayoutState.layout = layout;
  };
  if (recomposer !== undefined) {
    recomposer(apply);
  } else {
    apply();
  }
  try {
    storage()?.setItem(STORAGE_KEY, layout);
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
}
