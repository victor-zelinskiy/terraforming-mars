<template>
  <Teleport to="body">
    <Transition name="effect-detail-modal">
      <div v-if="open && cardName !== undefined"
           class="effect-detail-modal-overlay"
           @click.self="close">
        <div class="effect-detail-modal" role="dialog" aria-modal="true">
          <span class="effect-detail-modal__tick effect-detail-modal__tick--tl" aria-hidden="true"></span>
          <span class="effect-detail-modal__tick effect-detail-modal__tick--br" aria-hidden="true"></span>

          <header class="effect-detail-modal__header">
            <span class="effect-detail-modal__glyph" aria-hidden="true">✦</span>
            <span class="effect-detail-modal__kicker" v-i18n>Effect triggered</span>
            <span v-if="ownerColor !== undefined"
                  class="journal-player effect-detail-modal__owner"
                  :class="'player_translucent_bg_color_' + ownerColor">
              <span class="journal-player__dot" :class="'player_bg_color_' + ownerColor" aria-hidden="true"></span>
              <span class="journal-player__name">{{ ownerName }}</span>
            </span>
            <button type="button" class="effect-detail-modal__close" :aria-label="$t('Close')" @click="close">✕</button>
          </header>

          <!-- Multi-effect card: pick which effect to inspect. -->
          <div v-if="entries.length > 1" class="effect-detail-modal__tabs">
            <button v-for="(e, i) in entries"
                    :key="e.key"
                    type="button"
                    class="effect-detail-modal__tab"
                    :class="{'effect-detail-modal__tab--active': i === selectedIndex}"
                    @click="selectedIndex = i">{{ i + 1 }}</button>
          </div>

          <div class="effect-detail-modal__body">
            <EffectDetailsPanel
              :entry="entry"
              :effectCount="entries.length"
              :siblingIcons="siblingIcons"
              :stat="stat"
              :card="cardModel"
              :loading="loading" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref, watch} from 'vue';
import {paths} from '@/common/app/paths';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import EffectDetailsPanel from '@/client/components/effects/EffectDetailsPanel.vue';
import {playerEffects, EffectEntry} from '@/client/components/effects/effectExtraction';
import {effectDetailState, closeEffectDetail} from '@/client/components/notifications/effectDetailState';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

/**
 * Per-effect DETAIL modal opened from a «сработал эффект» notification — shows
 * ONE card's passive effect: its graphic, description + the per-game stats,
 * by REUSING the «Эффекты» overlay's `EffectDetailsPanel`. Mirrors the
 * additional-resources modal style. App-level (Teleport), read-only. Fetches the
 * effect owner's `/api/game/effect-stats` so the panel shows real numbers; falls
 * back to the base rule + thematic note when stats are unavailable.
 */
defineOptions({name: 'EffectDetailOverlay'});
const props = defineProps({
  viewerId: {
    type: String,
    default: '',
  },
  players: {
    type: Array as () => ReadonlyArray<PublicPlayerModel>,
    default: () => [],
  },
});

const selectedIndex = ref(0);
const loading = ref(false);
const stats = ref<ReadonlyArray<EffectOverlayStat> | undefined>(undefined);

const open = computed((): boolean => {
  return effectDetailState.open;
});
const cardName = computed(() => {
  return effectDetailState.cardName;
});
const ownerColor = computed(() => {
  return effectDetailState.ownerColor;
});
const cardModel = computed((): CardModel | undefined => {
  return cardName.value === undefined ? undefined : {name: cardName.value};
});
const entries = computed((): ReadonlyArray<EffectEntry> => {
  return cardModel.value === undefined ? [] : playerEffects([cardModel.value]);
});
const entry = computed((): EffectEntry | undefined => {
  return entries.value[selectedIndex.value] ?? entries.value[0];
});
const siblingIcons = computed((): ReadonlyArray<string> => {
  const out: Array<string> = [];
  entries.value.forEach((e, i) => {
    if (i !== selectedIndex.value) {
      out.push(...e.signature.icons);
    }
  });
  return out;
});
const stat = computed((): EffectOverlayStat | undefined => {
  return stats.value?.find((s) => s.card === cardName.value);
});
const ownerName = computed((): string => {
  const c = ownerColor.value;
  if (c === undefined) {
    return '';
  }
  return displayNameForColor(props.players, c);
});

function close(): void {
  closeEffectDetail();
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    close();
  }
}
async function fetchStats(): Promise<void> {
  stats.value = undefined;
  const color = ownerColor.value;
  if (color === undefined || props.viewerId === '' || typeof fetch !== 'function') {
    return; // playground / no auth → base rule + thematic note only
  }
  loading.value = true;
  try {
    const url = `${apiUrl(paths.API_GAME_EFFECT_STATS)}?id=${encodeURIComponent(props.viewerId)}&color=${encodeURIComponent(color)}`;
    const res = await fetch(url);
    if (res.ok) {
      stats.value = await res.json() as ReadonlyArray<EffectOverlayStat>;
    }
  } catch (e) {
    // ignore — the panel degrades to the base rule + note
  } finally {
    loading.value = false;
  }
}

watch(() => open.value, (isOpen: boolean): void => {
  if (isOpen) {
    selectedIndex.value = 0;
    window.addEventListener('keydown', onKey);
    void fetchStats();
  } else {
    window.removeEventListener('keydown', onKey);
  }
});
onBeforeUnmount((): void => {
  window.removeEventListener('keydown', onKey);
});
</script>
