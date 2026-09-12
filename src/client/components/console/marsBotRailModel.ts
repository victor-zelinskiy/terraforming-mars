/*
 * marsBotRailModel — PURE, DOM-free preparation layer of the MarsBot seat's
 * RESOURCE presentation (the left rail + the «Доп. ресурсы» satellite of the
 * Information Workspace) and of the bot's tag matrix.
 *
 * THE PARITY CONTRACT (info-panel normalization): the bot reads as ONE MORE
 * PARTICIPANT inside the SAME instrument the humans use. Visual
 * classification follows the RESOURCE TYPE, never the storage location:
 *
 *  - the SIX STANDARD ROWS exist for the bot exactly like for a human
 *    (M€ · steel · titanium · plants · energy · heat, zeros included). A
 *    standard-typed stock is a standard row wherever the Automa keeps it —
 *    Ceres steel, Triton titanium, Ganymede plants, Callisto energy, Io
 *    heat (shipping storage, RB-C pp.4–5) and the corporation's own plant
 *    store (Ecoline/Ecotec) all land in their type's row. The row model
 *    keeps the SOURCE split (`sources`) — the detail surfaces (bot screen,
 *    aria) name where each stock physically sits.
 *
 *  - M€ IS THE ONE DELIBERATE EXCEPTION: the bot's main M€ SUPPLY is the
 *    row's value (its meaning — the money the Automa pays with — must
 *    survive), while the INDEPENDENT M€ stores (the Luna shipping area, a
 *    corporation's own bank/till — C06/C20) ride the row as a separate
 *    compact `store` readout. They are never silently folded into the
 *    supply and never replace it; each store keeps its own balance,
 *    threshold and spending rule (stated on the detail surfaces).
 *
 *  - CARD-TYPE resources are «Доп. ресурсы»: the floater pool, Enceladus
 *    microbes, Miranda animals, Pluto's SCIENCE stock («MarsBot does not
 *    gain cards for Pluto. Instead it gains [science] resources into the
 *    corresponding storage area» — RB-C p.5; the printed board's own area
 *    reads «5 [science] → [science tag]») and a corporation's science
 *    store (Philares/Spire) — one science TYPE, independent stores named
 *    apart. Keys are the HUMAN satellite's own (`cardResourceKey`), so a
 *    seat switch can preserve the semantic focus.
 *
 *  - a REAL SOURCE WITH ZERO stays visible: a storable colony IN PLAY is an
 *    unlocked type at 0 (the human rule — «a card that CAN hold it shows at
 *    0»), while a type whose mechanism is not in this game never appears.
 *    `MarsBotExtrasContext` carries the game shape (Venus / colony tiles).
 *
 *  - the МЕТКИ zone is the SAME tag matrix as a human's — the track
 *    positions ARE the engine's tag counts (`AutomaTargeting.effectiveTagCount`).
 *    A tag no track serves is «not tracked» — a dash, never a lying 0.
 *
 * Data is public and server-authoritative (MarsBotModel mirrors the table).
 * No rule is re-implemented here — this module only CLASSIFIES the model's
 * own pools for display.
 */

import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {ColonyName} from '@/common/colonies/ColonyName';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {additionalResourceMetricKey} from '@/client/components/additionalResources/additionalResources';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {consoleAvailableTags, ConsoleTagCell} from '@/client/components/console/consoleTagMatrix';

// ── the game-shape context (which sources EXIST in this game) ──────────────

/**
 * What the extras classification needs to know about the GAME (not the
 * bot): a storage area is a real zero-count source only while its colony
 * tile is in play, and the floater pool only while a floater mechanism
 * exists (Venus track cells / the Titan area, RB-C p.2/p.4).
 */
export type MarsBotExtrasContext = {
  venus: boolean;
  /** Colony tiles IN PLAY (`game.colonies` names). */
  colonies: ReadonlyArray<string>;
};

/** Build the context from the client game model (one derivation, every call site). */
export function marsBotExtrasContext(game: {
  colonies?: ReadonlyArray<{name: string}>,
  gameOptions: {expansions: {venus?: boolean}},
}): MarsBotExtrasContext {
  return {
    venus: game.gameOptions.expansions.venus === true,
    colonies: (game.colonies ?? []).map((c) => c.name),
  };
}

// ── the STANDARD rows (the six-row parity skeleton) ────────────────────────

export type MarsBotStandardKey = 'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat';

const STANDARD_KEYS: ReadonlyArray<MarsBotStandardKey> =
  ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/** Which shipping area accumulates which STANDARD resource (RB-C pp.4–5 /
 *  `ShippingBoardData.ts`). Luna (M€) is handled apart — it is a separate
 *  store, never part of the supply. */
const STANDARD_AREA: Readonly<Partial<Record<string, Exclude<MarsBotStandardKey, 'megacredits'>>>> = {
  [ColonyName.CERES]: 'steel',
  [ColonyName.TRITON]: 'titanium',
  [ColonyName.GANYMEDE]: 'plants',
  [ColonyName.CALLISTO]: 'energy',
  [ColonyName.IO]: 'heat',
};

export type MarsBotStandardRow = {
  key: MarsBotStandardKey;
  /** The row's displayed number. For M€ this is the MAIN SUPPLY only. */
  value: number;
  /** AnimatedMetricValue key — the HUMAN family (`<key>.stock`), scoped by
   *  the bot's color, so the delta-chip language stays identical. */
  metricKey: string;
  /** WHERE `value` accumulates when it is storage (colony areas / the corp
   *  card) — the detail split. Empty when the value is the plain supply. */
  sources: ReadonlyArray<{name: string, amount: number}>;
  /** M€ held in SEPARATE stores (the Luna area, the corp card's own
   *  bank/till) — never folded into `value`, never a production. */
  store?: {total: number, sources: ReadonlyArray<{name: string, amount: number}>};
};

/**
 * The bot's six standard rows — ALWAYS six, canonical order, zeros shown
 * (0 is a definite number here; «not applicable» does not exist for a
 * standard stock). No production exists for the Automa — the component
 * keeps the production track visually empty, it never invents a «+0».
 */
export function marsBotStandardRows(bot: PublicPlayerModel, automa: MarsBotModel): Array<MarsBotStandardRow> {
  const storage = automa.shippingStorage ?? {};
  const corp = automa.corporation;
  // The bot player's OWN stock fields (normally 0 outside M€) stay part of
  // the row — any engine path that credits them directly remains visible.
  const ownStock: Record<MarsBotStandardKey, number> = {
    megacredits: bot.megacredits,
    steel: bot.steel,
    titanium: bot.titanium,
    plants: bot.plants,
    energy: bot.energy,
    heat: bot.heat,
  };
  return STANDARD_KEYS.map((key): MarsBotStandardRow => {
    const sources: Array<{name: string, amount: number}> = [];
    let value = ownStock[key] ?? 0;
    if (key !== 'megacredits') {
      for (const [colony, stored] of Object.entries(STANDARD_AREA)) {
        if (stored !== key) {
          continue;
        }
        const amount = storage[colony as ColonyName];
        if (typeof amount === 'number' && amount > 0) {
          value += amount;
          sources.push({name: colony, amount});
        }
      }
      if (corp?.resource === 'plant' && key === 'plants' && corp.resources > 0) {
        value += corp.resources;
        sources.push({name: corp.original, amount: corp.resources});
      }
      return {key, value, metricKey: `${key}.stock`, sources};
    }
    // M€ — the supply is the value; the separate stores ride the marker.
    const storeSources: Array<{name: string, amount: number}> = [];
    const luna = storage[ColonyName.LUNA];
    if (typeof luna === 'number' && luna > 0) {
      storeSources.push({name: ColonyName.LUNA, amount: luna});
    }
    if (corp?.resource === 'megacredits' && corp.resources > 0) {
      storeSources.push({name: corp.original, amount: corp.resources});
    }
    const storeTotal = storeSources.reduce((sum, s) => sum + s.amount, 0);
    return {
      key,
      value,
      metricKey: 'megacredits.stock',
      sources: [],
      store: storeTotal > 0 ? {total: storeTotal, sources: storeSources} : undefined,
    };
  });
}

// ── the tag matrix (parity with the human МЕТКИ block) ─────────────────────

export type MarsBotTagEntry = {
  tag: ConsoleTagCell;
  /** The engine's tag count = the mapped track's position. `undefined` =
   *  this tag maps to no track (wild / clone / no-tag) — «not tracked». */
  count: number | undefined;
};

/**
 * The bot's tag matrix over the SAME cell set a human shows (game.tags →
 * `consoleAvailableTags`), with counts read from the printed tracks. One
 * position may serve several cells — that is the rule, not a display bug.
 */
export function marsBotTagEntries(
  gameTags: ReadonlyArray<Tag> | undefined,
  automa: MarsBotModel,
): Array<MarsBotTagEntry> {
  const positionOf = new Map<Tag, number>();
  for (const track of automa.tracks) {
    const position = Math.max(0, track.position);
    for (const tag of track.tags) {
      positionOf.set(tag, position);
    }
  }
  return consoleAvailableTags(gameTags).map((tag) => ({
    tag,
    count: tag === 'none' ? undefined : positionOf.get(tag as Tag),
  }));
}

// ── «Доп. ресурсы» — the bot's CARD-TYPE pools ─────────────────────────────

/**
 * The honest per-source rule notes a group carries (the detail screen
 * renders one line per kind, in this order):
 *  · 'pool'    — the one floater pool (Research-Phase spend rule);
 *  · 'storage' — an ordinary storage area: steal/remove-targetable by
 *                type (RB-C p.5 lists Ceres…Triton);
 *  · 'pluto'   — Pluto's science area: exchanges like any area but is
 *                DELIBERATELY absent from that steal/remove list;
 *  · 'corp'    — the corporation card's own store (its printed rule).
 */
export type MarsBotExtraNote = 'pool' | 'storage' | 'pluto' | 'corp';

export type MarsBotExtraGroup = {
  /** The HUMAN satellite's own type key (`cardResourceKey`) — one key
   *  space, so a seat switch preserves the semantic focus. */
  key: string;
  /** Ready-to-render icon classes. */
  iconClass: string;
  /** i18n KEY of the resource-type name. */
  label: string;
  total: number;
  /** WHERE it is held — colony areas / the corp card (i18n keys: colony
   *  and card names are keys). Empty for the one-pool floater stock.
   *  One TYPE may hold several independent stores (Pluto science + a
   *  Philares/Spire corp store) — a meaningful total with the split
   *  named, never a mechanical merge of their balances/thresholds. */
  holders: Array<{name: string, amount: number}>;
  metricKey: string;
  /** The honest rule notes, one per source KIND present (see above). */
  notes: ReadonlyArray<MarsBotExtraNote>;
};

/** The card-typed shipping areas, in the official board's own order
 *  (rulebook A p.2). Pluto stores SCIENCE resources — the printed area
 *  reads «5 [science] → [science tag]», and RB-C p.5 spells it out:
 *  «MarsBot does not gain cards for Pluto. Instead it gains [science]
 *  resources into the corresponding storage area». Unlike the other
 *  areas, Pluto is absent from the steal/remove list (`note: 'pluto'`). */
const CARD_AREA: ReadonlyArray<{colony: ColonyName, key: string, iconClass: string, label: string, metricKey: string, note: MarsBotExtraNote}> = [
  {
    colony: ColonyName.ENCELADUS,
    key: cardResourceKey(CardResource.MICROBE),
    iconClass: `card-resource ${cardResourceCSS[CardResource.MICROBE]}`,
    label: 'Microbes',
    metricKey: additionalResourceMetricKey(CardResource.MICROBE),
    note: 'storage',
  },
  {
    colony: ColonyName.MIRANDA,
    key: cardResourceKey(CardResource.ANIMAL),
    iconClass: `card-resource ${cardResourceCSS[CardResource.ANIMAL]}`,
    label: 'Animals',
    metricKey: additionalResourceMetricKey(CardResource.ANIMAL),
    note: 'storage',
  },
  {
    colony: ColonyName.PLUTO,
    key: cardResourceKey(CardResource.SCIENCE),
    iconClass: `card-resource ${cardResourceCSS[CardResource.SCIENCE]}`,
    label: 'Science',
    metricKey: additionalResourceMetricKey(CardResource.SCIENCE),
    note: 'pluto',
  },
];

/**
 * The bot's REAL card-type accumulations for the shared «Доп. ресурсы»
 * area — the same semantic shape as a human's card-held resources: groups
 * BY RESOURCE TYPE, each naming its holders. Disjoint pools by
 * construction: Titan's floaters live ONLY in `automa.floaters` (never in
 * `shippingStorage`), the standard-typed areas live in the STANDARD rows,
 * and Europa never stores. A source that EXISTS shows its honest 0; a
 * mechanism not in this game never appears.
 */
export function marsBotExtraGroups(
  automa: MarsBotModel,
  ctx: MarsBotExtrasContext = {venus: false, colonies: []},
): Array<MarsBotExtraGroup> {
  const inPlay = new Set(ctx.colonies);
  const storage = automa.shippingStorage ?? {};
  const out: Array<MarsBotExtraGroup> = [];
  // The one-pool floater stock — real while a floater mechanism exists.
  if (ctx.venus || inPlay.has(ColonyName.TITAN) || automa.floaters > 0) {
    out.push({
      key: cardResourceKey(CardResource.FLOATER),
      iconClass: `card-resource ${cardResourceCSS[CardResource.FLOATER]}`,
      label: 'Floaters',
      total: automa.floaters,
      holders: [],
      metricKey: additionalResourceMetricKey(CardResource.FLOATER),
      notes: ['pool'],
    });
  }
  for (const area of CARD_AREA) {
    const raw = storage[area.colony];
    const amount = typeof raw === 'number' ? raw : 0;
    if (!inPlay.has(area.colony) && amount <= 0) {
      continue;
    }
    out.push({
      key: area.key,
      iconClass: area.iconClass,
      label: area.label,
      total: amount,
      holders: [{name: area.colony, amount}],
      metricKey: area.metricKey,
      notes: [area.note],
    });
  }
  // The corporation's own science store (Philares/Spire) — the SAME science
  // TYPE Pluto's area accumulates, so it joins that group when both exist:
  // one chip per type, a meaningful total, the split named per holder (the
  // stores stay independent — each keeps its own balance and rule).
  const corp = automa.corporation;
  if (corp?.resource === 'science') {
    const scienceKey = cardResourceKey(CardResource.SCIENCE);
    const existing = out.find((g) => g.key === scienceKey);
    if (existing !== undefined) {
      existing.total += corp.resources;
      existing.holders.push({name: corp.original, amount: corp.resources});
      existing.notes = [...existing.notes, 'corp'];
    } else {
      out.push({
        key: scienceKey,
        iconClass: `card-resource ${cardResourceCSS[CardResource.SCIENCE]}`,
        label: 'Science',
        total: corp.resources,
        holders: [{name: corp.original, amount: corp.resources}],
        metricKey: additionalResourceMetricKey(CardResource.SCIENCE),
        notes: ['corp'],
      });
    }
  }
  return out;
}

/** The per-colony storage split (the bot screen's storage block). */
export function shippingStorageEntries(automa: MarsBotModel): Array<{colony: string, count: number}> {
  const storage = automa.shippingStorage;
  if (storage === undefined) {
    return [];
  }
  return Object.entries(storage)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([colony, count]) => ({colony, count}));
}
