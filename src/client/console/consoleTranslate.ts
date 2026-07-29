/*
 * The i18n adapter the console's PURE presenters are handed.
 *
 * A presenter (`consolePlacementNextStep`, …) must not import the i18n
 * directive — that is what lets it run under the fast server test runner and
 * what lets a spec drive it with a real RU dictionary. So it declares a
 * `(key, params?) => string` port and the Vue side passes this.
 */

import {translateTextWithParams} from '@/client/directives/i18n';

/** Translate an English key, interpolating `${0}`, `${1}`, … from `params`. */
export function consoleTranslate(key: string, params?: ReadonlyArray<string>): string {
  return translateTextWithParams(key, params !== undefined ? [...params] : []);
}
