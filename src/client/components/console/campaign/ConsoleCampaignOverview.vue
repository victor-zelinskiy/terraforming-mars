<template>
  <div ref="root" class="con-cmpov" :class="{'con-cmpov--layered': ui.level !== 'route'}">
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
            :class="[seatClasses(seat, i), {'con-cmpov__seat--tenders': vm.rewardMode === 'tenders'}]"
            :style="seatRevealStyle(i)"
            @click="onSeatClick(i)">
            <span class="con-cmpov__seat-cube" :class="`player_bg_color_${seat.color}`"></span>
            <span class="con-cmpov__seat-name">
              <span class="con-cmpov__seat-label">{{ seatDisplayName(seat) }}</span>
              <span v-if="seat.isYou" class="con-cmpov__seat-you">{{ $t('you') }}</span>
              <span v-if="seat.isChampion" class="con-cmpov__seat-crown">{{ $t('Campaign champion') }}</span>
            </span>
            <template v-if="vm.rewardMode === 'tenders'">
              <!-- The holdings as their certificates in miniature (the titles' emblems' register) — the legacy layer
                   (A) walks them like cards and X opens the viewer. -->
              <span class="con-cmpov__seat-titles con-cmpov__seat-tenders" data-cmpov-seat-tenders>
                <span v-for="t in seat.tenders" :key="t.instance" class="con-tmini" :class="`con-tmini--${t.status}`"
                      :data-cmpov-tender="t.instance" :data-cmpov-tender-status="t.status">
                  <ConsoleTenderCard :id="t.id" size="table" :state="tenderCardStateOf(t.status)" />
                </span>
              </span>
              <span class="con-cmpov__seat-tp">{{ seat.tenders.length > 0 ? tenderCountText(seat.tenders.length) : $t('No tenders yet') }}</span>
            </template>
            <template v-else>
              <span class="con-cmpov__seat-titles">
                <img v-for="(t, ti) in seat.titles" :key="ti" class="con-cmpov__seat-title" :src="titleArtUrl(t.title)" :alt="$t(titleLabel(t.title))">
              </span>
              <span class="con-cmpov__seat-tp">{{ tpText(seat.titlePoints) }}</span>
            </template>
            <span class="con-cmpov__seat-corps">
              <span v-for="corp in seat.corps" :key="corp.name" class="con-cmpov__seat-corp"
                    :data-bot-holding="corp.holding === true ? 'true' : undefined">
                <span v-if="corp.missionSlot !== undefined" class="con-cmpov__seat-corp-ord">{{ corp.missionSlot + 1 }}</span>
                {{ $t(corp.name) }}
              </span>
            </span>
            <span class="con-cmpov__seat-bonus">{{ seat.pendingBonus > 0 ? pendingBonusText(seat.pendingBonus) : '' }}</span>
          </div>
          <div v-if="vm.rewardMode === 'tenders'" class="con-cmpov__seats-note" data-cmpov-note="tenders">{{ $t('Tenders') }} — {{ $t(vm.tenderNote) }}</div>
          <div v-else class="con-cmpov__seats-note">{{ $t('TP') }} — {{ $t(tpNote) }}</div>
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
          <CampaignSeatLegacy :legacy="legacyVm" :carried-models="legacyCarriedModels" :cursor-index="legacyRingSize > 0 ? ui.legacyCursor : undefined" />
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
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
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import CampaignMissionCard from './CampaignMissionCard.vue';
import CampaignMissionInspect from './CampaignMissionInspect.vue';
import CampaignSeatLegacy from './CampaignSeatLegacy.vue';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import {tenderCardStateOf} from '@/client/console/campaign/tenderPortfolio';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';
import {TenderHoldingView} from '@/client/console/campaign/tenderHoldings';

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
defineOptions({name: 'ConsoleCampaignOverview'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  viewedColor: {type: String as PropType<Color>, required: true},
});

const root = useTemplateRef<HTMLElement>('root');
const ui = campaignOverviewUi;
const state = campaignState;
/** transform-origin of the opening layer (% of this surface). */
const layerOrigin = ref({x: 50, y: 40});

const liveContext = computed((): OverviewLiveContext | undefined => {
  const contract = props.playerView.game.gameOptions.campaign;
  if (contract === undefined) {
    return undefined;
  }
  const corpsBySeat: Record<number, ReadonlyArray<CardName>> = {};
  for (const grant of contract.grants) {
    const player = props.playerView.players.find((p) => p.color === grant.color);
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
});
const vm = computed((): CampaignOverviewVm | undefined => {
  const model = state.model;
  if (model === undefined) {
    return undefined;
  }
  return buildCampaignOverview(model, liveContext.value);
});
const progressText = computed((): string => {
  const vmNow = vm.value;
  return vmNow === undefined ? '' : translateTextWithParams(vmNow.progressLabel, [...vmNow.progressParams]);
});
const tpNote = computed((): string => {
  const vmNow = vm.value;
  return vmNow === undefined || vmNow.seats.length === 0 ? '' : tpStatusLabel(vmNow.seats[0].tpStatus);
});
const laneFillStyle = computed((): Record<string, string> => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return {};
  }
  const n = vmNow.missionCount;
  const done = vmNow.phase === 'finished' ? n : Math.min(vmNow.pointer + (vmNow.phase === 'missionActive' ? 0.5 : 0), n);
  return {width: `${Math.round((done / Math.max(1, n - 0.5)) * 100)}%`};
});
const botCorporation = computed((): MarsBotCorpId | undefined => {
  return state.model?.progression.botCorporation;
});
/** The mission the inspect layer stands on (any state). */
const inspectMission = computed((): OverviewMissionCard | undefined => {
  return vm.value?.missions[ui.missionSlot];
});
/** The committed results of the inspected mission (undefined elsewhere). */
const inspectDetails = computed((): MissionDetailsVm | undefined => {
  const model = state.model;
  return model === undefined ? undefined : buildMissionDetails(model, ui.missionSlot);
});
const missionKicker = computed((): string => {
  return translateTextWithParams('Mission ${0}', [String(ui.missionSlot + 1)]);
});
const inspectBoardLabel = computed((): string => {
  const mission = inspectMission.value;
  return mission === undefined ? '' : mapLabelKey(mission.board);
});
/** The live game's generation — only honest for the OPEN mission. */
const inspectLiveGeneration = computed((): number | undefined => {
  return ui.missionSlot === liveContext.value?.missionSlot ?
    props.playerView.game.generation : undefined;
});
/** Participant chips of the active mission (visible names, resolved). */
const inspectParty = computed((): ReadonlyArray<{color: string, name: string}> => {
  return (vm.value?.seats ?? []).map((seat) => ({color: seat.color, name: seatDisplayName(seat)}));
});
/** The inspect layer's own inspectable cards (the viewer's carried-out
 *  of a committed mission — same ring the old results layer offered). */
const inspectCards = computed((): ReadonlyArray<CardModel> => {
  return (inspectDetails.value?.outgoing?.carried.yourCards ?? []).map((name) => ({name} as CardModel));
});
const legacyDisplayName = computed((): string => {
  const legacy = legacyVm.value;
  if (legacy === undefined) {
    return '';
  }
  return participantDisplayName({name: legacy.name, isMarsBot: legacy.kind === 'bot'});
});
const legacyVm = computed((): SeatLegacyVm | undefined => {
  const model = state.model;
  if (model === undefined || vm.value === undefined) {
    return undefined;
  }
  const isYou = model.you?.seat === ui.legacySeat;
  return buildSeatLegacy(model, ui.legacySeat, {
    contextSlot: vm.value.contextSlot,
    live: liveContext.value,
    selfBonusGranted: isYou ? props.playerView.campaignBonusGranted : undefined,
  });
});
/** The viewer's own carried cards as LIVE CardModels (richest source). */
const legacyCarriedModels = computed((): ReadonlyArray<CardModel> | undefined => {
  const model = state.model;
  if (model === undefined || model.you?.seat !== ui.legacySeat) {
    return undefined;
  }
  return props.playerView.campaignCarriedCards;
});
/** The legacy layer's inspectable CARDS: corps then carried, in order (the ring's first stretch). */
const legacyCards = computed((): ReadonlyArray<CardModel> => {
  const legacy = legacyVm.value;
  if (legacy === undefined) {
    return [];
  }
  const corps: Array<CardModel> = legacy.corps.map((c) => ({name: c.name} as CardModel));
  const carried = legacyCarriedModels.value ?? (legacy.carried.names ?? []).map((name) => ({name} as CardModel));
  return [...corps, ...carried];
});
/** The legacy layer's TENDERS — the ring's second stretch (empty on a titles campaign). */
const legacyTenders = computed((): ReadonlyArray<TenderHoldingView> => {
  return legacyVm.value?.tenders ?? [];
});
/** ONE ring over the layer: corps → carried → tenders — a certificate is walked like a card and X opens it. */
const legacyRingSize = computed((): number => {
  return legacyCards.value.length + legacyTenders.value.length;
});
const layerOriginStyle = computed((): Record<string, string> => {
  return {'--cov-ox': `${layerOrigin.value.x}%`, '--cov-oy': `${layerOrigin.value.y}%`};
});
const footCommands = computed((): Array<ConsoleCommand> => {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return [{control: 'back', label: 'To overview'}];
  }
  if (ui.level === 'mission') {
    const cmds: Array<ConsoleCommand> = [];
    if (inspectCards.value.length > 0) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push({control: 'back', label: 'Back'});
    return cmds;
  }
  if (ui.level === 'legacy') {
    const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Choose'}];
    if (legacyRingSize.value > 0) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push({control: 'back', label: 'Back'});
    return cmds;
  }
  // Base layer: the verb follows the cursor. EVERY mission is
  // inspectable — the layer is honest to its state, so the verb never
  // dead-ends on a future card.
  const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Navigate'}];
  if (ui.zone === 'route') {
    cmds.push({control: 'confirm', label: 'Inspect the mission'});
  } else {
    cmds.push({control: 'confirm', label: 'Open: participant legacy'});
  }
  cmds.push({control: 'back', label: 'To overview'});
  return cmds;
});

function titleLabel(title: TitleName): string {
  return TITLE_LABEL[title];
}
function tpText(points: number): string {
  return translateTextWithParams('${0} TP', [String(points)]);
}
function tenderCountText(count: number): string {
  return translateTextWithParams('${0} tender(s)', [String(count)]);
}
function pendingBonusText(amount: number): string {
  return translateTextWithParams('Next mission: +${0} M€', [String(amount)]);
}
function seatClasses(seat: OverviewSeatRow, index: number): Record<string, boolean> {
  return {
    'con-cmpov__seat--cursor': ui.level === 'route' && ui.zone === 'seats' && ui.seatIndex === index,
    'con-cmpov__seat--viewed': seat.color === props.viewedColor,
    'con-cmpov__seat--champion': seat.isChampion,
  };
}
function nodeRevealStyle(slot: number): Record<string, string> {
  return {'--cov-i': String(slot)};
}
function seatRevealStyle(index: number): Record<string, string> {
  return {'--cov-i': String(index)};
}
/** The visible participant label — the ONE name helper. */
function seatDisplayName(seat: OverviewSeatRow): string {
  return participantDisplayName({name: seat.name, isMarsBot: seat.kind === 'bot'});
}
function onRouteClick(slot: number): void {
  ui.zone = 'route';
  ui.routeIndex = slot;
  openMissionInspect(slot);
}
function onSeatClick(index: number): void {
  ui.zone = 'seats';
  ui.seatIndex = index;
  openLegacy(index);
}
function originFromEl(selector: string): void {
  const host = root.value;
  const el = host?.querySelector<HTMLElement>(selector);
  if (host === null || host === undefined || el === null || el === undefined) {
    layerOrigin.value = {x: 50, y: 40};
    return;
  }
  const hr = host.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (hr.width <= 0 || hr.height <= 0) {
    layerOrigin.value = {x: 50, y: 40};
    return;
  }
  layerOrigin.value = {
    x: Math.round(((er.left + er.width / 2 - hr.left) / hr.width) * 100),
    y: Math.round(((er.top + er.height / 2 - hr.top) / hr.height) * 100),
  };
}
function openMissionInspect(slot: number): void {
  const mission = vm.value?.missions[slot];
  if (mission === undefined) {
    return;
  }
  originFromEl(`.con-cmpov__node:nth-child(${slot + 1})`);
  ui.missionSlot = slot;
  ui.level = 'mission';
}
function openLegacy(index: number): void {
  const seat = vm.value?.seats[index];
  if (seat === undefined) {
    return;
  }
  originFromEl(`.con-cmpov__seat:nth-child(${index + 1})`);
  ui.legacySeat = seat.seat;
  ui.legacyCursor = 0;
  ui.level = 'legacy';
}
function closeLayer(): void {
  ui.level = 'route';
}
function zoomLegacyCursor(): void {
  const cards = legacyCards.value;
  const tenders = legacyTenders.value;
  if (ui.legacyCursor >= cards.length && tenders.length > 0) {
    // The cursor stands on a CERTIFICATE: the seat's holdings in the one fullscreen viewer (the rule in its right
    // column, the lore in the gutter), the focused one first, LB/RB in lockstep with the layer's cursor.
    const at = Math.min(ui.legacyCursor - cards.length, tenders.length - 1);
    const list = tenders.map((t) => tenderZoomEntry(t.id, {instance: t.instance, state: tenderCardStateOf(t.status)}));
    openConsoleCardZoom(list, at, undefined, undefined, {
      contextLabel: 'Tenders',
      origin: slotZoomOrigin(
        () => root.value as HTMLElement,
        (i) => `cleg:tender:${tenders[i]?.instance ?? ''}`,
        (i) => {
          ui.legacyCursor = cards.length + i;
        },
      ),
    });
    return;
  }
  if (cards.length === 0) {
    return;
  }
  const index = Math.min(ui.legacyCursor, cards.length - 1);
  openConsoleCardZoom([...cards], index, undefined, undefined, {
    contextLabel: 'Legacy',
    origin: slotZoomOrigin(
      () => root.value as HTMLElement,
      (i) => `cleg:${cards[i]?.name ?? ''}:${i}`,
      (i) => {
        ui.legacyCursor = i;
      },
    ),
  });
}
function zoomInspectCards(): void {
  const cards = inspectCards.value;
  if (cards.length === 0) {
    return;
  }
  openConsoleCardZoom([...cards], 0, undefined, undefined, {
    contextLabel: 'Legacy',
    origin: slotZoomOrigin(
      () => root.value as HTMLElement,
      (i) => `cmres:${cards[i]?.name ?? ''}:${i}`,
    ),
  });
}
/** The Information host routes the pad here while the route is up.
 *  Returns true when the intent was consumed (B at the base layer is
 *  NOT — the host walks back to the summary). */
function handleIntent(intent: GamepadIntent): boolean {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return false;
  }
  if (ui.level === 'mission') {
    if (intent.kind === 'press' && intent.button === 'back') {
      closeLayer();
      return true;
    }
    if (intent.kind === 'press' && intent.button === 'secondary') {
      zoomInspectCards();
      return true;
    }
    return intent.kind === 'press' || intent.kind === 'nav';
  }
  if (ui.level === 'legacy') {
    if (intent.kind === 'press' && intent.button === 'back') {
      closeLayer();
      return true;
    }
    if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
      const n = legacyRingSize.value;
      if (n > 0) {
        const step = intent.dir === 'left' ? -1 : 1;
        ui.legacyCursor = Math.max(0, Math.min(n - 1, ui.legacyCursor + step));
      }
      return true;
    }
    if (intent.kind === 'press' && (intent.button === 'secondary' || intent.button === 'confirm')) {
      zoomLegacyCursor();
      return true;
    }
    return intent.kind === 'press' || intent.kind === 'nav';
  }
  // Base layer.
  if (intent.kind === 'nav') {
    navigateBase(intent.dir);
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'confirm') {
    if (ui.zone === 'route') {
      openMissionInspect(ui.routeIndex);
    } else {
      openLegacy(ui.seatIndex);
    }
    return true;
  }
  return false;
}
function navigateBase(dir: 'up' | 'down' | 'left' | 'right'): void {
  const vmNow = vm.value;
  if (vmNow === undefined) {
    return;
  }
  if (ui.zone === 'route') {
    if (dir === 'left') {
      ui.routeIndex = Math.max(0, ui.routeIndex - 1);
    } else if (dir === 'right') {
      ui.routeIndex = Math.min(vmNow.missions.length - 1, ui.routeIndex + 1);
    } else if (dir === 'down') {
      ui.zone = 'seats';
      ui.seatIndex = Math.min(ui.seatIndex, vmNow.seats.length - 1);
    }
    return;
  }
  if (dir === 'up') {
    if (ui.seatIndex === 0) {
      ui.zone = 'route';
    } else {
      ui.seatIndex--;
    }
  } else if (dir === 'down') {
    ui.seatIndex = Math.min(vmNow.seats.length - 1, ui.seatIndex + 1);
  }
}

watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  ui.barCommands = cmds;
}, {immediate: true, deep: true});

onMounted(() => {
  // A mount IS the entry (the route branch remounts per entry): fresh
  // cursors, focus on the current mission. Seat switches and nested-layer
  // returns never remount this branch, so they never replay the scene.
  resetCampaignOverview(liveContext.value?.missionSlot ?? state.model?.pointer ?? 0);
  // Warm the legacy faces (corps + own carried) so the nested layers open
  // with decoded art.
  const names: Array<CardName> = [];
  for (const seat of vm.value?.seats ?? []) {
    for (const corp of seat.corps) {
      names.push(corp.name);
    }
  }
  for (const card of props.playerView.campaignCarriedCards ?? []) {
    names.push(card.name);
  }
  if (names.length > 0) {
    preloadPremiumCardArt(names);
  }
});
onBeforeUnmount(() => {
  ui.barCommands = undefined;
});
defineExpose({handleIntent});
</script>
