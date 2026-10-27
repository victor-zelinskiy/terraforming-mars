import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleBotDividendLedger from '@/client/components/console/ConsoleBotDividendLedger.vue';
import {BotDividendReading} from '@/client/components/marsbot/botDividendReading';

/*
 * THE LIVE DIVIDEND LEDGER under a further corporation's printed rule (the owner, 2026-10-27): the operand's
 * count once, each goal's threshold, prize, meter and state («взята» / «ещё N»), and the total WITH the goals
 * split into the formula and the goals. A reached goal is told by MATERIAL — the seal's tick, the kant's class
 * and the word — never by colour alone. The unit runner renders the English keys.
 */
const READING: BotDividendReading = {
  name: 'Green Belt',
  rule: [
    {text: '${0} VP per greenery tile MarsBot owns', params: ['2'], muted: false},
    {text: '+${0} VP if MarsBot reaches ${1} or more', params: ['2', '6'], muted: true},
  ],
  terms: [
    {label: 'Greenery tiles', formula: {label: '${0} × ${1} VP', params: [9, 2]}, vp: 18},
    {label: 'Threshold bonus', formula: {label: '${0} of ${1} for +${2} VP', params: [9, 6, 2]}, vp: 2},
  ],
  operand: {label: 'Greenery tiles', count: 9},
  goals: [
    {ordinal: 1, at: 9, vp: 10, reached: true, paid: 10, remaining: 0, fill: 1},
    {ordinal: 2, at: 10, vp: 15, reached: false, paid: 0, remaining: 1, fill: 0.9},
  ],
  formulaVp: 20,
  goalsVp: 10,
  totalVp: 30,
};

function make(props: Record<string, unknown> = {}) {
  return mount(ConsoleBotDividendLedger, {...globalConfig, props: {reading: READING, ...props}});
}

describe('ConsoleBotDividendLedger', () => {
  it('the mechanic leads: the name, the printed rule (the qualifier quieter), each live term with its VP', () => {
    const w = make();
    const formula = w.find('[data-dividend-formula]');
    expect(formula.find('[data-dividend-name]').text()).eq('Green Belt');
    const rule = formula.findAll('.con-divledger__rule-line');
    expect(rule.map((l) => l.text())).deep.eq(['2 VP per greenery tile MarsBot owns', '+2 VP if MarsBot reaches 6 or more']);
    expect(rule[1].classes()).contains('con-divledger__rule-line--muted');
    const terms = formula.findAll('[data-dividend-term]');
    expect(terms.map((t) => t.find('.con-divledger__term-calc').text())).deep.eq(['9 × 2 VP', '9 of 6 for +2 VP']);
    expect(terms.map((t) => t.attributes('data-term-vp'))).deep.eq(['18', '2']);
  });

  it('states the operand once, then both goals with their thresholds and prizes', () => {
    const w = make();
    expect(w.find('[data-dividend-count]').text()).eq('9');
    const goals = w.findAll('[data-dividend-goal]');
    expect(goals.map((g) => g.attributes('data-dividend-goal'))).deep.eq(['1', '2']);
    expect(goals.map((g) => g.find('[data-goal-at]').text())).deep.eq(['Dividend goal at 9', 'Dividend goal at 10']);
    expect(goals.map((g) => g.find('[data-goal-vp]').text())).deep.eq(['Dividend goal prize: +10 VP', 'Dividend goal prize: +15 VP']);
  });

  it('a reached goal reads «Взята» with its seal; an open one names how many are missing', () => {
    const [first, second] = make().findAll('[data-dividend-goal]');
    expect(first.attributes('data-goal-reached')).eq('true');
    expect(first.classes()).contains('con-divledger__goal--reached');
    expect(first.find('.con-divledger__seal').text()).eq('✓');
    expect(first.find('[data-goal-state]').text()).eq('Dividend goal reached');
    expect(second.attributes('data-goal-reached')).eq('false');
    expect(second.find('.con-divledger__seal').text()).eq('');
    expect(second.find('[data-goal-state]').text()).eq('Dividend goal: 1 to go');
    expect(second.find('.con-divledger__fill').attributes('style')).contains('scaleX(0.9)');
  });

  it('the total carries the goals, split into the formula and the goals; «now» until the game ends', () => {
    const live = make();
    expect(live.find('[data-dividend-vp]').text()).eq('30');
    expect(live.find('[data-dividend-total]').text()).contains('Dividend formula 20 + goals 10');
    expect(live.find('.con-divledger__total-label').text()).eq('Dividend total now');
    expect(make({final: true}).find('.con-divledger__total-label').text()).eq('Dividend total');
  });
});
