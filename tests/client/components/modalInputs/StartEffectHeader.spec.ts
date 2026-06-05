import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import StartEffectHeader from '@/client/components/modalInputs/StartEffectHeader.vue';
import {CardName} from '@/common/cards/CardName';

function factory(source: {kind: 'corporation' | 'prelude', card: CardName}) {
  return mount(StartEffectHeader, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {Card: true, CardZoomModal: true}},
    props: {source},
  });
}

describe('StartEffectHeader', () => {
  it('renders a corporation start moment with the card name', () => {
    const w = factory({kind: 'corporation', card: CardName.VITOR});
    expect(w.find('.start-effect-header--corporation').exists()).to.eq(true);
    expect(w.text().toLowerCase()).to.satisfy((t: string) => t.includes('corporation') || t.includes('корпорац'));
    expect(w.text()).to.include(CardName.VITOR);
  });

  it('renders a prelude start moment', () => {
    const w = factory({kind: 'prelude', card: CardName.ECOLOGY_EXPERTS});
    expect(w.find('.start-effect-header--prelude').exists()).to.eq(true);
    expect(w.find('[data-test="start-effect-card"]').exists()).to.eq(true);
  });
});
