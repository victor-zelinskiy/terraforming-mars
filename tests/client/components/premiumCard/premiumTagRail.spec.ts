import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import PremiumTagRail from '@/client/components/premiumCard/PremiumTagRail.vue';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {tagClusterPlan, TagClusterPlan} from '@/client/components/premiumCard/tagLayout';

/*
 * THE TAG CLUSTER on its own (the face around it is `PremiumCard.spec.ts`): two props in — the printed tags and the
 * cluster's plan — and a row of medallions out. It emits nothing and exposes nothing.
 */
describe('PremiumTagRail', () => {
  it('prints one medallion per tag, in the printed order — each named by `data-tag` and wearing that tag\'s own art', () => {
    const tags = [Tag.BUILDING, Tag.SPACE, Tag.EARTH];
    const wrapper = mount(PremiumTagRail, {props: {tags, plan: tagClusterPlan(tags.length)}});
    // The template starts with its root: the cluster IS the component's element.
    expect(wrapper.element.tagName).to.eq('DIV');
    expect(wrapper.classes()).to.include('pcard__tags');
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
    const medallions = wrapper.findAll('.pcard-tag');
    expect(medallions.map((m) => m.attributes('data-tag'))).to.deep.eq(tags);
    medallions.forEach((m, i) => {
      expect(m.element.tagName).to.eq('SPAN');
      expect(m.attributes('style'), tags[i]).to.contain(tagIconUrl(tags[i]));
    });
  });

  it('stacks the LEFTMOST tag on top — an explicit z-order, counted down along the row', () => {
    const tags = [Tag.SCIENCE, Tag.POWER, Tag.JOVIAN, Tag.CITY];
    const wrapper = mount(PremiumTagRail, {props: {tags, plan: tagClusterPlan(tags.length)}});
    const z = wrapper.findAll('.pcard-tag').map((m) => (m.element as HTMLElement).style.zIndex);
    expect(z).to.deep.eq(['4', '3', '2', '1']);
  });

  it('wears the plan\'s mode — and follows the props when the face re-plans the cluster', async () => {
    const row: TagClusterPlan = {mode: 'row', size: 30, overlap: 0, rows: 1, width: 30, count: 1};
    const stack: TagClusterPlan = {mode: 'stack', size: 20, overlap: 6, rows: 2, width: 48, count: 5};
    const wrapper = mount(PremiumTagRail, {props: {tags: [Tag.BUILDING], plan: row}});
    expect(wrapper.classes()).to.include('pcard__tags--row');
    expect(wrapper.findAll('.pcard-tag')).to.have.length(1);

    await wrapper.setProps({tags: [Tag.BUILDING, Tag.SPACE, Tag.EARTH, Tag.SCIENCE, Tag.POWER], plan: stack});
    expect(wrapper.classes()).to.include('pcard__tags--stack');
    expect(wrapper.classes()).to.not.include('pcard__tags--row');
    expect(wrapper.findAll('.pcard-tag').map((m) => m.attributes('data-tag')))
      .to.deep.eq([Tag.BUILDING, Tag.SPACE, Tag.EARTH, Tag.SCIENCE, Tag.POWER]);
  });
});
