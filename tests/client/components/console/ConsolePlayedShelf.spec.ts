import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedShelf from '@/client/components/console/played/ConsolePlayedShelf.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

/**
 * ONE SHELF RUN of the «Разыграно» table (TR65 — «СТОЛ — ЭТО СТОЛ»): a row of FULL faces at the album's scale,
 * every slot carrying its [data-played-key] / [data-zoom-slot] identity. The peek-crop piles are gone — a face
 * reads from the couch or it is not on the table.
 */

const SHELF: Array<CardName> = [CardName.TREES, CardName.GRASS, CardName.HEATHER, CardName.LICHEN];

function cards(names: Array<CardName>): Array<CardModel> {
  return names.map((n) => ({name: n}) as CardModel);
}

function make(props: Partial<{cards: Array<CardModel>, hiddenKey: string | undefined, outNames: ReadonlySet<string>, grounded: ReadonlySet<string>, column: boolean, live: boolean}> = {}) {
  return mount(ConsolePlayedShelf, {
    props: {
      cards: cards(SHELF),
      zoom: 1.2, slotW: 384, slotH: 552, gapX: 18,
      ...props,
    },
  });
}

describe('ConsolePlayedShelf — full faces in a row', () => {
  it('every card is a FULL premium face in its own slot (no peek crop, no art-less strip), keyed for the flights', () => {
    const wrapper = make();
    const slots = wrapper.findAll('.con-played__slot');
    expect(slots.length).to.eq(4);
    for (const name of SHELF) {
      const slot = wrapper.find(`[data-played-key="${name}"]`);
      expect(slot.exists()).to.be.true;
      expect(slot.attributes('data-zoom-slot')).to.eq(name);
      expect(slot.attributes('style')).to.include('width: 384px');
      expect(slot.find('.con-played__face').attributes('style')).to.include('zoom: 1.2');
      expect(slot.find('.pcard').exists(), 'the real premium face').to.be.true;
      expect(slot.find('.pcard--peek, .pcard__peek').exists(), 'never a peek crop').to.be.false;
    }
    wrapper.unmount();
  });

  it('the hero scene\'s reserved slot, a lifted card and a grounded card wear their holds — layout kept', () => {
    const wrapper = make({hiddenKey: CardName.LICHEN, outNames: new Set([CardName.TREES]), grounded: new Set([CardName.GRASS])});
    expect(wrapper.find(`[data-played-key="${CardName.LICHEN}"]`).classes()).to.include('con-played__slot--incoming');
    expect(wrapper.find(`[data-played-key="${CardName.TREES}"]`).classes()).to.include('con-played__slot--held-out');
    expect(wrapper.find(`[data-played-key="${CardName.GRASS}"]`).classes()).to.include('con-played__slot--grounded');
    expect(wrapper.findAll('.con-played__slot').length, 'every slot stays in the layout').to.eq(4);
    wrapper.unmount();
  });

  it('a column shelf stacks the identity\'s heroes', () => {
    const wrapper = make({column: true, cards: cards([CardName.THARSIS_REPUBLIC, CardName.CREDICOR])});
    expect(wrapper.find('.con-played__shelf').classes()).to.include('con-played__shelf--column');
    expect(wrapper.findAll('.con-played__slot').length).to.eq(2);
    wrapper.unmount();
  });
});

/*
 * THE FLEET ON A DOCK IS PART OF THE CARD ON THE TABLE TOO (docs/claude/gameplay-polish-ledger.md PL-013): the shelf
 * draws PUBLIC faces, and a docked dock read as a free one — in the owner's own «РАЗЫГРАНО» and in a rival's reading
 * of it. The docked face alone gets the minimal public model; every other face stays name-only — unless the slot is
 * the HERO's (`live`), whose stored resources are the player's own reading.
 */
describe('ConsolePlayedShelf — a dock\'s fleet stands on its face', () => {
  it('docked: the ship sits on its ▲ in the owner\'s livery', () => {
    const wrapper = make({cards: [{name: CardName.TREES} as CardModel, {name: CardName.UNMI_LINER, fleetDocked: 'blue'} as CardModel]});
    const ship = wrapper.find(`[data-played-key="${CardName.UNMI_LINER}"] .pcard-fleet--docked .colony-fleet-icon`);
    expect(ship.exists()).to.eq(true);
    expect(ship.classes()).to.include('fleet-hue--blue');
    wrapper.unmount();
  });

  it('a free dock keeps its empty mark slot; a shelf card\'s LIVE counters never reach the table — it stays printed', () => {
    const face = (cards: Array<CardModel>) => {
      const wrapper = make({cards});
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

  it('the HERO\'s face carries its live model (its own stored resources on its capsule)', () => {
    const printed = make({cards: [{name: CardName.ARKLIGHT} as CardModel]}).html();
    const live = make({live: true, cards: [{name: CardName.ARKLIGHT, resources: 3} as CardModel]}).html();
    expect(live).to.not.eq(printed);
    expect(live).to.include('3');
  });

  it('the fleet leaving (next generation) leaves the face name-only again', async () => {
    const wrapper = make({cards: [{name: CardName.UNMI_LINER, fleetDocked: 'red'} as CardModel]});
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(true);
    await wrapper.setProps({cards: [{name: CardName.UNMI_LINER} as CardModel]});
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(false);
    expect(wrapper.find('.pcard-fleet').exists(), 'the slot stays — it is the landing anchor').to.eq(true);
    wrapper.unmount();
  });
});
