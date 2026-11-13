<template>
  <div ref="rootEl" class="cmap" :class="{'cmap--reveal': revealPlaying, 'cmap--chronicle': vm !== undefined && vm.phase === 'finished', 'cmap--embedded': embedded, 'cmap--carry-open': overlay?.kind === 'carryover'}">
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
                'cmap__card--receiving': m.isCurrent && carryReceiving,
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
          :data-cmap-seat-you="row.isYou ? 'true' : undefined"
          @click="cursor = {zone: 'rail', index: i}"
        >
          <span class="cmap__seat-cube" :class="`player_bg_color_${row.color}`"></span>
          <span class="cmap__seat-name">
            <span class="cmap__seat-label">{{ seatRowName(row) }}</span>
            <span v-if="row.isYou" class="cmap__seat-you" v-i18n>you</span>
          </span>
          <!-- The «Тендеры» mode: the seat's holdings stand where the titles and the TP stood (one row, one grammar). -->
          <template v-if="row.rewardMode === 'tenders'">
            <span class="cmap__seat-titles cmap__seat-tenders" data-cmap-seat-tenders>
              <ConsoleTenderChip v-for="t in row.tenders" :key="t.instance" :id="t.id" :status="t.status" />
              <span v-if="row.tenders.length === 0" class="cmap__seat-tp cmap__seat-tp--none">{{ $t('No tenders yet') }}</span>
            </span>
            <span class="cmap__seat-tp">{{ row.tenders.length > 0 ? tenderCountText(row.tenders.length) : '' }}</span>
          </template>
          <template v-else>
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
          </template>
          <!-- The corporation LINEAGE lives on the row itself (the old
               campaign-dossier modal, folded onto the screen). -->
          <span class="cmap__seat-corps">
            <template v-if="row.isBot">
              <span v-for="(corp, ci) in botLineage" :key="corp.label" class="cmap__seat-corp"
                    :data-bot-holding="corp.holding ? 'true' : undefined">
                <span class="cmap__seat-corp-ord">{{ ci + 1 }}</span>{{ corp.label }}
              </span>
            </template>
            <template v-else>
              <span v-for="(corp, ci) in row.lineage" :key="corp" class="cmap__seat-corp">
                <span class="cmap__seat-corp-ord">{{ ci + 1 }}</span>{{ $t(corp) }}
              </span>
            </template>
          </span>
          <span v-if="row.pendingBonus > 0" class="cmap__seat-bonus">+{{ row.pendingBonus }} M€</span>
          <span v-if="row.carry !== undefined && row.carry.status === 'confirmed'" class="cmap__seat-carry" data-cmap-seat-carry>
            {{ carryText(row.isYou && carryHeldCount !== undefined ? carryHeldCount : row.carry.count) }}
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
        <div v-if="vm.rewardMode === 'tenders'" class="cmap__rail-note" data-cmap-rail-note="tenders">{{ $t('Tenders') }} — {{ $t(vm.tenderNote) }}</div>
        <div v-else class="cmap__rail-note">{{ $t('TP') }} — {{ $t(tpNote) }}</div>
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

      <!-- The carryover STEP — the map's central stage one level deeper, on the HAND ALBUM'S chassis (P87). The ENTER is
           a deal from the viewer's seat row (`dealCarryIn`), the CONFIRM the kept cards' flight into the next mission's
           card (`flyKeptIntoMission`); the LEAVE is this transition's short fold. -->
      <Transition name="cm-carry">
        <ConsoleCarryoverPicker
          v-if="overlay?.kind === 'carryover'"
          ref="carryPicker"
          class="cmap__carry-overlay"
          :eligible="vm.yourEligibleCards"
          :selected="carryDraft"
          :limit="vm.yourCarryLimit"
          :tender-seats="vm.yourTenderSeats"
          :eligible-preludes="vm.yourEligiblePreludes"
          :prelude-limit="vm.yourPreludeLimit"
          :selected-preludes="preludeDraft"
          :tenders="vm.yourTenders"
          :tender-busy="tenderBusy"
          :tender-error="tenderError"
          :next-mission="vm.currentSlot + 1"
          :root="embedded ? 'Game results' : 'Campaign'"
          :confirmed="vm.carryoverConfirmed && !carryDirty"
          :submitting="state.submittingCarryover"
          :error="state.error"
          @toggle="toggleCarry($event)"
          @toggle-prelude="togglePreludeCarry($event)"
          @execute-tender="executeTender($event)"
          @confirm="confirmCarry"
          @back="closeOverlay"
          @arm-change="carryArmed = $event"
          @bar="carryBar = $event"
        />
      </Transition>

      <!-- The «Тендеры» mode: the BIDDING as the map's own stage — for the player who comes back to the campaign while
           the table still waits (the endgame shows the very same surface first). -->
      <ConsoleTenderBidding
        v-if="overlay?.kind === 'bidding' && state.model?.bidding !== undefined"
        ref="biddingStage"
        class="cmap__bidding-overlay"
        :bidding="state.model.bidding"
        :seats="state.model.seats"
        :you-seat="state.model.you?.seat"
        :mission-label="missionOrdinal(state.model.bidding.sourceSlot)"
        :reveal-key="biddingRevealKeyOf(state.model.id, state.model.bidding.sourceSlot)"
        :root="embedded ? 'Game results' : 'Campaign'"
        :submitting="state.submittingBid"
        :error="state.error"
        :embedded="embedded"
        @bid="onBid"
        @back="closeOverlay"
      />

    </template>

    <!-- Embedded (an endgame scene): the HOST owns the command bar. -->
    <ConsoleCommandBar v-if="!embedded" :context="commandContext" :commands="commands" />
  </div>
</template>

<script setup vapor lang="ts">
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
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
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
import ConsoleCarryoverPicker, {CarryoverBarFacts} from './ConsoleCarryoverPicker.vue';
import ConsoleTenderBidding from './ConsoleTenderBidding.vue';
import ConsoleTenderChip from './ConsoleTenderChip.vue';
import {biddingRevealKey, tenderBiddingUi} from '@/client/console/campaign/tenderBiddingUi';
import {CloneFlightHandle, flyCardClones} from '@/client/console/cardFlight/cloneFlights';
import {motionMs} from '@/client/components/motion/motionTokens';
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
  submitCampaignBid,
  submitCampaignCarryover,
  submitCampaignTender,
} from '@/client/console/campaign/campaignState';
import {CampaignMapVm, buildCampaignMapVm} from '@/client/console/campaign/campaignMapModel';
import {campaignMapUi, resetCampaignMapUi} from '@/client/console/campaign/campaignMapUi';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {useAppRoot} from '@/client/components/appRoot';

type MapOverlay =
  | {kind: 'mission', slot: number}
  | {kind: 'legacy', seat: number}
  | {kind: 'carryover'}
  /** The «Тендеры» mode: the open bidding's table (the same surface the endgame shows first). */
  | {kind: 'bidding'};

const REVEAL_LATCH = 'tm_campaign_reveal';

defineOptions({name: 'ConsoleCampaignMap'});
const props = defineProps({
  /** Hosted as an endgame scene: no own bg/pad/command bar; the host routes
   *  intents into `handleIntent` and reads `commands` for its own bar. */
  embedded: {type: Boolean, required: false, default: false},
});
const emit = defineEmits(['close']);

// the app root's port (R26): the standalone map's root B navigates to the main menu through it. `undefined` outside
// the application — a map with no root above it has nowhere to navigate, and that press does nothing
const root = useAppRoot();
if (!props.embedded) {
  useConsoleNativeSurface();
}
const flow = useFlowScope('console-campaign-map');
const carryPicker = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean} & {dealIn?: (from: DOMRect | undefined) => void} & {keptFaces?: () => Map<CardName, {el: HTMLElement, rect: DOMRect}>}>('carryPicker');
const biddingStage = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('biddingStage');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const state = campaignState;
const cursor = ref({zone: 'route' as 'route' | 'rail', index: 0});
const overlay = ref<MapOverlay | undefined>(undefined);
const revealPlaying = ref(false);
/** Local carryover draft — seeded from the server selection on open. */
const carryDraft = ref<Array<CardName>>([]);
/** The «Тендеры» mode: the played preludes carried by «Продление программы» (seeded from the server on open). */
const preludeDraft = ref<Array<CardName>>([]);
const carryDirty = ref(false);
/** The picker's ARMED zero-carry confirm (mirrored up for the bar). */
const carryArmed = ref(false);
/** The picker's bar facts (the A verb by focus, the page count) — mirrored up for the ONE command bar. */
const carryBar = ref({primary: 'Keep for the next mission', pages: 1, stage: 'album', primaryEnabled: true} as CarryoverBarFacts);
/** The «Тендеры» mode: the legacy tender whose activation is on the wire, and the server's last refusal. */
const tenderBusy = ref<string | undefined>(undefined);
const tenderError = ref('');
/** The CONFIRM flight is in the air: the viewer's seat row holds its carry count until each card's touchdown. */
const carryHeldCount = ref<number | undefined>(undefined);
/** The next mission's card answers the touchdown (a one-shot kant impulse). */
const carryReceiving = ref(false);
let carryFlights: Array<CloneFlightHandle> = [];
/**
 * The interlude flow's mandatory step opens ITSELF once per visit —
 * arriving with an unresolved carryover door lands the player straight
 * in the picker (skippable inside; B returns to the map and the CTA
 * re-opens it). The latch keeps a deliberate B honest.
 */
const carryAutoOpened = ref(false);
/** The «Тендеры» mode: the open bidding opened itself once this visit (the same latch law as the carryover). */
const biddingAutoOpened = ref(false);
/**
 * AUTO-JOIN armed: the viewer reached the READY waiting state on this
 * surface. When the current slot flips to `active` with a seat link
 * (the launch push), the client enters the mission by itself.
 */
const autoJoinArmed = ref(false);
/** A join navigation is in flight — absorbs duplicates. */
const joining = ref(false);
/** Cursor over the legacy overlay's inspectable cards. */
const legacyCursor = ref(0);
let offPad: (() => void) | undefined;

const vm = computed((): CampaignMapVm | undefined => {
  return state.model !== undefined ? buildCampaignMapVm(state.model) : undefined;
});
/** The SHARED overview projection — mission cards, provenance, TP
 *  semantics (one model with the in-game Information overview). */
const overviewVm = computed((): CampaignOverviewVm | undefined => {
  return state.model !== undefined ? buildCampaignOverview(state.model) : undefined;
});
/** The route nodes pair the map vm (CTA/party/blockers) with the shared
 *  overview card (the painted mission card). Both derive from ONE model,
 *  so the slots align by construction. */
const routeNodes = computed((): ReadonlyArray<{m: CampaignMapVm['missions'][number], ov: OverviewMissionCard}> => {
  const vmNow = vm.value;
  const overview = overviewVm.value;
  if (vmNow === undefined || overview === undefined) {
    return [];
  }
  return vmNow.missions.map((m) => ({m, ov: overview.missions[m.slot]}));
});
/** The one TP semantics note of this campaign frame (shared wording). */
const tpNote = computed((): string => {
  const overview = overviewVm.value;
  if (overview === undefined || overview.seats.length === 0) {
    return '';
  }
  return tpStatusLabel(overview.seats[0].tpStatus);
});
/** The OPEN mission-inspect overlay's card (any state). */
const inspectMission = computed((): OverviewMissionCard | undefined => {
  if (overlay.value?.kind !== 'mission') {
    return undefined;
  }
  return overviewVm.value?.missions[overlay.value.slot];
});
/** The committed results of the open inspect (undefined for a future
 *  mission — the inspect body then presents the known features). */
const dossierDetails = computed((): MissionDetailsVm | undefined => {
  if (overlay.value?.kind !== 'mission' || state.model === undefined) {
    return undefined;
  }
  return buildMissionDetails(state.model, overlay.value.slot);
});
/** The viewer's own carried-out cards of the open dossier (X inspects). */
const dossierCards = computed((): ReadonlyArray<CardModel> => {
  return (dossierDetails.value?.outgoing?.carried.yourCards ?? []).map((name) => ({name} as CardModel));
});
/** «Наследие» of the OPEN seat overlay (shared body; the map's frame is
 *  the CURRENT mission — the pointer). */
const legacyVm = computed((): SeatLegacyVm | undefined => {
  if (overlay.value?.kind !== 'legacy' || state.model === undefined) {
    return undefined;
  }
  return buildSeatLegacy(state.model, overlay.value.seat, {contextSlot: state.model.pointer});
});
/** The legacy overlay's inspectable ring: corps then carried. */
const legacyCards = computed((): ReadonlyArray<CardModel> => {
  const legacy = legacyVm.value;
  if (legacy === undefined) {
    return [];
  }
  return [
    ...legacy.corps.map((c) => ({name: c.name} as CardModel)),
    ...(legacy.carried.names ?? []).map((name) => ({name} as CardModel)),
  ];
});
const progressText = computed((): string => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return '';
  }
  return translateTextWithParams(vmNow.progressLabel, [...vmNow.progressParams]);
});
/** The bot's portfolio for the rail: the primary (once mission 1 fixes it), then its HOLDINGS (dividend only). */
const botLineage = computed((): ReadonlyArray<{label: string, holding: boolean}> => {
  const progression = state.model?.progression;
  const id = progression?.botCorporation;
  if (id === undefined) {
    return [];
  }
  // The bot corp's display identity IS its human twin (`original`).
  return [
    {label: $t(marsBotCorpInfo(id).original), holding: false},
    ...(progression?.botHoldings ?? []).map((h) => ({label: $t(marsBotCorpInfo(h).original), holding: true})),
  ];
});
const laneFillStyle = computed((): Record<string, string> => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return {};
  }
  const done = vmNow.phase === 'finished' ? vmNow.missions.length : vmNow.currentSlot;
  // Solid behind the party, dashed ahead — state never carried by color alone.
  const pct = Math.min(100, (done / Math.max(1, vmNow.missions.length - 1)) * 100);
  return {width: `${pct}%`};
});
const commandContext = computed((): string => {
  if (overlay.value?.kind === 'carryover') {
    return 'Project legacy';
  }
  if (overlay.value?.kind === 'bidding') {
    return 'Bidding';
  }
  if (overlay.value?.kind === 'mission') {
    return 'Mission dossier';
  }
  if (overlay.value?.kind === 'legacy') {
    return 'Legacy';
  }
  return 'Campaign';
});
const commands = computed((): ReadonlyArray<ConsoleCommand> => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return [{control: 'confirm', label: 'Retry'}, {control: 'back', label: 'Main menu'}];
  }
  if (overlay.value?.kind === 'bidding') {
    // The bidding scene's OWN verbs, mirrored whole (its root B closes the overlay).
    return tenderBiddingUi.commands.map((c) =>
      c.control === 'back' && c.label === 'Minimize' ? {...c, label: 'Close', priority: 5} : c);
  }
  if (overlay.value?.kind === 'carryover') {
    // X = inspect (the console-wide verb); RT = confirm (the standard
    // next-step verb). While the fullscreen viewer is open the modal
    // draws its own bar on top (the dev-picker precedent).
    const carryCmds: Array<ConsoleCommand> = [];
    // THE TENDER DOOR's LIST (§19): A executes the focused certificate of this page (disabled, never hidden,
    // otherwise), X reads it, B goes one level back to the album.
    if (carryBar.value.stage === 'list') {
      carryCmds.push({control: 'dpad', label: 'Choose'});
      carryCmds.push({control: 'confirm', label: carryBar.value.primary, enabled: carryBar.value.primaryEnabled, highlight: carryBar.value.primaryEnabled});
      carryCmds.push({control: 'secondary', label: 'Inspect'});
      carryCmds.push({control: 'back', label: 'Back'});
      return carryCmds;
    }
    // …a tender's ACTIVATION SHEET (§20): A executes it (the stamp, then the album with its new place), X reads the
    // certificate, B goes one level back to the list.
    if (carryBar.value.stage === 'sheet') {
      carryCmds.push({control: 'confirm', label: carryBar.value.primary, enabled: carryBar.value.primaryEnabled, highlight: carryBar.value.primaryEnabled});
      carryCmds.push({control: 'secondary', label: 'Inspect'});
      carryCmds.push({control: 'back', label: 'Back'});
      return carryCmds;
    }
    // …a tender standing in its MODE on the album: its place is previewed in the manifest — A executes, B cancels.
    if (carryBar.value.stage === 'mode') {
      carryCmds.push({control: 'confirm', label: carryBar.value.primary, enabled: carryBar.value.primaryEnabled, highlight: carryBar.value.primaryEnabled});
      carryCmds.push({control: 'secondary', label: 'Inspect'});
      carryCmds.push({control: 'back', label: 'Cancel the tender'});
      return carryCmds;
    }
    if (vmNow.yourEligibleCards.length > 0) {
      carryCmds.push({control: 'dpad', label: 'Choose'});
      carryCmds.push({control: 'confirm', label: carryBar.value.primary});
      carryCmds.push({control: 'secondary', label: 'Inspect'});
      // LB / RB turn the page — the SPINE in the stage foot says so (one action, one hint: never the bar).
    }
    // THE TENDER DOOR (L3): lit and saying so on the page where a legacy tender executes.
    if (carryBar.value.door !== undefined) {
      carryCmds.push(carryBar.value.door.ready > 0 ?
        {control: 'stickL', label: 'Tenders', highlight: true, priority: 2} :
        {control: 'stickL', label: 'Tenders'});
    }
    carryCmds.push({control: 'triggerR', label: carryConfirmLabel.value, highlight: true});
    carryCmds.push({control: 'back', label: 'Close'});
    return carryCmds;
  }
  if (overlay.value?.kind === 'mission') {
    const cmds: Array<ConsoleCommand> = [];
    if (dossierCards.value.length > 0) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push({control: 'back', label: 'Close'});
    return cmds;
  }
  if (overlay.value?.kind === 'legacy') {
    const cmds: Array<ConsoleCommand> = [];
    if (legacyCards.value.length > 0) {
      cmds.push({control: 'dpad', label: 'Choose'});
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push({control: 'back', label: 'Close'});
    return cmds;
  }
  if (overlay.value !== undefined) {
    return [{control: 'back', label: 'Close'}];
  }
  const cmds: Array<ConsoleCommand> = [
    {control: 'dpad', label: 'Navigate'},
  ];
  const verb = routeVerb.value;
  if (verb !== undefined) {
    cmds.push({control: 'confirm', label: verb.label, enabled: verb.enabled});
  }
  // A on a seat row — the participant's full legacy (composition with
  // provenance, start bonus, carried projects, the title ledger).
  if (cursor.value.zone === 'rail') {
    cmds.push({control: 'confirm', label: 'Open: participant legacy'});
  }
  // X — inspect ANY mission under the cursor (the layer is honest to
  // its state: results for a committed one, the known features ahead).
  if (dossierSlot.value !== undefined) {
    cmds.push({control: 'secondary', label: 'Inspect the mission'});
  }
  // Y — the CHANGE door: re-open the very carryover picker while the next
  // mission has not consumed the selection (a mis-pick or an accidental
  // «continue without cards» stays correctable to the last moment).
  if (canReviseCarry.value) {
    cmds.push({control: 'inspect', label: 'Change the carried projects'});
  }
  cmds.push({control: 'back', label: 'Main menu'});
  return cmds;
});
/**
 * The carryover selection is still REVISABLE: the interlude window is
 * open (the next launch has not consumed it) and the viewer already
 * confirmed once — before that, the mandatory step itself is the door
 * (auto-open + the A CTA), so Y appears only as the change verb.
 */
const canReviseCarry = computed((): boolean => {
  const vmNow = vm.value;
  return vmNow !== undefined && vmNow.carryoverOpen && vmNow.carryoverConfirmed;
});
/**
 * A is ALWAYS «enter» (a live/committed mission) or «create + enter»
 * (the creator launching the ready one) — never an info modal. A mission
 * that offers neither offers no A verb at all.
 */
const routeVerb = computed((): {label: string, enabled: boolean} | undefined => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return undefined;
  }
  if (cursor.value.zone !== 'route') {
    return undefined;
  }
  const m = vmNow.missions[cursor.value.index];
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
    if (vmNow.biddingOpen) {
      // The «Тендеры» mode: the table is open for everyone — the turn seat picks, the rest watch.
      return {label: 'Open the bidding', enabled: true};
    }
    if (vmNow.cta.kind === 'carryover') {
      return {label: vmNow.cta.label, enabled: true};
    }
    if (vmNow.cta.kind === 'launch') {
      return {label: 'Launch the mission', enabled: vmNow.cta.enabled};
    }
    if (vmNow.cta.kind === 'waiting') {
      return {label: vmNow.cta.label, enabled: false};
    }
  }
  return undefined;
});
/** The mission X would inspect — ANY route card under the cursor. */
const dossierSlot = computed((): number | undefined => {
  const vmNow = vm.value;
  if (vmNow === undefined || cursor.value.zone !== 'route') {
    return undefined;
  }
  return vmNow.missions[cursor.value.index]?.slot;
});
/** The interlude's mandatory step is due: the viewer's own carryover door
 *  is the campaign's next move. */
const carryStepDue = computed((): boolean => {
  return vm.value?.cta.kind === 'carryover';
});
/** The «Тендеры» mode: a bidding is open this interlude — the table is the campaign's next move for everyone. */
const biddingStepDue = computed((): boolean => {
  return vm.value?.biddingOpen === true;
});
/** The confirm verb of the carryover step (English i18n key, no params). */
const carryConfirmLabel = computed((): string => {
  if ((vm.value?.yourEligibleCards ?? []).length === 0) {
    return 'Confirm readiness';
  }
  if (carryDraft.value.length > 0) {
    return 'Keep the selection';
  }
  // The ARMED zero-carry confirm: the verb itself names the second press.
  return carryArmed.value ? 'Yes — continue without cards' : 'Continue without cards';
});
/** The current slot's live seat link — what the auto-join watches for. */
const activeSeatLink = computed((): {playerId: string, gameId?: string} | undefined => {
  const vmNow = vm.value;
  const current = vmNow?.missions[vmNow.currentSlot];
  if (current?.state === 'active' && current.yourPlayerId !== undefined) {
    return {playerId: current.yourPlayerId, gameId: current.gameId};
  }
  return undefined;
});
/**
 * The WAIT STRIP heading the player zone (no overlay open): the screen's
 * own standing promise — ready / crew-wait / joining. The ready line
 * names the FIXATION contract out loud: the auto-join happens from THIS
 * screen (the armed watcher lives here and only here — a player who
 * walked elsewhere is never yanked; they get the explicit join verb).
 */
const waitStrip = computed((): {title: string, note: string, ready: boolean} | undefined => {
  const vmNow = vm.value;
  if (vmNow === undefined || overlay.value !== undefined) {
    return undefined;
  }
  if (joining.value) {
    return {title: 'Mission launched', note: 'Entering the mission…', ready: true};
  }
  // The strip stands for the WHOLE open readiness round — every viewer
  // reads their own next move on it, not only the ready ones.
  const roundOpen = vmNow.rail.some((r) => r.readiness !== undefined);
  if (!roundOpen) {
    return undefined;
  }
  if (vmNow.readyWaiting) {
    return {title: 'You are ready', note: 'Stay on this screen — the mission opens from here the moment the host launches it.', ready: true};
  }
  if (vmNow.cta.kind === 'carryover') {
    return {title: 'Waiting for the crew', note: 'Confirm your readiness — the campaign waits for every player.', ready: false};
  }
  if (vmNow.isCreator && vmNow.cta.kind === 'launch') {
    return vmNow.cta.enabled ?
      {title: 'The crew is ready', note: 'Launch the mission when you are ready.', ready: true} :
      {title: 'Waiting for the crew', note: vmNow.cta.reason ?? '', ready: false};
  }
  return undefined;
});

/** Hosted mode: the host routes pad intents here. */
function handleIntent(intent: GamepadIntent): boolean {
  return onIntent(intent);
}
function titleLabel(title: TitleName): string {
  return TITLE_LABEL[title];
}
function tpText(points: number): string {
  return translateTextWithParams('${0} TP', [String(points)]);
}
function tenderCountText(count: number): string {
  return translateTextWithParams('${0} tender(s)', [String(count)]);
}
/** The reveal latch's key — ONE per bidding on this client (`tenderBiddingUi`). */
function biddingRevealKeyOf(campaignId: string, slot: number): string {
  return biddingRevealKey(campaignId, slot);
}
function missionOrdinal(slot: number): string {
  return translateTextWithParams('Mission ${0}', [String(slot + 1)]);
}
function carryText(count: number): string {
  return translateTextWithParams('carrying ${0}', [String(count)]);
}
/** The roster chip's English i18n key per status. */
function waitStatusLabel(status: 'ready' | 'choosing' | 'launching' | 'tendering'): string {
  switch (status) {
  case 'ready': return 'is ready';
  case 'launching': return 'launching the mission…';
  case 'tendering': return 'picking a tender…';
  default: return 'choosing projects…';
  }
}
/** The «Тендеры» mode: the viewer's pick — the server decides, the push presents the result on every table. */
async function onBid(instance: string): Promise<void> {
  await submitCampaignBid(instance);
}
function revealDelay(slot: number): Record<string, string> {
  return revealPlaying.value ? {'--cmap-reveal-delay': `${420 + slot * 300}ms`} : {};
}
function retry(): void {
  void refreshCampaign();
}
function closeOverlay(): void {
  // B never silently confirms or discards — the draft simply closes; the
  // server keeps whatever was last CONFIRMED.
  overlay.value = undefined;
  carryDirty.value = false;
  carryArmed.value = false;
}
// ── Input routing ────────────────────────────────────────────────────
function onIntent(intent: GamepadIntent): boolean {
  if (state.launching) {
    return true;
  }
  const vmNow = vm.value;
  if (vmNow === undefined) {
    const action = consoleActionOf(intent, {});
    if (action === 'primary') {
      retry();
    } else if (action === 'back') {
      leaveMap();
    }
    return true;
  }
  if (overlay.value?.kind === 'carryover') {
    const picker = carryPicker.value ?? undefined;
    picker?.handleIntent?.(intent);
    return true;
  }
  if (overlay.value?.kind === 'bidding') {
    const stage = biddingStage.value ?? undefined;
    stage?.handleIntent?.(intent);
    return true;
  }
  if (overlay.value?.kind === 'mission') {
    const action = consoleActionOf(intent, {});
    if (action === 'inspect' && dossierCards.value.length > 0) {
      zoomDossierCards();
    } else if (action === 'back' || action === 'primary') {
      closeOverlay();
    }
    return true;
  }
  if (overlay.value?.kind === 'legacy') {
    if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
      const n = legacyCards.value.length;
      if (n > 0) {
        const step = intent.dir === 'left' ? -1 : 1;
        legacyCursor.value = Math.max(0, Math.min(n - 1, legacyCursor.value + step));
      }
      return true;
    }
    const action = consoleActionOf(intent, {});
    if (action === 'inspect' && legacyCards.value.length > 0) {
      zoomLegacyCards();
    } else if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay.value !== undefined) {
    const action = consoleActionOf(intent, {});
    if (action === 'back' || action === 'primary') {
      closeOverlay();
    }
    return true;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return true;
  }
  const action = consoleActionOf(intent, {});
  switch (action) {
  case 'primary':
    activateCursor();
    return true;
  case 'inspect':
    // X — the results detail of a COMMITTED mission (nowhere else).
    if (dossierSlot.value !== undefined) {
      openMissionDossier(dossierSlot.value);
    }
    return true;
  case 'fullscreen':
    // Y — re-open the carryover picker to CHANGE the confirmed selection
    // (only while the next launch has not consumed it). The entrance is
    // the picker's own cascade — the same door it was chosen in.
    if (canReviseCarry.value) {
      openCarryover();
    }
    return true;
  case 'back':
    leaveMap();
    return true;
  default:
    return true;
  }
}
/** Root B: standalone → the main menu; embedded → the host takes back. */
function leaveMap(): void {
  if (props.embedded) {
    emit('close');
  } else {
    root?.navigateInApp('/');
  }
}
function onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return;
  }
  if (cursor.value.zone === 'route') {
    if (dir === 'left' && cursor.value.index > 0) {
      cursor.value = {zone: 'route', index: cursor.value.index - 1};
    } else if (dir === 'right' && cursor.value.index < vmNow.missions.length - 1) {
      cursor.value = {zone: 'route', index: cursor.value.index + 1};
    } else if (dir === 'down' && vmNow.rail.length > 0) {
      cursor.value = {zone: 'rail', index: 0};
    }
  } else {
    if (dir === 'up') {
      if (cursor.value.index > 0) {
        cursor.value = {zone: 'rail', index: cursor.value.index - 1};
      } else {
        cursor.value = {zone: 'route', index: vmNow.currentSlot};
      }
    } else if (dir === 'down' && cursor.value.index < vmNow.rail.length - 1) {
      cursor.value = {zone: 'rail', index: cursor.value.index + 1};
    }
  }
}
function onRouteClick(slot: number): void {
  cursor.value = {zone: 'route', index: slot};
  activateCursor();
}
function activateCursor(): void {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return;
  }
  if (cursor.value.zone === 'rail') {
    // A on a seat row opens the participant's full LEGACY — the
    // composition with provenance, the start bonus and the carried
    // projects (the row keeps the compact read).
    openSeatLegacy(cursor.value.index);
    return;
  }
  const m = vmNow.missions[cursor.value.index];
  if (m === undefined) {
    return;
  }
  if (m.state === 'active' && m.yourPlayerId !== undefined) {
    enterMission(m.yourPlayerId, m.gameId, {resume: true, slot: m.slot});
    return;
  }
  if (m.state === 'committed' && m.yourPlayerId !== undefined) {
    // Open the settled mission endgame (the archive re-entry semantics).
    propagateServerPin(m.yourPlayerId);
    navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(m.yourPlayerId), 'sync',
      missionContext({resume: true, slot: m.slot}));
    return;
  }
  if (m.state === 'ready' && m.isCurrent) {
    if (vmNow.biddingOpen) {
      // The «Тендеры» mode: the open bidding is the mission's next move — the table, whosever turn it is.
      overlay.value = {kind: 'bidding'};
      return;
    }
    if (vmNow.cta.kind === 'carryover') {
      openCarryover();
      return;
    }
    if (vmNow.cta.kind === 'launch' && vmNow.cta.enabled) {
      // A = create + enter, ONE press: the CTA in the bar named it, the
      // wait strip explained it, and `state.launching` absorbs repeats.
      void doLaunch();
      return;
    }
  }
  // Everything else has no A action: A is enter/launch only. A future
  // mission's story lives on its route card; results detail is X.
}
function openMissionDossier(slot: number): void {
  overlay.value = {kind: 'mission', slot};
}
/** The visible participant label — the ONE name helper (the raw seat
 *  name says 'MarsBot'; the label localizes to «Бот»). */
function seatRowName(row: {name: string, isBot: boolean}): string {
  return participantDisplayName({name: row.name, isMarsBot: row.isBot});
}
function openSeatLegacy(rowIndex: number): void {
  const row = vm.value?.rail[rowIndex];
  if (row === undefined) {
    return;
  }
  legacyCursor.value = 0;
  overlay.value = {kind: 'legacy', seat: row.seat};
}
/** Fullscreen-inspect the dossier's carried-out cards (ONE zoom module —
 *  served by ConsoleMenuZoomHost standalone / the shell when embedded). */
function zoomDossierCards(): void {
  const cards = dossierCards.value;
  if (cards.length === 0) {
    return;
  }
  openConsoleCardZoom([...cards], 0, undefined, undefined, {
    contextLabel: 'Legacy',
    origin: slotZoomOrigin(
      () => rootEl.value as HTMLElement,
      (i) => `cmres:${cards[i]?.name ?? ''}:${i}`,
    ),
  });
}
/** Fullscreen-inspect the legacy overlay's ring (corps + carried). */
function zoomLegacyCards(): void {
  const cards = legacyCards.value;
  if (cards.length === 0) {
    return;
  }
  const index = Math.min(legacyCursor.value, cards.length - 1);
  openConsoleCardZoom([...cards], index, undefined, undefined, {
    contextLabel: 'Legacy',
    origin: slotZoomOrigin(
      () => rootEl.value as HTMLElement,
      (i) => `cleg:${cards[i]?.name ?? ''}:${i}`,
      (i) => {
        legacyCursor.value = i;
      },
    ),
  });
}
// ── Carryover ────────────────────────────────────────────────────────
function openCarryover(): void {
  carryDraft.value = [...(vm.value?.yourCarryCards ?? [])];
  preludeDraft.value = [...(vm.value?.yourPreludes ?? [])];
  carryDirty.value = false;
  carryArmed.value = false;
  // A REVISION (Y) opens with the kept cards already in their kant — they are «here» already, nothing is dealt.
  const revise = carryDraft.value.length > 0 || vm.value?.carryoverConfirmed === true;
  overlay.value = {kind: 'carryover'};
  if (!revise) {
    void nextTick(() => flow.afterFrame('the carried hand is dealt in', () => dealCarryIn()));
  }
}
/** THE ENTRY: the terminal hand arrives from the viewer's seat row (the cards of your hand from the mission just played). */
function dealCarryIn(): void {
  const picker = carryPicker.value ?? undefined;
  const row = rootEl.value?.querySelector?.<HTMLElement>('[data-cmap-seat-you]');
  picker?.dealIn?.(row?.getBoundingClientRect());
}
/**
 * THE CONFIRM's phrase — the server said yes: the KEPT cards rise out of their slots and fly into the next mission's
 * card, which answers each touch (a one-shot impulse) while the seat row's «carrying N» ticks per touchdown. The
 * stage folds at once (the leave fold), so the destination is in sight; the rest of the hand goes with the stage.
 */
function flyKeptIntoMission(kept: Map<CardName, {el: HTMLElement, rect: DOMRect}>): void {
  const card = rootEl.value?.querySelector?.<HTMLElement>('.cmap__card--current');
  const dest = card?.getBoundingClientRect();
  if (kept.size === 0 || dest === undefined || dest.width < 8 || motionMs(100) === 0) {
    return;
  }
  const entries = [...kept.entries()];
  const names = entries.map(([n]) => n);
  const first = entries[0][1].rect;
  const h = dest.height * 0.62;
  const w = h * (first.width / first.height);
  const to = new DOMRect(dest.left + dest.width / 2 - w / 2, dest.top + dest.height / 2 - h / 2, w, h);
  carryHeldCount.value = 0;
  // The layer is the convoy's own: it leaves with the last card.
  const flight: CloneFlightHandle = flyCardClones({
    names,
    sourceEl: (n) => kept.get(n)?.el ?? null,
    from: new Map(entries.map(([n, k]) => [n, k.rect] as [CardName, DOMRect])),
    to: new Map(names.map((n) => [n, to] as [CardName, DOMRect])),
    layerClass: 'con-carry-flight',
    onLand: () => {
      carryHeldCount.value = (carryHeldCount.value ?? 0) + 1;
      carryReceiving.value = false;
      void nextTick(() => {
        carryReceiving.value = true;
      });
    },
    onDone: () => {
      carryHeldCount.value = undefined;
      flight.dispose();
      carryFlights = carryFlights.filter((x) => x !== flight);
      flow.after(motionMs(520), 'the mission card\'s receiving impulse ends', () => {
        carryReceiving.value = false;
      });
    },
    travelMs: 420,
    staggerMs: 90,
  });
  carryFlights.push(flight);
}
function toggleCarry(name: CardName): void {
  const idx = carryDraft.value.indexOf(name);
  if (idx >= 0) {
    carryDraft.value.splice(idx, 1);
  } else if (carryDraft.value.length < (vm.value?.yourCarryLimit ?? 0)) {
    carryDraft.value.push(name);
  }
  carryDirty.value = true;
}
/** The «Тендеры» mode: a played prelude carried by «Продление программы» — the same toggle, the seat's own limit. */
function togglePreludeCarry(name: CardName): void {
  const idx = preludeDraft.value.indexOf(name);
  if (idx >= 0) {
    preludeDraft.value.splice(idx, 1);
  } else if (preludeDraft.value.length < (vm.value?.yourPreludeLimit ?? 0)) {
    preludeDraft.value.push(name);
  }
  carryDirty.value = true;
}
/** «ТЕНДЕРЫ» (§16.5): a legacy tender's ACTIVATION — the seat's own credential, one at a time; the model answer opens the seat / the band. */
async function executeTender(instance: string): Promise<void> {
  if (tenderBusy.value !== undefined) {
    return;
  }
  tenderBusy.value = instance;
  tenderError.value = '';
  try {
    const ok = await submitCampaignTender(instance);
    if (!ok) {
      tenderError.value = state.error !== '' ? state.error : 'Could not execute the tender. Please try again.';
    }
  } finally {
    tenderBusy.value = undefined;
  }
}
async function confirmCarry(): Promise<void> {
  const vmNow = vm.value;
  const model = state.model;
  if (vmNow === undefined || model === undefined || vmNow.youSeat === undefined) {
    return;
  }
  const source = model.missions[model.carryover?.sourceSlot ?? -1];
  const playerId = source?.yourPlayerId;
  if (playerId === undefined) {
    return;
  }
  // ARM → DETECT: the kept faces are measured before the POST; only a confirmed answer flies them.
  const picker = carryPicker.value ?? undefined;
  const kept = picker?.keptFaces?.() ?? new Map<CardName, {el: HTMLElement, rect: DOMRect}>();
  const ok = await submitCampaignCarryover(playerId, carryDraft.value, preludeDraft.value);
  if (ok) {
    carryDirty.value = false;
    carryArmed.value = false;
    flyKeptIntoMission(kept);
    overlay.value = undefined;
    // ONE FLOW: the confirmation was the readiness press. Everyone lands
    // back on the map — the wait strip states the next move (the ready
    // host reads «Запустите миссию»; A on the current mission launches;
    // everyone else waits with the auto-join armed). No confirm modal.
    cursor.value = {zone: 'route', index: vm.value?.currentSlot ?? cursor.value.index};
  }
}
/** The curtain's mission identity — real data only (slot/count exist here). */
function missionContext(opts: {resume: boolean, slot?: number}): TransitionContext {
  const vmNow = vm.value;
  const slot = opts.slot ?? vmNow?.currentSlot;
  return {
    kind: 'campaign-mission',
    mission: slot !== undefined ? slot + 1 : undefined,
    missionCount: vmNow?.missions.length,
    resume: opts.resume,
  };
}
/** Enter a live mission (manual A or the armed auto-join) — pin, record, curtain. */
function enterMission(playerId: string, gameId?: string, opts: {resume?: boolean, slot?: number} = {}): void {
  if (joining.value) {
    return;
  }
  joining.value = true;
  propagateServerPin(playerId);
  recordLastGameEntered(gameId ?? '');
  const resume = opts.resume === true;
  navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(playerId),
    resume ? 'sync' : 'expedition', missionContext({resume, slot: opts.slot}));
}
// ── Launch ───────────────────────────────────────────────────────────
async function doLaunch(): Promise<void> {
  // Belt to the server's own gate: the A press only lands on an enabled
  // CTA, but the model can move between the press and this call — and the
  // server re-checks blockers/creator anyway.
  const cta = vm.value?.cta;
  if (cta?.kind !== 'launch' || !cta.enabled) {
    return;
  }
  const result = await launchCampaignMission();
  if (result?.yourPlayerId !== undefined) {
    enterMission(result.yourPlayerId, result.gameId);
  }
}
/**
 * LAN (host-as-server): when THIS page's API calls are pinned to another
 * machine's server (the map was opened from a LAN campaign row, or the
 * embedded endgame scene of a LAN-joined mission), a mission entered from
 * here lives on that SAME server — pin its participant id before
 * navigating, or the player page would ask the local server and 404.
 * A no-op on the app's own server.
 */
function propagateServerPin(participantId: string): void {
  const endpoint = currentServerEndpoint();
  if (endpoint !== undefined) {
    pinServerEndpoint(participantId, endpoint);
  }
}

// The mandatory interlude step opens itself once per visit — the flow's
// entry IS the carryover picker, not a map to hunt a button on.
watch(() => carryStepDue.value, (due: boolean): void => {
  if (due && !carryAutoOpened.value && overlay.value === undefined && !revealPlaying.value) {
    carryAutoOpened.value = true;
    openCarryover();
  }
}, {immediate: true});
// The «Тендеры» mode: the open bidding stands BEFORE the carryover — it opens itself once per visit; a finished
// bidding closes its own overlay (the carryover step then opens by the watcher above).
watch(() => biddingStepDue.value, (due: boolean): void => {
  if (due && !biddingAutoOpened.value && overlay.value === undefined && !revealPlaying.value) {
    biddingAutoOpened.value = true;
    overlay.value = {kind: 'bidding'};
  } else if (!due && overlay.value?.kind === 'bidding') {
    overlay.value = undefined;
  }
}, {immediate: true});
// Reaching the READY waiting state arms the auto-join. Never disarmed by
// the state flipping (the launch flips it in the same model change the
// seat link arrives in) — only by leaving the surface.
watch(() => vm.value?.readyWaiting, (ready: boolean | undefined): void => {
  if (ready === true) {
    autoJoinArmed.value = true;
  }
}, {immediate: true});
// THE AUTO-JOIN: the launch push flips the current slot to `active` with
// the viewer's own seat link — a ready participant enters by itself. The
// TRANSITION is what fires (a map opened onto an already-active mission
// offers the explicit join verb instead).
watch(() => activeSeatLink.value, (link: {playerId: string, gameId?: string} | undefined): void => {
  if (link !== undefined && autoJoinArmed.value && !joining.value) {
    enterMission(link.playerId, link.gameId);
  }
});
// The embedded host reads the map's overlay + confirm verb through the
// module mirror (a host cannot reactively read a child through its ref).
watch(() => overlay.value, (overlay: MapOverlay | undefined): void => {
  campaignMapUi.overlay = overlay?.kind;
}, {immediate: true});
watch(() => carryConfirmLabel.value, (label: string): void => {
  campaignMapUi.carryConfirmLabel = label;
}, {immediate: true});
// The embedded host renders the map's OWN verbs — mirrored whole, so the
// host's bar can never drift from what the map actually honours.
watch(() => commands.value, (cmds: ReadonlyArray<ConsoleCommand>): void => {
  campaignMapUi.commands = cmds;
}, {immediate: true});

onMounted(async () => {
  if (props.embedded) {
    // The HOST already opened the campaign (campaignState is module-level);
    // the scene lands settled on the campaign's current mission.
    cursor.value = {zone: 'route', index: vm.value?.currentSlot ?? 0};
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
          revealPlaying.value = true;
          flow.after(2600, 'the generation reveal ends', () => {
            revealPlaying.value = false;
          });
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
    cursor.value = {zone: 'route', index: vm.value?.currentSlot ?? 0};
    await nextTick();
    releaseModel?.();
  } else {
    armSceneDestination();
  }
  offPad = installMenuPad((intent) => onIntent(intent));
});
onBeforeUnmount(() => {
  offPad?.();
  for (const flight of carryFlights) {
    flight.dispose();
  }
  resetCampaignMapUi();
  if (!props.embedded) {
    stopCampaignWatch();
  }
});
defineExpose({handleIntent});
</script>
