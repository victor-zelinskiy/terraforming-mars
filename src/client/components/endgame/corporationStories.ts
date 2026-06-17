/*
 * Corporation Story Registry (Iteration 13) — the hand-authored IDENTITY layer.
 *
 * A corporation is not an ordinary card: it sets the start, may carry a passive rule
 * and an activatable action, and usually defines a player's whole plan. The measured
 * numbers come from the event stream (the `corporationImpact` fact, built in
 * common/events/endgameFacts.ts); this module supplies the KNOWLEDGE the stream can't:
 * each in-scope corporation's ARCHETYPE (what it wants to be), its starting CAPITAL
 * (static reference data — printed on the card), whether it has an activatable ACTION,
 * and which generic insight family its main story OVERLAPS (so the corp insight can
 * suppress a redundant generic economy/colony/action card). The analyzer
 * (insightEngine.analyzeCorporationImpact) combines the measured fact + this profile to
 * tell a premium, spirit-led story — but only when the corporation MATTERED.
 *
 * Design contract (mirrors specialCardStories / gameStoryDna):
 *   • PURE — no Vue / DOM / i18n / card manifest. Texts are English i18n KEYS. The
 *     starting-capital numbers are verified against the manifest by a coverage test.
 *   • NO runtime dependency on insightEngine (only CardName) → no module cycle.
 *   • SCOPE = base, Corporate Era, promo, Venus, Colonies, Prelude 1 (the project's
 *     current scope). A corporation NOT in the registry degrades to a generic measured
 *     insight in the analyzer; widen the registry when an expansion enters scope.
 */
import {CardName} from '@/common/cards/CardName';

/**
 * The 17 corporation ARCHETYPES — the spirit/intended-style families a corporation can
 * belong to. Drives the engine flavour text + the player-arc label.
 */
export type CorporationArchetype =
  | 'capitalStarter' // big opening budget — early tempo (Credicor, Polyphemos)
  | 'discountHouse' // cost reduction economy (Teractor, Thorgate, Cheung Shing)
  | 'metalEconomy' // steel / building economy (Mining Guild, Manutech)
  | 'spaceEngine' // titanium / space / Jovian (Saturn Systems, PhoboLog, Kuiper)
  | 'energyEngine' // energy / heat economy (Helion, Thorgate-ish)
  | 'plantEngine' // plant / greenery tempo (Ecoline)
  | 'cityEngine' // city / board / land control (Tharsis, Philares, Arcadian, PolderTech)
  | 'colonyEngine' // colony / trade (Poseidon)
  | 'cardFlow' // card flow / science / draw (Point Luna, Pharmacy Union)
  | 'tagFlex' // requirement / tag flexibility (Inventrix, Aridor, Morning Star)
  | 'standardProjectEngine' // standard projects as the plan
  | 'eventTempo' // event / one-shot tempo (Interplanetary Cinematics)
  | 'actionEngine' // repeatable blue-card action (Viron, UNMI, Tycho, Factorum, Robinson)
  | 'disruption' // attack / pressure / insurance (Mons Insurance)
  | 'terraformEngine' // profits FROM terraforming the planet (Aphrodite, UNMI-style)
  | 'cardResourceEngine' // microbe / animal / floater / asteroid on the corp card
  | 'generalist'; // flexible / no single defining engine (Beginner, Vitor)

/** A corporation's hand-authored profile. */
export type CorporationProfile = {
  archetype: CorporationArchetype;
  /** Starting M€ (static — verified against the manifest by a coverage test). */
  startingMegacredits: number;
  /** Whether the corporation has an activatable corporate ACTION. */
  hasAction: boolean;
  /**
   * The generic insight family this corp's MAIN story overlaps with — so the corp
   * insight can dedup it (the corp card replaces the generic one). Absent → the corp
   * story stands on its own key (no generic to suppress).
   */
  dedup?: 'economy' | 'colony' | 'action';
};

/** Short i18n labels for the archetype (the player-arc chip + the detail title). */
export const ARCHETYPE_LABEL: Readonly<Record<CorporationArchetype, string>> = {
  capitalStarter: 'Capital Starter',
  discountHouse: 'Discount House',
  metalEconomy: 'Metal Economy',
  spaceEngine: 'Space Engine',
  energyEngine: 'Power Engine',
  plantEngine: 'Greenery Engine',
  cityEngine: 'City Builder',
  colonyEngine: 'Colony Engine',
  cardFlow: 'Card Flow',
  tagFlex: 'Tag Flexibility',
  standardProjectEngine: 'Standard Project Engine',
  eventTempo: 'Event Tempo',
  actionEngine: 'Action Engine',
  disruption: 'Disruption',
  terraformEngine: 'Terraforming Engine',
  cardResourceEngine: 'Resource Engine',
  generalist: 'Flexible Base',
};

/**
 * The engine HEADLINE per archetype (i18n KEYS) — the spirit of "this corporation did
 * its job". Params are always [0]=player name, [1]=corporation (a card token); the
 * measured value rides an EVIDENCE CHIP, not the prose, so it stays clean + honest.
 */
export const ARCHETYPE_ENGINE_TEXT: Readonly<Record<CorporationArchetype, string>> = {
  capitalStarter: '${1} was a war chest: ${0} turned a heavy opening budget into a faster, bolder game.',
  discountHouse: 'Every card came cheaper for ${0} — ${1} turned a standing discount into a real economy.',
  metalEconomy: 'Steel never sat idle: ${1} fed ${0}’s building tempo all game.',
  spaceEngine: '${1} pointed ${0} at the stars — titanium and space compounding into an orbital economy.',
  energyEngine: '${1} ran on power: ${0} turned energy and heat into a working economy.',
  plantEngine: '${1} grew the board for ${0}: greenery and oxygen were the plan.',
  cityEngine: '${1} built the planet: ${0}’s cities and tiles were the engine.',
  colonyEngine: '${1} made the colonies a private economy: ${0} traded them into the lead.',
  cardFlow: '${1} kept the cards coming: ${0} drew the deck into an engine.',
  tagFlex: '${1} bent the rules for ${0}: flexible tags and requirements opened plays others couldn’t make.',
  standardProjectEngine: '${1} leaned on standard projects: ${0} terraformed by infrastructure, not combos.',
  eventTempo: '${1} ran on events: ${0} turned one-shot plays into relentless tempo.',
  actionEngine: '${1} was a button worth pressing: ${0} fired its corporate action again and again.',
  disruption: '${1} played the table, not just the board: ${0} leaned on it to pressure opponents.',
  terraformEngine: '${1} profited from the planet itself: ${0} turned terraforming into the corporation’s engine.',
  cardResourceEngine: '${1} farmed its own resources: ${0} grew the corporation card into an engine.',
  generalist: '${1} gave ${0} a flexible base — no single engine, just room to build any plan.',
};

/**
 * The in-scope corporation registry. Starting-capital values are taken from the card
 * files and verified against the manifest by tests/.../corporationStories coverage.
 */
export const CORPORATION_REGISTRY: Partial<Record<CardName, CorporationProfile>> = {
  // ── Base (11) ──
  [CardName.BEGINNER_CORPORATION]: {archetype: 'generalist', startingMegacredits: 42, hasAction: false},
  [CardName.CREDICOR]: {archetype: 'capitalStarter', startingMegacredits: 57, hasAction: false, dedup: 'economy'},
  [CardName.ECOLINE]: {archetype: 'plantEngine', startingMegacredits: 36, hasAction: false},
  [CardName.HELION]: {archetype: 'energyEngine', startingMegacredits: 42, hasAction: false, dedup: 'economy'},
  [CardName.INTERPLANETARY_CINEMATICS]: {archetype: 'eventTempo', startingMegacredits: 30, hasAction: false},
  [CardName.INVENTRIX]: {archetype: 'tagFlex', startingMegacredits: 45, hasAction: false},
  [CardName.MINING_GUILD]: {archetype: 'metalEconomy', startingMegacredits: 30, hasAction: false},
  [CardName.PHOBOLOG]: {archetype: 'spaceEngine', startingMegacredits: 23, hasAction: false, dedup: 'economy'},
  [CardName.THARSIS_REPUBLIC]: {archetype: 'cityEngine', startingMegacredits: 40, hasAction: false},
  [CardName.THORGATE]: {archetype: 'energyEngine', startingMegacredits: 48, hasAction: false, dedup: 'economy'},
  [CardName.UNITED_NATIONS_MARS_INITIATIVE]: {archetype: 'terraformEngine', startingMegacredits: 40, hasAction: true, dedup: 'action'},

  // ── Corporate Era (2) ──
  [CardName.SATURN_SYSTEMS]: {archetype: 'spaceEngine', startingMegacredits: 42, hasAction: false},
  [CardName.TERACTOR]: {archetype: 'discountHouse', startingMegacredits: 60, hasAction: false, dedup: 'economy'},

  // ── Promo (11) ──
  [CardName.ARCADIAN_COMMUNITIES]: {archetype: 'cityEngine', startingMegacredits: 40, hasAction: true},
  [CardName.ASTRODRILL]: {archetype: 'cardResourceEngine', startingMegacredits: 35, hasAction: true, dedup: 'action'},
  [CardName.FACTORUM]: {archetype: 'actionEngine', startingMegacredits: 37, hasAction: true, dedup: 'action'},
  [CardName.PHARMACY_UNION]: {archetype: 'terraformEngine', startingMegacredits: 54, hasAction: false},
  [CardName.PHILARES]: {archetype: 'cityEngine', startingMegacredits: 47, hasAction: false},
  [CardName.MONS_INSURANCE]: {archetype: 'disruption', startingMegacredits: 48, hasAction: false},
  [CardName.RECYCLON]: {archetype: 'cardResourceEngine', startingMegacredits: 38, hasAction: false},
  [CardName.SPLICE]: {archetype: 'cardResourceEngine', startingMegacredits: 44, hasAction: false},
  [CardName.TYCHO_MAGNETICS]: {archetype: 'actionEngine', startingMegacredits: 42, hasAction: true, dedup: 'action'},
  [CardName.KUIPER_COOPERATIVE]: {archetype: 'spaceEngine', startingMegacredits: 33, hasAction: true, dedup: 'action'},
  [CardName.POLDERTECH_DUTCH]: {archetype: 'cityEngine', startingMegacredits: 35, hasAction: false},

  // ── Colonies (5) ──
  [CardName.ARIDOR]: {archetype: 'tagFlex', startingMegacredits: 40, hasAction: false},
  [CardName.ARKLIGHT]: {archetype: 'cardResourceEngine', startingMegacredits: 45, hasAction: false},
  [CardName.POLYPHEMOS]: {archetype: 'capitalStarter', startingMegacredits: 50, hasAction: false, dedup: 'economy'},
  [CardName.POSEIDON]: {archetype: 'colonyEngine', startingMegacredits: 45, hasAction: false, dedup: 'colony'},
  [CardName.STORMCRAFT_INCORPORATED]: {archetype: 'cardResourceEngine', startingMegacredits: 48, hasAction: true, dedup: 'action'},

  // ── Venus Next (5) ──
  [CardName.APHRODITE]: {archetype: 'terraformEngine', startingMegacredits: 47, hasAction: false},
  [CardName.CELESTIC]: {archetype: 'cardResourceEngine', startingMegacredits: 42, hasAction: true, dedup: 'action'},
  [CardName.MANUTECH]: {archetype: 'metalEconomy', startingMegacredits: 35, hasAction: false},
  [CardName.MORNING_STAR_INC]: {archetype: 'tagFlex', startingMegacredits: 50, hasAction: false},
  [CardName.VIRON]: {archetype: 'actionEngine', startingMegacredits: 48, hasAction: true, dedup: 'action'},

  // ── Prelude 1 (5) ──
  [CardName.CHEUNG_SHING_MARS]: {archetype: 'discountHouse', startingMegacredits: 44, hasAction: false, dedup: 'economy'},
  [CardName.POINT_LUNA]: {archetype: 'cardFlow', startingMegacredits: 38, hasAction: false},
  [CardName.ROBINSON_INDUSTRIES]: {archetype: 'actionEngine', startingMegacredits: 47, hasAction: true, dedup: 'action'},
  [CardName.VALLEY_TRUST]: {archetype: 'discountHouse', startingMegacredits: 37, hasAction: false, dedup: 'economy'},
  [CardName.VITOR]: {archetype: 'generalist', startingMegacredits: 48, hasAction: false},
};

/** The Merger prelude — grants a SECOND corporation (the special high-priority case). */
export const MERGER_PRELUDE = CardName.MERGER;

/** True for an archetype whose intended plan is a HIGH-CAPITAL opening (start-boost). */
export function isCapitalArchetype(a: CorporationArchetype): boolean {
  return a === 'capitalStarter' || a === 'discountHouse';
}

export function corporationProfile(name: CardName): CorporationProfile | undefined {
  return CORPORATION_REGISTRY[name];
}

/** Every corporation card name covered by the registry (for the coverage guard). */
export function registeredCorporationNames(): ReadonlyArray<CardName> {
  return Object.keys(CORPORATION_REGISTRY) as Array<CardName>;
}
