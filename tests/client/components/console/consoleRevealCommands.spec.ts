import {expect} from 'chai';
import {drawnRevealCommandRun} from '@/client/console/consoleRevealCommands';

function labels(cmds: ReadonlyArray<{control: string, label: string}>): Array<string> {
  return cmds.map((c) => `${c.control}:${c.label}`);
}

describe('drawnRevealCommandRun — ONE contract for both hosts', () => {
  it('the plain batch: A takes, X inspects, B takes all — B is never an exit (a draw is not cancellable)', () => {
    const run = drawnRevealCommandRun({hasCardSource: false, hasDiscards: false});
    expect(labels(run)).to.deep.eq(['confirm:Take card', 'secondary:Inspect', 'back:Take all cards']);
  });

  it('a CARD source adds L3 in the standalone host and drops it when EMBEDDED (the source is already on screen)', () => {
    const standalone = drawnRevealCommandRun({hasCardSource: true, hasDiscards: false});
    expect(labels(standalone)).to.contain('stickL:Source');

    const embedded = drawnRevealCommandRun({hasCardSource: true, hasDiscards: false, embedded: true});
    expect(labels(embedded)).to.not.contain('stickL:Source');
    // Everything else is IDENTICAL — the two hosts differ by one redundant
    // entry, never by what A or B mean.
    expect(labels(embedded)).to.deep.eq(['confirm:Take card', 'secondary:Inspect', 'back:Take all cards']);
  });

  it('a conditional search offers the discard pile on R3', () => {
    const run = drawnRevealCommandRun({hasCardSource: false, hasDiscards: true});
    expect(labels(run)).to.contain('stickR:Discarded pile');
  });

  it('a READY closing step takes over A and REMOVES take-all — the mandatory step cannot be skipped', () => {
    const run = drawnRevealCommandRun({
      hasCardSource: true,
      hasDiscards: false,
      closer: {index: 1, total: 1, label: 'Discard a card', ready: true} as never,
    });
    expect(labels(run)).to.contain('confirm:Discard a card');
    expect(labels(run).some((l) => l.startsWith('back:'))).to.eq(false);
  });

  it('a NOT-ready closer leaves A on «take» and keeps the take-all shortcut', () => {
    const run = drawnRevealCommandRun({
      hasCardSource: false,
      hasDiscards: false,
      closer: {index: 1, total: 1, label: 'Discard a card', ready: false} as never,
    });
    expect(labels(run)).to.contain('confirm:Take card');
    expect(labels(run)).to.contain('back:Take all cards');
  });
});
