import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {buildMarsBotCorpPremiumVm} from '@/client/components/marsbot/marsBotCorpPremiumVm';
import {marsBotCorpAnnotations} from '@/client/components/marsbot/marsBotCorpRules';

function mountFace(id: MarsBotCorpId, resources = 0, large = false) {
  return mount(MarsBotCorpFace, {
    props: {id, resources, large},
    global: {
      mocks: {$t: (s: string) => s},
      // In the app `premium-card-face` is registered globally (main.ts);
      // register it here the same way (a static import in the COMPONENT
      // would close the PremiumCard → CardZoomModal → CardZoomCard cycle).
      components: {'premium-card-face': PremiumCard},
    },
  });
}

/**
 * The bot corporation renders ONE-TO-ONE through the ordinary premium
 * `.pcard` corporation template — same nameplate, tag rail, art viewport,
 * mechanics zone, resource capsule and expansion medallion as a human
 * corporation. Only the CONTENT differs (the bot card's own boxes + the
 * 'automa' stamp), which is what these specs pin.
 */
describe('MarsBotCorpFace (.pcard template)', () => {
  it('renders the real premium corporation face', () => {
    const wrapper = mountFace(MarsBotCorpId.C45_SPIRE);
    expect(wrapper.find('.pcard').exists()).is.true;
    expect(wrapper.find('.pcard-nameplate').exists()).is.true;
    expect(wrapper.find('.pcard__title').text()).contains('Spire');
    expect(wrapper.find('.pcard__mech').exists(), 'the symbolic mechanics zone').is.true;
    expect(wrapper.find('.pcard__exp-medallion').exists(), 'the expansion medallion').is.true;
  });

  it('the medallion carries the automa stamp — never the original\'s module icon', () => {
    for (const id of [MarsBotCorpId.C01_CREDICOR, MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C45_SPIRE]) {
      const wrapper = mountFace(id);
      const style = wrapper.find('.pcard__exp-medallion').attributes('style') ?? '';
      expect(style, `${id} medallion`).contains('expansion_icon_automa.svg');
    }
  });

  it('shows the tag rail ONLY for a corporation that prints starting tags', () => {
    expect(mountFace(MarsBotCorpId.C45_SPIRE).find('.pcard__tags').exists()).is.true;
    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.pcard__tags').exists()).is.false;
    expect(mountFace(MarsBotCorpId.C02_ECOLINE).find('.pcard__tags').exists()).is.false;
  });

  it('the resource capsule is the ordinary .pcard__res socket with the live count', () => {
    const spire = mountFace(MarsBotCorpId.C45_SPIRE, 7);
    expect(spire.find('.pcard__res').exists()).is.true;
    expect(spire.find('.pcard__res-count').text()).eq('7');

    const ecoline = mountFace(MarsBotCorpId.C02_ECOLINE, 1);
    expect(ecoline.find('.pcard__res-count').text()).eq('1');
    // Ecoline stores PLANTS — the capsule shows the standard plants icon.
    expect(ecoline.find('.pcard__res-icon').attributes('style') ?? '').contains('plant');

    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.pcard__res').exists()).is.false;
  });

  it('no human corporation rule leaks onto the face', () => {
    for (const id of [MarsBotCorpId.C01_CREDICOR, MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C45_SPIRE]) {
      const text = mountFace(id).text();
      expect(text).not.contains('57');
      expect(text).not.match(/Start with/i);
      expect(text).not.match(/draw 4/i);
    }
  });
});

describe('marsBotCorpPremiumVm (pure)', () => {
  it('builds a corporation-typed vm with the automa expansion and the original identity', () => {
    const vm = buildMarsBotCorpPremiumVm(MarsBotCorpId.C45_SPIRE, 3);
    expect(vm.type).eq('corporation');
    expect(vm.title).eq('Spire');
    expect(vm.expansion).eq('automa');
    expect(vm.tags).deep.eq(['earth']);
    expect(vm.cost).is.undefined; // Corporations print no cost; no human 50 M€.
    expect(vm.resource?.amount).eq(3);
    expect(vm.art, 'the original PC05 art resolves').is.not.undefined;
    expect(vm.mechanics.textOnly).is.not.true;
  });

  it('Ecoline\'s capsule overrides the icon to the standard plants resource', () => {
    const vm = buildMarsBotCorpPremiumVm(MarsBotCorpId.C02_ECOLINE, 1);
    expect(vm.resource?.iconUrl).contains('plant');
    const credicor = buildMarsBotCorpPremiumVm(MarsBotCorpId.C01_CREDICOR, 0);
    expect(credicor.resource).is.undefined;
  });
});

describe('marsBotCorpRules — the «§ ПРАВИЛА» groups', () => {
  it('shapes the printed boxes into annotation groups with their own kickers', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C45_SPIRE);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation effect', 'Before action phase']);
    expect(groups.every((g) => g.rows.length > 0)).is.true;
  });

  it('resolves row params into the text (no raw ${0} reaches the panel)', () => {
    for (const id of [MarsBotCorpId.C01_CREDICOR, MarsBotCorpId.C02_ECOLINE, MarsBotCorpId.C45_SPIRE]) {
      for (const group of marsBotCorpAnnotations(id)) {
        for (const row of group.rows) {
          expect(row.text).not.contains('${');
        }
      }
    }
  });
});
