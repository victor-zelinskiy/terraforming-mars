/*
 * ConsoleColonyFleetBar — the fleet dock of the colony workspace's header. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its chips — a berth per fleet that never collapses, the viewer's
 * launch anchor, the ship hidden on the berth that is lifting off. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {$t} from '@/client/directives/i18n';
import ConsoleColonyFleetBar from '@/client/components/console/ConsoleColonyFleetBar.vue';

/** The section's chip (the component's own exported type — a `.ts` spec cannot import a named export of a `.vue`). */
type Chip = {color: Color, name: string, free: number, total: number, me: boolean};

// The ship and the pad are SVG leaves with their own specs; this one reads what the bar HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const IconStub = defineComponent({name: 'ColonyFleetIcon', props: {color: String, free: Boolean}, render: () => h('i', {class: 'icon-stub'})});
const PadStub = defineComponent({name: 'ColonyFleetPad', props: {color: String, occupied: Boolean}, render: () => h('i', {class: 'pad-stub'})});

const me: Chip = {color: 'red', name: 'Ada', free: 2, total: 3, me: true};
const rival: Chip = {color: 'blue', name: 'Bo', free: 0, total: 1, me: false};

function fleetBar(props: Record<string, unknown>) {
  return mount(ConsoleColonyFleetBar, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ColonyFleetIcon: IconStub, ColonyFleetPad: PadStub}},
  });
}

describe('ConsoleColonyFleetBar — the fleet dock', () => {
  it('one chip per player in the given order — the viewer marked, a seat with no free fleet marked', () => {
    const w = fleetBar({chips: [me, rival]});
    expect(w.classes()).to.deep.eq(['con-colonies__fleetbar']);
    expect(w.attributes('aria-label')).to.eq($t('Free trade fleets'));
    const chips = w.findAll('.con-colonies__fleetchip');
    expect(chips.map((c) => c.find('.con-colonies__fleetchip-name').text())).to.deep.eq(['Ada', 'Bo']);
    expect(chips.map((c) => c.classes().includes('con-colonies__fleetchip--me'))).to.deep.eq([true, false]);
    expect(chips.map((c) => c.classes().includes('con-colonies__fleetchip--none'))).to.deep.eq([false, true]);
    const docks = w.findAll('.con-colonies__fleetdock');
    expect(docks.map((d) => d.attributes('aria-label'))).to.deep.eq(['2/3', '0/1']);
    expect(docks.map((d) => d.classes().find((c) => c.startsWith('fleet-hue--')))).to.deep.eq(['fleet-hue--red', 'fleet-hue--blue']);
    expect(docks.some((d) => d.classes().includes('con-fleet-launching')), 'nothing is lifting off').to.eq(false);
  });

  it('a berth per fleet that never collapses: a ship on each free one, an empty pad for a fleet that is out', () => {
    const w = fleetBar({chips: [me, rival]});
    const berths = w.findAll('.con-colonies__fleetchip')[0].findAll('.con-colonies__fleetberth');
    expect(berths).to.have.lengthOf(3);
    expect(berths.map((b) => b.classes().includes('con-colonies__fleetberth--empty'))).to.deep.eq([false, false, true]);
    expect(berths.map((b) => b.find('.con-colonies__fleetship').exists()), 'the ship SLOT is always laid out').to.deep.eq([true, true, true]);
    expect(berths.map((b) => b.find('.con-colonies__fleetship .icon-stub').exists())).to.deep.eq([true, true, false]);
    expect(berths.map((b) => b.findComponent(PadStub).props('occupied'))).to.deep.eq([true, true, false]);
    expect(berths.map((b) => b.findComponent(PadStub).props('color'))).to.deep.eq(['red', 'red', 'red']);
    const ship = berths[0].findComponent(IconStub);
    expect(ship.props('color')).to.eq('red');
    expect(ship.props('free')).to.eq(true);

    // The viewer's LAUNCH berth is the last free one — and only the viewer has one.
    expect(berths.map((b) => b.find('.con-colonies__fleetship').attributes('data-fleet-launch'))).to.deep.eq([undefined, '', undefined]);
    const rivalBerths = w.findAll('.con-colonies__fleetchip')[1].findAll('.con-colonies__fleetberth');
    expect(rivalBerths).to.have.lengthOf(1);
    expect(rivalBerths[0].find('.con-colonies__fleetship').attributes('data-fleet-launch')).to.eq(undefined);
    expect(rivalBerths[0].find('.icon-stub').exists()).to.eq(false);
  });

  it('a fleet lifting off: its launch berth hides the ship and keeps the slot — the dock says so, nothing reflows', async () => {
    const w = fleetBar({chips: [me, rival]});
    await w.setProps({launchingColor: 'red'});
    const dock = w.findAll('.con-colonies__fleetdock')[0];
    expect(dock.classes()).to.contain('con-fleet-launching');
    expect(w.findAll('.con-colonies__fleetdock')[1].classes()).to.not.contain('con-fleet-launching');
    const berths = dock.findAll('.con-colonies__fleetberth');
    expect(berths).to.have.lengthOf(3);
    expect(berths.map((b) => b.find('.con-colonies__fleetship .icon-stub').exists()), 'the proxy carries the launching ship').to.deep.eq([true, false, false]);
    expect(berths[1].find('.con-colonies__fleetship').attributes('data-fleet-launch'), 'the anchor stands').to.eq('');
    expect(berths.map((b) => b.findComponent(PadStub).props('occupied')), 'the pad is still the fleet\'s').to.deep.eq([true, true, false]);

    await w.setProps({launchingColor: ''});
    expect(dock.findAll('.con-colonies__fleetship .icon-stub')).to.have.lengthOf(2);
  });

  it('more than six fleets fold into a count — one ship and «free/total»', () => {
    const w = fleetBar({chips: [{...me, free: 5, total: 7}, {...rival, free: 0, total: 8}]});
    expect(w.find('.con-colonies__fleetdock').exists()).to.eq(false);
    const counts = w.findAll('b.con-colonies__fleetchip-count');
    expect(counts.map((c) => c.text())).to.deep.eq(['5/7', '0/8']);
    expect(counts.map((c) => c.findComponent(IconStub).props('free'))).to.deep.eq([true, false]);
    expect(counts.map((c) => c.findComponent(IconStub).props('color'))).to.deep.eq(['red', 'blue']);
  });

  it('the template STARTS WITH ITS ROOT — what the section lets fall through lands on the bar itself', () => {
    const w = mount(ConsoleColonyFleetBar, {
      ...globalConfig,
      props: {chips: [me]},
      attrs: {'class': 'from-host', 'data-from-host': 'yes'},
      global: {...globalConfig.global, stubs: {ColonyFleetIcon: IconStub, ColonyFleetPad: PadStub}},
    });
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-colonies__fleetbar', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
