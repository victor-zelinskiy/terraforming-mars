import {expect} from 'chai';
import {
  desktopUpdateState,
  startMenuUpdateWatch,
  stopMenuUpdateWatch,
  updateOverlayBlocking,
  type DesktopUpdateState,
} from '../../../../src/client/components/desktop/desktopUpdateState';

// The main-menu update watch: entering the main menu is the whole "how do I update?" answer, so
// the check must fire on ENTRY (not just on the next tick), keep firing while the menu is up, and
// stop dead when the player leaves it — an in-game timer would drop the blocking gate over a live
// turn.
//   npx mochapack --webpack-config webpack.config.js --require tests/client/components/setup.ts \
//     "tests/client/components/desktop/desktopUpdateState.spec.ts"

const IDLE: DesktopUpdateState = {mode: 'idle', currentVersion: '1.1.296'};

function installBridge(state: DesktopUpdateState): {calls: () => number} {
  let calls = 0;
  (window as unknown as {desktopBridge?: unknown}).desktopBridge = {
    desktopMode: true,
    getVersion: () => Promise.resolve('1.1.296'),
    openExternal: () => Promise.resolve(),
    getUpdateState: () => Promise.resolve(state),
    onUpdateState: () => undefined,
    recheck: () => {
      calls++;
      return Promise.resolve(state);
    },
    quitAndInstall: () => Promise.resolve(),
    openDownload: () => Promise.resolve(),
  };
  return {calls: () => calls};
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('client/desktopUpdateState menu update watch', () => {
  afterEach(() => {
    stopMenuUpdateWatch();
    delete (window as unknown as {desktopBridge?: unknown}).desktopBridge;
    Object.assign(desktopUpdateState, {mode: 'idle', currentVersion: '', pendingReason: undefined});
  });

  it('checks IMMEDIATELY on entering the menu (not only on the next interval)', () => {
    const bridge = installBridge(IDLE);
    startMenuUpdateWatch(60_000);
    // The player who just left a game to update must not wait out an interval for it.
    expect(bridge.calls()).to.eq(1);
  });

  it('keeps checking while the menu stays open', async () => {
    const bridge = installBridge(IDLE);
    startMenuUpdateWatch(20);
    await tick(75);
    expect(bridge.calls()).to.be.greaterThan(1);
  });

  it('stops checking once the menu closes (never re-checks during a game)', async () => {
    const bridge = installBridge(IDLE);
    startMenuUpdateWatch(20);
    await tick(50);
    stopMenuUpdateWatch();
    const settled = bridge.calls();
    await tick(60);
    expect(bridge.calls()).to.eq(settled);
  });

  it('re-entering the menu does not stack a second timer', async () => {
    const bridge = installBridge(IDLE);
    startMenuUpdateWatch(20);
    startMenuUpdateWatch(20); // e.g. a remount
    const afterEntry = bridge.calls();
    expect(afterEntry).to.eq(2); // one immediate check per entry, no more
    await tick(70);
    stopMenuUpdateWatch();
    // Two stacked 20ms timers would roughly double the tick count; one timer must not.
    const ticks = bridge.calls() - afterEntry;
    expect(ticks).to.be.lessThan(7);
  });

  it('merges the re-checked state, so the menu locks the moment a build is found', async () => {
    installBridge({mode: 'pending', currentVersion: '1.1.296', pendingVersion: '1.1.298', pendingReason: 'ci-build'});
    startMenuUpdateWatch(60_000);
    await tick(5);
    expect(desktopUpdateState.mode).to.eq('pending');
    expect(desktopUpdateState.pendingVersion).to.eq('1.1.298');
    // ...and that state is one the overlay covers the screen for.
    expect(updateOverlayBlocking(desktopUpdateState.mode)).to.be.true;
  });

  it('is inert on the web (no desktop bridge)', () => {
    expect(() => startMenuUpdateWatch(20)).to.not.throw();
  });

  it('a rejected re-check is swallowed (a blip must not break the menu)', async () => {
    (window as unknown as {desktopBridge?: unknown}).desktopBridge = {
      desktopMode: true,
      recheck: () => Promise.reject(new Error('offline')),
      getVersion: () => Promise.resolve(''),
      openExternal: () => Promise.resolve(),
      getUpdateState: () => Promise.resolve(undefined),
      onUpdateState: () => undefined,
      quitAndInstall: () => Promise.resolve(),
      openDownload: () => Promise.resolve(),
    };
    startMenuUpdateWatch(20);
    await tick(50);
    expect(desktopUpdateState.mode).to.eq('idle');
  });
});
