import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

function mountToken(token: string | LogMessageData) {
  return mount(JournalTokenRenderer, {
    ...globalConfig,
    props: {token, players: []},
  });
}

function resourceToken(value: string): LogMessageData {
  return {type: LogMessageDataType.RESOURCE, value};
}

describe('JournalTokenRenderer — RESOURCE icon token', () => {
  it('renders a standard resource as a premium inline icon-chip (shared iconClassFor sprite)', () => {
    const wrapper = mountToken(resourceToken('steel'));
    const chip = wrapper.find('.journal-res');
    expect(chip.exists()).is.true;
    // Accessible without a native title (role=img + aria-label).
    expect(chip.attributes('role')).eq('img');
    expect(chip.attributes('aria-label')).is.not.empty;
    const icon = wrapper.find('.journal-res__icon');
    expect(icon.classes()).to.include.members(['resource_icon', 'resource_icon--steel']);
  });

  it('renders a card resource (Floater) via the card-resource sprite family', () => {
    const icon = mountToken(resourceToken('Floater')).find('.journal-res__icon');
    // iconClassFor normalises the CardResource enum value (lowercase, spaces→hyphens).
    expect(icon.classes()).to.include.members(['card-resource', 'card-resource-floater']);
  });

  it('maps the GlobalParameter "oceans" to the singular ocean icon (the alias fix)', () => {
    const icon = mountToken(resourceToken('oceans')).find('.journal-res__icon');
    expect(icon.classes()).to.include.members(['wgt-icon', 'wgt-icon--ocean']);
  });

  it('renders TR (РТ) with the real terraform-rating sprite', () => {
    const icon = mountToken(resourceToken('tr')).find('.journal-res__icon');
    expect(icon.classes()).to.include.members(['resource_icon', 'resource_icon--rating']);
  });

  it('leaves non-resource tokens untouched (a plain string is still journal text)', () => {
    const wrapper = mountToken('gained');
    expect(wrapper.find('.journal-res').exists()).is.false;
    expect(wrapper.find('.journal-text').exists()).is.true;
  });
});
