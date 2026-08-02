/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * FOREGROUND WATCHDOG — the ONE answer to "the console says it is busy, but is
 * anything actually on screen?".
 *
 * THE BUG CLASS IT CLOSES. Every surface that can hold the player back does so
 * through a CLAIM: a `mandatory-choice` lease, a derived module flag
 * (`hasVisibleReveal`, `botTurnReviewState.open`), or one of the shell's raw
 * admission signals (`consoleRevealMode`, `playedHeroHolding()`, `deckDrawHolds()`
 * …). Not one of them was ever checked against what is RENDERED, and only the
 * animation-hold registry had a ceiling. So any desync between a claim and its
 * surface's real mount gate froze the game outright:
 *
 *   - the shell's lease predicate is a strict SUPERSET of the task host's `v-if`
 *     (it ignores `taskHeldForWorkspace`, `effectDecisionActive`, … and both
 *     <Teleport>s, which silently drop their content on a stale selector);
 *   - `hasVisibleReveal()` blocks on `some(!dismissed)` while the overlay mounts
 *     on a strictly narrower predicate (`!playedHeroHolds`, `revealHeldForWorkspace`,
 *     the headless single-card mode);
 *   - `admits('host')` reads the raw scene predicates, so the documented 35 s
 *     animation ceiling never protected prompt ADMISSION at all.
 *
 * The player's symptom is always the same and always terminal: «СОБЫТИЯ В
 * ОЧЕРЕДИ +N» pinned on the board home with nothing beside it, no prompt, every
 * verb answering «Сначала завершите текущее действие» — and the leak detector's
 * own amber guard disarmed, because a held announce gate counts as "served".
 * Only a page reload cleared it.
 *
 * THE RULE (`presentationStalled`, pure): a hold on the player's progress must
 * be backed by something actually on screen. Claimed + nothing rendered +
 * something waiting = stale, and stale claims are EXPIRED (never force-closed:
 * the holder keeps its own release token, and any claim raised afterwards is
 * honest by construction and counts again immediately).
 *
 * WHY DOM EVIDENCE AND NOT A TIMER. A claim may legitimately stand for minutes —
 * a modal the player is reading is not a bug. Rendered-ness is the only honest
 * discriminator, and the leak detector already does exactly one querySelector
 * pass per tick, so this rides on it instead of adding a second clock.
 *
 * RECOVERY NAMES ITSELF (the "no silent loss" invariant): every recovery warns
 * with the exact claims it expired, and raises one short player-facing notice.
 * A watchdog that heals invisibly would have hidden this bug instead of it being
 * reported.
 */
import {reactive} from 'vue';
import {AdmissionSignals} from '@/client/console/consolePromptAdmission';
import {presentationStalled} from '@/client/components/presentation/presentationPolicy';
import {expireActiveAnimationHolds} from '@/client/components/presentation/animationHold';
import {
  currentBlockReason,
  expireForegroundHolds,
  foregroundHoldLabels,
  isMandatoryPromptsHeld,
} from '@/client/components/presentation/presentationFlow';
import {
  acknowledgeFlowHoldingCards,
  pendingSummary,
  promoteFromQueue,
  pushWarning,
} from '@/client/components/notifications/notificationState';
import {translateText} from '@/client/directives/i18n';

/** The admission signals the watchdog may expire (never `announceGate`). */
export type GuardableAdmissionSignal = Exclude<keyof AdmissionSignals, 'announceGate'>;

/**
 * `announceGate` is deliberately NOT expirable. It is not a cinematic that can
 * leak — it is the player's own pending press, and silently dropping it would
 * fling open the very surface the gate exists to announce first. When the gate
 * is what strands the prompt, the honest recovery is to clear whatever is
 * hiding its announcement card, which is exactly what expiring the OTHER claims
 * does (`mandatoryAnnounceVisible` waits on the animation / presentation holds).
 */
const GUARDABLE: ReadonlyArray<GuardableAdmissionSignal> = [
  'revealOpen', 'revealPending', 'playedHero', 'tileHero',
  'cardArrival', 'boardBonus', 'cardDiscard', 'presentation', 'anyAnimation',
];

/**
 * A stall must be observed on THIS MANY CONSECUTIVE passes before the watchdog
 * acts. A working hand-off (a reveal dismissing while the hand section mounts, a
 * section switch, a teleport re-homing) can momentarily satisfy all three parts
 * of the rule; those resolve well inside one 1 s tick, so their streak never
 * builds. A genuinely stale claim satisfies it every pass.
 */
export const STALL_CONFIRM_TICKS = 3;

/**
 * After a recovery, ignore the rule for this many passes. The underlying flag
 * may still be stuck true, and re-expiring it every second would spam the player
 * with notices while adding nothing — one expiry already un-blocked the queue
 * and the prompt, and the streak has to rebuild from zero anyway.
 */
export const RECOVERY_COOLDOWN_TICKS = 10;

export const foregroundWatchdogState = reactive({
  /** Admission signals expired by a recovery — masked until they go false. */
  expiredSignals: new Set<GuardableAdmissionSignal>(),
  /** Consecutive stalled passes observed so far. */
  streak: 0,
  /** Passes left before the rule is armed again. */
  cooldown: 0,
  /** How many times the watchdog has recovered this session (?gpDebug). */
  recoveries: 0,
  /** What the last recovery expired — the honest readout, never a bare flag. */
  lastDiagnosis: '' as string,
});

/** The last raw signals the shell published (drives expiry + un-expiry). */
let lastRaw: AdmissionSignals | undefined;

/**
 * Live mirror of "the player is on the BOARD HOME and has opened nothing of
 * their own" (the shell's `boardHomeIdle`). The watchdog acts ONLY here.
 *
 * WHY THE SCOPE. The rule's DOM half asks whether any SERVING surface is
 * rendered — and the journal, a sheet, the fullscreen zoom, the system menu, an
 * inspection and the hand carousel are none of those. Without this mirror, a
 * legitimately claimed foreground would read as "nothing rendered" the moment
 * the player opened a screen over it, and the watchdog would expire honest
 * claims and pop a prompt over whatever they were reading. The board home is
 * also exactly where the bug is diagnosable by the player ("I am on the main
 * screen, there is no live event beside me, and the queue chip never clears").
 */
let boardHomeIdle = false;
export function setConsoleBoardHomeIdle(idle: boolean): void {
  boardHomeIdle = idle;
}

/**
 * The shell mirrors its RAW admission signals here (one watcher). Un-expires any
 * signal that has gone honestly false, so the next legitimate cinematic holds
 * the prompt normally again — `animationHold`'s falling-edge semantics.
 */
export function noteAdmissionSignals(raw: AdmissionSignals): void {
  lastRaw = raw;
  for (const key of [...foregroundWatchdogState.expiredSignals]) {
    if (!raw[key]) {
      foregroundWatchdogState.expiredSignals.delete(key);
    }
  }
}

/**
 * The shell's admission signals with every expired claim masked off. PURE read
 * (reactive through `expiredSignals`), so the host's `v-if` re-evaluates the
 * instant a recovery lands.
 */
export function guardedAdmissionSignals(raw: AdmissionSignals): AdmissionSignals {
  if (foregroundWatchdogState.expiredSignals.size === 0) {
    return raw;
  }
  const guarded = {...raw};
  for (const key of foregroundWatchdogState.expiredSignals) {
    guarded[key] = false;
  }
  return guarded;
}

/**
 * Is the console currently CLAIMING the foreground (either half of the hold)?
 *
 * Reads the GUARDED view on purpose. An already-expired claim is neutralized —
 * the queue flows and the prompt mounts — so counting it would make the rule
 * true forever behind a flag that is stuck raw, and the watchdog would "recover"
 * again every cooldown, pushing a fresh notice each time for a screen that has
 * been working since the first one. `presentationFlow`'s own reads are masked
 * the same way, so the two halves agree.
 */
function foregroundClaimed(): boolean {
  if (currentBlockReason() !== undefined || isMandatoryPromptsHeld()) {
    return true;
  }
  if (lastRaw === undefined) {
    return false;
  }
  const guarded = guardedAdmissionSignals(lastRaw);
  return GUARDABLE.some((key) => guarded[key] === true);
}

/** Everything claiming the foreground right now, for the recovery warn. */
function claimLabels(): Array<string> {
  const labels = [...foregroundHoldLabels()];
  if (lastRaw !== undefined) {
    for (const key of GUARDABLE) {
      if (lastRaw[key] === true) {
        labels.push(`admission:${key}`);
      }
    }
  }
  return labels;
}

/**
 * Expire every claim that is up right now and let the queue flow again.
 * Exported for the ?gpDebug manual escape hatch and the specs.
 */
export function recoverStalledForeground(): ReadonlyArray<string> {
  const claims = claimLabels();
  // Animation holds FIRST: they outrank every other reason, so clearing only the
  // leases would leave `foregroundBlockReason()` at 'animation' and the queue
  // just as stuck, for the rest of the 35 s ceiling.
  const expired = [...expireActiveAnimationHolds(), ...expireForegroundHolds()];
  if (lastRaw !== undefined) {
    for (const key of GUARDABLE) {
      if (lastRaw[key] === true) {
        foregroundWatchdogState.expiredSignals.add(key);
        expired.push(`admission:${key}`);
      }
    }
  }
  // A flow-holding card that is in the feed but not on screen occupies the one
  // visible transient slot, so the queue cannot promote into it either. Acting
  // is one of the "notification finished" signals, and a recovery IS the shell
  // acting on the player's behalf — this also acks the bot turn to the server.
  acknowledgeFlowHoldingCards();

  foregroundWatchdogState.recoveries++;
  foregroundWatchdogState.lastDiagnosis = claims.join(', ');
  foregroundWatchdogState.streak = 0;
  foregroundWatchdogState.cooldown = RECOVERY_COOLDOWN_TICKS;
  console.warn(
    `[console-foreground-watchdog] the foreground claimed to be busy with NOTHING rendered — ` +
    `expired ${expired.length > 0 ? expired.join(', ') : '(nothing)'} ` +
    `(claims at the time: ${claims.length > 0 ? claims.join(', ') : 'none'})`);
  // The notice goes out BEFORE the drain: with the slot free it is delivered
  // rather than queued, and the backlog it just unblocked follows behind it
  // instead of being evicted by it. Explain, then show.
  pushWarning(translateText('The screen was stuck and has been released'));
  promoteFromQueue();
  return expired;
}

/** The observations one pass needs. `surfaceRendered` is the DOM evidence. */
export type WatchdogPass = {
  /** ≥1 serving surface actually has client rects (the leak detector's pass). */
  surfaceRendered: boolean;
  /** The server is waiting for this player's input. */
  promptLive: boolean;
};

/**
 * ONE watchdog pass, driven by the leak detector's 1 s tick. Returns true when
 * it recovered, so the caller can skip its own reporting for that pass.
 */
export function runForegroundWatchdog(pass: WatchdogPass): boolean {
  if (!boardHomeIdle) {
    foregroundWatchdogState.streak = 0;
    return false;
  }
  if (foregroundWatchdogState.cooldown > 0) {
    foregroundWatchdogState.cooldown--;
    foregroundWatchdogState.streak = 0;
    return false;
  }
  const stalled = presentationStalled({
    claimed: foregroundClaimed(),
    surfaceRendered: pass.surfaceRendered,
    // Nobody is hurt by a claim over an idle board: act only when the player is
    // demonstrably blocked — events that cannot be delivered, or a live prompt.
    waiting: pendingSummary().count > 0 || pass.promptLive,
  });
  if (!stalled) {
    foregroundWatchdogState.streak = 0;
    return false;
  }
  foregroundWatchdogState.streak++;
  if (foregroundWatchdogState.streak < STALL_CONFIRM_TICKS) {
    return false;
  }
  recoverStalledForeground();
  return true;
}

/** Full reset (game switch / shell teardown / test cleanup). */
export function resetForegroundWatchdog(): void {
  foregroundWatchdogState.expiredSignals.clear();
  foregroundWatchdogState.streak = 0;
  foregroundWatchdogState.cooldown = 0;
  foregroundWatchdogState.recoveries = 0;
  foregroundWatchdogState.lastDiagnosis = '';
  lastRaw = undefined;
  boardHomeIdle = false;
}
