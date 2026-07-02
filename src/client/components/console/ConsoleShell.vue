<template>
  <div class="con-root">
    <ConsoleStatusStrip :game="game" :players="playerView.players" :thisPlayerColor="thisPlayer.color" />

    <div v-if="bannerText !== ''" class="con-banner" :class="{'con-banner--action': bannerAction}">
      <span class="con-banner__pulse" aria-hidden="true"></span>
      <span>{{ bannerText }}</span>
      <span v-if="bannerAction && !consoleState.turnMenuOpen" class="con-banner__hint">
        <GamepadGlyph control="inspect" /><span>{{ $t('Turn menu') }}</span>
      </span>
    </div>

    <ConsoleSectionStrip :section="consoleState.section" />

    <div class="con-main">
      <!-- v-show (NOT v-if): the board must stay in the DOM — the headless
           SelectSpace attaches placement handlers to its cells. -->
      <ConsoleBoardSection v-show="consoleState.section === 'board'"
                           ref="boardSection"
                           :playerView="playerView"
                           :placementActive="placementActive" />
      <ConsoleHandSection v-if="consoleState.section === 'hand'"
                          :entries="handEntries"
                          :index="consoleState.handIndex" />
    </div>

    <ConsoleTurnMenu v-if="consoleState.turnMenuOpen" :verbs="verbs" :index="consoleState.turnMenuIndex" />
    <ConsoleSheet v-if="consoleState.sheet !== undefined" :title="sheetTitle" :rows="sheetRows" :index="consoleState.sheetIndex" />

    <!-- Console confirm panel (pass / risky conversions). -->
    <div v-if="consoleState.confirm !== undefined" class="con-confirm" role="dialog">
      <div class="con-confirm__backdrop" aria-hidden="true"></div>
      <div class="con-confirm__card">
        <div class="con-confirm__title">{{ $t(confirmTitle) }}</div>
        <div class="con-confirm__body">{{ $t(confirmBody) }}</div>
        <div class="con-confirm__actions">
          <span class="con-confirm__action con-confirm__action--yes"><GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span></span>
          <span class="con-confirm__action"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
        </div>
      </div>
    </div>

    <!-- Transient notice (unsupported verb, refusals). -->
    <transition name="con-notice">
      <div v-if="notice !== ''" class="con-notice">{{ $t(notice) }}</div>
    </transition>

    <ConsoleCommandBar :context="commandContext" :commands="commands" />

    <!-- HEADLESS transport: the WaitingFor brain (polling / holds / modal
         routing / SelectSpace placement handlers) runs unchanged; its INLINE
         rendering is hidden. Its teleported surfaces (MandatoryInputModal,
         PlacementBanner) render at body level = the iteration-1 FALLBACK. -->
    <div class="con-wf-host" aria-hidden="true">
      <waiting-for v-if="game.phase !== 'end'" ref="waitingFor" :playerView="playerView" :waitingfor="playerView.waitingFor"></waiting-for>
      <select-space v-if="convertPlantsPrompt !== undefined"
                    :playerView="playerView"
                    :playerinput="convertPlantsPrompt"
                    :onsave="onConvertPlantsSpacePicked"
                    :showsave="false"
                    :showtitle="false" />
    </div>

    <!-- Play-a-card flow: the existing premium payment/targets modal,
         re-hosted (a FALLBACK surface driven by the demoted focus engine
         until the console task wizard lands — CONSOLE_MODE_CONCEPT §17 P0). -->
    <MandatoryInputModal v-if="pendingPlayCard !== undefined"
                         :title="pendingPlayCard.title">
      <HandCardPaymentContent
        :playerView="playerView"
        :input="pendingPlayCard.input"
        :cardName="pendingPlayCard.cardName"
        @confirm="onPlayCardConfirm($event)"
        @cancel="pendingPlayCard = undefined"
        @pick-card="onUnsupportedPick"
        @pick-played-card="onUnsupportedPick"
        @pick-action="onUnsupportedPick"
        @repeat-action="onUnsupportedPick" />
    </MandatoryInputModal>

    <!-- Standard-project alt-resource payment (same fallback pattern). -->
    <MandatoryInputModal v-if="pendingStdProjectPayment !== undefined"
                         :title="pendingStdProjectPayment.title">
      <StandardProjectPaymentContent
        :playerView="playerView"
        :playerinput="pendingStdProjectPayment.input"
        @confirm="onStdProjectPaymentConfirm($event)"
        @cancel="pendingStdProjectPayment = undefined" />
    </MandatoryInputModal>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleShell — the console-first TV shell (CONSOLE_MODE_CONCEPT.md).
 * Mounted by App.vue INSTEAD of PlayerHome when consoleMode is on: same
 * game brain (playerView + a headless WaitingFor transport + the audited
 * turn-intent contracts), a Zones→Objects→Commands interface.
 *
 * Input: GamepadLayer dispatches semantic intents here
 * (registerConsoleIntentHandler). The shell CLAIMS them only while no
 * iteration-1 fallback surface (dialog / mandatory modal / draft / …) is on
 * top — `resolveScope() !== undefined` is exactly that test in console mode
 * (the desktop scope roots don't exist here). Unclaimed intents fall through
 * to the demoted DOM focus engine, which drives the fallback modals.
 *
 * Submission: byte-identical to the desktop dedicated buttons — every path
 * ends in WaitingFor.onsave()/onsaveBatch() with the same wrapped payloads
 * (turnIntents walkers mirror PlayerHome's audited contracts).
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Payment} from '@/common/inputs/Payment';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';

import WaitingFor from '@/client/components/WaitingFor.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import HandCardPaymentContent, {PlayCardPayload} from '@/client/components/handCards/HandCardPaymentContent.vue';
import StandardProjectPaymentContent from '@/client/components/payment/StandardProjectPaymentContent.vue';
import {buildStandardProjectPaymentModel, hasUsableStandardProjectAlternativeResources, standardProjectPaymentTitle} from '@/client/components/payment/paymentModelUtils';

import ConsoleStatusStrip from '@/client/components/console/ConsoleStatusStrip.vue';
import ConsoleSectionStrip from '@/client/components/console/ConsoleSectionStrip.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import ConsoleTurnMenu from '@/client/components/console/ConsoleTurnMenu.vue';
import ConsoleSheet, {ConsoleSheetRow} from '@/client/components/console/ConsoleSheet.vue';
import ConsoleBoardSection from '@/client/components/console/ConsoleBoardSection.vue';
import ConsoleHandSection, {ConsoleHandEntry} from '@/client/components/console/ConsoleHandSection.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {resolveScope} from '@/client/gamepad/focusScopes';
import {consoleState, closeConsoleLayers, cycleSection, stepIndex, registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {translateText} from '@/client/directives/i18n';
import {
  ConvertPlantsMatch,
  findAwardOptionPath,
  findConvertHeatOption,
  findConvertPlantsOption,
  findEndTurnPath,
  findMilestoneOptionPath,
  findPassPath,
  findPlayProjectCardAction,
  findStandardProjectsAction,
  inputTitleText,
  optionResponseForPath,
  turnVerbs,
  TurnVerb,
  wrapPath,
} from '@/client/console/turnIntents';
import {configureBoardInfo} from '@/client/components/board/boardInfoState';
import {journalState} from '@/client/components/journal/journalState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {useBoardAutoScale} from '@/client/utils/useBoardAutoScale';

type PendingPlayCard = {
  cardName: CardName;
  title: string | Message;
  input: SelectProjectCardToPlayModel;
};

type PendingStdProjectPayment = {
  cardName: CardName;
  title: string | Message;
  input: ReturnType<typeof buildStandardProjectPaymentModel>;
};

export default defineComponent({
  name: 'ConsoleShell',
  setup() {
    // The board auto-scale engine (writes --board-scale) — refcounted, the
    // same instance PlayerHome uses; the reused Board fills the TV stage.
    useBoardAutoScale();
  },
  components: {
    ConsoleStatusStrip,
    ConsoleSectionStrip,
    ConsoleCommandBar,
    ConsoleTurnMenu,
    ConsoleSheet,
    ConsoleBoardSection,
    ConsoleHandSection,
    GamepadGlyph,
    'waiting-for': WaitingFor,
    'select-space': SelectSpace,
    MandatoryInputModal,
    HandCardPaymentContent,
    StandardProjectPaymentContent,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      consoleState,
      pendingPlayCard: undefined as PendingPlayCard | undefined,
      pendingStdProjectPayment: undefined as PendingStdProjectPayment | undefined,
      convertPlantsPending: undefined as ConvertPlantsMatch | undefined,
      notice: '',
      noticeTimer: undefined as number | undefined,
      offIntent: undefined as (() => void) | undefined,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    verbs(): Array<TurnVerb> {
      return turnVerbs(this.playerView);
    },
    myTurn(): boolean {
      return this.verbs.some((v) => v.available);
    },
    playAction() {
      return findPlayProjectCardAction(this.playerView.waitingFor);
    },
    /** Server-driven placement (SelectSpace) or the client-side convert-plants picker. */
    placementActive(): boolean {
      return this.playerView.waitingFor?.type === 'space' || this.convertPlantsPending !== undefined;
    },
    /** The convert-plants inner SelectSpace, narrowed for the headless picker. */
    convertPlantsPrompt() {
      const p = this.convertPlantsPending?.spacePrompt;
      return p !== undefined && p.type === 'space' ? p : undefined;
    },
    placementCancellable(): boolean {
      if (this.convertPlantsPending !== undefined) {
        return true; // client-side — nothing committed yet
      }
      return this.playerView.waitingFor?.placementContext?.cancellable === true;
    },
    handEntries(): Array<ConsoleHandEntry> {
      const playable = new Set((this.playAction?.input.cards ?? [])
        .filter((c) => c.isDisabled !== true)
        .map((c) => c.name));
      const robots = new Set((this.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name));
      const all: Array<CardModel> = [
        ...this.playerView.cardsInHand,
        ...(this.thisPlayer.selfReplicatingRobotsCards ?? []),
      ];
      const entries = all.map((card) => ({
        card,
        playable: playable.has(card.name),
        robot: robots.has(card.name),
      }));
      // Playable-first, stable within groups (CONSOLE_MODE_CONCEPT §8).
      return [
        ...entries.filter((e) => e.playable),
        ...entries.filter((e) => !e.playable),
      ];
    },
    bannerText(): string {
      if (this.placementActive) {
        return translateText('Choose a location on the board');
      }
      if (this.consoleState.fallbackActive) {
        return translateText('Awaiting decision');
      }
      if (this.myTurn) {
        return translateText('Your turn');
      }
      if (this.playerView.waitingFor === undefined) {
        return translateText('Waiting for other players');
      }
      return '';
    },
    bannerAction(): boolean {
      return this.myTurn && !this.placementActive;
    },
    confirmTitle(): string {
      return this.consoleState.confirm === 'pass' ? 'Pass for this generation' : 'Convert heat';
    },
    confirmBody(): string {
      return this.consoleState.confirm === 'pass' ?
        'You will take no more actions this generation.' :
        'The temperature is already at its maximum.';
    },
    sheetTitle(): string {
      switch (this.consoleState.sheet) {
      case 'projects': return 'Standard Projects';
      case 'milestones': return 'Milestones';
      case 'awards': return 'Awards';
      default: return '';
      }
    },
    sheetRows(): Array<ConsoleSheetRow> {
      switch (this.consoleState.sheet) {
      case 'projects': {
        const cards = findStandardProjectsAction(this.playerView.waitingFor)?.input.cards ?? [];
        return cards.map((c) => ({
          key: c.name,
          title: c.name,
          meta: `${c.calculatedCost ?? 0} M€`,
          available: c.isDisabled !== true,
          reason: c.isDisabled === true ? 'Unavailable right now' : '',
        }));
      }
      case 'milestones': {
        const claimable = this.claimableTitles(findMilestoneOptionPath(this.playerView.waitingFor)?.options);
        return this.game.milestones.map((m) => {
          const claimed = m.playerName !== undefined && m.playerName !== '';
          let description = m.description ?? '';
          if (description === '') {
            try {
              description = getMilestone(m.name).description;
            } catch (err) {
              description = '';
            }
          }
          return {
            key: m.name,
            title: m.name,
            sub: description,
            meta: '8 M€',
            available: claimable.has(m.name),
            reason: claimed ? 'Claimed' : (claimable.has(m.name) ? '' : 'Unavailable right now'),
            takenBy: claimed && m.color !== undefined ? {color: m.color, name: m.playerName ?? ''} : undefined,
          };
        });
      }
      case 'awards': {
        const fundable = this.claimableTitles(findAwardOptionPath(this.playerView.waitingFor)?.options);
        const costText = this.awardCostText();
        return this.game.awards.map((a) => {
          const funded = a.playerName !== undefined && a.playerName !== '';
          let description = '';
          try {
            description = getAward(a.name).description;
          } catch (err) {
            description = '';
          }
          return {
            key: a.name,
            title: a.name,
            sub: description,
            meta: funded ? undefined : costText,
            available: fundable.has(a.name),
            reason: funded ? 'Funded' : (fundable.has(a.name) ? '' : 'Unavailable right now'),
            takenBy: funded && a.color !== undefined ? {color: a.color, name: a.playerName ?? ''} : undefined,
          };
        });
      }
      default:
        return [];
      }
    },
    commandContext(): string {
      if (this.consoleState.fallbackActive) {
        return 'Awaiting decision';
      }
      if (this.consoleState.confirm !== undefined) {
        return 'Confirmation';
      }
      if (this.consoleState.turnMenuOpen) {
        return 'Turn menu';
      }
      if (this.consoleState.sheet !== undefined) {
        return this.sheetTitle;
      }
      if (this.placementActive) {
        return 'Tile placement';
      }
      return this.consoleState.section === 'board' ? 'Board' : 'Hand';
    },
    commands(): Array<ConsoleCommand> {
      if (this.consoleState.fallbackActive) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.consoleState.confirm !== undefined) {
        return [
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.consoleState.turnMenuOpen || this.consoleState.sheet !== undefined) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Close'},
        ];
      }
      if (this.placementActive) {
        const cmds: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Place here'},
          {control: 'triggerL', label: 'Inspect all cells'},
        ];
        if (this.placementCancellable) {
          cmds.push({control: 'secondary', label: 'Cancel placement'});
        }
        return cmds;
      }
      if (this.consoleState.section === 'hand') {
        const playable = this.handEntries[this.consoleState.handIndex]?.playable === true;
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: 'Play now', enabled: playable},
          {control: 'triggerR', label: 'Next playable'},
          {control: 'inspect', label: 'Turn menu', enabled: this.myTurn},
          {control: 'bumperR', label: 'Panels'},
        ];
      }
      // Board (idle).
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'inspect', label: 'Turn menu', enabled: this.myTurn},
        {control: 'bumperR', label: 'Panels'},
        {control: 'view', label: 'Log'},
      ];
    },
  },
  watch: {
    // Server-driven placement pulls the player to the board (§10: a
    // board-target step changes the active section, the frame persists).
    placementActive(now: boolean) {
      if (now) {
        this.consoleState.section = 'board';
        closeConsoleLayers();
      }
    },
    // A fresh playerView: reconfigure the board-info fetcher (facts may have
    // changed), clamp transient indices to the fresh lists.
    playerView: {
      immediate: true,
      handler() {
        configureBoardInfo({
          participantId: this.playerView.id,
          color: this.thisPlayer.color,
          boardName: this.game.gameOptions.boardName,
          players: this.playerView.players,
        });
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, 0, this.handEntries.length);
        this.consoleState.turnMenuIndex = stepIndex(this.consoleState.turnMenuIndex, 0, this.verbs.length);
        this.consoleState.sheetIndex = stepIndex(this.consoleState.sheetIndex, 0, Math.max(1, this.sheetRows.length));
        // A resolved convert-plants prompt (server moved on) drops the local picker.
        if (this.convertPlantsPending !== undefined &&
            findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true) === undefined) {
          this.convertPlantsPending = undefined;
        }
      },
    },
  },
  methods: {
    /** Titles of the inner SelectOptions — the server's claimable/fundable set. */
    claimableTitles(options: ReadonlyArray<PlayerInputModel> | undefined): Set<string> {
      const set = new Set<string>();
      for (const o of options ?? []) {
        if (o.type === 'option') {
          const t = inputTitleText(o.title);
          if (t !== undefined) {
            set.add(t);
          }
        }
      }
      return set;
    },
    /** Award funding cost by the rules ladder (8 / 14 / 20 M€ by funded count). */
    awardCostText(): string {
      const funded = this.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
      const cost = [8, 14, 20][funded] ?? 20;
      return `${cost} M€`;
    },
    // ── input ────────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): boolean {
      // A fallback surface (mandatory modal / dialog / draft / endgame…) on
      // top → the demoted DOM focus engine drives it.
      const fallback = resolveScope() !== undefined;
      this.consoleState.fallbackActive = fallback;
      if (fallback) {
        return false;
      }
      // LT hold = free-roam over illegal cells during placement.
      if (intent.kind === 'press' && intent.button === 'triggerL') {
        if (this.placementActive) {
          this.consoleState.freeRoam = true;
        }
        return true;
      }
      if (intent.kind === 'release') {
        if (intent.button === 'triggerL') {
          this.consoleState.freeRoam = false;
        }
        return true;
      }
      if (intent.kind === 'scroll') {
        return true; // reserved (journal/list scrolling — next iteration)
      }
      if (this.consoleState.confirm !== undefined) {
        if (intent.kind === 'press' && intent.button === 'confirm') {
          this.acceptConfirm();
        } else if (intent.kind === 'press' && intent.button === 'back') {
          this.consoleState.confirm = undefined;
        }
        return true;
      }
      if (this.consoleState.turnMenuOpen) {
        this.handleTurnMenuIntent(intent);
        return true;
      }
      if (this.consoleState.sheet !== undefined) {
        this.handleSheetIntent(intent);
        return true;
      }
      return this.handleSectionIntent(intent);
    },
    handleTurnMenuIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const step = intent.dir === 'down' ? 1 : intent.dir === 'up' ? -1 : 0;
        this.consoleState.turnMenuIndex = stepIndex(this.consoleState.turnMenuIndex, step, this.verbs.length);
        return;
      }
      if (intent.kind === 'press') {
        if (intent.button === 'confirm') {
          this.executeVerb(this.verbs[this.consoleState.turnMenuIndex]);
        } else if (intent.button === 'back' || intent.button === 'inspect') {
          this.consoleState.turnMenuOpen = false;
        }
      }
    },
    handleSheetIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const step = intent.dir === 'down' ? 1 : intent.dir === 'up' ? -1 : 0;
        this.consoleState.sheetIndex = stepIndex(this.consoleState.sheetIndex, step, this.sheetRows.length);
        return;
      }
      if (intent.kind === 'press') {
        if (intent.button === 'confirm') {
          this.activateSheetRow(this.sheetRows[this.consoleState.sheetIndex]);
        } else if (intent.button === 'back') {
          this.consoleState.sheet = undefined;
        }
      }
    },
    handleSectionIntent(intent: GamepadIntent): boolean {
      if (intent.kind === 'nav') {
        this.handleSectionNav(intent.dir);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      switch (intent.button) {
      case 'bumperL':
        this.consoleState.section = cycleSection(this.consoleState.section, -1);
        return true;
      case 'bumperR':
        this.consoleState.section = cycleSection(this.consoleState.section, 1);
        return true;
      case 'inspect':
        this.consoleState.turnMenuOpen = true;
        this.consoleState.turnMenuIndex = Math.max(0, this.verbs.findIndex((v) => v.available));
        return true;
      case 'view':
        journalState.open = !journalState.open;
        return true;
      case 'confirm':
        this.handleSectionConfirm();
        return true;
      case 'secondary':
        if (this.placementActive && this.placementCancellable) {
          this.cancelPlacement();
        }
        return true;
      case 'back':
        // Base level: nothing to retreat from (never destructive).
        return true;
      default:
        return true;
      }
    },
    handleSectionNav(dir: NavDirection): void {
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        board?.move(dir);
        return;
      }
      // Hand carousel: left/right steps, triggers jump (handled as press).
      if (dir === 'left' || dir === 'right') {
        this.consoleState.handIndex = stepIndex(this.consoleState.handIndex, dir === 'right' ? 1 : -1, this.handEntries.length);
      }
    },
    handleSectionConfirm(): void {
      if (this.consoleState.section === 'board') {
        const board = this.$refs.boardSection as InstanceType<typeof ConsoleBoardSection> | undefined;
        if (this.placementActive && board?.activate() !== true) {
          this.showNotice('Cannot place here');
        }
        return;
      }
      // Hand: play the selected card.
      const entry = this.handEntries[this.consoleState.handIndex];
      if (entry === undefined) {
        return;
      }
      if (!entry.playable) {
        this.showNotice('Unplayable now');
        return;
      }
      this.openPlayCard(entry.card.name);
    },
    // ── verbs ────────────────────────────────────────────────────────────
    executeVerb(verb: TurnVerb | undefined): void {
      if (verb === undefined) {
        return;
      }
      if (!verb.available) {
        this.showNotice(verb.reason);
        return;
      }
      switch (verb.id) {
      case 'playCard':
        this.consoleState.section = 'hand';
        this.consoleState.turnMenuOpen = false;
        break;
      case 'standardProjects':
        this.openSheet('projects');
        break;
      case 'milestones':
        this.openSheet('milestones');
        break;
      case 'awards':
        this.openSheet('awards');
        break;
      case 'convertHeat': {
        const found = findConvertHeatOption(this.playerView.waitingFor);
        if (found === undefined) {
          return;
        }
        this.consoleState.turnMenuOpen = false;
        if ((found.option.warnings ?? []).includes('maxtemp')) {
          this.consoleState.confirm = 'convertHeat';
        } else {
          this.submit(optionResponseForPath(found.path));
        }
        break;
      }
      case 'convertPlants': {
        const found = findConvertPlantsOption(this.playerView.waitingFor, this.thisPlayer.canConvertPlants === true);
        if (found === undefined) {
          return;
        }
        // Client-side picker (nothing committed until a space is picked) —
        // mirrors the desktop convert-plants flow.
        this.convertPlantsPending = found;
        closeConsoleLayers();
        this.consoleState.section = 'board';
        break;
      }
      case 'endTurn': {
        const path = findEndTurnPath(this.playerView.waitingFor);
        if (path !== undefined) {
          closeConsoleLayers();
          this.submit(optionResponseForPath(path));
        }
        break;
      }
      case 'pass':
        this.consoleState.turnMenuOpen = false;
        this.consoleState.confirm = 'pass';
        break;
      default:
        this.showNotice(verb.reason !== '' ? verb.reason : 'Available in desktop mode for now');
      }
    },
    openSheet(sheet: 'projects' | 'milestones' | 'awards'): void {
      this.consoleState.turnMenuOpen = false;
      this.consoleState.sheet = sheet;
      void this.$nextTick(() => {
        this.consoleState.sheetIndex = Math.max(0, this.sheetRows.findIndex((r) => r.available));
      });
    },
    activateSheetRow(row: ConsoleSheetRow | undefined): void {
      if (row === undefined) {
        return;
      }
      if (!row.available) {
        this.showNotice(row.reason !== undefined && row.reason !== '' ? row.reason : 'Unavailable right now');
        return;
      }
      switch (this.consoleState.sheet) {
      case 'projects':
        this.useStandardProject(row.key as CardName);
        break;
      case 'milestones':
        this.submitInnerOption(findMilestoneOptionPath(this.playerView.waitingFor), row.key);
        break;
      case 'awards':
        this.submitInnerOption(findAwardOptionPath(this.playerView.waitingFor), row.key);
        break;
      }
    },
    acceptConfirm(): void {
      const kind = this.consoleState.confirm;
      this.consoleState.confirm = undefined;
      if (kind === 'pass') {
        const path = findPassPath(this.playerView.waitingFor);
        if (path !== undefined) {
          this.submit(optionResponseForPath(path));
        }
      } else if (kind === 'convertHeat') {
        const found = findConvertHeatOption(this.playerView.waitingFor);
        if (found !== undefined) {
          this.submit(optionResponseForPath(found.path));
        }
      }
    },
    // ── flows ────────────────────────────────────────────────────────────
    openPlayCard(cardName: CardName): void {
      const action = this.playAction;
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      const title: Message = {
        message: 'Play ${0}',
        data: [{type: LogMessageDataType.CARD as const, value: cardName}],
      };
      this.pendingPlayCard = {cardName, title, input: {...action.input, cards: [card]}};
    },
    onPlayCardConfirm(payload: PlayCardPayload): void {
      const action = this.playAction;
      if (this.pendingPlayCard === undefined || action === undefined) {
        return;
      }
      const play = wrapPath(action.path, payload.playResponse);
      const responses: Array<unknown> = [play, ...payload.preStepResponses];
      if (payload.branchIndex >= 0) {
        responses.push({type: 'or' as const, index: payload.branchIndex, response: payload.optionResponse ?? {type: 'option' as const}});
      } else if (payload.optionResponse !== undefined) {
        responses.push(payload.optionResponse);
      }
      responses.push(...payload.stepResponses);
      this.pendingPlayCard = undefined;
      this.submitBatch(responses);
    },
    onUnsupportedPick(): void {
      // A multi-candidate card-target pick routes to a desktop overlay that
      // doesn't exist in console mode — abort honestly instead of stranding.
      this.pendingPlayCard = undefined;
      this.showNotice('This card needs desktop mode for now');
    },
    useStandardProject(cardName: CardName): void {
      const action = findStandardProjectsAction(this.playerView.waitingFor);
      const card = action?.input.cards.find((c) => c.name === cardName);
      if (action === undefined || card === undefined || card.isDisabled === true) {
        return;
      }
      const cost = card.calculatedCost ?? 0;
      if (hasUsableStandardProjectAlternativeResources(this.thisPlayer, card, action.input.paymentOptions ?? {})) {
        const title = standardProjectPaymentTitle(cardName);
        this.pendingStdProjectPayment = {
          cardName,
          title,
          input: buildStandardProjectPaymentModel(this.playerView, action.input, card, title, cost),
        };
        closeConsoleLayers();
        return;
      }
      closeConsoleLayers();
      this.submitStandardProjectPayment(cardName, Payment.of({megacredits: cost}));
    },
    onStdProjectPaymentConfirm(payment: Payment): void {
      if (this.pendingStdProjectPayment === undefined) {
        return;
      }
      const cardName = this.pendingStdProjectPayment.cardName;
      this.pendingStdProjectPayment = undefined;
      this.submitStandardProjectPayment(cardName, payment);
    },
    submitStandardProjectPayment(cardName: CardName, payment: Payment): void {
      const action = findStandardProjectsAction(this.playerView.waitingFor);
      if (action === undefined) {
        return;
      }
      this.submit(wrapPath(action.path, {type: 'projectCard' as const, card: cardName, payment}));
    },
    submitInnerOption(found: {options: ReadonlyArray<unknown>, path: ReadonlyArray<number>} | undefined, targetTitle: string): void {
      if (found === undefined) {
        return;
      }
      const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
      const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === targetTitle);
      if (innerIdx === -1) {
        this.showNotice('Unavailable right now');
        return;
      }
      closeConsoleLayers();
      this.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
    },
    onConvertPlantsSpacePicked(spaceResponse: {type: 'space', spaceId: string}): void {
      const found = this.convertPlantsPending;
      this.convertPlantsPending = undefined;
      if (found === undefined || found.path.length === 0) {
        return;
      }
      this.submit(wrapPath(found.path, spaceResponse));
    },
    cancelPlacement(): void {
      if (this.convertPlantsPending !== undefined) {
        // Client-side picker: nothing committed — just drop it.
        this.convertPlantsPending = undefined;
        return;
      }
      const wfRef = this.$refs.waitingFor as {onPlacementCancel?: () => void} | undefined;
      wfRef?.onPlacementCancel?.();
    },
    // ── transport ────────────────────────────────────────────────────────
    submit(response: unknown): void {
      const wfRef = this.$refs.waitingFor as {onsave?: (out: unknown) => void} | undefined;
      wfRef?.onsave?.(response);
    },
    submitBatch(responses: ReadonlyArray<unknown>): void {
      const wfRef = this.$refs.waitingFor as {onsaveBatch?: (out: ReadonlyArray<unknown>) => void} | undefined;
      wfRef?.onsaveBatch?.(responses);
    },
    showNotice(key: string): void {
      this.notice = key;
      if (this.noticeTimer !== undefined) {
        window.clearTimeout(this.noticeTimer);
      }
      this.noticeTimer = window.setTimeout(() => {
        this.notice = '';
      }, motionMs(2400));
    },
  },
  mounted() {
    this.offIntent = registerConsoleIntentHandler((intent) => this.handleIntent(intent));
    document.documentElement.classList.add('console-mode');
  },
  beforeUnmount() {
    this.offIntent?.();
    if (this.noticeTimer !== undefined) {
      window.clearTimeout(this.noticeTimer);
    }
    document.documentElement.classList.remove('console-mode');
  },
});
</script>
