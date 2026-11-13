/*
 * ConsoleDeckDrawLayer's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the handles of the scene on stage and the scope its timers stand in live here —
 * one per page, as they were (the layer is a singleton: whoever tears the scene down takes back the same handles).
 */
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {BatchArrivalHandle} from '@/client/console/consoleBatchArrivalMotion';
import {IntakeAssemblyHandle} from '@/client/console/cardIntake/intakeAssemblyDirector';
import {DeckDrawHandle} from '@/client/console/deckDraw/deckDrawDirector';

/*
 * Non-reactive scene context (module scope — the layer is a singleton, and
 * GSAP handles must never be wrapped in Vue reactivity).
 */
export type SceneCtx = {
  beatHandles: Array<DeckDrawHandle>,
  sceneHandle?: DeckDrawHandle,
  /** The plain draw's single deck→slot batch flight (the shared director). */
  batchHandle?: BatchArrivalHandle,
  /**
   * The DISCARD STREAM in flight or handing its lease over (PL-261): what a teardown must still settle — the owner's
   * `onAllPeeled` (its flight waits on it) and the stream's lease on the pile. A killed timer must never strand either.
   */
  stream?: {lease: string, allPeeled: () => void},
  /** The assembly scene's director handle («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — `cardIntake/intakeAssemblyDirector.ts`). */
  assemblyHandle?: IntakeAssemblyHandle,
};
export const ctx: SceneCtx = {beatHandles: []};

/**
 * THE SCENE'S SCOPE (architecture v2 — PLAN §10 · C1): every timer of the scene on stage — a beat's start, the frame's
 * entrance, a poll's next look, a net — is armed in ONE scope of the flow kernel and taken back together when the scene
 * is torn down (`clearTimers`), and when the game screen leaves. What the `timers` array kept by hand.
 */
let sceneTimers: FlowScope | undefined;

export function sceneScope(): FlowScope {
  if (sceneTimers === undefined || sceneTimers.ended !== undefined) {
    sceneTimers = consoleSessionScope().open('scene', 'deck-draw-layer');
  }
  return sceneTimers;
}

export function clearTimers(): void {
  sceneTimers?.end({how: 'cancelled', reason: 'the scene was torn down'});
  sceneTimers = undefined;
}
