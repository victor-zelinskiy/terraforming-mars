import {Color} from '@/common/Color';

/**
 * The SINGLE smart source of truth for «why can't I trade at THIS colony right
 * now». Shared by the colony tile status AND the trade-attempt notice / inspect
 * block so they can never diverge and — crucially — so neither ever hardcodes a
 * generic turn message where a concrete, real reason exists.
 *
 * The bug this replaces: pressing «Trade» on a colony that already holds YOUR
 * fleet read «Сначала завершите текущее действие» (a turn-state guess) instead
 * of the true «Здесь стоит ваш флот». The generic turn reason is only ever the
 * LAST resort — every colony-intrinsic or resource blocker outranks it.
 *
 * The ladder is deliberately ordered by how ABSOLUTE the blocker is:
 *   1. colony-intrinsic (not built / a fleet already docked) — true regardless
 *      of turn or fleet count, so it must win over any turn/fleet message;
 *   2. no free trade fleet — a real capability blocker, true regardless of turn;
 *   3. can't afford the trade cost — the trade action isn't offered though a
 *      fleet is free and the action window is live;
 *   4. only then the turn itself (a pending mandatory decision, or genuinely an
 *      opponent's turn) — the honest fallback when nothing more specific applies.
 */

export type ColonyTradeReasonColony = {
  name: string,
  isActive: boolean,
  visitor: Color | undefined,
};

export type ColonyTradeReasonInput = {
  /** The colony the reason is for. */
  colony: ColonyTradeReasonColony,
  /** Colony names the OPEN SelectColony window offers (server-filtered; empty
   *  when no trade window is open — no free fleet / can't afford / not my turn). */
  tradeable: ReadonlyArray<string>,
  viewerColor: Color,
  /** The viewer's FREE trade fleets right now (fleetSize − deployed − used). */
  availableFleets: number,
  /** The free ACTION MENU is live (a top-level action is offered right now). */
  myTurn: boolean,
  /** The server is waiting on the viewer at all — their turn even when the free
   *  action menu is withheld by a mandatory sub-decision. */
  awaitingInput: boolean,
  /** Resolve a colour to its display label (for another player's docked fleet). */
  resolveName: (color: Color) => string,
};

export type ColonyTradeReason = {
  /** English i18n key (the text IS the key). */
  key: string,
  /** Params for a `${0}`-templated key (already display-resolved). */
  params?: ReadonlyArray<string>,
  /**
   * TRUE for a blocker INTRINSIC to the colony (not built yet / a fleet is
   * already docked): untradeable regardless of turn or fleet count. The tile
   * shows these as a hard ✕; a merely turn/fleet/afford block stays CALM on the
   * tile (its reason surfaces on the trade-attempt notice instead).
   */
  intrinsic: boolean,
};

/**
 * Resolve the trade blocker for one colony, or `undefined` when it IS tradeable.
 * PURE — unit-tested; every console surface funnels through it.
 */
export function colonyTradeReason(input: ColonyTradeReasonInput): ColonyTradeReason | undefined {
  if (input.tradeable.includes(input.colony.name)) {
    return undefined; // the server offers this trade — no blocker
  }
  // 1. COLONY-INTRINSIC — true regardless of turn / fleet. MUST win over any
  //    generic turn message.
  if (!input.colony.isActive) {
    return {key: 'This colony is not active yet', intrinsic: true};
  }
  if (input.colony.visitor !== undefined) {
    return input.colony.visitor === input.viewerColor ?
      {key: 'Your trade fleet is currently here', intrinsic: true} :
      {key: 'Trade fleet of ${0} is currently here', params: [input.resolveName(input.colony.visitor)], intrinsic: true};
  }
  // 2. The colony itself is fine — the blocker is the viewer's ability to trade.
  if (input.availableFleets <= 0) {
    return {key: 'No trade fleet available', intrinsic: false};
  }
  // 3. A window is open for OTHER colonies, or the action menu is live while a
  //    free fleet exists, yet this trade isn't offered → can't afford the cost.
  if (input.tradeable.length > 0 || input.myTurn) {
    return {key: 'Not enough resources to cover the cost', intrinsic: false};
  }
  // 4. No window at all despite a free fleet → the turn is the blocker.
  return {
    key: input.awaitingInput ? 'Finish your current action first' : 'Not your turn to take any actions',
    intrinsic: false,
  };
}
