/**
 * PARTY LORE — the flavour text of a Turmoil Redux PARTY.
 *
 * The rulebook's «Meet the parties» paragraph: WHO the faction is, never what
 * it does — a party's effect and action live in its plaque and in the rules
 * panel, and the archive block must never duplicate them.
 *
 * This is the SECOND resolver over the archive block (`CardLoreAside`), beside
 * `cardLore.ts`. A party has no `cardNumber` and no `reimplements` chain, so
 * it does not go through the card resolver (whose contract is «by printed
 * card number»): it has its own corpus keyed by the party's name and its own
 * lookup, and hands the block the SAME `LoreModel` a card does. Everything the
 * block draws — heading, marks, faces — is shared, and the length ladder is
 * `loreLengthTier` from cardLore.ts: one ladder for both corpora.
 *
 *   assets/text/party_lore_texts.json    party → the ENGLISH paragraph. English
 *                                        IS the i18n key (no `en/` locale).
 *   src/locales/<lang>/lore_texts.json   English → the localized paragraph — the
 *                                        same file as the cards' lore, merged by
 *                                        make:json: one pipeline, no new plumbing.
 *
 * PURITY: no Vue, no DOM, no i18n import — the localization function is
 * INJECTED (`buildPartyLoreModel(party, translate)`), as in cardLore.ts.
 */

import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {LORE_FALLBACK_KEY, LoreModel, loreLengthTier} from '@/client/cards/cardLore';
// The English party corpus. Keyed by the party's name (`PartyName` value).
import partyLoreTexts from '../../../assets/text/party_lore_texts.json';

const LORE_BY_PARTY: Readonly<Record<string, string>> = partyLoreTexts;

/** The ENGLISH paragraph for a party. Undefined ⇔ the corpus has no entry. */
export function partyLoreSource(party: ReduxParty): string | undefined {
  const own = LORE_BY_PARTY[party];
  return typeof own === 'string' && own.trim() !== '' ? own : undefined;
}

// One warning per party per session — see cardLore.ts.
const warnedMissing = new Set<string>();

function warnMissingLore(party: string): void {
  if (warnedMissing.has(party) || process.env.NODE_ENV === 'production') {
    return;
  }
  warnedMissing.add(party);
  console.warn(`[party lore] no archive entry for "${party}" — assets/text/party_lore_texts.json has no paragraph for it. Falling back to "${LORE_FALLBACK_KEY}".`);
}

/** Test seam: forget which parties already warned. */
export function resetPartyLoreWarnings(): void {
  warnedMissing.clear();
}

/**
 * The display model for the archive block over a PARTY. `translate` is the
 * client's lore translator (injected so this module stays pure).
 */
export function buildPartyLoreModel(party: ReduxParty, translate: (englishText: string) => string): LoreModel {
  const source = partyLoreSource(party);
  if (source === undefined) {
    warnMissingLore(party);
    const fallbackText = translate(LORE_FALLBACK_KEY);
    return {source: undefined, text: fallbackText, fallback: true, tier: loreLengthTier(fallbackText)};
  }
  const text = translate(source);
  return {source, text, fallback: false, tier: loreLengthTier(text)};
}
