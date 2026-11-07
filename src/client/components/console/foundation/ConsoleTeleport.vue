<script lang="ts">
/**
 * THE ONE TELEPORT INTO A TARGET THAT CAN BE ABSENT. Every console `<Teleport>`
 * whose target is not `body` goes through this component (guard
 * `tests/console/teleportTargetGuard.spec.ts`).
 *
 * Why it exists (the field crash of 2026-11-07, game-pdb19bfa — «Построить
 * колонию» from the standard projects right after a card had built one from the
 * hand): Vue's native `<Teleport>` does NOT keep its content in place when the
 * target is missing AT MOUNT. It warns (dev only), mounts NOTHING, and keeps the
 * never-mounted children as its `n1`; the next patch then walks component vnodes
 * that have no instance — `Cannot read properties of null (reading
 * 'emitsOptions')`, then `bum` / `parentNode` / `exposed` on unmount — and the
 * whole subtree around it stops patching. The surface vanishes and the server's
 * question has nobody serving it. A selector published by a host that already
 * left (a stale slot, a stale berth) is all it takes, and nothing about it is
 * visible in a test that never mounts twice.
 *
 * Three laws, each a native trap closed:
 * 1. **Nothing mounts into nothing.** Enabled with no live target, the content
 *    renders NOWHERE (the stack's own «ownership ≠ readiness» gap) and waits —
 *    one re-check after the current flush (a target rendered later in the same
 *    flush: the native `defer` case), then per frame, then at a slow cadence —
 *    and mounts the moment the target is in the document.
 * 2. **The target is resolved on every render**, and handed to the native
 *    teleport as the ELEMENT: a string `to` that never changes is never
 *    re-resolved by Vue, so a target node REPLACED by its host kept receiving
 *    the content in a detached copy. A new element is a new `to` — Vue moves.
 * 3. **Enabling never moves into a dead target.** A teleport mounted disabled
 *    keeps the target it resolved at mount; enabled later with the same `to`,
 *    Vue inserts into that (possibly `null`) target. While the target is
 *    missing, an already-mounted teleport that is disabled STAYS disabled.
 */
import {defineComponent, h, markRaw, nextTick, PropType, Teleport, VNode} from 'vue';

type TeleportTo = string | HTMLElement;

/** The live element a `to` names right now (`null` = not in the document). */
export function resolveTeleportTarget(to: TeleportTo): Element | null {
  if (typeof to !== 'string') {
    return to;
  }
  try {
    return document.querySelector(to);
  } catch {
    return null;
  }
}

/** Per-frame re-checks before the slow cadence takes over. */
const FAST_RETRY_FRAMES = 30;
const SLOW_RETRY_MS = 250;

export default defineComponent({
  name: 'ConsoleTeleport',
  props: {
    to: {
      type: [String, Object] as PropType<TeleportTo>,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    /** Passed to the native teleport on its mount (it resolves after the flush). */
    defer: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    // The wait's bookkeeping — plain, never reactive (the render reads it).
    return {
      wait: markRaw({frame: undefined as number | undefined, timer: undefined as number | undefined, active: false, warned: false}),
    };
  },
  data() {
    return {
      /** Bumped by a re-check that found the target — the one reactive edge of the wait. */
      epoch: 0,
    };
  },
  beforeUnmount() {
    this.stopWaiting();
  },
  methods: {
    stopWaiting(): void {
      const wait = this.wait;
      if (wait.frame !== undefined) {
        window.cancelAnimationFrame(wait.frame);
        wait.frame = undefined;
      }
      if (wait.timer !== undefined) {
        window.clearTimeout(wait.timer);
        wait.timer = undefined;
      }
      wait.active = false;
    },
    awaitTarget(): void {
      const wait = this.wait;
      if (wait.active) {
        return;
      }
      wait.active = true;
      let frames = 0;
      const check = (): boolean => {
        if (!wait.active) {
          return true;
        }
        if (resolveTeleportTarget(this.to) !== null) {
          this.stopWaiting();
          this.epoch++;
          return true;
        }
        return false;
      };
      const loop = (): void => {
        wait.frame = undefined;
        wait.timer = undefined;
        if (check()) {
          return;
        }
        if (frames++ < FAST_RETRY_FRAMES && typeof window.requestAnimationFrame === 'function') {
          wait.frame = window.requestAnimationFrame(loop);
        } else {
          wait.timer = window.setTimeout(loop, SLOW_RETRY_MS);
        }
      };
      void nextTick(() => {
        if (check()) {
          return;
        }
        if (!wait.warned) {
          wait.warned = true;
          console.warn(`[teleport] target ${typeof this.to === 'string' ? `«${this.to}»` : 'element'} is not in the document — the content waits (never mounted into nothing)`);
        }
        loop();
      });
    },
  },
  render() {
    void this.epoch;
    const prev = this.$.subTree as VNode | null;
    const live = prev !== null && prev.type === Teleport;
    const target = resolveTeleportTarget(this.to);
    const children = this.$slots.default?.() ?? [];
    if (target === null) {
      if (!live && !this.disabled) {
        // LAW 1 — the native teleport would mount nothing and crash on the next patch.
        this.awaitTarget();
        return null;
      }
      if (live && !this.disabled) {
        const wasDisabled = prev.props?.disabled === true || prev.props?.disabled === '';
        if (wasDisabled) {
          // LAW 3 — enabling now would insert into the target resolved at mount.
          this.awaitTarget();
          return h(Teleport, {to: prev.props?.to ?? this.to, disabled: true}, children);
        }
      }
      return h(Teleport, {to: this.to, disabled: this.disabled, defer: live ? undefined : this.defer}, children);
    }
    this.stopWaiting();
    // LAW 2 — the element, so a replaced node is a changed `to`.
    return h(Teleport, {to: target as HTMLElement, disabled: this.disabled, defer: live ? undefined : this.defer}, children);
  },
});
</script>
