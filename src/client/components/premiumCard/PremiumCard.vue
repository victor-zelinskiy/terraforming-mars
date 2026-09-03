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

      <!-- art viewport; a corporation / CEO shows real art if it has any,
           else its own identity zone (vm.art is undefined then): the corp
           brand wordmark, or the CEO's procedural executive band — no CEO
           ships art, so the band is that type's INTENDED face. A PEEK face
           skips this zone entirely — the art row starts below the peek
           band, so nothing of it can show. -->
      <PremiumCardArt v-if="!peek && vm.art !== undefined" :art="vm.art" :tier="artTier" />
      <PremiumCorpIdentity v-else-if="!peek && isCorporation" :name="vm.name" />
      <div v-else-if="!peek && isCeo" class="pcard-ceo-ident" aria-hidden="true">
        <span class="pcard-ceo-ident__line pcard-ceo-ident__line--l"></span>
        <span class="pcard-ceo-ident__crest">
          <span class="pcard-ceo-ident__chev"></span>
          <span class="pcard-ceo-ident__word">{{ ceoWord }}</span>
          <span class="pcard-ceo-ident__chev"></span>
        </span>
        <span class="pcard-ceo-ident__line pcard-ceo-ident__line--r"></span>
      </div>

      <!-- ── LOWER SECTION ────────────────────────────────────────────
           Mechanics content + ANCHORED service elements (no footer row).
           The VP badge reserves a right column via `--pcard-lower-safe-r`
           (per-variant, only when VP exists); the expansion stamp and the
           resource capsule are pinned at the bottom-left corner — tiny,
           overlapping the panel's border zone only. -->
      <div v-if="!peek" class="pcard__lower">
        <PremiumMechanicsPanel v-if="!vm.mechanics.textOnly" :mechanics="vm.mechanics" />
        <!-- CEO PROSE — the rule zone (the one deliberate exception to the
             icons-only face: on this type the description IS the rule).
             Length-tier ladder, never a scroll, never a clamp. -->
        <div v-if="proseText !== ''"
             class="pcard__prose"
             :class="'pcard__prose--t' + proseTier">{{ proseText }}</div>
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
         body to escape ancestor containing blocks — see Card.vue's note).
         Mounted only for faces that can actually open it (onClick's own
         gate) — an inert/static proxy never plants teleport anchors. -->
    <Teleport v-if="zoomable" to="body">
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
import {CardArtTier} from '@/client/cards/cardArt';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText, translateCardName} from '@/client/directives/i18n';
import PlayerCube from '@/client/components/PlayerCube.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {buildPremiumCardViewModel, PremiumCardVM, vpVariantOf} from './premiumCardViewModel';
import {titleTierFor, longestWordLength, proseTierFor, TitleTier} from './titleFit';
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
 * PRINTED-FACE VM CACHE. A `name`-only face (console proxies, the tableau,
 * category grids) is a pure function of the static manifest — the VM never
 * changes for the lifetime of the session. Mounting 100+ static faces at once
 * (the «Разыграно» table / category open) used to rebuild 100+ mechanics
 * trees; now each card name pays the build exactly once. VMs are shared and
 * read-only by contract (the render layer never mutates them). Live-model
 * faces (`card` prop) keep the per-instance build — their VM tracks state.
 */
const printedVmCache = new Map<CardName, PremiumCardVM>();

function printedFaceVm(name: CardName): PremiumCardVM {
  let vm = printedVmCache.get(name);
  if (vm === undefined) {
    vm = buildPremiumCardViewModel(getCardOrThrow(name));
    printedVmCache.set(name, vm);
  }
  return vm;
}

/**
 * PREMIUM CARD FACE — the fork's from-scratch card renderer (project cards +
 * preludes + corporations + standard projects/actions + CEOs; scope gate =
 * premiumCardTheme.isPremiumFaceType). Mirrors the
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
    /**
     * COVERED-IN-A-PILE mode: render only the layers that can peek out of a
     * stack — corpus (body/rim/frame), header shell and the requirements
     * rail / divider. The art viewport, the corp identity zone and the whole
     * lower section are NOT mounted (no art <img>, no decode, no mechanics
     * subtree). The card box and every rendered layer stay pixel-identical
     * to the full face, so a pile can swap peek ↔ full without a shift.
     */
    peek: {
      type: Boolean,
      required: false,
      default: false,
    },
    selected: {
      type: Boolean,
      required: false,
      default: false,
    },
    /**
     * ART RESOLUTION TIER (see cardArt.ts ART TIERS): dense surfaces whose
     * card box stays ≤ ~520 CSS px wide pass 'thumb' and paint the 512-px
     * build of the same picture (9× less decode/GPU); everything else keeps
     * the full 1536-px file. Purely a source swap — layout, fades and the
     * failure chain are identical.
     */
    artTier: {
      type: String as () => CardArtTier,
      required: false,
      default: 'full',
    },
    /**
     * EXTERNALLY-BUILT view-model — the ONE sanctioned entry for a face that
     * is not a manifest card (the MarsBot corporations: their vm is built by
     * `marsBotCorpPremiumVm.ts` from the bot card's own printed data). When
     * set, the manifest lookup is skipped entirely; every render path below
     * (header, art, mechanics, capsule, medallion) is byte-identical.
     */
    vmOverride: {
      type: Object as () => PremiumCardVM | undefined,
      required: false,
      default: undefined,
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
      if (this.vmOverride !== undefined) {
        return this.vmOverride;
      }
      if (this.card === undefined) {
        return printedFaceVm(this.cardName);
      }
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
    /** The fullscreen viewer is reachable (mirrors onClick's own gate). */
    zoomable(): boolean {
      return !this.inert && this.card !== undefined;
    },
    isCorporation(): boolean {
      return this.vm.type === CardType.CORPORATION;
    },
    isCeo(): boolean {
      return this.vm.type === CardType.CEO;
    },
    /** The identity-band role word («CEO» → «ДИРЕКТОР») — an existing key. */
    ceoWord(): string {
      return translateText('CEO');
    },
    /** The CEO rule text, translated — '' hides the zone (Gordon/Van Allen:
     *  their whole rule lives in the effect frames, like the legacy face). */
    proseText(): string {
      return this.vm.prose === undefined ? '' : translateText(this.vm.prose);
    },
    proseTier(): TitleTier {
      return proseTierFor(this.proseText);
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
        // No lower rules block at all (a requirement/VP-only card): the art
        // runs down to the bottom inner border and the corner anchors overlay
        // it — see `.pcard--no-mech` in premium_card.less.
        'pcard--no-mech': this.vm.mechanics.textOnly,
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
    /**
     * The resource socket — rendered for EVERY face whose card CAN hold
     * resources (`resourceType` in the manifest), live model or not (amount
     * defaults 0). The zone is part of the card's PHYSICAL anatomy: gating it
     * on a live count made the mechanics rows re-center between hosts (the
     * `--pcard-res-safe` reserve came and went), so the same card's graphics
     * jumped depending on where it was drawn.
     */
    resourceInfo(): {type: CardResource, amount: number, iconUrl?: string} | undefined {
      if (this.robotCard !== undefined) {
        return {
          type: CardResource.RESOURCE_CUBE,
          amount: this.card?.resources ?? this.robotCard.resources ?? 0,
        };
      }
      const res = this.vm.resource;
      return res === undefined ? undefined : {type: res.type, amount: res.amount, iconUrl: res.iconUrl};
    },
    resourceIconUrl(): string {
      if (this.resourceInfo === undefined) {
        return '';
      }
      // A vm-supplied override (the Ecoline bot corporation stores PLANTS —
      // a standard resource — on its card); else the card-resource family.
      return this.resourceInfo.iconUrl ?? cardResourceIconUrl(this.resourceInfo.type);
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
