<template>
  <div class="con-vchoice"
       :class="['con-vchoice--' + layout, {'con-vchoice--decided': decided}]"
       role="radiogroup"
       :aria-label="label">
    <!-- THE VARIANT CHOICE — the ONE grammar of «choose one of these» (TR51, `variantChoiceModel.ts`; reworked as
         OUTCOME TILES 2026-10-14). A tile answers one question — «what do I get if I choose this» — in one glance:
         its HERO is the card's own printed graphic of THAT outcome (face node references), bare on the tile's glass
         (never a plate inside a tile inside a group: one frame), at the scene's scale; under it the live reading
         (the host's chips) a step quieter; words only where the print cannot speak. Three facts, three paints, never
         one ring for two of them: the CURSOR (a cold lift + cyan ring), the CHOICE (the SEAL in the corner + a mint
         kant — it stays while the cursor walks away; the unchosen options RECEDE, never hide) and the RULES (a faded
         print and the reason INSIDE the tile — opacity and colour only, never a `filter`: the console strips it).
         The seal's slot is absolute (zero layout) — choosing re-flows nothing. «ИЛИ» is a medallion on the seam,
         the printed OR-connector of the card's own face. -->
    <template v-for="(opt, i) in options" :key="opt.key">
      <div v-if="exclusive && i > 0" class="con-vchoice__or" aria-hidden="true">
        <span class="con-vchoice__or-medal">{{ $t('or') }}</span>
      </div>
      <div class="con-vchoice__opt"
           :class="optionClasses(opt)"
           role="radio"
           :aria-checked="opt.state.selected"
           :aria-disabled="opt.state.off"
           :data-vchoice-key="opt.key"
           :data-vchoice-index="i"
           v-bind="opt.attrs ?? {}"
           @click="$emit('pick', i)">
        <!-- The seal's ✓ is painted (`::after`), never text: an option's words are its own, a probe reading them reads no mark. -->
        <span class="con-vchoice__seal" :class="{'con-vchoice__seal--on': opt.state.selected}" aria-hidden="true"></span>
        <div v-if="opt.printed !== undefined && opt.printed.length > 0" class="con-vchoice__print" data-vchoice-print>
          <!-- The face's own px-authored nodes at the face's own scale, zoomed as ONE object (the asterisk's spark, a
               digit, a production plate's rivets keep their proportions — rem would size only the icons). -->
          <span class="con-vchoice__ink">
            <PremiumMechNode v-for="(node, n) in opt.printed" :key="n" :node="node" />
          </span>
        </div>
        <!-- The words and the reading — one column beside (a row) or under (a tile) the print. -->
        <div v-if="hasText(opt)" class="con-vchoice__text">
          <div v-if="opt.title !== '' || opt.color !== undefined || opt.door" class="con-vchoice__head">
            <span v-if="opt.color !== undefined" class="con-vchoice__dot" :class="'player_bg_color_' + opt.color" aria-hidden="true"></span>
            <span v-if="opt.title !== ''" class="con-vchoice__title">{{ opt.title }}</span>
            <span v-if="opt.door" class="con-vchoice__door" aria-hidden="true">›</span>
          </div>
          <div v-if="$slots.body !== undefined" class="con-vchoice__body">
            <slot name="body" :option="opt" :index="i" />
          </div>
          <div v-if="opt.state.off && opt.reason !== undefined && opt.reason !== ''" class="con-vchoice__reason">
            <span class="con-vchoice__reason-mark" aria-hidden="true">✕</span>{{ opt.reason }}
          </div>
          <!-- LIVE and changing nothing right now: a calm fact on the same plate shape, never a refusal. -->
          <div v-else-if="quiet(opt)" class="con-vchoice__reason con-vchoice__reason--quiet" data-vchoice-quiet>
            <span class="con-vchoice__reason-mark" aria-hidden="true">○</span>{{ opt.quiet }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {groupDecided, variantOptionClasses, variantQuiet, VariantChoiceOption} from '@/client/console/variantChoiceModel';

export default defineComponent({
  name: 'ConsoleVariantChoice',
  components: {PremiumMechNode},
  props: {
    options: {type: Array as PropType<ReadonlyArray<VariantChoiceOption>>, required: true},
    /**
     * `compare` — tiles side by side (a column when the cluster is narrow; the host measures the axis off
     * `.con-vchoice__opt` and walks ←→ in a row); `column` — the same tiles always stacked, each a row with the print
     * leading (a host whose cursor walks rows with ↑↓); `list` — one row per option (a pick list).
     */
    layout: {type: String as PropType<'compare' | 'column' | 'list'>, default: 'compare'},
    /** Mutually exclusive results — the «ИЛИ» medallion between the options. */
    exclusive: {type: Boolean, default: true},
    /** The radiogroup's accessible name (already translated). */
    label: {type: String, default: ''},
  },
  emits: ['pick'],
  computed: {
    decided(): boolean {
      return groupDecided(this.options);
    },
  },
  methods: {
    optionClasses(opt: VariantChoiceOption): Record<string, boolean> {
      return {...variantOptionClasses(opt.state, this.decided), 'con-vchoice__opt--quiet': variantQuiet(opt)};
    },
    quiet(opt: VariantChoiceOption): boolean {
      return variantQuiet(opt);
    },
    /** Anything beside the print — words, the host's body, a refusal. */
    hasText(opt: VariantChoiceOption): boolean {
      return opt.title !== '' || opt.color !== undefined || opt.door === true || this.$slots.body !== undefined ||
        (opt.state.off && opt.reason !== undefined && opt.reason !== '') || variantQuiet(opt);
    },
  },
});
</script>
