import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardRenderItemComponent from '@/client/components/card/CardRenderItemComponent.vue';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {PartyName} from '@/common/turmoil/PartyName';

describe('CardRenderItemComponent', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CardRenderItemComponent, {
      ...globalConfig,
      props: {
        item: {
          is: 'item',
          type: CardRenderItemType.MEGACREDITS,
          amount: 3,
        },
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  // The effects explorer / journal canvases draw the DSL through this renderer: a party seal printed NOTHING (the
  // seal invisible) and its «Ruling» caption fell out as bare card-ink text — black on the console's dark well.
  it('draws a PARTY SEAL as its emblem disc with the caption as its own text node', () => {
    const wrapper = shallowMount(CardRenderItemComponent, {
      ...globalConfig,
      props: {
        item: {
          is: 'item',
          type: CardRenderItemType.PARTY_SEAL,
          amount: 1,
          party: PartyName.REDS,
          stacked: true,
          innerText: 'Ruling',
        },
      },
    });
    const seal = wrapper.find('.card-party-seal');
    expect(seal.exists()).to.be.true;
    expect(seal.classes()).to.include('card-party-seal--stacked');
    expect(seal.find('.card-party-seal__disc').attributes('style')).to.include('assets/parties/redux/reds.png');
    expect(seal.find('.card-party-seal__caption').text()).to.equal('Ruling');
    // The caption is never printed twice (the generic innerText path stands down).
    expect(seal.text()).to.equal('Ruling');
  });

  it('draws an uncaptioned PARTY SEAL as the disc alone', () => {
    const wrapper = shallowMount(CardRenderItemComponent, {
      ...globalConfig,
      props: {item: {is: 'item', type: CardRenderItemType.PARTY_SEAL, amount: 1, party: PartyName.MARS}},
    });
    expect(wrapper.find('.card-party-seal__disc').attributes('style')).to.include('assets/parties/redux/mars-first.png');
    expect(wrapper.find('.card-party-seal__caption').exists()).to.be.false;
  });
});
