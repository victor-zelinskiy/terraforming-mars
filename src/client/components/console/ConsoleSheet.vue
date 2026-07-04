<template>
  <div class="con-sheet" role="dialog" :aria-label="$t(title)">
    <div class="con-sheet__backdrop" aria-hidden="true"></div>
    <div class="con-sheet__panel" :class="{'con-sheet__panel--wide': wide}">
      <div class="con-sheet__head">
        <div class="con-sheet__title">{{ $t(title) }}</div>
        <div v-if="subtitle !== ''" class="con-sheet__subtitle">{{ subtitle }}</div>
      </div>
      <div class="con-sheet__rows con-info__scroll" ref="rows">
        <template v-for="(row, i) in rows" :key="row.key">
          <div v-if="row.kind === 'header'" class="con-sheet__group">{{ $t(row.title) }}</div>

          <!-- P22: the RICH milestone/award row — desktop information
               parity in a console-native composition: the localized ART
               plate, the rule text, MY progress (green = claimable now /
               red = not yet), the rivals' compact score badges, the cost
               chip and the action/state zone. -->
          <div v-else-if="row.ma !== undefined"
               class="con-sheet__row con-sheet__row--ma"
               :class="{'con-sheet__row--selected': i === index, 'con-sheet__row--disabled': !row.available && row.takenBy === undefined}"
               :ref="i === index ? 'selectedRow' : undefined">
            <div class="con-sheet__ma-art" aria-hidden="true"
                 :style="{backgroundImage: `url(assets/ma/${maAsset(row)}.png)`}"></div>
            <div class="con-sheet__ma-main">
              <div class="con-sheet__ma-name" v-i18n>{{ row.title }}</div>
              <div v-if="row.sub" class="con-sheet__row-sub con-sheet__row-sub--ma" v-i18n>{{ row.sub }}</div>
              <div v-if="row.takenBy !== undefined" class="con-sheet__row-taken">
                <span :class="'con-status__dot player_bg_color_' + row.takenBy.color"></span>
                <span>{{ row.takenBy.name }}</span>
                <span class="con-sheet__ma-takenlabel">{{ $t(row.ma.kind === 'milestone' ? 'Claimed' : 'Funded') }}</span>
              </div>
              <div v-else-if="!row.available && row.reason" class="con-sheet__row-reason">{{ $t(row.reason) }}</div>
            </div>
            <div class="con-sheet__ma-side">
              <!-- MY progress: value / threshold, eligible-coloured. -->
              <span class="con-sheet__ma-my" :class="myChipClass(row)">
                {{ myScore(row) }}<template v-if="row.ma.threshold !== undefined"> / {{ row.ma.threshold }}</template>
              </span>
              <!-- The rivals (and, for awards, everyone incl. the leader). -->
              <span class="con-sheet__ma-rivals">
                <span v-for="s in rivalScores(row)" :key="s.color"
                      class="con-sheet__ma-rival"
                      :class="['player_bg_color_' + s.color, {'con-sheet__ma-rival--leader': row.ma.kind === 'award' && s.score === leaderScore(row) && s.score > 0}]">
                  {{ s.score }}
                </span>
              </span>
              <span v-if="row.meta" class="con-sheet__row-meta">{{ row.meta }}</span>
              <GamepadGlyph v-if="row.available && i === index" control="confirm" class="con-sheet__a" />
            </div>
          </div>

          <div v-else
               class="con-sheet__row"
               :class="{'con-sheet__row--selected': i === index, 'con-sheet__row--disabled': !row.available}"
               :ref="i === index ? 'selectedRow' : undefined">
            <div class="con-sheet__row-main">
              <i v-if="row.icon" class="con-sheet__row-icon" :class="row.icon" aria-hidden="true"></i>
              <span class="con-sheet__row-title">{{ $t(row.title) }}</span>
              <span v-if="row.meta" class="con-sheet__row-meta">{{ row.meta }}</span>
              <span v-if="row.takenBy !== undefined" class="con-sheet__row-taken">
                <span :class="'con-status__dot player_bg_color_' + row.takenBy.color"></span>
                {{ row.takenBy.name }}
              </span>
              <GamepadGlyph v-if="row.available && i === index" control="confirm" class="con-sheet__a" />
            </div>
            <div v-if="row.sub" class="con-sheet__row-sub" v-i18n>{{ row.sub }}</div>
            <div v-if="!row.available && row.reason" class="con-sheet__row-reason">{{ $t(row.reason) }}</div>
          </div>
        </template>
      </div>
      <div class="con-sheet__foot">
        <span class="con-sheet__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-sheet__foot-item"><GamepadGlyph control="stickScroll" /><span>{{ $t('Scroll') }}</span></span>
        <span class="con-sheet__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Generic console bottom sheet (CONSOLE_MODE_CONCEPT.md §9) — big TV rows
 * for the bounded lists (standard projects / milestones / awards). Rows are
 * DATA; the shell supplies them + executes A on the selected available row.
 * The selected row carries the inline Ⓐ glyph.
 *
 * P22: milestone/award rows carry the `ma` payload and render RICH — the
 * ART tile (the same assets/ma/*.png the desktop overlays bind, so
 * recognition is 1:1), the name, the rule text, MY progress
 * vs the per-game threshold (green = claimable / red = not yet — the
 * server's `claimable` flag, never a client re-derivation), the rivals'
 * player-coloured score badges (awards highlight the current leader), the
 * cost chip and the taken/available state. The list is the RS scroll
 * target (`con-info__scroll`) and d-pad navigation auto-scrolls the
 * selected row into view.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {Color} from '@/common/Color';

export type ConsoleSheetMaScore = {color: Color, score: number, claimable?: boolean};

export type ConsoleSheetMa = {
  kind: 'milestone' | 'award',
  /** Drives the art asset lookup (assets/ma/<slug>.png). */
  name: string,
  scores: ReadonlyArray<ConsoleSheetMaScore>,
  /** The per-game milestone threshold (server-populated; awards have none). */
  threshold?: number,
  myColor: Color,
};

export type ConsoleSheetRow = {
  key: string,
  /** 'header' = a non-selectable group caption (nav skips it). */
  kind?: 'header',
  /** Icon CSS class (e.g. a std-icon pictogram) — premium rows are never bare text. */
  icon?: string,
  /** English i18n key (or literal already-translated text). */
  title: string,
  /** Rule / effect description (translated via v-i18n). */
  sub?: string,
  /** Cost / progress annotation (already formatted). */
  meta?: string,
  available: boolean,
  /** English i18n key ('' → no line). */
  reason?: string,
  takenBy?: {color: Color, name: string},
  /** P22: present ⇔ the row renders the rich milestone/award composition. */
  ma?: ConsoleSheetMa,
};

export default defineComponent({
  name: 'ConsoleSheet',
  components: {GamepadGlyph},
  props: {
    title: {type: String, required: true},
    /** P22: a compact summary line (claimed/funded count + price). */
    subtitle: {type: String, default: ''},
    /** P22: the near-fullscreen composition (milestones / awards). */
    wide: {type: Boolean, default: false},
    rows: {type: Array as PropType<ReadonlyArray<ConsoleSheetRow>>, required: true},
    index: {type: Number, required: true},
  },
  watch: {
    /** D-pad navigation keeps the selected row visible (auto-scroll). */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.selectedRow as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        el?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      });
    },
    /** A tab/sheet switch resets the list to the top. */
    title() {
      (this.$refs.rows as HTMLElement | undefined)?.scrollTo?.({top: 0});
    },
  },
  methods: {
    /** The SAME 140×83 art assets the desktop overlays use (assets/ma/). */
    maAsset(row: ConsoleSheetRow): string {
      return (row.ma?.name ?? '').toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    myScore(row: ConsoleSheetRow): number {
      const ma = row.ma;
      if (ma === undefined) {
        return 0;
      }
      return ma.scores.find((s) => s.color === ma.myColor)?.score ?? 0;
    },
    /** Green = claimable NOW (the server flag / the live option); red = not yet. */
    myChipClass(row: ConsoleSheetRow): string {
      const ma = row.ma;
      if (ma === undefined) {
        return '';
      }
      if (ma.kind === 'award') {
        const mine = this.myScore(row);
        return mine >= this.leaderScore(row) && mine > 0 ? 'con-sheet__ma-my--lead' : '';
      }
      const mine = ma.scores.find((s) => s.color === ma.myColor);
      const eligible = mine?.claimable === true || row.available;
      return eligible ? 'con-sheet__ma-my--ok' : 'con-sheet__ma-my--short';
    },
    rivalScores(row: ConsoleSheetRow): ReadonlyArray<ConsoleSheetMaScore> {
      const ma = row.ma;
      if (ma === undefined) {
        return [];
      }
      return ma.scores.filter((s) => s.color !== ma.myColor);
    },
    leaderScore(row: ConsoleSheetRow): number {
      const ma = row.ma;
      if (ma === undefined) {
        return 0;
      }
      return ma.scores.reduce((max, s) => Math.max(max, s.score), 0);
    },
  },
});
</script>
