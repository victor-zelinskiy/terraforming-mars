import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedStack from '@/client/components/console/played/ConsolePlayedStack.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayedStackLane} from '@/client/components/console/consolePlayedModel';

/**
 * ONE TABLE STACK of the «Разыграно» table (the owner, 2026-10-19 — «одна страница, настольные стопки»): a zone's cards
 * as a CASCADE per lane — every covered card shows its title band, the newest lies whole in front — every slot carrying
 * its [data-played-key] / [data-zoom-slot] identity (the landing, the flights and the inspector measure them).
 */

const ZONE: Array<CardName> = [CardName.TREES, CardName.GRASS, CardName.HEATHER, CardName.LICHEN, CardName.FARMING];

function cards(names: Array<CardName>): Array<CardModel> {
  return names.map((n) => ({name: n}) as CardModel);
}

type Props = Partial<{cards: Array<CardModel>, lanes: Array<PlayedStackLane>, hiddenKey: string | undefined, outNames: ReadonlySet<string>,
  grounded: ReadonlySet<string>, live: boolean}>;

function make(props: Props = {}) {
  return mount(ConsolePlayedStack, {
    props: {
      cards: cards(ZONE),
      lanes: [{start: 0, count: 3}, {start: 3, count: 2}],
      zoom: 0.6, slotW: 192, slotH: 276, peek: 45, laneGap: 10,
      ...props,
    },
  });
}

describe('ConsolePlayedStack — a cascade per lane', () => {
  it('every card is a premium face in its own slot, keyed for the flights; lanes hold contiguous runs', () => {
    const wrapper = make();
    const lanes = wrapper.findAll('.con-played__lane');
    expect(lanes.length).to.eq(2);
    expect(lanes[0].findAll('[data-played-key]').map((s) => s.attributes('data-played-key'))).to.deep.eq([CardName.TREES, CardName.GRASS, CardName.HEATHER]);
    expect(lanes[1].findAll('[data-played-key]').map((s) => s.attributes('data-played-key'))).to.deep.eq([CardName.LICHEN, CardName.FARMING]);
    for (const name of ZONE) {
      const slot = wrapper.find(`[data-played-key="${name}"]`);
      expect(slot.attributes('data-zoom-slot')).to.eq(name);
      expect(slot.attributes('style')).to.include('width: 192px');
      expect(slot.find('.con-played__face').attributes('style')).to.include('zoom: 0.6');
      expect(slot.find('.pcard').exists(), 'the real premium face').to.be.true;
    }
    wrapper.unmount();
  });

  it('the cascade: each card one band below the one before, the later card above it; the lane is its front face + the bands', () => {
    const wrapper = make();
    const lane = wrapper.findAll('.con-played__lane')[0];
    expect(lane.attributes('style')).to.include(`height: ${276 + 2 * 45}px`);
    const slots = lane.findAll('.con-played__slot');
    expect(slots.map((s) => s.attributes('style')?.match(/top: (\d+)px/)?.[1])).to.deep.eq(['0', '45', '90']);
    expect(slots.map((s) => s.attributes('style')?.match(/z-index: (\d+)/)?.[1])).to.deep.eq(['1', '2', '3']);
    // The FRONT of each lane is its last card — the newest of the zone closes the LAST lane.
    expect(slots[2].classes()).to.include('con-played__slot--front');
    expect(slots[0].classes()).to.not.include('con-played__slot--front');
    expect(wrapper.find(`[data-played-key="${CardName.FARMING}"]`).classes()).to.include('con-played__slot--front');
    wrapper.unmount();
  });

  it('the hero scene\'s reserved slot, a lifted card and a grounded card wear their holds — layout kept', () => {
    const wrapper = make({hiddenKey: CardName.FARMING, outNames: new Set([CardName.TREES]), grounded: new Set([CardName.GRASS])});
    expect(wrapper.find(`[data-played-key="${CardName.FARMING}"]`).classes()).to.include('con-played__slot--incoming');
    expect(wrapper.find(`[data-played-key="${CardName.TREES}"]`).classes()).to.include('con-played__slot--held-out');
    expect(wrapper.find(`[data-played-key="${CardName.GRASS}"]`).classes()).to.include('con-played__slot--grounded');
    expect(wrapper.findAll('.con-played__slot').length, 'every slot stays in the layout').to.eq(5);
    wrapper.unmount();
  });
});

/*
 * THE FLEET ON A DOCK IS PART OF THE CARD ON THE TABLE TOO (docs/claude/gameplay-polish-ledger.md PL-013): the stack
 * draws PUBLIC faces, and a docked dock read as a free one — in the owner's own «РАЗЫГРАНО» and in a rival's reading
 * of it. The docked face alone gets the minimal public model; every other face stays name-only — unless the stack is
 * the CORPORATION's (`live`), whose stored resources are the player's own reading.
 */
describe('ConsolePlayedStack — a dock\'s fleet stands on its face', () => {
  const one = (list: Array<CardModel>, live = false) => make({cards: list, lanes: [{start: 0, count: list.length}], live});

  it('docked: the ship sits on its ▲ in the owner\'s livery', () => {
    const wrapper = one([{name: CardName.TREES} as CardModel, {name: CardName.UNMI_LINER, fleetDocked: 'blue'} as CardModel]);
    const ship = wrapper.find(`[data-played-key="${CardName.UNMI_LINER}"] .pcard-fleet--docked .colony-fleet-icon`);
    expect(ship.exists()).to.eq(true);
    expect(ship.classes()).to.include('fleet-hue--blue');
    wrapper.unmount();
  });

  it('a free dock keeps its empty mark slot; a project card\'s LIVE counters never reach the table — it stays printed', () => {
    const face = (list: Array<CardModel>) => {
      const wrapper = one(list);
      const html = wrapper.find(`[data-played-key="${CardName.BIRDS}"]`).html();
      const docked = wrapper.find('.pcard-fleet--docked').exists();
      wrapper.unmount();
      return {html, docked};
    };
    const printed = face([{name: CardName.WATER_HAULING} as CardModel, {name: CardName.BIRDS} as CardModel]);
    const live = face([{name: CardName.WATER_HAULING} as CardModel, {name: CardName.BIRDS, resources: 4, isDisabled: true} as CardModel]);
    expect(printed.docked, 'no fleet on a free dock').to.eq(false);
    expect(live.html, 'stored resources and availability are not the table\'s to draw').to.eq(printed.html);
  });

  it('the CORPORATION\'s face carries its live model (its own stored resources on its capsule)', () => {
    const printed = one([{name: CardName.ARKLIGHT} as CardModel]).html();
    const live = one([{name: CardName.ARKLIGHT, resources: 3} as CardModel], true).html();
    expect(live).to.not.eq(printed);
    expect(live).to.include('3');
  });

  it('the fleet leaving (next generation) leaves the face name-only again', async () => {
    const wrapper = one([{name: CardName.UNMI_LINER, fleetDocked: 'red'} as CardModel]);
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(true);
    await wrapper.setProps({cards: [{name: CardName.UNMI_LINER} as CardModel]});
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(false);
    expect(wrapper.find('.pcard-fleet').exists(), 'the slot stays — it is the landing anchor').to.eq(true);
    wrapper.unmount();
  });
});
