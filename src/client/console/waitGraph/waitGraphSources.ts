/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WAIT GRAPH's SOURCES BY CONSTRUCTION (Э4 — docs/claude/console/wait-graph.md): the registries every presentation
 * wait already goes through enter the graph on their own — a new hold, a new ledger story, the board-beat park are
 * nodes the moment they stand, with their since, their bound and their owner's door. Nobody has to remember to declare
 * them: a mechanism that registers with its registry is in the graph.
 *
 *  - `hold:<label>`   — every animation hold (supplier or manual): its ceiling is its bound, its `expire` its door;
 *  - `story:<id>`     — every owed presentation-ledger story: its due is its bound, its degrade its door;
 *  - `park:board-beat` — the board-beat park: it waits for a board the player can see — the frame covering it (an edge
 *                        to that frame's surface when the frame stands past its commit), its 30 s safety its bound.
 *
 * Registered at import (the shell imports this module once). Doors: `hold-expire`, `story-degrade`, `park-release`.
 */
import {activeAnimationHoldWaits, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {degradePresentationStory, presentationLedgerSnapshot} from '@/client/console/presentationLedger';
import {boardBeatParkPending, releaseBoardBeatPark} from '@/client/console/boardBeatPark';
import {workspaceStackTop} from '@/client/console/consoleWorkspaceStack';
import {isTransientBeat} from '@/client/console/workspaceBeatStall';
import {registerWaitRecovery, registerWaitSource, WaitNodeInput} from '@/client/console/waitGraph/waitGraph';
import {WaitTarget} from '@/client/console/waitGraph/waitGraphModel';

/** The board-beat park's own safety (`BOARD_BEAT_PARK_SAFETY_MS`) — its bound in the graph. */
const PARK_BOUND_MS = 30_000;

/** The holds standing now — one node each, keyed by label. */
export function holdWaitNodes(): Array<WaitNodeInput> {
  const now = Date.now();
  return activeAnimationHoldWaits().map((h) => ({
    id: `hold:${h.label}`, family: 'hold' as const, owner: `hold:${h.label}`,
    since: Math.min(h.since, now), targets: [{kind: 'motion', what: h.label}] as Array<WaitTarget>,
    boundMs: h.maxHoldMs, recovery: 'hold-expire', detail: h.scope,
  }));
}

/** The ledger stories owed now — one node each. */
export function storyWaitNodes(): Array<WaitNodeInput> {
  const now = Date.now();
  return presentationLedgerSnapshot().stories.map((st) => ({
    id: `story:${st.id}`, family: 'story' as const, owner: 'presentationLedger',
    since: now - st.ageMs, targets: [{kind: 'motion', what: st.why || st.id}] as Array<WaitTarget>,
    boundMs: st.dueMs, recovery: 'story-degrade',
  }));
}

/** The board-beat park — waiting for the board the covering frame hides. */
export function parkWaitNodes(): Array<WaitNodeInput> {
  if (!boardBeatParkPending()) {
    return [];
  }
  const top = workspaceStackTop();
  // The frame past its commit / in a beat is a node of the shell's source (`surface:<kind>`); a frame the player is
  // browsing leaves when the player does; no frame — the board is only settling.
  const targets: Array<WaitTarget> = top !== undefined && (top.phase === 'committed' || isTransientBeat(top.phase)) ?
    [{kind: 'node', id: `surface:${top.kind}`}] :
    top !== undefined ? [{kind: 'player', what: `leave «${top.kind}» for the board`}] :
      [{kind: 'motion', what: 'the board becomes watchable'}];
  return [{id: 'park:board-beat', family: 'park', owner: 'boardBeatPark', targets, boundMs: PARK_BOUND_MS, recovery: 'park-release'}];
}

/** Register the construction sources and their doors (idempotent by name). Returns the unregisters. */
export function registerConstructionWaitSources(): Array<() => void> {
  return [
    registerWaitSource('holds', holdWaitNodes),
    registerWaitSource('stories', storyWaitNodes),
    registerWaitSource('park', parkWaitNodes),
    registerWaitRecovery('hold-expire', (node) => (expireAnimationHoldNow(node.id.slice('hold:'.length)) ? 'the hold ended through its owner\'s recovery' : '')),
    registerWaitRecovery('story-degrade', (node) => (degradePresentationStory(node.id.slice('story:'.length), 'the wait graph') ? 'the story degraded honestly' : '')),
    registerWaitRecovery('park-release', () => {
      releaseBoardBeatPark();
      return 'the park released (snap + standalone reveal)';
    }),
  ];
}
