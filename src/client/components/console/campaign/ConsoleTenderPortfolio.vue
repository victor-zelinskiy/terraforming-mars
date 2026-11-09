<template>
  <div class="con-tport" :class="{'con-tport--embedded': embedded, 'con-tport--live': live}"
       data-tender-portfolio :data-tender-portfolio-place="place" :data-tender-portfolio-count="entries.length"
       :data-tender-portfolio-ready="readyCount">
    <!--
      THE TENDER DOOR's LIST (§19, the owner 2026-11-09) — the ONE surface a campaign's tenders are met on, at the two
      places a tender can speak: the finale's START (a layer of the deal page the player stands on, opened from the dock's
      «ТЕНДЕРЫ» block) and the THRESHOLD before it (a layer of the legacy album). Host-agnostic: the host owns the focus,
      the pad, the order (`tenderDoorList` — the ones that execute HERE first, then the others with their reason, then the
      done ones) and every verb; this draws the holder's certificates, each in its STATE on this page (a kant · a word ·
      the stamp — never light), and under the row the READING of the focused one — WHAT IT GIVES HERE in live numbers.
      The certificates RISE into these slots out of the dock's miniatures (the host's flight — `heldNames` keeps a slot
      empty until its own touchdown). X is the console's one inspection (`tenderZoomEntry`).
    -->
    <div class="con-tport__row" data-tport-row>
      <div v-for="(e, i) in entries" :key="e.instance"
           class="con-tport__slot"
           :class="{
             'con-tport__slot--focused': i === focus,
             ['con-tport__slot--' + e.state]: true,
             'con-tport__slot--busy': busy === e.instance,
             'con-tport__slot--held': heldNames.includes(e.instance),
             'con-tport__slot--stamping': stamping.has(e.instance),
           }"
           :data-tport-slot="e.instance" :data-tport-kind="e.id" :data-tport-state="e.state"
           :data-tport-focused="i === focus ? 'yes' : undefined"
           :data-zoom-slot="i === focus ? e.instance : undefined"
           :ref="(el) => setSlotRef(e.instance, el)">
        <ConsoleTenderCard :id="e.id" size="table" :state="tenderCardStateOf(e.status)" :focused="i === focus" />
        <!-- The certificate's word on THIS page: it executes here (a kant), or WHY not — the server's reason / the page it
             speaks on — under the document (never a dim alone). -->
        <span v-if="e.state === 'ready'" class="con-tport__here" data-tport-here>{{ $t('Executes here') }}</span>
        <span v-else-if="e.note !== undefined" class="con-tport__reason" data-tport-reason>{{ $t(e.note) }}</span>
      </div>
    </div>
    <!-- THE READING — the focused tender's effect in this page's numbers; a certificate that cannot go names why in the
         same line. -->
    <div class="con-tport__reading" data-tport-reading :data-tport-reading-state="focused?.state">
      <template v-if="focused !== undefined">
        <span class="con-tport__reading-name">{{ $t(nameOf(focused.id)) }}</span>
        <span class="con-tport__reading-text">{{ readingOf(focused.reading) }}</span>
        <span v-if="busy === focused.instance" class="con-tport__reading-busy">{{ $t('Executing…') }}</span>
        <span v-else-if="focused.state !== 'ready' && focused.note !== undefined" class="con-tport__reading-note">{{ $t(focused.note) }}</span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {TenderId} from '@/common/campaign/tenders';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {
  TenderPlace, TenderPortfolioEntry, TenderReading, tenderCardStateOf, tenderPortfolioName, tenderReadyHere,
} from '@/client/console/campaign/tenderPortfolio';
import {readingText} from '@/client/console/readingText';
import {motionMs} from '@/client/components/motion/motionTokens';

/** How long the one-shot stamp class stands (the CSS keyframe's own length — never a gate). */
const STAMP_MS = 620;

export default defineComponent({
  name: 'ConsoleTenderPortfolio',
  components: {ConsoleTenderCard},
  props: {
    /** The certificates IN THE DOOR's ORDER (the host sorts — `tenderDoorList`). */
    entries: {type: Array as PropType<ReadonlyArray<TenderPortfolioEntry>>, required: true},
    /** The host's cursor over `entries` (−1 = none). */
    focus: {type: Number, required: true},
    place: {type: String as PropType<TenderPlace>, required: true},
    /** The instance whose answer is on the wire. */
    busy: {type: String, required: false, default: undefined},
    /** Slots whose certificate is still in the air (the rise out of the dock) — held empty until their touchdown. */
    heldNames: {type: Array as PropType<ReadonlyArray<string>>, required: false, default: () => []},
    /** The layer stands fully open (a state marker specs read). */
    live: {type: Boolean, required: false, default: false},
    embedded: {type: Boolean, required: false, default: false},
  },
  data() {
    return {
      slotEls: new Map<string, HTMLElement>(),
      /** Instances whose stamp is landing right now (a one-shot class). */
      stamping: new Set<string>(),
      stampTimers: new Map<string, number>(),
    };
  },
  computed: {
    focused(): TenderPortfolioEntry | undefined {
      return this.entries[this.focus];
    },
    readyCount(): number {
      return tenderReadyHere(this.entries);
    },
  },
  beforeUnmount() {
    for (const t of this.stampTimers.values()) {
      window.clearTimeout(t);
    }
  },
  methods: {
    tenderCardStateOf,
    nameOf(id: TenderId): string {
      return tenderPortfolioName(id);
    },
    readingOf(reading: TenderReading): string {
      return readingText({label: reading.key, params: [...reading.params]});
    },
    setSlotRef(instance: string, el: unknown): void {
      if (el instanceof HTMLElement) {
        this.slotEls.set(instance, el);
      } else {
        this.slotEls.delete(instance);
      }
    },
    /** The certificate's element — a flight's source / the stamp's stage. */
    slotEl(instance: string): HTMLElement | undefined {
      return this.slotEls.get(instance);
    },
    /**
     * THE STAMP LANDS — the one-shot event of an execution the player must not miss (the Committee's seal comes down on
     * the certificate). A class the CSS keyframe reads; it ends on its own (reduced motion: the stamp simply stands).
     */
    playStamp(instance: string): void {
      const prev = this.stampTimers.get(instance);
      if (prev !== undefined) {
        window.clearTimeout(prev);
      }
      this.stamping.add(instance);
      this.stamping = new Set(this.stamping);
      this.stampTimers.set(instance, window.setTimeout(() => {
        this.stamping.delete(instance);
        this.stamping = new Set(this.stamping);
        this.stampTimers.delete(instance);
      }, motionMs(STAMP_MS)));
    },
  },
});
</script>
