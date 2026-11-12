import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {PromptTone} from '@/client/console/promptTone';
import ConsolePromptEmblem from '@/client/components/console/foundation/ConsolePromptEmblem.vue';

function emblem(tone: PromptTone, attrs: Record<string, unknown> = {}) {
  return mount(ConsolePromptEmblem, {...globalConfig, props: {tone}, attrs});
}

describe('ConsolePromptEmblem — a decision\'s tone as a SHAPE', () => {
  it('gain is a circle with a plus', () => {
    const w = emblem('gain');
    expect((w.element as Element).tagName.toLowerCase()).to.eq('svg');
    expect(w.classes()).to.include.members(['con-prompt-emblem', 'con-prompt-emblem--gain']);
    expect(w.attributes('data-prompt-emblem')).to.eq('gain');
    expect(w.attributes('aria-hidden'), 'decorative — the tag beside it carries the word').to.eq('true');
    expect(w.findAll('circle')).to.have.length(1);
    expect(w.findAll('path')).to.have.length(1);
  });

  it('loss is a warning triangle with a minus — no circle', () => {
    const w = emblem('loss');
    expect(w.classes()).to.include.members(['con-prompt-emblem', 'con-prompt-emblem--loss']);
    expect(w.attributes('data-prompt-emblem')).to.eq('loss');
    expect(w.findAll('circle')).to.have.length(0);
    const paths = w.findAll('path').map((p) => p.attributes('d'));
    expect(paths).to.deep.eq(['M10 1.9 L18.6 17.1 H1.4 Z', 'M6.4 12.3 H13.6']);
  });

  it('neutral is the console\'s own diamond', () => {
    const w = emblem('neutral');
    expect(w.classes()).to.include.members(['con-prompt-emblem', 'con-prompt-emblem--neutral']);
    expect(w.attributes('data-prompt-emblem')).to.eq('neutral');
    expect(w.findAll('circle')).to.have.length(0);
    const paths = w.findAll('path').map((p) => p.attributes('d'));
    expect(paths).to.deep.eq(['M10 1.8 L18.2 10 L10 18.2 L1.8 10 Z', 'M10 6.6 L13.4 10 L10 13.4 L6.6 10 Z']);
  });

  it('the template STARTS WITH ITS ROOT — the host\'s class lands on the emblem, and it follows its tone', async () => {
    const w = emblem('gain', {class: 'con-prompt-outcome__emblem'});
    expect(w.classes()).to.include.members(['con-prompt-emblem', 'con-prompt-outcome__emblem']);
    await w.setProps({tone: 'loss'});
    expect(w.classes()).to.include.members(['con-prompt-emblem--loss', 'con-prompt-outcome__emblem']);
    expect(w.classes()).to.not.contain('con-prompt-emblem--gain');
    expect(w.findAll('circle')).to.have.length(0);
  });
});
