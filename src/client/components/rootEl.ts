/*
 * THE ROOT ELEMENT OF A CHILD, FOR A PARENT THAT NEEDS IT (docs/claude/vapor/RECIPES.md § R12 · ROADMAP § 4a · B5).
 *
 * A parent's ref on a child component used to answer `$el`. That is a property of the virtual-DOM instance: a VAPOR
 * child's ref is its `defineExpose` object and nothing else — `$el` is `undefined` there, silently (the whole client
 * flipped, 2026-11-13: the fullscreen viewer never opened, the workspace band lost the rail's edge, the flying tile
 * its proxy — every one a `$el` read off a child). So a child whose root a parent measures, animates or searches SAYS
 * so, by ONE name, and the parent reads that name:
 *
 *     <div ref="root" class="…">                              // the child's template — its root element
 *     const root = useTemplateRef<HTMLElement>('root');
 *     defineExpose({rootEl: root});                           // beside its other members
 *
 *     const child = useTemplateRef<RootElHolder>('child');    // the parent
 *     child.value?.rootEl                                     // HTMLElement | null — the same in both runtimes
 *
 * (an exposed ref is unwrapped by the expose proxy of either runtime). `$el` is not read anywhere in the client —
 * guard: tests/console/childRootEl.spec.ts.
 *
 * Prefer NOT needing it: a parent that wants «the card inside my own stage» asks its own DOM, and a parent that wants
 * something DONE with the child's element asks the child to do it. `rootEl` is for the honest remainder — geometry,
 * a flight's proxy, a motion that owns the whole child.
 */

/** What a parent's ref on such a child answers. */
export type RootElHolder = {readonly rootEl: HTMLElement | null};

/**
 * The element behind a template ref that may hold an ELEMENT or a COMPONENT exposing its root (a ref inside a
 * `v-if` chain of both, a registry of surfaces, a function ref) — `undefined` when there is none.
 */
export function rootElOf(held: unknown): HTMLElement | undefined {
  if (held instanceof HTMLElement) {
    return held;
  }
  if (held === null || typeof held !== 'object') {
    return undefined;
  }
  const el = (held as Partial<RootElHolder>).rootEl;
  return el instanceof HTMLElement ? el : undefined;
}
