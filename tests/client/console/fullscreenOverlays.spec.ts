import {expect} from 'chai';
import {fullscreenOverlayOf} from '@/client/console/resourceTransfer/transferEndVisible';

/*
 * THE FULL-SCREEN OVERLAYS — the scenes over the whole frame that stand above the flight layer by contract. A token
 * under one is under a scene that took the screen, never a paint defect; an end under one is covered.
 *
 * The SYSTEM ALERT joined them (the box's autopilot on `fa37325692`, game 2805, a storm game): «Ошибка сети» rose over
 * tokens in flight and they were named «painted under div.con-alert__backdrop» — the wire called the alert up, not
 * the player, and it takes the screen all the same.
 */
describe('transferEndVisible — the full-screen overlays', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('the system alert — its backdrop and its card — is a full-screen overlay', () => {
    document.body.innerHTML = '<div class="con-alert"><div class="con-alert__backdrop"></div><div class="con-alert__card"><div class="con-alert__title">x</div></div></div>';
    const backdrop = document.querySelector('.con-alert__backdrop') as Element;
    const title = document.querySelector('.con-alert__title') as Element;
    expect(fullscreenOverlayOf(backdrop), 'the backdrop').to.not.equal(undefined);
    expect(fullscreenOverlayOf(title), 'the card').to.not.equal(undefined);
  });

  it('the viewer and the system menu stay; a hull surface is none', () => {
    document.body.innerHTML = '<div class="con-zoom-veil"><i class="a"></i></div><div class="con-sys"><i class="b"></i></div><div class="con-res"><i class="c"></i></div>';
    expect(fullscreenOverlayOf(document.querySelector('.a') as Element)).to.not.equal(undefined);
    expect(fullscreenOverlayOf(document.querySelector('.b') as Element)).to.not.equal(undefined);
    expect(fullscreenOverlayOf(document.querySelector('.c') as Element), 'the rail is a hull surface a token crosses').to.equal(undefined);
  });
});
