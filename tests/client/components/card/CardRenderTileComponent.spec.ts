import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardRenderTileComponent from '@/client/components/card/CardRenderTileComponent.vue';
import {ICardRenderTile} from '@/common/cards/render/Types';
import {TileType} from '@/common/TileType';

/*
 * What the tile renders for its `item` prop: the root's classes name the tile's art (the Ares art where the item asks
 * for it and one exists), and a tile drawn as a SYMBOL stands on the blank canvas with one inner element carrying the
 * symbol. The tile emits nothing and exposes nothing.
 */
function tileOf(item: ICardRenderTile) {
  return mount(CardRenderTileComponent, {...globalConfig, props: {item}});
}

describe('CardRenderTileComponent', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CardRenderTileComponent, {
      ...globalConfig,
      props: {
        item: {
          is: 'tile',
          tile: TileType.CITY,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('a tile with art of its own wears that art\'s class — the Ares art where the item asks for it', () => {
    const printed = tileOf({is: 'tile', tile: TileType.CAPITAL});
    expect(printed.classes()).to.deep.eq(['card-tile', 'card-tile-capital']);
    expect((printed.element as Element).children.length, 'a whole tile carries no symbol').to.eq(0);

    const ares = tileOf({is: 'tile', tile: TileType.CAPITAL, isAres: true});
    expect(ares.classes()).to.deep.eq(['card-tile', 'card-tile-capital-ares']);

    // No Ares art for this one: the item's wish falls back to the tile's own.
    const noAresArt = tileOf({is: 'tile', tile: TileType.OCEAN_CITY, isAres: true});
    expect(noAresArt.classes()).to.deep.eq(['card-tile', 'card-tile-ocean-city']);
  });

  it('a tile drawn as a symbol stands on the canvas with ONE inner element carrying the symbol', () => {
    const wrapper = tileOf({is: 'tile', tile: TileType.MINING_RIGHTS, hasSymbol: true});
    expect(wrapper.classes()).to.deep.eq(['card-tile', 'card-tile-canvas']);
    const inner = (wrapper.element as Element).children;
    expect(inner.length).to.eq(1);
    expect(inner[0].className).to.eq('card-tile-symbol card-tile-symbol-mining');
  });

  it('a tile with neither art nor symbol is the bare tile — and the classes follow the item', async () => {
    const wrapper = tileOf({is: 'tile', tile: TileType.CITY});
    expect(wrapper.classes()).to.deep.eq(['card-tile']);
    expect((wrapper.element as Element).children.length).to.eq(0);

    const next: ICardRenderTile = {is: 'tile', tile: TileType.NUCLEAR_ZONE, hasSymbol: true, isAres: true};
    await wrapper.setProps({item: next});
    expect(wrapper.classes()).to.deep.eq(['card-tile', 'card-tile-canvas', 'card-tile-nuclear-zone-ares']);
    expect(wrapper.find('.card-tile-symbol').classes()).to.include('card-tile-symbol-nuclear-zone');
  });
});
