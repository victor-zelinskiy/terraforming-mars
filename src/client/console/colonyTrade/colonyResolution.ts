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
  /**
   * ⚠️ THE ENTRY IS THE ONLY TERM OF THE RESOLUTION THE CLIENT ITSELF WRITES,
   * so it is the only one that could LATCH — and it did, for a whole session.
   *
   * `clearColonyBonusEntry()` runs on exactly one edge: the FALLING edge of
   * `colonyResolutionLive`. While `colonyName` was a liveness term of its own,
   * that edge became unreachable the moment the entry was armed — the flag kept
   * the resolution true and the resolution kept the flag. Everything downstream
   * then never happened either: the claim was never released, the workspace
   * never concluded (the board offered «Вернуться к решению» over an empty
   * screen), the «СБРОШЕНО» receipt kept counting across resolutions, and the
   * stage kept naming a trader from a payout two generations old — over the
   * viewer's OWN trade.
   *
   * So the entry only HOLDS while it is still waiting for the payout it was
   * armed for. The moment any authoritative term takes over (a marker, a batch,
   * a discard flight, the viewer's own transaction) the wait is over and the
   * entry is demoted to what it always was in substance: CONTEXT — which colony
   * and whose trade — carried to the end of the resolution and cleared with it.
   * A payout that never arrives at all releases it on a bounded named net
   * (`COLONY_BONUS_ENTRY_WAIT_MS`), because «armed and waiting» has to be a
   * state the flow can leave without the server's help.
   */
  awaiting: false,
});

export function armColonyBonusEntry(colonyName: ColonyName, trader?: {color: Color, name: string}): void {
  colonyBonusEntry.colonyName = colonyName;
  colonyBonusEntry.traderColor = trader?.color ?? '';
  colonyBonusEntry.traderName = trader?.name ?? '';
  colonyBonusEntry.awaiting = true;
}

/**
 * HOW LONG «I have entered and nothing has arrived yet» may hold the workspace
 * on its own. Every real path releases it far sooner (the marker that opened
 * the door is present from the same tick, and the batch it holds for lands in
 * the next response); this is the named net for the one case with no signal at
 * all — an answer that produced nothing (an empty deck, a bonus the server
 * resolved silently). A bounded wait ends; a latch does not, and that is the
 * whole difference between this and the bug it replaces.
 */
export const COLONY_BONUS_ENTRY_WAIT_MS = 8000;

/**
 * The entry stops being what HOLDS the resolution up — evidence took over, or
 * the bounded wait expired. The context (colony + trader) stands until the
 * resolution itself ends.
 */
export function noteColonyBonusEntryWaitOver(): void {
  colonyBonusEntry.awaiting = false;
}

export function clearColonyBonusEntry(): void {
  colonyBonusEntry.colonyName = '';
  colonyBonusEntry.traderColor = '';
  colonyBonusEntry.traderName = '';
  colonyBonusEntry.awaiting = false;
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
  /**
   * THE PRESENTED CARD SCENE IS STANDING — the chosen host card(s) of a
   * card-resource payout are on the stage with the reward physically arriving.
   *
   * Published by the stage, read by the SECTION's completion: a colony act
   * whose reward lands on a card may not route home while that card is still
   * on screen receiving it. The BUILD is why it exists — its own transaction
   * ends at the cube's landing, several hundred ms before the floaters touch
   * down, so «resolving fell» would tear the card out from under its own
   * reward (the counter would tick over an unmounted scene).
   */
  cardSceneLive: false,
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
  colonyResolutionUi.cardSceneLive = false;
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

/**
 * A COLONY BONUS THE VIEWER HAS TO PLACE — «куда положить ресурс».
 *
 * The other two shapes of an owner bonus hand over cards (Pluto's discard,
 * Miranda's collect) and carry a marker of their own. This one is a plain
 * card TARGET pick (Enceladus' microbes, Titan's floaters — `AddResourcesToCard`
 * with a colony `cause`), and the server already states its origin
 * structurally: `choiceContext.source = {kind: 'colony', name}`. That is the
 * whole detection — never the prompt's title, which i18n rewrites in place.
 *
 * A prompt carrying a `discardPrompt` is excluded by construction: the discard
 * half of Pluto's bonus is the same input type and has its own owner.
 */
export function colonyBonusCardPickOf(wf: PlayerInputModel | undefined): {colonyName: string} | undefined {
  if (wf === undefined || wf.type !== 'card' || wf.discardPrompt !== undefined) {
    return undefined;
  }
  const source = wf.choiceContext?.source;
  if (source?.kind !== 'colony' || typeof source.name !== 'string' || source.name === '') {
    return undefined;
  }
  return {colonyName: source.name};
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
  /** A pending colony-caused card TARGET pick ('' when none) — the third shape
   *  of an owner bonus, «куда положить ресурс» (see `colonyBonusCardPickOf`). */
  cardPickColony: string,
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
  /** …and it is still WAITING for its payout — the ONLY state in which the
   *  entry holds the resolution up (see `colonyBonusEntry.awaiting`). */
  entryAwaiting: boolean,
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
  if (s.cardPickColony !== '') {
    return s.cardPickColony;
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
  return colonyResolutionEvidenceFor(s) ||
    // …and the client-armed entry — but ONLY while it is still waiting for the
    // payout it was armed for. It may EXTEND the resolution across the gap
    // between the player's press and the first authoritative signal; it may
    // never BE the resolution (see `colonyBonusEntry.awaiting`).
    s.entryAwaiting;
}

/**
 * THE AUTHORITATIVE HALF of the gate — everything the SERVER (or a physical
 * beat already in flight) says is still owed, with the client-armed entry
 * deliberately left out. Named on its own because the shell needs exactly this
 * to answer «is the resolution standing on its own evidence?» — whose rising
 * edge is what ends the entry's wait.
 */
export function colonyResolutionEvidenceFor(s: ColonyResolutionSignals): boolean {
  return s.tradeActive ||
    s.discardMeta !== undefined ||
    // A COLLECT still owed: the viewer has walked onto the colony and the
    // card is drawn on their answer, so the workspace must stand through the
    // gap where nothing has arrived yet.
    s.collectMeta !== undefined ||
    // …and the same for a bonus that has to be PLACED: the pick is the payout.
    s.cardPickColony !== '' ||
    s.discardFlightMeta !== undefined ||
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
  if (s.collectMeta !== undefined || s.cardPickColony !== '') {
    // Answered nothing yet, or answered and the card is on its way; or the
    // bonus is a resource still to be placed. Either way the owner bonus is
    // what the screen is about.
    return 'owner-bonus';
  }
  if (s.tradeActive) {
    return 'concluding';
  }
  if (s.entryAwaiting) {
    // Entered, nothing arrived yet (the gap before the first held batch is
    // released) — the bonus stage is standing by. A SETTLED entry (its payout
    // came and went) names no phase: the resolution is over, and the context it
    // still carries is for the closing frames to read, not a state to be in.
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
 * …AND THE PARK IS ABOUT ONE BATCH, NEVER ABOUT «THE REVEAL».
 *
 * `remoteColonyBonusPendingFor` answers a STATE question — «a foreign trade
 * owes the viewer a bonus and they have not walked in yet». This answers the
 * only question a PRESENTATION layer may ask of it: «is the batch I am about
 * to show THE ONE that is parked?».
 *
 * They were the same call, and the difference is a real freeze. The viewer sits
 * on their OWN reveal (a card action's draw, the card still untaken) when an
 * opponent's Pluto trade lands its discard marker. Read as a state, the park
 * took the WHOLE reveal down: the player's own untaken card lost its surface,
 * `admissionSignals.reveal*` went false — and every door that signal was
 * holding shut (the bonus's own announcement among them) was admitted OVER the
 * flow they were still standing in. Then the door armed the entry, the park
 * released, and the viewer's own batch came back INSIDE the colony workspace,
 * presented as somebody else's payout: two flows in one zone, no way back.
 *
 * The parked batch is the bonus's OWN and nothing else — a batch of that
 * colony, or none drawn yet (the collect delivery draws on the answer, and a
 * discard marker can ride a frame ahead of its own batch). Matched on the
 * colony NAME rather than the bonus role: a merged payout's income batch is
 * the same delivery from the player's side, and holding one half of it while
 * the other presents would tear the strip in two.
 */
export function remoteColonyBonusParksReveal(
  pending: {colonyName: string} | undefined,
  source: CardDrawRevealSource | undefined,
): boolean {
  if (pending === undefined) {
    return false;
  }
  return source === undefined || revealColonyOf(source) === pending.colonyName;
}

/**
 * The LIVE form of the remote hold, for the scene layers (deck-draw) that only
 * know the batch they are about to claim: while the viewer's entry is still
 * owed, THAT batch's presentation must not start — the mandatory announcement
 * is the door, and arming the entry is what releases this. Scoped to the batch
 * asked about (see `remoteColonyBonusParksReveal`): an unrelated draw of the
 * viewer's own keeps dealing.
 */
export function remoteColonyBonusHold(
  wf: PlayerInputModel | undefined,
  source: CardDrawRevealSource | undefined,
): boolean {
  return remoteColonyBonusParksReveal(remoteColonyBonusPendingFor({
    discardMeta: colonyBonusDiscardOf(wf),
    collectMeta: colonyBonusCollectOf(wf),
    // A card-target bonus has no batch to hold, so it is never a reason to
    // park one — it is still part of the resolution's evidence elsewhere.
    cardPickColony: colonyBonusCardPickOf(wf)?.colonyName ?? '',
    revealSource: source,
    tradeActive: colonyTradeState.active,
    tradeColony: colonyTradeState.colonyName,
    discardFlightMeta: cardDiscardColonyBonus(),
    entryColony: colonyBonusEntry.colonyName,
    entryAwaiting: colonyBonusEntry.awaiting,
    claimedByColonies: workspaceOutcomeState.host === 'colonies',
  }), source);
}
