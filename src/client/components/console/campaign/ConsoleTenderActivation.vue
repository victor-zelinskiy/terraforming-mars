<template>
  <div class="con-tsheet"
       :class="{'con-tsheet--open': open, 'con-tsheet--leaving': leaving, 'con-tsheet--committed': committed, 'con-tsheet--tags': tags !== undefined}"
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
      <!-- «ЦЕЛЕВОЙ ЗАПРОС»: the tag is named HERE — the decision about the tender itself — on the console's PRE-SELECT
           grammar (the variant tiles: `con-vchoice__opt` — the cursor's cold lift and ring, the answer's SEAL in the
           corner and its mint kant that stays while the cursor walks on, the unchosen RECEDE). Each tile is the tag's own
           large medallion and its word; no deck count (the owner, 2026-11-09: at the start the deck has them — it was
           noise). A tag the deck has run out of is a refused tile, shown with its mark, never hidden. ONE grid, its
           columns the host's walk (`tagGridCols`). -->
      <div v-if="tags !== undefined" class="con-tsheet__tags con-vchoice" :class="{'con-vchoice--decided': tagPicked !== undefined}"
           :style="{'--tag-cols': String(cols)}" role="radiogroup" data-tender-mode="tag">
        <div v-for="(t, i) in tags" :key="t.tag" class="con-vchoice__opt con-tsheet__tag"
             :class="tileClasses(t, i)" role="radio" :aria-checked="t.tag === tagPicked" :aria-disabled="t.count === 0"
             :data-tender-tag="t.tag" :data-tender-tag-count="t.count === Infinity ? undefined : t.count"
             :data-tender-tag-off="t.count === 0 ? 'yes' : undefined"
             :data-tender-mode-picked="t.tag === tagPicked ? 'yes' : undefined">
          <span class="con-vchoice__seal" :class="{'con-vchoice__seal--on': t.tag === tagPicked}" aria-hidden="true"></span>
          <i class="con-tsheet__tag-icon" :style="t.iconStyle" aria-hidden="true"></i>
          <span class="con-tsheet__tag-name">{{ t.label }}</span>
          <span v-if="t.count === 0" class="con-tsheet__tag-off" aria-hidden="true">✕</span>
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

<script setup vapor lang="ts">
import {computed, PropType, useTemplateRef} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {ActivationNote, TenderActivationPlan, tagGridCols} from '@/client/console/campaign/tenderActivation';
import {variantOptionClasses} from '@/client/console/variantChoiceModel';
import {tenderMeta} from '@/client/console/campaign/tenderMeta';
import {readingText} from '@/client/console/readingText';

/** One medallion of «Целевой запрос»'s chooser. */
export type ActivationTag = {tag: Tag, label: string, count: number, iconStyle: Record<string, string>};

defineOptions({name: 'ConsoleTenderActivation'});
const props = defineProps({
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
});

const hero = useTemplateRef<HTMLElement>('hero');
const nameKey = computed((): string => {
  return tenderMeta(props.plan.id).nameKey;
});
const ruleKey = computed((): string => {
  return tenderMeta(props.plan.id).ruleKey;
});
const cols = computed((): number => {
  return tagGridCols(props.tags?.length ?? 0);
});
/** A tag tile's three facts on the variant grammar's ONE mapping (cursor · answer · rules). */
function tileClasses(t: ActivationTag, i: number): Record<string, boolean> {
  return variantOptionClasses({focused: i === props.tagFocus, selected: t.tag === props.tagPicked, off: t.count === 0},
    props.tagPicked !== undefined);
}
function noteText(note: ActivationNote): string {
  return readingText({label: note.key, params: [...note.params]});
}
/** The hero's seat — the certificate's flights land on it and leave from it. */
function heroEl(): HTMLElement | undefined {
  return hero.value ?? undefined;
}

defineExpose({heroEl});
</script>
