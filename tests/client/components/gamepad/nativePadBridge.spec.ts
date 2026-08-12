import {expect} from 'chai';
import {installNativePadBridge, nativePads} from '@/client/gamepad/nativePadBridge';

/*
 * The native pad source exists for ONE measured platform failure (Chromium's
 * Linux fetcher reporting nothing while the kernel has live joysticks — see
 * docs/GAMEPAD_SUPPORT_DESIGN.md §8.1). Everywhere else it must be completely
 * inert, because a second live input source would deliver every press twice.
 *
 * This guards the outermost gate: with no Electron preload bridge in the page —
 * a browser, a Windows build's web view, this test runner — the module never
 * subscribes and never publishes a pad, so `navigatorPads()` can only ever
 * answer from the Gamepad API.
 */
describe('client/gamepad/nativePadBridge', () => {
  it('publishes nothing without the Electron preload bridge', () => {
    installNativePadBridge();
    expect(nativePads()).to.deep.eq([]);
  });

  it('stays inert when called repeatedly', () => {
    installNativePadBridge();
    installNativePadBridge();
    expect(nativePads()).to.have.length(0);
  });
});
