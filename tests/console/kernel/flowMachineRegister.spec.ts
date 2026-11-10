import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {FLOW_MACHINES} from '@/client/console/kernel/flowMachines';

const CLIENT = path.resolve(__dirname, '../../../src/client');

function sources(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sources(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments out — a file that merely MENTIONS a machine defines none. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * EVERY STATECHART IS ON THE REGISTER. A machine defined under `src/client` that `flowMachines.ts` does not list is
 * never read by the law (`flowLaw.spec.ts`) — and a lifecycle that skips the law is how «a state with no exit» and
 * «a wait with no bound» come back. The guard reads the sources: a file that calls `createMachine(` is a row.
 */
describe('flow kernel · every machine is on the register', () => {
  const defining = sources(CLIENT)
    .filter((file) => /\bcreateMachine\s*\(/.test(code(fs.readFileSync(file, 'utf8'))))
    .map((file) => path.relative(CLIENT, file).replace(/\\/g, '/'))
    .sort();
  const registered = [...new Set(FLOW_MACHINES.map((entry) => entry.file))].sort();

  it('every file that defines a machine is registered', () => {
    expect(defining.filter((file) => !registered.includes(file)), 'machines the law never reads — add them to FLOW_MACHINES').to.deep.eq([]);
  });

  it('every registered file exists and defines a machine', () => {
    expect(registered.filter((file) => !defining.includes(file)), 'rows of FLOW_MACHINES whose file defines no machine').to.deep.eq([]);
  });

  it('a machine has one name', () => {
    const names = FLOW_MACHINES.map((entry) => entry.name);
    expect(names).to.deep.eq([...new Set(names)]);
  });
});
