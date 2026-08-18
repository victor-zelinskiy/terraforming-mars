import {expect} from 'chai';
import {conWsPresence, installConWsPresenceBridge} from '@/client/console/conWsPresenceBridge';

/**
 * The `.con-ws` DOM-presence bridge — the ex-`.con-root:has(...)` flags.
 * Contract under guard: the flag is true exactly while a matching element
 * EXISTS in the observed root (a leave-transitioning surface still counts —
 * Vue only removes the element when the leave ends), and dispose releases
 * everything (the closed state owns nothing).
 */
describe('conWsPresenceBridge', () => {
  /** MutationObserver delivers as a microtask — settle a couple of turns. */
  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }

  it('tracks .con-ws presence: install → add → remove → dispose', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const dispose = installConWsPresenceBridge(root);
    expect(conWsPresence.wsOpen).to.be.false;

    const surface = document.createElement('div');
    surface.className = 'con-composer con-ws';
    root.appendChild(surface);
    await settle();
    expect(conWsPresence.wsOpen).to.be.true;
    expect(conWsPresence.wsDockcover).to.be.false;

    // The dockcover marker rides the SAME element family.
    surface.classList.add('con-ws--dockcover');
    await settle();
    expect(conWsPresence.wsDockcover).to.be.true;

    root.removeChild(surface);
    await settle();
    expect(conWsPresence.wsOpen).to.be.false;
    expect(conWsPresence.wsDockcover).to.be.false;

    dispose();
    document.body.removeChild(root);
  });

  it('a surface PRESENT at install time is seen immediately (no mutation needed)', () => {
    const root = document.createElement('div');
    const surface = document.createElement('div');
    surface.className = 'con-ws';
    root.appendChild(surface);
    document.body.appendChild(root);
    const dispose = installConWsPresenceBridge(root);
    expect(conWsPresence.wsOpen).to.be.true;
    dispose();
    expect(conWsPresence.wsOpen).to.be.false;
    document.body.removeChild(root);
  });

  it('tracks the planet-focus board state (both phases of it)', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const dispose = installConWsPresenceBridge(root);
    const board = document.createElement('div');
    board.className = 'con-board con-board--pfocus';
    root.appendChild(board);
    await settle();
    expect(conWsPresence.planetFocus).to.be.true;
    board.className = 'con-board con-board--pfocus-exit';
    await settle();
    expect(conWsPresence.planetFocus).to.be.true;
    board.className = 'con-board';
    await settle();
    expect(conWsPresence.planetFocus).to.be.false;
    dispose();
    document.body.removeChild(root);
  });
});
