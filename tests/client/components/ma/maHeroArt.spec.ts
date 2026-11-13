/*
 * MaHeroArt — the milestone / award HERO art. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * two props in, nothing out — the spec is what it renders for them, what it becomes when the asset is missing, and
 * that a re-pointed instance tries the asset again.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {maArtUrl} from '@/client/components/ma/maArt';

function hero(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(MaHeroArt, {props, attrs, global: {config: globalConfig.global.config}});
}

describe('MaHeroArt — the milestone / award hero art', () => {
  it('draws the art of its item — one inert image in the kind\'s stage', () => {
    const w = hero({name: 'Terraformer', kind: 'milestone'});
    expect(w.classes()).to.deep.eq(['ma-hero', 'ma-hero--milestone']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    const img = w.find('img.ma-hero__img');
    expect(img.attributes('src')).to.eq(maArtUrl('Terraformer'));
    expect(img.attributes('alt')).to.eq('');
    expect(img.attributes('draggable')).to.eq('false');
    expect(w.find('.ma-hero__glyph').exists()).to.eq(false);

    const award = hero({name: 'Space Baron', kind: 'award'});
    expect(award.classes()).to.deep.eq(['ma-hero', 'ma-hero--award']);
    expect(award.find('img.ma-hero__img').attributes('src')).to.eq(maArtUrl('Space Baron'));
  });

  it('a MISSING asset degrades to the kind\'s emblem — a trophy for a milestone, a medal for an award', async () => {
    const milestone = hero({name: 'No Such Milestone', kind: 'milestone'});
    await milestone.find('img').trigger('error');
    expect(milestone.classes()).to.deep.eq(['ma-hero', 'ma-hero--milestone', 'ma-hero--fallback']);
    expect(milestone.find('img').exists(), 'never a broken image').to.eq(false);
    expect(milestone.find('.ma-hero__glyph').text()).to.eq('🏆');

    const award = hero({name: 'No Such Award', kind: 'award'});
    await award.find('img').trigger('error');
    expect(award.classes()).to.deep.eq(['ma-hero', 'ma-hero--award', 'ma-hero--fallback']);
    expect(award.find('.ma-hero__glyph').text()).to.eq('🏅');
  });

  it('re-pointed at another item it tries the asset again — the failure is per name, not per instance', async () => {
    const w = hero({name: 'No Such Award', kind: 'award'});
    await w.find('img').trigger('error');
    expect(w.classes()).to.include('ma-hero--fallback');

    // The kind alone is not a new asset: the emblem stays, in the new kind.
    await w.setProps({kind: 'milestone'});
    // (the SET of classes: the order a runtime writes them in after an update is not a contract)
    expect(w.classes()).to.have.members(['ma-hero', 'ma-hero--milestone', 'ma-hero--fallback']);
    expect(w.find('.ma-hero__glyph').text()).to.eq('🏆');

    await w.setProps({name: 'Banker'});
    expect(w.classes()).to.deep.eq(['ma-hero', 'ma-hero--milestone']);
    expect(w.find('img.ma-hero__img').attributes('src')).to.eq(maArtUrl('Banker'));
    expect(w.find('.ma-hero__glyph').exists()).to.eq(false);
  });

  it('the template STARTS WITH ITS ROOT — the class a host puts on it lands on the hero itself', () => {
    const w = hero({name: 'Terraformer', kind: 'milestone'}, {'class': 'con-macere__hero', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['ma-hero', 'ma-hero--milestone', 'con-macere__hero']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
