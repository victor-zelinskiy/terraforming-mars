<template>
  <div class="con-hand">
    <!-- The persistent inspector: the selected card LARGE (this IS the zoom
         at TV distance) + its playability verdict (CONSOLE_MODE_CONCEPT §8). -->
    <aside class="con-inspector con-hand__inspector" :aria-label="$t('Card details')">
      <template v-if="selected !== undefined">
        <div class="con-hand__bigcard">
          <Card :card="selected" :key="selected.name" />
        </div>
        <div v-if="selectedPlayable" class="con-hand__verdict con-hand__verdict--ok">
          <GamepadGlyph control="confirm" />
          <span>{{ $t('Play now') }}</span>
        </div>
        <div v-else class="con-hand__verdict con-hand__verdict--blocked">
          <span class="con-hand__verdict-mark" aria-hidden="true">✕</span>
          <span>{{ $t('Unplayable now') }}</span>
        </div>
        <ul v-if="!selectedPlayable && reasons.length > 0" class="con-hand__reasons">
          <li v-for="(r, i) in reasons" :key="i" class="con-hand__reason" :class="'con-hand__reason--' + r.type">
            {{ reasonText(r) }}<span v-if="r.current !== undefined" class="con-hand__reason-now"> · {{ $t('Now') }}: {{ r.current }}</span>
          </li>
        </ul>
      </template>
      <div v-else class="con-inspector__empty">{{ $t('No cards in hand') }}</div>
    </aside>

    <!-- The filmstrip carousel: playable-first, snap-centered selection. -->
    <div class="con-hand__strip-wrap">
      <div class="con-hand__strip" ref="strip">
        <div v-for="(entry, i) in entries"
             :key="entry.card.name + '#' + i"
             class="con-hand__slot"
             :class="{'con-hand__slot--selected': i === index, 'con-hand__slot--unplayable': !entry.playable}"
             :ref="i === index ? 'selectedSlot' : undefined">
          <Card :card="entry.card" :key="entry.card.name" lightweight />
          <span v-if="entry.robot" class="con-hand__robot" v-i18n>Robots</span>
          <div v-if="i === index && entry.playable" class="con-hand__slot-a">
            <GamepadGlyph control="confirm" /><span v-i18n>Play now</span>
          </div>
        </div>
      </div>
      <div class="con-hand__strip-hints" aria-hidden="true">
        <span class="con-hand__strip-hint"><GamepadGlyph control="dpadH" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-hand__strip-hint"><GamepadGlyph control="triggerR" /><span>{{ $t('Next playable') }}</span></span>
        <span class="con-hand__counter">{{ entries.length === 0 ? 0 : index + 1 }} / {{ entries.length }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console Hand section (CONSOLE_MODE_CONCEPT.md §8): filmstrip carousel +
 * persistent inspector. PLAYABLE-FIRST sort; the selected playable card
 * carries an inline Ⓐ «Разыграть» chip (button-to-element mapping is
 * explicit, per the premium brief). Unplayable cards show the SERVER's
 * structured reasons inline — no hover needed. Selection index is owned by
 * the router (consoleState.handIndex); the shell drives movement.
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
