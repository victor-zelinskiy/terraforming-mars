<template>
  <div class="pcard__vp" :class="'pcard__vp--' + variant" :aria-label="ariaText">
    <!-- fixed VP -->
    <span v-if="vp.kind === 'fixed'"
          class="pcard__vp-value"
          :class="{'pcard__vp-value--negative': vp.value < 0}">{{ vp.value }}</span>

    <!-- vermin: −1 / city, engraved compact -->
    <span v-else-if="vp.kind === 'vermin'" class="pcard__vp-dyn">
      <span class="pcard__vp-value pcard__vp-value--negative">−1</span>
      <span class="pcard__vp-op pcard__vp-slash">/</span>
      <span class="pcard-ic" :style="cityIconStyle"></span>
      <span class="pcard__vp-asterisk">*</span>
    </span>

    <!--
      conditional: «[icon] : N» — TM's own «trigger : effect» colon, so this
      can never be misread as the «/» rate it is NOT (Search for Life scores a
      flat 3, not 3 per science resource).
    -->
    <span v-else-if="vp.relation === 'conditional'" class="pcard__vp-dyn">
      <span v-if="itemIconUrl !== undefined && bubble === undefined" class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
      <span v-else-if="itemIconUrl !== undefined" class="pcard-mi pcard-mi--bubbled">
        <span class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
        <span class="pcard-mi__bubble" :class="{'pcard-mi__bubble--tile': bubble?.shape === 'tile'}" :style="bubbleStyle"></span>
      </span>
      <span class="pcard__vp-op pcard__vp-colon">:</span>
      <span class="pcard__vp-value" :class="{'pcard__vp-value--negative': vp.points < 0}">{{ pointsText }}</span>
      <span class="pcard__vp-asterisk">*</span>
    </span>

    <!-- per / plain / variable: N · [/ K] · [icon] -->
    <span v-else class="pcard__vp-dyn">
      <span class="pcard__vp-value" :class="{'pcard__vp-value--negative': vp.points < 0}">{{ pointsText }}</span>
      <template v-if="showPer">
        <span class="pcard__vp-op pcard__vp-slash">/</span>
        <span v-if="vp.per > 1" class="pcard__vp-value">{{ vp.per }}</span>
      </template>
      <span v-if="itemIconUrl !== undefined && bubble === undefined" class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
      <span v-else-if="itemIconUrl !== undefined" class="pcard-mi pcard-mi--bubbled">
        <span class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
        <span class="pcard-mi__bubble" :class="{'pcard-mi__bubble--tile': bubble?.shape === 'tile'}" :style="bubbleStyle"></span>
      </span>
      <span v-if="vp.asterisk" class="pcard__vp-asterisk">*</span>
    </span>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * VP BADGE — anchored bottom-right inside the lower section (never touching
 * the card border; the mechanics panel reserves its column via the
 * pcard--vp-<variant> safe classes). A CSS-drawn gold plate that SIZES TO
 * ITS CONTENT (min/max bounded) — a formula can never overflow or clip.
 *
 * The badge speaks ONE grammar, and the RELATION operator is what makes it a
 * formula instead of a pile of symbols (`vp.relation`, derived in the
 * view-model — never guessed here):
 *   fixed / plain / variable   →  «2»   «−1»   «?»
 *   per one                    →  «1 / [jovian]»      — N per EACH
 *   per K                      →  «1 / 3 [microbe]»   — N per EVERY K
 *   conditional (one-or-more)  →  «[science] : 3»     — a flat N behind a threshold
 *   vermin                     →  «−1 / [city]»
 *
 * THE SUBJECT ICON MAY WEAR A CORNER — its render item's `secondaryTag`
 * («2 / [city with the SPACE bubble]» — Turmoil Redux TR22 Nova City, «per
 * SPACE city»). The corner is the mechanics rows' own (`secondaryBubbleOf` +
 * the `.pcard-mi__bubble` markup of PremiumMechNode) — never a second drawing.
 * An icon with no corner keeps the bare `.pcard-ic` it always had.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {PremiumVpVM, PremiumVpVariant, vpVariantOf} from './premiumCardViewModel';
import {mechItemIcon, secondaryBubbleOf, SecondaryBubbleSpec, tagIconStyle} from './premiumCardIcons';
import {translateText} from '@/client/directives/i18n';

defineOptions({name: 'PremiumVpBadge'});
const props = defineProps({
  vp: {
    type: Object as () => PremiumVpVM,
    required: true,
  },
});

const variant = computed((): PremiumVpVariant => {
  return vpVariantOf(props.vp);
});
const pointsText = computed((): string => {
  if (props.vp.kind !== 'dynamic') {
    return '';
  }
  // A bespoke count has no printed amount — the legacy face printed «?»
  // here and so must this one (a gold «0» reads as «worth nothing»).
  if (props.vp.relation === 'variable') {
    return '?';
  }
  return props.vp.points < 0 ? `−${Math.abs(props.vp.points)}` : String(props.vp.points);
});
/*
 * The «/» is the whole point of the badge — but it must never dangle. A
 * per-one relation only earns the operator once there is an icon on the
 * other side of it; a per-K relation always does (the K itself is the
 * subject «every 3» even when its icon is unmapped).
 */
const showPer = computed((): boolean => {
  if (props.vp.kind !== 'dynamic' || props.vp.relation !== 'per') {
    return false;
  }
  return props.vp.per > 1 || itemIconUrl.value !== undefined;
});
const itemIconUrl = computed((): string | undefined => {
  if (props.vp.kind !== 'dynamic' || props.vp.item === undefined) {
    return undefined;
  }
  const icon = mechItemIcon(props.vp.item);
  return icon?.kind === 'img' ? icon.url : undefined;
});
/** The subject icon's corner mark — the mechanics rows' ONE function, read off the same render item. */
const bubble = computed((): SecondaryBubbleSpec | undefined => {
  if (props.vp.kind !== 'dynamic' || props.vp.item === undefined || itemIconUrl.value === undefined) {
    return undefined;
  }
  return secondaryBubbleOf(props.vp.item);
});
/** …seated exactly as a mechanics row seats it: a tag through the ONE tag style. */
const bubbleStyle = computed((): Record<string, string> => {
  const bubbleSpec = bubble.value;
  if (bubbleSpec === undefined) {
    return {};
  }
  return bubbleSpec.tag !== undefined ? tagIconStyle(bubbleSpec.tag) : {backgroundImage: `url(${bubbleSpec.url})`};
});
const cityIconStyle = computed((): Record<string, string> => {
  return {backgroundImage: 'url(assets/tiles/city.png)'};
});
const ariaText = computed((): string => {
  return translateText('Victory points');
});
</script>
