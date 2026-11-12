import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {$t} from '@/client/directives/i18n';
import {promptOutcomeLabelKey} from '@/client/console/promptTone';
import ConsolePromptOutcome from '@/client/components/console/foundation/ConsolePromptOutcome.vue';

// The emblem is a leaf of a dozen lines — mounted for real: the footer's own class must land on its root.
function outcome(props: Record<string, unknown>) {
  return mount(ConsolePromptOutcome, {...globalConfig, props: {...props}});
}

const STEEL = {key: 'steel', iconClass: 'resource_icon resource_icon--steel', delta: 2, from: '3', to: '5'};
const MC_PROD = {key: 'megacredits-prod', iconClass: 'resource_icon resource_icon--megacredits', prod: true, delta: -1, from: '+3', to: '+2'};
const BARE = {key: 'heat', iconClass: 'resource_icon resource_icon--heat', delta: -4};

describe('ConsolePromptOutcome — the consequence footer of a prompt', () => {
  it('nothing chosen yet: the tone\'s own label, its emblem, and what is still owed — never a blank', () => {
    const w = outcome({tone: 'loss', pending: 'Choose a production'});
    expect(w.classes()).to.include.members(['con-prompt-outcome', 'con-prompt-outcome--loss']);
    expect(w.attributes('data-prompt-outcome')).to.not.eq(undefined);
    expect(w.attributes('data-prompt-outcome-tone')).to.eq('loss');
    expect(w.attributes('role')).to.eq('status');
    expect(w.find('.con-prompt-outcome__label > span').text()).to.eq($t(promptOutcomeLabelKey('loss')));
    const emblem = w.find('.con-prompt-outcome__label > svg');
    expect(emblem.classes()).to.include.members(['con-prompt-emblem', 'con-prompt-emblem--loss', 'con-prompt-outcome__emblem']);
    expect(emblem.attributes('data-prompt-emblem')).to.eq('loss');
    expect(w.find('.con-prompt-outcome__pending').text()).to.eq('Choose a production');
    expect(w.findAll('.con-prompt-outcome__item')).to.have.length(0);
    expect(w.find('[data-prompt-meter]').exists(), 'no budget — no meter').to.eq(false);
  });

  it('every consequence is a pool, its SIGNED delta and `current → resulting`', () => {
    const w = outcome({tone: 'neutral', items: [STEEL, MC_PROD, BARE], pending: 'never shown'});
    expect(w.find('.con-prompt-outcome__pending').exists()).to.eq(false);
    const items = w.findAll('.con-prompt-outcome__item');
    expect(items.map((i) => i.attributes('data-prompt-outcome-item'))).to.deep.eq(['steel', 'megacredits-prod', 'heat']);
    expect(items.map((i) => i.find('.con-prompt-outcome__icon > i').classes().join(' ')))
      .to.deep.eq([STEEL.iconClass, MC_PROD.iconClass, BARE.iconClass]);
    expect(items.map((i) => i.find('.con-prompt-outcome__icon').classes().includes('con-prompt-outcome__icon--prod')), 'a production pool sits on the plate')
      .to.deep.eq([false, true, false]);
    // The minus is the typographic one («−», U+2212), a gain always wears its plus.
    expect(items.map((i) => i.find('.con-prompt-outcome__delta').text())).to.deep.eq(['+2', '−1', '−4']);
    expect(items.map((i) => i.find('.con-prompt-outcome__delta').classes().filter((c) => c !== 'con-prompt-outcome__delta')))
      .to.deep.eq([['con-prompt-outcome__delta--plus'], ['con-prompt-outcome__delta--minus'], ['con-prompt-outcome__delta--minus']]);
    expect(items[0].find('.con-prompt-outcome__fromto').text().replace(/\s+/g, '')).to.eq('3→5');
    expect(items[1].find('.con-prompt-outcome__fromto').text().replace(/\s+/g, '')).to.eq('+3→+2');
    expect(items[2].find('.con-prompt-outcome__fromto').exists(), 'no honest pair — no arrow').to.eq(false);
  });

  it('the budget readout turns «ready» when it is spent, and a label key overrides the tone\'s', async () => {
    const w = outcome({tone: 'gain', items: [STEEL], meter: {done: 1, of: 2}, labelKey: 'You will pay'});
    expect(w.find('.con-prompt-outcome__label > span').text()).to.eq($t('You will pay'));
    const meter = w.find('[data-prompt-meter]');
    expect(meter.classes()).to.contain('con-prompt-outcome__meter');
    expect(meter.classes()).to.not.contain('con-prompt-outcome__meter--ready');
    expect(meter.text().replace(/\s+/g, '')).to.eq('1/2');
    await w.setProps({meter: {done: 2, of: 2}, labelKey: ''});
    expect(w.find('[data-prompt-meter]').classes()).to.contain('con-prompt-outcome__meter--ready');
    expect(w.find('.con-prompt-outcome__label > span').text()).to.eq($t(promptOutcomeLabelKey('gain')));
  });
});
