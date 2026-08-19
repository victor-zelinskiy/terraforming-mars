<template>
  <!--
    VP BADGE — anchored bottom-right inside the lower section (never touching
    the card border; the mechanics panel reserves its column via the
    pcard--vp-<variant> safe classes). A CSS-drawn gold plate that SIZES TO
    ITS CONTENT (min/max bounded) — a formula can never overflow or clip.

    The badge speaks ONE grammar, and the RELATION operator is what makes it a
    formula instead of a pile of symbols (`vp.relation`, derived in the
    view-model — never guessed here):
      fixed / plain / variable   →  «2»   «−1»   «?»
      per one                    →  «1 / [jovian]»      — N per EACH
      per K                      →  «1 / 3 [microbe]»   — N per EVERY K
      conditional (one-or-more)  →  «[science] : 3»     — a flat N behind a threshold
      vermin                     →  «−1 / [city]»
  -->
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
      <span v-if="itemIconUrl !== undefined" class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
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
      <span v-if="itemIconUrl !== undefined" class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
      <span v-if="vp.asterisk" class="pcard__vp-asterisk">*</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PremiumVpVM, PremiumVpVariant, vpVariantOf} from './premiumCardViewModel';
import {mechItemIcon} from './premiumCardIcons';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'PremiumVpBadge',
  props: {
    vp: {
      type: Object as () => PremiumVpVM,
      required: true,
    },
  },
  computed: {
    variant(): PremiumVpVariant {
      return vpVariantOf(this.vp);
    },
    pointsText(): string {
      if (this.vp.kind !== 'dynamic') {
        return '';
      }
      // A bespoke count has no printed amount — the legacy face printed «?»
      // here and so must this one (a gold «0» reads as «worth nothing»).
      if (this.vp.relation === 'variable') {
        return '?';
      }
      return this.vp.points < 0 ? `−${Math.abs(this.vp.points)}` : String(this.vp.points);
    },
    /*
     * The «/» is the whole point of the badge — but it must never dangle. A
     * per-one relation only earns the operator once there is an icon on the
     * other side of it; a per-K relation always does (the K itself is the
     * subject «every 3» even when its icon is unmapped).
     */
    showPer(): boolean {
      if (this.vp.kind !== 'dynamic' || this.vp.relation !== 'per') {
        return false;
      }
      return this.vp.per > 1 || this.itemIconUrl !== undefined;
    },
    itemIconUrl(): string | undefined {
      if (this.vp.kind !== 'dynamic' || this.vp.item === undefined) {
        return undefined;
      }
      const icon = mechItemIcon(this.vp.item);
      return icon?.kind === 'img' ? icon.url : undefined;
    },
    cityIconStyle(): Record<string, string> {
      return {backgroundImage: 'url(assets/tiles/city.png)'};
    },
    ariaText(): string {
      return translateText('Victory points');
    },
  },
});
</script>
