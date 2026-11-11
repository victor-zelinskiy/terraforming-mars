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
 * 4. **…and what was not standing yet does not stand up in place.** Law 3 keeps
 *    content that is already ON SCREEN where it is; content that arrives in the
 *    very render that asks for the missing target (the reveal claimed by a
 *    colony stage whose zone renders later in the same flush) would otherwise
 *    mount in the teleport's own place and MOVE into the target a tick later —
 *    two insertions, the arrival told twice (CI 2026-11-08,
 *    `console-pluto-two-colony-sequence`: the dealt card re-inserted). Vue
 *    patches a disabled teleport's NEW children into its own place before it
 *    moves them, so a teleport holding nothing (`teleportStandsContent`) waits
 *    empty and goes live as a FRESH teleport (a new key): its content mounts
 *    straight into the target — the stack's own «ownership ≠ readiness» gap.
 */
import {defineComponent, h, markRaw, nextTick, PropType, Teleport, VNode} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';

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

/**
 * Does the live teleport hold content the player can SEE — any child that rendered an element (a `v-if` that is
 * off renders a comment, a `<transition>` around it renders that comment)? Only such content has a place to keep.
 */
export function teleportStandsContent(prev: VNode): boolean {
  // A DISABLED teleport keeps its content in place, between its own two anchors.
  const start = prev.el as Node | null;
  const end = prev.anchor as Node | null;
  for (let node = start?.nextSibling ?? null; node !== null && node !== end; node = node.nextSibling) {
    if (node.nodeType === 1) {
      return true;
    }
  }
  return false;
}

/** Per-frame re-checks before the slow cadence takes over. */
const FAST_RETRY_FRAMES = 30;
const SLOW_RETRY_MS = 250;
/**
 * A wait this long is no gap frame any more — the content is STRANDED: whatever it serves (a prompt's step, a hosted
 * surface) stands nowhere on screen (ledger HC — the lent-node class of game-pdb19bfa turned from a crash into a
 * silent wait). Named once, `[teleport] stranded`; every e2e spec reads it red.
 */
const STRANDED_MS = 5000;

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
      wait: markRaw({cancelFrame: (() => {}) as () => void, cancelTimer: (() => {}) as () => void, active: false, warned: false, since: 0, stranded: false, key: 0}),
      flow: useFlowScope('console-teleport'),
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
      wait.cancelFrame();
      wait.cancelTimer();
      wait.active = false;
    },
    awaitTarget(): void {
      const wait = this.wait;
      if (wait.active) {
        return;
      }
      wait.active = true;
      wait.since = Date.now();
      wait.stranded = false;
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
        if (check()) {
          return;
        }
        if (!wait.stranded && Date.now() - wait.since >= STRANDED_MS) {
          wait.stranded = true;
          console.warn(`[teleport] stranded — ${typeof this.to === 'string' ? `«${this.to}»` : 'an element target'} absent for ${STRANDED_MS / 1000} s; the content stands nowhere`);
        }
        if (frames++ < FAST_RETRY_FRAMES && typeof window.requestAnimationFrame === 'function') {
          wait.cancelFrame = this.flow.afterFrame('the teleport\'s target is looked for', loop);
        } else {
          wait.cancelTimer = this.flow.after(SLOW_RETRY_MS, 'the teleport\'s target is looked for (the slow cadence)', loop);
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
    const wasDisabled = live && (prev.props?.disabled === true || prev.props?.disabled === '');
    // LAW 4 — a disabled teleport holding NOTHING that is asked to go live does not patch its new content in place
    // (Vue mounts it into the teleport's own place and only then moves it): it waits empty, and goes live as a FRESH
    // teleport — a new key — whose content mounts straight into the target.
    const nothingStands = wasDisabled && !teleportStandsContent(prev);
    if (target === null) {
      if (!live && !this.disabled) {
        // LAW 1 — the native teleport would mount nothing and crash on the next patch.
        this.awaitTarget();
        return null;
      }
      if (live && !this.disabled && wasDisabled) {
        // LAW 3 — enabling now would insert into the target resolved at mount.
        this.awaitTarget();
        return h(Teleport, {key: this.wait.key, to: prev.props?.to ?? this.to, disabled: true}, nothingStands ? [] : children);
      }
      return h(Teleport, {key: this.wait.key, to: this.to, disabled: this.disabled, defer: live ? undefined : this.defer}, children);
    }
    this.stopWaiting();
    if (!this.disabled && nothingStands) {
      this.wait.key++;
      return h(Teleport, {key: this.wait.key, to: target as HTMLElement, disabled: false}, children);
    }
    // LAW 2 — the element, so a replaced node is a changed `to`.
    return h(Teleport, {key: this.wait.key, to: target as HTMLElement, disabled: this.disabled, defer: live ? undefined : this.defer}, children);
  },
});
</script>
