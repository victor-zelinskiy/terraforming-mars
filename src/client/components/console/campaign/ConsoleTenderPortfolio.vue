<template>
  <div class="con-tport" :class="{'con-tport--embedded': embedded}"
       data-tender-portfolio :data-tender-portfolio-place="place" :data-tender-portfolio-count="entries.length">
    <!--
      THE PORTFOLIO — the ONE surface a campaign's tenders are met on, at the two places a tender can speak: the
      finale's START (the wizard's first step) and the THRESHOLD before it (the carryover picker's first stage).
      Host-agnostic (§16.1): the host owns the focus, the pad and every verb; this draws the holder's certificates in
      acquisition order, each in its STATE on this place (a kant · a word · the stamp — never light), and under the row
      the READING of the focused one — WHAT IT GIVES HERE in live numbers, so the player knows before the press. X is the
      console's one inspection — the host opens the certificate in the shared fullscreen viewer (`tenderZoomEntry`), lifted
      out of its `data-zoom-slot`; the portfolio draws no reader of its own.
    -->
    <div class="con-tport__row" data-tport-row>
      <div v-for="(e, i) in entries" :key="e.instance"
           class="con-tport__slot"
           :class="{
             'con-tport__slot--focused': i === focus,
             ['con-tport__slot--' + e.state]: true,
             'con-tport__slot--busy': busy === e.instance,
             'con-tport__slot--armed': armed === e.instance,
             'con-tport__slot--stamping': stamping.has(e.instance),
           }"
           :data-tport-slot="e.instance" :data-tport-kind="e.id" :data-tport-state="e.state"
           :data-tport-focused="i === focus ? 'yes' : undefined"
           :data-zoom-slot="i === focus ? e.instance : undefined"
           :ref="(el) => setSlotRef(e.instance, el)">
        <ConsoleTenderCard :id="e.id" size="table" :state="tenderCardStateOf(e.status)" :focused="i === focus" />
        <!-- The reason a held certificate cannot go HERE — the server's words, under the document (never a dim alone). -->
        <span v-if="e.state === 'blocked' && e.reason !== undefined" class="con-tport__reason" data-tport-reason>{{ $t(e.reason) }}</span>
        <span v-else-if="e.state === 'step'" class="con-tport__hint" aria-hidden="true">{{ $t('Needs a choice') }}</span>
      </div>
    </div>
    <!-- THE READING — the focused tender's effect in this place's numbers; a confirm names itself in the same line. -->
    <div class="con-tport__reading" data-tport-reading :data-tport-reading-state="focused?.state">
      <template v-if="focused !== undefined">
        <span class="con-tport__reading-name">{{ $t(nameOf(focused.id)) }}</span>
        <span class="con-tport__reading-text">{{ readingOf(focused) }}</span>
        <span v-if="armed === focused.instance && focused.confirm !== undefined" class="con-tport__reading-confirm" data-tport-confirm>{{ readingOf({reading: focused.confirm}) }}</span>
        <span v-else-if="busy === focused.instance" class="con-tport__reading-busy">{{ $t('Executing…') }}</span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {TenderId} from '@/common/campaign/tenders';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {
  TenderPlace, TenderPortfolioEntry, TenderReading, tenderCardStateOf, tenderPortfolioName,
} from '@/client/console/campaign/tenderPortfolio';
import {readingText} from '@/client/console/readingText';
import {motionMs} from '@/client/components/motion/motionTokens';

/** How long the one-shot stamp class stands (the CSS keyframe's own length — never a gate). */
const STAMP_MS = 620;

export default defineComponent({
  name: 'ConsoleTenderPortfolio',
  components: {ConsoleTenderCard},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<TenderPortfolioEntry>>, required: true},
    /** The host's cursor over `entries` (−1 = none). */
    focus: {type: Number, required: true},
    place: {type: String as PropType<TenderPlace>, required: true},
    /** The instance whose press asked for a second press. */
    armed: {type: String, required: false, default: undefined},
    /** The instance whose answer is on the wire. */
    busy: {type: String, required: false, default: undefined},
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
    readingOf(e: {reading: TenderReading}): string {
      return readingText({label: e.reading.key, params: [...e.reading.params]});
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
