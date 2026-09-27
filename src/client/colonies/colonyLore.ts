/**
 * COLONY LORE — the flavour line of a COLONY tile.
 *
 * The physical colony tile prints one sentence under its name («Our own moon
 * is the natural gate between the riches of Earth and the solar system
 * beyond»). The console dossier (`ConsoleColonyInspect`) shows it as the
 * archive entry, in the SAME block the fullscreen card viewer and the Turmoil
 * Redux party inspect use (`CardLoreAside`).
 *
 * This is the THIRD resolver over that block, beside `cardLore.ts` (by card
 * number) and `partyLore.ts` (by party name). A colony's sentence is NOT in a
 * corpus file: it is a field of the colony's OWN metadata
 * (`ColonyMetadata.lore`, set in `src/server/colonies/<Name>.ts` next to the
 * trade description) and rides the existing `make:cards` →
 * `genfiles/colonies.json` pipeline to the client. Co-location is the point —
 * an upstream change to a colony lands in the same diff as its lore, so the
 * text can never silently rot in a fork-only table.
 *
 *   ColonyMetadata.lore                  the ENGLISH sentence. English IS the
 *                                        i18n key (no `en/` locale).
 *   src/locales/<lang>/lore_texts.json   English → the localized sentence — the
 *                                        same file as the cards' and parties'
 *                                        lore, merged by make:json.
 *
 * PURITY: no Vue, no DOM, no i18n import — the localization function is
 * INJECTED (`buildColonyLoreModel(name, translate)`), as in the two siblings.
 */

import {ColonyName} from '@/common/colonies/ColonyName';
import {findColony} from '@/client/colonies/ClientColonyManifest';
import {LORE_FALLBACK_KEY, LoreModel, loreLengthTier} from '@/client/cards/cardLore';

/** The ENGLISH sentence for a colony. Undefined ⇔ its metadata carries none. */
export function colonyLoreSource(name: ColonyName | string): string | undefined {
  const lore = findColony(name)?.lore;
  return typeof lore === 'string' && lore.trim() !== '' ? lore : undefined;
}

// One warning per colony per session — see cardLore.ts.
const warnedMissing = new Set<string>();

function warnMissingLore(name: string): void {
  if (warnedMissing.has(name) || process.env.NODE_ENV === 'production') {
    return;
  }
  warnedMissing.add(name);
  console.warn(`[colony lore] no archive entry for "${name}" — its colony metadata declares no \`lore\`. Falling back to "${LORE_FALLBACK_KEY}".`);
}

/** Test seam: forget which colonies already warned. */
export function resetColonyLoreWarnings(): void {
  warnedMissing.clear();
}

/**
 * The display model for the archive block over a COLONY. `translate` is the
 * client's lore translator (`loreTranslate.ts` — injected so this stays pure).
 */
export function buildColonyLoreModel(name: ColonyName | string, translate: (englishText: string) => string): LoreModel {
  const source = colonyLoreSource(name);
  if (source === undefined) {
    warnMissingLore(name);
    const fallbackText = translate(LORE_FALLBACK_KEY);
    return {source: undefined, text: fallbackText, fallback: true, tier: loreLengthTier(fallbackText)};
  }
  const text = translate(source);
  return {source, text, fallback: false, tier: loreLengthTier(text)};
}
