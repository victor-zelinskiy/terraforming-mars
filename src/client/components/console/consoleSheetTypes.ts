/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleSheet.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleSheet.vue'` inside another SFC still works.
 */
import type {Color} from '@/common/Color';

export type ConsoleSheetRow = {
  key: string,
  /** 'header' = a non-selectable group caption (nav skips it). */
  kind?: 'header',
  /** Icon CSS class (e.g. a std-icon pictogram) — premium rows are never bare text. */
  icon?: string,
  /** English i18n key (or literal already-translated text). */
  title: string,
  /** Rule / effect description (translated via v-i18n). */
  sub?: string,
  /** Cost / progress annotation (already formatted). */
  meta?: string,
  available: boolean,
  /** English i18n key ('' → no line). */
  reason?: string,
  takenBy?: {color: Color, name: string},
};
