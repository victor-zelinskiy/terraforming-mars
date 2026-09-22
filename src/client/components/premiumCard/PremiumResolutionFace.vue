<!--
@console-shared LIVE — the face of a Turmoil Redux RESOLUTION (the Mars
Parliament's own object). Mounted by `PremiumCard` inside its `.pcard` root, so
every host that draws a resolution (the voting slots, the government, the vote
row, the payout hero, the fullscreen viewer, the flight proxies, the source
dock, the stand) gets this ONE anatomy.
-->
<template>
  <!--
    THE BILL. A resolution is not a project: it has no cost and no tags, nobody
    plays it, it is never held or tabled. It is a bill a PARTY brings in — a
    document with an author, a body every player receives, a clause of its own
    for the winner of the vote, and a condition it puts in force (the chairman
    quest). The face is that document, and its anatomy is its mechanics:

      · the SHEET — a page with a folded corner (no gold frame, no nameplate on
        top, no cost corner): told from a project card by its outline alone;
      · the ILLUSTRATION heads the page, edge to edge;
      · the BAND — a vellum strip bound round the page carries the TITLE, and
        the AUTHOR'S SEAL (the party's own emblem) closes it; the band's lower
        edge is dyed the party's colour. The party reads without a word;
      · the ARTICLES — the printed effect, through the ONE formula renderer
        (`PremiumMechanicsPanel`); the winner's clause is set apart by the row's
        own structure (`MechGroup.winnerRow`);
      · the FOOTNOTE — the chairman quest under a rule: the chair (the mark the
        Parliament already uses for the chairmanship) and the printed condition
        as a graphic. Not a block, and not a caption repeated on every card:
        the words live in the government's quest block and the inspector.
  -->
  <div class="pcard-bill__sheet" aria-hidden="true">
    <div class="pcard-bill__art"><PremiumCardArt :art="art" :tier="artTier" /></div>
    <div class="pcard-bill__band">
      <div class="pcard-bill__title pcard__title" :class="'pcard__title--t' + titleTier"><span>{{ title }}</span></div>
    </div>
    <div class="pcard-bill__articles">
      <PremiumMechanicsPanel v-if="!vm.mechanics.textOnly" :mechanics="vm.mechanics" />
    </div>
    <div class="pcard-bill__foot">
      <span v-if="vm.parliament?.quest !== undefined" class="pcard-bill__quest" :class="{'pcard-bill__quest--words': questNodes.length === 0}">
        <PremiumChairGlyph class="pcard-bill__chair" />
        <!-- The GOAL as a GRAPHIC (the same render-DSL nodes the Parliament's quest block and the
             inspector draw); its words only when no graphic exists. -->
        <span v-if="questNodes.length > 0" class="pcard__quest-graphic">
          <PremiumMechNode v-for="(node, i) in questNodes" :key="i" :node="node" />
        </span>
        <span v-else class="pcard__quest-text">{{ $t(vm.parliament.quest) }}</span>
      </span>
      <!-- The expansion stamp, the DEPENDENCIES beside it (a card that exists only with Venus Next wears the
           Venus medallion the way a project face wears its compatibility — as plainly as the printed scan),
           and the opt-in catalog code («RX01») — pressed into the page's foot. -->
      <span class="pcard-bill__stamp">
        <span v-if="showCode && vm.code !== undefined" class="pcard__code" :data-card-code="vm.code">{{ vm.code }}</span>
        <span class="pcard__exp-medallion" :class="{'pcard__exp-medallion--base': expansionIcon === undefined}" :style="expansionStyle"></span>
        <span v-for="module in compatibilityIcons"
              :key="module.module"
              class="pcard__exp-compat pcard-bill__compat"
              :data-bill-compat="module.module"
              :style="{backgroundImage: `url(${module.url})`}"></span>
      </span>
    </div>
    <!-- The page's printed keyline runs UNDER the folded corner, the way ink does. -->
    <span class="pcard-bill__keyline"></span>
    <span class="pcard-bill__fold"></span>
  </div>
  <!-- THE AUTHOR'S SEAL stands over the sheet's clip (it closes the band across the illustration's edge). -->
  <span class="pcard-bill__seal" aria-hidden="true">
    <span class="pcard-bill__tails"></span>
    <span class="pcard-bill__rosette"></span>
    <img class="pcard__party-emblem" :src="emblemUrl" alt="" draggable="false" />
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ItemType} from '@/common/cards/render/Types';
import {GameModule} from '@/common/cards/GameModule';
import {CardArtTier, PremiumCardArt as CardArtRef} from '@/client/cards/cardArt';
import {PremiumCardVM} from './premiumCardViewModel';
import {renderableNodes} from './mechanicsModel';
import {TitleTier} from './titleFit';
import {expansionIconUrl} from './premiumCardIcons';
import PremiumCardArt from './PremiumCardArt.vue';
import PremiumChairGlyph from './PremiumChairGlyph.vue';
import PremiumMechanicsPanel from './PremiumMechanicsPanel.vue';
import PremiumMechNode from './PremiumMechNode.vue';

export default defineComponent({
  name: 'PremiumResolutionFace',
  components: {PremiumCardArt, PremiumChairGlyph, PremiumMechanicsPanel, PremiumMechNode},
  props: {
    vm: {type: Object as () => PremiumCardVM, required: true},
    /** The translated title and its length tier (the host face already derived both). */
    title: {type: String, required: true},
    titleTier: {type: Number as unknown as () => TitleTier, required: true},
    artTier: {type: String as () => CardArtTier, default: 'full'},
    /** «Настройки» → «Номера карт» (`cardNumberDisplay.ts`), off by default. */
    showCode: {type: Boolean, default: false},
  },
  computed: {
    emblemUrl(): string {
      return this.vm.parliament?.emblemUrl ?? '';
    },
    /** A resolution always resolves an art: its illustration, else its party's emblem (`sealArt`). */
    art(): CardArtRef {
      return this.vm.art ?? {url: this.emblemUrl, fallback: false};
    },
    /** The chairman quest's goal nodes — the first row of its render root. */
    questNodes(): ReadonlyArray<ItemType> {
      const root = this.vm.parliament?.questRenderData;
      return root === undefined ? [] : renderableNodes(root.rows[0] ?? []);
    },
    expansionIcon(): string | undefined {
      return expansionIconUrl(this.vm.expansion);
    },
    expansionStyle(): Record<string, string> {
      return this.expansionIcon !== undefined ? {backgroundImage: `url(${this.expansionIcon})`} : {};
    },
    /** The expansions the resolution DEPENDS on (its `compatibility`, the module itself aside), each with its icon. */
    compatibilityIcons(): Array<{module: GameModule, url: string}> {
      const out: Array<{module: GameModule, url: string}> = [];
      for (const module of this.vm.compatibility) {
        if (module === this.vm.expansion) {
          continue;
        }
        const url = expansionIconUrl(module);
        if (url !== undefined) {
          out.push({module, url});
        }
      }
      return out;
    },
  },
});
</script>
