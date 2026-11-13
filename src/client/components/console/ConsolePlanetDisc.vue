<template>
  <div class="con-planet"
       :class="[artClass, {'con-planet--lit': lit}]"
       :style="size !== '' ? {'--con-planet-size': size} : undefined"
       aria-hidden="true">
    <span class="con-planet__light" aria-hidden="true"></span>
    <span class="con-planet__terminator" aria-hidden="true"></span>
    <span v-if="lit" class="con-planet__rim" aria-hidden="true"></span>
    <slot />
  </div>
</template>

<script setup lang="ts">
/*
 * THE PLANET DISC — the ONE way a colony's planet art is rendered on every
 * console surface (the overview tile's medallion, the trade stage's hero,
 * the dossier's centrepiece).
 *
 * The art (`assets/colonies-planets/<key>.webp`, `scripts/import-planet-art.mjs`)
 * is a clean 1024² alpha disc: no baked light, no halo, no vignette. So the
 * disc is `background-size: cover` + `center` inside a `border-radius: 50%`
 * box, and THIS component paints the light — a key sheen top-left, an inset
 * terminator bottom-right, the thin cyan atmosphere rim — once, so no host
 * re-draws (or contradicts) it. The host decides the SIZE (`--con-planet-size`
 * on its own element or the `size` prop) and whether the sphere is LIT (the
 * tile keeps a quieter dress; the hero and the dossier the full one).
 *
 * The two light layers carry stable class names because the descend
 * choreography animates them by name (`consoleColonyFocusMotion` — the key
 * light drifts against the body, the rim comes up with the size).
 *
 * The default slot is the ORBIT: a host that seats a fleet berth on the
 * planet puts it here, positioned against the disc.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed} from 'vue';
import {planetArtClass} from '@/client/components/console/consolePlanetDiscModel';

defineOptions({name: 'ConsolePlanetDisc'});
const props = defineProps({
  /** The colony's name — the art key. */
  colony: {type: String, required: true},
  /** The full dress: the key sheen at full strength + the atmosphere rim. */
  lit: {type: Boolean, default: false},
  /** A CSS length for `--con-planet-size` ('' = the host's own token). */
  size: {type: String, default: ''},
});

const artClass = computed((): string => {
  return planetArtClass(props.colony);
});
</script>
