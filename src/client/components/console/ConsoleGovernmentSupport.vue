<template>
  <div class="con-govsupport" role="dialog" :aria-label="$t('Government Support')">
    <div class="con-govsupport__backdrop" aria-hidden="true"></div>

    <div class="con-govsupport__panel">
      <!-- ── Briefing header ─────────────────────────────────────────── -->
      <header class="con-govsupport__head">
        <div class="con-govsupport__kicker">
          <span class="con-govsupport__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Awaiting decision') }}</span>
        </div>
        <div class="con-govsupport__title">{{ $t('Government Support') }}</div>
        <div class="con-govsupport__subtitle">{{ $t('A planetary initiative will raise one global parameter.') }}</div>
        <!-- The one calm rule strip — never repeated as a "TR +0" per card. -->
        <div class="con-govsupport__rule">
          <span class="con-govsupport__rule-mark" aria-hidden="true">i</span>
          <span>{{ $t('Government action: TR and track bonuses are not awarded to players.') }}</span>
        </div>
      </header>

      <!-- ── 2×2 action grid ─────────────────────────────────────────── -->
      <div class="con-govsupport__grid" ref="grid" :class="{'con-govsupport__grid--wide': cards.length > 4}">
        <div v-for="(card, i) in cards" :key="card.key"
             class="con-govsupport__card"
             :class="[
               'con-govsupport__card--' + card.accent,
               {
                 'con-govsupport__card--focused': focusIdx === i,
                 'con-govsupport__card--disabled': !card.available,
                 'con-govsupport__card--space': card.isSpace && card.available,
               },
             ]">
          <div class="con-govsupport__card-top">
            <i class="con-govsupport__card-icon" :class="card.iconClass" aria-hidden="true"></i>
            <span v-if="focusIdx === i && card.available" class="con-govsupport__card-a">
              <GamepadGlyph control="confirm" />
            </span>
          </div>
          <div class="con-govsupport__card-name">{{ textOf(card.title) }}</div>
          <!-- The heart of the panel: the current → resulting change, large.
               The animated scale VISUAL lives on the board scale after
               confirm (one focused place) — not duplicated here. -->
          <div v-if="card.currentText !== ''" class="con-govsupport__preview">
            <span class="con-govsupport__pv-cur">{{ card.currentText }}</span>
            <template v-if="card.hasPreview">
              <span class="con-govsupport__pv-arrow" aria-hidden="true">→</span>
              <span class="con-govsupport__pv-next">{{ card.nextText }}</span>
            </template>
          </div>
          <div class="con-govsupport__card-type">
            <template v-if="!card.available">
              <span class="con-govsupport__card-blocked">✕ {{ $t(card.disabledReason) }}</span>
            </template>
            <template v-else-if="card.isSpace">
              <span class="con-govsupport__card-place">◈ {{ $t('Tile placement required') }}</span>
            </template>
            <template v-else>{{ $t('Global parameter') }}</template>
          </div>
        </div>
      </div>

      <!-- Focused-card briefing line (fixed height → never shifts the grid). -->
      <div class="con-govsupport__detail">{{ focusedDetail }}</div>

      <!-- ── Command contract ────────────────────────────────────────── -->
      <footer class="con-govsupport__foot" aria-hidden="true">
        <span v-for="(hint, i) in footHints" :key="i"
              class="con-govsupport__foot-item"
              :class="{'con-govsupport__foot-item--off': hint.enabled === false}">
          <GamepadGlyph :control="hint.control" />
          <span>{{ $t(hint.label) }}</span>
        </span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleGovernmentSupport — the console-native premium DECISION BRIEFING
 * for World Government Terraforming (the "Правительственная поддержка"
 * prompt). Replaces the generic ConsoleTaskHost `choice` list for this ONE
 * prompt (router flavor 'wgt'): a mission-control 2×2 of premium action
 * tiles — themed parameter icon, a large `current → resulting` preview + a
 * segmented mini-scale, and an honest type / placement line — under one
 * calm rules strip ("TR and track bonuses are not awarded to players").
 *
 * It changes NO game logic: the pure model (consoleGovernmentSupport.ts)
 * derives the tiles from the SAME WGT OrOptions; a leaf pick emits the
 * byte-identical `{type:'or', index, response:{type:'option'}}` the desktop
 * WGT modal POSTs (`@submit` → shell.onTaskSubmit), and the ocean/hazard
 * pick emits `@space-pick` (shell.onTaskSpacePick → the existing headless
 * SelectSpace placement flow). B defers to the amber chip (`@defer`).
 *
 * Control grammar (deliberately minimal — A is the one verb, no X confirm):
 *   D-pad / L-stick = navigate the 2×2 · A / X = apply the focused action
 *   (ocean → go to board placement) · B = minimize (inspect the board).
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {orOptionResponse} from '@/client/console/taskResponses';
import {buildGovSupportCards, firstAvailableIndex, GovCard, GovParam} from '@/client/console/consoleGovernmentSupport';
import {SCALE_FOCUS_PARAMS} from '@/client/console/consoleGovScaleFocus';

/** Two columns → up/down step by a row, left/right by one card. */
const COLS = 2;

/** Per-parameter focused briefing sentence (i18n keys). */
const DETAIL_KEY: Partial<Record<GovParam, string>> = {
  temperature: 'The world government raises the planet temperature.',
  oxygen: 'The world government raises the atmospheric oxygen.',
  oceans: 'Choose an available ocean space on the board.',
  venus: 'The world government raises the Venus scale.',
};

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleGovernmentSupport',
  components: {GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer', 'space-pick', 'gov-confirm'],
  data() {
    return {
      focusIdx: 0,
      /** Blocks a duplicate leaf submit between the emit and the next response. */
      submitting: false,
    };
  },
  computed: {
    options(): ReadonlyArray<PlayerInputModel> {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'or' ? (wf as OrOptionsModel).options : [];
    },
    cards(): Array<GovCard> {
      const game = this.playerView.game;
      return buildGovSupportCards(this.options, {
        temperature: game.temperature,
        oxygenLevel: game.oxygenLevel,
        oceans: game.oceans,
        venusScaleLevel: game.venusScaleLevel,
        venusInGame: game.gameOptions.expansions.venus === true,
      });
    },
    /** Prompt identity — a change is a genuinely new server ask (reset focus). */
    promptKey(): string {
      const wf = this.playerView.waitingFor;
      return `${textOf(wf?.title)}|${this.options.length}`;
    },
    focusedCard(): GovCard | undefined {
      return this.cards[this.focusIdx];
    },
    focusedDetail(): string {
      const card = this.focusedCard;
      if (card === undefined) {
        return '';
      }
      if (!card.available) {
        return translateText(card.disabledReason);
      }
      const key = DETAIL_KEY[card.param];
      return key !== undefined ?
        translateText(key) :
        translateText('A planetary initiative will raise one global parameter.');
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      const card = this.focusedCard;
      const applyLabel = card?.isSpace === true && card.available ? 'Select ocean space' : 'Apply';
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: applyLabel, enabled: card?.available === true},
        {control: 'back', label: 'Minimize'},
      ];
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler() {
        this.focusIdx = firstAvailableIndex(this.cards);
        this.submitting = false;
      },
    },
    /** Every server response re-arms submission (root identity always changes). */
    playerView() {
      this.submitting = false;
    },
  },
  methods: {
    textOf(v: string | Message | undefined): string {
      return textOf(v);
    },
    /** The shell routes every intent here while the panel is active. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onNav(dir: NavDirection): void {
      const n = this.cards.length;
      if (n === 0) {
        return;
      }
      let next = this.focusIdx;
      switch (dir) {
      case 'left': next = this.focusIdx - 1; break;
      case 'right': next = this.focusIdx + 1; break;
      case 'up': next = this.focusIdx - COLS; break;
      case 'down': next = this.focusIdx + COLS; break;
      }
      if (next >= 0 && next < n) {
        this.focusIdx = next;
      }
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'confirm': // A — the one verb
      case 'secondary': // X mirrors A (forgiving; no separate confirm step)
        this.apply();
        return;
      case 'back':
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    apply(): void {
      const card = this.focusedCard;
      if (card === undefined || !card.available) {
        return; // a maxed/disabled card is readable, never applied
      }
      if (card.isSpace && card.option !== undefined) {
        // Ocean / hazard: hand off to the board placement flow (the shell
        // mounts the headless SelectSpace + shows the placement banner).
        this.$emit('space-pick', {index: card.optionIndex, spacePrompt: card.option});
        return;
      }
      if (this.submitting) {
        return; // guard rapid A presses — no double submit
      }
      this.submitting = true;
      const response = orOptionResponse(card.optionIndex);
      // Scale params (temp/oxygen/venus): hand the shell the CHOREOGRAPHED
      // path — close this modal FIRST, then submit, so the board scale glide
      // + accent play on a clean board before the next modal opens. Other
      // leaf options (Moon rates) submit immediately (no arc scale to accent).
      if (SCALE_FOCUS_PARAMS.has(card.param)) {
        this.$emit('gov-confirm', {response, param: card.param});
      } else {
        this.$emit('submit', response);
      }
    },
  },
});
</script>
