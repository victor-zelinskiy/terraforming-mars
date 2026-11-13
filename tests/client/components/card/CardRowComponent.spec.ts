import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import CardRowComponent from '@/client/components/card/CardRowComponent.vue';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {ICardRenderDescription} from '@/common/cards/render/ICardRenderDescription';
import {Size} from '@/common/cards/render/Size';
import {
  ICardRenderCorpBoxAction,
  ICardRenderCorpBoxEffect,
  ICardRenderCorpBoxEffectAction,
  ICardRenderEffect,
  ICardRenderItem,
  ICardRenderProductionBox,
  ICardRenderRoot,
  ICardRenderSymbol,
  ICardRenderTile,
  ItemType,
} from '@/common/cards/render/Types';
import {TileType} from '@/common/TileType';
import {translateText} from '@/client/directives/i18n';

/*
 * The row is a SWITCH: one piece of a card's render data goes to the one component that draws its kind, under that
 * component's own prop. The six virtual-DOM children are stubbed by name; the description is the real (Vapor) leaf.
 * The row emits nothing and exposes nothing.
 */
const ItemStub = defineComponent({
  name: 'CardRenderItemComponent',
  props: {item: {type: Object as PropType<ICardRenderItem>, required: true}},
  render() {
    return h('i', {'class': 'item-stub'});
  },
});

const SymbolStub = defineComponent({
  name: 'CardRenderSymbolComponent',
  props: {item: {type: Object as PropType<ICardRenderSymbol>, required: true}},
  render() {
    return h('i', {'class': 'symbol-stub'});
  },
});

const ProductionStub = defineComponent({
  name: 'CardProductionBoxComponent',
  props: {rows: {type: Array as PropType<Array<Array<ItemType>>>, required: true}},
  render() {
    return h('i', {'class': 'production-stub'});
  },
});

const EffectStub = defineComponent({
  name: 'CardRenderEffectBoxComponent',
  props: {effectData: {type: Object as PropType<ICardRenderEffect>, required: true}},
  render() {
    return h('i', {'class': 'effect-stub'});
  },
});

const TileStub = defineComponent({
  name: 'CardRenderTileComponent',
  props: {item: {type: Object as PropType<ICardRenderTile>, required: true}},
  render() {
    return h('i', {'class': 'tile-stub'});
  },
});

const CorpBoxStub = defineComponent({
  name: 'CardRenderCorpBoxComponent',
  props: {
    rows: {type: Array as PropType<Array<Array<ItemType>>>, required: true},
    label: {type: String, required: true},
  },
  render() {
    return h('i', {'class': 'corp-box-stub'});
  },
});

function rowOf(componentData: ItemType | ICardRenderDescription) {
  return mount(CardRowComponent, {
    global: {
      ...globalConfig.global,
      stubs: {
        CardRenderItemComponent: ItemStub,
        CardRenderSymbolComponent: SymbolStub,
        CardProductionBoxComponent: ProductionStub,
        CardRenderEffectBoxComponent: EffectStub,
        CardRenderTileComponent: TileStub,
        CardRenderCorpBoxComponent: CorpBoxStub,
      },
    },
    props: {componentData},
  });
}

/**
 * A row whose data is a description has the VAPOR leaf as its root, and test-utils cannot read a Vapor root — so that
 * row stands under a virtual-DOM host with an element root, as it does in the product under the card's render tree.
 */
function hostedRowOf(componentData: ItemType | ICardRenderDescription) {
  const Host = defineComponent({render: () => h('div', [h(CardRowComponent, {componentData})])});
  return mount(Host, {...globalConfig});
}

const ITEM: ICardRenderItem = {is: 'item', type: CardRenderItemType.MEGACREDITS, amount: 5};
const SYMBOL: ICardRenderSymbol = {is: 'symbol', type: CardRenderSymbolType.PLUS, size: Size.MEDIUM};

describe('CardRowComponent', () => {
  it('mounts without errors', () => {
    const componentData: ICardRenderItem = {
      is: 'item',
      type: CardRenderItemType.MEGACREDITS,
      amount: 5,
    };
    const wrapper = shallowMount(CardRowComponent, {
      ...globalConfig,
      props: {
        componentData,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('each kind of render data goes to its own component, under that component\'s prop', () => {
    const item = rowOf(ITEM);
    expect(item.findComponent(ItemStub).props('item')).to.deep.eq(ITEM);
    expect(item.findComponent(SymbolStub).exists(), 'one piece, one component').to.eq(false);

    expect(rowOf(SYMBOL).findComponent(SymbolStub).props('item')).to.deep.eq(SYMBOL);

    const production: ICardRenderProductionBox = {is: 'production-box', rows: [[ITEM]]};
    expect(rowOf(production).findComponent(ProductionStub).props('rows')).to.deep.eq([[ITEM]]);

    const effect: ICardRenderEffect = {is: 'effect', rows: [[ITEM], [SYMBOL], [ITEM]]};
    expect(rowOf(effect).findComponent(EffectStub).props('effectData')).to.deep.eq(effect);

    const tile: ICardRenderTile = {is: 'tile', tile: TileType.GREENERY};
    expect(rowOf(tile).findComponent(TileStub).props('item')).to.deep.eq(tile);
  });

  it('a corporation box is ONE component for its three kinds — the label names the kind', () => {
    const rows: Array<Array<ItemType>> = [[ITEM]];
    const effect: ICardRenderCorpBoxEffect = {is: 'corp-box-effect', rows};
    const action: ICardRenderCorpBoxAction = {is: 'corp-box-action', rows};
    const both: ICardRenderCorpBoxEffectAction = {is: 'corp-box-effect-action', rows};
    expect(rowOf(effect).findComponent(CorpBoxStub).props()).to.deep.eq({rows, label: 'effect'});
    expect(rowOf(action).findComponent(CorpBoxStub).props()).to.deep.eq({rows, label: 'action'});
    expect(rowOf(both).findComponent(CorpBoxStub).props()).to.deep.eq({rows, label: 'effect/action'});
  });

  it('a description is printed by the description leaf; data of no kind the row knows prints «n/a»', () => {
    const description: ICardRenderDescription = {text: 'A line of a card nobody translated', align: 'left'};
    const printed = hostedRowOf(description).find('.card-description');
    expect(printed.classes()).to.include('card-description-align--left');
    expect(printed.text()).to.eq(`(${translateText(description.text)})`);

    const root: ICardRenderRoot = {is: 'root', rows: []};
    const unknown = rowOf(root);
    expect(unknown.text()).to.eq('n/a');
    expect(unknown.find('.card-description').exists()).to.eq(false);
    expect(unknown.findComponent(ItemStub).exists()).to.eq(false);
  });
});
