import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

function mountFace(id: MarsBotCorpId, resources = 0, large = false) {
  return mount(MarsBotCorpFace, {
    props: {id, resources, large},
    global: {mocks: {$t: (s: string) => s}},
  });
}

describe('MarsBotCorpFace', () => {
  it('renders the bot rule sections with their kickers (Credicor)', () => {
    const wrapper = mountFace(MarsBotCorpId.C01_CREDICOR);
    const kickers = wrapper.findAll('.mbc__kicker').map((k) => k.classes().join(' '));
    expect(kickers.some((c) => c.includes('mbc__kicker--draftPriority'))).is.true;
    expect(kickers.some((c) => c.includes('mbc__kicker--effect'))).is.true;
    expect(wrapper.text()).contains('Most expensive');
  });

  it('never shows a HUMAN corporation rule (no starting M€, no first action)', () => {
    for (const id of [MarsBotCorpId.C01_CREDICOR, MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C45_SPIRE]) {
      const text = mountFace(id).text();
      expect(text).not.contains('57');
      expect(text).not.match(/Start with/i);
      expect(text).not.match(/draw 4/i);
      expect(text).not.match(/discard 3/i);
    }
  });

  it('shows the starting-tag row ONLY for a corporation that prints one', () => {
    expect(mountFace(MarsBotCorpId.C45_SPIRE).find('.mbc__tags').exists()).is.true;
    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.mbc__tags').exists()).is.false;
    expect(mountFace(MarsBotCorpId.C02_ECOLINE).find('.mbc__tags').exists()).is.false;
  });

  it('shows the corporation resource counter for Ecoline (plant) and Spire (science)', () => {
    const ecoline = mountFace(MarsBotCorpId.C02_ECOLINE, 1);
    expect(ecoline.find('.mbc__res').exists()).is.true;
    expect(ecoline.find('.mbc__res-count').text()).eq('1');
    expect(ecoline.find('.resource_icon--plants').exists()).is.true;

    const spire = mountFace(MarsBotCorpId.C45_SPIRE, 7);
    expect(spire.find('.mbc__res-count').text()).eq('7');
    expect(spire.find('.card-resource-science').exists()).is.true;

    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.mbc__res').exists()).is.false;
  });

  it('the identity plate carries the ORIGINAL corporation wordmark', () => {
    const wrapper = mountFace(MarsBotCorpId.C01_CREDICOR);
    expect(wrapper.find('.pcard-corp-stage').exists()).is.true;
    expect(wrapper.find('.card-corporation-logo').exists()).is.true;
  });

  it('the large tier keeps the same face family for the fullscreen fit', () => {
    const wrapper = mountFace(MarsBotCorpId.C45_SPIRE, 0, true);
    expect(wrapper.classes()).contains('mb-face');
    expect(wrapper.classes()).contains('mb-face--corp');
    expect(wrapper.classes()).contains('mb-face--large');
  });
});
