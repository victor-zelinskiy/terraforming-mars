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
import type {TaskKind} from '@/client/console/consoleTaskRouter';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {ColonyBonusCollectMeta, ColonyBonusDiscardMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
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
  /**
   * THE FULL-STAGE DISCARD PHASE is up: the hand owns the whole central area
   * (the colony shrunk to its source chip), the claimed reveal slot is held
   * empty (a next-cycle batch waits for the focus restore), and the closing
   * track glide is deferred. Set on the discard's entry, cleared when the
   * hand hands the room back (or the resolution ends).
   */
  discardStage: false,
  /**
   * THE PAYOUT HAS LIFTED OFF — the first card of this payout has separated
   * from its source and is rising while it turns.
   *
   * ONE FACT, RAISED BY WHICHEVER SCENE IS FLYING (the trade's covers, the
   * build's cover-lift), read by the colony stage as the cue to start letting
   * go. It exists because the stage's dissolve must be SYNCHRONOUS WITH THE
   * CARDS THEMSELVES — the interface evaporates as they rise and turn, one
   * continuous phrase — and neither scene's private phase ladder is a fact the
   * stage should have to know. A per-scene predicate here is how the build
   * path ended up with no cue at all and dissolved on «content landed»
   * instead, i.e. abruptly and after the fact.
   */
  payoutLiftOff: false,
});

export function noticeColonyResolutionDiscard(): void {
  colonyResolutionUi.discarded++;
}

export function setColonyDiscardStage(on: boolean): void {
  colonyResolutionUi.discardStage = on;
}

/** A cover scene reports its first card separating (see `payoutLiftOff`). */
export function markColonyPayoutLiftOff(): void {
  colonyResolutionUi.payoutLiftOff = true;
}

/** The payout is over (its claim released / the scene torn down) — the next
 *  one must raise its own cue, never inherit this one. */
export function clearColonyPayoutLiftOff(): void {
  colonyResolutionUi.payoutLiftOff = false;
}

export function resetColonyResolutionUi(): void {
  colonyResolutionUi.discarded = 0;
  colonyResolutionUi.discardStage = false;
  colonyResolutionUi.payoutLiftOff = false;
}

/**
 * WHAT THE COLONY WORKSPACE SERVES WHILE A RESOLUTION RUNS — one list, four
 * call sites (the rising edge, the re-entry, the bonus entry, the discard
 * routing). `handSelect` and `colonyBonus` are EARNED here, never registry
 * defaults: a colonies screen idling at its browse layer must not mask an
 * unrelated stranded prompt of either kind.
 */
export const COLONY_RESOLUTION_SERVES: ReadonlyArray<TaskKind> = ['colony', 'handSelect', 'colonyBonus'];

/** The structural marker of a pending colony-bonus discard, if any. */
export function colonyBonusDiscardOf(wf: PlayerInputModel | undefined): ColonyBonusDiscardMeta | undefined {
  return wf?.discardPrompt?.colonyBonus;
}

/**
 * The structural marker of a pending colony-bonus COLLECT — the delivery of a
 * card another player's trade owes the viewer (Miranda). The server draws it
 * on the answer, so this marker IS the whole «that colony paid you» state.
 */
export function colonyBonusCollectOf(wf: PlayerInputModel | undefined): ColonyBonusCollectMeta | undefined {
  return wf?.colonyBonusPrompt;
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
  /** The pending colony-bonus COLLECT marker (server truth) — a delivery the
   *  viewer owes an answer to before its card is even drawn. */
  collectMeta: ColonyBonusCollectMeta | undefined,
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
  if (s.collectMeta !== undefined) {
    return s.collectMeta.colonyName;
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
    // A COLLECT still owed: the viewer has walked onto the colony and the
    // card is drawn on their answer, so the workspace must stand through the
    // gap where nothing has arrived yet.
    s.collectMeta !== undefined ||
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
  if (s.collectMeta !== undefined) {
    // Answered nothing yet, or answered and the card is on its way: either
    // way the owner bonus is what the screen is about.
    return 'owner-bonus';
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
  // A SERVER MARKER is the one proof — deliberately NOT «a bonus batch
  // arrived». Both markers ride the same response as whatever they own, so
  // they are present from the same tick; a bonus batch WITHOUT a marker is
  // the auto-discard edge (the owner's hand was too small for a choice — the
  // server discarded silently), where no mandatory action exists, no beat
  // could ever open the door, and a hold would park the batch forever.
  if (s.discardMeta !== undefined) {
    return {colonyName: s.discardMeta.colonyName};
  }
  // The COLLECT delivery (Miranda): the card is not even drawn yet, so there
  // is normally nothing to hold — but a batch that DID arrive (the previous
  // cube's card, still on the table) belongs to the same entry, and the
  // answer to this marker is what opens the door.
  if (s.collectMeta !== undefined) {
    return {colonyName: s.collectMeta.colonyName};
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
    collectMeta: colonyBonusCollectOf(wf),
    revealSource: source,
    tradeActive: colonyTradeState.active,
    tradeColony: colonyTradeState.colonyName,
    discardFlightMeta: cardDiscardColonyBonus(),
    entryColony: colonyBonusEntry.colonyName,
    claimedByColonies: workspaceOutcomeState.host === 'colonies',
  }) !== undefined;
}
