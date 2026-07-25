/**
 * CARD LORE — the flavour ("archive entry") text of a card.
 *
 * The corpus is a HAND-MAINTAINED pair of files, already shipped and already
 * guarded by tests; this module is the single production resolver over them:
 *
 *   assets/text/lore_texts.json      cardNumber → the ENGLISH lore sentence.
 *                                    English IS the i18n key (this fork has no
 *                                    `en/` locale — see CLAUDE.md).
 *   src/locales/<lang>/lore_texts.json
 *                                    English sentence → the localized one.
 *                                    Auto-merged into assets/locales/<lang>.json
 *                                    by make:json, so `translateText` resolves
 *                                    it with no extra plumbing.
 *
 * REIMPLEMENTS: a reissue (a promo/Ares variant of a base card) carries its own
 * `cardNumber` but usually no lore entry of its own — it borrows the source
 * card's, exactly like the artwork does. The recursion here mirrors
 * `cardArt.ts` `artKey()` (the canonical fork idiom) and adds the cycle guard
 * the coverage test uses, so a malformed metadata loop can never hang a render.
 *
 * PURITY: no Vue, no DOM, no i18n import — the localization function is
 * INJECTED (`buildCardLoreModel(name, translate)`), the same idiom the pure
 * view-models in this fork use. That keeps the whole resolution unit-testable
 * and keeps the lookup out of the render function.
 */

import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
// The English lore corpus. Keyed by the printed card number (`metadata.cardNumber`).
import loreTexts from '../../../assets/text/lore_texts.json';

const LORE_BY_CARD_NUMBER: Readonly<Record<string, string>> = loreTexts;

/**
 * The heading of the block. An i18n KEY — never render it raw, and never
 * hardcode the localized wording in a component or a stylesheet.
 */
export const LORE_HEADING_KEY = 'FROM THE ARCHIVES';

/**
 * Shown INSTEAD of a missing lore text. The block always renders (a premium
 * composition must never collapse into an empty container) — it just reads
 * honestly and takes the muted style. Every card in the current premium-face
 * scope has real lore; `tests/client/components/card/cardLore.spec.ts` fails
 * the moment one starts falling back.
 */
export const LORE_FALLBACK_KEY = 'No archive entry is available.';

/**
 * Typographic tiers. A one-liner («Сорок два.») and a corporation's paragraph
 * need different optical compensation — the block never scrolls or truncates,
 * so the TEXT adapts instead. Measured on the LOCALIZED string (a translation
 * can be much longer than its English key).
 */
export type LoreLengthTier = 'short' | 'regular' | 'extended';

/** Up to and including this many characters → `short`. */
export const LORE_SHORT_MAX = 65;
/** Up to and including this many characters → `regular`; beyond → `extended`. */
export const LORE_REGULAR_MAX = 170;

export type CardLoreModel = {
  /** The ENGLISH source sentence (the i18n key), or undefined when unknown. */
  source: string | undefined,
  /** The string to render. Never empty — falls back to the localized notice. */
  text: string,
  /** True ⇔ `text` is the fallback notice rather than real lore. */
  fallback: boolean,
  /** Typographic tier of `text`. */
  tier: LoreLengthTier,
};

/** Locales written in Cyrillic — they take the Literata face (see card_lore.less). */
const CYRILLIC_LOCALES: ReadonlySet<string> = new Set(['ru', 'ua', 'bg']);

/** Which literary face the block uses. Chosen by the ACTIVE LOCALE, never by
 *  sniffing characters out of the string (a Russian entry may be pure Latin). */
export type LoreScript = 'cyrillic' | 'latin';

export function loreScriptForLocale(lang: string | undefined): LoreScript {
  return lang !== undefined && CYRILLIC_LOCALES.has(lang) ? 'cyrillic' : 'latin';
}

/**
 * The ENGLISH lore sentence for a card, borrowing through `reimplements` when
 * the card has no entry of its own. Undefined ⇔ neither the card nor anything
 * it reimplements has lore.
 */
export function cardLoreSource(name: CardName, seen: Set<CardName> = new Set()): string | undefined {
  if (seen.has(name)) {
    return undefined; // metadata cycle — bail instead of recursing forever
  }
  seen.add(name);
  const metadata = getCard(name)?.metadata;
  if (metadata === undefined) {
    return undefined;
  }
  const cardNumber = metadata.cardNumber;
  const own = cardNumber === undefined ? undefined : LORE_BY_CARD_NUMBER[cardNumber];
  if (typeof own === 'string' && own.trim() !== '') {
    return own;
  }
  const reimplements = metadata.reimplements;
  return reimplements === undefined ? undefined : cardLoreSource(reimplements, seen);
}

export function loreLengthTier(text: string): LoreLengthTier {
  const length = text.trim().length;
  if (length <= LORE_SHORT_MAX) {
    return 'short';
  }
  return length <= LORE_REGULAR_MAX ? 'regular' : 'extended';
}

// One warning per card per session — a render runs on every browse step and an
// animation frame must never be a logging loop.
const warnedMissing = new Set<CardName>();

function warnMissingLore(name: CardName): void {
  if (warnedMissing.has(name) || process.env.NODE_ENV === 'production') {
    return;
  }
  warnedMissing.add(name);
  console.warn(`[card lore] no archive entry for "${name}" — the lore resolver returned nothing (assets/text/lore_texts.json, incl. the reimplements borrow). Falling back to "${LORE_FALLBACK_KEY}".`);
}

/** Test seam: forget which cards already warned. */
export function resetLoreWarnings(): void {
  warnedMissing.clear();
}

/**
 * The display model for the fullscreen archive block. `translate` is the
 * client's `translateText` (injected so this module stays pure) — it maps the
 * English key to the active locale and returns the key itself for `en`.
 */
export function buildCardLoreModel(name: CardName, translate: (englishText: string) => string): CardLoreModel {
  const source = cardLoreSource(name);
  if (source === undefined) {
    warnMissingLore(name);
    const fallbackText = translate(LORE_FALLBACK_KEY);
    return {source: undefined, text: fallbackText, fallback: true, tier: loreLengthTier(fallbackText)};
  }
  // The lore string is rendered VERBATIM: it may already contain «», ‘’, an
  // em dash, an ellipsis or a full quotation (the Kennedy entry). The block's
  // quotation marks are decoration drawn around it, never punctuation added
  // to it.
  const text = translate(source);
  return {source, text, fallback: false, tier: loreLengthTier(text)};
}
