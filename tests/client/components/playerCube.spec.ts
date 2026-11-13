/*
 * PlayerCube — the premium player cube (the board, the colonies, the Parliament, the card faces, the flight proxies).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): eight props in, nothing out. Its tones are
 * the palette's and are pinned by `playerTokenPalette.spec.ts`; this spec is the rest of what it renders for its
 * props, what a parent's ref still reaches (`$el` — the two colony layers measure the cube through it), and that the
 * gradient ids stay ONE count per page: the counter lives in `playerCubeState.ts` (R25 — inside `<script setup>` it
 * would start again in every cube, and every cube on a page would paint with the first one's gradients).
 */
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {tokenSymbol} from '@/client/components/playerToken/playerTokenPalette';

function cube(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(PlayerCube, {props, attrs, global: {config: globalConfig.global.config}});
}

/** The ids of a cube's gradient defs, in the template's order (depth, depth-side, sheen, ao). */
function defIds(root: Element): Array<string> {
  return Array.from(root.querySelectorAll('.player-cube__defs defs > *')).map((def) => def.id);
}

/** Every gradient a cube's faces point at (`fill="url(#id)"`), without repeats. */
function paintedIds(root: Element): Array<string> {
  const ids = new Set<string>();
  for (const el of Array.from(root.querySelectorAll('.player-cube__cube [fill^="url("]'))) {
    const match = /^url\(#(.+)\)$/.exec(el.getAttribute('fill') ?? '');
    if (match !== null) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

function faces(root: Element): Array<string> {
  return Array.from(root.querySelectorAll('.player-cube__face')).map((face) => face.classList.item(1) ?? '');
}

describe('PlayerCube — the premium player cube', () => {
  // The LIVE manager, asked every time: other specs call `PreferencesManager.resetForTest()`, which replaces the
  // instance — one captured at describe time is a dead object by the time this spec runs in the suite.
  const preferences = {
    values: () => PreferencesManager.INSTANCE.values(),
    set: (key: 'symbol_overlay', value: boolean) => PreferencesManager.INSTANCE.set(key, value),
  };
  let overlayWas = false;

  beforeEach(() => {
    overlayWas = preferences.values().symbol_overlay;
  });

  afterEach(() => {
    preferences.set('symbol_overlay', overlayWas);
  });

  it('renders the cube for its props: the colour on the root, the footprint, three faces — six when solid — the glow and the shadow unless dropped', () => {
    const w = cube({color: 'green'});
    const root = w.element as HTMLElement;
    expect(root.tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['player-cube', 'player-cube--green']);
    expect(w.attributes('role')).to.eq('img');
    expect(w.attributes('aria-label')).to.eq('green');
    expect(w.attributes('data-player-token')).to.eq('green');
    expect(root.style.getPropertyValue('--pc-size'), 'the default footprint').to.eq('21px');
    expect(faces(root)).to.deep.eq(['player-cube__face--right', 'player-cube__face--left', 'player-cube__face--top']);
    expect(w.find('.player-cube__glow').exists()).to.eq(true);
    expect(w.find('.player-cube__shadow').exists()).to.eq(true);

    const proxy = cube({color: 'blue', size: 40, glow: false, shadow: false, steel: true, solid: true, animateIn: true});
    expect(proxy.classes()).to.deep.eq(['player-cube', 'player-cube--blue', 'player-cube--steel', 'player-cube--solid', 'player-cube--animate-in']);
    expect((proxy.element as HTMLElement).style.getPropertyValue('--pc-size')).to.eq('40px');
    expect(faces(proxy.element as Element), 'a cube that tumbles shows its bottom, back and far side').to.deep.eq([
      'player-cube__face--right', 'player-cube__face--left', 'player-cube__face--bottom', 'player-cube__face--back', 'player-cube__face--far', 'player-cube__face--top',
    ]);
    expect(proxy.find('.player-cube__glow').exists()).to.eq(false);
    expect(proxy.find('.player-cube__shadow').exists()).to.eq(false);

    // A call site may bind a model field that is still `undefined` (the prop's own comment): Vue warns about the
    // type in a development build — this mount lets the warning pass — and the cube falls back to the neutral one.
    const ownerless = mount(PlayerCube, {props: {color: undefined}, global: {config: {warnHandler: () => undefined}}});
    expect(ownerless.classes(), 'an absent colour is the neutral cube, never a broken class').to.deep.eq(['player-cube', 'player-cube--neutral']);
    expect(ownerless.attributes('data-player-token')).to.eq('neutral');
  });

  it('the colour-blind glyph is tri-state: forced on, forced off, and — when the prop is absent — the `symbol_overlay` preference', () => {
    preferences.set('symbol_overlay', false);
    expect(cube({color: 'red', overlaySymbol: true}).find('.player-cube__symbol').text()).to.eq(tokenSymbol('red'));
    expect(cube({color: 'red', steel: true, overlaySymbol: true}).find('.player-cube__symbol').text(), 'steel wears its own ring').to.eq(tokenSymbol('red', {steel: true}));
    expect(cube({color: 'red'}).find('.player-cube__symbol').exists(), 'the preference is off').to.eq(false);

    preferences.set('symbol_overlay', true);
    expect(cube({color: 'red'}).find('.player-cube__symbol').text(), 'the preference is on').to.eq(tokenSymbol('red'));
    expect(cube({color: 'red', overlaySymbol: false}).find('.player-cube__symbol').exists(), 'the prop outranks the preference').to.eq(false);
  });

  it('gradient ids are per instance — one count for the whole page — and every face paints with its OWN cube\'s defs', () => {
    const first = cube({color: 'red', solid: true});
    const second = cube({color: 'red', solid: true});
    const a = defIds(first.element as Element);
    const b = defIds(second.element as Element);
    expect(a.map((id) => id.replace(/\d+$/, ''))).to.deep.eq(['pc-depth-', 'pc-depth-side-', 'pc-sheen-', 'pc-ao-']);
    expect(new Set([...a, ...b]).size, 'two cubes on one page never share a gradient id').to.eq(8);
    const uid = (ids: Array<string>) => Number(/\d+$/.exec(ids[0])?.[0]);
    expect(uid(b), 'the next cube takes the next number of ONE counter').to.eq(uid(a) + 1);
    expect(paintedIds(first.element as Element).sort()).to.deep.eq([...a].sort());
    expect(paintedIds(second.element as Element).sort()).to.deep.eq([...b].sort());
  });

  it('a parent\'s ref still answers `$el` — the cube\'s root — and what a host puts on the cube lands on that root', () => {
    // The cube the way the colony layers mount it: under a host with the string ref `cube`, measured through `$el`.
    const Host = defineComponent({
      render: () => h('div', [h(PlayerCube, {'ref': 'cube', 'color': 'purple', 'class': 'con-colonybuild__cube', 'data-from-host': 'yes'})]),
    });
    const host = mount(Host, {global: {config: globalConfig.global.config}});
    const root = host.find('.player-cube').element;
    expect((host.vm.$refs.cube as {$el?: HTMLElement}).$el).to.eq(root);
    expect(Array.from(root.classList)).to.include.members(['player-cube', 'player-cube--purple', 'con-colonybuild__cube']);
    expect(root.getAttribute('data-from-host')).to.eq('yes');
  });
});
