/*
 * THE FLEET DOCKS OF THE COLONY WORKSPACE — the PURE model behind the
 * «ПРИЧАЛЫ» column (Turmoil Redux TR06 Water Hauling and its sisters TR26 /
 * TR27: a card that is a DESTINATION of its owner's trade action).
 *
 * Three questions, each answered once:
 *  - WHICH docks stand in the column — the viewer's own tableau cards that are
 *    docks (`ClientCard.fleetDock`), joined with the live pick's verdict
 *    (`SelectColonyModel.fleetDocks`) when a trade window is open. A rival's
 *    dock never stands here: only its owner may trade with it (FAQ p. 19).
 *  - WHAT a dock's state is — through the SAME ladder a colony tile reads
 *    (`colonyTradeReason`): a dock is a destination that is always «active»,
 *    never holds a visitor, and whose own refusal (the fleet already on it,
 *    no ocean left) is the server's — the marker's reason in the window, the
 *    PUBLIC state (`CardModel.fleetDocked`) outside it. One function of the
 *    status, never a second.
 *  - WHERE the cursor goes — the column is a stop of the overview's ring:
 *    ▶ from a row's last tile enters it, ◀ returns to the tile it left.
 *
 * Availability is never derived here (cross-cutting invariant 2): the A on a
 * dock is live exactly when the pick's marker says `available`.
 */

import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {FleetDockOfferModel} from '@/common/models/PlayerInputModel';
import {FLEET_DOCK_BUSY_REASON} from '@/common/colonies/fleetDock';
import {colonyTradeReason, ColonyTradeReason} from '@/client/console/colonyTradeReason';
import {CardComponent} from '@/common/cards/render/CardComponent';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderEffect, isICardRenderEffect, isICardRenderItem, isICardRenderRoot} from '@/common/cards/render/Types';

/** One dock of the column. */
export type FleetDockView = {
  card: CardName,
  /** The live card model from the viewer's tableau (the face, the fleet mark). */
  model: CardModel,
  /** The fleet standing on the card this generation — its owner's livery (public state). */
  dockedColor: Color | undefined,
  /** The server's verdict from the live trade pick; undefined outside the trade window. */
  offer: FleetDockOfferModel | undefined,
};

/**
 * The docks of the column, in tableau order. `isDock` reads the static card
 * manifest (`ClientCard.fleetDock`); an offer naming a card that is not in the
 * tableau (cannot happen — the server reads the same tableau) still stands,
 * so the live verdict is never hidden behind a stale view.
 */
export function fleetDockViews(
  tableau: ReadonlyArray<CardModel>,
  isDock: (name: CardName) => boolean,
  offers: ReadonlyArray<FleetDockOfferModel>,
): Array<FleetDockView> {
  const views: Array<FleetDockView> = [];
  const seen = new Set<CardName>();
  for (const model of tableau) {
    if (!isDock(model.name) || seen.has(model.name)) {
      continue;
    }
    seen.add(model.name);
    views.push({
      card: model.name,
      model,
      dockedColor: model.fleetDocked,
      offer: offers.find((o) => o.card === model.name),
    });
  }
  for (const offer of offers) {
    if (!seen.has(offer.card)) {
      seen.add(offer.card);
      views.push({card: offer.card, model: {name: offer.card} as CardModel, dockedColor: undefined, offer});
    }
  }
  return views;
}

/** The marker's reason as a key (the server sends English keys; a Message carries its template). */
function offerReasonKey(offer: FleetDockOfferModel | undefined): string | undefined {
  const reason = offer?.reason;
  if (reason === undefined) {
    return undefined;
  }
  return typeof reason === 'string' ? reason : reason.message;
}

/** The dock's OWN refusal: the live marker's, else the public state's (the fleet on the card). */
export function fleetDockOwnBlock(dock: FleetDockView): string | undefined {
  if (dock.offer !== undefined) {
    return dock.offer.available ? undefined : (offerReasonKey(dock.offer) ?? FLEET_DOCK_BUSY_REASON);
  }
  return dock.dockedColor !== undefined ? FLEET_DOCK_BUSY_REASON : undefined;
}

export type FleetDockReasonInput = {
  /** Every destination the OPEN trade window offers — colony names AND available dock cards. */
  tradeable: ReadonlyArray<string>,
  viewerColor: Color,
  /** The viewer's free trade fleets right now. */
  availableFleets: number,
  myTurn: boolean,
  awaitingInput: boolean,
};

/**
 * «Why can't I send the fleet to THIS card right now» — the colony ladder,
 * asked about a dock (`undefined` = the server offers it). The dock's own
 * refusal ranks with the colony-intrinsic rungs; a fleet, a fee and the turn
 * follow in the ladder's own order.
 */
export function fleetDockReason(dock: FleetDockView, input: FleetDockReasonInput): ColonyTradeReason | undefined {
  return colonyTradeReason({
    colony: {name: dock.card, isActive: true, visitor: undefined},
    tradeable: input.tradeable,
    colonyBlock: fleetDockOwnBlock(dock),
    viewerColor: input.viewerColor,
    availableFleets: input.availableFleets,
    myTurn: input.myTurn,
    awaitingInput: input.awaitingInput,
    resolveName: () => '',
  });
}

/** What the dock's TILE says — three states, the reason being the ladder's. */
export type FleetDockTileStatus = {
  kind: 'free' | 'docked' | 'blocked',
  /** An English i18n key. */
  text: string,
};

export const DOCK_FREE_KEY = 'Dock free';
export const DOCK_DOCKED_KEY = 'Trade fleet docked · returns next generation';

/**
 * The tile's status, through the ladder. Like a colony tile it states only
 * what is about the DESTINATION: the fleet on the card, the reward's own
 * refusal. A turn / fleet / fee block stays calm (the dock itself is free —
 * the stage and the A-press carry that reason), except a window open for
 * OTHER destinations, which names itself exactly as a colony tile does.
 */
export function fleetDockTileStatus(dock: FleetDockView, input: FleetDockReasonInput): FleetDockTileStatus {
  if (dock.dockedColor !== undefined) {
    return {kind: 'docked', text: DOCK_DOCKED_KEY};
  }
  const reason = fleetDockReason(dock, input);
  if (reason === undefined) {
    return {kind: 'free', text: DOCK_FREE_KEY};
  }
  if (reason.intrinsic) {
    return {kind: 'blocked', text: reason.key};
  }
  if (input.tradeable.length > 0) {
    return {kind: 'blocked', text: 'Trade unavailable'};
  }
  return {kind: 'free', text: DOCK_FREE_KEY};
}

// ── THE CURSOR — the docks are a COLUMN of the overview's ring ──────────────

export type ColonyNavDir = 'up' | 'down' | 'left' | 'right';

/**
 * Where the overview's cursor stands: on a colony tile (`grid`, the tile is
 * `index`) or on a dock (`docks`, the dock is `dock`). While it stands on a
 * dock the grid index is KEPT — it is the tile ◀ walks back to.
 */
export type ColonyCursor = {zone: 'grid' | 'docks', index: number, dock: number};

/** The grid's own 2D step (`colonyNavStep` — injected, so this module stays a leaf). */
export type GridStep = (dir: ColonyNavDir, index: number, count: number, cols: number) => number;

/**
 * One d-pad step over the overview: the colony grid, plus the docks column to
 * its right. ▶ from the LAST tile of a row (its last column, or the row's
 * last tile in an incomplete row) enters the column at the row's height
 * (clamped); ◀ from the column returns to the very tile it left; ↑/↓ walk the
 * column (the edge is felt, no wrap); ▶ in the column stays. With no colony on
 * the rail the cursor lives in the column; with no dock it never leaves the grid.
 */
export function colonyCursorStep(
  dir: ColonyNavDir,
  cursor: ColonyCursor,
  count: number,
  cols: number,
  dockCount: number,
  gridStep: GridStep,
): ColonyCursor {
  if (dockCount <= 0) {
    return {zone: 'grid', index: gridStep(dir, cursor.index, count, cols), dock: 0};
  }
  if (cursor.zone === 'docks' || count <= 0) {
    const dock = Math.min(dockCount - 1, Math.max(0, cursor.dock));
    if (dir === 'left' && count > 0) {
      return {zone: 'grid', index: cursor.index, dock};
    }
    if (dir === 'up' || dir === 'down') {
      return {zone: 'docks', index: cursor.index, dock: Math.min(dockCount - 1, Math.max(0, dock + (dir === 'down' ? 1 : -1)))};
    }
    return {zone: 'docks', index: cursor.index, dock};
  }
  const safeCols = Math.max(1, cols);
  const rowEnd = cursor.index % safeCols === safeCols - 1 || cursor.index >= count - 1;
  if (dir === 'right' && rowEnd) {
    const row = Math.floor(cursor.index / safeCols);
    return {zone: 'docks', index: cursor.index, dock: Math.min(dockCount - 1, row)};
  }
  return {zone: 'grid', index: gridStep(dir, cursor.index, count, cols), dock: cursor.dock};
}

// ── THE PRINTED ROW — where the card ANSWERS ────────────────────────────────

/**
 * The dock card's printed «▲ : [reward]» effect — the row the fleet lands on
 * and the action-commit impulse runs (cause → colon → result). Found by its
 * CAUSE (an effect whose cause holds the TRADE symbol), never by position: a
 * sister card may print other rows above it. Undefined when the face has none
 * (the impulse then degrades to the whole mechanics plate).
 */
export function fleetDockEffectNode(renderData: CardComponent | undefined): ICardRenderEffect | undefined {
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return undefined;
  }
  for (const row of renderData.rows) {
    for (const node of row) {
      if (isICardRenderEffect(node) && (node.rows[0] ?? []).some((n) => isICardRenderItem(n) && n.type === CardRenderItemType.TRADE)) {
        return node;
      }
    }
  }
  return undefined;
}
