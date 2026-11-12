/*
 * ConsoleVenusBonusRow — the composer's ONE row of the Venus bonus (P89 · ledger EM). A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): it only READS — the step's own prompt (its `venusBonusPrompt` marker) and
 * the parts the composer collected so far — and says either what is still owed or the answer in chips.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import ConsoleVenusBonusRow from '@/client/components/console/foundation/ConsoleVenusBonusRow.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {VenusBonusParts, venusStepReading} from '@/client/console/venusBonus/venusBonusPreselect';

/** The step's prompt as the preview carries it — the row reads its marker and nothing else. */
function prompt(meta: VenusBonusPromptMeta): PlayerInputModel {
  return {type: 'and', title: 'Venus bonus', buttonLabel: 'Save', options: [], venusBonusPrompt: meta} as unknown as PlayerInputModel;
}

function row(meta: VenusBonusPromptMeta, parts: VenusBonusParts) {
  return mount(ConsoleVenusBonusRow, {...globalConfig, props: {input: prompt(meta), parts}});
}

const owed = (n: number): string => translateTextWithParams('Resources to lay out: ${0}', [String(n)]);

describe('ConsoleVenusBonusRow — the composer\'s one row of the Venus bonus', () => {
  it('an unanswered standard step reads what is owed — the label, the raise that earned it, the count', () => {
    const meta: VenusBonusPromptMeta = {kind: 'standard', baseCount: 2, step: {from: 16, to: 20}};
    const w = row(meta, {});
    expect(w.classes()).to.contain('con-venusrow');
    expect(w.attributes('data-venus-bonus-row')).to.not.eq(undefined);
    expect(w.attributes('data-venus-answered'), 'nothing is laid out yet').to.eq(undefined);
    expect(w.find('.con-venusrow__label > span').text()).to.eq($t('Venus bonus'));
    expect(w.find('[data-venus-step]').text()).to.eq(venusStepReading(meta));
    expect(w.find('[data-venus-step]').text()).to.contain('16 % → 20 %');
    expect(w.find('.con-venusrow__budget').text()).to.eq(owed(2));
    expect(w.find('.con-venusrow__final').exists(), 'a standard step names no 30 % finish').to.eq(false);
    expect(w.find('.con-venusrow__ask').classes()).to.not.contain('con-venusrow__face--off');
    expect(w.find('.con-venusrow__answer').classes()).to.contain('con-venusrow__face--off');
    expect(w.findAll('[data-venus-summary-unit]')).has.length(0);
  });

  it('follows its parts — a spread laid out in full is the ANSWER, read in chips in lane order', async () => {
    const w = row({kind: 'standard', baseCount: 2}, {spread: {titanium: 1}});
    expect(w.find('[data-venus-step]').exists(), 'a marker with no raise — no reading').to.eq(false);
    expect(w.attributes('data-venus-answered'), 'one of two — still owed').to.eq(undefined);
    expect(w.find('.con-venusrow__answer').attributes('aria-hidden')).to.eq('true');

    await w.setProps({parts: {spread: {titanium: 1, steel: 1}}});
    expect(w.attributes('data-venus-answered')).to.eq('');
    expect(w.findAll('[data-venus-summary-unit]').map((chip) => [chip.attributes('data-venus-summary-unit'), chip.text()]))
      .to.deep.eq([['steel', '+1'], ['titanium', '+1']]);
    expect(w.find('[data-venus-summary-unit="steel"] i.con-venusrow__icon').classes()).to.include.members(iconClassFor('steel').split(' '));
    expect(w.find('.con-venusrow__ask').classes()).to.contain('con-venusrow__face--off');
    expect(w.find('.con-venusrow__ask').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-venusrow__answer').classes()).to.not.contain('con-venusrow__face--off');
    expect(w.find('.con-venusrow__answer').attributes('aria-hidden')).to.eq(undefined);
    expect(w.find('[data-venus-summary-card]').exists(), 'no wild — no card chip').to.eq(false);
  });

  it('the 30 % finish names itself beside the base — and a wild put on a card reads as that card', () => {
    const meta: VenusBonusPromptMeta = {kind: 'final', baseCount: 1, wildCardTargets: [CardName.DIRIGIBLES]};
    const w = row(meta, {wild: {wild: 'onCard', card: CardName.DIRIGIBLES}, spread: {heat: 1}});
    expect(w.find('.con-venusrow__final').text()).to.eq($t('Final step · 30 %'));
    expect(w.find('.con-venusrow__budget').text(), 'the base — the finish is named beside it').to.eq(owed(1));
    expect(w.attributes('data-venus-answered')).to.eq('');
    expect(w.findAll('[data-venus-summary-unit]').map((chip) => chip.attributes('data-venus-summary-unit'))).to.deep.eq(['heat']);
    const chip = w.find(`[data-venus-summary-card="${CardName.DIRIGIBLES}"]`);
    expect(chip.find('.con-venusrow__card').text()).to.eq($t(CardName.DIRIGIBLES));
    expect(chip.find('i.con-venusrow__icon').classes(), 'the holder\'s own resource').to.include.members(iconClassFor('floater').split(' '));
  });
});
