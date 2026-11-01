<template>
  <!--
    «НАСЛЕДИЕ ПРОЕКТОВ» — the interlude's step: up to `limit` cards of the viewer's terminal hand travel into the next
    mission. P87 (the owner, 2026-11-01): it solved the hand's task in a language of its own — its own grid engine, its
    own slots and sockets, its own cursor frame — and looked bad on a big hand; putting a card back meant pressing an
    empty socket. It now stands on the HAND ALBUM'S CHASSIS:

      · ONE album (`foundation/ConsoleCardAlbum` — the hand's planner and LESS mixins): strict pages from the box,
        the ONE cursor grammar, LB / RB and the d-pad across the edge turn the page, the spine in the foot;
      · keeping is a TOGGLE IN PLACE, as the patent sale's: A on a card stands it in its own slot with a kant and its
        ordinal band («✓ В миссию 2 · 1»), A on it again lets it go — the same key on the same object; nothing leaves
        the album before the confirm, an empty socket does not exist as a concept;
      · the SEAT MANIFEST under the question line names what is kept (a label — never a second face), so a many-page
        hand reads its legacy without turning back;
      · ONE head (`ConsoleWsHead`): the host's root › the mission the cards travel into › НАСЛЕДИЕ ПРОЕКТОВ (cyan →
        amber once confirmed); the limit is the SEAT's (`limit`, the server's number — never a client constant).

    HOSTED ONLY BY THE CAMPAIGN MAP (standalone screen + the endgame's embedded map scene). Input arrives via
    `handleIntent`; the verbs render in the host's ONE command bar. RT confirms; a zero-card confirm over a real hand is
    ARMED first (the first RT warns, the second confirms; B disarms). X inspects in the ONE `consoleCardZoom` pipeline
    (A there is the same toggle). The ENTRY deal and the CONFIRM flight are the host's phrases around this surface
    (`dealIn` / `keptFaces`).

    PRIVACY: this surface only ever receives the VIEWER's own cards.
  -->
  <div class="con-carry" :class="{'con-carry--embedded': embedded, 'con-carry--confirmed': confirmed}"
       role="dialog" :aria-label="$t('Project legacy')" data-carry-stage>
    <div class="con-carry__shade" aria-hidden="true"></div>
    <div class="con-carry__stage">
      <ConsoleWsHead class="con-carry__head" :root="root" :subject="missionLabel" subject-raw
                     stage="Project legacy" :committed="confirmed" />

      <!-- THE QUESTION LINE (the hand's own chassis): the ask on the left, the running summary on the right. -->
      <div class="con-hand__question con-carry__question" data-pick-question>
        <div class="con-hand__question-ask con-carry__ask">
          <span class="con-hand__question-text" data-carry-ask>{{ askText }}</span>
        </div>
        <span class="con-hand__salebar con-carry__summary" role="status" data-carry-summary>
          <span v-if="selected.length === 0" class="con-hand__salebar-item con-hand__salebar-item--zero">
            <span class="con-hand__salebar-label">{{ $t('Nothing selected') }}</span>
          </span>
          <template v-else>
            <span class="con-hand__salebar-item con-hand__salebar-item--gain">
              <b class="con-hand__salebar-num" data-carry-count>{{ keepingText }}</b>
            </span>
            <span class="con-hand__salebar-item">
              <span class="con-hand__salebar-label">{{ $t('free of charge') }}</span>
            </span>
          </template>
        </span>
      </div>

      <!-- THE SEAT MANIFEST — one place per seat of the limit: an empty seat is its number, a taken one its number and
           the card's NAME (a label, never a face — the face is the album's). -->
      <div v-if="limit > 0" class="con-carry__seats" data-carry-seats>
        <TransitionGroup name="con-carry-seat" tag="span" class="con-carry__seats-row">
          <span v-for="seat in seats" :key="'seat' + seat.n"
                class="con-carry__seat" :class="{'con-carry__seat--taken': seat.name !== undefined}"
                :data-carry-seat="seat.n" :data-carry-seat-card="seat.name">
            <b class="con-carry__seat-num">{{ seat.n }}</b>
            <span v-if="seat.name !== undefined" :key="seat.name" class="con-carry__seat-name">{{ $t(seat.name) }}</span>
          </span>
        </TransitionGroup>
      </div>

      <ConsoleCardAlbum v-if="eligible.length > 0"
                        ref="album"
                        class="con-carry__album"
                        :entries="entries"
                        :index="cursor"
                        :held-names="heldNames"
                        @pick="onCardClick"
                        @position="position = $event" />
      <div v-else class="con-carry__empty">
        <div class="con-carry__empty-mark" aria-hidden="true">—</div>
        <div class="con-carry__empty-text" v-i18n>No cards remained in your hand — the selection completes with nothing to carry.</div>
      </div>

      <!-- THE FOOT — the album spine (where it is) and ONE status line (what the step says now). -->
      <div class="con-carry__foot">
        <ConsoleAlbumSpine v-if="eligible.length > 0 && position !== undefined" variant="foot" :album="position"
                           @page="turnPage($event)" />
        <span class="con-carry__status">
          <span v-if="armed" class="con-carry__status-warn" v-i18n>Nothing is selected — press again to continue WITHOUT a legacy.</span>
          <span v-else-if="notice !== ''" class="con-carry__status-warn" data-carry-notice>{{ $t(notice) }}</span>
          <span v-else-if="confirmed" class="con-carry__status-ok" v-i18n>Selection confirmed — it can be revised until the next mission launches.</span>
          <span v-else-if="error !== ''" class="con-carry__status-err">{{ $t(error) }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleCardAlbum, {CardAlbumEntry, CardAlbumPosition} from '@/client/components/console/foundation/ConsoleCardAlbum.vue';
import ConsoleAlbumSpine from '@/client/components/console/foundation/ConsoleAlbumSpine.vue';
import {carryoverAskText, carryoverBandText, carryoverSeats, CarryoverSeat} from '@/client/console/campaign/carryoverPicker';

type AlbumApi = {
  step(from: number, dir: 'left' | 'right' | 'up' | 'down'): number,
  jumpPage(from: number, dir: 1 | -1): number,
  slotEl(name: string): HTMLElement | null,
  faceEl(name: string): HTMLElement | null,
  activePageNames(): Array<string>,
};

/** How long a refusal stays named on the status line. */
const NOTICE_MS = 2400;

export default defineComponent({
  name: 'ConsoleCarryoverPicker',
  components: {ConsoleWsHead, ConsoleCardAlbum, ConsoleAlbumSpine},
  props: {
    /** The recorded terminal hand (owner-only wire data). */
    eligible: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
    /** The current selection, in pick order — the order IS the seat order. */
    selected: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
    /** The SEAT's carry limit (the server's number). */
    limit: {type: Number, required: true},
    /** The mission the cards travel into (1-based). */
    nextMission: {type: Number, required: true},
    /** The host's workspace root (i18n key) — the endgame's results, or the campaign. */
    root: {type: String, default: 'Campaign'},
    confirmed: {type: Boolean, default: false},
    submitting: {type: Boolean, default: false},
    error: {type: String, default: ''},
    embedded: {type: Boolean, default: false},
  },
  emits: ['toggle', 'confirm', 'back', 'armChange', 'bar'],
  data() {
    return {
      cursor: 0,
      /** The ARMED zero-carry confirm (the first RT warns, the second confirms; any other input disarms). */
      armed: false,
      /** A refusal named on the status line («seats are full»), for a beat. */
      notice: '',
      noticeTimer: undefined as number | undefined,
      position: undefined as CardAlbumPosition | undefined,
      /** Cards whose face waits for its own flight (the entry deal). */
      heldNames: [] as Array<string>,
      flights: [] as Array<CloneFlightHandle>,
      zoomOpenedHere: false,
    };
  },
  computed: {
    /** Cards that no longer resolve in this build (post-update loss, §2.12). */
    unavailable(): ReadonlyArray<CardName> {
      return this.eligible.filter((name) => getCard(name) === undefined);
    },
    entries(): Array<CardAlbumEntry> {
      return this.eligible.map((name) => {
        const seat = this.selected.indexOf(name);
        const vanished = this.unavailable.includes(name) && seat < 0;
        return {
          name,
          card: {name} as CardModel,
          picked: seat >= 0,
          band: seat >= 0 ? carryoverBandText(this.nextMission, seat + 1) : undefined,
          disabled: vanished,
          reason: vanished ? translateText('Unavailable in this build') : undefined,
        };
      });
    },
    seats(): Array<CarryoverSeat> {
      return carryoverSeats(this.limit, this.selected);
    },
    missionLabel(): string {
      return translateTextWithParams('Mission ${0}', [String(this.nextMission)]);
    },
    askText(): string {
      return carryoverAskText(this.limit, this.nextMission);
    },
    keepingText(): string {
      return translateTextWithParams('Keeping ${0} / ${1}', [String(this.selected.length), String(this.limit)]);
    },
    full(): boolean {
      return this.selected.length >= this.limit;
    },
    barFacts(): {primary: string, pages: number} {
      return {primary: this.primaryLabel, pages: this.position?.pages ?? 1};
    },
    /** The A verb for the focused card — the bar reads it (one key, one object, two words). */
    primaryLabel(): string {
      const name = this.eligible[this.cursor];
      return name !== undefined && this.selected.includes(name) ? 'Return to hand' : 'Keep for the next mission';
    },
  },
  watch: {
    'selected.length': function(): void {
      this.disarm();
    },
    /** The facts the host's ONE bar reads: the A verb for the focused card and whether pages exist. */
    'barFacts': {
      immediate: true,
      handler(now: {primary: string, pages: number}): void {
        this.$emit('bar', now);
      },
    },
  },
  beforeUnmount() {
    for (const f of this.flights) {
      f.dispose();
    }
    this.flights = [];
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    if (this.zoomOpenedHere && consoleCardZoom.card !== undefined) {
      closeConsoleCardZoom();
    }
    this.zoomOpenedHere = false;
  },
  methods: {
    album(): AlbumApi | undefined {
      return this.$refs.album as AlbumApi | undefined;
    },
    disarm(): void {
      if (this.armed) {
        this.armed = false;
        this.$emit('armChange', false);
      }
    },
    say(notice: string): void {
      this.notice = notice;
      if (this.noticeTimer !== undefined) {
        window.clearTimeout(this.noticeTimer);
      }
      this.noticeTimer = window.setTimeout(() => {
        this.notice = '';
        this.noticeTimer = undefined;
      }, motionMs(NOTICE_MS));
    },
    onCardClick(i: number): void {
      this.cursor = i;
      this.toggleAt(i);
    },
    /** THE TOGGLE IN PLACE — keep / return the same card with the same key; a full set of seats is a NAMED refusal. */
    toggleAt(i: number): void {
      const name = this.eligible[i];
      if (name === undefined || this.submitting) {
        return;
      }
      this.disarm();
      if (this.selected.includes(name)) {
        this.$emit('toggle', name);
        return;
      }
      if (this.unavailable.includes(name)) {
        this.say('Unavailable in this build');
        return;
      }
      if (this.full) {
        this.say(this.limit === 0 ? 'No project card can be carried into this mission' : 'Seats are full — return a card to keep another');
        return;
      }
      this.$emit('toggle', name);
    },
    turnPage(dir: 1 | -1): void {
      const album = this.album();
      if (album !== undefined) {
        this.cursor = album.jumpPage(this.cursor, dir);
      }
    },
    /** The host routes pad intents here. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (consoleCardZoom.card !== undefined || this.submitting) {
        return true; // the zoom host owns the pad while its viewer is up
      }
      if (intent.kind === 'nav') {
        this.disarm();
        const album = this.album();
        if (album !== undefined) {
          this.cursor = album.step(this.cursor, intent.dir);
        }
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'triggerR') {
        if (this.selected.length === 0 && this.eligible.length > 0 && this.limit > 0 && !this.armed) {
          this.armed = true;
          this.$emit('armChange', true);
          return true;
        }
        this.$emit('confirm');
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        this.toggleAt(this.cursor);
        return true;
      case 'inspect':
        this.disarm();
        this.openZoom(this.cursor);
        return true;
      case 'prevSection':
      case 'nextSection':
        this.disarm();
        this.turnPage(action === 'nextSection' ? 1 : -1);
        return true;
      case 'back':
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
    // ── X — the ONE console zoom pipeline; the card lifts out of its album slot, A there is the same toggle ──
    openZoom(at: number): void {
      if (this.eligible.length === 0) {
        return;
      }
      const list = this.eligible.map((name) => ({name} as CardModel));
      const index = Math.min(Math.max(at, 0), list.length - 1);
      this.zoomOpenedHere = true;
      openConsoleCardZoom(list, index, {
        isSelected: (name) => this.selected.includes(name),
        toggle: (name) => {
          const i = this.eligible.indexOf(name);
          if (i >= 0) {
            this.toggleAt(i);
          }
        },
      }, undefined, {
        contextLabel: 'Project legacy',
        origin: {
          kind: 'physical',
          resolve: (i) => {
            const name = this.eligible[i];
            return name !== undefined ? this.album()?.slotEl(name) ?? null : null;
          },
          // LB / RB inside the viewer keeps the album's cursor (and its page) in lockstep.
          onBrowse: (i) => {
            this.cursor = i;
          },
        },
      });
    },
    // ── the host's phrases ──────────────────────────────────────────────
    /**
     * THE ENTRY DEAL — the active page's cards arrive from `from` (the viewer's seat row: «the cards of your hand from
     * the finished mission») into their slots, each slot's face held until its own touchdown. Reduced motion / an
     * unmeasurable end → the album simply stands (nothing is withheld).
     */
    dealIn(from: DOMRect | undefined): void {
      const album = this.album();
      if (album === undefined || from === undefined || from.width < 4 || motionMs(100) === 0) {
        return;
      }
      const names = album.activePageNames() as Array<CardName>;
      const to = new Map<CardName, DOMRect>();
      for (const name of names) {
        const r = album.faceEl(name)?.getBoundingClientRect();
        if (r === undefined || r.width < 8) {
          return; // a half-measured convoy never flies
        }
        to.set(name, r);
      }
      // The source: a small card standing on the seat row, at the destination's aspect.
      const h = Math.max(24, from.height * 1.6);
      const w = h * ((to.get(names[0])?.width ?? 1) / (to.get(names[0])?.height ?? 1));
      const src = new DOMRect(from.left + from.width * 0.18 - w / 2, from.top + from.height / 2 - h / 2, w, h);
      const fromMap = new Map(names.map((n) => [n, src] as [CardName, DOMRect]));
      this.heldNames = [...names];
      // The layer is the convoy's own: it leaves with the last card (a lingering empty layer is a leak).
      const flight: CloneFlightHandle = flyCardClones({
        names,
        sourceEl: (n) => album.faceEl(n),
        from: fromMap,
        to,
        layerClass: 'con-carry-flight',
        onLand: (n) => {
          this.heldNames = this.heldNames.filter((x) => x !== n);
        },
        onDone: () => {
          this.heldNames = [];
          flight.dispose();
          this.flights = this.flights.filter((x) => x !== flight);
        },
        travelMs: 380,
        staggerMs: 60,
      });
      this.flights.push(flight);
    },
    /** The KEPT cards' faces as they stand now — the confirm flight's sources (armed before the POST). */
    keptFaces(): Map<CardName, {el: HTMLElement, rect: DOMRect}> {
      const out = new Map<CardName, {el: HTMLElement, rect: DOMRect}>();
      const album = this.album();
      for (const name of this.selected) {
        const el = album?.faceEl(name) ?? null;
        const rect = el?.getBoundingClientRect();
        // Only a face ON SCREEN is a flight's source (a neighbour page is mounted beyond the clip).
        if (el !== null && rect !== undefined && rect.width >= 8 && rect.right > 0 && rect.left < window.innerWidth) {
          out.set(name, {el, rect});
        }
      }
      return out;
    },
  },
});
</script>
