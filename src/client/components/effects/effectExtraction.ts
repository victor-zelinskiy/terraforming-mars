import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  ICardRenderEffect,
  ItemType,
  isICardRenderRoot,
  isICardRenderEffect,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderSymbol,
} from '@/common/cards/render/Types';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';

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
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  // The card is out of the game (e.g. PharmacyUnion turned into a disease) —
  // its effect is shown dimmed.
  isDisabled: boolean;
  // The effect render node (rendered by CardRenderEffectBoxComponent), OR
  // undefined for an override that only supplies text.
  effectNode: ICardRenderEffect | undefined;
  // Optional manual text for edge-case cards whose passive effect isn't a clean
  // render node (the localized i18n key for the effect description).
  text: string | undefined;
};

/*
 * EDGE-CASE OVERRIDES. Per the task brief, a handful of cards encode their
 * passive effect as plain text / non-`effect()` graphics, or mix effect+action
 * in a way the generic scan can't cleanly separate. Cover them here:
 *   - `exclude: true`              → never show this card's effects.
 *   - `text: <i18n key>`           → show a TEXT-ONLY block with this description.
 * The generic renderData scan handles everything else. Populate this as the
 * playground surfaces problem cards.
 */
type EffectOverride = {exclude?: boolean; text?: string};
const EFFECT_OVERRIDES: Partial<Record<CardName, EffectOverride>> = {
  // ── Plain-text passive effects (no clean `effect()` render node) ──────────
  // Olympus Conference's trigger is drawn with raw tags/symbols, not an
  // effect() box — its (already-localized) card description IS the effect text.
  [CardName.OLYMPUS_CONFERENCE]: {
    text: 'When you play a science tag, including this, either add a science resource to this card, or remove a science resource from this card to draw a card.',
  },
  // TODO(effects-playground): these three encode a passive rule as bespoke
  // renderData text with no `effect()` node AND no usable card description, so
  // they need a hand-written localized descriptor. Surfaced by the playground;
  // left here as the documented edge-case backlog (they don't block the system).
  //   PROTECTED_HABITATS          — "Opponents may not remove your plants/animals/microbes."
  //   SUPERCAPACITORS             — heat-as-energy conversion rule.
  //   NEPTUNIAN_POWER_CONSULTANTS — ocean-placed optional resource gain.
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

/** Pull every passive-effect node out of a card's renderData, incl. nested in
 *  a corporation effect box. */
function collectEffectNodes(cardName: CardName): Array<ICardRenderEffect> {
  const card = getCard(cardName);
  const renderData = card?.metadata.renderData;
  const out: Array<ICardRenderEffect> = [];
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return out;
  }
  for (const row of renderData.rows) {
    for (const item of row) {
      if (isICardRenderEffect(item)) {
        if (isPassiveEffectNode(item)) {
          out.push(item);
        }
      } else if (isICardRenderCorpBoxEffect(item) || isICardRenderCorpBoxEffectAction(item)) {
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
  }
  return out;
}

/** Whether a card grants at least one passive effect (drives playground/count). */
export function cardHasPassiveEffect(cardName: CardName): boolean {
  const override = EFFECT_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return false;
  }
  if (override?.text !== undefined) {
    return true;
  }
  return collectEffectNodes(cardName).length > 0;
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

  if (override?.text !== undefined) {
    return [{
      key: cardName + '#text',
      cardName,
      isCorporation,
      isDisabled,
      effectNode: undefined,
      text: override.text,
    }];
  }

  return collectEffectNodes(cardName).map((effectNode, i) => ({
    key: cardName + '#' + i,
    cardName,
    isCorporation,
    isDisabled,
    effectNode,
    text: undefined,
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
export type EffectGroup = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  isDisabled: boolean;
  effects: Array<{
    key: string;
    effectNode: ICardRenderEffect | undefined;
    text: string | undefined;
  }>;
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
    g.effects.push({key: e.key, effectNode: e.effectNode, text: e.text});
  }
  return [...groups.values()];
}

// Current scope for the effects feature.
const SCOPE_MODULES: ReadonlySet<GameModule> =
  new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

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

/** Cards whose passive effect is covered by a TEXT-only override (no graphic). */
export function textOverrideEffectCards(): Array<CardName> {
  return (Object.keys(EFFECT_OVERRIDES) as Array<CardName>)
    .filter((name) => EFFECT_OVERRIDES[name]?.text !== undefined);
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
