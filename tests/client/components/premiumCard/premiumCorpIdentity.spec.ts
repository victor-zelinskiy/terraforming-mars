/*
 * PremiumCorpIdentity — the corporation face's IDENTITY ZONE (the art viewport's slot: a corporation has no art, its
 * brand wordmark stands there). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). It takes ONE
 * prop — the corporation's name — emits nothing and exposes nothing; the spec is what it renders for that name: the
 * zone, the legacy-geometry stage the logos are calibrated against, the wordmark it hands the name to, the kicker.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {translateText} from '@/client/directives/i18n';
import PremiumCorpIdentity from '@/client/components/premiumCard/PremiumCorpIdentity.vue';

// The wordmark system is its own (large) surface; this spec reads what the zone HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const LogoStub = defineComponent({
  name: 'CardCorporationLogo',
  props: ['title'],
  render: () => h('i', {class: 'logo-stub'}),
});

function identity(name: CardName) {
  return mount(PremiumCorpIdentity, {
    ...globalConfig,
    props: {name},
    global: {...globalConfig.global, stubs: {CardCorporationLogo: LogoStub}},
  });
}

describe('PremiumCorpIdentity — the corporation face\'s identity zone', () => {
  it('the zone is ONE decorative element — the template starts with its root — holding the stage and the kicker', () => {
    const w = identity(CardName.ECOLINE);
    expect(w.element.tagName).to.eq('DIV');
    expect(w.classes()).to.include('pcard-corp');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.pcard-corp > .pcard-corp-stage').exists()).to.eq(true);
    expect(w.find('.pcard-corp > .pcard-corp__kicker').exists()).to.eq(true);
  });

  it('hands the wordmark the corporation\'s NAME, inside the stage — never inside a literal `.card-container`', () => {
    const w = identity(CardName.ECOLINE);
    const logo = w.findComponent(LogoStub);
    expect(logo.exists()).to.eq(true);
    expect(logo.props('title')).to.eq(CardName.ECOLINE);
    expect(w.find('.pcard-corp-stage > .logo-stub').exists(), 'the logo stands in the calibrated stage').to.eq(true);
    // A nested `.card-container` inside a `.pcard` would be zoomed twice by the hosts.
    expect(w.find('.card-container').exists()).to.eq(false);
  });

  it('the kicker names the card\'s type in the player\'s language', () => {
    const w = identity(CardName.ECOLINE);
    expect(w.find('.pcard-corp__kicker').text()).to.eq(translateText('Corporation'));
  });

  it('follows its prop — another corporation, the same zone', async () => {
    const w = identity(CardName.ECOLINE);
    await w.setProps({name: CardName.THARSIS_REPUBLIC});
    expect(w.findComponent(LogoStub).props('title')).to.eq(CardName.THARSIS_REPUBLIC);
    expect(w.findAll('.pcard-corp-stage')).to.have.length(1);
  });
});
