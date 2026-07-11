<template>
  <div class="pcard"
       :class="rootClasses"
       role="img"
       :aria-label="ariaLabel"
       @click="onClick">
    <div class="pcard__body" aria-hidden="true"></div>
    <div class="pcard__rim" aria-hidden="true"></div>

    <div class="pcard__content">
      <!-- header: cost + title + tags -->
      <div class="pcard__header">
        <PremiumCostBadge v-if="vm.cost !== undefined" :cost="vm.cost" />
        <span v-else class="pcard__cost-spacer" aria-hidden="true"></span>
        <div class="pcard__title" :class="'pcard__title--t' + titleTier">
          <span>{{ translatedTitle }}</span>
        </div>
        <PremiumTagRail v-if="vm.tags.length > 0" :tags="vm.tags" :layout="vm.tagLayout" />
        <span v-else class="pcard__cost-spacer" aria-hidden="true"></span>
      </div>

      <!-- requirements band (collapses when absent) -->
      <PremiumRequirementsBar v-if="vm.requirements.length > 0" :requirements="vm.requirements" />
      <span v-else aria-hidden="true"></span>

      <!-- art viewport -->
      <PremiumCardArt :art="vm.art" />

      <!-- mechanics plate (collapses when the card has none) -->
      <PremiumMechanicsPanel v-if="!vm.mechanics.textOnly" :mechanics="vm.mechanics" />
      <span v-else aria-hidden="true"></span>

      <!-- footer: expansion medallion · resource socket · VP badge -->
      <div class="pcard__footer">
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
import {Color} from '@/common/Color';
import {GameModule} from '@/common/cards/GameModule';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';
import PlayerCube from '@/client/components/PlayerCube.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {buildPremiumCardViewModel, PremiumCardVM} from './premiumCardViewModel';
import {titleTierFor, TitleTier} from './titleFit';
import {cardResourceIconUrl, expansionIconUrl} from './premiumCardIcons';
import PremiumCostBadge from './PremiumCostBadge.vue';
import PremiumTagRail from './PremiumTagRail.vue';
import PremiumRequirementsBar from './PremiumRequirementsBar.vue';
import PremiumCardArt from './PremiumCardArt.vue';
import PremiumMechanicsPanel from './PremiumMechanicsPanel.vue';
import PremiumVpBadge from './PremiumVpBadge.vue';

export type PremiumCardTier = 'thumb' | 'normal' | 'full';

/**
 * PREMIUM CARD FACE — the fork's from-scratch card renderer (project cards +
 * preludes; scope gate = premiumCardTheme.isPremiumFaceType). Mirrors the
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
      return translateText(this.vm.title);
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
    rootClasses(): Record<string, boolean> {
      return {
        ['pcard--theme-' + this.vm.theme]: true,
        ['pcard--mech-' + this.vm.mechanics.density]: true,
        ['pcard--tier-' + this.effectiveTier]: true,
        ['pcard--' + this.vm.slug]: true,
        'pcard--interactive': this.interactive,
        'pcard--unavailable': this.isUnavailable,
        'pcard--selected': this.selected,
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
