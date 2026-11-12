/*
 * GamepadHintBar — the contextual hint bar. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * no props, no emits, nothing exposed — its whole input is MODULE state (the input mode and the focus engine's
 * scope / focus kind / verb), so the spec is what it renders for that state and that it FOLLOWS it. Mounted WITHOUT
 * the i18n plugin on purpose: the component imports `$t` itself, and a Vue warning fails the test. The glyph is the
 * real `GamepadGlyph` (a leaf — the badge of the control it is handed).
 */
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import GamepadHintBar from '@/client/components/gamepad/GamepadHintBar.vue';
import {FocusKind, focusState} from '@/client/gamepad/focusEngine';
import {InputMode, inputModeState} from '@/client/gamepad/inputModeState';
import {hintsFor} from '@/client/gamepad/hintModel';
import {activeGlyphSet} from '@/client/gamepad/glyphSets';

function bar() {
  return mount(GamepadHintBar, {global: {config: globalConfig.global.config}});
}

describe('GamepadHintBar — the contextual hint bar', () => {
  // Module state is bundle-shared: what the spec moves is put back for every later spec.
  let before: {mode: InputMode, scopeId: string, focusKind: FocusKind, focusVerb: string};

  beforeEach(() => {
    before = {mode: inputModeState.mode, scopeId: focusState.scopeId, focusKind: focusState.focusKind, focusVerb: focusState.focusVerb};
    inputModeState.mode = 'gamepad';
    focusState.scopeId = 'mainMenu';
    focusState.focusKind = 'action';
    focusState.focusVerb = '';
  });
  afterEach(() => {
    inputModeState.mode = before.mode;
    focusState.scopeId = before.scopeId;
    focusState.focusKind = before.focusKind;
    focusState.focusVerb = before.focusVerb;
  });

  it('with the pointer in charge the bar is not there', () => {
    inputModeState.mode = 'pointer';
    const w = bar();
    expect(w.find('.gp-hintbar').exists()).to.eq(false);
    expect(w.find('.gp-glyph').exists()).to.eq(false);
  });

  it('in gamepad mode: one item per hint of the active scope and focus kind — the glyph of its control, its label translated', () => {
    const w = bar();
    const hints = hintsFor('mainMenu', 'action', '');
    expect(hints.length, 'the scope has hints to show').to.be.greaterThan(0);
    expect(w.classes()).to.deep.eq(['gp-hintbar']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    const items = w.findAll('.gp-hintbar > .gp-hintbar__item');
    expect(items.map((i) => i.find('.gp-hintbar__label').text())).to.deep.eq(hints.map((hint) => $t(hint.label)));
    const glyphs = activeGlyphSet();
    expect(items.map((i) => i.find('.gp-glyph').text())).to.deep.eq(hints.map((hint) => glyphs[hint.control].label));
    for (const [i, hint] of hints.entries()) {
      expect(items[i].find('.gp-glyph').classes(), hint.label).to.include('gp-glyph--' + glyphs[hint.control].shape);
    }
  });

  it('FOLLOWS the module state — the focused element\'s own verb, a disabled control, another scope, the pointer taking over', async () => {
    const w = bar();
    const labels = () => w.findAll('.gp-hintbar__label').map((l) => l.text());
    const expected = (scope: string, kind: FocusKind, verb: string) => hintsFor(scope, kind, verb).map((hint) => $t(hint.label));

    focusState.focusVerb = 'Create game';
    await nextTick();
    expect(labels()).to.deep.eq(expected('mainMenu', 'action', 'Create game'));
    expect(labels(), 'the exact A-verb stands in the row').to.include($t('Create game'));

    focusState.focusKind = 'disabled';
    await nextTick();
    expect(labels()).to.deep.eq(expected('mainMenu', 'disabled', 'Create game'));
    expect(labels(), 'a disabled control offers no A').to.not.include($t('Create game'));

    focusState.scopeId = 'dialog';
    focusState.focusKind = 'action';
    focusState.focusVerb = '';
    await nextTick();
    expect(labels()).to.deep.eq(expected('dialog', 'action', ''));

    inputModeState.mode = 'pointer';
    await nextTick();
    expect(w.find('.gp-hintbar').exists()).to.eq(false);
  });
});
