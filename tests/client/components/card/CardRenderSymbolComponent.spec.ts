import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardRenderSymbolComponent from '@/client/components/card/CardRenderSymbolComponent.vue';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {ICardRenderSymbol} from '@/common/cards/render/Types';
import {Size} from '@/common/cards/render/Size';

/** The symbol's own element — the component's root is a plain wrapper around it. It emits nothing and exposes nothing. */
function symbolOf(item: ICardRenderSymbol) {
  return shallowMount(CardRenderSymbolComponent, {...globalConfig, props: {item}}).find('.card-special');
}

describe('CardRenderSymbolComponent', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CardRenderSymbolComponent, {
      ...globalConfig,
      props: {
        item: {
          is: 'symbol',
          type: CardRenderSymbolType.ARROW,
          size: Size.MEDIUM,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('a symbol wears its type\'s class and prints its sign — the size suffix only where the type has that size', () => {
    const plus = symbolOf({is: 'symbol', type: CardRenderSymbolType.PLUS, size: Size.SMALL});
    expect(plus.classes()).to.deep.eq(['card-special', 'card-plus', 'card-plus--small']);
    expect(plus.text()).to.eq('+');

    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.PLUS, size: Size.MEDIUM}).classes(), 'a plus has no medium form')
      .to.deep.eq(['card-special', 'card-plus']);
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.OR, size: Size.TINY}).classes())
      .to.deep.eq(['card-special', 'card-or', 'card-or--tiny']);
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.VSPACE, size: Size.LARGE}).classes())
      .to.deep.eq(['card-special', 'card-vspace', 'card-vspace--large']);
  });

  it('the arrow is the special case: the red arrow, its small form at the small size — never the type\'s own class', () => {
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.ARROW, size: Size.SMALL}).classes())
      .to.deep.eq(['card-special', 'card-red-arrow--small']);
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.ARROW, size: Size.MEDIUM}).classes())
      .to.deep.eq(['card-special', 'card-red-arrow']);
  });

  it('an icon prints no sign, a superscript stands in a <sup>, a cancelled symbol is struck', () => {
    const plain = symbolOf({is: 'symbol', type: CardRenderSymbolType.MINUS, size: Size.MEDIUM});
    expect(plain.text()).to.eq('-');
    expect(plain.find('sup').exists()).to.eq(false);
    expect(plain.classes()).to.not.include('card-symbol-cancelled');

    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.MINUS, size: Size.MEDIUM, isIcon: true}).text()).to.eq('');
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.ASTERIX, size: Size.MEDIUM, isSuperscript: true}).find('sup').text()).to.eq('*');
    expect(symbolOf({is: 'symbol', type: CardRenderSymbolType.SLASH, size: Size.MEDIUM, cancelled: true}).classes())
      .to.deep.eq(['card-special', 'card-slash', 'card-symbol-cancelled']);
  });
});
