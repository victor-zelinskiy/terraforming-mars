/*
 * CONSOLE COLONIES — the PURE layout/navigation model behind the premium
 * tile grid (ConsoleColoniesSection) + the reactive UI mirror the shell's
 * bottom command bar reads while the colony workspace's focus stage owns
 * the pad (the consoleHydroUi pattern — the bar never guesses), + the
 * COLONY WORKSPACE flow state (browse ⇄ focus, the workspace-family model).
 *
 * The in-game colony count is 1–6 (5 in a typical game, 6 with a bonus
 * tile) and the viewer's fleet docks (TR06 / TR26 / TR27) are further CELLS
 * of the same grid, so the MAIN layouts are designed per CELL count: 1–3 =
 * one centred row of large tiles, 4 = 2×2, 5 = a deliberate 3+2, 6 = 3×2,
 * 7 = 4+3, 8 = 4×2, 9 = 3×3. The rare "add a new colony tile" catalog
 * (Aridor — possibly >6 candidates) keeps a compact wrap grid and is visually
 * a different mode.
 */

import {reactive} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardName} from '@/common/cards/CardName';
import {WorkspacePhase, backVerbFor, WorkspaceBackVerb} from '@/client/console/consoleWorkspaceFlow';
import type {VenusInnerCommand} from '@/client/console/venusBonus/venusBonusInner';

export type ColonyGridLayout = 'solo' | 'duo' | 'trio' | 'four' | 'five' | 'six' | 'seven' | 'eight' | 'nine' | 'catalog';

/**
 * Which premium layout the tile grid uses. The grid's CELLS are the colonies
 * AND the viewer's fleet docks (ledger EZ, the owner 2026-11-03: «a dock is a
 * cell of the grid, not a group beside it» — docks LAST in reading order), so
 * the composition is chosen by the TOTAL (`colonyGridCols`): 1–3 = one centred
 * row, 4 = a 2×2 block, 5 = the deliberate 3+2, 6 = 3×2, 7 = 4+3, 8 = 4×2,
 * 9 = 3×3. Designed Steam-Deck-first (1280×800) — every in-game count fits
 * WITHOUT clipping. The rare add-a-tile catalog (> 6 COLONIES offered — the
 * docks never make a pick a catalog) is its own compact mode.
 */
export function colonyGridLayout(count: number, catalogMode: boolean, docks = 0): ColonyGridLayout {
  if (catalogMode && count > 6) {
    return 'catalog';
  }
  switch (Math.max(1, count + Math.max(0, docks))) {
  case 1: return 'solo';
  case 2: return 'duo';
  case 3: return 'trio';
  case 4: return 'four';
  case 5: return 'five';
  case 6: return 'six';
  case 7: return 'seven';
  case 8: return 'eight';
  case 9: return 'nine';
  default: return 'catalog';
  }
}

/**
 * THE COLUMNS PER LAYOUT — one table, read by the CSS fit (the grid's
 * max-width), the d-pad's 2D stepping and the dock cursor alike. An odd
 * remainder is a CENTRED short last row (5 = 3 + 2, 7 = 4 + 3).
 */
const GRID_COLUMNS: Readonly<Record<Exclude<ColonyGridLayout, 'catalog'>, number>> = {
  solo: 1,
  duo: 2,
  trio: 3,
  four: 2, // 2 × 2 — large tiles
  five: 3, // 3 + 2 (second row centred)
  six: 3, // 3 × 2
  seven: 4, // 4 + 3 (second row centred)
  eight: 4, // 4 × 2
  nine: 3, // 3 × 3
};

/**
 * THE RAIL IS THE ADD-A-TILE CATALOG — a pick-a-NEW-tile prompt (Aridor's
 * first action, Maria) offers the game's UNUSED colonies (`discardedColonies`),
 * so the tiles standing on the rail are NOT in the game.
 *
 * ONE derivation, because two consumers ask it and they must never disagree:
 * WHICH colonies to rail (the prompt's own `coloniesModel` instead of
 * `game.colonies`), and whether anything SERVER-SCOPED may be asked about them.
 * Nothing may: a catalog tile has no track, no cubes and no trade, so the
 * colony-trade preview can only decline — which is precisely how descending
 * into one produced `GET /api/game/colony-trade-preview?…&colony=Ceres` → 404
 * on the server and a red 404 in the client console.
 *
 * `isColonyTask` is «the shell's colony task is what put this rail up» — the
 * same term `coloniesForRail` has always carried, kept because a colony grid
 * standing for any OTHER reason (a trade, a plain visit) rails in-game colonies
 * whatever a prompt elsewhere says.
 */
export function colonyRailIsCatalog(
  purpose: 'selectExistingColony' | 'addNewColonyToGame' | undefined,
  isColonyTask: boolean,
  /**
   * A ROSTER pick's level (`colonyRosterModel.rosterLevel`): a REPLACEMENT is a catalog prompt whose first
   * question — «which tile leaves» — is asked on the TABLE; only its second stands on the reserve.
   */
  rosterLevel?: 'outgoing' | 'incoming',
): boolean {
  return isColonyTask && purpose === 'addNewColonyToGame' && rosterLevel !== 'outgoing';
}

/** Columns per layout — drives both CSS and the d-pad 2D stepping. `cells` = colonies + docks. */
export function colonyGridCols(layout: ColonyGridLayout, cells: number): number {
  return layout === 'catalog' ? 4 : Math.min(GRID_COLUMNS[layout], Math.max(1, cells));
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
   *  A = choose, X = inspect the focused card — its own command grammar);
   *  `mix` = the Delta Works composition substep (LB/RB dial · X confirm). */
  composerSub: '' as '' | 'list' | 'lanes' | 'targets' | 'mix' | 'venus',
  /** The Venus bonus's inner step's bar (P89 · EM — `venusInnerFootHints`), while `composerSub` is `venus`. */
  composerVenusBar: [] as ReadonlyArray<VenusInnerCommand>,
  /** Focus stage: the open list's DECLINE as a button (RT, its i18n key — `optionalChoice.ts`); '' = none. */
  composerDecline: '' as string,
  /** Focus stage: every decision is captured — X (confirm) is meaningful. */
  composerReady: false,
  /** Focus stage: the focused row opens something on A. */
  composerEditable: false,
  /** Focus stage: this act COMPOSES (it has decision rows) — the bar then
   *  speaks the two-verb grammar (A opens the decision, X commits) for a
   *  build exactly as it does for a trade. */
  composerDecisions: false,
  /** Focus stage: the Delta Works energy/steel mix is LIVE AND ADJUSTABLE —
   *  the bar advertises the LB/RB dial exactly while it works, and drops the
   *  hint the moment another payment family (or a fixed mix) is chosen. */
  composerMixAdjustable: false,
  /**
   * The grid stands as a RECEIPT (a roster change, a city laid on a tile, a colony a card built — the section's ONE
   * `receiptOn` reading): no cursor and no verbs, so the bar states the result instead of offering the grid's verbs.
   */
  receipt: false,
  /** Focus stage: R3 «Эффекты» is a verb right now — a forecast with facts, the setup level, nothing held (PL-066). */
  forecastAvailable: false,
  /** Focus stage: the «Эффекты» layer is OPEN — the bar is the explorer's (`forecastExplorerUi('colony').barCommands`). */
  forecastOpen: false,
});

/**
 * THE FLEET-DOCK STAGE's live mirror for the command bar (Turmoil Redux TR06 —
 * a trade whose fleet goes to a CARD). The stage speaks ONE primary verb whose
 * label follows the cursor (A selects another payment path, opens the M€
 * payment, or — on the chosen path — trades), so the bar reads the label the
 * stage publishes instead of guessing it.
 */
export const fleetDockUi = reactive({
  /** The stage's substep: '' = the rows, 'lanes' = the M€ payment, 'mix' = the Delta Works composition, 'targets' = the reward's target step. */
  sub: '' as '' | 'lanes' | 'mix' | 'targets',
  /** A's label right now (an i18n key — «Trade» / «Select» / «Payment» / «Continue to payment»). */
  primaryLabel: 'Trade',
  /** A does something right now (a trade the server refuses keeps it dead, the reason on the stage). */
  primaryEnabled: false,
  /** A on the chosen path commits the trade — the bar lights it. */
  primaryCommits: false,
  /** X's label — the trade's commit (the colony stage's verb): «Подтвердить торговлю» / «Продолжить к оплате». */
  confirmLabel: 'Confirm trade',
  /** X trades right now (every decision is in and the server offers the dock). */
  confirmEnabled: false,
  /**
   * PAST THE PRESS: the stage is its own receipt and its scene is in flight (the shell accepted the confirm —
   * `holdPresentation` — until the workspace leaves or a refusal gives the stage back). The bar is a STATUS then,
   * never the stage's verbs gone inert.
   */
  answered: false,
  /** R3 «Эффекты» is a verb of the stage right now: a forecast with facts, the setup level, nothing held (PL-060). */
  forecastAvailable: false,
  /** The stage's «Эффекты» layer is OPEN — the explorer owns the bar (`forecastExplorerUi('dock').barCommands`). */
  forecastOpen: false,
});

export function resetFleetDockUi(): void {
  fleetDockUi.sub = '';
  fleetDockUi.primaryLabel = 'Trade';
  fleetDockUi.primaryEnabled = false;
  fleetDockUi.primaryCommits = false;
  fleetDockUi.confirmLabel = 'Confirm trade';
  fleetDockUi.confirmEnabled = false;
  fleetDockUi.answered = false;
  fleetDockUi.forecastAvailable = false;
  fleetDockUi.forecastOpen = false;
}

/**
 * THE DOCK HALF OF THE ONE GRID WALK. The fleet docks are CELLS of the colony
 * grid (ledger EZ — docks last in reading order), and the d-pad walks ONE slot
 * index over colonies + docks (`fleetDockModel.colonyCursorStep`). The shell
 * keeps the colony half in `consoleState.colonyIndex` (every colony reader
 * indexes the rail by it); this is the slot's projection onto the docks — the
 * cursor stands on dock `index` (slot `colonies + index`) while `active`.
 */
export const colonyDockCursor = reactive({
  /** The cursor stands on a dock cell (not on a colony tile). */
  active: false,
  /** The dock under the cursor (the docks' order — tableau order). */
  index: 0,
});

export function resetColonyDockCursor(): void {
  colonyDockCursor.active = false;
  colonyDockCursor.index = 0;
}

export function resetConsoleColoniesUi(): void {
  consoleColoniesUi.inspectOpen = false;
  consoleColoniesUi.composerSub = '';
  consoleColoniesUi.composerVenusBar = [];
  consoleColoniesUi.composerDecline = '';
  consoleColoniesUi.composerReady = false;
  consoleColoniesUi.composerEditable = false;
  consoleColoniesUi.composerDecisions = false;
  consoleColoniesUi.composerMixAdjustable = false;
  consoleColoniesUi.receipt = false;
  consoleColoniesUi.forecastAvailable = false;
  consoleColoniesUi.forecastOpen = false;
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
 *  'inspect' — the dossier composition (no fake configuration controls);
 *  'bonus'   — SOMEBODY ELSE'S TRADE IS PAYING THE VIEWER. There is no action
 *              to configure and no offer to weigh: the player is here for one
 *              thing the colony owes them (Pluto's card, Miranda's card, a
 *              card-resource target). So the stage drops its whole working
 *              half — the trade track, the berths, the configuration and the
 *              reward rail — and becomes what the moment actually is: the
 *              paying colony, WHOSE trade triggered it, and the choice.
 *              Mixing that into the trade dossier made a two-second collect
 *              read as the trading screen, with the live decision squeezed
 *              into a corner of a surface describing an action nobody took.
 *  'track'   — the pick MOVES THE CHOSEN TILE'S TRACK (Turmoil Redux TR07
 *              Colony Sponsors — the server's `trackMoves` marker): the
 *              instrument is the hero — the marker where it stands, the ghost
 *              where it will land, «+N» — and the reward rail says what a
 *              trade HERE pays now and after («торговля здесь»). A confirms,
 *              like a pick; the move itself plays on this stage after the
 *              answer (`colonyTrackMove`).
 *  'roster'  — the pick CHANGES THE ROSTER (the server's `rosterChange`
 *              marker: a tile enters the game, leaves it, or is replaced in
 *              its slot — Aridor, the solo trim, TR10 Fringe Colony). The
 *              stage is the build's / the pick's composition (a colony the
 *              effect builds lands in the berth row) plus the roster's own
 *              reading: who leaves, who arrives and how it enters, whether
 *              the colony stands. A confirms; the ceremony plays on this
 *              stage with the commit held (`consoleColonyRoster`).
 *  'city'    — the pick PLACES A TILE ON THE CHOSEN COLONY TILE (Turmoil
 *              Redux TR22 Nova City — the server's `tileSite` marker). The
 *              stage is the pick's composition and the working half STANDS as
 *              it is — no track projection, no berth projection: the player
 *              sees that the city touches none of it. The hero is the planet
 *              with the CITY'S SEAT in its projection pose, and the result
 *              rail states the placement (the city, the player's space cities
 *              now → after, the card's VP). A confirms; the landing plays on
 *              this stage with the commit held (`consoleColonyCity`).
 */
export type ColonyFocusIntent = 'trade' | 'build' | 'pick' | 'inspect' | 'bonus' | 'track' | 'roster' | 'city';

/**
 * THE ACT OF A SERVER COLONY PICK — the one derivation the grid's A, the
 * dossier's A and the stage read: a pick that moves a track (its `trackMoves`
 * marker) is `track`, a pick that changes the roster (its `rosterChange`
 * marker) is `roster`, a pick that places a tile on the chosen colony tile
 * (its `tileSite` marker) is `city`, a pick that builds a colony (its
 * `buildSites` marker — published by the server on EVERY build prompt) is
 * `build`, anything else is a plain `pick`. The marker decides — never the
 * button's label, never a title.
 */
export function colonyPickIntent(pick: {trackMoves?: ReadonlyArray<unknown>, roster?: unknown, tileSite?: unknown, buildSites?: ReadonlyArray<unknown>}): ColonyFocusIntent {
  if (pick.trackMoves !== undefined) {
    return 'track';
  }
  if (pick.roster !== undefined) {
    return 'roster';
  }
  if (pick.tileSite !== undefined) {
    return 'city';
  }
  return pick.buildSites !== undefined ? 'build' : 'pick';
}

export const colonyFocusState = reactive({
  /** The focus stage is open (the browse grid is parked behind it). */
  open: false,
  /** The colony descended into ('' while browsing, and while the stage is a DOCK's). */
  colonyName: '' as ColonyName | '',
  /**
   * The FLEET-DOCK CARD descended into ('' otherwise) — a trade whose fleet
   * goes to a card of the viewer's own (Turmoil Redux TR06 Water Hauling).
   * Exactly one of `colonyName` / `dock` names the stage's subject; the intent
   * is always 'trade' (a dock is nothing but a trade destination).
   */
  dock: '' as CardName | '',
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
  colonyFocusState.dock = '';
  colonyFocusState.intent = intent;
  colonyFocusState.committing = false;
}

/** Enter the FLEET-DOCK stage for `card` (the descend from its cell of the grid). */
export function openFleetDockFocus(card: CardName): void {
  colonyFocusState.open = true;
  colonyFocusState.colonyName = '';
  colonyFocusState.dock = card;
  colonyFocusState.intent = 'trade';
  colonyFocusState.committing = false;
}

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
 *
 * ⚠ A berth is OWNED, and it is good only for the host that is hosting the
 * colonies NOW (`colonyFleetBerthFor`). It used to be a bare global string:
 * the hand lent it for a card's colony, left without retracting it (its
 * post-flush watcher never ran on the way out, and `beforeUnmount` asked
 * «am I offering?» of a stack the colonies had already left), and the next
 * host — the standard projects, which lend none — got the hand's selector. The
 * dock teleported into a node that was not in the document, Vue mounted
 * nothing and the next patch crashed the colony step (game-pdb19bfa,
 * 2026-11-07). A host can no longer read another host's berth, and a host
 * retracts only its own.
 */
export const colonyFleetBerth = reactive({selector: '', owner: ''});

/** The host `owner` lends its header berth (`selector`) to the hosted colonies. */
export function offerColonyFleetBerth(owner: string, selector: string): void {
  colonyFleetBerth.selector = selector;
  colonyFleetBerth.owner = owner;
}

/** The host `owner` takes its berth back — a berth another host lent stays. */
export function retractColonyFleetBerth(owner: string): void {
  if (colonyFleetBerth.owner === owner) {
    colonyFleetBerth.selector = '';
    colonyFleetBerth.owner = '';
  }
}

/** The berth the colonies may use while hosted by `host` (`''` = none — the section's own toolbar). */
export function colonyFleetBerthFor(host: string | undefined): string {
  return host !== undefined && colonyFleetBerth.owner === host ? colonyFleetBerth.selector : '';
}

export function setColonyFocusStage(stage: string): void {
  if (colonyFocusState.open) {
    colonyFocusState.stage = stage;
  }
}

/**
 * A from the DOSSIER (`intent === 'inspect'`): the same colony, the ACT
 * intent — the trade / build / pick stage takes the dossier's place with the
 * planet, the track and the berths carried over (the section arms the
 * hand-off rects and the motion module plays it). A read that turns into an
 * act is one continuous object, never a fold-and-reopen; and it is a SWITCH,
 * not a new descent: the stage stays open, only the verb changes.
 */
export function switchColonyFocusIntent(intent: ColonyFocusIntent): void {
  if (!colonyFocusState.open || colonyFocusState.intent === intent) {
    return;
  }
  colonyFocusState.intent = intent;
  colonyFocusState.committing = false;
}

/** Leave the stage — back at the browse surface (B, or the confirm fold). */
export function closeColonyFocus(): void {
  colonyFocusState.open = false;
  colonyFocusState.colonyName = '';
  colonyFocusState.dock = '';
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
  resetColonyDockCursor();
  resetFleetDockUi();
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
