<template>
  <div ref="rootEl" class="cm-create">
    <div class="cm-menu__bg" aria-hidden="true"></div>
    <div class="cm-menu__vignette" aria-hidden="true"></div>

    <!-- ── Stage 0: the session mode («Отдельная партия» / «Кампания») ── -->
    <template v-if="ui.stage === 'mode'">
      <header class="cm-create__head">
        <div class="cm-create__kicker">{{ $t('Create new game') }}</div>
        <div class="cm-create__identity">
          <span class="cm-identity__cube" :class="identityCubeClass" aria-hidden="true"></span>
          <span class="cm-create__identity-name">{{ identityName }}</span>
        </div>
      </header>
      <div class="cm-mode">
        <button
          v-for="(opt, i) in modeOptions"
          :key="opt.id"
          type="button"
          class="cm-mode__tile"
          :class="{'cm-mode__tile--cursor': ui.modeCursor === i, 'cm-mode__tile--campaign': opt.id === 'campaign'}"
          :data-mode="opt.id"
          @click="pickMode(i)"
        >
          <!-- THE ILLUSTRATION (TR68): the mode is SHOWN before it is read — one real board for a single party, the
               route of boards on one lane for a campaign (as many as the chosen length; the campaign map's grammar,
               in small). -->
          <span class="cm-mode__art" aria-hidden="true">
            <template v-if="opt.id === 'campaign'">
              <span class="cm-mode__lane" :style="{'--cm-route-n': String(modeRouteBoards.length)}"></span>
              <span v-for="(board, n) in modeRouteBoards" :key="board" class="cm-mode__stop" :style="{'--cm-route-n': String(modeRouteBoards.length)}" :class="{'cm-mode__stop--final': n === modeRouteBoards.length - 1}">
                <PremiumMapFingerprint :map-id="board" variant="thumb" />
              </span>
            </template>
            <span v-else class="cm-mode__board">
              <PremiumMapFingerprint :map-id="modeSingleBoard" variant="card" />
            </span>
          </span>
          <div class="cm-mode__label">{{ $t(opt.labelKey) }}</div>
          <div class="cm-mode__desc">{{ $t(opt.descKey) }}</div>
        </button>
      </div>
    </template>

    <template v-else>
    <header class="cm-create__head">
      <div class="cm-create__kicker">{{ $t('Create new game') }}</div>
      <div class="cm-tabs">
        <GamepadGlyph control="bumperL" />
        <button
          v-for="deck in decks"
          :key="deck.id"
          type="button"
          class="cm-tabs__tab"
          :class="{'cm-tabs__tab--active': deck.id === ui.deck, 'cm-tabs__tab--flagged': deckFlagged(deck.id)}"
          @click="setDeck(deck.id)"
        >
          {{ $t(deck.labelKey) }}
        </button>
        <GamepadGlyph control="bumperR" />
      </div>
      <div class="cm-create__identity">
        <span class="cm-identity__cube" :class="identityCubeClass" aria-hidden="true"></span>
        <span class="cm-create__identity-name">{{ identityName }}</span>
      </div>
    </header>

    <div class="cm-create__main">
      <!-- fill: decks keep their full-height layout (flex:1 deckbody,
           vertically-centred map deck) when content is shorter than the
           viewport; scrolling engages only on the extreme-viewport valve. -->
      <ConsoleScrollArea ref="deckScroll" class="cm-create__deck" :fill="true">
        <ConsoleCrewDeck
          v-if="ui.deck === 'crew'"
          :rows="crew"
          :cursor="ui.cursor.crew"
          :shake-row="shakeRowFor('crew')"
          @hover="setCursor('crew', $event)"
          @activate="activateCrew($event)"
        />
        <ConsoleRulesDeck
          v-else-if="ui.deck === 'rules'"
          :rows="rules"
          :cursor="ui.cursor.rules"
          :shake-row="shakeRowFor('rules')"
          @hover="setCursor('rules', $event)"
          @activate="activateRules($event)"
        />
        <ConsoleExpansionsDeck
          v-else-if="ui.deck === 'expansions'"
          :rows="expansions"
          :cursor="ui.cursor.expansions"
          :shake-row="shakeRowFor('expansions')"
          @hover="setCursor('expansions', $event)"
          @activate="activateExpansions($event)"
        />
        <!-- Campaign: no manual map pick — the route briefing replaces the deck, and it IS the route's length dial
             (◄ ► / A — 3…6 missions, the last the finale): the lane of unknown boards grows and shrinks with it. -->
        <div v-else-if="isCampaign" class="cm-routebrief" :class="{'cm-routebrief--cursor': true}" data-route-length>
          <div class="cm-routebrief__title" v-i18n>Mission route</div>
          <TransitionGroup tag="div" name="cm-routestop" class="cm-routebrief__route" aria-hidden="true">
            <span
              v-for="n in missionCount"
              :key="n"
              class="cm-routebrief__stop"
              :class="{'cm-routebrief__stop--final': n === missionCount}"
            >
              <PremiumMapFingerprint :random="true" variant="thumb" />
              <span v-if="n === missionCount" class="cm-routebrief__final">{{ $t('Finale') }}</span>
            </span>
          </TransitionGroup>
          <div class="cm-routebrief__dial">
            <span class="cm-routebrief__dial-label">{{ $t('Missions') }}</span>
            <span class="cm-field__value cm-field__value--stepper" aria-hidden="true">
              <span class="cm-field__arrow">◄</span>
              <span class="cm-field__stepval cm-routebrief__dial-value" data-route-length-value>{{ missionCount }}</span>
              <span class="cm-field__arrow">►</span>
            </span>
          </div>
          <div class="cm-routebrief__body" v-i18n>Unique boards are generated when the campaign is assembled, one per mission. The route never changes afterwards.</div>
          <div class="cm-routebrief__note" data-route-reward-note>{{ $t(routeRewardNote) }}</div>
          <div class="cm-routebrief__note" v-if="botSeated" v-i18n>With the MarsBot seated, the route draws only from the boards it supports.</div>
          <div class="cm-routebrief__note" v-i18n>Corporations merge between missions; Merger itself is excluded from the campaign prelude pool.</div>
        </div>
        <ConsoleMapDeck
          v-else
          :rows="maps"
          :cursor="ui.cursor.map"
          :shake-row="shakeRowFor('map')"
          :wide="creatorWide"
          @hover="setCursor('map', $event)"
          @activate="activateMap($event)"
          @layout="mapCols = $event.cols"
        />
      </ConsoleScrollArea>
      <ConsoleLaunchPanel />
    </div>

    <!-- ── Overlays (one at a time, model-owned) ───────────────────────── -->
    <ConsoleTypePicker
      v-if="ui.overlay?.kind === 'typePicker'"
      :options="typeOptions"
      :cursor="ui.overlay.cursor"
      @cursor="ui.overlay.cursor = $event"
      @pick="pickType($event)"
    />

    <ConsoleParticipantEditor
      v-if="ui.overlay?.kind === 'editor'"
      ref="editor"
      :target="ui.overlay.target"
      :cursor="ui.overlay.cursor"
      @cursor="ui.overlay.cursor = $event"
      @remove-request="onEditorRemoveRequest"
      @close="closeOverlay"
    />

    <div v-if="ui.overlay?.kind === 'confirm'" class="cm-overlay" role="dialog" :aria-label="$t(confirmTitle)">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t(confirmTitle) }}</div>
        <div class="cm-overlay__body">{{ confirmBody }}</div>
        <div class="cm-confirm__pad">
          <button type="button" class="cm-confirm__btn" :class="{'cm-confirm__btn--danger': confirmDanger}" @click="executeConfirm">
            <GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span>
          </button>
          <button type="button" class="cm-confirm__btn" @click="closeOverlay">
            <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
          </button>
        </div>
      </div>
    </div>

    <ConsoleDevCardPicker
      v-if="ui.overlay?.kind === 'devCards'"
      ref="devCards"
      @close="closeOverlay"
    />

    <ConsoleLaunchConfirm
      v-if="ui.overlay?.kind === 'launch'"
      @confirm="doLaunch"
      @cancel="closeOverlay"
    />
    </template>

    <ConsoleCommandBar :context="commandContext" :commands="commands" />
  </div>
</template>

<script setup lang="ts">
/**
 * CONSOLE-NATIVE CREATE GAME — the "Mission Bridge" screen.
 *
 * Four DECKS (Crew / Rules / Expansions / Map) cycled with LB/RB, one cursor
 * per deck, direct A-actions (toggle / select / open the participant
 * editor), a persistent LAUNCH BRIEFING on the right, X = the global launch
 * action (ready → launch ceremony where A confirms; blocked → jump-to-issue
 * with a shake), B = back to the main menu, View = reset settings.
 *
 * Navigation is pure screen state (consoleCreateModel + consoleMenuPad) —
 * DOM focus never drives it; mouse clicks work as a fallback everywhere.
 * Data / validation / persistence / submit are the SHARED premium create
 * modules, so desktop and console can never drift.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {
  CREATE_WIDE_MIN_WIDTH,
  CreateDeckId,
  SESSION_MODE_OPTIONS,
  createDecks,
  CrewRow,
  ExpansionRow,
  MapRow,
  ParticipantTypeOption,
  RulesDeckRow,
  addHuman,
  clampCreateCursors,
  consoleCreateUi,
  crewRows,
  cycleCreateDeck,
  deckNavStep,
  deckRowCount,
  expansionRows,
  jumpToFirstIssue,
  launchIssues,
  launchReady,
  mapRows,
  participantTypeOptions,
  removeHuman,
  resetConsoleCreateUi,
  rulesDeckRows,
  seatBot,
  seatBotNeedsConfirm,
  selectMap,
  toggleExpansion,
  toggleRule,
  setCreateLayoutWide,
  stepCampaignChance,
  stepCampaignRewardMode,
  stepCampaignTenderOffer,
  stepCampaignMissionCount,
  unseatBot,
} from '@/client/console/menu/consoleCreateModel';
import {
  applyCreatorIdentity,
  botSeatedInState,
  clearSavedCreateGameState,
  createGameState,
  isCampaignMode,
  resetCreateGameState,
  restoreCreateGameState,
  setSessionMode,
} from '@/client/components/create/premium/createGameState';
import {submitPremiumCreateGame} from '@/client/components/create/premium/submitCreateGame';
import {submitPremiumCreateCampaign} from '@/client/components/create/premium/submitCampaign';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {BoardName} from '@/common/boards/BoardName';
import {identityState, ensureIdentityLoaded, setIdentity} from '@/client/components/mainMenu/identity/identityState';
import {ensureProfilesLoaded} from '@/client/components/mainMenu/profilesState';
import {prefillIdentityFromSteam} from '@/client/components/mainMenu/identity/steamIdentity';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCrewDeck from '@/client/components/console/menu/ConsoleCrewDeck.vue';
import ConsoleRulesDeck from '@/client/components/console/menu/ConsoleRulesDeck.vue';
import ConsoleExpansionsDeck from '@/client/components/console/menu/ConsoleExpansionsDeck.vue';
import ConsoleMapDeck from '@/client/components/console/menu/ConsoleMapDeck.vue';
import ConsoleLaunchPanel from '@/client/components/console/menu/ConsoleLaunchPanel.vue';
import ConsoleParticipantEditor from '@/client/components/console/menu/ConsoleParticipantEditor.vue';
import ConsoleTypePicker from '@/client/components/console/menu/ConsoleTypePicker.vue';
import ConsoleLaunchConfirm from '@/client/components/console/menu/ConsoleLaunchConfirm.vue';
import ConsoleDevCardPicker from '@/client/components/console/menu/ConsoleDevCardPicker.vue';
import {pruneGuaranteedCards} from '@/client/components/create/premium/devGuaranteedCards';
import {$t} from '@/client/directives/i18n';
import {trackDeckComposition} from '@/client/console/menu/deckCompositionState';
import {vI18n} from '@/client/directives/vDirectives';
import {useAppRoot} from '@/client/components/appRoot';

const SHAKE_MS = 460;

defineOptions({name: 'ConsoleCreateGame'});

// The app root's port (R26): B on the mode stage goes back to the main menu through it. `undefined` outside the
// application — a creator with no root above it has no menu to go back to, and that press does nothing.
const root = useAppRoot();
// Foundation: page-level overflow lock while this screen owns the viewport.
useConsoleNativeSurface();
// THE WIDE CREATOR (TR68): the stylesheet's `@media (min-width: 1900px)` and the cursor's walk read ONE threshold.
const viewport = useConsoleViewport();
const creatorWide = computed(() => viewport.width.value >= CREATE_WIDE_MIN_WIDTH);
// The model orders a sub-setting by the grid it stands in.
watch(creatorWide, (wide) => setCreateLayoutWide(wide), {immediate: true});
const flow = useFlowScope('console-create-game');
const devCards = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('devCards');
const editor = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('editor');
const deckScroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('deckScroll');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
/** The map showcase's MEASURED columns (`ConsoleMapDeck` → `layout`) — the cursor's walk (P44 · ER). */
const mapCols = ref<number | undefined>(undefined);
const ui = consoleCreateUi;
let offPad: (() => void) | undefined;
// The deck counts the server keeps live while the creator stands (T04).
let offDecks: (() => void) | undefined;
const shakeDeck = ref<CreateDeckId | undefined>(undefined);
const shakeRow = ref(-1);
let cancelShake = (() => {}) as () => void;

const decks = computed(() => {
  return createDecks();
});
/** The single party's illustration — the base board every player knows. */
const modeSingleBoard = computed((): BoardName => {
  return BoardName.THARSIS;
});
/** The campaign's illustration — a route of four boards (the last one the finale). */
/** The mode tile's little route — as long as the campaign the player has chosen. */
const modeRouteBoards = computed((): ReadonlyArray<BoardName> => {
  return [
    BoardName.TERRA_CIMMERIA, BoardName.THARSIS, BoardName.VASTITAS_BOREALIS,
    BoardName.ELYSIUM, BoardName.UTOPIA_PLANITIA, BoardName.HELLAS,
  ].slice(-missionCount.value);
});
const missionCount = computed((): number => {
  return createGameState.config.campaignMissionCount;
});
/** What the finale does with the road's rewards — the briefing's note follows the reward dial. */
const routeRewardNote = computed((): string => {
  return createGameState.config.campaignRewardMode === 'tenders' ?
    'The last mission is the finale: the tenders won on the way execute at its start, corporations count into its VP.' :
    'The last mission is the finale: titles and corporations count into its VP.';
});
const modeOptions = SESSION_MODE_OPTIONS;
const isCampaign = computed((): boolean => {
  return isCampaignMode();
});
const botSeated = computed((): boolean => {
  return botSeatedInState();
});
const crew = computed((): ReadonlyArray<CrewRow> => {
  return crewRows();
});
const rules = computed((): ReadonlyArray<RulesDeckRow> => {
  return rulesDeckRows();
});
const expansions = computed((): ReadonlyArray<ExpansionRow> => {
  return expansionRows();
});
const maps = computed((): ReadonlyArray<MapRow> => {
  return mapRows();
});
const typeOptions = computed((): ReadonlyArray<ParticipantTypeOption> => {
  return participantTypeOptions();
});
const identityName = computed((): string => {
  return identityState.identity?.displayName ?? '';
});
const identityCubeClass = computed((): string => {
  const color = identityState.identity?.cubeColor;
  return color !== undefined ? `player_bg_color_${color}` : 'cm-identity__cube--empty';
});
const ready = computed((): boolean => {
  return launchReady();
});
const confirmTitle = computed((): string => {
  const overlay = ui.overlay;
  if (overlay?.kind !== 'confirm') {
    return '';
  }
  switch (overlay.id) {
  case 'seat-bot': return 'Add MarsBot?';
  case 'remove-human': return 'Remove participant?';
  case 'unseat-bot': return 'Remove MarsBot?';
  case 'reset': return 'Reset settings?';
  }
});
const confirmBody = computed((): string => {
  const overlay = ui.overlay;
  if (overlay?.kind !== 'confirm') {
    return '';
  }
  switch (overlay.id) {
  case 'seat-bot':
    return $t('MarsBot currently plays one-on-one only — the roster will shrink to just you. Removing the bot brings your roster back.');
  case 'remove-human': {
    const name = createGameState.config.players[overlay.index ?? -1]?.name?.trim() ?? '';
    return name !== '' ? name : $t('Name not set');
  }
  case 'unseat-bot':
    return $t('Your previous roster will be restored.');
  case 'reset':
    return $t('The saved setup will be cleared and the defaults restored.');
  }
});
const confirmDanger = computed((): boolean => {
  const overlay = ui.overlay;
  return overlay?.kind === 'confirm' && (overlay.id === 'remove-human' || overlay.id === 'unseat-bot' || overlay.id === 'reset');
});
const commandContext = computed((): string => {
  if (ui.stage === 'mode') {
    return 'Create new game';
  }
  const overlay = ui.overlay;
  if (overlay?.kind === 'typePicker') {
    return 'Add participant';
  }
  if (overlay?.kind === 'editor') {
    return 'Participant';
  }
  if (overlay?.kind === 'confirm') {
    return confirmTitle.value;
  }
  if (overlay?.kind === 'launch') {
    return 'Launch the party';
  }
  if (overlay?.kind === 'devCards') {
    return 'Guaranteed cards';
  }
  return 'Create new game';
});
const commands = computed((): ReadonlyArray<ConsoleCommand> => {
  if (ui.stage === 'mode') {
    return [
      {control: 'dpadH', label: 'Choose'},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Main menu'},
    ];
  }
  const overlay = ui.overlay;
  if (overlay?.kind === 'typePicker') {
    return [
      {control: 'dpadH', label: 'Choose'},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Cancel'},
    ];
  }
  if (overlay?.kind === 'editor') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Change'},
      {control: 'back', label: 'Done'},
    ];
  }
  if (overlay?.kind === 'confirm') {
    return [
      {control: 'confirm', label: 'Confirm'},
      {control: 'back', label: 'Cancel'},
    ];
  }
  if (overlay?.kind === 'launch') {
    return [
      {control: 'confirm', label: 'Launch'},
      {control: 'back', label: 'Cancel'},
    ];
  }
  if (overlay?.kind === 'devCards') {
    // The picker shows precise per-view foot hints; the bar stays generic.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Back'},
    ];
  }
  const verb = deckVerb.value;
  const cmds: Array<ConsoleCommand> = [
    {control: 'bumperL', control2: 'bumperR', label: 'Section'},
    {control: 'confirm', label: verb.label, enabled: verb.enabled},
  ];
  if (removeHintVisible.value) {
    cmds.push({control: 'inspect', label: 'Remove'});
  }
  cmds.push({control: 'secondary', label: ready.value ? (isCampaign.value ? 'Assemble the campaign' : 'Launch the party') : 'Go to the first issue', highlight: ready.value});
  cmds.push({control: 'back', label: 'Game mode'});
  return cmds;
});
const deckVerb = computed((): {label: string, enabled: boolean} => {
  switch (ui.deck) {
  case 'crew': {
    const row = crew.value[ui.cursor.crew];
    if (row === undefined) {
      return {label: 'Select', enabled: false};
    }
    if (row.kind === 'add') {
      return {label: 'Add participant', enabled: row.enabled};
    }
    return {label: 'Edit', enabled: true};
  }
  case 'rules': {
    const row = rules.value[ui.cursor.rules];
    if (row?.kind === 'chance') {
      return {label: 'Change', enabled: true};
    }
    return {label: row?.kind === 'devCards' ? 'Open' : 'Toggle', enabled: true};
  }
  case 'expansions':
    return {label: 'Toggle', enabled: true};
  case 'map': {
    if (isCampaign.value) {
      return {label: 'Change', enabled: true};
    }
    const row = maps.value[ui.cursor.map];
    return {label: 'Select map', enabled: row !== undefined && !row.selected};
  }
  }
});
const removeHintVisible = computed((): boolean => {
  if (ui.deck !== 'crew') {
    return false;
  }
  const row = crew.value[ui.cursor.crew];
  return row !== undefined && ((row.kind === 'human' && row.removable) || row.kind === 'bot');
});

// ── Input routing ──────────────────────────────────────────────────
function onIntent(intent: GamepadIntent): boolean {
  if (createGameState.creating) {
    return true; // The launch is in flight — nothing may interrupt it.
  }
  // Foundation: presses resolve to SEMANTIC actions (X = launch — the
  // create screen's advertised verb; no raw button names).
  const action = consoleActionOf(intent, {secondary: 'launch'});
  // ── Stage 0: the session-mode pick ──
  if (ui.stage === 'mode') {
    if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
      const max = modeOptions.length - 1;
      ui.modeCursor = intent.dir === 'right' ?
        Math.min(max, ui.modeCursor + 1) : Math.max(0, ui.modeCursor - 1);
      return true;
    }
    if (action === 'primary') {
      pickMode(ui.modeCursor);
    } else if (action === 'back') {
      root?.navigateInApp('/');
    }
    return true;
  }
  const overlay = ui.overlay;
  if (overlay?.kind === 'devCards') {
    // The picker owns the pad completely (X = inspect there, not launch).
    const picker = devCards.value ?? undefined;
    if (picker?.handleIntent?.(intent) !== true && action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay?.kind === 'editor') {
    const editorNow = editor.value ?? undefined;
    if (editorNow?.handleIntent?.(intent) === true) {
      return true;
    }
    if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay?.kind === 'typePicker') {
    if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
      overlay.cursor = intent.dir === 'right' ? Math.min(1, overlay.cursor + 1) : Math.max(0, overlay.cursor - 1);
      return true;
    }
    if (action === 'primary') {
      pickType(overlay.cursor);
    } else if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay?.kind === 'confirm') {
    if (action === 'primary') {
      executeConfirm();
    } else if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay?.kind === 'launch') {
    if (action === 'primary') {
      doLaunch();
    } else if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  // ── Deck level ──
  if (intent.kind === 'nav') {
    const deck = ui.deck;
    // The campaign's route briefing is the route's LENGTH dial: ◄ ► move it.
    if (deck === 'map' && isCampaign.value && (intent.dir === 'left' || intent.dir === 'right')) {
      stepCampaignMissionCount(intent.dir === 'right' ? 1 : -1, false);
      return true;
    }
    // A campaign chance row is a DIAL: ◄ ► move its value (the console
    // settings stepper idiom), not the section ring.
    const dial = deck === 'rules' ? rules.value[ui.cursor.rules] : undefined;
    if (dial?.kind === 'chance' && (intent.dir === 'left' || intent.dir === 'right')) {
      stepCampaignChance(dial.id, intent.dir === 'right' ? 1 : -1, false);
      return true;
    }
    if (dial?.kind === 'rewardMode' && (intent.dir === 'left' || intent.dir === 'right')) {
      stepCampaignRewardMode(intent.dir === 'right' ? 1 : -1, false);
      return true;
    }
    if (dial?.kind === 'tenderOffer' && (intent.dir === 'left' || intent.dir === 'right')) {
      stepCampaignTenderOffer(intent.dir === 'right' ? 1 : -1, false);
      return true;
    }
    const next = deckNavStep(deck, ui.cursor[deck], intent.dir, deckRowCount(deck), {wide: creatorWide.value, mapCols: mapCols.value});
    if (next !== undefined) {
      ui.cursor[deck] = next;
      keepDeckCursorVisible();
    } else if (intent.dir === 'left' || intent.dir === 'right') {
      // Vertical decks: ◄ ► also walks the section ring (console settings idiom).
      setDeck(cycleCreateDeck(deck, intent.dir === 'right' ? 1 : -1));
    }
    return true;
  }
  switch (action) {
  case 'prevSection':
    setDeck(cycleCreateDeck(ui.deck, -1));
    return true;
  case 'nextSection':
    setDeck(cycleCreateDeck(ui.deck, 1));
    return true;
  case 'primary':
    activateCurrent();
    return true;
  case 'launch':
    onLaunchPressed();
    return true;
  case 'fullscreen':
    onRemovePressed();
    return true;
  case 'reset':
    ui.overlay = {kind: 'confirm', id: 'reset', cursor: 0};
    return true;
  case 'back':
    // One logical level: decks → the mode stage → the main menu.
    ui.stage = 'mode';
    return true;
  default:
    return true;
  }
}
/** Stage 0 pick: apply the session mode and enter the decks. */
function pickMode(i: number): void {
  const opt = modeOptions[i];
  if (opt === undefined) {
    return;
  }
  ui.modeCursor = i;
  setSessionMode(opt.id);
  clampCreateCursors();
  ui.stage = 'decks';
}
// ── Deck actions ───────────────────────────────────────────────────
function setDeck(deck: CreateDeckId): void {
  ui.deck = deck;
  clampCreateCursors();
  keepDeckCursorVisible();
}
/** Keep the cursored deck row inside the ConsoleScrollArea viewport
 * (decks are designed to FIT 1280×800 — this matters only on the
 * extreme-viewport safety-valve path). */
function keepDeckCursorVisible(): void {
  void nextTick(() => {
    const scroll = deckScroll.value ?? undefined;
    scroll?.ensureVisible?.(rootEl.value?.querySelector('.cm-row--cursor, .cm-map--cursor') ?? null);
  });
}
function setCursor(deck: CreateDeckId, i: number): void {
  ui.cursor[deck] = i;
}
function deckFlagged(deck: CreateDeckId): boolean {
  return launchIssues().some((issue) => issue.target.deck === deck);
}
function activateCurrent(): void {
  switch (ui.deck) {
  case 'crew':
    activateCrew(ui.cursor.crew);
    break;
  case 'rules':
    activateRules(ui.cursor.rules);
    break;
  case 'expansions':
    activateExpansions(ui.cursor.expansions);
    break;
  case 'map':
    activateMap(ui.cursor.map);
    break;
  }
}
function activateCrew(i: number): void {
  setCursor('crew', i);
  const row = crew.value[i];
  if (row === undefined) {
    return;
  }
  if (row.kind === 'human') {
    ui.overlay = {kind: 'editor', target: {kind: 'human', index: row.index}, cursor: 0};
  } else if (row.kind === 'bot') {
    ui.overlay = {kind: 'editor', target: {kind: 'bot'}, cursor: 0};
  } else if (row.enabled) {
    ui.overlay = {kind: 'typePicker', cursor: 0};
  } else {
    armShake('crew', i); // Disabled ADD — the reason is on the row.
  }
}
function activateRules(i: number): void {
  setCursor('rules', i);
  const row = rules.value[i];
  if (row === undefined) {
    return;
  }
  if (row.kind === 'devCards') {
    ui.overlay = {kind: 'devCards'};
    return;
  }
  if (row.kind === 'chance') {
    stepCampaignChance(row.id, 1, true);
    return;
  }
  if (row.kind === 'rewardMode') {
    stepCampaignRewardMode(1, true);
    // The mode's sub-row appears / leaves with it — the cursor must not stand on a row that is gone.
    clampCreateCursors();
    return;
  }
  if (row.kind === 'tenderOffer') {
    stepCampaignTenderOffer(1, true);
    return;
  }
  toggleRule(row.rule.meta.id);
  // altVenus visibility — and the test-mode sub-row — change the row count.
  clampCreateCursors();
}
function activateExpansions(i: number): void {
  setCursor('expansions', i);
  const row = expansions.value[i];
  if (row !== undefined) {
    toggleExpansion(row.meta.id);
    clampCreateCursors();
  }
}
function activateMap(i: number): void {
  if (isCampaign.value) {
    // The boards are generated at assembly — A steps the route's length (cycling).
    stepCampaignMissionCount(1, true);
    return;
  }
  setCursor('map', i);
  const row = maps.value[i];
  if (row !== undefined) {
    selectMap(row.meta.id);
  }
}
// ── Participants ───────────────────────────────────────────────────
function pickType(i: number): void {
  const opt = typeOptions.value[i];
  if (opt === undefined || !opt.enabled) {
    return;
  }
  if (opt.id === 'human') {
    const index = addHuman();
    if (index !== undefined) {
      ui.overlay = {kind: 'editor', target: {kind: 'human', index}, cursor: 0};
      ui.cursor.crew = index;
    }
    return;
  }
  // MarsBot: seating it under the current server limit may shrink the
  // roster — that is an explicit player decision, never a silent one.
  if (seatBotNeedsConfirm()) {
    ui.overlay = {kind: 'confirm', id: 'seat-bot', cursor: 0};
  } else {
    seatBot();
    clampCreateCursors();
    openBotEditor();
  }
}
function openBotEditor(): void {
  const botRow = crew.value.findIndex((r) => r.kind === 'bot');
  if (botRow >= 0) {
    ui.cursor.crew = botRow;
  }
  ui.overlay = {kind: 'editor', target: {kind: 'bot'}, cursor: 0};
}
function onEditorRemoveRequest(): void {
  const overlay = ui.overlay;
  if (overlay?.kind !== 'editor') {
    return;
  }
  if (overlay.target.kind === 'bot') {
    ui.overlay = {kind: 'confirm', id: 'unseat-bot', cursor: 0};
  } else {
    ui.overlay = {kind: 'confirm', id: 'remove-human', index: overlay.target.index, cursor: 0};
  }
}
function onRemovePressed(): void {
  if (ui.deck !== 'crew') {
    return;
  }
  const row = crew.value[ui.cursor.crew];
  if (row === undefined) {
    return;
  }
  if (row.kind === 'bot') {
    ui.overlay = {kind: 'confirm', id: 'unseat-bot', cursor: 0};
  } else if (row.kind === 'human' && row.removable) {
    ui.overlay = {kind: 'confirm', id: 'remove-human', index: row.index, cursor: 0};
  }
}
function executeConfirm(): void {
  const overlay = ui.overlay;
  if (overlay?.kind !== 'confirm') {
    return;
  }
  switch (overlay.id) {
  case 'seat-bot':
    seatBot();
    clampCreateCursors();
    openBotEditor();
    return; // The editor replaced the confirm.
  case 'remove-human':
    if (overlay.index !== undefined) {
      removeHuman(overlay.index);
    }
    break;
  case 'unseat-bot':
    unseatBot();
    break;
  case 'reset':
    clearSavedCreateGameState();
    resetCreateGameState();
    {
      const id = identityState.identity;
      if (id !== undefined) {
        applyCreatorIdentity(id.displayName, id.cubeColor);
      }
    }
    consoleCreateUi.restored = false;
    break;
  }
  clampCreateCursors();
  ui.overlay = undefined;
}
function closeOverlay(): void {
  ui.overlay = undefined;
}
// ── Launch flow ────────────────────────────────────────────────────
function onLaunchPressed(): void {
  if (createGameState.creating) {
    return;
  }
  if (ready.value) {
    ui.overlay = {kind: 'launch'};
    return;
  }
  if (jumpToFirstIssue()) {
    armShake(ui.deck, ui.cursor[ui.deck]);
  }
}
function doLaunch(): void {
  if (createGameState.creating || !ready.value) {
    return;
  }
  // First-run identity capture: the launcher profile powers the join /
  // continue lists — seed it from the creator seat when it is still empty.
  const slot0 = createGameState.config.players[0];
  if (identityState.identity === undefined && slot0 !== undefined && slot0.name.trim() !== '') {
    setIdentity(slot0.name.trim(), slot0.color);
  }
  if (isCampaign.value) {
    void submitPremiumCreateCampaign();
  } else {
    void submitPremiumCreateGame();
  }
}
// ── Shake feedback ─────────────────────────────────────────────────
function shakeRowFor(deck: CreateDeckId): number {
  return shakeDeck.value === deck ? shakeRow.value : -1;
}
function armShake(deck: CreateDeckId, row: number): void {
  clearShake();
  shakeDeck.value = deck;
  shakeRow.value = row;
  cancelShake = flow.after(SHAKE_MS, 'the refused row\'s shake ends', () => {
    shakeDeck.value = undefined;
    shakeRow.value = -1;
  });
}
function clearShake(): void {
  cancelShake();
  shakeDeck.value = undefined;
  shakeRow.value = -1;
}

onMounted(async () => {
  setDocumentTitle('Create new game');
  ensureIdentityLoaded();
  // Roster is the source of truth for the active identity (mirrors it into
  // identityState + migrates a legacy identity) — in case the create screen
  // is reached without visiting the console main menu first.
  ensureProfilesLoaded();
  // First launch with no saved name (Steam Deck / Steam Machine): pull the Steam display name so
  // the creator seat isn't empty. No-op when an identity already exists or off the Steam build.
  await prefillIdentityFromSteam();
  const restored = restoreCreateGameState();
  if (!restored) {
    resetCreateGameState();
  }
  // A restored setup may name a card a later build renamed or dropped — the
  // shared state can't check (no card manifest there), so prune it here.
  pruneGuaranteedCards(createGameState.config.guaranteedCards);
  const id = identityState.identity;
  if (id !== undefined) {
    applyCreatorIdentity(id.displayName, id.cubeColor);
  }
  resetConsoleCreateUi();
  consoleCreateUi.restored = restored;
  offPad = installMenuPad((intent) => onIntent(intent));
  offDecks = trackDeckComposition();
});
onBeforeUnmount(() => {
  offPad?.();
  offDecks?.();
  clearShake();
});
</script>
