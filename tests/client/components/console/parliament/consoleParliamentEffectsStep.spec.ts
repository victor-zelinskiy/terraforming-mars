import {mount} from '@vue/test-utils';
import {defineComponent, h, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {$t} from '@/client/directives/i18n';
import {createEffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import ConsoleParliamentEffectsStep from '@/client/components/console/parliament/ConsoleParliamentEffectsStep.vue';

/*
 * THE STEP AS ITS PARENT HOLDS IT. `ConsoleParliamentEffectsStep` is `<script setup>`: a parent's template ref of it is
 * ONLY what it `defineExpose`s (docs/claude/vapor/RECIPES.md § R11) — and `ConsoleParliamentSection` reaches it exactly
 * so (`$refs.effectsStep.explorer()`, then the explorer's own `handleIntent` / `consumeEffectsBack`). This spec is the
 * step's OWN template and that contract; the two shared surfaces it hosts stand in `../parliamentEffectsStep.spec.ts`
 * with their real output.
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
const GroupStub = {name: 'ConsoleActionGroupView', props: {group: Object, readonly: Boolean}, render: () => h('i', {class: 'group-stub'})};

/** The hosted explorer, reduced to what the section CALLS on it — every call is recorded. */
const calls: Array<string> = [];
const ExplorerStub = defineComponent({
  name: 'ConsoleEffectsExplorer',
  props: {cards: Array, color: String, politicalEntries: Array, explorerUi: Object, workColumn: Boolean},
  methods: {
    handleIntent(intent: {kind: string}): void {
      calls.push('intent:' + intent.kind);
    },
    consumeEffectsBack(): boolean {
      calls.push('back');
      return false;
    },
  },
  render: () => h('i', {class: 'explorer-stub'}),
});

const global = {...globalConfig.global, stubs: {ConsoleActionGroupView: GroupStub, ConsoleEffectsExplorer: ExplorerStub}};

const GROUPS = [{key: 'party:Reds', party: PartyName.REDS}, {key: 'resolution', resolutionParty: PartyName.GREENS}];
const ENTRIES = [{key: 'party:Scientists'}];

function stepProps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {groups: GROUPS, entries: ENTRIES, color: 'blue', zone: 'actions', actionCursor: 0, explorerUi: createEffectsExplorerUi(), ...over};
}

function step(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentEffectsStep as any, {...globalConfig, props: stepProps(over), global});
}

type Explorer = {handleIntent(intent: {kind: string}): void, consumeEffectsBack(): boolean};
type StepRef = {explorer(): Explorer | undefined};

/** The step under a PARENT that holds a ref to it — what that ref carries is what the section's `$refs.effectsStep` does. */
function underParent() {
  const held = shallowRef<StepRef | null>(null);
  const Parent = defineComponent({
    name: 'EffectsStepParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentEffectsStep as never, {...stepProps(), ref: held})]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held};
}

describe('ConsoleParliamentEffectsStep — its own template, and what a parent reaches through its ref', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('one tile per action group — its key, its party, the read-only group view; the head counts them', () => {
    const w = step();
    expect(w.classes()).to.include.members(['con-parl-fxhost', 'con-parl-fxhost--zone-actions']);
    expect(w.classes()).to.not.contain('con-parl-fxhost--no-actions');
    expect(w.attributes('data-parl-effects-step')).to.not.eq(undefined);
    expect(w.attributes('data-parl-effects-zone')).to.eq('actions');
    expect(w.find('.con-parl-fxhost__kicker').text()).to.eq($t('Actions'));
    expect(w.find('.con-parl-fxhost__sum').text()).to.eq('2');
    const tiles = w.findAll('[data-parl-effects-actions] .con-parl-fxhost__tile');
    expect(tiles.map((t) => t.attributes('data-parl-fx-entry'))).to.deep.eq(['party:Reds', 'resolution']);
    expect(tiles.map((t) => t.attributes('data-party')), 'a party action by its party, the law\'s by the resolution\'s').to.deep.eq([PartyName.REDS, PartyName.GREENS]);
    const views = w.findAllComponents(GroupStub);
    expect(views.map((v) => v.props('group'))).to.deep.eq(GROUPS);
    expect(views.every((v) => v.props('readonly') === true), 'the tiles are read-only here').to.eq(true);
    expect(w.find('[data-parl-fx-empty]').exists()).to.eq(false);
  });

  it('a seat with no action says so — and the standing effects still stand', () => {
    const w = step({groups: []});
    expect(w.classes()).to.contain('con-parl-fxhost--no-actions');
    expect(w.find('.con-parl-fxhost__sum').exists()).to.eq(false);
    expect(w.find('.con-parl-fxhost__tile').exists()).to.eq(false);
    expect(w.find('[data-parl-fx-empty="actions"]').text()).to.eq($t('No parliament action is yours'));
    expect(w.find('[data-parl-effects-standing] .explorer-stub').exists()).to.eq(true);
  });

  it('ONE cursor: it marks a tile in the ACTIONS zone only, and follows `actionCursor`', async () => {
    const w = step({actionCursor: 1});
    const focused = () => w.findAll('.con-parl-fxhost__tile--focused').map((t) => t.attributes('data-parl-fx-entry'));
    expect(focused()).to.deep.eq(['resolution']);
    await w.setProps({actionCursor: 0});
    expect(focused()).to.deep.eq(['party:Reds']);
    await w.setProps({zone: 'effects'});
    expect(focused(), 'the explorer owns the cursor now').to.deep.eq([]);
    expect(w.classes()).to.contain('con-parl-fxhost--zone-effects');
    expect(w.attributes('data-parl-effects-zone')).to.eq('effects');
  });

  it('hands the explorer the seat\'s political entries in a work column — and NO cards, the same empty list for its whole life', async () => {
    const explorerUi = createEffectsExplorerUi();
    const w = step({explorerUi});
    const explorer = w.findComponent(ExplorerStub);
    expect(explorer.props('politicalEntries')).to.deep.eq(ENTRIES);
    expect(explorer.props('color')).to.eq('blue');
    expect(explorer.props('explorerUi')).to.eq(explorerUi);
    expect(explorer.props('workColumn')).to.eq(true);
    const cards = explorer.props('cards');
    expect(cards).to.deep.eq([]);
    await w.setProps({zone: 'effects'});
    expect(explorer.props('cards'), 'a re-render hands over the SAME list, never a fresh one').to.eq(cards);
  });

  it('a PARENT\'s ref sees `explorer()` and nothing else', () => {
    const {held} = underParent();
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the step exposes').to.deep.eq(['explorer']);
    expect(held.value!.explorer).to.be.a('function');
    // Neither a prop nor the step's own state is reachable through the ref.
    const leaked = ['groups', 'entries', 'color', 'zone', 'actionCursor', 'explorerUi', 'noCards', 'hostedExplorer', 'handleIntent', 'consumeEffectsBack']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`explorer()` is the HOSTED explorer — the section forwards an intent to it and asks it for B first', () => {
    const {wrapper, held} = underParent();
    const explorer = held.value!.explorer();
    expect(explorer, 'the explorer stands once the step is mounted').to.not.eq(undefined);
    expect(wrapper.find('[data-parl-effects-standing] .explorer-stub').exists()).to.eq(true);
    // What `ConsoleParliamentSection.handleEffectsIntent` does with it in the effects zone.
    explorer!.handleIntent({kind: 'nav'});
    expect(explorer!.consumeEffectsBack(), 'nothing folded — the section closes the step itself').to.eq(false);
    expect(calls).to.deep.eq(['intent:nav', 'back']);
  });

  it('`explorer()` answers `undefined` once the step is gone — never `null`', () => {
    const {wrapper, held} = underParent();
    const explorer = held.value!.explorer;
    wrapper.unmount();
    expect(held.value, 'the parent\'s ref is cleared').to.eq(null);
    expect(explorer()).to.eq(undefined);
  });
});
