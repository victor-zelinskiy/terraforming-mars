/**
 * THE ONE CLIENT READER OF A CARD'S EXPANSION TEXT VARIANTS (`metadata.textVariants` — TR84 Titan Holdings: «…or Moon»
 * only when the Moon is in the game). The face prints icons; the printed sentence reaches the player through the
 * translation of its key — the dossier, the «Information» panel, the fullscreen viewer's rule blocks, the composer's
 * rule rows — so the variant is chosen at THAT one point (`translateText` asks `cardTextFor` first), never by an
 * `if (moon)` in a component.
 *
 * The game's expansions are module state, set by the shell with the translation context (`setTranslationContext` on
 * every applied player view); outside a game (the catalog, the card list) nothing is set and the full printed text
 * stands.
 */
import {getCards} from '@/client/cards/ClientCardManifest';
import {CardTextVariant, resolveCardText, TextVariantExpansions} from '@/common/cards/CardTextVariant';

let expansions: TextVariantExpansions | undefined;
/** Full printed key → the variants of it (built once, on the first ask inside a game). */
let byText: Map<string, ReadonlyArray<CardTextVariant>> | undefined;

/** The current game's expansions (`undefined` — no game: the printed card). */
export function setCardTextExpansions(next: TextVariantExpansions | undefined): void {
  expansions = next === undefined ? undefined : {moon: next.moon === true, venus: next.venus === true};
}

function variantsByText(): Map<string, ReadonlyArray<CardTextVariant>> {
  if (byText === undefined) {
    const map = new Map<string, Array<CardTextVariant>>();
    for (const card of getCards((c) => (c.metadata.textVariants?.length ?? 0) > 0)) {
      for (const variant of card.metadata.textVariants ?? []) {
        const list = map.get(variant.text) ?? [];
        list.push(variant);
        map.set(variant.text, list);
      }
    }
    byText = map;
  }
  return byText;
}

/**
 * The key to print for `key` in the current game — a variant's when the game lacks what the full text names, `key`
 * itself otherwise (every key that no card varies — the overwhelming case — returns at the first check).
 */
export function cardTextFor(key: string): string {
  if (expansions === undefined) {
    return key;
  }
  const variants = variantsByText().get(key);
  return variants === undefined ? key : resolveCardText(key, variants, expansions);
}
