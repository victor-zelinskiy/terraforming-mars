import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import PremiumCardArt from '@/client/components/premiumCard/PremiumCardArt.vue';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

describe('PremiumCard', () => {
  it('renders the crimson event face with cost, tags and mechanics', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(wrapper.classes()).to.include('pcard--theme-crimson');
    expect(wrapper.find('.pcard__cost-value').text()).to.eq('21');
    expect(wrapper.find('.pcard__cost-delta').exists()).to.eq(false);
    expect(wrapper.findAll('.pcard-tag').length).to.be.greaterThan(0); // event tag appended
    expect(wrapper.findAll('.pcard-mech-group').length).to.be.greaterThan(0);
    expect(wrapper.find('.pcard__title span').text()).to.not.eq('');
  });

  it('shows the discount mini-chip when calculatedCost differs', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET, {calculatedCost: 17})}});
    const delta = wrapper.find('.pcard__cost-delta');
    expect(delta.exists()).to.eq(true);
    expect(delta.text()).to.eq('−4');
    // printed cost stays on the badge
    expect(wrapper.find('.pcard__cost-value').text()).to.eq('21');
  });

  it('prelude face: no cost badge, prelude theme', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.DONATION)}});
    expect(wrapper.classes()).to.include('pcard--theme-prelude');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
  });

  it('carries live resources and unavailable state', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.PREDATORS, {resources: 3, isDisabled: true})}});
    expect(wrapper.find('.pcard__res-count').text()).to.eq('3');
    expect(wrapper.classes()).to.include('pcard--unavailable');
    expect(wrapper.classes()).to.include('pcard--theme-azure');
  });

  it('corporation face: identity zone hosts the wordmark, no art, no cost badge', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.HELION)}});
    expect(wrapper.classes()).to.include('pcard--theme-corporation');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
    expect(wrapper.findComponent(PremiumCardArt).exists()).to.eq(false);
    // the identity zone hosts the EXISTING wordmark system inside the stage
    expect(wrapper.find('.pcard-corp .pcard-corp-stage .card-corporation-logo').exists()).to.eq(true);
    // the flattened corp box renders as ordinary mech groups (starting row + effect)
    expect(wrapper.findAll('.pcard-mech-group').length).to.be.greaterThan(1);
  });

  it('static name-only mode renders the pristine printed face', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    expect(wrapper.classes()).to.include('pcard--theme-crimson');
    expect(wrapper.find('.pcard__res').exists()).to.eq(false);
    expect(wrapper.classes()).to.not.include('pcard--interactive');
  });

  it('VP-only card renders without a mechanics panel', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.DUST_SEALS)}});
    expect(wrapper.find('.pcard__mech').exists()).to.eq(false);
    expect(wrapper.find('.pcard__vp').exists()).to.eq(true);
  });

  it('header layering: full-width nameplate + overlay-driven text safe-areas', () => {
    // Comet: cost badge + 2 tags (space + event) → cluster width 64 → safe-r 82.
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(wrapper.find('.pcard-nameplate').exists()).to.eq(true);
    const style = wrapper.attributes('style') ?? '';
    expect(style).to.contain('--pcard-title-safe-l: 50px');
    expect(style).to.contain('--pcard-title-safe-r: 82px');
    // discount widens ONLY the left safe-area
    const discounted = mount(PremiumCard, {props: {card: model(CardName.COMET, {calculatedCost: 17})}});
    expect(discounted.attributes('style') ?? '').to.contain('--pcard-title-safe-l: 84px');
    expect(discounted.classes()).to.include('pcard--cost-mod');
  });

  it('default DSL amounts (-1 = unspecified) never leak a «−1» digit', () => {
    // Herbivores: «greenery : animal» effect + «−1 plant production» — every
    // icon uses the builder default amount (-1). The digit shows ONLY on an
    // explicit showDigit (legacy semantics); negativity rides MINUS symbols.
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.HERBIVORES)}});
    expect(wrapper.text()).to.not.contain('−1');
    expect(wrapper.text()).to.not.contain('-1');
  });

  it('peek face: corpus + header + requirements rail only — no art <img>, no lower section', () => {
    // Predators has requirements — the rail's top pixels live inside the
    // peek band, so the peek face must keep it.
    const wrapper = mount(PremiumCard, {props: {name: CardName.PREDATORS, inert: true, peek: true}});
    expect(wrapper.find('.pcard-nameplate').exists()).to.eq(true);
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(true);
    expect(wrapper.find('.pcard__reqs').exists()).to.eq(true);
    expect(wrapper.find('.pcard__art').exists()).to.eq(false);
    expect(wrapper.find('.pcard__lower').exists()).to.eq(false);
    // The box + theme classes stay those of the full face (pixel-true band).
    expect(wrapper.classes()).to.include('pcard--theme-azure');
  });

  it('peek face: a requirement-less card keeps the divider; a corporation skips its identity zone', () => {
    const comet = mount(PremiumCard, {props: {name: CardName.COMET, inert: true, peek: true}});
    expect(comet.find('.pcard__divider').exists()).to.eq(true);
    expect(comet.find('.pcard__art').exists()).to.eq(false);
    const corp = mount(PremiumCard, {props: {name: CardName.HELION, inert: true, peek: true}});
    expect(corp.find('.pcard-corp').exists()).to.eq(false);
    expect(corp.find('.pcard__lower').exists()).to.eq(false);
    expect(corp.classes()).to.include('pcard--theme-corporation');
  });

  it('an inert/static face plants no teleport anchors in body; a live face does', () => {
    const before = document.body.childNodes.length;
    const inert = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    expect(document.body.childNodes.length).to.eq(before);
    inert.unmount();
    const live = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(document.body.childNodes.length).to.be.greaterThan(before);
    live.unmount();
    expect(document.body.childNodes.length).to.eq(before);
  });

  it('lower anchors: VP variant class reserves the panel column', () => {
    const formula = mount(PremiumCard, {props: {card: model(CardName.SEARCH_FOR_LIFE)}});
    expect(formula.classes()).to.include('pcard--vp-formula');
    const compact = mount(PremiumCard, {props: {card: model(CardName.DUST_SEALS)}});
    expect(compact.classes()).to.include('pcard--vp-compact');
    // no VP → no reserve class at all
    const none = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(none.classes().some((c) => c.startsWith('pcard--vp-'))).to.eq(false);
  });
});

describe('PremiumCardArt', () => {
  it('one-shot fallback chain: art → -1.webp → procedural body (no loop)', async () => {
    const wrapper = mount(PremiumCardArt, {
      props: {art: {url: 'assets/card-images/001.webp', fallback: false}},
    });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').attributes('src')).to.eq('assets/card-images/-1.webp');
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).to.eq(false);
    expect(wrapper.classes()).to.include('pcard__art--void');
  });

  it('a fallback-art card that errors goes straight to the procedural body', async () => {
    const wrapper = mount(PremiumCardArt, {
      props: {art: {url: 'assets/card-images/-1.webp', fallback: true}},
    });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).to.eq(false);
  });
});
