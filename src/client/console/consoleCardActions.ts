/*
 * CONSOLE BLUE-CARD ACTION CENTER — the PURE view model (CONSOLE_MODE_CONCEPT.md
 * §9 "Actions"; the console-native rewrite of the desktop ДЕЙСТВИЯ overlay).
 *
 * Turns the SHARED desktop action data (`buildActionEntries` → per-source
 * availability state, `playerActionGroups` → the printed render nodes, the
 * `/api/action-preview` branches) into a TV-first model for the console
 * surface (ConsoleCardActions.vue): one GROUP per action source, each with
 * one or more variant TILES (the render nodes, "ИЛИ" between them), a live
 * cost→reward formula built from the branch's `ActionEffect` chips, a
 * per-VARIANT availability status (a multi-branch card can have one branch
 * available and another blocked — Электрокатапульта: spend plant OK, spend
 * steel blocked), the two faceted filter dimensions counted BY VARIANT (the
 * console shows every variant, so a card with one available + one blocked
 * branch is `+1` in "Available" AND `+1` in "Unavailable"), and a flat focus
 * order over the visible tiles.
 *
 * It NEVER re-derives a game rule: availability + reasons come from
 * `computeActionState` (server-authoritative `CardModel.actionReasons` + the
 * `Perform an action from a played card` SelectCard membership); the
 * node→branch mapping is `branchPositionForNode` (the same token-overlap
 * match the desktop overlay uses — the submitted branch is always
 * `branch.index`, never the node ordinal). No Vue / DOM / i18n in the builder
 * (labels are English i18n KEYS the component translates); the reactive UI
 * store below is the ONE piece of mutable state, kept module-level so the
 * shell's command bar can read the confirm/filter state.
 *
 * Pure + unit-tested (tests/client/components/console/consoleCardActions.spec.ts).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Message} from '@/common/logs/Message';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {ActionEntry, ActionFilterState, AvailabilityFilter, ActivationFilter} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {branchPositionForNode, stripNodeOr} from '@/client/components/actions/actionBranchView';

type GroupNode = ActionGroup['nodes'][number];

/** A normalized "why not" reason — a raw i18n template + its params; the
 *  component translates via `translateTextWithParams` / `translateMessage`. */
export type ConsoleActionReason = {message: string | Message, params: ReadonlyArray<string>};

/** One variant (render node) of a source card's action. */
export type ConsoleActionTile = {
  /** Stable focus id — `cardName#nodeIndex`. */
  key: string;
  cardName: CardName;
  nodeIndex: number;
  /** The printed render node (leading `or()` connector stripped). */
  node: GroupNode;
  /** Per-VARIANT status (refined from the card state by the branch's availability). */
  status: ActionStatus;
  /** The preview branch resolved for this node (undefined until the preview
   *  loads, or for a combined-node card whose 1 node draws every branch). */
  branch: ActionPreviewBranch | undefined;
  /** The branch's COST chips (spent / lost) — the left side of the formula. */
  costEffects: ReadonlyArray<ActionEffect>;
  /** The branch's GAIN chips (produced / raised) — the right side. */
  gainEffects: ReadonlyArray<ActionEffect>;
  /** Why this variant can't be used right now (undefined when available). */
  reason: ConsoleActionReason | undefined;
};

/** One action SOURCE (card / corporation) and its variant tiles. */
export type ConsoleActionGroup = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  /** Card-level status (the best of its variants — drives the group badge + sort). */
  status: ActionStatus;
  /** The stored resource on the source card (microbes/animals/floaters), if any. */
  cardResource: {type: CardResource, count: number} | undefined;
  tiles: ReadonlyArray<ConsoleActionTile>;
};

export type ConsoleFilterChip<T> = {value: T, label: string, count: number, active: boolean};

export type ConsoleActionsModel = {
  /** The filtered + status-sorted groups (available first, then blocked, then activated). */
  groups: ReadonlyArray<ConsoleActionGroup>;
  availabilityChips: ReadonlyArray<ConsoleFilterChip<AvailabilityFilter>>;
  activationChips: ReadonlyArray<ConsoleFilterChip<ActivationFilter>>;
  /** Total variants across every source (the header count — BY VARIANT). */
  totalTiles: number;
  /** Variants activatable right now (`status === 'available'`) — "can activate: N". */
  availableTiles: number;
  /** Flat focus order over the VISIBLE tiles (group order, node order within). */
  flatKeys: ReadonlyArray<string>;
};

/** The default filter — show everything, hide already-activated (they don't
 *  clutter the actions the player can still take; switch to see them). */
export function defaultCardActionsFilter(): ActionFilterState {
  return {availability: 'all', activation: 'dormant'};
}

/**
 * Module-level UI state the SHELL reads for the command bar (mirrors
 * `consoleJournalUi`): the persisted filter (survives close/reopen) + whether
 * the confirm sub-overlay is open (so the bar shows Confirm/Cancel instead of
 * the grid's contract, and the global Y=Information guard yields to it).
 */
export const consoleCardActionsUi = reactive({
  filter: defaultCardActionsFilter() as ActionFilterState,
  confirmOpen: false,
});

// ── filter predicates (BY VARIANT — mirror actionModel's entry-level rules) ──

function passAvailability(status: ActionStatus, availability: AvailabilityFilter): boolean {
  switch (availability) {
  // 'available' = rules-doable (activatable now, or just not the player's
  // window) — mirrors the hand overlay (a soft block still counts as available).
  case 'available': return status === 'available' || status === 'soft';
  case 'unavailable': return status === 'rules';
  default: return true;
  }
}

function passActivation(status: ActionStatus, activation: ActivationFilter): boolean {
  switch (activation) {
  case 'dormant': return status !== 'activated';
  case 'activated': return status === 'activated';
  default: return true;
  }
}

const AVAILABILITY_DEFS: ReadonlyArray<{value: AvailabilityFilter, label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'available', label: 'Available'},
  {value: 'unavailable', label: 'Unavailable'},
];

const ACTIVATION_DEFS: ReadonlyArray<{value: ActivationFilter, label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'dormant', label: 'Not activated'},
  {value: 'activated', label: 'Activated'},
];

/** Display/sort rank — available first, blocked/soft next, activated last. */
const STATUS_RANK: Record<ActionStatus, number> = {available: 0, rules: 1, soft: 1, activated: 2};

function reasonFrom(message: string | Message | undefined, params: ReadonlyArray<unknown> | undefined): ConsoleActionReason | undefined {
  if (message === undefined) {
    return undefined;
  }
  return {message, params: (params ?? []).map((p) => String(p))};
}

/** Build a source group's variant tiles, refining each by its preview branch. */
function buildTiles(
  entry: ActionEntry,
  preview: ActionPreview | undefined,
): Array<ConsoleActionTile> {
  const group = entry.group;
  const branches = preview?.branches ?? [];
  const cardStatus = entry.state.status;
  return group.nodes.map((node, i): ConsoleActionTile => {
    const pos = branchPositionForNode(group, branches, i);
    const branch = pos !== undefined ? branches[pos] : undefined;
    let status: ActionStatus = cardStatus;
    let reason: ConsoleActionReason | undefined;

    if (cardStatus === 'available') {
      // The card is activatable (≥1 branch available) — but THIS variant's
      // branch may itself be blocked (Rotator Impacts: "add asteroid" OK,
      // "spend asteroid → Venus" needs a resource on the card).
      if (branch !== undefined && branch.available === false) {
        status = 'rules';
        reason = reasonFrom(branch.unavailableReason ?? 'Unavailable right now', branch.unavailableReasonParams);
      }
    } else if (cardStatus === 'rules') {
      // The whole card is blocked — prefer this variant's own branch reason,
      // else the card-level structured reason.
      reason = (branch !== undefined && branch.available === false && branch.unavailableReason !== undefined) ?
        reasonFrom(branch.unavailableReason, branch.unavailableReasonParams) :
        reasonFrom(entry.state.reasons[0]?.message, entry.state.reasons[0]?.params);
    } else {
      // soft / activated — the single calm reason applies to every variant.
      reason = reasonFrom(entry.state.softReason?.message, entry.state.softReason?.params);
    }

    const effects = branch?.effects ?? [];
    return {
      key: entry.cardName + '#' + i,
      cardName: entry.cardName,
      nodeIndex: i,
      node: stripNodeOr(node),
      status,
      branch,
      costEffects: effects.filter((e) => e.direction === 'cost'),
      gainEffects: effects.filter((e) => e.direction === 'gain'),
      reason,
    };
  });
}

/**
 * Build the whole console action-center model from the SHARED desktop entries
 * (already annotated with availability state), the per-card previews (lazily
 * fetched — a card with no preview yet shows the DSL graphic + card-level
 * status), the live card-resource counts, and the two-dimension filter.
 */
export function buildConsoleActionsModel(
  entries: ReadonlyArray<ActionEntry>,
  previews: ReadonlyMap<CardName, ActionPreview>,
  cardResources: ReadonlyMap<CardName, {type: CardResource, count: number}>,
  filter: ActionFilterState,
): ConsoleActionsModel {
  // Build every group + its variant tiles (unfiltered), then status-sort.
  const groups: Array<ConsoleActionGroup> = entries.map((entry) => {
    const tiles = buildTiles(entry, previews.get(entry.cardName));
    const status = tiles.reduce<ActionStatus>(
      (best, t) => (STATUS_RANK[t.status] < STATUS_RANK[best] ? t.status : best),
      tiles[0]?.status ?? entry.state.status,
    );
    return {
      key: entry.cardName,
      cardName: entry.cardName,
      isCorporation: entry.isCorporation,
      status,
      cardResource: cardResources.get(entry.cardName),
      tiles,
    };
  });
  // Stable sort by card-level status (available → blocked → activated); the
  // corp-first tableau order the entries arrive in is preserved within a band.
  const sorted = groups
    .map((g, i) => ({g, i}))
    .sort((a, b) => (STATUS_RANK[a.g.status] - STATUS_RANK[b.g.status]) || (a.i - b.i))
    .map((x) => x.g);

  const allTiles = sorted.flatMap((g) => g.tiles);

  // Faceted counts — each dimension counts within the OTHER's current slice.
  const availabilityChips = AVAILABILITY_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: allTiles.filter((t) =>
      passActivation(t.status, filter.activation) && passAvailability(t.status, def.value)).length,
    active: filter.availability === def.value,
  }));
  const activationChips = ACTIVATION_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: allTiles.filter((t) =>
      passAvailability(t.status, filter.availability) && passActivation(t.status, def.value)).length,
    active: filter.activation === def.value,
  }));

  // Filter each group's tiles by BOTH dimensions; keep a group only when a
  // variant survives (a card whose sole surviving variant is the blocked one
  // still shows — the player can read WHY; a card with no surviving variant
  // is hidden).
  const visibleGroups: Array<ConsoleActionGroup> = [];
  for (const g of sorted) {
    const tiles = g.tiles.filter((t) =>
      passAvailability(t.status, filter.availability) && passActivation(t.status, filter.activation));
    if (tiles.length > 0) {
      visibleGroups.push({...g, tiles});
    }
  }

  return {
    groups: visibleGroups,
    availabilityChips,
    activationChips,
    totalTiles: allTiles.length,
    availableTiles: allTiles.filter((t) => t.status === 'available').length,
    flatKeys: visibleGroups.flatMap((g) => g.tiles.map((t) => t.key)),
  };
}

/** PURE: step the availability filter left/right through its three values. */
export function cycleAvailability(current: AvailabilityFilter, step: 1 | -1): AvailabilityFilter {
  const order = AVAILABILITY_DEFS.map((d) => d.value);
  const i = order.indexOf(current);
  return order[(i + step + order.length) % order.length];
}

/** PURE: step the activation filter left/right through its three values. */
export function cycleActivation(current: ActivationFilter, step: 1 | -1): ActivationFilter {
  const order = ACTIVATION_DEFS.map((d) => d.value);
  const i = order.indexOf(current);
  return order[(i + step + order.length) % order.length];
}
