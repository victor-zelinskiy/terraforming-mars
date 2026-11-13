/*
 * ConsolePromptHead — the ONE head of the prompt-modal family. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): props and three slots, no emits, nothing exposed. It is also the family's one
 * registration point with the decision sequence (`promptSequence.ts`), so the spec is what it renders for its props,
 * what it tells the sequence (present on mount and on a new key, withdraw on unmount) and how it FOLLOWS the
 * sequence's state (the ordinal, the tone shift, the settle and the nudge). The settle is a wait of the flow kernel —
 * the spec drives the kernel's clock. The emblem is the real one (a leaf).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {h, nextTick, VNode} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {PromptTone} from '@/client/console/promptTone';
import {notePromptSubmit, promptSequenceState, resetPromptSequence, SETTLE_SHIFT_MS} from '@/client/console/promptSequence';
import {notePromptRelease, resetPromptHandoff} from '@/client/console/surfaceMotion/promptHandoffModel';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';

function head(props: {tone: PromptTone, promptKey?: string, trigger?: string, titleTag?: string, series?: {index: number, of: number}},
  slots: Record<string, () => VNode> = {}) {
  return mount(ConsolePromptHead, {...globalConfig, props: {kicker: 'CHOICE', title: 'Gain 2 plants or lose 1 heat', ...props}, slots});
}

describe('ConsolePromptHead — the one head of the prompt modals', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetPromptSequence();
    resetPromptHandoff();
  });
  afterEach(() => {
    resetPromptSequence();
    resetPromptHandoff();
    setFlowClock(undefined);
  });

  it('reads in its fixed order: the tone\'s emblem and category, the ask in its title tag, the trigger — and the hosts\' slots in their places', () => {
    const w = head({tone: 'gain', trigger: 'Viral Enhancers'}, {
      'kicker-extra': () => h('i', {class: 'extra'}),
      'decline': () => h('b', {class: 'decline'}),
      'default': () => h('u', {class: 'body'}),
    });
    expect((w.element as Element).tagName).to.eq('HEADER');
    expect(w.classes()).to.deep.eq(['con-prompt-head', 'con-prompt-head--gain']);
    expect(w.attributes('data-prompt-tone')).to.eq('gain');
    expect(w.attributes('style'), 'no handoff — no delayed beat').to.eq(undefined);
    expect(w.find('.con-prompt-head__crest').attributes('aria-hidden')).to.eq('true');

    const kicker = w.find('.con-prompt-head__kicker');
    expect(kicker.find('.con-prompt-head__emblem').classes()).to.include('con-prompt-emblem--gain');
    expect(kicker.find('.con-prompt-head__category').text()).to.eq('CHOICE');
    expect(kicker.find('.extra').exists(), 'the kicker\'s extra').to.eq(true);
    const tag = kicker.find('[data-prompt-tag]');
    expect(tag.classes()).to.deep.eq(['con-prompt-head__tag', 'con-prompt-head__tag--gain']);
    expect(tag.text()).to.eq('▲Benefit');

    const ask = w.find('.con-prompt-head__ask');
    const title = ask.find('.con-prompt-head__title');
    expect(title.element.tagName).to.eq('H2');
    expect(title.text()).to.eq('Gain 2 plants or lose 1 heat');
    expect(ask.find('.decline').exists(), 'the decline plate beside the ask').to.eq(true);
    expect(w.find('.con-prompt-head__trigger').text()).to.eq('Viral Enhancers');
    expect(w.find('.con-prompt-head > .body').exists(), 'the host\'s own content, last').to.eq(true);
  });

  it('follows its props: a loss is tagged ▼, a neutral ask carries no tag, no trigger draws no line, the title tag is the host\'s', async () => {
    const w = head({tone: 'loss', titleTag: 'h3'});
    expect(w.find('[data-prompt-tag]').text()).to.eq('▼Loss');
    expect(w.find('.con-prompt-head__title').element.tagName).to.eq('H3');
    expect(w.find('.con-prompt-head__trigger').exists()).to.eq(false);

    await w.setProps({tone: 'neutral'});
    expect(w.classes()).to.deep.eq(['con-prompt-head', 'con-prompt-head--neutral']);
    expect(w.find('[data-prompt-tag]').exists()).to.eq(false);
    expect(w.find('.con-prompt-head__emblem').classes()).to.include('con-prompt-emblem--neutral');
  });

  it('an empty key opts out of the decision sequence: no ordinal, no settle, nothing presented', async () => {
    const w = head({tone: 'gain'});
    await nextTick();
    expect(promptSequenceState.current).to.eq(undefined);
    expect(w.attributes('data-prompt-ordinal')).to.eq(undefined);
    expect(w.attributes('data-prompt-settling')).to.eq(undefined);
    expect(w.find('[data-prompt-seq]').exists()).to.eq(false);
  });

  it('presents its decision to the sequence and follows it: the ordinal, the tone shift, the settle with its meter, the nudge — and withdraws', async () => {
    const w = head({tone: 'gain', promptKey: 'k1'});
    await nextTick();
    expect(promptSequenceState.current?.key).to.eq('k1');
    expect(w.attributes('data-prompt-ordinal')).to.eq('1');
    expect(w.attributes('data-prompt-settling'), 'the double-tap guard of a first decision').to.eq('1');
    expect(w.find('[data-prompt-seq]').exists(), 'a decision standing alone is not counted').to.eq(false);
    expect(w.find('[data-prompt-settle]').exists(), 'too short to show').to.eq(false);

    // The player answers it; the next decision of the same chain flips the character.
    notePromptSubmit();
    await w.setProps({promptKey: 'k2', tone: 'loss'});
    expect(promptSequenceState.current?.key).to.eq('k2');
    expect(w.attributes('data-prompt-ordinal')).to.eq('2');
    const seq = w.find('[data-prompt-seq]');
    expect(seq.attributes('data-prompt-seq-ordinal')).to.eq('2');
    expect(seq.text()).to.eq('Decision 2');
    expect(w.classes()).to.include.members(['con-prompt-head--loss', 'con-prompt-head--shift', 'con-prompt-head--settling']);
    expect(w.attributes('data-prompt-shift')).to.eq('1');
    expect((w.find('[data-prompt-settle]').element as HTMLElement).style.animationDuration).to.eq(`${SETTLE_SHIFT_MS}ms`);

    // A press absorbed by the settle: one calm pulse per press, replayed by alternating the class.
    promptSequenceState.nudge++;
    await nextTick();
    expect(w.classes()).to.include('con-prompt-head--nudge-a');
    promptSequenceState.nudge++;
    await nextTick();
    expect(w.classes()).to.include('con-prompt-head--nudge-b');
    expect(w.classes()).to.not.include('con-prompt-head--nudge-a');

    clock.advance(SETTLE_SHIFT_MS);
    await nextTick();
    expect(w.attributes('data-prompt-settling'), 'the window closed').to.eq(undefined);
    promptSequenceState.nudge++;
    await nextTick();
    expect(w.classes(), 'a press after the settle pulses nothing').to.include('con-prompt-head--nudge-b');

    w.unmount();
    expect(promptSequenceState.current, 'the head left the screen').to.eq(undefined);
  });

  it('a question of a SERIES counts «k / N» in the ordinal\'s own place; a plate handed over waits for the one before it', () => {
    notePromptRelease();
    const w = head({tone: 'neutral', promptKey: 'k1', series: {index: 2, of: 3}});
    const seq = w.findAll('[data-prompt-seq]');
    expect(seq).to.have.length(1);
    expect(seq[0].attributes('data-series-count')).to.eq('2 / 3');
    expect(seq[0].text()).to.eq('Tag 2 / 3');
    expect(w.attributes('style'), 'the tone beat starts once the plate is there').to.match(/--con-prompt-beat-at:\s*\d+(\.\d+)?ms/);
  });
});
