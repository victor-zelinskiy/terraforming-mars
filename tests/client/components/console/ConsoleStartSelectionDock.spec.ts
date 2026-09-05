import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleStartSelectionDock from '@/client/components/console/ConsoleStartSelectionDock.vue';
import {CardName} from '@/common/cards/CardName';

/**
 * THE SELECTION DOCK's campaign «НАСЛЕДИЕ» blocks (corporations + carried
 * projects). The regression this pins: the corporation block used to be
 * gated on the MERGE chapter (additional corps > 0), which is false for a
 * mission-2 seat in the wizard (lineage of exactly one, pick unsubmitted) —
 * the scene now feeds the lineage unconditionally, and the dock must render
 * whatever legacy it is given, single corporation included.
 */
function make(props: Record<string, unknown>) {
  return mount(ConsoleStartSelectionDock, {
    props: {piles: [], ...props},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {Card: true, GamepadGlyph: true},
    },
  });
}

describe('ConsoleStartSelectionDock (campaign legacy blocks)', () => {
  it('renders the «НАСЛЕДИЕ» block for a SINGLE-corporation lineage (mission 2)', () => {
    const wrapper = make({lineage: [CardName.THARSIS_REPUBLIC]});
    const tiles = wrapper.findAll('[data-legacy-dock]');
    expect(tiles.length).to.eq(1);
    expect(tiles[0].attributes('data-legacy-dock')).to.eq(CardName.THARSIS_REPUBLIC);
    expect(wrapper.find('.con-startdock__legacy-cap').text()).to.eq('Legacy');
    wrapper.unmount();
  });

  it('renders the carried projects as their OWN block beside the corporations', () => {
    const wrapper = make({
      lineage: [CardName.THARSIS_REPUBLIC],
      carried: [CardName.AI_CENTRAL, CardName.BIRDS],
    });
    const blocks = wrapper.findAll('.con-startdock__legacy');
    expect(blocks.length).to.eq(2);
    const projects = wrapper.find('.con-startdock__legacy--projects');
    expect(projects.exists()).to.be.true;
    expect(projects.find('.con-startdock__legacy-cap').text()).to.eq('Legacy projects');
    expect(projects.findAll('[data-legacy-dock]').length).to.eq(2);
    wrapper.unmount();
  });

  it('carried projects alone still stand the shelf up (no piles, no lineage)', () => {
    const wrapper = make({carried: [CardName.BIRDS]});
    expect(wrapper.find('.con-startdock').exists()).to.be.true;
    expect(wrapper.find('.con-startdock__legacy--projects').exists()).to.be.true;
    wrapper.unmount();
  });

  it('a HELD tile keeps its box but hides its face and stops being a zoom slot (its card is up in the overview)', () => {
    const wrapper = make({
      lineage: [CardName.THARSIS_REPUBLIC, CardName.HELION],
      heldNames: [CardName.HELION],
    });
    const held = wrapper.find(`[data-legacy-dock="${CardName.HELION}"]`);
    expect(held.classes()).to.contain('con-startdock__legacy-card--held');
    // The zoom resolver must find the STAGE seat, never the hidden tile.
    expect(held.attributes('data-zoom-slot')).to.be.undefined;
    const free = wrapper.find(`[data-legacy-dock="${CardName.THARSIS_REPUBLIC}"]`);
    expect(free.classes()).to.not.contain('con-startdock__legacy-card--held');
    expect(free.attributes('data-zoom-slot')).to.eq(CardName.THARSIS_REPUBLIC);
    wrapper.unmount();
  });

  it('a tile click asks for the legacy overview with that card', () => {
    const wrapper = make({lineage: [CardName.THARSIS_REPUBLIC, CardName.HELION]});
    void wrapper.find(`[data-legacy-dock="${CardName.HELION}"]`).trigger('click');
    expect(wrapper.emitted('inspect-lineage')?.[0]).to.deep.eq([CardName.HELION]);
    wrapper.unmount();
  });
});
