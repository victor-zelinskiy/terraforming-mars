import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import CardDescription from '@/client/components/card/CardDescription.vue';

// A VAPOR component (the Vue 3.6 pilot): test-utils cannot take one as the ROOT of a mount (it reads the root's
// virtual-DOM instance), so it stands under a virtual-DOM host with an element root — as it does in the product, under
// the card's render tree. The interop plugin is installed for every mount by the bundle setup.
function mountDescription(item: unknown) {
  const Host = defineComponent({render: () => h('div', [h(CardDescription, {item})])});
  return mount(Host, {...globalConfig});
}

describe('CardDescription', () => {
  it('mounts without errors', () => {
    const wrapper = mountDescription('A test description');
    expect(wrapper.find('.card-description').exists()).to.be.true;
    expect(wrapper.find('.card-description').text()).to.equal('(A test description)');
  });

  it('an aligned description wears its alignment; the text stands in its own translatable node between the brackets', () => {
    const wrapper = mountDescription({text: 'Effect text', align: 'left'});
    const root = wrapper.find('.card-description');
    expect(root.classes()).to.include.members(['card-description-aligned', 'card-description-align--left']);
    expect(root.find('span').attributes('tm-has-i18n')).to.equal('true');
    expect(root.find('span').text()).to.equal('Effect text');
  });
});
