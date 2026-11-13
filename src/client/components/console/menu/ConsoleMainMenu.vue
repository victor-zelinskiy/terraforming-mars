<template>
  <div ref="rootEl" class="cm-menu" :class="{'cm-menu--dimmed': overlay !== undefined && !screenOpen, 'cm-menu--screen': screenOpen}">
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

    <!-- THE STAGE of the menu: the item column, and the pregame SCREENS that unfold out of it (TR68 «ПРЕДИГРОВОЕ —
         ЭТО ВИТРИНА»). «Мои партии» / «Мои кампании» are screens on the campaign map's grammar, never a dialog: the
         column recedes, the screen unfolds out of the pressed item, its cards surface in a wave; B plays it back. -->
    <div class="cm-menu__stage">
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
          :data-menu-item="item.id"
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

      <transition :css="false" @enter="screenEnter" @leave="screenLeave">
        <!-- ── My games (continue / join / the archive) ──────────────────── -->
        <ConsoleLobbyScreen
          v-if="overlay === 'games'"
          ref="gamesScreen"
          key="games"
          kind="games"
          title-key="My games"
          :tabs="gamesTabs"
          :tab="gamesTab"
          :state="gamesScreenState"
          :state-key="gamesStateKey"
          :state-hint-key="gamesStateHintKey"
          :refreshing="lobbyState.refreshing"
          :items="gamesCount + (gamesRowCount === 0 ? 1 : 0)"
          @tab="setGamesTab($event)"
          @grid="gamesCols = $event"
        >
          <template #band>
            <div v-if="gamesTab === 'finished' && gamesScreenState === 'list'" class="cm-lobby__band cm-lobby__band--note">
              {{ $t('Open a finished game to review the results or replay the final scoring.') }}
            </div>
            <!-- LAN hosts (host-as-server mode): the listing is NAME-scoped, and that is invisible unless it is said;
                 a host that stopped answering SAYS SO and WHY; a host with nothing for this name says that too. -->
            <div v-else-if="lanSectionVisible && gamesScreenState === 'list'" class="cm-lobby__band">
              <span class="cm-lobby__band-title cm-gamelist__lanhead">
                {{ $t('On your local network') }}
                <span v-if="identityName !== ''" class="cm-gamelist__lanwho">{{ $t('games with') }} «{{ identityName }}»</span>
              </span>
              <span v-for="host in lanTrouble" :key="host.id" class="cm-lobby__host cm-gamelist__lanstatus" data-lan-host="unreachable">
                {{ host.label }} — {{ $t('not responding') }}<template v-if="host.reason !== ''"> · {{ host.reason }}</template>
              </span>
              <span v-for="host in lanEmptyHosts" :key="host.id" class="cm-lobby__host cm-gamelist__lanstatus cm-gamelist__lanstatus--calm" data-lan-host="empty">
                {{ host.label }} — {{ $t('no games with your name') }}
              </span>
            </div>
          </template>

          <ConsoleLobbyCard
            v-for="(g, i) in localRows"
            :key="g.id"
            :view="localCardView(g)"
            :cursor="i === gamesCursor"
            :age="createdAgo(g)"
            :reveal="true"
            :reveal-delay-ms="140 + i * 60"
            @activate="enterGameAt(i)"
            @hover="gamesCursor = i"
          />
          <!-- LAN rows: joining pins the seat to that host's server and navigates (docs/EMBEDDED_SERVER.md §6); a
               row whose host has stopped answering stays LISTED (the game exists) but refuses entry. -->
          <ConsoleLobbyCard
            v-for="(row, k) in visibleLanRows"
            :key="row.key"
            :view="lanCardView(row)"
            :cursor="localRows.length + k === gamesCursor"
            :age="createdAgo(row.game)"
            :reveal="true"
            :reveal-delay-ms="140 + (localRows.length + k) * 60"
            @activate="enterGameAt(localRows.length + k)"
            @hover="gamesCursor = localRows.length + k"
          />
          <!-- With the add-a-host tool present the list is never «empty», so the answer to «сколько у меня партий»
               stands on the stage as a statement beside the tool. -->
          <div v-if="gamesRowCount === 0" class="cm-lcard cm-lcard--statement cm-gamelist__empty cm-gamelist__empty--inline">
            <span class="cm-lcard__statement-glyph" aria-hidden="true">⧉</span>
            <span>{{ $t(gamesEmptyKey) }}</span>
          </div>
          <!-- MANUAL HOST — the fallback that always works when the network drops multicast. Last in the cursor ring. -->
          <button
            v-if="lanEntryVisible"
            type="button"
            class="cm-lcard cm-lcard--add cm-game cm-game--add"
            :class="{'cm-lcard--cursor': gamesCursor === gamesCount - 1, 'cm-game--cursor': gamesCursor === gamesCount - 1}"
            @click="enterGameAt(gamesCount - 1)"
            @mousemove="gamesCursor = gamesCount - 1"
          >
            <span class="cm-lcard__add-plus" aria-hidden="true">＋</span>
            <span class="cm-lcard__add-text">
              <span class="cm-lcard__name cm-game__name">{{ $t('Add a host by address') }}</span>
              <span class="cm-lcard__add-hint">{{ $t('When the network hides other players, type their address') }}</span>
            </span>
          </button>
        </ConsoleLobbyScreen>

        <!-- ── My campaigns (one card per campaign; A = the Campaign Map) ──── -->
        <ConsoleCampaignsList v-else-if="overlay === 'campaigns'" ref="campaigns" key="campaigns" @close="closeOverlay" />
      </transition>
    </div>

    <!-- ── Local-game deletion confirm (host mode; stacked over the games list) ── -->
    <div v-if="overlay === 'games' && gamesConfirm !== undefined" class="cm-overlay" role="alertdialog" :aria-label="$t(gamesConfirmTitle)">
      <div class="cm-overlay__card">
        <div class="cm-overlay__title">{{ $t(gamesConfirmTitle) }}</div>
        <div class="cm-overlay__body">
          <template v-if="gamesConfirm.kind === 'one'">
            <b>{{ gamesConfirm.game.name }}</b> — {{ $t('The game and its whole history will be permanently deleted.') }}
          </template>
          <!-- A CAMPAIGN MISSION is never deleted alone (the server refuses it
               too): the honest answer is the campaign's own front door. -->
          <template v-else-if="gamesConfirm.kind === 'campaign'">
            <b>{{ gamesConfirm.game.campaign !== undefined ? gamesConfirm.game.campaign.name : gamesConfirm.game.name }}</b> — {{ $t('Open the campaign to manage or delete it as a whole.') }}
          </template>
          <template v-else>
            {{ $t('Every game stored on this device will be permanently deleted, including games of other profiles.') }}
            {{ $t('Campaign missions are not affected — a campaign is deleted from the My campaigns screen.') }}
          </template>
        </div>
        <div v-if="gamesError" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not delete the game') }}</div>
        <div class="cm-confirm__pad">
          <button v-if="gamesConfirm.kind === 'campaign'" type="button" class="cm-confirm__btn" @click="openCampaignFromConfirm">
            <GamepadGlyph control="confirm" /><span>{{ $t('Open the campaign') }}</span>
          </button>
          <button v-else type="button" class="cm-confirm__btn cm-confirm__btn--danger" :disabled="gamesDeleting" @click="executeGamesDelete">
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

<script setup lang="ts">
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
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {paths} from '@/common/app/paths';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {JoinableGameStatus, JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {installMenuPad, menuPadState} from '@/client/console/menu/consoleMenuPad';
import {stepIndex} from '@/client/console/consoleRouter';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCampaignsList from '@/client/components/console/menu/ConsoleCampaignsList.vue';
import ConsoleLobbyScreen, {LobbyScreenState} from '@/client/components/console/menu/ConsoleLobbyScreen.vue';
import ConsoleLobbyCard from '@/client/components/console/menu/ConsoleLobbyCard.vue';
import {LobbyCardView, gameCardView, showcaseStep} from '@/client/console/menu/lobbyCardModel';
import {LobbyRect, foldLobbyScreen, unfoldLobbyScreen} from '@/client/console/menu/lobbyScreenMotion';
import ConsoleProfileEditor from '@/client/components/console/menu/ConsoleProfileEditor.vue';
import ConsoleProfilesEditor from '@/client/components/console/menu/ConsoleProfilesEditor.vue';
import ConsoleFriendsEditor from '@/client/components/console/menu/ConsoleFriendsEditor.vue';
import ConsoleLanguagePicker from '@/client/components/console/menu/ConsoleLanguagePicker.vue';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import ConsoleAdminRollback from '@/client/components/console/menu/ConsoleAdminRollback.vue';
import ConsolePlaygroundHub from '@/client/components/console/menu/ConsolePlaygroundHub.vue';
import {isAdminName} from '@/common/utils/adminName';
import {apiEndpointIsLocal} from '@/client/utils/runtimeConfig';
import {identityState, ensureIdentityLoaded} from '@/client/components/mainMenu/identity/identityState';
import {ensureProfilesLoaded} from '@/client/components/mainMenu/profilesState';
import {prefillIdentityFromSteam} from '@/client/components/mainMenu/identity/steamIdentity';
import {
  lobbyState, LobbyRow,
  hydrateLobbyCache, startLobbyWatch, stopLobbyWatch, openLobbyList, closeLobbyList,
  setLobbyIdentity, setLobbyMenuScope, refreshLobby, loadLobbyArchive, setLobbyOwnVersion,
  lobbyFirstLoad, lobbyUnreachable, localLobbySource,
} from '@/client/components/mainMenu/lobbyState';
import {initLanDiscovery, publishLanName, addManualHost, removeManualHost, lanState} from '@/client/components/mainMenu/lanState';
import {lobbyAge, lobbyAgeLabel} from '@/client/components/mainMenu/lobbyAge';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';
import {pinServerEndpoint} from '@/client/utils/serverEndpoints';
import {lastGameEntered, recordLastGameEntered} from '@/client/components/mainMenu/lastGameState';
import {armSceneDestination, deferSceneReveal, loadingScreenState, navigateWithCurtain} from '@/client/console/loadingScreenState';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {quitApp, supportsNativeQuit} from '@/client/console/runtimeMode';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {desktopBridge, startMenuUpdateWatch, stopMenuUpdateWatch} from '@/client/components/desktop/desktopUpdateState';
import {addToSteam, dismissSteamPrompt, initSteamShortcut, steamButtonVisible, steamPromptVisible, steamShortcutState} from '@/client/components/desktop/steamShortcutState';
import raw_settings from '@/genfiles/settings.json';
import {$t} from '@/client/directives/i18n';
import {campaignsState, refreshCampaigns, takeCampaignsReturn} from '@/client/console/campaign/campaignsState';
import {activeCampaignRowCount, campaignActionRequired, visibleCampaignSourceRows} from '@/client/console/campaign/campaignListModel';
import {useAppRoot} from '@/client/components/appRoot';

type MenuItemId = 'continue' | 'create' | 'games' | 'campaigns' | 'profile' | 'options' | 'admin' | 'playground' | 'steam' | 'quit';
type MenuItem = {id: MenuItemId, labelKey: string, subText: string, glyph: string, badge: number};
type MenuOverlay = 'games' | 'campaigns' | 'profile' | 'profiles' | 'friends' | 'language' | 'options' | 'admin' | 'playground' | 'quit' | 'steam' | undefined;

defineOptions({name: 'ConsoleMainMenu'});

// the app root's port (R26): «New game» navigates through it. `undefined` outside the application — a menu with no
// root above it has nowhere to navigate, and that press does nothing
const root = useAppRoot();
// Foundation: page-level overflow lock while this screen owns the viewport.
useConsoleNativeSurface();
const profile = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('profile');
const profiles = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('profiles');
const friends = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('friends');
const language = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('language');
const options = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('options');
const admin = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('admin');
const playground = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('playground');
const campaigns = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('campaigns');
const lankeyboard = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('lankeyboard');
const gamesScreen = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('gamesScreen');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const cursor = ref(0);
const gamesCursor = ref(0);
/** Which slice of «Мои партии» the list shows (L3 toggles). */
const gamesTab = ref('active' as JoinableGameStatus);
const overlay = ref<MenuOverlay>(undefined);
let offPad: (() => void) | undefined;
const desktopVersion = ref('');
// Host-as-server: local-game deletion (X = one, Y = all; both confirmed).
// 'campaign' is the REDIRECT shape: a mission is never deleted alone —
// the dialog leads to the campaign's own front door instead.
const appModeEffective = ref<'host' | 'remote' | undefined>(undefined);
const gamesConfirm = ref<undefined | {kind: 'one', game: JoinableGameSummary} | {kind: 'campaign', game: JoinableGameSummary} | {kind: 'all'}>(undefined);
const gamesDeleting = ref(false);
const gamesError = ref(false);
// Manual LAN host entry (the multicast-blocked fallback).
const lanEntry = ref(false);
const lanDraft = ref('');
const lanIssue = ref('');
/** The showcase grid's column count (the screen measures it) — the ◀ ▶ ▲ ▼ walk's row length. */
const gamesCols = ref(3);
/** The rect of the menu item a screen unfolds OUT of (taken at the press, before the column recedes). */
const lobbyOrigin = ref<LobbyRect | undefined>(undefined);

const identityName = computed((): string => {
  return identityState.identity?.displayName ?? '';
});
/** A pregame SCREEN stands (a list of the product), never a dialog — the column recedes for it. */
const screenOpen = computed((): boolean => {
  return overlay.value === 'games' || overlay.value === 'campaigns';
});
/**
 * FOUR distinct answers, never one sentence for all of them: no name yet · still asking · asked and failed ·
 * asked and there are none. Collapsing them is what made a party that existed read as one that did not. With the
 * add-a-host tool present the list is never structurally empty (the statement stands beside the tool).
 */
const gamesScreenState = computed((): LobbyScreenState => {
  if (gamesNeedName.value) {
    return 'need-name';
  }
  if (gamesFirstLoad.value) {
    return 'loading';
  }
  if (gamesLoadError.value) {
    return 'error';
  }
  return gamesRowCount.value === 0 && !lanEntryVisible.value ? 'empty' : 'list';
});
const gamesStateKey = computed((): string => {
  switch (gamesScreenState.value) {
  case 'need-name': return 'Set your player name to see your games';
  case 'loading': return 'Loading';
  case 'error': return 'Could not load your games';
  case 'empty': return gamesEmptyKey.value;
  default: return '';
  }
});
const gamesStateHintKey = computed((): string => {
  switch (gamesScreenState.value) {
  case 'need-name': return 'Your games are found by your player name — set it in the player profile';
  case 'error': return 'Refresh';
  case 'empty': return gamesTab.value === 'finished' ? '' : 'Start one with «New game» in the main menu';
  default: return '';
  }
});
const identityCubeClass = computed((): string => {
  const color = identityState.identity?.cubeColor;
  return color !== undefined ? `player_bg_color_${color}` : 'cm-identity__cube--empty';
});
const isAdmin = computed((): boolean => {
  return isAdminName(identityName.value);
});
/**
 * The game-rollback tool: every player when the menu talks to THIS
 * machine's server (local mode — the server enforces the same rule as a
 * loopback gate), plus the ADMIN_NAME dev door from anywhere.
 */
const rollbackAvailable = computed((): boolean => {
  return isAdmin.value || apiEndpointIsLocal();
});
/** Unfinished games on THIS device's server. */
const games = computed((): ReadonlyArray<JoinableGameSummary> => {
  return lobbyState.localRows.map((row) => row.game);
});
/** The ARCHIVE — games of this player that have already ended. */
const finishedGames = computed((): ReadonlyArray<JoinableGameSummary> => {
  return lobbyState.archive;
});
/**
 * The rows of the SHOWN slice that live on this server. Campaign missions
 * sharing one campaign COLLAPSE into a single campaign row (its front
 * door is the Campaign Map, not any one mission) — «Мои партии» must not
 * read as four unrelated games. A host running an older build sends no
 * `campaign` field; such rows stay ungrouped (partial-data tolerance).
 */
const localRows = computed((): ReadonlyArray<JoinableGameSummary> => {
  const rows = gamesTab.value === 'finished' ? finishedGames.value : games.value;
  const seen = new Set<string>();
  const out: Array<JoinableGameSummary> = [];
  for (const g of rows) {
    const cid = g.campaign?.id;
    if (cid === undefined) {
      out.push(g);
      continue;
    }
    if (seen.has(cid)) {
      continue;
    }
    seen.add(cid);
    // The representative is the LIVE mission when one exists, else the
    // furthest mission (the chronicle's door).
    const members = rows.filter((r) => r.campaign?.id === cid);
    const live = members.find((r) => r.finished !== true);
    const furthest = members.reduce((a, b) => ((b.campaign?.slot ?? 0) > (a.campaign?.slot ?? 0) ? b : a));
    out.push(live ?? furthest);
  }
  return out;
});
/** LAN hosts publish their UNFINISHED games only — the archive is local.
 *  Campaign missions collapse into ONE campaign row here too (same rule
 *  as local rows): the campaign's front door is its map, never any one
 *  mission — usually only the LIVE mission is published anyway. */
const visibleLanRows = computed((): ReadonlyArray<LobbyRow> => {
  if (gamesTab.value === 'finished') {
    return [];
  }
  const rows = lobbyState.lanRows;
  const seen = new Set<string>();
  const out: Array<LobbyRow> = [];
  for (const row of rows) {
    const cid = row.game.campaign?.id;
    if (cid === undefined) {
      out.push(row);
      continue;
    }
    if (seen.has(cid)) {
      continue;
    }
    seen.add(cid);
    const members = rows.filter((r) => r.game.campaign?.id === cid);
    const live = members.find((r) => r.game.finished !== true);
    const furthest = members.reduce((a, b) => ((b.game.campaign?.slot ?? 0) > (a.game.campaign?.slot ?? 0) ? b : a));
    out.push(live ?? furthest);
  }
  return out;
});
/**
 * Cursor range of the games overlay: local rows, then LAN rows, then the
 * «add a host» affordance last — a real party is always ahead of a tool.
 */
const gamesCount = computed((): number => {
  return gamesRowCount.value + (lanEntryVisible.value ? 1 : 0);
});
/**
 * PARTIES only. The empty / loading / error states must answer «сколько у
 * меня партий», not «сколько строк на экране» — counting the add-a-host
 * tool as a row would silently retire «У вас пока нет незавершённых партий».
 */
const gamesRowCount = computed((): number => {
  return localRows.value.length + visibleLanRows.value.length;
});
/** The two slices as a segmented control (count shown once its list loaded). */
const gamesTabs = computed((): ReadonlyArray<{id: JoinableGameStatus, label: string, count: number | undefined}> => {
  return [
    {id: 'active', label: 'Active games', count: localLobbySource()?.lastOkAt !== undefined ? games.value.length : undefined},
    {id: 'finished', label: 'Finished games', count: lobbyState.archiveStatus === 'ok' ? finishedGames.value.length : undefined},
  ];
});
/**
 * «Загрузка…» — we have nothing to show AND are still finding out. This is
 * deliberately NOT the same state as «нет партий»: an unanswered list and an
 * empty library used to render the same sentence, which is how a LAN party
 * that existed read as one that did not.
 */
const gamesFirstLoad = computed((): boolean => {
  return gamesTab.value === 'finished' ?
    lobbyState.archiveStatus === 'loading' && finishedGames.value.length === 0 :
    lobbyFirstLoad();
});
/** We asked and could not find out — never rendered as «no games». */
const gamesLoadError = computed((): boolean => {
  return gamesTab.value === 'finished' ?
    lobbyState.archiveStatus === 'unreachable' && finishedGames.value.length === 0 :
    lobbyUnreachable();
});
/** No identity yet — the list is name-scoped, so say THAT, not «пусто». */
const gamesNeedName = computed((): boolean => {
  return identityName.value === '';
});
const gamesEmptyKey = computed((): string => {
  return gamesTab.value === 'finished' ? 'You have no finished games yet.' : 'You have no unfinished games yet.';
});
/**
 * LAN hosts that could not be asked — SHOWN with the reason, never silently
 * absent. «Не отвечает» alone leaves the player unable to tell a slow couch
 * from a blocked port, which is the one thing they can act on.
 */
const lanTrouble = computed((): ReadonlyArray<{id: string, label: string, reason: string}> => {
  if (gamesTab.value === 'finished') {
    return [];
  }
  return lobbyState.sources
    .filter((s) => s.kind === 'lan' && s.status === 'unreachable')
    .map((s) => ({id: s.id, label: s.label, reason: s.lastError}));
});
/**
 * A LAN host that answered, but with nothing for THIS player. Also a state
 * that must speak: name matching is what a listing is scoped by, and a
 * silent empty section reads as «сеть не работает» when in fact the seat is
 * simply under another name.
 */
const lanEmptyHosts = computed((): ReadonlyArray<{id: string, label: string}> => {
  if (gamesTab.value === 'finished') {
    return [];
  }
  const withRows = new Set(lobbyState.lanRows.map((row) => row.sourceId));
  return lobbyState.sources
    .filter((s) => s.kind === 'lan' && s.status === 'ok' && !withRows.has(s.id))
    .map((s) => ({id: s.id, label: s.label}));
});
/** True when the LAN section has anything at all to say. */
const lanSectionVisible = computed((): boolean => {
  return visibleLanRows.value.length > 0 || lanTrouble.value.length > 0 || lanEmptyHosts.value.length > 0;
});
/**
 * The manual-host affordance. Only in the live slice, only on a shell that
 * has LAN at all — on the web there is nothing to type an address into.
 */
const lanEntryVisible = computed((): boolean => {
  return gamesTab.value !== 'finished' && appModeEffective.value === 'host';
});
/** Hand-typed hosts, so X can take one back off the list. */
const manualHosts = computed((): ReadonlyArray<{entry: string}> => {
  return lanState.manual;
});
/** Deletion is offered only for games on THIS device's embedded server. */
const canDeleteLocal = computed((): boolean => {
  return appModeEffective.value === 'host';
});
/** «Удалить все» wipes the device library — either slice proves it has one. */
const hasLocalGames = computed((): boolean => {
  return games.value.length > 0 || finishedGames.value.length > 0;
});
const gamesConfirmTitle = computed((): string => {
  const confirm = gamesConfirm.value;
  if (confirm === undefined) {
    return '';
  }
  if (confirm.kind === 'all') {
    return 'Delete all local games?';
  }
  return confirm.kind === 'campaign' ? 'This game is part of a campaign' : 'Delete this game?';
});
/** Unfinished campaigns of the active identity (the menu plate's badge). */
const campaignsBadge = computed((): number => {
  return campaignsState.status === 'ok' ? activeCampaignRowCount(campaignsState.rows) : 0;
});
const continueItem = computed((): JoinableGameSummary | undefined => {
  const mine = games.value.filter((g) => g.you !== undefined);
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
});
const version = computed((): string => {
  if (desktopVersion.value !== '') {
    return desktopVersion.value;
  }
  const settingsVersion = (raw_settings as {version?: string}).version;
  return settingsVersion !== undefined && settingsVersion !== '' ? settingsVersion : (raw_settings.head ?? '');
});
const currentLangCode = computed((): string => {
  return String(getPreferences().lang ?? 'ru').toUpperCase();
});
const items = computed((): ReadonlyArray<MenuItem> => {
  const items: Array<MenuItem> = [];
  const cont = continueItem.value;
  if (cont !== undefined) {
    const turn = yourTurn(cont) ? ` · ${$t('Your turn')}` : '';
    items.push({
      id: 'continue',
      labelKey: 'Continue',
      subText: `${cont.name} · ${$t('Generation')} ${cont.generation}${turn}`,
      glyph: '▶',
      badge: 0,
    });
  }
  items.push({id: 'create', labelKey: 'New game', subText: $t('Set up the players, map and rules of the party'), glyph: '◈', badge: 0});
  items.push({id: 'games', labelKey: 'My games', subText: $t('Continue or join your unfinished games'), glyph: '⧉', badge: games.value.filter((g) => g.you !== undefined).length});
  items.push({id: 'campaigns', labelKey: 'My campaigns', subText: $t('Continue a campaign or open the route map'), glyph: '⚑', badge: campaignsBadge.value});
  items.push({id: 'profile', labelKey: 'Player profile', subText: identityName.value !== '' ? identityName.value : $t('Set your name'), glyph: '◉', badge: 0});
  items.push({id: 'options', labelKey: 'Options', subText: $t('Interface and display settings'), glyph: '⚙', badge: 0});
  // Rollback: every player in local mode (games on this device); the
  // overlay carries the local-only note. Playground stays ADMIN_NAME-only.
  if (rollbackAvailable.value) {
    items.push({id: 'admin', labelKey: 'Game rollback', subText: $t('Roll a game back to an earlier save'), glyph: '⟲', badge: 0});
  }
  if (isAdmin.value) {
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
});
const commandContext = computed((): string => {
  if (overlay.value === 'games') {
    return 'My games';
  }
  if (overlay.value === 'campaigns') {
    return 'My campaigns';
  }
  if (overlay.value === 'profile') {
    return 'Player profile';
  }
  if (overlay.value === 'profiles') {
    return 'Profiles';
  }
  if (overlay.value === 'friends') {
    return 'Friends';
  }
  if (overlay.value === 'options') {
    return 'Options';
  }
  if (overlay.value === 'admin') {
    return 'Game rollback';
  }
  if (overlay.value === 'playground') {
    return 'Playground';
  }
  if (overlay.value === 'quit') {
    return 'Exit the game?';
  }
  if (overlay.value === 'steam') {
    return 'Add to Steam?';
  }
  return 'Main menu';
});
const commands = computed((): ReadonlyArray<ConsoleCommand> => {
  if (overlay.value === 'games') {
    if (gamesConfirm.value !== undefined) {
      return [
        {control: 'confirm', label: gamesConfirm.value.kind === 'campaign' ? 'Open the campaign' : 'Delete'},
        {control: 'back', label: 'Cancel'},
      ];
    }
    const cursorLocal = gamesCursor.value < localRows.value.length ? localRows.value[gamesCursor.value] : undefined;
    const lanRow = cursorLocal === undefined ? visibleLanRows.value[gamesCursor.value - localRows.value.length] : undefined;
    const row = cursorLocal ?? lanRow?.game;
    // A row whose host has gone quiet stays LISTED (the game exists) but the
    // verb must not offer to enter it — the navigation would land on a
    // curtain that never lifts.
    const onAdd = onLanEntryRow();
    const enterable = onAdd || (row !== undefined && joinable(row) && lanRow?.stale !== true);
    const archive = gamesTab.value === 'finished';
    const manualRow = lanRow !== undefined && manualHosts.value.some((h) => h.entry === lanRow.hostName);
    const bar: Array<ConsoleCommand> = [
      {control: 'dpad', label: 'Navigate'},
      // A finished row is opened to READ it — the verb says so, since the
      // press leads to the settled final scoring, not into a turn.
      {control: 'confirm', label: onAdd ? 'Add a host' : (archive ? 'Open the results' : 'Enter game'), enabled: enterable, highlight: !onAdd && enterable && row !== undefined && yourTurn(row)},
      {control: 'stickL', label: archive ? 'Active games' : 'Finished games'},
      {control: 'triggerR', label: 'Refresh', enabled: !lobbyState.refreshing},
    ];
    if (manualRow) {
      // The same physical button, an honest label: on someone else's couch
      // there is no game to delete, only our own typed entry.
      bar.push({control: 'inspect', label: 'Remove host'});
    } else if (canDeleteLocal.value) {
      bar.push(
        {control: 'secondary', label: 'Delete', enabled: cursorLocal !== undefined},
        {control: 'inspect', label: 'Delete all', enabled: hasLocalGames.value},
      );
    }
    bar.push({control: 'back', label: 'Back'});
    return bar;
  }
  if (overlay.value === 'campaigns') {
    if (campaignsState.confirmId !== undefined) {
      return [
        {control: 'confirm', label: 'Delete', enabled: !campaignsState.deleting},
        {control: 'back', label: 'Cancel'},
      ];
    }
    const rows = visibleCampaignSourceRows(campaignsState.rows, campaignsState.tab);
    const row = rows[campaignsState.cursor];
    const archive = campaignsState.tab === 'completed';
    // Deliberately NO «Y · Удалить всё» here: a bulk cascade over every
    // campaign is not a verb this screen offers. A quiet host's row stays
    // listed but is not enterable (the same rule as LAN game rows).
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Campaign map', enabled: row !== undefined && !row.stale, highlight: row !== undefined && !row.stale && campaignActionRequired(row.summary)},
      {control: 'stickL', label: archive ? 'Active campaigns' : 'Completed campaigns'},
      {control: 'triggerR', label: 'Refresh', enabled: !campaignsState.refreshing},
      {control: 'secondary', label: 'Delete', enabled: row !== undefined && row.summary.isCreator && !row.stale},
      {control: 'back', label: 'Back'},
    ];
  }
  // No 'options' branch: the settings console owns its own foot bar and the
  // menu's is hidden while it is open (see the template).
  if (overlay.value === 'profile') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Change'},
      {control: 'back', label: 'Done'},
    ];
  }
  if (overlay.value === 'admin') {
    // The panel shows precise per-view foot hints; the bar stays generic.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (overlay.value === 'playground') {
    // A fullscreen stand covers this bar and shows its own foot hints.
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Open'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (overlay.value === 'profiles') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Select'},
      {control: 'inspect', label: 'Delete'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (overlay.value === 'friends') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Add friend'},
      {control: 'inspect', label: 'Remove'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (overlay.value === 'quit') {
    return [
      {control: 'confirm', label: 'Exit'},
      {control: 'back', label: 'Cancel'},
    ];
  }
  if (overlay.value === 'steam') {
    return [
      {control: 'confirm', label: 'Add to Steam'},
      {control: 'back', label: 'Not now'},
    ];
  }
  if (overlay.value === 'language') {
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
});

function onIntent(intent: GamepadIntent): boolean {
  // Foundation: raw press intents resolve to SEMANTIC console actions —
  // screens compare actions ('primary'/'back'), never button names.
  const action = consoleActionOf(intent);
  // The profile editor hosts the text-entry fallback — route to it.
  if (overlay.value === 'profile') {
    const profileNow = profile.value ?? undefined;
    if (profileNow?.handleIntent?.(intent) === true) {
      return true;
    }
    if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay.value === 'profiles') {
    const profilesNow = profiles.value ?? undefined;
    if (profilesNow?.handleIntent?.(intent) === true) {
      return true;
    }
    if (action === 'back') {
      backToProfileFromProfiles();
    }
    return true;
  }
  if (overlay.value === 'friends') {
    const friendsNow = friends.value ?? undefined;
    if (friendsNow?.handleIntent?.(intent) === true) {
      return true;
    }
    if (action === 'back') {
      backToProfileFromFriends();
    }
    return true;
  }
  if (overlay.value === 'language') {
    const picker = language.value ?? undefined;
    return picker?.handleIntent?.(intent) ?? true;
  }
  if (overlay.value === 'options') {
    const optionsNow = options.value ?? undefined;
    return optionsNow?.handleIntent?.(intent) ?? true;
  }
  if (overlay.value === 'admin') {
    const adminNow = admin.value ?? undefined;
    return adminNow?.handleIntent?.(intent) ?? true;
  }
  if (overlay.value === 'playground') {
    const hub = playground.value ?? undefined;
    return hub?.handleIntent?.(intent) ?? true;
  }
  if (overlay.value === 'campaigns') {
    const panel = campaigns.value ?? undefined;
    return panel?.handleIntent?.(intent) ?? true;
  }
  if (overlay.value === 'games') {
    // The on-screen keyboard owns every intent while an address is typed.
    if (lanEntry.value) {
      const vk = lankeyboard.value ?? undefined;
      if (vk?.handleIntent?.(intent) === true) {
        return true;
      }
      if (action === 'back') {
        cancelManualHost();
      }
      return true;
    }
    // The deletion confirm swallows everything but confirm/cancel.
    if (gamesConfirm.value !== undefined) {
      if (action === 'primary') {
        if (gamesConfirm.value.kind === 'campaign') {
          openCampaignFromConfirm();
        } else {
          void executeGamesDelete();
        }
      } else if (action === 'back') {
        gamesConfirm.value = undefined;
        gamesError.value = false;
      }
      return true;
    }
    if (intent.kind === 'nav') {
      // The showcase is a GRID: ◀ ▶ walk the ring, ▲ ▼ a row (`showcaseStep`).
      gamesCursor.value = showcaseStep(gamesCursor.value, intent.dir, gamesCount.value, gamesCols.value);
      keepGamesCursorVisible();
      return true;
    }
    if (intent.kind === 'press' && intent.button === 'stickL') {
      setGamesTab(gamesTab.value === 'finished' ? 'active' : 'finished');
      return true;
    }
    if (intent.kind === 'press' && intent.button === 'triggerR') {
      refreshGames();
      return true;
    }
    if (action === 'primary') {
      enterGameAt(gamesCursor.value);
      return true;
    }
    if (action === 'inspect') {
      // On a hand-typed LAN host X takes the ENTRY away (there is nothing
      // else to delete on someone else's couch); on a local row it stays
      // the game-deletion verb.
      if (removeManualHostAt(gamesCursor.value)) {
        return true;
      }
      requestDeleteAt(gamesCursor.value);
      return true;
    }
    if (action === 'fullscreen') {
      // Y — delete ALL local games.
      requestDeleteAll();
      return true;
    }
    if (action === 'back') {
      closeOverlay();
      return true;
    }
    return true;
  }
  if (overlay.value === 'quit') {
    if (action === 'primary') {
      onQuitConfirm();
    } else if (action === 'back') {
      closeOverlay();
    }
    return true;
  }
  if (overlay.value === 'steam') {
    if (action === 'primary') {
      onSteamAdd();
    } else if (action === 'back') {
      onSteamDismiss();
    }
    return true;
  }
  // Root list.
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    cursor.value = stepIndex(cursor.value, intent.dir === 'down' ? 1 : -1, items.value.length);
    return true;
  }
  if (action === 'primary') {
    activateAt(cursor.value);
    return true;
  }
  // Y (physical inspect button) opens the language picker.
  if (intent.kind === 'press' && intent.button === 'inspect') {
    overlay.value = 'language';
    return true;
  }
  // Swallow the rest — nothing below this screen should react.
  return true;
}
/** Keep the cursored card inside the showcase's scroll area (a third row is a page below). */
function keepGamesCursorVisible(): void {
  void nextTick(() => {
    const screen = gamesScreen.value ?? undefined;
    screen?.ensureVisible?.((rootEl.value?.querySelector('.cm-game--cursor') ?? null));
  });
}
/** One local row as a card (the pure model — the same answers the command bar reads). */
function localCardView(g: JoinableGameSummary): LobbyCardView {
  return gameCardView(g, {isNew: isNewGame(g)});
}
/** One LAN row as a card: it names its couch, a quiet host's card is shown and refuses entry. */
function lanCardView(row: LobbyRow): LobbyCardView {
  return gameCardView(row.game, {isNew: isNewGame(row.game), hostLabel: row.hostName, stale: row.stale, versionMismatch: row.versionMismatch});
}
/** The rect of a menu item AT REST (the receding column's own transform taken out). */
function menuItemRect(id: MenuItemId): LobbyRect | undefined {
  const el = (rootEl.value?.querySelector(`.cm-item[data-menu-item="${id}"]`) ?? null) as HTMLElement | null;
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  const column = el.parentElement;
  let dx = 0;
  if (column !== null) {
    const t = getComputedStyle(column).transform;
    if (t !== '' && t !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
      dx = new DOMMatrixReadOnly(t).m41;
    }
  }
  return {left: r.left - dx, top: r.top, width: r.width, height: r.height};
}
/** The screen's root inside a transition's element (the campaigns list wraps its screen with its confirm). */
function screenRootOf(el: Element): HTMLElement | undefined {
  if (el.classList.contains('cm-screen')) {
    return el as HTMLElement;
  }
  return el.querySelector<HTMLElement>('.cm-screen') ?? undefined;
}
/** UNFOLD — the screen arrives out of the pressed item, its cards in a wave (`lobbyScreenMotion`). */
function screenEnter(el: Element, done: () => void): void {
  const origin = lobbyOrigin.value ?? menuItemRect(overlay.value === 'campaigns' ? 'campaigns' : 'games');
  lobbyOrigin.value = undefined;
  void nextTick()
    .then(() => {
      const root = screenRootOf(el);
      return root === undefined ? undefined : unfoldLobbyScreen(root, origin);
    })
    .finally(done);
}
/** FOLD — B plays the phrase back: the cards let go, the plate folds into the item the cursor stands on. */
function screenLeave(el: Element, done: () => void): void {
  const root = screenRootOf(el);
  const item = items.value[cursor.value]?.id;
  const target = item === undefined ? undefined : menuItemRect(item);
  if (root === undefined) {
    done();
    return;
  }
  void foldLobbyScreen(root, target).finally(done);
}
function activateAt(i: number): void {
  cursor.value = i;
  const item = items.value[i];
  if (item === undefined) {
    return;
  }
  switch (item.id) {
  case 'continue': {
    const cont = continueItem.value;
    if (cont?.you !== undefined) {
      recordLastGameEntered(cont.id);
      // CONTINUE re-enters a game already underway — «возвращение», not
      // «подготовка экспедиции».
      navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(cont.you.id), 'sync');
    }
    break;
  }
  case 'create':
    root?.navigateInApp(paths.NEW_GAME_PREMIUM);
    break;
  case 'games':
    lobbyOrigin.value = menuItemRect('games');
    overlay.value = 'games';
    gamesTab.value = 'active';
    gamesCursor.value = 0;
    gamesConfirm.value = undefined;
    gamesError.value = false;
    // ENTERING THE SCREEN IS A REFRESH — unconditionally, every time, for
    // every source (this device + every LAN host). Showing something is
    // never a reason not to check whether it is still true.
    void openLobbyList();
    // The archive's count belongs on the tab chip before L3 is pressed.
    if (lobbyState.archiveStatus === 'idle') {
      void loadLobbyArchive();
    }
    break;
  case 'campaigns':
    lobbyOrigin.value = menuItemRect('campaigns');
    overlay.value = 'campaigns';
    campaignsState.tab = 'active';
    campaignsState.cursor = 0;
    campaignsState.confirmId = undefined;
    campaignsState.deleteError = '';
    // The campaigns list is a LOBBY-CONSUMING screen (LAN campaigns ride
    // the lobby's verified sources/endpoints/channels) — opening it opens
    // the lobby model, exactly like «Мои партии» does. Its completion
    // stamps `lastRefreshAt`, whose watcher re-asks the campaigns with
    // the LAN endpoints resolved.
    void openLobbyList();
    // Entering the screen is a refresh — the panel re-asks on its mount too,
    // but the press must never depend on the panel being the one to ask.
    void refreshCampaigns();
    break;
  case 'profile':
    openProfile();
    break;
  case 'options':
    overlay.value = 'options';
    break;
  case 'admin':
    overlay.value = 'admin';
    break;
  case 'playground':
    overlay.value = 'playground';
    break;
  case 'steam':
    void addToSteam();
    break;
  case 'quit':
    overlay.value = 'quit';
    break;
  }
}
function onSteamAdd(): void {
  overlay.value = undefined;
  void addToSteam();
}
function onSteamDismiss(): void {
  overlay.value = undefined;
  dismissSteamPrompt();
}
/** Show the first-run Steam prompt once, if warranted and no other overlay is open. */
function maybeShowSteamPrompt(): void {
  if (overlay.value === undefined && steamPromptVisible()) {
    overlay.value = 'steam';
  }
}
function openProfile(): void {
  overlay.value = 'profile';
}
function openFriends(): void {
  overlay.value = 'friends';
}
/** Friends is a sub-panel of the profile — B there returns to the profile. */
function backToProfileFromFriends(): void {
  menuPadState.textEntry = false;
  overlay.value = 'profile';
}
/** The profiles roster is a sub-panel of the profile editor. */
function openProfiles(): void {
  overlay.value = 'profiles';
}
/** B in the roster returns to the profile editor. A profile switch is picked
 * up by the identity watcher, which reloads the lobby for the new name. */
function backToProfileFromProfiles(): void {
  menuPadState.textEntry = false;
  overlay.value = 'profile';
}
function closeOverlay(): void {
  overlay.value = undefined;
  menuPadState.textEntry = false;
  gamesConfirm.value = undefined;
  gamesError.value = false;
  campaignsState.confirmId = undefined;
  campaignsState.deleteError = '';
  lanEntry.value = false;
  lanIssue.value = '';
  closeLobbyList();
  // The profile may have just set the identity — re-advertise this host
  // under the (possibly new) name. The list itself follows the identity
  // watcher, so there is no second refresh path here.
  const name = identityName.value;
  if (name !== '') {
    publishLanName(name);
  }
}
function joinable(g: JoinableGameSummary): boolean {
  // A campaign row opens the Campaign Map, which resolves the seat by
  // name itself — the row is enterable even without a per-game seat link.
  if (g.campaign !== undefined) {
    return true;
  }
  return g.you !== undefined;
}
/**
 * A row that ARRIVED while the player was on this screen — the visible
 * proof that the push channel works. It decays on its own; nothing else
 * depends on it.
 */
function isNewGame(g: JoinableGameSummary): boolean {
  return lobbyState.newIds.includes(g.id);
}
/** The cursor is parked on the «add a host» affordance (always last). */
function onLanEntryRow(): boolean {
  return lanEntryVisible.value && gamesCursor.value === gamesCount.value - 1;
}
/** Open the on-screen keyboard for a hand-typed host address. */
function openManualHost(): void {
  lanDraft.value = '';
  lanIssue.value = '';
  lanEntry.value = true;
  // Silence the console key bridge — the on-screen keyboard owns input.
  menuPadState.textEntry = true;
}
function commitManualHost(value: string): void {
  // `addManualHost` validates the address itself (a bare IP, host:port, an
  // http:// paste, a bracketed IPv6). A rejection keeps the keyboard open
  // with the reason rather than swallowing the attempt.
  if (!addManualHost(value)) {
    lanIssue.value = 'That is not a usable address';
    return;
  }
  lanEntry.value = false;
  lanIssue.value = '';
  menuPadState.textEntry = false;
  // The new host is a SOURCE like any other — the one refresh path asks it.
  void refreshLobby();
}
function cancelManualHost(): void {
  lanEntry.value = false;
  lanIssue.value = '';
  menuPadState.textEntry = false;
}
/** X on a LAN row we typed ourselves — take the entry back off the list. */
function removeManualHostAt(i: number): boolean {
  const row = visibleLanRows.value[i - localRows.value.length];
  const entry = manualHosts.value.find((h) => row !== undefined && row.hostName === h.entry);
  if (entry === undefined) {
    return false;
  }
  removeManualHost(entry.entry);
  void refreshLobby();
  return true;
}
/**
 * Manual re-ask (RT). The list refreshes itself on open, on push, on focus
 * and on a poll floor — this is for the player who wants to KNOW it just
 * did, and the way out of any source that has gone quiet.
 */
function refreshGames(): void {
  void refreshLobby({archive: gamesTab.value === 'finished'});
}
function yourTurn(g: JoinableGameSummary): boolean {
  // A finished game keeps an `activePlayer` (whoever was to move when it
  // ended) — it means nothing now, so the archive never claims a turn.
  return g.finished !== true && g.you !== undefined && g.activePlayer === g.you.color;
}
/** Switch the shown slice — L3, or a click on the strip (mouse fallback). */
function setGamesTab(tab: JoinableGameStatus): void {
  if (gamesTab.value === tab) {
    return;
  }
  gamesTab.value = tab;
  gamesCursor.value = 0;
  gamesConfirm.value = undefined;
  gamesError.value = false;
  keepGamesCursorVisible();
  if (tab === 'finished' && lobbyState.archiveStatus !== 'loading') {
    // Re-ask on every toggle: a game that has just ended belongs here
    // without a restart. A load already in flight is left alone — the scan
    // is not free and a second one would only rewrite the same list.
    void loadLobbyArchive();
  }
}
/**
 * «12 с назад» / «7 мин назад» — how long ago this party was created, and
 * the reason it sits where it sits. Reads the ONE shared clock in
 * `lobbyState`, which re-arms itself at the cadence the freshest row needs,
 * so every row on screen advances in the same tick.
 */
function createdAgo(g: JoinableGameSummary): string {
  return lobbyAgeLabel(lobbyAge(g.createdTimeMs, lobbyState.nowMs));
}
/**
 * Open a row hosted by THIS server. A FINISHED game is opened to be READ:
 * the console lands on the settled final scoring (replay the count, open
 * the overview), so it must not become the CONTINUE memory — that names
 * the party still being played — and its curtain says «синхронизация»
 * rather than «подготовка экспедиции».
 */
function openLocalGame(g: JoinableGameSummary): void {
  // A CAMPAIGN row opens the Campaign Map — the campaign's front door
  // (the active mission is one press away from there). Not recorded as
  // the CONTINUE memory: that stays the concrete game.
  if (g.campaign !== undefined) {
    navigateWithCurtain(paths.CAMPAIGN + '?id=' + encodeURIComponent(g.campaign.id), 'sync', {kind: 'campaign-map'});
    return;
  }
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
  // A listed live game is being RE-ENTERED, never founded.
  navigateWithCurtain(href, 'sync');
}
function enterGameAt(i: number): void {
  gamesCursor.value = i;
  if (lanEntryVisible.value && i === gamesCount.value - 1) {
    openManualHost();
    return;
  }
  if (i < localRows.value.length) {
    const g = localRows.value[i];
    if (g !== undefined) {
      openLocalGame(g);
    }
    return;
  }
  // A LAN row: pin the session to the HOST's server first — from then on
  // every request and the WebSocket go to that host (§6). A row whose
  // host has stopped answering is kept on screen (it exists) but not
  // entered: the navigation would land on a curtain that never lifts.
  const row = visibleLanRows.value[i - localRows.value.length];
  if (row === undefined || row.stale || row.endpoint === undefined) {
    return;
  }
  // A CAMPAIGN row opens the Campaign Map on the HOST's server — the
  // campaign id is pinned the same way a seat is, and the map's own page
  // (`/campaign?id=c…`) resolves the pin for its model/poll/carryover.
  if (row.game.campaign !== undefined) {
    pinServerEndpoint(row.game.campaign.id, row.endpoint);
    navigateWithCurtain(paths.CAMPAIGN + '?id=' + encodeURIComponent(row.game.campaign.id), 'sync', {kind: 'campaign-map'});
    return;
  }
  if (row.game.you !== undefined) {
    pinServerEndpoint(row.game.you.id, row.endpoint);
    recordLastGameEntered(row.game.id);
    navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(row.game.you.id), 'sync');
  }
}
/** X on a LOCAL row (host mode) — ask before deleting that one game.
 *  A CAMPAIGN row never offers the single delete: the dialog redirects to
 *  the campaign itself (the server refuses a lone mission delete anyway). */
function requestDeleteAt(i: number): void {
  if (!canDeleteLocal.value || i >= localRows.value.length) {
    return;
  }
  const g = localRows.value[i];
  if (g !== undefined) {
    gamesCursor.value = i;
    gamesError.value = false;
    gamesConfirm.value = g.campaign !== undefined ? {kind: 'campaign', game: g} : {kind: 'one', game: g};
  }
}
/** The campaign-mission dialog's one verb: the campaign's own front door. */
function openCampaignFromConfirm(): void {
  const confirm = gamesConfirm.value;
  if (confirm === undefined || confirm.kind !== 'campaign') {
    return;
  }
  gamesConfirm.value = undefined;
  openLocalGame(confirm.game);
}
/** Y (host mode) — ask before wiping the whole local library. */
function requestDeleteAll(): void {
  if (canDeleteLocal.value && hasLocalGames.value) {
    gamesError.value = false;
    gamesConfirm.value = {kind: 'all'};
  }
}
async function executeGamesDelete(): Promise<void> {
  const confirm = gamesConfirm.value;
  if (confirm === undefined || confirm.kind === 'campaign' || gamesDeleting.value) {
    return;
  }
  gamesDeleting.value = true;
  gamesError.value = false;
  try {
    const query = confirm.kind === 'all' ? 'all=1' : 'id=' + encodeURIComponent(confirm.game.id);
    const res = await fetch(apiUrl(paths.API_LOCAL_GAME_DELETE) + '?' + query, {method: 'POST'});
    if (!res.ok) {
      throw new Error(`delete failed (${res.status})`);
    }
    gamesConfirm.value = undefined;
    // Re-ask rather than patch the list locally: the server is the one that
    // knows what is left (and the same refresh rewrites the CONTINUE cache).
    await refreshLobby({archive: true});
    gamesCursor.value = Math.min(gamesCursor.value, Math.max(0, gamesCount.value - 1));
  } catch {
    gamesError.value = true;
  } finally {
    gamesDeleting.value = false;
  }
}
function onQuitConfirm(): void {
  overlay.value = undefined;
  quitApp();
}

/**
 * The identity may resolve AFTER the first frame (Steam prefill on a fresh
 * install, the profile roster, a profile switch). The lobby is name-scoped,
 * so this is the difference between a list and an empty screen — and its
 * absence is exactly why «Мои партии» used to need an app restart.
 */
watch(() => identityName.value, (name: string) => {
  setLobbyIdentity(name);
  if (name !== '') {
    publishLanName(name);
  }
  // The campaigns list is name-scoped the same way.
  void refreshCampaigns();
});
/**
 * Campaign realtime rides the LOBBY channel (a campaign mutation bumps the
 * lobby revision server-side), and every lobby trigger funnels into
 * `refreshLobby`, which stamps `lastRefreshAt` — so re-asking the campaign
 * list here covers push, poll, focus and the manual RT alike.
 */
watch(() => lobbyState.lastRefreshAt, () => {
  void refreshCampaigns();
});
// The Steam state loads async (getSteamState). When it arrives, show the first-run prompt
// if it's warranted (Windows first launch, not added, not dismissed) and nothing else is open.
watch(() => steamShortcutState.loaded, (loaded: boolean) => {
  if (loaded === true) {
    maybeShowSteamPrompt();
  }
});

// Resolve the identity + hydrate the joinable list from the cross-session
// cache BEFORE the first render, so CONTINUE / the My-games badge are on
// the first painted frame instead of popping in after the fetch (the flash).
ensureIdentityLoaded();
// The profile roster is the source of truth for the active identity —
// hydrate it (migrating a legacy single identity + mirroring the active
// profile into identityState) BEFORE the first render, so the header /
// games reflect the active profile even before the profile editor is opened.
ensureProfilesLoaded();
hydrateLobbyCache(identityName.value);

onMounted(() => {
  setDocumentTitle('Terraforming Mars');
  ensureIdentityLoaded();
  // SCENE TRANSITION (the menu destination — the exit-from-game curtain
  // lands here): hold the reveal until the menu's own backdrop texture is
  // decoded and the fonts are settled, so the first revealed frame is the
  // finished composition, never a bare gradient the art then pops onto.
  // No-ops entirely when no curtain is covering (a plain SPA hop).
  if (loadingScreenState.phase === 'covering') {
    const releaseBg = deferSceneReveal('menu-bg', 3500);
    const bg = new Image();
    bg.src = 'assets/premium-main-menu-bg.png';
    bg.decode().then(releaseBg, releaseBg);
    const releaseFonts = deferSceneReveal('fonts', 2500);
    const fonts = (document as Partial<Document>).fonts;
    if (fonts !== undefined) {
      void fonts.ready.then(() => releaseFonts());
    } else {
      releaseFonts();
    }
    armSceneDestination();
  }
  // Return from the Campaign Map: reopen «Мои кампании» on the same tab and
  // focus the same row (the map entry was a full navigation, so the overlay
  // state did not survive on its own).
  const campaignsReturn = takeCampaignsReturn();
  if (campaignsReturn !== undefined) {
    campaignsState.tab = campaignsReturn.tab;
    campaignsState.pendingFocusId = campaignsReturn.id;
    campaignsState.confirmId = undefined;
    campaignsState.deleteError = '';
    overlay.value = 'campaigns';
    // The campaigns screen consumes the lobby model (LAN sources) — see
    // the activateAt('campaigns') branch.
    void openLobbyList();
  }
  // The badge on the plate needs the list before the screen is ever opened.
  void refreshCampaigns();
  // First launch with no saved name (Steam Deck / Steam Machine): prefill from the Steam display
  // name so the greeting + creator seat aren't empty. Reactive — the menu updates when it lands.
  void prefillIdentityFromSteam();
  initSteamShortcut();
  maybeShowSteamPrompt();
  offPad = installMenuPad((intent) => onIntent(intent));
  // Host-as-server: subscribe to LAN discovery pushes + advertise under the
  // active profile's name (both no-op on the web / remote mode). The effective
  // app mode gates the local-game deletion verbs in the games overlay.
  initLanDiscovery();
  void desktopBridge()?.getAppMode?.().then((info) => {
    if (info !== undefined) {
      appModeEffective.value = info.effective;
    }
  }).catch(() => {});
  // The lobby watch runs for the whole menu: it keeps CONTINUE and the badge
  // live (push + a slow fallback poll) even before «Мои партии» is opened, and
  // it starts with an EMPTY name too — the identity watcher above feeds it.
  // The MENU SCOPE additionally keeps LAN sources + their push channels in
  // play at the menu ROOT, so a campaign/game created on another couch
  // announces itself immediately (badge + open lists), not on a screen open.
  setLobbyMenuScope(true);
  startLobbyWatch(identityName.value);
  if (identityName.value !== '') {
    publishLanName(identityName.value);
  }
  // Version readout (desktop shell prefers the baked app version; web uses settings.json).
  const bridge = desktopBridge();
  if (bridge !== undefined) {
    void bridge.getVersion().then((v) => {
      desktopVersion.value = typeof v === 'string' ? v : '';
      // A LAN host on another build gets a warning on its rows.
      setLobbyOwnVersion(desktopVersion.value);
    }).catch(() => undefined);
  }
  // Watch for a new version for as long as the menu is up. The menu is the safe place to be
  // interrupted, so this is what makes "leave the game to the main menu" the way to update.
  startMenuUpdateWatch();
});
onBeforeUnmount(() => {
  offPad?.();
  setLobbyMenuScope(false);
  stopLobbyWatch();
  stopMenuUpdateWatch();
});
</script>
