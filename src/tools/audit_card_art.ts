/*
 * CARD ART COVERAGE AUDIT (dev tool, ad-hoc).
 *
 * Lists every IN-SCOPE premium-face card (project + prelude) whose artwork
 * is still missing — i.e. whose art does not resolve to real per-card art
 * via `assets/card-images/<cardNumber>.webp` (mirroring the exact resolution
 * in src/client/cards/cardArt.ts, including the `reimplements` borrow: a
 * reissue with no art of its own inherits the base card's illustration).
 *
 * ALSO reports corporation art coverage separately — corporations render
 * premium across EVERY module (not just SCOPE_MODULES) and opportunistically
 * use real art when present, falling back to the wordmark identity zone
 * otherwise (see resolveArt() in premiumCardViewModel.ts) — so a missing
 * corp art is a cosmetic gap, not a hard scope violation.
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
const corpCards: Array<ScopeCard> = [];

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
      if (card.type === CardType.CORPORATION) {
        corpCards.push({name: card.name, module, type: card.type, cardNumber: md?.cardNumber});
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

const missingCorps = corpCards.filter((c) => !hasArt(c.name));
const byModuleCorp = new Map<GameModule, Array<ScopeCard>>();
for (const c of missingCorps) {
  const list = byModuleCorp.get(c.module) ?? [];
  list.push(c);
  byModuleCorp.set(c.module, list);
}

console.log('\n============= CORPORATION ART COVERAGE (all modules) =============');
console.log(`Corporations   : ${corpCards.length}`);
console.log(`With art       : ${corpCards.length - missingCorps.length}`);
console.log(`No real art    : ${missingCorps.length} (renders the wordmark identity zone instead)`);
console.log('====================================================================');
for (const module of [...byModuleCorp.keys()].sort()) {
  const list = (byModuleCorp.get(module) ?? []).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\n[${module}] — ${list.length} without art`);
  for (const c of list) {
    console.log(`  ${c.cardNumber ?? '(no cardNumber)'}\t${c.name}`);
  }
}
