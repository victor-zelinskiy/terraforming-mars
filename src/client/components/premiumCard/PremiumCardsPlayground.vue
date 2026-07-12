<template>
  <!--
    DEV-ONLY premium card showcase (URL: ?premiumCardsPlayground).
    The visual acceptance surface for the from-scratch card renderer:
    curated edge cases, density buckets, worst titles, tag extremes,
    tiers/states, and the full in-scope catalog — all on one screen.
  -->
  <div class="pcpg">
    <header class="pcpg__head">
      <h1>PREMIUM CARDS — SHOWCASE</h1>
      <span class="pcpg__hint">?premiumCardsPlayground · {{ scopeCards.length }} карт в скоупе (project + prelude)</span>
    </header>

    <!-- reference strip -->
    <section class="pcpg__section">
      <h2>Референс: рубашка ↔ лицо (green / blue / red / prelude)</h2>
      <div class="pcpg__row">
        <img class="pcpg__back" src="assets/resources/card.webp" alt="card back"/>
        <PremiumCard v-for="n in referenceNames" :key="n" :card="modelOf(n)" />
      </div>
    </section>

    <!-- curated edge cases -->
    <section class="pcpg__section">
      <h2>Эталонные кейсы</h2>
      <div class="pcpg__row">
        <div v-for="c in curated" :key="c.label" class="pcpg__case">
          <PremiumCard :card="c.model" />
          <span class="pcpg__label">{{ c.label }}</span>
        </div>
      </div>
    </section>

    <!-- density buckets -->
    <section class="pcpg__section">
      <h2>Плотность механик (авто-подбор)</h2>
      <div v-for="bucket in densityBuckets" :key="bucket.density" class="pcpg__bucket">
        <h3>{{ bucket.density }} · {{ bucket.total }} карт</h3>
        <div class="pcpg__row">
          <PremiumCard v-for="n in bucket.samples" :key="n" :card="modelOf(n)" />
        </div>
      </div>
    </section>

    <!-- worst titles -->
    <section class="pcpg__section">
      <h2>Самые длинные названия (переведённые)</h2>
      <div class="pcpg__row">
        <PremiumCard v-for="n in longestTitles" :key="n" :card="modelOf(n)" />
      </div>
    </section>

    <!-- tag extremes -->
    <section class="pcpg__section">
      <h2>Максимум меток</h2>
      <div class="pcpg__row">
        <PremiumCard v-for="n in mostTags" :key="n" :card="modelOf(n)" />
      </div>
    </section>

    <!-- tiers & states -->
    <section class="pcpg__section">
      <h2>Тиры и состояния</h2>
      <div class="pcpg__row pcpg__row--baseline">
        <div class="pcpg__case" style="zoom: 0.5"><PremiumCard :card="modelOf(stateCard)" tier="thumb" /><span class="pcpg__label">thumb ×0.5</span></div>
        <div class="pcpg__case"><PremiumCard :card="modelOf(stateCard)" /><span class="pcpg__label">normal</span></div>
        <div class="pcpg__case" style="zoom: 1.25"><PremiumCard :card="modelOf(stateCard)" tier="full" /><span class="pcpg__label">full ×1.25</span></div>
        <div class="pcpg__case"><PremiumCard :card="modelOf(stateCard)" :selected="true" /><span class="pcpg__label">selected</span></div>
        <div class="pcpg__case"><PremiumCard :card="disabledModel" /><span class="pcpg__label">disabled</span></div>
        <div class="pcpg__case"><PremiumCard :card="modelOf(resourceCard, {resources: 4})" /><span class="pcpg__label">resources: 4</span></div>
      </div>
    </section>

    <!-- full catalog -->
    <section class="pcpg__section">
      <h2>Полный каталог
        <span class="pcpg__filters">
          <button v-for="m in modules" :key="m"
                  class="pcpg__chip" :class="{'pcpg__chip--on': moduleFilter === m}"
                  @click="moduleFilter = m">{{ m }}</button>
        </span>
      </h2>
      <div class="pcpg__row pcpg__row--catalog">
        <PremiumCard v-for="c in catalog" :key="c.name" :card="modelOf(c.name)" :lightweight="true" />
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {GameModule} from '@/common/cards/GameModule';
import {getCards, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {isPremiumFaceType} from './premiumCardTheme';
import {buildPremiumCardViewModel} from './premiumCardViewModel';
import {MechDensity} from './mechanicsModel';
import PremiumCard from './PremiumCard.vue';

const SCOPE_MODULES: ReadonlyArray<GameModule> = ['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares'];

type CuratedCase = {label: string, model: CardModel};

export default defineComponent({
  name: 'PremiumCardsPlayground',
  components: {PremiumCard},
  data() {
    return {
      moduleFilter: 'base' as GameModule,
      stateCard: CardName.PREDATORS,
      resourceCard: CardName.PREDATORS,
    };
  },
  computed: {
    scopeCards(): Array<ClientCard> {
      return getCards((c) => SCOPE_MODULES.includes(c.module) && isPremiumFaceType(c.type));
    },
    modules(): ReadonlyArray<GameModule> {
      return SCOPE_MODULES;
    },
    referenceNames(): Array<CardName> {
      // green / blue / red / prelude — the theme quartet next to the back.
      return [CardName.TREES, CardName.PREDATORS, CardName.COMET, CardName.DONATION];
    },
    curated(): Array<CuratedCase> {
      return [
        {label: 'скидка −4', model: this.modelOf(CardName.COMET, {calculatedCost: 17})},
        {label: 'стоимость 0 экв.', model: this.modelOf(CardName.MICRO_MILLS, {calculatedCost: 0})},
        {label: 'dynamic VP */3', model: this.modelOf(CardName.SEARCH_FOR_LIFE)},
        {label: 'vermin VP', model: this.modelOf(CardName.VERMIN)},
        {label: 'нет арта (fallback)', model: this.modelOf(CardName.DONATION)},
        {label: 'без механик (VP-only)', model: this.modelOf(CardName.DUST_SEALS)},
        {label: 'Столица (база)', model: this.modelOf(CardName.CAPITAL)},
        {label: 'Столица (Ares-тайл)', model: this.modelOf(CardName.CAPITAL_ARES)},
        {label: 'Торг. район (Ares-тайл)', model: this.modelOf(CardName.COMMERCIAL_DISTRICT_ARES)},
        {label: 'Deimos Down (Ares-тайл)', model: this.modelOf(CardName.DEIMOS_DOWN_ARES)},
      ];
    },
    densityBuckets(): Array<{density: MechDensity, total: number, samples: Array<CardName>}> {
      const buckets = new Map<MechDensity, Array<CardName>>([
        ['sparse', []], ['normal', []], ['dense', []], ['veryDense', []],
      ]);
      for (const card of this.scopeCards) {
        const vm = buildPremiumCardViewModel(card);
        buckets.get(vm.mechanics.density)?.push(card.name);
      }
      return Array.from(buckets.entries()).map(([density, names]) => ({
        density,
        total: names.length,
        samples: names.slice(0, 5),
      }));
    },
    longestTitles(): Array<CardName> {
      return this.scopeCards
        .map((c) => ({name: c.name, len: translateText(c.name).length}))
        .sort((a, b) => b.len - a.len)
        .slice(0, 6)
        .map((e) => e.name);
    },
    mostTags(): Array<CardName> {
      return this.scopeCards
        .map((c) => ({name: c.name, tags: buildPremiumCardViewModel(c).tags.length}))
        .sort((a, b) => b.tags - a.tags)
        .slice(0, 6)
        .map((e) => e.name);
    },
    disabledModel(): CardModel {
      return this.modelOf(this.stateCard, {isDisabled: true});
    },
    catalog(): Array<ClientCard> {
      return this.scopeCards.filter((c) => c.module === this.moduleFilter);
    },
  },
  methods: {
    modelOf(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
      const printed = getCardOrThrow(name).cost;
      return {name, calculatedCost: printed, ...overrides} as CardModel;
    },
  },
});
</script>

<style>
.pcpg {
  position: fixed;
  inset: 0;
  z-index: 20000;
  overflow-y: auto;
  background: radial-gradient(120% 80% at 50% -10%, #17212e, #0a0f16 60%);
  padding: 24px 32px 80px;
  font-family: Prototype, sans-serif;
  color: #dfe8f2;
}
.pcpg__head { display: flex; align-items: baseline; gap: 18px; margin-bottom: 18px; }
.pcpg__head h1 { font-size: 22px; letter-spacing: 0.08em; color: #7db9ff; margin: 0; }
.pcpg__hint { font-size: 13px; opacity: 0.7; }
.pcpg__section { margin-bottom: 34px; }
.pcpg__section h2 { font-size: 15px; letter-spacing: 0.05em; color: #d9b878; border-bottom: 1px solid rgba(217, 184, 120, 0.3); padding-bottom: 5px; }
.pcpg__section h3 { font-size: 13px; color: #9fb3c8; margin: 10px 0 4px; }
.pcpg__row { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.pcpg__row--baseline { align-items: center; }
.pcpg__row--catalog { zoom: 0.55; gap: 26px; }
.pcpg__case { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pcpg__label { font-size: 12px; color: #9fb3c8; }
.pcpg__back { width: 320px; height: 460px; object-fit: cover; border-radius: 15px; }
.pcpg__filters { margin-left: 14px; }
.pcpg__chip {
  background: rgba(20, 30, 44, 0.8); color: #9fb3c8; border: 1px solid #33465e;
  border-radius: 10px; padding: 2px 10px; margin-right: 6px; font-size: 12px; cursor: pointer;
}
.pcpg__chip--on { color: #0a0f16; background: #7db9ff; border-color: #7db9ff; }
</style>
