import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import type {DiagnosticsHub as ElectronHub, HubHost as ElectronHost} from '../../electron/diagnosticsHost';
import type {DiagnosticsHub as SrcHub, HubHost as SrcHost} from '../../src/server/diagnostics/hub/hubTypes';

/**
 * THE HUB'S TWO TYPES ARE DECLARED TWICE — and this spec is what keeps the two declarations one.
 *
 * The Electron lane compiles `electron/**` alone, so `electron/diagnosticsHost.ts` repeats by hand what
 * `src/server/diagnostics/hub/hubTypes.ts` declares (the hub itself arrives as a bundle the lane `require`s). The
 * four assignments below are checked by `npm run build:test`: a member added, removed or re-typed on one side is a
 * compile error here, naming the other side.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const hostsAgree: Same<ElectronHost, SrcHost> = true;
const hubsAgree: Same<ElectronHub, SrcHub> = true;

describe('diagnostics — the Electron lane\'s copy of the hub types', () => {
  it('is assignable both ways (compile-time), and member for member the same text', () => {
    expect(hostsAgree && hubsAgree).to.eq(true);
    // …and the members read the same, comments included: a doc that drifted is a contract that drifted.
    const members = (file: string): string => {
      const text = fs.readFileSync(path.resolve(__dirname, '..', '..', file), 'utf8').replace(/\r\n/g, '\n');
      return text.slice(text.indexOf('export type HubHost'));
    };
    expect(members('electron/diagnosticsHost.ts')).to.eq(members('src/server/diagnostics/hub/hubTypes.ts'));
  });
});
