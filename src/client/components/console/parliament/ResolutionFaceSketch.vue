<template>
  <!--
    DESIGN SKETCHES of the resolution face («Лицо резолюции», block A) — three
    DIRECTIONS of one object, live on the resolutions stand so they are judged
    at the game's own sizes beside real project cards. A sketch is the premium
    face's px design space (320×460, hosts zoom `.pcard`), the ONE formula
    renderer (`PremiumMechanicsPanel` / `PremiumMechNode`) and the shared art
    pipeline — only the anatomy differs. TEMPORARY: the chosen direction is
    promoted to the production face and this file is deleted with the others.
  -->
  <div class="pcard rface" :class="rootClasses" :style="rootVars" role="img" :aria-label="title">
    <!-- ── A · «ГРАМОТА» — the bill as a DOCUMENT: folded corner, vellum heading, the author's seal ── -->
    <template v-if="direction === 'charter'">
      <div class="rface__sheet">
        <div class="rface__artwrap"><PremiumCardArt :art="art" :tier="artTier" /></div>
        <div class="rface__head">
          <div class="rface__title pcard__title" :class="'pcard__title--t' + titleTier"><span>{{ title }}</span></div>
        </div>
        <div class="rface__ribbon" aria-hidden="true"></div>
        <div class="rface__body"><PremiumMechanicsPanel :mechanics="vm.mechanics" /></div>
        <div class="rface__foot">
          <span class="rface__quest" aria-hidden="true">
            <svg class="rface__chair" viewBox="0 0 16 16"><path d="M4 1.5h8a1 1 0 0 1 1 1V9H3V2.5a1 1 0 0 1 1-1Zm-2 8.6h12v2.2h-1.4v2.2h-1.7v-2.2H5.1v2.2H3.4v-2.2H2Z" /></svg>
            <PremiumMechNode v-for="(node, i) in questNodes" :key="i" :node="node" />
          </span>
        </div>
        <span class="rface__fold" aria-hidden="true"></span>
        <span class="rface__keyline" aria-hidden="true"></span>
      </div>
      <span class="rface__seal" aria-hidden="true"><img :src="emblemUrl" alt="" /></span>
    </template>

    <!-- ── B · «ШТАНДАРТ» — the bill as the PARTY'S BANNER: pennant silhouette, enamel in the party's colour ── -->
    <template v-else-if="direction === 'standard'">
      <div class="rface__sheet">
        <div class="rface__artwrap"><PremiumCardArt :art="art" :tier="artTier" /></div>
        <div class="rface__head">
          <div class="rface__title pcard__title" :class="'pcard__title--t' + titleTier"><span>{{ title }}</span></div>
        </div>
        <div class="rface__body"><PremiumMechanicsPanel :mechanics="vm.mechanics" /></div>
        <div class="rface__foot">
          <span class="rface__quest" aria-hidden="true">
            <svg class="rface__chair" viewBox="0 0 16 16"><path d="M4 1.5h8a1 1 0 0 1 1 1V9H3V2.5a1 1 0 0 1 1-1Zm-2 8.6h12v2.2h-1.4v2.2h-1.7v-2.2H5.1v2.2H3.4v-2.2H2Z" /></svg>
            <PremiumMechNode v-for="(node, i) in questNodes" :key="i" :node="node" />
          </span>
        </div>
      </div>
      <svg class="rface__trim" viewBox="0 0 320 460" aria-hidden="true">
        <path d="M13 6.5H307a6.5 6.5 0 0 1 6.5 6.5V388L160 452.5 6.5 388V13A6.5 6.5 0 0 1 13 6.5Z" />
      </svg>
      <span class="rface__seal" aria-hidden="true"><img :src="emblemUrl" alt="" /></span>
    </template>

    <!-- ── C · «ПЛАНШЕТ» — the bill as a LEGISLATIVE SLATE: glass, full-bleed art, the console's own panel language ── -->
    <template v-else>
      <div class="rface__sheet">
        <div class="rface__artwrap"><PremiumCardArt :art="art" :tier="artTier" /></div>
        <div class="rface__head">
          <span class="rface__chip" aria-hidden="true"><img :src="emblemUrl" alt="" /></span>
          <div class="rface__title pcard__title" :class="'pcard__title--t' + titleTier"><span>{{ title }}</span></div>
        </div>
        <div class="rface__body"><PremiumMechanicsPanel :mechanics="vm.mechanics" /></div>
        <div class="rface__foot">
          <span class="rface__quest" aria-hidden="true">
            <svg class="rface__chair" viewBox="0 0 16 16"><path d="M4 1.5h8a1 1 0 0 1 1 1V9H3V2.5a1 1 0 0 1 1-1Zm-2 8.6h12v2.2h-1.4v2.2h-1.7v-2.2H5.1v2.2H3.4v-2.2H2Z" /></svg>
            <PremiumMechNode v-for="(node, i) in questNodes" :key="i" :node="node" />
          </span>
        </div>
        <span class="rface__edge" aria-hidden="true"></span>
      </div>
      <svg class="rface__trim" viewBox="0 0 320 460" aria-hidden="true">
        <path d="M27 .75H319.25V433L293 459.25H.75V27Z" />
      </svg>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ItemType} from '@/common/cards/render/Types';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {renderableNodes} from '@/client/components/premiumCard/mechanicsModel';
import {longestWordLength, titleTierFor, TitleTier} from '@/client/components/premiumCard/titleFit';
import {translateCardName} from '@/client/directives/i18n';
import {PremiumCardArt as CardArtRef} from '@/client/cards/cardArt';
import PremiumCardArt from '@/client/components/premiumCard/PremiumCardArt.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';

export type ResolutionFaceDirection = 'charter' | 'standard' | 'slate';

export default defineComponent({
  name: 'ResolutionFaceSketch',
  components: {PremiumCardArt, PremiumMechanicsPanel, PremiumMechNode},
  props: {
    vm: {type: Object as () => PremiumCardVM, required: true},
    direction: {type: String as () => ResolutionFaceDirection, required: true},
    /** The dense-surface tier (the same switch the hosts flip with `lightweight`). */
    thumb: {type: Boolean, default: false},
  },
  computed: {
    title(): string {
      return translateCardName(this.vm.title);
    },
    titleTier(): TitleTier {
      return titleTierFor(this.title);
    },
    emblemUrl(): string {
      return this.vm.parliament?.emblemUrl ?? '';
    },
    /** A resolution always resolves an art (its illustration, else its party's emblem). */
    art(): CardArtRef {
      return this.vm.art ?? {url: this.emblemUrl, fallback: false};
    },
    artTier(): 'thumb' | 'full' {
      return this.thumb ? 'thumb' : 'full';
    },
    questNodes(): ReadonlyArray<ItemType> {
      const root = this.vm.parliament?.questRenderData;
      return root === undefined ? [] : renderableNodes(root.rows[0] ?? []);
    },
    rootClasses(): Record<string, boolean> {
      return {
        ['rface--' + this.direction]: true,
        ['pcard--mech-' + this.vm.mechanics.density]: true,
        ['pcard--tier-' + (this.thumb ? 'thumb' : 'full')]: true,
        'rface--seal-art': this.vm.parliament?.sealArt === true,
      };
    },
    rootVars(): Record<string, string> {
      return {
        '--rface-party': this.vm.parliament?.accent ?? '#8b6ad8',
        '--rface-emblem': `url(${this.emblemUrl})`,
        '--pcard-title-longest': String(longestWordLength(this.title)),
      };
    },
  },
});
</script>
