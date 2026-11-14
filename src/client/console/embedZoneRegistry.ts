/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE OUTCOME ZONES THAT ACTUALLY EXIST — the readiness half of the embedded
 * outcome, kept apart from the claim on purpose.
 *
 * A workspace publishes WHERE its outcome presents as a SELECTOR
 * (`workspaceOutcomeState.embedSlot`), and the shell teleports one instance of
 * the reveal / the deck pick / the task host / the effect decision into it. A
 * selector describes a node; it does not prove one. Every gate that decided
 * «may the surface go in there now?» asked only «is the selector non-empty?»,
 * and a published selector outlives its node in four ordinary ways — the host
 * unmounts at a «свернуть» while the claim survives, a `v-if` inside the host
 * takes the zone away, the zone renders a flush AFTER the shell's `<Teleport>`
 * is patched (the shell's teleports stand before most hosts in its template),
 * or a publisher names a zone its host is not rendering. In each, Vue resolves
 * the target to nothing, leaves the content in the shell's own flow, and never
 * looks again while the string stays the same — a decision mounted, pickable
 * and invisible under a full-bleed workspace («Корпоративные архивы» after
 * B → A, the field blocker of 2026-10-18), or floating as a bare child of the
 * root (the colony dossier's picker, 2026-09-28). Each was fixed where it
 * shipped; this makes the class unexpressible.
 *
 * A ZONE DECLARES ITSELF: `v-embed-zone` on the element. The registry holds the
 * mounted elements and bumps one reactive epoch on every mount and unmount, so
 * `embedZoneMounted(selector)` — «is a node matching this selector mounted
 * right now?» — re-answers the moment a zone comes or goes. A gate that reads
 * it holds a claimed surface NOWHERE until its zone is really there (the
 * console's own «claimed but not ready» law), and the zone's arrival is itself
 * the change that makes the teleport resolve it.
 *
 * Guard: `tests/console/embedZoneRegistry.spec.ts` — the registry's semantics,
 * and every zone a publisher can name carries the directive.
 */
import {nextTick, ObjectDirective, reactive} from 'vue';

const zones = new Set<HTMLElement>();
const registry = reactive({epoch: 0});

/** Is an element matching `selector` registered and in the document? Reactive
 *  over every zone's mount and unmount. */
export function embedZoneMounted(selector: string): boolean {
  void registry.epoch;
  if (selector === '') {
    return false;
  }
  for (const el of zones) {
    if (el.isConnected && el.matches(selector)) {
      return true;
    }
  }
  return false;
}

/**
 * The registry's EPOCH — a reactive read for a consumer that must re-ask the DOM whenever a declared node comes or
 * goes. `ConsoleTeleport` reads it in its render: a teleport is created BEFORE its host's subtree is in the document
 * (always so under a Vapor parent — a child is created, then the parent's block is inserted), finds no target, and
 * would otherwise look again only on its own clock (a tick, then a frame). A target that wears `v-embed-zone` moves
 * this epoch from its `mounted`, so the teleport re-resolves in that very flush — no gap a frame could paint.
 */
export function embedZoneEpoch(): number {
  return registry.epoch;
}

/** A zone element stands (the directive's `mounted`, in either runtime). */
export function registerEmbedZone(el: HTMLElement): void {
  zones.add(el);
  registry.epoch++;
  // A VAPOR component calls the directive when the element is CREATED — before its block is inserted. A reader that
  // re-asks at once finds a zone that is registered and not in the document yet, and nothing would tell it when the
  // insertion happens (it is the same flush: no reactive edge of its own). So the epoch moves ONCE MORE after that
  // flush, when the element stands in the document. (The virtual DOM calls `mounted` after the insertion: no echo.)
  if (!el.isConnected) {
    void nextTick(() => {
      if (zones.has(el)) {
        registry.epoch++;
      }
    });
  }
}

/** A zone element left (the directive's `unmounted`, in either runtime). */
export function unregisterEmbedZone(el: HTMLElement): void {
  zones.delete(el);
  registry.epoch++;
}

/** The directive a zone element wears. No argument: the element is matched
 *  against whatever selector a publisher names.
 *
 *  THIS IS THE OPTIONS-API FORM — an object of hooks, registered by name (`directives: {embedZone: vEmbedZone}`).
 *  A `<script setup>` component imports the binding of the same name from `@/client/directives/vDirectives`
 *  instead: one function both runtimes call (a Vapor component refuses an object directive). */
export const vEmbedZone: ObjectDirective<HTMLElement> = {
  mounted: registerEmbedZone,
  unmounted: unregisterEmbedZone,
};

/** Spec seam: forget every registered zone. */
export function resetEmbedZones(): void {
  zones.clear();
  registry.epoch++;
}
