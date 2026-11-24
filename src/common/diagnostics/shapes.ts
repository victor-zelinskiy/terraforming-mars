/*
 * EVERY STALL / INTEGRITY LINE HAS A SHAPE — the one table.
 *
 * `classify.ts` says what KIND a tag is. This table says what each LINE of a stall or integrity family IS, apart from
 * its wording: a row per shape, matched on the line's FIXED WORDS, naming
 *
 *   · the shape's id (`wait-graph/ceiling`) — the head of the cause class (`cause.ts`);
 *   · which captures are STRUCTURAL (a workspace kind, a phase, a hold's label, a wait's id) — the class's tail;
 *   · which captures are DIMENSIONS (a card, an owner) — an event's tags, never part of the class;
 *   · the TIER: `defect` (an event), `planned` (counted, never an event — with the reason it is honest), `info`
 *     (evidence around an event);
 *   · what the line is an ECHO of (a door's result after the finding that asked for it): the journal folds it into
 *     that record instead of filing a second one.
 *
 * A NEW LINE IS A NEW ROW. The guard `tests/console/diagnosticsShapes.spec.ts` reads every print site of these
 * families in `src/client` and `electron`, renders its template, and fails with the LIST of sites no row matches — so
 * a reworded or a new line cannot ship filed under the wrong class, or under none (`<family>/unshaped`).
 *
 * The rows of a family are tried IN ORDER: the specific ones stand before the general one.
 *
 * Pure.
 */

import {tagOf, lineBody} from './classify';
import {DiagTier} from './DiagnosticModel';

export type DiagShape = {
  /** `<family>/<name>`. */
  id: string;
  tier: DiagTier;
  /** The line's structural words, as printed (`cause.ts` normalises them). */
  parts: ReadonlyArray<string>;
  /** What a reader slices by. */
  dims: Readonly<Record<string, string>>;
  /** The shapes this line is the echo of ('' = none): folded into the newest live record of one of them. */
  echoOf: ReadonlyArray<string>;
  /** No row matched — the guard exists so that this never ships. */
  unshaped: boolean;
};

type Read = {parts?: ReadonlyArray<string>, dims?: Record<string, string>, tier?: DiagTier, name?: string, echoOf?: ReadonlyArray<string>};

type Row = {
  /** The shape's name inside its family. */
  name: string;
  /** Over the line's BODY (the line without its tag), its first line only. */
  re: RegExp;
  tier: DiagTier;
  /** Capture groups that are parts of the class, in order. */
  parts?: ReadonlyArray<number>;
  /** dimension → its capture group. */
  dims?: Readonly<Record<string, number>>;
  /** For a row that needs more than groups: overrides what the groups gave. */
  read?: (m: RegExpExecArray, body: string) => Read;
  /** `planned` / `info`: why this line is not a defect by itself. */
  why?: string;
  echoOf?: ReadonlyArray<string>;
};

/**
 * A QUESTION WITH NO SURFACE is seen by three detectors, in this order: the leak detector's first pass (`STRANDED
 * PROMPT`), the screen director's shadow (`unserved`, three passes later) and the wait graph (`dead-end` of the
 * question's node, three ticks later). One incident is one record: the two later lines are lines of the first.
 */
const STRANDED_PROMPT: ReadonlyArray<string> = ['console-leak-detector/stranded-prompt'];

/** The wait graph's findings — what its cure lines are the echo of. */
export const WAIT_GRAPH_FINDINGS: ReadonlyArray<string> = [
  'wait-graph/cycle', 'wait-graph/dangling', 'wait-graph/dead-end', 'wait-graph/overdue', 'wait-graph/unbounded',
];

/** `key: value;` of the arbiter's line (`value` runs to the next `;` or to the ` — ` before the rung). */
function field(body: string, key: string): string {
  const m = new RegExp(`(?:^|[;:] )${key}: ([^;]*?)(?:;| — |$)`).exec(body);
  return m === null ? '' : m[1].trim();
}

/** What the PLAYER looks at instead of the board — the covers of `boardBeatsWatchable` that are the player's choice. */
export const PLAYER_BOARD_COVERS: ReadonlySet<string> = new Set(['section', 'sheet', 'workspace', 'placement']);

/**
 * ARE THESE COVERS ALL THE PLAYER's? Every one a screen of their own — and the CAMERA with them only while it serves a
 * PLACEMENT the player keeps live: the planet's focus during a placement IS that placement's view (the player is
 * choosing a cell), so `planet-focus` beside `placement` is the player's time. The camera with no placement under it
 * — its exit never finished, a story it holds — stays the game's own cover, and a bound reached under it a defect.
 * (The whole suite on CI, 2026-11-22: `console-start-held-placement` — an oxygen step parked for thirty seconds
 * behind `workspace · placement · planet-focus`, the player in their placement the whole time, filed as a defect.)
 */
export function boardCoversAreThePlayers(names: ReadonlyArray<string>): boolean {
  const placing = names.includes('placement');
  return names.length > 0 && names.every((name) => PLAYER_BOARD_COVERS.has(name) || (name === 'planet-focus' && placing));
}

/**
 * A BOARD NEVER IN VIEW, and A SITTING ON ITS WAY UP beside a SCREEN of the player's own (the story's reading ONLY —
 * never the park's own `boardCoversAreThePlayers`, and never a board the player SAW: a drain the rise covered again is
 * the game taking the board away). The sitting rises behind that screen, bounded by its own net
 * (`sittingRise.SITTING_RISE_NET_MS` — it gives the board back by itself): that it stands at the moment a story's
 * bound runs out says nothing of a leak — the window was the player's screen's. Alone the rise stays the game's cover.
 * (The autopilot's third pass in a real browser, 2026-11-24 — game 35: three scale steps parked thirty seconds behind
 * `workspace · sitting-rise`, the board not seen in one look of 119, filed as a defect.)
 */
function riseBehindThePlayersScreen(names: ReadonlyArray<string>): boolean {
  const ownScreen = names.some((name) => name === 'workspace' || name === 'section' || name === 'sheet');
  return ownScreen && boardCoversAreThePlayers(names.filter((name) => name !== 'sitting-rise'));
}

/**
 * A degraded board story's diagnose (`boardBeatPark` — `{"watchable":…, "watchableSeen":…, "coveredBy":[…]}`): was it
 * the honest wait — every cover the player's own, and the board never open long enough to be told? A line printed
 * before `coveredBy` existed answers by `watchable` alone (its old reading).
 *
 * «Never open long enough» is the DRAIN's own word, never a guess from one look: the board was not seen at all — or
 * it was seen, the drain opened (`drains` > 0) and EVERY drain ended «covered again before anything released»
 * (`coveredAgain` === `drains`) by the player's own covers (`coveredAgainBy`): the player crossed the board for less
 * than the drain's settle, which re-parks by design. A board seen with no drain opened, or a drain that neither
 * released nor was covered again, or a cover of the game's own (a sitting on its way up, the camera) is a defect. A
 * line of a build before the drain spoke (`drains` absent) keeps the stricter reading: seen = defect.
 */
export function storyCoveredByPlayer(body: string): boolean {
  if (!/"watchable":\s*false/.test(body)) {
    return false;
  }
  const covered = /"coveredBy":\s*\[([^\]]*)\]/.exec(body);
  if (covered === null) {
    return true;
  }
  const namesOf = (list: string): Array<string> => list.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter((s) => s !== '');
  const names = namesOf(covered[1]);
  const seen = /"watchableSeen":\s*true/.test(body);
  if (!boardCoversAreThePlayers(names) && !(!seen && riseBehindThePlayersScreen(names))) {
    return false;
  }
  if (!seen) {
    return true;
  }
  const drains = Number(/"drains":\s*(\d+)/.exec(body)?.[1] ?? Number.NaN);
  // SEEN, AND THE DRAIN STOOD BEHIND ITS OWN GATE AT EVERY LOOK THAT SAW THE BOARD (the board's scene settling, a
  // reveal above it, cards in transit — `noteBoardBeatDrainGated`): the player CROSSED a board whose drain could not
  // open yet, and covered it again. The gate has its own bound and its own line; the park's wait was the player's.
  if (drains === 0) {
    const seen = Number(/"looks":\s*"(\d+)\//.exec(body)?.[1] ?? Number.NaN);
    const gated = Number(/"gated":\s*(\d+)/.exec(body)?.[1] ?? Number.NaN);
    const gatedBy = /"gatedBy":\s*\[([^\]]*)\]/.exec(body);
    return gated > 0 && gated >= seen && gatedBy !== null && namesOf(gatedBy[1]).length > 0;
  }
  const again = Number(/"coveredAgain":\s*(\d+)/.exec(body)?.[1] ?? Number.NaN);
  const againBy = /"coveredAgainBy":\s*\[([^\]]*)\]/.exec(body);
  if (!(drains > 0) || again !== drains || againBy === null) {
    return false;
  }
  return boardCoversAreThePlayers(namesOf(againBy[1]));
}

/** The node ids of a wait-graph finding's member list (`id (owner: detail) · id (owner)`), sorted — a cycle has no first member. */
function waitMembers(list: string): Array<string> {
  return list.split(' · ').map((m) => m.trim().split(' ')[0]).filter((id) => id !== '').sort();
}

/**
 * THE ARBITER'S LINE (`supervisorController.ts` `checkLiveness`):
 * `stall (<reason>): Ns without progress, P presses; asked: <type>; task: <kind>; top: <kind:phase>; holder: <who>;
 *  beat: …; stranded: …; last in flight: …; claim: <host>/<card> [kinds] <stage> (…); holds: … — rung i: …`.
 * The class is `liveness/stall/<reason>/<task>/<top>/<holder>`; a line written before `task` / `top` / `holder`
 * existed reads `asked` and its beat.
 */
function readLivenessStall(m: RegExpExecArray, body: string): Read {
  const asked = field(body, 'asked');
  const task = field(body, 'task');
  const top = field(body, 'top');
  const beat = field(body, 'beat');
  const holder = field(body, 'holder');
  const stranded = field(body, 'stranded');
  const claim = field(body, 'claim');
  const where = top !== '' ? top : (beat !== '' && beat !== 'none' ? beat : 'board');
  const who = holder !== '' ? holder : (stranded !== '' && stranded !== 'no' ? 'stranded' : (beat !== '' && beat !== 'none' ? 'beat' : 'none'));
  const source = /^[^/]+\/(.+?) \[/.exec(claim)?.[1] ?? '';
  return {
    parts: [m[1], task !== '' ? task : asked, where, who],
    dims: {
      reason: m[1], asked, where, holder: who,
      ...(task !== '' ? {task} : {}),
      ...(source !== '' ? {source} : {}),
    },
  };
}

/** `[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt X, accepting, frames a;b, section s, quiet 2s, …)`. */
function readHangScreen(m: RegExpExecArray): Read {
  const desc = m[1];
  const section = /section ([^,)]*)/.exec(desc)?.[1]?.trim() ?? '';
  const frames = /frames ([^,)]*)/.exec(desc)?.[1]?.trim() ?? '';
  const top = frames === '' || frames === '-' ? 'board' : frames.split(';').pop() ?? 'board';
  return {
    parts: [section === '' || section === '-' ? 'unknown' : section, top],
    dims: {where: top, ...(section !== '' && section !== '-' ? {section} : {})},
  };
}

/**
 * family → its rows. Every stall / integrity family of `classify.ts` has an entry (the guard checks it).
 */
export const DIAG_SHAPES: Readonly<Record<string, ReadonlyArray<Row>>> = {
  // ── the arbiter ─────────────────────────────────────────────────────────────────────────────────────────────────
  'liveness': [
    {name: 'stall', re: /^stall \(([^)]*)\): /, tier: 'defect', read: readLivenessStall},
    {name: 'recovered', re: /^recovered after /, tier: 'info', why: 'the end of an episode — its own record is the episode'},
    {name: 'still-hold', re: /^still hold — /, tier: 'info', why: 'the motion witness names a hold; the wait graph judges it and files the finding'},
    // A screen that flips between the same few states by itself under a live question (`console/livenessOscillation.ts`).
    {name: 'oscillating', re: /^oscillating — .*; task: (\S+); top: (\S+)/, tier: 'defect', parts: [1, 2]},
  ],
  // ── a question nobody can answer (`common/inputs/promptAnswerable.ts`) — the engine's defect, named by the page ──
  'question': [
    {name: 'unanswerable', re: /^unanswerable — «([^»]*)» \((\w+)#\d*\): /, tier: 'defect', parts: [1, 2]},
  ],
  // ── the workspace's nets ────────────────────────────────────────────────────────────────────────────────────────
  'workspace-stall': [
    {name: 'ghost-forced', re: /^«([^»]*)» reported finished but could not dismiss .*\(held: ([^)]*)\)/, tier: 'defect', parts: [1, 2]},
    {name: 'beat-arbiter', re: /^beat «([^»]*)» torn down by the liveness arbiter/, tier: 'info', parts: [1], why: 'the echo of an arbiter\'s rung — the episode is the defect', echoOf: ['liveness/stall']},
    {name: 'beat-bound', re: /^beat «([^»]*)» torn down at the frame's own bound/, tier: 'defect', parts: [1]},
  ],
  'workspace-anchor': [
    {name: 'reaped', re: /^reaped a live frame of a phase that is over: (.*?) — asked: ([^;]*);/, tier: 'defect', parts: [1], dims: {asked: 2}},
    {name: 'dropped', re: /^dropped (.*) \(([^)]*)\) — its phase is over/, tier: 'planned', parts: [1, 2], why: 'the anchor rule working: an off-stage frame of a finished phase does not come back'},
  ],
  'workspace-outcome': [
    {name: 'host-gone', re: /^the claim of «([^»]*)» \((.*) \[([^\]]*)\]\) outlived its host/, tier: 'defect', parts: [1, 3], dims: {source: 2}},
    {name: 'arrival-ceiling', re: /^arrival of (.*)'s batch: outlived its ceiling/, tier: 'defect', dims: {source: 1}},
    {name: 'unregistered-zone', re: /^UNREGISTERED ZONE (\S+)/, tier: 'defect', parts: [1]},
    {name: 'claim-released-free-turn', re: /^the claim of «([^»]*)» answered for nothing over the free turn/, tier: 'defect', parts: [1]},
  ],
  'workspace-conclusion': [
    {
      name: 'level-door', re: /^«([^»]*)» left by the level door/, tier: 'info', parts: [1],
      why: 'the conclusion\'s owner acting on its own decision (`staleFreeTurnClock.observeConclusionDoor`): a finished frame over the free turn, dismissible, unread, nothing in flight for the door\'s frames — the trail of which flow left its ending to the level, never an incident',
    },
    {name: 'cadence', re: /^«([^»]*)» (.*?) on the re-ask cadence.*it last held on: (.*)$/, tier: 'defect', parts: [1, 3], dims: {how: 2}},
  ],
  'workspace': [
    {name: 'beat-expired', re: /^«([^»]*)» stood in «([^»]*)» on stage past its bound/, tier: 'defect', parts: [1, 2]},
    {name: 'beat-handler-threw', re: /^the beat-expired handler threw/, tier: 'defect'},
    {
      name: 'off-protocol', re: /^«([^»]*)» moved (\S+) → (\S+) off the frame's protocol/, tier: 'info', parts: [1, 2, 3],
      why: 'the move is made all the same (the record\'s one writer never refuses); the line is the trail, and the walks\' report holds it as `unlisted` — a decision for the protocol, not an incident',
    },
    {
      name: 'beat-rollback', re: /^«([^»]*)» goes back (\S+) → (\S+) — /, tier: 'defect', parts: [1, 2, 3],
      // THE QUESTION HAD MOVED ON (`#stale-prompt` — another seat acted while this page still showed the old question:
      // the server did not apply the answer, the page refetches and puts its frame back): the designed recovery,
      // counted. Every other refusal of an answer the page offered is a defect upstream.
      read: (_m, body) => (/\(refused: #stale-prompt\)$/.test(body) ? {tier: 'planned'} : {}),
    },
  ],
  'ws-stack': [
    {name: 'verb-trace', re: / depth=/, tier: 'info', why: 'an opt-in trace of the stack\'s verbs (`window.__wsTrace`)'},
  ],
  // ── the start, the screen ───────────────────────────────────────────────────────────────────────────────────────
  'start-stranded': [
    {name: 'confirmed', re: /^confirmed — the start serves nothing while the server asks «([^»]*)»/, tier: 'defect', parts: [1]},
    {name: 'yielded', re: /^yielded to the shell .*while the server asks «([^»]*)»/, tier: 'defect', parts: [1]},
  ],
  'start-shadow': [
    {
      // THE DIRECTOR ACTING. By LEVEL it is the door opening on a standing disagreement — a latch of the opening missed
      // its edge and the screen was wrong for the door's frames: the DEFECT's own line (the shadow's confirm, whose
      // `finding` used to be that line three seconds later, is retired — FREEZE ZERO, stage 2b → 7). By the arbiter's
      // rung it is that episode's echo.
      name: 'cure', re: /^cure «([^»]*)» by (\S+) — expected «([^»]*)», on screen «([^»]*)»/, tier: 'defect', parts: [1, 3, 4], dims: {by: 2},
      read: (m) => (m[2] === 'liveness' ? {tier: 'info'} : {}), echoOf: ['liveness/stall'],
    },
  ],
  'start-director': [
    {name: 'backwards', re: /^«([^»]*)» went backwards: (\S+) → (\S+)\./, tier: 'defect', parts: [1, 2, 3]},
  ],
  'screen-shadow': [
    {name: 'cure-plan', re: /^cure-plan «([^»]*)» by (\S+)/, tier: 'info', parts: [1], why: 'a dry-run plan filed beside its finding', echoOf: ['screen-shadow/finding']},
    {
      name: 'cure', re: /^cure «([^»]*)» by (\S+) for /, tier: 'defect', parts: [1], dims: {by: 2},
      read: (m) => (m[2] === 'liveness' ? {tier: 'info'} : {}), echoOf: ['liveness/stall', 'screen-shadow/finding'],
    },
    {
      name: 'finding', re: /^(unserved|misserved) — expected «([^»]*)», on screen «([^»]*)» for «([^»]*)»/, tier: 'defect', parts: [1, 2, 3],
      read: (m) => (m[1] === 'unserved' ? {echoOf: STRANDED_PROMPT} : {}),
    },
  ],
  'console-leak-detector': [
    {name: 'covered-prompt', re: /^COVERED PROMPT: waitingFor "([^"]*)" \(task kind "([^"]*)"\)/, tier: 'defect', parts: [2], dims: {asked: 1}},
    {name: 'stranded-prompt', re: /^STRANDED PROMPT: waitingFor "([^"]*)" \(task kind "([^"]*)"\)/, tier: 'defect', parts: [2], dims: {asked: 1}},
    {name: 'batch-overlap', re: /^BATCH OVERLAP:/, tier: 'defect'},
  ],
  'console-foreground-watchdog': [
    {name: 'quarantined', re: /^the foreground claimed to be busy with NOTHING rendered — QUARANTINED \([^)]*\) (.*) \(claims at the time/, tier: 'defect', parts: [1]},
    {name: 'expired', re: /^the foreground claimed to be busy with NOTHING rendered — expired (.*) \(claims at the time/, tier: 'defect', parts: [1]},
  ],
  // ── the wait graph ──────────────────────────────────────────────────────────────────────────────────────────────
  'wait-graph': [
    {
      name: 'ceiling', re: /^ceiling (\S+) \(((?:[^:)]|:(?! ))*)(?:: [^)]*)?\) — «(.*)» did not come in /, tier: 'defect', parts: [1], dims: {owner: 2},
      // A wait that DECLARES its ceiling as its honest end says so in its line (`CeilingWaitSpec.planned`).
      read: (_m, body) => (/ \(planned: [^)]*\)$/.test(body) ? {tier: 'planned'} : {}),
    },
    {name: 'cure', re: /^cure (\S+) at (\S+) through «([^»]*)» — /, tier: 'info', parts: [1, 3], why: 'what the finding\'s door did — a line of the finding', echoOf: WAIT_GRAPH_FINDINGS},
    {name: 'cure-no-door', re: /^cure (\S+) — (\S+) has no door/, tier: 'info', parts: [1], why: 'a finding with no door — a line of the finding', echoOf: WAIT_GRAPH_FINDINGS},
    {name: 'cure-door-idle', re: /^cure (\S+) — the door «([^»]*)» of (\S+) had nothing to do/, tier: 'info', parts: [1, 2], why: 'a line of the finding', echoOf: WAIT_GRAPH_FINDINGS},
    {name: 'cure-cycle-stuck', re: /^cure (\S+) — no member's door could yield/, tier: 'info', parts: [1], why: 'a line of the finding', echoOf: WAIT_GRAPH_FINDINGS},
    {name: 'door-threw', re: /^door «([^»]*)» threw on (\S+)/, tier: 'defect', parts: [1]},
    {name: 'source-threw', re: /^source «([^»]*)» threw/, tier: 'defect', parts: [1]},
    {
      name: 'finding', re: /^(cycle|dangling|dead-end|overdue|unbounded) (.*?) — /, tier: 'defect',
      read: (m) => {
        const members = waitMembers(m[2]);
        // A dead end of the QUESTION's own node is the stranded prompt, seen by the graph.
        const stranded = m[1] === 'dead-end' && members.length === 1 && members[0].startsWith('question:');
        return {name: m[1], parts: members, ...(stranded ? {echoOf: STRANDED_PROMPT} : {})};
      },
    },
  ],
  // ── holds, stories, hand-overs ──────────────────────────────────────────────────────────────────────────────────
  'animation-hold': [
    {
      name: 'ceiling', re: /^"([^"]*)" held for over \S+ — force-released by the safety ceiling/, tier: 'defect', parts: [1],
      // A hold whose ceiling came on a page that painted nothing says so (`kernel/frameWitness.ts`) — its honest end.
      read: (_m, body) => (/ \(planned: [^)]*\)/.test(body) ? {tier: 'planned'} : {}),
    },
    {name: 'recovery-threw', re: /^the "([^"]*)" owner recovery threw/, tier: 'defect', parts: [1]},
    {name: 'supplier-threw', re: /^supplier "([^"]*)" threw/, tier: 'defect', parts: [1]},
  ],
  'screen-handoff': [
    {name: 'ceiling', re: /^«([^»]*)» took the screen after \S+ ms with the player still owed: (.*?) \(holds:/, tier: 'defect', parts: [1, 2]},
  ],
  'presentation-ledger': [
    {
      name: 'story-due', re: /^story «([^»]*)» degraded after \S+ — the release edge never came/, tier: 'defect', parts: [1],
      // A story that waited for a board the PLAYER kept covered degrades by design (the honest multiplayer wait) — and
      // only that: the board never watchable in the whole window, covered only by what the player looks at. A board
      // seen and not told, or covered by the game's own scene (a sitting on its way up, the camera), is a defect
      // (the tier audit of 2026-11-18, row 1). A line from a build before `coveredBy` keeps the old reading.
      // …and a story that came due on a page that did not PAINT (`presentationLedger` asks the frame witness over the
      // story's own window — behind another window, a hidden tab): the scene that releases it runs on frames.
      read: (_m, body) => (/ \(planned: [^)]*\)$/.test(body) || storyCoveredByPlayer(body) ? {tier: 'planned'} : {}),
    },
    {name: 'story-degraded-by', re: /^story «([^»]*)» degraded by (.*?) after /, tier: 'info', parts: [1], dims: {by: 2}, why: 'the echo of a rung / a door — the episode or the finding is the defect', echoOf: ['liveness/stall', ...WAIT_GRAPH_FINDINGS]},
    {name: 'witness-heal', re: /^witness «([^»]*)» healing — the lie outlived its grace/, tier: 'defect', parts: [1]},
    {name: 'hook-threw', re: /^(degrade|ready\(\)|telling\(\)|redrive|heal) of «([^»]*)» failed/, tier: 'defect', parts: [1, 2]},
    {name: 'witness-threw', re: /^witness «([^»]*)» failed/, tier: 'defect', parts: [1]},
  ],
  'notifications': [
    {name: 'starvation', re: /queued event\(s\) held behind an ANIMATION hold .*\(leaked hold: (.*)\)$/, tier: 'defect', parts: [1]},
    {
      name: 'starvation-succession', re: /queued event\(s\) held behind an ANIMATION hold .*\(planned: a succession of scenes[^)]*\)$/, tier: 'planned',
      why: 'the queue stood its bound behind a CHAIN of scenes, and no standing hold has itself stood that long (each says its age): nothing leaked — every hold keeps its own ceiling as its leak line',
    },
    {
      name: 'starvation-page', re: /queued event\(s\) held behind an ANIMATION hold .*\(planned: [^)]*\)$/, tier: 'planned',
      why: 'the page is not painting (`frameWitness.pageStarvedNow` — behind another window, a hidden tab): no animation ends there, so the delivery at the bound is the designed mode and no hold leaked',
    },
    {
      name: 'starvation-owned', re: /queued event\(s\) held behind an ANIMATION hold .*\(the holds wait for the player: ([^:)]*)/, tier: 'planned', parts: [1],
      why: 'every hold behind the queue says it waits on the player (`AnimationHoldOptions.heldForPlayer`): the delivery at the bound is the designed degraded mode',
    },
    {name: 'correlation-ceiling', re: /^correlation \S+ stayed open for over .* — held by (.*)$/, tier: 'defect', parts: [1]},
    {
      name: 'correlation-player', re: /^correlation \S+ has stood open for over .* — still holding its prepared notification \(planned: the chain waits for a player/, tier: 'planned',
      why: 'the server names a player\'s prompt as the chain\'s only holder: a question asked inside the action is that player\'s time — the card stays held (released half-told it would freeze) and the ceiling only says so',
    },
    {name: 'unclassified-variant', re: /^variant '([^']*)' has no feed-relevance classification/, tier: 'defect', parts: [1]},
    {name: 'band-no-cause', re: /^band with no nameable cause:/, tier: 'defect'},
  ],
  'deferred-refresh': [
    {name: 'overdue', re: /^the screen stayed busy for over \d+ms — refreshing anyway(?: — held by (\S+))?/, tier: 'defect', parts: [1]},
    // A scene flag that held the view for a scene's whole legal life: the view is committed over it (`VIEW_SCENE_HOLD_MAX_MS`).
    {name: 'overruled', re: /^«([^»]*)» held the view for over \d+ms — the view is committed over it/, tier: 'defect', parts: [1]},
  ],
  // ── the transport, the kernel ───────────────────────────────────────────────────────────────────────────────────
  // ── the last line (`console/session/sessionRebuild.ts`) — never a cure: every one of them is a defect ──────────────
  'session-rebuild': [
    {name: 'page', re: /^page — «([^»]*)» \(.*?\) — by (\S+): /, tier: 'defect', parts: [1], dims: {by: 2}},
    {name: 'refused-again', re: /^refused \(again\) — «([^»]*)» \(.*?\) stands unserved after the page was rebuilt for it — by (\S+): /, tier: 'defect', parts: [1], dims: {by: 2}},
    {name: 'refused-rate', re: /^refused \(rate\) — «([^»]*)» \(.*?\) stays as it stands: the window of rebuilds is full — by (\S+): /, tier: 'defect', dims: {source: 1, by: 2}},
    {name: 'refused-off', re: /^refused \(off\) — «([^»]*)» \(.*?\) stays as it stands: the last line is switched off /, tier: 'info', parts: [1], why: 'the line is switched off on purpose (`?rebuild=0`: a control spec, a diagnosis) — the episode it stands in is the defect'},
  ],
  // ── the view's road (`App.viewFailed`): a fetch that failed is the network's word — a throw of the apply is the
  //    last line's (`session-rebuild/page/view-apply`) ──
  'view': [
    {name: 'fetch-failed', re: /^fetch failed — /, tier: 'info', why: 'the network\'s word, not the page\'s: nothing was applied, the poll re-asks and owns the «cannot contact the server» alert'},
  ],
  'transport': [
    {name: 'poll-answer', re: /^the poll's answer could not be taken — /, tier: 'info', why: 'what the chain did with a throw — the exception reported beside it (`reportDiagnosticError`, with its stack) is the defect'},
    {name: 'poll-never-ended', re: /^the poll never ended — /, tier: 'defect'},
    {name: 'gate-bound', re: /^gate «([^»]*)» of \S+ outlived its bound/, tier: 'defect', parts: [1]},
    {name: 'abandoned', re: /^\S+ abandoned — its presentation never ended/, tier: 'defect'},
    {name: 'server-silent', re: /^the server did not answer the submit for /, tier: 'defect'},
    {name: 'refused-busy', re: /^submit refused — \S+ is (\S+) for /, tier: 'info', parts: [1], why: 'a press into a busy funnel: the ticket says `accepted: false` and the caller puts back what it armed'},
    {name: 'threw-after-end', re: /^\S+ threw after its end/, tier: 'defect'},
    {name: 'listener-threw', re: /^a (settle|ticket) listener threw/, tier: 'defect', parts: [1]},
    {name: 'unwind-threw', re: /^the unwind «([^»]*)» threw after an unlanded press/, tier: 'defect', parts: [1]},
    {name: 'reload', re: /^reload — /, tier: 'info', why: 'the product announces a reload it is about to make — the harness names it'},
  ],
  'flow': [
    {name: 'bound-run', re: /^bound (\S+) — the run did not end in /, tier: 'defect', parts: [1]},
    {name: 'bound-wait', re: /^bound (\S+) — «(.*)» did not come in /, tier: 'defect', parts: [1, 2]},
    {name: 'cycle-refused', re: /^cycle refused (.*?) — «/, tier: 'defect', parts: [1]},
    {name: 'law-refused', re: /^(\S+) — LAW — /, tier: 'defect', parts: [1]},
    {
      // `flowAnomaly`: `<scope> — <what threw, in a few words>` — the scope and the words outside the quotes.
      name: 'anomaly', re: /^(\S+) — (.*)$/, tier: 'defect',
      read: (m) => ({parts: [m[1], m[2].replace(/«[^»]*»/g, '').replace(/\([^)]*\)/g, '').split(' — ')[0]]}),
    },
  ],
  'mandatory-gate': [
    {name: 'overdue', re: /^the first presentation of «([^»]*)» did not come in its bound/, tier: 'defect', parts: [1]},
    {name: 'door-threw', re: /^the plate's door threw/, tier: 'defect'},
    {name: 'door', re: /^the plate's door — /, tier: 'info', why: 'what the plate\'s door did — a line of its overdue', echoOf: ['mandatory-gate/overdue', ...WAIT_GRAPH_FINDINGS]},
  ],
  'teleport': [
    {name: 'stranded', re: /^stranded — (.*) absent for /, tier: 'defect', parts: [1]},
    {name: 'target-absent-waits', re: /^target (.*) is not in the document — the content waits/, tier: 'planned', parts: [1], why: 'law 1 of the teleport: nothing mounts into nothing, the content waits for its target'},
  ],
  'scene-transition': [
    {name: 'never-armed', re: /^destination never armed/, tier: 'defect'},
    {name: 'hold-bound', re: /^hold "([^"]*)" hit its \S+ bound/, tier: 'defect', parts: [1]},
    {name: 'callback-threw', re: /^onSceneRevealed callback failed/, tier: 'defect'},
  ],
  'cursor': [
    {name: 'backstop', re: /^«([^»]*)» never signalled ready in /, tier: 'defect', parts: [1]},
  ],
  'realtime': [
    {name: 'listener-threw', re: /^wake listener failed/, tier: 'defect'},
  ],
  // ── the main process's watch over the renderer ──────────────────────────────────────────────────────────────────
  'renderer-hang': [
    {name: 'unresponsive', re: /^the page stopped answering — the last screen \((.*)\)$/, tier: 'defect', read: readHangScreen},
    {name: 'restart', re: /^still not answering after \S+ — the renderer is restarted/, tier: 'info', why: 'a step of the stop\'s own episode', echoOf: ['renderer-hang/unresponsive']},
    {name: 'recovered', re: /^the page answers again after (\d+)s/, tier: 'info', why: 'the end of the stop\'s episode'},
    {name: 'process-gone', re: /^the renderer process is gone \(([^,]*), exit /, tier: 'defect', parts: [1]},
    {name: 'reload-budget-spent', re: / — NOT reloaded: \S+ reloads in /, tier: 'defect'},
    {name: 'trace-written', re: /^trace of the stop \(.*\): (.*) — open it in /, tier: 'info', dims: {trace: 1}, why: 'names the trace file — a line of the stop', echoOf: ['renderer-hang/unresponsive']},
    {name: 'trace-failed', re: /^(?:the trace could not start|old traces could not be pruned|the trace \(.*\) could not be written)/, tier: 'info', why: 'the tracing tool failed — nothing of the game did'},
  ],
  // ── INTEGRITY ───────────────────────────────────────────────────────────────────────────────────────────────────
  'transfer': [
    {name: 'end-not-painted', re: /^end not painted — the (\S+) of ([^:\s]+):([^\s@]+)/, tier: 'defect', parts: [1, 2, 3]},
    {name: 'surface-folded', re: /^surface folded under its token — the (\S+) of ([^:\s]+):([^\s@]+)/, tier: 'defect', parts: [1, 2, 3]},
    {name: 'painted-under', re: /^token painted under (\S+) at the (\S+)/, tier: 'defect', parts: [1, 2]},
    {name: 'told-twice', re: /^told twice — .*?: (\S+) tells it; (\S+) reached for it too/, tier: 'defect', parts: [1, 2]},
    {
      name: 'frame-left-holding', re: /^a frame left with tokens on its surface — «([^»]*)»/, tier: 'defect', parts: [1],
      // The fold witnessed where it happens (`witnessFrameLeft`): on a page that PAINTS — the law of the fold broken,
      // with the verb in the line; on a page that does not paint (the line says so) no flight was ever started — that
      // page's honest end.
      read: (_m, body) => (/ \(planned: [^)]*\)$/.test(body) ? {tier: 'planned'} : {}),
    },
    {name: 'no-visible-end', re: /^no visible (\S+) — /, tier: 'planned', parts: [1], why: 'the law of visible ends: a covered end is not flown, its counter ticks with its chip'},
  ],
  // ── «this cannot happen, and it did» (`client/diagnostics/invariant.ts`): one class per invariant id ──────────────
  'invariant': [
    {name: 'broken', re: /^(\S+) — /, tier: 'defect', parts: [1]},
  ],
  // ── a module's own net ended a wait (`client/diagnostics/netEnded.ts`): one class per net, counted until judged ───
  'net-ended': [
    {name: 'ended', re: /^(\S+) — /, tier: 'info', parts: [1], why: 'a waiting room: the matrix counts it and the walk is read — it leaves as a ceiling wait of the graph (a defect on a page that painted) or as a designed fallback with its reason'},
  ],
  'reactivity': [
    {name: 'latch-healed', re: /^«([^»]*)» changed without a reactive edge/, tier: 'defect', parts: [1]},
  ],
  'reaction-identity': [
    {name: 'foreign-face', re: /^foreign face — (\S+?): (.*?)(?: at \S+)? \(/, tier: 'defect', parts: [1], dims: {source: 2}},
  ],
  'discard-count': [
    {name: 'released-under', re: /^released under its count owner=(\S+) /, tier: 'defect', parts: [1]},
  ],
  'reading': [
    {name: 'raw-template', re: /^RAW TEMPLATE on screen:.* — key «([^»]*)»/, tier: 'defect', parts: [1]},
  ],
  'console-preselect': [
    {name: 'reasked', re: /^RE-ASKED PRE-SELECT: the (.*) was answered in the batch/, tier: 'defect', parts: [1]},
    {name: 'post-commit', re: /^POST-COMMIT CHOICE: the (\S+) of (.*) is asked after the commit/, tier: 'defect', parts: [1], dims: {source: 2}},
  ],
};

/** A line of a family with no row at all, or one no row matched: filed by its family, never silently merged. */
function unshaped(family: string): DiagShape {
  return {id: `${family}/unshaped`, tier: 'defect', parts: [], dims: {}, echoOf: [], unshaped: true};
}

/**
 * The shape of one line (its first line is read). `family` is the line's tag (`classify.ts`); a line of a family the
 * table does not hold is `<family>/unshaped`.
 */
export function shapeOf(text: string, family: string = tagOf(text) ?? ''): DiagShape {
  const rows = DIAG_SHAPES[family];
  if (rows === undefined) {
    return unshaped(family);
  }
  const body = lineBody(text.split('\n')[0]);
  for (const row of rows) {
    const m = row.re.exec(body);
    if (m === null) {
      continue;
    }
    const read = row.read?.(m, body) ?? {};
    const dims: Record<string, string> = {};
    for (const [key, group] of Object.entries(row.dims ?? {})) {
      const value = (m[group] ?? '').trim();
      if (value !== '') {
        dims[key] = value.slice(0, 120);
      }
    }
    Object.assign(dims, read.dims ?? {});
    return {
      id: `${family}/${read.name ?? row.name}`,
      tier: read.tier ?? row.tier,
      parts: read.parts ?? (row.parts ?? []).map((group) => m[group] ?? ''),
      dims,
      echoOf: read.echoOf ?? row.echoOf ?? [],
      unshaped: false,
    };
  }
  return unshaped(family);
}

/** Every shape id the table can produce by a row's own name (a `read` that renames adds its own — the findings). */
export function declaredShapeIds(): Array<string> {
  const ids: Array<string> = [];
  for (const [family, rows] of Object.entries(DIAG_SHAPES)) {
    for (const row of rows) {
      ids.push(`${family}/${row.name}`);
    }
  }
  return ids;
}

/** The rows that are not defects, each with its reason — what the guard requires a reason for. */
export function quietRows(): Array<{id: string, tier: DiagTier, why: string | undefined}> {
  const out: Array<{id: string, tier: DiagTier, why: string | undefined}> = [];
  for (const [family, rows] of Object.entries(DIAG_SHAPES)) {
    for (const row of rows) {
      if (row.tier !== 'defect') {
        out.push({id: `${family}/${row.name}`, tier: row.tier, why: row.why});
      }
    }
  }
  return out;
}
