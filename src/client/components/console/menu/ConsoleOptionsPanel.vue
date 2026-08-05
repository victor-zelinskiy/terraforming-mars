<template>
  <div class="con-sys con-sys--settings" role="dialog" :aria-label="$t('Settings')">
    <div class="con-sys__backdrop" aria-hidden="true"></div>

    <div class="con-sys__card">
      <!-- Stable context BEFORE the mutable stage: «НАСТРОЙКИ › УПРАВЛЕНИЕ».
           Root and emblem never move; only the tail crossfades. -->
      <div class="con-sys__head">
        <span class="con-sys__emblem" aria-hidden="true">⚙</span>
        <span class="con-sys__crumb">
          <span class="con-sys__crumb-root">{{ $t('Settings') }}</span>
          <span class="con-sys__crumb-slot">
            <transition name="con-sys-stage">
              <span :key="current.id" class="con-sys__crumb-tail">
                <span class="con-sys__crumb-sep" aria-hidden="true">›</span>
                <span class="con-sys__crumb-stage">{{ $t(current.label) }}</span>
              </span>
            </transition>
          </span>
        </span>
      </div>

      <div class="con-sys__body">
        <div class="con-set">
          <!-- Category rail. The technical pair sits small and dim under the
               «ДОПОЛНИТЕЛЬНО» hairline — present, never competing. -->
          <nav class="con-set__rail" :aria-label="$t('Category')">
            <template v-for="(cat, i) in categories" :key="cat.id">
              <div v-if="cat.minor && !categories[i - 1]?.minor" class="con-set__rail-sep">{{ $t('Advanced') }}</div>
              <button
                type="button"
                class="con-set__cat"
                :class="{'con-set__cat--current': i === categoryIndex, 'con-set__cat--minor': cat.minor}"
                @click="selectCategory(i)"
              >
                <span class="con-set__cat-glyph" aria-hidden="true">{{ cat.glyph }}</span>
                <span class="con-set__cat-name">{{ $t(cat.label) }}</span>
              </button>
            </template>
          </nav>

          <div class="con-set__pane">
            <ConsoleScrollArea ref="scroll" class="con-set__scroll" contentClass="con-set__rows">
              <!-- Dialable rows: one line each, value on a fixed-width stepper. -->
              <div
                v-for="(row, i) in current.rows"
                :key="row.id"
                class="con-set__row"
                :class="{'con-set__row--cursor': i === cursor}"
                role="button"
                :aria-label="$t(row.label)"
                @click="step(1)"
                @mousemove="cursor = i"
              >
                <span class="con-set__row-label">{{ $t(row.label) }}</span>
                <span v-if="row.note !== '' && row.noteTone === 'pending'" class="con-set__row-pending" aria-hidden="true"></span>
                <span class="con-set__stepper">
                  <span class="con-set__arrow" aria-hidden="true" @click.stop="stepAt(i, -1)">‹</span>
                  <span class="con-set__value">{{ row.value }}</span>
                  <span class="con-set__arrow" aria-hidden="true" @click.stop="stepAt(i, 1)">›</span>
                  <span class="con-set__pips" aria-hidden="true">
                    <span
                      v-for="n in row.count"
                      :key="n"
                      class="con-set__pip"
                      :class="{'con-set__pip--on': n - 1 === row.index}"
                    ></span>
                  </span>
                </span>
              </div>

              <!-- Read-only readout (the diagnostics category) — the groups sit
                   SIDE BY SIDE so the whole readout lands inside the constant
                   body height instead of scrolling half of itself away. -->
              <div v-if="current.readout.length > 0" class="con-set__readout">
                <div v-for="group in current.readout" :key="group.label" class="con-set__rogroup">
                  <div class="con-set__group">{{ $t(group.label) }}</div>
                  <div v-for="ro in group.rows" :key="ro.label" class="con-set__ro">
                    <span class="con-set__ro-key">{{ ro.raw ? ro.label : $t(ro.label) }}</span>
                    <span class="con-set__ro-val" :class="'con-set__ro-val--' + ro.tone">{{ ro.value }}</span>
                  </div>
                  <div v-if="group.note !== ''" class="con-set__ro-note" :class="{'con-set__ro-note--bad': group.noteBad}">{{ group.note }}</div>
                </div>
              </div>
            </ConsoleScrollArea>

            <!-- The detail strip: what the cursored row does, in full. Always
                 the same height (both text lines reserved) — the reason the
                 rows above could shed their subtitles and fit the screen. -->
            <div class="con-set__detail" aria-live="polite">
              <div class="con-set__detail-head">
                <span class="con-set__detail-title">{{ detail.title }}</span>
                <span class="con-set__detail-value">{{ detail.value }}</span>
              </div>
              <div class="con-set__detail-desc">{{ detail.desc }}</div>
              <div class="con-set__detail-note" :class="{'con-set__detail-note--pending': detail.notePending}">{{ detail.note }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="con-sys__foot">
        <span v-if="categories.length > 1" class="con-sys__hint">
          <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />{{ $t('Category') }}
        </span>
        <!-- A read-only category has no row to walk, so the SAME control means
             «scroll the readout» there. Naming it honestly beats dimming a
             verb that in fact still does something. -->
        <span class="con-sys__hint">
          <GamepadGlyph control="dpad" />{{ $t(current.rows.length === 0 ? 'Scroll' : 'Navigate') }}
        </span>
        <span v-if="current.rows.length > 0" class="con-sys__hint">
          <GamepadGlyph control="confirm" />{{ $t('Change') }}
        </span>
        <span class="con-sys__hint"><GamepadGlyph control="back" />{{ $t('Done') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE CONSOLE SETTINGS CONSOLE — the home of every PERSISTENT console
 * preference (CLAUDE.md: settings live here, NOT in the fixed-shape in-game
 * System menu). Two hosts, ONE surface: the main menu's «Настройки» item and,
 * in-game, the System overlay's «Настройки» plate (GamepadLayer mounts it with
 * `context="game"`).
 *
 * ITERATION 2 — CATEGORIES. The flat list had grown to eleven rows with
 * two-line subtitles and no longer fit a TV screen; the player scrolled a
 * settings menu, which is the definition of a surface that stopped being
 * designed. Three changes fixed it, and they belong together:
 *
 *  1. A CATEGORY RAIL (`consoleSettingsModel.ts` owns the grouping) — LB/RB
 *     switch categories, so no category ever needs to scroll. The technical
 *     pair (СЕТЬ, ДИАГНОСТИКА — `minor: true`) renders small and dim under a
 *     «ДОПОЛНИТЕЛЬНО» hairline: reachable, never competing with the four a
 *     player actually tunes.
 *  2. ONE-LINE ROWS + a fixed DETAIL STRIP. The description moved off the row
 *     into a big always-mounted strip under the list, which reads better at
 *     2 m AND halves the row height. The strip reserves both its text lines,
 *     so cursoring never re-lays the card out — the same layout-shift contract
 *     that keeps settings out of the System menu.
 *  3. A STEPPER, not a cycler. Every setting is a RING in the model, so ‹ / ›
 *     (d-pad left/right, A = forward) step in both directions and the pips
 *     show the position. A five-option row (Display) is no longer a
 *     press-A-four-times affair.
 *
 * The IN-GAME context (`context === 'game'`) drops the shell switch (the
 * desktop UI is frozen and swapping shells mid-game is jarring) and the
 * network category (launch-time properties), and gains ЭТА ПАРТИЯ with the
 * per-game private-score mask. That whole decision lives in the model.
 *
 * Both hosts route pad intents through `handleIntent`. `revision` is what
 * makes a stepped value re-render: the motion prefs are module-CACHED, not
 * reactive, so the rebuild has to be forced rather than tracked.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import {
  type ConsoleSettingsCategory,
  type ConsoleSettingsCategoryId,
  type ConsoleSettingsContext,
  buildConsoleSettings,
} from '@/client/console/settings/consoleSettingsModel';
import {desktopBridge, DesktopAppModeInfo, DesktopLanState} from '@/client/components/desktop/desktopUpdateState';
import {translateText} from '@/client/directives/i18n';

/** An empty category can never be selected, but the template must be total. */
const EMPTY_CATEGORY: ConsoleSettingsCategory = {
  id: 'interface', label: 'Settings', glyph: '⚙', minor: false, rows: [], readout: [],
};

export default defineComponent({
  name: 'ConsoleOptionsPanel',
  components: {GamepadGlyph, ConsoleScrollArea},
  props: {
    /**
     * Where the panel is hosted. 'game' (the in-game system menu) hides the
     * shell switch + the launch-time network rows and adds ЭТА ПАРТИЯ.
     */
    context: {type: String as () => ConsoleSettingsContext, default: 'menu'},
    /**
     * Open straight onto a category — the System menu's «Диагностика» plate
     * rides this, so the readout has exactly ONE home (it used to be a second
     * hand-built panel inside the system menu).
     */
    initialCategory: {type: String as () => ConsoleSettingsCategoryId | undefined, default: undefined},
  },
  emits: ['close'],
  data() {
    return {
      categoryIndex: 0,
      cursor: 0,
      /**
       * Bumped after every applied step. The settings live in module state,
       * and the motion prefs are module-CACHED rather than reactive — so the
       * rebuild is forced, not tracked. (Reactive states the model touches
       * re-render on their own; this covers the rest.)
       */
      revision: 0,
      // Host-as-server (desktop shell only; undefined on the web hides the
      // whole network category). Loaded async on mount.
      serverInfo: undefined as DesktopAppModeInfo | undefined,
      lanInfo: undefined as DesktopLanState | undefined,
      /** Baked Electron app version for the diagnostics readout. */
      desktopVersion: '',
    };
  },
  computed: {
    categories(): ReadonlyArray<ConsoleSettingsCategory> {
      // `revision` is read for its dependency, not its value.
      void this.revision;
      return buildConsoleSettings({
        context: this.context,
        server: this.serverInfo,
        lan: this.lanInfo,
        desktopVersion: this.desktopVersion,
      });
    },
    current(): ConsoleSettingsCategory {
      return this.categories[this.categoryIndex] ?? this.categories[0] ?? EMPTY_CATEGORY;
    },
    /**
     * The detail strip's content. A read-only category has no cursored row, so
     * it describes the CATEGORY instead — the strip is never empty and never
     * changes height.
     */
    detail(): {title: string, value: string, desc: string, note: string, notePending: boolean} {
      const row = this.current.rows[this.cursor];
      if (row === undefined) {
        return {
          title: translateText(this.current.label),
          value: '',
          desc: translateText('Read-only status of this device and its connection'),
          note: '',
          notePending: false,
        };
      }
      return {
        title: translateText(row.label),
        value: row.value,
        desc: translateText(row.desc),
        note: row.note,
        notePending: row.noteTone === 'pending',
      };
    },
  },
  mounted() {
    // Open on the requested category when it exists in this context.
    if (this.initialCategory !== undefined) {
      const at = this.categories.findIndex((c) => c.id === this.initialCategory);
      if (at >= 0) {
        this.categoryIndex = at;
      }
    }
    // The network category + the diagnostics client version come from the
    // desktop bridge; an absent bridge (web build / older shell) simply
    // leaves the category out and falls back to settings.json for the version.
    const bridge = desktopBridge();
    if (bridge === undefined) {
      return;
    }
    void bridge.getVersion().then((v) => {
      this.desktopVersion = typeof v === 'string' ? v : '';
    }).catch(() => {});
    if (this.context !== 'game' && bridge.getAppMode !== undefined) {
      void bridge.getAppMode().then((info) => {
        if (info !== undefined) {
          this.serverInfo = info;
        }
      }).catch(() => {});
      void bridge.getLanState?.().then((lan) => {
        if (lan !== undefined) {
          this.lanInfo = lan;
        }
      }).catch(() => {});
    }
  },
  methods: {
    /** Host-routed pad intents. Returns true when consumed (always). */
    handleIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.moveCursor(intent.dir === 'down' ? 1 : -1);
        } else if (intent.dir === 'left') {
          this.step(-1);
        } else if (intent.dir === 'right') {
          this.step(1);
        }
        return true;
      }
      // LB/RB — the category ladder (the established «section ring» control).
      // It CLAMPS at the ends like every other console list (stepIndex); only
      // a VALUE wraps, which is what makes the ‹ arrow useful.
      if (action === 'prevSection' || action === 'nextSection') {
        this.stepCategory(action === 'nextSection' ? 1 : -1);
        return true;
      }
      if (action === 'primary') {
        this.step(1);
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      return true;
    },
    /**
     * Up/down. A read-only category has no rows to walk — the same press
     * scrolls the readout instead, so the stick/d-pad is never dead.
     */
    moveCursor(delta: 1 | -1): void {
      const rows = this.current.rows.length;
      if (rows === 0) {
        (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(delta * 60);
        return;
      }
      this.cursor = stepIndex(this.cursor, delta, rows);
      this.keepCursorVisible();
    },
    stepCategory(delta: 1 | -1): void {
      if (this.categories.length === 0) {
        return;
      }
      this.categoryIndex = stepIndex(this.categoryIndex, delta, this.categories.length);
      this.cursor = 0;
    },
    selectCategory(i: number): void {
      this.categoryIndex = i;
      this.cursor = 0;
    },
    /** Apply the option `dir` steps away from the cursored row's current one. */
    step(dir: 1 | -1): void {
      this.stepAt(this.cursor, dir);
    },
    stepAt(i: number, dir: 1 | -1): void {
      this.cursor = i;
      const row = this.current.rows[i];
      if (row === undefined) {
        return;
      }
      row.step(dir);
      // Force the rebuild — see `revision`.
      this.revision++;
    },
    /** Keep the cursored row inside the ConsoleScrollArea viewport. */
    keepCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.scroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.con-set__row--cursor'));
      });
    },
  },
});
</script>
