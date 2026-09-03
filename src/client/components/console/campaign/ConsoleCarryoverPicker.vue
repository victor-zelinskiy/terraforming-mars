<template>
  <!--
    «НАСЛЕДИЕ ПРОЕКТОВ» — the project carryover selection (0–2 cards of the
    viewer's terminal hand travel into the next mission). HOST-AGNOSTIC: the
    standalone Campaign Map hosts it as an overlay; the endgame workspace
    hosts it as a scene (`embedded` strips the shell). One instance, one
    input path (the host routes intents into `handleIntent`).

    PHYSICALITY: a card has ONE visual owner. A pick physically flies the
    card out of its hand socket into the reserved slot (the socket stays,
    empty — «taken from the hand»); a return flies it back. The flights are
    clone-proxy flights (`cloneFlights.ts` — the draft workspace's engine),
    and the toggle itself never waits on them: a failed measurement degrades
    to the instant swap, never to a lost press.

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
        :class="{
          'con-carry__slot--filled': selected[slotIndex] !== undefined,
          'con-carry__slot--inbound': hiddenSlots.includes(slotIndex),
        }"
        :data-carry-slot="slotIndex"
      >
        <Card
          v-if="selected[slotIndex] !== undefined"
          :card="cardModelOf(selected[slotIndex])"
          :key="selected[slotIndex]"
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

    <!-- The eligible hand row (the recorded terminal hand). A picked card's
         SOCKET stays in the row, empty — the card itself lives in its slot
         (one visual owner); A on the empty socket takes it back. -->
    <div v-if="eligible.length > 0" class="con-carry__row" ref="row">
      <button
        v-for="(name, i) in eligible"
        :key="name + ':' + i"
        type="button"
        class="con-carry__card"
        :class="{
          'con-carry__card--cursor': cursor === i,
          'con-carry__card--away': rowAway(i),
          'con-carry__card--dimmed': !rowAway(i) && selected.length >= 2,
          'con-carry__card--unavailable': unavailable.includes(name),
        }"
        :data-carry-card="name + ':' + i"
        @click="onCardClick(i)"
      >
        <Card :card="cardModelOf(name)" :lightweight="true" :inert="true" />
        <div v-if="unavailable.includes(name) && !rowAway(i)" class="con-carry__unavail" v-i18n>Unavailable in this build</div>
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
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';

function esc(v: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(v) : v.replace(/"/g, '\\"');
}

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
    return {
      cursor: 0,
      /** Row indices whose face is withheld beyond the pick state (a return
       *  flight is inbound — the socket may not re-materialize early). */
      awayLocal: [] as Array<number>,
      /** Slot indices whose face is withheld (a pick flight is inbound —
       *  touchdown is what reveals the real card, never a crossfade). */
      hiddenSlots: [] as Array<number>,
      flights: [] as Array<CloneFlightHandle>,
    };
  },
  beforeUnmount() {
    for (const f of this.flights) {
      f.dispose();
    }
    this.flights = [];
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
    /** The row socket is EMPTY: the card lives in its slot, or is in flight. */
    rowAway(i: number): boolean {
      return this.isPicked(i) || this.awayLocal.includes(i);
    },
    onCardClick(i: number): void {
      this.cursor = i;
      this.toggleAt(i);
    },
    rowCardNode(i: number): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const btn = root.querySelector<HTMLElement>(`[data-carry-card="${esc(this.eligible[i] + ':' + i)}"]`);
      return btn?.querySelector<HTMLElement>(':scope :is(.card-container, .pcard)') ?? null;
    },
    slotCardNode(k: number): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      return root.querySelector<HTMLElement>(`[data-carry-slot="${k}"] :is(.card-container, .pcard)`);
    },
    toggleAt(i: number): void {
      const name = this.eligible[i];
      if (name === undefined || this.submitting) {
        return;
      }
      if (this.unavailable.includes(name) && !this.selected.includes(name)) {
        return; // A vanished card may be dropped, never re-picked.
      }
      if (this.selected.includes(name)) {
        this.flyReturn(i, name);
        return;
      }
      if (this.selected.length >= 2) {
        return;
      }
      this.flyPick(i, name);
    },
    /** PICK: the card leaves its hand socket and flies INTO the slot. The
     *  toggle commits first (state is never hostage to an animation); the
     *  flight measures the real destination card a tick later. */
    flyPick(i: number, name: CardName): void {
      const src = this.rowCardNode(i);
      const from = src?.getBoundingClientRect();
      const slotIdx = this.selected.length;
      this.$emit('toggle', name);
      if (src === null || from === undefined || from.width < 8) {
        return; // instant fallback — the pick itself already happened
      }
      this.hiddenSlots.push(slotIdx);
      void this.$nextTick(() => {
        const dest = this.slotCardNode(slotIdx);
        const to = dest?.getBoundingClientRect();
        if (dest === null || to === undefined || to.width < 8) {
          this.hiddenSlots = this.hiddenSlots.filter((k) => k !== slotIdx);
          return;
        }
        this.flights.push(flyCardClones({
          names: [name],
          sourceEl: () => src,
          from: new Map([[name, from]]),
          to: new Map([[name, to]]),
          layerClass: 'con-carry-flight',
          onLand: () => {
            this.hiddenSlots = this.hiddenSlots.filter((k) => k !== slotIdx);
          },
          onDone: () => undefined,
          travelMs: 420,
        }));
      });
    },
    /** RETURN: the card flies OUT of its slot back into its hand socket. The
     *  slot card node is cloned BEFORE the toggle unmounts it. */
    flyReturn(i: number, name: CardName): void {
      const slotIdx = this.selected.indexOf(name);
      const src = this.slotCardNode(slotIdx);
      const from = src?.getBoundingClientRect();
      const rowNode = this.rowCardNode(i);
      const to = rowNode?.getBoundingClientRect();
      if (src === null || from === undefined || from.width < 8 ||
          rowNode === null || to === undefined || to.width < 8) {
        this.$emit('toggle', name); // instant fallback
        return;
      }
      // The socket stays empty until touchdown (`awayLocal` bridges the gap
      // between «no longer picked» and «the card has landed back»).
      this.awayLocal.push(i);
      this.flights.push(flyCardClones({
        names: [name],
        sourceEl: () => src,
        from: new Map([[name, from]]),
        to: new Map([[name, to]]),
        layerClass: 'con-carry-flight',
        onLand: () => {
          this.awayLocal = this.awayLocal.filter((k) => k !== i);
        },
        onDone: () => undefined,
        travelMs: 420,
      }));
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
