/*
 * CONSOLE COLONIES — the PURE layout/navigation model behind the premium
 * tile grid (ConsoleColoniesSection) + the reactive UI mirror the shell's
 * bottom command bar reads while the colony workspace's focus stage owns
 * the pad (the consoleHydroUi pattern — the bar never guesses), + the
 * COLONY WORKSPACE flow state (browse ⇄ focus, the workspace-family model).
 *
 * The in-game colony count is 1–6 (5 in a typical game, 6 with a bonus
 * tile), so the MAIN layouts are designed per count: 1–4 = one centred row
 * of large tiles, 5 = a deliberate 3+2 composition, 6 = a 3×2 grid. The
 * rare "add a new colony tile" catalog (Aridor — possibly >6 candidates)
 * keeps a compact wrap grid and is visually a different mode.
 */

import {reactive} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {WorkspacePhase, backVerbFor, WorkspaceBackVerb} from '@/client/console/consoleWorkspaceFlow';

export type ColonyGridLayout = 'solo' | 'duo' | 'trio' | 'four' | 'five' | 'six' | 'catalog';

/** Which premium layout the tile grid uses for `count` colonies. Designed
 *  Steam-Deck-first (1280×800): 1–3 = one centred row, 4 = a 2×2 block,
 *  5 = the deliberate 3+2, 6 = 3×2 — every in-game count fits WITHOUT
 *  clipping; the rare >6 add-a-tile catalog is its own compact mode. */
export function colonyGridLayout(count: number, catalogMode: boolean): ColonyGridLayout {
  if (catalogMode && count > 6) {
    return 'catalog';
  }
  switch (Math.max(1, count)) {
  case 1: return 'solo';
  case 2: return 'duo';
  case 3: return 'trio';
  case 4: return 'four';
  case 5: return 'five';
  case 6: return 'six';
  default: return 'catalog';
  }
}

/** Columns per layout — drives both CSS and the d-pad 2D stepping. */
export function colonyGridCols(layout: ColonyGridLayout, count: number): number {
  switch (layout) {
  case 'solo': return 1;
  case 'duo': return 2;
  case 'trio': return 3;
  case 'four': return 2; // 2 × 2 — large tiles
  case 'five': return 3; // 3 + 2 (second row centred)
  case 'six': return 3; // 3 × 2
  case 'catalog': return 4;
  default: return Math.max(1, count);
  }
}

/**
 * 2D d-pad stepping over the tile grid: left/right walk within the row,
 * up/down jump a whole row (clamped to the last tile — the edge is felt,
 * no wrap).
 */
export function colonyNavStep(
  dir: 'up' | 'down' | 'left' | 'right',
  index: number,
  count: number,
  cols: number,
): number {
  if (count <= 0) {
    return 0;
  }
  let next = index;
  switch (dir) {
  case 'left': next = index - 1; break;
  case 'right': next = index + 1; break;
  case 'up': next = index - cols; break;
  case 'down': next = index + cols; break;
  }
  if (next < 0) {
    // Stepping up from the first row keeps the selection (no wrap).
    return dir === 'left' ? Math.max(0, index - 1) : (dir === 'up' ? index : 0);
  }
  if (next >= count) {
    // Stepping down past the end lands on the LAST tile only when moving
    // down from an incomplete final row; horizontal steps clamp.
    return dir === 'down' ? (index + cols >= count + cols ? index : count - 1) :
      (dir === 'right' ? count - 1 : index);
  }
  return next;
}

// ── The bottom command bar's live mirror ────────────────────────────────────
// The focus stage / journal inspect sync their state here; the shell's
// `commands()` reads it — hints live ONLY in the bottom bar (never inline).

export const consoleColoniesUi = reactive({
  /** The read-only journal colony dossier overlay is open. */
  inspectOpen: false,
  /** Focus stage: which sub-surface owns the pad ('' = the review rows).
   *  `targets` = the embedded played-card target step (physical candidates:
   *  A = choose, X = inspect the focused card — its own command grammar). */
  composerSub: '' as '' | 'list' | 'lanes' | 'targets',
  /** Focus stage: every decision is captured — X (confirm) is meaningful. */
  composerReady: false,
  /** Focus stage: the focused row opens something on A. */
  composerEditable: false,
  /** Focus stage: this act COMPOSES (it has decision rows) — the bar then
   *  speaks the two-verb grammar (A opens the decision, X commits) for a
   *  build exactly as it does for a trade. */
  composerDecisions: false,
});

export function resetConsoleColoniesUi(): void {
  consoleColoniesUi.inspectOpen = false;
  consoleColoniesUi.composerSub = '';
  consoleColoniesUi.composerReady = false;
  consoleColoniesUi.composerEditable = false;
  consoleColoniesUi.composerDecisions = false;
}

// ── THE COLONY WORKSPACE FLOW — browse ⇄ focus, one typed state ─────────────
//
// The colonies screen is a WORKSPACE (the family model: consoleWorkspaceFlow).
// Its browse layer is the colony surface (the tile islands); pressing INTO a
// colony descends to the COLONY FOCUS STAGE — the one source of truth for
// «what does trading here do» (track, rewards, payment, warnings, CTA). The
// old trade-confirm / inspect MODALS are gone; both verbs (A and X) descend
// into the same stage.
//
// Module-level reactive (not component data): the shell's command bar, the
// breadcrumb and the input router all read it, and it must survive the
// section's own re-renders. It deliberately does NOT persist across a section
// close — reopening the colonies always lands on the browse surface.

/**
 * What the player came INTO the focus stage to do. ONE stage serves them all
 * (one source of truth); the intent decides the ACTION half of the layout:
 *  'trade'   — the payment/decision configuration + the trade CTA;
 *  'build'   — the destination slot + the build brief + the build CTA
 *              (a Build SelectColony no longer commits from the overview);
 *  'pick'    — a generic server pick (setup remove / Aridor add-tile): the
 *              verb brief + the pick CTA;
 *  'inspect' — the dossier composition (no fake configuration controls).
 */
export type ColonyFocusIntent = 'trade' | 'build' | 'pick' | 'inspect';

export const colonyFocusState = reactive({
  /** The focus stage is open (the browse grid is parked behind it). */
  open: false,
  /** The colony descended into ('' while browsing). */
  colonyName: '' as ColonyName | '',
  /** Which verb opened the stage (see ColonyFocusIntent). */
  intent: 'trade' as ColonyFocusIntent,
  /**
   * The stage's own crumb tail (i18n key), published UP by the stage —
   * «Trade» / «Inspection». The stage never titles itself (workspace rule 5).
   */
  stage: '' as string,
  /**
   * The trade was CONFIRMED and is on the wire / in flight. The stage is
   * already folded by then (the fleet flies over the browse surface), but the
   * crumb's committed accent and the B-verb derivation read this.
   */
  committing: false,
});

/** Enter the focus stage for `colony` (the descend). */
export function openColonyFocus(colony: ColonyName, intent: ColonyFocusIntent): void {
  colonyFocusState.open = true;
  colonyFocusState.colonyName = colony;
  colonyFocusState.intent = intent;
  colonyFocusState.committing = false;
}

/** The stage names its own crumb tail (never draws its own header). */
/**
 * WHERE THE FLEET DOCK BERTHS when the colony screen is a STEP of another
 * workspace.
 *
 * The dock is ONE component in ONE place — the header's right edge — in every
 * mode, because that is spatial memory: the player who walked in through
 * «Колонии» and the player who walked in through a card's action must find
 * their ships in the same spot. A hosted section has no header of its own
 * (rule 5), so the HOST publishes a berth in ITS header and the section
 * teleports the dock there; `''` means «no berth offered» and the section
 * keeps the dock in its own toolbar, exactly as before.
 *
 * A selector rather than a boolean for the same reason `setWorkspaceFrameSlot`
 * is one: the host owns where, the step owns what.
 */
export const colonyFleetBerth = reactive({selector: ''});

export function setColonyFleetBerth(selector: string): void {
  colonyFleetBerth.selector = selector;
}

export function setColonyFocusStage(stage: string): void {
  if (colonyFocusState.open) {
    colonyFocusState.stage = stage;
  }
}

/** Leave the stage — back at the browse surface (B, or the confirm fold). */
export function closeColonyFocus(): void {
  colonyFocusState.open = false;
  colonyFocusState.colonyName = '';
  colonyFocusState.stage = '';
  colonyFocusState.committing = false;
}

/** The trade left the stage for the wire — the fold + flight own the moment. */
export function markColonyFocusCommitting(): void {
  colonyFocusState.committing = true;
}

/** Full reset (section close / game switch / test cleanup). */
export function resetColonyFocus(): void {
  closeColonyFocus();
}

/**
 * The workspace phase of the colonies screen, in the family vocabulary
 * (consoleWorkspaceFlow) — what B means and whether input is live DERIVE from
 * this, never from hand-rolled flags at call sites.
 *
 * `transactionActive` = the trade fleet / reward transaction owns the moment
 * (the executing beat: input is absorbed by its own gates already).
 */
export function colonyWorkspacePhase(transactionActive: boolean): WorkspacePhase {
  if (transactionActive || colonyFocusState.committing) {
    return 'executing';
  }
  return colonyFocusState.open ? 'configure' : 'browse';
}

/** B's verb at the colonies workspace's current depth. */
export function colonyWorkspaceBackVerb(transactionActive: boolean): WorkspaceBackVerb {
  return backVerbFor(colonyWorkspacePhase(transactionActive));
}
