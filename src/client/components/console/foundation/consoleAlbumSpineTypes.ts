/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `foundation/ConsoleAlbumSpine.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/foundation/ConsoleAlbumSpine.vue'` inside another SFC still works.
 */
/**
 * An album's page position (POSITION ONLY — a card-index range is an admin-paginator fact the player never needs).
 */
export type AlbumSpinePosition = {
  /** 1-based current page and the page count. */
  page: number,
  pages: number,
  canPrev: boolean,
  canNext: boolean,
};
