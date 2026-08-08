import {defineComponent, nextTick} from 'vue';
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleDevCardPicker from '@/client/components/console/menu/ConsoleDevCardPicker.vue';
import {createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};

const CardZoomModalStub = defineComponent({
  name: 'CardZoomModal',
  props: {
    card: {type: Object, required: true},
    cards: {type: Array, default: undefined},
    index: {type: Number, default: 0},
    selected: {type: Boolean, default: false},
    consoleMotion: {type: Boolean, default: false},
    annotationsSuppressed: {type: Boolean, default: false},
    lore: {type: Boolean, default: false},
  },
  emits: ['navigate', 'close'],
  methods: {
    show(): void {},
    prev(): void {},
    next(): void {},
    close(): void {
      this.$emit('close');
    },
  },
  template: '<div class="zoom-stub"><slot name="side" :nonce="1" :closing="false" /><slot name="actions" /></div>',
});

const ConsoleCardRulesPanelStub = defineComponent({
  name: 'ConsoleCardRulesPanel',
  props: {
    cardName: {type: String, required: true},
    nonce: {type: Number, default: 0},
    closing: {type: Boolean, default: false},
  },
  template: '<aside class="console-rules-stub" />',
});

const ConsoleScrollAreaStub = defineComponent({
  name: 'ConsoleScrollArea',
  methods: {ensureVisible(): void {}},
  template: '<div><slot /></div>',
});

type PickerVm = {
  readonly zoomSelected: boolean,
  openZoom(names: ReadonlyArray<CardName>, at: number): void,
  handleIntent(intent: GamepadIntent): boolean,
  onZoomNavigate(card: CardModel, index: number): void,
  closeZoom(): void,
};

function mountPicker() {
  return mount(ConsoleDevCardPicker, {
    global: {
      ...globalConfig.global,
      stubs: {
        teleport: true,
        GamepadGlyph: true,
        CardZoomModal: CardZoomModalStub,
        ConsoleCardRulesPanel: ConsoleCardRulesPanelStub,
        ConsoleScrollArea: ConsoleScrollAreaStub,
      },
    },
  });
}

describe('ConsoleDevCardPicker fullscreen', () => {
  beforeEach(() => {
    resetCreateGameState();
    document.body.classList.remove('con-zoom-open');
  });

  afterEach(() => {
    document.body.classList.remove('con-zoom-open');
  });

  it('uses the console-native viewer and toggles the current card with A', async () => {
    const wrapper = mountPicker();
    const vm = wrapper.vm as unknown as PickerVm;

    vm.openZoom([CardName.ALGAE, CardName.BUSHES], 0);
    await nextTick();

    const zoom = wrapper.findComponent(CardZoomModalStub);
    expect(zoom.classes(), 'native viewer class').to.include('con-zoom');
    expect(zoom.props('consoleMotion'), 'native browse motion').to.eq(true);
    expect(zoom.props('lore'), 'native lore flank').to.eq(true);
    expect(zoom.props('annotationsSuppressed'), 'desktop callouts suppressed').to.eq(true);
    expect(wrapper.find('.con-zoom-veil').exists(), 'native veil').to.eq(true);
    expect(wrapper.find('.console-rules-stub').exists(), 'console rules panel').to.eq(true);
    expect(wrapper.find('.con-zoom__bar').exists(), 'native command bar').to.eq(true);
    expect(document.body.classList.contains('con-zoom-open'), 'body zoom ownership').to.eq(true);

    expect(createGameState.config.guaranteedCards.projects, 'initial picks').to.not.include(CardName.ALGAE);
    vm.handleIntent(A);
    await nextTick();
    expect(createGameState.config.guaranteedCards.projects, 'A selects').to.include(CardName.ALGAE);
    expect(vm.zoomSelected, 'computed selected state').to.eq(true);
    expect(wrapper.find('.con-zoom__state').exists(), 'selected status').to.eq(true);

    vm.handleIntent(A);
    await nextTick();
    expect(createGameState.config.guaranteedCards.projects, 'second A deselects').to.not.include(CardName.ALGAE);
    expect(wrapper.find('.con-zoom__state').exists(), 'selected status clears').to.eq(false);

    vm.onZoomNavigate({name: CardName.BUSHES} as CardModel, 1);
    vm.handleIntent(A);
    expect(createGameState.config.guaranteedCards.projects, 'navigated card selects').to.include(CardName.BUSHES);

    vm.closeZoom();
    await nextTick();
    expect(document.body.classList.contains('con-zoom-open'), 'body zoom ownership cleared').to.eq(false);
    wrapper.unmount();
  });
});
