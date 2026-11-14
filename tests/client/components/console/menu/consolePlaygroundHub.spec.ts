/*
 * ConsolePlaygroundHub — the admin-only «Полигон» overlay of the main menu: a cursor list of the dev stands; picking
 * one opens it FULLSCREEN in the shared stand chassis, teleported out of the menu. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): no prop. `ConsoleMainMenu` stands it under `ref="playground"` and routes
 * the pad's intents to `handleIntent` THROUGH THAT REF — so the hub is mounted here the way the menu mounts it, under
 * an Options host with a string ref, and the spec reads what that ref carries.
 *
 * The stand below it is the REAL `ConsolePlaygroundStand` (a `<script setup>` component too): the hub forwards the pad
 * through ITS ref, so a stand that stopped exposing `handleIntent` goes red here.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import ConsolePlaygroundHub from '@/client/components/console/menu/ConsolePlaygroundHub.vue';
import ConsolePlaygroundStand from '@/client/components/console/menu/ConsolePlaygroundStand.vue';

/** What the menu reads through its ref — the component's whole contract with its parent. */
type HubReach = {handleIntent(intent: GamepadIntent): boolean};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The stand's scroll area: its slot, and a record of every distance it was asked to scroll. */
const scrolled: Array<number> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  methods: {
    scrollByPx(dy: number): void {
      scrolled.push(dy);
    },
  },
  render() {
    return h('div', {class: 'scroll-stub'}, this.$slots.default?.());
  },
});

/**
 * Every showcase is a lazy binding the hub IMPORTS (`consolePlaygroundHubAsync.ts` — `lazyComponent`, a Vapor async wrapper), and an
 * imported lazy binding answers to ONE stub key, `VaporAsyncComponentWrapper` (neither its import's name nor its tag) — so
 * this is the stand-in of all five, and no real catalog is loaded. test-utils cannot tell two of them apart (each is
 * named `VaporAsyncComponentWrapper`), so WHICH stand is open is read off what the hub hands the chassis — its title, its
 * section selector, its pad target. The stand-in says how it was mounted, and it is an INTERACTIVE showcase that takes
 * ▼ and declines the rest (what the two interactive stands hand to the chassis as their pad target, through the hub's
 * own ref to the showcase).
 */
const offered: Array<GamepadIntent> = [];
const ShowcaseStub = defineComponent({
  name: 'VaporAsyncComponentWrapper',
  props: {embedded: Boolean},
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      offered.push(intent);
      return intent.kind === 'nav' && intent.dir === 'down';
    },
  },
  render: () => h('div', {class: 'showcase-stub'}),
});

function mountUnderHost() {
  const closed = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsolePlaygroundHub, {
      ref: 'playground',
      onClose: () => {
        closed.count++;
      },
    })]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      // The stand is teleported to the body in the product; here it stays inside the wrapper.
      stubs: {GamepadGlyph: GlyphStub, ConsoleScrollArea: ScrollStub, VaporAsyncComponentWrapper: ShowcaseStub, teleport: true},
    },
  });
  return {
    wrapper,
    closed,
    /** Exactly the menu's read: `(this.$refs.playground ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): HubReach => {
      const hub = (wrapper.vm.$refs.playground ?? undefined) as HubReach | undefined;
      if (hub === undefined) {
        throw new Error('the host holds no ref to the hub');
      }
      return hub;
    },
    cursor: () => wrapper.findAll('button.cm-pg__row').map((row) => row.classes().includes('cm-pg__row--cursor')).indexOf(true),
    stand: () => wrapper.findComponent(ConsolePlaygroundStand),
  };
}

const nav = (dir: 'up' | 'down'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

/** The five stands, in the list's order: the row's name and what the chassis is handed for it. */
const STANDS = [
  {title: 'Premium cards showcase', sections: 'h2', interactive: false},
  {title: 'Player cubes showcase', sections: '.cube-playground__section-head', interactive: false},
  {title: 'Card lore showcase', sections: '.lore-playground__caption', interactive: false},
  {title: 'Redux resolutions showcase', sections: 'h2', interactive: true},
  {title: 'Tenders showcase', sections: 'h2', interactive: true},
];

describe('ConsolePlaygroundHub — the menu\'s list of dev stands', () => {
  beforeEach(() => {
    scrolled.length = 0;
    offered.length = 0;
  });

  it('a dialog listing the five stands — a glyph, a name and what it shows; the cursor on the first; no stand open', () => {
    const {wrapper, cursor, stand} = mountUnderHost();
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Playground'));
    expect(dialog.find('.cm-overlay__title').text()).to.eq($t('Playground'));

    const rows = wrapper.findAll('.cm-pg__list > button.cm-pg__row');
    expect(rows.map((row) => row.find('.cm-pg__label').text())).to.deep.eq(STANDS.map((s) => $t(s.title)));
    expect(rows.map((row) => row.find('.cm-pg__glyph').text())).to.deep.eq(['❏', '⬢', '✎', '⚖', '§']);
    expect(rows.every((row) => row.find('.cm-pg__sub').text() !== ''), 'every stand says what it shows').to.eq(true);
    expect(cursor()).to.eq(0);

    expect(wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text())).to.deep.eq([$t('Open'), $t('Back')]);
    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'back']);
    expect(stand().exists()).to.eq(false);
    expect(wrapper.find('.showcase-stub').exists(), 'no showcase is mounted before its stand is opened').to.eq(false);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const hub = reach();
    expect(Object.keys(hub), 'exactly what the hub exposes').to.deep.eq(['handleIntent']);
    expect(hub.handleIntent).to.be.a('function');
    const leaked = ['cursor', 'open', 'stands', 'openAt', 'reduxStandTarget', 'tendersStandTarget']
      .filter((key) => (hub as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ walk the list between two walls, A opens the cursored stand in the chassis, B closes the hub', async () => {
    const {reach, closed, cursor, stand} = mountUnderHost();
    expect(reach().handleIntent(nav('up'))).to.eq(true);
    await nextTick();
    expect(cursor(), 'the first row is a wall').to.eq(0);
    for (let i = 0; i < 6; i++) {
      reach().handleIntent(nav('down'));
    }
    await nextTick();
    expect(cursor(), 'and so is the last').to.eq(4);
    reach().handleIntent(nav('up'));
    reach().handleIntent(nav('up'));
    reach().handleIntent(nav('up'));
    await nextTick();
    expect(cursor()).to.eq(1);

    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    expect(stand().exists()).to.eq(true);
    expect(stand().props('titleKey')).to.eq(STANDS[1].title);
    expect(stand().props('sectionSelector'), 'a showcase with its own header markup names it').to.eq(STANDS[1].sections);
    expect(stand().props('padTarget'), 'a plain showcase has no pad target').to.eq(undefined);
    expect(stand().find('.cm-stand__body > .showcase-stub').exists(), 'a showcase stands in the chassis\' body').to.eq(true);
    expect(stand().findAll('.showcase-stub'), '…one, and no other').to.have.length(1);
    expect(stand().findComponent(ShowcaseStub).props('embedded'), '…told it is embedded').to.eq(true);
    expect(closed.count).to.eq(0);
  });

  it('an OPEN stand owns the pad: the hub forwards every intent through the stand\'s ref; B returns to the list, B again leaves the hub', async () => {
    const {wrapper, reach, closed, cursor, stand} = mountUnderHost();
    reach().handleIntent(A);
    await nextTick();
    expect(stand().props('titleKey')).to.eq(STANDS[0].title);

    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(scrolled, 'the STAND scrolled — the press went through its exposed handler').to.deep.eq([220]);
    await nextTick();
    expect(cursor(), 'the list behind the stand did not move').to.eq(0);
    expect(reach().handleIntent(A), 'a press the stand has no use for is swallowed there').to.eq(true);
    await nextTick();
    expect(stand().props('titleKey'), '…and opens nothing').to.eq(STANDS[0].title);

    expect(reach().handleIntent(B)).to.eq(true);
    await nextTick();
    expect(stand().exists(), 'B closed the stand').to.eq(false);
    expect(closed.count, '…and not the hub').to.eq(0);
    expect(wrapper.find('.cm-pg__list').exists(), 'the list is still there').to.eq(true);

    expect(reach().handleIntent(B)).to.eq(true);
    expect(closed.count, 'B on the list leaves the hub').to.eq(1);
  });

  it('a pointer carries the cursor and a click opens the row — every stand is handed its own title, headers and pad target', async () => {
    const {wrapper, reach, cursor, stand} = mountUnderHost();
    for (let i = 0; i < STANDS.length; i++) {
      const row = wrapper.findAll('button.cm-pg__row')[i];
      await row.trigger('mousemove');
      expect(cursor(), `the pointer over row ${i}`).to.eq(i);
      await row.trigger('click');
      expect(stand().props('titleKey')).to.eq(STANDS[i].title);
      expect(stand().findAll('.showcase-stub'), `${STANDS[i].title}: one showcase in its body`).to.have.length(1);
      expect(stand().props('sectionSelector')).to.eq(STANDS[i].sections);
      expect(typeof stand().props('padTarget') === 'function', `${STANDS[i].title}: an interactive showcase is the stand's pad target`).to.eq(STANDS[i].interactive);
      reach().handleIntent(B);
      await nextTick();
      expect(stand().exists()).to.eq(false);
    }
  });

  it('an INTERACTIVE showcase answers the pad first, through the hub\'s own ref to it — what it declines is the stand\'s', async () => {
    const {wrapper, reach, stand} = mountUnderHost();
    for (const index of [3, 4]) {
      offered.length = 0;
      scrolled.length = 0;
      await wrapper.findAll('button.cm-pg__row')[index].trigger('click');
      expect(stand().props('titleKey')).to.eq(STANDS[index].title);

      expect(reach().handleIntent(nav('down'))).to.eq(true);
      expect(offered, 'the showcase was asked').to.deep.eq([nav('down')]);
      expect(scrolled, '…and took it: the stand did not scroll').to.deep.eq([]);
      expect(reach().handleIntent(nav('up'))).to.eq(true);
      expect(offered).to.deep.eq([nav('down'), nav('up')]);
      expect(scrolled, 'declined — the stand\'s own scroll').to.deep.eq([-220]);

      expect(reach().handleIntent(B)).to.eq(true);
      expect(offered, 'B is never the showcase\'s').to.deep.eq([nav('down'), nav('up')]);
      await nextTick();
      expect(stand().exists()).to.eq(false);
    }
  });
});
