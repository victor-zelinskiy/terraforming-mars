/*
 * CONSOLE BLUE-CARD ACTION CENTER — the PURE view model (docs/CONSOLE_MODE_CONCEPT.md
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
import {SelectAmountModel} from '@/common/models/PlayerInputModel';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {ActionEntry, ActionFilterState, AvailabilityFilter, ActivationFilter} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {branchPositionForNode, branchPositionsForNode, branchTitleText, stripNodeOr} from '@/client/components/actions/actionBranchView';
import {ActionRules, actionRules} from '@/client/components/actions/actionDescription';
import {ActionBranchScope, branchMetricTokens} from '@/client/components/actions/actionUsageSummary';
import {resourceScoring, accumulatedVp} from '@/client/components/additionalResources/additionalResources';

type GroupNode = ActionGroup['nodes'][number];

/** A normalized "why not" reason — a raw i18n template + its params; the
 *  component translates via `translateTextWithParams` / `translateMessage`. */
export type ConsoleActionReason = {message: string | Message, params: ReadonlyArray<string>};

/**
 * A VARIABLE piece of an action formula — a value the PLAYER will choose in the
 * composer (never a debug "X → X"). Derived STRUCTURALLY from the branch's
 * amount inputs: `spend`/`result` pairs come from the model's `amountResult` /
 * `conversion` hints (their spend-vs-produce semantics are part of the model —
 * "spend X energy → draw X cards"); a bare amount input with no hint renders as
 * a NEUTRAL `choice` chip (icon + range + "your choice") — honest, never a
 * guessed direction.
 */
export type ConsoleVariableChip = {
  role: 'spend' | 'result' | 'choice';
  icon?: string;
  min: number;
  max: number;
  unit?: string;
};

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
  /** The branch's COST chips (spent / lost) — the left side of the formula.
   *  Filtered: a static chip superseded by a variable spend/result is dropped. */
  costEffects: ReadonlyArray<ActionEffect>;
  /** The branch's GAIN chips (produced / raised) — the right side. */
  gainEffects: ReadonlyArray<ActionEffect>;
  /** Player-chosen VARIABLE parts of the formula (amount inputs) — the
   *  "spend X energy → draw X cards" family. Rendered as premium range chips. */
  variableCost: ReadonlyArray<ConsoleVariableChip>;
  variableGain: ReadonlyArray<ConsoleVariableChip>;
  /** Direction-unknown amount choices — an honest separate "you choose" cluster. */
  variableChoice: ReadonlyArray<ConsoleVariableChip>;
  /** True when activating this variant requires pre-submit choices (the
   *  composer will host them) — drives the tile's "choice" marker. */
  hasChoices: boolean;
  /** Activated this generation (the activation-filter dimension). In REPEAT
   *  mode this is INDEPENDENT of `status` (a candidate is both used-this-gen
   *  AND selectable), so the filter reads this flag, not `status === 'activated'`. */
  usedThisGen: boolean;
  /** NON-amount pre-submit choice kinds (card / player / or / payment /
   *  spendHeat) — the tile names them ("choose a card") since no range chip
   *  can express them. Amount choices ride `variableCost`/`variableGain`. */
  choiceKinds: ReadonlyArray<'card' | 'player' | 'or' | 'payment' | 'spendHeat'>;
  /** Why this variant can't be used right now (undefined when available). */
  reason: ConsoleActionReason | undefined;
  /** How many variants the SOURCE card has (1 = a single-action card) — the
   *  flat grid's tiles are self-describing, so the «N/M» badge lives here. */
  variantTotal: number;
  /** The source card's stored resource (microbes / animals / floaters). */
  cardResource: {type: CardResource, count: number} | undefined;
  isCorporation: boolean;
  /** THIS action's rule text (i18n keys) — the card's own printed / curated
   *  wording for exactly this variant, never the whole card's. */
  rules: ActionRules | undefined;
};

/**
 * A tile as the FLAT 2-column grid lays it out: the browse list packs ACTION
 * BUTTONS two abreast regardless of which card they belong to (a row may hold
 * the last variant of one card and the first of the next). Grouping reads
 * from the tile itself — the card's name + the «N/M» badge — plus the «или»
 * JOINT drawn between two siblings that happen to land side by side.
 */
export type ConsoleActionFlatTile = ConsoleActionTile & {
  /** The tile to the LEFT in the same row is the SAME card's sibling variant
   *  → the «или» joint rides their shared edge. */
  joinLeft: boolean;
};

/** One action SOURCE (card / corporation) and its variant tiles. */
export type ConsoleActionGroup = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  /** Card-level status (the best of its variants — drives the group badge). */
  status: ActionStatus;
  /** The SERVER-side card status (`entry.state.status`) — the SORT key.
   *  Deliberately NOT the preview-refined `status`: previews arrive
   *  asynchronously, and sorting by a value that changes on arrival made the
   *  whole grid re-order under the player's cursor a beat after opening. */
  sortStatus: ActionStatus;
  /** Activated this generation (for the repeat-mode activation filter). */
  usedThisGen: boolean;
  /** The stored resource on the source card (microbes/animals/floaters), if any. */
  cardResource: {type: CardResource, count: number} | undefined;
  /**
   * The card's RESOURCE-SCORED victory points, when its VP rule counts what is
   * stored on it (`resourcesHere` — Regolith Eaters, Nitrite Reducing
   * Bacteria, …). Read-only, from the SHARED scorer the additional-resources
   * panel uses (`accumulatedVp`) — never a second formula: `points` is what
   * the card is worth right now, `toNext` how many more resources buy the next
   * point. `undefined` for a card that merely stores a resource.
   */
  vp: {points: number, toNext: number} | undefined;
  /** The card's action buttons IN GRID ORDER (`joinLeft` marks the one that
   *  shares a row with the sibling to its left — where the «или» joint goes). */
  tiles: ReadonlyArray<ConsoleActionFlatTile>;
};

export type ConsoleFilterChip<T> = {value: T, label: string, count: number, active: boolean};

export type ConsoleActionsModel = {
  /** The filtered + status-sorted groups (available first, then blocked, then activated). */
  groups: ReadonlyArray<ConsoleActionGroup>;
  /** The FLAT grid order the browse list renders (groups flattened, sibling
   *  variants adjacent) — the layout unit is the action button. */
  tiles: ReadonlyArray<ConsoleActionFlatTile>;
  availabilityChips: ReadonlyArray<ConsoleFilterChip<AvailabilityFilter>>;
  activationChips: ReadonlyArray<ConsoleFilterChip<ActivationFilter>>;
  /** Total variants across every source (the header count — BY VARIANT). */
  totalTiles: number;
  /** Variants activatable right now (`status === 'available'`) — "can activate: N". */
  availableTiles: number;
  /** Flat focus order over the VISIBLE tiles (group order, node order within). */
  flatKeys: ReadonlyArray<string>;
  /** The 2-COLUMN visual grid as focus rows (see {@link packActionRows}) —
   *  the d-pad's spatial map (left/right within a row, up/down across). */
  rows: ReadonlyArray<ReadonlyArray<string>>;
};

/**
 * Pack the visible tiles into the browse grid's FOCUS ROWS, mirroring the CSS
 * layout exactly.
 *
 * The CARD is the grouping unit and is never split: a single-action card takes
 * one of the two columns (consecutive singles pack abreast), a card with
 * ALTERNATIVES takes the whole row — its buttons stand side by side with the
 * «или» joint on their shared edge, on the SAME physical columns as two
 * singles, so every action button across the screen shares one width rhythm.
 * A card that needs the full row after a half-filled one CLOSES that row (the
 * grid moves on, leaving the hole) — the model mirrors that exactly, so d-pad
 * geometry always matches what the eye sees.
 */
export function packActionRows(
  groups: ReadonlyArray<ConsoleActionGroup>,
  columns: 1 | 2 = 2,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [];
  let half: Array<string> | undefined;
  const flushHalf = () => {
    if (half !== undefined) {
      rows.push(half);
      half = undefined;
    }
  };
  for (const g of groups) {
    if (g.tiles.length === 1 && columns === 2) {
      if (half === undefined) {
        half = [g.tiles[0].key];
      } else {
        half.push(g.tiles[0].key);
        flushHalf();
      }
      continue;
    }
    flushHalf();
    if (columns === 1) {
      // Handheld: one action button per row — the card zone still groups them
      // visually, but nothing stands abreast.
      for (const t of g.tiles) {
        rows.push([t.key]);
      }
      continue;
    }
    // A card with alternatives owns the full row: its buttons pack two abreast
    // (the dominant «или» pair fills it exactly; a 3+-variant card wraps onto
    // as many full rows as it needs).
    for (let i = 0; i < g.tiles.length; i += columns) {
      rows.push(g.tiles.slice(i, i + columns).map((t) => t.key));
    }
  }
  flushHalf();
  return rows;
}

/**
 * PURE: order the groups so the 2-column grid leaves no HOLES.
 *
 * A card with alternatives needs a full row, so meeting one while a row is
 * half-filled used to strand that half empty. This pulls the NEAREST
 * single-action card forward into the hole — a minimal, local reorder that
 * never crosses a status band (the availability grouping the player reads
 * first stays intact) and never splits a card. One column (handheld) has no
 * holes to fill, so the order passes through untouched.
 */
export function arrangeGroupsForGrid<T extends {tiles: ReadonlyArray<unknown>, sortStatus: ActionStatus}>(
  groups: ReadonlyArray<T>,
  columns: 1 | 2 = 2,
): Array<T> {
  if (columns === 1) {
    return [...groups];
  }
  const rest = [...groups];
  const out: Array<T> = [];
  let holeOpen = false; // the current row has one free column
  while (rest.length > 0) {
    const next = rest[0];
    if (holeOpen && next.tiles.length > 1) {
      // A wide card would close the row — pull the nearest single of the SAME
      // band into the hole instead (if there is one).
      const filler = rest.findIndex((g) => g.tiles.length === 1 && g.sortStatus === next.sortStatus);
      if (filler > 0) {
        out.push(...rest.splice(filler, 1));
        holeOpen = false;
        continue;
      }
    }
    rest.shift();
    out.push(next);
    holeOpen = next.tiles.length === 1 ? !holeOpen : false;
  }
  return out;
}

/** PURE: step the focus through the packed rows (clamped — the edge is felt). */
export function stepActionRows(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  current: string,
  dir: 'up' | 'down' | 'left' | 'right',
): string {
  if (rows.length === 0) {
    return current;
  }
  let r = 0;
  let c = 0;
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].indexOf(current);
    if (j !== -1) {
      r = i;
      c = j;
      break;
    }
  }
  if (dir === 'left' || dir === 'right') {
    c = Math.min(rows[r].length - 1, Math.max(0, c + (dir === 'left' ? -1 : 1)));
  } else {
    r = Math.min(rows.length - 1, Math.max(0, r + (dir === 'up' ? -1 : 1)));
    c = Math.min(c, rows[r].length - 1);
  }
  return rows[r][c];
}

/** The default filter — show everything, hide already-activated (they don't
 *  clutter the actions the player can still take; switch to see them). */
export function defaultCardActionsFilter(): ActionFilterState {
  return {availability: 'all', activation: 'dormant'};
}

/** The default REPEAT-mode filter — «Активированы + Доступна», so the player
 *  sees exactly the copyable actions; relaxing either filter reveals the rest
 *  (with an honest reason why they can't be repeated). */
export function defaultRepeatFilter(): ActionFilterState {
  return {availability: 'available', activation: 'activated'};
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

/**
 * REPEAT-mode availability (ProjectInspection / Viron): the SAME grid, but the
 * "available" dimension means "selectable for repeat" (a candidate = used this
 * generation AND `canAct`), and the "activated" dimension is INDEPENDENT (read
 * from `usedThisGen`, not the status) — so a candidate is BOTH activated AND
 * available, and the default «Активированы + Доступна» filter shows exactly the
 * copyable actions while everything else stays visible with a reason.
 */
export type RepeatAvailability = {
  /** Cards selectable for repeat (the server's repeat SelectCard candidates). */
  candidates: ReadonlySet<CardName>;
  /** Cards activated this generation (the activation dimension). */
  used: ReadonlySet<CardName>;
};

function passAvailability(status: ActionStatus, availability: AvailabilityFilter): boolean {
  switch (availability) {
  // 'available' = rules-doable (activatable now, or just not the player's
  // window) — mirrors the hand overlay (a soft block still counts as available).
  // In REPEAT mode there is no 'soft', so this is exactly the selectable set.
  case 'available': return status === 'available' || status === 'soft';
  case 'unavailable': return status === 'rules';
  default: return true;
  }
}

function passActivation(tile: {status: ActionStatus, usedThisGen: boolean}, activation: ActivationFilter, repeat: boolean): boolean {
  // Normal mode: "activated" IS the status. Repeat mode: it is the independent
  // used-this-generation flag (a selectable candidate is also activated).
  const activated = repeat ? tile.usedThisGen : tile.status === 'activated';
  switch (activation) {
  case 'dormant': return !activated;
  case 'activated': return activated;
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

/** Every SelectAmount carried by a branch (its direct optionInput + input steps). */
function branchAmountInputs(branch: ActionPreviewBranch): Array<SelectAmountModel> {
  const out: Array<SelectAmountModel> = [];
  if (branch.optionInput?.type === 'amount') {
    out.push(branch.optionInput as SelectAmountModel);
  }
  for (const step of branch.steps) {
    if (step.kind === 'input' && step.input.type === 'amount') {
      out.push(step.input as SelectAmountModel);
    }
  }
  return out;
}

/**
 * The VARIABLE formula parts of a branch + the static-chip icons they
 * supersede. An `amountResult`/`conversion` hint is structural spend→produce
 * semantics, so the matching static chips (a fixed "+1 card" emitted as the
 * baseline) are SUPPRESSED in favour of the range pair — the formula must
 * never show both "+1 card" and "cards ×N" for the same outcome. A bare
 * amount input adds a neutral `choice` chip and suppresses nothing.
 * (Exported for the composer, which recomputes it per SELECTED branch.)
 */
export function variablePartsForBranch(branch: ActionPreviewBranch): {
  cost: Array<ConsoleVariableChip>,
  gain: Array<ConsoleVariableChip>,
  /** Direction-UNKNOWN choices — rendered in their OWN cluster (never under a
   *  spent/received label a bare SelectAmount doesn't structurally justify). */
  choice: Array<ConsoleVariableChip>,
  suppressCostIcons: ReadonlySet<string>,
  suppressGainIcons: ReadonlySet<string>,
} {
  const cost: Array<ConsoleVariableChip> = [];
  const gain: Array<ConsoleVariableChip> = [];
  const choice: Array<ConsoleVariableChip> = [];
  const suppressCostIcons = new Set<string>();
  const suppressGainIcons = new Set<string>();
  for (const m of branchAmountInputs(branch)) {
    if (m.amountResult !== undefined) {
      const perUnit = m.amountResult.perUnit ?? 1;
      cost.push({role: 'spend', icon: m.icon, min: m.min, max: m.max, unit: m.unit});
      gain.push({role: 'result', icon: m.amountResult.icon, min: m.min * perUnit, max: m.max * perUnit});
      if (m.icon !== undefined) {
        suppressCostIcons.add(m.icon);
      }
      suppressGainIcons.add(m.amountResult.icon);
    } else if (m.conversion !== undefined) {
      const ratio = m.conversion.ratio ?? 1;
      cost.push({role: 'spend', icon: m.conversion.from, min: m.min, max: m.max});
      gain.push({role: 'result', icon: m.conversion.to, min: m.min * ratio, max: m.max * ratio});
      suppressCostIcons.add(m.conversion.from);
      suppressGainIcons.add(m.conversion.to);
    } else if (m.amountCost !== undefined) {
      // The INVERSE shape: the dial counts what is RECEIVED and each unit is paid
      // for out of another pool (Energy Market «2X M€ → X energy»).
      const perUnit = m.amountCost.perUnit ?? 1;
      cost.push({role: 'spend', icon: m.amountCost.icon, min: m.min * perUnit, max: m.max * perUnit});
      gain.push({role: 'result', icon: m.icon, min: m.min, max: m.max, unit: m.unit});
      suppressCostIcons.add(m.amountCost.icon);
      if (m.icon !== undefined) {
        suppressGainIcons.add(m.icon);
      }
    } else {
      // Direction unknown (no structural hint) — an honest neutral choice chip.
      choice.push({role: 'choice', icon: m.icon, min: m.min, max: m.max, unit: m.unit});
    }
  }
  return {cost, gain, choice, suppressCostIcons, suppressGainIcons};
}

/** Whether activating this branch needs any pre-submit choice (composer-hosted). */
function branchNeedsChoices(branch: ActionPreviewBranch | undefined): boolean {
  if (branch === undefined) {
    return false;
  }
  return branch.optionInput !== undefined ||
    branch.steps.some((s) => s.kind === 'input' || s.kind === 'spendHeat');
}

/** The NON-amount choice kinds a branch (+ card-level preSteps) will host. */
function branchChoiceKinds(
  branch: ActionPreviewBranch | undefined,
  preview: ActionPreview | undefined,
): Array<'card' | 'player' | 'or' | 'payment' | 'spendHeat'> {
  const kinds = new Set<'card' | 'player' | 'or' | 'payment' | 'spendHeat'>();
  const add = (input: {type: string} | undefined) => {
    if (input === undefined) {
      return;
    }
    if (input.type === 'card' || input.type === 'player' || input.type === 'or' || input.type === 'payment') {
      kinds.add(input.type);
    }
  };
  for (const step of preview?.preSteps ?? []) {
    if (step.kind === 'spendHeat') {
      kinds.add('spendHeat');
    } else if (step.kind === 'input') {
      add(step.input);
    }
  }
  if (branch !== undefined) {
    add(branch.optionInput);
    for (const step of branch.steps) {
      if (step.kind === 'spendHeat') {
        kinds.add('spendHeat');
      } else if (step.kind === 'input') {
        add(step.input);
      }
    }
  }
  return [...kinds];
}

/**
 * The card's resource-scored VP right now + the distance to the next point.
 * Pure display math over the SHARED scorer (`resourceScoring`/`accumulatedVp`
 * — the same one the ДОП.РЕСУРСЫ panel uses); undefined when the card's VP
 * rule doesn't count what is stored on it.
 */
function resourceVp(cardName: CardName, amount: number): {points: number, toNext: number} | undefined {
  const scoring = resourceScoring(cardName);
  if (scoring === undefined) {
    return undefined;
  }
  const points = accumulatedVp(cardName, amount);
  // Resources needed for point (points + 1): the smallest n with
  // floor(n * each / per) > points.
  const needed = Math.ceil(((points + 1) * scoring.per) / scoring.each);
  return {points, toNext: Math.max(0, needed - amount)};
}

/** Build a source group's variant tiles, refining each by its preview branch. */
function buildTiles(
  entry: ActionEntry,
  preview: ActionPreview | undefined,
  cardResource: {type: CardResource, count: number} | undefined,
  repeat?: RepeatAvailability,
): Array<ConsoleActionTile> {
  const group = entry.group;
  const branches = preview?.branches ?? [];
  const cardStatus = entry.state.status;
  // In repeat mode the activation dimension is the used-this-gen flag; in normal
  // mode it IS the status (`activated`).
  const usedThisGen = repeat !== undefined ? repeat.used.has(entry.cardName) : (cardStatus === 'activated');
  // In repeat mode a card is selectable iff it is a candidate (server truth =
  // used this gen AND canAct); a non-candidate stays VISIBLE with a reason.
  const repeatSelectable = repeat !== undefined ? repeat.candidates.has(entry.cardName) : false;
  return group.nodes.map((node, i): ConsoleActionTile => {
    const pos = branchPositionForNode(group, branches, i);
    const branch = pos !== undefined ? branches[pos] : undefined;
    let status: ActionStatus;
    let reason: ConsoleActionReason | undefined;

    if (repeat !== undefined) {
      // REPEAT mode: candidate → selectable ('available'), unless THIS branch is
      // itself blocked; a non-candidate → 'rules' with a CONCRETE reason (full
      // informativeness — never a bare "cannot be repeated").
      if (!repeatSelectable) {
        status = 'rules';
        if (!usedThisGen) {
          // Only actions USED this generation can be repeated — the concrete reason.
          reason = reasonFrom('This action was not used this generation', []);
        } else if (branch !== undefined && branch.available === false && branch.unavailableReason !== undefined) {
          // Used this gen, but the rules block it NOW — the SAME concrete reason a
          // normal blocked action shows (e.g. «Недостаточно стали»), from the preview
          // (declarative / bespoke hook / bespoke-dynamic `actionUnavailableReason`).
          reason = reasonFrom(branch.unavailableReason, branch.unavailableReasonParams);
        } else {
          // The preview hasn't loaded yet — a temporary honest line, refined on
          // load (the internal re-entrancy guard `checkLoops` never surfaces here:
          // the SelectCard is built at the top level where the counter is 0).
          reason = reasonFrom('This action cannot be repeated right now', []);
        }
      } else if (branch !== undefined && branch.available === false) {
        status = 'rules';
        reason = reasonFrom(branch.unavailableReason ?? 'Unavailable right now', branch.unavailableReasonParams);
      } else {
        status = 'available';
      }
    } else if (cardStatus === 'available') {
      status = cardStatus;
      // The card is activatable (≥1 branch available) — but THIS variant's
      // branch may itself be blocked (Rotator Impacts: "add asteroid" OK,
      // "spend asteroid → Venus" needs a resource on the card).
      if (branch !== undefined && branch.available === false) {
        status = 'rules';
        reason = reasonFrom(branch.unavailableReason ?? 'Unavailable right now', branch.unavailableReasonParams);
      }
    } else if (cardStatus === 'rules') {
      status = cardStatus;
      // The whole card is blocked — prefer this variant's own branch reason,
      // else the card-level structured reason.
      reason = (branch !== undefined && branch.available === false && branch.unavailableReason !== undefined) ?
        reasonFrom(branch.unavailableReason, branch.unavailableReasonParams) :
        reasonFrom(entry.state.reasons[0]?.message, entry.state.reasons[0]?.params);
    } else {
      status = cardStatus;
      // soft / activated — the single calm reason applies to every variant.
      reason = reasonFrom(entry.state.softReason?.message, entry.state.softReason?.params);
    }

    const effects = branch?.effects ?? [];
    const variable = branch !== undefined ?
      variablePartsForBranch(branch) :
      {cost: [], gain: [], choice: [], suppressCostIcons: new Set<string>(), suppressGainIcons: new Set<string>()};
    return {
      key: entry.cardName + '#' + i,
      cardName: entry.cardName,
      nodeIndex: i,
      node: stripNodeOr(node),
      status,
      usedThisGen,
      branch,
      costEffects: effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon)),
      gainEffects: effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon)),
      variableCost: variable.cost,
      variableGain: variable.gain,
      variableChoice: variable.choice,
      hasChoices: (preview?.preSteps ?? []).length > 0 || branchNeedsChoices(branch),
      choiceKinds: branchChoiceKinds(branch, preview),
      reason,
      // Self-describing tile data (the flat grid has no group chrome to carry it).
      variantTotal: group.nodes.length,
      cardResource,
      isCorporation: entry.isCorporation,
      // The action's OWN rule text (never the card's) — resolved once here so
      // every host (slot one-liner, dossier, setup stage) reads one value.
      rules: actionRules(group, i, branch === undefined ? undefined : branchTitleText(branch)),
    };
  });
}

/**
 * Per-VARIANT usage-stats scope for the focused render node — the EXACT mirror
 * of the desktop ActionDetailsPanel.branchScope: `mineTokens` are the metric
 * tokens of the branches THIS node maps to (token-overlap match, never
 * positional), `siblingTokens` everything else. `undefined` = unscoped
 * (single-branch card, or a combined node that maps to ALL branches).
 */
export function branchScopeForNode(
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
  nodeIndex: number,
): ActionBranchScope | undefined {
  if (branches.length < 2) {
    return undefined;
  }
  const mine = new Set(branchPositionsForNode(group, branches, nodeIndex));
  const mineTokens: Array<string> = [];
  const siblingTokens: Array<string> = [];
  branches.forEach((b, i) => {
    const tokens = branchMetricTokens(b.effects);
    (mine.has(i) ? mineTokens : siblingTokens).push(...tokens);
  });
  if (mineTokens.length === 0 || siblingTokens.length === 0) {
    return undefined;
  }
  return {mineTokens, siblingTokens};
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
  repeat?: RepeatAvailability,
  /** The browse grid's column count (handheld collapses to 1) — the packed
   *  focus rows MUST mirror the CSS profile or the d-pad drifts off-screen. */
  layoutColumns: 1 | 2 = 2,
): ConsoleActionsModel {
  const repeatMode = repeat !== undefined;
  // Build every group + its variant tiles (unfiltered), then status-sort.
  type GroupDraft = Omit<ConsoleActionGroup, 'tiles'> & {tiles: ReadonlyArray<ConsoleActionTile>};
  const groups: Array<GroupDraft> = entries.map((entry) => {
    const cardResource = cardResources.get(entry.cardName);
    const tiles = buildTiles(entry, previews.get(entry.cardName), cardResource, repeat);
    const status = tiles.reduce<ActionStatus>(
      (best, t) => (STATUS_RANK[t.status] < STATUS_RANK[best] ? t.status : best),
      tiles[0]?.status ?? entry.state.status,
    );
    return {
      key: entry.cardName,
      cardName: entry.cardName,
      isCorporation: entry.isCorporation,
      status,
      // The SORT band comes from the server-side card status only (repeat mode:
      // the candidate set, equally synchronous) — never from the preview-refined
      // per-variant status, whose late arrival would re-order the live grid.
      sortStatus: repeat !== undefined ?
        (repeat.candidates.has(entry.cardName) ? 'available' : 'rules') :
        entry.state.status,
      usedThisGen: tiles[0]?.usedThisGen ?? false,
      cardResource,
      vp: resourceVp(entry.cardName, cardResource?.count ?? 0),
      tiles,
    };
  });
  // Stable sort by the SERVER card status (available → blocked → activated);
  // the corp-first tableau order the entries arrive in is preserved within a
  // band, and the order NEVER changes when previews land.
  const sorted = groups
    .map((g, i) => ({g, i}))
    .sort((a, b) => (STATUS_RANK[a.g.sortStatus] - STATUS_RANK[b.g.sortStatus]) || (a.i - b.i))
    .map((x) => x.g);

  const allTiles = sorted.flatMap((g) => g.tiles);

  // Faceted counts — each dimension counts within the OTHER's current slice.
  const availabilityChips = AVAILABILITY_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: allTiles.filter((t) =>
      passActivation(t, filter.activation, repeatMode) && passAvailability(t.status, def.value)).length,
    active: filter.availability === def.value,
  }));
  const activationChips = ACTIVATION_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: allTiles.filter((t) =>
      passAvailability(t.status, filter.availability) && passActivation(t, def.value, repeatMode)).length,
    active: filter.activation === def.value,
  }));

  // Filter each group's tiles by BOTH dimensions; keep a group only when a
  // variant survives (a card whose sole surviving variant is the blocked one
  // still shows — the player can read WHY; a card with no surviving variant
  // is hidden).
  const packed: Array<ConsoleActionGroup> = [];
  for (const g of sorted) {
    const kept = g.tiles.filter((t) =>
      passAvailability(t.status, filter.availability) && passActivation(t, filter.activation, repeatMode));
    if (kept.length > 0) {
      // The «или» JOINT rides the shared edge of two of the CARD's buttons in
      // the same row — i.e. a non-zero column inside the group's own grid.
      // One-column profiles stack them, so no tile ever joins there.
      packed.push({...g, tiles: kept.map((t, i) => ({...t, joinLeft: layoutColumns === 2 && i % 2 === 1}))});
    }
  }

  // Fill the grid's holes (a wide card meeting a half-filled row) with the
  // nearest single of the same band — the ONE order both the DOM and the
  // packed focus rows use.
  const visibleGroups = arrangeGroupsForGrid(packed, layoutColumns);
  // The flat focus order — the same tile objects the groups render.
  const tiles: ReadonlyArray<ConsoleActionFlatTile> = visibleGroups.flatMap((g) => g.tiles);

  return {
    groups: visibleGroups,
    tiles,
    availabilityChips,
    activationChips,
    totalTiles: allTiles.length,
    availableTiles: allTiles.filter((t) => t.status === 'available').length,
    flatKeys: tiles.map((t) => t.key),
    rows: packActionRows(visibleGroups, layoutColumns),
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
