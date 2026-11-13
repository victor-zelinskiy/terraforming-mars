<template>
  <div ref="root" class="con-tileplace__tile">
    <div class="con-tileplace__edge" :class="artClass"></div>
    <div class="con-tileplace__art" :class="artClass"></div>
    <div class="con-tileplace__touch"></div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE FLYING TILE — the ONE anatomy of a tile that lands (a twin of the real
 * board tile): the thickness EDGE (the same hex art, darkened, offset down —
 * the contact compresses it), the ART, and the TOUCH overlay (one quiet
 * brightness pass at contact). Its styles are the landing stage's own
 * (`.con-tileplace__tile` / `__edge` / `__art` / `__touch`,
 * console_tile_placement.less): born invisible, materialized by its director.
 *
 * Shared by every stage that lays a tile down — the Mars landing hero
 * (ConsoleTilePlacementLayer: the player's own arrival and a remote one) and
 * a tile laid on a colony tile (ConsoleColonyCityLayer — Turmoil Redux TR22
 * Nova City) — so a piece cannot look different by where it is put.
 * The director reads its parts through `tileProxyEls`.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {useTemplateRef} from 'vue';

defineOptions({name: 'ConsoleTileProxy'});
defineProps({
  /** The board's own tile art class (`board-space-tile--city`, …). */
  artClass: {type: String, required: true},
});
// Its root — what `tileProxyEls` reads the proxy's parts off — for the stage that flies it (components/rootEl.ts).
const root = useTemplateRef<HTMLElement>('root');
defineExpose({rootEl: root});
</script>
