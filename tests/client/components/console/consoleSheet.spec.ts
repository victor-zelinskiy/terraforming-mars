/*
 * ConsoleSheet — the generic bottom sheet of the console shell (basic actions / standard projects / card actions / the
 * hydro pick). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its three
 * props, and the two things its watchers ask of the scroll area its list stands in — the row under the cursor kept in
 * view (R11: a STRING ref key bound dynamically inside `v-for`, «the row that carries the key», and a ref named like
 * the prop `rows`), the list back at its top when the sheet is re-titled. It exposes nothing: the shell stands no ref
 * on it.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleSheet from '@/client/components/console/ConsoleSheet.vue';
import type {ConsoleSheetRow} from '@/client/components/console/consoleSheetTypes';

const ROWS: ReadonlyArray<ConsoleSheetRow> = [
  {key: 'group', kind: 'header', title: 'Projects', available: true},
  {key: 'power', icon: 'std-icon--power', title: 'Power Plant', sub: 'Increase your energy production 1 step', meta: '11 M€', available: true},
  {key: 'asteroid', title: 'Asteroid', available: false, reason: 'Not enough M€'},
  {key: 'city', title: 'City', available: true, takenBy: {color: 'red', name: 'Ada'}},
];

/** What the sheet asked of its scroll area, in order. */
type ScrollCalls = {ensured: Array<Element | null | undefined>, toStart: number};

// The scroll area is a primitive with a spec of its own; this one is about what the SHEET asks of it. The stand-in
// renders the slot inside the content wrapper the sheet names and exposes the two functions the sheet reads through
// its `ref="rows"`. (A render function, not a template string: the runtime compiler is not in this build.)
function scrollAreaStub(calls: ScrollCalls) {
  return defineComponent({
    name: 'ConsoleScrollArea',
    props: {contentClass: {type: String, default: ''}},
    setup(props, {slots, expose}) {
      expose({
        ensureVisible: (el: Element | null | undefined) => {
          calls.ensured.push(el);
        },
        scrollToStart: () => {
          calls.toStart++;
        },
      });
      return () => h('div', {class: 'scroll-stub'}, [h('div', {class: props.contentClass}, slots.default?.())]);
    },
  });
}

function mountSheet(props: {title: string, rows: ReadonlyArray<ConsoleSheetRow>, index: number}) {
  const calls: ScrollCalls = {ensured: [], toStart: 0};
  const wrapper = mount(ConsoleSheet, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsoleScrollArea: scrollAreaStub(calls), GamepadGlyph: true}},
  });
  return {wrapper, calls};
}

describe('ConsoleSheet — the console\'s bottom sheet', () => {
  it('renders its title, a caption per header and a row per entry — the cursor\'s row marked, a refused row with its reason', () => {
    const {wrapper} = mountSheet({title: 'Standard projects', rows: ROWS, index: 1});

    expect(wrapper.classes()).to.include.members(['con-sheet', 'con-ws']);
    expect(wrapper.attributes('role')).to.eq('dialog');
    expect(wrapper.attributes('aria-label')).to.eq('Standard projects');
    expect(wrapper.attributes('data-motion-surface')).to.eq('sheet');
    expect(wrapper.find('.con-sheet__panel[data-motion-panel] > .con-sheet__head > .con-sheet__title').text()).to.eq('Standard projects');
    expect(wrapper.find('.scroll-stub').classes(), 'the scroll area is the list\'s host').to.contain('con-sheet__scroll-host');

    expect(wrapper.findAll('.con-sheet__rows > .con-sheet__group').map((g) => g.text())).to.deep.eq(['Projects']);
    const rows = wrapper.findAll('.con-sheet__rows > .con-sheet__row');
    expect(rows.map((r) => r.find('.con-sheet__row-title').text())).to.deep.eq(['Power Plant', 'Asteroid', 'City']);
    expect(rows.map((r) => r.classes().includes('con-sheet__row--selected')), 'the cursor').to.deep.eq([true, false, false]);
    expect(rows.map((r) => r.classes().includes('con-sheet__row--disabled')), 'the refused row').to.deep.eq([false, true, false]);
    expect(rows.map((r) => r.find('.con-sheet__a').exists()), 'the confirm glyph rides the cursor\'s row').to.deep.eq([true, false, false]);

    expect(rows[0].find('i.con-sheet__row-icon').classes()).to.contain('std-icon--power');
    expect(rows[0].find('.con-sheet__row-meta').text()).to.eq('11 M€');
    expect(rows[0].find('.con-sheet__row-sub').text()).to.eq('Increase your energy production 1 step');
    expect(rows[0].find('.con-sheet__row-reason').exists(), 'an available row names no reason').to.eq(false);

    expect(rows[1].find('.con-sheet__row-reason').text()).to.eq('Not enough M€');
    expect(rows[1].find('.con-sheet__row-icon').exists()).to.eq(false);

    expect(rows[2].find('.con-sheet__row-taken').text()).to.eq('Ada');
    expect(rows[2].find('.con-sheet__row-taken > span').classes()).to.include.members(['con-status__dot', 'player_bg_color_red']);
  });

  it('a d-pad step hands the row NOW under the cursor to the scroll area — the node that carries the ref, after the re-render', async () => {
    const {wrapper, calls} = mountSheet({title: 'Standard projects', rows: ROWS, index: 1});
    expect(calls.ensured, 'standing still asks for nothing').to.deep.eq([]);

    await wrapper.setProps({index: 3});
    await flushPromises();

    const selected = wrapper.findAll('.con-sheet__row--selected');
    expect(selected.map((r) => r.find('.con-sheet__row-title').text())).to.deep.eq(['City']);
    expect(calls.ensured.length).to.eq(1);
    expect(calls.ensured[0], 'the row\'s own node, not the one the cursor left').to.eq(selected[0].element);

    // A refused row under the cursor is still the cursor's row — kept in view, with no confirm glyph on it.
    await wrapper.setProps({index: 2});
    await flushPromises();
    const refused = wrapper.find('.con-sheet__row--selected');
    expect(refused.find('.con-sheet__row-title').text()).to.eq('Asteroid');
    expect(refused.find('.con-sheet__a').exists()).to.eq(false);
    expect(calls.ensured.length).to.eq(2);
    expect(calls.ensured[1]).to.eq(refused.element);

    // No row carries the ref (the index stands on a caption): the scroll area is asked with nothing — never a stale node.
    await wrapper.setProps({index: 0});
    await flushPromises();
    expect(wrapper.find('.con-sheet__row--selected').exists()).to.eq(false);
    expect(calls.ensured.length).to.eq(3);
    expect(calls.ensured[2]).to.eq(undefined);
    expect(calls.toStart, 'a step never resets the list').to.eq(0);
  });

  it('a re-titled sheet (a tab switch) sends the list back to its top', async () => {
    const {wrapper, calls} = mountSheet({title: 'Standard projects', rows: ROWS, index: 1});
    expect(calls.toStart, 'the first title is no switch').to.eq(0);

    await wrapper.setProps({title: 'Card actions'});
    await flushPromises();

    expect(calls.toStart).to.eq(1);
    expect(calls.ensured, 'the cursor did not move').to.deep.eq([]);
    expect(wrapper.find('.con-sheet__title').text()).to.eq('Card actions');
    expect(wrapper.attributes('aria-label')).to.eq('Card actions');
  });

  it('a parent\'s ref reaches nothing — the sheet exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleSheet, {ref: 'sheet', title: 'Standard projects', rows: ROWS, index: 1})]),
    });
    const host = mount(Host, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {ConsoleScrollArea: scrollAreaStub({ensured: [], toStart: 0}), GamepadGlyph: true}},
    });
    expect(host.find('.con-sheet').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.sheet ?? {}) as object), 'rows are data; the shell drives it by props alone').to.deep.eq([]);
  });
});
