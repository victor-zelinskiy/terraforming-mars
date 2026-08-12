import {expect} from 'chai';
import {installNativePadBridge, nativePads, setNativePadsWanted} from '@/client/gamepad/nativePadBridge';

type TestGlobal = {window?: {desktopBridge?: unknown}};

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

  /*
   * `setNativePadsWanted` resolves to an ipcRenderer `invoke`, so a host that
   * has no handler for the channel answers with a REJECTED PROMISE — which a
   * synchronous try/catch cannot see. That is not hypothetical: every Windows
   * build logged "Unhandled promise rejection: No handler registered for
   * 'desktop:native-pads-wanted'" on each pad connect until the `.catch` landed.
   */
  describe('setNativePadsWanted', () => {
    const host = globalThis as TestGlobal;
    const hadWindow = host.window !== undefined;
    let previousBridge: unknown;

    beforeEach(() => {
      if (host.window === undefined) {
        host.window = {};
      }
      previousBridge = host.window.desktopBridge;
    });

    afterEach(() => {
      // Module state is bundle-shared in mochapack — leave the host exactly as found.
      if (host.window !== undefined) {
        host.window.desktopBridge = previousBridge;
      }
      if (!hadWindow) {
        delete host.window;
      }
    });

    it('swallows a rejected invoke instead of leaking an unhandled rejection', async () => {
      const leaked: unknown[] = [];
      const watch = (reason: unknown): void => void leaked.push(reason);
      const canWatch = typeof process !== 'undefined' && typeof process.on === 'function';
      if (canWatch) {
        process.on('unhandledRejection', watch);
      }
      let called = false;
      (host.window as {desktopBridge?: unknown}).desktopBridge = {
        setNativePadsWanted: (): Promise<void> => {
          called = true;
          return Promise.reject(new Error('No handler registered for \'desktop:native-pads-wanted\''));
        },
      };

      setNativePadsWanted(false);
      expect(called).to.eq(true, 'the bridge method must still be invoked');
      // Let the microtask queue drain — an unswallowed rejection surfaces here.
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (canWatch) {
        process.off('unhandledRejection', watch);
      }
      expect(leaked).to.have.length(0);
    });

    it('does nothing when the host exposes no such method', () => {
      (host.window as {desktopBridge?: unknown}).desktopBridge = {};
      expect(() => setNativePadsWanted(true)).to.not.throw();
    });

    it('does nothing when there is no bridge at all', () => {
      (host.window as {desktopBridge?: unknown}).desktopBridge = undefined;
      expect(() => setNativePadsWanted(true)).to.not.throw();
    });
  });
});
