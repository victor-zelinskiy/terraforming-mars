/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  ICardRenderEffect,
  ICardRenderItem,
  ICardRenderRoot,
  ItemType,
  isICardRenderRoot,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderSymbol,
} from '@/common/cards/render/Types';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {EffectSignature} from '@/client/components/effects/effectSummary';

/*
 * Client-side extraction of a card's PASSIVE/ongoing effect graphics, for the
 * Effects overlay. Everything is derived from the static client card manifest
 * (`getCard(name).metadata.renderData`) — no server change, no live CardModel
 * field needed. The renderData effect block IS the printed passive effect; we
 * filter it out and render it standalone via `CardRenderEffectBoxComponent`.
 *
 * Active actions are EXCLUDED (they live in the future "Actions" overlay): both
 * `effect()` and `action()` produce an `is:'effect'` node — they're told apart
 * by the DSL's description prefix ('Effect: ' vs 'Action: ') and the delimiter
 * symbol (colon ':' vs arrow '->'). corpBox is already discriminated
 * (corp-box-effect vs corp-box-action vs corp-box-effect-action).
 */

export type EffectEntry = {
  // Stable v-for key (card name + ordinal — a card can grant several effects).
  // This is the PER-EFFECT selection key in the master-detail overlay.
  key: string;
  cardName: CardName;
  // The ordinal of this effect within its source card (0 for a single-effect
  // card / an override). Lets the details panel say "effect i of N".
  effectIndex: number;
  isCorporation: boolean;
  // The card is out of the game (e.g. PharmacyUnion turned into a disease) —
  // its effect is shown dimmed.
  isDisabled: boolean;
  // The effect render node (rendered by CardRenderEffectBoxComponent), OR
  // undefined for an override.
  effectNode: ICardRenderEffect | undefined;
  // WHOLE-renderData graphics (rendered by CardRenderData) — used by a
  // `renderWhole` override for cards whose effect is drawn as raw root rows, not
  // an `effect()` box (e.g. Olympus Conference).
  renderRoot: ICardRenderRoot | undefined;
  // Optional localized description text shown below the graphic (text-only
  // overrides, or the description for a `renderWhole` card).
  text: string | undefined;
  // The PER-EFFECT description string (still i18n-key + 'Effect: '-prefixed; the
  // client strips the prefix on display). For a clean `effect()` node it's pulled
  // from the node; for an override it's the override text. Shown in the DETAILS
  // panel only (the left grid card is icons-only), so a multi-effect card shows
  // each effect's OWN description.
  description: string | undefined;
  // The PER-EFFECT impact signature (what this effect's result produces) — lets the
  // details panel scope the per-game stats to the SELECTED effect on a multi-effect
  // card (an override has the empty signature → no scoping).
  signature: EffectSignature;
};

/*
 * EDGE-CASE OVERRIDES. A handful of cards encode their passive effect outside a
 * clean `effect()` box; cover them here:
 *   - `exclude: true`     → never show this card's effects.
 *   - `renderWhole: true` → render the card's ENTIRE renderData root (the raw
 *                           symbol rows ARE the effect graphic) + its
 *                           description. For cards whose effect is drawn as
 *                           top-level rows, not an effect() node.
 *   - `text: <i18n key>`  → a TEXT-ONLY block with this description (no graphic).
 * The generic renderData scan handles everything else. Populate this as the
 * ?effectsPlayground "flagged" tab surfaces problem cards.
 */
type EffectOverride = {exclude?: boolean; renderWhole?: boolean; descFromMeta?: boolean; text?: string};
const EFFECT_OVERRIDES: Partial<Record<CardName, EffectOverride>> = {
  // Olympus Conference draws its trigger as RAW root rows (science tag : science
  // / OR / −science +card), not an effect() box; its description lives in
  // metadata.description → render the whole renderData + append that description.
  [CardName.OLYMPUS_CONFERENCE]: {renderWhole: true, descFromMeta: true},
  // Protected Habitats: the WHOLE renderData is the rule ("Opponents may not
  // remove your" + plant/animal/microbe icons) — render it as-is (it's fully
  // localized + self-explanatory, no immediate effect to strip).
  [CardName.PROTECTED_HABITATS]: {renderWhole: true},
  // Neptunian Power Consultants: the whole renderData IS the ocean-trigger effect
  // (incl. its own "(Effect: …)" text row); metadata.description is the VP, so do
  // NOT append it. (The effect text row isn't in ru/cards.json yet — a base-game
  // translation gap, so it shows in English; not this feature's bug.)
  [CardName.NEPTUNIAN_POWER_CONSULTANTS]: {renderWhole: true},
  // Supercapacitors now carries a real effect() node (energy -> heat with a
  // crossed-out arrow); the generic scan extracts it, so no override is needed.
};

/** The (prefixed) description string of an effect node, if present. */
function descriptionString(node: ICardRenderEffect): string | undefined {
  const row: ReadonlyArray<ItemType> | undefined = node.rows?.[2];
  if (row !== undefined && row.length > 0) {
    const last = row[row.length - 1];
    if (typeof last === 'string') {
      return last;
    }
  }
  const d = (node as unknown as {description?: unknown}).description;
  return typeof d === 'string' ? d : undefined;
}

/**
 * Whether an `is:'effect'` node is a PASSIVE effect (vs an active `action()`,
 * which the DSL renders with the same node type). Primary signal = the
 * description prefix the DSL bakes in; fallback = the delimiter symbol.
 */
function isPassiveEffectNode(node: ICardRenderEffect): boolean {
  const desc = descriptionString(node);
  if (desc !== undefined) {
    if (desc.startsWith('Action: ')) {
      return false;
    }
    if (desc.startsWith('Effect: ')) {
      return true;
    }
  }
  const delim = node.rows?.[1]?.[0];
  if (delim !== undefined && isICardRenderSymbol(delim)) {
    if (delim.type === CardRenderSymbolType.ARROW) {
      return false;
    }
    if (delim.type === CardRenderSymbolType.COLON) {
      return true;
    }
  }
  // Ambiguous (no description, no clear delimiter) → exclude to avoid noise;
  // such cards are handled via EFFECT_OVERRIDES when they matter.
  return false;
}

/**
 * The IMPACT SIGNATURE of one effect — what its RESULT row produces — so the
 * details panel can show the per-game stats for the SELECTED effect, not the whole
 * card. The event stream attributes to the card (not a single effect), so for a
 * MULTI-effect card a metric is shown on an effect only if its result references
 * that metric; a metric that belongs ONLY to a sibling effect is hidden. (Cards
 * like PolderTech Dutch [ocean→energy / greenery→plant] and Solar Logistics
 * [Earth discount / space-event draw] have DISJOINT signatures → genuinely
 * per-effect stats.)
 *   - `icons`: the stat-line icon keys the result references ('megacredits',
 *     'steel'/…, 'tr', 'cards', or a CardResource value like 'Graphene').
 *   - `discount`: the result is a NEGATIVE M€ (a cost reduction, not a gain).
 *   - `valueModifier`: the CAUSE is a held resource ("each steel …") — a passive
 *     value rule, not an event trigger.
 * The `EffectSignature` TYPE lives in the pure `effectSummary` module (so the
 * server test runner can import the summary without this manifest-bound module).
 */
const EMPTY_SIGNATURE: EffectSignature = {icons: [], discount: false, valueModifier: false, valueAsPayment: false};

const STANDARD_RESOURCE_TYPES: ReadonlySet<CardRenderItemType> = new Set([
  CardRenderItemType.MEGACREDITS, CardRenderItemType.STEEL, CardRenderItemType.TITANIUM,
  CardRenderItemType.PLANTS, CardRenderItemType.ENERGY, CardRenderItemType.HEAT,
]);

/** The stat-line icon key a result item maps to (undefined for non-stat items). */
function iconKeyForItem(item: ICardRenderItem): string | undefined {
  switch (item.type) {
  case CardRenderItemType.MEGACREDITS: return 'megacredits';
  case CardRenderItemType.STEEL: return 'steel';
  case CardRenderItemType.TITANIUM: return 'titanium';
  case CardRenderItemType.PLANTS: return 'plants';
  case CardRenderItemType.ENERGY: return 'energy';
  case CardRenderItemType.HEAT: return 'heat';
  case CardRenderItemType.TR: return 'tr';
  case CardRenderItemType.CARDS: return 'cards';
  case CardRenderItemType.RESOURCE: return item.resource; // a CardResource value (card resource)
  default: return undefined; // tags / tiles / symbols / global params — not stat lines
  }
}

function collectResultIcons(items: ReadonlyArray<ItemType> | undefined, icons: Set<string>, markDiscount: () => void): void {
  if (items === undefined) {
    return;
  }
  for (const it of items) {
    if (isICardRenderItem(it)) {
      const key = iconKeyForItem(it);
      if (key !== undefined) {
        icons.add(key);
      }
      if (it.type === CardRenderItemType.MEGACREDITS && it.amount < 0) {
        markDiscount();
      }
    } else if (isICardRenderProductionBox(it)) {
      for (const row of it.rows) {
        collectResultIcons(row, icons, markDiscount);
      }
    }
  }
}

function effectSignature(node: ICardRenderEffect): EffectSignature {
  const icons = new Set<string>();
  let discount = false;
  collectResultIcons(node.rows?.[2], icons, () => {
    discount = true;
  });
  const cause: ReadonlyArray<ItemType> = node.rows?.[0] ?? [];
  const valueModifier = cause.some((it) => isICardRenderItem(it) && STANDARD_RESOURCE_TYPES.has(it.type));
  // "card-resource = N M€" → the resource is spendable as payment (Psychrophiles
  // microbes, Carbon Nanosystems graphene). The EQUALS distinguishes it from an
  // "OR gain M€" result (Splice).
  const result: ReadonlyArray<ItemType> = node.rows?.[2] ?? [];
  const hasEquals = result.some((it) => isICardRenderSymbol(it) && it.type === CardRenderSymbolType.EQUALS);
  const hasCardResource = result.some((it) => isICardRenderItem(it) && it.type === CardRenderItemType.RESOURCE);
  const hasMegacredits = result.some((it) => isICardRenderItem(it) && it.type === CardRenderItemType.MEGACREDITS);
  const valueAsPayment = hasEquals && hasCardResource && hasMegacredits;
  return {icons: [...icons], discount, valueModifier, valueAsPayment};
}

/** Whether an effect node's OWN cause (rows[0]) has any drawn items. */
function causeHasItems(node: ICardRenderEffect): boolean {
  return (node.rows?.[0] ?? []).some(isICardRenderItem);
}

/**
 * Some cards draw an effect's TRIGGER as a ROOT row before the effect, with an
 * empty effect cause (`eb.empty().startEffect` — e.g. Viral Vectors:
 * `b.tag(PLANT).slash().tag(MICROBE).slash().tag(ANIMAL).br; b.effect(eb => eb.empty().startEffect…)`).
 * The extracted effect node then has a BLANK cause, so the overlay showed only the
 * result. When the node's cause is empty and a root cause row precedes it, splice
 * that row in so the effect block shows the FULL trigger : result iconography.
 */
function withSplicedCause(node: ICardRenderEffect, precedingCause: ReadonlyArray<ItemType> | undefined): ICardRenderEffect {
  if (precedingCause === undefined || causeHasItems(node)) {
    return node;
  }
  return {...node, rows: [[...precedingCause], node.rows[1], node.rows[2]]};
}

/** Pull every passive-effect node out of a card's renderData, incl. nested in
 *  a corporation effect box. */
function collectEffectNodes(cardName: CardName): Array<ICardRenderEffect> {
  const card = getCard(cardName);
  const renderData = card?.metadata.renderData;
  const out: Array<ICardRenderEffect> = [];
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return out;
  }
  // The most recent ROOT row of cause items (no effect node) — spliced into a
  // following empty-cause effect (the Viral Vectors pattern above).
  let precedingCause: ReadonlyArray<ItemType> | undefined;
  for (const row of renderData.rows) {
    let rowHasEffect = false;
    for (const item of row) {
      if (isICardRenderEffect(item)) {
        rowHasEffect = true;
        if (isPassiveEffectNode(item)) {
          out.push(withSplicedCause(item, precedingCause));
        }
      } else if (isICardRenderCorpBoxEffect(item) || isICardRenderCorpBoxEffectAction(item)) {
        rowHasEffect = true;
        // A corp effect box holds its effect node(s) inside its own rows.
        for (const innerRow of item.rows) {
          for (const inner of innerRow) {
            if (isICardRenderEffect(inner) && isPassiveEffectNode(inner)) {
              out.push(inner);
            }
          }
        }
      }
      // corp-box-action and everything else carries no passive effect.
    }
    if (!rowHasEffect && row.some(isICardRenderItem)) {
      precedingCause = row;
    }
  }
  return out;
}

/** Whether a card grants at least one passive effect (drives playground/count). */
export function cardHasPassiveEffect(cardName: CardName): boolean {
  const override = EFFECT_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return false;
  }
  if (override?.renderWhole === true || override?.text !== undefined) {
    return true;
  }
  return collectEffectNodes(cardName).length > 0;
}

/** The card's renderData root, if it is a root (for `renderWhole` overrides). */
function cardRenderRoot(cardName: CardName): ICardRenderRoot | undefined {
  const rd = getCard(cardName)?.metadata.renderData;
  return rd !== undefined && isICardRenderRoot(rd) ? rd : undefined;
}

/** The card's plain-string description, if any (for the text under a graphic). */
function cardDescriptionText(cardName: CardName): string | undefined {
  const d = getCard(cardName)?.metadata.description;
  return typeof d === 'string' ? d : undefined;
}

/** Build the effect entries (one per distinct effect) for a single card. */
function cardEffectEntries(card: CardModel): Array<EffectEntry> {
  const cardName = card.name;
  const override = EFFECT_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return [];
  }
  const isCorporation = getCard(cardName)?.type === CardType.CORPORATION;
  const isDisabled = card.isDisabled === true;
  const base = {cardName, isCorporation, isDisabled};

  // Render the card's WHOLE renderData (the raw symbol rows ARE the effect) +
  // its description.
  if (override?.renderWhole === true) {
    const text = override.text ?? (override.descFromMeta === true ? cardDescriptionText(cardName) : undefined);
    return [{
      ...base,
      key: cardName + '#whole',
      effectIndex: 0,
      effectNode: undefined,
      renderRoot: cardRenderRoot(cardName),
      // Only append the card description when asked (some renderWhole cards
      // already carry their effect text inside the render, or their
      // metadata.description is a VP, not the effect).
      text,
      description: text,
      signature: EMPTY_SIGNATURE,
    }];
  }

  // Text-only fallback.
  if (override?.text !== undefined) {
    return [{...base, key: cardName + '#text', effectIndex: 0, effectNode: undefined, renderRoot: undefined, text: override.text, description: override.text, signature: EMPTY_SIGNATURE}];
  }

  return collectEffectNodes(cardName).map((effectNode, i) => ({
    ...base,
    key: cardName + '#' + i,
    effectIndex: i,
    effectNode,
    renderRoot: undefined,
    text: undefined,
    description: descriptionString(effectNode),
    signature: effectSignature(effectNode),
  }));
}

/**
 * All passive effects of a player's tableau, in a STABLE, premium order:
 * corporation effects first (the player's defining ongoing rules), then the
 * blue/automated cards in play (tableau) order. A card with several effects
 * yields several entries.
 */
export function playerEffects(tableau: ReadonlyArray<CardModel>): Array<EffectEntry> {
  const corp: Array<EffectEntry> = [];
  const rest: Array<EffectEntry> = [];
  for (const card of tableau) {
    for (const entry of cardEffectEntries(card)) {
      (entry.isCorporation ? corp : rest).push(entry);
    }
  }
  return [...corp, ...rest];
}

/** Count of active passive effects for the badge. */
export function playerEffectCount(tableau: ReadonlyArray<CardModel>): number {
  return playerEffects(tableau).length;
}

// One SOURCE (card / corporation) and ALL of its passive effects. The overlay
// renders one group per source — the source name appears ONCE (no duplication
// when a card grants several effects) but each effect stays its OWN sub-block.
export type GroupEffect = {
  key: string;
  effectIndex: number;
  effectNode: ICardRenderEffect | undefined;
  renderRoot: ICardRenderRoot | undefined;
  text: string | undefined;
  description: string | undefined;
};

export type EffectGroup = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  isDisabled: boolean;
  effects: Array<GroupEffect>;
};

/**
 * The player's effects grouped by SOURCE card, preserving the corp-first,
 * tableau order of `playerEffects` (a card's effects are consecutive there, so
 * Map insertion order groups them correctly).
 */
export function playerEffectGroups(tableau: ReadonlyArray<CardModel>): Array<EffectGroup> {
  const groups = new Map<CardName, EffectGroup>();
  for (const e of playerEffects(tableau)) {
    let g = groups.get(e.cardName);
    if (g === undefined) {
      g = {
        key: e.cardName,
        cardName: e.cardName,
        isCorporation: e.isCorporation,
        isDisabled: e.isDisabled,
        effects: [],
      };
      groups.set(e.cardName, g);
    }
    g.effects.push({key: e.key, effectIndex: e.effectIndex, effectNode: e.effectNode, renderRoot: e.renderRoot, text: e.text, description: e.description});
  }
  return [...groups.values()];
}

// Current scope for the effects feature.
const SCOPE_MODULES: ReadonlySet<GameModule> =
  new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);

/**
 * Every in-scope card (Base / CorpEra / Promo / Venus / Colonies / Prelude) that
 * grants at least one passive effect — the data source for the dev playground
 * (?effectsPlayground), which mounts the overlay as if ALL of them were in play
 * so layout + edge cases can be eyeballed in one shot.
 */
export function allScopeEffectCardNames(): Array<CardName> {
  const out: Array<CardName> = [];
  for (const name of Object.values(CardName)) {
    const card = getCard(name);
    if (card === undefined || !SCOPE_MODULES.has(card.module)) {
      continue;
    }
    if (cardHasPassiveEffect(name)) {
      out.push(name);
    }
  }
  return out;
}

// ─── Dev diagnostics (?effectsPlayground "flagged" tab) ─────────────────────

/** Cards handled by a custom override (text-only or whole-renderData graphic). */
export function overriddenEffectCards(): Array<CardName> {
  return (Object.keys(EFFECT_OVERRIDES) as Array<CardName>)
    .filter((name) => {
      const o = EFFECT_OVERRIDES[name];
      return o !== undefined && o.exclude !== true;
    });
}

/**
 * In-scope ACTIVE/CORPORATION cards with NO action (`hasAction === false`) and
 * NO extractable effect graphic and no override — the candidates whose passive
 * rule (if any) is drawn as bespoke text/symbols and likely needs a hand-written
 * descriptor (e.g. Protected Habitats, Supercapacitors, Neptunian Power
 * Consultants). May include the odd vanilla card (e.g. a starter corporation) —
 * worth a human verdict, which is exactly what the flagged tab is for.
 */
export function flaggedEffectCandidates(): Array<CardName> {
  const out: Array<CardName> = [];
  for (const name of Object.values(CardName)) {
    const card = getCard(name);
    if (card === undefined || !SCOPE_MODULES.has(card.module)) {
      continue;
    }
    if (card.type !== CardType.ACTIVE && card.type !== CardType.CORPORATION) {
      continue;
    }
    if (card.hasAction === true || EFFECT_OVERRIDES[name] !== undefined) {
      continue;
    }
    if (collectEffectNodes(name).length > 0) {
      continue;
    }
    out.push(name);
  }
  return out;
}
