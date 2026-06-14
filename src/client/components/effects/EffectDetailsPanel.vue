<template>
  <!--
    The static RIGHT panel — PER EFFECT (not per card). For the SELECTED effect it
    shows: a mini-context header, the effect's OWN icon graphic, the effect's OWN
    full text DESCRIPTION (which lives ONLY here — the left grid is icons-only), a
    per-game summary ("what this effect did this game": trigger count + impact lines
    + live current value + last-trigger gen) or a thematic NOTE, and the source card
    preview. A multi-effect card shows EACH effect's own description; the per-game
    stats are aggregated at the source-card level (the event stream attributes to the
    card), so a small caption says so. Read-only (effects are passive). ⤢ → fullscreen.
  -->
  <aside class="effect-detail"
         :class="{
           'effect-detail--empty': entry === undefined,
           'effect-detail--corp': isCorporation,
           'effect-detail--disabled': isDisabled,
         }">
    <div v-if="entry === undefined" class="effect-detail__placeholder">
      <span class="effect-detail__placeholder-glyph" aria-hidden="true">⌁</span>
      <span class="effect-detail__placeholder-text" v-i18n>Select an effect to see details</span>
    </div>

    <div v-else class="effect-detail__scroll">
      <header class="effect-detail__head">
        <span class="effect-detail__type">
          <span v-i18n>{{ isCorporation ? 'Corporation' : 'Card' }}</span>
          <span v-if="multiEffect" class="effect-detail__ord">{{ entry.effectIndex + 1 }}/{{ effectCount }}</span>
        </span>
        <h3 class="effect-detail__name" v-i18n>{{ entry.cardName }}</h3>
        <button type="button"
                class="effect-detail__zoom"
                :aria-label="$t('Open fullscreen')"
                @click="$emit('open', entry.cardName)">⤢</button>
        <span v-if="resourceChip" class="effect-detail__res">
          <span class="effect-detail__res-icon" :class="resIconClass" aria-hidden="true"></span>
          <span class="effect-detail__res-count">{{ resourceCount }}</span>
          <span class="effect-detail__res-label" v-i18n>on this card</span>
        </span>
      </header>

      <!-- The SELECTED effect's icon graphic (description hidden via CSS — the prose
           lives in the Description block below, not baked into the graphic). -->
      <div class="effect-detail__section">
        <span class="effect-detail__label" v-i18n>Effect</span>
        <div class="effect-detail__rules">
          <div class="effect-detail__rule">
            <div v-if="entry.effectNode !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
              <CardRenderEffectBoxComponent :effectData="entry.effectNode" />
            </div>
            <div v-else-if="entry.renderRoot !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
              <CardRenderData :renderData="entry.renderRoot" />
            </div>
            <div v-else class="effect-item__text" v-i18n v-strip-effect-prefix>{{ entry.text }}</div>
          </div>
        </div>
      </div>

      <!-- This effect's OWN full text description (translated, prefix-stripped). -->
      <div v-if="hasDescription" class="effect-detail__section">
        <span class="effect-detail__label" v-i18n>Description</span>
        <p class="effect-detail__desc" v-i18n v-strip-effect-prefix>{{ entry.description }}</p>
      </div>

      <!-- Per-game summary — what this effect did this game. -->
      <div class="effect-detail__section effect-detail__summary">
        <span class="effect-detail__label" v-i18n>This game</span>

        <div v-if="loading && stat === undefined" class="effect-detail__skeleton">
          <span class="effect-detail__skeleton-bar"></span>
          <span class="effect-detail__skeleton-bar effect-detail__skeleton-bar--short"></span>
        </div>

        <template v-else>
          <p v-if="vm.cardScoped && !vm.empty" class="effect-detail__scope-note" v-i18n>Stats cover all effects of this card</p>

          <div v-if="vm.headline" class="effect-detail__headline" v-i18n>{{ vm.headline }}</div>

          <div v-if="vm.triggerCount > 0" class="effect-detail__metric">
            <span class="effect-detail__metric-label" v-i18n>Times triggered</span>
            <span class="effect-detail__metric-value">{{ vm.triggerCount }}</span>
          </div>

          <div v-for="(line, i) in vm.lines" :key="i" class="effect-detail__line">
            <span class="effect-detail__line-icon" :class="iconClassFor(line.icon)" aria-hidden="true"></span>
            <span class="effect-detail__line-label" v-i18n>{{ line.label }}</span>
            <span class="effect-detail__line-value">{{ line.value }}</span>
          </div>

          <div v-if="vm.currentValue !== undefined" class="effect-detail__line effect-detail__line--current">
            <span class="effect-detail__line-icon" :class="iconClassFor(vm.currentValue.icon)" aria-hidden="true"></span>
            <span class="effect-detail__line-label" v-i18n>Current</span>
            <span class="effect-detail__line-value">{{ vm.currentValue.value }}</span>
          </div>

          <!-- Thematic note (always present when there's nothing to tally). -->
          <p v-if="vm.note" class="effect-detail__note" v-i18n>{{ vm.note }}</p>

          <div v-if="vm.lastTrigger !== undefined" class="effect-detail__last">
            <span v-i18n>Last triggered</span> · <span v-i18n>Generation</span> {{ vm.lastTrigger.generation }}
          </div>
        </template>
      </div>

      <!-- Source card — a compact reference (⤢ in the header opens it fullscreen). -->
      <div class="effect-detail__section effect-detail__source">
        <span class="effect-detail__label" v-i18n>Source</span>
        <div v-if="measuring" class="effect-detail__source-spacer" aria-hidden="true"></div>
        <button v-else
                type="button"
                class="effect-detail__source-card"
                :aria-label="$t('Open fullscreen')"
                @click.capture.stop="$emit('open', entry.cardName)">
          <!-- @click.capture.stop suppresses Card.vue's OWN click→zoom (else one
               click opens TWO viewers). :key is load-bearing — Card.vue resolves
               its render data ONCE in data(), so a reused keyless <Card> sticks on
               the first card it ever rendered. -->
          <Card :key="entry.cardName" :card="cardModel" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {CardModel} from '@/common/models/CardModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EffectEntry} from '@/client/components/effects/effectExtraction';
import {getEffectSummary, EffectSummaryViewModel, EffectSummaryContext} from '@/client/components/effects/effectSummary';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {stripEffectPrefix} from '@/client/directives/stripEffectPrefix';
import Card from '@/client/components/card/Card.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';

// A synthesized all-zero stat for a source with no recorded events yet — so the
// summary shows its thematic note (never a dead panel).
function emptyStat(cardName: CardName | undefined, isCorporation: boolean): EffectOverlayStat {
  return {
    sourceKey: (isCorporation ? 'corporation:' : 'card:') + (cardName ?? ''),
    kind: isCorporation ? 'corporation' : 'card',
    card: cardName,
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: Units.EMPTY,
    production: Units.EMPTY,
    cardResources: {},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
  };
}

export default defineComponent({
  name: 'EffectDetailsPanel',
  components: {Card, CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripEffectPrefix},
  props: {
    // The SELECTED effect (per-effect, not per-card).
    entry: {
      type: Object as PropType<EffectEntry>,
      default: undefined,
    },
    // How many effects the source card grants (>1 → the stats are card-scoped).
    effectCount: {
      type: Number,
      default: 1,
    },
    // The whole-game aggregate for this source (undefined → no events yet / loading).
    stat: {
      type: Object as PropType<EffectOverlayStat>,
      default: undefined,
    },
    // The live tableau model (carries the current resource count).
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    // Hidden height-probe mode: render a card SPACER instead of the heavy <Card>.
    measuring: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['open'],
  methods: {
    iconClassFor,
  },
  computed: {
    cardName(): CardName | undefined {
      return this.entry?.cardName;
    },
    isCorporation(): boolean {
      return this.entry?.isCorporation ?? false;
    },
    isDisabled(): boolean {
      return this.entry?.isDisabled ?? false;
    },
    multiEffect(): boolean {
      return this.effectCount > 1;
    },
    hasDescription(): boolean {
      return this.entry?.description !== undefined && this.entry.description !== '';
    },
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    // The card resource this source holds (Animal / Microbe / Floater / …), if any.
    resourceType(): CardResource | undefined {
      return this.cardName !== undefined ? getCard(this.cardName)?.resourceType : undefined;
    },
    resourceChip(): boolean {
      return this.resourceType !== undefined;
    },
    resourceCount(): number {
      return this.card?.resources ?? 0;
    },
    resIconClass(): string {
      return this.resourceType !== undefined ? iconClassFor(String(this.resourceType)) : '';
    },
    ctx(): EffectSummaryContext {
      return {
        sourceName: this.cardName ?? ('' as CardName),
        sourceKind: this.isCorporation ? 'corporation' : 'card',
        cardResourceType: this.resourceType,
        currentCardResource: this.resourceType !== undefined ? this.resourceCount : undefined,
        effectIndex: this.entry?.effectIndex,
        effectCount: this.effectCount,
      };
    },
    vm(): EffectSummaryViewModel {
      const stat = this.stat ?? emptyStat(this.cardName, this.isCorporation);
      return getEffectSummary(stat, this.ctx);
    },
  },
});
</script>
