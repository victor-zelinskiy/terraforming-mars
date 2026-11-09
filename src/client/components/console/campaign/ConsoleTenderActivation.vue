<template>
  <div class="con-tsheet"
       :class="{'con-tsheet--open': open, 'con-tsheet--leaving': leaving, 'con-tsheet--committed': committed}"
       data-tender-sheet :data-tender-sheet-id="plan.id" :data-tender-sheet-kind="plan.kind"
       :data-tender-sheet-open="open ? 'yes' : undefined">
    <!--
      THE ACTIVATION SHEET (§20 — the owner, 2026-11-09: «игрок не понимает, что он делает и что получает»). The tender
      chosen in the door's list is the HERO of its own scene — the certificate itself, carried here out of its list slot
      (the host's flight; `heroHeld` keeps the seat empty until the touchdown) — and beside it the RESULT in the table's
      live numbers: what changes (`from → to`), what it costs or clears, and the one verb on the bar. The press stamps
      the certificate (the Committee's seal — a one-shot event), the sheet folds and the hero flies home to its miniature
      while the page whose cards it changes surfaces and plays the change itself.
      Host-agnostic: the host owns the focus, the pad, the flights and every verb.
    -->
    <div class="con-tsheet__hero" :class="{'con-tsheet__hero--held': heroHeld, 'con-tsheet__hero--stamping': stamping}"
         ref="hero" data-tsheet-hero>
      <ConsoleTenderCard :id="plan.id" size="table" :state="committed ? 'executed' : 'held'" />
    </div>
    <div class="con-tsheet__panel" data-tsheet-panel>
      <span class="con-tsheet__kicker">{{ $t('Result') }}</span>
      <div class="con-tsheet__name">{{ $t(nameKey) }}</div>
      <p class="con-tsheet__rule" data-tsheet-rule>{{ $t(ruleKey) }}</p>
      <div v-if="plan.rows.length > 0" class="con-tsheet__rows">
        <div v-for="row in plan.rows" :key="row.label" class="con-tsheet__row" :data-tone="row.tone" :data-tsheet-row="row.label">
          <span class="con-tsheet__label">{{ $t(row.label) }}</span>
          <span class="con-tsheet__value">
            <template v-if="row.from !== undefined">
              <b class="con-tsheet__from" data-tsheet-from>{{ row.from }}</b>
              <i class="con-tsheet__arrow" aria-hidden="true">→</i>
            </template>
            <b class="con-tsheet__to" data-tsheet-to>{{ row.to }}</b>
            <i v-if="row.unit === 'mc'" class="resource_icon resource_icon--megacredits con-tsheet__mc" aria-hidden="true"></i>
            <i v-else class="con-tsheet__unit" :class="'con-tsheet__unit--' + row.unit" aria-hidden="true"></i>
          </span>
        </div>
      </div>
      <!-- «ЦЕЛЕВОЙ ЗАПРОС»: the tag is named HERE — the decision about the tender itself — each medallion with the deck's
           own count (a tag with none is off, with its reason on the bar). -->
      <div v-if="tags !== undefined" class="con-tsheet__tags" data-tender-mode="tag">
        <div v-for="(t, i) in tags" :key="t.tag" class="con-tsheet__tag"
             :class="{
               'con-tsheet__tag--focused': i === tagFocus,
               'con-tsheet__tag--picked': t.tag === tagPicked,
               'con-tsheet__tag--off': t.count === 0,
               'con-tsheet__tag--short': t.count > 0 && t.count < 3,
             }"
             :data-tender-tag="t.tag" :data-tender-tag-count="t.count === Infinity ? undefined : t.count"
             :data-tender-tag-off="t.count === 0 ? 'yes' : undefined"
             :data-tender-mode-picked="t.tag === tagPicked ? 'yes' : undefined">
          <i class="con-tsheet__tag-icon" :style="t.iconStyle" aria-hidden="true"></i>
          <span class="con-tsheet__tag-name">{{ t.label }}</span>
          <b v-if="t.count !== Infinity" class="con-tsheet__tag-count">{{ t.count }}</b>
        </div>
      </div>
      <ul v-if="plan.notes.length > 0" class="con-tsheet__notes">
        <li v-for="note in plan.notes" :key="note.key" class="con-tsheet__note" :data-tone="note.tone">
          {{ noteText(note) }}
        </li>
      </ul>
      <span v-if="busy" class="con-tsheet__busy">{{ $t('Executing…') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {ActivationNote, TenderActivationPlan} from '@/client/console/campaign/tenderActivation';
import {tenderMeta} from '@/client/console/campaign/tenderMeta';
import {readingText} from '@/client/console/readingText';

/** One medallion of «Целевой запрос»'s chooser. */
export type ActivationTag = {tag: Tag, label: string, count: number, iconStyle: Record<string, string>};

export default defineComponent({
  name: 'ConsoleTenderActivation',
  components: {ConsoleTenderCard},
  props: {
    plan: {type: Object as PropType<TenderActivationPlan>, required: true},
    /** The hero's seat waits for the certificate's own flight (visibility only — the seat is the flight's landing). */
    heroHeld: {type: Boolean, default: false},
    /** The RESULT stands (the panel unfolds once the hero has landed). */
    open: {type: Boolean, default: false},
    /** The press landed: the certificate wears the Committee's stamp. */
    committed: {type: Boolean, default: false},
    /** The stamp's one-shot is running. */
    stamping: {type: Boolean, default: false},
    /** The sheet folds (the hand-over to the page). */
    leaving: {type: Boolean, default: false},
    busy: {type: Boolean, default: false},
    tags: {type: Array as PropType<ReadonlyArray<ActivationTag>>, required: false, default: undefined},
    tagFocus: {type: Number, default: -1},
    tagPicked: {type: String as PropType<Tag>, required: false, default: undefined},
  },
  computed: {
    nameKey(): string {
      return tenderMeta(this.plan.id).nameKey;
    },
    ruleKey(): string {
      return tenderMeta(this.plan.id).ruleKey;
    },
  },
  methods: {
    noteText(note: ActivationNote): string {
      return readingText({label: note.key, params: [...note.params]});
    },
    /** The hero's seat — the certificate's flights land on it and leave from it. */
    heroEl(): HTMLElement | undefined {
      return (this.$refs.hero ?? undefined) as HTMLElement | undefined;
    },
  },
});
</script>
