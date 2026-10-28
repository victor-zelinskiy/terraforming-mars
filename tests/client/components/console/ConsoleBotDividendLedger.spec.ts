import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleBotDividendLedger from '@/client/components/console/ConsoleBotDividendLedger.vue';
import {BotDividendReading} from '@/client/components/marsbot/botDividendReading';

/*
 * THE LIVE DIVIDEND LEDGER under a further corporation's printed rule (the owner, 2026-10-27; the goal as ONE
 * scale of three tiers, 2026-10-28): the operand's count once, the scale (gold up to the last reached notch, the
 * progress beyond it), each tier's threshold and prize under its notch, ONE line naming what the next tier needs,
 * and the total WITH the goal split into the formula and the goal. A reached tier is told by MATERIAL — a solid
 * notch and its class — never by colour alone. The unit runner renders the English keys.
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
  goal: {
    operand: {label: 'Greenery tiles', count: 9},
    tiers: [
      {ordinal: 1, at: 8, vp: 7, reached: true, paid: 7},
      {ordinal: 2, at: 10, vp: 8, reached: false, paid: 0},
      {ordinal: 3, at: 11, vp: 10, reached: false, paid: 0},
    ],
    progress: 0.5,
    next: {ordinal: 2, vp: 8, remaining: 1},
    vp: 7,
  },
  formulaVp: 20,
  goalsVp: 7,
  totalVp: 27,
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

  it('states the operand once, then ONE scale of three tiers with their thresholds and prizes — the last notch at the end', () => {
    const w = make();
    expect(w.findAll('[data-dividend-goal-scale]')).lengthOf(1);
    expect(w.find('[data-dividend-count]').text()).eq('9');
    const tiers = w.findAll('[data-dividend-goal]');
    expect(tiers.map((t) => t.attributes('data-dividend-goal'))).deep.eq(['1', '2', '3']);
    expect(tiers.map((t) => t.find('[data-goal-at]').text())).deep.eq(['Dividend goal at 8', 'Dividend goal at 10', 'Dividend goal at 11']);
    expect(tiers.map((t) => t.find('[data-goal-vp]').text())).deep.eq(['Dividend goal prize: +7 VP', 'Dividend goal prize: +8 VP', 'Dividend goal prize: +10 VP']);
    const notches = w.findAll('.con-divledger__notch');
    expect(notches.map((n) => n.attributes('style'))).deep.eq(['left: 33.33333333333333%;', 'left: 66.66666666666666%;', 'left: 100%;']);
  });

  it('a reached tier is a solid notch; the paid gold stops at it, the progress runs on; ONE line names the next tier', () => {
    const w = make();
    const tiers = w.findAll('[data-dividend-goal]');
    expect(tiers.map((t) => t.attributes('data-goal-reached'))).deep.eq(['true', 'false', 'false']);
    expect(tiers[0].classes()).contains('con-divledger__tier--reached');
    expect(w.findAll('.con-divledger__notch').map((n) => n.classes().includes('con-divledger__notch--reached'))).deep.eq([true, false, false]);
    expect(w.find('[data-dividend-goal-scale]').attributes('data-goal-tiers-reached')).eq('1');
    expect(w.find('.con-divledger__fill--paid').attributes('style')).contains(`scaleX(${1 / 3})`);
    expect(w.find('.con-divledger__fill--progress').attributes('style')).contains('scaleX(0.5)');
    expect(w.findAll('[data-goal-state]')).lengthOf(1);
    expect(w.find('[data-goal-state]').text()).eq('Dividend goal: 1 to go for +8 VP');
  });

  it('all three tiers paid: the line says so', () => {
    const done: BotDividendReading = {
      ...READING,
      goal: {
        ...READING.goal,
        tiers: [
          {ordinal: 1, at: 8, vp: 7, reached: true, paid: 7},
          {ordinal: 2, at: 10, vp: 8, reached: true, paid: 8},
          {ordinal: 3, at: 11, vp: 10, reached: true, paid: 10},
        ],
        progress: 1,
        next: undefined,
        vp: 25,
      },
    };
    expect(make({reading: done}).find('[data-goal-state]').text()).eq('Dividend goals: all reached');
  });

  it('the total carries the goals, split into the formula and the goals; «now» until the game ends', () => {
    const live = make();
    expect(live.find('[data-dividend-vp]').text()).eq('27');
    expect(live.find('[data-dividend-total]').text()).contains('Dividend formula 20 + goals 7');
    expect(live.find('.con-divledger__total-label').text()).eq('Dividend total now');
    expect(make({final: true}).find('.con-divledger__total-label').text()).eq('Dividend total');
  });
});
