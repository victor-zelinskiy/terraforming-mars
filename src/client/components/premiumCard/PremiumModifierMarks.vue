<template>
  <!-- THE MODIFIER SEAL (TR49 class): WHAT KIND of modifier bends a requirement, as SYMBOLS — a card silhouette for a
       standing effect of a card on the table (several stack into a little pile), the class's bolt for a one-play
       effect, the party's emblem for a policy, «±» for a rule. Never the source's art: at a seal's size it is noise.
       WHICH card is named in words by the surfaces around it (the verdict, the composer's row). Purely a statement:
       no focus stop, no hint of its own. Sized in `em` — it takes the type size of the line it stands in. -->
  <span v-if="sources.length > 0" class="pcard-modmarks" role="img" :aria-label="label"
        :data-req-marks="sources.length">
    <span v-for="(s, i) in shown" :key="s.key"
          class="pcard-modmark"
          :class="'pcard-modmark--' + s.symbol"
          :style="markStyle(s, i)"
          :data-req-mark="s.symbol"
          :data-req-mark-source="s.card ?? s.resolution ?? s.party ?? s.key"
          :data-req-mark-via="s.via"></span>
    <span v-if="more > 0" class="pcard-modmark pcard-modmark--more" :style="{zIndex: '0'}">+{{ more }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {translateText} from '@/client/directives/i18n';
import {requirementPartyEmblem} from './partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ModifierSourceVM, sealOrder} from './premiumModifierSources';
import {lawName} from '@/client/console/requirementEasingText';

export default defineComponent({
  name: 'PremiumModifierMarks',
  props: {
    sources: {type: Array as PropType<ReadonlyArray<ModifierSourceVM>>, required: true},
    /** Marks drawn before the «+N» mark takes the rest. */
    max: {type: Number, default: 3},
  },
  computed: {
    ordered(): ReadonlyArray<ModifierSourceVM> {
      return sealOrder(this.sources);
    },
    shown(): ReadonlyArray<ModifierSourceVM> {
      return this.ordered.length > this.max ? this.ordered.slice(0, this.max - 1) : this.ordered;
    },
    more(): number {
      return this.sources.length - this.shown.length;
    },
    label(): string {
      return this.sources.map((s) => {
        // An ALLIANCE (TR62) is read as its partner and its card: «Марс вперёд · Альянс Тарсиса».
        if (s.symbol === 'ally' && s.via !== undefined) {
          return [translateText(partyNameKey(s.via)), s.card !== undefined ? translateText(s.card) : ''].filter((n) => n !== '').join(' · ');
        }
        // A LAW (RX36) is read by its own name, never its party's.
        if (s.symbol === 'law' && s.resolution !== undefined) {
          return lawName(s.resolution);
        }
        return s.card !== undefined ? translateText(s.card) : s.party !== undefined ? translateText(partyNameKey(s.party)) : '';
      }).filter((n) => n !== '').join(', ');
    },
  },
  methods: {
    markStyle(s: ModifierSourceVM, i: number): Record<string, string> {
      // A pile of cards: the first lies on top, each next one peeks from behind.
      const style: Record<string, string> = {zIndex: String(this.shown.length - i)};
      const party = s.symbol === 'party' || s.symbol === 'law' ? s.party : s.symbol === 'ally' ? s.via : undefined;
      const emblem = party !== undefined ? requirementPartyEmblem(party) : undefined;
      if (emblem !== undefined) {
        style.backgroundImage = `url(${emblem})`;
      }
      return style;
    },
  },
});
</script>
