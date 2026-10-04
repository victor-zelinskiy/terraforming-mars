<template>
  <!--
    THE FLYING TILE — the ONE anatomy of a tile that lands (a twin of the real
    board tile): the thickness EDGE (the same hex art, darkened, offset down —
    the contact compresses it), the ART, and the TOUCH overlay (one quiet
    brightness pass at contact). Its styles are the landing stage's own
    (`.con-tileplace__tile` / `__edge` / `__art` / `__touch`,
    console_tile_placement.less): born invisible, materialized by its director.

    Shared by every stage that lays a tile down — the Mars landing hero
    (ConsoleTilePlacementLayer: the player's own arrival and a remote one) and
    a tile laid on a colony tile (ConsoleColonyCityLayer — Turmoil Redux TR22
    Nova City) — so a piece cannot look different by where it is put.
    The director reads its parts through `tileProxyEls`.
  -->
  <div class="con-tileplace__tile">
    <div class="con-tileplace__edge" :class="artClass"></div>
    <div class="con-tileplace__art" :class="artClass"></div>
    <div class="con-tileplace__touch"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

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

export default defineComponent({
  name: 'ConsoleTileProxy',
  props: {
    /** The board's own tile art class (`board-space-tile--city`, …). */
    artClass: {type: String, required: true},
  },
});
</script>
