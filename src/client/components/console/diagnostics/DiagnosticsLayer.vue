<template>
  <ConsoleDevNotice v-if="noticeOn" />
</template>

<script setup vapor lang="ts">
/**
 * THE APP-LEVEL DIAGNOSTICS LAYER — mounted by `App.vue` beside `GamepadLayer`, on every screen, outside every shell.
 *
 * It renders one thing — the developer's notice, and only while that setting is on (the notice is a lazy component:
 * a player who never turns it on never loads it) — and does the one piece of wiring that needs what only the app has:
 * it tells the diagnostics hub WHERE THE PLAYER STANDS and what must never leave by itself (the seat's id, the names
 * at the table and of this device's profiles — `diagnostics/diagnosticsContext.ts`). The surface itself (the journal,
 * the report) is a member of the system overlay and lives in `GamepadLayer`.
 */
import {computed, watch} from 'vue';
import type {PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ConsoleDevNotice} from '@/client/components/console/diagnostics/diagnosticsAsync';
import {profilesState} from '@/client/components/mainMenu/profilesState';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {publishDiagContext} from '@/client/diagnostics/diagnosticsContext';
import {installDevNotice} from '@/client/diagnostics/diagnosticsNotice';
import {devNoticeState} from '@/client/diagnostics/diagnosticsPrefs';
import {getPreferences} from '@/client/utils/PreferencesManager';

defineOptions({name: 'DiagnosticsLayer'});
const props = defineProps({
  /** The App screen. */
  screen: {type: String, default: ''},
  /** The player's view while a game is on screen. */
  playerView: {type: Object as PropType<PlayerViewModel | undefined>, default: undefined},
});

const noticeOn = computed((): boolean => devNoticeState.mode !== 'off');

// The notice's state follows the journal from here on (idempotent; cheap while the setting is off).
installDevNotice();

// ONE reaction: everything the context is made of is read in one source and told in one call — VALUES, never the
// view's identity (a response replaces the root object every time; the ids and the names do not change with it).
watch(() => {
  const view = props.playerView;
  return [
    props.screen,
    consoleLayoutState.profile,
    view?.id ?? '',
    view === undefined ? '' : view.players.map((p) => p.name).join('\u0000'),
    profilesState.profiles.map((p) => p.displayName).join('\u0000'),
    view?.waitingFor?.type ?? '',
  ] as const;
}, ([screen, profile, participantId, playerNames, profileNames, promptType]) => {
  publishDiagContext({
    screen,
    profile,
    locale: getPreferences().lang,
    participantId,
    playerNames: playerNames === '' ? [] : playerNames.split('\u0000'),
    profileNames: profileNames === '' ? [] : profileNames.split('\u0000'),
    promptType,
  });
}, {immediate: true});
</script>
