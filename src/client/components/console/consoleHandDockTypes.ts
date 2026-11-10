/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleHandDock.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleHandDock.vue'` inside another SFC still works.
 */
import type {AlbumSpinePosition} from '@/client/components/console/foundation/consoleAlbumSpineTypes';

/**
 * The album spine's live state (undefined → the plain «КАРТЫ n/m» line).
 *
 * POSITION ONLY, deliberately: a card-index range («9–12 из 14») is an
 * admin-paginator fact the player never needs — the total already stands in
 * the header's «ВСЕ 14» chip and the page's own cards are on screen. What
 * they need is where they are and how far the album goes.
 */
export type HandDockAlbum = AlbumSpinePosition;
