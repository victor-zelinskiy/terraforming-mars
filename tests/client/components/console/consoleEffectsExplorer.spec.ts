import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {createEffectsExplorerUi, EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {EFFECT_FAMILY_ORDER} from '@/client/console/effectsExplorerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

/*
 * THE EXPLORER AS ITS HOSTS HOLD IT. `ConsoleEffectsExplorer` is `<script setup>` (step A of
 * docs/claude/vapor/RECIPES.md): a parent's template ref of it is ONLY what it `defineExpose`s (§ R11) — and its five
 * hosts reach it exactly so: `handleIntent` (every intent while the explorer is up) and `consumeEffectsBack` (B asks
 * the explorer before the host's own back). This spec is that contract and the surface's own lifecycle — the cursor
 * its immediate watcher seeds, the bar it publishes on the host's `EffectsExplorerUi` and takes back, the dossier a
 * seat switch drops. What the two modes RENDER stands in `ConsoleEffectsExplorerPolitical.spec.ts` (the grid, the
 * detail layer) and `ConsoleEffectsExplorerDiscount.spec.ts` (the forecast tiles).
 *
 * `globalConfig` turns every Vue warning into a throw, so each mount below is also «it mounts without a warning».
 */
const BLUE = 'blue';
const PETS = {name: CardName.PETS, resources: 2} as CardModel;

function explorerProps(ui: EffectsExplorerUi, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {cards: [PETS], color: BLUE, stats: [], explorerUi: ui, ...over};
}

function mountExplorer(ui: EffectsExplorerUi, over: Record<string, unknown> = {}) {
  return mount(ConsoleEffectsExplorer as any, {global: globalConfig.global, props: explorerProps(ui, over)});
}

/** What a host's ref of the explorer carries. */
type ExplorerReach = {handleIntent(intent: GamepadIntent): void, consumeEffectsBack(): boolean};

/** The explorer under a PARENT that holds a ref to it — what that ref carries is what a host's `$refs` does. */
function underParent() {
  const ui = createEffectsExplorerUi();
  const held = shallowRef<ExplorerReach | null>(null);
  const Parent = defineComponent({
    name: 'EffectsExplorerParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleEffectsExplorer as never, {...explorerProps(ui), ref: held})]),
  });
  return {wrapper: mount(Parent, {global: globalConfig.global}), held, ui};
}

/** The published bar, by its labels (English i18n keys). */
const bar = (ui: EffectsExplorerUi): Array<string> => (ui.barCommands ?? []).map((c) => c.label);

describe('ConsoleEffectsExplorer — the surface\'s own life, and what a parent reaches through its ref', () => {
  it('mounts over an EMPTY tableau: the empty state, no cursor, its bar published on the host\'s ui — and taken back on unmount', () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui, {cards: []});
    expect(w.classes()).to.contain('con-efx');
    expect(w.classes(), 'the stats mode').to.not.contain('con-efx--forecast');
    expect(w.classes(), 'no work column asked for').to.not.contain('con-efx--column');
    expect(w.find('.con-efx__empty-title').text()).to.eq('No passive effects');
    expect(w.find('.con-efx__empty-filters').exists(), 'nothing is hidden — there is nothing').to.eq(false);
    expect(w.find('[data-effect-key]').exists()).to.eq(false);
    expect(w.find('.con-efx__stage').exists(), 'the detail layer is not standing').to.eq(false);
    expect(ui.focusKey).to.eq('');
    expect(bar(ui), 'no «Open» over an empty grid').to.deep.eq(['Players', 'To overview', 'Close']);
    w.unmount();
    expect(ui.barCommands, 'the bar is the host\'s again').to.eq(undefined);
  });

  it('seeds the cursor on the first tile BEFORE the first render, and offers «Open»', () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui);
    const keys = w.findAll('[data-effect-key]').map((t) => t.attributes('data-effect-key'));
    expect(keys.length, 'the card\'s effect is a tile').to.be.greaterThan(0);
    expect(ui.focusKey).to.eq(keys[0]);
    expect(w.find('.con-efx__tile--focused').attributes('data-effect-key'), 'the first frame already wears the cursor').to.eq(keys[0]);
    expect(w.find('.con-efx__detail-name').text(), 'the dossier column names the focused source').to.eq(CardName.PETS);
    expect(bar(ui)).to.deep.eq(['Players', 'Open', 'Inspect', 'To overview', 'Close']);
  });

  it('a work column runs one tile per row — the host\'s switch is a class on the root', () => {
    const w = mountExplorer(createEffectsExplorerUi(), {workColumn: true});
    expect(w.classes()).to.contain('con-efx--column');
  });

  it('a facet that hides every tile says so and empties the cursor; R3 resets it and the cursor comes back', async () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui);
    const tiles = w.findAll('[data-effect-key]');
    const key = tiles[0].attributes('data-effect-key');
    expect(ui.focusKey).to.eq(key);
    // A family NO tile of this tableau wears (read off the tiles' own classes — never a guess at the card's rules).
    const worn = EFFECT_FAMILY_ORDER.filter((f) => tiles.some((t) => t.classes().includes('con-efx__tile--fam-' + f)));
    expect(worn.length, 'every tile wears its family').to.be.greaterThan(0);
    const absent = EFFECT_FAMILY_ORDER.find((f) => !worn.includes(f));
    expect(absent, 'one card cannot fill all four families').to.not.eq(undefined);
    ui.familyFilter = absent ?? 'all';
    await nextTick();
    expect(w.find('[data-effect-key]').exists()).to.eq(false);
    expect(w.find('.con-efx__empty-filters').text()).to.eq('Hidden by the active filter');
    expect(ui.focusKey).to.eq('');
    expect(bar(ui)).to.deep.eq(['Players', 'Reset', 'To overview', 'Close']);
    (w.vm as unknown as ExplorerReach).handleIntent({kind: 'press', button: 'stickR'});
    await nextTick();
    expect(ui.familyFilter).to.eq('all');
    expect(ui.focusKey, 'the nearest survivor of where the cursor last stood').to.eq(key);
    expect(bar(ui)).to.deep.eq(['Players', 'Open', 'Inspect', 'To overview', 'Close']);
  });

  it('a PARENT\'s ref sees `consumeEffectsBack` and `handleIntent` — and nothing else', () => {
    const {held} = underParent();
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the explorer exposes').to.deep.eq(['consumeEffectsBack', 'handleIntent']);
    expect(held.value!.consumeEffectsBack).to.be.a('function');
    expect(held.value!.handleIntent).to.be.a('function');
    // Neither a prop nor the explorer's own state is reachable through the ref.
    const leaked = ['cards', 'color', 'explorerUi', 'ui', 'model', 'flatKeys', 'descendKey', 'lastFlatIndex', 'descendFocused', 'dropDetail', 'setFamily', 'scheduleCanvasFit']
      .filter((name) => (held.value as unknown as Record<string, unknown>)[name] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('through the ref: A descends into the dossier, B folds it ONCE — `false` when there is nothing to fold', async () => {
    const {wrapper, held, ui} = underParent();
    const key = ui.focusKey;
    // LB/RB step between the tableau's effects only when there is more than one (the card's own count — read, not assumed).
    const siblings = wrapper.findAll('[data-effect-key]').length > 1 ? ['Other effects'] : [];
    expect(held.value!.consumeEffectsBack(), 'at browse the host\'s own back runs').to.eq(false);
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    await nextTick();
    expect(ui.detail).to.deep.include({cardName: CardName.PETS, effectKey: key});
    expect(wrapper.find('.con-efx__stage').exists(), 'the detail layer stands').to.eq(true);
    expect(wrapper.find('.con-efx__hero').attributes('data-zoom-slot'), 'the hero carries the zoom slot now').to.eq(CardName.PETS);
    expect(wrapper.find('.con-efx__browse').classes(), 'the browse layer parks, never unmounts').to.contain('con-efx__browse--parked');
    expect(wrapper.find('.con-efx__detail-cardwrap').attributes('data-zoom-slot'), 'two slots never carry one key').to.eq(undefined);
    expect(bar(ui), 'the dossier\'s own verbs').to.deep.eq([...siblings, 'Inspect', 'Back', 'Close']);
    expect(held.value!.consumeEffectsBack(), 'the explorer took the B').to.eq(true);
    expect(ui.detail).to.eq(undefined);
    await nextTick();
    expect(wrapper.find('.con-efx__browse').classes()).to.not.contain('con-efx__browse--parked');
    expect(held.value!.consumeEffectsBack()).to.eq(false);
  });

  it('a press on a tile descends too, and a SEAT SWITCH drops the open dossier at once', async () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui);
    await w.find('[data-effect-key]').trigger('click');
    expect(ui.detail, 'the tile\'s own click is the same descent').to.not.eq(undefined);
    expect(w.find('.con-efx__tile--descend').exists(), 'the pressed tile wears the commit pulse').to.eq(true);
    await w.setProps({color: 'red'});
    expect(ui.detail, 'another seat almost never has the same effect').to.eq(undefined);
    expect(w.find('.con-efx__tile--descend').exists()).to.eq(false);
  });
});
