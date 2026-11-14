<template>
  <transition name="con-devnote">
    <div
      v-if="visible && entry !== undefined"
      class="con-devnote"
      :class="['con-devnote--' + tab, {'con-devnote--folded': view.folded, 'con-devnote--holding': view.holding}]"
      :data-dev-notice="view.folded ? 'chip' : 'plate'"
      :data-dev-notice-kind="entry.kind"
      role="status"
    >
      <!-- THE CHIP — what has not been opened yet, by kind. Always in the DOM beside the plate, each with its own
           glass, both anchored to the same corner: folding is a crossfade of two layers, never a swap. -->
      <div class="con-devnote__chip" aria-hidden="true">
        <span v-if="view.unseenErrors > 0" class="con-devnote__tally con-devnote__tally--errors">
          <span class="con-devnote__tally-mark">✕</span>{{ view.unseenErrors }}
        </span>
        <span v-if="view.unseenStalls > 0" class="con-devnote__tally con-devnote__tally--stalls">
          <span class="con-devnote__tally-mark">◷</span>{{ view.unseenStalls }}
        </span>
        <span class="con-devnote__hold-glyph">
          <GamepadGlyph control="secondary" />
          <span class="con-devnote__hold-fill" :style="{animationDuration: holdMs + 'ms'}"></span>
        </span>
      </div>

      <!-- THE PLATE — the newest record, three short lines sized to the one free corner of the game screen. Keyed by
           the raise, so a NEW record replays the one-shot entry and an episode that only moved updates in place. -->
      <div :key="view.raises" class="con-devnote__plate">
        <div class="con-devnote__top">
          <span class="con-devnote__kind">{{ $t(kindLabel) }}</span>
          <span v-if="outcome !== ''" class="con-devnote__outcome" :class="'con-diag__tone--' + outcomeTone">{{ outcome }}</span>
          <!-- The hold-X hint: the same gesture, the same fill, the same duration as a card of the game's feed. -->
          <span class="con-devnote__hold">
            <span class="con-devnote__hold-glyph">
              <GamepadGlyph control="secondary" />
              <span class="con-devnote__hold-fill" :style="{animationDuration: holdMs + 'ms'}" aria-hidden="true"></span>
            </span>
            <span class="con-devnote__hold-label">{{ $t('Hold to open') }}</span>
          </span>
        </div>
        <div class="con-devnote__title">{{ $t(headline) }}</div>
        <div class="con-devnote__raw">{{ raw }}</div>
      </div>
    </div>
  </transition>
</template>

<script setup vapor lang="ts">
/**
 * THE DEVELOPER'S NOTICE — «Настройки» → ДИАГНОСТИКА → «Уведомления разработчика» (off by default).
 *
 * An error or a stall of the screen, shown the moment it is recorded — in the bottom-left corner of the central
 * opening (the one corner of the game screen nothing else uses: the feed's cards stand top-right, the scales and the
 * hand's dock begin to its right, the bars and both rails are hull), above every game surface and outside the shell,
 * so it stands while the shell does not. It is SIZED to that corner: three short lines, never wider. Over a docked
 * workspace — where no corner is free — it arrives already folded into its chip.
 *
 * Presentation over `diagnostics/diagnosticsNotice.ts` (the poses, the counts, the hold). A standing state is drawn
 * by MATERIAL (CLAUDE.md invariant 15): the kind is a kant on the plate's leading edge and a word — red for an error,
 * amber for a stall; the only motion is the one-shot entry of a NEW record and the fill of the hold.
 */
import {computed} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {NOTIF_HOLD_MS} from '@/client/console/consoleNotifHold';
import {diagEntry} from '@/client/diagnostics/diagnosticsJournalState';
import {devNoticeView, devNoticeVisible} from '@/client/diagnostics/diagnosticsNotice';
import {diagHeadline, diagKindLabel, diagOutcome, diagRawLine, tabOfKind} from '@/client/diagnostics/diagnosticsView';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleDevNotice'});

const view = devNoticeView;
const holdMs = NOTIF_HOLD_MS;

const visible = computed((): boolean => devNoticeVisible());
const entry = computed(() => diagEntry(view.entryId));
const tab = computed((): string => (entry.value === undefined ? 'errors' : tabOfKind(entry.value.kind)));
const kindLabel = computed((): string => (entry.value === undefined ? '' : diagKindLabel(entry.value.kind)));
const headline = computed((): string => (entry.value === undefined ? '' : diagHeadline(entry.value)));
const raw = computed((): string => (entry.value === undefined ? '' : diagRawLine(entry.value)));
const outcomeReading = computed(() => (entry.value === undefined ? undefined : diagOutcome(entry.value)));
const outcome = computed((): string => (outcomeReading.value === undefined ? '' : translateTextWithParams(outcomeReading.value.key, [...outcomeReading.value.params])));
const outcomeTone = computed((): string => outcomeReading.value?.tone ?? 'plain');
</script>
