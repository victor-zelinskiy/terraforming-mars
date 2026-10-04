/*
 * THE LEDGER'S ROWS PAY IN TURN — the ONE wave of a colony ledger, wherever
 * the ledger stands.
 *
 * «Gain all your colony bonuses» is paid row by row: the row is marked, its
 * chips leave the PRINTED BONUS of that tile (its own icon in the row's cell),
 * land on their rail rows — the counter ticks on the touchdown — and only then
 * the next tile pays. The Parliament's sitting played this first (RX07
 * Colonial Affairs, the reward stage's body); a CARD that pays the same
 * bonuses (TR23 Habitat Science — the action composer's ledger) plays the very
 * same wave. So it lives here, outside both: the caller hands in WHERE the
 * ledger stands (`root` + `scope`), WHAT each row flies (`rows`, the specs it
 * owns) and what its own bookkeeping does at the four moments — a row starts,
 * a chip lands, a row could not fly, the walk ends. Nothing here knows whose
 * ledger it is, and nothing here is timed: a row follows the previous one's
 * last landing, a tick later (`probeTick` — the next painted frame, never a
 * wall clock).
 *
 * A row that is not on screen (the ledger folded under a step, a reload) or a
 * run driven to its end is RELEASED at once through `onRelease`: the counter
 * ticks, honestly late, never lost.
 */
import {nextTick} from 'vue';
import {probeTick} from '@/client/console/probeTick';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

/** Between two LEDGER ROWS' waves: the next tile pays only once the previous one's chips have landed. */
export const LEDGER_ROW_GAP_MS = 140;
/** The LEDGER read after its last row / step: the rows and their states, read before the page turns. */
export const LEDGER_READ_MS = 1400;

/** ONE row of the wave: the tile and the transfers its bonus pays (the caller's own spec objects — identity is kept). */
export type LedgerWaveRow = {colony: string, specs: ReadonlyArray<ResourceTransferSpec>};

export type LedgerWaveRun = {
  /** The subtree the ledger is looked up in. */
  root: Document | HTMLElement;
  /**
   * The CSS scope the ledger stands under — the prefix of every row's selector
   * (the sitting's `[data-parl-sitting]`, the action composer's own). It is a
   * selector and not an element because the flight layer re-resolves it.
   */
  scope: string;
  rows: ReadonlyArray<LedgerWaveRow>;
  /** The run was driven to its end or torn down: nothing more flies, what is left is released. */
  finished: () => boolean;
  /** WHICH row's wave is in the air ('' — none): the caller marks exactly one row by weight. */
  onRow: (colony: string) => void;
  /** One chip touched down — release its hold, tick its counter. */
  onArrive: (spec: ResourceTransferSpec, row: LedgerWaveRow) => void;
  /** The row cannot fly (off screen, or the run is finished): release everything it holds, at once. */
  onRelease: (row: LedgerWaveRow) => void;
  /** Every wave launched — the caller's handle for «дожать» / its own bookkeeping. */
  track?: (wave: Promise<void>) => void;
  /** The row's last chip has landed (never called for a released row). */
  onRowDone?: (row: LedgerWaveRow) => void;
};

/** The bonus cell of `colony`'s ledger row under `scope` — the place the player read the printed bonus in, the chips' birthplace. */
export function ledgerRowBonusSelector(scope: string, colony: string): string {
  const name = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(colony) : colony.replace(/"/g, '\\"');
  return `${scope} [data-colony-row="${name}"] [data-colony-bonus]`;
}

/** The birth points on a ledger row's bonus cell: the printed unit icon of the cell (one per row), else the cell itself. */
export function ledgerBonusIconOrigins(cell: HTMLElement, specs: ReadonlyArray<ResourceTransferSpec>): Array<TransferPoint | undefined> {
  const icon = cell.querySelector<HTMLElement>('.con-cledger__unit');
  const r = (icon ?? cell).getBoundingClientRect();
  const point: TransferPoint | undefined = r.width > 4 ? {x: r.left + r.width / 2, y: r.top + r.height / 2} : undefined;
  return specs.map(() => point);
}

/** Fly the rows in turn, in the order given; `then` runs once the last one has landed (or been released). */
export function flyLedgerRows(run: LedgerWaveRun, then: () => void): void {
  const step = (index: number): void => {
    const row = run.rows[index];
    if (row === undefined) {
      run.onRow('');
      then();
      return;
    }
    if (run.finished()) {
      run.rows.slice(index).forEach((r) => run.onRelease(r));
      run.onRow('');
      then();
      return;
    }
    const selector = ledgerRowBonusSelector(run.scope, row.colony);
    const cell = run.root.querySelector<HTMLElement>(selector);
    if (cell === null || cell.getBoundingClientRect().width < 4) {
      run.onRelease(row);
      step(index + 1);
      return;
    }
    run.onRow(row.colony);
    const specs = [...row.specs];
    const wave = runResourceTransfers({
      specs,
      origins: ledgerBonusIconOrigins(cell, specs),
      source: {selectors: [selector]},
      arrival: 'auto',
      onArrive: (spec) => run.onArrive(spec, row),
    });
    run.track?.(wave);
    void wave.then(() => {
      run.onRowDone?.(row);
      void nextTick(() => probeTick(() => step(index + 1)));
    });
  };
  step(0);
}
