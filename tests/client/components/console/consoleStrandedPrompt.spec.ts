import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleStrandedPrompt from '@/client/components/console/ConsoleStrandedPrompt.vue';
import {StrandedPrompt} from '@/client/console/consoleLeakDetector';

/*
 * THE STRANDED-PROMPT GUARD PANEL — what the player reads when a server prompt has no serving surface: WHAT is
 * pending and HOW to proceed. What this spec owns: the panel names the prompt when it has a title, always gives the
 * way out with the Menu glyph (through `GamepadGlyph` — never a literal button name), and keeps the raw routing line
 * for the debug flag only. (The unit runner has no RU bundle — a key reads as itself.)
 */
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, required: true}},
  render: () => h('i', {class: 'glyph-stub'}),
});

function mountPanel(stranded: StrandedPrompt) {
  return mount(ConsoleStrandedPrompt, {
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {stranded},
  });
}

describe('ConsoleStrandedPrompt — the guard panel of a prompt nobody serves', () => {
  it('names the pending prompt and the way out, with the Menu glyph', () => {
    const panel = mountPanel({inputType: 'card', taskKind: 'generic', title: 'Select a card to discard'});
    expect(panel.classes()).to.include('con-stranded');
    expect(panel.attributes('role')).to.eq('alertdialog');
    expect(panel.attributes('aria-label')).to.eq('Awaiting decision');
    expect(panel.find('.con-stranded__kicker').text()).to.contain('Awaiting decision');
    expect(panel.find('.con-stranded__title').text()).to.eq('Select a card to discard');
    expect(panel.find('.con-stranded__body').text()).to.eq('This prompt is not available in console mode yet.');
    expect(panel.find('.con-stranded__hint').text()).to.contain('System menu');
    expect(panel.findComponent(GlyphStub).props('control')).to.eq('menu');
  });

  it('a prompt with no title draws no title line; the raw routing line is the debug flag\'s alone', () => {
    const panel = mountPanel({inputType: 'or', taskKind: 'choice', title: ''});
    expect(panel.find('.con-stranded__title').exists()).to.eq(false);
    expect(panel.find('.con-stranded__body').exists()).to.eq(true);
    expect(panel.find('.con-stranded__debug').exists(), 'no `?gpDebug` on this page').to.eq(false);
  });
});
