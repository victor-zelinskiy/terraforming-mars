/*
 * ConsoleEntryPrompt — the consented console-mode entry prompt. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md) with no props and no emits (GamepadLayer owns the input): what it renders — a dialog
 * teleported to the body, the question, and the two answers by their SEMANTIC controls. The unit runner renders the
 * English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import ConsoleEntryPrompt from '@/client/components/console/ConsoleEntryPrompt.vue';

// The badge is the glyph set's subject; this spec reads which CONTROL each answer is handed.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

function prompt() {
  return mount(ConsoleEntryPrompt, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}}});
}

/** The prompt is teleported: it stands in the body, not under the component's own place. */
function dialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.con-entry');
}

describe('ConsoleEntryPrompt — «Controller detected»', () => {
  it('stands in the BODY as a dialog that names itself and asks the question', () => {
    prompt();
    const el = dialog();
    expect(el, 'teleported to the body').to.not.eq(null);
    expect(el!.parentElement).to.eq(document.body);
    expect(el!.getAttribute('role')).to.eq('dialog');
    expect(el!.getAttribute('aria-label')).to.eq($t('Controller detected'));
    expect(el!.querySelector('.con-entry__card > .con-entry__title')?.textContent).to.eq($t('Controller detected'));
    expect(el!.querySelector('.con-entry__card > .con-entry__body')?.textContent)
      .to.eq($t('Switch to the console interface? Optimized for TV and gamepad.'));
  });

  it('offers two answers by their SEMANTIC controls — confirm switches (the marked one), back stays', () => {
    const w = prompt();
    const actions = Array.from(dialog()!.querySelectorAll('.con-entry__actions > .con-entry__action'));
    expect(actions).to.have.lengthOf(2);
    expect(actions.map((a) => a.querySelector('.glyph-stub')?.getAttribute('data-control'))).to.deep.eq(['confirm', 'back']);
    expect(actions.map((a) => a.querySelector('span')?.textContent)).to.deep.eq([$t('Switch'), $t('Stay here')]);
    expect(actions.map((a) => a.classList.contains('con-entry__action--yes'))).to.deep.eq([true, false]);
    // The same two badges through the component tree (a teleport moves the DOM, not the tree).
    expect(w.findAllComponents(GlyphStub).map((g) => g.props('control'))).to.deep.eq(['confirm', 'back']);
  });

  it('leaves the body with the component — nothing of it stays behind', () => {
    const w = prompt();
    expect(dialog()).to.not.eq(null);
    w.unmount();
    expect(dialog()).to.eq(null);
  });
});
