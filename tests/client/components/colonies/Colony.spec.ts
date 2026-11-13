import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import Colony from '@/client/components/colonies/Colony.vue';
import {Color} from '@/common/Color';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {translateText} from '@/client/directives/i18n';

/*
 * What the tile renders for its `colony` prop. Its three children are stubbed by name; every string the tile prints
 * through `v-i18n` / `translateText` is expected through the same `translateText` (English is the key). The tile
 * emits nothing and exposes nothing.
 */
const RowStub = defineComponent({
  name: 'ColonyRow',
  props: {
    metadata: {type: Object as PropType<ColonyMetadata>, required: true},
    colony: {type: Object as PropType<ColonyModel>, required: true},
  },
  render() {
    return h('i', {'class': 'colony-row-stub'});
  },
});

const TradeRowStub = defineComponent({
  name: 'ColonyTradeRow',
  props: {metadata: {type: Object as PropType<ColonyMetadata>, required: true}},
  render() {
    return h('i', {'class': 'colony-trade-row-stub'});
  },
});

const FleetIconStub = defineComponent({
  name: 'ColonyFleetIcon',
  props: {color: {type: String as PropType<Color>, required: true}},
  render() {
    return h('i', {'class': 'fleet-icon-stub'});
  },
});

function tileOf(colony: ColonyModel) {
  return mount(Colony, {
    global: {
      ...globalConfig.global,
      stubs: {ColonyRow: RowStub, ColonyTradeRow: TradeRowStub, ColonyFleetIcon: FleetIconStub},
    },
    props: {colony},
  });
}

describe('Colony', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(Colony, {
      ...globalConfig,
      props: {
        colony: {
          colonies: [],
          isActive: false,
          name: ColonyName.GANYMEDE,
          trackPosition: 1,
          visitor: undefined,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('the tile names its colony: the title, the background class (a space becomes a dash), the tooltip of its three bonuses', () => {
    const metadata = getColony(ColonyName.GANYMEDE);
    const w = tileOf(simpleColonyModel(ColonyName.GANYMEDE));
    expect(w.classes()).to.include.members(['colony-card', 'Ganymede-background']);
    const title = w.find('.colony-card-title-span');
    expect(title.classes()).to.include('Ganymede-title');
    expect(title.text()).to.eq(translateText(ColonyName.GANYMEDE));
    expect((w.attributes('data-tooltip') ?? '').split('\n')).to.deep.eq([
      `${translateText('Build Colony bonus')}: ${translateText(metadata.build.description)}`,
      `${translateText('Trade bonus')}: ${translateText(metadata.trade.description)}`,
      `${translateText('Colony bonus')}: ${translateText(metadata.colony.description)}`,
    ]);

    expect(tileOf(simpleColonyModel(ColonyName.IAPETUS_II)).classes()).to.include('Iapetus-II-background');
  });

  it('its rows get the manifest\'s metadata of the colony — the cube row with the colony itself, the trade row alone', () => {
    const colony: ColonyModel = {...simpleColonyModel(ColonyName.GANYMEDE), trackPosition: 3};
    const w = tileOf(colony);
    expect(w.findComponent(RowStub).props()).to.deep.eq({metadata: getColony(ColonyName.GANYMEDE), colony});
    expect(w.findComponent(TradeRowStub).props()).to.deep.eq({metadata: getColony(ColonyName.GANYMEDE)});
  });

  it('a trade fleet stands on the tile only while somebody visits it — in the visitor\'s colour', () => {
    const empty = tileOf(simpleColonyModel(ColonyName.GANYMEDE));
    expect(empty.find('.colony-spaceship').exists()).to.eq(false);
    expect(empty.findComponent(FleetIconStub).exists()).to.eq(false);

    const visited = tileOf({...simpleColonyModel(ColonyName.GANYMEDE), visitor: 'red'});
    expect(visited.find('.colony-spaceship').exists()).to.eq(true);
    expect(visited.findComponent(FleetIconStub).props('color')).to.eq('red');
  });

  it('the owners\' line reads «Bonus» — and «Colony Fee» on Titania, whose colonies pay', () => {
    const ownersLine = (name: ColonyName): string => tileOf(simpleColonyModel(name)).find('.colony-background-color').text();
    expect(ownersLine(ColonyName.GANYMEDE)).to.eq(translateText('Bonus'));
    expect(ownersLine(ColonyName.TITANIA)).to.eq(translateText('Colony Fee'));
  });
});
