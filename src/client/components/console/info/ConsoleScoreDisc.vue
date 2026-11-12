<template>
  <span class="con-dscore__disc" :data-score-disc="glyph.kind" aria-hidden="true">
    <i v-if="glyph.kind === 'icon'" class="con-dscore__glyph" :class="iconClass(glyph.icon)"></i>
    <i v-else-if="glyph.kind === 'tile'" class="con-dscore__glyph con-dscore__glyph--tile" :class="'con-dscore__glyph--' + glyph.tile"></i>
    <span v-else-if="glyph.kind === 'emblems'" class="con-dscore__emblems" :data-emblems="glyph.slugs.length">
      <img v-for="slug in glyph.slugs" :key="slug" class="con-dscore__emblem" :src="maArt(slug)" alt="" />
    </span>
    <BarButtonIcon v-else-if="glyph.kind === 'line'" class="con-dscore__glyph con-dscore__glyph--line" :name="glyph.icon" />
    <i v-else class="con-dscore__glyph con-dscore__glyph--mark"></i>
  </span>
</template>

<script setup lang="ts">
/*
 * A SCORE CATEGORY'S MEDALLION DISC — the category's own symbol (the TR badge, the city / greenery tile, the card, the
 * earned emblems) in a disc ringed in the category's hue (`--eg-c`, set by the host's `.con-eg-cat--*`). ONE object in
 * every host that names a category by its symbol: the dossier's score medallions and the score explorer's overview
 * tiles (PL-574) — never two lookalike drawings.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {PropType} from 'vue';
import {DossierGlyph} from '@/client/console/infoDossierModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {maArtPath} from '@/client/console/maArt';
import {getPreferences} from '@/client/utils/PreferencesManager';

defineOptions({name: 'ConsoleScoreDisc'});
defineProps({
  glyph: {type: Object as PropType<DossierGlyph>, required: true},
});

function iconClass(icon: string): string {
  return iconClassFor(icon);
}
function maArt(slug: string): string {
  return maArtPath(slug, getPreferences().lang);
}
</script>
