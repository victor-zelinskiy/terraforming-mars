<template>
  <div ref="root" class="con-sys con-sys--diag" role="dialog" :aria-label="$t('Diagnostics')" :data-diag-step="s.step">
    <div class="con-sys__backdrop" aria-hidden="true"></div>

    <div class="con-sys__card">
      <div class="con-sys__head">
        <span class="con-sys__emblem" aria-hidden="true">⊙</span>
        <span class="con-sys__crumb">
          <span class="con-sys__crumb-root">{{ $t('Diagnostics') }}</span>
          <span
            v-for="(segment, i) in crumb"
            :key="segment.key"
            class="con-diag__crumb-seg"
            :data-diag-crumb="segment.key"
          >
            <span class="con-sys__crumb-sep" aria-hidden="true">›</span>
            <span
              class="con-sys__crumb-stage"
              :class="{'con-sys__crumb-stage--commit': segment.commit, 'con-diag__crumb-subject': i < crumb.length - 1}"
            >{{ segment.text }}</span>
          </span>
        </span>
        <span class="con-sys__tag">{{ $t('version') }} <b>{{ build }}</b></span>
      </div>

      <div class="con-sys__tabs" :class="{'con-diag__tabs--away': s.step !== 'browse'}">
        <GamepadGlyph control="bumperL" class="con-sys__tabs-chip" />
        <nav class="con-set__tabs" :aria-label="$t('Filter')">
          <template v-for="(tab, i) in tabs" :key="tab.id">
            <span v-if="tab.minor" class="con-set__tabs-sep" aria-hidden="true"></span>
            <button
              type="button"
              class="con-set__tab"
              :class="{'con-set__tab--current': i === s.tab, 'con-set__tab--minor': tab.minor}"
              :data-diag-tab="tab.id"
              @click="selectTab(i)"
            >
              <span class="con-set__tab-glyph" aria-hidden="true">{{ tab.glyph }}</span>
              <span class="con-set__tab-name">{{ $t(tab.label) }}</span>
              <span v-if="!tab.minor" class="con-diag__tab-count" :class="{'con-diag__tab-count--none': counts[tab.id] === 0}">{{ counts[tab.id] }}</span>
            </button>
          </template>
        </nav>
        <GamepadGlyph control="bumperR" class="con-sys__tabs-chip" />
      </div>

      <div class="con-sys__body">
        <div class="con-diag">
          <transition name="con-diag-step">
            <!-- BROWSE — the journal under its filter, or the system readout past the seam. -->
            <div v-if="s.step === 'browse'" key="browse" class="con-diag__step">
              <template v-if="!onSystem">
                <ConsoleScrollArea ref="list" class="con-diag__list" contentClass="con-diag__rows">
                  <div
                    v-for="(row, i) in rows"
                    :key="row.id"
                    class="con-diag__row"
                    :class="['con-diag__row--' + row.kind, {'con-diag__row--cursor': i === s.cursor}]"
                    role="button"
                    :data-diag-row="row.family"
                    @click="openRow(i)"
                    @mousemove="s.cursor = i"
                  >
                    <span class="con-diag__row-time">{{ clock(row.at) }}</span>
                    <span class="con-diag__row-kind">{{ $t(kindLabel(row.kind)) }}</span>
                    <span class="con-diag__row-title">{{ $t(headline(row)) }}</span>
                    <span v-if="row.count > 1" class="con-diag__row-count">×{{ row.count }}</span>
                    <span class="con-diag__row-mark" :class="'con-diag__row-mark--' + deliveryTone(row)" aria-hidden="true"></span>
                  </div>
                  <!-- The empty state says what to do next — never a bare «пусто». -->
                  <div v-if="rows.length === 0" class="con-diag__empty" data-diag-empty>
                    <span class="con-diag__empty-mark" aria-hidden="true">✓</span>
                    <span class="con-diag__empty-title">{{ $t(emptyTitle) }}</span>
                    <span class="con-diag__empty-body">{{ $t('If something went wrong and there is no record of it, send a report — it carries everything the developer needs.') }}</span>
                  </div>
                </ConsoleScrollArea>
                <div class="con-set__detail con-diag__detail" aria-live="polite">
                  <div class="con-set__detail-head">
                    <span class="con-set__detail-title">{{ detail.title }}</span>
                    <span class="con-set__detail-value">{{ detail.where }}</span>
                  </div>
                  <div class="con-set__detail-desc con-diag__detail-raw">{{ detail.raw }}</div>
                  <div class="con-set__detail-note con-diag__detail-note">
                    <span v-if="detail.outcome !== ''" :class="'con-diag__tone--' + detail.outcomeTone">{{ detail.outcome }}</span>
                    <span v-if="detail.delivery !== ''" :class="'con-diag__tone--' + detail.deliveryTone">{{ detail.delivery }}</span>
                  </div>
                </div>
              </template>
              <ConsoleDiagSystem v-else ref="system" />
            </div>

            <ConsoleDiagEntry v-else-if="s.step === 'entry'" key="entry" ref="entry" class="con-diag__step" :entry="reading" :resolved="s.resolved[s.entryId]" />

            <ConsoleDiagCheck v-else-if="s.step === 'selftest'" key="selftest" class="con-diag__step" />

            <ConsoleDiagReport v-else key="report" class="con-diag__step" @typed="commitComment" ref="report" />
          </transition>
        </div>
      </div>

      <div class="con-sys__foot" data-diag-foot>
        <span
          v-for="hint in foot"
          :key="hint.label"
          class="con-sys__hint"
          :class="{'con-sys__hint--go': hint.tone === 'go', 'con-sys__hint--off': hint.off}"
        ><GamepadGlyph :control="hint.control" />{{ $t(hint.label) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * THE DIAGNOSTICS SURFACE — the third member of the console's system overlay (beside the system menu and the settings
 * console), on the same `.con-sys` chassis: the same card, crumb head, tab band and foot bar, so it reads as the same
 * product from its first frame.
 *
 * It is a TEMPLATE over `diagnostics/diagnosticsSurface.ts`: every step, every cursor and every flow lives there
 * (input arrives through `GamepadLayer`); this component draws the chassis and the browse step and mounts the other
 * steps' bodies. What stays here is what only a component has — two template refs it LENDS the controller (a scroller
 * for the read-only bodies, the keyboard's own input) and the row kept in view.
 *
 * LAYOUT-SHIFT CONTRACT (the system surface's own, `docs/claude/console/system-surface.md` §3): `.con-diag` has a
 * FIXED height and every step is laid into the same cell — a filter change, a cursor move, a step change move nothing
 * of the card. The tab band stays mounted on every step (it only steps back in paint): unmounting it would move the
 * body up by its height.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleDiagCheck from '@/client/components/console/diagnostics/ConsoleDiagCheck.vue';
import ConsoleDiagEntry from '@/client/components/console/diagnostics/ConsoleDiagEntry.vue';
import ConsoleDiagReport from '@/client/components/console/diagnostics/ConsoleDiagReport.vue';
import ConsoleDiagSystem from '@/client/components/console/diagnostics/ConsoleDiagSystem.vue';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {DiagEntry, DiagKind} from '@/common/diagnostics/DiagnosticModel';
import {diagnosticsBuild} from '@/client/diagnostics/diagnosticsCapture';
import {diagEntries} from '@/client/diagnostics/diagnosticsJournalState';
import {acknowledgeDevNotice} from '@/client/diagnostics/diagnosticsNotice';
import {
  commitDiagnosticsComment, diagOnSystemTab, diagRows, diagSurfaceState, handleDiagnosticsIntent, lendDiagnosticsHands,
} from '@/client/diagnostics/diagnosticsSurface';
import {
  DIAG_REPORT_PLATES, DIAG_TABS, diagClock, diagDelivery, diagHeadline, diagKindLabel, diagOutcome, diagRawLine, diagRuntimeLabel, diagTabCounts,
} from '@/client/diagnostics/diagnosticsView';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

type FootHint = {control: GlyphControl, label: string, tone?: 'go', off?: boolean};
type CrumbSegment = {key: string, text: string, commit: boolean};

defineOptions({name: 'ConsoleDiagnostics'});

const s = diagSurfaceState;
const tabs = DIAG_TABS;
const build = diagnosticsBuild();

const root = useTemplateRef<HTMLElement>('root');
const list = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('list');
const entry = useTemplateRef<{scrollBy?: (dy: number) => void}>('entry');
const system = useTemplateRef<{scrollBy?: (dy: number) => void}>('system');
const report = useTemplateRef<{keyboardIntent?: (intent: GamepadIntent) => boolean}>('report');

const rows = computed((): ReadonlyArray<DiagEntry> => diagRows());
const counts = computed(() => diagTabCounts(diagEntries()));
const onSystem = computed((): boolean => diagOnSystemTab());
const reading = computed((): DiagEntry | undefined => diagEntries().find((e) => e.id === s.entryId));

const emptyTitle = computed((): string => {
  switch (tabs[s.tab]?.id) {
  case 'errors': return 'No errors were recorded';
  case 'stalls': return 'The screen never stalled';
  case 'other': return 'Nothing else was noted';
  default: return 'The journal is empty — nothing went wrong';
  }
});

/** The fixed strip under the list: the cursored record in one glance. Never empty, never another height. */
const detail = computed(() => {
  const row = rows.value[s.cursor];
  if (row === undefined) {
    return {title: translateText('Journal'), where: '', raw: translateText('Errors and stalls of the game are recorded here as they happen.'), outcome: '', outcomeTone: 'plain', delivery: '', deliveryTone: 'plain'};
  }
  const outcome = diagOutcome(row);
  const delivery = diagDelivery(row);
  return {
    title: `${translateText(diagKindLabel(row.kind))} · ${diagClock(row.at)}`,
    where: translateText(diagRuntimeLabel(row.runtime)),
    raw: diagRawLine(row),
    outcome: outcome === undefined ? '' : translateTextWithParams(outcome.key, [...outcome.params]),
    outcomeTone: outcome?.tone ?? 'plain',
    delivery: delivery === undefined ? '' : translateTextWithParams(delivery.key, [...delivery.params]),
    deliveryTone: delivery?.tone ?? 'plain',
  };
});

/** The crumb's tail: it only ever GAINS a segment as the player goes deeper; the last one is the stage. */
const crumb = computed((): ReadonlyArray<CrumbSegment> => {
  const segment = (key: string, label: string, commit = false): CrumbSegment => ({key, text: translateText(label), commit});
  const category = DIAG_REPORT_PLATES.find((p) => p.id === s.category);
  const reportPath = [segment('report', 'Report')];
  if (category !== undefined) {
    reportPath.push(segment(`category-${category.id}`, category.label));
  }
  switch (s.step) {
  case 'entry': return [segment('entry', 'Record')];
  case 'selftest': return [segment('selftest', 'Connection check')];
  case 'category': return [segment('report', 'Report')];
  case 'review': return reportPath;
  case 'sending': return [...reportPath, segment('sending', 'Sending', true)];
  case 'done': return [...reportPath, segment('done', 'Complete', true)];
  case 'failed': return [...reportPath, segment('failed', 'Not sent', true)];
  default: return [];
  }
});

/** The ONE command bar of the surface — what each control does on THIS step. */
const foot = computed((): ReadonlyArray<FootHint> => {
  switch (s.step) {
  case 'browse':
    if (onSystem.value) {
      return [{control: 'dpad', label: 'Scroll'}, {control: 'confirm', label: 'Check the connection', tone: 'go'}, {control: 'back', label: 'Back'}];
    }
    return [
      {control: 'dpad', label: 'Navigate'},
      rows.value.length > 0 ? {control: 'confirm', label: 'Open'} : {control: 'confirm', label: 'Report a problem', tone: 'go'},
      {control: 'back', label: 'Back'},
    ];
  case 'entry':
    return [
      {control: 'stickScroll', label: 'Scroll'},
      {control: 'secondary', label: s.copied ? 'Copied' : 'Copy the text'},
      {control: 'confirm', label: 'Report a problem', tone: 'go'},
      {control: 'back', label: 'Back'},
    ];
  case 'category':
    return [{control: 'dpad', label: 'Navigate'}, {control: 'confirm', label: 'Select'}, {control: 'back', label: 'Back'}];
  case 'review':
    return [
      {control: 'dpad', label: 'Navigate'},
      s.reviewCursor === 0 ? {control: 'confirm', label: 'Write'} : {control: 'confirm', label: 'Send the report', tone: 'go'},
      {control: 'back', label: 'Back'},
    ];
  case 'sending':
    return [{control: 'confirm', label: 'Sending…', off: true}];
  case 'done':
    return [{control: 'confirm', label: 'Close', tone: 'go'}];
  case 'failed':
    return [{control: 'confirm', label: 'Try again', tone: 'go'}, {control: 'back', label: 'Back'}];
  case 'selftest':
    return [{control: 'confirm', label: s.checking ? 'Checking…' : 'Check again', off: s.checking}, {control: 'back', label: 'Back'}];
  }
});

function clock(at: number): string {
  return diagClock(at);
}
function kindLabel(kind: DiagKind): string {
  return diagKindLabel(kind);
}
function headline(row: DiagEntry): string {
  return diagHeadline(row);
}
function deliveryTone(row: DiagEntry): string {
  return diagDelivery(row)?.tone ?? 'none';
}

/** A mouse click on a tab / a row runs the same branch the pad does. */
function selectTab(i: number): void {
  if (s.step === 'browse') {
    s.tab = i;
    s.cursor = 0;
  }
}
function openRow(i: number): void {
  s.cursor = i;
  handleDiagnosticsIntent({kind: 'press', button: 'confirm'});
}
function commitComment(text: string | undefined): void {
  commitDiagnosticsComment(text);
}

/** Keep the cursored row inside the list's viewport (asked of the row's rendered cursor class, in its own container). */
function keepCursorVisible(): void {
  void nextTick(() => {
    const el = root.value?.querySelector('.con-diag__row--cursor') ?? null;
    list.value?.ensureVisible?.(el);
  });
}
watch(() => [s.cursor, s.tab, s.step] as const, keepCursorVisible);

onMounted(() => {
  // What the developer's notice counted is seen now.
  acknowledgeDevNotice();
  lendDiagnosticsHands({
    scrollBy: (dy) => (s.step === 'entry' ? entry.value : system.value)?.scrollBy?.(dy),
    keyboard: (intent) => report.value?.keyboardIntent?.(intent) ?? false,
  });
  keepCursorVisible();
});
onBeforeUnmount(() => lendDiagnosticsHands({}));
</script>
