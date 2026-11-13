/*
 * ConsoleQuickSelector — the cross layer behind the two triggers (the entries are `consoleQuickModel`'s, spec'd there;
 * every press is the shell's). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders
 * for its props — a tile per entry on its slot, the key cap each control style gives a tile, the armed / focused /
 * blocked poses, an unavailable or futile tile with its reason — and the direction of the trigger swap. It emits
 * nothing and exposes nothing. The two children are stubbed by name. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {QuickEntry, QuickSlot} from '@/client/console/consoleQuickModel';
import {WheelControlMode} from '@/client/console/quickWheel/wheelControlMode';
import ConsoleQuickSelector from '@/client/components/console/ConsoleQuickSelector.vue';

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String as PropType<GlyphControl>, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub'});
  },
});

const IconStub = defineComponent({
  name: 'BarButtonIcon',
  props: {name: {type: String, required: true}},
  render() {
    return h('i', {'class': 'icon-stub'});
  },
});

function entry(id: string, slot: QuickSlot, more: Partial<QuickEntry> = {}): QuickEntry {
  return {id, slot, label: 'Label ' + id, available: true, reason: '', ...more};
}

const CROSS: ReadonlyArray<QuickEntry> = [
  entry('cards', 'center', {barIcon: 'cards', badge: 3, meta: '3 of 7'}),
  entry('actions', 'up', {iconClass: 'ico-actions', badge: 2, badgeTone: 'neutral'}),
  entry('trade', 'right', {glyph: '⇄', available: false, reason: 'No colonies in this game'}),
  entry('heat', 'down', {futile: 'Temperature is at its maximum', meta: '8 heat', badge: 0}),
  entry('vote', 'left', {available: false, soft: true, reason: 'Not your turn', note: 'Rating refused'}),
];

type Props = {
  entries: ReadonlyArray<QuickEntry>,
  title: string,
  trigger: GlyphControl,
  mode?: WheelControlMode,
  focusedSlot?: QuickSlot,
  armedSlot?: QuickSlot,
  armedBlocked?: boolean,
};

function wheelOf(props: Partial<Props> = {}) {
  const all: Props = {entries: CROSS, title: 'Action categories', trigger: 'triggerR', ...props};
  return mount(ConsoleQuickSelector, {
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, BarButtonIcon: IconStub}},
    props: all,
  });
}

describe('ConsoleQuickSelector — the cross behind the triggers', () => {
  it('a tile per entry on its slot, the kicker with the trigger that opened it, and each tile\'s DIRECT activator as its cap', () => {
    const w = wheelOf();
    const root = w.find('div.con-quick.con-ws');
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq('Action categories');
    expect(root.attributes('data-motion-surface')).to.eq('quick');
    expect(w.find('.con-quick__panel').attributes('data-motion-panel')).to.not.eq(undefined);
    expect(w.find('.con-quick__kicker-inner > span').text()).to.eq('Action categories');
    expect(w.findComponent(GlyphStub).props('control'), 'the kicker names the trigger').to.eq('triggerR');
    expect(w.findComponent(GlyphStub).classes()).to.include('con-quick__trigger');

    const slots = w.findAll('.con-quick__cross > .con-quick__slot');
    expect(slots.map((s) => s.attributes('data-quick-id'))).to.deep.eq(['cards', 'actions', 'trade', 'heat', 'vote']);
    expect(slots.map((s) => s.classes().filter((c) => /^con-quick__slot--(center|up|right|down|left)$/.test(c))))
      .to.deep.eq([['con-quick__slot--center'], ['con-quick__slot--up'], ['con-quick__slot--right'], ['con-quick__slot--down'], ['con-quick__slot--left']]);
    expect(slots.map((s) => s.find('.con-quick__slot-label').text()))
      .to.deep.eq(['Label cards', 'Label actions', 'Label trade', 'Label heat', 'Label vote']);
    const caps = w.findAllComponents(GlyphStub).filter((g) => g.classes().includes('con-quick__slot-key'));
    expect(caps.map((g) => g.props('control'))).to.deep.eq(['confirm', 'dpadU', 'dpadR', 'dpadD', 'dpadL']);
    expect(w.find('.con-quick__cross').classes(), 'nothing is armed').to.not.include('con-quick__cross--armed');
    expect(w.find('.con-quick__slot--focus').exists(), 'quick select has no focus cursor').to.eq(false);
  });

  it('a tile\'s body: its icon in one of three forms, the count and its register, the meta — and an unavailable or futile tile says why', () => {
    const w = wheelOf();
    const slot = (id: string) => w.find(`[data-quick-id="${id}"]`);

    expect(w.findComponent(IconStub).props('name'), 'a bar icon by its name').to.eq('cards');
    expect(slot('actions').find('.con-quick__slot-icon > i').classes(), 'a sprite class').to.include('ico-actions');
    expect(slot('trade').find('.con-quick__slot-glyph').text(), 'a text glyph').to.eq('⇄');

    expect(slot('cards').find('.con-quick__slot-badge').text()).to.eq('3');
    expect(slot('cards').find('.con-quick__slot-badge').attributes('data-badge-tone')).to.eq('go');
    expect(slot('actions').find('.con-quick__slot-badge').attributes('data-badge-tone')).to.eq('neutral');
    expect(slot('actions').find('.con-quick__slot-badge').classes()).to.include('con-quick__slot-badge--neutral');
    expect(slot('heat').find('.con-quick__slot-badge').exists(), 'a zero count is no badge').to.eq(false);
    expect(slot('cards').find('.con-quick__slot-meta').text()).to.eq('3 of 7');

    // UNAVAILABLE: still on the cross, with its reason; a temporary blocker keeps more presence.
    expect(slot('trade').classes()).to.include('con-quick__slot--disabled');
    expect(slot('trade').classes()).to.not.include('con-quick__slot--soft');
    expect(slot('trade').find('.con-quick__slot-reason').text()).to.eq('No colonies in this game');
    expect(slot('vote').classes()).to.include.members(['con-quick__slot--disabled', 'con-quick__slot--soft']);
    expect(slot('vote').find('.con-quick__slot-reason').text()).to.eq('Not your turn');
    expect(slot('vote').find('[data-slot-veto]').exists(), 'a note belongs to a verb that can be pressed').to.eq(false);

    // AVAILABLE and changing nothing: the reason stands where the meta would.
    expect(slot('heat').classes()).to.include('con-quick__slot--futile');
    expect(slot('heat').classes()).to.not.include('con-quick__slot--disabled');
    expect(slot('heat').find('[data-slot-futile]').text()).to.eq('Temperature is at its maximum');
    expect(slot('heat').find('.con-quick__slot-meta').exists()).to.eq(false);
  });

  it('FOCUS & CONFIRM: only the focused tile wears a cap — the confirm; an armed tile is seated, its neighbours yield', async () => {
    const w = wheelOf({mode: 'focus-confirm', focusedSlot: 'up'});
    const caps = () => w.findAllComponents(GlyphStub).filter((g) => g.classes().includes('con-quick__slot-key'));
    const slot = (id: string) => w.find(`[data-quick-id="${id}"]`);

    expect(caps().map((g) => g.props('control'))).to.deep.eq(['confirm']);
    expect(slot('actions').find('.glyph-stub').exists(), 'the cap is the focused tile\'s').to.eq(true);
    expect(slot('actions').classes()).to.include('con-quick__slot--focus');
    expect(slot('cards').classes()).to.not.include('con-quick__slot--focus');

    await w.setProps({armedSlot: 'right', armedBlocked: true});
    expect(w.find('.con-quick__cross').classes()).to.include('con-quick__cross--armed');
    expect(slot('trade').classes()).to.include.members(['con-quick__slot--armed', 'con-quick__slot--armed-blocked']);
    expect(slot('actions').classes(), 'the focus cursor yields to the press').to.not.include('con-quick__slot--focus');
    expect(['cards', 'actions', 'heat', 'vote'].map((id) => slot(id).classes().includes('con-quick__slot--muted'))).to.deep.eq([true, true, true, true]);
    expect(slot('trade').classes()).to.not.include('con-quick__slot--muted');

    // With no focus cursor the armed tile is the one that wears the confirm.
    await w.setProps({focusedSlot: undefined, armedBlocked: false});
    expect(slot('trade').classes()).to.not.include('con-quick__slot--armed-blocked');
    expect(slot('trade').find('.glyph-stub').exists()).to.eq(true);
    expect(caps()).to.have.length(1);
  });

  it('the swap\'s direction follows the pulling trigger: the left one draws the cross in from the left, the right one from the right', async () => {
    const w = wheelOf({trigger: 'triggerL', title: 'Basic actions'});
    const swaps = () => w.findAll('transition-stub').map((t) => t.attributes('name'));
    expect(swaps()).to.deep.eq(['con-quick-swapl', 'con-quick-swapl']);
    expect(w.findComponent(GlyphStub).props('control')).to.eq('triggerL');
    await w.setProps({trigger: 'triggerR', title: 'Action categories'});
    expect(swaps()).to.deep.eq(['con-quick-swapr', 'con-quick-swapr']);
    expect(w.findComponent(GlyphStub).props('control')).to.eq('triggerR');
    expect(w.find('.con-quick__kicker-inner > span').text()).to.eq('Action categories');
  });
});
