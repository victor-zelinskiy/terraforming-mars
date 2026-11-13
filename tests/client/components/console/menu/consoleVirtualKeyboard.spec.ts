/*
 * ConsoleVirtualKeyboard — the on-screen keyboard of the pre-game name entries (a profile, a friend, a seat, a LAN
 * host). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): four props (`initial` · `maxLength` ·
 * `title` · `issue`), three emits (`update` · `commit` · `cancel`). Its five hosts stand it under a ref and route the
 * pad's intents to `handleIntent` THROUGH THAT REF — so it is mounted here the way they mount it, under an Options
 * host with a string ref, and the spec reads what that ref carries.
 *
 * The keys are the REAL `simple-keyboard` (driving it is the component's whole job — a stub would leave nothing to
 * assert), and the panel is teleported to <body>: the spec reads the document, never the host's own element.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

/** What a host reads through its ref — the component's whole contract with its parents. */
type KeyboardReach = {handleIntent(intent: GamepadIntent): boolean};

// The badge is the glyph set's own subject; this spec reads the SEMANTIC control each hint asks it for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

function mountUnderHost(props: {initial?: string, maxLength?: number, title?: string} = {}) {
  /** Everything the host heard, in order: the event's name, then its payload. */
  const heard: Array<Array<unknown>> = [];
  /** The one prop a host changes while the keyboard stands. */
  const live = reactive({issue: ''});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleVirtualKeyboard, {
      ref: 'vkeyboard',
      ...props,
      issue: live.issue,
      onUpdate: (value: string) => {
        heard.push(['update', value]);
      },
      onCommit: (value: string) => {
        heard.push(['commit', value]);
      },
      onCancel: () => {
        heard.push(['cancel']);
      },
    })]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}}});
  return {
    wrapper,
    heard,
    live,
    /** Exactly a host's read: `(this.$refs.vkeyboard ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): KeyboardReach => {
      const keyboard = (wrapper.vm.$refs.vkeyboard ?? undefined) as KeyboardReach | undefined;
      if (keyboard === undefined) {
        throw new Error('the host holds no ref to the keyboard');
      }
      return keyboard;
    },
  };
}

/** The mount is one tick after `mounted` (the ref lives in a Teleport), the key grid one tick after the mount. */
async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
  await nextTick();
}

/** The teleported panel — on the page, not under the host. */
function panel(): Element {
  const overlay = document.body.querySelector('.cm-vk-overlay');
  if (overlay === null) {
    throw new Error('the keyboard is not on the page');
  }
  return overlay;
}
const text = (selector: string): string => (panel().querySelector(selector)?.textContent ?? '').trim();
/** The rendered key grid, by the library's own button names. */
const keys = (): Array<Array<string>> => Array.from(panel().querySelectorAll('.cm-vk-mount .hg-row'))
  .map((row) => Array.from(row.querySelectorAll('.hg-button')).map((key) => key.getAttribute('data-skbtn') ?? ''));
const keyOf = (name: string): Element | null => panel().querySelector(`.cm-vk-mount .hg-button[data-skbtn="${name}"]`);
const cursored = (): Array<string> => Array.from(panel().querySelectorAll('.cm-vk__key--cursor')).map((key) => key.getAttribute('data-skbtn') ?? '');
const hintControls = (): Array<string | null> => Array.from(panel().querySelectorAll('.cm-vk-panel__hints .glyph-stub')).map((glyph) => glyph.getAttribute('data-control'));

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const press = (button: 'confirm' | 'back' | 'secondary' | 'inspect' | 'bumperL' | 'bumperR' | 'triggerR' | 'view'): GamepadIntent => ({kind: 'press', button});

/** Override navigator.languages + navigator.language (jsdom exposes them read-only) — what the layouts are resolved from. */
function setLanguages(langs: ReadonlyArray<string>): void {
  Object.defineProperty(navigator, 'languages', {value: [...langs], configurable: true});
  Object.defineProperty(navigator, 'language', {value: langs[0] ?? '', configurable: true});
}

/** A physical key, as the window hears it; answers whether the keyboard took it. */
function physicalKey(key: string): boolean {
  const event = new KeyboardEvent('keydown', {key, cancelable: true});
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('ConsoleVirtualKeyboard — the on-screen keyboard of a name entry', () => {
  // The environment is bundle-shared: what this spec stubs on `navigator` is restored exactly (both properties live
  // on the prototype — the stubbed own one is deleted).
  const originalLanguages = Object.getOwnPropertyDescriptor(navigator, 'languages');
  const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');

  beforeEach(() => {
    setLanguages(['en-US']);
  });

  afterEach(() => {
    if (originalLanguages === undefined) {
      delete (navigator as unknown as {languages?: unknown}).languages;
    } else {
      Object.defineProperty(navigator, 'languages', originalLanguages);
    }
    if (originalLanguage === undefined) {
      delete (navigator as unknown as {language?: unknown}).language;
    } else {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('a dialog teleported to <body>: the title, the layout\'s badge, the draft with its count, the keys of the user\'s layout, the pad\'s verbs', async () => {
    const {wrapper} = mountUnderHost({initial: 'Victor', title: 'New profile'});
    await settle();
    expect(wrapper.find('.cm-vk-overlay').exists(), 'not under its host').to.eq(false);
    expect(panel().parentElement, 'on the page itself').to.eq(document.body);
    expect(panel().getAttribute('role')).to.eq('dialog');
    expect(panel().getAttribute('aria-label')).to.eq($t('On-screen keyboard'));
    expect(text('.cm-vk-panel__title')).to.eq($t('New profile'));
    expect(text('.cm-vk-panel__lang')).to.eq('ENG');

    expect(text('.cm-vk-field__text')).to.eq('Victor');
    expect(text('.cm-vk-field__count')).to.eq('6/32');
    expect(panel().querySelector('.cm-vk-field--empty'), 'a draft is no placeholder').to.eq(null);
    expect(panel().querySelector('.cm-vk-field__issue'), 'no issue line while the host has none').to.eq(null);

    const grid = keys();
    expect(grid.map((row) => row.join(' '))).to.deep.eq([
      '1 2 3 4 5 6 7 8 9 0',
      'q w e r t y u i o p',
      'a s d f g h j k l',
      '{shift} z x c v b n m {bksp}',
      '- {space} {done}',
    ]);
    expect(keyOf('{done}')?.textContent).to.eq('✓');
    expect(keyOf('{space}')?.textContent).to.eq($t('Space bar'));
    expect(keyOf('{done}')?.classList.contains('cm-vk__key--done')).to.eq(true);
    expect(keyOf('{space}')?.classList.contains('cm-vk__key--fn'), 'a function key').to.eq(true);
    expect(keyOf('{space}')?.classList.contains('cm-vk__key--wide'), 'and the wide one').to.eq(true);
    expect(cursored(), 'the cursor starts on the first letter').to.deep.eq(['q']);

    expect(hintControls(), 'one layout — no «Input language» verb').to.deep.eq(['dpad', 'confirm', 'secondary', 'bumperR', 'inspect', 'back']);
    expect(Array.from(panel().querySelectorAll('.cm-vk-panel__hint')).map((hint) => (hint.textContent ?? '').trim()))
      .to.deep.eq([$t('Navigate'), $t('Type a key'), $t('Backspace'), $t('Space bar'), $t('Confirm'), $t('Cancel')]);
  });

  it('with nothing typed it asks for a name; the host\'s issue is said above the keys, and follows the host', async () => {
    const {live} = mountUnderHost();
    await settle();
    expect(text('.cm-vk-panel__title'), 'the default title').to.eq($t('Player name'));
    expect(panel().querySelector('.cm-vk-field')?.classList.contains('cm-vk-field--empty')).to.eq(true);
    expect(text('.cm-vk-field__text')).to.eq($t('Enter a player name'));
    expect(text('.cm-vk-field__count')).to.eq('0/32');

    live.issue = 'This name cannot be used';
    await nextTick();
    expect(text('.cm-vk-field__issue')).to.eq($t('This name cannot be used'));
    live.issue = '';
    await nextTick();
    expect(panel().querySelector('.cm-vk-field__issue')).to.eq(null);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', async () => {
    const {reach} = mountUnderHost();
    await settle();
    const keyboard = reach();
    expect(Object.keys(keyboard), 'exactly what the keyboard exposes').to.deep.eq(['handleIntent']);
    expect(keyboard.handleIntent).to.be.a('function');
    // Neither the keyboard's state, its library handle nor its other functions are reachable through the ref.
    const leaked = ['value', 'layouts', 'shift', 'cursorRow', 'cursorCol', 'keyboard', 'keyGrid', 'press', 'moveTo', 'toggleLang', 'initial', 'title']
      .filter((key) => (keyboard as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF drives the keys: the d-pad walks a cursor between walls, A types the cursored key, X · RB · LB · Y · B are the hotkeys; every intent is consumed', async () => {
    const {reach, heard} = mountUnderHost({initial: 'Vi', maxLength: 5});
    await settle();
    expect(reach().handleIntent(nav('left')), 'the first column is a wall').to.eq(true);
    expect(cursored()).to.deep.eq(['q']);
    expect(reach().handleIntent(nav('right'))).to.eq(true);
    expect(cursored(), 'ONE key wears the cursor').to.deep.eq(['w']);

    expect(reach().handleIntent(press('confirm'))).to.eq(true);
    await nextTick();
    expect(text('.cm-vk-field__text'), 'the draft goes on from the host\'s initial value').to.eq('Viw');
    expect(text('.cm-vk-field__count')).to.eq('3/5');
    expect(reach().handleIntent(press('secondary')), 'X — backspace').to.eq(true);
    expect(reach().handleIntent(press('bumperR')), 'RB — space').to.eq(true);
    expect(heard).to.deep.eq([['update', 'Viw'], ['update', 'Vi'], ['update', 'Vi ']]);

    // LB — shift: the same grid in capitals, the cursor on the same place.
    expect(reach().handleIntent(press('bumperL'))).to.eq(true);
    await settle();
    expect(keys()[1].join(' ')).to.eq('Q W E R T Y U I O P');
    expect(cursored()).to.deep.eq(['W']);
    reach().handleIntent(press('confirm'));
    reach().handleIntent(press('confirm'));
    reach().handleIntent(press('confirm'));
    await nextTick();
    expect(text('.cm-vk-field__text'), 'the host\'s `maxLength` is the library\'s limit').to.eq('Vi WW');
    expect(text('.cm-vk-field__count')).to.eq('5/5');
    expect(heard.slice(3)).to.deep.eq([['update', 'Vi W'], ['update', 'Vi WW']]);

    // The on-screen ✓ is one more way to confirm: ↓ to the last row (the column is clamped), → to its last key.
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    expect(cursored(), 'the last row is a wall').to.deep.eq(['{space}']);
    reach().handleIntent(nav('right'));
    reach().handleIntent(nav('right'));
    expect(cursored()).to.deep.eq(['{done}']);
    reach().handleIntent(press('confirm'));
    expect(reach().handleIntent(press('inspect')), 'Y — confirm from anywhere').to.eq(true);
    expect(reach().handleIntent(press('back')), 'B — cancel').to.eq(true);
    expect(heard.slice(5)).to.deep.eq([['commit', 'Vi WW'], ['commit', 'Vi WW'], ['cancel']]);

    // What it has no use for is still consumed — the keyboard owns the pad while it stands.
    expect(reach().handleIntent(press('triggerR')), 'one layout — nothing to cycle').to.eq(true);
    expect(reach().handleIntent(press('view'))).to.eq(true);
    expect(reach().handleIntent({kind: 'release', button: 'confirm'})).to.eq(true);
    await settle();
    expect(text('.cm-vk-panel__lang')).to.eq('ENG');
    expect(heard).to.have.length(8);
  });

  it('TWO layouts (the user\'s own languages): the first one stands; RT and the on-screen language key cycle them; the verb is offered', async () => {
    setLanguages(['ru-RU', 'en-US']);
    const {reach} = mountUnderHost();
    await settle();
    expect(text('.cm-vk-panel__lang')).to.eq('РУС');
    expect(keys()[1].join(' ')).to.eq('й ц у к е н г ш щ з х');
    expect(keys()[4], 'the language key leads the last row').to.deep.eq(['{lang}', '-', '{space}', '{done}']);
    expect(keyOf('{lang}')?.textContent, 'it names the layout it switches TO').to.eq('ENG');
    expect(hintControls()).to.deep.eq(['dpad', 'confirm', 'secondary', 'bumperR', 'triggerR', 'inspect', 'back']);
    expect(cursored()).to.deep.eq(['й']);

    expect(reach().handleIntent(press('triggerR'))).to.eq(true);
    await settle();
    expect(text('.cm-vk-panel__lang')).to.eq('ENG');
    expect(keys()[1].join(' ')).to.eq('q w e r t y u i o p');
    expect(keyOf('{lang}')?.textContent).to.eq('РУС');
    expect(cursored(), 'the cursor keeps its place on the new grid').to.deep.eq(['q']);

    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    expect(cursored()).to.deep.eq(['{lang}']);
    reach().handleIntent(press('confirm'));
    await settle();
    expect(text('.cm-vk-panel__lang'), 'the ring wraps').to.eq('РУС');
    expect(cursored()).to.deep.eq(['{lang}']);
  });

  it('a physical keyboard is a convenience of the same entry — and it leaves with the keyboard', async () => {
    const {wrapper, heard} = mountUnderHost({initial: 'Vi'});
    await settle();
    expect(physicalKey('k'), 'a character is typed').to.eq(true);
    expect(physicalKey('Backspace')).to.eq(true);
    expect(physicalKey('ArrowLeft'), 'a key it has no use for is left alone').to.eq(false);
    expect(physicalKey('Enter')).to.eq(true);
    expect(physicalKey('Escape')).to.eq(true);
    expect(heard).to.deep.eq([['update', 'Vik'], ['update', 'Vi'], ['commit', 'Vi'], ['cancel']]);

    wrapper.unmount();
    expect(document.body.querySelector('.cm-vk-overlay'), 'the panel left the page').to.eq(null);
    expect(physicalKey('Enter'), 'and its window listener with it').to.eq(false);
    expect(heard).to.have.length(4);
  });
});
