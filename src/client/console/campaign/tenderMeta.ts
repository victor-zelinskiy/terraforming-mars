// Campaign «ТЕНДЕРЫ» — the presentation registry (`common/campaign/tenders.ts`
// is the rule). ONE row per tender id: its printed name, its rule in one
// sentence, its lore line, its lot number and the glyph the document wears.
// Every surface that shows a tender (the bidding's table, the podium plaque,
// the start's «НАСЛЕДИЕ › ТЕНДЕРЫ» page, the campaign map) reads this table —
// a new tender is a new row here and nothing else on the client; the compiler
// refuses an id without one.

import {TENDER_CATALOG, TENDER_NAME_KEY, TenderId, TenderTier, TenderWindow, tenderDef} from '@/common/campaign/tenders';

export type TenderGlyph = 'prelude' | 'corporation' | 'project' | 'legacy' | 'megacredit' | 'dice';

export type TenderMeta = {
  id: TenderId;
  /** The printed name (English i18n key). */
  nameKey: string;
  /** The rule in one sentence (English i18n key). */
  ruleKey: string;
  /** The lore line (English i18n key). */
  loreKey: string;
  /** The lot number printed on the document — fixed per kind. */
  lot: number;
  /** The family glyph on the document's emblem. */
  glyph: TenderGlyph;
};

const META: Record<TenderId, Omit<TenderMeta, 'id' | 'nameKey'>> = {
  programExtension: {
    ruleKey: 'Carry one prelude you played in the previous mission into the finale — it is played again as your extra prelude.',
    loreKey: 'The programme was a success. So we are running it again — same budget, half the oversight.',
    lot: 1, glyph: 'prelude',
  },
  additionalPrelude: {
    ruleKey: 'At the finale\'s start choose 3 preludes of those dealt instead of 2.',
    loreKey: 'Three opening moves. The Committee calls it initiative; the auditors call it a footnote.',
    lot: 2, glyph: 'prelude',
  },
  restructuring: {
    ruleKey: 'At the finale\'s start 2 corporations are dealt to you; take one of them in place of any corporation of your lineage, or decline.',
    loreKey: 'Nobody was fired. The division was simply reassigned to another planet.',
    lot: 3, glyph: 'corporation',
  },
  extendedLegacy: {
    ruleKey: 'One more legacy seat: carry 3 project cards into the finale instead of 2.',
    loreKey: 'One more crate cleared customs. Don\'t ask what the manifest said.',
    lot: 4, glyph: 'legacy',
  },
  preludeReview: {
    ruleKey: 'At the finale\'s start keep at most one of your dealt preludes and redeal the rest once.',
    loreKey: 'The first proposals were fine. The second proposals were ours.',
    lot: 5, glyph: 'prelude',
  },
  projectReview: {
    ruleKey: 'At the finale\'s start keep at most one of your dealt projects and redeal the rest once.',
    loreKey: 'Ten projects landed on the desk. The desk was found to be the wrong desk.',
    lot: 6, glyph: 'project',
  },
  openCall: {
    ruleKey: '6 preludes are dealt to you at the finale\'s start instead of 4.',
    loreKey: 'More applicants than chairs. The Committee considers this healthy.',
    lot: 7, glyph: 'prelude',
  },
  broadPortfolio: {
    ruleKey: '14 project cards are dealt to you at the finale\'s start instead of 10.',
    loreKey: 'Fourteen folders instead of ten. The intern is no longer with us.',
    lot: 8, glyph: 'project',
  },
  researchSubsidy: {
    ruleKey: 'Every card of your starting hand in the finale costs 1 M€ less.',
    loreKey: 'One megacredit less per card. Science has never been so affordable — or so suspicious.',
    lot: 9, glyph: 'megacredit',
  },
  gamble: {
    ruleKey: 'At the finale\'s start redeal all your preludes and all your projects — nothing of the first deal stays.',
    loreKey: 'Everything back in the box. Shake. Hope.',
    lot: 10, glyph: 'dice',
  },
};

export function tenderMeta(id: TenderId): TenderMeta {
  return {id, nameKey: TENDER_NAME_KEY[id], ...META[id]};
}

/** The window printed on the document (English i18n keys). */
export const TENDER_WINDOW_KEY: Readonly<Record<TenderWindow, string>> = {
  legacy: 'Legacy step',
  start: 'Finale start',
};

/** The tier word printed on the document (English i18n keys). */
export const TENDER_TIER_KEY: Readonly<Record<TenderTier, string>> = {
  decisive: 'Decisive',
  notable: 'Notable',
  minor: 'Minor',
  gamble: 'Gamble tier',
};

/** The tier's chevrons — the rank by form (the title emblems' precedent); the gamble wears a die, not chevrons. */
export function tenderChevrons(tier: TenderTier): number {
  switch (tier) {
  case 'decisive': return 3;
  case 'notable': return 2;
  case 'minor': return 1;
  default: return 0;
  }
}

export function tenderWindowKey(id: TenderId): string {
  return TENDER_WINDOW_KEY[tenderDef(id).window];
}

export function tenderTierKey(id: TenderId): string {
  return TENDER_TIER_KEY[tenderDef(id).tier];
}

/** The document's family glyph — ONE stroke path per family (24 × 24, drawn in the document's ink). */
export const TENDER_GLYPH_PATH: Readonly<Record<TenderGlyph, string>> = {
  prelude: 'M5 4h14v16H5z M9 9h6 M9 13h6 M9 17h3',
  corporation: 'M4 20h16 M6 20V8l6-4 6 4v12 M10 20v-5h4v5 M9 11h2 M13 11h2',
  project: 'M7 3h10l3 3v15H7z M17 3v3h3 M10 11h7 M10 15h7',
  legacy: 'M3 8h18v12H3z M3 8l3-4h12l3 4 M12 12v4 M9 14h6',
  megacredit: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M9 9h6 M9 12h6 M10.5 7v10',
  dice: 'M5 5h14v14H5z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
};

/** Every id has its row — the guard the spec runs. */
export function tenderMetaIds(): ReadonlyArray<TenderId> {
  return Object.keys(TENDER_CATALOG) as Array<TenderId>;
}
