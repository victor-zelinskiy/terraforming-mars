<template>
  <Teleport to="body">
    <Transition name="aux-detail">
      <div
        v-if="group !== undefined && player !== undefined"
        class="additional-resource-detail-overlay"
        data-test="additional-resource-detail-overlay"
        @click.self="close">
        <div class="additional-resource-detail" :class="modeClass">
          <span class="additional-resource-detail__tick additional-resource-detail__tick--tl" aria-hidden="true"></span>
          <span class="additional-resource-detail__tick additional-resource-detail__tick--br" aria-hidden="true"></span>

          <header class="additional-resource-detail__header">
            <i class="card-resource additional-resource-detail__icon" :class="iconClass" aria-hidden="true"></i>
            <div class="additional-resource-detail__title">
              <div class="additional-resource-detail__name">{{ resourceName }}</div>
              <div class="additional-resource-detail__subtitle" v-i18n>Resources stored on cards</div>
            </div>
            <div class="additional-resource-detail__total">
              <span class="additional-resource-detail__total-label" v-i18n>Total</span>
              <span class="additional-resource-detail__total-value">
                {{ group.total }}
                <AnimatedMetricValue
                  :value="group.total"
                  :metricKey="totalMetricKey"
                  :scopeKey="detailScope"
                  :epoch="epoch"
                  variant="score" />
              </span>
            </div>
            <div class="additional-resource-detail__player" :class="'player_color_' + player.color">
              <span class="additional-resource-detail__player-dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
              <span class="additional-resource-detail__player-name">{{ isViewer ? $t('You') : playerLabel }}</span>
            </div>
            <button class="additional-resource-detail__close" type="button" :aria-label="$t('Close')" @click="close">✕</button>
          </header>

          <div class="additional-resource-detail__summary">
            <span class="additional-resource-detail__stat">
              <span class="additional-resource-detail__stat-label" v-i18n>Cards</span>
              <span class="additional-resource-detail__stat-value">{{ cardCount }}</span>
            </span>
            <span class="additional-resource-detail__stat-sep" aria-hidden="true"></span>
            <span class="additional-resource-detail__stat">
              <span class="additional-resource-detail__stat-label" v-i18n>With stock</span>
              <span class="additional-resource-detail__stat-value">{{ nonZeroCount }}</span>
            </span>
            <template v-if="hasScoring">
              <span class="additional-resource-detail__stat-sep" aria-hidden="true"></span>
              <span class="additional-resource-detail__stat additional-resource-detail__stat--vp">
                <span class="additional-resource-detail__stat-label" v-i18n>VP</span>
                <span class="additional-resource-detail__stat-value">{{ totalAccumulatedVp }}</span>
              </span>
            </template>
          </div>

          <div class="additional-resource-detail__body">
            <div class="additional-resource-detail__grid">
              <div
                v-for="s in summaries"
                :key="s.entry.name"
                class="additional-resource-detail__card"
                :class="{
                  'additional-resource-detail__card--zero': s.entry.amount === 0,
                  'additional-resource-detail__card--special': s.special !== undefined && s.special.replacesCardChrome === true,
                }"
                data-test="additional-resource-detail-card"
                @click.capture.stop="openZoom(s.entry.name)">
                <div class="additional-resource-detail__card-visual">
                  <Card :card="s.card" />
                </div>
                <!-- One cohesive info plate per card: PRIMARY count, then EITHER
                     a bespoke special-state marker OR the generic VP scoring. -->
                <div class="additional-resource-detail__card-foot">
                  <!-- PRIMARY: how many of the selected resource sit on this card. -->
                  <div class="additional-resource-detail__count" :class="{'additional-resource-detail__count--zero': s.entry.amount === 0}">
                    <i class="card-resource additional-resource-detail__count-icon" :class="iconClass" aria-hidden="true"></i>
                    <span class="additional-resource-detail__count-num">{{ s.entry.amount }}<AnimatedMetricValue
                      :value="s.entry.amount"
                      :metricKey="cardMetricKey(s.entry.name)"
                      :scopeKey="detailScope"
                      :epoch="epoch"
                      variant="misc" /></span>
                  </div>

                  <!-- SPECIAL: bespoke premium status marker (Search for Life
                       "life found" trigger, Vermin infestation threshold, …). -->
                  <template v-if="s.special !== undefined">
                    <div class="additional-resource-detail__status"
                         :class="'additional-resource-detail__status--' + s.special.tone">
                      <span class="additional-resource-detail__status-head">
                        <span class="additional-resource-detail__status-glyph" aria-hidden="true">{{ statusGlyph(s.special.tone) }}</span>
                        <span class="additional-resource-detail__status-label" v-i18n>{{ s.special.label }}</span>
                        <span v-if="s.special.vp" class="additional-resource-detail__status-vp">+{{ s.special.vp }} <span v-i18n>VP</span></span>
                      </span>
                      <span v-if="s.special.detail !== undefined" class="additional-resource-detail__status-detail" v-i18n>{{ s.special.detail }}</span>
                    </div>
                    <!-- Activation progress for threshold-driven special cards (Vermin → 10). -->
                    <div v-if="s.special.threshold !== undefined"
                         class="additional-resource-detail__progress additional-resource-detail__progress--threshold"
                         :class="{'additional-resource-detail__progress--reached': s.special.threshold.reached}"
                         :aria-label="$t('Progress to threshold')">
                      <span class="additional-resource-detail__progress-track">
                        <span class="additional-resource-detail__progress-fill" :style="{width: thresholdPct(s.special.threshold) + '%'}"></span>
                      </span>
                      <span class="additional-resource-detail__progress-text">{{ s.special.threshold.current }}/{{ s.special.threshold.required }}</span>
                    </div>
                  </template>

                  <!-- SECONDARY: generic VP scoring shown as a NATURAL threshold rule
                       ("3 [res] = 1 VP", never a decimal) + accrued total + (for
                       threshold cards) progress toward the next VP. -->
                  <template v-else-if="s.scoring !== undefined">
                    <div class="additional-resource-detail__score">
                      <span class="additional-resource-detail__score-rate">
                        <span class="additional-resource-detail__score-amt">{{ s.scoring.per }}</span>
                        <i class="card-resource additional-resource-detail__score-icon" :class="iconClass" aria-hidden="true"></i>
                        <span class="additional-resource-detail__score-op">=</span>
                        <span class="additional-resource-detail__score-vp">{{ s.scoring.each }}</span>
                        <span class="additional-resource-detail__score-unit" v-i18n>VP</span>
                      </span>
                      <span class="additional-resource-detail__score-acc">
                        <span class="additional-resource-detail__score-acc-label" v-i18n>Accumulated</span>
                        <span class="additional-resource-detail__score-vp">{{ s.scoring.accumulated }}</span>
                        <span class="additional-resource-detail__score-unit" v-i18n>VP</span>
                      </span>
                    </div>
                    <div v-if="s.progress !== undefined" class="additional-resource-detail__progress" :aria-label="$t('Progress to next VP')">
                      <span class="additional-resource-detail__progress-track">
                        <span class="additional-resource-detail__progress-fill" :style="{width: s.progress.pct + '%'}"></span>
                      </span>
                      <span class="additional-resource-detail__progress-text">{{ s.progress.filled }}/{{ s.progress.per }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardZoomModal
          ref="zoomModal"
          v-if="zoomCard !== undefined"
          :card="zoomCard"
          :cards="zoomCards"
          @navigate="zoomCard = $event"
          @close="zoomCard = undefined" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup vapor lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import Card from '@/client/components/card/CardFace.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {additionalResourceGroup, AdditionalResourceGroup, AdditionalResourceCardEntry, resourceScoring, accumulatedVp as calcAccumulatedVp} from '@/client/components/additionalResources/additionalResources';
import {specialResourceState, SpecialResourceState} from '@/client/components/additionalResources/additionalResourceSpecialCases';
import {additionalResourcesState, closeAdditionalResourceDetail} from '@/client/components/additionalResources/additionalResourcesState';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';

/**
 * Per-card info-plate descriptor, precomputed in `summaries` so the template
 * stays declarative + vue-tsc narrows cleanly. Exactly ONE of `special` /
 * `scoring` drives the secondary line; `progress` rides alongside `scoring`
 * for threshold cards (per > 1).
 */
interface CardResourceLine {
  readonly entry: AdditionalResourceCardEntry;
  readonly card: CardModel;
  readonly special?: SpecialResourceState;
  readonly scoring?: {readonly per: number; readonly each: number; readonly accumulated: number};
  readonly progress?: {readonly filled: number; readonly per: number; readonly pct: number};
}

defineOptions({name: 'AdditionalResourceDetailOverlay'});
const props = defineProps({
  playerView: {
    type: Object as PropType<PlayerViewModel>,
    required: true,
  },
});

const zoomModal = useTemplateRef<ExposedOf<typeof CardZoomModal>>('zoomModal');
const zoomCard = ref<CardModel | undefined>(undefined);
const resource = computed((): CardResource | undefined => {
  return additionalResourcesState.detailResource;
});
const player = computed((): PublicPlayerModel | undefined => {
  const color = additionalResourcesState.detailPlayerColor;
  if (color === undefined) {
    return undefined;
  }
  return props.playerView.players.find((p) => p.color === color);
});
/** The participant's VISIBLE label — the Automa seat localizes («Бот»). */
const playerLabel = computed((): string => {
  return player.value !== undefined ? participantDisplayName(player.value) : '';
});
const group = computed((): AdditionalResourceGroup | undefined => {
  if (resource.value === undefined || player.value === undefined) {
    return undefined;
  }
  return additionalResourceGroup(player.value.tableau, resource.value);
});
const visible = computed((): boolean => {
  return group.value !== undefined && player.value !== undefined;
});
const isViewer = computed((): boolean => {
  return player.value?.color === props.playerView.thisPlayer.color;
});
const iconClass = computed((): string => {
  return resource.value === undefined ? '' : cardResourceCSS[resource.value];
});
const resourceName = computed((): string => {
  return resource.value === undefined ? '' : $t(resource.value);
});
const epoch = computed((): string => {
  return props.playerView.runId;
});
const detailScope = computed((): string => {
  return `${player.value?.color ?? ''}-aux-detail`;
});
const totalMetricKey = computed((): string => {
  return `card-resource.${resource.value}.detail-total`;
});
const zoomCards = computed((): ReadonlyArray<CardModel> => {
  if (group.value === undefined) {
    return [];
  }
  return group.value.cards.map((entry) => cardModelFor(entry.name));
});
const cardCount = computed((): number => {
  return group.value?.cards.length ?? 0;
});
const nonZeroCount = computed((): number => {
  return group.value?.cards.filter((c) => c.amount > 0).length ?? 0;
});
// True when this resource yields VP anywhere — via generic scoring OR a
// special-case status (e.g. Search for Life's "life found" 3 VP). Gates
// the header's aggregate-VP stat (hidden entirely when nothing scores).
const hasScoring = computed((): boolean => {
  return summaries.value.some((s) => s.scoring !== undefined || (s.special?.vp ?? 0) > 0);
});
// Total VP this resource currently yields across all cards: each card's
// exact accrued scoring VP, or its special-case VP — correct even when
// cards mix threshold rates or special triggers.
const totalAccumulatedVp = computed((): number => {
  return summaries.value.reduce((sum, s) => sum + (s.scoring?.accumulated ?? s.special?.vp ?? 0), 0);
});
// Precomputed per-card info-plate descriptors. Bespoke special cards
// (registry) win the secondary line; otherwise the generic VP scoring +
// (for threshold cards) progress toward the next VP.
const summaries = computed((): ReadonlyArray<CardResourceLine> => {
  return (group.value?.cards ?? []).map((entry): CardResourceLine => {
    const special = specialResourceState(entry.name, entry.amount);
    const s = special === undefined ? resourceScoring(entry.name) : undefined;
    let scoring: CardResourceLine['scoring'];
    let progress: CardResourceLine['progress'];
    if (s !== undefined) {
      scoring = {per: s.per, each: s.each, accumulated: calcAccumulatedVp(entry.name, entry.amount)};
      if (s.per > 1) {
        const filled = entry.amount % s.per;
        progress = {filled, per: s.per, pct: Math.round((filled / s.per) * 100)};
      }
    }
    return {entry, card: cardModelFor(entry.name), special, scoring, progress};
  });
});
// Layout mode = number of source cards. Drives the modal's per-mode
// max-width cap + card zoom (see additional_resources.less). The modal is
// width:fit-content, so it hugs the real card row in every mode.
const layoutMode = computed((): 'single' | 'double' | 'grid' | 'many' => {
  const n = cardCount.value;
  if (n <= 1) {
    return 'single';
  }
  if (n === 2) {
    return 'double';
  }
  if (n <= 4) {
    return 'grid';
  }
  return 'many';
});
const modeClass = computed((): string => {
  return `additional-resource-detail--${layoutMode.value}`;
});

function cardModelFor(name: CardName): CardModel {
  return player.value?.tableau.find((c) => c.name === name) ?? ({name} as CardModel);
}
function cardMetricKey(name: CardName): string {
  return `card-resource.${resource.value}.card.${name}`;
}
// Glyph for a special-state marker by tone (success ✓ / warning ⚠ / pending ◦).
function statusGlyph(tone: string): string {
  if (tone === 'success') {
    return '✓';
  }
  if (tone === 'warning') {
    return '⚠';
  }
  return '◦';
}
// Activation-bar fill %, clamped to 100 once the threshold is reached/exceeded.
function thresholdPct(t: {current: number, required: number}): number {
  if (t.required <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((t.current / t.required) * 100));
}
function openZoom(name: CardName): void {
  zoomCard.value = cardModelFor(name);
  nextTick(() => {
    zoomModal.value?.show();
  });
}
function close(): void {
  closeAdditionalResourceDetail();
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') {
    return;
  }
  // Let an open fullscreen card (native <dialog>) consume Escape first.
  if (document.querySelector('dialog[open]') !== null) {
    return;
  }
  if (visible.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
