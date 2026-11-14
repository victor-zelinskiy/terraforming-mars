import {expect} from 'chai';
import {
  __resetFrameSymbolsForTesting, cleanSourcePath, decodeMappings, frameSymbolsOf, parseFrameSymbols, resolveFrames, resolvePosition,
} from '../../src/client/diagnostics/frameSymbols';
import {diagFrameRows} from '../../src/client/diagnostics/diagnosticsView';
import {DiagEntry} from '../../src/common/diagnostics/DiagnosticModel';

/**
 * A MINIFIED FRAME, READ BACK (docs/claude/diagnostics.md § 5): the journal's reading surface shows `src/…:line` for
 * the frames of our own code. The decoder is the source-map v3 format's own — pinned here against segments written by
 * hand and against an encoder of the spec's own.
 */
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function vlq(value: number): string {
  let v = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) {
      digit |= 32;
    }
    out += BASE64[digit];
  } while (v > 0);
  return out;
}

/** Absolute segments `[genLine, genCol, source, line, col, name?]` → a `mappings` string (deltas, as the format asks). */
function encode(segments: ReadonlyArray<ReadonlyArray<number>>): string {
  const lines: Array<Array<string>> = [];
  let prev = [0, 0, 0, 0];
  let prevColumn = 0;
  let line = 0;
  for (const [genLine, genCol, source, srcLine, srcCol, name] of segments) {
    while (line < genLine) {
      line++;
      prevColumn = 0;
    }
    lines[genLine] ??= [];
    let seg = vlq(genCol - prevColumn) + vlq(source - prev[0]) + vlq(srcLine - prev[1]) + vlq(srcCol - prev[2]);
    if (name !== undefined) {
      seg += vlq(name - prev[3]);
      prev = [source, srcLine, srcCol, name];
    } else {
      prev = [source, srcLine, srcCol, prev[3]];
    }
    prevColumn = genCol;
    lines[genLine].push(seg);
  }
  return Array.from({length: lines.length}, (_v, i) => (lines[i] ?? []).join(',')).join(';');
}

describe('frame symbols — a minified frame read back to its source', () => {
  it('decodes segments written by hand: fields are deltas, the column restarts on every line', () => {
    // «AAAA» = [0,0,0,0] · «IAAM» = column +4, source +0, line +0, column +6 · «;» a new line · «AACA» = line +1.
    const lines = decodeMappings('AAAA,IAAM;AACA');
    expect(Array.from(lines[0])).to.deep.eq([0, 0, 0, 0, -1, 4, 0, 0, 6, -1]);
    expect(Array.from(lines[1])).to.deep.eq([0, 0, 1, 6, -1]);
    // A negative delta, a multi-digit value and a named segment.
    expect(Array.from(decodeMappings('gkBAAD,AAAAA')[0])).to.deep.eq([576, 0, 0, -1, -1, 576, 0, 0, -1, 0]);
    // A one-field segment is generated code with no source behind it.
    expect(Array.from(decodeMappings('A,CAAA')[0])).to.deep.eq([0, -1, -1, -1, -1, 1, 0, 0, 0, -1]);
    expect(decodeMappings('')).to.have.length(1);
  });

  it('agrees with an encoder of the spec\'s own on a bundle-shaped map (one long line, many sources)', () => {
    const segments: Array<Array<number>> = [];
    let column = 0;
    for (let i = 0; i < 400; i++) {
      column += 1 + (i * 7) % 90;
      segments.push([0, column, i % 5, (i * 13) % 700, (i * 3) % 60, ...(i % 3 === 0 ? [i % 11] : [])]);
    }
    segments.push([1, 4, 2, 9, 1]);
    const lines = decodeMappings(encode(segments));
    expect(lines[0].length / 5).to.eq(400);
    for (const i of [0, 1, 57, 199, 399]) {
      const [, genCol, source, srcLine, srcCol, name] = segments[i];
      expect(Array.from(lines[0].subarray(i * 5, i * 5 + 5)), `segment ${i}`).to.deep.eq([genCol, source, srcLine, srcCol, name ?? -1]);
    }
    expect(Array.from(lines[1])).to.deep.eq([4, 2, 9, 1, -1]);
  });

  const symbols = parseFrameSymbols({
    sources: ['webpack://terraforming-mars/./src/client/console/hand/handStage.ts', 'webpack://terraforming-mars/./node_modules/gsap/gsap-core.js'],
    names: ['foldStage', 'to'],
    mappings: encode([[0, 10, 0, 411, 4, 0], [0, 250, 1, 90, 2, 1], [0, 900, 0, 20, 0]]),
  });

  it('resolves a position to the LAST segment at or before it; a path reads as the repository has it', () => {
    expect(cleanSourcePath('webpack://terraforming-mars/./src/client/x.ts?vue')).to.eq('src/client/x.ts');
    expect(cleanSourcePath('webpack://terraforming-mars/../../node_modules/vue/dist/vue.js')).to.eq('node_modules/vue/dist/vue.js');
    // V8's column is 1-based: column 11 is the map's column 10.
    expect(resolvePosition(symbols, 1, 11)).to.deep.eq({source: 'src/client/console/hand/handStage.ts', line: 412, name: 'foldStage'});
    expect(resolvePosition(symbols, 1, 260)).to.deep.eq({source: 'node_modules/gsap/gsap-core.js', line: 91, name: 'to'});
    expect(resolvePosition(symbols, 1, 5000)).to.deep.eq({source: 'src/client/console/hand/handStage.ts', line: 21, name: ''});
    expect(resolvePosition(symbols, 1, 3), 'before the first segment').to.eq(undefined);
    expect(resolvePosition(symbols, 7, 1), 'a line the map does not have').to.eq(undefined);
  });

  it('fetches a script\'s symbols once, falls back to its whole map, and never fails a stack', async () => {
    __resetFrameSymbolsForTesting();
    const asked: Array<string> = [];
    const fetcher = async (url: string): Promise<unknown> => {
      asked.push(url);
      if (url === 'app://bundle/main.js.symbols.json') {
        return {sources: ['webpack://terraforming-mars/./src/a.ts'], names: [], mappings: encode([[0, 0, 0, 5, 0]])};
      }
      if (url === 'http://localhost:8080/vendors.js.map') {
        return {sources: ['webpack://terraforming-mars/./node_modules/vue/x.js'], names: [], mappings: encode([[0, 0, 0, 1, 0]])};
      }
      throw new Error('404');
    };
    const resolved = await resolveFrames([
      {fn: 'E', file: 'app://bundle/main.js', line: 1, col: 40, inApp: true},
      {fn: 'x', file: 'app://bundle/main.js', line: 1, col: 90, inApp: true},
      {fn: 'q', file: 'http://localhost:8080/vendors.js', line: 1, col: 3, inApp: false},
      {fn: 'lazy', file: 'app://bundle/chunks/730.js', line: 1, col: 3, inApp: true},
      {fn: 'run', file: 'node:internal/timers', line: 5, col: 1, inApp: false},
      {fn: 'native', file: '', inApp: false},
    ], fetcher);
    expect(resolved.map((r) => r?.source)).to.deep.eq(['src/a.ts', 'src/a.ts', 'node_modules/vue/x.js', undefined, undefined, undefined]);
    expect(asked, 'one fetch per script; the whole map only where the symbols are absent; never for another runtime\'s path').to.deep.eq([
      'app://bundle/main.js.symbols.json',
      'http://localhost:8080/vendors.js.symbols.json', 'http://localhost:8080/vendors.js.map',
      'app://bundle/chunks/730.js.symbols.json', 'app://bundle/chunks/730.js.map',
    ]);
    expect(await frameSymbolsOf('app://bundle/main.js', fetcher)).to.not.eq(undefined);
    expect(asked).to.have.length(5);
    __resetFrameSymbolsForTesting();
  });

  it('a resolved row names the source and the function its CALLER\'s call site carries; a library steps back', () => {
    const entry: DiagEntry = {
      id: 'e', at: 0, lastAt: 0, kind: 'error', family: 'page-error', level: 'error', runtime: 'page', title: 't', text: 't', count: 1, build: 'b',
      stack: 'TypeError: x\n    at E (app://bundle/main.js:1:11)\n    at k (app://bundle/vendors.js:1:260)\n    at app://bundle/chunks/730.js:1:5',
    };
    expect(diagFrameRows(entry).frames.map((f) => `${f.fn} ${f.where} ${f.own}`)).to.deep.eq([
      'E bundle/main.js:1:11 true', 'k bundle/vendors.js:1:260 false', '(anonymous) chunks/730.js:1:5 true',
    ]);
    const rows = diagFrameRows(entry, [
      {source: 'src/client/console/hand/handStage.ts', line: 412, name: 'state'},
      {source: 'node_modules/gsap/gsap-core.js', line: 91, name: 'foldStage'},
      undefined,
    ]).frames;
    expect(rows.map((f) => `${f.fn} ${f.where} ${f.own}`)).to.deep.eq([
      // The innermost frame is named by the call site of the frame that called it.
      'foldStage src/client/console/hand/handStage.ts:412 true',
      // No resolved caller: what V8 printed stands.
      'k node_modules/gsap/gsap-core.js:91 false',
      '(anonymous) chunks/730.js:1:5 true',
    ]);
  });
});
