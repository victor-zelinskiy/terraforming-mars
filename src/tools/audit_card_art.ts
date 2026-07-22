/*
 * CARD ART COVERAGE AUDIT (dev tool, ad-hoc).
 *
 * Lists every IN-SCOPE premium-face card (project + prelude, EXCLUDING
 * corporations) whose artwork is still missing — i.e. whose art does not
 * resolve to real per-card art via `assets/card-images/<cardNumber>.webp`
 * (mirroring the exact resolution in src/client/cards/cardArt.ts, including
 * the `reimplements` borrow: a reissue with no art of its own inherits the
 * base card's illustration).
 *
 * Run: npx tsx src/tools/audit_card_art.ts
 */
import '../server/init';
import * as fs from 'fs';
import {ALL_MODULE_MANIFESTS} from '../server/cards/AllManifests';
import {CardManifest} from '../server/cards/ModuleManifest';
import {ICard} from '../server/cards/ICard';
import {GameModule} from '../common/cards/GameModule';
import {CardType} from '../common/cards/CardType';

// The premium-face scope (mirrors PremiumCardsPlayground SCOPE_MODULES).
const SCOPE_MODULES: ReadonlySet<GameModule> = new Set(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
// Project + prelude only — corporations are EXCLUDED per the audit request
// (they render an identity/wordmark zone instead of art).
const SCOPE_TYPES: ReadonlySet<CardType> = new Set([CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT, CardType.PRELUDE]);

const available: ReadonlySet<string> = new Set<string>(
  JSON.parse(fs.readFileSync('src/genfiles/cardArtManifest.json', 'utf8')) as Array<string>,
);

type Meta = {cardNumber?: string; reimplements?: string | Array<string>};
const metaByName = new Map<string, Meta>();

type ScopeCard = {name: string; module: GameModule; type: CardType; cardNumber?: string};
const scopeCards: Array<ScopeCard> = [];

for (const manifest of ALL_MODULE_MANIFESTS) {
  const module = manifest.module;
  const decks: Array<[boolean, CardManifest<ICard>]> = [
    [true, manifest.projectCards],
    [true, manifest.preludeCards],
    [false, manifest.corporationCards],
    [false, manifest.ceoCards],
    [false, manifest.standardActions],
    [false, manifest.standardProjects],
  ];
  for (const [inScopeDeck, deck] of decks) {
    for (const factory of CardManifest.values(deck)) {
      const card = new factory.Factory() as ICard;
      if (card.type === CardType.PROXY) {
        continue; // Proxy cards throw on metadata access — not real cards.
      }
      const md = card.metadata as unknown as Meta | undefined;
      metaByName.set(card.name, {cardNumber: md?.cardNumber, reimplements: md?.reimplements});
      if (inScopeDeck && SCOPE_MODULES.has(module) && SCOPE_TYPES.has(card.type)) {
        scopeCards.push({name: card.name, module, type: card.type, cardNumber: md?.cardNumber});
      }
    }
  }
}

function hasArt(name: string, seen: Set<string> = new Set()): boolean {
  if (seen.has(name)) {
    return false;
  }
  seen.add(name);
  const md = metaByName.get(name);
  if (md === undefined) {
    return false;
  }
  if (md.cardNumber !== undefined && available.has(md.cardNumber)) {
    return true;
  }
  const re = md.reimplements;
  if (re !== undefined) {
    const targets = Array.isArray(re) ? re : [re];
    return targets.some((t) => hasArt(t, seen));
  }
  return false;
}

const missing = scopeCards.filter((c) => !hasArt(c.name));

// Group the missing cards by module for a readable worklist.
const byModule = new Map<GameModule, Array<ScopeCard>>();
for (const c of missing) {
  const list = byModule.get(c.module) ?? [];
  list.push(c);
  byModule.set(c.module, list);
}

console.log('================ CARD ART COVERAGE AUDIT ================');
console.log(`Scope: modules {${[...SCOPE_MODULES].join(', ')}}, types {project + prelude} (corporations EXCLUDED)`);
console.log(`In-scope cards : ${scopeCards.length}`);
console.log(`With art       : ${scopeCards.length - missing.length}`);
console.log(`MISSING art    : ${missing.length}`);
console.log('========================================================');
for (const module of [...byModule.keys()].sort()) {
  const list = (byModule.get(module) ?? []).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\n[${module}] — ${list.length} missing`);
  for (const c of list) {
    // CardType is a STRING enum — the value IS the readable label.
    console.log(`  ${c.cardNumber ?? '(no cardNumber)'}\t${c.type}\t${c.name}`);
  }
}
