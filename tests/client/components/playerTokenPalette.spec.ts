import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {Color} from '@/common/Color';
import {BASE_RGB, STEEL_RGB, tokenStyleVars, tokenSymbol} from '@/client/components/playerToken/playerTokenPalette';

/**
 * THE ONE PLAYER-TOKEN PALETTE (`playerTokenPalette.ts`). Two guards:
 *  1. the tones are FROZEN at what the cube painted before the palette moved
 *     out of `PlayerCube.vue` — the move is a pure extraction, zero visual change;
 *  2. every piece paints with the module's `--pt-*` set, never its own copy.
 */

// Captured from `PlayerCube.vue` at 24b2d94ff4 (its inline BASE_RGB / STEEL_RGB
// derivation), before the extraction.
const FROZEN: Record<Color | 'steel', {top: string, left: string, right: string, edgeHi: string, glow: string}> = {
  red: {top: 'rgb(166, 48, 33)', left: 'rgb(122, 14, 0)', right: 'rgb(77, 9, 0)', edgeHi: 'rgb(209, 148, 140)', glow: 'rgba(153, 17, 0, 0.55)'},
  green: {top: 'rgb(33, 166, 33)', left: 'rgb(0, 122, 0)', right: 'rgb(0, 77, 0)', edgeHi: 'rgb(140, 209, 140)', glow: 'rgba(0, 153, 0, 0.55)'},
  yellow: {top: 'rgb(174, 174, 13)', left: 'rgb(136, 136, 0)', right: 'rgb(85, 85, 0)', edgeHi: 'rgb(217, 217, 140)', glow: 'rgba(170, 170, 0, 0.55)'},
  blue: {top: 'rgb(33, 122, 255)', left: 'rgb(0, 82, 204)', right: 'rgb(0, 51, 128)', edgeHi: 'rgb(140, 186, 255)', glow: 'rgba(0, 102, 255, 0.55)'},
  black: {top: 'rgb(108, 111, 118)', left: 'rgb(69, 72, 78)', right: 'rgb(43, 45, 49)', edgeHi: 'rgb(179, 181, 184)', glow: 'rgba(86, 90, 98, 0.55)'},
  purple: {top: 'rgb(155, 33, 255)', left: 'rgb(112, 0, 204)', right: 'rgb(70, 0, 128)', edgeHi: 'rgb(203, 140, 255)', glow: 'rgba(140, 0, 255, 0.55)'},
  orange: {top: 'rgb(238, 131, 44)', left: 'rgb(189, 90, 10)', right: 'rgb(118, 57, 6)', edgeHi: 'rgb(246, 191, 146)', glow: 'rgba(236, 113, 12, 0.55)'},
  pink: {top: 'rgb(241, 108, 178)', left: 'rgb(192, 80, 139)', right: 'rgb(120, 50, 87)', edgeHi: 'rgb(248, 185, 219)', glow: 'rgba(240, 100, 174, 0.55)'},
  bronze: {top: 'rgb(186, 138, 95)', left: 'rgb(141, 97, 57)', right: 'rgb(88, 61, 36)', edgeHi: 'rgb(219, 195, 172)', glow: 'rgba(176, 121, 71, 0.55)'},
  neutral: {top: 'rgb(186, 138, 95)', left: 'rgb(141, 97, 57)', right: 'rgb(88, 61, 36)', edgeHi: 'rgb(219, 195, 172)', glow: 'rgba(176, 121, 71, 0.55)'},
  steel: {top: 'rgb(182, 189, 203)', left: 'rgb(142, 149, 160)', right: 'rgb(89, 93, 100)', edgeHi: 'rgb(220, 224, 230)', glow: 'rgba(178, 186, 200, 0.55)'},
};

const COLORS = Object.keys(BASE_RGB) as Array<Color>;

function inlineVars(el: Element): Record<string, string> {
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

describe('playerTokenPalette — the one palette every player piece paints with', () => {
  it('the tones are frozen at the pre-extraction cube (zero visual change)', () => {
    for (const color of COLORS) {
      const vars = tokenStyleVars(color);
      const want = FROZEN[color];
      expect(vars['--pt-top'], color).eq(want.top);
      expect(vars['--pt-left'], color).eq(want.left);
      expect(vars['--pt-right'], color).eq(want.right);
      expect(vars['--pt-edge-hi'], color).eq(want.edgeHi);
      expect(vars['--pt-glow'], color).eq(want.glow);
    }
    const steel = tokenStyleVars('neutral', {steel: true});
    expect(steel['--pt-top']).eq(FROZEN.steel.top);
    expect(steel['--pt-right']).eq(FROZEN.steel.right);
    expect(steel['--pt-base']).eq(`rgb(${STEEL_RGB.join(', ')})`);
  });

  it('steel is ONE alloy for every colour; neutral without steel stays bronze', () => {
    for (const color of COLORS) {
      expect(tokenStyleVars(color, {steel: true})).deep.eq(tokenStyleVars('neutral', {steel: true}));
      expect(tokenSymbol(color, {steel: true})).eq('○');
    }
    expect(tokenStyleVars('neutral')['--pt-base']).eq(tokenStyleVars('bronze')['--pt-base']);
  });

  it('PlayerCube paints with the module set, byte for byte, and names its colour', () => {
    for (const color of COLORS) {
      for (const steel of [false, true]) {
        const w = mount(PlayerCube, {...globalConfig, props: {color, steel}});
        expect(inlineVars(w.element), `${color}${steel ? '/steel' : ''}`).deep.eq(tokenStyleVars(color, {steel}));
        expect(w.attributes('data-player-token')).eq(color);
        expect(w.attributes('aria-label')).eq(color);
        w.unmount();
      }
    }
  });
});
