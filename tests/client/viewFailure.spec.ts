import {expect} from 'chai';
import {viewFailed} from '@/client/components/viewFailure';
import {loadingScreenState} from '@/client/console/loadingScreenState';
import {__setSessionRebuildNavigateForTesting} from '@/client/console/session/sessionRebuild';

/**
 * THE VIEW'S ROAD HAS ONE ENDING FOR A FAILURE — and it is never a native dialog
 * (docs/claude/console/freeze-zero/PLAN.md §4 — `src/client/components/viewFailure.ts`).
 *
 * The root's `update()` ended every failure between the fetch and the commit in `alert('Error getting game data')` —
 * a blocking browser dialog no pad reaches, with the page's own script stopped behind it.
 */
describe('viewFailure — the view could not be fetched, or could not be applied', () => {
  let warned: Array<string>;
  let warn: typeof console.warn;
  let error: typeof console.error;
  let navigations: number;
  let undoNavigate: () => void;
  let nativeAlerts: number;
  let realAlert: typeof window.alert;
  let storageWas: PropertyDescriptor | undefined;

  const curtain = {active: false, phase: '', error: ''};
  const standing = {id: 'p-seat', game: {gameAge: 41}};

  beforeEach(() => {
    warned = [];
    warn = console.warn;
    error = console.error;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    console.error = () => {};
    navigations = 0;
    undoNavigate = __setSessionRebuildNavigateForTesting(() => {
      navigations++;
    });
    nativeAlerts = 0;
    realAlert = window.alert;
    window.alert = () => {
      nativeAlerts++;
    };
    curtain.active = loadingScreenState.active;
    curtain.phase = loadingScreenState.phase;
    curtain.error = loadingScreenState.error;
    loadingScreenState.active = false;
    loadingScreenState.error = '';
    // The bound's memory outlives a document in the tab's session storage — the runner's document has none of its own.
    const kept = new Map<string, string>();
    storageWas = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => kept.get(key) ?? null,
        setItem: (key: string, value: string) => void kept.set(key, value),
        removeItem: (key: string) => void kept.delete(key),
      },
    });
  });

  afterEach(() => {
    if (storageWas === undefined) {
      delete (globalThis as {sessionStorage?: unknown}).sessionStorage;
    } else {
      Object.defineProperty(globalThis, 'sessionStorage', storageWas);
    }
    undoNavigate();
    window.alert = realAlert;
    console.warn = warn;
    console.error = error;
    loadingScreenState.active = curtain.active;
    loadingScreenState.phase = curtain.phase as typeof loadingScreenState.phase;
    loadingScreenState.error = curtain.error;
  });

  it('a FETCH that failed applies nothing and takes nothing from the player: one line, the poll re-asks', () => {
    expect(viewFailed('fetch', new TypeError('Failed to fetch'), standing)).to.eq('said');
    expect(warned).to.deep.eq(['[view] fetch failed — TypeError: Failed to fetch — the poll re-asks']);
    expect(navigations, 'the page stands on its last truth').to.eq(0);
    expect(loadingScreenState.error, 'no error screen for a network hiccup').to.eq('');
    expect(nativeAlerts).to.eq(0);
  });

  it('an APPLY that threw is the last line\'s: the session is rebuilt from the server\'s view — once for that view', () => {
    expect(viewFailed('apply', new TypeError('Cannot read properties of undefined (reading \'spaces\')'), standing)).to.eq('rebuilding');
    expect(navigations).to.eq(1);
    const line = warned.find((text) => text.startsWith('[session-rebuild] page'));
    expect(line, 'said under the last line\'s own shape, by the view\'s road').to.match(
      /^\[session-rebuild\] page — «view-apply» \(view@41\) — by view: the fetched view could not be applied — TypeError: Cannot read properties of undefined/);
    expect(line, 'the seat is the bound\'s key only — never printed').not.to.contain('p-seat');
    expect(nativeAlerts).to.eq(0);
  });

  it('…and a view the page was ALREADY rebuilt for ends on the curtain\'s own error state — never in a loop of rebuilds, never in a dialog', () => {
    expect(viewFailed('apply', new Error('broken'), standing)).to.eq('rebuilding');
    // The next page (the spec's document did not leave): the same view throws again.
    undoNavigate();
    undoNavigate = __setSessionRebuildNavigateForTesting(() => {
      navigations++;
    });
    expect(viewFailed('apply', new Error('broken'), standing)).to.eq('refused');
    expect(navigations, 'one rebuild for one view').to.eq(1);
    expect(loadingScreenState.active).to.eq(true);
    expect(loadingScreenState.error).to.eq('Error getting game data');
    expect(warned.some((text) => text.startsWith('[session-rebuild] refused (again) — «view-apply» (view@41)'))).to.eq(true);
    expect(nativeAlerts).to.eq(0);
  });

  it('under the LOADING CURTAIN every failure is the curtain\'s error state at once (the boot, a rebuild in flight)', () => {
    loadingScreenState.active = true;
    expect(viewFailed('fetch', new Error('down'), undefined)).to.eq('curtain');
    expect(loadingScreenState.error).to.eq('Error getting game data');
    loadingScreenState.error = '';
    loadingScreenState.active = true;
    expect(viewFailed('apply', new Error('broken'), undefined)).to.eq('curtain');
    expect(loadingScreenState.error).to.eq('Error getting game data');
    expect(navigations).to.eq(0);
    expect(warned).to.deep.eq([]);
  });
});
