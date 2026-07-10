<template>
  <div class="cm-create">
    <div class="cm-menu__bg" aria-hidden="true"></div>
    <div class="cm-menu__vignette" aria-hidden="true"></div>

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

    <ConsoleLaunchConfirm
      v-if="ui.overlay?.kind === 'launch'"
      @confirm="doLaunch"
      @cancel="closeOverlay"
    />

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
  CREATE_DECKS,
  CreateDeckId,
  CrewRow,
  ExpansionRow,
  MapRow,
  ParticipantTypeOption,
  RuleRow,
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
  ruleRows,
  seatBot,
  seatBotNeedsConfirm,
  selectMap,
  toggleExpansion,
  toggleRule,
  unseatBot,
} from '@/client/console/menu/consoleCreateModel';
import {
  applyCreatorIdentity,
  clearSavedCreateGameState,
  createGameState,
  resetCreateGameState,
  restoreCreateGameState,
} from '@/client/components/create/premium/createGameState';
import {submitPremiumCreateGame} from '@/client/components/create/premium/submitCreateGame';
import {identityState, ensureIdentityLoaded, setIdentity} from '@/client/components/mainMenu/identity/identityState';
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
      return CREATE_DECKS;
    },
    crew(): ReadonlyArray<CrewRow> {
      return crewRows();
    },
    rules(): ReadonlyArray<RuleRow> {
      return ruleRows();
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
      return 'Create new game';
    },
    commands(): ReadonlyArray<ConsoleCommand> {
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
      const verb = this.deckVerb;
      const cmds: Array<ConsoleCommand> = [
        {control: 'bumperL', control2: 'bumperR', label: 'Section'},
        {control: 'confirm', label: verb.label, enabled: verb.enabled},
      ];
      if (this.removeHintVisible) {
        cmds.push({control: 'inspect', label: 'Remove'});
      }
      cmds.push({control: 'secondary', label: this.ready ? 'Launch the party' : 'Go to the first issue', highlight: this.ready});
      cmds.push({control: 'back', label: 'Main menu'});
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
      case 'rules':
      case 'expansions':
        return {label: 'Toggle', enabled: true};
      case 'map': {
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
  mounted() {
    setDocumentTitle('Create new game');
    ensureIdentityLoaded();
    const restored = restoreCreateGameState();
    if (!restored) {
      resetCreateGameState();
    }
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
      const overlay = this.ui.overlay;
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
        vueRoot(this).navigateInApp('/');
        return true;
      default:
        return true;
      }
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
      if (row !== undefined) {
        toggleRule(row.meta.id);
        clampCreateCursors(); // altVenus visibility may change the row count.
      }
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
      void submitPremiumCreateGame();
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
