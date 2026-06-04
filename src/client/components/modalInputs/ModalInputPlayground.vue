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
        <div class="modal-input-playground__cell-head">
          <span class="modal-input-playground__cell-label">{{ s.label }}</span>
          <span class="modal-input-playground__tags">
            <span v-for="tag in scenarioTags(s)"
                  :key="tag.text"
                  class="modal-input-playground__tag"
                  :class="'modal-input-playground__tag--' + tag.kind">{{ tag.text }}</span>
          </span>
        </div>
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

// Two mock players, full enough that the rich target picker can read each
// player's stock + production + corporation. Victor (red) is `thisPlayer` so
// the self-target warning renders; Nastya (blue) has 0 energy production and
// only 2 M€ so the disabled-production and capped-stock states are demoable.
function mockPlayer(color: string, name: string, corp: string, overrides: Record<string, unknown>) {
  return {
    color, name,
    tableau: [{name: corp}],
    energy: 4, energyProduction: 2,
    heat: 6, heatProduction: 1,
    megacredits: 30, megacreditProduction: 3,
    plants: 6, plantProduction: 2,
    steel: 3, steelProduction: 1,
    titanium: 2, titaniumProduction: 0,
    cardCost: 3,
    ...overrides,
  };
}
const PLAYERS = [
  mockPlayer('red', 'Victor', 'Tharsis Republic', {energyProduction: 2, megacredits: 40}),
  mockPlayer('blue', 'Nastya', 'Ecoline', {energyProduction: 0, megacredits: 2, plants: 9}),
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
        thisPlayer: PLAYERS[0],
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
                title: {message: 'Remove ${0} plants from ${1}', data: [raw(6), player('blue')]},
                metadata: {kind: 'resourceRemoval', icon: 'plants', amount: 6, player: {color: 'blue', current: 9, resulting: 3}}},
              {type: 'option', title: 'Skip removing plants', buttonLabel: '', metadata: {kind: 'skip'}},
              {type: 'option', buttonLabel: 'Remove plants', warnings: ['removeOwnPlants'],
                title: {message: 'Remove ${0} plants from ${1}', data: [raw(6), player('red')]},
                metadata: {kind: 'resourceRemoval', icon: 'plants', amount: 6, player: {color: 'red', current: 6, resulting: 0}}},
            ],
          },
        },
        {
          label: 'OrOptions — global parameter (Atmoscoop)',
          input: {
            type: 'or',
            title: 'Choose global parameter to raise',
            options: [
              {type: 'option', title: 'Raise temperature 2 steps', buttonLabel: 'Raise temperature',
                metadata: {kind: 'globalParameter', icon: 'temperature', amount: 2, global: {current: -8, resulting: -4, unit: '°C'}}},
              {type: 'option', title: 'Raise Venus 2 steps', buttonLabel: 'Raise Venus',
                metadata: {kind: 'globalParameter', icon: 'venus', amount: 2, global: {current: 10, resulting: 14, unit: '%'}}},
            ],
          },
        },
        {
          label: 'OrOptions — steal M€ (Hired Raiders)',
          input: {
            type: 'or',
            title: {message: 'Select player to steal up to ${0} ${1} from', data: [raw(3), raw('M€')]},
            options: [
              {type: 'option', buttonLabel: 'Steal',
                title: {message: 'Steal ${0} M€ from ${1}', data: [raw(3), player('blue')]},
                metadata: {kind: 'steal', icon: 'megacredits', amount: 3, player: {color: 'blue', current: 22, resulting: 19}}},
              {type: 'option', title: 'Do not steal', buttonLabel: '', metadata: {kind: 'skip'}},
            ],
          },
        },
        {
          label: 'OrOptions — add/remove card resource (Olympus Conference)',
          input: {
            type: 'or',
            title: 'Select an option for Olympus Conference',
            options: [
              {type: 'option', title: 'Add a science resource to this card', buttonLabel: 'Add resource',
                metadata: {kind: 'resourceGain', icon: 'science', amount: 1}},
              {type: 'option', title: 'Remove a science resource from this card to draw a card', buttonLabel: 'Remove resource',
                metadata: {kind: 'resourceRemoval', icon: 'science', amount: 1}},
            ],
          },
        },
        {
          label: 'SelectPlayer — decrease energy production (Energy Tapping) · self + disabled',
          input: {type: 'player', title: {message: 'Select player to decrease ${0} production by ${1} step(s)', data: [raw('energy'), raw(1)]}, buttonLabel: 'Decrease', players: ['red', 'blue'], icon: 'energy', amount: 1, scope: 'production'},
        },
        {
          label: 'SelectPlayer — remove M€ (Flooding / LawSuit) · stock + capped',
          input: {type: 'player', title: 'Select player to remove up to 4 M€ from', buttonLabel: 'Remove M€', players: ['red', 'blue'], icon: 'megacredits', amount: 4, scope: 'stock'},
        },
        {
          label: 'SelectPlayer — plain (no impact metadata)',
          input: {type: 'player', title: 'Select player to discard a card', buttonLabel: 'Select', players: ['red', 'blue']},
        },
        {
          label: 'SelectAmount — heat production (Insulation)',
          input: {type: 'amount', title: 'Select amount of heat production to decrease', buttonLabel: 'Decrease', min: 1, max: 6, maxByDefault: false, icon: 'heat'},
        },
        {
          label: 'SelectResource',
          input: {type: 'resource', title: 'Gain a standard resource', buttonLabel: 'Gain', include: ['steel', 'titanium', 'plants', 'energy', 'heat']},
        },
        {
          label: 'SelectResources — distribute',
          input: {type: 'resources', title: {message: 'Gain ${0} standard resources', data: [raw(2)]}, buttonLabel: 'Gain', count: 2},
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
    // Quality-gate debug chips: which scenarios drive the rich (metadata) render
    // vs. the text fallback. Makes "this one is still legacy/fallback" obvious.
    scenarioTags(s: {input: any}): Array<{text: string, kind: string}> {
      const input = s.input;
      if (input.type === 'or') {
        const leaves = (input.options as Array<any>).filter((o) => o.type === 'option');
        const withMeta = leaves.filter((o) => o.metadata !== undefined);
        if (leaves.length > 0 && withMeta.length === leaves.length) {
          return [{text: 'metadata: complete', kind: 'ok'}];
        }
        if (withMeta.length > 0) {
          return [{text: 'metadata: partial', kind: 'warn'}];
        }
        return [{text: 'fallback (text only)', kind: 'fallback'}];
      }
      if (input.type === 'option' && input.metadata !== undefined) {
        return [{text: 'metadata', kind: 'ok'}];
      }
      if (input.type === 'player') {
        return input.icon !== undefined ?
          [{text: 'rich target (' + (input.scope ?? 'stock') + ')', kind: 'ok'}] :
          [{text: 'plain target', kind: 'warn'}];
      }
      return [{text: input.type, kind: 'neutral'}];
    },
  },
});
</script>
