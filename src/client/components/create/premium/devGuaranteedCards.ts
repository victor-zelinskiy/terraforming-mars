/*
 * DEV «GUARANTEED CARDS» — the catalogue behind the test-mode sub-setting.
 *
 * A DEVELOPMENT switch nested under «Тестовый режим» (admin seat only): the
 * picked cards are forced into the FIRST hand every player is dealt, so an e2e
 * run or a feature check can reach a specific card without re-rolling the deal.
 *
 * The guarantee itself is the SERVER's existing "cards on top of the deck"
 * mechanism (`Deck.shuffle(cardsOnTop)`), reached through three GameOptions
 * lists — which is why the picks are stored ALREADY SPLIT by target list
 * (`GuaranteedCardPicks`): the shared payload builder then needs no card data
 * at all, and stays importable from the server test runner.
 *   CORPORATION → customCorporationsList
 *   PRELUDE     → customPreludes
 *   project     → customProjectCards
 *
 * Card data is the STATIC client manifest (`ClientCardManifest`), so every
 * function here works pre-game, with no game and no player view. Nothing in
 * the SHARED create-game modules may import this file — the manifest pulls in
 * `genfiles/cards.json`, which only the webpack/mochapack build resolves.
 */

import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard, getCards} from '@/client/cards/ClientCardManifest';
import {PremiumTheme, isPremiumFaceType, premiumThemeFor} from '@/client/components/premiumCard/premiumCardTheme';
import {translateCardName} from '@/client/directives/i18n';
import {PREMIUM_EXPANSIONS} from './createGameMeta';
import type {GuaranteedCardPicks, GuaranteedPickList} from './createGameState';

export type GuaranteedModuleMeta = {id: GameModule, labelKey: string};

/**
 * Level 1 of the picker: the fork's PLAYABLE module scope. `PREMIUM_EXPANSIONS`
 * is that single access point; the base game is not an "expansion", so it is
 * prepended here (it holds most of the deck).
 */
export const GUARANTEED_MODULES: ReadonlyArray<GuaranteedModuleMeta> = [
  {id: 'base', labelKey: 'Base'},
  ...PREMIUM_EXPANSIONS.map((e) => ({id: e.id as GameModule, labelKey: e.labelKey})),
];

/**
 * Card TYPES a pick can route to, in list order. Anything else (standard
 * projects, CEOs) has no guarantee list on the server and is left out —
 * `isPremiumFaceType` is the fork's one type-scope gate and agrees exactly.
 */
const TYPE_ORDER: ReadonlyArray<CardType> = [
  CardType.CORPORATION,
  CardType.PRELUDE,
  CardType.AUTOMATED,
  CardType.ACTIVE,
  CardType.EVENT,
];

/** Group headings — existing plural i18n keys (ui.json), not coined ones. */
const TYPE_LABEL_KEY: Readonly<Partial<Record<CardType, string>>> = {
  [CardType.CORPORATION]: 'Corporations',
  [CardType.PRELUDE]: 'Preludes',
  [CardType.AUTOMATED]: 'Automated',
  [CardType.ACTIVE]: 'Active',
  [CardType.EVENT]: 'Events',
};

/** Which server list a card TYPE is guaranteed through (undefined = none). */
export function guaranteedListOf(type: CardType): GuaranteedPickList | undefined {
  switch (type) {
  case CardType.CORPORATION: return 'corporations';
  case CardType.PRELUDE: return 'preludes';
  case CardType.AUTOMATED:
  case CardType.ACTIVE:
  case CardType.EVENT:
    return 'projects';
  default: return undefined;
  }
}

export function guaranteedTypeLabelKey(type: CardType): string {
  return TYPE_LABEL_KEY[type] ?? String(type);
}

/** The colour vocabulary of the fork's card faces — never re-derived locally. */
export function guaranteedThemeOf(type: CardType): PremiumTheme | undefined {
  return premiumThemeFor(type);
}

/** Localized card title (variant-safe), for display AND for sorting. */
export function guaranteedCardTitle(name: CardName): string {
  return translateCardName(name);
}

/**
 * Cards the SERVER refuses to guarantee. Offering one is worse than not
 * offering it: the pick would either be a silent no-op or break creation.
 *  - Delta Project is a global subsystem, not a dealt prelude — `Game.newInstance`
 *    THROWS when it appears in `customPreludes`.
 *  - The beginner corporation is what a player gets INSTEAD of a choice;
 *    `GameCards.getCorporationCards` strips it from the deck on purpose.
 */
const NOT_GUARANTEEABLE: ReadonlySet<CardName> = new Set([
  CardName.DELTA_PROJECT,
  CardName.BEGINNER_CORPORATION,
]);

function guaranteeable(card: ClientCard): boolean {
  return isPremiumFaceType(card.type) && !NOT_GUARANTEEABLE.has(card.name);
}

function pickable(card: ClientCard, module: GameModule): boolean {
  return card.module === module && guaranteeable(card);
}

// ── Picks ──────────────────────────────────────────────────────────────────

export const GUARANTEED_PICK_LISTS: ReadonlyArray<GuaranteedPickList> = ['corporations', 'preludes', 'projects'];

export function guaranteedCount(picks: GuaranteedCardPicks): number {
  return GUARANTEED_PICK_LISTS.reduce((n, list) => n + picks[list].length, 0);
}

export function guaranteedNames(picks: GuaranteedCardPicks): ReadonlySet<CardName> {
  const set = new Set<CardName>();
  for (const list of GUARANTEED_PICK_LISTS) {
    for (const name of picks[list]) {
      set.add(name);
    }
  }
  return set;
}

/** Add / remove one card, routing it to the list its TYPE is guaranteed by. */
export function toggleGuaranteedCard(picks: GuaranteedCardPicks, name: CardName): void {
  const card = getCard(name);
  const list = card === undefined ? undefined : guaranteedListOf(card.type);
  if (card === undefined || list === undefined || !guaranteeable(card)) {
    return;
  }
  const bucket = picks[list];
  const at = bucket.indexOf(card.name);
  if (at >= 0) {
    bucket.splice(at, 1);
  } else {
    bucket.push(card.name);
  }
}

/** Remove one card wherever it sits (the picked-list view's Y action). */
export function removeGuaranteedCard(picks: GuaranteedCardPicks, name: CardName): void {
  for (const list of GUARANTEED_PICK_LISTS) {
    const at = picks[list].indexOf(name);
    if (at >= 0) {
      picks[list].splice(at, 1);
    }
  }
}

export function clearGuaranteedCards(picks: GuaranteedCardPicks): void {
  for (const list of GUARANTEED_PICK_LISTS) {
    picks[list].splice(0, picks[list].length);
  }
}

/**
 * Drop names this picker could not produce today — a restored setup may name a
 * card that a later build renamed or removed, and the server throws on an
 * unknown name at game creation. Mutates in place; returns how many went.
 */
export function pruneGuaranteedCards(picks: GuaranteedCardPicks): number {
  const modules = new Set<GameModule>(GUARANTEED_MODULES.map((m) => m.id));
  let dropped = 0;
  for (const list of GUARANTEED_PICK_LISTS) {
    const kept = picks[list].filter((name) => {
      const card = getCard(name);
      return card !== undefined &&
        card.name === name &&
        modules.has(card.module) &&
        guaranteeable(card) &&
        guaranteedListOf(card.type) === list;
    });
    dropped += picks[list].length - kept.length;
    picks[list].splice(0, picks[list].length, ...kept);
  }
  return dropped;
}

// ── Level 2: one module's cards, grouped by type, alphabetical inside ──────

export type GuaranteedCardEntry = {
  name: CardName,
  type: CardType,
  title: string,
  chosen: boolean,
};

export type GuaranteedPickRow =
  | {kind: 'header', key: string, type: CardType, labelKey: string, count: number}
  | {kind: 'card', key: string, entry: GuaranteedCardEntry};

/**
 * The flat render list for one module: a type heading followed by its cards,
 * sorted by the LOCALIZED title (that is the order the player reads, not the
 * English one). Headings are not selectable — `stepSelectable` walks past them.
 */
export function guaranteedPickRows(module: GameModule, chosen: ReadonlySet<CardName>): ReadonlyArray<GuaranteedPickRow> {
  const cards = getCards((card) => pickable(card, module));
  const rows: Array<GuaranteedPickRow> = [];
  for (const type of TYPE_ORDER) {
    const group = cards
      .filter((card) => card.type === type)
      .map((card): GuaranteedCardEntry => ({
        name: card.name,
        type: card.type,
        title: guaranteedCardTitle(card.name),
        chosen: chosen.has(card.name),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    if (group.length === 0) {
      continue;
    }
    rows.push({kind: 'header', key: `h:${type}`, type, labelKey: guaranteedTypeLabelKey(type), count: group.length});
    for (const entry of group) {
      rows.push({kind: 'card', key: `c:${entry.name}`, entry});
    }
  }
  return rows;
}

/** How many pickable cards a module holds, and how many are already picked. */
export function guaranteedModuleCounts(module: GameModule, chosen: ReadonlySet<CardName>): {total: number, chosen: number} {
  const cards = getCards((card) => pickable(card, module));
  return {
    total: cards.length,
    chosen: cards.reduce((n, card) => n + (chosen.has(card.name) ? 1 : 0), 0),
  };
}

// ── Level 0: the picked list ───────────────────────────────────────────────

/**
 * The picked cards as display entries, in the same type-then-title order the
 * picker groups by, so both lists read alike. An unknown name is dropped (it
 * would have been pruned on restore; this keeps the view honest either way).
 */
export function guaranteedChosenEntries(picks: GuaranteedCardPicks): ReadonlyArray<GuaranteedCardEntry> {
  const entries: Array<GuaranteedCardEntry> = [];
  for (const list of GUARANTEED_PICK_LISTS) {
    for (const name of picks[list]) {
      const card = getCard(name);
      if (card === undefined) {
        continue;
      }
      entries.push({name: card.name, type: card.type, title: guaranteedCardTitle(card.name), chosen: true});
    }
  }
  return entries.sort((a, b) => {
    const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    return byType !== 0 ? byType : a.title.localeCompare(b.title);
  });
}
