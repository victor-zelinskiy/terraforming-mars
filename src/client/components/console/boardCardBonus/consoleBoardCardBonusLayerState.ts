/*
 * ConsoleBoardCardBonusLayer's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every
 * top-level statement runs once per INSTANCE, so the handles of the scene on stage live here — one per page, as they
 * were (the layer is a singleton: whoever tears the scene down takes back the same handles).
 */
import {BonusCoverHandle, BonusSceneHandle} from '@/client/console/boardCardBonus/boardCardBonusDirector';
import {RectLike} from '@/client/console/boardCardBonus/boardCardBonusModel';

/*
 * Non-reactive scene context (module scope — the layer is a singleton,
 * and GSAP handles must never be wrapped in Vue reactivity).
 */
export type SceneCtx = {
  coverHandle?: BonusCoverHandle,
  sceneHandle?: BonusSceneHandle,
  abortHandle?: BonusSceneHandle,
  cellRect?: RectLike,
  liftedEls: Array<HTMLElement>,
  /** The scene's pending beats — each is its cancel / disarm in the layer's scope. */
  timers: Array<() => void>,
  /** The «no cards came» recall's cancel. */
  noRevealTimer?: () => void,
};
export const ctx: SceneCtx = {liftedEls: [], timers: []};
