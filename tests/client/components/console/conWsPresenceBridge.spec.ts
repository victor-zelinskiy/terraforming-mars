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

  it('sees a marker carried DEEP inside an added/removed wrapper (record filter, perf iteration 3)', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const dispose = installConWsPresenceBridge(root);

    // The workspace mounts as a wrapper whose DESCENDANT carries .con-ws —
    // the added record's top node does not match, its subtree does.
    const wrapper = document.createElement('div');
    wrapper.className = 'con-anything';
    const inner = document.createElement('div');
    inner.className = 'con-hand con-ws';
    wrapper.appendChild(inner);
    root.appendChild(wrapper);
    await settle();
    expect(conWsPresence.wsOpen).to.be.true;

    // Removing the WRAPPER (an ancestor) must be seen through the detached
    // subtree — the removal record is the only witness.
    root.removeChild(wrapper);
    await settle();
    expect(conWsPresence.wsOpen).to.be.false;

    dispose();
    document.body.removeChild(root);
  });

  it('stays correct through unrelated churn (flight-proxy adds, foreign class flips)', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const dispose = installConWsPresenceBridge(root);

    const surface = document.createElement('div');
    surface.className = 'con-hand con-ws';
    root.appendChild(surface);
    await settle();
    expect(conWsPresence.wsOpen).to.be.true;

    // Unrelated mutations (the filtered-out family) change nothing…
    const proxy = document.createElement('div');
    proxy.className = 'con-deal-proxy';
    root.appendChild(proxy);
    proxy.className = 'con-deal-proxy con-deal-proxy--landed';
    await settle();
    expect(conWsPresence.wsOpen).to.be.true;
    expect(conWsPresence.wsDockcover).to.be.false;

    // …and a relevant one AFTER the churn still lands (the filter must never
    // wedge the pipeline).
    surface.classList.remove('con-ws');
    await settle();
    expect(conWsPresence.wsOpen).to.be.false;

    dispose();
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
