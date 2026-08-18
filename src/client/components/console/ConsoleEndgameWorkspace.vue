<template>
  <!--
    CONSOLE FINAL SCORING — the post-game workspace (`?console=1`).

    THE ceremony: every player permanently on screen as one comparable row
    (place · identity · one shared-scale bar · exact per-category values ·
    a large running total), categories revealed in sequence for the whole
    table at once, TR and Cards opening as quick two-level micro-reveals,
    ranking settled by ONE FLIP only after the last number lands, then the
    tie-break (when the totals demand one) and the winner beat. The MarsBot
    is an ordinary row — its legacy scoring category is dissolved into the
    card families by the VM (consoleEndgameModel).

    A full-bleed scene (start-scene family): it covers the frame while the
    command bar below stays live — skip during the count, the post-game
    action list after it. «Обзор партии» opens the existing desktop results
    overlay OVER this workspace (shell hides us via v-show for that round
    trip; minimize returns here with every value settled).
  -->
  <div class="con-endgame" role="region" :aria-label="$t('Final scoring')"
       :class="{'con-endgame--noanim': noanim, ['con-endgame--' + ui.phase]: true}">
    <div class="con-eg">
      <header class="con-eg__head">
        <div class="con-eg__kicker">
          <span class="con-eg__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Final scoring') }}</span>
        </div>
        <div class="con-eg__meta">{{ $t('Generation') }} {{ vm.generation }}</div>
      </header>

      <!-- THE LEGEND — one stable strip, the active category brightens.
           Category identity = colour + position + name (never colour alone). -->
      <div class="con-eg__legend">
        <div v-for="(cat, i) in vm.categories" :key="cat.key"
             class="con-eg__lchip" :class="lchipClass(cat, i)">
          <span class="con-eg__ldot" aria-hidden="true"></span>
          <span class="con-eg__lname">{{ $t(cat.legend) }}</span>
        </div>
      </div>

      <!-- STAGE CAPTION — what is being counted right now (micro-reveal voice). -->
      <div class="con-eg__caption" aria-live="polite">
        <transition name="con-eg-cap" mode="out-in">
          <span :key="captionKey" class="con-eg__caption-text" :class="captionAccent">{{ captionText }}</span>
        </transition>
      </div>

      <!-- THE ROWS — all players, one comparable composition. -->
      <div ref="rowsEl" class="con-eg__rows" :class="'con-eg__rows--n' + vm.rows.length">
        <div v-for="(color, i) in rowOrder" :key="color"
             class="con-eg__row" :class="rowClass(color)"
             :data-eg-row="color" :style="{'--eg-i': i}">
          <div class="con-eg__place" aria-hidden="true">
            <span v-if="ui.placesShown" class="con-eg__place-num">{{ rowBy(color).place }}</span>
            <span v-else class="con-eg__place-dot"></span>
          </div>
          <div class="con-eg__ident">
            <span class="con-eg__swatch" :class="'player_bg_color_' + color" aria-hidden="true"></span>
            <div class="con-eg__who">
              <span class="con-eg__name">{{ rowBy(color).name }}</span>
              <span v-if="rowBy(color).corporation !== ''" class="con-eg__corp">{{ $t(rowBy(color).corporation) }}</span>
            </div>
          </div>
          <div class="con-eg__track">
            <div class="con-eg__bar">
              <div v-for="seg in rowSegments(color)" :key="seg.key"
                   class="con-eg__seg" :class="segClass(seg)"
                   :style="{left: seg.leftPct + '%', width: seg.widthPct + '%'}">
                <div v-for="sub in seg.subs" :key="sub.key"
                     class="con-eg__subseg" :class="subClass(sub)"
                     :style="{left: sub.leftPct + '%', width: sub.widthPct + '%'}"></div>
              </div>
            </div>
            <!-- The «+N» chip lives OUTSIDE the bar (its clip would eat it),
                 riding the same growth edge over the track. -->
            <transition name="con-eg-chip">
              <span v-if="chipFor(color) !== undefined" :key="chipFor(color)!.seq"
                    class="con-eg__chip" :class="{'con-eg__chip--minus': chipFor(color)!.value < 0}"
                    :style="{left: chipEdgePct(color) + '%'}">
                {{ chipFor(color)!.value > 0 ? '+' + chipFor(color)!.value : chipFor(color)!.value }}
              </span>
            </transition>
            <!-- EXACT VALUES — one entry per settled category, in legend order,
                 colour + position keyed. Width is reserved from the start so
                 the strip never re-flows mid-ceremony. -->
            <div class="con-eg__vals">
              <span v-for="(cat, ci) in vm.categories" :key="cat.key"
                    class="con-eg__val" :class="valClass(cat, ci)">
                <span class="con-eg__val-dot" aria-hidden="true"></span>
                <span class="con-eg__val-num">{{ ci < ui.catsSettled ? fmtVal(cat.values[color] ?? 0) : '' }}</span>
              </span>
            </div>
          </div>
          <div v-if="tieChipVisible(color)" class="con-eg__mc">
            <i class="resource_icon resource_icon--megacredits con-eg__mc-icon" aria-hidden="true"></i>
            <b>{{ rowBy(color).megacredits }}</b>
          </div>
          <div class="con-eg__total">
            <span class="con-eg__total-num">{{ ui.displayTotals[color] ?? 0 }}</span>
            <span class="con-eg__total-cap">{{ $t('VP') }}</span>
          </div>
        </div>
      </div>

      <!-- THE BOTTOM ZONE — stage caption's counterpart: tie-break strip →
           winner plate → the post-game action list. One focus at a time. -->
      <div class="con-eg__zone">
        <transition name="con-eg-zone" mode="out-in">
          <div v-if="ui.phase === 'tiebreak' && vm.tieBreak !== undefined" key="tiebreak" class="con-eg__tb">
            <div class="con-eg__tb-title">{{ $t('Tie on VP — decided on M€') }}</div>
            <transition name="con-eg-fade">
              <div v-if="ui.tieStage >= 1" class="con-eg__tb-chips">
                <span v-for="c in vm.tieBreak.contenders" :key="c"
                      class="con-eg__tb-chip" :class="{'con-eg__tb-chip--won': ui.tieStage >= 2 && vm.winners.includes(c)}">
                  <span class="con-eg__swatch" :class="'player_bg_color_' + c" aria-hidden="true"></span>
                  <span class="con-eg__tb-name">{{ rowBy(c).name }}</span>
                  <i class="resource_icon resource_icon--megacredits con-eg__mc-icon" aria-hidden="true"></i>
                  <b>{{ vm.tieBreak.values[c] }}</b>
                </span>
              </div>
            </transition>
          </div>

          <div v-else-if="ui.winnerShown" key="winner" class="con-eg__final">
            <div ref="winnerPlateEl" class="con-eg__wplate"
                 :class="{'con-eg__wplate--defeat': soloDefeat, 'con-eg__wplate--shared': sharedWin}">
              <div class="con-eg__wkicker">{{ $t(winnerKicker) }}</div>
              <div class="con-eg__wnames">
                <span v-for="c in winnerColors" :key="c" class="con-eg__wname">
                  <span class="con-eg__swatch con-eg__swatch--big" :class="'player_bg_color_' + c" aria-hidden="true"></span>
                  <span class="con-eg__wname-text">{{ rowBy(c).name }}</span>
                  <span v-if="rowBy(c).corporation !== ''" class="con-eg__wcorp">{{ $t(rowBy(c).corporation) }}</span>
                </span>
              </div>
              <div v-if="winnerColors.length > 0" class="con-eg__wtotal">
                <b>{{ rowBy(winnerColors[0]).finalTotal }}</b>
                <span>{{ $t('VP') }}</span>
              </div>
              <div v-if="vm.automaClockWin" class="con-eg__wnote">{{ $t('Won on the clock — the final generation was reached') }}</div>
            </div>

            <transition name="con-eg-fade">
              <div v-if="ui.actionsOn" class="con-eg__actions" role="menu">
                <div v-for="(a, i) in actions" :key="a.id"
                     class="con-eg__action" role="menuitem"
                     :class="{
                       'con-eg__action--focused': i === ui.actionsFocus,
                       'con-eg__action--disabled': a.enabled === false,
                     }">
                  <GamepadGlyph v-if="i === ui.actionsFocus && a.enabled !== false" control="confirm" class="con-eg__action-a" />
                  <span class="con-eg__action-label">{{ $t(a.label) }}</span>
                  <span v-if="a.note !== undefined" class="con-eg__action-note">{{ a.note }}</span>
                </div>
              </div>
            </transition>
          </div>

          <div v-else key="idle" class="con-eg__zone-idle" aria-hidden="true"></div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The scoring WORKSPACE component. Rendering + input + the two DOM moments
 * the director cannot know (the ranking FLIP and the winner burst); the
 * numbers live in the pure VM, the choreography in the script/director, the
 * observable stages in the module state — all unit-tested without this file.
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {ViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {consoleMotionMs, useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {endgameModelFromView, botColorsFromView} from '@/client/components/endgame/endgameViewAdapter';
import {restoreEndgameResults, setEndgameTab} from '@/client/components/endgame/endgameState';
import {rematchState, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {
  buildConsoleEndgameVm, ConsoleEndgameVm, ConsoleEndgameCategory, ConsoleEndgameRow,
} from '@/client/console/endgame/consoleEndgameModel';
import {CEREMONY_MS} from '@/client/console/endgame/consoleEndgameScript';
import {runEndgameCeremony, CeremonyHandle} from '@/client/console/endgame/consoleEndgameDirector';
import {
  consoleEndgameUi, ceremonyShouldPlay, resetCeremonyProgress, finalizeCeremony,
} from '@/client/console/endgame/consoleEndgameState';

type SubView = {key: string, leftPct: number, widthPct: number, on: boolean, shade: number};
type SegView = {
  key: string, accent: string, leftPct: number, widthPct: number,
  on: boolean, merged: boolean, penalty: boolean, subs: Array<SubView>,
};

type PostGameAction = {
  id: string,
  label: string, // i18n KEY
  note?: string, // pre-rendered (counts) — never a key
  enabled?: boolean,
  run: () => void,
};

export default defineComponent({
  name: 'ConsoleEndgameWorkspace',
  components: {GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<ViewModel>, required: true},
  },
  setup() {
    const {reduced} = useConsoleReducedMotion();
    return {reduced};
  },
  data() {
    return {
      handle: undefined as CeremonyHandle | undefined,
      bursts: [] as Array<CeremonyBurstHandle>,
      /** Suppresses every CSS transition for the skip's atomic jump frame. */
      noanim: false,
      noanimRaf: 0,
    };
  },
  computed: {
    ui() {
      return consoleEndgameUi;
    },
    vm(): ConsoleEndgameVm {
      const model = endgameModelFromView(this.playerView);
      const order = this.playerView.players.map((p) => p.color);
      return buildConsoleEndgameVm(model, order, {botColors: botColorsFromView(this.playerView)});
    },
    rowOrder(): ReadonlyArray<Color> {
      return this.ui.ranked ? this.vm.rankedColors : this.vm.rows.map((r) => r.color);
    },
    activeCategory(): ConsoleEndgameCategory | undefined {
      return this.ui.catIdx >= 0 ? this.vm.categories[this.ui.catIdx] : undefined;
    },
    captionText(): string {
      const cat = this.activeCategory;
      if (cat === undefined) {
        return '';
      }
      const sub = this.ui.subIdx >= 0 ? cat.subs[this.ui.subIdx] : undefined;
      if (sub !== undefined) {
        return `${this.$t(cat.label)} — ${this.$t(sub.label)}`;
      }
      return this.$t(cat.label);
    },
    captionKey(): string {
      return `${this.ui.catIdx}:${this.ui.subIdx}`;
    },
    captionAccent(): string {
      const cat = this.activeCategory;
      return cat !== undefined ? `con-eg-ink--${cat.accent}` : '';
    },
    sharedWin(): boolean {
      return this.vm.winners.length > 1;
    },
    soloDefeat(): boolean {
      return this.vm.mode === 'solo' && !this.vm.soloWin;
    },
    winnerKicker(): string {
      if (this.vm.mode === 'solo') {
        return this.vm.soloWin ? 'Victory' : 'Defeat';
      }
      return this.sharedWin ? 'Shared victory' : 'Winner';
    },
    winnerColors(): ReadonlyArray<Color> {
      if (this.vm.winners.length > 0) {
        return this.vm.winners;
      }
      // Solo defeat: the plate still states the player's own result.
      return this.vm.mode === 'solo' ? this.vm.rows.map((r) => r.color) : [];
    },
    /** The post-game verbs. Only REAL flows: the desktop results overlay, the
     *  rematch machinery (rematchState — polled by RematchLayer), the local
     *  replay, the main menu (GameExitButton is gone at Phase.END, so this
     *  list is the one road out). */
    actions(): Array<PostGameAction> {
      const out: Array<PostGameAction> = [];
      out.push({
        id: 'overview',
        label: 'Game overview',
        // TODO(console-endgame-overview): «Обзор партии» deliberately opens the
        // EXISTING desktop EndgameResultsOverlay for now (restoreEndgameResults
        // → .eg-results over this workspace; B/minimize returns here). The
        // console-native rewrite is a separate iteration: a full workspace with
        // InsightEngine facts, per-category breakdowns, tabs (score / timeline /
        // cards / parameters / players) and charts — driven by the same
        // endgameModel/insight layers, presented in the console language.
        run: () => {
          setEndgameTab('overview');
          restoreEndgameResults();
        },
      });
      const rematch = rematchState.model;
      const busy = rematchState.submitting;
      const viewerId = this.playerView.id;
      if (rematch !== undefined && rematch.viewerIsPlayer && viewerId !== undefined) {
        if (rematch.status === 'created') {
          const href = rematchJoinHref(rematch);
          if (href !== undefined) {
            out.push({
              id: 'rematch-join',
              label: rematch.joinKind === 'spectator' ? 'Watch rematch' : 'Join rematch',
              run: () => navigateWithCurtain(href),
            });
          }
        } else if (rematch.viewerMustVote) {
          out.push({
            id: 'rematch-accept', label: 'Accept rematch', enabled: !busy,
            note: this.rematchTally(rematch.votes),
            run: () => void submitRematch(viewerId, 'accept'),
          });
          out.push({
            id: 'rematch-decline', label: 'Decline', enabled: !busy,
            run: () => void submitRematch(viewerId, 'decline'),
          });
        } else if (rematch.status === 'offered' && rematch.viewerIsOfferer) {
          out.push({
            id: 'rematch-cancel', label: 'Cancel', enabled: !busy,
            note: this.rematchTally(rematch.votes),
            run: () => void submitRematch(viewerId, 'cancel'),
          });
        } else if (rematch.status === 'offered') {
          // A player who already voted while others are still deciding.
          out.push({
            id: 'rematch-wait', label: 'Offer rematch', enabled: false,
            note: this.rematchTally(rematch.votes),
            run: () => { /* disabled */ },
          });
        } else {
          out.push({
            id: 'rematch-offer', label: 'Offer rematch', enabled: !busy,
            run: () => void submitRematch(viewerId, 'offer'),
          });
        }
      }
      out.push({
        id: 'replay',
        label: 'Replay scoring',
        run: () => this.replayCeremony(),
      });
      out.push({
        id: 'menu',
        label: 'To main menu',
        run: () => navigateWithCurtain('/'),
      });
      return out;
    },
    footCommands(): Array<ConsoleCommand> {
      if (this.ui.phase !== 'actions') {
        // ONE verb while the count runs — deliberately X (never A/B/d-pad, so
        // ordinary navigation can't trigger it by accident), and never the
        // loudest thing on screen: the ceremony is the point.
        return [{control: 'secondary', label: 'Skip scoring', priority: 0}];
      }
      return [
        {control: 'dpad', label: 'Select'},
        {control: 'confirm', label: 'Confirm'},
      ];
    },
  },
  watch: {
    'footCommands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        setPanelCommands('endgame', cmds);
      },
    },
    // The list is live (rematch states arrive by poll) — the cursor must
    // never point past its end.
    'actions.length': function(len: number): void {
      if (this.ui.actionsFocus >= len) {
        this.ui.actionsFocus = Math.max(0, len - 1);
      }
    },
    // Skip / settle jumps suppress every CSS transition for one frame, so the
    // final state appears ATOMICALLY (no half-grown bars racing each other).
    'ui.skipSeq': function(): void {
      this.noanim = true;
      cancelAnimationFrame(this.noanimRaf);
      this.noanimRaf = requestAnimationFrame(() => {
        this.noanimRaf = requestAnimationFrame(() => {
          this.noanim = false;
        });
      });
    },
  },
  mounted() {
    if (ceremonyShouldPlay()) {
      this.startCeremony();
    } else {
      // Reload / re-entry into an already-ended game: the SETTLED final state,
      // instantly and silently. Watching the count again is the explicit
      // «Повторить подсчёт» action, never a side effect of arriving.
      finalizeCeremony(this.vm);
    }
  },
  beforeUnmount() {
    this.teardown();
    clearPanelCommands('endgame');
  },
  methods: {
    rowBy(color: Color): ConsoleEndgameRow {
      const row = this.vm.rows.find((r) => r.color === color);
      // Every color in rowOrder/winners comes from the VM itself.
      return row ?? this.vm.rows[0];
    },
    fmtVal(v: number): string {
      return v > 0 ? String(v) : (v < 0 ? String(v) : '0');
    },
    chipFor(color: Color): {value: number, seq: number} | undefined {
      return this.ui.chips[color];
    },
    // ── layout ────────────────────────────────────────────────────────────
    rowSegments(color: Color): Array<SegView> {
      const out: Array<SegView> = [];
      const max = this.vm.maxTotal;
      let cum = 0;
      this.vm.categories.forEach((cat, idx) => {
        const value = cat.values[color] ?? 0;
        if (cat.penalty) {
          if (value < 0) {
            const width = (-value / max) * 100;
            out.push({
              key: cat.key, accent: cat.accent, penalty: true,
              leftPct: Math.max(0, ((cum + value) / max) * 100),
              widthPct: width,
              on: this.segOn(idx),
              merged: true,
              subs: [{key: cat.key + ':0', leftPct: 0, widthPct: 100, on: this.segOn(idx), shade: 0}],
            });
            cum += value;
          }
          return;
        }
        if (value <= 0) {
          return;
        }
        const leftPct = (cum / max) * 100;
        const widthPct = (value / max) * 100;
        const subs: Array<SubView> = [];
        if (cat.subs.length > 1) {
          let subCum = 0;
          cat.subs.forEach((sub, sidx) => {
            const sv = sub.values[color] ?? 0;
            if (sv > 0) {
              subs.push({
                key: sub.key,
                leftPct: (subCum / value) * 100,
                widthPct: (sv / value) * 100,
                on: this.subOn(idx, cat, sidx),
                shade: sidx % 3,
              });
              subCum += sv;
            }
          });
        } else {
          subs.push({key: cat.key + ':0', leftPct: 0, widthPct: 100, on: this.segOn(idx), shade: 0});
        }
        out.push({
          key: cat.key, accent: cat.accent, penalty: false,
          leftPct, widthPct,
          on: this.segOn(idx),
          merged: this.ui.merged[cat.key] === true || cat.subs.length <= 1,
          subs,
        });
        cum += value;
      });
      return out;
    },
    segOn(idx: number): boolean {
      return idx < this.ui.catsSettled || idx === this.ui.catIdx;
    },
    subOn(idx: number, cat: ConsoleEndgameCategory, sidx: number): boolean {
      if (idx < this.ui.catsSettled) {
        return true;
      }
      if (idx !== this.ui.catIdx) {
        return false;
      }
      return (this.ui.subsOn[cat.key] ?? 0) > sidx;
    },
    /** The bar edge the «+N» chip stands over: everything already counted for
     *  this row, INCLUDING the active beat's own value. */
    chipEdgePct(color: Color): number {
      const max = this.vm.maxTotal;
      let cum = 0;
      this.vm.categories.forEach((cat, idx) => {
        const value = cat.values[color] ?? 0;
        if (idx < this.ui.catsSettled) {
          cum += value;
          return;
        }
        if (idx !== this.ui.catIdx) {
          return;
        }
        if (cat.subs.length > 1) {
          const on = this.ui.subsOn[cat.key] ?? 0;
          for (let s = 0; s < on && s < cat.subs.length; s++) {
            cum += cat.subs[s].values[color] ?? 0;
          }
        } else {
          cum += value;
        }
      });
      return Math.min(100, Math.max(0, (cum / max) * 100));
    },
    // ── classes ───────────────────────────────────────────────────────────
    lchipClass(cat: ConsoleEndgameCategory, i: number): Record<string, boolean> {
      return {
        ['con-eg-cat--' + cat.accent]: true,
        'con-eg__lchip--active': i === this.ui.catIdx && this.ui.phase === 'scoring',
        'con-eg__lchip--done': i < this.ui.catsSettled,
      };
    },
    segClass(seg: SegView): Record<string, boolean> {
      return {
        ['con-eg-cat--' + seg.accent]: true,
        'con-eg__seg--on': seg.on,
        'con-eg__seg--merged': seg.merged,
        'con-eg__seg--penalty': seg.penalty,
      };
    },
    subClass(sub: SubView): Record<string, boolean> {
      return {
        'con-eg__subseg--on': sub.on,
        ['con-eg__subseg--s' + sub.shade]: true,
      };
    },
    valClass(cat: ConsoleEndgameCategory, ci: number): Record<string, boolean> {
      return {
        ['con-eg-ink--' + cat.accent]: true,
        'con-eg__val--on': ci < this.ui.catsSettled,
        'con-eg__val--active': ci === this.ui.catIdx && this.ui.phase === 'scoring',
      };
    },
    rowClass(color: Color): Record<string, boolean> {
      const winner = this.ui.winnerShown && this.vm.winners.includes(color);
      const contender = this.ui.phase === 'tiebreak' && (this.vm.tieBreak?.contenders.includes(color) ?? false);
      return {
        'con-eg__row--winner': winner,
        // The rest of the table steps back HALF a tone — readable, never grey noise.
        'con-eg__row--rest': this.ui.winnerShown && !winner && this.vm.winners.length > 0,
        'con-eg__row--contender': contender,
        'con-eg__row--bot': this.rowBy(color).isBot,
      };
    },
    tieChipVisible(color: Color): boolean {
      return this.ui.phase === 'tiebreak' && this.ui.tieStage >= 1 &&
        (this.vm.tieBreak?.contenders.includes(color) ?? false);
    },
    rematchTally(votes: ReadonlyArray<{status: string}>): string {
      const accepted = votes.filter((v) => v.status === 'accepted').length;
      return `${accepted}/${votes.length}`;
    },
    // ── ceremony control ──────────────────────────────────────────────────
    startCeremony(): void {
      this.teardown();
      resetCeremonyProgress();
      consoleEndgameUi.ceremonyPlayed = true;
      this.handle = runEndgameCeremony(this.vm, {
        onRankFlip: () => this.performRankFlip(),
        onWinnerFx: () => this.fireWinnerFx(),
      });
    },
    replayCeremony(): void {
      this.startCeremony();
    },
    skipCeremony(): void {
      if (this.handle !== undefined) {
        this.handle.skip();
      } else {
        finalizeCeremony(this.vm);
      }
    },
    teardown(): void {
      this.handle?.kill();
      this.handle = undefined;
      for (const b of this.bursts.splice(0)) {
        b.stop();
      }
    },
    /**
     * THE RANKING FLIP — capture, reorder, invert, play. Transform-only; the
     * tweens register with the director so a skip mid-flight clears them
     * atomically (clearProps) instead of stranding half-translated rows.
     */
    performRankFlip(): void {
      const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
      if (rowsEl === undefined) {
        consoleEndgameUi.ranked = true;
        return;
      }
      const first = new Map<string, number>();
      rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]').forEach((el) => {
        first.set(el.dataset.egRow ?? '', el.getBoundingClientRect().top);
      });
      consoleEndgameUi.ranked = true;
      void this.$nextTick(() => {
        const els = [...rowsEl.querySelectorAll<HTMLElement>('[data-eg-row]')];
        const tweens: Array<gsap.core.Tween> = [];
        for (const el of els) {
          const from = first.get(el.dataset.egRow ?? '');
          if (from === undefined) {
            continue;
          }
          const dy = from - el.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) {
            continue;
          }
          tweens.push(gsap.fromTo(el,
            {y: dy},
            {y: 0, duration: consoleMotionMs(CEREMONY_MS.rankFlip) / 1000, ease: 'power3.inOut', clearProps: 'transform'}));
        }
        this.handle?.addCleanup(() => {
          for (const t of tweens) {
            t.kill();
          }
          gsap.set(els, {clearProps: 'transform'});
        });
      });
    },
    /** The winner burst — full on the first winner row, a quiet ping on
     *  co-winners (one main focus, even in a shared victory). */
    fireWinnerFx(): void {
      if (this.soloDefeat) {
        return; // a defeat gets a calm plate, never a celebration
      }
      void this.$nextTick(() => {
        const rowsEl = this.$refs.rowsEl as HTMLElement | undefined;
        this.vm.winners.forEach((color, i) => {
          const host = rowsEl?.querySelector<HTMLElement>(`[data-eg-row="${color}"]`);
          if (host !== null && host !== undefined) {
            this.bursts.push(playCeremonyBurst({
              host, accent: 'gold', reduced: this.reduced, intensity: i === 0 ? 'full' : 'ping',
            }));
          }
        });
      });
    },
    // ── input (delegated by the shell) ────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      // While the desktop results overlay is open the shell's fallback branch
      // owns the pad — this handler is only reached when the workspace is the
      // visible surface.
      if (intent.kind === 'nav') {
        if (this.ui.phase === 'actions') {
          const delta = intent.dir === 'down' || intent.dir === 'right' ? 1 : -1;
          const len = this.actions.length;
          this.ui.actionsFocus = (this.ui.actionsFocus + delta + len) % len;
        }
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (this.ui.phase !== 'actions') {
        // X — the one labelled skip verb. A/B/Y deliberately do nothing: the
        // count is not a dialog, and B has no level to go back to.
        if (action === 'inspect') {
          this.skipCeremony();
        }
        return;
      }
      if (action === 'primary') {
        const a = this.actions[this.ui.actionsFocus];
        if (a !== undefined && a.enabled !== false) {
          a.run();
        }
      }
      // B at the settled root: nothing above, nothing behind — inert by design.
    },
  },
});
</script>
