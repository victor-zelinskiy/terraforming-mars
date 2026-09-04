<template>
  <div>
    <!-- ── My campaigns — one row per campaign (never per mission) ───────── -->
    <div class="cm-overlay" role="dialog" :aria-label="$t('My campaigns')">
      <div class="cm-overlay__card cm-overlay__card--wide">
        <div class="cm-overlay__head">
          <div class="cm-overlay__title">{{ $t('My campaigns') }}</div>
          <div class="cm-gametabs" role="tablist" :aria-label="$t('My campaigns')">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="cm-gametab"
              :class="{'cm-gametab--on': tab.id === ui.tab}"
              role="tab"
              :aria-selected="tab.id === ui.tab"
              @click="setTab(tab.id)"
            >
              <span>{{ $t(tab.label) }}</span>
              <span v-if="tab.count !== undefined" class="cm-gametab__count">{{ tab.count }}</span>
            </button>
            <span class="cm-gametabs__hint" aria-hidden="true"><GamepadGlyph control="stickL" /></span>
          </div>
        </div>
        <!-- The lobby's four answers, never one sentence for all of them:
             no name yet · still asking · asked and failed · asked and none. -->
        <div v-if="needName" class="cm-gamelist__empty">{{ $t('Set your player name to see your games') }}</div>
        <div v-else-if="firstLoad" class="cm-gamelist__empty">{{ $t('Loading') }}…</div>
        <div v-else-if="loadError" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not load your campaigns') }}</div>
        <div v-else-if="rows.length === 0" class="cm-gamelist__empty">{{ $t(emptyKey) }}</div>
        <ConsoleScrollArea v-else ref="scroll" class="cm-gamelist-scroll">
          <div class="cm-gamelist">
            <button
              v-for="(r, i) in rows"
              :key="r.summary.id"
              type="button"
              class="cm-game cm-camp"
              :class="{
                'cm-game--cursor': i === ui.cursor,
                'cm-camp--archived': isArchived(r.summary),
                'cm-game--disabled': r.stale,
                'cm-game--lan': r.hostLabel !== '',
              }"
              @click="openAt(i)"
              @mousemove="ui.cursor = i"
            >
              <div class="cm-game__head">
                <span class="cm-camp__fp" aria-hidden="true"><PremiumMapFingerprint :mapId="r.summary.currentBoard" variant="thumb" /></span>
                <span class="cm-game__name">{{ r.summary.name }}</span>
                <span class="cm-game__campaign">{{ $t('Campaign') }} · {{ progressLabel(r.summary) }}</span>
                <!-- A LAN campaign names its couch — the same language as game rows. -->
                <span v-if="r.hostLabel !== ''" class="cm-game__lanhost">{{ r.hostLabel }}</span>
                <span v-if="r.stale" class="cm-game__note">{{ $t('not responding') }}</span>
                <span v-else-if="actionRequired(r.summary)" class="cm-game__turn">{{ $t(stateLabel(r.summary)) }}</span>
                <span
                  v-else
                  class="cm-camp__state"
                  :class="{'cm-camp__state--abandoned': r.summary.state === 'abandoned', 'cm-camp__state--blocked': r.summary.state === 'blocked', 'cm-camp__state--ready': r.summary.state === 'launchReady'}"
                >{{ $t(stateLabel(r.summary)) }}</span>
              </div>

              <!-- The route rail: 1/4 → 4/4, done / current / future. -->
              <div class="cm-camp__rail" aria-hidden="true">
                <span v-for="(m, k) in slotMarks(r.summary)" :key="k" class="cm-camp__seg" :class="'cm-camp__seg--' + m"></span>
              </div>
              <div v-if="r.summary.state === 'blocked' && r.summary.blockedReason !== undefined" class="cm-camp__reason">{{ $t(r.summary.blockedReason) }}</div>

              <div class="cm-game__crew">
                <span
                  v-for="s in r.summary.seats"
                  :key="s.seat"
                  class="cm-game__player"
                  :class="{'cm-game__player--you': s.seat === r.summary.you.seat}"
                >
                  <span class="cm-game__pcube" :class="'player_bg_color_' + s.color" aria-hidden="true"></span>
                  <span class="cm-game__pname">{{ s.name }}</span>
                  <span v-if="isChampion(r.summary, s.seat)" class="cm-camp__crown" aria-hidden="true">♛</span>
                  <span v-if="s.seat === r.summary.you.seat" class="cm-game__ptag">{{ $t('You') }}</span>
                </span>
              </div>

              <div class="cm-game__foot">
                <span class="cm-game__meta">
                  <span class="cm-game__age">{{ updatedAgo(r.summary) }}</span>
                  <span class="cm-game__dot" aria-hidden="true">·</span>
                  <span>{{ boardLabel(r.summary) }}</span>
                  <template v-if="r.summary.yourTitlePoints > 0">
                    <span class="cm-game__dot" aria-hidden="true">·</span>
                    <span class="cm-camp__tp">{{ titlePointsLabel(r.summary) }}</span>
                  </template>
                </span>
              </div>
            </button>
          </div>
        </ConsoleScrollArea>
      </div>
    </div>

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
 * «МОИ КАМПАНИИ» — the console-native campaign list (a main-menu overlay
 * panel, the ConsoleProfilesEditor pattern: own markup, `handleIntent` driven
 * by the menu, `@close` back out).
 *
 * One row = ONE campaign (missions never appear as rows here — «Мои партии»
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
 */
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {CampaignSummaryModel} from '@/common/campaign/CampaignSummary';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {lobbyState, refreshLobby} from '@/client/components/mainMenu/lobbyState';
import {lobbyAge, lobbyAgeLabel} from '@/client/components/mainMenu/lobbyAge';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {
  campaignsState, refreshCampaigns, startCampaignsWatch, stopCampaignsWatch,
  deleteCampaignCascade, pinCampaignRow,
} from '@/client/console/campaign/campaignsState';
import {
  CampaignsTab, CampaignSourceRow, visibleCampaignSourceRows,
  activeCampaignRowCount, completedCampaignRowCount,
  campaignActionRequired, campaignStateLabelKey, campaignProgress, campaignSlotMarks,
  isArchivedCampaign, CampaignSlotMark,
} from '@/client/console/campaign/campaignListModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleCampaignsList',
  components: {ConsoleScrollArea, GamepadGlyph, PremiumMapFingerprint},
  emits: ['close'],
  data() {
    return {
      ui: campaignsState,
      identityState,
      lobbyState,
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
    this.applyPendingFocus();
  },
  beforeUnmount() {
    stopCampaignsWatch();
  },
  methods: {
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
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.ui.cursor = stepIndex(this.ui.cursor, intent.dir === 'down' ? 1 : -1, Math.max(1, this.rows.length));
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
        const scroll = this.$refs.scroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-game--cursor'));
      });
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
      navigateWithCurtain(paths.CAMPAIGN + '?id=' + encodeURIComponent(row.summary.id), 'sync');
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
    // ---- row presentation --------------------------------------------------
    isArchived(c: CampaignSummaryModel): boolean {
      return isArchivedCampaign(c);
    },
    actionRequired(c: CampaignSummaryModel): boolean {
      return campaignActionRequired(c);
    },
    stateLabel(c: CampaignSummaryModel): string {
      return campaignStateLabelKey(c);
    },
    progressLabel(c: CampaignSummaryModel): string {
      const p = campaignProgress(c);
      return p.params.length > 0 ? translateTextWithParams(p.key, p.params) : $t(p.key);
    },
    slotMarks(c: CampaignSummaryModel): ReadonlyArray<CampaignSlotMark> {
      return campaignSlotMarks(c);
    },
    isChampion(c: CampaignSummaryModel, seat: number): boolean {
      return c.championSeats?.includes(seat) === true;
    },
    boardLabel(c: CampaignSummaryModel): string {
      return $t(mapLabelKey(c.currentBoard));
    },
    /** Reads the lobby's ONE shared clock, so ages tick live like game rows. */
    updatedAgo(c: CampaignSummaryModel): string {
      return lobbyAgeLabel(lobbyAge(c.lastActivityMs, this.lobbyState.nowMs));
    },
    titlePointsLabel(c: CampaignSummaryModel): string {
      return translateTextWithParams('Title Points: ${0}', [String(c.yourTitlePoints)]);
    },
    missionGamesLine(c: CampaignSummaryModel): string {
      return translateTextWithParams('Mission games to delete: ${0}.', [String(c.missionGamesCount)]);
    },
  },
});
</script>
