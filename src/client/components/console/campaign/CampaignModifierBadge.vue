<template>
  <span class="cmod" :class="{'cmod--stamp': stamp}" :style="stampStyle" :data-mission-modifier="meta.id">
    <span class="cmod__glyph" aria-hidden="true">
      <svg v-if="meta.glyph === 'dice'" viewBox="0 0 16 16" class="cmod__svg">
        <rect x="1.6" y="1.6" width="12.8" height="12.8" rx="3" class="cmod__die" />
        <circle cx="5.2" cy="5.2" r="1.25" class="cmod__pip" />
        <circle cx="8" cy="8" r="1.25" class="cmod__pip" />
        <circle cx="10.8" cy="10.8" r="1.25" class="cmod__pip" />
      </svg>
      <svg v-else-if="meta.glyph === 'shuffle'" viewBox="0 0 16 16" class="cmod__svg">
        <path d="M1.8 4.6h2.6c1.6 0 2.5.7 3.4 2.1l1.2 2.6c.9 1.4 1.8 2.1 3.4 2.1h1.6" class="cmod__stroke" />
        <path d="M1.8 11.4h2.6c1.6 0 2.5-.7 3.4-2.1l1.2-2.6c.9-1.4 1.8-2.1 3.4-2.1h1.6" class="cmod__stroke" />
        <path d="M12.4 2.8l1.8 1.8-1.8 1.8M12.4 9.4l1.8 1.8-1.8 1.8" class="cmod__stroke" />
      </svg>
    </span>
    <span class="cmod__label">{{ $t(meta.shortKey) }}</span>
  </span>
</template>

<script setup lang="ts">
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {MissionModifierMeta} from '@/client/console/campaign/missionModifierMeta';

/**
 * ONE mission modifier's badge — the roguelike mark a route card wears when
 * its mission was generated with a rolled condition. Material, never light:
 * a dark plate, a bronze hairline, a glyph and a tracked-caps word. `stamp`
 * plays the ONE-SHOT seal at the route's reveal (the modifier is an event of
 * the generation the player must not miss — then it simply stands).
 */
defineOptions({name: 'CampaignModifierBadge'});
const props = defineProps({
  meta: {type: Object as PropType<MissionModifierMeta>, required: true},
  stamp: {type: Boolean, default: false},
  stampDelayMs: {type: Number, default: 0},
});

const stampStyle = computed((): Record<string, string> | undefined => {
  return props.stamp ? {'--cmod-delay': `${props.stampDelayMs}`} : undefined;
});
</script>
