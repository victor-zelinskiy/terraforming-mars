/*
 * ConsoleLanguagePicker — the main menu's LANGUAGE overlay: a cursor list of the three maintained locales. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no prop; the cursor starts on the CURRENT
 * language; picking the current one (or B) closes the overlay — picking another stores it and reloads the page (that
 * road is not walked here: the reload is the page's). `ConsoleMainMenu` stands it under `ref="language"` and routes
 * the pad's intents to `handleIntent` THROUGH THAT REF — so the picker is mounted here the way the menu mounts it,
 * under an Options host with a string ref, and the spec reads what that ref carries.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {LANGUAGES} from '@/common/constants';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import ConsoleLanguagePicker from '@/client/components/console/menu/ConsoleLanguagePicker.vue';

/** What the menu reads through its ref — the component's whole contract with its parent. */
type PickerReach = {handleIntent(intent: GamepadIntent): boolean};

// The badge is the glyph set's own subject; this spec reads the SEMANTIC control the overlay asks it for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

function mountUnderHost() {
  const closed = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleLanguagePicker, {
      ref: 'language',
      onClose: () => {
        closed.count++;
      },
    })]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}}});
  return {
    wrapper,
    closed,
    /** Exactly the menu's read: `(this.$refs.language ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): PickerReach => {
      const picker = (wrapper.vm.$refs.language ?? undefined) as PickerReach | undefined;
      if (picker === undefined) {
        throw new Error('the host holds no ref to the picker');
      }
      return picker;
    },
    cursor: () => wrapper.findAll('button.cm-lang').map((row) => row.classes().includes('cm-lang--cursor')),
  };
}

const nav = (dir: 'up' | 'down' | 'left'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleLanguagePicker — the main menu\'s language overlay', () => {
  beforeEach(() => {
    PreferencesManager.resetForTest();
    PreferencesManager.INSTANCE.set('lang', 'en');
  });

  afterEach(() => {
    PreferencesManager.INSTANCE.set('lang', 'ru');
    PreferencesManager.resetForTest();
  });

  it('a dialog of the three maintained locales — code and native name; the CURRENT one is marked and holds the cursor', () => {
    const {wrapper, cursor} = mountUnderHost();
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Language'));
    expect(dialog.find('.cm-overlay__card > .cm-overlay__title').text()).to.eq($t('Language'));

    const rows = wrapper.findAll('.cm-langlist > button.cm-lang');
    expect(rows.map((row) => row.find('.cm-lang__code').text())).to.deep.eq(['RU', 'EN', 'UA']);
    expect(rows.map((row) => row.find('.cm-lang__name').text())).to.deep.eq([LANGUAGES.ru[0], LANGUAGES.en[0], LANGUAGES.ua[0]]);
    expect(rows.map((row) => row.classes().includes('cm-lang--current'))).to.deep.eq([false, true, false]);
    expect(rows.map((row) => row.find('.cm-lang__current-tag').exists())).to.deep.eq([false, true, false]);
    expect(rows[1].find('.cm-lang__current-tag').text()).to.eq($t('Current'));
    expect(cursor(), 'the cursor starts on the language in use').to.deep.eq([false, true, false]);

    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'back']);
    expect(wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text())).to.deep.eq([$t('Select'), $t('Close')]);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const picker = reach();
    expect(Object.keys(picker), 'exactly what the picker exposes').to.deep.eq(['handleIntent']);
    expect(picker.handleIntent).to.be.a('function');
    // Neither the picker's state nor its other function is reachable through the ref.
    const leaked = ['currentLang', 'cursor', 'options', 'pick', 'SHOWN']
      .filter((key) => (picker as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ walk the cursor and stop at the ends; every intent is consumed', async () => {
    const {reach, cursor} = mountUnderHost();
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    await nextTick();
    expect(cursor()).to.deep.eq([false, false, true]);
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursor(), 'the last row is a wall, never a wrap').to.deep.eq([false, false, true]);
    reach().handleIntent(nav('up'));
    reach().handleIntent(nav('up'));
    reach().handleIntent(nav('up'));
    await nextTick();
    expect(cursor(), 'and so is the first').to.deep.eq([true, false, false]);
    expect(reach().handleIntent(nav('left')), 'an intent it has no use for is still consumed — the overlay owns the pad').to.eq(true);
    await nextTick();
    expect(cursor()).to.deep.eq([true, false, false]);
  });

  it('B closes; A on the CURRENT language closes too and stores nothing; a pointer moves the cursor and a click picks', async () => {
    const {wrapper, reach, closed, cursor} = mountUnderHost();
    expect(reach().handleIntent({kind: 'press', button: 'back'})).to.eq(true);
    expect(closed.count, 'B').to.eq(1);
    expect(reach().handleIntent({kind: 'press', button: 'confirm'})).to.eq(true);
    expect(closed.count, 'A on the language in use').to.eq(2);

    const rows = wrapper.findAll('button.cm-lang');
    await rows[2].trigger('mousemove');
    expect(cursor(), 'the pointer carries the cursor').to.deep.eq([false, false, true]);
    await rows[1].trigger('click');
    expect(closed.count, 'a click on the language in use').to.eq(3);
    expect(cursor(), 'a pick leaves the cursor on the picked row').to.deep.eq([false, true, false]);
    expect(PreferencesManager.INSTANCE.values().lang, 'nothing was stored').to.eq('en');
  });
});
