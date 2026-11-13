/*
 * ConsolePlaygroundStand — the fullscreen chassis a dev showcase renders inside: a head, the ONE scroll area holding
 * the slotted showcase, a foot of pad hints. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md).
 * `ConsolePlaygroundHub` stands it under `ref="stand"` and forwards the pad's intents to `handleIntent` THROUGH THAT
 * REF (App mounts it `standalone`, where it claims the pre-game pad itself) — so the stand is mounted here the way
 * the hub mounts it, under an Options host with a string ref, and the spec reads what that ref carries.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, ref} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {closeConsoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import ConsolePlaygroundStand from '@/client/components/console/menu/ConsolePlaygroundStand.vue';

/** What the hub reads through its ref — the component's whole contract with its parent. */
type StandReach = {handleIntent(intent: GamepadIntent): boolean};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/**
 * The scroll area's stand-in: its slot, a record of every distance it was asked to scroll, and its ROOT exposed by the
 * one name the stand reads it by (`rootEl` — a Vapor child's ref answers no `$el`, components/rootEl.ts).
 */
const scrolled: Array<number> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  setup(_, {expose, slots}) {
    const root = ref<HTMLElement | null>(null);
    expose({
      scrollByPx: (dy: number): void => {
        scrolled.push(dy);
      },
      rootEl: root,
    });
    return () => h('div', {ref: root, class: 'scroll-stub'}, slots.default?.());
  },
});

/** The props a host may add to the title (the hub's and the deep link's own). */
type StandProps = {
  standalone?: boolean,
  sectionSelector?: string,
  padTarget?: () => {handleIntent?: (intent: GamepadIntent) => boolean} | undefined,
};

function mountUnderHost(props: StandProps = {}) {
  const closed = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsolePlaygroundStand, {
      ref: 'stand',
      titleKey: 'Premium cards showcase',
      onClose: () => {
        closed.count++;
      },
      ...props,
    }, {
      // A showcase is a plain document: its own headers are the stand's sections.
      default: () => [h('h2', 'Automated'), h('p', 'faces'), h('h2', ' Active '), h('h3', {class: 'own-head'}, 'Events')],
    })]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ConsoleScrollArea: ScrollStub}},
  });
  return {
    wrapper,
    closed,
    /** Exactly the hub's read: `(this.$refs.stand ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): StandReach => {
      const stand = (wrapper.vm.$refs.stand ?? undefined) as StandReach | undefined;
      if (stand === undefined) {
        throw new Error('the host holds no ref to the stand');
      }
      return stand;
    },
    section: () => (wrapper.find('.cm-stand__section').exists() ? wrapper.find('.cm-stand__section').text() : undefined),
  };
}

const nav = (dir: 'up' | 'down' | 'left'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const press = (button: 'confirm' | 'back' | 'bumperL' | 'bumperR'): GamepadIntent => ({kind: 'press', button});

describe('ConsolePlaygroundStand — the fullscreen chassis of a dev showcase', () => {
  beforeEach(() => {
    scrolled.length = 0;
  });

  afterEach(() => {
    closeConsoleCardZoom();
  });

  it('a dialog named by its title: the showcase inside the ONE scroll area, the pad\'s verbs in the foot, the first section named', async () => {
    const {wrapper, section} = mountUnderHost();
    const dialog = wrapper.find('.cm-stand');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Premium cards showcase'));
    expect(wrapper.find('.cm-stand__kicker').text()).to.eq($t('Playground'));
    expect(wrapper.find('.cm-stand__title').text()).to.eq($t('Premium cards showcase'));
    expect(wrapper.findComponent(ScrollStub).classes()).to.include('cm-stand__scroll');
    expect(wrapper.findAll('.scroll-stub > .cm-stand__body > h2').map((head) => head.text()), 'the slot stands in the scroll area\'s body').to.deep.eq(['Automated', 'Active']);
    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['stickR', 'bumperL', 'bumperR', 'back']);
    expect(wrapper.findAll('.cm-stand__hint').map((hint) => hint.text())).to.deep.eq([$t('Scroll'), $t('Sections'), $t('Back')]);

    // The section under the viewport's top is read off the showcase's own headers once the stand is mounted.
    await nextTick();
    expect(section()).to.eq('Automated');
  });

  it('the foot yields its line while the fullscreen inspector holds the footer', async () => {
    const {wrapper} = mountUnderHost();
    const foot = wrapper.find('.cm-stand__foot').element as HTMLElement;
    expect(foot.style.display).to.eq('');
    openConsoleCardZoom([{name: CardName.ANTS} as CardModel], 0);
    await nextTick();
    expect(foot.style.display, 'hidden, never unmounted').to.eq('none');
    closeConsoleCardZoom();
    await nextTick();
    expect(foot.style.display).to.eq('');
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const stand = reach();
    expect(Object.keys(stand), 'exactly what the stand exposes').to.deep.eq(['handleIntent']);
    expect(stand.handleIntent).to.be.a('function');
    const leaked = ['zoom', 'sectionTitle', 'sectionIdx', 'sections', 'scrollApi', 'jumpSection', 'refreshSectionTitle']
      .filter((key) => (stand as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ and the stick scroll the area, LB / RB walk the sections between two walls, B closes, the rest is swallowed', async () => {
    const {reach, closed, section} = mountUnderHost();
    await nextTick();
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(reach().handleIntent(nav('up'))).to.eq(true);
    expect(scrolled, 'one d-pad step is 220 px').to.deep.eq([220, -220]);
    expect(reach().handleIntent({kind: 'scroll', dx: 0, dy: 0.5})).to.eq(true);
    expect(scrolled[2], 'a deflection is scaled to pixels').to.eq(0.5 * 24 * conUiScale());

    scrolled.length = 0;
    expect(reach().handleIntent(press('bumperR'))).to.eq(true);
    await nextTick();
    expect(section(), 'the next header, trimmed').to.eq('Active');
    // jsdom lays nothing out (every box is at 0): the jump is the header's top against the area's, less the 16 px margin.
    expect(scrolled, 'the area is driven to the header — never scrollIntoView').to.deep.eq([-16]);
    reach().handleIntent(press('bumperR'));
    await nextTick();
    expect(section(), 'the last section is a wall').to.eq('Active');
    reach().handleIntent(press('bumperL'));
    reach().handleIntent(press('bumperL'));
    await nextTick();
    expect(section(), 'and so is the first').to.eq('Automated');

    expect(reach().handleIntent(nav('left')), 'nothing under the stand may react').to.eq(true);
    expect(reach().handleIntent(press('confirm'))).to.eq(true);
    expect(closed.count).to.eq(0);
    expect(reach().handleIntent(press('back'))).to.eq(true);
    expect(closed.count, 'B closes the stand').to.eq(1);
  });

  it('a showcase with its own header markup names its selector; one with no header has no section to name', async () => {
    const {reach, section} = mountUnderHost({sectionSelector: '.own-head'});
    await nextTick();
    expect(section()).to.eq('Events');
    reach().handleIntent(press('bumperR'));
    await nextTick();
    expect(section(), 'a single section — nowhere to jump').to.eq('Events');

    const bare = mountUnderHost({sectionSelector: '.no-such-head'});
    await nextTick();
    expect(bare.section()).to.eq(undefined);
    scrolled.length = 0;
    expect(bare.reach().handleIntent(press('bumperR'))).to.eq(true);
    expect(scrolled, 'no section — no jump').to.deep.eq([]);
  });

  it('an INTERACTIVE showcase gets the pad first: what it takes stops there, what it declines falls through, B is always the stand\'s', () => {
    const offered: Array<GamepadIntent> = [];
    const showcase = {
      handleIntent(intent: GamepadIntent): boolean {
        offered.push(intent);
        return intent.kind === 'nav' && intent.dir === 'down';
      },
    };
    const {reach, closed} = mountUnderHost({padTarget: () => showcase});
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(scrolled, 'the showcase took it — the stand did not scroll').to.deep.eq([]);
    expect(reach().handleIntent(nav('up'))).to.eq(true);
    expect(scrolled, 'declined — the stand\'s own scroll').to.deep.eq([-220]);
    expect(reach().handleIntent(press('back'))).to.eq(true);
    expect(closed.count).to.eq(1);
    expect(offered, 'B was never offered to the showcase').to.deep.eq([nav('down'), nav('up')]);

    // A target that is not resolved yet (the showcase mounts async) is simply skipped.
    const late = mountUnderHost({padTarget: () => undefined});
    expect(late.reach().handleIntent(nav('down'))).to.eq(true);
    expect(scrolled).to.deep.eq([-220, 220]);
  });

  it('STANDALONE (the deep link) claims the pre-game pad itself, and gives it back when it leaves', () => {
    // Module state is bundle-shared: the claim is read as a change of the menu pad's own count.
    const claimed = menuPadState.mountedCount;
    const hosted = mountUnderHost();
    expect(menuPadState.mountedCount, 'under the hub the stand installs nothing — the hub forwards the pad').to.eq(claimed);
    hosted.wrapper.unmount();

    const {wrapper} = mountUnderHost({standalone: true});
    expect(menuPadState.mountedCount, 'one more pre-game screen owns the pad').to.eq(claimed + 1);
    wrapper.unmount();
    expect(menuPadState.mountedCount, 'the pad slot is released with the stand').to.eq(claimed);
  });
});
