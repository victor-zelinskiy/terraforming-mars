/*
 * ConsoleTileProxy's MODULE level (docs/claude/vapor/RECIPES.md § R25). A `<script setup>` block may not export a
 * value, so `tileProxyEls` — which every stage that lays the proxy down imports (the Mars landing layer, the colony
 * city layer) — lives here, with the type it returns (a `.ts` module cannot take a type through the `.vue` shim).
 */

/** The proxy's parts as its directors address them — resolved off the root, so no ref travels through a component boundary. */
export type TileProxyEls = {
  tile: HTMLElement,
  edge: HTMLElement | undefined,
  art: HTMLElement | undefined,
  touch: HTMLElement | undefined,
};

/** The parts of a mounted proxy (`undefined` while it is not in the document). */
export function tileProxyEls(root: HTMLElement | null | undefined): TileProxyEls | undefined {
  if (!root || !root.isConnected) {
    return undefined;
  }
  return {
    tile: root,
    edge: root.querySelector<HTMLElement>(':scope > .con-tileplace__edge') ?? undefined,
    art: root.querySelector<HTMLElement>(':scope > .con-tileplace__art') ?? undefined,
    touch: root.querySelector<HTMLElement>(':scope > .con-tileplace__touch') ?? undefined,
  };
}
