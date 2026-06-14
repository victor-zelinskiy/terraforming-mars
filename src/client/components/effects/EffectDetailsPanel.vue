<template>
  <!--
    The static RIGHT panel of the Эффекты overlay — the "what did this effect DO
    this game" step between scanning the effect grid and reading the rule. Always
    shows the SELECTED source (card / corporation): the printed effect graphic, a
    per-game summary built individually by `getEffectSummary` (trigger count +
    impact lines + the live current value + last-trigger generation), and — when an
    effect has produced nothing measurable — a thematic NOTE instead of a dead
    empty state. Read-only (no CTA): effects are passive. ⤢ opens the source card
    fullscreen.
  -->
  <aside class="effect-detail"
         :class="{
           'effect-detail--empty': group === undefined,
           'effect-detail--corp': isCorporation,
           'effect-detail--disabled': isDisabled,
         }">
    <div v-if="group === undefined" class="effect-detail__placeholder">
      <span class="effect-detail__placeholder-glyph" aria-hidden="true">⌁</span>
      <span class="effect-detail__placeholder-text" v-i18n>Select an effect to see details</span>
    </div>

    <div v-else class="effect-detail__scroll">
      <header class="effect-detail__head">
        <span class="effect-detail__type" v-i18n>{{ isCorporation ? 'Corporation' : 'Card' }}</span>
        <h3 class="effect-detail__name" v-i18n>{{ cardName }}</h3>
        <button type="button"
                class="effect-detail__zoom"
                :aria-label="$t('Open fullscreen')"
                @click="$emit('open', cardName)">⤢</button>
        <span v-if="resourceChip" class="effect-detail__res">
          <span class="effect-detail__res-icon" :class="resIconClass" aria-hidden="true"></span>
          <span class="effect-detail__res-count">{{ resourceCount }}</span>
          <span class="effect-detail__res-label" v-i18n>on this card</span>
        </span>
      </header>

      <!-- The printed passive-effect graphic (the rule). Reuses the card's own
           render — the global `.effect-item__render.card-container` styles localize
           the plate text, render the sprite icons + light text on the dark glass. -->
      <div class="effect-detail__section">
        <span class="effect-detail__label" v-i18n>Effect</span>
        <div class="effect-detail__rules">
          <div v-for="eff in group.effects" :key="eff.key" class="effect-detail__rule">
            <div v-if="eff.effectNode !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
              <CardRenderEffectBoxComponent :effectData="eff.effectNode" />
            </div>
            <div v-else-if="eff.renderRoot !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
              <CardRenderData :renderData="eff.renderRoot" />
              <div v-if="eff.text" class="effect-item__desc">(<span v-i18n>{{ eff.text }}</span>)</div>
            </div>
            <div v-else class="effect-item__text" v-i18n v-strip-effect-prefix>{{ eff.text }}</div>
          </div>
        </div>
      </div>

      <!-- Per-game summary — what this effect actually did this game. -->
      <div class="effect-detail__section effect-detail__summary">
        <span class="effect-detail__label" v-i18n>This game</span>

        <div v-if="loading && stat === undefined" class="effect-detail__skeleton">
          <span class="effect-detail__skeleton-bar"></span>
          <span class="effect-detail__skeleton-bar effect-detail__skeleton-bar--short"></span>
        </div>

        <template v-else>
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
                @click.capture.stop="$emit('open', cardName)">
          <!-- @click.capture.stop suppresses Card.vue's OWN click→zoom (else one
               click opens TWO viewers). :key is load-bearing — Card.vue resolves
               its render data ONCE in data(), so a reused keyless <Card> sticks on
               the first card it ever rendered. -->
          <Card :key="cardName" :card="cardModel" />
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
import {EffectGroup} from '@/client/components/effects/effectExtraction';
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
    group: {
      type: Object as PropType<EffectGroup>,
      default: undefined,
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
      return this.group?.cardName;
    },
    isCorporation(): boolean {
      return this.group?.isCorporation ?? false;
    },
    isDisabled(): boolean {
      return this.group?.isDisabled ?? false;
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
      };
    },
    vm(): EffectSummaryViewModel {
      const stat = this.stat ?? emptyStat(this.cardName, this.isCorporation);
      return getEffectSummary(stat, this.ctx);
    },
  },
});
</script>
