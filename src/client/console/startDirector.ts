/*
 * startDirector — «правда сервера → одно состояние → один владелец экрана» for the GAME START (the owner, 2026-10-29).
 *
 * The start flow's screen is decided today by a dozen independent latches (the room / shelf releases, the seat
 * chain, the first-action stage machine, the yields) plus enumerated «may the next stage start» predicates. Each is
 * right on its own and a chain nobody thought of walks between them — the PL-1110 «Наследие» miss and the field hang
 * of 2026-10-28 (Strategic Base Planning → Triton) are one class.
 *
 * This module states the OTHER way to ask: the server asks a player exactly one thing at a time, so WHO must serve
 * the screen is a pure function of that one question (`expectedStartOwner`). Phase 0 is SHADOW MODE: the shell
 * computes it beside the latches, reads what the latches actually put on screen (`actualStartOwner`) and only LOGS
 * a sustained disagreement (`[start-shadow]`) — nothing on screen changes. Every finding is either a bug of the
 * latch machinery or a hole of this table; both are what the migration needs before a single latch is replaced.
 *
 * Pure: no Vue, no DOM — the server runner tests it (`tests/console/startDirector.spec.ts`).
 */
import type {StartGamePromptMeta} from '@/common/models/PlayerInputModel';
import type {StartServes} from '@/client/console/startServing';

/** Who must serve the screen during the start flow. */
export type StartOwner =
  /** Nothing is asked of the viewer (another seat moves) — any calm pose of the scene is right. */
  | 'waiting'
  /** The pre-game wizard (corporation · preludes · projects · summary). */
  | 'wizard'
  /** A deployment item of the queue (play / pay a corporation, a prelude, a merger, the campaign bonus / legacy). */
  | 'queue'
  /** The corporation's mandatory opening move — the start's own stage. */
  | 'firstAction'
  /** A granted bonus action («Фора») — the start's own stage. */
  | 'bonusAction'
  /** A server placement — the board. */
  | 'board'
  /** A follow-up of a deployment item (a colony, a hand pick, a deck pick, a payment, an effect decision…) —
   *  a step INSIDE the start, or a surface of the shell's own when the start cannot host it. */
  | 'step'
  /** The game proper has begun — the start scene has no business on screen. */
  | 'game';

/** What the latch machinery has on screen right now. `beat` / `parked` are never judged. */
export type ActualStartOwner = StartOwner | 'none' | 'shell' | 'beat' | 'parked';

/** The ONE question, as plain facts (the shell reads them off the applied view). */
export type StartTruth = {
  /** `undefined` = nothing is asked of the viewer. */
  prompt: undefined | {
    type: string,
    startKind?: StartGamePromptMeta['kind'],
    /** The server's `bonusActionPrompt` marker. */
    bonusAction: boolean,
    /** The ordinary action menu (`isActionMenuTitle` — the one sanctioned title check). */
    actionMenu: boolean,
    /** The task router's kind, when it classifies the prompt. */
    task?: string,
  },
  /** Generation 1 IS the start of the game (`corpFirstActionInStartFlow`). */
  generation: number,
};

export function expectedStartOwner(t: StartTruth): StartOwner {
  const p = t.prompt;
  if (p === undefined) {
    return 'waiting';
  }
  if (p.task === 'initialDraft' || p.type === 'initialCards') {
    return 'wizard';
  }
  if (p.startKind === 'corporationInitialAction') {
    return t.generation === 1 ? 'firstAction' : 'step';
  }
  if (p.startKind !== undefined) {
    return 'queue';
  }
  if (p.bonusAction) {
    return 'bonusAction';
  }
  if (p.actionMenu) {
    return 'game';
  }
  if (p.type === 'space') {
    return 'board';
  }
  return 'step';
}

/** Is this owner one only the start scene can be (its absence is a finding even with the scene unmounted)? */
export function startOwnsOwner(owner: StartOwner): boolean {
  return owner === 'wizard' || owner === 'queue' || owner === 'firstAction' || owner === 'bonusAction';
}

export type ActualStartSignals = {
  /** The start frame is mounted (the stack). */
  mounted: boolean,
  /** The scene paints (`startSceneVisible`). */
  visible: boolean,
  /** The scene's own answer (`data-start-serves`). */
  serves: StartServes | undefined,
  /** The first-action stage machine is past `idle` (so a `stage` serve is the first action, else the bonus). */
  firstActStage: boolean,
  /** A server placement is live on the board. */
  placementLive: boolean,
  /** A prompt surface stands over / inside the scene (`startPromptSurfaceStands` / a standalone band). */
  promptSurface: boolean,
  /** The watchdog handed the screen to the shell (`startStrandYield`). */
  strandYield: boolean,
  /** The player minimized the task («свернуть») — whatever stands is the player's own choice. */
  parked: boolean,
};

export function actualStartOwner(s: ActualStartSignals): ActualStartOwner {
  if (s.placementLive) {
    return 'board';
  }
  if (!s.mounted) {
    return 'game';
  }
  if (s.parked) {
    return 'parked';
  }
  if (!s.visible) {
    // A paint-only yield with nothing standing for it is a bounded beat (the placement's completion chain, the scale
    // glide) — the strand watchdog owns the case where it is not.
    return s.promptSurface || s.strandYield ? 'shell' : 'beat';
  }
  if (s.promptSurface) {
    return 'step';
  }
  switch (s.serves) {
  case 'wizard': return 'wizard';
  case 'step':
  case 'outcome': return 'step';
  case 'stage': return s.firstActStage ? 'firstAction' : 'bonusAction';
  case 'risk':
  case 'queue': return 'queue';
  case 'beat': return 'beat';
  case 'yielded': return 'beat';
  default: return 'none';
  }
}

/** Do the two agree? `beat` / `parked` are never judged; a step may be served by the start or by the shell. */
export function startOwnersAgree(expected: StartOwner, actual: ActualStartOwner): boolean {
  if (actual === 'beat' || actual === 'parked') {
    return true;
  }
  switch (expected) {
  case 'waiting': return true;
  case 'step': return actual === 'step' || actual === 'shell';
  default: return actual === expected;
  }
}

/**
 * Is the comparison IN SCOPE at all? The shadow judges the start flow only: while the scene is mounted, or while the
 * server asks something only the start can serve (its absence is then the finding).
 */
export function startShadowInScope(expected: StartOwner, actual: ActualStartOwner): boolean {
  return actual !== 'game' || startOwnsOwner(expected);
}

/**
 * THE VERDICT of one judged state. A prompt HELD behind an admission block is waiting for something on screen: while
 * the player has a surface to act on (a reveal to take — the server's next question legitimately waits for the take)
 * the hold is THEIRS and nothing is judged; only a hold over a screen with nothing to do (`none`, a beat) can become a
 * `held-long` finding — the field hang's shape (a city held behind a foreign landing over an empty scene).
 */
export function startShadowVerdict(expected: StartOwner, actual: ActualStartOwner, held: string | undefined): 'agree' | 'disagree' | 'held' {
  if (held !== undefined) {
    return actual === 'none' || actual === 'beat' ? 'held' : 'agree';
  }
  return startOwnersAgree(expected, actual) ? 'agree' : 'disagree';
}

/** A disagreement is a finding only once it has stood this long, unchanged, with the prompt admitted. */
export const START_SHADOW_CONFIRM_MS = 3000;
/** A prompt held behind an admission block for longer than this is a finding of its own (`held-long`). */
export const START_SHADOW_HELD_MS = 10_000;

export type StartShadowFinding = {
  kind: 'disagree' | 'held-long',
  expected: StartOwner,
  actual: ActualStartOwner,
  /** The admission block that held the prompt (`held-long`), if any. */
  block?: string,
  prompt: string,
  at: number,
};

/** The findings of this session (bounded) — read by `window.__conStartShadow()` and the field export. */
export const startShadowLog: {findings: Array<StartShadowFinding>, judged: number} = {findings: [], judged: 0};
const MAX_FINDINGS = 50;

/** The stable key of one finding — logged once per prompt, never once per frame. */
export function startShadowKey(f: Pick<StartShadowFinding, 'kind' | 'expected' | 'actual' | 'prompt' | 'block'>): string {
  return `${f.kind}|${f.expected}|${f.actual}|${f.block ?? ''}|${f.prompt}`;
}

export function recordStartShadowFinding(f: StartShadowFinding): boolean {
  const key = startShadowKey(f);
  if (startShadowLog.findings.some((x) => startShadowKey(x) === key)) {
    return false;
  }
  startShadowLog.findings.push(f);
  if (startShadowLog.findings.length > MAX_FINDINGS) {
    startShadowLog.findings.shift();
  }
  return true;
}

export function resetStartShadowLog(): void {
  startShadowLog.findings.length = 0;
  startShadowLog.judged = 0;
}
