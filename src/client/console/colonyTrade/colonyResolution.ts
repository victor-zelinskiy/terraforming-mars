/*
 * COLONY RESOLUTION — the ONE lifecycle answer to «is a colony's card payout
 * (Pluto: draw → take → discard, per settlement, in order) still owed?», and
 * the flow controller of the COLONY WORKSPACE's post-commit chain.
 *
 * WHY A MODULE. The Pluto flow used to end wherever its most local signal
 * ended: taking the last reveal card released the embed claim, the claim's
 * falling edge closed the workspace, the discard prompt then re-opened a
 * SEPARATE hand workspace, and the next bonus batch dragged the colonies back
 * («COLONIES → MODAL → HAND → COLONIES» — the reported break). The truth the
 * server already models is different: ONE resolution spans the trade commit,
 * every reveal batch, every mandatory discard and the closing track reset —
 * the server itself sequences the reset AFTER the last bonus (see
 * Colony.handleTrade's finalizer at Priority.DECREASE_COLONY_TRACK_AFTER_TRADE
 * vs the discards' Priority.SUPERPOWER). This module states that span ONCE, so
 * the workspace's lifetime can ride it instead of riding «the reveal is empty».
 *
 * THE PHASES (derived, never assigned — the honest state machine):
 *
 *   trade-reveal   — the trade income batch is on the table, being taken;
 *   owner-bonus    — a colony-bonus card (own or foreign trade) is on the
 *                    table / arriving;
 *   discard        — the mandatory «select a card to discard» is the pending
 *                    server input (the hand step runs INSIDE the workspace);
 *   discard-flight — the chosen card is physically leaving (the shared
 *                    cardDiscard scene) — the answer is committed, the beat
 *                    is not;
 *   concluding     — no more inputs; the trade transaction is finishing its
 *                    own tail (track glide → settle);
 *   idle           — nothing owed.
 *
 * AUTHORITY. Every predicate reads server truth (the `discardPrompt.colonyBonus`
 * marker, the reveal batch's `CardDrawRevealSource`, the trade transaction that
 * concludes only on the committed track reset) — never a title, never a DOM
 * state, never a card count a client invented. The two client-armed latches
 * (the discard scene, the remote-entry context) are both bounded by their own
 * flows and only ever EXTEND the resolution to the end of a physical beat the
 * player must see finish.
 *
 * PURE + a tiny reactive entry context; unit-tested in
 * tests/client/components/console/colonyResolution.spec.ts.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {ColonyBonusDiscardMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {colonyTradeState} from '@/client/console/colonyTrade/consoleColonyTrade';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';

/** The resolution's derived phase (observability + the crumb's vocabulary). */
export type ColonyResolutionPhase =
  | 'idle'
  | 'trade-reveal'
  | 'owner-bonus'
  | 'discard'
  | 'discard-flight'
  | 'concluding';

/**
 * THE REMOTE ENTRY CONTEXT — armed when the viewer enters the colony workspace
 * to answer an owner bonus another player's trade triggered. It exists so the
 * flow has an owner from the moment of entry (before any batch is claimed),
 * and so the stage can name the trigger («Игрок X торговал с Плутоном»).
 *
 * Module-level reactive (survives playerView commits and the shell's
 * transient-UI resets); cleared exactly when the resolution ends.
 */
export const colonyBonusEntry = reactive({
  colonyName: '' as ColonyName | '',
  /** The trading player (resolved from the colony's `visitor` at entry). */
  traderColor: '' as Color | '',
  traderName: '' as string,
});

export function armColonyBonusEntry(colonyName: ColonyName, trader?: {color: Color, name: string}): void {
  colonyBonusEntry.colonyName = colonyName;
  colonyBonusEntry.traderColor = trader?.color ?? '';
  colonyBonusEntry.traderName = trader?.name ?? '';
}

export function clearColonyBonusEntry(): void {
  colonyBonusEntry.colonyName = '';
  colonyBonusEntry.traderColor = '';
  colonyBonusEntry.traderName = '';
}

export function colonyBonusEntryArmed(): boolean {
  return colonyBonusEntry.colonyName !== '';
}

/**
 * THE RESOLUTION'S PRESENTATION RECEIPT — how many mandatory discards this
 * resolution has physically completed (the «СБРОШЕНО» seat's count). Purely
 * presentational: the authoritative sequencing is the server's `index/total`
 * marker; this only lets the seat keep a calm record between cycles instead
 * of blinking empty when the tray withdraws.
 */
export const colonyResolutionUi = reactive({
  discarded: 0,
});

export function noticeColonyResolutionDiscard(): void {
  colonyResolutionUi.discarded++;
}

export function resetColonyResolutionUi(): void {
  colonyResolutionUi.discarded = 0;
}

/** The structural marker of a pending colony-bonus discard, if any. */
export function colonyBonusDiscardOf(wf: PlayerInputModel | undefined): ColonyBonusDiscardMeta | undefined {
  return wf?.discardPrompt?.colonyBonus;
}

/** A COLONY-sourced reveal batch's colony name ('' for anything else). */
export function revealColonyOf(source: CardDrawRevealSource | undefined): string {
  return source?.type === 'colony' ? source.colonyName : '';
}

/** Is this colony-sourced batch an OWNER-BONUS wave (vs trade income)? */
export function revealIsOwnerBonus(source: CardDrawRevealSource | undefined): boolean {
  return source?.type === 'colony' && source.trade?.role === 'bonus';
}

/** Everything the pure derivations read — the shell assembles it once. */
export type ColonyResolutionSignals = {
  /** The pending colony-bonus discard marker (server truth). */
  discardMeta: ColonyBonusDiscardMeta | undefined,
  /** The current reveal batch's source (drawnCardsState truth). */
  revealSource: CardDrawRevealSource | undefined,
  /** The viewer's OWN trade transaction is running (spans to the track reset). */
  tradeActive: boolean,
  /** Its colony ('' when no own transaction). */
  tradeColony: string,
  /** The shared discard scene is disposing THIS resolution's card. */
  discardFlightMeta: ColonyBonusDiscardMeta | undefined,
  /** The remote-entry context (armed on gated entry, '' otherwise). */
  entryColony: string,
  /**
   * The COLONY WORKSPACE holds the outcome claim — the flow already has a
   * living owner surface. ⚠️ Load-bearing for the own/remote split: the trade
   * TRANSACTION is not a reliable «this is my own flow» proof, because a
   * trade whose track never moves (one colony, position 1 — the
   * built-then-traded case) concludes right after its chip/reveal beats,
   * BEFORE the mandatory discard. The claim is what the workspace keeps for
   * the resolution's whole span, so it is the discriminator.
   */
  claimedByColonies: boolean,
};

/**
 * THE COLONY THIS RESOLUTION BELONGS TO — '' when nothing is owed. Priority is
 * the signal's authority: the viewer's own transaction names its colony for
 * its whole span; a pending discard marker names its colony structurally; the
 * armed remote entry carries it across the gaps between batches; a live
 * colony-sourced reveal covers the first batch of a foreign bonus.
 */
export function colonyResolutionColony(s: ColonyResolutionSignals): string {
  if (s.tradeActive && s.tradeColony !== '') {
    return s.tradeColony;
  }
  if (s.discardMeta !== undefined) {
    return s.discardMeta.colonyName;
  }
  if (s.discardFlightMeta !== undefined) {
    return s.discardFlightMeta.colonyName;
  }
  if (s.entryColony !== '') {
    return s.entryColony;
  }
  return revealColonyOf(s.revealSource);
}

/**
 * IS THE RESOLUTION STILL OWED? The workspace's close gate: while this is
 * true the colony workspace is the ONE interaction owner and may not be
 * unmounted, folded to the board or replaced by another root.
 *
 * Note what is deliberately NOT here: «the reveal has untaken cards» as the
 * ONLY term. An empty reveal between two bonus cycles, a discard prompt whose
 * batch was fully taken, a discard flight after the prompt was answered — all
 * of these are mid-resolution states, and each keeps exactly one of these
 * terms true until the next takes over.
 */
export function colonyResolutionLiveFor(s: ColonyResolutionSignals): boolean {
  return s.tradeActive ||
    s.discardMeta !== undefined ||
    s.discardFlightMeta !== undefined ||
    s.entryColony !== '' ||
    revealColonyOf(s.revealSource) !== '';
}

/** The derived phase (see the header). PURE. */
export function colonyResolutionPhaseFor(s: ColonyResolutionSignals): ColonyResolutionPhase {
  if (s.discardFlightMeta !== undefined) {
    return 'discard-flight';
  }
  const reveal = revealColonyOf(s.revealSource);
  if (reveal !== '') {
    return revealIsOwnerBonus(s.revealSource) ? 'owner-bonus' : 'trade-reveal';
  }
  if (s.discardMeta !== undefined) {
    return 'discard';
  }
  if (s.tradeActive) {
    return 'concluding';
  }
  if (s.entryColony !== '') {
    // Entered, nothing arrived yet (the gap before the first held batch is
    // released) — the bonus stage is standing by.
    return 'owner-bonus';
  }
  return 'idle';
}

/**
 * A REMOTE OWNER BONUS IS WAITING FOR ITS ENTRY: another player's trade
 * granted the viewer a colony bonus (the discard marker is the proof), the
 * viewer has NO transaction of their own and has NOT entered yet. While this
 * holds, the batch's presentation (deck-draw scene, reveal overlay) is HELD —
 * the mandatory announcement is the door, and pressing it arms the entry.
 *
 * A resolution the viewer is already inside (own trade, or an armed entry)
 * never matches — its follow-up batches flow straight into the workspace.
 */
export function remoteColonyBonusPendingFor(s: ColonyResolutionSignals): {colonyName: string} | undefined {
  // The flow already has an OWNER: a running trade transaction, an armed
  // entry, or — decisive for a no-track-move trade whose transaction has
  // already concluded — the colony workspace's own live claim.
  if (s.tradeActive || s.entryColony !== '' || s.claimedByColonies) {
    return undefined;
  }
  // The DISCARD MARKER is the one proof — deliberately NOT «a bonus batch
  // arrived». The batch and its discard prompt ride the same server response,
  // so the marker is present from the same tick; a bonus batch WITHOUT a
  // marker is the auto-discard edge (the owner's hand was too small for a
  // choice — the server discarded silently), where no mandatory action
  // exists, no beat could ever open the door, and a hold would park the
  // batch forever.
  if (s.discardMeta !== undefined) {
    return {colonyName: s.discardMeta.colonyName};
  }
  return undefined;
}

/**
 * The LIVE form of the remote hold, for the scene layers (deck-draw) that only
 * know the batch they are about to claim: while the viewer's entry is still
 * owed, the batch's presentation must not start — the mandatory announcement
 * is the door, and arming the entry is what releases this.
 */
export function remoteColonyBonusHold(
  wf: PlayerInputModel | undefined,
  source: CardDrawRevealSource | undefined,
): boolean {
  return remoteColonyBonusPendingFor({
    discardMeta: colonyBonusDiscardOf(wf),
    revealSource: source,
    tradeActive: colonyTradeState.active,
    tradeColony: colonyTradeState.colonyName,
    discardFlightMeta: cardDiscardColonyBonus(),
    entryColony: colonyBonusEntry.colonyName,
    claimedByColonies: workspaceOutcomeState.host === 'colonies',
  }) !== undefined;
}
