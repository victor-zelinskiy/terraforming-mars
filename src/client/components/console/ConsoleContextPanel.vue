<template>
  <aside class="con-inspector con-context con-info__scroll" ref="root" :aria-label="$t('Cell details')">
    <!-- ── TASK MODE: active placement ─────────────────────────────── -->
    <template v-if="mode === 'placement'">
      <div class="con-context__task-kicker">{{ $t('Tile placement') }}</div>
      <div class="con-context__task-title">{{ placementTitle }}</div>
      <!-- P20: the inspect-all toggle announces itself as a distinct mode. -->
      <div v-if="inspectAll" class="con-context__mode-chip">{{ $t('Inspecting all cells') }}</div>

      <div v-if="selectedLegal" class="con-inspector__placement con-inspector__placement--legal">
        <GamepadGlyph control="confirm" />
        <span>{{ $t('Place here') }}</span>
      </div>
      <template v-else>
        <div class="con-inspector__placement con-inspector__placement--illegal">
          <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
          <span>{{ $t('Cannot place here') }}</span>
        </div>
        <div v-if="illegalReason !== ''" class="con-context__reason">{{ illegalReason }}</div>
      </template>

      <div class="con-context__cell-brief" v-if="cellHeader !== ''">
        <span class="con-context__cell-brief-label">{{ $t('Board cell') }}:</span> {{ cellHeader }}
        <span v-if="!selectedLegal" class="con-context__cell-brief-note">— {{ $t('this tile cannot go here') }}</span>
      </div>
      <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>

      <!-- P21: the panel commands stay MINIMAL (A + a real cancel only) —
           the footer owns the shortcut map, the legend owns the globals. -->
      <div class="con-context__commands">
        <div class="con-context__cmd" :class="{'con-context__cmd--off': !selectedLegal}">
          <GamepadGlyph control="confirm" /><span>{{ $t('Place here') }}</span>
        </div>
        <div v-if="cancellable" class="con-context__cmd">
          <GamepadGlyph control="back" /><span>{{ $t('Cancel placement') }}</span>
        </div>
      </div>
      <!-- P20: the mandatory/cancel state is explained, not implied. -->
      <div v-if="!cancellable" class="con-context__mandatory-note">{{ $t('This action requires picking a cell. Cancelling is not available.') }}</div>
    </template>

    <!-- ── TRACK MODE (P27b): a focused global-parameter track bonus ── -->
    <template v-else-if="mode === 'track'">
      <div class="con-context__task-kicker">{{ $t('Track bonus') }}</div>
      <template v-if="trackInfo !== null">
        <div class="con-inspector__name">{{ trackInfo.kicker }}</div>
        <div class="con-context__track-rows">
          <div v-for="(row, i) in trackInfo.rows" :key="i"
               class="con-context__track-row"
               :class="'con-context__track-row--' + row.tone">
            <span v-if="row.dot !== undefined" class="con-status__dot" :style="{background: row.dot}"></span>
            <span>{{ row.text }}</span>
          </div>
        </div>
      </template>
      <div v-else class="con-inspector__loading">{{ $t('Loading') }}…</div>
      <!-- P27c: the owning SCALE's own hover-overview (name + current
           value + description) — the mouse would show it on the band. -->
      <div v-if="trackScale !== null" class="con-context__scale">
        <div class="con-context__scale-title">{{ $t(trackScale.titleKey) }}</div>
        <div class="con-context__track-row con-context__track-row--value">
          <span>{{ $t(trackScale.nounKey) }}: {{ trackScale.valueText }}</span>
        </div>
        <div class="con-context__track-row con-context__track-row--desc">
          <span>{{ $t(trackScale.descriptionKey) }}</span>
        </div>
      </div>
      <div class="con-context__note">{{ $t('Scale bonuses are granted when the parameter passes this step') }}</div>
    </template>

    <!-- ── CELL MODE: inspection — a selected cell, no task ─────────── -->
    <template v-else-if="mode === 'cell'">
      <div class="con-inspector__kicker">{{ cellHeader !== '' ? cellHeader : $t('Board cell') }}</div>
      <div v-if="tileLabel !== ''" class="con-inspector__name">{{ tileLabel }}</div>
      <div v-if="ownerName !== ''" class="con-context__owner">
        <span :class="'con-status__dot player_bg_color_' + ownerColor"></span>
        <span>{{ ownerName }}</span>
      </div>
      <div v-if="cellDescription !== ''" class="con-inspector__desc">{{ cellDescription }}</div>
      <!-- P27b: the curated special-cell LORE (Ganymede, volcanoes…) —
           inspection is the right home for it (placement stays lean). -->
      <div v-if="lore !== undefined" class="con-context__lore">
        <div v-if="loreTitle !== ''" class="con-context__lore-title">{{ $t(lore.title) }}</div>
        <div class="con-context__lore-text">{{ $t(lore.description) }}</div>
      </div>
      <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>
      <div v-else-if="loading" class="con-inspector__loading">{{ $t('Loading') }}…</div>
    </template>

    <!-- ── IDLE MODE (P27): the console home — the strategic summary.
         P27b: no «Ваш ход» kicker — the top player chips own that read.
         P28: the premium readability pass — hero numbers, status dots,
         mini-card MA rows with progress rails / leader chips, slot
         footers; the LB/RB keys live ON the blocks they open. ── -->
    <template v-else>

      <!-- Cards: how many can be PLAYED now / total in hand. -->
      <section class="con-home__block" :class="{'con-home__block--hot': cardsPlayable > 0}">
        <header class="con-home__head">
          <BarButtonIcon name="cards" />
          <span class="con-home__title">{{ $t('Cards') }}</span>
          <span class="con-home__value"><b>{{ cardsPlayable }}</b><i>/{{ cardsTotal }}</i></span>
        </header>
        <div class="con-home__state" :class="cardsPlayable > 0 ? 'con-home__state--go' : 'con-home__state--mute'">
          <span class="con-home__state-dot" aria-hidden="true"></span>
          <span>{{ $t(cardsPlayable > 0 ? 'Playable now' : 'No playable cards') }}</span>
        </div>
      </section>

      <!-- Card actions: available blue-card/corp activations. -->
      <section class="con-home__block" :class="{'con-home__block--hot': actionsAvailable > 0}">
        <header class="con-home__head">
          <BarButtonIcon name="actions" />
          <span class="con-home__title">{{ $t('Card actions') }}</span>
          <span class="con-home__value"><b>{{ actionsAvailable }}</b><i>/{{ actionsTotal }}</i></span>
        </header>
        <div class="con-home__state" :class="actionsAvailable > 0 ? 'con-home__state--go' : 'con-home__state--mute'">
          <span class="con-home__state-dot" aria-hidden="true"></span>
          <span>{{ $t(actionsAvailable > 0 ? 'Available now' : 'No actions available') }}</span>
        </div>
      </section>

      <!-- Milestones: who claimed what, my progress, slots left. -->
      <section class="con-home__block con-home__block--ma" :class="{'con-home__block--hot': milestoneSummary.actionable > 0}">
        <header class="con-home__head">
          <BarButtonIcon name="milestones" />
          <span class="con-home__title">{{ $t('Milestones') }}</span>
          <span v-if="milestoneSummary.actionable > 0" class="con-home__badge">{{ milestoneSummary.actionable }}</span>
          <span class="con-home__hint"><GamepadGlyph control="bumperL" /></span>
        </header>
        <div v-for="row in milestoneSummary.rows" :key="row.name"
             class="con-home__ma"
             :class="{'con-home__ma--taken': row.takenBy !== undefined, 'con-home__ma--now': row.availableNow}">
          <span class="con-home__ma-name" v-i18n>{{ shortName(row.name) }}</span>
          <span v-if="row.takenBy !== undefined" class="con-home__ma-owner">
            <span class="con-home__ma-check" aria-hidden="true">✓</span>
            <span :class="'con-status__dot player_bg_color_' + row.takenBy.color"></span>
            <span class="con-home__ma-owner-name">{{ row.takenBy.name }}</span>
          </span>
          <template v-else-if="row.my !== undefined">
            <span v-if="row.my.threshold !== undefined" class="con-home__ma-bar" aria-hidden="true">
              <span class="con-home__ma-bar-fill"
                    :class="{'con-home__ma-bar-fill--ready': row.my.ready}"
                    :style="{width: progressPct(row.my.score, row.my.threshold) + '%'}"></span>
            </span>
            <span class="con-home__ma-progress" :class="{'con-home__ma-progress--ready': row.my.ready}">
              {{ row.my.score }}<i v-if="row.my.threshold !== undefined">/{{ row.my.threshold }}</i>
            </span>
          </template>
        </div>
        <div class="con-home__foot">
          <span v-if="milestoneSummary.slotsLeft === 0" class="con-home__foot-done">✓ {{ $t('All claimed') }}</span>
          <span v-else class="con-home__foot-slots">{{ $t('Slots left') }}: <b>{{ milestoneSummary.slotsLeft }}</b></span>
        </div>
      </section>

      <!-- Awards: who funded what + the live race leaders. P29: funding
           availability is an ECONOMY action, not a met condition — no hot
           block / no mint row rails (that language is milestone-only);
           a quiet count chip communicates "can sponsor" instead. -->
      <section class="con-home__block con-home__block--ma con-home__block--awards">
        <header class="con-home__head">
          <BarButtonIcon name="awards" />
          <span class="con-home__title">{{ $t('Awards') }}</span>
          <span v-if="awardSummary.actionable > 0" class="con-home__badge con-home__badge--quiet">{{ awardSummary.actionable }}</span>
          <span class="con-home__hint"><GamepadGlyph control="bumperR" /></span>
        </header>
        <!-- Legend = a helper row on the SAME grid: empty title cell, then a
             quiet glyph+word hint above the sponsor and leader columns, so it
             lines up with every award row below. -->
        <div class="con-award-row con-award-row--legend" aria-hidden="true">
          <span class="con-award__name"></span>
          <span class="con-award__sponsor con-award__legend-cell">
            <svg class="con-award__flag con-award__legend-glyph" viewBox="0 0 16 16">
              <path d="M4 1.6v12.8" />
              <path d="M4 2.4h8.4l-2.1 2.8 2.1 2.8H4z" class="con-award__flag-fill" />
            </svg>
            <span class="con-award__legend-word" v-i18n>Sponsor</span>
          </span>
          <span class="con-award__leader con-award__legend-cell">
            <svg class="con-award__crown con-award__legend-glyph" viewBox="0 0 20 16">
              <path d="M2 12.4h16l1.1-8-4.4 3.1L10 3.2 5.3 7.5.9 4.4z" />
              <rect x="2" y="13.2" width="16" height="1.8" rx="0.9" />
            </svg>
            <span class="con-award__legend-word" v-i18n>Leader</span>
          </span>
        </div>
        <div v-for="row in awardSummary.rows" :key="row.name"
             class="con-award-row"
             :class="{'con-award-row--taken': row.takenBy !== undefined}">
          <span class="con-award__name" v-i18n>{{ shortName(row.name) }}</span>
          <!-- SPONSOR zone: flag + funder cube, or flag + «—» when unsponsored. -->
          <span class="con-award__sponsor">
            <svg class="con-award__flag" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 1.6v12.8" />
              <path d="M4 2.4h8.4l-2.1 2.8 2.1 2.8H4z" class="con-award__flag-fill" />
            </svg>
            <span v-if="row.takenBy !== undefined"
                  class="con-status__dot con-award__cube"
                  :class="['player_bg_color_' + row.takenBy.color, {'con-award__cube--me': row.takenBy.color === viewerColor}]"></span>
            <span v-else class="con-award__none">—</span>
          </span>
          <!-- LEADER zone: crown + (cube value) per co-leader, or a bare «—». -->
          <span class="con-award__leader">
            <template v-if="hasLeaders(row)">
              <svg class="con-award__crown" viewBox="0 0 20 16" aria-hidden="true">
                <path d="M2 12.4h16l1.1-8-4.4 3.1L10 3.2 5.3 7.5.9 4.4z" />
                <rect x="2" y="13.2" width="16" height="1.8" rx="0.9" />
              </svg>
              <span v-for="l in displayLeaders(row)" :key="l.color" class="con-award__leader-unit">
                <span class="con-status__dot con-award__cube"
                      :class="['player_bg_color_' + l.color, {'con-award__cube--me': l.color === viewerColor}]"></span>
                <span class="con-award__leader-val">{{ l.score }}</span>
              </span>
              <span v-if="extraLeaders(row) > 0" class="con-award__leader-more">+{{ extraLeaders(row) }}</span>
            </template>
            <span v-else class="con-award__none">—</span>
          </span>
        </div>
        <div class="con-home__foot">
          <span v-if="awardSummary.slotsLeft === 0" class="con-home__foot-done">✓ {{ $t('All funded') }}</span>
          <span v-else class="con-home__foot-slots">{{ $t('Slots left') }}: <b>{{ awardSummary.slotsLeft }}</b></span>
        </div>
      </section>
    </template>
  </aside>
</template>

<script lang="ts">
/**
 * The right CONTEXT + INFO panel (feedback iteration 2; P27 rework) — the
 * console home's explaining surface. Four modes:
 *  - placement: the TASK state (legal/illegal + the SERVER's illegal
 *    reason + cell facts + the minimal command set incl. honest B);
 *  - track (P27): a focused global-parameter TRACK bonus — the SAME
 *    already-translated rows the premium ScaleTooltip shows;
 *  - cell: inspection identity (header/name/owner) + facts from the
 *    shared BoardInformation pipeline;
 *  - idle (P27): the STRATEGIC turn summary — playable cards / available
 *    card actions (moved here from the top HUD) + the Milestones/Awards
 *    race (who claimed/funded what, live award leaders, slots left).
 * Deliberately NOT a duplicate of the bottom command bar — only the two
 * single-button panels (LB/RB) carry a mini glyph for direct clarity.
 * Pure presentation: every value is a prop computed in ConsoleShell from
 * the same sources the desktop buttons use.
 */
import {defineComponent, PropType} from 'vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo} from '@/common/boards/BoardInformationFacts';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
import {HomeMaSummary, HomeMaRow} from '@/client/console/consoleQuickModel';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

const EMPTY_SUMMARY: HomeMaSummary = {rows: [], takenCount: 0, maxSlots: 3, actionable: 0, slotsLeft: 3};

// How many co-leaders show a cube+score before the rest collapse to «+N»
// (keeps the leader column a stable width — priority 4 in the spec).
const MAX_LEADER_CUBES = 2;

export default defineComponent({
  name: 'ConsoleContextPanel',
  components: {BoardFactGroups, BarButtonIcon, GamepadGlyph},
  watch: {
    /** P21: a new inspected cell resets the panel scroll — the placement
     *  STATUS is always the first thing visible. */
    cellHeader() {
      (this.$refs.root as HTMLElement | undefined)?.scrollTo?.({top: 0});
    },
    selectedLegal() {
      (this.$refs.root as HTMLElement | undefined)?.scrollTo?.({top: 0});
    },
  },
  props: {
    mode: {type: String as PropType<'placement' | 'cell' | 'track' | 'idle'>, required: true},
    info: {type: Object as PropType<BoardCellInfo | undefined>, default: undefined},
    loading: {type: Boolean, default: false},
    viewerColor: {type: String as PropType<Color>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    // placement mode
    placementTitle: {type: String, default: ''},
    selectedLegal: {type: Boolean, default: false},
    illegalReason: {type: String, default: ''},
    cancellable: {type: Boolean, default: false},
    /** P20: the R3 inspect-all toggle is on (labels + the mode chip). */
    inspectAll: {type: Boolean, default: false},
    // track mode (P27)
    trackInfo: {type: Object as PropType<ScaleTooltipContent | null>, default: null},
    /** P27c: the owning scale's overview (name / current value / description). */
    trackScale: {type: Object as PropType<{titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null>, default: null},
    // cell mode (P27b): curated special-cell lore
    lore: {type: Object as PropType<{title: string, description: string} | undefined>, default: undefined},
    // idle mode
    myTurn: {type: Boolean, default: false},
    cardsPlayable: {type: Number, default: 0},
    cardsTotal: {type: Number, default: 0},
    actionsAvailable: {type: Number, default: 0},
    actionsTotal: {type: Number, default: 0},
    milestoneSummary: {type: Object as PropType<HomeMaSummary>, default: () => EMPTY_SUMMARY},
    awardSummary: {type: Object as PropType<HomeMaSummary>, default: () => EMPTY_SUMMARY},
  },
  computed: {
    cellHeader(): string {
      return textOf(this.info?.status.header);
    },
    tileLabel(): string {
      return textOf(this.info?.status.tileLabel);
    },
    cellDescription(): string {
      return textOf(this.info?.description);
    },
    ownerColor(): Color | undefined {
      return this.info?.status.ownerColor;
    },
    ownerName(): string {
      const color = this.ownerColor;
      if (color === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === color)?.name ?? '';
    },
    /** P27b: hide the lore title when the cell header already names it. */
    loreTitle(): string {
      const t = this.lore?.title ?? '';
      if (t === '') {
        return '';
      }
      const translated = translateText(t);
      return translated === this.cellHeader || translated === this.tileLabel ? '' : t;
    },
  },
  methods: {
    /** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
    shortName(name: string): string {
      return name.replace(/[0-9]+$/, '');
    },
    /** Awards only: the row has a live race leader (someone with a non-zero top score). */
    hasLeaders(row: HomeMaRow): boolean {
      return row.leaders !== undefined && row.leaders.length > 0;
    },
    // Keep the fixed leader column a stable width: a 2-way tie shows BOTH
    // cubes+scores; a 3+-way tie collapses to the first cube+score + «+N» (all
    // co-leaders share the same score, so one value still reads correctly).
    displayLeaders(row: HomeMaRow): ReadonlyArray<{color: Color, score: number}> {
      const l = row.leaders ?? [];
      return l.length <= MAX_LEADER_CUBES ? l : l.slice(0, 1);
    },
    extraLeaders(row: HomeMaRow): number {
      const n = row.leaders?.length ?? 0;
      return n <= MAX_LEADER_CUBES ? 0 : n - 1;
    },
    /** Milestone progress → the mini rail width (bounded 0..100). */
    progressPct(score: number, threshold: number): number {
      if (threshold <= 0) {
        return 0;
      }
      return Math.min(100, Math.round((score / threshold) * 100));
    },
  },
});
</script>
