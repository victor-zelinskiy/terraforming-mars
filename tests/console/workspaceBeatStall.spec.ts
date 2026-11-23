import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  isTransientBeat,
  reportSurfaceBeat,
  resetBeatStall,
  transientSurfaceBeats,
  WORKSPACE_BEAT_STALL_MS,
} from '@/client/console/workspaceBeatStall';

/**
 * THE BEAT's VOCABULARY — which phases are machine time, the bound, a surface's own report. The rule itself («a beat
 * with nothing in flight is a stall» — the owner's R&D Funding freeze of 2026-10-31) is judged by the frame's own
 * machine (its bound) and by the liveness arbiter (`beatOwed`); the 1 Hz sampler that used to stand in this module
 * had no caller and is gone.
 */
describe('workspaceBeatStall', () => {
  afterEach(() => resetBeatStall());

  it('only the TRANSIENT phases are judged — a verdict or a committed stage is the player\'s to read', () => {
    expect(isTransientBeat('executing')).is.true;
    expect(isTransientBeat('completing')).is.true;
    for (const phase of ['browse', 'configure', 'committed', 'verdict'] as const) {
      expect(isTransientBeat(phase), phase).is.false;
    }
    expect(isTransientBeat(undefined)).is.false;
  });

  it('a surface reports its derived phase; only the transient ones are listed, and the report leaves with it', () => {
    reportSurfaceBeat('card-actions', 'committed');
    expect(transientSurfaceBeats()).to.deep.equal([]);
    reportSurfaceBeat('card-actions', 'executing');
    expect(transientSurfaceBeats()).to.deep.equal([['card-actions', 'executing']]);
    reportSurfaceBeat('card-actions', undefined);
    expect(transientSurfaceBeats()).to.deep.equal([]);
  });

  it('the bound is the own bound of the frame machine, and the arbiter judges a quiet beat sooner — nothing samples it here', () => {
    expect(WORKSPACE_BEAT_STALL_MS).to.equal(12_000);
    const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../src/client/console', file), 'utf8').replace(/\r\n/g, '\n');
    const module = read('workspaceBeatStall.ts');
    expect(module, 'the sampler is gone — a rule nothing runs reads as a net that stands').to.not.match(/export function (observeBeatStall|tickBeatStall)\(/);
    // The two judges that do stand: the frame's own bound, and the arbiter's «a beat owes its end».
    expect(read('consoleWorkspaceStack.ts')).to.contain('export function registerFrameBeatExpired(');
    expect(read('consoleLiveness.ts')).to.contain('(sample.promptLive || sample.beatOwed === true) && !accepting &&');
    expect(read('supervisor/supervisorController.ts')).to.match(/name: 'workspace-beat',\s+release: \(\) => \{\s+const beat = judgedTransientBeat\(\);/);
  });
});
