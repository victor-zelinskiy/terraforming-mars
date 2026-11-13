/*
 * ConsoleStdProjectsScreen — the console's STANDARD PROJECTS workspace (the dashboard of basic actions, the focused
 * project's foot, the zone a hosted step teleports into, the R3 «Эффекты» layer). A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md). A unit spec of a surface this size pins what the conversion could break, not the
 * flow (its e2e does that): it mounts in an honest state without a warning (`globalConfig` turns one into a failure);
 * the shell's controllers reach exactly three members through the surface registry's ref — `armStepOrigin`,
 * `forecastIntent`, `openForecastLayer` (R11); the row under the cursor is found through the string ref it alone
 * carries inside `v-for`, and the root through its own ref (R12 — the layer's door is looked up under it).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, reactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {StdProjectItem} from '@/client/console/consoleQuickModel';
import {effectForecastOpen, resetEffectForecastUi} from '@/client/console/consoleEffectForecast';
import {resetForecastFocusMotion} from '@/client/console/consoleForecastFocusMotion';
import {resetOutcomeOrigin} from '@/client/console/consoleActionOutcomeMotion';
import {resetStdProjectCommit} from '@/client/console/consoleStdProjectCommit';
import {enterWorkspace, resetWorkspaceStack, workspaceFrameSlot} from '@/client/console/consoleWorkspaceStack';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleStdProjectsScreen from '@/client/components/console/ConsoleStdProjectsScreen.vue';

/** What the shell's controllers read through `surfaces.at('stdpScreen')` — the screen's whole contract with them. */
type ScreenReach = {armStepOrigin(): void, forecastIntent(intent: GamepadIntent): void, openForecastLayer(): void};

/** The ruling Greens answer a rating step — the one fact that puts a «⚡ сработает» door on the asteroid's foot. */
const GREENS = {
  id: 'greens-tr', source: {kind: 'party', name: 'Greens', owner: 'blue', channel: 'tr-increase'},
  certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate',
  effects: [{direction: 'gain', icon: 'megacredits', amount: 2, current: 0, resulting: 2}],
  reason: 'The Greens pay 2 M€ per TR step you gain',
} as unknown as EffectForecastFact;
const forecastOf = (facts: ReadonlyArray<EffectForecastFact>): EffectForecast =>
  ({facts, discounts: {base: 0, final: 0, items: [], other: 0}, paymentValues: [], coverage: 'complete'});

const ASTEROID: StdProjectItem = {
  key: 'asteroid', cardName: CardName.ASTEROID_STANDARD_PROJECT, title: 'Asteroid', iconClass: 'std-icon--asteroid',
  description: 'Raise temperature 1 step', cost: 11, discount: 3, available: true, reason: '',
  preview: {
    effects: [
      {direction: 'cost', icon: 'megacredits', amount: 11, current: 20, resulting: 9},
      {direction: 'gain', icon: 'temperature', amount: 1, current: -20, resulting: -18},
    ],
    forecast: forecastOf([GREENS]),
  },
};
const CITY: StdProjectItem = {
  key: 'city', cardName: CardName.CITY_STANDARD_PROJECT, title: 'City', iconClass: 'std-icon--city',
  description: 'Place a city tile', cost: 25, available: false, reason: 'Need ${0} more M€', reasonParams: ['5'],
};
const GREENERY: StdProjectItem = {
  key: 'greenery', cardName: CardName.GREENERY_STANDARD_PROJECT, title: 'Greenery', iconClass: 'std-icon--greenery',
  description: 'Place a greenery tile', cost: 20, available: true, reason: '',
  preview: {effects: [], target: 'space'},
};
const PATENTS: StdProjectItem = {
  key: 'sell-patents', cardName: CardName.SELL_PATENTS_STANDARD_PROJECT, title: 'Patent sale', iconClass: 'std-icon--patents',
  description: 'Discard cards for M€', gain: '+1', available: true, reason: '',
};
const ITEMS: ReadonlyArray<StdProjectItem> = [ASTEROID, CITY, GREENERY, PATENTS];

/** What the screen asked of the scroll area its grid stands in, in order. */
type ScrollCalls = {ensured: Array<Element | null | undefined>};

// The scroll area is a primitive with a spec of its own; here only what the SCREEN asks of it through `ref="grid"` is
// the subject. (A render function, not a template string: the runtime compiler is not in this build.)
function scrollAreaStub(calls: ScrollCalls) {
  return defineComponent({
    name: 'ConsoleScrollArea',
    props: {contentClass: {type: String, default: ''}},
    setup(props, {slots, expose}) {
      expose({
        ensureVisible: (el: Element | null | undefined) => {
          calls.ensured.push(el);
        },
      });
      return () => h('div', {class: 'scroll-stub'}, [h('div', {class: props.contentClass}, slots.default?.())]);
    },
  });
}

/** What the layer's explorer was asked through the screen's `forecastIntent`, in order. */
const asked: Array<string> = [];
// The explorer is the composers' (its own specs); the layer forwards the screen's input to it.
const ExplorerStub = defineComponent({
  name: 'ConsoleEffectsExplorer',
  methods: {
    consumeEffectsBack(): boolean {
      asked.push('back');
      return false;
    },
    handleIntent(intent: GamepadIntent): void {
      asked.push(intent.kind === 'nav' ? 'nav:' + intent.dir : intent.kind);
    },
  },
  render() {
    return h('i', {class: 'explorer-stub'});
  },
});

type ScreenProps = {items: ReadonlyArray<StdProjectItem>, index: number, myMegacredits: number, stepUp?: boolean};

/** The screen as the shell stands it: under a parent that holds a ref on it (the surface registry binds one). */
function mountUnderHost(initial: Partial<ScreenProps> = {}) {
  const calls: ScrollCalls = {ensured: []};
  const props = reactive<ScreenProps>({items: ITEMS, index: 0, myMegacredits: 20, ...initial});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleStdProjectsScreen, {ref: 'stdpScreen', ...props})]),
  });
  const host = mount(Host, {
    global: {...globalConfig.global, stubs: {ConsoleScrollArea: scrollAreaStub(calls), ConsoleEffectsExplorer: ExplorerStub}},
  });
  return {
    host,
    props,
    calls,
    screen: host.findComponent(ConsoleStdProjectsScreen),
    reach: () => (host.vm.$refs.stdpScreen ?? undefined) as ScreenReach | undefined,
  };
}

describe('ConsoleStdProjectsScreen — the standard projects workspace', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    // No translation table: the English key is the text (and a missing key logs nothing) — whatever an earlier spec
    // of the bundle left standing.
    originalTranslations = (window as any)._translations;
    (window as any)._translations = undefined;
    asked.length = 0;
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
    resetEffectForecastUi();
    resetForecastFocusMotion();
    resetOutcomeOrigin();
    resetStdProjectCommit();
    resetWorkspaceStack();
  });

  it('mounts its dashboard: a card per project — the cursor\'s one focused, a refused one off, the price with its discount, the sale\'s gain', () => {
    const {screen} = mountUnderHost();

    expect(screen.classes()).to.include.members(['con-stdp', 'con-ws', 'con-ws--dockcover']);
    expect(screen.attributes('role')).to.eq('dialog');
    expect(screen.attributes('aria-label')).to.eq('Standard Projects');
    expect(screen.attributes('data-motion-surface')).to.eq('std-projects');
    expect(screen.findComponent(ConsoleWsHead).props('root'), 'the ONE workspace header, the crumb\'s root').to.eq('Standard Projects');

    const cards = screen.findAll('.scroll-stub > .con-stdp__grid > .con-stdp__card');
    expect(cards.map((c) => c.attributes('data-stdp-card'))).to.deep.eq(ITEMS.map((it) => it.cardName));
    expect(cards.map((c) => c.find('.con-stdp__name').text())).to.deep.eq(['Asteroid', 'City', 'Greenery', 'Patent sale']);
    expect(cards.map((c) => c.classes().includes('con-stdp__card--focused')), 'the cursor').to.deep.eq([true, false, false, false]);
    expect(cards.map((c) => c.classes().includes('con-stdp__card--go')), 'live rows').to.deep.eq([true, false, true, true]);
    expect(cards.map((c) => c.classes().includes('con-stdp__card--off')), 'the refused row').to.deep.eq([false, true, false, false]);

    expect(cards[0].find('.con-stdp__cost > b').text()).to.eq('11');
    expect(cards[0].find('.con-stdp__cost').classes()).to.include('con-stdp__cost--discounted');
    expect(cards[0].find('.con-stdp__cost-delta').text(), 'the saving already folded into the price').to.eq('−3');
    expect(cards[1].find('.con-stdp__cost').classes(), '25 M€ against a purse of 20').to.include('con-stdp__cost--short');
    expect(cards[1].find('.con-stdp__cost-delta').exists()).to.eq(false);
    expect(cards[3].find('.con-stdp__cost').exists(), 'the sale has no price').to.eq(false);
    expect(cards[3].find('.con-stdp__gain > b').text()).to.eq('+1');

    // The zone a hosted step teleports into is ALWAYS there, down while no step stands.
    const zone = screen.find('.con-stdp__step[data-embed-slot="stdp-step"][data-outcome-zone]');
    expect(zone.exists()).to.eq(true);
    expect(zone.classes()).to.not.include('con-stdp__step--up');
    expect(screen.find('.con-stdp__browse').classes()).to.not.include('con-stdp__browse--parked');
  });

  it('the foot reads the FOCUSED project: its whole transaction in chips, a blocker in its own words, the step that follows the press', async () => {
    const {screen, props} = mountUnderHost();
    const foot = () => screen.find('.con-stdp__foot > .con-stdp__context');

    expect(foot().classes()).to.include('con-stdp__context--ready');
    expect(foot().find('.con-stdp__context-name').text()).to.eq('Asteroid');
    expect(foot().findAll('.con-stdp__context-chips > *'), 'the M€ chip and the scale\'s — one row').to.have.lengthOf(2);
    expect(foot().find('.con-stdp__context-state').exists(), 'chips speak, no «ready» filler beside them').to.eq(false);

    props.index = 1;
    await flushPromises();
    expect(foot().classes()).to.include('con-stdp__context--blocked');
    expect(foot().find('.con-stdp__context-state').text(), 'the reason with its params').to.eq('Need 5 more M€');
    expect(foot().find('.con-stdp__context-chips').exists()).to.eq(false);

    props.index = 2;
    await flushPromises();
    expect(foot().find('.con-stdp__context-state').text()).to.eq('Ready to use now');
    expect(foot().find('.con-stdp__context-next').text()).to.eq('› Next: choose a location on the board.');

    props.index = 3;
    await flushPromises();
    expect(foot().find('.con-stdp__context-next').text(), 'the sale is a client pre-select — the rail names the step').to.eq('› Next: choose the cards to sell.');
  });

  it('a cursor step hands the row NOW under the cursor to the scroll area — the one node that carries the ref', async () => {
    const {screen, props, calls} = mountUnderHost();
    expect(calls.ensured, 'standing still asks for nothing').to.deep.eq([]);

    props.index = 2;
    await flushPromises();
    const focused = screen.findAll('.con-stdp__card--focused');
    expect(focused.map((c) => c.attributes('data-stdp-card'))).to.deep.eq([CardName.GREENERY_STANDARD_PROJECT]);
    expect(calls.ensured).to.have.lengthOf(1);
    expect(calls.ensured[0], 'the row\'s own node, not the one the cursor left').to.eq(focused[0].element);

    props.index = 3;
    await flushPromises();
    expect(calls.ensured).to.have.lengthOf(2);
    expect(calls.ensured[1]).to.eq(screen.find('.con-stdp__card--focused').element);
  });

  it('a hosted step PARKS the browse layer and raises the zone — the same nodes, never a swap', async () => {
    const {screen, props} = mountUnderHost();
    const browse = screen.find('.con-stdp__browse').element;
    const zone = screen.find('[data-outcome-zone]').element as HTMLElement;

    props.stepUp = true;
    await flushPromises();
    expect(screen.find('.con-stdp__browse').classes()).to.include('con-stdp__browse--parked');
    expect(screen.find('.con-stdp__browse').attributes('aria-hidden')).to.eq('true');
    expect(screen.find('.con-stdp__step').classes()).to.include('con-stdp__step--up');

    // The fold back clears whatever an episode left on the zone (found under the screen's own root).
    zone.style.opacity = '0.4';
    props.stepUp = false;
    await flushPromises();
    expect(zone.style.opacity, 'the zone\'s inline motion props are gone').to.eq('');
    expect(screen.find('.con-stdp__browse').element, 'the browse layer never re-mounted').to.eq(browse);
    expect(screen.find('.con-stdp__browse').attributes('aria-hidden')).to.eq(undefined);
  });

  it('publishes its step zone to the workspace stack while it stands and retracts it when it leaves (embed rule 4)', () => {
    enterWorkspace('standard-projects');
    expect(workspaceFrameSlot('standard-projects')).to.eq('');
    const {host} = mountUnderHost();
    expect(workspaceFrameSlot('standard-projects')).to.eq('.con-stdp [data-embed-slot="stdp-step"]');
    host.unmount();
    expect(workspaceFrameSlot('standard-projects')).to.eq('');
  });

  // R11: the parent's ref reaches ONLY what the screen exposes. Asserted through a host's ref — `wrapper.vm` sees the
  // whole setup state and would stay green with the list missing.
  it('a PARENT\'s ref sees exactly `armStepOrigin`, `forecastIntent` and `openForecastLayer` — the controllers\' three reads', async () => {
    const {host, screen, reach} = mountUnderHost();
    const stdp = reach();
    expect(stdp, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(stdp!).sort(), 'the exposed list is the contract — nothing else of the script')
      .to.deep.eq(['armStepOrigin', 'forecastIntent', 'openForecastLayer']);
    for (const inner of ['focused', 'forecastCanOpen', 'forecastPulse', 'rowFutile', 'chipKey', 'props']) {
      expect((stdp as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // `openForecastLayer()` — the pad router's R3: the door flares, the layer stands INSIDE the workspace, the crumb
    // gains «ЭФФЕКТЫ» as a composed (raw) tail.
    expect(screen.find('[data-forecast-row]').exists(), 'the Greens answer the asteroid — the door is drawn').to.eq(true);
    expect(screen.find('[data-forecast-layer]').exists(), 'closed until the press').to.eq(false);
    stdp!.openForecastLayer();
    await flushPromises();
    expect(effectForecastOpen('stdp'), 'the ONE fact everybody reads').to.eq(true);
    expect(screen.find('[data-forecast-host] [data-forecast-layer] .explorer-stub').exists(), 'the explorer in the workspace\'s own box').to.eq(true);
    expect(screen.find('[data-forecast-row]').classes(), 'the door\'s one-shot flare').to.include('con-forecast--descend');
    expect(screen.findComponent(ConsoleWsHead).props('stage')).to.eq('Effects');
    expect(screen.findComponent(ConsoleWsHead).props('stageRaw')).to.eq(true);

    // `forecastIntent(intent)` — the pad router's input while the layer is open: the explorer's first (through the
    // screen's own ref on the layer), B folds the layer once the explorer has nothing of its own to fold.
    stdp!.forecastIntent({kind: 'nav', dir: 'down', repeat: false});
    expect(asked, 'a d-pad step is the explorer\'s').to.deep.eq(['nav:down']);
    stdp!.forecastIntent({kind: 'press', button: 'back'});
    await flushPromises();
    expect(asked, 'B asks the explorer first').to.deep.eq(['nav:down', 'back']);
    expect(effectForecastOpen('stdp'), 'B folds the layer, never the workspace').to.eq(false);
    expect(screen.find('[data-forecast-layer]').exists()).to.eq(false);
    expect(screen.findComponent(ConsoleWsHead).props('stage'), 'the tail is given back').to.eq('');
    expect(host.findComponent(ConsoleStdProjectsScreen).exists()).to.eq(true);

    // `armStepOrigin()` — the std-projects controller's arm at the press: it measures the row under the cursor.
    let measured = 0;
    const focused = screen.find('.con-stdp__card--focused').element as HTMLElement;
    const others = screen.findAll('.con-stdp__card').filter((c) => !c.classes().includes('con-stdp__card--focused'));
    focused.getBoundingClientRect = () => {
      measured++;
      return {left: 10, top: 20, width: 300, height: 80, right: 310, bottom: 100, x: 10, y: 20, toJSON: () => ({})};
    };
    for (const other of others) {
      (other.element as HTMLElement).getBoundingClientRect = () => {
        throw new Error('only the focused row is the descend\'s origin');
      };
    }
    stdp!.armStepOrigin();
    expect(measured, 'the focused row\'s rect, once').to.eq(1);
  });

  it('the layer lives on the browse level only: a cursor step folds it, a hosted step silences R3, and it dies with the workspace', async () => {
    const {host, props, reach} = mountUnderHost();
    reach()!.openForecastLayer();
    await flushPromises();
    expect(effectForecastOpen('stdp')).to.eq(true);

    // The cursor moved to another project — its answer is another forecast.
    props.index = 2;
    await flushPromises();
    expect(effectForecastOpen('stdp'), 'a focus move folds it').to.eq(false);
    reach()!.openForecastLayer();
    await flushPromises();
    expect(effectForecastOpen('stdp'), 'nothing answers the greenery — no door, no layer').to.eq(false);

    props.index = 0;
    props.stepUp = true;
    await flushPromises();
    reach()!.openForecastLayer();
    expect(effectForecastOpen('stdp'), 'R3 is silent under a hosted step').to.eq(false);

    props.stepUp = false;
    await flushPromises();
    reach()!.openForecastLayer();
    expect(effectForecastOpen('stdp')).to.eq(true);
    host.unmount();
    expect(effectForecastOpen('stdp'), 'the unmount closes it').to.eq(false);
  });
});
