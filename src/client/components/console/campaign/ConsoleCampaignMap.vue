<template>
  <div class="cmap" :class="{'cmap--reveal': revealPlaying, 'cmap--chronicle': vm !== undefined && vm.phase === 'finished', 'cmap--embedded': embedded, 'cmap--carry-open': overlay?.kind === 'carryover'}">
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
            v-for="{m, ov} in routeNodes"
            :key="m.slot"
            class="cmap__node"
            :class="{'cmap__node--finalparty': m.isCurrent && m.final}"
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
            <!-- The SHARED mission card (CampaignMissionCard — the same
                 component the in-game Information overview renders): real
                 board geometry, state dressing, the compact podium. The
                 button is a bare hit/cursor wrapper; the card paints. -->
            <button
              type="button"
              class="cmap__card"
              :class="{
                'cmap__card--cursor': cursor.zone === 'route' && cursor.index === m.slot,
                'cmap__card--done': m.state === 'committed',
                'cmap__card--current': m.isCurrent,
                'cmap__card--future': m.state === 'locked',
                'cmap__card--final': m.final,
                'cmap__card--waitfocus': m.isCurrent && waitStrip !== undefined,
              }"
              @click="onRouteClick(m.slot)"
            >
              <CampaignMissionCard
                :mission="ov"
                :cursor="cursor.zone === 'route' && cursor.index === m.slot"
                :reveal="true"
                :reveal-delay-ms="revealPlaying ? 420 + m.slot * 300 : 80 + m.slot * 70" />
              <div v-if="m.blockedReason !== undefined" class="cmap__blocked">
                <span v-i18n>{{ m.blockedReason }}</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      <!-- ── The progression rail: seats, titles, TP, bonuses, carryover ──
           …and during the interlude it IS the waiting zone: the per-seat
           readiness chips live on these very rows (everyone tracks who is
           ready in the one player zone they already read), and the WAIT
           STRIP above them states the screen's own promise — the ready
           player is FIXED here, and the auto-join into the next mission
           happens from this screen only. -->
      <div class="cmap__rail">
        <div v-if="waitStrip !== undefined" class="cmap__wait-strip" :class="{'cmap__wait-strip--ready': waitStrip.ready}">
          <span class="cmap__wait-spin" aria-hidden="true"></span>
          <span class="cmap__wait-title" v-i18n>{{ waitStrip.title }}</span>
          <span class="cmap__wait-note" v-i18n>{{ waitStrip.note }}</span>
        </div>
        <div
          v-for="(row, i) in vm.rail"
          :key="row.seat"
          class="cmap__seat"
          :class="{'cmap__seat--cursor': cursor.zone === 'rail' && cursor.index === i, 'cmap__seat--champion': row.isChampion}"
          @click="cursor = {zone: 'rail', index: i}"
        >
          <span class="cmap__seat-cube" :class="`player_bg_color_${row.color}`"></span>
          <span class="cmap__seat-name">
            <span class="cmap__seat-label">{{ seatRowName(row) }}</span>
            <span v-if="row.isYou" class="cmap__seat-you" v-i18n>you</span>
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
          <!-- The corporation LINEAGE lives on the row itself (the old
               campaign-dossier modal, folded onto the screen). -->
          <span class="cmap__seat-corps">
            <template v-if="row.isBot">
              <span v-if="botLineageLabel !== ''" class="cmap__seat-corp"><span class="cmap__seat-corp-ord">1</span>{{ botLineageLabel }}</span>
            </template>
            <template v-else>
              <span v-for="(corp, ci) in row.lineage" :key="corp" class="cmap__seat-corp">
                <span class="cmap__seat-corp-ord">{{ ci + 1 }}</span>{{ $t(corp) }}
              </span>
            </template>
          </span>
          <span v-if="row.pendingBonus > 0" class="cmap__seat-bonus">+{{ row.pendingBonus }} M€</span>
          <span v-if="row.carry !== undefined && row.carry.status === 'confirmed'" class="cmap__seat-carry">
            {{ carryText(row.carry.count) }}
          </span>
          <!-- The readiness chip — the interlude's «кто готов» lives on the
               seat row itself; the pending text folds into the chip. -->
          <span v-if="row.readiness !== undefined" class="cmap__seat-status" :class="`cmap__seat-status--${row.readiness}`">
            <span v-i18n>{{ waitStatusLabel(row.readiness) }}</span>
          </span>
          <span v-else-if="row.carry !== undefined && row.carry.status === 'pending'" class="cmap__seat-carry cmap__seat-carry--pending">
            <span v-i18n>choosing projects…</span>
          </span>
          <span v-if="row.isChampion" class="cmap__seat-crown" v-i18n>Campaign champion</span>
        </div>
        <div class="cmap__rail-note">{{ $t('TP') }} — {{ $t(tpNote) }}</div>
        <div v-if="state.error !== '' && vm !== undefined" class="cmap__inline-error">{{ $t(state.error) }}</div>
      </div>

      <!-- ── Overlays (one at a time). «Осмотр миссии» — X on ANY route
           card: the SHARED inspect body (CampaignMissionInspect, the same
           component the in-game overview renders) — the enlarged real
           board is the hero, the detail half is honest to the state
           (results + outgoing legacy for a committed mission, the known
           features for a future one). X inside inspects the viewer's own
           carried cards through the ONE zoom module. -->
      <div v-if="overlay?.kind === 'mission' && inspectMission !== undefined" class="cm-overlay" role="dialog" :aria-label="$t('Mission dossier')">
        <div class="cm-overlay__card cmap__dossier cmap__dossier--mission" :class="{'cmap__dossier--results': inspectMission.state === 'committed'}">
          <div class="cm-overlay__title">
            {{ missionOrdinal(inspectMission.slot) }}
          </div>
          <CampaignMissionInspect
            :mission="inspectMission"
            :details="dossierDetails"
            :you-seat="state.model?.you?.seat"
            :bot-corporation="state.model?.progression.botCorporation"
            :mission-count="vm.missions.length" />
        </div>
      </div>

      <!-- «Наследие участника» — the SHARED seat-legacy body (the same
           component as the in-game overview): the composition with its
           mission-of-origin badges, the start bonus with an honest status,
           the carried projects (view-only faces) and the title ledger.
           A opens it from the seat row; X inspects the focused card. -->
      <div v-if="overlay?.kind === 'legacy' && legacyVm !== undefined" class="cm-overlay" role="dialog" :aria-label="$t('Legacy')">
        <div class="cm-overlay__card cmap__dossier cmap__dossier--legacy">
          <div class="cm-overlay__title">
            <span class="cmap__legcube" :class="`player_bg_color_${legacyVm.color}`"></span>
            {{ seatRowName({name: legacyVm.name, isBot: legacyVm.kind === 'bot'}) }}
            <span class="cmap__dossier-sub" v-i18n>Legacy</span>
          </div>
          <CampaignSeatLegacy :legacy="legacyVm" :cursor-index="legacyCards.length > 0 ? legacyCursor : undefined" />
        </div>
      </div>

      <!-- The mandatory carryover STEP — the map's central stage one level
           deeper (the map's own content releases in place under it); the
           ENTER is the picker's internal cascade, the LEAVE is this
           transition's short fold. -->
      <Transition name="cm-carry">
        <ConsoleCarryoverPicker
          v-if="overlay?.kind === 'carryover'"
          ref="carryPicker"
          class="cmap__carry-overlay"
          :eligible="vm.yourEligibleCards"
          :selected="carryDraft"
          :confirmed="vm.carryoverConfirmed && !carryDirty"
          :submitting="state.submittingCarryover"
          :error="state.error"
          @toggle="toggleCarry($event)"
          @confirm="confirmCarry"
          @back="closeOverlay"
          @arm-change="carryArmed = $event"
        />
      </Transition>

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
import {TitleName} from '@/common/campaign/CampaignTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {TransitionContext, armSceneDestination, deferSceneReveal, loadingScreenState, navigateWithCurtain, onSceneRevealed} from '@/client/console/loadingScreenState';
import {recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import {currentServerEndpoint} from '@/client/utils/runtimeConfig';
import {pinServerEndpoint} from '@/client/utils/serverEndpoints';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCarryoverPicker from './ConsoleCarryoverPicker.vue';
import CampaignMissionCard from './CampaignMissionCard.vue';
import CampaignMissionInspect from './CampaignMissionInspect.vue';
import CampaignSeatLegacy from './CampaignSeatLegacy.vue';
import {CardModel} from '@/common/models/CardModel';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {
  CampaignOverviewVm,
  MissionDetailsVm,
  OverviewMissionCard,
  SeatLegacyVm,
  buildCampaignOverview,
  buildMissionDetails,
  buildSeatLegacy,
  tpStatusLabel,
} from '@/client/console/campaign/campaignOverviewModel';
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
import {campaignMapUi, resetCampaignMapUi} from '@/client/console/campaign/campaignMapUi';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

type MapOverlay =
  | {kind: 'mission', slot: number}
  | {kind: 'legacy', seat: number}
  | {kind: 'carryover'};

const REVEAL_LATCH = 'tm_campaign_reveal';

export default defineComponent({
  name: 'ConsoleCampaignMap',
  components: {ConsoleCommandBar, GamepadGlyph, ConsoleCarryoverPicker, CampaignMissionCard, CampaignMissionInspect, CampaignSeatLegacy},
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
      /** The picker's ARMED zero-carry confirm (mirrored up for the bar). */
      carryArmed: false,
      /**
       * The interlude flow's mandatory step opens ITSELF once per visit —
       * arriving with an unresolved carryover door lands the player straight
       * in the picker (skippable inside; B returns to the map and the CTA
       * re-opens it). The latch keeps a deliberate B honest.
       */
      carryAutoOpened: false,
      /**
       * AUTO-JOIN armed: the viewer reached the READY waiting state on this
       * surface. When the current slot flips to `active` with a seat link
       * (the launch push), the client enters the mission by itself.
       */
      autoJoinArmed: false,
      /** A join navigation is in flight — absorbs duplicates. */
      joining: false,
      /** Cursor over the legacy overlay's inspectable cards. */
      legacyCursor: 0,
      offPad: undefined as (() => void) | undefined,
    };
  },
  computed: {
    vm(): CampaignMapVm | undefined {
      return this.state.model !== undefined ? buildCampaignMapVm(this.state.model) : undefined;
    },
    /** The SHARED overview projection — mission cards, provenance, TP
     *  semantics (one model with the in-game Information overview). */
    overviewVm(): CampaignOverviewVm | undefined {
      return this.state.model !== undefined ? buildCampaignOverview(this.state.model) : undefined;
    },
    /** The route nodes pair the map vm (CTA/party/blockers) with the shared
     *  overview card (the painted mission card). Both derive from ONE model,
     *  so the slots align by construction. */
    routeNodes(): ReadonlyArray<{m: CampaignMapVm['missions'][number], ov: OverviewMissionCard}> {
      const vm = this.vm;
      const overview = this.overviewVm;
      if (vm === undefined || overview === undefined) {
        return [];
      }
      return vm.missions.map((m) => ({m, ov: overview.missions[m.slot]}));
    },
    /** The one TP semantics note of this campaign frame (shared wording). */
    tpNote(): string {
      const overview = this.overviewVm;
      if (overview === undefined || overview.seats.length === 0) {
        return '';
      }
      return tpStatusLabel(overview.seats[0].tpStatus);
    },
    /** The OPEN mission-inspect overlay's card (any state). */
    inspectMission(): OverviewMissionCard | undefined {
      if (this.overlay?.kind !== 'mission') {
        return undefined;
      }
      return this.overviewVm?.missions[this.overlay.slot];
    },
    /** The committed results of the open inspect (undefined for a future
     *  mission — the inspect body then presents the known features). */
    dossierDetails(): MissionDetailsVm | undefined {
      if (this.overlay?.kind !== 'mission' || this.state.model === undefined) {
        return undefined;
      }
      return buildMissionDetails(this.state.model, this.overlay.slot);
    },
    /** The viewer's own carried-out cards of the open dossier (X inspects). */
    dossierCards(): ReadonlyArray<CardModel> {
      return (this.dossierDetails?.outgoing?.carried.yourCards ?? []).map((name) => ({name} as CardModel));
    },
    /** «Наследие» of the OPEN seat overlay (shared body; the map's frame is
     *  the CURRENT mission — the pointer). */
    legacyVm(): SeatLegacyVm | undefined {
      if (this.overlay?.kind !== 'legacy' || this.state.model === undefined) {
        return undefined;
      }
      return buildSeatLegacy(this.state.model, this.overlay.seat, {contextSlot: this.state.model.pointer});
    },
    /** The legacy overlay's inspectable ring: corps then carried. */
    legacyCards(): ReadonlyArray<CardModel> {
      const legacy = this.legacyVm;
      if (legacy === undefined) {
        return [];
      }
      return [
        ...legacy.corps.map((c) => ({name: c.name} as CardModel)),
        ...(legacy.carried.names ?? []).map((name) => ({name} as CardModel)),
      ];
    },
    progressText(): string {
      const vm = this.vm;
      if (vm === undefined) {
        return '';
      }
      return translateTextWithParams(vm.progressLabel, [...vm.progressParams]);
    },
    /** The bot's lineage entry for the rail ('' until mission 1 fixes it). */
    botLineageLabel(): string {
      const id = this.state.model?.progression.botCorporation;
      if (id === undefined) {
        return '';
      }
      // The bot corp's display identity IS its human twin (`original`).
      return $t(marsBotCorpInfo(id).original);
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
      if (this.overlay?.kind === 'legacy') {
        return 'Legacy';
      }
      return 'Campaign';
    },
    commands(): ReadonlyArray<ConsoleCommand> {
      const vm = this.vm;
      if (vm === undefined) {
        return [{control: 'confirm', label: 'Retry'}, {control: 'back', label: 'Main menu'}];
      }
      if (this.overlay?.kind === 'carryover') {
        // X = inspect (the console-wide verb); RT = confirm (the standard
        // next-step verb). While the fullscreen viewer is open the modal
        // draws its own bar on top (the dev-picker precedent).
        const carryCmds: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Choose'},
          {control: 'confirm', label: 'Take / return'},
        ];
        if (vm.yourEligibleCards.length > 0) {
          carryCmds.push({control: 'secondary', label: 'Inspect'});
        }
        carryCmds.push({control: 'triggerR', label: this.carryConfirmLabel, highlight: true});
        carryCmds.push({control: 'back', label: 'Close'});
        return carryCmds;
      }
      if (this.overlay?.kind === 'mission') {
        const cmds: Array<ConsoleCommand> = [];
        if (this.dossierCards.length > 0) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
      }
      if (this.overlay?.kind === 'legacy') {
        const cmds: Array<ConsoleCommand> = [];
        if (this.legacyCards.length > 0) {
          cmds.push({control: 'dpad', label: 'Choose'});
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Close'});
        return cmds;
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
      // A on a seat row — the participant's full legacy (composition with
      // provenance, start bonus, carried projects, the title ledger).
      if (this.cursor.zone === 'rail') {
        cmds.push({control: 'confirm', label: 'Open: participant legacy'});
      }
      // X — inspect ANY mission under the cursor (the layer is honest to
      // its state: results for a committed one, the known features ahead).
      if (this.dossierSlot !== undefined) {
        cmds.push({control: 'secondary', label: 'Inspect the mission'});
      }
      // Y — the CHANGE door: re-open the very carryover picker while the next
      // mission has not consumed the selection (a mis-pick or an accidental
      // «continue without cards» stays correctable to the last moment).
      if (this.canReviseCarry) {
        cmds.push({control: 'inspect', label: 'Change the carried projects'});
      }
      cmds.push({control: 'back', label: 'Main menu'});
      return cmds;
    },
    /**
     * The carryover selection is still REVISABLE: the interlude window is
     * open (the next launch has not consumed it) and the viewer already
     * confirmed once — before that, the mandatory step itself is the door
     * (auto-open + the A CTA), so Y appears only as the change verb.
     */
    canReviseCarry(): boolean {
      const vm = this.vm;
      return vm !== undefined && vm.carryoverOpen && vm.carryoverConfirmed;
    },
    /**
     * A is ALWAYS «enter» (a live/committed mission) or «create + enter»
     * (the creator launching the ready one) — never an info modal. A mission
     * that offers neither offers no A verb at all.
     */
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
      if (m.state === 'committed' && m.yourPlayerId !== undefined) {
        return {label: 'Open mission results', enabled: true};
      }
      if (m.state === 'ready' && m.isCurrent) {
        if (vm.cta.kind === 'carryover') {
          return {label: vm.cta.label, enabled: true};
        }
        if (vm.cta.kind === 'launch') {
          return {label: 'Launch the mission', enabled: vm.cta.enabled};
        }
        if (vm.cta.kind === 'waiting') {
          return {label: vm.cta.label, enabled: false};
        }
      }
      return undefined;
    },
    /** The mission X would inspect — ANY route card under the cursor. */
    dossierSlot(): number | undefined {
      const vm = this.vm;
      if (vm === undefined || this.cursor.zone !== 'route') {
        return undefined;
      }
      return vm.missions[this.cursor.index]?.slot;
    },
    /** The interlude's mandatory step is due: the viewer's own carryover door
     *  is the campaign's next move. */
    carryStepDue(): boolean {
      return this.vm?.cta.kind === 'carryover';
    },
    /** The confirm verb of the carryover step (English i18n key, no params). */
    carryConfirmLabel(): string {
      if ((this.vm?.yourEligibleCards ?? []).length === 0) {
        return 'Confirm readiness';
      }
      if (this.carryDraft.length > 0) {
        return 'Keep the selection';
      }
      // The ARMED zero-carry confirm: the verb itself names the second press.
      return this.carryArmed ? 'Yes — continue without cards' : 'Continue without cards';
    },
    /** The current slot's live seat link — what the auto-join watches for. */
    activeSeatLink(): {playerId: string, gameId?: string} | undefined {
      const vm = this.vm;
      const current = vm?.missions[vm.currentSlot];
      if (current?.state === 'active' && current.yourPlayerId !== undefined) {
        return {playerId: current.yourPlayerId, gameId: current.gameId};
      }
      return undefined;
    },
    /**
     * The WAIT STRIP heading the player zone (no overlay open): the screen's
     * own standing promise — ready / crew-wait / joining. The ready line
     * names the FIXATION contract out loud: the auto-join happens from THIS
     * screen (the armed watcher lives here and only here — a player who
     * walked elsewhere is never yanked; they get the explicit join verb).
     */
    waitStrip(): {title: string, note: string, ready: boolean} | undefined {
      const vm = this.vm;
      if (vm === undefined || this.overlay !== undefined) {
        return undefined;
      }
      if (this.joining) {
        return {title: 'Mission launched', note: 'Entering the mission…', ready: true};
      }
      // The strip stands for the WHOLE open readiness round — every viewer
      // reads their own next move on it, not only the ready ones.
      const roundOpen = vm.rail.some((r) => r.readiness !== undefined);
      if (!roundOpen) {
        return undefined;
      }
      if (vm.readyWaiting) {
        return {title: 'You are ready', note: 'Stay on this screen — the mission opens from here the moment the host launches it.', ready: true};
      }
      if (vm.cta.kind === 'carryover') {
        return {title: 'Waiting for the crew', note: 'Confirm your readiness — the campaign waits for every player.', ready: false};
      }
      if (vm.isCreator && vm.cta.kind === 'launch') {
        return vm.cta.enabled ?
          {title: 'The crew is ready', note: 'Launch the mission when you are ready.', ready: true} :
          {title: 'Waiting for the crew', note: vm.cta.reason ?? '', ready: false};
      }
      return undefined;
    },
  },
  watch: {
    // The mandatory interlude step opens itself once per visit — the flow's
    // entry IS the carryover picker, not a map to hunt a button on.
    'carryStepDue': {
      immediate: true,
      handler(due: boolean): void {
        if (due && !this.carryAutoOpened && this.overlay === undefined && !this.revealPlaying) {
          this.carryAutoOpened = true;
          this.openCarryover();
        }
      },
    },
    // Reaching the READY waiting state arms the auto-join. Never disarmed by
    // the state flipping (the launch flips it in the same model change the
    // seat link arrives in) — only by leaving the surface.
    'vm.readyWaiting': {
      immediate: true,
      handler(ready: boolean | undefined): void {
        if (ready === true) {
          this.autoJoinArmed = true;
        }
      },
    },
    // THE AUTO-JOIN: the launch push flips the current slot to `active` with
    // the viewer's own seat link — a ready participant enters by itself. The
    // TRANSITION is what fires (a map opened onto an already-active mission
    // offers the explicit join verb instead).
    activeSeatLink(link: {playerId: string, gameId?: string} | undefined): void {
      if (link !== undefined && this.autoJoinArmed && !this.joining) {
        this.enterMission(link.playerId, link.gameId);
      }
    },
    // The embedded host reads the map's overlay + confirm verb through the
    // module mirror (a host cannot reactively read a child's $refs).
    'overlay': {
      immediate: true,
      handler(overlay: MapOverlay | undefined): void {
        campaignMapUi.overlay = overlay?.kind;
      },
    },
    'carryConfirmLabel': {
      immediate: true,
      handler(label: string): void {
        campaignMapUi.carryConfirmLabel = label;
      },
    },
    // The embedded host renders the map's OWN verbs — mirrored whole, so the
    // host's bar can never drift from what the map actually honours.
    'commands': {
      immediate: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        campaignMapUi.commands = cmds;
      },
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
      // The generation reveal plays ONCE, on the creator's first arrival —
      // and it is the DESTINATION's own opening cinematic, so it starts AT
      // the curtain's reveal, never under it (two directions may not
      // overlap; onSceneRevealed fires immediately when no curtain covers).
      try {
        if (window.sessionStorage.getItem(REVEAL_LATCH) === id && !consoleReducedMotionActive()) {
          window.sessionStorage.removeItem(REVEAL_LATCH);
          onSceneRevealed(() => {
            this.revealPlaying = true;
            window.setTimeout(() => {
              this.revealPlaying = false;
            }, 2600);
          });
        } else {
          window.sessionStorage.removeItem(REVEAL_LATCH);
        }
      } catch {
        // Storage unavailable — land settled.
      }
      // SCENE TRANSITION (the campaign-map destination): the curtain holds
      // until the campaign document is actually rendered — the map must
      // never reveal as an empty route the missions then pop onto.
      const releaseModel = loadingScreenState.phase === 'covering' ?
        deferSceneReveal('campaign-model', 8000) : undefined;
      armSceneDestination();
      await openCampaign(id);
      startCampaignWatch();
      // Focus lands on the mission the campaign is at.
      this.cursor = {zone: 'route', index: this.vm?.currentSlot ?? 0};
      await this.$nextTick();
      releaseModel?.();
    } else {
      armSceneDestination();
    }
    this.offPad = installMenuPad((intent) => this.onIntent(intent));
  },
  beforeUnmount() {
    this.offPad?.();
    resetCampaignMapUi();
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
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
    tpText(points: number): string {
      return translateTextWithParams('${0} TP', [String(points)]);
    },
    missionOrdinal(slot: number): string {
      return translateTextWithParams('Mission ${0}', [String(slot + 1)]);
    },
    carryText(count: number): string {
      return translateTextWithParams('carrying ${0}', [String(count)]);
    },
    /** The roster chip's English i18n key per status. */
    waitStatusLabel(status: 'ready' | 'choosing' | 'launching'): string {
      switch (status) {
      case 'ready': return 'is ready';
      case 'launching': return 'launching the mission…';
      default: return 'choosing projects…';
      }
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
      this.carryArmed = false;
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
      if (this.overlay?.kind === 'mission') {
        const action = consoleActionOf(intent, {});
        if (action === 'inspect' && this.dossierCards.length > 0) {
          this.zoomDossierCards();
        } else if (action === 'back' || action === 'primary') {
          this.closeOverlay();
        }
        return true;
      }
      if (this.overlay?.kind === 'legacy') {
        if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
          const n = this.legacyCards.length;
          if (n > 0) {
            const step = intent.dir === 'left' ? -1 : 1;
            this.legacyCursor = Math.max(0, Math.min(n - 1, this.legacyCursor + step));
          }
          return true;
        }
        const action = consoleActionOf(intent, {});
        if (action === 'inspect' && this.legacyCards.length > 0) {
          this.zoomLegacyCards();
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
        // X — the results detail of a COMMITTED mission (nowhere else).
        if (this.dossierSlot !== undefined) {
          this.openMissionDossier(this.dossierSlot);
        }
        return true;
      case 'fullscreen':
        // Y — re-open the carryover picker to CHANGE the confirmed selection
        // (only while the next launch has not consumed it). The entrance is
        // the picker's own cascade — the same door it was chosen in.
        if (this.canReviseCarry) {
          this.openCarryover();
        }
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
        // A on a seat row opens the participant's full LEGACY — the
        // composition with provenance, the start bonus and the carried
        // projects (the row keeps the compact read).
        this.openSeatLegacy(this.cursor.index);
        return;
      }
      const m = vm.missions[this.cursor.index];
      if (m === undefined) {
        return;
      }
      if (m.state === 'active' && m.yourPlayerId !== undefined) {
        this.enterMission(m.yourPlayerId, m.gameId, {resume: true, slot: m.slot});
        return;
      }
      if (m.state === 'committed' && m.yourPlayerId !== undefined) {
        // Open the settled mission endgame (the archive re-entry semantics).
        this.propagateServerPin(m.yourPlayerId);
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(m.yourPlayerId), 'sync',
          this.missionContext({resume: true, slot: m.slot}));
        return;
      }
      if (m.state === 'ready' && m.isCurrent) {
        if (vm.cta.kind === 'carryover') {
          this.openCarryover();
          return;
        }
        if (vm.cta.kind === 'launch' && vm.cta.enabled) {
          // A = create + enter, ONE press: the CTA in the bar named it, the
          // wait strip explained it, and `state.launching` absorbs repeats.
          void this.doLaunch();
          return;
        }
      }
      // Everything else has no A action: A is enter/launch only. A future
      // mission's story lives on its route card; results detail is X.
    },
    openMissionDossier(slot: number): void {
      this.overlay = {kind: 'mission', slot};
    },
    /** The visible participant label — the ONE name helper (the raw seat
     *  name says 'MarsBot'; the label localizes to «Бот»). */
    seatRowName(row: {name: string, isBot: boolean}): string {
      return participantDisplayName({name: row.name, isMarsBot: row.isBot});
    },
    openSeatLegacy(rowIndex: number): void {
      const row = this.vm?.rail[rowIndex];
      if (row === undefined) {
        return;
      }
      this.legacyCursor = 0;
      this.overlay = {kind: 'legacy', seat: row.seat};
    },
    /** Fullscreen-inspect the dossier's carried-out cards (ONE zoom module —
     *  served by ConsoleMenuZoomHost standalone / the shell when embedded). */
    zoomDossierCards(): void {
      const cards = this.dossierCards;
      if (cards.length === 0) {
        return;
      }
      openConsoleCardZoom([...cards], 0, undefined, undefined, {
        contextLabel: 'Legacy',
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement,
          (i) => `cmres:${cards[i]?.name ?? ''}:${i}`,
        ),
      });
    },
    /** Fullscreen-inspect the legacy overlay's ring (corps + carried). */
    zoomLegacyCards(): void {
      const cards = this.legacyCards;
      if (cards.length === 0) {
        return;
      }
      const index = Math.min(this.legacyCursor, cards.length - 1);
      openConsoleCardZoom([...cards], index, undefined, undefined, {
        contextLabel: 'Legacy',
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement,
          (i) => `cleg:${cards[i]?.name ?? ''}:${i}`,
          (i) => {
            this.legacyCursor = i;
          },
        ),
      });
    },
    // ── Carryover ────────────────────────────────────────────────────────
    openCarryover(): void {
      this.carryDraft = [...(this.vm?.yourCarryCards ?? [])];
      this.carryDirty = false;
      this.carryArmed = false;
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
        this.carryArmed = false;
        this.overlay = undefined;
        // ONE FLOW: the confirmation was the readiness press. Everyone lands
        // back on the map — the wait strip states the next move (the ready
        // host reads «Запустите миссию»; A on the current mission launches;
        // everyone else waits with the auto-join armed). No confirm modal.
        this.cursor = {zone: 'route', index: this.vm?.currentSlot ?? this.cursor.index};
      }
    },
    /** The curtain's mission identity — real data only (slot/count exist here). */
    missionContext(opts: {resume: boolean, slot?: number}): TransitionContext {
      const vm = this.vm;
      const slot = opts.slot ?? vm?.currentSlot;
      return {
        kind: 'campaign-mission',
        mission: slot !== undefined ? slot + 1 : undefined,
        missionCount: vm?.missions.length,
        resume: opts.resume,
      };
    },
    /** Enter a live mission (manual A or the armed auto-join) — pin, record, curtain. */
    enterMission(playerId: string, gameId?: string, opts: {resume?: boolean, slot?: number} = {}): void {
      if (this.joining) {
        return;
      }
      this.joining = true;
      this.propagateServerPin(playerId);
      recordLastGameEntered(gameId ?? '');
      const resume = opts.resume === true;
      navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(playerId),
        resume ? 'sync' : 'expedition', this.missionContext({resume, slot: opts.slot}));
    },
    // ── Launch ───────────────────────────────────────────────────────────
    async doLaunch(): Promise<void> {
      // Belt to the server's own gate: the A press only lands on an enabled
      // CTA, but the model can move between the press and this call — and the
      // server re-checks blockers/creator anyway.
      const cta = this.vm?.cta;
      if (cta?.kind !== 'launch' || !cta.enabled) {
        return;
      }
      const result = await launchCampaignMission();
      if (result?.yourPlayerId !== undefined) {
        this.enterMission(result.yourPlayerId, result.gameId);
      }
    },
    /**
     * LAN (host-as-server): when THIS page's API calls are pinned to another
     * machine's server (the map was opened from a LAN campaign row, or the
     * embedded endgame scene of a LAN-joined mission), a mission entered from
     * here lives on that SAME server — pin its participant id before
     * navigating, or the player page would ask the local server and 404.
     * A no-op on the app's own server.
     */
    propagateServerPin(participantId: string): void {
      const endpoint = currentServerEndpoint();
      if (endpoint !== undefined) {
        pinServerEndpoint(participantId, endpoint);
      }
    },
  },
});
</script>
