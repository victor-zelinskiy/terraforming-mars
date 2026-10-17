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
import {ObjectDirective, reactive} from 'vue';

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

/** The directive a zone element wears. No argument: the element is matched
 *  against whatever selector a publisher names. */
export const vEmbedZone: ObjectDirective<HTMLElement> = {
  mounted(el: HTMLElement): void {
    zones.add(el);
    registry.epoch++;
  },
  unmounted(el: HTMLElement): void {
    zones.delete(el);
    registry.epoch++;
  },
};

/** Spec seam: forget every registered zone. */
export function resetEmbedZones(): void {
  zones.clear();
  registry.epoch++;
}
