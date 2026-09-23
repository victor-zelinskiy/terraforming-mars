import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {countedMetricIconUrl, countedTileIconUrl} from '@/client/components/premiumCard/premiumCardIcons';

/**
 * THE COUNTED OBJECT's glyph (Turmoil Redux): ONE drawing per kind of count,
 * each the object the face itself prints — the card silhouette, the tag
 * medallion(s), and the TILE with the face's own footnote spark (Colonization
 * Funding's «space city»). The tile glyph reuses the mechanics' city asset
 * and the face's `.pcard-sym--asterix` rule, so a reading and the card
 * cannot draw two different cities.
 */
describe('PremiumCountGlyph', () => {
  // The template opens with a comment node (kept in the development build), so the glyph is found, never the root.
  it('a TILE count draws the city pictogram with the footnote spark — the face\'s own asset and its own spark', () => {
    const wrapper = mount(PremiumCountGlyph, {props: {glyph: {kind: 'tile', tile: 'spaceCity'}}});
    const glyph = wrapper.find('.pcglyph');
    expect(glyph.exists()).to.eq(true);
    expect(glyph.classes()).to.include('pcglyph--tile');
    expect(glyph.attributes('data-count-tile')).to.eq('spaceCity');
    const tile = wrapper.find('.pcglyph__tile');
    expect(tile.exists()).to.eq(true);
    expect(tile.attributes('style')).to.contain(countedTileIconUrl('spaceCity'));
    expect(countedTileIconUrl('spaceCity')).to.contain('tiles/city.png');
    // The spark is the mechanics' asterisk rule (the physical card's «*»), never a second drawing.
    const spark = wrapper.find('.pcglyph__spark');
    expect(spark.exists()).to.eq(true);
    expect(spark.classes()).to.include('pcard-sym--asterix');
    // A tile glyph carries no tag and no card silhouette.
    expect(wrapper.find('.pcglyph__tag').exists()).to.eq(false);
    expect(wrapper.find('.pvpcard').exists()).to.eq(false);
  });

  it('a METRIC count draws the rating badge — the face\'s own TR asset — alone: no spark, no number, no tag, no card', () => {
    const wrapper = mount(PremiumCountGlyph, {props: {glyph: {kind: 'metric', metric: 'terraformRating'}}});
    const glyph = wrapper.find('.pcglyph');
    expect(glyph.exists()).to.eq(true);
    expect(glyph.classes()).to.include('pcglyph--metric');
    expect(glyph.attributes('data-count-metric')).to.eq('terraformRating');
    const badge = wrapper.find('.pcglyph__metric');
    expect(badge.exists()).to.eq(true);
    expect(badge.attributes('style')).to.contain(countedMetricIconUrl('terraformRating'));
    expect(countedMetricIconUrl('terraformRating')).to.contain('resources/tr.png');
    expect(wrapper.find('.pcglyph__spark').exists()).to.eq(false);
    expect(wrapper.find('.pcglyph__tile').exists()).to.eq(false);
    expect(wrapper.find('.pcglyph__tag').exists()).to.eq(false);
    expect(wrapper.find('.pvpcard').exists()).to.eq(false);
    expect(glyph.text().trim(), 'no number inside the badge — the value stands beside the glyph').to.eq('');
  });

  it('the other kinds are untouched: a tag medallion, several medallions joined by «+», the card silhouette', () => {
    const tag = mount(PremiumCountGlyph, {props: {glyph: {kind: 'tag', tag: Tag.POWER}}});
    expect(tag.find('.pcglyph').attributes('data-count-tag')).to.eq(Tag.POWER);
    expect(tag.find('.pcglyph__tag').attributes('style')).to.contain('tags/power.png');
    expect(tag.find('.pcglyph__spark').exists()).to.eq(false);

    const tags = mount(PremiumCountGlyph, {props: {glyph: {kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]}}});
    expect(tags.find('.pcglyph').classes()).to.include('pcglyph--tags');
    expect(tags.findAll('.pcglyph__tag')).to.have.length(2);
    expect(tags.findAll('.pcglyph__plus')).to.have.length(1);

    // The card silhouette prints a localized «VP» plate — the mount supplies the translator the face expects.
    const card = mount(PremiumCountGlyph, {props: {glyph: {kind: 'vp-card', tag: Tag.BUILDING}}, global: {mocks: {$t: (key: string) => key}}});
    expect(card.find('.pvpcard').exists()).to.eq(true);
    expect(card.find('.pcglyph--tile').exists()).to.eq(false);
  });
});
