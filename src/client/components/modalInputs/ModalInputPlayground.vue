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

      <!-- Bespoke colony-flow modals (not routed via modal-input-host) — kept in
           the same audit gate so weak/legacy colony modals can't slip past. -->
      <section class="modal-input-playground__cell">
        <div class="modal-input-playground__cell-head">
          <span class="modal-input-playground__cell-label">Colony trade payment (affordable + disabled)</span>
          <span class="modal-input-playground__tags">
            <span class="modal-input-playground__tag modal-input-playground__tag--ok">premium</span>
            <span class="modal-input-playground__tag modal-input-playground__tag--info">disabled: 1</span>
          </span>
        </div>
        <div class="modal-input-playground__stage">
          <colony-trade-payment-modal :colony="colonyTradeMock.colony"
                                      :colonyName="colonyTradeMock.colonyName"
                                      :options="colonyTradeMock.options"
                                      :disabledOptions="colonyTradeMock.disabledOptions"
                                      @select="onColonyTradeSelect"
                                      @cancel="onSave('colony-trade cancel')" />
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
import ColonyTradePaymentModal from '@/client/components/colonies/ColonyTradePaymentModal.vue';
import {ColonyName} from '@/common/colonies/ColonyName';

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
  mockPlayer('red', 'Victor', 'Tharsis Republic', {energyProduction: 2, megacredits: 40,
    // Two resource cards in the tableau so the Venus final-bonus "resource on a
    // card" tab has real candidates to render (with the current→resulting + VP
    // preview).
    tableau: [{name: 'Tharsis Republic'}, {name: 'Tardigrades', resources: 4}, {name: 'Physics Complex', resources: 2}]}),
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
  components: {ColonyTradePaymentModal},
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
      // Mock for the bespoke colony trade-payment modal: titanium/M€ affordable,
      // energy unaffordable (disabled with a reason).
      colonyTradeMock: {
        colonyName: ColonyName.IO,
        colony: {colonies: [], isActive: true, name: ColonyName.IO, trackPosition: 3, visitor: undefined},
        options: [
          {type: 'option', title: 'Pay 3 titanium', buttonLabel: '',
            metadata: {kind: 'resourceRemoval', icon: 'titanium', amount: 3, resource: {current: 5, resulting: 2}}},
          {type: 'option', title: 'Pay 9 M€', buttonLabel: '',
            metadata: {kind: 'resourceRemoval', icon: 'megacredits', amount: 9, resource: {current: 21, resulting: 12}}},
        ],
        disabledOptions: [
          {title: 'Pay 3 energy',
            metadata: {kind: 'resourceRemoval', icon: 'energy', amount: 3, resource: {current: 2, resulting: 0}},
            reason: 'Not enough energy'},
        ],
      } as any,
    };
  },
  computed: {
    scenarios(): Array<{label: string, input: any}> {
      return [
        {
          label: 'Contextual — optional effect w/ tradeoff (Pharmacy Union)',
          input: {
            type: 'or',
            title: 'Select one option',
            choiceContext: {
              source: {kind: 'corporation', card: 'Pharmacy Union'},
              trigger: 'You played a science tag and there are no diseases left here.',
              mode: 'optional-effect',
            },
            options: [
              {type: 'option', title: 'Turn this card face down and gain 3 TR', buttonLabel: 'Gain TR',
                metadata: {kind: 'resourceGain', effects: [{direction: 'gain', icon: 'tr', amount: 3}], tradeoff: 'Card is turned face down — its effect stops working'}},
              {type: 'option', title: 'Do nothing', buttonLabel: 'Do nothing', metadata: {kind: 'skip'}},
            ],
          },
        },
        {
          label: 'Contextual — effect choice (Olympus Conference)',
          input: {
            type: 'or',
            title: 'Select an option for Olympus Conference',
            choiceContext: {
              source: {kind: 'card', card: 'Olympus Conference'},
              trigger: 'A science tag was played.',
              mode: 'effect-choice',
            },
            options: [
              {type: 'option', title: 'Remove a science resource from this card to draw a card', buttonLabel: 'Remove resource',
                metadata: {kind: 'resourceRemoval', icon: 'science', amount: 1, effects: [{direction: 'gain', icon: 'cards', amount: 1}]}},
              {type: 'option', title: 'Add a science resource to this card', buttonLabel: 'Add resource',
                metadata: {kind: 'resourceGain', icon: 'science', amount: 1, effects: [{direction: 'gain', icon: 'science', amount: 1}]}},
            ],
          },
        },
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
          label: 'OrOptions — steal M€ (Hired Raiders) · with disabled target',
          input: {
            type: 'or',
            title: {message: 'Select player to steal up to ${0} ${1} from', data: [raw(3), raw('M€')]},
            options: [
              {type: 'option', buttonLabel: 'Steal',
                title: {message: 'Steal ${0} M€ from ${1}', data: [raw(3), player('blue')]},
                metadata: {kind: 'steal', icon: 'megacredits', amount: 3, player: {color: 'blue', current: 22, resulting: 19}}},
              {type: 'option', title: 'Do not steal', buttonLabel: '', metadata: {kind: 'skip'}},
            ],
            disabledOptions: [
              {title: {message: '${0}', data: [player('red')]},
                metadata: {kind: 'playerTarget', icon: 'megacredits', player: {color: 'red'}},
                reason: 'Nothing to steal'},
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
          input: {type: 'player', title: {message: 'Select player to decrease ${0} production by ${1} step(s)', data: [raw('energy'), raw(1)]}, buttonLabel: 'Decrease', players: ['red'], icon: 'energy', amount: 1, scope: 'production',
            disabledPlayers: [{color: 'blue', reason: 'Production already at minimum'}]},
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
          input: {type: 'amount', title: 'Select amount of heat production to decrease', buttonLabel: 'Decrease', min: 1, max: 6, maxByDefault: false, icon: 'heat',
            conversion: {from: 'heat', to: 'megacredits', fromScope: 'production', toScope: 'production'}},
        },
        {
          label: 'SelectAmount — conversion, stock (Supercapacitors)',
          input: {type: 'amount', title: 'Select amount of energy to convert to heat', buttonLabel: 'OK', min: 0, max: 3, maxByDefault: true, icon: 'energy',
            conversion: {from: 'energy', to: 'heat'}},
        },
        {
          label: 'SelectAmount — bare (no conversion hint)',
          input: {type: 'amount', title: 'Select amount', buttonLabel: 'OK', min: 0, max: 5, maxByDefault: false},
        },
        {
          label: 'SelectResource',
          input: {type: 'resource', title: 'Gain a standard resource', buttonLabel: 'Gain', include: ['steel', 'titanium', 'plants', 'energy', 'heat']},
        },
        {
          label: 'SelectResources — distribute',
          input: {type: 'resources', title: {message: 'Gain ${0} standard resources', data: [raw(2)]}, buttonLabel: 'Gain', count: 2},
        },
        {
          label: 'Venus bonus — standard (pick 1)',
          input: {type: 'and', title: {message: 'Gain ${0} resource(s) for your Venus track bonus.', data: [raw(1)]}, buttonLabel: '', options: [],
            venusBonusPrompt: {kind: 'standard', baseCount: 1}},
        },
        {
          label: 'Venus bonus — standard (pick 3)',
          input: {type: 'and', title: {message: 'Gain ${0} resource(s) for your Venus track bonus.', data: [raw(3)]}, buttonLabel: '', options: [],
            venusBonusPrompt: {kind: 'standard', baseCount: 3}},
        },
        {
          label: 'Venus bonus — FINAL (base + wild: standard / on-card)',
          input: {type: 'or', title: 'Choose your wild resource bonus.', buttonLabel: '', options: [],
            venusBonusPrompt: {kind: 'final', baseCount: 1, wildCardTargets: ['Tardigrades', 'Physics Complex']}},
        },
        {
          label: 'Venus bonus — FINAL, NO card (on-card tab disabled, wild as standard)',
          input: {type: 'and', title: 'Choose your wild resource bonus.', buttonLabel: '', options: [],
            venusBonusPrompt: {kind: 'final', baseCount: 1, wildCardTargets: []}},
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
    onColonyTradeSelect(idx: number): void {
      this.lastResponse = 'colony-trade pay option ' + idx;
    },
    // Quality-gate debug chips: which scenarios drive the rich (metadata) render
    // vs. the text fallback. Makes "this one is still legacy/fallback" obvious.
    scenarioTags(s: {input: any}): Array<{text: string, kind: string}> {
      const input = s.input;
      const tags: Array<{text: string, kind: string}> = [];
      // A Venus alt-track bonus prompt routes to the dedicated premium
      // VenusBonusContent (resource tiles + final wild bonus), not any fallback.
      if (input.venusBonusPrompt !== undefined) {
        return [{text: 'venus premium', kind: 'ok'}];
      }
      const disabledCount = (input.disabledOptions?.length ?? 0) + (input.disabledPlayers?.length ?? 0);
      if (disabledCount > 0) {
        tags.push({text: 'disabled: ' + disabledCount, kind: 'info'});
      }
      if (input.type === 'or') {
        const leaves = (input.options as Array<any>).filter((o) => o.type === 'option');
        const withMeta = leaves.filter((o) => o.metadata !== undefined);
        if (leaves.length > 0 && withMeta.length === leaves.length) {
          tags.unshift({text: 'metadata: complete', kind: 'ok'});
        } else if (withMeta.length > 0) {
          tags.unshift({text: 'metadata: partial', kind: 'warn'});
        } else {
          tags.unshift({text: 'fallback (text only)', kind: 'fallback'});
        }
        // Carrying choiceContext → routes to the premium ContextualChoiceContent
        // (source card + trigger frame), not the bare ModernOptionPicker.
        if (input.choiceContext !== undefined) {
          tags.unshift({text: 'contextual', kind: 'ok'});
        }
        return tags;
      }
      if (input.type === 'option' && input.metadata !== undefined) {
        tags.unshift({text: 'metadata', kind: 'ok'});
        return tags;
      }
      if (input.type === 'player') {
        tags.unshift(input.icon !== undefined ?
          {text: 'rich target (' + (input.scope ?? 'stock') + ')', kind: 'ok'} :
          {text: 'plain target', kind: 'warn'});
        return tags;
      }
      if (input.type === 'amount') {
        tags.unshift(input.conversion !== undefined ?
          {text: 'conversion (' + (input.conversion.fromScope ?? 'stock') + ' → ' + (input.conversion.toScope ?? 'stock') + ')', kind: 'ok'} :
          {text: input.icon !== undefined ? 'icon only' : 'bare stepper', kind: 'warn'});
        return tags;
      }
      tags.unshift({text: input.type, kind: 'neutral'});
      return tags;
    },
  },
});
</script>
