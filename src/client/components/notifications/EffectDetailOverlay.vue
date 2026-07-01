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

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import EffectDetailsPanel from '@/client/components/effects/EffectDetailsPanel.vue';
import {playerEffects, EffectEntry} from '@/client/components/effects/effectExtraction';
import {effectDetailState, closeEffectDetail} from '@/client/components/notifications/effectDetailState';

/**
 * Per-effect DETAIL modal opened from a «сработал эффект» notification — shows
 * ONE card's passive effect: its graphic, description + the per-game stats,
 * by REUSING the «Эффекты» overlay's `EffectDetailsPanel`. Mirrors the
 * additional-resources modal style. App-level (Teleport), read-only. Fetches the
 * effect owner's `/api/game/effect-stats` so the panel shows real numbers; falls
 * back to the base rule + thematic note when stats are unavailable.
 */
export default defineComponent({
  name: 'EffectDetailOverlay',
  components: {EffectDetailsPanel},
  props: {
    viewerId: {
      type: String,
      default: '',
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      default: () => [],
    },
  },
  data() {
    return {
      selectedIndex: 0,
      loading: false,
      stats: undefined as ReadonlyArray<EffectOverlayStat> | undefined,
    };
  },
  computed: {
    open(): boolean {
      return effectDetailState.open;
    },
    cardName() {
      return effectDetailState.cardName;
    },
    ownerColor() {
      return effectDetailState.ownerColor;
    },
    cardModel(): CardModel | undefined {
      return this.cardName === undefined ? undefined : {name: this.cardName};
    },
    entries(): ReadonlyArray<EffectEntry> {
      return this.cardModel === undefined ? [] : playerEffects([this.cardModel]);
    },
    entry(): EffectEntry | undefined {
      return this.entries[this.selectedIndex] ?? this.entries[0];
    },
    siblingIcons(): ReadonlyArray<string> {
      const out: Array<string> = [];
      this.entries.forEach((e, i) => {
        if (i !== this.selectedIndex) {
          out.push(...e.signature.icons);
        }
      });
      return out;
    },
    stat(): EffectOverlayStat | undefined {
      return this.stats?.find((s) => s.card === this.cardName);
    },
    ownerName(): string {
      const c = this.ownerColor;
      if (c === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === c)?.name ?? c;
    },
  },
  watch: {
    open(isOpen: boolean): void {
      if (isOpen) {
        this.selectedIndex = 0;
        window.addEventListener('keydown', this.onKey);
        void this.fetchStats();
      } else {
        window.removeEventListener('keydown', this.onKey);
      }
    },
  },
  methods: {
    close(): void {
      closeEffectDetail();
    },
    onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.close();
      }
    },
    async fetchStats(): Promise<void> {
      this.stats = undefined;
      const color = this.ownerColor;
      if (color === undefined || this.viewerId === '' || typeof fetch !== 'function') {
        return; // playground / no auth → base rule + thematic note only
      }
      this.loading = true;
      try {
        const url = `${apiUrl(paths.API_GAME_EFFECT_STATS)}?id=${encodeURIComponent(this.viewerId)}&color=${encodeURIComponent(color)}`;
        const res = await fetch(url);
        if (res.ok) {
          this.stats = await res.json() as ReadonlyArray<EffectOverlayStat>;
        }
      } catch (e) {
        // ignore — the panel degrades to the base rule + note
      } finally {
        this.loading = false;
      }
    },
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKey);
  },
});
</script>
