<template>
  <div class="log-container">
    <div class="log-generations">
      <h2 :class="getTitleClasses()">
          <span v-i18n>Game log</span>
      </h2>
      <div class="log-gen-title"  v-i18n>Gen: </div>
      <div class="log-gen-numbers">
        <div v-for="n in getGenerationsRange()" :key="n" :class="getClassesGenIndicator(n)" v-on:click.prevent="selectGeneration(n)">
          {{ n }}
        </div>
      </div>
      <span class="label-additional" v-if="players.length === 1"><span :class="lastGenerationClass" v-i18n>of {{lastSoloGeneration}}</span></span>
    </div>
    <div class="panel log-panel">
      <div id="logpanel-scrollable" class="panel-body">
        <ul v-if="messages">
          <log-message-component v-for="(message, index) in messages" :key="index" :message="message" :viewModel="viewModel" v-on:click="messageClicked(message)" @spaceClicked="spaceClicked"></log-message-component>
        </ul>
      </div>
      <div class='debugid'>(debugid {{step}})</div>
    </div>
    <card-panel v-if="selectedMessage !== undefined" :message="selectedMessage" :players="players" v-on:hide="selectedMessage = undefined"></card-panel>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {LogMessage} from '@/common/logs/LogMessage';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {playerColorClass} from '@/common/utils/utils';
import {Color} from '@/common/Color';
import {SoundManager} from '@/client/utils/SoundManager';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {ParticipantId, SpaceId} from '@/common/Types';
import LogMessageComponent from '@/client/components/logpanel/LogMessageComponent.vue';
import CardPanel from '@/client/components/logpanel/CardPanel.vue';
import {isMarsSpace} from '@/common/boards/spaces';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {replaceLogRequest} from '@/client/components/logpanel/logPanelState';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'log-panel'});
const props = defineProps({
  viewModel: {
    type: Object as () => ViewModel,
    required: true,
  },
  color: {
    type: String as () => Color,
    required: true,
  },
  step: {
    type: Number,
    required: false,
    default: 0,
  },
});

const flow = useFlowScope('log-panel');
const messages = ref<Array<LogMessage>>([]);
const selectedGeneration = ref(-1);
const selectedMessage = ref<LogMessage | undefined>(undefined);

const generation = computed((): number => {
  return props.viewModel.game.generation;
});
const lastSoloGeneration = computed((): number => {
  return props.viewModel.game.lastSoloGeneration;
});
const players = computed((): Array<PublicPlayerModel> => {
  return props.viewModel.players;
});
const id = computed((): ParticipantId | undefined => {
  return props.viewModel.id;
});

function messageClicked(message: LogMessage) {
  selectedMessage.value = message;
}
function spaceClicked(spaceId: SpaceId) {
  const id = isMarsSpace(spaceId) ? 'shortkey-board' : 'shortkey-moonBoard';
  const el = document.getElementById(id);
  el?.scrollIntoView({block: 'center', inline: 'center', behavior: 'auto'});

  const regions = ['main_board', 'moon_board', 'moon_board_outer_spaces'];
  for (const region of regions) {
    const board = document.getElementById(region);
    if (board !== null) {
      const array = board.getElementsByClassName('board-log-highlight');
      for (let i = 0, length = array.length; i < length; i++) {
        const element = array[i] as HTMLElement;
        if (element.getAttribute('data_log_highlight_id') === spaceId) {
          element.classList.add('highlight');
          // A GUARANTEED release (flow kernel — PLAN §10 · C1): the class sits on the BOARD's element, not the
          // panel's — it comes off after the blink, or when the panel leaves first.
          flow.guarantee(3000, 'the clicked cell\'s highlight comes off', () => {
            element.classList.remove('highlight');
          });
          return;
        }
      }
    }
  }
}
function selectGeneration(gen: number): void {
  if (gen !== selectedGeneration.value) {
    getLogsForGeneration(gen);
  }
  selectedGeneration.value = gen;
}
function getLogsForGeneration(generationNow: number): void {
  const messagesNow = messages.value;
  const url = `${apiUrl(paths.API_GAME_LOGS)}?id=${id.value}&generation=${generationNow}`;
  // abort any pending requests — one log request at a time (the handle lives in `logPanelState.ts`)
  const controller = replaceLogRequest();

  fetch(url, {signal: controller.signal})
    .then((resp) => {
      if (!resp.ok) {
        console.error(`error updating messages, response code ${resp.status}`);
        return null;
      }
      return resp.json();
    })
    .then((data) => {
      if (!data) {
        return;
      }
      messagesNow.splice(0, messagesNow.length);
      messagesNow.push(...data);
      if (getPreferences().enable_sounds && window.location.search.includes('experimental=1') ) {
        SoundManager.newLog();
      }
      if (generationNow === generation.value) {
        nextTick(scrollToEnd);
      }
    })
    .catch((err) => {
      if (err.name === 'AbortError') {
        // ignore aborted requests
        return;
      }
      console.error('error updating messages, unable to reach server');
    });
}
function scrollToEnd() {
  const scrollablePanel = document.getElementById('logpanel-scrollable');
  if (scrollablePanel !== null) {
    scrollablePanel.scrollTop = scrollablePanel.scrollHeight;
  }
}
function getClassesGenIndicator(gen: number): string {
  const classes = ['log-gen-indicator'];
  if (gen === selectedGeneration.value) {
    classes.push('log-gen-indicator--selected');
  }
  return classes.join(' ');
}
function getGenerationsRange(): Array<number> {
  const generations: Array<number> = [];
  for (let i = 1; i <= generation.value; i++) {
    generations.push(i);
  }
  return generations;
}
function getTitleClasses(): string {
  const classes = ['log-title'];
  classes.push(playerColorClass(props.color, 'shadow'));
  return classes.join(' ');
}
function lastGenerationClass(): string {
  return lastSoloGeneration.value === generation.value ? 'last-generation blink-animation' : '';
}

onMounted(() => {
  selectedGeneration.value = generation.value;
  getLogsForGeneration(generation.value);
});
</script>
