/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VERDICT HANDS THE CARD OVER — «результат переживает поверхность, которая
 * его произвела».
 *
 * A deck check turns the top card over INTO a slot of the verdict stage, and
 * that card then goes somewhere real: onto the discard pile (Search For Life,
 * Asteroid Deflection System, a Political Think Tank miss) or into the
 * revealer's hand (a Political Think Tank match, TR13). Before this module the
 * card stood in its slot until «OK» and vanished with the workspace — the one
 * object on screen whose destination the player was never shown.
 *
 * ON «OK», AND ONLY THERE, the outcome DETACHES:
 *   · hand    → the shared HAND INTAKE (`runHandIntake`) lifts the card off its
 *               slot onto the app-level delivery layer; on its staged seam the
 *               host acknowledges (the workspace concludes UNDER the lifted
 *               card) and the intake's own slot polling lands it on its MEASURED
 *               resting rect in the dock. The verdict's stock reward (+5 M€)
 *               leaves the verdict's chip in the same beat and the rail's
 *               counter ticks on the touchdown;
 *   · discard → the ONE language of a refused open card (`discardOpenCards`):
 *               proxies over the card, the turn-over, the carry to the pile.
 *
 * THE HOLDS, and who releases them:
 *   · the KEPT CARD is in `cardsInHand` from the server's answer on. The dock
 *     withholds it while the verdict stands (`revealKeptCardHeld`, derived in
 *     the shell's `dockHeld` — reload-safe, no state), and the intake's in-flight
 *     ledger takes over in the SAME synchronous block as the press;
 *   · the STOCK REWARD is held on the rail from the answer (`seedRevealRewardHold`,
 *     in the transport's apply block — the panel paints «committed − held», so a
 *     hold seeded a micro-task late flushes a phantom chip). ONLY this module's
 *     own spec is ever released — `clearPanelRewardHold()` would take somebody
 *     else's chip with it (memory: panel-reward-hold-is-shared). It is released
 *     by the chip's TOUCHDOWN; a verdict that disappears without an «OK» (the
 *     server moved on, a reset) releases it unflown — never a timer.
 *
 * Nothing measurable → the end pose (the counter ticks, the card is where the
 * server says) plus a NAMED degradation witness on <html>
 * (`data-reveal-handoff-degraded`), never a silent jump.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {RevealResultModel, revealDestination} from '@/common/models/RevealResultModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {discardOpenCards} from '@/client/console/cardDiscard/discardOpenCard';
import {revealKey, revealRewardStock} from '@/client/console/revealReading';

/** The attribute a degraded handoff leaves on <html> (an e2e reads its ABSENCE). */
export const REVEAL_HANDOFF_DEGRADED_ATTR = 'data-reveal-handoff-degraded';

type OwedReward = {key: string, spec: ResourceTransferSpec};

/** What the rail is holding for a verdict that has not been acknowledged yet. */
export const revealHandoffState = reactive({
  owed: undefined as OwedReward | undefined,
});

/** Release THIS module's rail hold (never anybody else's) and forget it. */
function releaseOwed(): void {
  const owed = revealHandoffState.owed;
  if (owed !== undefined) {
    revealHandoffState.owed = undefined;
    releasePanelRewardHold(owed.spec);
  }
}

/**
 * SEED — called in the SAME synchronous block as the view apply (the
 * transport's `seedRewardHolds` for the viewer's own submit, `App.update` for a
 * poll / WS frame). Idempotent over echo frames (the same verdict again seeds
 * nothing), and a first view seeds nothing (a reload shows the committed truth).
 * A held reward whose verdict is gone or replaced can never fly any more — it
 * is released here, in the same block that took it away.
 */
export function seedRevealRewardHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const next = after?.lastReveal;
  const owed = revealHandoffState.owed;
  if (owed !== undefined && (next === undefined || revealKey(next) !== owed.key)) {
    releaseOwed();
  }
  if (before === undefined || next === undefined || consoleReducedMotionActive()) {
    return;
  }
  const key = revealKey(next);
  const prev = before.lastReveal;
  if ((prev !== undefined && revealKey(prev) === key) || revealHandoffState.owed?.key === key) {
    return;
  }
  const stock = revealRewardStock(next);
  if (stock === undefined) {
    return;
  }
  const spec: ResourceTransferSpec = {channel: 'stock', resource: stock.resource, amount: stock.amount};
  beginPanelRewardHold([spec]);
  revealHandoffState.owed = {key, spec};
}

/** Take the held reward of THIS verdict for its flight (the flight releases it now). */
function consumeOwed(key: string): ResourceTransferSpec | undefined {
  const owed = revealHandoffState.owed;
  if (owed === undefined || owed.key !== key) {
    return undefined;
  }
  revealHandoffState.owed = undefined;
  return owed.spec;
}

/** Full reset (shell teardown / game switch): release the held reward unflown. */
export function resetRevealHandoff(): void {
  releaseOwed();
}

function markDegraded(reason: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(REVEAL_HANDOFF_DEGRADED_ATTR, reason);
  }
}

function usableRect(el: Element | null | undefined): DOMRect | undefined {
  const r = el?.getBoundingClientRect();
  return r !== undefined && r.width >= 10 && r.height >= 10 ? r : undefined;
}

/** The centre of the verdict's own stock-reward chip — the M€ flight's birth point. */
function rewardChipPoint(verdict: HTMLElement | undefined): TransferPoint | undefined {
  const chip = verdict?.querySelector('[data-reveal-reward-stock]');
  const r = chip?.getBoundingClientRect();
  if (r === undefined || r.width < 2 || r.height < 2) {
    return undefined;
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
}

/** Fly the held stock reward from the verdict's chip to the rail; the counter ticks on the touchdown. */
function flyStockReward(spec: ResourceTransferSpec | undefined, point: TransferPoint | undefined): void {
  if (spec === undefined) {
    return;
  }
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      releasePanelRewardHold(spec);
    }
  };
  if (point === undefined) {
    markDegraded('no-reward-chip');
    release();
    return;
  }
  void runResourceTransfers({specs: [spec], source: {point}, arrival: 'auto', onArrive: release}).finally(release);
}

export type RevealHandoffArgs = {
  /** The verdict being acknowledged. */
  reveal: RevealResultModel;
  /** The slot the revealed card rests in — the flight's source. */
  slot: HTMLElement | undefined;
  /** The verdict panel — the stock reward chip's birth point. */
  verdict: HTMLElement | undefined;
  /**
   * The host's acknowledgement (mark the verdict seen, release the claim,
   * conclude the flow). Fired EXACTLY ONCE, in the frame the card has left its
   * slot (the intake's staged seam) — or at once when nothing can fly.
   */
  onDetached: () => void;
};

/**
 * «OK» on a verdict: the revealed card goes where the server sent it, and the
 * host's surface concludes under it. Never throws, never strands the host.
 */
export function runRevealHandoff(args: RevealHandoffArgs): void {
  const {reveal, slot, verdict, onDetached} = args;
  let detached = false;
  const detach = () => {
    if (!detached) {
      detached = true;
      onDetached();
    }
  };
  const stock = consumeOwed(revealKey(reveal));
  // Measured NOW: the verdict leaves with the workspace a few frames from here.
  const point = rewardChipPoint(verdict);
  if (typeof document === 'undefined' || usableRect(slot) === undefined) {
    // No stage to lift from (a torn-down layout, the unit runner): the end pose.
    markDegraded('no-slot');
    if (stock !== undefined) {
      releasePanelRewardHold(stock);
    }
    detach();
    return;
  }
  const name = reveal.revealed.name;
  if (revealDestination(reveal) === 'hand') {
    void runHandIntake([{name, el: slot}], {
      mode: 'cascade',
      onStaged: () => {
        detach();
        flyStockReward(stock, point);
      },
    }).finally(detach);
    return;
  }
  // The discard: the proxies are measured and spawned from the slot (app-level
  // layer), so the surface may conclude in this very block.
  void discardOpenCards([{name, el: slot}]);
  detach();
  flyStockReward(stock, point);
}
