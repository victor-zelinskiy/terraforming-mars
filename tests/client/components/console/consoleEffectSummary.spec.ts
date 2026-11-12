/*
 * ConsoleEffectSummary — «За партию», ONE effect's whole-game summary on the console. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop — the skeleton while the stats have not
 * arrived, then the blocks in the model's order. `v-i18n` is the component's own imported binding now; the unit
 * runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {EffectSummaryViewModel} from '@/client/components/effects/effectSummary';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleEffectSummary from '@/client/components/console/ConsoleEffectSummary.vue';

const FULL: EffectSummaryViewModel = {
  empty: false,
  triggerCount: 3,
  headline: 'Resources gained',
  lines: [
    {icon: 'plants', label: 'Gained', value: '+6'},
    {label: 'Saved', value: '12'},
  ],
  currentValue: {icon: 'floater', value: '4'},
  breakdown: [{label: 'Europa', value: '2'}, {label: 'Titan', value: '1'}],
  note: 'Counts every trigger this game',
  confidence: 'exact',
  lastTrigger: {generation: 7},
  cardScoped: true,
};

function summaryOf(summary: EffectSummaryViewModel | undefined) {
  return mount(ConsoleEffectSummary, {...globalConfig, props: {summary}});
}

describe('ConsoleEffectSummary — «За партию»', () => {
  it('the stats have not arrived: a quiet skeleton under the label — never «nothing fired»', () => {
    const w = summaryOf(undefined);
    expect(w.classes()).to.deep.eq(['con-efx__sum']);
    expect(w.find('.con-efx__rule-label').text()).to.eq('This game');
    expect(w.find('.con-efx__rule-label').attributes('tm-has-i18n'), 'the label is translated by the imported directive').to.eq('true');
    const skeleton = w.find('.con-efx__sum-skel');
    expect(skeleton.attributes('aria-hidden')).to.eq('true');
    expect(skeleton.findAll('.con-efx__sum-skel-bar')).to.have.lengthOf(2);
    for (const block of ['scope', 'headline', 'metric', 'line', 'breakdown', 'note', 'last']) {
      expect(w.find('.con-efx__sum-' + block).exists(), block).to.eq(false);
    }
  });

  it('a full summary: scope → headline + confidence → trigger count → lines → current value → breakdown → note → last trigger', () => {
    const w = summaryOf(FULL);
    expect(w.find('.con-efx__sum-skel').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-scope').text()).to.eq('Some stats are tracked at the card level');

    const headline = w.find('.con-efx__sum-headline');
    expect(headline.find('span').text()).to.eq('Resources gained');
    const confidence = headline.find('.con-efx__sum-conf');
    expect(confidence.classes()).to.contain('con-efx__sum-conf--exact');
    expect(confidence.text()).to.eq('Exact');

    const metric = w.find('.con-efx__sum-metric');
    expect(metric.find('.con-efx__sum-label').text()).to.eq('Times triggered');
    expect(metric.find('b').text()).to.eq('3');

    // The impact lines, then the live value — the same row grammar, the current one marked.
    const lines = w.findAll('.con-efx__sum-line');
    expect(lines.map((l) => l.find('.con-efx__sum-label').text())).to.deep.eq(['Gained', 'Saved', 'Current']);
    expect(lines.map((l) => l.find('b').text())).to.deep.eq(['+6', '12', '4']);
    expect(lines.map((l) => l.classes().includes('con-efx__sum-line--current'))).to.deep.eq([false, false, true]);
    expect(lines.map((l) => l.find('.con-efx__sum-icon').exists()), 'a line with no icon draws none').to.deep.eq([true, false, true]);
    expect(lines[0].find('.con-efx__sum-icon').classes()).to.include.members(iconClassFor('plants').split(' '));
    expect(lines[2].find('.con-efx__sum-icon').classes()).to.include.members(iconClassFor('floater').split(' '));

    const rows = w.findAll('.con-efx__sum-breakdown > .con-efx__sum-brow');
    expect(rows.map((r) => [r.find('span').text(), r.find('b').text()])).to.deep.eq([['Europa', '2'], ['Titan', '1']]);
    expect(w.find('.con-efx__sum-note').text()).to.eq('Counts every trigger this game');
    expect(w.find('.con-efx__sum-last').text().replace(/\s+/g, ' ')).to.eq('Last triggered · Generation 7');
  });

  it('an empty summary says only its note — no count, no card-level caption, no dead rows', () => {
    const w = summaryOf({empty: true, triggerCount: 0, lines: [], note: 'Nothing to tally yet', confidence: 'ruleOnly', cardScoped: true});
    expect(w.find('.con-efx__sum-skel').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-scope').exists(), 'the caption is for a summary that has something').to.eq(false);
    expect(w.find('.con-efx__sum-headline').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-metric').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-line').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-breakdown').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-last').exists()).to.eq(false);
    expect(w.find('.con-efx__sum-note').text()).to.eq('Nothing to tally yet');
  });

  it('the confidence chip follows the model — its word and its class, or no chip at all', async () => {
    const w = summaryOf({...FULL, confidence: 'partial'});
    const chip = () => w.find('.con-efx__sum-conf');
    expect(chip().text()).to.eq('Partial');
    expect(chip().classes()).to.contain('con-efx__sum-conf--partial');
    await w.setProps({summary: {...FULL, confidence: 'ruleOnly'}});
    expect(chip().text()).to.eq('Rule effect');
    expect(chip().classes()).to.contain('con-efx__sum-conf--ruleOnly');
    await w.setProps({summary: {...FULL, confidence: undefined}});
    expect(chip().exists(), 'no confidence — no chip').to.eq(false);
    expect(w.find('.con-efx__sum-headline span').text()).to.eq('Resources gained');
  });

  it('the template STARTS WITH ITS ROOT — what the explorer lets fall through lands on the summary itself', () => {
    const w = mount(ConsoleEffectSummary, {...globalConfig, props: {summary: FULL}, attrs: {'class': 'from-host', 'data-from-host': 'yes'}});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-efx__sum', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
