<template>
  <div class="con-hand con-hand--v2">
    <!-- P13: ONE clean carousel composition - the focused card is
         emphasized IN PLACE (scaled, neighbours calmed); X reads it
         fullscreen. The old duplicate big-preview inspector is gone. -->
    <div class="con-hand__strip-wrap">
      <div class="con-hand__strip con-cards__strip--has-focus" ref="strip">
        <div v-for="(entry, i) in entries"
             :key="entry.card.name + '#' + i"
             class="con-hand__slot"
             :class="{
               'con-hand__slot--selected': i === index,
               'con-hand__slot--unplayable': !saleActive && !entry.playable,
               'con-hand__slot--sale-picked': saleActive && isSaleSelected(entry.card.name),
             }"
             :ref="i === index ? 'selectedSlot' : undefined">
          <Card :card="entry.card" :key="entry.card.name" lightweight />
          <span v-if="entry.robot" class="con-hand__robot" v-i18n>Robots</span>
          <!-- P18: the sale pick wears the unified state band (amber sale
               language) - the tiny corner tick is gone. -->
          <span v-if="saleActive && isSaleSelected(entry.card.name)" class="con-cards__pickband con-cards__pickband--sale" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
        </div>
      </div>

      <!-- The focused card's verdict line - compact context, never a
           duplicate card (X = the universal fullscreen read). -->
      <div v-if="selected !== undefined" class="con-cards__verdictbar con-hand__verdictbar">
        <span class="con-cards__verdict-name">{{ $t(selected.name) }}</span>
        <template v-if="saleActive">
          <span class="con-cards__verdict" :class="isSaleSelected(selected.name) ? 'con-cards__verdict--picked' : 'con-cards__verdict--ok'">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(isSaleSelected(selected.name) ? 'Deselect' : 'Select') }}</span>
          </span>
          <span class="con-cards__verdict con-cards__verdict--go" :class="{'con-cards__verdict--off': saleSelected.length === 0}">
            <GamepadGlyph control="triggerR" />
            <span>{{ $t('Sell') }}: <b>{{ saleSelected.length }}</b> (+{{ saleSelected.length }} M€)</span>
          </span>
        </template>
        <template v-else-if="selectedPlayable">
          <span class="con-cards__verdict con-cards__verdict--ok">
            <GamepadGlyph control="confirm" /><span>{{ $t('Play now') }}</span>
          </span>
        </template>
        <template v-else>
          <span class="con-cards__verdict con-cards__verdict--blocked">
            <span aria-hidden="true">✕</span><span>{{ $t('Unplayable now') }}</span>
          </span>
          <span v-for="(r, i) in reasons.slice(0, 2)" :key="i" class="con-hand__reason con-hand__reason--bar" :class="'con-hand__reason--' + r.type">
            {{ reasonText(r) }}<span v-if="r.current !== undefined" class="con-hand__reason-now"> · {{ $t('Now') }}: {{ r.current }}</span>
          </span>
        </template>
        <span class="con-cards__verdict con-cards__verdict--zoom">
          <GamepadGlyph control="secondary" /><span>{{ $t('Card') }}</span>
        </span>
      </div>

      <div class="con-hand__strip-hints" aria-hidden="true">
        <span class="con-hand__strip-hint"><GamepadGlyph control="dpadH" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-hand__strip-hint"><GamepadGlyph control="triggerR" /><span>{{ $t('Next playable') }}</span></span>
        <span class="con-hand__counter">{{ entries.length === 0 ? 0 : index + 1 }} / {{ entries.length }}</span>
      </div>
      <div v-if="entries.length === 0" class="con-inspector__empty">{{ $t('No cards in hand') }}</div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console Hand section (CONSOLE_MODE_CONCEPT.md §8, P13 rework): ONE
 * centred carousel - the focused card is emphasized IN PLACE and X opens
 * the fullscreen viewer (the duplicate big-preview inspector is gone).
 * PLAYABLE-FIRST sort; the verdict bar under the strip carries the play
 * state + the SERVER's structured unplayable reasons (no hover needed).
 * Selection index is owned by the router; the shell drives movement.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateTextWithParams} from '@/client/directives/i18n';

export type ConsoleHandEntry = {
  card: CardModel,
  playable: boolean,
  /** Hosted on Self-Replicating Robots. */
  robot: boolean,
};

export default defineComponent({
  name: 'ConsoleHandSection',
  components: {Card, GamepadGlyph},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<ConsoleHandEntry>>, required: true},
    index: {type: Number, required: true},
    /** Sell-patents mode: A toggles picks, X confirms (shell owns the flow). */
    saleActive: {type: Boolean, default: false},
    saleSelected: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  },
  computed: {
    selected(): CardModel | undefined {
      return this.entries[this.index]?.card;
    },
    selectedPlayable(): boolean {
      return this.entries[this.index]?.playable === true;
    },
    reasons(): ReadonlyArray<UnplayableReason> {
      return this.selected?.unplayableReasons ?? [];
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
  },
  methods: {
    isSaleSelected(name: string): boolean {
      return this.saleSelected.includes(name);
    },
    reasonText(r: UnplayableReason): string {
      return translateTextWithParams(r.message, (r.params ?? []).map(String));
    },
    scrollSelectedIntoView(): void {
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
    },
  },
  mounted() {
    this.scrollSelectedIntoView();
  },
});
</script>
