/*
 * THE DRAFT WORKSPACE'S PURCHASE ARITHMETIC — the members of `ConsoleDraftWorkspace.vue` its unit spec runs against a
 * stub (`consoleBuyCost.spec.ts`: WHICH number each of them reads — the server's `cardCost`, never a card's play cost).
 *
 * Each function is the member's body with the workspace handed in as a PORT (`self`) — exactly the fields that body
 * reads (`Pick<DraftWorkspacePort, …>`). A body that reads another of these members reads it THROUGH the port, so a
 * stub may answer for it. The component builds the port once (accessors over its prop, its refs and its computeds) and
 * each member there is a one-line delegate; a spec hands a stub.
 *
 * `megacreditsAfterPurchase` lives here ALONE: nothing in the component reads it (the remainder the player sees is the
 * wallet plate's `after` — `draftReadingModel.draftWalletOf`), the spec still runs it beside the gate it must agree with.
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {megacreditsAvailable} from '@/client/console/paymentPlan';

/** One workspace zone — what the staging area is showing right now. */
export type DraftZone = 'pick' | 'wait' | 'buy' | 'pay' | 'inspect' | 'done';

/** What the purchase's arithmetic reads of the workspace. */
export type DraftWorkspacePort = {
  readonly playerView: PlayerViewModel,
  /** Pick-stage picks (keep-2 rounds) and buy-stage picks — the purchase reads their count. */
  readonly picks: ReadonlyArray<CardName>,
  /** The one visible layer of the staging area. */
  readonly zone: DraftZone,
  readonly buyCostPerCard: number,
  readonly buyTotal: number,
  readonly megacreditsOnHand: number,
};

// ── purchase economics (server-identical: ChooseCards charges
//    selected.length × player.cardCost) ─────────────────────────────
export function buyCostPerCard(self: Pick<DraftWorkspacePort, 'playerView'>): number {
  return self.playerView.thisPlayer.cardCost;
}

export function buyTotal(self: Pick<DraftWorkspacePort, 'picks' | 'buyCostPerCard'>): number {
  return self.picks.length * self.buyCostPerCard;
}

export function megacreditsOnHand(self: Pick<DraftWorkspacePort, 'playerView'>): number {
  return megacreditsAvailable(self.playerView.thisPlayer);
}

export function megacreditsAfterPurchase(self: Pick<DraftWorkspacePort, 'megacreditsOnHand' | 'buyTotal'>): number {
  return self.megacreditsOnHand - self.buyTotal;
}

export function buyAffordable(self: Pick<DraftWorkspacePort, 'zone' | 'buyTotal' | 'megacreditsOnHand'>): boolean {
  return self.zone !== 'buy' || self.buyTotal <= self.megacreditsOnHand;
}
