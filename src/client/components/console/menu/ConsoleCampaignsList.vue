<template>
  <div>
    <!-- ── My campaigns — one CARD per campaign (never per mission), on the pregame screen chassis (TR68) ── -->
    <ConsoleLobbyScreen
      ref="screen"
      kind="campaigns"
      title-key="My campaigns"
      :tabs="tabs"
      :tab="ui.tab"
      :state="screenState"
      :state-key="stateKey"
      :state-hint-key="stateHintKey"
      :refreshing="ui.refreshing"
      :items="rows.length"
      @tab="setTab($event)"
      @grid="cols = $event"
    >
      <ConsoleLobbyCard
        v-for="(r, i) in rows"
        :key="r.summary.id"
        :view="cardView(r)"
        :cursor="i === ui.cursor"
        :age="createdAgo(r.summary)"
        :reveal="true"
        :reveal-delay-ms="140 + i * 60"
        @activate="openAt(i)"
        @hover="ui.cursor = i"
      />
    </ConsoleLobbyScreen>

    <!-- ── Cascade-delete confirm (creator only; stacked over the list) ──── -->
    <div v-if="confirmRow !== undefined" class="cm-overlay cm-overlay--nested" role="alertdialog" :aria-label="$t('Delete this campaign?')">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t('Delete this campaign?') }}</div>
        <div class="cm-overlay__body">
          <b>{{ confirmRow.summary.name }}</b> — <template v-if="isArchived(confirmRow.summary)">{{ $t(stateLabel(confirmRow.summary)) }}</template><template v-else>{{ progressLabel(confirmRow.summary) }}</template>
        </div>
        <!-- An ACTIVE campaign gets the louder warning — calm, not hysterical. -->
        <div v-if="!isArchived(confirmRow.summary)" class="cm-overlay__body cm-camp__warn">{{ $t('This campaign is still in progress.') }}</div>
        <div class="cm-overlay__body">
          {{ missionGamesLine(confirmRow.summary) }}
          {{ $t('The campaign, its route and all of its mission games will be permanently deleted.') }}
          {{ $t('Progress, results and titles will be lost. This cannot be undone.') }}
        </div>
        <div v-if="ui.deleteError !== ''" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t(ui.deleteError) }}</div>
        <div class="cm-confirm__pad">
          <button type="button" class="cm-confirm__btn cm-confirm__btn--danger" :disabled="ui.deleting" @click="executeDelete">
            <GamepadGlyph control="confirm" /><span>{{ $t('Delete') }}</span>
          </button>
          <button type="button" class="cm-confirm__btn" @click="cancelConfirm">
            <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * «МОИ КАМПАНИИ» — the console-native campaign list: a pregame SCREEN on the
 * showcase chassis (`ConsoleLobbyScreen` + `ConsoleLobbyCard`, TR68 —
 * docs/claude/console/pregame-showcase.md), never a dialog; `handleIntent`
 * driven by the menu, `@close` back out (the menu plays the fold).
 *
 * One card = ONE campaign (missions never appear as rows here — «Мои партии»
 * is the per-mission door), across EVERY source: the app's own server plus
 * the LAN hosts the lobby model has verified (a guest sees the campaign they
 * were seated into on another couch, marked with its host's name). A opens
 * the existing Campaign Map — a LAN row first PINS its campaign id to the
 * host's endpoint, so the map, its poll and the carryover submit all land on
 * the right server. X (creator only — the server decides again) starts the
 * cascade-delete confirm; L3 toggles active/completed; RT is the manual
 * refresh. UI state (tab / cursor / confirm) lives in the module store
 * `campaignsState`, so the menu's command bar reads it reactively and a
 * return from the map restores the exact tab + row.
 *
 * ORDER = the lobby's rule: strictly by creation time, newest first, and each
 * row says how long ago its campaign was CREATED — on the lobby's ONE clock,
 * which this screen hands its rows to (`setLobbyAgeRows`).
 */
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {CampaignSummaryModel} from '@/common/campaign/CampaignSummary';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleLobbyScreen, {LobbyScreenState} from '@/client/components/console/menu/ConsoleLobbyScreen.vue';
import ConsoleLobbyCard from '@/client/components/console/menu/ConsoleLobbyCard.vue';
import {LobbyCardView, campaignCardView, showcaseStep} from '@/client/console/menu/lobbyCardModel';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {lobbyState, refreshLobby, setLobbyAgeRows} from '@/client/components/mainMenu/lobbyState';
import {lobbyAge, lobbyAgeLabel} from '@/client/components/mainMenu/lobbyAge';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {
  campaignsState, refreshCampaigns, startCampaignsWatch, stopCampaignsWatch,
  deleteCampaignCascade, pinCampaignRow,
} from '@/client/console/campaign/campaignsState';
import {
  CampaignsTab, CampaignSourceRow, visibleCampaignSourceRows,
  activeCampaignRowCount, completedCampaignRowCount,
  campaignStateLabelKey, campaignProgress, isArchivedCampaign,
} from '@/client/console/campaign/campaignListModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

/** This screen's key among the rows the lobby's age clock ticks for. */
const AGE_CLOCK_CONSUMER = 'campaigns';

export default defineComponent({
  name: 'ConsoleCampaignsList',
  components: {GamepadGlyph, ConsoleLobbyScreen, ConsoleLobbyCard},
  emits: ['close'],
  data() {
    return {
      ui: campaignsState,
      identityState,
      lobbyState,
      /** The showcase grid's column count (the screen measures it). */
      cols: 3,
    };
  },
  computed: {
    identityName(): string {
      return this.identityState.identity?.displayName ?? '';
    },
    needName(): boolean {
      return this.identityName === '';
    },
    firstLoad(): boolean {
      return this.ui.status === 'loading' || this.ui.status === 'idle';
    },
    loadError(): boolean {
      return this.ui.status === 'error';
    },
    /** The shown slice, sorted (the one list the cursor walks). */
    rows(): ReadonlyArray<CampaignSourceRow> {
      return visibleCampaignSourceRows(this.ui.rows, this.ui.tab);
    },
    tabs(): ReadonlyArray<{id: CampaignsTab, label: string, count: number | undefined}> {
      const loaded = this.ui.status === 'ok';
      return [
        {id: 'active', label: 'Active campaigns', count: loaded ? activeCampaignRowCount(this.ui.rows) : undefined},
        {id: 'completed', label: 'Completed campaigns', count: loaded ? completedCampaignRowCount(this.ui.rows) : undefined},
      ];
    },
    /** The lobby's four honest answers on the stage (no name · still asking · failed · none). */
    screenState(): LobbyScreenState {
      if (this.needName) {
        return 'need-name';
      }
      if (this.firstLoad) {
        return 'loading';
      }
      if (this.loadError) {
        return 'error';
      }
      return this.rows.length === 0 ? 'empty' : 'list';
    },
    stateKey(): string {
      switch (this.screenState) {
      case 'need-name': return 'Set your player name to see your games';
      case 'loading': return 'Loading';
      case 'error': return 'Could not load your campaigns';
      case 'empty': return this.emptyKey;
      default: return '';
      }
    },
    stateHintKey(): string {
      switch (this.screenState) {
      case 'need-name': return 'Your games are found by your player name — set it in the player profile';
      case 'error': return 'Refresh';
      default: return '';
      }
    },
    emptyKey(): string {
      return this.ui.tab === 'completed' ?
        'You have no completed campaigns yet.' :
        'You have no active campaigns yet. Assemble one in the New game screen.';
    },
    confirmRow(): CampaignSourceRow | undefined {
      const id = this.ui.confirmId;
      if (id === undefined) {
        return undefined;
      }
      return this.ui.rows.find((r) => r.summary.id === id);
    },
    /** Key of the CURRENT slice — the focus-restore watcher re-runs on it. */
    rowsKey(): string {
      return this.ui.status + '|' + this.ui.tab + '|' + this.rows.map((r) => r.summary.id).join(',');
    },
  },
  watch: {
    /** The identity is an INPUT that can arrive late — reload for the new name. */
    identityName(): void {
      void refreshCampaigns();
    },
    rowsKey(): void {
      this.shareAgeRows();
      this.applyPendingFocus();
      // A refresh that removed rows must not leave the cursor past the end.
      if (this.ui.cursor > 0 && this.ui.cursor >= this.rows.length) {
        this.ui.cursor = Math.max(0, this.rows.length - 1);
      }
      // A confirm standing over a row that vanished (realtime removal) closes.
      if (this.ui.confirmId !== undefined && this.confirmRow === undefined && !this.ui.deleting) {
        this.cancelConfirm();
      }
    },
  },
  mounted() {
    // Entering the screen is an unconditional refresh, every time.
    void refreshCampaigns();
    startCampaignsWatch();
    // The store may already hold rows (the menu plate's badge loaded them), in
    // which case no rowsKey change is coming to hand them to the clock.
    this.shareAgeRows();
    this.applyPendingFocus();
  },
  beforeUnmount() {
    stopCampaignsWatch();
    setLobbyAgeRows(AGE_CLOCK_CONSUMER, []);
  },
  methods: {
    /** The ages tick on the lobby's shared clock — at the cadence the freshest
     *  row on THIS screen needs, so a campaign created seconds ago counts up. */
    shareAgeRows(): void {
      setLobbyAgeRows(AGE_CLOCK_CONSUMER, this.rows.map((r) => r.summary.createdTimeMs));
    },
    /** Return-from-map restore: focus the remembered campaign once rows exist. */
    applyPendingFocus(): void {
      const id = this.ui.pendingFocusId;
      if (id === undefined || this.ui.status !== 'ok') {
        return;
      }
      this.ui.pendingFocusId = undefined;
      const idx = this.rows.findIndex((r) => r.summary.id === id);
      if (idx >= 0) {
        this.ui.cursor = idx;
      }
      this.keepCursorVisible();
    },
    handleIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      // The delete confirm swallows everything but confirm/cancel — key
      // repeat, a held A from the previous screen and stale focus included.
      if (this.ui.confirmId !== undefined) {
        if (action === 'primary') {
          void this.executeDelete();
        } else if (action === 'back') {
          this.cancelConfirm();
        }
        return true;
      }
      if (intent.kind === 'nav') {
        // The showcase is a GRID: ◀ ▶ walk the ring, ▲ ▼ a row (`showcaseStep`).
        this.ui.cursor = showcaseStep(this.ui.cursor, intent.dir, Math.max(1, this.rows.length), this.cols);
        this.keepCursorVisible();
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'stickL') {
        this.setTab(this.ui.tab === 'completed' ? 'active' : 'completed');
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'triggerR') {
        // RT re-asks every source in one sweep — the lobby first (it owns the
        // LAN endpoints), then the campaigns fetch rides its completion; the
        // direct call covers the local half immediately.
        void refreshLobby();
        void refreshCampaigns();
        return true;
      }
      if (action === 'primary') {
        this.openAt(this.ui.cursor);
        return true;
      }
      if (action === 'inspect') {
        // X — cascade delete (creator only; the server enforces it again).
        this.requestDelete();
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      // No Y verb here BY DESIGN: «удалить все кампании» is not offered.
      return true;
    },
    keepCursorVisible(): void {
      void this.$nextTick(() => {
        const screen = this.$refs.screen as {ensureVisible?: (el: Element | null) => void} | undefined;
        screen?.ensureVisible?.(this.$el.querySelector('.cm-game--cursor'));
      });
    },
    /** One campaign as a card (the pure model). */
    cardView(r: CampaignSourceRow): LobbyCardView {
      return campaignCardView(r);
    },
    setTab(tab: CampaignsTab): void {
      if (this.ui.tab === tab) {
        return;
      }
      this.ui.tab = tab;
      this.ui.cursor = 0;
      this.ui.confirmId = undefined;
      this.ui.deleteError = '';
      this.keepCursorVisible();
    },
    /** A — the existing Campaign Map is THE door; missions live one press deeper.
     *  A LAN row pins its campaign id to the host's endpoint first, so every
     *  request the map makes lands on the server the campaign lives on. */
    openAt(i: number): void {
      this.ui.cursor = i;
      const row = this.rows[i];
      if (row === undefined || row.stale) {
        return; // A quiet host's row stays listed but is not entered.
      }
      pinCampaignRow(row);
      navigateWithCurtain(paths.CAMPAIGN + '?id=' + encodeURIComponent(row.summary.id), 'sync', {kind: 'campaign-map'});
    },
    requestDelete(): void {
      const row = this.rows[this.ui.cursor];
      if (row === undefined || !row.summary.isCreator || row.stale) {
        return; // The bar already shows the verb disabled for a non-creator.
      }
      this.ui.deleteError = '';
      this.ui.confirmId = row.summary.id;
    },
    cancelConfirm(): void {
      this.ui.confirmId = undefined;
      this.ui.deleteError = '';
      // The cursor was never moved — focus returns to the original row.
    },
    async executeDelete(): Promise<void> {
      const id = this.ui.confirmId;
      if (id === undefined || this.ui.deleting) {
        return;
      }
      const ok = await deleteCampaignCascade(id);
      if (!ok) {
        return; // The error renders inside the confirm; B cancels out.
      }
      this.ui.confirmId = undefined;
      // The mission games are gone too — «Мои партии» must not keep ghosts.
      void refreshLobby({archive: true});
      void this.$nextTick(() => {
        this.ui.cursor = Math.min(this.ui.cursor, Math.max(0, this.rows.length - 1));
        this.keepCursorVisible();
      });
    },
    // ---- the confirm's presentation (the card reads `lobbyCardModel`) -------
    isArchived(c: CampaignSummaryModel): boolean {
      return isArchivedCampaign(c);
    },
    stateLabel(c: CampaignSummaryModel): string {
      return campaignStateLabelKey(c);
    },
    progressLabel(c: CampaignSummaryModel): string {
      const p = campaignProgress(c);
      return p.params.length > 0 ? translateTextWithParams(p.key, p.params) : $t(p.key);
    },
    /** How long ago the campaign was CREATED — the very key the rows are sorted
     *  by, so the order reads off the labels. The lobby's ONE shared clock. */
    createdAgo(c: CampaignSummaryModel): string {
      return lobbyAgeLabel(lobbyAge(c.createdTimeMs, this.lobbyState.nowMs));
    },
    missionGamesLine(c: CampaignSummaryModel): string {
      return translateTextWithParams('Mission games to delete: ${0}.', [String(c.missionGamesCount)]);
    },
  },
});
</script>
