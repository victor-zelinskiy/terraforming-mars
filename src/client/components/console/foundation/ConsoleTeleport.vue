<template>
  <component :is="homeStartMark" />
  <Teleport v-if="plan.mounted" :key="plan.generation" :to="plan.to" :disabled="plan.disabled">
    <slot />
  </Teleport>
  <component :is="homeEndMark" />
</template>

<script setup vapor lang="ts">
/*
 * THE ONE TELEPORT INTO A TARGET THAT CAN BE ABSENT. Every console `<Teleport>` whose target is not `body` goes
 * through this component (guard `tests/console/teleportTargetGuard.spec.ts`).
 *
 * Why it exists (the field crash of 2026-11-07, game-pdb19bfa — «Построить колонию» from the standard projects right
 * after a card had built one from the hand): a selector published by a host that already left — a stale slot, a stale
 * berth — is all it takes for a surface to be teleported into NOTHING, and the server's question then has nobody
 * serving it. (On the virtual DOM the native teleport also crashed on its next patch; the Vapor one does not — what
 * is left is the law, not the crash.)
 *
 * FOUR LAWS, decided by ONE function (`decide`) over reactive facts — the props, this wrapper's own wait, and the
 * registry of DECLARED targets (`v-embed-zone`):
 * 1. **Nothing mounts into nothing.** Enabled with no live target and no teleport standing, the content is rendered
 *    NOWHERE — not even created (the stack's own «ownership ≠ readiness» gap) — and waits: a declared target re-asks
 *    the document from its own mount, in the same task; any other is looked for after the flush, then per frame,
 *    then at a slow cadence; a wait of 5 s is named once (`[teleport] stranded` — red in every e2e spec).
 * 2. **The target is the resolved ELEMENT.** The Vapor teleport's `to` is reactive: a new element under the same
 *    selector is a changed `to`, and the content MOVES there — the same nodes, never a re-mount. A declared target
 *    says when it leaves; any other is watched through its parent while the content stands in it.
 * 3. **What stands keeps standing.** Enabling into an absent target leaves content that is ON SCREEN where it is —
 *    in its own place while it was disabled, in the target it was last given — and moves it once the target exists.
 * 4. **…and what was not standing yet does not stand up in place.** Content that arrives in the very change that
 *    asks for a missing target (the reveal claimed by a colony stage whose zone renders later) would mount in the
 *    teleport's own place and move a tick later — two insertions, the arrival told twice (CI 2026-11-08,
 *    `console-pluto-two-colony-sequence`: the dealt card re-inserted). A disabled teleport holding nothing waits
 *    UNMOUNTED and goes live as a fresh one: its content mounts straight into the target.
 *
 * THE FORM (V3 step B · B4, 2026-11-13). This was the client's last virtual-DOM component: a render function over the
 * vnode it had returned last, because the four laws read what the previous render had put on screen. On the Vapor
 * teleport they need ONE such fact — «does content stand in place» — and it is read off the DOM between the wrapper's
 * two HOME MARKS (a `ref` on a Vapor `<Teleport>` is `null`, so the wrapper keeps its own handle).
 *
 * A MARK IS A COMMENT NODE, NEVER AN ELEMENT. The wrapper stands among its host's own children — the tiles of the
 * parties' grid, the government's dais, the shell's root — and a host must never have to know it is there: an element,
 * even a `display: none` one, is a child a script counts (`parliamentCardFit` sums the dais' children and their gaps:
 * two hidden `<i>` made the enacted card smaller), a `:first-child` / `:nth-child` / `:empty` a sheet reads. A comment
 * is none of those. The wrapper creates the two nodes itself and the template mounts them as they are
 * (`<component :is>` given a DOM node renders that node — a row of the capability table).
 *
 * The facts of the Vapor teleport it stands on are rows of `tests/client/vapor/vaporCapability.spec.ts` and of its
 * own spec (under a virtual-DOM parent and a Vapor one).
 */
import {nextTick, onBeforeUnmount, PropType, reactive, ref, watch} from 'vue';
import type {Component} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {embedZoneEpoch} from '@/client/console/embedZoneRegistry';

defineOptions({name: 'ConsoleTeleport'});

type TeleportTo = string | HTMLElement;

function resolveTeleportTarget(to: TeleportTo): HTMLElement | null {
  if (typeof to !== 'string') {
    return to;
  }
  try {
    return document.querySelector<HTMLElement>(to);
  } catch {
    return null;
  }
}

const FAST_RETRY_FRAMES = 30;
const SLOW_RETRY_MS = 250;
const STRANDED_MS = 5000;

const props = defineProps({
  to: {type: [String, Object] as PropType<TeleportTo>, required: true},
  disabled: {type: Boolean, default: false},
  /** Kept for the call sites: a declared target re-resolves in its own flush, so there is nothing to defer. */
  defer: {type: Boolean, default: false},
});

const homeStart = document.createComment('');
const homeEnd = document.createComment('');
// (`<component :is>` is typed for components and tag names; the runtime also takes a node and mounts it as it is.)
const homeStartMark = homeStart as unknown as Component;
const homeEndMark = homeEnd as unknown as Component;
const flowScope = useFlowScope('console-teleport');
const epoch = ref(0);
const wait = {cancelFrame: (() => {}) as () => void, cancelTimer: (() => {}) as () => void, active: false, warned: false, since: 0, stranded: false};
const plan = reactive({mounted: false, generation: 0, to: props.to as TeleportTo, disabled: props.disabled});

/** Does the teleport hold content the player can see IN PLACE — an element between the two home marks? */
function standsInPlace(): boolean {
  for (let node = homeStart.nextSibling; node !== null && node !== homeEnd; node = node.nextSibling) {
    if (node.nodeType === 1) {
      return true;
    }
  }
  return false;
}

function stopWaiting(): void {
  wait.cancelFrame();
  wait.cancelTimer();
  wait.active = false;
}

function awaitTarget(): void {
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
    if (resolveTeleportTarget(props.to) !== null) {
      stopWaiting();
      epoch.value++;
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
      console.warn(`[teleport] stranded — ${typeof props.to === 'string' ? `«${props.to}»` : 'an element target'} absent for ${STRANDED_MS / 1000} s; the content stands nowhere`);
    }
    if (frames++ < FAST_RETRY_FRAMES && typeof window.requestAnimationFrame === 'function') {
      wait.cancelFrame = flowScope.afterFrame('the teleport\'s target is looked for', loop);
    } else {
      wait.cancelTimer = flowScope.after(SLOW_RETRY_MS, 'the teleport\'s target is looked for (the slow cadence)', loop);
    }
  };
  void nextTick(() => {
    if (check()) {
      return;
    }
    if (!wait.warned) {
      wait.warned = true;
      console.warn(`[teleport] target ${typeof props.to === 'string' ? `«${props.to}»` : 'element'} is not in the document — the content waits (never mounted into nothing)`);
    }
    loop();
  });
}

/*
 * THE TARGET IS WATCHED WHILE THE CONTENT STANDS IN IT. The virtual-DOM wrapper re-resolved its selector on every
 * render of its parent; a Vapor component has no such render. A declared target (`v-embed-zone`) moves the registry's
 * epoch when it leaves; for any other, the element's own parent is observed — its removal re-asks the document.
 */
let observed: {el: HTMLElement, stop: () => void} | undefined;
function watchTarget(el: HTMLElement | undefined): void {
  if (observed?.el === el) {
    return;
  }
  observed?.stop();
  observed = undefined;
  const parent = el?.parentNode ?? null;
  if (el === undefined || parent === null || typeof MutationObserver === 'undefined') {
    return;
  }
  const observer = new MutationObserver(() => {
    if (!el.isConnected) {
      epoch.value++;
    }
  });
  observer.observe(parent, {childList: true});
  observed = {el, stop: () => observer.disconnect()};
}

/** THE DECISION — the wrapper's four laws over what stands now. */
function decide(): void {
  const target = resolveTeleportTarget(props.to);
  const live = plan.mounted;
  const wasDisabled = live && plan.disabled;
  if (target === null) {
    watchTarget(undefined);
    if (props.disabled) {
      // In place: the target does not matter yet (the body stands in for it — an absent selector is a warning).
      plan.disabled = true;
      if (!live) {
        plan.to = document.body;
      }
      plan.mounted = true;
      return;
    }
    awaitTarget();
    if (!live) {
      return; // LAW 1 — nothing mounts into nothing
    }
    if (wasDisabled && !standsInPlace()) {
      plan.mounted = false; // LAW 4 — nothing stood: it waits unmounted, its content mounts straight into the target
    }
    // LAW 3 — what stands keeps standing where it is: in place while it was disabled, in the target it was given
    // (one that left the document, or the old one while `to` names one that is not there yet).
    return;
  }
  stopWaiting();
  if (live && wasDisabled && !props.disabled && !standsInPlace()) {
    plan.generation++; // LAW 4 — a fresh teleport: the arriving content is inserted once, into the target
  }
  plan.to = target; // LAW 2 — the element: a replaced node is a changed `to`, and the Vapor teleport moves
  plan.disabled = props.disabled;
  plan.mounted = true;
  watchTarget(props.disabled ? undefined : target);
}

// What the wrapper is TOLD — its props, its own wait — is decided on the spot: the teleport's props change in the
// very assignment, before the host's content of that change is rendered (law 4 reads what stood BEFORE it).
watch([() => props.to, () => props.disabled, epoch], decide, {flush: 'sync'});
// A DECLARED target is another matter. Its directive moves the registry's epoch when the element is CREATED — a Vapor
// render creates a block and inserts it afterwards — so asked on the spot the document does not hold the zone yet,
// and the content would move a TICK later (the registry's echo): after the flush's post hooks had measured it where
// it stood (`console-parliament-sitting-v3` on the first Vapor wrapper: the ruler's tile stood nowhere for the first
// sample of the verdict). So this reaction is a JOB of the flush that is creating the zone: it runs when the render
// that inserts the element is over, and before anything of that flush measures — where the virtual-DOM wrapper's own
// render used to stand.
watch(() => embedZoneEpoch(), decide);
decide();

onBeforeUnmount(() => {
  stopWaiting();
  watchTarget(undefined);
});
</script>
