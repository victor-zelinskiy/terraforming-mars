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

/**
 * What the latch machinery has on screen right now. `beat` / `parked` / `trip` are never judged.
 * `trip` — THE BONUS ACTION TAKEN ON THE BOARD («Фора» — `startController.bonusTurnLive`): the player confirmed the
 * trip and the start LET GO whole — no frame, no host, no deferred task; the game's own surfaces serve the action,
 * its placements and its follow-ups, by the start's own decision, for as long as the player takes.
 */
export type ActualStartOwner = StartOwner | 'none' | 'shell' | 'beat' | 'parked' | 'trip';

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
  /** A step the start hosts is on its own entry / leave episode (the hand lifting out of the dock, or gathering back). */
  stepInTransit?: boolean,
  /** What stands on the start is the player's own look (`hostCarriesPlayersLook`) — a browse layer they walked into. */
  playersLook?: boolean,
  /** A bonus action is being taken on the board (`bonusTurnLive`) — the start let go for it. */
  bonusTrip?: boolean,
};

export function actualStartOwner(s: ActualStartSignals): ActualStartOwner {
  // THE BONUS ACTION'S TRIP TO THE BOARD is the start's own hand-over, and the player's time: read as `game` it was
  // «expected the bonus stage, on screen the game» for as long as the action took — a finding filed three seconds
  // into every trip a person makes (the whole e2e suite's reading of the opening, 2026-11-22: the one disagreement
  // with no cure and no hold that came within 61 ms of the confirm — and only because a spec plays faster than a
  // player).
  if (s.bonusTrip === true) {
    return 'trip';
  }
  // The start frame is gone: whatever stands — a staged card's cell on the board, the finale's greenery, a card's
  // placement — is the GAME's, never the start's business (the shadow filed «game → board» on three ordinary tables).
  if (!s.mounted) {
    // …unless the PLAYER took it away: «B Свернуть» on the corporation's first action sets the question aside and
    // takes the start's frame off the stack — the board stands with the restore card («Вернуться к решению»), by the
    // player's own choice. That is `parked` whether or not a frame is mounted; read as `game` it was «the game on
    // screen for the start's own question» — a finding (and a defect event) filed for a screen the player asked for
    // (FREEZE ZERO, the monkey's baseline `fz0 · hydro-terminal-surge`; replayed in `classReplays.bottle.ts`).
    return s.parked ? 'parked' : 'game';
  }
  if (s.placementLive) {
    return 'board';
  }
  if (s.parked) {
    return 'parked';
  }
  // THE PLAYER'S OWN LOOK over the start (the colony rail they walked into) is the player's choice exactly as a parked
  // task is: whatever the server asks meanwhile, the screen is theirs until they close it — never judged, and never
  // «cured» by releasing the start from under what they are reading (`startServing.hostedStepServes` — the watchdog's
  // reading of the same fact).
  if (s.playersLook === true && s.mounted) {
    return 'parked';
  }
  if (!s.visible) {
    // A paint-only yield with nothing standing for it is a bounded beat (the placement's completion chain, the scale
    // glide) — the strand watchdog owns the case where it is not.
    return s.promptSurface || s.strandYield ? 'shell' : 'beat';
  }
  // A HOSTED STEP ON ITS OWN ENTRY / LEAVE is a beat — bounded by its own episode, never judged (`startServing.
  // hostedStepServes` is the watchdog's reading of the same fact). A machine four times slower stretches the hand's
  // gather past the shadow's confirm: «expected game, on screen step», and a cure that released the start under a
  // leave that was ending by itself (CI's CPU x4 pass, `hydro-terminal-surge`, 2026-11-17).
  if (s.stepInTransit === true) {
    return 'beat';
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
  if (actual === 'beat' || actual === 'parked' || actual === 'trip') {
    return true;
  }
  switch (expected) {
  case 'waiting': return true;
  case 'step': return actual === 'step' || actual === 'shell';
  // The corporation's mandatory move INSIDE the bonus window is the bonus stage's own sub-stage («Фора»: bonus action 1
  // — `console-bonus-nested-first-action`): the bonus stage serving it is the same owner one level down.
  case 'firstAction': return actual === 'firstAction' || actual === 'bonusAction';
  // ⚠ NOT `game ↔ shell`: the shell serving the menu while the start FRAME still stands is the state a mere yield
  // leaves — the frame covers the board for every board story (the park held the temperature with `watchable: false`
  // for 30 s after the field's yield of 2026-10-31 22:15, and the mandatory lease hung until the watchdog). The game
  // proper has begun: the start has to END (`release`).
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

/**
 * PHASE 1 — THE SHADOW ACTS (the owner, 2026-10-31: «расширить подход тени — не только диагностика, а фактическое
 * устранение зависаний и неправильных переходов»). A CONFIRMED finding is CURED, through the doors that already exist
 * and by name — never a latch replaced (that is phase 3, one owner class at a time, under storyboards):
 *
 *   · `heal`  — the START must serve (`startOwnsOwner`) and nothing does: the scene's own doors (`healStrand` — the
 *               queue / shelf return, the first-action seat, the bonus stage); a door that opens nothing YIELDS;
 *   · `yield` — the SHELL's own surface must serve (a step, a placement) and the start scene stands in its way: the
 *               strand's yield — the scene stops painting, the question goes to the shell's surfaces
 *               (`startStrandYield`, released on the next prompt — the start may still be owed after the step);
 *   · `release` — the GAME PROPER has begun (the plain action menu) and the start still stands, in any pose: the
 *               start ENDS through its own release beat (`releaseByDirector` → `runSceneRelease`, bounded by its
 *               own safety; the lifetime hold let go) — a yield there left the frame covering the board (2026-10-31
 *               22:15: the park's 30 s degrade, the hung lease);
 *   · `none`  — a HELD prompt is an admission block's ledgered debt (its own degrade); a disagreement the player can
 *               act on (a shell surface standing for a start question) is logged only.
 *
 * Applied twice: by the shadow's own confirmation (3 s, once per finding) and by the liveness arbiter's rung
 * `start-director` (rank 15 — before the flows are released with force) whenever the screen stalls with a standing
 * disagreement. Idempotent: a cure that changes nothing reports nothing.
 */
export type StartCure = 'heal' | 'yield' | 'release' | 'none';

export function startDirectorCure(f: Pick<StartShadowFinding, 'kind' | 'expected' | 'actual'>): StartCure {
  if (f.kind === 'held-long') {
    return 'none';
  }
  const startStands = f.actual === 'none' || f.actual === 'wizard' || f.actual === 'queue' ||
    f.actual === 'firstAction' || f.actual === 'bonusAction';
  if (startOwnsOwner(f.expected)) {
    // The start's own question, nobody serving it — a door of the scene; the SHELL serving it (actual `shell`) is a
    // deliberate fallback (the strand's yield already happened), never undone here.
    return f.actual === 'none' ? 'heal' : 'none';
  }
  if (f.expected === 'game') {
    // The start frame in ANY pose (painting, yielded to the shell) while the game proper asks — it ends.
    return f.actual === 'game' || f.actual === 'board' ? 'none' : 'release';
  }
  if (f.expected === 'step' || f.expected === 'board') {
    return startStands ? 'yield' : 'none';
  }
  return 'none';
}

/**
 * THE LEVEL DOOR (FREEZE ZERO, stage 2b — «start-shadow lines impossible by construction»). The director's cure is
 * right as a pure function of the server's one question and of what stands; it was executed by latches on an EDGE,
 * with the shadow behind them on a confirm of seconds. Now the door opens BY LEVEL: the moment the director would act
 * and NOTHING IS IN FLIGHT — the wait graph holds no wait for a motion or for the server, and the wire is quiet — for
 * this many painted frames in a row. Counted in FRAMES, the clock of the thing it bounds: a page that does not paint
 * opens no door, a slow one waits as many frames as a fast one.
 *
 * WHY EIGHT: over every walk there is (the whole e2e suite, 1 502 tests; the gate's 606 walks in the bottle) a state
 * the director would cure stands QUIET for one frame at the most — the latches' own doors open in the tick the state
 * rises; the longest such state, quiet or not, stood 72 ms. Eight frames is past every hand-off the scene plays, so
 * on a healthy table the door never opens (the specs that are red on a `[start-shadow] cure` line hold exactly that);
 * it opens on a strand, a hundred milliseconds in instead of three seconds.
 */
export const START_LEVEL_DOOR_QUIET_FRAMES = 8;

/**
 * MAY THE LEVEL DOOR ACT on this disagreement? Every cure but ONE state: the game proper asks and a STEP still stands
 * on the start (a surface over the scene). That state is not this door's — and no gap either: a step that is
 * FINISHED leaves by the conclusion's own door (`staleFreeTurnClock.observeConclusionDoor` — a frame past its commit
 * with nothing owed inside, over the free turn), one the player still reads or answers HOLDS that door by a named
 * reason and is the player's time, and one left standing for a question it does not answer is a strand
 * (`startServing.hostedStepServes`) — healed, then yielded, by the strand's door. Whichever it was, what it leaves is
 * `game > none | queue | shell`, and those this door releases. Releasing the start from under a standing step here
 * would decide a second owner's question.
 *
 * (`game > shell` — a yield already happened and the start's frame still covers the board under the game's menu, the
 * field of 2026-10-31 22:15 — was shut too until 2026-11-23: no healthy table makes it (not one span of it over the
 * whole e2e suite, CI run 45083892683), so the door opens on it as on every other strand.)
 */
export function startLevelDoorMay(f: Pick<StartShadowFinding, 'kind' | 'expected' | 'actual'>): boolean {
  if (f.kind !== 'disagree' || startDirectorCure(f) === 'none') {
    return false;
  }
  return !(f.expected === 'game' && f.actual === 'step');
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
/** `unpainted`: confirms that came due over a span the page did not paint through — no evidence, judged again. */
export const startShadowLog: {findings: Array<StartShadowFinding>, judged: number, unpainted: number} = {findings: [], judged: 0, unpainted: 0};
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
  startShadowLog.unpainted = 0;
}
