<template>
  <div v-if="stage.card !== undefined" :key="stage.serial" ref="root" class="con-bstage" :class="['con-bstage--' + stage.phase, 'con-bstage--from-' + stage.origin]"
       :style="{'--bstage-zoom': String(zoom)}"
       data-banner-stage :data-banner-stage-phase="stage.phase" :data-banner-stage-card="stage.card" :data-banner-stage-party="stage.party">
    <div class="con-bstage__lift">
      <div class="con-bstage__face" data-banner-stage-face>
        <Card :card="model" :inert="true" :artTier="artTier" />
      </div>
      <div class="con-bstage__caption" data-banner-stage-caption>
        <span class="con-bstage__kicker">{{ $t('Party banner') }}</span>
        <span class="con-bstage__line">
          <span class="con-bstage__cube"><PlayerCube v-if="stage.color !== undefined" :color="stage.color" :size="20" :glow="false" :shadow="false" /></span>
          <span class="con-bstage__arrow" aria-hidden="true">→</span>
          <img v-if="stage.party !== undefined" class="con-bstage__emblem" :src="emblemOf(stage.party)" alt="" />
          <b v-if="stage.party !== undefined" class="con-bstage__party" :style="{color: accentOf(stage.party)}">{{ $t(partyNameKey(stage.party)) }}</b>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * ══ THE CORPORATION RISES, THE CUBE LEAVES IT (Septem Tribus:redux — `bannerCubeStage.ts`): the card whose effect
 * puts a cube on a banner stands up in the voting table's own cell — the bills recede under it, nothing flies to or
 * from them in this beat — and the cube is born on its PRINTED cube glyph and carried onto the party's banner.
 * Under the card one line says what is happening, in the hall's own objects: the cube → the party. The phrase is the
 * module's (rise · stand · carry · read · sink); this surface only draws it. No light: the card is raised by its
 * size and a contact shadow, the effect's press is a transform (invariant 15). ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onMounted, ref, useTemplateRef, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import {CardModel} from '@/common/models/CardModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import Card from '@/client/components/card/CardFace.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {bannerCubeStage} from '@/client/console/parliament/bannerCubeStage';

/** The face's natural box (the premium card's design space). */
const FACE_W = 320;
const FACE_H = 460;

defineOptions({name: 'ConsoleBannerCubeStage'});

const root = useTemplateRef<HTMLElement>('root');
const zoom = ref(1);
const stage = bannerCubeStage;
const model = computed((): CardModel => {
  return {name: bannerCubeStage.card} as CardModel;
});
const artTier = computed((): CardArtTier => {
  return artTierForWidth(FACE_W * zoom.value);
});

function emblemOf(party: ReduxParty): string {
  return partyEmblemUrl(party);
}
function accentOf(party: ReduxParty): string {
  return partyAccent(party);
}
/** THE FACE, solved from the cell (never a fixed size): as tall as the cell leaves under the caption, at most half its width. */
function fit(): void {
  const rootNow = root.value;
  if (rootNow === null || rootNow.clientWidth <= 0 || rootNow.clientHeight <= 0) {
    return;
  }
  const caption = rootNow.querySelector<HTMLElement>('.con-bstage__caption');
  const ui = conUiScale();
  const availH = rootNow.clientHeight - (caption?.offsetHeight ?? 40 * ui) - 28 * ui;
  const availW = rootNow.clientWidth * 0.5;
  const zoomNow = Math.max(0.3 * ui, Math.min(availH / FACE_H, availW / FACE_W, 1.6 * ui));
  zoom.value = Math.floor(zoomNow * 1000) / 1000;
}

// A new cube is a new rise: the face is solved against the cell before its first painted frame.
watch(() => stage.serial, (): void => {
  fit();
}, {flush: 'post'});
onMounted(() => {
  fit();
});
</script>
