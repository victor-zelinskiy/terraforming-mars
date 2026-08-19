/*
 * CONSOLE ENDGAME OVERVIEW — the module-reactive scene state.
 *
 * «Обзор партии» is an INTERNAL SCENE of the endgame workspace — never an
 * overlay over it and never the desktop `.eg-results`. One depth model:
 *
 *   scoring (settled actions)  ⇄  overview root  ⇄  one nested detail
 *
 * B walks it back one level at a time; «Свернуть» (the board inspection)
 * exists only from the scoring scene, so the hierarchy stays a line, never a
 * diamond. Module-level so the whole trip survives the workspace's v-show
 * round trips (collapse) and any playerkey epoch, and so a re-entry restores
 * the same tab, focus and page («повторный вход восстанавливает состояние»).
 *
 * SCENE PHASES (the seamless transition contract):
 *   closed → entering → open → leaving → closed
 * `entering`/`leaving` only gate CSS choreography classes; input lands from
 * the first frame of `entering` (a transition must absorb nothing). The
 * timers ride gsap.delayedCall through consoleMotionMs — kill-safe, so rapid
 * A/B can retarget the scene without stranding a half-played phase.
 */
import {reactive} from 'vue';
import {gsap} from 'gsap';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {OVERVIEW_TAB_ORDER, OverviewTabKey} from '@/client/console/endgame/consoleOverviewModel';

export type OverviewScenePhase = 'closed' | 'entering' | 'open' | 'leaving';

/** One nested detail layer — B closes it back to its tab. */
export type OverviewDetail =
  | {kind: 'score-category'; catKey: string}
  | {kind: 'card'; rowId: string}
  | {kind: 'generation'; gen: number}
  | {kind: 'players-metric'; group: string};

/** The scene transition beats (ms, pre-motionMs). Entering ≈ 620 ms total
 *  (commit 140 + scene 480), leaving is deliberately quicker. */
export const OVERVIEW_MS = {
  commit: 140,
  enter: 520,
  leave: 360,
  /** The tab-pane swap: out is short, in carries the direction. */
  paneOut: 130,
  paneIn: 230,
} as const;

export const consoleOverviewUi = reactive({
  phase: 'closed' as OverviewScenePhase,

  /** The active tab of the ring. */
  tab: 'digest' as OverviewTabKey,
  /** +1 = rightward (RB), −1 = leftward (LB) — the pane slide direction. */
  tabDir: 1,
  /** The pane swap machine — 'out' → (swap) → 'in' → 'idle'. Never parallel:
   *  a press mid-swap only retargets `pendingTab`. */
  paneStage: 'idle' as 'idle' | 'out' | 'in',
  pendingTab: undefined as OverviewTabKey | undefined,

  /** ONE nested detail (B closes). Dies on tab switch and scene close. */
  detail: undefined as OverviewDetail | undefined,

  /** «A Подробнее» is honest for the focused element right now — written by
   *  the overview root (it owns the per-tab data), read by the command bar. */
  primaryAvailable: false,

  // ── Per-tab focus memory (restored on re-entry) ──────────────────────────
  digestFocus: 0,
  scoreCat: 0,
  /** −1 = «not visited yet» → the component seats it on the last generation. */
  timelineGen: -1,
  cardsIdx: 0,
  /** −1 = все игроки; 0..n−1 = ranked player filter. */
  cardsFilter: -1,
  paramIdx: 0,
  /** −1 = «not visited yet» → last generation. */
  paramGen: -1,
  playerIdx: 0,
  playerGroup: 0,

  /** Chart first-reveal memory (per page load) — a chart draws its line once;
   *  every later visit lands settled («не переигрывай при каждом возврате»). */
  revealed: {} as Record<string, boolean>,
});

let phaseCall: gsap.core.Tween | undefined;

function killPhaseCall(): void {
  phaseCall?.kill();
  phaseCall = undefined;
}

/** «Обзор партии» — the scoring scene yields, the overview unfolds in place. */
export function openEndgameOverview(): void {
  const s = consoleOverviewUi;
  if (s.phase === 'open' || s.phase === 'entering') {
    return;
  }
  killPhaseCall();
  s.phase = 'entering';
  phaseCall = gsap.delayedCall(consoleMotionMs(OVERVIEW_MS.enter) / 1000, () => {
    if (consoleOverviewUi.phase === 'entering') {
      consoleOverviewUi.phase = 'open';
    }
  });
}

/** B at the overview root — back to the settled scoring results. */
export function closeEndgameOverview(): void {
  const s = consoleOverviewUi;
  if (s.phase === 'closed' || s.phase === 'leaving') {
    return;
  }
  killPhaseCall();
  s.detail = undefined;
  s.phase = 'leaving';
  phaseCall = gsap.delayedCall(consoleMotionMs(OVERVIEW_MS.leave) / 1000, () => {
    if (consoleOverviewUi.phase === 'leaving') {
      consoleOverviewUi.phase = 'closed';
    }
  });
}

/** The overview is ON STAGE (the scoring scene is parked under it). */
export function overviewSceneUp(): boolean {
  return consoleOverviewUi.phase !== 'closed';
}

/** Ring step — LB/RB wrap both ways (the settings-category grammar). */
export function nextOverviewTab(tab: OverviewTabKey, dir: 1 | -1): OverviewTabKey {
  const idx = OVERVIEW_TAB_ORDER.indexOf(tab);
  const n = OVERVIEW_TAB_ORDER.length;
  return OVERVIEW_TAB_ORDER[(idx + dir + n) % n];
}

/**
 * Full reset — the endgame workspace closed (new game / rollback). The tab,
 * focus memory and reveal memory all go: the next party is a fresh story.
 */
export function resetConsoleOverview(): void {
  const s = consoleOverviewUi;
  killPhaseCall();
  s.phase = 'closed';
  s.tab = 'digest';
  s.tabDir = 1;
  s.paneStage = 'idle';
  s.pendingTab = undefined;
  s.detail = undefined;
  s.primaryAvailable = false;
  s.digestFocus = 0;
  s.scoreCat = 0;
  s.timelineGen = -1;
  s.cardsIdx = 0;
  s.cardsFilter = -1;
  s.paramIdx = 0;
  s.paramGen = -1;
  s.playerIdx = 0;
  s.playerGroup = 0;
  s.revealed = {};
}
