<template>
  <div class="effect-group"
       :class="{
         'effect-group--corp': group.isCorporation,
         'effect-group--disabled': group.isDisabled,
       }"
       :data-test="'effect-block-' + group.key">
    <div class="effect-group__label">
      <span class="effect-group__accent" aria-hidden="true"></span>
      <span class="effect-group__source" v-i18n>{{ group.cardName }}</span>
      <span v-if="resourceChip" class="effect-group__res" :title="$t('on this card')">
        <span class="effect-group__res-icon" :class="resIconClass" aria-hidden="true"></span>
        <span class="effect-group__res-count">{{ resourceCount }}</span>
      </span>
      <span class="effect-group__type" aria-hidden="true">
        <span v-if="group.isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
    </div>
    <div class="effect-group__items">
      <div v-for="eff in group.effects"
           :key="eff.key"
           class="effect-item"
           :class="{'effect-item--selected': eff.key === selectedKey}"
           tabindex="0"
           role="button"
           :aria-pressed="eff.key === selectedKey"
           @mouseenter="onEnter(eff.key)"
           @mouseleave="onLeave"
           @focus="onEnter(eff.key)"
           @blur="onLeave"
           @click="onClick(eff.key)"
           @keydown.enter="onClick(eff.key)"
           :data-test="'effect-item-' + eff.key">
        <!-- The card frame + the row buttons make the grouping obvious — no `i/N`
             ordinal chip needed on the grid (it survives only in the details head). -->
        <div v-if="eff.effectNode !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
          <CardRenderEffectBoxComponent :effectData="eff.effectNode" />
        </div>
        <div v-else-if="eff.renderRoot !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
          <CardRenderData :renderData="eff.renderRoot" />
        </div>
        <div v-else class="effect-item__text" v-i18n v-strip-effect-prefix>{{ eff.text }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * One SOURCE group. The source (card / corporation) is named ONCE in a light
 * auxiliary label (+ a live resource badge when it holds one); EACH passive
 * effect it grants is its OWN bordered, SEPARATELY-SELECTABLE block — a card with
 * several effects (Pharmacy Union, Splice, Advanced Alloys, …) shows several
 * blocks, each independently hover/click/highlightable, each opening ITS OWN
 * details on the right. The grid card is ICONS-ONLY (the rule's prose description
 * is hidden here — see `effects_overlay.less` — and lives in the details panel),
 * so the grid stays clean + fast to scan.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n, vStripEffectPrefix} from '@/client/directives/vDirectives';
import {CardModel} from '@/common/models/CardModel';
import {EffectGroup} from '@/client/components/effects/effectExtraction';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';

defineOptions({name: 'EffectBlock'});
const props = defineProps({
  group: {
    type: Object as PropType<EffectGroup>,
    required: true,
  },
  // The live tableau model (for the resource badge), if any.
  card: {
    type: Object as PropType<CardModel>,
    default: undefined,
  },
  // The selected EFFECT key (`<cardName>#<i>`) — highlights the matching block.
  selectedKey: {
    type: String,
    default: undefined,
  },
});
const emit = defineEmits(['namehover', 'open']);

const resourceType = computed((): string | undefined => {
  const r = getCard(props.group.cardName)?.resourceType;
  return r !== undefined ? String(r) : undefined;
});
const resourceChip = computed((): boolean => {
  return resourceType.value !== undefined && props.card !== undefined;
});
const resourceCount = computed((): number => {
  return props.card?.resources ?? 0;
});
const resIconClass = computed((): string => {
  return resourceType.value !== undefined ? iconClassFor(resourceType.value) : '';
});
function onEnter(key: string): void {
  emit('namehover', key);
}
function onLeave(): void {
  emit('namehover', null);
}
function onClick(key: string): void {
  emit('open', key);
}
</script>
