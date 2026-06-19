<template>
  <!--
    Premium "Гидросеть Марса" overlay — the Delta Project as a global engineering
    subsystem. A two-row snake track (players shown ON the stages, click any stage
    to plan or inspect) + an embedded action-zone that switches between PLAN mode
    (future target: energy / route / reward / confirm) and DETAILS mode
    (current/passed stage: per-player history). Legality is server-authoritative.
  -->
  <div class="hydronetwork-overlay" role="region" :aria-label="$t('Mars Hydronetwork')">
    <span class="hydronetwork-overlay__corner hydronetwork-overlay__corner--tl" aria-hidden="true"></span>
    <span class="hydronetwork-overlay__corner hydronetwork-overlay__corner--tr" aria-hidden="true"></span>
    <span class="hydronetwork-overlay__corner hydronetwork-overlay__corner--bl" aria-hidden="true"></span>
    <span class="hydronetwork-overlay__corner hydronetwork-overlay__corner--br" aria-hidden="true"></span>

    <header class="hydro-board__header">
      <div class="hydro-board__context">
        <span class="hydro-board__glyph" aria-hidden="true">≈</span>
        <div class="hydro-board__titles">
          <h2 class="hydro-board__title" v-i18n>Mars Hydronetwork</h2>
          <p class="hydro-board__lore" v-i18n>
            After the oceans were built, erosion, landslides and subsidence began. The corporations
            jointly engineer the Mars Hydronetwork — dams, pumping stations, drainage and protective works.
          </p>
        </div>
      </div>
      <button type="button" class="hydro-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <div class="hydro-board__body">
      <div class="hydro-board__track-wrap">
        <HydroTrack :stages="model.stages" @select="onSelectPosition" />
      </div>
      <HydroActionZone
        class="hydro-board__action"
        :model="model"
        :rewardChoice="rewardChoice"
        :actionAvailable="actionAvailable"
        @spend="onSpend"
        @choice="onChoice"
        @plan="onPlan"
        @confirm="onConfirm" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {$t} from '@/client/directives/i18n';
import {buildHydroModel, HydroModel} from './hydroNetworkModel';
import {hydroNetworkState, resetHydroPlan} from './hydroNetworkState';
import HydroTrack from './HydroTrack.vue';
import HydroActionZone from './HydroActionZone.vue';

export default defineComponent({
  name: 'HydroNetworkOverlay',
  components: {HydroTrack, HydroActionZone},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    viewerId: {
      type: String,
      required: true,
    },
    actionAvailable: {
      type: Boolean,
      default: false,
    },
    cacheKey: {
      type: String,
      default: '',
    },
  },
  emits: ['close', 'confirm'],
  computed: {
    viewerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    rewardChoice(): number | undefined {
      return hydroNetworkState.rewardChoice;
    },
    preview(): DeltaTrackPreviewModel | undefined {
      return hydroNetworkState.previewColor === this.viewerColor ? hydroNetworkState.preview : undefined;
    },
    model(): HydroModel {
      const players = this.playerView.players.map((p) => ({
        color: p.color,
        name: p.name,
        position: p.deltaProject?.position ?? 0,
        isViewer: p.color === this.viewerColor,
        stops: p.deltaProject?.stops ?? [],
      }));
      return buildHydroModel({
        preview: this.preview,
        players,
        viewerColor: this.viewerColor,
        selectedPosition: hydroNetworkState.selectedPosition,
        rewardChoice: hydroNetworkState.rewardChoice,
        actionAvailable: this.actionAvailable,
      });
    },
  },
  watch: {
    cacheKey(): void {
      this.fetchPreview();
    },
    viewerColor(): void {
      resetHydroPlan();
      this.fetchPreview();
    },
  },
  mounted(): void {
    this.fetchPreview();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    $t,
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.$emit('close');
      }
    },
    onSelectPosition(position: number): void {
      hydroNetworkState.selectedPosition = position;
      // A different destination stage invalidates a pending reward choice.
      hydroNetworkState.rewardChoice = undefined;
    },
    onSpend(spend: number): void {
      this.onSelectPosition(this.model.currentPosition + spend);
    },
    // Return to the default plan target (e.g. from details mode).
    onPlan(): void {
      this.onSelectPosition(this.model.currentPosition + Math.max(1, this.model.defaultSpend));
    },
    onChoice(idx: number): void {
      hydroNetworkState.rewardChoice = idx;
    },
    onConfirm(): void {
      if (!this.model.canConfirm) {
        return;
      }
      this.$emit('confirm', {
        spend: this.model.selectedSpend,
        rewardChoice: this.model.targetNeedsChoice ? hydroNetworkState.rewardChoice : undefined,
      });
    },
    fetchPreview(): void {
      if (typeof fetch !== 'function' || this.viewerId === '') {
        return;
      }
      const color = this.viewerColor;
      const scope = this.cacheKey + ':' + color;
      const url = paths.API_GAME_DELTA_PREVIEW +
        '?id=' + encodeURIComponent(this.viewerId) +
        '&color=' + encodeURIComponent(color);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (p !== undefined) {
            hydroNetworkState.preview = p as DeltaTrackPreviewModel;
            hydroNetworkState.previewColor = color;
            hydroNetworkState.previewScope = scope;
          }
        })
        .catch(() => { /* best-effort: the track still renders from public positions */ });
    },
  },
});
</script>
