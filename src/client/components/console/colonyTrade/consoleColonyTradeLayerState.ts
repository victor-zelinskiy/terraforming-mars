/*
 * ConsoleColonyTradeLayer's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the handles of the scenes on stage live here — one per page, as they were (the
 * layer is a singleton: whoever tears a scene down takes back the same handles).
 */
import {TradeDirectorHandle} from '@/client/console/colonyTrade/colonyTradeDirector';

/*
 * Non-reactive scene context — GSAP handles must never enter Vue reactivity.
 *
 * ⚠️ TWO ACTORS, TWO LIFETIMES. The card covers belong to ONE payout cycle (a
 * Pluto resolution plays one per colony) and must be reset between cycles; the
 * white MARKER belongs to the transaction and legitimately runs while a cycle
 * starts — the pre-trade ADVANCE leg is exactly the beat the covers wait out.
 * One shared list would make the cycle reset kill the glide mid-flight, and its
 * `onLanded` is what releases the payout: the leg would only ever end on its
 * own safety net.
 */
export type SceneCtx = {
  /** The current cover cycle's timelines + timers (reset per batch) — each timer is its cancel / disarm in the layer's scope. */
  handles: Array<TradeDirectorHandle>,
  timers: Array<() => void>,
  /** The marker glide's own timeline + cell-pulse timers (transaction-lived). */
  glideHandles: Array<TradeDirectorHandle>,
  glideTimers: Array<() => void>,
  /** A law's WAVE over every track (its own lifetime — a trade's teardown never kills it, nor it a trade's). */
  waveHandles: Array<TradeDirectorHandle>,
  waveTimers: Array<() => void>,
};
export const ctx: SceneCtx = {handles: [], timers: [], glideHandles: [], glideTimers: [], waveHandles: [], waveTimers: []};
