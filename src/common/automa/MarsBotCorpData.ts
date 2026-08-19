import {CardName} from '../cards/CardName';
import {Tag} from '../cards/Tag';
import {BonusCardId, MARS_BOT_CORP_IDS, MarsBotCorpId} from './AutomaTypes';
import {BonusCardEffectLine} from './BonusCardData';

export {MARS_BOT_CORP_IDS, MarsBotCorpId} from './AutomaTypes';

/**
 * MarsBot corporations (Automa expansion, Rule Book B "Adding Corporations").
 *
 * A MarsBot corporation is its OWN game entity — never the human corporation
 * with tweaked numbers. The `original` reference is exactly the four official
 * links to the human card: identity (name/logo), art, lore, and the
 * corporation-selection collision rule ("If the same corporation was selected
 * as the one you're playing, select another" — RB-B Setup 1). No human
 * gameplay field (starting M€, first action, human tags, discounts) ever
 * leaks through it. The id enum lives in `AutomaTypes.ts` (official card
 * numbers C01–C46, the `BonusCardId` convention).
 */

/**
 * A resource physically stored ON the MarsBot corporation card (Ecoline's
 * plant, Spire's science). Its own union — plants are not a `CardResource`
 * in this engine, and the bot's corp storage is not a card-resource pool.
 */
export type MarsBotCorpResource = 'plant' | 'science';

/**
 * How the bot picks (and protects) cards in the research draft — RB-B "Draft
 * Priority". Data, not behavior: the server's draft resolver interprets it,
 * the client only labels it.
 * - `tags`: priority tag chain ("a > b"); the Wildcard tag never matches
 *   (RB-B p.2).
 * - `mostExpensive` / `mostTags`: the RB-B special cases (Credicor / Spire).
 * - `leastAdvancedTrack`: Aridor's rule — re-evaluated each generation.
 */
export type MarsBotDraftPriority =
  | {type: 'tags', tags: ReadonlyArray<Tag>}
  | {type: 'mostExpensive'}
  | {type: 'mostTags'}
  | {type: 'leastAdvancedTrack'};

/** One kicker box of the printed MarsBot corporation card (RB-B anatomy). */
export type MarsBotCorpSection = {
  kind: 'draftPriority' | 'setup' | 'effect' | 'beforeActionPhase' | 'roundStart';
  lines: ReadonlyArray<BonusCardEffectLine>;
};

/**
 * The full printed definition of one MarsBot corporation — everything both
 * sides need to KNOW (the server adds behavior on top in
 * `src/server/automa/corps/`). Only the boxes the physical card actually
 * prints exist here — no fake defaults (RB-B anatomy: "Not all corporations
 * use all fields").
 */
export type MarsBotCorpInfo = {
  id: MarsBotCorpId;
  /** Official printed card number — doubles as the enum value. */
  cardNumber: string;
  /** The original human corporation: identity, art, lore, collision mapping. */
  original: CardName;
  /**
   * Starting tags printed on the corp card. Resolved at setup "as if they are
   * shown on a card revealed during play" (RB-B Setup 4) — i.e. each advances
   * its MarsBot track once, which IS how the bot owns tags from then on.
   */
  startingTags: ReadonlyArray<Tag>;
  draftPriority?: MarsBotDraftPriority;
  /** The resource this corporation stores on its own card, if any. */
  resource?: MarsBotCorpResource;
  /** Corporation-specific bonus cards this corp brings into play (RB-B Setup 5
   *  returns all others to the box). */
  corpBonusCards: ReadonlyArray<BonusCardId>;
  /** The printed rule boxes, in printed order (display data; EN i18n keys). */
  sections: ReadonlyArray<MarsBotCorpSection>;
};

/**
 * Printed card data, transcribed from the official cards (owner-verified
 * scans; см. docs/AUTOMA_DATA_AUDIT.md §10):
 *  - C01 Credicor, C02 Ecoline — MarsBot corporation cards C01/C02;
 *  - C45 Spire — MarsBot corporation card C45 (starting tag: Earth);
 *  - RB-B p.2 "Special Cases" gives Credicor/Spire their draft rules verbatim.
 */
const CORP_INFO: Readonly<Record<MarsBotCorpId, MarsBotCorpInfo>> = {
  [MarsBotCorpId.C01_CREDICOR]: {
    id: MarsBotCorpId.C01_CREDICOR,
    cardNumber: 'C01',
    original: CardName.CREDICOR,
    startingTags: [],
    draftPriority: {type: 'mostExpensive'},
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Most expensive'}]},
      {kind: 'effect', lines: [
        {icon: 'megacredits', text: 'When resolving a card with a cost of 20 M€ or more, MarsBot gains ${0} M€', params: ['4']},
      ]},
    ],
  },
  [MarsBotCorpId.C02_ECOLINE]: {
    id: MarsBotCorpId.C02_ECOLINE,
    cardNumber: 'C02',
    original: CardName.ECOLINE,
    startingTags: [],
    resource: 'plant',
    corpBonusCards: [BonusCardId.B23_RAPID_SPROUTING],
    sections: [
      {kind: 'beforeActionPhase', lines: [
        {icon: 'deck', text: 'Add Rapid Sprouting to MarsBot\'s action deck'},
        {icon: 'plants', text: 'Rapid Sprouting grows a plant on this card, then turns it into a greenery and an oxygen step', muted: true},
      ]},
    ],
  },
  [MarsBotCorpId.C45_SPIRE]: {
    id: MarsBotCorpId.C45_SPIRE,
    cardNumber: 'C45',
    original: CardName.SPIRE,
    startingTags: [Tag.EARTH],
    draftPriority: {type: 'mostTags'},
    resource: 'science',
    corpBonusCards: [],
    sections: [
      {kind: 'draftPriority', lines: [{text: 'Most tags'}]},
      {kind: 'effect', lines: [
        {icon: 'science', text: 'When resolving a card with 2 or more tags, place a science resource on this card'},
      ]},
      {kind: 'beforeActionPhase', lines: [
        {icon: 'science', text: 'With ${0} or more science resources here, remove ${1} of them', params: ['10', '10']},
        {icon: 'city', text: 'MarsBot places a city tile and gains 1 TR'},
      ]},
    ],
  },
};

export function marsBotCorpInfo(id: MarsBotCorpId): MarsBotCorpInfo {
  return CORP_INFO[id];
}

/** The corp that owns a corporation-specific bonus card (B22–B32), if implemented. */
export function corpOwningBonusCard(id: BonusCardId): MarsBotCorpInfo | undefined {
  return MARS_BOT_CORP_IDS.map(marsBotCorpInfo).find((corp) => corp.corpBonusCards.includes(id));
}

/**
 * Per-corporation statistic counters, serialized with the bot and shipped to
 * the client as open information. Missing keys read as 0. The keys are a
 * closed vocabulary so the endgame insight layer works with STRUCTURED facts,
 * never display text:
 *
 * Shared draft counters (any corp with a draft priority):
 *  - draftPriorityPicks   — bot draft picks decided by the corp's priority;
 *  - draftPickTiesBroken  — picks where several cards tied and rng decided;
 *  - draftProtectionSaves — post-draft discards where the priority CHANGED the
 *                           discarded card (the shuffled-first card was saved);
 *  - draftNoDiscardRounds — the rare "all 4 equal → nothing discarded" case;
 *  - fiveCardDecks        — action decks that ended up with 5 cards because of it.
 *
 * Credicor: credicorTriggers / credicorMc (the ≥20 M€ effect).
 * Ecoline:  sproutingsPlayed / plantsAdded / plantsSpent / greeneries /
 *           oxygenSteps / plantsLostToOpponents.
 * Spire:    scienceAdded / scienceSpent / citiesPlaced / trGained /
 *           multiTagCards (cards with 2+ tags resolved).
 */
export type MarsBotCorpStats = Partial<Record<string, number>>;

/** The public per-corp model the client receives (open table information). */
export type MarsBotCorpModel = {
  id: MarsBotCorpId;
  /** Original human corporation — identity/art/lore resolve through it. */
  original: CardName;
  startingTags: ReadonlyArray<Tag>;
  resource?: MarsBotCorpResource;
  /** Resources currently ON the corporation card (Ecoline plant, Spire science). */
  resources: number;
  stats: MarsBotCorpStats;
};

// ─────────────────────────────────────────────────────────────────────────────
// Display view — the client's render feed (mirrors `buildBonusCardView`).
// ─────────────────────────────────────────────────────────────────────────────

/** Kicker labels, EN i18n keys (RB-B anatomy names). */
export const CORP_SECTION_LABEL: Readonly<Record<MarsBotCorpSection['kind'], string>> = {
  draftPriority: 'Draft priority',
  setup: 'Corporation setup',
  effect: 'Corporation effect',
  beforeActionPhase: 'Before action phase',
  roundStart: 'Round start',
};

export type MarsBotCorpView = {
  id: MarsBotCorpId;
  cardNumber: string;
  original: CardName;
  startingTags: ReadonlyArray<Tag>;
  resource?: MarsBotCorpResource;
  sections: ReadonlyArray<MarsBotCorpSection>;
};

export function buildMarsBotCorpView(id: MarsBotCorpId): MarsBotCorpView {
  const info = marsBotCorpInfo(id);
  return {
    id: info.id,
    cardNumber: info.cardNumber,
    original: info.original,
    startingTags: info.startingTags,
    resource: info.resource,
    sections: info.sections,
  };
}
