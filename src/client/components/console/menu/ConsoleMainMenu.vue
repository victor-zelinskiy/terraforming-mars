<template>
  <div class="cm-menu" :class="{'cm-menu--dimmed': overlay !== undefined}">
    <div class="cm-menu__bg" aria-hidden="true"></div>
    <div class="cm-menu__vignette" aria-hidden="true"></div>

    <header class="cm-menu__head">
      <div class="cm-menu__brand">
        <span class="cm-menu__brand-terra">TERRAFORMING</span>
        <span class="cm-menu__brand-mars">MARS</span>
        <span class="cm-menu__brand-badge">PREMIUM EDITION</span>
      </div>
      <button type="button" class="cm-identity" @click="openProfile">
        <span class="cm-identity__cube" :class="identityCubeClass" aria-hidden="true"></span>
        <span class="cm-identity__text">
          <span class="cm-identity__kicker">{{ $t('Player') }}</span>
          <span class="cm-identity__name">{{ identityName !== '' ? identityName : $t('Set your name') }}</span>
        </span>
      </button>
    </header>

    <nav class="cm-menu__items" :aria-label="$t('Main menu')">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        type="button"
        class="cm-item"
        :class="{
          'cm-item--cursor': i === cursor,
          'cm-item--primary': item.id === 'continue' || (item.id === 'create' && continueItem === undefined),
        }"
        @click="activateAt(i)"
        @mousemove="cursor = i"
      >
        <span class="cm-item__glyph" aria-hidden="true">{{ item.glyph }}</span>
        <span class="cm-item__text">
          <span class="cm-item__label">{{ $t(item.labelKey) }}</span>
          <span v-if="item.subText !== ''" class="cm-item__sub">{{ item.subText }}</span>
        </span>
        <span v-if="item.badge > 0" class="cm-item__badge">{{ item.badge }}</span>
        <span class="cm-item__hint" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
      </button>
    </nav>

    <!-- ── My games (continue / join) ──────────────────────────────────── -->
    <div v-if="overlay === 'games'" class="cm-overlay" role="dialog" :aria-label="$t('My games')">
      <div class="cm-overlay__card cm-overlay__card--wide">
        <div class="cm-overlay__title">{{ $t('My games') }}</div>
        <div v-if="joinGamesState.loading && !joinGamesState.loadedOnce" class="cm-gamelist__empty">{{ $t('Loading') }}…</div>
        <div v-else-if="joinGamesState.error" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not load your games') }}</div>
        <div v-else-if="games.length === 0" class="cm-gamelist__empty">{{ $t('You have no unfinished games yet.') }}</div>
        <ConsoleScrollArea v-else ref="gamesScroll" class="cm-gamelist-scroll">
          <div class="cm-gamelist">
          <button
            v-for="(g, i) in games"
            :key="g.id"
            type="button"
            class="cm-game"
            :class="{'cm-game--cursor': i === gamesCursor, 'cm-game--disabled': !joinable(g)}"
            @click="enterGameAt(i)"
            @mousemove="gamesCursor = i"
          >
            <div class="cm-game__head">
              <span class="cm-game__name">{{ g.name }}</span>
              <span v-if="yourTurn(g)" class="cm-game__turn">{{ $t('Your turn') }}</span>
              <span v-else-if="!joinable(g)" class="cm-game__note">{{ $t(g.ambiguous ? 'Several players share your name here' : 'No seat with your name') }}</span>
            </div>

            <!-- Crew — who you're playing against (names visible, YOU + whose turn marked). -->
            <div class="cm-game__crew">
              <span
                v-for="p in gameCrew(g)"
                :key="p.color"
                class="cm-game__player"
                :class="{'cm-game__player--you': p.isYou, 'cm-game__player--active': p.isActive}"
              >
                <span v-if="p.isActive" class="cm-game__pturn" aria-hidden="true"></span>
                <span class="cm-game__pcube" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
                <span class="cm-game__pname">{{ p.name }}</span>
                <span v-if="p.isYou" class="cm-game__ptag">{{ $t('You') }}</span>
              </span>
            </div>

            <div class="cm-game__foot">
              <span class="cm-game__meta">
                <span>{{ $t('Generation') }} {{ g.generation }}</span>
                <span class="cm-game__dot" aria-hidden="true">·</span>
                <span>{{ boardLabel(g) }}</span>
              </span>
              <span v-if="gameExpansions(g).length > 0" class="cm-game__exp">
                <img
                  v-for="e in gameExpansions(g).slice(0, 8)"
                  :key="e.id"
                  :src="e.url"
                  :alt="$t(e.label)"
                  :title="$t(e.label)"
                  draggable="false"
                />
                <span v-if="gameExpansions(g).length > 8" class="cm-game__exp-more">+{{ gameExpansions(g).length - 8 }}</span>
              </span>
            </div>
          </button>
          </div>
        </ConsoleScrollArea>
      </div>
    </div>

    <!-- ── Profile editor ──────────────────────────────────────────────── -->
    <ConsoleProfileEditor v-if="overlay === 'profile'" ref="profile" @close="closeOverlay" />

    <!-- ── Language picker (Y) ─────────────────────────────────────────── -->
    <ConsoleLanguagePicker v-if="overlay === 'language'" ref="language" @close="closeOverlay" />

    <!-- ── Quit confirm ────────────────────────────────────────────────── -->
    <div v-if="overlay === 'quit'" class="cm-overlay" role="dialog" :aria-label="$t('Exit the game?')">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t('Exit the game?') }}</div>
        <div class="cm-overlay__body">{{ $t('The application will close.') }}</div>
        <div class="cm-confirm__pad">
          <button type="button" class="cm-confirm__btn cm-confirm__btn--danger" @click="onQuitConfirm">
            <GamepadGlyph control="confirm" /><span>{{ $t('Exit') }}</span>
          </button>
          <button type="button" class="cm-confirm__btn" @click="closeOverlay">
            <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── First-run "Add to Steam" prompt (Windows) ───────────────────── -->
    <div v-if="overlay === 'steam'" class="cm-overlay" role="dialog" :aria-label="$t('Add to Steam?')">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t('Add to Steam?') }}</div>
        <div class="cm-overlay__body">{{ $t('Add a Steam shortcut with artwork so you can launch Terraforming Mars from your library.') }}</div>
        <div class="cm-confirm__pad">
          <button type="button" class="cm-confirm__btn" @click="onSteamAdd">
            <GamepadGlyph control="confirm" /><span>{{ $t('Add to Steam') }}</span>
          </button>
          <button type="button" class="cm-confirm__btn" @click="onSteamDismiss">
            <GamepadGlyph control="back" /><span>{{ $t('Not now') }}</span>
          </button>
        </div>
      </div>
    </div>

    <footer class="cm-menu__foot">
      <span class="cm-menu__foot-lang"><GamepadGlyph control="inspect" />{{ $t('Language') }}: {{ currentLangCode }}</span>
      <span v-if="version !== ''" class="cm-menu__foot-version">
        <span class="cm-menu__foot-version-tag">{{ $t('version') }}</span>
        <span class="cm-menu__foot-version-value">{{ version }}</span>
      </span>
    </footer>

    <ConsoleCommandBar :context="commandContext" :commands="commands" />
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE-NATIVE MAIN MENU — the pre-game "big plates" screen (Steam Deck /
 * TV posture). Navigation is pure screen state (cursor over the items),
 * driven by semantic pad intents through consoleMenuPad — DOM focus never
 * drives it; mouse clicks work as a fallback (click = activate).
 *
 * Items: CONTINUE (the most recent unfinished game with the player's seat —
 * one press back into the party), NEW GAME (the console create flow),
 * MY GAMES (the full joinable list), PROFILE (name + cube colour), EXIT
 * (Electron only). The command bar at the bottom is the single source of
 * button truth; Menu/system stays global (GamepadLayer).
 *
 * FOUNDATION PILOT (CONSOLE_FOUNDATION.md): a console-native SURFACE — it
 * acquires the page-level overflow lock (html.console-native, body scroll
 * lock) for its lifetime; the games list scrolls inside a ConsoleScrollArea
 * (never the page) and keeps the cursored row visible via ensureVisible;
 * intent handling resolves SEMANTIC actions (consoleActionOf) instead of
 * pattern-matching raw buttons.
 */
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {vueRoot} from '@/client/components/vueRoot';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad, menuPadState} from '@/client/console/menu/consoleMenuPad';
import {stepIndex} from '@/client/console/consoleRouter';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleProfileEditor from '@/client/components/console/menu/ConsoleProfileEditor.vue';
import ConsoleLanguagePicker from '@/client/components/console/menu/ConsoleLanguagePicker.vue';
import {identityState, ensureIdentityLoaded} from '@/client/components/mainMenu/identity/identityState';
import {joinGamesState, hydrateJoinableGames, loadJoinableGames, startJoinPolling, stopJoinPolling} from '@/client/components/mainMenu/joinGamesState';
import {lastGameEntered, recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {quitApp, supportsNativeQuit} from '@/client/console/runtimeMode';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';
import {Expansion} from '@/common/cards/GameModule';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';
import {addToSteam, dismissSteamPrompt, initSteamShortcut, steamButtonVisible, steamPromptVisible, steamShortcutState} from '@/client/components/desktop/steamShortcutState';
import raw_settings from '@/genfiles/settings.json';
import {$t} from '@/client/directives/i18n';

type MenuItemId = 'continue' | 'create' | 'games' | 'profile' | 'steam' | 'quit';
type MenuItem = {id: MenuItemId, labelKey: string, subText: string, glyph: string, badge: number};
type MenuOverlay = 'games' | 'profile' | 'language' | 'quit' | 'steam' | undefined;

export default defineComponent({
  name: 'ConsoleMainMenu',
  components: {ConsoleCommandBar, ConsoleScrollArea, GamepadGlyph, ConsoleProfileEditor, ConsoleLanguagePicker},
  setup() {
    // Foundation: page-level overflow lock while this screen owns the viewport.
    useConsoleNativeSurface();
  },
  data() {
    return {
      identityState,
      joinGamesState,
      cursor: 0,
      gamesCursor: 0,
      overlay: undefined as MenuOverlay,
      offPad: undefined as (() => void) | undefined,
      desktopVersion: '',
      steamState: steamShortcutState,
    };
  },
  computed: {
    identityName(): string {
      return this.identityState.identity?.displayName ?? '';
    },
    identityCubeClass(): string {
      const color = this.identityState.identity?.cubeColor;
      return color !== undefined ? `player_bg_color_${color}` : 'cm-identity__cube--empty';
    },
    games(): ReadonlyArray<JoinableGameSummary> {
      return this.joinGamesState.games;
    },
    continueItem(): JoinableGameSummary | undefined {
      const mine = this.games.filter((g) => g.you !== undefined);
      if (mine.length === 0) {
        return undefined;
      }
      // Prefer the game the player LAST ENTERED (recorded on every game-enter),
      // not the newest-created — otherwise a game they created but abandoned
      // would out-rank the party they actually last sat down at. Fall back to
      // newest-created when the recorded game is finished / no longer joinable.
      const lastId = lastGameEntered();
      const last = lastId !== '' ? mine.find((g) => g.id === lastId) : undefined;
      return last ?? [...mine].sort((a, b) => b.createdTimeMs - a.createdTimeMs)[0];
    },
    version(): string {
      if (this.desktopVersion !== '') {
        return this.desktopVersion;
      }
      const settingsVersion = (raw_settings as {version?: string}).version;
      return settingsVersion !== undefined && settingsVersion !== '' ? settingsVersion : (raw_settings.head ?? '');
    },
    currentLangCode(): string {
      return String(getPreferences().lang ?? 'ru').toUpperCase();
    },
    items(): ReadonlyArray<MenuItem> {
      const items: Array<MenuItem> = [];
      const cont = this.continueItem;
      if (cont !== undefined) {
        const turn = this.yourTurn(cont) ? ` · ${$t('Your turn')}` : '';
        items.push({
          id: 'continue',
          labelKey: 'Continue',
          subText: `${cont.name} · ${$t('Generation')} ${cont.generation}${turn}`,
          glyph: '▶',
          badge: 0,
        });
      }
      items.push({id: 'create', labelKey: 'New game', subText: $t('Set up the players, map and rules of the party'), glyph: '◈', badge: 0});
      items.push({id: 'games', labelKey: 'My games', subText: $t('Continue or join your unfinished games'), glyph: '⧉', badge: this.games.filter((g) => g.you !== undefined).length});
      items.push({id: 'profile', labelKey: 'Player profile', subText: this.identityName !== '' ? this.identityName : $t('Set your name'), glyph: '◉', badge: 0});
      // Windows desktop, shortcut not yet added → an explicit "Add to Steam" plate (shared
      // steamShortcutState; disappears once added). steamButtonVisible() reads the reactive
      // fields, so this computed re-evaluates when they change.
      if (steamButtonVisible()) {
        items.push({id: 'steam', labelKey: 'Add to Steam library', subText: '', glyph: '⊕', badge: 0});
      }
      if (supportsNativeQuit()) {
        items.push({id: 'quit', labelKey: 'Exit', subText: '', glyph: '⏻', badge: 0});
      }
      return items;
    },
    commandContext(): string {
      if (this.overlay === 'games') {
        return 'My games';
      }
      if (this.overlay === 'profile') {
        return 'Player profile';
      }
      if (this.overlay === 'quit') {
        return 'Exit the game?';
      }
      if (this.overlay === 'steam') {
        return 'Add to Steam?';
      }
      return 'Main menu';
    },
    commands(): ReadonlyArray<ConsoleCommand> {
      if (this.overlay === 'games') {
        const g = this.games[this.gamesCursor];
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Enter game', enabled: g !== undefined && this.joinable(g), highlight: g !== undefined && this.yourTurn(g)},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.overlay === 'profile') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Change'},
          {control: 'back', label: 'Done'},
        ];
      }
      if (this.overlay === 'quit') {
        return [
          {control: 'confirm', label: 'Exit'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      if (this.overlay === 'steam') {
        return [
          {control: 'confirm', label: 'Add to Steam'},
          {control: 'back', label: 'Not now'},
        ];
      }
      if (this.overlay === 'language') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Close'},
        ];
      }
      // No «System» here (fix): the system overlay is an IN-GAME affordance
      // (view controls / return to menu); at the menu there is nowhere to
      // return to. Y opens the language picker instead.
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: 'Select'},
        {control: 'inspect', label: 'Language'},
      ];
    },
  },
  created() {
    // Resolve the identity + hydrate the joinable list from the cross-session
    // cache BEFORE the first render, so CONTINUE / the My-games badge are on
    // the first painted frame instead of popping in after the fetch (the flash).
    ensureIdentityLoaded();
    hydrateJoinableGames(this.identityName);
  },
  watch: {
    // The Steam state loads async (getSteamState). When it arrives, show the first-run prompt
    // if it's warranted (Windows first launch, not added, not dismissed) and nothing else is open.
    'steamState.loaded'(loaded: boolean) {
      if (loaded === true) {
        this.maybeShowSteamPrompt();
      }
    },
  },
  mounted() {
    setDocumentTitle('Terraforming Mars');
    ensureIdentityLoaded();
    initSteamShortcut();
    this.maybeShowSteamPrompt();
    this.offPad = installMenuPad((intent) => this.onIntent(intent));
    const name = this.identityName;
    if (name !== '') {
      void loadJoinableGames(name, {silent: true});
      startJoinPolling();
    }
    // Version readout (desktop shell prefers the baked app version; web uses settings.json).
    const bridge = desktopBridge();
    if (bridge !== undefined) {
      void bridge.getVersion().then((v) => {
        this.desktopVersion = typeof v === 'string' ? v : '';
      }).catch(() => undefined);
    }
  },
  beforeUnmount() {
    this.offPad?.();
    stopJoinPolling();
  },
  methods: {
    onIntent(intent: GamepadIntent): boolean {
      // Foundation: raw press intents resolve to SEMANTIC console actions —
      // screens compare actions ('primary'/'back'), never button names.
      const action = consoleActionOf(intent);
      // The profile editor hosts the text-entry fallback — route to it.
      if (this.overlay === 'profile') {
        const profile = this.$refs.profile as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        if (profile?.handleIntent?.(intent) === true) {
          return true;
        }
        if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (this.overlay === 'language') {
        const picker = this.$refs.language as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return picker?.handleIntent?.(intent) ?? true;
      }
      if (this.overlay === 'games') {
        if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
          this.gamesCursor = stepIndex(this.gamesCursor, intent.dir === 'down' ? 1 : -1, this.games.length);
          this.keepGamesCursorVisible();
          return true;
        }
        if (action === 'primary') {
          this.enterGameAt(this.gamesCursor);
          return true;
        }
        if (action === 'back') {
          this.closeOverlay();
          return true;
        }
        return true;
      }
      if (this.overlay === 'quit') {
        if (action === 'primary') {
          this.onQuitConfirm();
        } else if (action === 'back') {
          this.closeOverlay();
        }
        return true;
      }
      if (this.overlay === 'steam') {
        if (action === 'primary') {
          this.onSteamAdd();
        } else if (action === 'back') {
          this.onSteamDismiss();
        }
        return true;
      }
      // Root list.
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.cursor = stepIndex(this.cursor, intent.dir === 'down' ? 1 : -1, this.items.length);
        return true;
      }
      if (action === 'primary') {
        this.activateAt(this.cursor);
        return true;
      }
      // Y (physical inspect button) opens the language picker.
      if (intent.kind === 'press' && intent.button === 'inspect') {
        this.overlay = 'language';
        return true;
      }
      // Swallow the rest — nothing below this screen should react.
      return true;
    },
    /** Keep the cursored games row inside the ConsoleScrollArea viewport. */
    keepGamesCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.gamesScroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-game--cursor'));
      });
    },
    activateAt(i: number): void {
      this.cursor = i;
      const item = this.items[i];
      if (item === undefined) {
        return;
      }
      switch (item.id) {
      case 'continue': {
        const cont = this.continueItem;
        if (cont?.you !== undefined) {
          recordLastGameEntered(cont.id);
          navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(cont.you.id), 'expedition');
        }
        break;
      }
      case 'create':
        vueRoot(this).navigateInApp(paths.NEW_GAME_PREMIUM);
        break;
      case 'games':
        this.overlay = 'games';
        this.gamesCursor = 0;
        if (this.identityName !== '') {
          void loadJoinableGames(this.identityName);
        }
        break;
      case 'profile':
        this.openProfile();
        break;
      case 'steam':
        void addToSteam();
        break;
      case 'quit':
        this.overlay = 'quit';
        break;
      }
    },
    onSteamAdd(): void {
      this.overlay = undefined;
      void addToSteam();
    },
    onSteamDismiss(): void {
      this.overlay = undefined;
      dismissSteamPrompt();
    },
    /** Show the first-run Steam prompt once, if warranted and no other overlay is open. */
    maybeShowSteamPrompt(): void {
      if (this.overlay === undefined && steamPromptVisible()) {
        this.overlay = 'steam';
      }
    },
    openProfile(): void {
      this.overlay = 'profile';
    },
    closeOverlay(): void {
      this.overlay = undefined;
      menuPadState.textEntry = false;
      // The profile may have just set the identity — refresh the games list.
      const name = this.identityName;
      if (name !== '') {
        void loadJoinableGames(name, {silent: true});
      }
    },
    joinable(g: JoinableGameSummary): boolean {
      return g.you !== undefined;
    },
    yourTurn(g: JoinableGameSummary): boolean {
      return g.you !== undefined && g.activePlayer === g.you.color;
    },
    boardLabel(g: JoinableGameSummary): string {
      return $t(mapLabelKey(g.boardName));
    },
    /** Crew for the row — names visible, YOU tagged, whose-turn (active) flagged. */
    gameCrew(g: JoinableGameSummary): ReadonlyArray<{name: string, color: string, isYou: boolean, isActive: boolean}> {
      return g.players.map((p) => ({
        name: p.name,
        color: p.color,
        isYou: p.isYou,
        isActive: g.activePlayer === p.color,
      }));
    },
    /** Enabled expansions as premium icon chips (same artwork as the create screen). */
    gameExpansions(g: JoinableGameSummary): ReadonlyArray<{id: Expansion, url: string, label: string}> {
      return g.expansions.map((e) => ({id: e, url: expansionIconUrl(e), label: expansionLabel(e)}));
    },
    enterGameAt(i: number): void {
      this.gamesCursor = i;
      const g = this.games[i];
      if (g?.you !== undefined) {
        recordLastGameEntered(g.id);
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(g.you.id), 'expedition');
      }
    },
    onQuitConfirm(): void {
      this.overlay = undefined;
      quitApp();
    },
  },
});
</script>
