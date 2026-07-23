<!--
@console-shared LIVE — console native stands on this file, so it is NOT covered
by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
-->
<template>
  <div class="pcard"
       :class="rootClasses"
       :style="headerVars"
       role="img"
       :aria-label="ariaLabel"
       @click="onClick">
    <div class="pcard__body" aria-hidden="true"></div>
    <div class="pcard__rim" aria-hidden="true"></div>

    <div class="pcard__content">
      <!-- ── HEADER SHELL ─────────────────────────────────────────────
           The title plate is the FLAGSHIP element: a full-width faceted
           nameplate whose silhouette NEVER changes. Cost badge and tag
           medallions are OVERLAY layers pinned over its ends — they only
           drive the title text's safe-area paddings (CSS vars set from
           the deterministic view-model, no DOM measuring). -->
      <div class="pcard__header">
        <div class="pcard-nameplate" aria-hidden="true">
          <span class="pcard-nameplate__body"></span>
        </div>
        <div class="pcard__title pcard-nameplate__text" :class="'pcard__title--t' + titleTier">
          <span>{{ translatedTitle }}</span>
        </div>
        <PremiumCostBadge v-if="vm.cost !== undefined" :cost="vm.cost" />
        <PremiumTagRail v-if="vm.tags.length > 0" :tags="vm.tags" :plan="vm.tagCluster" />
      </div>

      <!-- requirements rail (secondary to the plate); collapses to a thin
           decorative divider when the card has no requirements -->
      <PremiumRequirementsBar v-if="vm.requirements.length > 0" :requirements="vm.requirements" />
      <span v-else class="pcard__divider" aria-hidden="true"></span>

      <!-- art viewport; a corporation shows real art if it has any, else the
           brand wordmark identity zone (vm.art is undefined only for an
           art-less corporation) -->
      <PremiumCardArt v-if="vm.art !== undefined" :art="vm.art" />
      <PremiumCorpIdentity v-else-if="isCorporation" :name="vm.name" />

      <!-- ── LOWER SECTION ────────────────────────────────────────────
           Mechanics content + ANCHORED service elements (no footer row).
           The VP badge reserves a right column via `--pcard-lower-safe-r`
           (per-variant, only when VP exists); the expansion stamp and the
           resource capsule are pinned at the bottom-left corner — tiny,
           overlapping the panel's border zone only. -->
      <div class="pcard__lower">
        <PremiumMechanicsPanel v-if="!vm.mechanics.textOnly" :mechanics="vm.mechanics" />
        <div class="pcard__exp" aria-hidden="true">
          <span class="pcard__exp-medallion"
                :class="{'pcard__exp-medallion--base': expansionIcon === undefined}"
                :style="expansionStyle"></span>
          <span v-for="module in compatibilityIcons"
                :key="module.module"
                class="pcard__exp-compat"
                :style="{backgroundImage: `url(${module.url})`}"></span>
        </div>
        <div v-if="resourceInfo !== undefined" class="pcard__res">
          <span class="pcard__res-icon" :style="{backgroundImage: `url(${resourceIconUrl})`}"></span>
          <span class="pcard__res-count">{{ resourceInfo.amount }}</span>
        </div>
        <PremiumVpBadge v-if="vm.vp !== undefined" :vp="vm.vp" />
      </div>
    </div>

    <div class="pcard__frame" aria-hidden="true"></div>
    <div class="pcard__state" aria-hidden="true"></div>

    <player-cube v-if="showPlayerCube" :color="cubeColor" :size="30"></player-cube>
    <slot/>

    <!-- fullscreen zoom (same viewer shell as the legacy face; teleported to
         body to escape ancestor containing blocks — see Card.vue's note) -->
    <Teleport to="body">
      <CardZoomModal v-if="showZoom" ref="zoomModal" :card="cardModel" :actionUsed="actionUsed" @close="showZoom = false" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {GameModule} from '@/common/cards/GameModule';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText, translateCardName} from '@/client/directives/i18n';
import PlayerCube from '@/client/components/PlayerCube.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {buildPremiumCardViewModel, PremiumCardVM, vpVariantOf} from './premiumCardViewModel';
import {titleTierFor, longestWordLength, TitleTier} from './titleFit';
import {cardResourceIconUrl, expansionIconUrl} from './premiumCardIcons';
import PremiumCostBadge from './PremiumCostBadge.vue';
import PremiumTagRail from './PremiumTagRail.vue';
import PremiumRequirementsBar from './PremiumRequirementsBar.vue';
import PremiumCardArt from './PremiumCardArt.vue';
import PremiumCorpIdentity from './PremiumCorpIdentity.vue';
import PremiumMechanicsPanel from './PremiumMechanicsPanel.vue';
import PremiumVpBadge from './PremiumVpBadge.vue';

export type PremiumCardTier = 'thumb' | 'normal' | 'full';

/* Title text safe-areas (design px). The plate keeps its full width; only
 * the text inset changes. Values are derived from the overlay clusters'
 * DETERMINISTIC geometry — badge 46px with a −6px overhang, the delta chip
 * extends the cost cluster rightward, the tag cluster width comes from
 * tagClusterPlan. */
const TITLE_SAFE_BASE = 14;
const TITLE_SAFE_COST = 50;
const TITLE_SAFE_COST_MOD = 84;
const TITLE_SAFE_TAG_GAP = 18;

/**
 * PREMIUM CARD FACE — the fork's from-scratch card renderer (project cards +
 * preludes + corporations; scope gate = premiumCardTheme.isPremiumFaceType). Mirrors the
 * legacy <Card> host contract: `card` (CardModel), `actionUsed`, `robotCard`,
 * `cubeColor`, `lightweight`; click opens the shared fullscreen viewer behind
 * the same preference. `name`-only mode renders the pristine printed face for
 * inert proxies (console cinematics).
 */
export default defineComponent({
  name: 'PremiumCard',
  components: {
    'player-cube': PlayerCube,
    CardZoomModal,
    PremiumCostBadge,
    PremiumTagRail,
    PremiumRequirementsBar,
    PremiumCardArt,
    PremiumCorpIdentity,
    PremiumMechanicsPanel,
    PremiumVpBadge,
  },
  props: {
    /** Live card state; omit for the static printed face (with `name`). */
    card: {
      type: Object as () => CardModel | undefined,
      required: false,
      default: undefined,
    },
    /** Static mode: render the printed face of this card (console proxies). */
    name: {
      type: String as () => CardName | undefined,
      required: false,
      default: undefined,
    },
    actionUsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    robotCard: {
      type: Object as () => CardModel | undefined,
      required: false,
      default: undefined,
    },
    cubeColor: {
      type: String as () => Color,
      required: false,
      default: 'neutral',
    },
    /** Legacy-compat: dense surfaces; maps to the `thumb` quality tier. */
    lightweight: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Legacy-compat no-op (the premium face is always fixed-height). */
    autoTall: {
      type: Boolean,
      required: false,
      default: false,
    },
    tier: {
      type: String as () => PremiumCardTier | undefined,
      required: false,
      default: undefined,
    },
    /** No interactivity at all (cinematic proxies). */
    inert: {
      type: Boolean,
      required: false,
      default: false,
    },
    selected: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      showZoom: false,
    };
  },
  computed: {
    cardName(): CardName {
      const name = this.card?.name ?? this.name;
      if (name === undefined) {
        throw new Error('PremiumCard needs either a card model or a card name');
      }
      return name;
    },
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    /** Computed (never data()) so a keyless re-pointed face re-resolves. */
    vm(): PremiumCardVM {
      return buildPremiumCardViewModel(getCardOrThrow(this.cardName), this.card);
    },
    effectiveTier(): PremiumCardTier {
      if (this.tier !== undefined) {
        return this.tier;
      }
      return this.lightweight ? 'thumb' : 'normal';
    },
    translatedTitle(): string {
      // Tolerate a `Name:variant` id (`:ares` / `:promo` / …) — the dictionary
      // keys only the BASE name, so fall back to it without the suffix.
      return translateCardName(this.vm.title);
    },
    titleTier(): TitleTier {
      return titleTierFor(this.translatedTitle);
    },
    isUnavailable(): boolean {
      if (this.card?.isDisabled) {
        return true;
      }
      return !getPreferences().experimental_ui && this.actionUsed;
    },
    showPlayerCube(): boolean {
      return getPreferences().experimental_ui && this.actionUsed;
    },
    interactive(): boolean {
      return !this.inert;
    },
    isCorporation(): boolean {
      return this.vm.type === CardType.CORPORATION;
    },
    rootClasses(): Record<string, boolean> {
      const classes: Record<string, boolean> = {
        ['pcard--theme-' + this.vm.theme]: true,
        ['pcard--mech-' + this.vm.mechanics.density]: true,
        ['pcard--tier-' + this.effectiveTier]: true,
        ['pcard--' + this.vm.slug]: true,
        'pcard--interactive': this.interactive,
        'pcard--unavailable': this.isUnavailable,
        'pcard--selected': this.selected,
        'pcard--cost-mod': this.vm.cost !== undefined && this.vm.cost.delta !== 0,
        'pcard--has-res': this.resourceInfo !== undefined,
      };
      if (this.vm.vp !== undefined) {
        classes['pcard--vp-' + vpVariantOf(this.vm.vp)] = true;
      }
      return classes;
    },
    /*
     * The header's safe-area system: the title plate stays full-width; the
     * TEXT insets around the overlay clusters. Pure arithmetic from the VM
     * (tagClusterPlan geometry + cost/modifier presence) — set once as CSS
     * custom properties, never measured from the DOM.
     */
    headerVars(): Record<string, string> {
      const plan = this.vm.tagCluster;
      const safeL = this.vm.cost === undefined ?
        TITLE_SAFE_BASE :
        (this.vm.cost.delta !== 0 ? TITLE_SAFE_COST_MOD : TITLE_SAFE_COST);
      const safeR = plan.count === 0 ? TITLE_SAFE_BASE : plan.width + TITLE_SAFE_TAG_GAP;
      return {
        '--pcard-title-safe-l': `${safeL}px`,
        '--pcard-title-safe-r': `${safeR}px`,
        // Longest unbreakable run — the CSS shrinks the type until IT fits the
        // remaining inline size, so a word is never split (see titleFit.ts).
        '--pcard-title-longest': String(longestWordLength(this.translatedTitle)),
        '--pcard-tag-size': `${plan.size}px`,
        '--pcard-tag-overlap': `${plan.overlap}px`,
        '--pcard-tag-cluster-w': `${plan.width}px`,
      };
    },
    expansionIcon(): string | undefined {
      return expansionIconUrl(this.vm.expansion);
    },
    expansionStyle(): Record<string, string> {
      return this.expansionIcon !== undefined ? {backgroundImage: `url(${this.expansionIcon})`} : {};
    },
    compatibilityIcons(): Array<{module: GameModule, url: string}> {
      const result: Array<{module: GameModule, url: string}> = [];
      for (const module of this.vm.compatibility) {
        if (module === this.vm.expansion) {
          continue;
        }
        const url = expansionIconUrl(module);
        if (url !== undefined) {
          result.push({module, url});
        }
      }
      return result;
    },
    /** Live resource socket; only with a live model (printed faces stay pristine). */
    resourceInfo(): {type: CardResource, amount: number} | undefined {
      if (this.card === undefined && this.robotCard === undefined) {
        return undefined;
      }
      if (this.robotCard !== undefined) {
        return {
          type: CardResource.RESOURCE_CUBE,
          amount: this.card?.resources ?? this.robotCard.resources ?? 0,
        };
      }
      const res = this.vm.resource;
      return res === undefined ? undefined : {type: res.type, amount: res.amount};
    },
    resourceIconUrl(): string {
      return this.resourceInfo !== undefined ? cardResourceIconUrl(this.resourceInfo.type) : '';
    },
    ariaLabel(): string {
      const parts: Array<string> = [this.translatedTitle];
      if (this.vm.cost !== undefined) {
        parts.push(`${this.vm.cost.printed} M€`);
      }
      if (this.vm.vp?.kind === 'fixed') {
        parts.push(`${this.vm.vp.value} ${translateText('VP')}`);
      }
      return parts.join(', ');
    },
  },
  methods: {
    /*
     * Same Steam-like contract as the legacy face: a single click opens the
     * fullscreen viewer behind the `fullscreen_cards_on_dblclick` preference;
     * hosts that consume clicks intercept via `@click.capture.stop` wrappers.
     */
    onClick() {
      if (this.inert || this.card === undefined) {
        return;
      }
      if (!getPreferences().fullscreen_cards_on_dblclick) {
        return;
      }
      this.showZoom = true;
      nextTick(() => {
        (this.$refs as any).zoomModal?.show();
      });
    },
  },
});
</script>
