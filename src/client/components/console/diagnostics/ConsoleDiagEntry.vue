<template>
  <div class="con-diagentry" data-diag-entry>
    <template v-if="entry !== undefined">
      <!-- The head: what kind of thing, in a person's words, and how it ended. Its lines are reserved, so two records
           of different shapes stand in the same frame. -->
      <div class="con-diagentry__head" :class="'con-diagentry__head--' + entry.kind">
        <div class="con-diagentry__kicker">
          <span class="con-diagentry__kind">{{ $t(kindLabel) }}</span>
          <span class="con-diagentry__meta">{{ meta }}</span>
        </div>
        <div class="con-diagentry__title">{{ $t(headline) }}</div>
        <div class="con-diagentry__state">
          <span v-if="outcome !== ''" :class="'con-diag__tone--' + outcomeTone">{{ outcome }}</span>
          <span v-if="delivery !== ''" :class="'con-diag__tone--' + deliveryTone">{{ delivery }}</span>
        </div>
      </div>

      <ConsoleScrollArea ref="scroll" class="con-diagentry__scroll" contentClass="con-diagentry__body">
        <!-- THE STACK — the message first; our own frames read, a library's step back. -->
        <section v-if="stack.frames.length > 0" class="con-diagentry__section" data-diag-stack :data-diag-resolved="resolved.length > 0 ? 'yes' : 'no'">
          <div class="con-diagentry__label">{{ $t('Where it happened') }}</div>
          <div class="con-diagentry__message">{{ stack.head }}</div>
          <div
            v-for="(frame, i) in stack.frames"
            :key="i"
            class="con-diagentry__frame"
            :class="{'con-diagentry__frame--lib': !frame.own}"
          >
            <span class="con-diagentry__frame-fn">{{ frame.fn }}</span>
            <span class="con-diagentry__frame-at">{{ frame.where }}</span>
          </div>
        </section>

        <section v-if="episode.length > 0" class="con-diagentry__section" data-diag-episode>
          <div class="con-diagentry__label">{{ $t('How the game recovered') }}</div>
          <div v-for="(fact, i) in episode" :key="i" class="con-diagentry__fact">
            <span class="con-diagentry__fact-key">{{ fact.label === '' ? '' : $t(fact.label) }}</span>
            <span class="con-diagentry__fact-val con-diagentry__fact-val--mono">{{ fact.value }}</span>
          </div>
        </section>

        <section v-if="screen.length > 0" class="con-diagentry__section" data-diag-screen>
          <div class="con-diagentry__label">{{ $t('The screen at that moment') }}</div>
          <div v-for="fact in screen" :key="fact.label" class="con-diagentry__fact">
            <span class="con-diagentry__fact-key">{{ $t(fact.label) }}</span>
            <span class="con-diagentry__fact-val" :class="{'con-diagentry__fact-val--mono': fact.mono}">{{ fact.mono ? fact.value : $t(fact.value) }}</span>
          </div>
        </section>

        <!-- THE FULL TEXT — verbatim what the console received. Long lines wrap; nothing scrolls sideways. -->
        <section class="con-diagentry__section" data-diag-text>
          <div class="con-diagentry__label">{{ $t('Full text') }}</div>
          <pre class="con-diagentry__text">{{ entry.text }}</pre>
        </section>
      </ConsoleScrollArea>
    </template>
    <div v-else class="con-diag__empty">
      <span class="con-diag__empty-title">{{ $t('This record is no longer in the journal') }}</span>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * ONE RECORD IN FULL — «ДИАГНОСТИКА › ЗАПИСЬ». What the developer used to open a browser console for, as a reading
 * surface of the game: the message is the hero, the frames of our own code are readable and a library's step back,
 * the screen's state at that moment is a short table, and the full text is exactly what the console received — in
 * the game's own mono face (it ships with the game, so SteamOS and Windows draw the same glyphs), wrapped, never
 * scrolled sideways.
 *
 * Presentation over one prop; the readings come from `diagnostics/diagnosticsView.ts`. It exposes `scrollBy` — the
 * controller pages the body on ↑ / ↓ (the right stick reaches the same viewport through the overlay's own net).
 */
import {computed, useTemplateRef} from 'vue';
import type {PropType} from 'vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {
  diagClock, diagDelivery, diagEpisodeFacts, diagFrameRows, diagHeadline, diagKindLabel, diagOutcome, DiagResolvedFrame, diagRuntimeLabel, diagScreenFacts,
} from '@/client/diagnostics/diagnosticsView';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleDiagEntry'});
const props = defineProps({
  entry: {type: Object as PropType<DiagEntry | undefined>, default: undefined},
  /** The record's frames read back to their sources (the controller fills them once the record is opened). */
  resolved: {type: Array as PropType<ReadonlyArray<DiagResolvedFrame>>, default: () => []},
});

const scroll = useTemplateRef<{scrollByPx?: (dy: number) => void}>('scroll');

const kindLabel = computed((): string => (props.entry === undefined ? '' : diagKindLabel(props.entry.kind)));
const headline = computed((): string => (props.entry === undefined ? '' : diagHeadline(props.entry)));
/** `Экран игры · 14:07:31 · сборка 1.2.3240 · ×4`. */
const meta = computed((): string => {
  const e = props.entry;
  if (e === undefined) {
    return '';
  }
  const parts = [translateText(diagRuntimeLabel(e.runtime)), diagClock(e.at), translateTextWithParams('build ${0}', [e.build])];
  if (e.count > 1) {
    parts.push(`×${e.count}`);
  }
  return parts.join(' · ');
});
const outcomeReading = computed(() => (props.entry === undefined ? undefined : diagOutcome(props.entry)));
const deliveryReading = computed(() => (props.entry === undefined ? undefined : diagDelivery(props.entry)));
const outcome = computed((): string => (outcomeReading.value === undefined ? '' : translateTextWithParams(outcomeReading.value.key, [...outcomeReading.value.params])));
const outcomeTone = computed((): string => outcomeReading.value?.tone ?? 'plain');
const delivery = computed((): string => (deliveryReading.value === undefined ? '' : translateTextWithParams(deliveryReading.value.key, [...deliveryReading.value.params])));
const deliveryTone = computed((): string => deliveryReading.value?.tone ?? 'plain');
const stack = computed(() => (props.entry === undefined ? {head: '', frames: []} : diagFrameRows(props.entry, props.resolved)));
const screen = computed(() => (props.entry === undefined ? [] : diagScreenFacts(props.entry)));
const episode = computed(() => (props.entry === undefined ? [] : diagEpisodeFacts(props.entry)));

function scrollBy(dy: number): void {
  scroll.value?.scrollByPx?.(dy);
}

defineExpose({scrollBy});
</script>
