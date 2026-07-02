<template>
  <div class="con-turnmenu" role="dialog" :aria-label="$t('Turn menu')">
    <div class="con-turnmenu__backdrop" aria-hidden="true"></div>
    <div class="con-turnmenu__card">
      <div class="con-turnmenu__title">{{ $t('Your turn — available actions') }}</div>
      <div class="con-turnmenu__rows">
        <div v-for="(verb, i) in verbs"
             :key="verb.id"
             class="con-turnmenu__row"
             :class="{'con-turnmenu__row--selected': i === index, 'con-turnmenu__row--disabled': !verb.available}">
          <span class="con-turnmenu__icon" aria-hidden="true">
            <BarButtonIcon v-if="barIconFor(verb.id) !== undefined" :name="barIconFor(verb.id)!" />
            <i v-else-if="resourceIconFor(verb.id) !== undefined" :class="resourceIconFor(verb.id)"></i>
            <span v-else class="con-turnmenu__glyph-fallback">{{ fallbackGlyphFor(verb.id) }}</span>
          </span>
          <span class="con-turnmenu__label">{{ $t(verb.label) }}</span>
          <span v-if="verb.count !== undefined" class="con-turnmenu__count">{{ verb.count }}</span>
          <span v-if="!verb.available" class="con-turnmenu__reason">{{ $t(verb.reason) }}</span>
          <GamepadGlyph v-if="verb.available && i === index" control="confirm" class="con-turnmenu__a" />
        </div>
      </div>
      <div class="con-turnmenu__foot">
        <span class="con-turnmenu__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-turnmenu__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The Turn Menu (CONSOLE_MODE_CONCEPT.md §5) — the console's answer to
 * "what can I do right now": one vertical premium list of every verb the
 * server currently offers, derived from the SAME waitingFor walkers the
 * dedicated desktop buttons use. Blocked verbs stay visible with their
 * reason (principle 4: always show the verbs). The selected available row
 * carries an inline Ⓐ glyph — the button-to-element mapping is explicit.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {TurnVerb, TurnVerbId} from '@/client/console/turnIntents';

const BAR_ICONS: Partial<Record<TurnVerbId, string>> = {
  playCard: 'cards',
  standardProjects: 'standard-projects',
  milestones: 'milestones',
  awards: 'awards',
  colonies: 'colonies',
  hydro: 'hydronetwork',
};

const RESOURCE_ICONS: Partial<Record<TurnVerbId, string>> = {
  convertPlants: 'resource_icon resource_icon--plants con-turnmenu__res-icon',
  convertHeat: 'resource_icon resource_icon--heat con-turnmenu__res-icon',
  sellPatents: 'resource_icon resource_icon--megacredits con-turnmenu__res-icon',
};

const FALLBACK_GLYPHS: Partial<Record<TurnVerbId, string>> = {
  endTurn: '⤳',
  pass: '⏭',
};

export default defineComponent({
  name: 'ConsoleTurnMenu',
  components: {GamepadGlyph, BarButtonIcon},
  props: {
    verbs: {type: Array as PropType<ReadonlyArray<TurnVerb>>, required: true},
    index: {type: Number, required: true},
  },
  methods: {
    barIconFor(id: TurnVerbId): string | undefined {
      return BAR_ICONS[id];
    },
    resourceIconFor(id: TurnVerbId): string | undefined {
      return RESOURCE_ICONS[id];
    },
    fallbackGlyphFor(id: TurnVerbId): string {
      return FALLBACK_GLYPHS[id] ?? '·';
    },
  },
});
</script>
