/*
 * GameAtmosphere — the layered backdrop of the in-game screen. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders, and what its mount does under a boot curtain. The hold it asks the
 * scene director for is the director's own subject (tests/console/sceneTransition.spec.ts) — this spec reads the
 * texture the backdrop fetches, with jsdom's missing `HTMLImageElement.decode` lent for the test.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {loadingScreenState, resetSceneTransitionForTest} from '@/client/console/loadingScreenState';
import GameAtmosphere from '@/client/components/GameAtmosphere.vue';

describe('GameAtmosphere — the backdrop of the game screen', () => {
  const imageProto = HTMLImageElement.prototype as {decode?: () => Promise<void>};
  const nativeDecode = Object.getOwnPropertyDescriptor(imageProto, 'decode');
  /** The `src` of every image the backdrop asked the browser to decode. */
  let decoded: Array<string>;

  beforeEach(() => {
    resetSceneTransitionForTest();
    decoded = [];
    imageProto.decode = function(this: HTMLImageElement): Promise<void> {
      decoded.push(this.getAttribute('src') ?? '');
      return Promise.resolve();
    };
  });

  afterEach(() => {
    if (nativeDecode === undefined) {
      delete imageProto.decode;
    } else {
      Object.defineProperty(imageProto, 'decode', nativeDecode);
    }
    resetSceneTransitionForTest();
  });

  it('renders its seven layers back to front, hidden from assistive tech', () => {
    const w = mount(GameAtmosphere, {...globalConfig});
    expect(w.classes()).to.deep.eq(['game-atmosphere']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.findAll('.game-atmosphere > div').map((layer) => layer.classes())).to.deep.eq([
      ['game-atmosphere__base'],
      ['game-atmosphere__nebula'],
      ['game-atmosphere__stars-far'],
      ['game-atmosphere__stars-near'],
      ['game-atmosphere__halo'],
      ['game-atmosphere__hud'],
      ['game-atmosphere__vignette'],
    ]);
  });

  it('mounted with no curtain over it, it fetches nothing', () => {
    expect(loadingScreenState.phase).to.eq('idle');
    mount(GameAtmosphere, {...globalConfig});
    expect(decoded).to.deep.eq([]);
  });

  it('mounted under the boot curtain, it fetches AND decodes the starfield texture', () => {
    loadingScreenState.phase = 'covering';
    mount(GameAtmosphere, {...globalConfig});
    expect(decoded).to.deep.eq(['assets/stars.jpg']);
  });
});
