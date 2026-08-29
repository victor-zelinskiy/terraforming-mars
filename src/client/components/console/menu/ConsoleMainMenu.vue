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
        <!-- The slice is a TAB, not another screen: «МОИ ПАРТИИ» is the stable
             context and only the strip on its right changes (L3 toggles it; a
             click works as the mouse fallback). The archive rows lead to the
             settled final scoring, so the same list serves both. -->
        <div class="cm-overlay__head">
          <div class="cm-overlay__title">{{ $t('My games') }}</div>
          <div class="cm-gametabs" role="tablist" :aria-label="$t('My games')">
            <button
              v-for="tab in gamesTabs"
              :key="tab.id"
              type="button"
              class="cm-gametab"
              :class="{'cm-gametab--on': tab.id === gamesTab}"
              role="tab"
              :aria-selected="tab.id === gamesTab"
              @click="setGamesTab(tab.id)"
            >
              <span>{{ $t(tab.label) }}</span>
              <span v-if="tab.count !== undefined" class="cm-gametab__count">{{ tab.count }}</span>
            </button>
            <span class="cm-gametabs__hint" aria-hidden="true"><GamepadGlyph control="stickL" /></span>
          </div>
        </div>
        <div v-if="gamesTab === 'finished'" class="cm-overlay__body cm-overlay__body--dim">
          {{ $t('Open a finished game to review the results or replay the final scoring.') }}
        </div>
        <!-- FOUR distinct answers, never one sentence for all of them: no name
             yet · still asking · asked and failed · asked and there are none.
             Collapsing them is what made a party that existed read as one that
             did not. -->
        <div v-if="gamesNeedName" class="cm-gamelist__empty">{{ $t('Set your player name to see your games') }}</div>
        <div v-else-if="gamesFirstLoad" class="cm-gamelist__empty">{{ $t('Loading') }}…</div>
        <div v-else-if="gamesLoadError" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not load your games') }}</div>
        <div v-else-if="gamesRowCount === 0 && !lanEntryVisible" class="cm-gamelist__empty">{{ $t(gamesEmptyKey) }}</div>
        <ConsoleScrollArea v-else ref="gamesScroll" class="cm-gamelist-scroll">
          <div class="cm-gamelist">
          <button
            v-for="(g, i) in localRows"
            :key="g.id"
            type="button"
            class="cm-game"
            :class="{'cm-game--cursor': i === gamesCursor, 'cm-game--disabled': !joinable(g)}"
            @click="enterGameAt(i)"
            @mousemove="gamesCursor = i"
          >
            <div class="cm-game__head">
              <span class="cm-game__name">{{ g.name }}</span>
              <span v-if="isNewGame(g)" class="cm-game__new">{{ $t('New') }}</span>
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
                <!-- The age leads: the list is sorted by it, so it is what
                     explains the order rather than a rule taken on trust. -->
                <span class="cm-game__age">{{ createdAgo(g) }}</span>
                <span class="cm-game__dot" aria-hidden="true">·</span>
                <span>{{ $t('Generation') }} {{ g.generation }}</span>
                <span class="cm-game__dot" aria-hidden="true">·</span>
                <span>{{ boardLabel(g) }}</span>
              </span>
              <span v-if="gameExpansions(g).length > 0" class="cm-game__exp">
                <!-- No native title tooltip (banned): the pad has no hover, alt carries a11y. -->
                <img
                  v-for="e in gameExpansions(g).slice(0, 8)"
                  :key="e.id"
                  :src="e.url"
                  :alt="$t(e.label)"
                  draggable="false"
                />
                <span v-if="gameExpansions(g).length > 8" class="cm-game__exp-more">+{{ gameExpansions(g).length - 8 }}</span>
              </span>
            </div>
          </button>

          <!-- LAN hosts (host-as-server mode): games discovered over mDNS on other
               couches. Joining pins the seat to that host's server and navigates —
               the session then talks to the host directly (docs/EMBEDDED_SERVER.md §6). -->
          <template v-if="lanSectionVisible">
            <!-- The listing is NAME-scoped, and that is invisible unless it is
                 said: a host with no row is usually a seat under another name,
                 not a broken network. -->
            <div class="cm-gamelist__lanhead">
              {{ $t('On your local network') }}
              <span v-if="identityName !== ''" class="cm-gamelist__lanwho">{{ $t('games with') }} «{{ identityName }}»</span>
            </div>
            <!-- A host that stopped answering SAYS SO, and says WHY. Silence
                 here used to be indistinguishable from «that couch has no
                 games», which is what made a LAN problem undiagnosable. -->
            <div v-for="host in lanTrouble" :key="host.id" class="cm-gamelist__lanstatus">
              {{ host.label }} — {{ $t('not responding') }}<template v-if="host.reason !== ''"> · {{ host.reason }}</template>
            </div>
            <div v-for="host in lanEmptyHosts" :key="host.id" class="cm-gamelist__lanstatus cm-gamelist__lanstatus--calm">
              {{ host.label }} — {{ $t('no games with your name') }}
            </div>
            <button
              v-for="(row, k) in visibleLanRows"
              :key="row.key"
              type="button"
              class="cm-game cm-game--lan"
              :class="{'cm-game--cursor': localRows.length + k === gamesCursor, 'cm-game--disabled': !joinable(row.game) || row.stale}"
              @click="enterGameAt(localRows.length + k)"
              @mousemove="gamesCursor = localRows.length + k"
            >
              <div class="cm-game__head">
                <span class="cm-game__name">{{ row.game.name }}</span>
                <span v-if="isNewGame(row.game)" class="cm-game__new">{{ $t('New') }}</span>
                <span class="cm-game__lanhost">{{ row.hostName }}</span>
                <span v-if="row.stale" class="cm-game__note">{{ $t('not responding') }}</span>
                <span v-else-if="yourTurn(row.game)" class="cm-game__turn">{{ $t('Your turn') }}</span>
                <span v-else-if="!joinable(row.game)" class="cm-game__note">{{ $t(row.game.ambiguous ? 'Several players share your name here' : 'No seat with your name') }}</span>
                <span v-else-if="row.versionMismatch" class="cm-game__note">{{ $t('Host version differs from yours') }}</span>
              </div>
              <div class="cm-game__crew">
                <span
                  v-for="p in gameCrew(row.game)"
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
                  <span class="cm-game__age">{{ createdAgo(row.game) }}</span>
                  <span class="cm-game__dot" aria-hidden="true">·</span>
                  <span>{{ $t('Generation') }} {{ row.game.generation }}</span>
                  <span class="cm-game__dot" aria-hidden="true">·</span>
                  <span>{{ boardLabel(row.game) }}</span>
                </span>
              </div>
            </button>
          </template>

          <!-- With the add-a-host tool present the list is never «empty», so the
               answer to «сколько у меня партий» moves inside it. -->
          <div v-if="gamesRowCount === 0" class="cm-gamelist__empty cm-gamelist__empty--inline">{{ $t(gamesEmptyKey) }}</div>

          <!-- MANUAL HOST — the fallback that always works. Discovery is
               multicast, and multicast is the first thing a router's client
               isolation, a guest SSID or a firewall drops; without a typed
               address such a network has no way into a LAN game at all. Last in
               the cursor ring, so it never gets in the way of a real row. -->
          <button
            v-if="lanEntryVisible"
            type="button"
            class="cm-game cm-game--add"
            :class="{'cm-game--cursor': gamesCursor === gamesCount - 1}"
            @click="enterGameAt(gamesCount - 1)"
            @mousemove="gamesCursor = gamesCount - 1"
          >
            <div class="cm-game__head">
              <span class="cm-game__name">＋ {{ $t('Add a host by address') }}</span>
            </div>
            <div class="cm-game__foot">
              <span class="cm-game__meta">{{ $t('When the network hides other players, type their address') }}</span>
            </div>
          </button>
          </div>
        </ConsoleScrollArea>
      </div>
    </div>

    <!-- ── Local-game deletion confirm (host mode; stacked over the games list) ── -->
    <div v-if="overlay === 'games' && gamesConfirm !== undefined" class="cm-overlay" role="alertdialog" :aria-label="$t(gamesConfirm.kind === 'all' ? 'Delete all local games?' : 'Delete this game?')">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t(gamesConfirm.kind === 'all' ? 'Delete all local games?' : 'Delete this game?') }}</div>
        <div class="cm-overlay__body">
          <template v-if="gamesConfirm.kind === 'one'">
            <b>{{ gamesConfirm.game.name }}</b> — {{ $t('The game and its whole history will be permanently deleted.') }}
          </template>
          <template v-else>{{ $t('Every game stored on this device will be permanently deleted, including games of other profiles.') }}</template>
        </div>
        <div v-if="gamesError" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not delete the game') }}</div>
        <div class="cm-confirm__pad">
          <button type="button" class="cm-confirm__btn cm-confirm__btn--danger" :disabled="gamesDeleting" @click="executeGamesDelete">
            <GamepadGlyph control="confirm" /><span>{{ $t('Delete') }}</span>
          </button>
          <button type="button" class="cm-confirm__btn" @click="gamesConfirm = undefined">
            <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Manual LAN host entry (the on-screen keyboard owns every intent). -->
    <ConsoleVirtualKeyboard
      v-if="lanEntry"
      ref="lankeyboard"
      :initial="lanDraft"
      :title="'Host address'"
      :issue="lanIssue"
      @update="lanDraft = $event"
      @commit="commitManualHost"
      @cancel="cancelManualHost"
    />

    <!-- ── Profile editor ──────────────────────────────────────────────── -->
    <ConsoleProfileEditor v-if="overlay === 'profile'" ref="profile" @close="closeOverlay" @manage-friends="openFriends" @manage-profiles="openProfiles" />

    <!-- ── Profiles roster (opened from the profile — switch / add / remove) ── -->
    <ConsoleProfilesEditor v-if="overlay === 'profiles'" ref="profiles" @close="backToProfileFromProfiles" />

    <!-- ── Friends editor (opened from the profile) ────────────────────── -->
    <ConsoleFriendsEditor v-if="overlay === 'friends'" ref="friends" @close="backToProfileFromFriends" />

    <!-- ── Language picker (Y) ─────────────────────────────────────────── -->
    <ConsoleLanguagePicker v-if="overlay === 'language'" ref="language" @close="closeOverlay" />

    <!-- ── Options (interface + display) ───────────────────────────────── -->
    <ConsoleOptionsPanel v-if="overlay === 'options'" ref="options" @close="closeOverlay" />

    <!-- ── Admin: game rollback (dev-only, ADMIN_NAME) ─────────────────── -->
    <ConsoleAdminRollback v-if="overlay === 'admin'" ref="admin" :name="identityName" @close="closeOverlay" />

    <!-- ── Playground hub (admin-only dev stands) ──────────────────────── -->
    <ConsolePlaygroundHub v-if="overlay === 'playground'" ref="playground" @close="closeOverlay" />

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

    <!-- The settings console carries its OWN foot bar (it has to — in-game
         there is no menu bar under it), so showing the menu's bar behind it
         would print the same four verbs twice, in two sizes. -->
    <ConsoleCommandBar v-if="overlay !== 'options'" :context="commandContext" :commands="commands" />
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
 * FOUNDATION PILOT (docs/CONSOLE_FOUNDATION.md): a console-native SURFACE — it
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
import {JoinableGameStatus, JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad, menuPadState} from '@/client/console/menu/consoleMenuPad';
import {stepIndex} from '@/client/console/consoleRouter';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleProfileEditor from '@/client/components/console/menu/ConsoleProfileEditor.vue';
import ConsoleProfilesEditor from '@/client/components/console/menu/ConsoleProfilesEditor.vue';
import ConsoleFriendsEditor from '@/client/components/console/menu/ConsoleFriendsEditor.vue';
import ConsoleLanguagePicker from '@/client/components/console/menu/ConsoleLanguagePicker.vue';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import ConsoleAdminRollback from '@/client/components/console/menu/ConsoleAdminRollback.vue';
import ConsolePlaygroundHub from '@/client/components/console/menu/ConsolePlaygroundHub.vue';
import {isAdminName} from '@/common/utils/adminName';
import {identityState, ensureIdentityLoaded} from '@/client/components/mainMenu/identity/identityState';
import {ensureProfilesLoaded} from '@/client/components/mainMenu/profilesState';
import {prefillIdentityFromSteam} from '@/client/components/mainMenu/identity/steamIdentity';
import {
  lobbyState, LobbyRow,
  hydrateLobbyCache, startLobbyWatch, stopLobbyWatch, openLobbyList, closeLobbyList,
  setLobbyIdentity, refreshLobby, loadLobbyArchive, setLobbyOwnVersion,
  lobbyFirstLoad, lobbyUnreachable, localLobbySource,
} from '@/client/components/mainMenu/lobbyState';
import {initLanDiscovery, publishLanName, addManualHost, removeManualHost, lanState} from '@/client/components/mainMenu/lanState';
import {lobbyAge, lobbyAgeLabel} from '@/client/components/mainMenu/lobbyAge';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';
import {pinServerEndpoint} from '@/client/utils/serverEndpoints';
import {lastGameEntered, recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {quitApp, supportsNativeQuit} from '@/client/console/runtimeMode';
import {mapLabelKey} from '@/client/components/create/premium/createGameMeta';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';
import {Expansion} from '@/common/cards/GameModule';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {desktopBridge, startMenuUpdateWatch, stopMenuUpdateWatch} from '@/client/components/desktop/desktopUpdateState';
import {addToSteam, dismissSteamPrompt, initSteamShortcut, steamButtonVisible, steamPromptVisible, steamShortcutState} from '@/client/components/desktop/steamShortcutState';
import raw_settings from '@/genfiles/settings.json';
import {$t} from '@/client/directives/i18n';

type MenuItemId = 'continue' | 'create' | 'games' | 'profile' | 'options' | 'admin' | 'playground' | 'steam' | 'quit';
type MenuItem = {id: MenuItemId, labelKey: string, subText: string, glyph: string, badge: number};
type MenuOverlay = 'games' | 'profile' | 'profiles' | 'friends' | 'language' | 'options' | 'admin' | 'playground' | 'quit' | 'steam' | undefined;

export default defineComponent({
  name: 'ConsoleMainMenu',
  components: {ConsoleCommandBar, ConsoleScrollArea, GamepadGlyph, ConsoleVirtualKeyboard, ConsoleProfileEditor, ConsoleProfilesEditor, ConsoleFriendsEditor, ConsoleLanguagePicker, ConsoleOptionsPanel, ConsoleAdminRollback, ConsolePlaygroundHub},
  setup() {
    // Foundation: page-level overflow lock while this screen owns the viewport.
    useConsoleNativeSurface();
  },
  data() {
    return {
      identityState,
      lobbyState,
      cursor: 0,
      gamesCursor: 0,
      /** Which slice of «Мои партии» the list shows (L3 toggles). */
      gamesTab: 'active' as JoinableGameStatus,
      overlay: undefined as MenuOverlay,
      offPad: undefined as (() => void) | undefined,
      desktopVersion: '',
      steamState: steamShortcutState,
      // Host-as-server: local-game deletion (X = one, Y = all; both confirmed).
      appModeEffective: undefined as 'host' | 'remote' | undefined,
      gamesConfirm: undefined as undefined | {kind: 'one', game: JoinableGameSummary} | {kind: 'all'},
      gamesDeleting: false,
      gamesError: false,
      // Manual LAN host entry (the multicast-blocked fallback).
      lanState,
      lanEntry: false,
      lanDraft: '',
      lanIssue: '',
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
    isAdmin(): boolean {
      return isAdminName(this.identityName);
    },
    /** Unfinished games on THIS device's server. */
    games(): ReadonlyArray<JoinableGameSummary> {
      return this.lobbyState.localRows.map((row) => row.game);
    },
    /** The ARCHIVE — games of this player that have already ended. */
    finishedGames(): ReadonlyArray<JoinableGameSummary> {
      return this.lobbyState.archive;
    },
    /** The rows of the SHOWN slice that live on this server. */
    localRows(): ReadonlyArray<JoinableGameSummary> {
      return this.gamesTab === 'finished' ? this.finishedGames : this.games;
    },
    /** LAN hosts publish their UNFINISHED games only — the archive is local. */
    visibleLanRows(): ReadonlyArray<LobbyRow> {
      return this.gamesTab === 'finished' ? [] : this.lobbyState.lanRows;
    },
    /**
     * Cursor range of the games overlay: local rows, then LAN rows, then the
     * «add a host» affordance last — a real party is always ahead of a tool.
     */
    gamesCount(): number {
      return this.gamesRowCount + (this.lanEntryVisible ? 1 : 0);
    },
    /**
     * PARTIES only. The empty / loading / error states must answer «сколько у
     * меня партий», not «сколько строк на экране» — counting the add-a-host
     * tool as a row would silently retire «У вас пока нет незавершённых партий».
     */
    gamesRowCount(): number {
      return this.localRows.length + this.visibleLanRows.length;
    },
    /** The two slices as a segmented control (count shown once its list loaded). */
    gamesTabs(): ReadonlyArray<{id: JoinableGameStatus, label: string, count: number | undefined}> {
      return [
        {id: 'active', label: 'Active games', count: localLobbySource()?.lastOkAt !== undefined ? this.games.length : undefined},
        {id: 'finished', label: 'Finished games', count: this.lobbyState.archiveStatus === 'ok' ? this.finishedGames.length : undefined},
      ];
    },
    /**
     * «Загрузка…» — we have nothing to show AND are still finding out. This is
     * deliberately NOT the same state as «нет партий»: an unanswered list and an
     * empty library used to render the same sentence, which is how a LAN party
     * that existed read as one that did not.
     */
    gamesFirstLoad(): boolean {
      return this.gamesTab === 'finished' ?
        this.lobbyState.archiveStatus === 'loading' && this.finishedGames.length === 0 :
        lobbyFirstLoad();
    },
    /** We asked and could not find out — never rendered as «no games». */
    gamesLoadError(): boolean {
      return this.gamesTab === 'finished' ?
        this.lobbyState.archiveStatus === 'unreachable' && this.finishedGames.length === 0 :
        lobbyUnreachable();
    },
    /** No identity yet — the list is name-scoped, so say THAT, not «пусто». */
    gamesNeedName(): boolean {
      return this.identityName === '';
    },
    gamesEmptyKey(): string {
      return this.gamesTab === 'finished' ? 'You have no finished games yet.' : 'You have no unfinished games yet.';
    },
    /**
     * LAN hosts that could not be asked — SHOWN with the reason, never silently
     * absent. «Не отвечает» alone leaves the player unable to tell a slow couch
     * from a blocked port, which is the one thing they can act on.
     */
    lanTrouble(): ReadonlyArray<{id: string, label: string, reason: string}> {
      if (this.gamesTab === 'finished') {
        return [];
      }
      return this.lobbyState.sources
        .filter((s) => s.kind === 'lan' && s.status === 'unreachable')
        .map((s) => ({id: s.id, label: s.label, reason: s.lastError}));
    },
    /**
     * A LAN host that answered, but with nothing for THIS player. Also a state
     * that must speak: name matching is what a listing is scoped by, and a
     * silent empty section reads as «сеть не работает» when in fact the seat is
     * simply under another name.
     */
    lanEmptyHosts(): ReadonlyArray<{id: string, label: string}> {
      if (this.gamesTab === 'finished') {
        return [];
      }
      const withRows = new Set(this.lobbyState.lanRows.map((row) => row.sourceId));
      return this.lobbyState.sources
        .filter((s) => s.kind === 'lan' && s.status === 'ok' && !withRows.has(s.id))
        .map((s) => ({id: s.id, label: s.label}));
    },
    /** True when the LAN section has anything at all to say. */
    lanSectionVisible(): boolean {
      return this.visibleLanRows.length > 0 || this.lanTrouble.length > 0 || this.lanEmptyHosts.length > 0;
    },
    /**
     * The manual-host affordance. Only in the live slice, only on a shell that
     * has LAN at all — on the web there is nothing to type an address into.
     */
    lanEntryVisible(): boolean {
      return this.gamesTab !== 'finished' && this.appModeEffective === 'host';
    },
    /** Hand-typed hosts, so X can take one back off the list. */
    manualHosts(): ReadonlyArray<{entry: string}> {
      return this.lanState.manual;
    },
    /** Deletion is offered only for games on THIS device's embedded server. */
    canDeleteLocal(): boolean {
      return this.appModeEffective === 'host';
    },
    /** «Удалить все» wipes the device library — either slice proves it has one. */
    hasLocalGames(): boolean {
      return this.games.length > 0 || this.finishedGames.length > 0;
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
      items.push({id: 'options', labelKey: 'Options', subText: $t('Interface and display settings'), glyph: '⚙', badge: 0});
      // Dev-only tools — visible ONLY to the ADMIN_NAME identity.
      if (this.isAdmin) {
        items.push({id: 'admin', labelKey: 'Game rollback', subText: $t('Roll a game back to an earlier save'), glyph: '⟲', badge: 0});
        items.push({id: 'playground', labelKey: 'Playground', subText: $t('Visual dev stands of the interface'), glyph: '❏', badge: 0});
      }
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
      if (this.overlay === 'profiles') {
        return 'Profiles';
      }
      if (this.overlay === 'friends') {
        return 'Friends';
      }
      if (this.overlay === 'options') {
        return 'Options';
      }
      if (this.overlay === 'admin') {
        return 'Game rollback';
      }
      if (this.overlay === 'playground') {
        return 'Playground';
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
        if (this.gamesConfirm !== undefined) {
          return [
            {control: 'confirm', label: 'Delete'},
            {control: 'back', label: 'Cancel'},
          ];
        }
        const cursorLocal = this.gamesCursor < this.localRows.length ? this.localRows[this.gamesCursor] : undefined;
        const lanRow = cursorLocal === undefined ? this.visibleLanRows[this.gamesCursor - this.localRows.length] : undefined;
        const row = cursorLocal ?? lanRow?.game;
        // A row whose host has gone quiet stays LISTED (the game exists) but the
        // verb must not offer to enter it — the navigation would land on a
        // curtain that never lifts.
        const onAdd = this.onLanEntryRow();
        const enterable = onAdd || (row !== undefined && this.joinable(row) && lanRow?.stale !== true);
        const archive = this.gamesTab === 'finished';
        const manualRow = lanRow !== undefined && this.manualHosts.some((h) => h.entry === lanRow.hostName);
        const bar: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Navigate'},
          // A finished row is opened to READ it — the verb says so, since the
          // press leads to the settled final scoring, not into a turn.
          {control: 'confirm', label: onAdd ? 'Add a host' : (archive ? 'Open the results' : 'Enter game'), enabled: enterable, highlight: !onAdd && enterable && row !== undefined && this.yourTurn(row)},
          {control: 'stickL', label: archive ? 'Active games' : 'Finished games'},
          {control: 'triggerR', label: 'Refresh', enabled: !this.lobbyState.refreshing},
        ];
        if (manualRow) {
          // The same physical button, an honest label: on someone else's couch
          // there is no game to delete, only our own typed entry.
          bar.push({control: 'inspect', label: 'Remove host'});
        } else if (this.canDeleteLocal) {
          bar.push(
            {control: 'secondary', label: 'Delete', enabled: cursorLocal !== undefined},
            {control: 'inspect', label: 'Delete all', enabled: this.hasLocalGames},
          );
        }
        bar.push({control: 'back', label: 'Back'});
        return bar;
      }
      // No 'options' branch: the settings console owns its own foot bar and the
      // menu's is hidden while it is open (see the template).
      if (this.overlay === 'profile') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Change'},
          {control: 'back', label: 'Done'},
        ];
      }
      if (this.overlay === 'admin') {
        // The panel shows precise per-view foot hints; the bar stays generic.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.overlay === 'playground') {
        // A fullscreen stand covers this bar and shows its own foot hints.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Open'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.overlay === 'profiles') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          {control: 'inspect', label: 'Delete'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.overlay === 'friends') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Add friend'},
          {control: 'inspect', label: 'Remove'},
          {control: 'back', label: 'Back'},
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
    // The profile roster is the source of truth for the active identity —
    // hydrate it (migrating a legacy single identity + mirroring the active
    // profile into identityState) BEFORE the first render, so the header /
    // games reflect the active profile even before the profile editor is opened.
    ensureProfilesLoaded();
    hydrateLobbyCache(this.identityName);
  },
  watch: {
    /**
     * The identity may resolve AFTER the first frame (Steam prefill on a fresh
     * install, the profile roster, a profile switch). The lobby is name-scoped,
     * so this is the difference between a list and an empty screen — and its
     * absence is exactly why «Мои партии» used to need an app restart.
     */
    identityName(name: string) {
      setLobbyIdentity(name);
      if (name !== '') {
        publishLanName(name);
      }
    },
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
    // First launch with no saved name (Steam Deck / Steam Machine): prefill from the Steam display
    // name so the greeting + creator seat aren't empty. Reactive — the menu updates when it lands.
    void prefillIdentityFromSteam();
    initSteamShortcut();
    this.maybeShowSteamPrompt();
    this.offPad = installMenuPad((intent) => this.onIntent(intent));
    // Host-as-server: subscribe to LAN discovery pushes + advertise under the
    // active profile's name (both no-op on the web / remote mode). The effective
    // app mode gates the local-game deletion verbs in the games overlay.
    initLanDiscovery();
    void desktopBridge()?.getAppMode?.().then((info) => {
      if (info !== undefined) {
        this.appModeEffective = info.effective;
      }
    }).catch(() => {});
    // The lobby watch runs for the whole menu: it keeps CONTINUE and the badge
    // live (push + a slow fallback poll) even before «Мои партии» is opened, and
    // it starts with an EMPTY name too — the identity watcher above feeds it.
    startLobbyWatch(this.identityName);
    if (this.identityName !== '') {
      publishLanName(this.identityName);
    }
    // Version readout (desktop shell prefers the baked app version; web uses settings.json).
    const bridge = desktopBridge();
    if (bridge !== undefined) {
      void bridge.getVersion().then((v) => {
        this.desktopVersion = typeof v === 'string' ? v : '';
        // A LAN host on another build gets a warning on its rows.
        setLobbyOwnVersion(this.desktopVersion);
      }).catch(() => undefined);
    }
    // Watch for a new version for as long as the menu is up. The menu is the safe place to be
    // interrupted, so this is what makes "leave the game to the main menu" the way to update.
    startMenuUpdateWatch();
  },
  beforeUnmount() {
    this.offPad?.();
    stopLobbyWatch();
    stopMenuUpdateWatch();
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
      if (this.overlay === 'profiles') {
        const profiles = this.$refs.profiles as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        if (profiles?.handleIntent?.(intent) === true) {
          return true;
        }
        if (action === 'back') {
          this.backToProfileFromProfiles();
        }
        return true;
      }
      if (this.overlay === 'friends') {
        const friends = this.$refs.friends as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        if (friends?.handleIntent?.(intent) === true) {
          return true;
        }
        if (action === 'back') {
          this.backToProfileFromFriends();
        }
        return true;
      }
      if (this.overlay === 'language') {
        const picker = this.$refs.language as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return picker?.handleIntent?.(intent) ?? true;
      }
      if (this.overlay === 'options') {
        const options = this.$refs.options as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return options?.handleIntent?.(intent) ?? true;
      }
      if (this.overlay === 'admin') {
        const admin = this.$refs.admin as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return admin?.handleIntent?.(intent) ?? true;
      }
      if (this.overlay === 'playground') {
        const hub = this.$refs.playground as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return hub?.handleIntent?.(intent) ?? true;
      }
      if (this.overlay === 'games') {
        // The on-screen keyboard owns every intent while an address is typed.
        if (this.lanEntry) {
          const vk = this.$refs.lankeyboard as {handleIntent?: (i: GamepadIntent) => boolean} | undefined;
          if (vk?.handleIntent?.(intent) === true) {
            return true;
          }
          if (action === 'back') {
            this.cancelManualHost();
          }
          return true;
        }
        // The deletion confirm swallows everything but confirm/cancel.
        if (this.gamesConfirm !== undefined) {
          if (action === 'primary') {
            void this.executeGamesDelete();
          } else if (action === 'back') {
            this.gamesConfirm = undefined;
            this.gamesError = false;
          }
          return true;
        }
        if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
          this.gamesCursor = stepIndex(this.gamesCursor, intent.dir === 'down' ? 1 : -1, this.gamesCount);
          this.keepGamesCursorVisible();
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'stickL') {
          this.setGamesTab(this.gamesTab === 'finished' ? 'active' : 'finished');
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'triggerR') {
          this.refreshGames();
          return true;
        }
        if (action === 'primary') {
          this.enterGameAt(this.gamesCursor);
          return true;
        }
        if (action === 'inspect') {
          // On a hand-typed LAN host X takes the ENTRY away (there is nothing
          // else to delete on someone else's couch); on a local row it stays
          // the game-deletion verb.
          if (this.removeManualHostAt(this.gamesCursor)) {
            return true;
          }
          this.requestDeleteAt(this.gamesCursor);
          return true;
        }
        if (action === 'fullscreen') {
          // Y — delete ALL local games.
          this.requestDeleteAll();
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
        this.gamesTab = 'active';
        this.gamesCursor = 0;
        this.gamesConfirm = undefined;
        this.gamesError = false;
        // ENTERING THE SCREEN IS A REFRESH — unconditionally, every time, for
        // every source (this device + every LAN host). Showing something is
        // never a reason not to check whether it is still true.
        void openLobbyList();
        // The archive's count belongs on the tab chip before L3 is pressed.
        if (this.lobbyState.archiveStatus === 'idle') {
          void loadLobbyArchive();
        }
        break;
      case 'profile':
        this.openProfile();
        break;
      case 'options':
        this.overlay = 'options';
        break;
      case 'admin':
        this.overlay = 'admin';
        break;
      case 'playground':
        this.overlay = 'playground';
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
    openFriends(): void {
      this.overlay = 'friends';
    },
    /** Friends is a sub-panel of the profile — B there returns to the profile. */
    backToProfileFromFriends(): void {
      menuPadState.textEntry = false;
      this.overlay = 'profile';
    },
    /** The profiles roster is a sub-panel of the profile editor. */
    openProfiles(): void {
      this.overlay = 'profiles';
    },
    /** B in the roster returns to the profile editor. A profile switch is picked
     * up by the identity watcher, which reloads the lobby for the new name. */
    backToProfileFromProfiles(): void {
      menuPadState.textEntry = false;
      this.overlay = 'profile';
    },
    closeOverlay(): void {
      this.overlay = undefined;
      menuPadState.textEntry = false;
      this.gamesConfirm = undefined;
      this.gamesError = false;
      this.lanEntry = false;
      this.lanIssue = '';
      closeLobbyList();
      // The profile may have just set the identity — re-advertise this host
      // under the (possibly new) name. The list itself follows the identity
      // watcher, so there is no second refresh path here.
      const name = this.identityName;
      if (name !== '') {
        publishLanName(name);
      }
    },
    joinable(g: JoinableGameSummary): boolean {
      return g.you !== undefined;
    },
    /**
     * A row that ARRIVED while the player was on this screen — the visible
     * proof that the push channel works. It decays on its own; nothing else
     * depends on it.
     */
    isNewGame(g: JoinableGameSummary): boolean {
      return this.lobbyState.newIds.includes(g.id);
    },
    /** The cursor is parked on the «add a host» affordance (always last). */
    onLanEntryRow(): boolean {
      return this.lanEntryVisible && this.gamesCursor === this.gamesCount - 1;
    },
    /** Open the on-screen keyboard for a hand-typed host address. */
    openManualHost(): void {
      this.lanDraft = '';
      this.lanIssue = '';
      this.lanEntry = true;
      // Silence the console key bridge — the on-screen keyboard owns input.
      menuPadState.textEntry = true;
    },
    commitManualHost(value: string): void {
      // `addManualHost` validates the address itself (a bare IP, host:port, an
      // http:// paste, a bracketed IPv6). A rejection keeps the keyboard open
      // with the reason rather than swallowing the attempt.
      if (!addManualHost(value)) {
        this.lanIssue = 'That is not a usable address';
        return;
      }
      this.lanEntry = false;
      this.lanIssue = '';
      menuPadState.textEntry = false;
      // The new host is a SOURCE like any other — the one refresh path asks it.
      void refreshLobby();
    },
    cancelManualHost(): void {
      this.lanEntry = false;
      this.lanIssue = '';
      menuPadState.textEntry = false;
    },
    /** X on a LAN row we typed ourselves — take the entry back off the list. */
    removeManualHostAt(i: number): boolean {
      const row = this.visibleLanRows[i - this.localRows.length];
      const entry = this.manualHosts.find((h) => row !== undefined && row.hostName === h.entry);
      if (entry === undefined) {
        return false;
      }
      removeManualHost(entry.entry);
      void refreshLobby();
      return true;
    },
    /**
     * Manual re-ask (RT). The list refreshes itself on open, on push, on focus
     * and on a poll floor — this is for the player who wants to KNOW it just
     * did, and the way out of any source that has gone quiet.
     */
    refreshGames(): void {
      void refreshLobby({archive: this.gamesTab === 'finished'});
    },
    yourTurn(g: JoinableGameSummary): boolean {
      // A finished game keeps an `activePlayer` (whoever was to move when it
      // ended) — it means nothing now, so the archive never claims a turn.
      return g.finished !== true && g.you !== undefined && g.activePlayer === g.you.color;
    },
    /** Switch the shown slice — L3, or a click on the strip (mouse fallback). */
    setGamesTab(tab: JoinableGameStatus): void {
      if (this.gamesTab === tab) {
        return;
      }
      this.gamesTab = tab;
      this.gamesCursor = 0;
      this.gamesConfirm = undefined;
      this.gamesError = false;
      this.keepGamesCursorVisible();
      if (tab === 'finished' && this.lobbyState.archiveStatus !== 'loading') {
        // Re-ask on every toggle: a game that has just ended belongs here
        // without a restart. A load already in flight is left alone — the scan
        // is not free and a second one would only rewrite the same list.
        void loadLobbyArchive();
      }
    },
    boardLabel(g: JoinableGameSummary): string {
      return $t(mapLabelKey(g.boardName));
    },
    /**
     * «12 с назад» / «7 мин назад» — how long ago this party was created, and
     * the reason it sits where it sits. Reads the ONE shared clock in
     * `lobbyState`, which re-arms itself at the cadence the freshest row needs,
     * so every row on screen advances in the same tick.
     */
    createdAgo(g: JoinableGameSummary): string {
      return lobbyAgeLabel(lobbyAge(g.createdTimeMs, this.lobbyState.nowMs));
    },
    /**
     * Crew for the row — names visible, YOU tagged, whose-turn (active)
     * flagged. A FINISHED game marks nobody: its stored `activePlayer` is
     * whoever was to move when it ended, and a pulsing «его ход» dot on that
     * seat would claim a turn that no longer exists.
     */
    gameCrew(g: JoinableGameSummary): ReadonlyArray<{name: string, color: string, isYou: boolean, isActive: boolean}> {
      const live = g.finished !== true;
      return g.players.map((p) => ({
        name: p.name,
        color: p.color,
        isYou: p.isYou,
        isActive: live && g.activePlayer === p.color,
      }));
    },
    /** Enabled expansions as premium icon chips (same artwork as the create screen). */
    gameExpansions(g: JoinableGameSummary): ReadonlyArray<{id: Expansion, url: string, label: string}> {
      return g.expansions.map((e) => ({id: e, url: expansionIconUrl(e), label: expansionLabel(e)}));
    },
    /**
     * Open a row hosted by THIS server. A FINISHED game is opened to be READ:
     * the console lands on the settled final scoring (replay the count, open
     * the overview), so it must not become the CONTINUE memory — that names
     * the party still being played — and its curtain says «синхронизация»
     * rather than «подготовка экспедиции».
     */
    openLocalGame(g: JoinableGameSummary): void {
      const you = g.you;
      if (you === undefined) {
        return;
      }
      const href = paths.PLAYER + '?id=' + encodeURIComponent(you.id);
      if (g.finished === true) {
        navigateWithCurtain(href, 'sync');
        return;
      }
      recordLastGameEntered(g.id);
      navigateWithCurtain(href, 'expedition');
    },
    enterGameAt(i: number): void {
      this.gamesCursor = i;
      if (this.lanEntryVisible && i === this.gamesCount - 1) {
        this.openManualHost();
        return;
      }
      if (i < this.localRows.length) {
        const g = this.localRows[i];
        if (g !== undefined) {
          this.openLocalGame(g);
        }
        return;
      }
      // A LAN row: pin the seat to the HOST's server first — from then on every
      // request and the WebSocket for this game go to that host (§6). A row whose
      // host has stopped answering is kept on screen (it exists) but not entered:
      // the navigation would land on a curtain that never lifts.
      const row = this.visibleLanRows[i - this.localRows.length];
      if (row !== undefined && !row.stale && row.endpoint !== undefined && row.game.you !== undefined) {
        pinServerEndpoint(row.game.you.id, row.endpoint);
        recordLastGameEntered(row.game.id);
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(row.game.you.id), 'expedition');
      }
    },
    /** X on a LOCAL row (host mode) — ask before deleting that one game. */
    requestDeleteAt(i: number): void {
      if (!this.canDeleteLocal || i >= this.localRows.length) {
        return;
      }
      const g = this.localRows[i];
      if (g !== undefined) {
        this.gamesCursor = i;
        this.gamesError = false;
        this.gamesConfirm = {kind: 'one', game: g};
      }
    },
    /** Y (host mode) — ask before wiping the whole local library. */
    requestDeleteAll(): void {
      if (this.canDeleteLocal && this.hasLocalGames) {
        this.gamesError = false;
        this.gamesConfirm = {kind: 'all'};
      }
    },
    async executeGamesDelete(): Promise<void> {
      const confirm = this.gamesConfirm;
      if (confirm === undefined || this.gamesDeleting) {
        return;
      }
      this.gamesDeleting = true;
      this.gamesError = false;
      try {
        const query = confirm.kind === 'all' ? 'all=1' : 'id=' + encodeURIComponent(confirm.game.id);
        const res = await fetch(apiUrl(paths.API_LOCAL_GAME_DELETE) + '?' + query, {method: 'POST'});
        if (!res.ok) {
          throw new Error(`delete failed (${res.status})`);
        }
        this.gamesConfirm = undefined;
        // Re-ask rather than patch the list locally: the server is the one that
        // knows what is left (and the same refresh rewrites the CONTINUE cache).
        await refreshLobby({archive: true});
        this.gamesCursor = Math.min(this.gamesCursor, Math.max(0, this.gamesCount - 1));
      } catch {
        this.gamesError = true;
      } finally {
        this.gamesDeleting = false;
      }
    },
    onQuitConfirm(): void {
      this.overlay = undefined;
      quitApp();
    },
  },
});
</script>
