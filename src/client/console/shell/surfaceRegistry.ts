/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SURFACE REGISTRY — how a controller reaches a surface of the shell (architecture v2 —
 * docs/claude/console/architecture-v2/PLAN.md §5 · S3; the road to `createVaporApp(App)` —
 * docs/claude/vapor/ROADMAP.md §1.1).
 *
 * A controller taken out of `ConsoleShell.vue` used to reach the hand section, the colonies section, the card viewer
 * through `shell.$refs.<name>` — the Options-API instance's bag of template refs. Two things were wrong with it:
 *
 *  · it is a property of an INSTANCE. A `<script setup>` / Vapor component has no `$refs`, and a ref of a Vapor child
 *    carries only what the child exposes — every one of those 117 reads was a line the shell's own conversion would
 *    have had to rewrite, with nothing saying what a controller actually needs of a surface;
 *  · the bag is untyped and unnamed: `shell.$refs.anything` compiles, and «which surfaces does the pad router
 *    drive» was a grep.
 *
 * Now a surface STANDS UNDER A NAME while it is mounted, and a controller asks for it by that name:
 *
 *   <ConsoleHandSection :ref="surfaces.bind.handSection" … />          // the shell's template
 *   shell.surfaces.at<HandSectionSurface>('handSection')?.restoreScroll(px);   // a controller
 *
 * `bind.<name>` is a FUNCTION ref: Vue calls it with the surface at the very moment it used to write the string ref
 * (after the patch, before the `mounted` hooks and before every post-flush watcher) and with `null` when the surface
 * is unmounted — the timing of every read is what it was. What stands under a name is whatever the tag's ref yields:
 * a virtual-DOM component's public instance today, a Vapor component's EXPOSED object after its conversion (so «what
 * a controller needs of a surface» becomes that component's `defineExpose`, read off the type argument of `at`), an
 * element for a plain tag.
 *
 * NAMES ARE A CLOSED LIST (`SURFACE_NAMES`): a typo is a compile error, and the list is the answer to «which surfaces
 * do the controllers reach». A new surface a controller must reach is a new name here and a `:ref` in the template —
 * never a `$refs` read (the debt ledger's `surface-by-ref` row is zero and may not grow).
 *
 * NOT reactive on purpose: `$refs` never was, and a controller's `computed` that started to depend on «is it
 * mounted» would re-evaluate on every mount.
 */
import {markRaw} from 'vue';

export const SURFACE_NAMES = [
  // the workspaces and sections
  'boardSection', 'handSection', 'coloniesSection', 'parliamentSection', 'hydroSection', 'cardActions', 'stdpScreen',
  'maScreen', 'infoMode', 'startScene', 'endgameWs', 'draftWs', 'extDrawWs', 'deckPick', 'playedOverlay',
  // the decision surfaces
  'taskHost', 'playConfirm', 'actionConfirm', 'corpFirstConfirm', 'effectDecision', 'repeatPick', 'revealOverlay',
  'venusBonus', 'spendHeat', 'prodLoss', 'govSupport', 'botAttack', 'aresGlobals',
  // the journal and the viewer
  'journalPanel', 'journalInspect', 'cardZoom', 'zoomRulesPanel', 'zoomInspectSide', 'zoomAsidePanel', 'zoomFlightProxy',
] as const;

export type SurfaceName = typeof SURFACE_NAMES[number];

export type SurfaceRegistry = {
  /** The surface standing under `name` right now; `undefined` while it is not mounted. `T` is what the caller needs of it. */
  at<T>(name: SurfaceName): T | undefined;
  /** The template side — `:ref="surfaces.bind.<name>"`. One stable function per name. */
  readonly bind: Readonly<Record<SurfaceName, (surface: unknown) => void>>;
  /** The names that stand right now (diagnostics; a spec). */
  standing(): Array<SurfaceName>;
};

export function createSurfaceRegistry(): SurfaceRegistry {
  const stands = new Map<SurfaceName, unknown>();
  const bind = {} as Record<SurfaceName, (surface: unknown) => void>;
  for (const name of SURFACE_NAMES) {
    bind[name] = (surface: unknown) => {
      if (surface === null || surface === undefined) {
        stands.delete(name);
        return;
      }
      stands.set(name, surface);
    };
  }
  // Raw: the registry holds component instances — it must never be walked by a reactive proxy (it is setup state).
  return markRaw({
    at<T>(name: SurfaceName): T | undefined {
      return stands.get(name) as T | undefined;
    },
    bind,
    standing: () => [...stands.keys()],
  });
}
