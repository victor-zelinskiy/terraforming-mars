import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import ConsoleMaWaivedPrice from '@/client/components/console/foundation/ConsoleMaWaivedPrice.vue';

// The seal is the premium face's modifier mark — its own specs' subject; this one reads what the price HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const SealStub = defineComponent({name: 'PremiumModifierMarks', props: ['sources'], render: () => h('i', {class: 'seal-stub'})});

function price(props: Record<string, unknown>) {
  return mount(ConsoleMaWaivedPrice, {
    ...globalConfig,
    props: {...props},
    global: {...globalConfig.global, stubs: {PremiumModifierMarks: SealStub}},
  });
}

describe('ConsoleMaWaivedPrice — a waived milestone / award price', () => {
  it('the table\'s price STRUCK, «0 M€» and the source\'s seal — one image with its sentence', () => {
    const w = price({printed: 8, waivedBy: CardName.VITOR});
    expect(w.classes()).to.contain('con-maprice');
    expect(w.attributes('role')).to.eq('img');
    expect(w.attributes('data-ma-price-printed')).to.eq('8');
    expect(w.attributes('data-ma-price-source')).to.eq(CardName.VITOR);
    expect(w.attributes('aria-label'))
      .to.eq(translateTextWithParams('Free thanks to ${0}: the price was ${1} M€', [translateText(CardName.VITOR), '8']));
    expect(w.find('s.con-maprice__printed').text()).to.eq('8');
    expect(w.find('.con-maprice__arrow').exists()).to.eq(true);
    expect(w.find('b.con-maprice__value').text()).to.eq('0');
    expect(w.find('i.resource_icon.resource_icon--megacredits').exists()).to.eq(true);
    const seal = w.findComponent(SealStub);
    expect(seal.classes()).to.contain('con-maprice__seal');
    expect(seal.props('sources')).to.deep.eq([{key: `card:${CardName.VITOR}`, symbol: 'card', card: CardName.VITOR, kind: 'waive', oneShot: false}]);
  });

  it('a funded slot has no printed price — the past is the 0 it went for', () => {
    const w = price({waivedBy: CardName.VITOR});
    expect(w.attributes('data-ma-price-printed')).to.eq(undefined);
    expect(w.find('.con-maprice__printed').exists()).to.eq(false);
    expect(w.find('.con-maprice__arrow').exists()).to.eq(false);
    expect(w.find('b.con-maprice__value').text()).to.eq('0');
    expect(w.attributes('aria-label')).to.eq(translateTextWithParams('Free thanks to ${0}', [translateText(CardName.VITOR)]));
  });

  it('follows its source and its price', async () => {
    const w = price({printed: 8, waivedBy: CardName.VITOR});
    await w.setProps({printed: 14, waivedBy: CardName.HELION});
    expect(w.attributes('data-ma-price-printed')).to.eq('14');
    expect(w.attributes('data-ma-price-source')).to.eq(CardName.HELION);
    expect(w.find('s.con-maprice__printed').text()).to.eq('14');
    expect(w.findComponent(SealStub).props('sources')).to.deep.eq([{key: `card:${CardName.HELION}`, symbol: 'card', card: CardName.HELION, kind: 'waive', oneShot: false}]);
    expect(w.attributes('aria-label'))
      .to.eq(translateTextWithParams('Free thanks to ${0}: the price was ${1} M€', [translateText(CardName.HELION), '14']));
  });
});
