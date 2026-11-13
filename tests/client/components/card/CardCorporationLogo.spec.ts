import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardCorporationLogo from '@/client/components/card/CardCorporationLogo.vue';
import {CardName} from '@/common/cards/CardName';

// A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): ONE prop — the corporation's name — nothing
// emitted, nothing exposed. What it renders for that name is one of three kinds of wordmark.
function logo(title: CardName) {
  return mount(CardCorporationLogo, {...globalConfig, props: {title}});
}

describe('CardCorporationLogo', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CardCorporationLogo, {
      ...globalConfig,
      props: {
        title: CardName.ECOLINE,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('a wordmark the stylesheet draws: the class is derived from the name, the text is the name in capitals', () => {
    const w = logo(CardName.ECOLINE);
    // The template starts with its root — the one element the i18n walker is told not to descend into.
    expect(w.element.tagName).to.eq('DIV');
    expect(w.classes()).to.deep.eq(['card-corporation-logo']);
    expect(w.attributes('tm-has-i18n')).to.eq('true');
    expect((w.element as Element).children).to.have.length(1);
    const mark = w.find('.card-corporation-logo > div');
    expect(mark.classes()).to.deep.eq(['card-ecoline-logo']);
    expect(mark.text()).to.eq('ECOLINE');

    // Spaces become dashes, the ampersand goes, a doubled dash folds.
    expect(logo(CardName.JENSON_BOYLE_CO).find('.card-jenson-boyle-co-logo').text()).to.eq('JENSON-BOYLE & CO');
  });

  it('an image wordmark carries its class and no text; a name with no entry is its capitals with no class', () => {
    const image = logo(CardName.AEROTECH);
    expect(image.find('.card-corporation-logo > .card-aerotech-logo').exists()).to.eq(true);
    expect(image.text()).to.eq('');

    const unknown = logo(CardName.ANTS).find('.card-corporation-logo > div');
    expect(unknown.classes()).to.deep.eq([]);
    expect(unknown.text()).to.eq('ANTS');
  });

  it('a bespoke wordmark is its own markup — and the logo follows its prop', async () => {
    const w = logo(CardName.THARSIS_REPUBLIC);
    expect(w.find('.card-corporation-logo > .card-tharsis-logo > .card-tharsis-logo-text').text()).to.eq('Tharsis Republic');
    expect((w.element as Element).children, 'one branch, nothing beside it').to.have.length(1);

    await w.setProps({title: CardName.SATURN_SYSTEMS});
    expect(w.find('.card-tharsis-logo').exists()).to.eq(false);
    expect(w.find('.card-corporation-logo > .card-saturn-logo').text()).to.contain('SATURN');

    await w.setProps({title: CardName.HELION});
    expect(w.find('.card-saturn-logo').exists()).to.eq(false);
    expect(w.find('.card-corporation-logo > .card-helion-logo').text()).to.eq('HELION');
  });
});
