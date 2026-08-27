/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  ICardRenderEffect,
  ICardRenderRoot,
  ICardRenderSymbol,
  ItemType,
  isICardRenderRoot,
  isICardRenderEffect,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffectAction,
  isICardRenderSymbol,
} from '@/common/cards/render/Types';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {Size} from '@/common/cards/render/Size';

/*
 * Client-side extraction of a card's ACTIVATABLE ACTION graphics, for the
 * Actions overlay. Mirrors `effectExtraction.ts` but pulls the ACTION render
 * node(s) instead of the passive-effect ones. Everything is derived from the
 * static client card manifest (`getCard(name).metadata.renderData`) — the
 * action graphic is the printed rule; the live CardModel only carries the
 * availability/reason state (handled separately by the overlay).
 *
 * action() vs effect(): both produce an `is:'effect'` render node — they're
 * told apart by the DSL's description prefix ('Action: ' vs 'Effect: ') and the
 * delimiter symbol (arrow '->' for actions vs colon ':' for effects). corpBox
 * is already discriminated (corp-box-action / corp-box-effect-action carry the
 * action; corp-box-effect never does).
 *
 * GAME-MODEL NOTE: unlike a passive effect (a card can grant several), a card
 * has exactly ONE activatable action() at the game level — even an `or` action
 * that draws two render nodes is ONE activation that branches server-side. So a
 * card's action nodes all belong to one activation unit; the overlay renders
 * them inside ONE block with ONE activate affordance.
 */

export type ActionEntry = {
  // Stable v-for key (card name + ordinal — an `or` action can draw several).
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  // The card is out of the game (CEO turned off / disabled) — shown dimmed.
  isDisabled: boolean;
  // The action render node (rendered by CardRenderEffectBoxComponent), OR
  // undefined for an override.
  actionNode: ICardRenderEffect | undefined;
  // WHOLE-renderData graphics (rendered by CardRenderData) — used by a
  // `renderWhole` override for cards whose action is drawn as raw root rows.
  renderRoot: ICardRenderRoot | undefined;
  // Optional localized description text shown below the graphic (text-only
  // overrides, or the description for a `renderWhole` card).
  text: string | undefined;
};

/*
 * EDGE-CASE OVERRIDES. A handful of cards encode their action outside a clean
 * `action()` box; cover them here (same shape as EFFECT_OVERRIDES):
 *   - `exclude: true`     → never show this card as an action.
 *   - `renderWhole: true` → render the card's ENTIRE renderData root + its
 *                           description (for actions drawn as top-level rows).
 *   - `text: <i18n key>`  → a TEXT-ONLY block with this description (no graphic).
 * The generic renderData scan handles everything else. Populate this as the
 * ?actionsPlayground "flagged" tab surfaces problem cards.
 *
 * ⚠️ AN OVERRIDE IS A DEBT, NOT A DECORATION. It SUPPRESSES the generic scan,
 * so the day a card's renderData gains a real `action()` box the override keeps
 * winning and the printed graphic silently disappears from every action surface
 * — that is exactly how Arcadian Communities ended up drawing an EMPTY canvas
 * with a clipped sentence in it long after its corp box was re-authored with a
 * proper `ce.action()`. `staleActionOverrides()` (guarded by
 * actionExtraction.spec) fails the build with the list the moment an override
 * outlives its reason; delete the entry, don't re-word it.
 */
type ActionOverride = {exclude?: boolean; renderWhole?: boolean; descFromMeta?: boolean; text?: string};
// Empty today: every in-scope action card draws from its own render node.
const ACTION_OVERRIDES: Partial<Record<CardName, ActionOverride>> = {};

/** The (prefixed) description string of an action node, if present. */
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
 * The (English source) description of an action group node — its action-render
 * node's description string, or its text override. Used to MATCH a preview
 * branch to the render node that draws it (the branch graphic in the confirm
 * modal), since the render-node order can differ from the behavior order.
 */
export function actionNodeDescription(node: {actionNode?: ICardRenderEffect | undefined; text?: string | undefined}): string {
  if (node.actionNode !== undefined) {
    return descriptionString(node.actionNode) ?? '';
  }
  return node.text ?? '';
}

/** Is this item the `or()` connector symbol? */
function isOrSymbol(item: ItemType | undefined): boolean {
  return item !== undefined && isICardRenderSymbol(item) && item.type === CardRenderSymbolType.OR;
}

/**
 * …and the LAYOUT FILLER that surrounds it: the spacing the DSL habitually
 * writes beside a connector (`.nbsp.or()`), and the empty trailing slot the row
 * builder leaves at the end of every effect row. Both are meaningless once the
 * connector they spaced is gone — and the trailing one is why «is the last item
 * an OR?» answered no for a row that visibly ended in one.
 */
function isFiller(item: ItemType | undefined): boolean {
  if (item === undefined) {
    return false;
  }
  // ⚠️ The client reads render data from the JSON manifest (`cards.json`), and
  // JSON has no `undefined` — the builder's empty tail slot arrives as `null`.
  // A raw property read on it THREW while stripping the connector (Venus
  // Orbital Survey, Project Workshop), so null is checked before any read.
  if ((item as unknown) === null) {
    return true;
  }
  if (isICardRenderSymbol(item)) {
    return item.type === CardRenderSymbolType.NBSP || item.type === CardRenderSymbolType.EMPTY;
  }
  // The row builder's empty tail slot: no `is`, nothing to draw.
  return (item as unknown as {is?: unknown}).is === undefined;
}

/**
 * A copy of an action render node with its `or()` CONNECTOR stripped — the one
 * that joins this box to a SIBLING box on the printed card.
 *
 * The DSL draws an `or` action as STACKED boxes and marks the join in one of two
 * places, both of which are correct on the full card face and both of which are
 * ORPHANED the moment a single box is shown on its own (an Actions-overlay tile,
 * the composer's repeat slot, the Hydronetwork's pre-select row):
 *
 *  - LEADING, opening the 2nd+ box's CAUSE row — «ИЛИ <floater> → …» (Weather
 *    Balloons / Icy Impactors / Rotator Impacts);
 *  - TRAILING, closing the 1st box's EFFECT row — «1 M€ → <asteroid>* ИЛИ»
 *    (Asteroid Rights, whose first `action()` literally ends `.nbsp.or()`).
 *
 * Only the leading form used to be stripped, so a lone Asteroid Rights branch
 * read «… ИЛИ» with nothing after it — the same orphan, at the other end.
 *
 * An `or()` INSIDE an effect row is a different thing entirely («производство
 * M€ ИЛИ 2 титана» — one branch offering two outcomes) and is deliberately
 * left alone: only a connector at the very EDGE of the box joins boxes.
 *
 * Never mutates the shared manifest node (returns a shallow copy); a no-op for
 * a node that carries no edge connector.
 */
export function branchActionNode(node: ICardRenderEffect): ICardRenderEffect {
  const cause = node.rows[0];
  const effect = node.rows[2];
  let newCause = cause;
  if (isOrSymbol(cause?.[0])) {
    const trimmed = cause.slice(1);
    // An emptied cause makes the box renderer drop the delimiter (the action
    // arrow), so keep an EMPTY placeholder — mirrors how the DSL uses `empty()`
    // for a cause-less action ("→ effect").
    newCause = trimmed.length > 0 ?
      trimmed :
      [{is: 'symbol', type: CardRenderSymbolType.EMPTY, size: Size.MEDIUM} as ICardRenderSymbol];
  }
  let newEffect = effect;
  if (effect !== undefined) {
    // Walk in past the trailing filler to find the row's LAST MEANINGFUL item.
    let end = effect.length;
    while (end > 0 && isFiller(effect[end - 1])) {
      end--;
    }
    if (end > 0 && isOrSymbol(effect[end - 1])) {
      // …and cut the spacing that preceded the connector with it. Never empties
      // the row: a box with no effect at all is not a branch, so a degenerate
      // node is left exactly as it is.
      let cut = end - 1;
      while (cut > 1 && isFiller(effect[cut - 1])) {
        cut--;
      }
      if (cut > 0) {
        newEffect = effect.slice(0, cut);
      }
    }
  }
  if (newCause === cause && newEffect === effect) {
    return node;
  }
  return {...node, rows: [newCause, node.rows[1], newEffect]};
}

/**
 * Whether an `is:'effect'` node is an ACTIVE action (vs a passive `effect()`,
 * which the DSL renders with the same node type). Primary signal = the
 * description prefix the DSL bakes in; fallback = the delimiter symbol.
 */
function isActionNode(node: ICardRenderEffect): boolean {
  const desc = descriptionString(node);
  if (desc !== undefined) {
    if (desc.startsWith('Action: ')) {
      return true;
    }
    if (desc.startsWith('Effect: ')) {
      return false;
    }
  }
  const delim = node.rows?.[1]?.[0];
  if (delim !== undefined && isICardRenderSymbol(delim)) {
    if (delim.type === CardRenderSymbolType.ARROW) {
      return true;
    }
    if (delim.type === CardRenderSymbolType.COLON) {
      return false;
    }
  }
  // Ambiguous (no description, no clear delimiter) → exclude to avoid noise;
  // such cards are handled via ACTION_OVERRIDES when they matter.
  return false;
}

/** Memo of collectActionNodes — a card's printed renderData is STATIC, but the
 *  walk ran per tableau action card on EVERY wheel open / Action Center render
 *  (late game: dozens of tree walks per open, all recomputing the same answer). */
const actionNodesMemo = new Map<CardName, Array<ICardRenderEffect>>();

/** Pull every action node out of a card's renderData, incl. nested in a
 *  corporation action / effect-action box. Memoized: static per card name. */
function collectActionNodes(cardName: CardName): Array<ICardRenderEffect> {
  const memo = actionNodesMemo.get(cardName);
  if (memo !== undefined) {
    return memo;
  }
  const card = getCard(cardName);
  const renderData = card?.metadata.renderData;
  const out: Array<ICardRenderEffect> = [];
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    actionNodesMemo.set(cardName, out);
    return out;
  }
  for (const row of renderData.rows) {
    for (const item of row) {
      if (isICardRenderEffect(item)) {
        if (isActionNode(item)) {
          out.push(item);
        }
      } else if (isICardRenderCorpBoxAction(item) || isICardRenderCorpBoxEffectAction(item)) {
        // A corp action / effect-action box holds its node(s) inside its rows;
        // it can mix an effect() with an action() (e.g. StormCraft), so still
        // filter by isActionNode and keep only the action(s).
        for (const innerRow of item.rows) {
          for (const inner of innerRow) {
            if (isICardRenderEffect(inner) && isActionNode(inner)) {
              out.push(inner);
            }
          }
        }
      }
      // corp-box-effect and everything else carries no action.
    }
  }
  actionNodesMemo.set(cardName, out);
  return out;
}

/** Whether a card has at least one activatable action (the manifest flag is the
 *  authoritative game-level signal; the graphic may still need an override). */
export function cardHasAction(cardName: CardName): boolean {
  const override = ACTION_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return false;
  }
  return getCard(cardName)?.hasAction === true;
}

/** Whether a card's action graphic is extractable (or covered by an override). */
function cardHasActionGraphic(cardName: CardName): boolean {
  const override = ACTION_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return false;
  }
  if (override?.renderWhole === true || override?.text !== undefined) {
    return true;
  }
  return collectActionNodes(cardName).length > 0;
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

/** Build the action entries (one per action render node) for a single card. */
function cardActionEntries(card: CardModel): Array<ActionEntry> {
  const cardName = card.name;
  // Only cards the game treats as action cards.
  if (getCard(cardName)?.hasAction !== true) {
    return [];
  }
  const override = ACTION_OVERRIDES[cardName];
  if (override?.exclude === true) {
    return [];
  }
  const isCorporation = getCard(cardName)?.type === CardType.CORPORATION;
  const isDisabled = card.isDisabled === true;
  const base = {cardName, isCorporation, isDisabled};

  if (override?.renderWhole === true) {
    return [{
      ...base,
      key: cardName + '#whole',
      actionNode: undefined,
      renderRoot: cardRenderRoot(cardName),
      text: override.text ?? (override.descFromMeta === true ? cardDescriptionText(cardName) : undefined),
    }];
  }

  if (override?.text !== undefined) {
    return [{...base, key: cardName + '#text', actionNode: undefined, renderRoot: undefined, text: override.text}];
  }

  const nodes = collectActionNodes(cardName);
  if (nodes.length === 0) {
    // The card has an action but no extractable graphic (and no override) — show
    // a text-only block from its description so it's never silently missing.
    return [{...base, key: cardName + '#fallback', actionNode: undefined, renderRoot: undefined, text: cardDescriptionText(cardName)}];
  }
  return nodes.map((actionNode, i) => ({
    ...base,
    key: cardName + '#' + i,
    actionNode,
    renderRoot: undefined,
    text: undefined,
  }));
}

/**
 * All activatable actions of a player's tableau, in a STABLE, premium order:
 * corporation actions first (the player's defining repeatable ability), then the
 * blue cards in play (tableau) order. An `or` action yields several entries (all
 * belonging to ONE activation unit / card).
 */
export function playerActions(tableau: ReadonlyArray<CardModel>): Array<ActionEntry> {
  const corp: Array<ActionEntry> = [];
  const rest: Array<ActionEntry> = [];
  for (const card of tableau) {
    for (const entry of cardActionEntries(card)) {
      (entry.isCorporation ? corp : rest).push(entry);
    }
  }
  return [...corp, ...rest];
}

// One SOURCE (card / corporation) and ITS action (the activation unit). Unlike
// effects, a source has exactly one action — but its graphic may be several
// render nodes (an `or` action). The overlay renders one group per source with
// ONE activate affordance.
export type ActionGroup = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  isDisabled: boolean;
  nodes: Array<{
    key: string;
    actionNode: ICardRenderEffect | undefined;
    renderRoot: ICardRenderRoot | undefined;
    text: string | undefined;
  }>;
};

/**
 * The player's actions grouped by SOURCE card, preserving the corp-first,
 * tableau order of `playerActions` (a card's nodes are consecutive there, so
 * Map insertion order groups them correctly). One group = one activatable card.
 */
export function playerActionGroups(tableau: ReadonlyArray<CardModel>): Array<ActionGroup> {
  const groups = new Map<CardName, ActionGroup>();
  for (const e of playerActions(tableau)) {
    let g = groups.get(e.cardName);
    if (g === undefined) {
      g = {
        key: e.cardName,
        cardName: e.cardName,
        isCorporation: e.isCorporation,
        isDisabled: e.isDisabled,
        nodes: [],
      };
      groups.set(e.cardName, g);
    }
    g.nodes.push({key: e.key, actionNode: e.actionNode, renderRoot: e.renderRoot, text: e.text});
  }
  return [...groups.values()];
}

/** Count of action SOURCES (cards with an action) — drives the button "all"
 *  badge so it matches the card-based server `availableBlueCardActionCount`. */
export function playerActionSourceCount(tableau: ReadonlyArray<CardModel>): number {
  return playerActionGroups(tableau).length;
}

// Current scope for the actions feature (same as the effects overlay).
const SCOPE_MODULES: ReadonlySet<GameModule> =
  new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/**
 * Every in-scope card (Base / CorpEra / Promo / Venus / Colonies / Prelude) with
 * an activatable action — the data source for the dev playground
 * (?actionsPlayground), which mounts the overlay as if ALL of them were in play.
 */
export function allScopeActionCardNames(): Array<CardName> {
  const out: Array<CardName> = [];
  for (const name of Object.values(CardName)) {
    const card = getCard(name);
    if (card === undefined || !SCOPE_MODULES.has(card.module)) {
      continue;
    }
    if (cardHasAction(name)) {
      out.push(name);
    }
  }
  return out;
}

// ─── Dev diagnostics (?actionsPlayground "flagged" tab) ─────────────────────

/** Cards handled by a custom override (text-only or whole-renderData graphic). */
export function overriddenActionCards(): Array<CardName> {
  return (Object.keys(ACTION_OVERRIDES) as Array<CardName>)
    .filter((name) => {
      const o = ACTION_OVERRIDES[name];
      return o !== undefined && o.exclude !== true;
    });
}

/**
 * Overrides that have OUTLIVED their reason: the card now carries a real,
 * extractable `action()` render node, so the override is suppressing the
 * printed graphic in favour of a hand-written sentence. Deliberately scanned
 * over EVERY module (an override is a fork-authored entry — it rots whether or
 * not its card is in premium scope). Guard-asserted empty; the fix is always
 * to DELETE the entry.
 */
export function staleActionOverrides(): Array<CardName> {
  return (Object.keys(ACTION_OVERRIDES) as Array<CardName>)
    .filter((name) => {
      const o = ACTION_OVERRIDES[name];
      // `exclude` is a game-level decision, never invalidated by a render node.
      return o !== undefined && o.exclude !== true && collectActionNodes(name).length > 0;
    });
}

/**
 * In-scope cards that HAVE an action (`hasAction === true`) but whose action
 * graphic is NOT cleanly extractable (no action render node) and have no
 * override — the candidates whose action is drawn as bespoke text/symbols and
 * likely needs a hand-written descriptor. The ?actionsPlayground flagged tab.
 */
export function flaggedActionCandidates(): Array<CardName> {
  const out: Array<CardName> = [];
  for (const name of Object.values(CardName)) {
    const card = getCard(name);
    if (card === undefined || !SCOPE_MODULES.has(card.module)) {
      continue;
    }
    if (card.hasAction !== true || ACTION_OVERRIDES[name] !== undefined) {
      continue;
    }
    if (cardHasActionGraphic(name)) {
      continue;
    }
    out.push(name);
  }
  return out;
}
