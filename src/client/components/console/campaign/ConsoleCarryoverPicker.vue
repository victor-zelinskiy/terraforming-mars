<template>
  <!--
    «НАСЛЕДИЕ ПРОЕКТОВ» — the interlude's mandatory step: 0–2 cards of the
    viewer's terminal hand travel into the next mission. A WORKSPACE-STEP
    STAGE, not a floating modal: its own shade, a full central stage, the
    two keep-slots as a hero row, and the terminal hand fitted by the ONE
    shared stage geometry engine (`consoleWsStageLayout` — the same brain
    every in-game card stage solves with), so the cards take the room the
    screen actually has and read at couch distance.

    HOSTED ONLY BY THE CAMPAIGN MAP (standalone screen + the endgame's
    embedded map scene). Input arrives via `handleIntent`; the verbs render
    in the host's ONE command bar.

    EXPLICIT «БЕЗ ПЕРЕНОСА»: with eligible cards on the table, a zero-card
    confirm must be ARMED first — the first press turns the status line into
    a named warning and relabels the verb; only the second press confirms.
    An accidental X can no longer ship a player into the next mission with
    no legacy. An EMPTY hand needs no arming (there is nothing to miss) —
    its confirm is the plain readiness press.

    PHYSICALITY: a card has ONE visual owner. A pick physically flies the
    card out of its hand socket into the reserved slot (the socket stays,
    empty — «taken from the hand»); a return flies it back. The flights are
    clone-proxy flights (`cloneFlights.ts`), and the toggle itself never
    waits on them: a failed measurement degrades to the instant swap, never
    to a lost press.

    PRIVACY: this surface only ever receives the VIEWER's own cards — the
    wire model never carries anyone else's.
  -->
  <div class="con-carry" :class="{'con-carry--embedded': embedded}" role="dialog" :aria-label="$t('Project legacy')">
    <div class="con-carry__shade" aria-hidden="true"></div>
    <div class="con-carry__stage">
      <div class="con-carry__head">
        <div class="con-carry__kicker" v-i18n>Project legacy</div>
        <div class="con-carry__lede" v-i18n>Keep up to two project cards from your hand — they travel into the next mission, free of charge.</div>
      </div>

      <!-- The keep row: two reserved slots (filled by picks, in pick order)
           + the counter. The hero band of the stage. -->
      <div class="con-carry__keep">
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
            :style="{'--i': slotIndex}"
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
        </div>
        <div class="con-carry__counter">
          <span class="con-carry__counter-num">{{ selected.length }}/2</span>
          <span class="con-carry__counter-note" v-i18n>{{ counterNote }}</span>
        </div>
      </div>

      <!-- The eligible hand (the recorded terminal hand), fitted to the
           room by the shared stage engine. A picked card's SOCKET stays in
           the grid, empty — the card itself lives in its slot (one visual
           owner); A on the empty socket takes it back. -->
      <div v-if="eligible.length > 0" class="con-carry__row" ref="row" :style="rowStyle">
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
          :style="{'--i': i}"
          @click="onCardClick(i)"
        >
          <Card :card="cardModelOf(name)" :lightweight="true" :inert="true" />
          <div v-if="unavailable.includes(name) && !rowAway(i)" class="con-carry__unavail" v-i18n>Unavailable in this build</div>
        </button>
      </div>
      <div v-else class="con-carry__empty">
        <div class="con-carry__empty-mark" aria-hidden="true">—</div>
        <div class="con-carry__empty-text" v-i18n>No cards remained in your hand — the selection completes with nothing to carry.</div>
      </div>

      <div class="con-carry__status">
        <span v-if="armed" class="con-carry__status-warn" v-i18n>Nothing is selected — press again to continue WITHOUT a legacy.</span>
        <span v-else-if="confirmed" class="con-carry__status-ok" v-i18n>Selection confirmed — it can be revised until the next mission launches.</span>
        <span v-else-if="error !== ''" class="con-carry__status-err">{{ $t(error) }}</span>
      </div>
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
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

function esc(v: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(v) : v.replace(/"/g, '\\"');
}

const FIT_RETRIES = 6;

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
  emits: ['toggle', 'confirm', 'back', 'armChange'],
  data() {
    return {
      cursor: 0,
      /**
       * The ARMED zero-carry confirm: with eligible cards present, the first
       * X only raises the warning; the second X is the confirmation. Any
       * other input (nav, toggle, B) disarms — the guard exists precisely
       * against the accidental press.
       */
      armed: false,
      /** Row indices whose face is withheld beyond the pick state (a return
       *  flight is inbound — the socket may not re-materialize early). */
      awayLocal: [] as Array<number>,
      /** Slot indices whose face is withheld (a pick flight is inbound —
       *  touchdown is what reveals the real card, never a crossfade). */
      hiddenSlots: [] as Array<number>,
      flights: [] as Array<CloneFlightHandle>,
      /** The solved stage grid (the shared `--con-cards-zoom` contract). */
      rowStyle: {} as Record<string, string>,
      fitRetries: 0,
      resizeObserver: undefined as ResizeObserver | undefined,
    };
  },
  mounted() {
    this.scheduleFit();
    const stage = this.$el?.querySelector?.('.con-carry__stage') as HTMLElement | null | undefined;
    if (stage !== null && stage !== undefined && typeof ResizeObserver !== 'undefined') {
      // The HOST's box, never the row's own (an engine may not read its own
      // output — the deck-pick circularity).
      this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
      this.resizeObserver.observe(stage);
    }
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
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
      if (this.eligible.length === 0) {
        return 'Confirm readiness';
      }
      if (this.selected.length > 0) {
        return 'Keep the selection';
      }
      return this.armed ? 'Yes — continue without cards' : 'Continue without cards';
    },
  },
  watch: {
    // The fit is per hand (a revise re-opens with the same hand, but stay
    // honest against any change) and armed state disarms on selection moves.
    'eligible.length': function(): void {
      this.scheduleFit();
    },
    'selected.length': function(): void {
      this.disarm();
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
    disarm(): void {
      if (this.armed) {
        this.armed = false;
        this.$emit('armChange', false);
      }
    },
    onCardClick(i: number): void {
      this.cursor = i;
      this.toggleAt(i);
    },
    // ── FIT — the shared stage engine over this stage's own box ──────────
    scheduleFit(): void {
      this.fitRetries = 0;
      void this.$nextTick(() => this.fitRow());
    },
    fitRow(): void {
      const row = this.$refs.row as HTMLElement | null | undefined;
      if (row === null || row === undefined || this.eligible.length === 0) {
        return;
      }
      // Reset the engine's own outputs before measuring (an engine never
      // reads its own output — the deck-pick rule).
      row.style.setProperty('--con-cards-zoom', '1');
      row.style.setProperty('--con-ws-stage-rowmax', '100%');
      const probe = row.children[0] as HTMLElement | undefined;
      const slotW = probe?.offsetWidth ?? 0;
      const slotH = probe?.offsetHeight ?? 0;
      if (slotW <= 0 || slotH <= 0) {
        if (this.fitRetries < FIT_RETRIES) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitRow());
        }
        return;
      }
      this.fitRetries = 0;
      const cs = window.getComputedStyle(row);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const ui = conUiScale();
      // The BUDGET is the stage's remaining room: the stage is a strict flex
      // column whose row is the only flexing part, so the row's parent-given
      // box (clientHeight before our zoom re-applies) is what there is.
      const layout = wsStageLayout({
        availW: row.clientWidth - padX,
        availH: Math.max(160 * ui, row.clientHeight - padY),
        slotW, slotH, n: this.eligible.length, ui, padXPx: padX,
      });
      this.rowStyle = wsStageLayoutStyle(layout);
    },
    // ── toggling + flights ───────────────────────────────────────────────
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
      this.disarm();
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
        this.disarm();
        this.moveCursor(intent.dir);
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        this.toggleAt(this.cursor);
        return true;
      case 'inspect':
        // X = confirm. A ZERO-card confirm over a real hand must be ARMED:
        // the first press raises the named warning, the second confirms —
        // «продолжить без наследия» can never be one accidental press.
        if (this.selected.length === 0 && this.eligible.length > 0 && !this.armed) {
          this.armed = true;
          this.$emit('armChange', true);
          return true;
        }
        this.$emit('confirm');
        return true;
      case 'back':
        // An armed warning is its own level: B disarms first. Otherwise the
        // host decides what «back» means (close the step; the selection
        // stays as last CONFIRMED on the server).
        if (this.armed) {
          this.disarm();
          return true;
        }
        this.$emit('back');
        return true;
      default:
        return true;
      }
    },
    /** The grid cursor follows the SOLVED row shape (per-row from the fit). */
    moveCursor(dir: 'up' | 'down' | 'left' | 'right'): void {
      const n = this.eligible.length;
      if (n === 0) {
        return;
      }
      const perRow = Math.max(1, parseInt(this.rowStyle['--con-ws-stage-per-row'] ?? '') || n);
      let next = this.cursor;
      if (dir === 'left') {
        next = this.cursor - 1;
      } else if (dir === 'right') {
        next = this.cursor + 1;
      } else if (dir === 'up') {
        next = this.cursor - perRow;
      } else if (dir === 'down') {
        next = this.cursor + perRow;
      }
      if (next >= 0 && next < n) {
        this.cursor = next;
      }
    },
  },
});
</script>
