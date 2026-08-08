<template>
  <div class="cm-overlay cm-devcards" role="dialog" :aria-label="$t('Guaranteed cards')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">
        <span class="cm-devcards__devtag" aria-hidden="true">DEV</span>
        {{ $t('Guaranteed cards') }}
        <span v-if="crumb !== ''" class="cm-devcards__crumb">› {{ crumb }}</span>
      </div>

      <!-- ── PICKED: what the deal is rigged with ───────────────────────── -->
      <template v-if="view === 'picked'">
        <div class="cm-devcards__lede">{{ $t('These cards go on top of the decks, so the starting choice contains them. Picking any of them also makes you the first player, who is dealt first.') }}</div>
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <button
              type="button"
              class="cm-drow cm-drow--add"
              :class="{'cm-drow--cursor': pickedCursor === 0}"
              @click="openModules()"
              @mousemove="pickedCursor = 0"
            >
              <span class="cm-drow__name">＋ {{ $t('Add card') }}</span>
            </button>
            <button
              v-for="(entry, i) in picked"
              :key="entry.name"
              type="button"
              class="cm-drow"
              :class="[themeClass(entry.type), {'cm-drow--cursor': pickedCursor === i + 1}]"
              @click="removeAt(i)"
              @mousemove="pickedCursor = i + 1"
            >
              <span class="cm-drow__dot" aria-hidden="true"></span>
              <span class="cm-drow__name">{{ entry.title }}</span>
              <span class="cm-drow__type">{{ $t(typeLabelKey(entry.type)) }}</span>
            </button>
            <div v-if="picked.length === 0" class="cm-devcards__empty">{{ $t('No cards picked — the deal stays random.') }}</div>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t(pickedCursor === 0 ? 'Add card' : 'Remove') }}</span>
          <span v-if="picked.length > 0 && pickedCursor > 0" class="cm-overlay__foot-hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
          <span v-if="picked.length > 0" class="cm-overlay__foot-hint"><GamepadGlyph control="view" />{{ $t('Clear all') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Done') }}</span>
        </div>
      </template>

      <!-- ── MODULES: level 1 ───────────────────────────────────────────── -->
      <template v-else-if="view === 'modules'">
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <button
              v-for="(m, i) in modules"
              :key="m.id"
              type="button"
              class="cm-drow cm-drow--module"
              :class="{'cm-drow--cursor': moduleCursor === i}"
              @click="openModule(i)"
              @mousemove="moduleCursor = i"
            >
              <span class="cm-drow__name">{{ $t(m.labelKey) }}</span>
              <span v-if="!m.enabled" class="cm-drow__off">{{ $t('Expansion is off') }}</span>
              <span class="cm-drow__count">
                <span v-if="m.chosen > 0" class="cm-drow__count-on">{{ m.chosen }}</span>
                <span class="cm-drow__count-total">{{ m.total }}</span>
              </span>
            </button>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Open') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
        </div>
      </template>

      <!-- ── CARDS: level 2 ─────────────────────────────────────────────── -->
      <template v-else>
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <template v-for="(row, i) in cardRows" :key="row.key">
              <div v-if="row.kind === 'header'" class="cm-devcards__group">
                <span class="cm-devcards__group-name">{{ $t(row.labelKey) }}</span>
                <span class="cm-devcards__group-count">{{ row.count }}</span>
              </div>
              <button
                v-else
                type="button"
                class="cm-drow"
                :class="[themeClass(row.entry.type), {'cm-drow--cursor': cardCursor === i, 'cm-drow--chosen': row.entry.chosen}]"
                @click="toggleAt(i)"
                @mousemove="cardCursor = i"
              >
                <span class="cm-drow__dot" aria-hidden="true"></span>
                <span class="cm-drow__name">{{ row.entry.title }}</span>
                <span v-if="row.entry.chosen" class="cm-drow__mark" aria-hidden="true">✓</span>
              </button>
            </template>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t(currentCardChosen ? 'Remove' : 'Add') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />{{ $t('Card type') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
        </div>
      </template>
    </div>

    <!--
      The fullscreen card viewer. The console's shared one is mounted by
      ConsoleShell, which does not exist before a game — so this dev tool hosts
      its own instance of the SAME modal with the SAME console-native chrome
      (teleported out of the overlay's stacking context, as every other host
      does). The picker stays mounted underneath, so toggles made here are
      reflected in the list without losing its cursor or scroll position.
    -->
    <Teleport to="body">
      <transition name="con-zoom-veil">
        <div v-if="zoomCard !== undefined" class="con-zoom-veil" aria-hidden="true"></div>
      </transition>
      <CardZoomModal
        v-if="zoomCard !== undefined"
        ref="zoomModal"
        class="con-zoom"
        :card="zoomCard"
        :cards="zoomList"
        :index="zoomIndex"
        :selected="zoomSelected"
        :consoleMotion="true"
        :annotationsSuppressed="zoomRulesCardName !== undefined"
        :lore="true"
        @navigate="onZoomNavigate"
        @close="closeZoom()"
      >
        <template v-if="zoomRulesCardName !== undefined" #side="side">
          <ConsoleCardRulesPanel
            :cardName="zoomRulesCardName"
            :nonce="side.nonce"
            :closing="side.closing"
          />
        </template>
        <template #actions>
          <div class="con-zoom__context">
            <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Guaranteed cards') }}</span>
          </div>
          <div class="con-zoom__bar">
            <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
            <button type="button" class="con-zoom__btn con-zoom__btn--select" @click="toggleZoomSelection">
              <GamepadGlyph control="confirm" />
              <span>{{ $t(zoomSelected ? 'Deselect' : 'Select') }}</span>
            </button>
            <span v-if="zoomList !== undefined && zoomList.length > 1" class="con-zoom__cmd con-zoom__cmd--flip">
              <GamepadGlyph control="bumperL" />
              <span class="con-zoom__flip-arrow" aria-hidden="true">◀</span>
              <span>{{ $t('Browse') }}</span>
              <span class="con-zoom__flip-arrow" aria-hidden="true">▶</span>
              <GamepadGlyph control="bumperR" />
            </span>
            <button type="button" class="con-zoom__btn" @click="requestZoomClose">
              <GamepadGlyph control="back" />
              <span>{{ $t('Close') }}</span>
            </button>
          </div>
        </template>
      </CardZoomModal>
    </Teleport>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE-NATIVE DEV CARD PICKER — the «Тестовый режим» sub-setting.
 *
 * Deliberately a UTILITY, not a premium surface: plain rows, no card faces, no
 * cinematics. It exists so an e2e run or a feature check can guarantee a card
 * in the starting choice instead of re-rolling the deal.
 *
 * Three levels, one overlay:
 *   PICKED  — what is currently rigged (A = add / remove, Y = remove, View = clear)
 *   MODULES — the fork's playable module scope (GUARANTEED_MODULES)
 *   CARDS   — that module's cards, grouped by type, alphabetical by the
 *             LOCALIZED title; A toggles, LB/RB jump between type groups.
 *
 * X inspects the cursored card fullscreen — the console-wide inspect verb —
 * reusing the shared `CardZoomModal` (see the Teleport above). While it is open
 * it owns the pad, exactly like the in-game shell's zoom carve-out.
 *
 * Host-routed pad intents via `handleIntent`, mirroring ConsoleAdminRollback.
 */
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import ConsoleCardRulesPanel, {cardHasRules} from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {createGameState} from '@/client/components/create/premium/createGameState';
import {
  GUARANTEED_MODULES,
  GuaranteedCardEntry,
  GuaranteedPickRow,
  clearGuaranteedCards,
  guaranteedChosenEntries,
  guaranteedModuleCounts,
  guaranteedNames,
  guaranteedPickRows,
  guaranteedThemeOf,
  guaranteedTypeLabelKey,
  removeGuaranteedCard,
  toggleGuaranteedCard,
} from '@/client/components/create/premium/devGuaranteedCards';
import {$t} from '@/client/directives/i18n';

type PickerView = 'picked' | 'modules' | 'cards';

/** ◄ / ► page step through a long card list. */
const PAGE_ROWS = 10;

export default defineComponent({
  name: 'ConsoleDevCardPicker',
  components: {GamepadGlyph, CardZoomModal, ConsoleCardRulesPanel, ConsoleScrollArea},
  emits: ['close'],
  data() {
    return {
      view: 'picked' as PickerView,
      pickedCursor: 0,
      moduleCursor: 0,
      cardCursor: 0,
      module: 'base' as GameModule,
      zoomCard: undefined as CardModel | undefined,
      zoomList: undefined as ReadonlyArray<CardModel> | undefined,
      zoomIndex: 0,
    };
  },
  computed: {
    picks() {
      return createGameState.config.guaranteedCards;
    },
    chosenNames(): ReadonlySet<CardName> {
      return guaranteedNames(this.picks);
    },
    picked(): ReadonlyArray<GuaranteedCardEntry> {
      return guaranteedChosenEntries(this.picks);
    },
    modules(): ReadonlyArray<{id: GameModule, labelKey: string, total: number, chosen: number, enabled: boolean}> {
      const selected = createGameState.config.selectedExpansions;
      const chosen = this.chosenNames;
      return GUARANTEED_MODULES.map((m) => ({
        ...m,
        ...guaranteedModuleCounts(m.id, chosen),
        // Base is always in; an expansion that is OFF still works (the server
        // adds a guaranteed card to the pool), but the dev should see it.
        enabled: m.id === 'base' || selected[m.id as keyof typeof selected] === true,
      }));
    },
    cardRows(): ReadonlyArray<GuaranteedPickRow> {
      return guaranteedPickRows(this.module, this.chosenNames);
    },
    /** Row-parallel selectability — headers are walked past, never landed on. */
    cardSelectable(): ReadonlyArray<boolean> {
      return this.cardRows.map((row) => row.kind === 'card');
    },
    currentEntry(): GuaranteedCardEntry | undefined {
      const row = this.cardRows[this.cardCursor];
      return row !== undefined && row.kind === 'card' ? row.entry : undefined;
    },
    currentCardChosen(): boolean {
      return this.currentEntry?.chosen === true;
    },
    zoomSelected(): boolean {
      return this.zoomCard !== undefined && this.chosenNames.has(this.zoomCard.name as CardName);
    },
    zoomRulesCardName(): CardName | undefined {
      const name = this.zoomCard?.name;
      return name !== undefined && cardHasRules(name) ? name as CardName : undefined;
    },
    crumb(): string {
      if (this.view === 'modules') {
        return $t('Add card');
      }
      if (this.view === 'cards') {
        const meta = GUARANTEED_MODULES.find((m) => m.id === this.module);
        return meta === undefined ? '' : $t(meta.labelKey);
      }
      return '';
    },
  },
  methods: {
    typeLabelKey(type: CardType): string {
      return guaranteedTypeLabelKey(type);
    },
    themeClass(type: CardType): string {
      const theme = guaranteedThemeOf(type);
      return theme === undefined ? '' : `cm-drow--${theme}`;
    },

    // ── Input ────────────────────────────────────────────────────────────
    /** Host-routed pad intents. Always consumes — this overlay is modal. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.zoomCard !== undefined) {
        return this.handleZoomIntent(intent);
      }
      // No `secondary` override: X keeps its DEFAULT meaning here — the
      // console-wide inspect verb — rather than the create screen's «Запуск».
      const action = consoleActionOf(intent);
      switch (this.view) {
      case 'picked': return this.handlePickedIntent(intent, action);
      case 'modules': return this.handleModulesIntent(intent, action);
      default: return this.handleCardsIntent(intent, action);
      }
    },
    handleZoomIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      const modal = this.$refs.zoomModal as {prev: () => void, next: () => void} | undefined;
      if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
        if (intent.dir === 'right') {
          modal?.next();
        } else {
          modal?.prev();
        }
        return true;
      }
      if (action === 'prevSection') {
        modal?.prev();
        return true;
      }
      if (action === 'nextSection') {
        modal?.next();
        return true;
      }
      if (action === 'primary') {
        this.toggleZoomSelection();
        return true;
      }
      if (action === 'back' || action === 'inspect') {
        this.requestZoomClose();
      }
      return true;
    },
    handlePickedIntent(intent: GamepadIntent, action: string | undefined): boolean {
      const rows = this.picked.length + 1;
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.pickedCursor = stepIndex(this.pickedCursor, intent.dir === 'down' ? 1 : -1, rows);
        this.keepCursorVisible();
        return true;
      }
      if (action === 'primary') {
        if (this.pickedCursor === 0) {
          this.openModules();
        } else {
          this.removeAt(this.pickedCursor - 1);
        }
        return true;
      }
      if (action === 'fullscreen') {
        // Y — the create screen's established «удалить» verb.
        if (this.pickedCursor > 0) {
          this.removeAt(this.pickedCursor - 1);
        }
        return true;
      }
      if (action === 'inspect') {
        const entry = this.picked[this.pickedCursor - 1];
        if (entry !== undefined) {
          this.openZoom(this.picked.map((e) => e.name), this.pickedCursor - 1);
        }
        return true;
      }
      if (action === 'reset') {
        clearGuaranteedCards(this.picks);
        this.pickedCursor = 0;
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
      }
      return true;
    },
    handleModulesIntent(intent: GamepadIntent, action: string | undefined): boolean {
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.moduleCursor = stepIndex(this.moduleCursor, intent.dir === 'down' ? 1 : -1, this.modules.length);
        this.keepCursorVisible();
        return true;
      }
      if (action === 'primary') {
        this.openModule(this.moduleCursor);
        return true;
      }
      if (action === 'back') {
        this.view = 'picked';
        this.keepCursorVisible();
      }
      return true;
    },
    handleCardsIntent(intent: GamepadIntent, action: string | undefined): boolean {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.cardCursor = stepSelectable(this.cardCursor, intent.dir === 'down' ? 1 : -1, this.cardSelectable);
          this.keepCursorVisible();
          return true;
        }
        // ◄ ► page through a long list without holding the stick.
        const step = intent.dir === 'right' ? PAGE_ROWS : -PAGE_ROWS;
        const target = stepIndex(this.cardCursor, step, this.cardRows.length);
        this.cardCursor = stepSelectable(target, 0, this.cardSelectable);
        this.keepCursorVisible();
        return true;
      }
      if (action === 'primary') {
        this.toggleAt(this.cardCursor);
        return true;
      }
      if (action === 'inspect') {
        const names = this.cardRows.flatMap((row) => row.kind === 'card' ? [row.entry.name] : []);
        const at = names.indexOf(this.currentEntry?.name as CardName);
        if (at >= 0) {
          this.openZoom(names, at);
        }
        return true;
      }
      if (action === 'prevSection' || action === 'nextSection') {
        this.jumpGroup(action === 'nextSection' ? 1 : -1);
        return true;
      }
      if (action === 'back') {
        this.view = 'modules';
        this.keepCursorVisible();
      }
      return true;
    },

    // ── Navigation ───────────────────────────────────────────────────────
    openModules(): void {
      this.view = 'modules';
      this.keepCursorVisible();
    },
    openModule(i: number): void {
      const meta = this.modules[i];
      if (meta === undefined) {
        return;
      }
      this.moduleCursor = i;
      this.module = meta.id;
      this.view = 'cards';
      // Land on the first real card, never on a group heading.
      this.cardCursor = stepSelectable(0, 0, this.cardSelectable);
      this.keepCursorVisible();
    },
    /** LB / RB — jump to the previous/next card-TYPE group heading. */
    jumpGroup(step: 1 | -1): void {
      const rows = this.cardRows;
      const headers = rows.flatMap((row, i) => row.kind === 'header' ? [i] : []);
      if (headers.length === 0) {
        return;
      }
      const currentGroup = headers.filter((i) => i <= this.cardCursor).length - 1;
      const next = Math.min(headers.length - 1, Math.max(0, currentGroup + step));
      this.cardCursor = stepSelectable(headers[next], 1, this.cardSelectable);
      this.keepCursorVisible();
    },
    keepCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.scroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-drow--cursor'));
      });
    },

    // ── Picks ────────────────────────────────────────────────────────────
    toggleAt(i: number): void {
      const row = this.cardRows[i];
      if (row === undefined || row.kind !== 'card') {
        return;
      }
      this.cardCursor = i;
      toggleGuaranteedCard(this.picks, row.entry.name);
    },
    removeAt(i: number): void {
      const entry = this.picked[i];
      if (entry === undefined) {
        return;
      }
      removeGuaranteedCard(this.picks, entry.name);
      this.pickedCursor = Math.min(this.pickedCursor, this.picked.length);
    },

    // ── Fullscreen inspect ───────────────────────────────────────────────
    openZoom(names: ReadonlyArray<CardName>, at: number): void {
      const list = names.map((name) => ({name} as CardModel));
      const card = list[at];
      if (card === undefined) {
        return;
      }
      this.zoomList = list;
      this.zoomIndex = at;
      this.zoomCard = card;
      document.body.classList.add('con-zoom-open');
      void this.$nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    onZoomNavigate(card: CardModel, index: number): void {
      this.zoomCard = card;
      this.zoomIndex = index;
    },
    toggleZoomSelection(): void {
      const name = this.zoomCard?.name as CardName | undefined;
      if (name === undefined) {
        return;
      }
      toggleGuaranteedCard(this.picks, name);
      if (this.view === 'picked') {
        this.pickedCursor = Math.min(this.pickedCursor, this.picked.length);
      }
    },
    requestZoomClose(): void {
      const modal = this.$refs.zoomModal as {close?: () => void} | undefined;
      if (modal?.close !== undefined) {
        modal.close();
      } else {
        this.closeZoom();
      }
    },
    closeZoom(): void {
      this.zoomCard = undefined;
      this.zoomList = undefined;
      document.body.classList.remove('con-zoom-open');
    },
  },
  beforeUnmount() {
    document.body.classList.remove('con-zoom-open');
  },
});
</script>
