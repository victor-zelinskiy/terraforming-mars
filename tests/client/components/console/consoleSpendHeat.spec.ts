/*
 * ConsoleSpendHeat — Stormcraft's «pay N heat» bill, console-native: two source lanes, a coverage meter, a confirm
 * that is live only on an EXACT cover. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its
 * rules are the pure `budgetLanes` engine's (`compositePrompts.spec.ts`); this spec is the component's own contract:
 * what it renders for its one prop, what it emits, what it publishes to the command bar — and what the shell's pad
 * router reaches through the surface's ref, which is `handleIntent` and nothing else. So the surface is mounted the
 * way the shell holds it: under a host with a ref, and the pad is driven THROUGH that ref.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {consolePanelUi} from '@/client/console/consolePanelUi';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import ConsoleSpendHeat from '@/client/components/console/ConsoleSpendHeat.vue';

/** What the pad router reads through the registry — the surface's whole contract with the shell. */
type SurfaceReach = {handleIntent(intent: GamepadIntent): void};

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const LB: GamepadIntent = {kind: 'press', button: 'bumperL'};
const RB: GamepadIntent = {kind: 'press', button: 'bumperR'};
const RT: GamepadIntent = {kind: 'press', button: 'triggerR'};
const L3: GamepadIntent = {kind: 'press', button: 'stickL'};
const down: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};

/** The prompt exactly as the server builds it: an `and` of two amounts carrying the `spendHeatPrompt` marker. */
function bill(amount: number, heatMax: number, floaterMax: number): PlayerViewModel {
  return {
    id: 'p1',
    waitingFor: {
      type: 'and', title: `Select how to spend ${amount} heat`, buttonLabel: 'Save',
      spendHeatPrompt: {amount},
      options: [
        {type: 'amount', title: 'Heat', buttonLabel: 'Spend heat', min: 0, max: heatMax, maxByDefault: false},
        {type: 'amount', title: 'Floaters', buttonLabel: 'Spend floaters', min: 0, max: floaterMax, maxByDefault: false},
      ],
    },
  } as unknown as PlayerViewModel;
}

/** The same bill asked BY A CARD — the server's source marker rides the prompt's choice context. */
function billOf(source: CardName, amount: number, heatMax: number, floaterMax: number): PlayerViewModel {
  const view = bill(amount, heatMax, floaterMax);
  (view.waitingFor as unknown as Record<string, unknown>).choiceContext = {source: {kind: 'corporation', card: source}};
  return view;
}

// `<console-source-dock>` is the lazy binding of `asyncComponents.ts` — it answers to the wrapper's name, which is the
// stub's key (RECIPES § 3). The stub stands a card face where the real dock stands one.
const DockStub = defineComponent({
  name: 'AsyncComponentWrapper',
  props: {view: {type: Object, required: true}, compact: {type: Boolean, default: false}},
  render: () => h('div', {class: 'con-src'}, [h('div', {class: 'pcard'})]),
});

function mountUnderHost(first: PlayerViewModel) {
  const view = shallowRef(first);
  const submitted: Array<unknown> = [];
  const deferred = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleSpendHeat, {
      ref: 'spendHeat',
      playerView: view.value,
      onSubmit: (response: unknown) => {
        submitted.push(response);
      },
      onDefer: () => {
        deferred.count++;
      },
    })]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: true, AsyncComponentWrapper: DockStub}}});
  return {
    wrapper,
    view,
    submitted,
    deferred,
    reach: (): SurfaceReach => {
      const surface = (wrapper.vm.$refs.spendHeat ?? undefined) as SurfaceReach | undefined;
      if (surface === undefined) {
        throw new Error('the host holds no ref to the surface');
      }
      return surface;
    },
    dials: () => wrapper.findAll('.con-lanes__row').map((row) => row.find('.con-lanes__value').text()),
    focused: () => wrapper.findAll('.con-lanes__row').map((row) => row.classes().includes('con-lanes__row--focused')),
    meter: () => wrapper.find('[data-prompt-meter]').text().replace(/\s+/g, ' '),
  };
}

describe('ConsoleSpendHeat — the «pay N heat» bill', () => {
  afterEach(() => {
    // The L3 zoom is module state — never left open for the next spec.
    closeConsoleCardZoom();
  });

  it('the template starts with its root: a dialog named by the bill, two source lanes with the SERVER\'s caps, the meter at 0 / N', () => {
    const {wrapper, dials, focused, meter} = mountUnderHost(bill(6, 8, 3));
    const root = wrapper.find('.con-heat');
    const host = wrapper.element as Element;
    expect(host.firstElementChild, 'the surface is one element').to.eq(root.element);
    expect(host.childNodes, 'no comment node stands before the root').to.have.length(1);
    expect(root.classes()).to.include.members(['con-lanes', 'con-heat', 'con-ws']);
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq($t('Select how to spend 6 heat'));
    expect(root.attributes('data-motion-surface')).to.eq('spend-heat');
    expect(root.find('.con-prompt-head__category').text()).to.eq($t('Spend heat'));

    expect(root.findAll('.con-lanes__name').map((name) => name.text())).to.deep.eq([$t('Heat'), $t('Floaters')]);
    expect(root.findAll('.con-lanes__of').map((of) => of.text())).to.deep.eq(['/ 8', '/ 3']);
    expect(root.findAll('.con-lanes__note').map((note) => note.text()), 'only the floater lane explains its weight')
      .to.deep.eq([$t('Each floater pays 2 heat')]);
    expect(dials()).to.deep.eq(['0', '0']);
    expect(focused()).to.deep.eq([true, false]);
    expect(meter()).to.eq('0/ 6');
    // No source marker on the prompt — no dock.
    expect(root.find('.con-src').exists()).to.eq(false);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const surface = mountUnderHost(bill(6, 8, 3)).reach();
    expect(Object.keys(surface), 'exactly what the surface exposes').to.deep.eq(['handleIntent']);
    expect(surface.handleIntent).to.be.a('function');
    const leaked = ['picks', 'focusIdx', 'submitting', 'lanes', 'reset', 'confirm', 'step']
      .filter((key) => (surface as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: the dials step and pour, X pays only an exact cover — once — and B defers', async () => {
    const {wrapper, reach, submitted, deferred, dials, focused, meter} = mountUnderHost(bill(6, 8, 3));
    reach().handleIntent(X);
    expect(submitted, 'nothing is covered yet').to.deep.eq([]);

    reach().handleIntent(RB);
    await nextTick();
    expect(dials()).to.deep.eq(['1', '0']);
    expect(wrapper.find('[data-prompt-outcome-item="heat"] .con-prompt-outcome__fromto').text().replace(/\s+/g, ''), 'owned → left').to.eq('8→7');
    reach().handleIntent(LB);
    reach().handleIntent(down);
    reach().handleIntent(RB);
    await nextTick();
    expect(focused()).to.deep.eq([false, true]);
    expect(dials(), 'one floater').to.deep.eq(['0', '1']);
    expect(wrapper.findAll('.con-lanes__pays').map((pays) => pays.text()), 'a floater pays 2 heat').to.deep.eq(['', '2']);
    expect(meter()).to.eq('2/ 6');

    reach().handleIntent(RT);
    await nextTick();
    expect(dials(), 'RT pours the rest onto the focused lane').to.deep.eq(['0', '3']);
    expect(meter()).to.eq('6/ 6');

    reach().handleIntent(X);
    reach().handleIntent(X);
    expect(submitted, 'the `and` in the server\'s own option order — sent ONCE').to.deep.eq([
      {type: 'and', responses: [{type: 'amount', amount: 0}, {type: 'amount', amount: 3}]},
    ]);

    reach().handleIntent(B);
    expect(deferred.count).to.eq(1);
  });

  it('a bill ONE step covers is a radio (A picks the source); a NEW bill resets the dials and re-arms the confirm', async () => {
    const {wrapper, view, reach, submitted, dials, meter} = mountUnderHost(bill(1, 1, 1));
    expect(wrapper.find('.con-lanes__dial').exists(), 'a dial that could only read 0 or 1 is not drawn').to.eq(false);
    reach().handleIntent(A);
    await nextTick();
    expect(wrapper.findAll('.con-lanes__row').map((row) => row.find('.con-lanes__tick').exists())).to.deep.eq([true, false]);
    reach().handleIntent(X);
    expect(submitted).to.deep.eq([{type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 0}]}]);

    view.value = bill(4, 4, 2);
    await nextTick();
    expect(dials(), 'the new bill starts from nothing').to.deep.eq(['0', '0']);
    expect(meter()).to.eq('0/ 4');
    reach().handleIntent(RT);
    reach().handleIntent(X);
    expect(submitted, 'the confirm is live again for the new bill').to.have.length(2);
    expect(submitted[1]).to.deep.eq({type: 'and', responses: [{type: 'amount', amount: 4}, {type: 'amount', amount: 0}]});
  });

  it('a bill asked BY A CARD stands its source dock (the lazy binding, by import) — and L3 opens that card from the dock\'s own face', () => {
    const {wrapper, reach} = mountUnderHost(billOf(CardName.STORMCRAFT_INCORPORATED, 6, 8, 3));
    const dock = wrapper.findComponent(DockStub);
    expect(dock.exists(), 'the tag resolved to the imported binding').to.eq(true);
    expect(dock.props('view')).to.deep.include({card: CardName.STORMCRAFT_INCORPORATED, inspectable: true});
    expect(dock.props('compact')).to.eq(true);
    expect(consolePanelUi.commands.map((command) => command.control), 'the bar gains «Source»').to.include('stickL');

    reach().handleIntent(L3);
    expect(consoleCardZoom.card?.name).to.eq(CardName.STORMCRAFT_INCORPORATED);
    expect(consoleCardZoom.statusLabel).to.eq('Source');
    expect(consoleCardZoom.origin.kind).to.eq('physical');
    // The zoom flies out of the card the dock paints — found through the surface's ref on the dock.
    expect(consoleCardZoom.origin.resolve?.(0)).to.eq(dock.find('.pcard').element);
  });

  it('publishes its verbs to the command bar from the first frame, follows the bill, and takes them back on leave', async () => {
    const {wrapper, reach} = mountUnderHost(bill(6, 8, 3));
    const pay = () => consolePanelUi.commands.find((command) => command.control === 'secondary');
    expect(consolePanelUi.owner).to.eq('spendHeat');
    expect(consolePanelUi.commands.map((command) => command.control)).to.deep.eq(['dpad', 'bumperL', 'bumperR', 'triggerR', 'secondary', 'back']);
    expect(pay()?.enabled, 'nothing covered — «Pay» is dim').to.eq(false);

    reach().handleIntent(RT);
    await nextTick();
    expect(pay()?.enabled, 'covered exactly — «Pay» is live').to.eq(true);

    wrapper.unmount();
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });
});
