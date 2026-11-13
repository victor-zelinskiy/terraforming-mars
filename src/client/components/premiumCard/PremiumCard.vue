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
    <!-- A RESOLUTION (Turmoil Redux) is NOT a project and does not wear the
         project's anatomy: its own face — the bill — stands inside the same
         root, so every host keeps zooming / flying / inspecting one `.pcard`. -->
    <PremiumResolutionFace v-if="isResolution"
                           :vm="vm"
                           :title="translatedTitle"
                           :titleTier="titleTier"
                           :artTier="artTier"
                           :showCode="showCardNumber" />
    <!-- A PARTY is neither a project nor a bill: its own face — the charter — in the same root. -->
    <PremiumPartyFace v-else-if="isCharter"
                      :vm="vm"
                      :title="translatedTitle"
                      :titleTier="titleTier"
                      :showCode="showCardNumber" />
    <template v-else>
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
        <PremiumRequirementsBar v-if="vm.requirements.length > 0" :requirements="vm.requirements" :footnote="vm.requirementFootnote === true" />
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
            <!-- THE PRINTED CATALOG CODE («X31», «DP07», a resolution's «RX01»):
                 engraved beside the stamp in the same pressed-in language — the
                 key the art, the lore and the catalog search resolve by.
                 Technical information, so it is an OPT-IN («Настройки» →
                 «Номера карт», off by default — `cardNumberDisplay.ts`). -->
            <span v-if="vm.code !== undefined && showCardNumber" class="pcard__code" :data-card-code="vm.code">{{ vm.code }}</span>
          </div>
          <div v-if="resourceInfo !== undefined" class="pcard__res">
            <span class="pcard__res-icon" :style="{backgroundImage: `url(${resourceIconUrl})`}"></span>
            <span class="pcard__res-count">{{ resourceInfo.amount }}</span>
          </div>
          <PremiumVpBadge v-if="vm.vp !== undefined" :vp="vm.vp" />
        </div>
      </div>

      <div class="pcard__frame" aria-hidden="true"></div>
    </template>
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

<script setup vapor lang="ts">
import {computed, nextTick, provide, ref, useTemplateRef} from 'vue';
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
import PremiumResolutionFace from './PremiumResolutionFace.vue';
import PremiumPartyFace from './PremiumPartyFace.vue';
import PremiumVpBadge from './PremiumVpBadge.vue';
import {cardNumberDisplayState} from './cardNumberDisplay';
import {PCARD_FLEET_DOCK_KEY, PremiumFleetDockFace} from './premiumFleetDock';
import {printedVmCache} from './premiumCardState';

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

/** The printed face's VM — built once per card name, for the whole page (the cache: `premiumCardState.ts`). */
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
defineOptions({name: 'PremiumCard'});
const props = defineProps({
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
});

const zoomModal = useTemplateRef<{show: () => void}>('zoomModal');
const showZoom = ref(false);

/** The face is a fleet dock: the static manifest flag + the live model's public fleet. */
const fleetDockFace = computed((): PremiumFleetDockFace | undefined => {
  if (props.vmOverride !== undefined) {
    return undefined;
  }
  const card = getCardOrThrow(cardName.value);
  if (card.fleetDock !== true) {
    return undefined;
  }
  return {card: cardName.value, color: props.card?.fleetDocked};
});
/** The player opted into printed card numbers (default off — technical information). */
const showCardNumber = computed((): boolean => {
  return cardNumberDisplayState.enabled;
});
const cardName = computed((): CardName => {
  const name = props.card?.name ?? props.name;
  if (name === undefined) {
    throw new Error('PremiumCard needs either a card model or a card name');
  }
  return name;
});
const cardModel = computed((): CardModel => {
  return props.card ?? ({name: cardName.value} as CardModel);
});
/** A computed (never a value resolved once, at setup) so a keyless re-pointed face re-resolves. */
const vm = computed((): PremiumCardVM => {
  if (props.vmOverride !== undefined) {
    return props.vmOverride;
  }
  if (props.card === undefined) {
    return printedFaceVm(cardName.value);
  }
  return buildPremiumCardViewModel(getCardOrThrow(cardName.value), props.card);
});
const effectiveTier = computed((): PremiumCardTier => {
  if (props.tier !== undefined) {
    return props.tier;
  }
  return props.lightweight ? 'thumb' : 'normal';
});
const translatedTitle = computed((): string => {
  // Tolerate a `Name:variant` id (`:ares` / `:promo` / …) — the dictionary
  // keys only the BASE name, so fall back to it without the suffix.
  return translateCardName(vm.value.title);
});
const titleTier = computed((): TitleTier => {
  return titleTierFor(translatedTitle.value);
});
const isUnavailable = computed((): boolean => {
  if (props.card?.isDisabled) {
    return true;
  }
  return !getPreferences().experimental_ui && props.actionUsed;
});
const showPlayerCube = computed((): boolean => {
  return getPreferences().experimental_ui && props.actionUsed;
});
const interactive = computed((): boolean => {
  return !props.inert;
});
/** The fullscreen viewer is reachable (mirrors onClick's own gate). */
const zoomable = computed((): boolean => {
  return !props.inert && props.card !== undefined;
});
const isCorporation = computed((): boolean => {
  return vm.value.type === CardType.CORPORATION;
});
const isCeo = computed((): boolean => {
  return vm.value.type === CardType.CEO;
});
/** A Turmoil Redux resolution — its own anatomy (`PremiumResolutionFace`), never the project's. */
const isResolution = computed((): boolean => {
  return vm.value.type === CardType.RESOLUTION;
});
/** A Turmoil Redux party drawn as a card — the charter (`PremiumPartyFace`), never the project anatomy. */
const isCharter = computed((): boolean => {
  return vm.value.theme === 'charter';
});
/** The identity-band role word («CEO» → «ДИРЕКТОР») — an existing key. */
const ceoWord = computed((): string => {
  return translateText('CEO');
});
/** The CEO rule text, translated — '' hides the zone (Gordon/Van Allen:
 *  their whole rule lives in the effect frames, like the legacy face). */
const proseText = computed((): string => {
  return vm.value.prose === undefined ? '' : translateText(vm.value.prose);
});
const proseTier = computed((): TitleTier => {
  return proseTierFor(proseText.value);
});
const rootClasses = computed((): Record<string, boolean> => {
  const classes: Record<string, boolean> = {
    ['pcard--theme-' + vm.value.theme]: true,
    ['pcard--mech-' + vm.value.mechanics.density]: true,
    ['pcard--tier-' + effectiveTier.value]: true,
    ['pcard--' + vm.value.slug]: true,
    'pcard--interactive': interactive.value,
    // A RESOLUTION is the BILL anatomy (`.pcard-bill`); its window holds the
    // card's own 3:2 illustration, or — a never-dealt dev example with no
    // art yet — the party's seal over its accent field.
    'pcard--bill': isResolution.value,
    'pcard--resolution-art': isResolution.value && vm.value.parliament?.sealArt !== true,
    'pcard--resolution-seal': isResolution.value && vm.value.parliament?.sealArt === true,
    // A PARTY drawn as a card (Turmoil Redux — ONE FRAMEWORK, Р2): the project's anatomy, its art window the
    // party's seal over its accent field (`partyPremiumVm`).
    'pcard--party-face': !isResolution.value && (isCharter.value || vm.value.parliament?.sealArt === true),
    'pcard--charter': isCharter.value,
    'pcard--unavailable': isUnavailable.value,
    'pcard--selected': props.selected,
    'pcard--cost-mod': vm.value.cost !== undefined && vm.value.cost.delta !== 0,
    'pcard--has-res': resourceInfo.value !== undefined,
    // No lower rules block at all (a requirement/VP-only card): the art
    // runs down to the bottom inner border and the corner anchors overlay
    // it — see `.pcard--no-mech` in premium_card.less. A resolution has
    // its own anatomy and never takes this pose.
    'pcard--no-mech': vm.value.mechanics.textOnly && !isResolution.value && !isCharter.value,
  };
  if (vm.value.vp !== undefined) {
    classes['pcard--vp-' + vpVariantOf(vm.value.vp)] = true;
  }
  return classes;
});
/*
 * The header's safe-area system: the title plate stays full-width; the
 * TEXT insets around the overlay clusters. Pure arithmetic from the VM
 * (tagClusterPlan geometry + cost/modifier presence) — set once as CSS
 * custom properties, never measured from the DOM.
 */
const headerVars = computed((): Record<string, string> => {
  const plan = vm.value.tagCluster;
  const safeL = vm.value.cost === undefined ?
    TITLE_SAFE_BASE :
    (vm.value.cost.delta !== 0 ? TITLE_SAFE_COST_MOD : TITLE_SAFE_COST);
  const safeR = plan.count === 0 ? TITLE_SAFE_BASE : plan.width + TITLE_SAFE_TAG_GAP;
  const vars: Record<string, string> = {
    '--pcard-title-safe-l': `${safeL}px`,
    '--pcard-title-safe-r': `${safeR}px`,
    // Longest unbreakable run — the CSS shrinks the type until IT fits the
    // remaining inline size, so a word is never split (see titleFit.ts).
    '--pcard-title-longest': String(longestWordLength(translatedTitle.value)),
    '--pcard-tag-size': `${plan.size}px`,
    '--pcard-tag-overlap': `${plan.overlap}px`,
    '--pcard-tag-cluster-w': `${plan.width}px`,
  };
  // The bill's party: its accent dyes the band's edge and the seal's tails; its
  // emblem is also the page's watermark (one url, set once — never measured).
  if (vm.value.parliament?.accent !== undefined) {
    vars['--pcard-party-accent'] = vm.value.parliament.accent;
  }
  if ((isResolution.value || isCharter.value) && vm.value.parliament !== undefined) {
    vars['--pcard-party-emblem'] = `url(${vm.value.parliament.emblemUrl})`;
  }
  return vars;
});
const expansionIcon = computed((): string | undefined => {
  return expansionIconUrl(vm.value.expansion);
});
const expansionStyle = computed((): Record<string, string> => {
  return expansionIcon.value !== undefined ? {backgroundImage: `url(${expansionIcon.value})`} : {};
});
const compatibilityIcons = computed((): Array<{module: GameModule, url: string}> => {
  const result: Array<{module: GameModule, url: string}> = [];
  for (const module of vm.value.compatibility) {
    if (module === vm.value.expansion) {
      continue;
    }
    const url = expansionIconUrl(module);
    if (url !== undefined) {
      result.push({module, url});
    }
  }
  return result;
});
/**
 * The resource socket — rendered for EVERY face whose card CAN hold
 * resources (`resourceType` in the manifest), live model or not (amount
 * defaults 0). The zone is part of the card's PHYSICAL anatomy: gating it
 * on a live count made the mechanics rows re-center between hosts (the
 * `--pcard-res-safe` reserve came and went), so the same card's graphics
 * jumped depending on where it was drawn.
 */
const resourceInfo = computed((): {type: CardResource, amount: number, iconUrl?: string} | undefined => {
  if (props.robotCard !== undefined) {
    return {
      type: CardResource.RESOURCE_CUBE,
      amount: props.card?.resources ?? props.robotCard.resources ?? 0,
    };
  }
  const res = vm.value.resource;
  return res === undefined ? undefined : {type: res.type, amount: res.amount, iconUrl: res.iconUrl};
});
const resourceIconUrl = computed((): string => {
  if (resourceInfo.value === undefined) {
    return '';
  }
  // A vm-supplied override (the Ecoline bot corporation stores PLANTS —
  // a standard resource — on its card); else the card-resource family.
  return resourceInfo.value.iconUrl ?? cardResourceIconUrl(resourceInfo.value.type);
});
const ariaLabel = computed((): string => {
  const parts: Array<string> = [translatedTitle.value];
  if (vm.value.cost !== undefined) {
    parts.push(`${vm.value.cost.printed} M€`);
  }
  if (vm.value.vp?.kind === 'fixed') {
    parts.push(`${vm.value.vp.value} ${translateText('VP')}`);
  }
  return parts.join(', ');
});

/*
 * Same Steam-like contract as the legacy face: a single click opens the
 * fullscreen viewer behind the `fullscreen_cards_on_dblclick` preference;
 * hosts that consume clicks intercept via `@click.capture.stop` wrappers.
 */
function onClick() {
  if (props.inert || props.card === undefined) {
    return;
  }
  if (!getPreferences().fullscreen_cards_on_dblclick) {
    return;
  }
  showZoom.value = true;
  nextTick(() => {
    zoomModal.value?.show();
  });
}

/**
 * THE FLEET DOCK, as the face's own state (Turmoil Redux TR06 Water Hauling
 * and its sisters): the ▲ of the printed effect carries a mark slot, and the
 * trade fleet standing on the card sits IN it, in its owner's livery. Handed
 * to the mechanics plate through one injection — the plate draws the node,
 * the card knows what stands on it — so every host that draws the face
 * (the dock stage, the docks column, «Разыграно», the inspector, a rival's
 * table) shows the fleet without knowing whose card it is drawing.
 */
provide(PCARD_FLEET_DOCK_KEY, computed((): PremiumFleetDockFace | undefined => fleetDockFace.value));
</script>
