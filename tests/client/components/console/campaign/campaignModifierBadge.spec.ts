/*
 * CampaignModifierBadge — ONE mission modifier's badge on a route card. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): a glyph and a word off the modifier's meta row, and the one-shot seal (`stamp`) the
 * route's reveal plays with its own delay.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {MissionModifierId} from '@/common/campaign/CampaignTypes';
import {MissionModifierMeta, missionModifierMetas} from '@/client/console/campaign/missionModifierMeta';
import CampaignModifierBadge from '@/client/components/console/campaign/CampaignModifierBadge.vue';

/** The registry's own row — what the route card and the dossier hand the badge. */
function metaOf(id: MissionModifierId): MissionModifierMeta {
  return missionModifierMetas([{id}])[0];
}

describe('CampaignModifierBadge — a mission modifier\'s badge', () => {
  it('«random goals»: the die, the modifier\'s short word, its id on the root — and no seal at rest', () => {
    const meta = metaOf('randomMA');
    const w = mount(CampaignModifierBadge, {...globalConfig, props: {meta}});
    expect(w.classes()).to.deep.eq(['cmod']);
    expect(w.attributes('data-mission-modifier')).to.eq('randomMA');
    expect(w.attributes('style'), 'no delay is published without the seal').to.eq(undefined);
    expect(w.find('.cmod__glyph').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.cmod__glyph svg.cmod__svg .cmod__die').exists()).to.eq(true);
    expect(w.findAll('.cmod__glyph .cmod__pip').length).to.eq(3);
    expect(w.find('.cmod__stroke').exists()).to.eq(false);
    expect(w.find('.cmod__label').text()).to.eq($t(meta.shortKey));
  });

  it('«shuffled cells»: the crossing arrows instead of the die', () => {
    const meta = metaOf('shuffleMap');
    const w = mount(CampaignModifierBadge, {...globalConfig, props: {meta}});
    expect(w.attributes('data-mission-modifier')).to.eq('shuffleMap');
    expect(w.findAll('.cmod__glyph svg.cmod__svg .cmod__stroke').length).to.eq(3);
    expect(w.find('.cmod__die').exists()).to.eq(false);
    expect(w.find('.cmod__label').text()).to.eq($t(meta.shortKey));
  });

  it('`stamp` plays the seal with the delay it was handed — and a delay alone publishes nothing', async () => {
    const w = mount(CampaignModifierBadge, {...globalConfig, props: {meta: metaOf('randomMA'), stampDelayMs: 240}});
    expect(w.classes()).to.not.contain('cmod--stamp');
    expect(w.attributes('style')).to.eq(undefined);

    await w.setProps({stamp: true});
    expect(w.classes()).to.include.members(['cmod', 'cmod--stamp']);
    expect((w.element as HTMLElement).style.getPropertyValue('--cmod-delay')).to.eq('240');

    await w.setProps({stampDelayMs: 0});
    expect((w.element as HTMLElement).style.getPropertyValue('--cmod-delay'), 'the default: no delay').to.eq('0');
  });
});
