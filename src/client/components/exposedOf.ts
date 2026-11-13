/*
 * WHAT A REF ON A COMPONENT ANSWERS — its type, for both forms a component has (docs/claude/vapor/ROADMAP.md § 4a).
 *
 * `InstanceType<typeof Child>` is right for a virtual-DOM component only: there the type of a `.vue` module is a
 * constructor, and its instance carries what the component exposed. The type of a `<script setup vapor>` module is a
 * FUNCTION — `(props, ctx, expose: (exposed) => void, …) => …` — and `InstanceType` of it does not compile (116 sites
 * on the whole client flipped). `ExposedOf<typeof Child>` reads the constructor's instance for the first form and the
 * `expose` parameter for the second, so a ref's type does not change the day its component gains `vapor`:
 *
 *     const zoom = useTemplateRef<ExposedOf<typeof CardZoomModal>>('zoom');
 *     shell.surfaces.at<ExposedOf<typeof ConsoleColoniesSection>>('coloniesSection')
 *
 * (The shape of `vue-component-type-helpers`' `ComponentExposed`, kept here so the client does not lean on a
 * transitive package of the type checker.) What it answers for a Vapor component is its `defineExpose` object and
 * NOTHING else — no `$el` (components/rootEl.ts), no `$props`. Guard: tests/console/exposedOf.spec.ts.
 */
export type ExposedOf<T> =
  T extends new (...args: any) => infer Instance ? Instance :
    T extends (props: any, ctx: any, expose: (exposed: infer Exposed) => any, ...args: any) => any ? NonNullable<Exposed> :
      never;
