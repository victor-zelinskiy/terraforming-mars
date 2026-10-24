import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {BASE_RGB} from '@/client/components/playerToken/playerTokenPalette';
import {Color} from '@/common/Color';

/**
 * THE DELEGATE PIECE — the card's silhouette as a standee, in EXACTLY its
 * player's cube RGB (one `--pt-*` set) or in the neutral delegate's steel.
 */

function ptVars(el: Element): Record<string, string> {
  const style = (el as HTMLElement).style;
  const out: Record<string, string> = {};
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (name.startsWith('--pt-')) {
      out[name] = style.getPropertyValue(name).trim();
    }
  }
  return out;
}

const COLORS = Object.keys(BASE_RGB) as Array<Color>;

describe('PlayerDelegate', () => {
  it('stands in its player\'s CUBE colour, byte for byte (and the steel is the cube\'s steel)', () => {
    for (const color of COLORS) {
      for (const steel of [false, true]) {
        const figure = mount(PlayerDelegate, {...globalConfig, props: {color, steel}});
        const cube = mount(PlayerCube, {...globalConfig, props: {color, steel}});
        const fv = ptVars(figure.element);
        expect(fv['--pt-base'], `${color}${steel ? '/steel' : ''}`).is.a('string').and.not.empty;
        expect(fv, `${color}${steel ? '/steel' : ''}`).deep.eq(ptVars(cube.element));
        figure.unmount();
        cube.unmount();
      }
    }
  });

  it('names its colour on the shared token hook and its aria label', () => {
    const w = mount(PlayerDelegate, {...globalConfig, props: {color: 'blue'}});
    expect(w.attributes('data-player-token')).eq('blue');
    expect(w.attributes('aria-label')).eq('blue');
    expect(w.attributes('role')).eq('img');
    expect(w.classes()).to.include.members(['player-delegate', 'player-delegate--blue']);
  });

  it('the neutral delegate is the steel figure; steel and solid are classes', () => {
    const w = mount(PlayerDelegate, {...globalConfig, props: {color: 'neutral', steel: true, solid: true}});
    expect(w.attributes('data-player-token')).eq('neutral');
    expect(w.classes()).to.include.members(['player-delegate--neutral', 'player-delegate--steel', 'player-delegate--solid']);
  });

  it('size is the figure\'s height', () => {
    const w = mount(PlayerDelegate, {...globalConfig, props: {color: 'red', size: 18}});
    expect((w.element as HTMLElement).style.getPropertyValue('--pd-size')).eq('18px');
  });

  it('the shadow is a SIBLING of the body (it stays on the table in flight), and both can be dropped', () => {
    const w = mount(PlayerDelegate, {...globalConfig, props: {color: 'red'}});
    const shadow = w.find('.player-delegate__shadow');
    expect(shadow.exists()).is.true;
    expect(shadow.element.parentElement).eq(w.element);
    expect(w.find('.player-delegate__body .player-delegate__shadow').exists()).is.false;
    const bare = mount(PlayerDelegate, {...globalConfig, props: {color: 'red', shadow: false, glow: false}});
    expect(bare.find('.player-delegate__shadow').exists()).is.false;
    expect(bare.find('.player-delegate__glow').exists()).is.false;
  });

  it('the colour-blind glyph follows the prop: the player\'s symbol, steel\'s ring', () => {
    const red = mount(PlayerDelegate, {...globalConfig, props: {color: 'red', overlaySymbol: true}});
    expect(red.find('.player-delegate__symbol').text()).eq('▲');
    const steel = mount(PlayerDelegate, {...globalConfig, props: {color: 'neutral', steel: true, overlaySymbol: true}});
    expect(steel.find('.player-delegate__symbol').text()).eq('○');
    const off = mount(PlayerDelegate, {...globalConfig, props: {color: 'red', overlaySymbol: false}});
    expect(off.find('.player-delegate__symbol').exists()).is.false;
  });

  it('gradient ids are per instance (many figures on one page never collide)', () => {
    const a = mount(PlayerDelegate, {...globalConfig, props: {color: 'red'}});
    const b = mount(PlayerDelegate, {...globalConfig, props: {color: 'red'}});
    const ids = (w: typeof a) => w.findAll('defs [id]').map((n) => n.attributes('id'));
    expect(ids(a)).to.have.length.greaterThan(3);
    expect(ids(a).filter((id) => ids(b).includes(id))).deep.eq([]);
  });
});
