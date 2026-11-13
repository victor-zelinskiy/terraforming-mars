/*
 * ConsoleForecastLayer — the «Эффекты» layer (R3) of a stage. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): it stands only while ITS host's layer is open (`effectForecastOpen(host)` — module
 * state), hands the effects explorer the host's own cursors and what the host gave it, and its six hosts reach exactly
 * two members through their `ref="forecastLayer"` (`forecastHostIntent` — `ForecastLayerHandle`): `consumeBack()` and
 * `handleIntent(intent)`, both forwarded to the explorer. Mounted here the way they mount it: under an Options host
 * with a string ref. The explorer is stubbed by name (it is its own specs' subject); the default `transition` stub
 * stands the layer with no motion.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType, reactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {ForecastBranchInfo, ForecastOperation} from '@/client/console/effectForecastModel';
import {
  EffectForecastHost, closeEffectForecastLayer, forecastExplorerUi, openEffectForecastLayer, resetEffectForecastUi,
} from '@/client/console/consoleEffectForecast';
import {EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';

/** What a host reads through its ref — the layer's whole contract with its parents. */
type LayerReach = {consumeBack(): boolean, handleIntent(intent: GamepadIntent): void};
type Seat = {color: string, name: string, tableau: ReadonlyArray<CardModel>};

/** What the explorer stub was asked, in order — and what it answers to «is there something to fold?». */
const asked: Array<string> = [];
let folds = false;

// (A render function, not a template string: the runtime compiler is not in this build.)
const ExplorerStub = defineComponent({
  name: 'ConsoleEffectsExplorer',
  props: {
    mode: {type: String, default: 'stats'},
    operation: {type: String as PropType<ForecastOperation>, default: undefined},
    explorerUi: {type: Object as PropType<EffectsExplorerUi>, default: undefined},
    forecast: {type: Object, default: undefined},
    branches: {type: Array as PropType<ReadonlyArray<ForecastBranchInfo>>, default: undefined},
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, default: undefined},
    color: {type: String, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<Seat>>, default: undefined},
    statsByColor: {type: Object, default: undefined},
  },
  methods: {
    consumeEffectsBack(): boolean {
      asked.push('back');
      return folds;
    },
    handleIntent(intent: GamepadIntent): void {
      asked.push(intent.kind === 'nav' ? 'nav:' + intent.dir : intent.kind);
    },
  },
  render() {
    return h('i', {'class': 'explorer-stub'});
  },
});

type LayerProps = {
  host: EffectForecastHost,
  cards?: ReadonlyArray<CardModel>,
  color?: string,
  players?: ReadonlyArray<Seat>,
  statsByColor?: Record<string, ReadonlyArray<unknown> | undefined>,
  operation?: ForecastOperation,
  branches?: ReadonlyArray<ForecastBranchInfo>,
};

function mountUnderHost(initial: LayerProps) {
  const props = reactive<LayerProps>({...initial});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleForecastLayer, {ref: 'forecastLayer', ...props})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {ConsoleEffectsExplorer: ExplorerStub}}});
  return {
    wrapper,
    /** Exactly the hosts' read: `(this.$refs.forecastLayer ?? undefined) as … | undefined`. */
    reach: () => (wrapper.vm.$refs.forecastLayer ?? undefined) as LayerReach | undefined,
  };
}

describe('ConsoleForecastLayer — the «Эффекты» layer of a stage', () => {
  beforeEach(() => {
    asked.length = 0;
    folds = false;
    resetEffectForecastUi();
  });
  afterEach(() => {
    resetEffectForecastUi();
  });

  it('stands only while ITS host\'s layer is open — another host\'s layer is not this one', async () => {
    const {wrapper} = mountUnderHost({host: 'dock'});
    expect(wrapper.find('.con-fxlayer').exists(), 'closed everywhere').to.eq(false);

    openEffectForecastLayer('colony');
    await nextTick();
    expect(wrapper.find('.con-fxlayer').exists(), 'the colony stage\'s layer is open, not the dock\'s').to.eq(false);

    openEffectForecastLayer('dock');
    await nextTick();
    const layer = wrapper.find('div.con-fxlayer');
    expect(layer.exists()).to.eq(true);
    expect(layer.attributes('data-forecast-layer')).to.not.eq(undefined);
    expect(layer.find('.con-fxpanel').attributes('data-forecast-surface')).to.not.eq(undefined);
    expect(layer.find('.con-fxpanel > .explorer-stub').exists()).to.eq(true);

    closeEffectForecastLayer('dock');
    await nextTick();
    expect(wrapper.find('.con-fxlayer').exists(), 'B / R3 folded it back').to.eq(false);
  });

  it('hands the explorer its forecast mode, the HOST\'s own cursors and what the host gave the layer', async () => {
    const tableau = [{name: CardName.ANTS, resources: 2} as CardModel];
    const players: ReadonlyArray<Seat> = [{color: 'red', name: 'Ada', tableau}];
    const statsByColor = {red: []};
    const branches: ReadonlyArray<ForecastBranchInfo> = [{pos: 0, title: 'First', available: true}];
    openEffectForecastLayer('stdp');
    const {wrapper} = mountUnderHost({host: 'stdp', cards: tableau, color: 'red', players, statsByColor, operation: 'play', branches});
    await nextTick();

    const explorer = wrapper.findComponent(ExplorerStub);
    expect(explorer.exists()).to.eq(true);
    expect(explorer.props('mode')).to.eq('forecast');
    expect(explorer.props('explorerUi'), 'the host\'s own cursors — never the Information workspace\'s').to.eq(forecastExplorerUi('stdp'));
    expect(explorer.props('operation')).to.eq('play');
    expect(explorer.props('color')).to.eq('red');
    expect(explorer.props('cards')).to.deep.eq(tableau);
    expect(explorer.props('players')).to.deep.eq(players);
    expect(explorer.props('statsByColor')).to.deep.eq(statsByColor);
    expect(explorer.props('branches')).to.deep.eq(branches);
    expect(explorer.props('forecast')).to.eq(undefined);
  });

  it('the defaults of a host that hands nothing but its name: an action\'s «when», no cards, no seats, no branches', async () => {
    openEffectForecastLayer('confirm');
    const {wrapper} = mountUnderHost({host: 'confirm'});
    await nextTick();
    const explorer = wrapper.findComponent(ExplorerStub);
    expect(explorer.props('operation')).to.eq('action');
    expect(explorer.props('color')).to.eq('');
    expect(explorer.props('cards')).to.deep.eq([]);
    expect(explorer.props('players')).to.deep.eq([]);
    expect(explorer.props('statsByColor')).to.deep.eq({});
    expect(explorer.props('branches')).to.deep.eq([]);
    expect(explorer.props('explorerUi')).to.eq(forecastExplorerUi('confirm'));
  });

  it('a PARENT\'s ref sees exactly `consumeBack` and `handleIntent` — both forwarded to the explorer while it stands', async () => {
    const {reach} = mountUnderHost({host: 'hydro'});
    const layer = reach();
    expect(layer, 'the host\'s ref stands (the layer is a component even while it renders nothing)').to.not.eq(undefined);
    expect(Object.keys(layer!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['consumeBack', 'handleIntent']);
    for (const inner of ['explorer', 'open', 'ui', 'props']) {
      expect((layer as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // Closed: no explorer to ask — nothing to fold (the host closes the layer), a press goes nowhere.
    expect(layer!.consumeBack()).to.eq(false);
    layer!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    expect(asked).to.deep.eq([]);

    openEffectForecastLayer('hydro');
    await nextTick();
    expect(layer!.consumeBack(), 'the explorer had nothing to fold').to.eq(false);
    folds = true;
    expect(layer!.consumeBack(), 'the explorer folded its dossier').to.eq(true);
    layer!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    layer!.handleIntent({kind: 'press', button: 'confirm'});
    expect(asked).to.deep.eq(['back', 'back', 'nav:down', 'press']);
  });
});
