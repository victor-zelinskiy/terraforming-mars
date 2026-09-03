<template>
  <!--
    «НАСЛЕДИЕ ПРОЕКТОВ» — the project carryover selection (0–2 cards of the
    viewer's terminal hand travel into the next mission). HOST-AGNOSTIC: the
    standalone Campaign Map hosts it as an overlay; the endgame workspace
    hosts it as a scene (`embedded` strips the shell). One instance, one
    input path (the host routes intents into `handleIntent`).

    PRIVACY: this surface only ever receives the VIEWER's own cards — the
    wire model never carries anyone else's.
  -->
  <div class="con-carry" :class="{'con-carry--embedded': embedded}" role="dialog" :aria-label="$t('Project legacy')">
    <div v-if="!embedded" class="con-carry__kicker" v-i18n>Project legacy</div>
    <div class="con-carry__lede" v-i18n>Keep up to two project cards from your hand — they travel into the next mission, free of charge.</div>

    <!-- The two reserved slots: filled by picks, in pick order. -->
    <div class="con-carry__slots">
      <div
        v-for="slotIndex in [0, 1]"
        :key="slotIndex"
        class="con-carry__slot"
        :class="{'con-carry__slot--filled': selected[slotIndex] !== undefined}"
      >
        <Card
          v-if="selected[slotIndex] !== undefined"
          :card="cardModelOf(selected[slotIndex])"
          :lightweight="true"
          :inert="true"
        />
        <div v-else class="con-carry__slot-empty" aria-hidden="true"></div>
      </div>
      <div class="con-carry__counter">
        <span class="con-carry__counter-num">{{ selected.length }}/2</span>
        <span class="con-carry__counter-note" v-i18n>{{ counterNote }}</span>
      </div>
    </div>

    <!-- The eligible hand row (the recorded terminal hand). -->
    <div v-if="eligible.length > 0" class="con-carry__row" ref="row">
      <button
        v-for="(name, i) in eligible"
        :key="name + ':' + i"
        type="button"
        class="con-carry__card"
        :class="{
          'con-carry__card--cursor': cursor === i,
          'con-carry__card--picked': isPicked(i),
          'con-carry__card--dimmed': !isPicked(i) && selected.length >= 2,
          'con-carry__card--unavailable': unavailable.includes(name),
        }"
        @click="onCardClick(i)"
      >
        <Card :card="cardModelOf(name)" :lightweight="true" :inert="true" />
        <div v-if="isPicked(i)" class="con-carry__pick-mark" aria-hidden="true">✓</div>
        <div v-if="unavailable.includes(name)" class="con-carry__unavail" v-i18n>Unavailable in this build</div>
      </button>
    </div>
    <div v-else class="con-carry__empty" v-i18n>No cards remained in your hand — the selection completes with nothing to carry.</div>

    <div class="con-carry__status">
      <span v-if="confirmed" class="con-carry__status-ok" v-i18n>Selection confirmed — it can be revised until the next mission launches.</span>
      <span v-else-if="error !== ''" class="con-carry__status-err">{{ $t(error) }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {getCard} from '@/client/cards/ClientCardManifest';

export default defineComponent({
  name: 'ConsoleCarryoverPicker',
  components: {Card},
  props: {
    /** The recorded terminal hand (owner-only wire data). */
    eligible: {type: Array as () => ReadonlyArray<CardName>, required: true},
    /** The current selection, in pick order (0..2). */
    selected: {type: Array as () => ReadonlyArray<CardName>, required: true},
    confirmed: {type: Boolean, required: false, default: false},
    submitting: {type: Boolean, required: false, default: false},
    error: {type: String, required: false, default: ''},
    embedded: {type: Boolean, required: false, default: false},
  },
  emits: ['toggle', 'confirm', 'back'],
  data() {
    return {cursor: 0};
  },
  computed: {
    counterNote(): string {
      return this.selected.length === 0 ? 'Nothing selected' : 'Free to keep — the play cost stays normal';
    },
    /** Cards that no longer resolve in this build (post-update loss, §2.12). */
    unavailable(): ReadonlyArray<CardName> {
      return this.eligible.filter((name) => getCard(name) === undefined);
    },
    /** English i18n KEY for the host's command bar (no params — bars don't interpolate). */
    confirmLabel(): string {
      return this.selected.length === 0 ? 'Continue without cards' : 'Keep the selection';
    },
  },
  methods: {
    cardModelOf(name: CardName): CardModel {
      return {name} as CardModel;
    },
    isPicked(i: number): boolean {
      return this.selected.includes(this.eligible[i]);
    },
    onCardClick(i: number): void {
      this.cursor = i;
      this.toggleAt(i);
    },
    toggleAt(i: number): void {
      const name = this.eligible[i];
      if (name === undefined || this.submitting) {
        return;
      }
      if (this.unavailable.includes(name) && !this.selected.includes(name)) {
        return; // A vanished card may be dropped, never re-picked.
      }
      if (!this.selected.includes(name) && this.selected.length >= 2) {
        return;
      }
      this.$emit('toggle', name);
    },
    /** The host routes pad intents here (single-slot owner pattern). Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.submitting) {
        return true;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'left' && this.cursor > 0) {
          this.cursor--;
        } else if (intent.dir === 'right' && this.cursor < this.eligible.length - 1) {
          this.cursor++;
        }
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        this.toggleAt(this.cursor);
        return true;
      case 'inspect':
        // X = confirm the selection (0 cards included — an explicit «дальше без карт»).
        this.$emit('confirm');
        return true;
      case 'back':
        // B never silently confirms or discards — the host decides what
        // «back» means (close the overlay; the selection stays as submitted).
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
  },
});
</script>
