/**
 * An element's top in LAYOUT — its `offsetTop` chain (plus each offset parent's top border) — which NO TRANSFORM
 * moves. `getBoundingClientRect` reads a box where its motion has it: measured during an entrance (the unfold's
 * `translateY`), a box reads lower than it stands, and a size solved off that stays short once the motion ends —
 * nothing resizes to say so (the P43 target selector's slot came out 53–84 px short at 4K, the second row did not stand).
 * Compare two of these (the same chain), never one against a client rect.
 */
export function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (let at: HTMLElement | null = el; at !== null;) {
    top += at.offsetTop;
    const parent = at.offsetParent as HTMLElement | null;
    top += parent?.clientTop ?? 0;
    at = parent;
  }
  return top;
}

/** How far `el`'s layout box starts below `ancestor`'s (transform-free — see `layoutTop`). */
export function layoutTopWithin(el: HTMLElement, ancestor: HTMLElement): number {
  return layoutTop(el) - layoutTop(ancestor);
}
