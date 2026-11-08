import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import ConsoleTenderBack from '@/client/components/console/campaign/ConsoleTenderBack.vue';
import {TENDER_COMPENSATION_MC, TENDER_IDS, tenderDef} from '@/common/campaign/tenders';
import {tenderMeta} from '@/client/console/campaign/tenderMeta';
import {tenderAnnotations, tenderLoreModel} from '@/client/console/campaign/tenderAnnotations';
import {TENDER_ART_DIR, tenderArtUrl} from '@/client/console/campaign/tenderArt';

/**
 * THE CONTRACT'S FACE — the third pass (2026-11-08, the owner: «ТЕНДЕР» on the head instead of «Комитет», a premium
 * face in the game's own direction with a window for the art, the rule moved off the card into the viewer's right
 * column as for a project). The face prints NO prose at any size; the viewer reads the rule, the window and the buyout
 * (`tenderAnnotations`) and the lore (`tenderLoreModel`).
 */
describe('the tender contract — face, back and the viewer\'s reading', () => {
  it('the head says «Tender», the art window stands, no rule and no lore — at the table AND the reader size', () => {
    for (const size of ['table', 'reader'] as const) {
      const wrapper = mount(ConsoleTenderCard, {...globalConfig, props: {id: 'extendedLegacy', size}});
      expect(wrapper.find('.con-tender__kicker').text()).eq('Tender');
      expect(wrapper.find('.con-tender__art').exists(), size).is.true;
      // NO PROSE: the reading plate is the name, the meta line and the stub — nothing else.
      expect(wrapper.findAll('.con-tender__plate > *').map((w) => w.classes()[0]), size)
        .deep.eq(['con-tender__name', 'con-tender__meta', 'con-tender__coupon']);
      expect(wrapper.find('.con-tender__coupon').text()).contains(`${TENDER_COMPENSATION_MC} M€`);
      wrapper.unmount();
    }
  });

  it('until a kind has its art, the window engraves the family glyph (never an empty box, never a 404)', () => {
    const wrapper = mount(ConsoleTenderCard, {...globalConfig, props: {id: 'broadPortfolio'}});
    expect(wrapper.find('.con-tender__art').attributes('data-tender-art')).eq(tenderArtUrl('broadPortfolio') === undefined ? 'emblem' : 'image');
    if (tenderArtUrl('broadPortfolio') === undefined) {
      expect(wrapper.find('.con-tender__emblem').exists()).is.true;
      expect(wrapper.find('img').exists()).is.false;
    }
  });

  it('an art URL names its file by the id under the art directory', () => {
    for (const id of TENDER_IDS) {
      const url = tenderArtUrl(id);
      if (url !== undefined) {
        expect(url).eq(`${TENDER_ART_DIR}/${id}.webp`);
      }
    }
  });

  it('the plaque is the head and the name alone — no art, no stub', () => {
    const wrapper = mount(ConsoleTenderCard, {...globalConfig, props: {id: 'openCall', size: 'plaque'}});
    expect(wrapper.find('.con-tender__head').exists()).is.true;
    expect(wrapper.find('.con-tender__name').exists()).is.true;
    expect(wrapper.find('.con-tender__art').exists()).is.false;
    expect(wrapper.find('.con-tender__coupon').exists()).is.false;
  });

  it('the back is the Committee\'s cover: the seal and the word «Tender»', () => {
    const wrapper = mount(ConsoleTenderBack, {...globalConfig});
    expect(wrapper.find('.con-tender-back__seal').exists()).is.true;
    expect(wrapper.find('.con-tender-back__word').text()).eq('Tender');
  });

  it('every kind reads in the viewer\'s right column: its rule, its window, its buyout — in that order', () => {
    for (const id of TENDER_IDS) {
      const groups = tenderAnnotations(id);
      expect(groups.map((g) => g.id), id).deep.eq(['group:tender', 'group:window', 'group:buyout']);
      expect(groups[0].rows[0].text).eq(tenderMeta(id).ruleKey);
      expect(groups[1].rows[0].text).contains(tenderDef(id).window === 'legacy' ? 'threshold' : 'finale\'s start');
      expect(groups[2].rows[0].params).deep.eq([String(TENDER_COMPENSATION_MC)]);
    }
  });

  it('the lore reads in the left gutter (the archive block a project card lends its entry to)', () => {
    const lore = tenderLoreModel('restructuring', (s) => s);
    expect(lore.source).eq(tenderMeta('restructuring').loreKey);
    expect(lore.fallback).is.false;
  });
});
