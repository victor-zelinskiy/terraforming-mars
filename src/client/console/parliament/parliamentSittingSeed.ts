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
 * WHAT IS DETECTED (pure, against two views of the same sitting):
 *  · THE BARRIER OPENED — `before` stood at the verdict (`winner` /
 *    `assembly`), `after` is past it: the enactment's holds — the table as it
 *    was voted (`heldSlots` + the winner's slot), the Agenda move not yet
 *    made, the support not yet seated, the delegates not yet home, the OLD
 *    government (card · ruling party · quest) — and, when the same response
 *    already refreshed the area (a resolution that asks nothing), the
 *    renewal's holds on top;
 *  · THE REFRESH ARRIVED — `before` stood in the effects, `after` past them:
 *    the renewal's holds (the losers' table kept, the fresh faces hidden, the
 *    neutral cubes not yet seated, the lobby not yet refilled).
 * A first view (no `before`) or a new generation seeds NOTHING: a reload has
 * no old state to move from — it lands in the final poses.
 *
 * The holds are MODULE state (they outlive the section — a collapsed or a
 * yielded sitting resumes its walk with them); a new sitting drops what the
 * old one still held. Reduced motion holds nothing: the poses are final.
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {buildParliamentView, ParliamentViewVm} from './consoleParliamentModel';
import {preloadResolutionArt} from './parliamentArtTier';
import {parliamentHolds, resetParliamentHolds} from './parliamentDisplayHolds';
import {returningInstances} from './sittingBeats';
import {verdictStandsAt} from './consoleSittingFlow';

/** The sitting the holds belong to (`generation:seq`) — a new sitting drops the old holds. */
let heldSitting = '';

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

function sittingKey(phase: ParliamentPhaseModel | undefined): string {
  return phase === undefined ? '' : `${phase.generation}:${phase.summary?.seq ?? phase.generation}`;
}

const AFTER_BARRIER: ReadonlySet<string> = new Set(['agenda', 'support', 'enact', 'effects', 'refresh', 'lobby', 'adjourn', 'done']);
const AFTER_REFRESH: ReadonlySet<string> = new Set(['refresh', 'lobby', 'adjourn', 'done']);

/** What ONE response moved the sitting across — the transitions the walk has beats for. */
export type SittingTransition = {
  /** The assembly barrier opened in this response: the Agenda / support / enactment happened. */
  barrier: boolean;
  /** The voting area was refreshed in this response (the losers left, fresh cards were dealt, the lobby refilled). */
  refresh: boolean;
};

/** DETECT (pure): which transitions `after` carries relative to `before` — none across a generation or from a first view. */
export function detectSittingTransition(before: PlayerViewModel | undefined, after: PlayerViewModel): SittingTransition {
  const was = phaseOf(before);
  const now = phaseOf(after);
  if (was === undefined || now === undefined || was.generation !== now.generation) {
    return {barrier: false, refresh: false};
  }
  const barrier = verdictStandsAt(was.step) && AFTER_BARRIER.has(now.step);
  const refresh = !AFTER_REFRESH.has(was.step) && AFTER_REFRESH.has(now.step) && !now.final;
  return {barrier, refresh};
}

/**
 * WHAT THE ENACTMENT STILL HAS TO MOVE, from the table as it stood
 * (`beforeView`) to the summary's facts: the marker's move, the gained
 * support, the returned delegates, the old government behind the new one.
 */
export function seedEnactmentHolds(beforeView: ParliamentViewVm, after: ParliamentModel): void {
  const summary = after.phase?.summary;
  if (summary === undefined) {
    return;
  }
  const h = parliamentHolds;
  if (summary.agenda !== undefined && summary.agenda.to !== summary.agenda.from) {
    h.agendaAwaits = {player: summary.agenda.player, from: summary.agenda.from, to: summary.agenda.to};
  }
  for (const entry of summary.support) {
    if (entry.gained > 0) {
      h.supportIncoming.set(entry.party, (h.supportIncoming.get(entry.party) ?? 0) + entry.gained);
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
  h.questBefore = {quest: beforeView.quest, chairman: beforeView.chairman};
}

/**
 * WHAT THE RENEWAL STILL HAS TO MOVE: the fresh cards are still on the deck
 * (their faces hidden, the pile one card thicker each), their neutral votes
 * have not arrived, the parties' consumed support still shows on the
 * plaques, the free delegates are still in the reserves. IDEMPOTENT — a cube
 * already hidden adds no second support hold.
 */
export function seedRenewalHolds(after: ParliamentModel, afterView: ParliamentViewVm): void {
  const summary = after.phase?.summary;
  if (summary === undefined) {
    return;
  }
  const h = parliamentHolds;
  // A card dealt straight back from the reshuffled discard is not a fresh face (`returningInstances`).
  const returning = returningInstances(summary);
  for (const fresh of summary.refreshed) {
    if (!returning.has(fresh.instance)) {
      h.freshFaces.add(fresh.instance);
    }
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
  h.deckPending = summary.refreshed.filter((f) => !returning.has(f.instance)).length;
  // ARM TIME for the deal: a fresh card's illustration has never been painted, and its proxy turns face up in
  // the air — decode it now, while the beats before the deal play (a blank window mid-turn otherwise).
  preloadResolutionArt(summary.refreshed.filter((f) => !returning.has(f.instance)).map((f) => f.resolution));
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
  const key = sittingKey(phaseOf(after));
  if (key !== heldSitting) {
    // A NEW sitting drops the old holds. The PHASE'S END does not (v3 В1): this very block carries the
    // sitting's data away, and the surface still stands — latched — for its leave; the section drops
    // the holds when it unmounts after the phase.
    if (key !== '') {
      resetParliamentHolds();
    }
    heldSitting = key;
  }
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
  if (transition.barrier) {
    const beforeView = buildParliamentView(beforeModel, viewer, before?.players ?? after.players);
    seedEnactmentHolds(beforeView, afterModel);
  } else if (transition.refresh && parliamentHolds.heldSlots === undefined) {
    // The refresh arrived on its own (after the effects): the losers' table is kept as it stood.
    const beforeView = buildParliamentView(beforeModel, viewer, before?.players ?? after.players);
    parliamentHolds.heldSlots = beforeView.slots;
  }
  if (transition.refresh) {
    seedRenewalHolds(afterModel, buildParliamentView(afterModel, viewer, after.players));
  }
}

/** The sitting the holds belong to — a diagnostic (the readiness probe), and the test cleanup. */
export function heldSittingKey(): string {
  return heldSitting;
}

export function resetParliamentSittingSeed(): void {
  heldSitting = '';
  resetParliamentHolds();
}
