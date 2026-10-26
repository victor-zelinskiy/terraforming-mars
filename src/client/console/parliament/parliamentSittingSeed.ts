/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SITTING'S TRANSITION SEEDS (Turmoil Redux, «Заседание v2» —
 * docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md): the ONE place that turns a
 * server response into DISPLAY HOLDS, in the SAME synchronous block that
 * applies the view — the transport's `seedRewardHolds` for the viewer's own
 * submit, `App.update()` for a poll / WS frame. Seeded a tick late, the
 * tiers would paint the new state for a frame before the beat that moves it
 * (the marker already on its new step, the winner already in the government,
 * the fresh cards already on the table) — the exact class of defect the
 * pre-v2 sitting had, where the server applied everything before the gate
 * and the client «played it back».
 *
 * WHAT IS DETECTED (pure, against the response's BASELINE — `sittingBaselineOf`:
 * the same sitting in `before`, or, since the soft gates run the whole chain
 * in ONE response, the view of the same generation with no sitting yet — the
 * table as it stood):
 *  · THE CHAIN RAN PAST THE VERDICT — the baseline stood before it (no
 *    sitting yet, or a legacy `winner` / `assembly`), `after` is past it:
 *    the enactment's holds — the table as it was voted (`heldSlots` + the
 *    winner's slot), the Agenda move not yet made, the support not yet
 *    seated, the delegates not yet home, the OLD government (card · ruling
 *    party · quest) — and, when the same response already refreshed the area
 *    (a law that asks nothing), the renewal's holds on top; the park of a
 *    card's answer to the change of power opens with them (its batch rides
 *    this very response — `rulingChangeDraw.ts`);
 *  · THE REFRESH ARRIVED — the baseline stood in the effects, `after` past
 *    them: the renewal's holds (the losers' table kept, the fresh faces
 *    hidden, the neutral cubes not yet seated, the lobby not yet refilled).
 * A first view (no `before`) or a view of another generation seeds NOTHING:
 * a reload has no old state to move from — it lands in the final poses.
 *
 * The holds are MODULE state (they outlive the section — a collapsed or a
 * yielded sitting resumes its walk with them); a new sitting drops what the
 * old one still held. Reduced motion holds nothing: the poses are final.
 */
import {resetRulingChangeDraw, seedRulingChangeAnswers} from './rulingChangeDraw';
import {resetAllianceImpulse, seedAllianceSeen} from './allianceImpulse';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {buildParliamentView, ParliamentViewVm} from './consoleParliamentModel';
import {preloadResolutionArt} from './parliamentArtTier';
import {parliamentHolds, resetParliamentHolds} from './parliamentDisplayHolds';
import {verdictStandsAt} from './consoleSittingFlow';
import {sittingBaselineOf} from './sittingBaseline';
import {openRulingChangePark} from './rulingChangeDraw';
import {careerPausedAt} from './agendaReaction';

/** The sitting the holds belong to (`generation:seq`) — a new sitting drops the old holds. */
let heldSitting = '';
/** The sitting whose chain this session SAW arrive (its holds seeded from the table as it stood) — its walk starts on the verdict. */
let liveSitting = '';

/** Did this session see `key`'s chain arrive (the holds seeded)? The section then opens on the verdict; a reload opens in the final poses. */
export function sittingSeededLive(key: string): boolean {
  return key !== '' && liveSitting === key;
}

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

function sittingKey(phase: ParliamentPhaseModel | undefined): string {
  return phase === undefined ? '' : `${phase.generation}:${phase.summary?.seq ?? phase.generation}`;
}

const AFTER_BARRIER: ReadonlySet<string> = new Set(['agenda', 'support', 'enact', 'effects', 'refresh', 'lobby', 'adjourn', 'done']);
const AFTER_REFRESH: ReadonlySet<string> = new Set(['refresh', 'lobby', 'adjourn', 'done']);
/** The steps the enactment has been applied by (the support and the ENACTED slot changed). */
const AFTER_ENACT: ReadonlySet<string> = new Set(['effects', 'refresh', 'lobby', 'adjourn', 'done']);

/** What ONE response moved the sitting across — the transitions the walk has beats for. */
export type SittingTransition = {
  /** The chain ran past the verdict in this response: the Agenda / support / enactment happened. */
  barrier: boolean;
  /** The voting area was refreshed in this response (the losers left, fresh cards were dealt, the lobby refilled). */
  refresh: boolean;
  /**
   * «ИСТРЕБИТЕЛЬ» (TR78 Arwind Inc.): the chain had stopped AT THE CAREER (a card of the winner's table answering its
   * step — `careerPausedAt`) and this response carries what the answer let through: the support and the enactment.
   * Their holds are seeded from the table as the pause left it — the Agenda move already played.
   */
  careerResume?: boolean;
};

/** DETECT (pure): which transitions `after` carries relative to `before` — none across a generation or from a first view. */
export function detectSittingTransition(before: PlayerViewModel | undefined, after: PlayerViewModel): SittingTransition {
  const was = sittingBaselineOf(before, after);
  const now = phaseOf(after);
  if (was === undefined || now === undefined) {
    return {barrier: false, refresh: false};
  }
  const barrier = verdictStandsAt(was.step) && AFTER_BARRIER.has(now.step);
  const refresh = !AFTER_REFRESH.has(was.step) && AFTER_REFRESH.has(now.step) && !now.final;
  const careerResume = careerPausedAt(was) && !careerPausedAt(now) && AFTER_ENACT.has(now.step);
  return {barrier, refresh, ...(careerResume ? {careerResume} : {})};
}

/**
 * WHAT THE ENACTMENT STILL HAS TO MOVE, from the table as it stood
 * (`beforeView`) to the summary's facts: the marker's move, the gained
 * support, the returned delegates, the old government behind the new one.
 */
export function seedEnactmentHolds(beforeView: ParliamentViewVm, after: ParliamentModel, career: '' | 'pause' | 'resume' = ''): void {
  const summary = after.phase?.summary;
  if (summary === undefined) {
    return;
  }
  const h = parliamentHolds;
  // «ИСТРЕБИТЕЛЬ» (TR78): a chain PAUSED at the Career has moved nothing but the marker — the pause seeds that move
  // alone; the RESUME seeds everything else (the marker's glide already played on the paused page).
  if (career === 'pause') {
    if (summary.agenda !== undefined && summary.agenda.to !== summary.agenda.from) {
      h.agendaAwaits = {player: summary.agenda.player, from: summary.agenda.from, to: summary.agenda.to};
    }
    return;
  }
  // The old law leaves the government for the DISCARD PILE: the piles keep their pre-response counts until
  // it lands there (the renewal, when it rides the same response, goes on moving them from these values).
  if (summary.discardedEnacted !== undefined && h.pile === undefined) {
    h.pile = {deck: beforeView.deckSize, discard: beforeView.discardSize};
  }
  if (career !== 'resume' && summary.agenda !== undefined && summary.agenda.to !== summary.agenda.from) {
    h.agendaAwaits = {player: summary.agenda.player, from: summary.agenda.from, to: summary.agenda.to};
  }
  for (const entry of summary.support) {
    if (entry.gained > 0) {
      h.supportIncoming.set(entry.party, (h.supportIncoming.get(entry.party) ?? 0) + entry.gained);
      // Every gained cube left the neutral supply on the server: the bench keeps counting it until its wave lifts.
      h.supportPool += entry.gained;
    }
  }
  for (const entry of summary.returned ?? []) {
    h.returns.set(entry.owner, (h.returns.get(entry.owner) ?? 0) + entry.count);
  }
  // The table as voted — the winner still in its slot — until the renewal takes the whole table.
  h.heldSlots = beforeView.slots;
  h.winnerSlot = beforeView.slots.some((slot) => slot.instance === summary.winner.instance) ? summary.winner.instance : undefined;
  h.vacated = new Set();
  h.liftedFaces = new Set();
  // The old government stays until each piece has moved: the card (the old law leaves, the winner moves in),
  // the ruling party's plaque (the tiles change places), the chairman quest (closed → the new one unfolds).
  h.govBefore = {enacted: beforeView.enacted};
  h.govAwaits = after.enacted?.instance;
  h.rulerBefore = beforeView.rulingParty;
  // Whether the old ruler ruled BY A CARD — generation 1's starting-rule Greens did not, and their plaque
  // keeps its support sockets (the support step may pay them as «not present on any card»).
  h.rulerBeforeByCard = beforeView.enacted !== undefined;
  h.questBefore = {quest: beforeView.quest, chairman: beforeView.chairman};
}

/**
 * WHAT THE RENEWAL STILL HAS TO MOVE, from the server's JOURNAL: the losers'
 * delegates are still on their cards, the piles still read their pre-response
 * counts, the fresh cards are still on the deck (their faces hidden — EVERY
 * dealt card, a loser dealt straight back from the reshuffled discard
 * included: by the rules it left the table and was dealt again, and so it is
 * on screen; there is no «the same card stays» exception), their neutral
 * votes have not arrived, the parties' consumed support still shows on the
 * plaques, the free delegates are still in the reserves. IDEMPOTENT — a cube
 * already hidden adds no second support hold, the journal is seeded once. A
 * summary WITHOUT a journal (a save from before it) seeds nothing: the table
 * is shown as it stands.
 */
export function seedRenewalHolds(beforeView: ParliamentViewVm, after: ParliamentModel, afterView: ParliamentViewVm): void {
  const summary = after.phase?.summary;
  const journal = summary?.renewal;
  if (summary === undefined || journal === undefined || parliamentHolds.renewalSeeded) {
    return;
  }
  const h = parliamentHolds;
  h.renewalSeeded = true;
  if (h.pile === undefined) {
    h.pile = {deck: beforeView.deckSize, discard: beforeView.discardSize};
  }
  for (const event of journal) {
    // Only the returns are seeded here. A `card-effect` (a card answered a leave — TR02) holds nothing of
    // the table: its token is born at the LANDING of the owner's last cube, inside the director's own
    // flight accounting, never as a display hold.
    if (event.kind === 'leave') {
      for (const entry of event.returned) {
        h.renewalReturns.set(entry.owner, (h.renewalReturns.get(entry.owner) ?? 0) + entry.count);
      }
    }
  }
  for (const fresh of summary.refreshed) {
    h.freshFaces.add(fresh.instance);
    if (fresh.neutralVotes <= 0) {
      continue;
    }
    const slot = afterView.slots.find((sl) => sl.instance === fresh.instance);
    if (slot === undefined) {
      continue;
    }
    const seqs = slot.votes.filter((v) => v.owner === 'neutral').map((v) => v.seq).sort((a, b) => a - b).slice(0, fresh.neutralVotes);
    let added = 0;
    for (const seq of seqs) {
      const key = `${slot.instance}#${seq}`;
      if (!h.hiddenCubes.has(key)) {
        h.hiddenCubes.add(key);
        added++;
      }
    }
    if (added > 0) {
      h.support.set(fresh.party, (h.support.get(fresh.party) ?? 0) + added);
    }
  }
  // ARM TIME for the deal: a fresh card's illustration has never been painted, and its proxy turns face up in
  // the air — decode it now, while the beats before the deal play (a blank window mid-turn otherwise). A
  // rejected card is revealed in the air too.
  preloadResolutionArt(journal.flatMap((e) => e.kind === 'deal' || e.kind === 'reject' ? [e.resolution] : []));
  for (const color of summary.lobbyRefilled) {
    h.lobby.add(color);
  }
}

/**
 * SEED — called in the SAME synchronous block as the view apply, for BOTH
 * paths (the transport's own submit, the poll / WS frame). Detects the
 * transitions this response carries and seeds their holds over the table as
 * it stood in `before`; a new sitting (or the phase's end) resets everything.
 */
export function seedParliamentSittingHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  // The alliance's activation (TR62): the first view of a game is the pose the player lands in — no impulse is owed.
  seedAllianceSeen(after);
  // A card's RATING answer to the change of power (TR63) is held on the rail for the enactment's tail.
  seedRulingChangeAnswers(before, after);
  const key = enterParliamentSittingHolds(after);
  if (key === '' || consoleReducedMotionActive()) {
    return;
  }
  const transition = detectSittingTransition(before, after);
  const afterModel = after.game.parliament;
  const beforeModel = before?.game.parliament;
  if (afterModel === undefined || beforeModel === undefined) {
    return;
  }
  const viewer = after.thisPlayer?.color;
  const beforeView = buildParliamentView(beforeModel, viewer, before?.players ?? after.players);
  if (transition.barrier) {
    seedEnactmentHolds(beforeView, afterModel, careerPausedAt(afterModel.phase) ? 'pause' : '');
    liveSitting = key;
    // A CARD'S ANSWER TO THE CHANGE OF POWER (TR62) rides THIS response and is owed to the enactment's tail.
    openRulingChangePark(key);
  } else if (transition.careerResume === true) {
    // THE ANSWER LET THE CHAIN THROUGH (TR78): the support, the enactment — from the table as the pause held it.
    seedEnactmentHolds(beforeView, afterModel, 'resume');
    // …and a card's answer to the change of power (TR62) rides THIS response, owed to the enactment's tail.
    openRulingChangePark(key);
  } else if (transition.refresh && parliamentHolds.heldSlots === undefined) {
    // The refresh arrived on its own (after the effects): the losers' table is kept as it stood.
    parliamentHolds.heldSlots = beforeView.slots;
  }
  if (transition.refresh) {
    seedRenewalHolds(beforeView, afterModel, buildParliamentView(afterModel, viewer, after.players));
  }
}

/**
 * A NEW sitting drops the old holds — called FIRST in the apply block (before the reward ledger seeds the holds of
 * this very response: the soft gates bring the sitting's key and its records in ONE response, so a reset run after
 * the ledger wiped the Career's held markers it had just set). The PHASE'S END does not (v3 В1): this very block
 * carries the sitting's data away, and the surface still stands — latched — for its leave; the section drops the
 * holds when it unmounts after the phase. Idempotent; returns the sitting's key ('' = none).
 */
export function enterParliamentSittingHolds(after: PlayerViewModel | undefined): string {
  const key = sittingKey(phaseOf(after));
  if (key !== heldSitting) {
    if (key !== '') {
      resetParliamentHolds();
    }
    heldSitting = key;
  }
  return key;
}

/** The sitting the holds belong to — a diagnostic (the readiness probe), and the test cleanup. */
export function heldSittingKey(): string {
  return heldSitting;
}

export function resetParliamentSittingSeed(): void {
  heldSitting = '';
  liveSitting = '';
  resetParliamentHolds();
  // …and the park of a card's answer to a change of power (TR62) — it belongs to the same sitting — and what the viewer
  // has been shown of the alliance (a new game seeds it again from its first view).
  resetRulingChangeDraw();
  resetAllianceImpulse();
}
