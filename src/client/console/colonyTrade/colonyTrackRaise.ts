/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE RAISE A PLAY ALREADY MADE, PLAYED BEFORE ITS COLONY PICK OPENS (Prelude 2 P48 Early Colonization — «raise
 * all colony tracks 2 steps. Place a colony»).
 *
 * The server applies the raise synchronously in the play and only then asks where the colony goes, so the
 * placement prompt ARRIVES over the raised tracks — and carries what was raised (`SelectColonyModel.trackRaise`,
 * one `{colony, before, after}` per ACTIVE tile; an inactive tile is absent, a track at its top has
 * `before === after`). The screen tells it in the rules' order, off that marker and never off a diff of two views:
 *
 *  · THE SEED (`seedColonyTrackRaise`) — the moment the colonies frame opens for the prompt, BEFORE the grid
 *    renders: every tile of the marker is HELD at `before` (`holdColonyTracks` — the presented model reads the hold
 *    first), and the raise is OWED. A prompt whose raise this session already told (`promptId` — a reload mid-step,
 *    a re-open) seeds nothing: the tiles stand on the truth and the pick opens at once.
 *  · THE WAVE (`playOwedColonyTrackRaise`) — the ONE track mechanism (`requestColonyTrackWave`, anchors `tile`,
 *    rhythm `wave` — the RX29 law's own), waited for an idle stage first: another wave on stage (a trade, TR07) is
 *    never `finish`ed from here, its holds are not ours. Each landing releases its own tile; a track at its top
 *    charges and settles back.
 *  · THE PICK — locked while the raise is owed or playing (`colonyTrackRaiseLocksInput`), open after the last
 *    marker lands; the colony follow-up stays live through it, so the frame cannot hand the screen back under it.
 *
 * Bounded everywhere: the wait for an idle stage and the wave's own net (`TRACK_WAVE_NET_MS`) end it; `clear`
 * releases whatever is still held.
 */
import {reactive} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {ColonyTrackMove} from '@/common/parliament/colonyTrackAdvance';
import {
  colonyTrackWaveState, holdColonyTracks, registerColonyInputLock, releaseColonyTrack, requestColonyTrackWave,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';

/** The raise a colony prompt carries, with the prompt it rides — `undefined` when the prompt carries none. */
export type ColonyTrackRaise = {key: string, moves: ReadonlyArray<ColonyTrackMove>};

/** How long the raise waits for ANOTHER wave on stage to end before it plays anyway (bounded — never a gate). */
const IDLE_WAIT_MAX_MS = 9_000;

/** The session's memory of the raises already told — a reload mid-step never replays the wave. */
const STORAGE_KEY = 'tm-colony-track-raise-told';

export const colonyTrackRaiseFlow = reactive({
  /** The raise the open frame still owes (tiles held at `before`). */
  owed: undefined as ColonyTrackRaise | undefined,
  /** The wave is on stage. */
  live: false,
  /** The key of the last raise told (a probe's fact). */
  lastTold: '',
});

/**
 * THE RAISE A PROMPT CARRIES — read off the server's marker on the colony prompt itself (top level: the build a
 * play queues is asked on its own). `key` is the prompt's identity in this game (`promptId`, the colony type).
 */
export function colonyTrackRaiseOf(waitingFor: PlayerInputModel | undefined, gameId = ''): ColonyTrackRaise | undefined {
  if (waitingFor === undefined || waitingFor.type !== 'colony') {
    return undefined;
  }
  const moves = waitingFor.trackRaise;
  if (moves === undefined || moves.length === 0) {
    return undefined;
  }
  return {key: `${gameId}#${waitingFor.promptId ?? waitingFor.title}`, moves};
}

function toldKeys(): Array<string> {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Was this raise already told in this session? */
export function colonyTrackRaiseTold(key: string): boolean {
  return colonyTrackRaiseFlow.lastTold === key || toldKeys().includes(key);
}

function markTold(key: string): void {
  colonyTrackRaiseFlow.lastTold = key;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...toldKeys().filter((k) => k !== key), key].slice(-24)));
    }
  } catch {
    // A storage that refuses is a reload that replays — never an error.
  }
}

/**
 * THE SEED — the colonies frame opens for `raise`'s prompt: hold every tile at `before`, owe the wave. `false` when
 * nothing was seeded (no raise, already told, already owed). Synchronous, so the first frame of the grid paints the
 * markers where they stood.
 */
export function seedColonyTrackRaise(raise: ColonyTrackRaise | undefined): boolean {
  if (raise === undefined || colonyTrackRaiseTold(raise.key)) {
    return false;
  }
  if (colonyTrackRaiseFlow.owed?.key === raise.key || colonyTrackRaiseFlow.live) {
    return false;
  }
  holdColonyTracks(raise.moves.map((move) => ({colony: move.colony, position: move.before})));
  colonyTrackRaiseFlow.owed = raise;
  return true;
}

/** Resolve once no other wave stands on stage (or the bound passes). */
function waitWaveIdle(): Promise<void> {
  if (!colonyTrackWaveState.active) {
    return Promise.resolve();
  }
  const started = Date.now();
  // The wait has to wait: a node of the wait graph, its ceiling ending it said (`ceilingWait.ts`).
  const wait = beginCeilingWait({id: 'colony-track:wave-idle', owner: 'colonyTrackRaise', what: 'the end of the standing colony track wave', maxMs: IDLE_WAIT_MAX_MS});
  return new Promise((done) => {
    const poll = () => {
      if (!colonyTrackWaveState.active) {
        wait.met();
        done();
        return;
      }
      if (Date.now() - started > IDLE_WAIT_MAX_MS) {
        wait.ceiling();
        done();
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

/**
 * THE WAVE — play the owed raise over the tiles (the layer waits for the standing tiles itself), resolve once
 * every marker landed and was read. `false` when nothing was owed.
 */
export async function playOwedColonyTrackRaise(): Promise<boolean> {
  const raise = colonyTrackRaiseFlow.owed;
  if (raise === undefined || colonyTrackRaiseFlow.live) {
    return false;
  }
  colonyTrackRaiseFlow.live = true;
  try {
    await waitWaveIdle();
    if (colonyTrackRaiseFlow.owed !== raise) {
      // Cleared while waiting (the prompt went away): nothing to tell.
      return false;
    }
    // Another wave may have released every hold at its end — the raise re-holds its own before it plays.
    holdColonyTracks(raise.moves.map((move) => ({colony: move.colony, position: move.before})));
    markTold(raise.key);
    await requestColonyTrackWave(raise.moves.map((move) => ({colony: move.colony, before: move.before, after: move.after})),
      {anchors: 'tile', rhythm: 'wave'});
  } finally {
    for (const move of raise.moves) {
      releaseColonyTrack(move.colony);
    }
    if (colonyTrackRaiseFlow.owed === raise) {
      colonyTrackRaiseFlow.owed = undefined;
    }
    colonyTrackRaiseFlow.live = false;
  }
  return true;
}

/** The raise is owed or on stage — the colony follow-up stays live, the pick stays locked. */
export function colonyTrackRaiseLive(): boolean {
  return colonyTrackRaiseFlow.owed !== undefined || colonyTrackRaiseFlow.live;
}

/** The pick may not be answered before the raise is told (the player chooses over the raised tracks). */
export function colonyTrackRaiseLocksInput(): boolean {
  return colonyTrackRaiseLive();
}

/** The flow ended (the prompt went away, a reset): every hold of the raise released. Idempotent. */
export function clearColonyTrackRaise(): void {
  const raise = colonyTrackRaiseFlow.owed;
  if (raise !== undefined && !colonyTrackRaiseFlow.live) {
    for (const move of raise.moves) {
      releaseColonyTrack(move.colony);
    }
    colonyTrackRaiseFlow.owed = undefined;
  }
}

// The raise is a scene beat while it is OWED too (the wave's own hold covers the glide): what waits for a quiet
// screen waits for the tiles to reach the truth. Notification-only — a decision never waits on a story.
registerAnimationHoldSupplier('colony-track-raise', () => colonyTrackRaiseFlow.owed !== undefined && !colonyTrackRaiseFlow.live,
  {scope: 'notification-only', expire: expireColonyTrackRaise});

/**
 * THE OWNER'S RECOVERY for the `colony-track-raise` hold: a raise OWED and never played (nobody asked for the wave)
 * is told without its wave — marked told (a re-open never re-seeds it) and cleared through `clearColonyTrackRaise`,
 * so the tiles stand on the raised truth and the pick unlocks. A raise already on stage is the wave's (its own net).
 */
function expireColonyTrackRaise(): void {
  const raise = colonyTrackRaiseFlow.owed;
  if (raise === undefined || colonyTrackRaiseFlow.live) {
    return;
  }
  console.warn(`[colony-track-raise] owed raise ${raise.key}: outlived its ceiling — ended`);
  markTold(raise.key);
  clearColonyTrackRaise();
}

// The pad is the wave's from the seed: a press before the first marker moves could only answer the pick early.
registerColonyInputLock(colonyTrackRaiseLocksInput);
