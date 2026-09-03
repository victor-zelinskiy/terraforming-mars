<template>
  <div class="cmap" :class="{'cmap--reveal': revealPlaying, 'cmap--chronicle': vm !== undefined && vm.phase === 'finished', 'cmap--embedded': embedded}">
    <template v-if="!embedded">
      <div class="cm-menu__bg" aria-hidden="true"></div>
      <div class="cm-menu__vignette" aria-hidden="true"></div>
    </template>

    <!-- ── Loading / error states (full states, never a dead screen) ────── -->
    <div v-if="vm === undefined && state.status === 'loading'" class="cmap__load" v-i18n>Loading the campaign…</div>
    <div v-else-if="vm === undefined && state.status === 'error'" class="cmap__load cmap__load--error">
      <div v-i18n>Could not load the campaign. Please try again.</div>
      <button type="button" class="cmap__retry" @click="retry"><GamepadGlyph control="confirm" /><span v-i18n>Retry</span></button>
    </div>

    <template v-else-if="vm !== undefined">
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <header class="cmap__head">
        <div class="cmap__kicker" v-i18n>Campaign</div>
        <div class="cmap__title">{{ vm.name }}</div>
        <div class="cmap__progress">
          <span class="cmap__progress-label">{{ progressText }}</span>
          <span v-if="vm.phase === 'abandoned'" class="cmap__chip cmap__chip--muted" v-i18n>Campaign abandoned</span>
        </div>
      </header>

      <!-- ── The route stage: four mission cards on one connector ───────── -->
      <div class="cmap__stage">
        <div class="cmap__lane" aria-hidden="true">
          <div class="cmap__lane-fill" :style="laneFillStyle"></div>
        </div>
        <div class="cmap__route">
          <div
            v-for="m in vm.missions"
            :key="m.slot"
            class="cmap__node"
            :style="revealDelay(m.slot)"
          >
            <!-- The party marker travels the connector: it stands on the current node. -->
            <div v-if="m.isCurrent" class="cmap__party" aria-hidden="true">
              <span
                v-for="row in vm.rail"
                :key="row.seat"
                class="cmap__party-cube"
                :class="`player_bg_color_${row.color}`"
              ></span>
            </div>
            <button
              type="button"
              class="cmap__card"
              :class="{
                'cmap__card--cursor': cursor.zone === 'route' && cursor.index === m.slot,
                'cmap__card--done': m.state === 'committed',
                'cmap__card--current': m.isCurrent,
                'cmap__card--future': m.state === 'locked',
                'cmap__card--final': m.final,
              }"
              @click="onRouteClick(m.slot)"
            >
              <div v-if="m.final" class="cmap__final-banner" v-i18n>Finale</div>
              <div class="cmap__map">
                <PremiumMapFingerprint :map-id="m.board" variant="card" :accent="accentOf(m.board)" />
              </div>
              <div class="cmap__board-name">{{ $t(boardLabel(m.board)) }}</div>
              <div class="cmap__state" :class="`cmap__state--${m.state}`">
                <span v-i18n>{{ m.stateLabel }}</span>
              </div>
              <!-- Compact result strip: place-ordered cubes + earned title emblems. -->
              <div v-if="m.results !== undefined" class="cmap__results">
                <div v-for="row in m.results" :key="row.seat" class="cmap__result-row">
                  <span class="cmap__result-place">{{ row.place }}</span>
                  <span class="cmap__result-cube" :class="`player_bg_color_${row.color}`"></span>
                  <span class="cmap__result-name">{{ row.name }}</span>
                  <img
                    v-if="row.title !== undefined"
                    class="cmap__result-title"
                    :src="titleArtUrl(row.title)"
                    :alt="$t(titleLabel(row.title))"
                  />
                </div>
              </div>
              <div v-if="m.blockedReason !== undefined" class="cmap__blocked">
                <span v-i18n>{{ m.blockedReason }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- ── The progression rail: seats, titles, TP, bonuses, carryover ── -->
      <div class="cmap__rail">
        <div
          v-for="(row, i) in vm.rail"
          :key="row.seat"
          class="cmap__seat"
          :class="{'cmap__seat--cursor': cursor.zone === 'rail' && cursor.index === i, 'cmap__seat--champion': row.isChampion}"
          @click="cursor = {zone: 'rail', index: i}"
        >
          <span class="cmap__seat-cube" :class="`player_bg_color_${row.color}`"></span>
          <span class="cmap__seat-name">
            {{ row.name }}
            <span v-if="row.isYou" class="cmap__seat-you" v-i18n>you</span>
            <span v-if="row.isBot" class="cmap__seat-bot">MarsBot</span>
          </span>
          <span class="cmap__seat-titles">
            <img
              v-for="(t, ti) in row.titles"
              :key="ti"
              class="cmap__seat-title"
              :src="titleArtUrl(t.title)"
              :alt="$t(titleLabel(t.title))"
            />
          </span>
          <span class="cmap__seat-tp">{{ tpText(row.titlePoints) }}</span>
          <span v-if="row.pendingBonus > 0" class="cmap__seat-bonus">+{{ row.pendingBonus }} M€</span>
          <span v-if="row.carry !== undefined" class="cmap__seat-carry" :class="{'cmap__seat-carry--pending': row.carry.status === 'pending'}">
            <template v-if="row.carry.status === 'pending'"><span v-i18n>choosing projects…</span></template>
            <template v-else>{{ carryText(row.carry.count) }}</template>
          </span>
          <span v-if="row.isChampion" class="cmap__seat-crown" v-i18n>Campaign champion</span>
        </div>
        <div v-if="state.error !== '' && vm !== undefined" class="cmap__inline-error">{{ $t(state.error) }}</div>
      </div>

      <!-- ── Overlays (one at a time) ───────────────────────────────────── -->
      <div v-if="overlay?.kind === 'mission'" class="cm-overlay" role="dialog" :aria-label="$t('Mission dossier')">
        <div class="cm-overlay__card cmap__dossier">
          <div class="cm-overlay__title">
            {{ $t(boardLabel(vm.missions[overlay.slot].board)) }}
            <span class="cmap__dossier-sub">{{ missionOrdinal(overlay.slot) }}</span>
          </div>
          <div v-if="vm.missions[overlay.slot].results !== undefined" class="cmap__dossier-body">
            <div v-for="row in vm.missions[overlay.slot].results" :key="row.seat" class="cmap__dossier-row">
              <span class="cmap__result-place">{{ row.place }}</span>
              <span class="cmap__result-cube" :class="`player_bg_color_${row.color}`"></span>
              <span class="cmap__dossier-name">{{ row.name }}<span v-if="row.tied" class="cmap__dossier-tied" v-i18n>shared place</span></span>
              <span class="cmap__dossier-score">{{ row.score }} {{ $t('VP') }}</span>
              <img v-if="row.title !== undefined" class="cmap__dossier-title" :src="titleArtUrl(row.title)" :alt="$t(titleLabel(row.title))" />
            </div>
            <div class="cmap__dossier-gens">{{ generationsText(vm.missions[overlay.slot].generations ?? 0) }}</div>
          </div>
          <div v-else class="cmap__dossier-body">
            <div class="cmap__dossier-brief" v-i18n>The board is fixed by the campaign route. Everything else follows the frozen campaign settings.</div>
            <div v-if="vm.missions[overlay.slot].blockedReason !== undefined" class="cmap__blocked">
              <span v-i18n>{{ vm.missions[overlay.slot].blockedReason }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="overlay?.kind === 'dossier'" class="cm-overlay" role="dialog" :aria-label="$t('Campaign dossier')">
        <div class="cm-overlay__card cmap__dossier cmap__dossier--wide">
          <div class="cm-overlay__title" v-i18n>Campaign dossier</div>
          <div class="cmap__dossier-body">
            <div v-for="row in vm.rail" :key="row.seat" class="cmap__lineage">
              <div class="cmap__lineage-head">
                <span class="cmap__result-cube" :class="`player_bg_color_${row.color}`"></span>
                <span class="cmap__dossier-name">{{ row.name }}</span>
                <span class="cmap__seat-tp">{{ tpText(row.titlePoints) }}</span>
              </div>
              <div class="cmap__lineage-corps">
                <span v-if="lineageOf(row.seat).length === 0 && !row.isBot" class="cmap__lineage-none" v-i18n>No corporations acquired yet</span>
                <span v-else-if="row.isBot" class="cmap__lineage-none">{{ botCorpLabel }}</span>
                <span v-for="(corp, ci) in lineageOf(row.seat)" :key="corp" class="cmap__lineage-corp">
                  <span class="cmap__lineage-ord">{{ ci + 1 }}</span>{{ corp }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConsoleCarryoverPicker
        v-if="overlay?.kind === 'carryover'"
        ref="carryPicker"
        class="cm-overlay cmap__carry-overlay"
        :eligible="vm.yourEligibleCards"
        :selected="carryDraft"
        :confirmed="vm.carryoverConfirmed && !carryDirty"
        :submitting="state.submittingCarryover"
        :error="state.error"
        @toggle="toggleCarry($event)"
        @confirm="confirmCarry"
        @back="closeOverlay"
      />

      <div v-if="overlay?.kind === 'launch'" class="cm-overlay" role="dialog" :aria-label="$t('Launch the mission')">
        <div class="cm-overlay__card">
          <div class="cm-overlay__title">{{ launchTitle }}</div>
          <div class="cm-overlay__body" v-i18n>The carryover selections lock in and the mission game is created for every participant.</div>
          <div class="cm-confirm__pad">
            <button type="button" class="cm-confirm__btn" @click="doLaunch">
              <GamepadGlyph control="confirm" /><span v-i18n>Launch</span>
            </button>
            <button type="button" class="cm-confirm__btn" @click="closeOverlay">
              <GamepadGlyph control="back" /><span v-i18n>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Embedded (an endgame scene): the HOST owns the command bar. -->
    <ConsoleCommandBar v-if="!embedded" :context="commandContext" :commands="commands" />
  </div>
</template>

<script lang="ts">
/**
 * CAMPAIGN MAP («Кампания») — the standalone campaign screen: one generated
 * route of four missions, the party's position, titles/TP/bonuses, the
 * carryover door and the launch CTA. Console-native pre-game shell (the
 * menu/creator idiom: state-based pad navigation via installMenuPad, own
 * command bar, no DOM focus).
 *
 * State is ALWAYS the server model (campaignState) — reload lands settled;
 * the one presentation-only extra is the generation reveal, played once on
 * the creator's first arrival (sessionStorage latch, never server state).
 */
import {defineComponent} from 'vue';
import {vueRoot} from '@/client/components/vueRoot';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {paths} from '@/common/app/paths';
import {isCampaignId} from '@/common/Types';
import {CardName} from '@/common/cards/CardName';
import {BoardName} from '@/common/boards/BoardName';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import ConsoleCarryoverPicker from './ConsoleCarryoverPicker.vue';
import {mapMeta, mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {
  campaignState,
  launchCampaignMission,
  openCampaign,
  refreshCampaign,
  startCampaignWatch,
  stopCampaignWatch,
  submitCampaignCarryover,
} from '@/client/console/campaign/campaignState';
import {CampaignMapVm, buildCampaignMapVm} from '@/client/console/campaign/campaignMapModel';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

type MapOverlay =
  | {kind: 'mission', slot: number}
  | {kind: 'dossier'}
  | {kind: 'carryover'}
  | {kind: 'launch'};

const REVEAL_LATCH = 'tm_campaign_reveal';

export default defineComponent({
  name: 'ConsoleCampaignMap',
  components: {ConsoleCommandBar, GamepadGlyph, PremiumMapFingerprint, ConsoleCarryoverPicker},
  props: {
    /** Hosted as an endgame scene: no own bg/pad/command bar; the host routes
     *  intents into `handleIntent` and reads `commands` for its own bar. */
    embedded: {type: Boolean, required: false, default: false},
  },
  emits: ['close'],
  setup(props) {
    if (!props.embedded) {
      useConsoleNativeSurface();
    }
  },
  data() {
    return {
      state: campaignState,
      cursor: {zone: 'route' as 'route' | 'rail', index: 0},
      overlay: undefined as MapOverlay | undefined,
      revealPlaying: false,
      /** Local carryover draft — seeded from the server selection on open. */
      carryDraft: [] as Array<CardName>,
      carryDirty: false,
      offPad: undefined as (() => void) | undefined,
    };
  },
  computed: {
    vm(): CampaignMapVm | undefined {
      return this.state.model !== undefined ? buildCampaignMapVm(this.state.model) : undefined;
    },
    progressText(): string {
      const vm = this.vm;
      if (vm === undefined) {
        return '';
      }
      return translateTextWithParams(vm.progressLabel, [...vm.progressParams]);
    },
    botCorpLabel(): string {
      const id = this.state.model?.progression.botCorporation;
      if (id === undefined) {
        return $t('The corporation is chosen in mission 1 and kept for the whole campaign');
      }
      // The bot corp's display identity IS its human twin (`original`).
      return $t(marsBotCorpInfo(id).original);
    },
    launchTitle(): string {
      return translateTextWithParams('Launch mission ${0}?', [String((this.vm?.currentSlot ?? 0) + 1)]);
    },
    laneFillStyle(): Record<string, string> {
      const vm = this.vm;
      if (vm === undefined) {
        return {};
      }
      const done = vm.phase === 'finished' ? vm.missions.length : vm.currentSlot;
      // Solid behind the party, dashed ahead — state never carried by color alone.
      const pct = Math.min(100, (done / Math.max(1, vm.missions.length - 1)) * 100);
      return {width: `${pct}%`};
    },
    commandContext(): string {
      if (this.overlay?.kind === 'carryover') {
        return 'Project legacy';
      }
      if (this.overlay?.kind === 'mission') {
        return 'Mission dossier';
      }
      if (this.overlay?.kind === 'dossier') {
        return 'Campaign dossier';
      }
      return 'Campaign';
    },
    commands(): ReadonlyArray<ConsoleCommand> {
      const vm = this.vm;
      if (vm === undefined) {
        return [{control: 'confirm', label: 'Retry'}, {control: 'back', label: 'Main menu'}];
      }
      if (this.overlay?.kind === 'carryover') {
        const picker = this.$refs.carryPicker as {confirmLabel?: string} | undefined;
        return [
          {control: 'dpadH', label: 'Choose'},
          {control: 'confirm', label: 'Take / return'},
          {control: 'secondary', label: picker?.confirmLabel ?? 'Confirm selection', highlight: true},
          {control: 'back', label: 'Close'},
        ];
      }
      if (this.overlay !== undefined) {
        return [{control: 'back', label: 'Close'}];
      }
      const cmds: Array<ConsoleCommand> = [
        {control: 'dpad', label: 'Navigate'},
      ];
      const verb = this.routeVerb;
      if (verb !== undefined) {
        cmds.push({control: 'confirm', label: verb.label, enabled: verb.enabled});
      }
      cmds.push({control: 'secondary', label: 'Mission dossier'});
      cmds.push({control: 'inspect', label: 'Campaign dossier'});
      cmds.push({control: 'back', label: 'Main menu'});
      return cmds;
    },
    routeVerb(): {label: string, enabled: boolean} | undefined {
      const vm = this.vm;
      if (vm === undefined) {
        return undefined;
      }
      if (this.cursor.zone !== 'route') {
        return undefined;
      }
      const m = vm.missions[this.cursor.index];
      if (m === undefined) {
        return undefined;
      }
      if (m.state === 'active' && m.yourPlayerId !== undefined) {
        return {label: 'Enter the mission', enabled: true};
      }
      if (m.state === 'committed' && m.gameId !== undefined) {
        return {label: 'Open mission results', enabled: true};
      }
      if (m.state === 'ready' && m.isCurrent) {
        if (vm.cta.kind === 'carryover') {
          return {label: 'Choose projects to carry over', enabled: true};
        }
        if (vm.cta.kind === 'launch') {
          return {label: 'Launch the mission', enabled: vm.cta.enabled};
        }
        return {label: 'Waiting for the campaign creator to launch the mission', enabled: false};
      }
      return {label: 'Mission dossier', enabled: true};
    },
  },
  async mounted() {
    if (this.embedded) {
      // The HOST already opened the campaign (campaignState is module-level);
      // the scene lands settled on the campaign's current mission.
      this.cursor = {zone: 'route', index: this.vm?.currentSlot ?? 0};
      return;
    }
    setDocumentTitle('Campaign');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') ?? '';
    if (isCampaignId(id)) {
      // The generation reveal plays ONCE, on the creator's first arrival.
      try {
        if (window.sessionStorage.getItem(REVEAL_LATCH) === id && !consoleReducedMotionActive()) {
          this.revealPlaying = true;
          window.setTimeout(() => {
            this.revealPlaying = false;
          }, 2600);
        }
        window.sessionStorage.removeItem(REVEAL_LATCH);
      } catch {
        // Storage unavailable — land settled.
      }
      await openCampaign(id);
      startCampaignWatch();
      // Focus lands on the mission the campaign is at.
      this.cursor = {zone: 'route', index: this.vm?.currentSlot ?? 0};
    }
    this.offPad = installMenuPad((intent) => this.onIntent(intent));
  },
  beforeUnmount() {
    this.offPad?.();
    if (!this.embedded) {
      stopCampaignWatch();
    }
  },
  methods: {
    titleArtUrl,
    /** Hosted mode: the host routes pad intents here. */
    handleIntent(intent: GamepadIntent): boolean {
      return this.onIntent(intent);
    },
    boardLabel(board: BoardName): string {
      return mapLabelKey(board);
    },
    accentOf(board: BoardName): string {
      return mapMeta(board).accent;
    },
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
    tpText(points: number): string {
      return translateTextWithParams('${0} TP', [String(points)]);
    },
    missionOrdinal(slot: number): string {
      return translateTextWithParams('Mission ${0}', [String(slot + 1)]);
    },
    generationsText(generations: number): string {
      return translateTextWithParams('Generations: ${0}', [String(generations)]);
    },
    carryText(count: number): string {
      return translateTextWithParams('carrying ${0}', [String(count)]);
    },
    lineageOf(seat: number): ReadonlyArray<CardName> {
      return this.state.model?.progression.lineages[seat] ?? [];
    },
    revealDelay(slot: number): Record<string, string> {
      return this.revealPlaying ? {'--cmap-reveal-delay': `${420 + slot * 300}ms`} : {};
    },
    retry(): void {
      void refreshCampaign();
    },
    closeOverlay(): void {
      // B never silently confirms or discards — the draft simply closes; the
      // server keeps whatever was last CONFIRMED.
      this.overlay = undefined;
      this.carryDirty = false;
    },
    // ── Input routing ────────────────────────────────────────────────────
    onIntent(intent: GamepadIntent): boolean {
      if (this.state.launching) {
        return true;
      }
      const vm = this.vm;
      if (vm === undefined) {
        const action = consoleActionOf(intent, {});
        if (action === 'primary') {
          this.retry();
        } else if (action === 'back') {
          this.leaveMap();
        }
        return true;
      }
      if (this.overlay?.kind === 'carryover') {
        const picker = this.$refs.carryPicker as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        picker?.handleIntent?.(intent);
        return true;
      }
      if (this.overlay?.kind === 'launch') {
        const action = consoleActionOf(intent, {});
        if (action === 'primary') {
          this.doLaunch();
        } else if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (this.overlay !== undefined) {
        const action = consoleActionOf(intent, {});
        if (action === 'back' || action === 'primary') {
          this.closeOverlay();
        }
        return true;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return true;
      }
      const action = consoleActionOf(intent, {});
      switch (action) {
      case 'primary':
        this.activateCursor();
        return true;
      case 'inspect':
        // X — the current object's dossier.
        this.openMissionDossier(this.cursor.zone === 'route' ? this.cursor.index : vm.currentSlot);
        return true;
      case 'fullscreen':
        // Y — the campaign dossier (lineages + the TP ledger).
        this.overlay = {kind: 'dossier'};
        return true;
      case 'back':
        this.leaveMap();
        return true;
      default:
        return true;
      }
    },
    /** Root B: standalone → the main menu; embedded → the host takes back. */
    leaveMap(): void {
      if (this.embedded) {
        this.$emit('close');
      } else {
        // Typed emits narrow `this` off ComponentPublicInstance — vueRoot only
        // walks $parent, so the widening cast is safe.
        vueRoot(this as unknown as Parameters<typeof vueRoot>[0]).navigateInApp('/');
      }
    },
    onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      const vm = this.vm;
      if (vm === undefined) {
        return;
      }
      if (this.cursor.zone === 'route') {
        if (dir === 'left' && this.cursor.index > 0) {
          this.cursor = {zone: 'route', index: this.cursor.index - 1};
        } else if (dir === 'right' && this.cursor.index < vm.missions.length - 1) {
          this.cursor = {zone: 'route', index: this.cursor.index + 1};
        } else if (dir === 'down' && vm.rail.length > 0) {
          this.cursor = {zone: 'rail', index: 0};
        }
      } else {
        if (dir === 'up') {
          if (this.cursor.index > 0) {
            this.cursor = {zone: 'rail', index: this.cursor.index - 1};
          } else {
            this.cursor = {zone: 'route', index: vm.currentSlot};
          }
        } else if (dir === 'down' && this.cursor.index < vm.rail.length - 1) {
          this.cursor = {zone: 'rail', index: this.cursor.index + 1};
        }
      }
    },
    onRouteClick(slot: number): void {
      this.cursor = {zone: 'route', index: slot};
      this.activateCursor();
    },
    activateCursor(): void {
      const vm = this.vm;
      if (vm === undefined) {
        return;
      }
      if (this.cursor.zone === 'rail') {
        this.overlay = {kind: 'dossier'};
        return;
      }
      const m = vm.missions[this.cursor.index];
      if (m === undefined) {
        return;
      }
      if (m.state === 'active' && m.yourPlayerId !== undefined) {
        recordLastGameEntered(m.gameId ?? '');
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(m.yourPlayerId), 'expedition');
        return;
      }
      if (m.state === 'committed' && m.yourPlayerId !== undefined) {
        // Open the settled mission endgame (the archive re-entry semantics).
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(m.yourPlayerId), 'sync');
        return;
      }
      if (m.state === 'ready' && m.isCurrent) {
        if (vm.cta.kind === 'carryover') {
          this.openCarryover();
          return;
        }
        if (vm.cta.kind === 'launch' && vm.cta.enabled) {
          this.overlay = {kind: 'launch'};
          return;
        }
      }
      this.openMissionDossier(m.slot);
    },
    openMissionDossier(slot: number): void {
      this.overlay = {kind: 'mission', slot};
    },
    // ── Carryover ────────────────────────────────────────────────────────
    openCarryover(): void {
      this.carryDraft = [...(this.vm?.yourCarryCards ?? [])];
      this.carryDirty = false;
      this.overlay = {kind: 'carryover'};
    },
    toggleCarry(name: CardName): void {
      const idx = this.carryDraft.indexOf(name);
      if (idx >= 0) {
        this.carryDraft.splice(idx, 1);
      } else if (this.carryDraft.length < 2) {
        this.carryDraft.push(name);
      }
      this.carryDirty = true;
    },
    async confirmCarry(): Promise<void> {
      const vm = this.vm;
      const model = this.state.model;
      if (vm === undefined || model === undefined || vm.youSeat === undefined) {
        return;
      }
      const source = model.missions[model.carryover?.sourceSlot ?? -1];
      const playerId = source?.yourPlayerId;
      if (playerId === undefined) {
        return;
      }
      const ok = await submitCampaignCarryover(playerId, this.carryDraft);
      if (ok) {
        this.carryDirty = false;
        this.overlay = undefined;
      }
    },
    // ── Launch ───────────────────────────────────────────────────────────
    async doLaunch(): Promise<void> {
      const result = await launchCampaignMission();
      this.overlay = undefined;
      if (result?.yourPlayerId !== undefined) {
        recordLastGameEntered(result.gameId);
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(result.yourPlayerId), 'expedition');
      }
    },
  },
});
</script>
