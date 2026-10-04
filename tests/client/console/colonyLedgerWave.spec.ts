/*
 * THE LEDGER'S ROWS PAY IN TURN — the shared wave
 * (src/client/console/colonyLedger/colonyLedgerWave.ts): the Parliament's
 * sitting (RX07) and a card's composer (TR23) call this ONE function.
 *
 * jsdom lays nothing out, so a row is «on screen» here when its bonus cell is
 * given a rect; the transfer itself then has no rail to land on and resolves
 * at once through `onArrive` (the framework's own honest degrade) — which is
 * exactly what makes the ORDER of the callbacks observable without a browser.
 */
import {expect} from 'chai';
import {flyLedgerRows, ledgerBonusIconOrigins, LEDGER_READ_MS, LEDGER_ROW_GAP_MS, ledgerRowBonusSelector, LedgerWaveRow} from '@/client/console/colonyLedger/colonyLedgerWave';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

const SCOPE = '[data-test-ledger]';

/** A ledger with one row per colony; `visible` rows get a measurable bonus cell. */
function ledger(colonies: ReadonlyArray<string>, visible: ReadonlyArray<string>): HTMLElement {
  const root = document.createElement('div');
  const scope = document.createElement('div');
  scope.setAttribute('data-test-ledger', '');
  root.appendChild(scope);
  for (const colony of colonies) {
    const row = document.createElement('div');
    row.setAttribute('data-colony-row', colony);
    const cell = document.createElement('span');
    cell.setAttribute('data-colony-bonus', '');
    const icon = document.createElement('i');
    icon.className = 'con-cledger__unit';
    cell.appendChild(icon);
    const on = visible.includes(colony);
    const rect = {left: 100, top: 40, width: on ? 60 : 0, height: on ? 20 : 0, right: on ? 160 : 100, bottom: on ? 60 : 40, x: 100, y: 40, toJSON: () => ({})} as DOMRect;
    cell.getBoundingClientRect = () => rect;
    icon.getBoundingClientRect = () => ({...rect, left: 110, width: on ? 20 : 0, toJSON: () => ({})} as DOMRect);
    row.appendChild(cell);
    scope.appendChild(row);
  }
  document.body.appendChild(root);
  return root;
}

function spec(resource: string, amount: number): ResourceTransferSpec {
  return {channel: 'stock', resource, amount};
}

function run(root: HTMLElement, rows: ReadonlyArray<LedgerWaveRow>, finished: () => boolean = () => false): Promise<Array<string>> {
  const trail: Array<string> = [];
  return new Promise((resolve) => {
    flyLedgerRows({
      root,
      scope: SCOPE,
      rows,
      finished,
      onRow: (colony) => trail.push(`row:${colony}`),
      onArrive: (s, row) => trail.push(`arrive:${row.colony}:${s.resource}+${s.amount}`),
      onRelease: (row) => trail.push(`release:${row.colony}`),
      onRowDone: (row) => trail.push(`done:${row.colony}`),
    }, () => {
      trail.push('then');
      resolve(trail);
    });
  });
}

describe('colonyLedgerWave — the rows pay in turn', () => {
  let root: HTMLElement | undefined;
  afterEach(() => {
    root?.remove();
    root = undefined;
  });

  it('RX07\'s numbers, stated once for both callers', () => {
    expect(LEDGER_ROW_GAP_MS).eq(140);
    expect(LEDGER_READ_MS).eq(1400);
  });

  it('the row\'s bonus cell is addressed UNDER THE CALLER\'S SCOPE — the sitting\'s and the composer\'s never collide', () => {
    expect(ledgerRowBonusSelector('[data-parl-sitting]', 'Luna')).eq('[data-parl-sitting] [data-colony-row="Luna"] [data-colony-bonus]');
    expect(ledgerRowBonusSelector('[data-colony-ledger-scope="card"]', 'Pluto')).eq('[data-colony-ledger-scope="card"] [data-colony-row="Pluto"] [data-colony-bonus]');
  });

  it('the chips are born on the row\'s printed unit icon — one point for every spec of the row', () => {
    root = ledger(['Luna'], ['Luna']);
    const cell = root.querySelector<HTMLElement>('[data-colony-bonus]')!;
    const origins = ledgerBonusIconOrigins(cell, [spec('megacredits', 2), spec('steel', 1)]);
    expect(origins).deep.eq([{x: 120, y: 50}, {x: 120, y: 50}]);
  });

  it('the rows pay in the ORDER GIVEN, one after the other: mark → arrive → done, then the next; `then` closes the walk', async () => {
    root = ledger(['Luna', 'Ceres', 'Io'], ['Luna', 'Ceres', 'Io']);
    const trail = await run(root, [
      {colony: 'Ceres', specs: [spec('steel', 2)]},
      {colony: 'Luna', specs: [spec('megacredits', 4)]},
      {colony: 'Io', specs: [spec('heat', 2)]},
    ]);
    expect(trail).deep.eq([
      'row:Ceres', 'arrive:Ceres:steel+2', 'done:Ceres',
      'row:Luna', 'arrive:Luna:megacredits+4', 'done:Luna',
      'row:Io', 'arrive:Io:heat+2', 'done:Io',
      'row:', 'then',
    ]);
  });

  it('a row that is NOT ON SCREEN is released at once (its counter ticks honestly) and the walk goes on — it is never marked', async () => {
    root = ledger(['Luna', 'Ceres'], ['Ceres']);
    const trail = await run(root, [
      {colony: 'Luna', specs: [spec('megacredits', 2)]},
      {colony: 'Ceres', specs: [spec('steel', 2)]},
    ]);
    expect(trail).deep.eq(['release:Luna', 'row:Ceres', 'arrive:Ceres:steel+2', 'done:Ceres', 'row:', 'then']);
  });

  it('a row the ledger does not have at all is released the same way', async () => {
    root = ledger(['Luna'], ['Luna']);
    const trail = await run(root, [{colony: 'Titan', specs: [spec('megacredits', 1)]}]);
    expect(trail).deep.eq(['release:Titan', 'row:', 'then']);
  });

  it('a run driven to its end releases EVERYTHING that has not flown and flies nothing more', async () => {
    root = ledger(['Luna', 'Ceres'], ['Luna', 'Ceres']);
    let finished = false;
    const trail: Array<string> = [];
    await new Promise<void>((resolve) => {
      flyLedgerRows({
        root: root!,
        scope: SCOPE,
        rows: [{colony: 'Luna', specs: [spec('megacredits', 2)]}, {colony: 'Ceres', specs: [spec('steel', 2)]}],
        finished: () => finished,
        onRow: (colony) => trail.push(`row:${colony}`),
        onArrive: (_spec, row) => {
          trail.push(`arrive:${row.colony}`);
          finished = true; // «дожать» pressed while Luna's wave is in the air
        },
        onRelease: (row) => trail.push(`release:${row.colony}`),
      }, () => {
        trail.push('then');
        resolve();
      });
    });
    expect(trail).deep.eq(['row:Luna', 'arrive:Luna', 'release:Ceres', 'row:', 'then']);
  });

  it('an empty walk ends at once', async () => {
    root = ledger([], []);
    expect(await run(root, [])).deep.eq(['row:', 'then']);
  });
});
