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
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ColonyTradeFollowUpModel} from '@/common/models/ColonyTradePreviewModel';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {FleetDockOfferModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {Payment} from '@/common/inputs/Payment';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, cardResourceKey, isStandardResource, mergeTransferSpecs, railRewardSpecs, railRowKey,
} from '@/client/console/resourceTransfer/resourceTransferModel';
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
  /** An English i18n key — the WHOLE statement (the overview's rail, the explorer's plate: where there is room). */
  text: string,
  /**
   * The same state in the TILE's own width, when the whole statement cannot
   * stand on one line of a narrow column: the tile says the state, the rail
   * under the grid says the rest once the cursor is on the dock.
   */
  short?: string,
};

export const DOCK_FREE_KEY = 'Dock free';
export const DOCK_DOCKED_KEY = 'Trade fleet docked · returns next generation';
export const DOCK_DOCKED_SHORT_KEY = 'Fleet on the card';

/** What the tile's one status line prints (an English key). */
export function fleetDockTileLabel(status: FleetDockTileStatus): string {
  return status.short ?? status.text;
}

/**
 * The tile's status, through the ladder. Like a colony tile it states only
 * what is about the DESTINATION: the fleet on the card, the reward's own
 * refusal. A turn / fleet / fee block stays calm (the dock itself is free —
 * the stage and the A-press carry that reason), except a window open for
 * OTHER destinations, which names itself exactly as a colony tile does.
 */
export function fleetDockTileStatus(dock: FleetDockView, input: FleetDockReasonInput): FleetDockTileStatus {
  if (dock.dockedColor !== undefined) {
    return {kind: 'docked', text: DOCK_DOCKED_KEY, short: DOCK_DOCKED_SHORT_KEY};
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

// ── THE REWARD'S CATEGORY — how a trade with the card ENDS ──────────────────

/**
 * How a dock trade's scene ends — read off the SERVER's own preview of the
 * trade (`FleetDockPreviewModel`: its chips and its follow-ups, pinned at the
 * commit boundary), never off the card's name:
 *
 *  · `placement` — the reward is AHEAD, on a surface of its own (an «after
 *    confirming» follow-up: Water Hauling's ocean and its cell). Nothing of it
 *    is shown on the stage; the card answers, is read, departs, and the board
 *    comes up clean;
 *  · `rail`      — the reward arrives WITH the answer and asks nothing (UNMI
 *    Liner's +1 TR): its rail-bound gains are flown from the card's printed
 *    icons to their rows, and the card leaves with the workspace;
 *  · `card`      — the reward LANDS ON A CARD (a `cardTarget` follow-up:
 *    Aurora Station's floaters, onto the Venus card the player chose on the
 *    stage before the press — or the one holder the server names). Its tokens
 *    leave the dock's printed icons for that card, one token per icon, the
 *    card's counter ticking on each touchdown; whatever else the reward gives
 *    on the rail (Aurora's M€ production) flies after them, and the card goes
 *    with the workspace. Named for where the reward lands, not for a question:
 *    with one holder nothing is asked at all.
 *
 * Seniority when a preview carries several signs: a card outranks a surface
 * ahead, and a surface ahead outranks a plain gain — Water Hauling states BOTH
 * a placement and a TR chip, and that TR is the ocean's own: it lands with the
 * tile, never from the card.
 */
export type FleetDockRewardCategory = 'placement' | 'rail' | 'card';

export function fleetDockRewardCategory(followUps: ReadonlyArray<ColonyTradeFollowUpModel>): FleetDockRewardCategory {
  if (followUps.some((followUp) => followUp.kind === 'cardTarget')) {
    return 'card';
  }
  return followUps.length > 0 ? 'placement' : 'rail';
}

/** A dock's card target — the first `cardTarget` follow-up of its preview (a dock declares at most one). */
export type FleetDockCardTarget = Extract<ColonyTradeFollowUpModel, {kind: 'cardTarget'}>;

export function fleetDockCardTarget(followUps: ReadonlyArray<ColonyTradeFollowUpModel> | undefined): FleetDockCardTarget | undefined {
  const found = (followUps ?? []).find((followUp) => followUp.kind === 'cardTarget');
  return found?.kind === 'cardTarget' ? found : undefined;
}

/**
 * HOW MANY TOKENS a card-target reward flies: one per PRINTED icon of that
 * resource on the dock's «▲ : [reward]» row (Aurora prints two floater icons —
 * two tokens, each from its own icon), never more tokens than units. Read off
 * the render data (`fleetDockEffectNode`), so the scene answers the printed
 * card, not a guess. At least one.
 */
export function printedRewardUnits(node: ICardRenderEffect | undefined, resource: string | undefined, amount: number): number {
  const result = node?.rows[node.rows.length - 1] ?? [];
  const printed = resource === undefined ? 0 : result.filter((item) =>
    isICardRenderItem(item) && item.type === CardRenderItemType.RESOURCE &&
    item.resource !== undefined && cardResourceKey(item.resource) === cardResourceKey(resource)).length;
  return Math.max(1, Math.min(Math.max(1, amount), printed));
}

/** The landing of the card's answer — the action-commit vocabulary (`ActionCommitKind`), named here so this module stays a leaf. */
export type FleetDockAnswerKind = 'global' | 'resources' | 'generic';

/** What the dock's scene plays after the fleet has landed. */
export type FleetDockScenePlan = {
  category: FleetDockRewardCategory;
  /** Where the impulse over the printed «▲ : [reward]» lands. */
  answer: FleetDockAnswerKind;
  /** `resources` only: the resource whose printed icon the impulse lands on. */
  firstResource?: string;
  /** `rail` / `card`: the gains the card's own icons give — flown in print order, each ticking on its touchdown. */
  specs: Array<ResourceTransferSpec>;
  /** `rail` / `card`: what the table pays BECAUSE of them — released after the last touchdown. */
  reactions: Array<ResourceTransferSpec>;
  /** `card` only: the card that receives (the stage's choice, else the one holder the server named). */
  target?: CardName;
  /**
   * `card` only, aligned with `specs`: the victory points each token brings the
   * RECEIVING card at its touchdown — the server's per-unit reading
   * (`vpSteps`), so a derived number (the rail's VP cell) is held with the
   * counter it derives from. 0 for a token that moves no point.
   */
  vp?: Array<number>;
};

/**
 * The tokens of a CARD-target reward: `amount` units onto `target`, split over
 * `tokens` flights (print order, the remainder on the first), each with the
 * points it brings the card at its touchdown — the server's own per-unit
 * reading (`vpSteps[target][k − 1]`), cumulative, never client arithmetic.
 */
export function cardTargetTokens(followUp: FleetDockCardTarget, target: CardName, tokens: number): {specs: Array<ResourceTransferSpec>, vp: Array<number>} {
  const resource = followUp.resource === undefined ? '' : cardResourceKey(followUp.resource);
  const amount = Math.max(0, followUp.amount);
  const count = Math.max(1, Math.min(tokens, amount));
  const steps = followUp.vpSteps?.[target];
  const vpAfter = (units: number): number => units <= 0 || steps === undefined ?
    (steps?.[0]?.from ?? 0) :
    (steps[Math.min(units, steps.length) - 1]?.to ?? 0);
  const specs: Array<ResourceTransferSpec> = [];
  const vp: Array<number> = [];
  let landed = 0;
  for (let i = 0; i < count; i++) {
    const units = Math.floor(amount / count) + (i < amount % count ? 1 : 0);
    specs.push({channel: 'card-resource', resource, amount: units, targetCard: target});
    vp.push(steps === undefined ? 0 : vpAfter(landed + units) - vpAfter(landed));
    landed += units;
  }
  return {specs, vp};
}

/**
 * The table's answer as rail specs: only what arrives WITH the trade's own
 * response and is the viewer's — an `exact` fact addressed to «you». A
 * question, a deferred payout, an uncomputed reaction and another seat's gain
 * are named on the stage and never held on the viewer's rail.
 */
export function reactionRailSpecs(reactions: ReadonlyArray<EffectForecastFact> | undefined): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (const fact of reactions ?? []) {
    if (fact.certainty === 'exact' && fact.recipient.kind === 'you') {
      out.push(...railRewardSpecs(fact.effects));
    }
  }
  return mergeTransferSpecs(out);
}

/**
 * The scene's plan, from the preview the stage pinned at the commit boundary.
 * NO preview (the press outran the stage's own fetch) is the honest default —
 * the phrase every dock played before categories existed: the card answers,
 * is read and departs, nothing is flown and nothing is withheld on the rail.
 * A category is never guessed from the pick's marker: its chips alone cannot
 * tell a plain gain from the TR of a tile that is still ahead.
 */
export function fleetDockScenePlan(preview: {
  effects: ReadonlyArray<ActionEffect>,
  followUps: ReadonlyArray<ColonyTradeFollowUpModel>,
  forecast?: Pick<EffectForecast, 'facts'>,
} | undefined, card?: {
  /** The card that receives — the stage's captured choice (absent: the server's one holder, `auto`). */
  target?: CardName,
  /** The printed tokens of the target's resource (`printedRewardUnits`); 1 when unknown. */
  tokens?: number,
}): FleetDockScenePlan {
  if (preview === undefined) {
    return {category: 'placement', answer: 'global', specs: [], reactions: []};
  }
  const category = fleetDockRewardCategory(preview.followUps);
  switch (category) {
  case 'placement':
    // The impulse lands on the printed parameter the placement will move (the ocean) — the reward itself is ahead.
    return {category, answer: 'global', specs: [], reactions: []};
  case 'rail': {
    const specs = railRewardSpecs(preview.effects);
    if (specs.length === 0) {
      return {category, answer: 'generic', specs, reactions: []};
    }
    const first = specs[0];
    return first.resource === RATING_RAIL_KEY ?
      {category, answer: 'global', specs, reactions: reactionRailSpecs(preview.forecast?.facts)} :
      {category, answer: 'resources', firstResource: first.resource, specs, reactions: reactionRailSpecs(preview.forecast?.facts)};
  }
  case 'card': {
    // THE CARD PAYS A CARD: the tokens leave the printed icons for the receiving card (one per icon), then the
    // rail half of the same reward (the M€ production) flies to its row — the printed order is the order of the
    // events. With no receiving card named (a choice not made — the press outran it) nothing is flown: the
    // honest default, the counters tick with the commit.
    const followUp = fleetDockCardTarget(preview.followUps);
    const target = card?.target ?? followUp?.auto;
    if (followUp === undefined || followUp.lost || target === undefined || followUp.resource === undefined) {
      return {category, answer: 'generic', specs: [], reactions: []};
    }
    const tokens = cardTargetTokens(followUp, target, card?.tokens ?? 1);
    const rail = railRewardSpecs(preview.effects);
    return {
      category,
      answer: 'resources',
      firstResource: cardResourceKey(followUp.resource),
      specs: [...tokens.specs, ...rail],
      reactions: reactionRailSpecs(preview.forecast?.facts),
      target,
      vp: [...tokens.vp, ...rail.map(() => 0)],
    };
  }
  }
}

/** A `Payment`'s fields that are rail rows (the standard resources — a card resource spent as M€ leaves no rail row). */
const PAYMENT_RAIL_ROWS: ReadonlyArray<keyof Payment> = ['megacredits', 'heat', 'steel', 'titanium', 'plants'];

/**
 * THE OTHER MOVES OF THE TRADE ON THE RAIL — what the same response changes on
 * the viewer's rows beside the reward: the FEE of the chosen path (the
 * server's own `current → resulting` on the path's option; the captured
 * payment of an M€ path that asked for one; the Delta Works composition of an
 * energy path) and the flat every-trade bonuses. Keyed by `railRowKey`; the
 * reward's diff check (`railReward.verifyRailReward`) allows for exactly these.
 */
export function tradeKnownRailMoves(input: {
  option: SelectOptionModel | undefined,
  payment?: Payment,
  mix?: {energy: number, steel: number},
  flatBonuses?: ReadonlyArray<{resource: string, amount: number}>,
}): Record<string, number> {
  const known: Record<string, number> = {};
  const add = (resource: string, amount: number) => {
    if (amount !== 0 && isStandardResource(resource)) {
      const row = railRowKey({channel: 'stock', resource});
      known[row] = (known[row] ?? 0) + amount;
    }
  };
  if (input.mix !== undefined) {
    add('energy', -input.mix.energy);
    add('steel', -input.mix.steel);
  } else if (input.payment !== undefined) {
    for (const resource of PAYMENT_RAIL_ROWS) {
      add(resource, -(input.payment[resource] ?? 0));
    }
  } else {
    const meta = input.option?.metadata;
    if (meta?.icon !== undefined && meta.resource !== undefined) {
      add(meta.icon, meta.resource.resulting - meta.resource.current);
    }
  }
  for (const bonus of input.flatBonuses ?? []) {
    add(bonus.resource, bonus.amount);
  }
  return known;
}
