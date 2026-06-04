<template>
  <!--
    DEV-ONLY visual playground for the modern card-play input modals. Mounted by
    App when the URL contains `?modalPlayground` (or `&modalPlayground`). Renders
    each Modern* input component with mock data so the whole choice/action layer
    can be eyeballed at once WITHOUT having to find + play the specific card that
    triggers it. Never shipped to players (gated by the URL flag).
  -->
  <div class="modal-input-playground">
    <header class="modal-input-playground__bar">
      <span class="modal-input-playground__title">MODAL INPUT PLAYGROUND</span>
      <span class="modal-input-playground__hint">dev preview · mock data · {{ lastResponse }}</span>
    </header>
    <div class="modal-input-playground__grid">
      <section v-for="s in scenarios" :key="s.label" class="modal-input-playground__cell">
        <div class="modal-input-playground__cell-label">{{ s.label }}</div>
        <div class="modal-input-playground__stage">
          <modal-input-host :playerView="playerView" :playerinput="s.input" :onsave="onSave" />
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {setTranslationContext} from '@/client/directives/i18n';
import {MANDATORY_MODAL_PICKER_SETTER} from '@/client/components/MandatoryInputModal.vue';

// Two mock players so player-target options + colour accents render.
const PLAYERS = [
  {color: 'red', name: 'Victor', plants: 6, megacredits: 40, cardCost: 3},
  {color: 'blue', name: 'Nastya', plants: 6, megacredits: 22, cardCost: 3},
];

function player(color: string) {
  return {type: LogMessageDataType.PLAYER, value: color};
}
function raw(value: string | number) {
  return {type: LogMessageDataType.RAW_STRING, value: String(value)};
}

export default defineComponent({
  name: 'ModalInputPlayground',
  // Stub the modal's picker-mode setter so ModernOptionPicker's space options
  // don't blow up outside a real MandatoryInputModal.
  provide() {
    return {
      [MANDATORY_MODAL_PICKER_SETTER]: () => {},
    };
  },
  data() {
    return {
      lastResponse: '—',
      // A mock PlayerViewModel — only the fields the hosted components read.
      playerView: {
        id: 'p-dev',
        players: PLAYERS,
        thisPlayer: {color: 'red', name: 'Victor', plants: 6, megacredits: 40, cardCost: 3},
        game: {phase: 'action'},
        cardsInHand: [],
      } as any,
    };
  },
  computed: {
    scenarios(): Array<{label: string, input: any}> {
      return [
        {
          label: 'OrOptions — remove plants (player targets + skip + warning)',
          input: {
            type: 'or',
            title: {message: 'Select player to remove up to ${0} plants', data: [raw(6)]},
            options: [
              {type: 'option', buttonLabel: 'Remove plants',
                title: {message: 'Remove ${0} plants from ${1}', data: [raw(6), player('blue')]}},
              {type: 'option', title: 'Skip removing plants', buttonLabel: ''},
              {type: 'option', buttonLabel: 'Remove plants', warnings: ['removeOwnPlants'],
                title: {message: 'Remove ${0} plants from ${1}', data: [raw(6), player('red')]}},
            ],
          },
        },
        {
          label: 'OrOptions — choose an effect (Atmoscoop)',
          input: {
            type: 'or',
            title: 'Choose global parameter to raise',
            options: [
              {type: 'option', title: 'Raise temperature 2 steps', buttonLabel: 'Raise temperature'},
              {type: 'option', title: 'Raise Venus 2 steps', buttonLabel: 'Raise Venus'},
            ],
          },
        },
        {
          label: 'SelectOption — confirm',
          input: {type: 'option', title: 'Add a science resource to this card', buttonLabel: 'Add resource'},
        },
        {
          label: 'SelectPlayer',
          input: {type: 'player', title: 'Select player to sue (steal 3 M€ from)', buttonLabel: '', players: ['red', 'blue']},
        },
        {
          label: 'SelectAmount',
          input: {type: 'amount', title: 'Select amount of energy to gain', buttonLabel: 'OK', min: 1, max: 8, maxByDefault: false},
        },
        {
          label: 'SelectResource',
          input: {type: 'resource', title: 'Gain a standard resource', buttonLabel: 'Gain', include: ['steel', 'titanium', 'plants', 'energy', 'heat']},
        },
        {
          label: 'SelectResources — distribute',
          input: {type: 'resources', title: 'Gain 2 standard resources', buttonLabel: 'Gain', count: 2},
        },
      ];
    },
  },
  mounted() {
    // Lets translateMessage resolve PLAYER tokens to names.
    setTranslationContext(this.playerView);
  },
  methods: {
    onSave(out: unknown): void {
      this.lastResponse = 'submitted: ' + JSON.stringify(out);
    },
  },
});
</script>
