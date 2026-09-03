<template>
  <div class="cm-create">
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
          @click="pickMode(i)"
        >
          <div class="cm-mode__label">{{ $t(opt.labelKey) }}</div>
          <div class="cm-mode__desc">{{ $t(opt.descKey) }}</div>
          <div v-if="opt.id === 'campaign'" class="cm-mode__route" aria-hidden="true">
            <span v-for="n in 4" :key="n" class="cm-mode__dot" :class="{'cm-mode__dot--final': n === 4}"></span>
          </div>
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
        <!-- Campaign: no manual map pick — the route briefing replaces the deck. -->
        <div v-else-if="isCampaign" class="cm-routebrief" :class="{'cm-routebrief--cursor': true}">
          <div class="cm-routebrief__ghost" aria-hidden="true">
            <PremiumMapFingerprint :random="true" variant="card" />
          </div>
          <div class="cm-routebrief__title" v-i18n>Mission route</div>
          <div class="cm-routebrief__body" v-i18n>Four unique boards are generated when the campaign is assembled. The route never changes afterwards.</div>
          <div class="cm-routebrief__note" v-if="botSeated" v-i18n>With the MarsBot seated, the route draws only from the boards it supports.</div>
          <div class="cm-routebrief__note" v-i18n>Corporations merge between missions; Merger itself is excluded from the campaign prelude pool.</div>
        </div>
        <ConsoleMapDeck
          v-else
          :rows="maps"
          :cursor="ui.cursor.map"
          :shake-row="shakeRowFor('map')"
          @hover="setCursor('map', $event)"
          @activate="activateMap($event)"
        />
      </ConsoleScrollArea>
      <ConsoleLaunchPanel @launch="onLaunchPressed" />
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

<script lang="ts">
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
import {defineComponent} from 'vue';
import {vueRoot} from '@/client/components/vueRoot';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {
  CreateDeckId,
  SESSION_MODE_OPTIONS,
  SessionModeOption,
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

const SHAKE_MS = 460;

export default defineComponent({
  name: 'ConsoleCreateGame',
  components: {
    ConsoleCommandBar,
    ConsoleScrollArea,
    GamepadGlyph,
    ConsoleCrewDeck,
    ConsoleRulesDeck,
    ConsoleExpansionsDeck,
    ConsoleMapDeck,
    ConsoleLaunchPanel,
    ConsoleParticipantEditor,
    ConsoleTypePicker,
    ConsoleLaunchConfirm,
    ConsoleDevCardPicker,
    PremiumMapFingerprint,
  },
  setup() {
    // Foundation: page-level overflow lock while this screen owns the viewport.
    useConsoleNativeSurface();
  },
  data() {
    return {
      ui: consoleCreateUi,
      identityState,
      offPad: undefined as (() => void) | undefined,
      shakeDeck: undefined as CreateDeckId | undefined,
      shakeRow: -1,
      shakeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    decks() {
      return createDecks();
    },
    modeOptions(): ReadonlyArray<SessionModeOption> {
      return SESSION_MODE_OPTIONS;
    },
    isCampaign(): boolean {
      return isCampaignMode();
    },
    botSeated(): boolean {
      return botSeatedInState();
    },
    crew(): ReadonlyArray<CrewRow> {
      return crewRows();
    },
    rules(): ReadonlyArray<RulesDeckRow> {
      return rulesDeckRows();
    },
    expansions(): ReadonlyArray<ExpansionRow> {
      return expansionRows();
    },
    maps(): ReadonlyArray<MapRow> {
      return mapRows();
    },
    typeOptions(): ReadonlyArray<ParticipantTypeOption> {
      return participantTypeOptions();
    },
    identityName(): string {
      return this.identityState.identity?.displayName ?? '';
    },
    identityCubeClass(): string {
      const color = this.identityState.identity?.cubeColor;
      return color !== undefined ? `player_bg_color_${color}` : 'cm-identity__cube--empty';
    },
    ready(): boolean {
      return launchReady();
    },
    confirmTitle(): string {
      const overlay = this.ui.overlay;
      if (overlay?.kind !== 'confirm') {
        return '';
      }
      switch (overlay.id) {
      case 'seat-bot': return 'Add MarsBot?';
      case 'remove-human': return 'Remove participant?';
      case 'unseat-bot': return 'Remove MarsBot?';
      case 'reset': return 'Reset settings?';
      }
    },
    confirmBody(): string {
      const overlay = this.ui.overlay;
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
    },
    confirmDanger(): boolean {
      const overlay = this.ui.overlay;
      return overlay?.kind === 'confirm' && (overlay.id === 'remove-human' || overlay.id === 'unseat-bot' || overlay.id === 'reset');
    },
    commandContext(): string {
      if (this.ui.stage === 'mode') {
        return 'Create new game';
      }
      const overlay = this.ui.overlay;
      if (overlay?.kind === 'typePicker') {
        return 'Add participant';
      }
      if (overlay?.kind === 'editor') {
        return 'Participant';
      }
      if (overlay?.kind === 'confirm') {
        return this.confirmTitle;
      }
      if (overlay?.kind === 'launch') {
        return 'Launch the party';
      }
      if (overlay?.kind === 'devCards') {
        return 'Guaranteed cards';
      }
      return 'Create new game';
    },
    commands(): ReadonlyArray<ConsoleCommand> {
      if (this.ui.stage === 'mode') {
        return [
          {control: 'dpadH', label: 'Choose'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Main menu'},
        ];
      }
      const overlay = this.ui.overlay;
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
      const verb = this.deckVerb;
      const cmds: Array<ConsoleCommand> = [
        {control: 'bumperL', control2: 'bumperR', label: 'Section'},
        {control: 'confirm', label: verb.label, enabled: verb.enabled},
      ];
      if (this.removeHintVisible) {
        cmds.push({control: 'inspect', label: 'Remove'});
      }
      cmds.push({control: 'secondary', label: this.ready ? (this.isCampaign ? 'Assemble the campaign' : 'Launch the party') : 'Go to the first issue', highlight: this.ready});
      cmds.push({control: 'back', label: 'Game mode'});
      return cmds;
    },
    deckVerb(): {label: string, enabled: boolean} {
      switch (this.ui.deck) {
      case 'crew': {
        const row = this.crew[this.ui.cursor.crew];
        if (row === undefined) {
          return {label: 'Select', enabled: false};
        }
        if (row.kind === 'add') {
          return {label: 'Add participant', enabled: row.enabled};
        }
        return {label: 'Edit', enabled: true};
      }
      case 'rules': {
        const row = this.rules[this.ui.cursor.rules];
        return {label: row?.kind === 'devCards' ? 'Open' : 'Toggle', enabled: true};
      }
      case 'expansions':
        return {label: 'Toggle', enabled: true};
      case 'map': {
        if (this.isCampaign) {
          return {label: 'The route is generated at assembly', enabled: false};
        }
        const row = this.maps[this.ui.cursor.map];
        return {label: 'Select map', enabled: row !== undefined && !row.selected};
      }
      }
    },
    removeHintVisible(): boolean {
      if (this.ui.deck !== 'crew') {
        return false;
      }
      const row = this.crew[this.ui.cursor.crew];
      return row !== undefined && ((row.kind === 'human' && row.removable) || row.kind === 'bot');
    },
  },
  async mounted() {
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
    const id = this.identityState.identity;
    if (id !== undefined) {
      applyCreatorIdentity(id.displayName, id.cubeColor);
    }
    resetConsoleCreateUi();
    consoleCreateUi.restored = restored;
    this.offPad = installMenuPad((intent) => this.onIntent(intent));
  },
  beforeUnmount() {
    this.offPad?.();
    this.clearShake();
  },
  methods: {
    // ── Input routing ──────────────────────────────────────────────────
    onIntent(intent: GamepadIntent): boolean {
      if (createGameState.creating) {
        return true; // The launch is in flight — nothing may interrupt it.
      }
      // Foundation: presses resolve to SEMANTIC actions (X = launch — the
      // create screen's advertised verb; no raw button names).
      const action = consoleActionOf(intent, {secondary: 'launch'});
      // ── Stage 0: the session-mode pick ──
      if (this.ui.stage === 'mode') {
        if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
          const max = this.modeOptions.length - 1;
          this.ui.modeCursor = intent.dir === 'right' ?
            Math.min(max, this.ui.modeCursor + 1) : Math.max(0, this.ui.modeCursor - 1);
          return true;
        }
        if (action === 'primary') {
          this.pickMode(this.ui.modeCursor);
        } else if (action === 'back') {
          vueRoot(this).navigateInApp('/');
        }
        return true;
      }
      const overlay = this.ui.overlay;
      if (overlay?.kind === 'devCards') {
        // The picker owns the pad completely (X = inspect there, not launch).
        const picker = this.$refs.devCards as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        if (picker?.handleIntent?.(intent) !== true && action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (overlay?.kind === 'editor') {
        const editor = this.$refs.editor as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        if (editor?.handleIntent?.(intent) === true) {
          return true;
        }
        if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (overlay?.kind === 'typePicker') {
        if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
          overlay.cursor = intent.dir === 'right' ? Math.min(1, overlay.cursor + 1) : Math.max(0, overlay.cursor - 1);
          return true;
        }
        if (action === 'primary') {
          this.pickType(overlay.cursor);
        } else if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (overlay?.kind === 'confirm') {
        if (action === 'primary') {
          this.executeConfirm();
        } else if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (overlay?.kind === 'launch') {
        if (action === 'primary') {
          this.doLaunch();
        } else if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      // ── Deck level ──
      if (intent.kind === 'nav') {
        const deck = this.ui.deck;
        const next = deckNavStep(deck, this.ui.cursor[deck], intent.dir, deckRowCount(deck));
        if (next !== undefined) {
          this.ui.cursor[deck] = next;
          this.keepDeckCursorVisible();
        } else if (intent.dir === 'left' || intent.dir === 'right') {
          // Vertical decks: ◄ ► also walks the section ring (console settings idiom).
          this.setDeck(cycleCreateDeck(deck, intent.dir === 'right' ? 1 : -1));
        }
        return true;
      }
      switch (action) {
      case 'prevSection':
        this.setDeck(cycleCreateDeck(this.ui.deck, -1));
        return true;
      case 'nextSection':
        this.setDeck(cycleCreateDeck(this.ui.deck, 1));
        return true;
      case 'primary':
        this.activateCurrent();
        return true;
      case 'launch':
        this.onLaunchPressed();
        return true;
      case 'fullscreen':
        this.onRemovePressed();
        return true;
      case 'reset':
        this.ui.overlay = {kind: 'confirm', id: 'reset', cursor: 0};
        return true;
      case 'back':
        // One logical level: decks → the mode stage → the main menu.
        this.ui.stage = 'mode';
        return true;
      default:
        return true;
      }
    },
    /** Stage 0 pick: apply the session mode and enter the decks. */
    pickMode(i: number): void {
      const opt = this.modeOptions[i];
      if (opt === undefined) {
        return;
      }
      this.ui.modeCursor = i;
      setSessionMode(opt.id);
      clampCreateCursors();
      this.ui.stage = 'decks';
    },
    // ── Deck actions ───────────────────────────────────────────────────
    setDeck(deck: CreateDeckId): void {
      this.ui.deck = deck;
      clampCreateCursors();
      this.keepDeckCursorVisible();
    },
    /** Keep the cursored deck row inside the ConsoleScrollArea viewport
     * (decks are designed to FIT 1280×800 — this matters only on the
     * extreme-viewport safety-valve path). */
    keepDeckCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.deckScroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-row--cursor, .cm-map--cursor'));
      });
    },
    setCursor(deck: CreateDeckId, i: number): void {
      this.ui.cursor[deck] = i;
    },
    deckFlagged(deck: CreateDeckId): boolean {
      return launchIssues().some((issue) => issue.target.deck === deck);
    },
    activateCurrent(): void {
      switch (this.ui.deck) {
      case 'crew':
        this.activateCrew(this.ui.cursor.crew);
        break;
      case 'rules':
        this.activateRules(this.ui.cursor.rules);
        break;
      case 'expansions':
        this.activateExpansions(this.ui.cursor.expansions);
        break;
      case 'map':
        this.activateMap(this.ui.cursor.map);
        break;
      }
    },
    activateCrew(i: number): void {
      this.setCursor('crew', i);
      const row = this.crew[i];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'human') {
        this.ui.overlay = {kind: 'editor', target: {kind: 'human', index: row.index}, cursor: 0};
      } else if (row.kind === 'bot') {
        this.ui.overlay = {kind: 'editor', target: {kind: 'bot'}, cursor: 0};
      } else if (row.enabled) {
        this.ui.overlay = {kind: 'typePicker', cursor: 0};
      } else {
        this.armShake('crew', i); // Disabled ADD — the reason is on the row.
      }
    },
    activateRules(i: number): void {
      this.setCursor('rules', i);
      const row = this.rules[i];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'devCards') {
        this.ui.overlay = {kind: 'devCards'};
        return;
      }
      toggleRule(row.rule.meta.id);
      // altVenus visibility — and the test-mode sub-row — change the row count.
      clampCreateCursors();
    },
    activateExpansions(i: number): void {
      this.setCursor('expansions', i);
      const row = this.expansions[i];
      if (row !== undefined) {
        toggleExpansion(row.meta.id);
        clampCreateCursors();
      }
    },
    activateMap(i: number): void {
      if (this.isCampaign) {
        return; // The route is generated — there is nothing to select.
      }
      this.setCursor('map', i);
      const row = this.maps[i];
      if (row !== undefined) {
        selectMap(row.meta.id);
      }
    },
    // ── Participants ───────────────────────────────────────────────────
    pickType(i: number): void {
      const opt = this.typeOptions[i];
      if (opt === undefined || !opt.enabled) {
        return;
      }
      if (opt.id === 'human') {
        const index = addHuman();
        if (index !== undefined) {
          this.ui.overlay = {kind: 'editor', target: {kind: 'human', index}, cursor: 0};
          this.ui.cursor.crew = index;
        }
        return;
      }
      // MarsBot: seating it under the current server limit may shrink the
      // roster — that is an explicit player decision, never a silent one.
      if (seatBotNeedsConfirm()) {
        this.ui.overlay = {kind: 'confirm', id: 'seat-bot', cursor: 0};
      } else {
        seatBot();
        clampCreateCursors();
        this.openBotEditor();
      }
    },
    openBotEditor(): void {
      const botRow = this.crew.findIndex((r) => r.kind === 'bot');
      if (botRow >= 0) {
        this.ui.cursor.crew = botRow;
      }
      this.ui.overlay = {kind: 'editor', target: {kind: 'bot'}, cursor: 0};
    },
    onEditorRemoveRequest(): void {
      const overlay = this.ui.overlay;
      if (overlay?.kind !== 'editor') {
        return;
      }
      if (overlay.target.kind === 'bot') {
        this.ui.overlay = {kind: 'confirm', id: 'unseat-bot', cursor: 0};
      } else {
        this.ui.overlay = {kind: 'confirm', id: 'remove-human', index: overlay.target.index, cursor: 0};
      }
    },
    onRemovePressed(): void {
      if (this.ui.deck !== 'crew') {
        return;
      }
      const row = this.crew[this.ui.cursor.crew];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'bot') {
        this.ui.overlay = {kind: 'confirm', id: 'unseat-bot', cursor: 0};
      } else if (row.kind === 'human' && row.removable) {
        this.ui.overlay = {kind: 'confirm', id: 'remove-human', index: row.index, cursor: 0};
      }
    },
    executeConfirm(): void {
      const overlay = this.ui.overlay;
      if (overlay?.kind !== 'confirm') {
        return;
      }
      switch (overlay.id) {
      case 'seat-bot':
        seatBot();
        clampCreateCursors();
        this.openBotEditor();
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
          const id = this.identityState.identity;
          if (id !== undefined) {
            applyCreatorIdentity(id.displayName, id.cubeColor);
          }
        }
        consoleCreateUi.restored = false;
        break;
      }
      clampCreateCursors();
      this.ui.overlay = undefined;
    },
    closeOverlay(): void {
      this.ui.overlay = undefined;
    },
    // ── Launch flow ────────────────────────────────────────────────────
    onLaunchPressed(): void {
      if (createGameState.creating) {
        return;
      }
      if (this.ready) {
        this.ui.overlay = {kind: 'launch'};
        return;
      }
      if (jumpToFirstIssue()) {
        this.armShake(this.ui.deck, this.ui.cursor[this.ui.deck]);
      }
    },
    doLaunch(): void {
      if (createGameState.creating || !this.ready) {
        return;
      }
      // First-run identity capture: the launcher profile powers the join /
      // continue lists — seed it from the creator seat when it is still empty.
      const slot0 = createGameState.config.players[0];
      if (this.identityState.identity === undefined && slot0 !== undefined && slot0.name.trim() !== '') {
        setIdentity(slot0.name.trim(), slot0.color);
      }
      if (this.isCampaign) {
        void submitPremiumCreateCampaign();
      } else {
        void submitPremiumCreateGame();
      }
    },
    // ── Shake feedback ─────────────────────────────────────────────────
    shakeRowFor(deck: CreateDeckId): number {
      return this.shakeDeck === deck ? this.shakeRow : -1;
    },
    armShake(deck: CreateDeckId, row: number): void {
      this.clearShake();
      this.shakeDeck = deck;
      this.shakeRow = row;
      this.shakeTimer = setTimeout(() => {
        this.shakeDeck = undefined;
        this.shakeRow = -1;
        this.shakeTimer = undefined;
      }, SHAKE_MS);
    },
    clearShake(): void {
      if (this.shakeTimer !== undefined) {
        clearTimeout(this.shakeTimer);
        this.shakeTimer = undefined;
      }
      this.shakeDeck = undefined;
      this.shakeRow = -1;
    },
  },
});
</script>
