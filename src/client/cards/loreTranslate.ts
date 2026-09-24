/**
 * THE LORE TRANSLATOR — the one `translate` the archive-block hosts inject into
 * the pure resolvers (`buildCardLoreModel` / `buildPartyLoreModel`).
 *
 * The lore corpora are PROSE, so they opt out of `translateText`'s "non-word"
 * guard — that guard is meant for card-render fragments (`x`, `3x`) and would
 * otherwise leave a whole archive entry that happens to be digits and a full
 * stop («42.» — AI Central) permanently untranslated.
 *
 * Lives apart from the resolvers on purpose: they import no i18n (unit-tested
 * with an injected function), this file is the client-side binding.
 */
import {translateText} from '@/client/directives/i18n';

export const translateLore = (englishText: string): string => translateText(englishText, {translateNonWordText: true});
