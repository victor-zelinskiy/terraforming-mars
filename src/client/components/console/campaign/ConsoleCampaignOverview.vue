<template>
  <div class="con-cmpov" :class="{'con-cmpov--layered': ui.level !== 'route'}">
    <template v-if="vm === undefined">
      <div class="con-cmpov__load">{{ $t('Loading the campaign…') }}</div>
    </template>
    <template v-else>
      <!-- Base layer: the campaign header line + the route + the seats. -->
      <div class="con-cmpov__base">
        <div class="con-cmpov__headline">
          <span class="con-cmpov__name">{{ vm.name }}</span>
          <span class="con-cmpov__progress">{{ progressText }}</span>
          <span class="con-cmpov__chip">{{ $t(vm.phaseLabel) }}</span>
        </div>

        <div class="con-cmpov__stage">
          <div class="con-cmpov__lane" aria-hidden="true"><div class="con-cmpov__lane-fill" :style="laneFillStyle"></div></div>
          <div class="con-cmpov__route">
            <div v-for="m in vm.missions" :key="m.slot" class="con-cmpov__node" :style="nodeRevealStyle(m.slot)">
              <div v-if="m.isCurrent" class="con-cmpov__party">
                <span v-for="seat in vm.seats" :key="seat.seat" class="con-cmpov__party-cube" :class="`player_bg_color_${seat.color}`"></span>
              </div>
              <CampaignMissionCard
                :mission="m"
                :cursor="ui.level === 'route' && ui.zone === 'route' && ui.routeIndex === m.slot"
                :reveal="true"
                :reveal-delay-ms="180 + m.slot * 120"
                @click="onRouteClick(m.slot)" />
            </div>
          </div>
        </div>

        <!-- Participant rows on ONE column grid: identity · titles · TP ·
             corporations start on the same verticals for every row (a bot
             and a long human name alike). The TP semantics note is stated
             ONCE, under the list, tied to the TP column by its own term. -->
        <div class="con-cmpov__seats">
          <div
            v-for="(seat, i) in vm.seats"
            :key="seat.seat"
            class="con-cmpov__seat"
            :class="seatClasses(seat, i)"
            :style="seatRevealStyle(i)"
            @click="onSeatClick(i)">
            <span class="con-cmpov__seat-cube" :class="`player_bg_color_${seat.color}`"></span>
            <span class="con-cmpov__seat-name">
              <span class="con-cmpov__seat-label">{{ seatDisplayName(seat) }}</span>
              <span v-if="seat.isYou" class="con-cmpov__seat-you">{{ $t('you') }}</span>
              <span v-if="seat.isChampion" class="con-cmpov__seat-crown">{{ $t('Campaign champion') }}</span>
            </span>
            <span class="con-cmpov__seat-titles">
              <img v-for="(t, ti) in seat.titles" :key="ti" class="con-cmpov__seat-title" :src="titleArtUrl(t.title)" :alt="$t(titleLabel(t.title))">
            </span>
            <span class="con-cmpov__seat-tp">{{ tpText(seat.titlePoints) }}</span>
            <span class="con-cmpov__seat-corps">
              <span v-for="corp in seat.corps" :key="corp.name" class="con-cmpov__seat-corp">
                <span v-if="corp.missionSlot !== undefined" class="con-cmpov__seat-corp-ord">{{ corp.missionSlot + 1 }}</span>
                {{ $t(corp.name) }}
              </span>
            </span>
            <span class="con-cmpov__seat-bonus">{{ seat.pendingBonus > 0 ? pendingBonusText(seat.pendingBonus) : '' }}</span>
          </div>
          <div class="con-cmpov__seats-note">{{ $t('TP') }} — {{ $t(tpNote) }}</div>
        </div>
      </div>

      <!-- Nested read-only layers: mission inspect / legacy, one at a time,
           opening FROM the pressed object (transform-origin carries the
           origin — the enlarged board is the card's own continuation). -->
      <Transition name="cov-step">
        <div v-if="ui.level === 'mission' && inspectMission !== undefined" key="mission" class="con-cmpov__layer" :style="layerOriginStyle">
          <div class="con-cmpov__layer-head">
            <span class="con-cmpov__layer-kicker">{{ missionKicker }}</span>
            <span class="con-cmpov__layer-board">{{ $t(inspectBoardLabel) }}</span>
          </div>
          <CampaignMissionInspect
            :mission="inspectMission"
            :details="inspectDetails"
            :you-seat="vm.youSeat"
            :bot-corporation="botCorporation"
            :live-generation="inspectLiveGeneration"
            :party="inspectParty"
            :mission-count="vm.missionCount" />
        </div>
        <div v-else-if="ui.level === 'legacy' && legacyVm !== undefined" key="legacy" class="con-cmpov__layer" :style="layerOriginStyle">
          <div class="con-cmpov__layer-head">
            <span class="con-cmpov__layer-cube" :class="`player_bg_color_${legacyVm.color}`"></span>
            <span class="con-cmpov__layer-kicker">{{ legacyDisplayName }}</span>
            <span class="con-cmpov__layer-board">{{ $t('Legacy') }}</span>
          </div>
          <CampaignSeatLegacy :legacy="legacyVm" :carried-models="legacyCarriedModels" :cursor-index="legacyCards.length > 0 ? ui.legacyCursor : undefined" />
        </div>
      </Transition>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {campaignState} from '@/client/console/campaign/campaignState';
import {campaignOverviewUi, resetCampaignOverview} from '@/client/console/campaign/campaignOverviewUi';
import {
  CampaignOverviewVm,
  MissionDetailsVm,
  OverviewLiveContext,
  OverviewMissionCard,
  OverviewSeatRow,
  SeatLegacyVm,
  buildCampaignOverview,
  buildMissionDetails,
  buildSeatLegacy,
  tpStatusLabel,
} from '@/client/console/campaign/campaignOverviewModel';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import {TitleName} from '@/common/campaign/CampaignTypes';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import CampaignMissionCard from './CampaignMissionCard.vue';
import CampaignMissionInspect from './CampaignMissionInspect.vue';
import CampaignSeatLegacy from './CampaignSeatLegacy.vue';

/**
 * THE IN-GAME CAMPAIGN OVERVIEW — the Information workspace's «Кампания»
 * route: the full campaign inside the live mission, read-only by
 * construction (viewing NEVER launches, re-grants or mutates campaign
 * state; the fullscreen card zoom gets no select bridge). The composition
 * is the campaign's own: the four-mission route dominates, the participant
 * rows read second, details unfold as nested layers of the same surface.
 *
 * Shares every building block with the standalone Campaign Map
 * (CampaignMissionCard / CampaignMissionResults / CampaignSeatLegacy over
 * campaignOverviewModel), so the two contexts cannot drift. Input arrives
 * through `handleIntent` (the Information host routes the pad); cursors and
 * the command contract live in `campaignOverviewUi`.
 */
export default defineComponent({
  name: 'ConsoleCampaignOverview',
  components: {CampaignMissionCard, CampaignMissionInspect, CampaignSeatLegacy},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewedColor: {type: String as PropType<Color>, required: true},
  },
  data() {
    return {
      ui: campaignOverviewUi,
      state: campaignState,
      /** transform-origin of the opening layer (% of this surface). */
      layerOrigin: {x: 50, y: 40},
    };
  },
  computed: {
    liveContext(): OverviewLiveContext | undefined {
      const contract = this.playerView.game.gameOptions.campaign;
      if (contract === undefined) {
        return undefined;
      }
      const corpsBySeat: Record<number, ReadonlyArray<CardName>> = {};
      for (const grant of contract.grants) {
        const player = this.playerView.players.find((p) => p.color === grant.color);
        if (player === undefined) {
          continue;
        }
        corpsBySeat[grant.seat] = player.tableau
          .filter((c) => {
            try {
              return getCard(c.name)?.type === CardType.CORPORATION;
            } catch (err) {
              return false;
            }
          })
          .map((c) => c.name);
      }
      return {missionSlot: contract.missionSlot, corpsBySeat};
    },
    vm(): CampaignOverviewVm | undefined {
      const model = this.state.model;
      if (model === undefined) {
        return undefined;
      }
      return buildCampaignOverview(model, this.liveContext);
    },
    progressText(): string {
      const vm = this.vm;
      return vm === undefined ? '' : translateTextWithParams(vm.progressLabel, [...vm.progressParams]);
    },
    tpNote(): string {
      const vm = this.vm;
      return vm === undefined || vm.seats.length === 0 ? '' : tpStatusLabel(vm.seats[0].tpStatus);
    },
    laneFillStyle(): Record<string, string> {
      const vm = this.vm;
      if (vm === undefined) {
        return {};
      }
      const n = vm.missionCount;
      const done = vm.phase === 'finished' ? n : Math.min(vm.pointer + (vm.phase === 'missionActive' ? 0.5 : 0), n);
      return {width: `${Math.round((done / Math.max(1, n - 0.5)) * 100)}%`};
    },
    botCorporation(): MarsBotCorpId | undefined {
      return this.state.model?.progression.botCorporation;
    },
    /** The mission the inspect layer stands on (any state). */
    inspectMission(): OverviewMissionCard | undefined {
      return this.vm?.missions[this.ui.missionSlot];
    },
    /** The committed results of the inspected mission (undefined elsewhere). */
    inspectDetails(): MissionDetailsVm | undefined {
      const model = this.state.model;
      return model === undefined ? undefined : buildMissionDetails(model, this.ui.missionSlot);
    },
    missionKicker(): string {
      return translateTextWithParams('Mission ${0}', [String(this.ui.missionSlot + 1)]);
    },
    inspectBoardLabel(): string {
      const mission = this.inspectMission;
      return mission === undefined ? '' : mapLabelKey(mission.board);
    },
    /** The live game's generation — only honest for the OPEN mission. */
    inspectLiveGeneration(): number | undefined {
      return this.ui.missionSlot === this.liveContext?.missionSlot ?
        this.playerView.game.generation : undefined;
    },
    /** Participant chips of the active mission (visible names, resolved). */
    inspectParty(): ReadonlyArray<{color: string, name: string}> {
      return (this.vm?.seats ?? []).map((seat) => ({color: seat.color, name: this.seatDisplayName(seat)}));
    },
    /** The inspect layer's own inspectable cards (the viewer's carried-out
     *  of a committed mission — same ring the old results layer offered). */
    inspectCards(): ReadonlyArray<CardModel> {
      return (this.inspectDetails?.outgoing?.carried.yourCards ?? []).map((name) => ({name} as CardModel));
    },
    legacyDisplayName(): string {
      const legacy = this.legacyVm;
      if (legacy === undefined) {
        return '';
      }
      return participantDisplayName({name: legacy.name, isMarsBot: legacy.kind === 'bot'});
    },
    legacyVm(): SeatLegacyVm | undefined {
      const model = this.state.model;
      if (model === undefined || this.vm === undefined) {
        return undefined;
      }
      const isYou = model.you?.seat === this.ui.legacySeat;
      return buildSeatLegacy(model, this.ui.legacySeat, {
        contextSlot: this.vm.contextSlot,
        live: this.liveContext,
        selfBonusGranted: isYou ? this.playerView.campaignBonusGranted : undefined,
      });
    },
    /** The viewer's own carried cards as LIVE CardModels (richest source). */
    legacyCarriedModels(): ReadonlyArray<CardModel> | undefined {
      const model = this.state.model;
      if (model === undefined || model.you?.seat !== this.ui.legacySeat) {
        return undefined;
      }
      return this.playerView.campaignCarriedCards;
    },
    /** The legacy layer's inspectable ring: corps then carried, in order. */
    legacyCards(): ReadonlyArray<CardModel> {
      const legacy = this.legacyVm;
      if (legacy === undefined) {
        return [];
      }
      const corps: Array<CardModel> = legacy.corps.map((c) => ({name: c.name} as CardModel));
      const carried = this.legacyCarriedModels ?? (legacy.carried.names ?? []).map((name) => ({name} as CardModel));
      return [...corps, ...carried];
    },
    layerOriginStyle(): Record<string, string> {
      return {'--cov-ox': `${this.layerOrigin.x}%`, '--cov-oy': `${this.layerOrigin.y}%`};
    },
    footCommands(): Array<ConsoleCommand> {
      const vm = this.vm;
      if (vm === undefined) {
        return [{control: 'back', label: 'To overview'}];
      }
      if (this.ui.level === 'mission') {
        const cmds: Array<ConsoleCommand> = [];
        if (this.inspectCards.length > 0) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Back'});
        return cmds;
      }
      if (this.ui.level === 'legacy') {
        const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Choose'}];
        if (this.legacyCards.length > 0) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Back'});
        return cmds;
      }
      // Base layer: the verb follows the cursor. EVERY mission is
      // inspectable — the layer is honest to its state, so the verb never
      // dead-ends on a future card.
      const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Navigate'}];
      if (this.ui.zone === 'route') {
        cmds.push({control: 'confirm', label: 'Inspect the mission'});
      } else {
        cmds.push({control: 'confirm', label: 'Open: participant legacy'});
      }
      cmds.push({control: 'back', label: 'To overview'});
      return cmds;
    },
  },
  watch: {
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        this.ui.barCommands = cmds;
      },
    },
  },
  mounted() {
    // A mount IS the entry (the route branch remounts per entry): fresh
    // cursors, focus on the current mission. Seat switches and nested-layer
    // returns never remount this branch, so they never replay the scene.
    resetCampaignOverview(this.liveContext?.missionSlot ?? this.state.model?.pointer ?? 0);
    // Warm the legacy faces (corps + own carried) so the nested layers open
    // with decoded art.
    const names: Array<CardName> = [];
    for (const seat of this.vm?.seats ?? []) {
      for (const corp of seat.corps) {
        names.push(corp.name);
      }
    }
    for (const card of this.playerView.campaignCarriedCards ?? []) {
      names.push(card.name);
    }
    if (names.length > 0) {
      preloadPremiumCardArt(names);
    }
  },
  beforeUnmount() {
    this.ui.barCommands = undefined;
  },
  methods: {
    titleArtUrl,
    titleLabel(title: TitleName): string {
      return TITLE_LABEL[title];
    },
    tpText(points: number): string {
      return translateTextWithParams('${0} TP', [String(points)]);
    },
    pendingBonusText(amount: number): string {
      return translateTextWithParams('Next mission: +${0} M€', [String(amount)]);
    },
    seatClasses(seat: OverviewSeatRow, index: number): Record<string, boolean> {
      return {
        'con-cmpov__seat--cursor': this.ui.level === 'route' && this.ui.zone === 'seats' && this.ui.seatIndex === index,
        'con-cmpov__seat--viewed': seat.color === this.viewedColor,
        'con-cmpov__seat--champion': seat.isChampion,
      };
    },
    nodeRevealStyle(slot: number): Record<string, string> {
      return {'--cov-i': String(slot)};
    },
    seatRevealStyle(index: number): Record<string, string> {
      return {'--cov-i': String(index)};
    },
    /** The visible participant label — the ONE name helper. */
    seatDisplayName(seat: OverviewSeatRow): string {
      return participantDisplayName({name: seat.name, isMarsBot: seat.kind === 'bot'});
    },
    onRouteClick(slot: number): void {
      this.ui.zone = 'route';
      this.ui.routeIndex = slot;
      this.openMissionInspect(slot);
    },
    onSeatClick(index: number): void {
      this.ui.zone = 'seats';
      this.ui.seatIndex = index;
      this.openLegacy(index);
    },
    originFromEl(selector: string): void {
      const host = this.$el as HTMLElement | null;
      const el = host?.querySelector<HTMLElement>(selector);
      if (host === null || host === undefined || el === null || el === undefined) {
        this.layerOrigin = {x: 50, y: 40};
        return;
      }
      const hr = host.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      if (hr.width <= 0 || hr.height <= 0) {
        this.layerOrigin = {x: 50, y: 40};
        return;
      }
      this.layerOrigin = {
        x: Math.round(((er.left + er.width / 2 - hr.left) / hr.width) * 100),
        y: Math.round(((er.top + er.height / 2 - hr.top) / hr.height) * 100),
      };
    },
    openMissionInspect(slot: number): void {
      const mission = this.vm?.missions[slot];
      if (mission === undefined) {
        return;
      }
      this.originFromEl(`.con-cmpov__node:nth-child(${slot + 1})`);
      this.ui.missionSlot = slot;
      this.ui.level = 'mission';
    },
    openLegacy(index: number): void {
      const seat = this.vm?.seats[index];
      if (seat === undefined) {
        return;
      }
      this.originFromEl(`.con-cmpov__seat:nth-child(${index + 1})`);
      this.ui.legacySeat = seat.seat;
      this.ui.legacyCursor = 0;
      this.ui.level = 'legacy';
    },
    closeLayer(): void {
      this.ui.level = 'route';
    },
    zoomLegacyCursor(): void {
      const cards = this.legacyCards;
      if (cards.length === 0) {
        return;
      }
      const index = Math.min(this.ui.legacyCursor, cards.length - 1);
      openConsoleCardZoom([...cards], index, undefined, undefined, {
        contextLabel: 'Legacy',
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement,
          (i) => `cleg:${cards[i]?.name ?? ''}:${i}`,
          (i) => {
            this.ui.legacyCursor = i;
          },
        ),
      });
    },
    zoomInspectCards(): void {
      const cards = this.inspectCards;
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
    /** The Information host routes the pad here while the route is up.
     *  Returns true when the intent was consumed (B at the base layer is
     *  NOT — the host walks back to the summary). */
    handleIntent(intent: GamepadIntent): boolean {
      const vm = this.vm;
      if (vm === undefined) {
        return false;
      }
      if (this.ui.level === 'mission') {
        if (intent.kind === 'press' && intent.button === 'back') {
          this.closeLayer();
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'secondary') {
          this.zoomInspectCards();
          return true;
        }
        return intent.kind === 'press' || intent.kind === 'nav';
      }
      if (this.ui.level === 'legacy') {
        if (intent.kind === 'press' && intent.button === 'back') {
          this.closeLayer();
          return true;
        }
        if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
          const n = this.legacyCards.length;
          if (n > 0) {
            const step = intent.dir === 'left' ? -1 : 1;
            this.ui.legacyCursor = Math.max(0, Math.min(n - 1, this.ui.legacyCursor + step));
          }
          return true;
        }
        if (intent.kind === 'press' && (intent.button === 'secondary' || intent.button === 'confirm')) {
          this.zoomLegacyCursor();
          return true;
        }
        return intent.kind === 'press' || intent.kind === 'nav';
      }
      // Base layer.
      if (intent.kind === 'nav') {
        this.navigateBase(intent.dir);
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'confirm') {
        if (this.ui.zone === 'route') {
          this.openMissionInspect(this.ui.routeIndex);
        } else {
          this.openLegacy(this.ui.seatIndex);
        }
        return true;
      }
      return false;
    },
    navigateBase(dir: 'up' | 'down' | 'left' | 'right'): void {
      const vm = this.vm;
      if (vm === undefined) {
        return;
      }
      if (this.ui.zone === 'route') {
        if (dir === 'left') {
          this.ui.routeIndex = Math.max(0, this.ui.routeIndex - 1);
        } else if (dir === 'right') {
          this.ui.routeIndex = Math.min(vm.missions.length - 1, this.ui.routeIndex + 1);
        } else if (dir === 'down') {
          this.ui.zone = 'seats';
          this.ui.seatIndex = Math.min(this.ui.seatIndex, vm.seats.length - 1);
        }
        return;
      }
      if (dir === 'up') {
        if (this.ui.seatIndex === 0) {
          this.ui.zone = 'route';
        } else {
          this.ui.seatIndex--;
        }
      } else if (dir === 'down') {
        this.ui.seatIndex = Math.min(vm.seats.length - 1, this.ui.seatIndex + 1);
      }
    },
  },
});
</script>
