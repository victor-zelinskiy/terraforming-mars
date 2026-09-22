import {expect} from 'chai';
import * as path from 'path';
import {pathToFileURL} from 'url';

/*
 * `npm run push`'s tree check (scripts/pushTree.mjs). A push got stuck on «working tree is not clean»
 * with NOTHING to commit: a temporary file had been `git add`ed and then deleted from disk, leaving an
 * `AD` index entry — in neither HEAD nor the tree. Such a PHANTOM is dropped, UNTRACKED files never
 * block (a rebase and an amend do not touch them), and every REAL change still refuses the push — by name.
 */
type Entry = {code: string, path: string};
type TreeModule = {
  parsePorcelainZ: (raw: string) => Array<Entry>,
  classifyTree: (entries: Array<Entry>) => {phantoms: Array<Entry>, untracked: Array<Entry>, blocking: Array<Entry>},
  describeBlocking: (entries: Array<Entry>, limit?: number) => string,
};

const load = (): Promise<TreeModule> => import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'pushTree.mjs')).href) as Promise<TreeModule>;

describe('npm run push — the working tree, classified', () => {
  it('parses -z porcelain, keeping the leading space of a status code and a rename\'s original path out of the list', async () => {
    const {parsePorcelainZ} = await load();
    const raw = ['AD tests/e2e/tmp.spec.ts', ' M src/a.ts', 'R  src/new.ts', 'src/old.ts', '?? notes.txt', ''].join('\0');
    expect(parsePorcelainZ(raw)).deep.eq([
      {code: 'AD', path: 'tests/e2e/tmp.spec.ts'},
      {code: ' M', path: 'src/a.ts'},
      {code: 'R ', path: 'src/new.ts'},
      {code: '??', path: 'notes.txt'},
    ]);
    expect(parsePorcelainZ(''), 'a clean tree').deep.eq([]);
  });

  it('a staged-then-deleted file is a PHANTOM, an untracked file is ignored, everything else BLOCKS', async () => {
    const {classifyTree} = await load();
    const verdict = classifyTree([
      {code: 'AD', path: 'tmp.spec.ts'},
      {code: '??', path: 'scratch.txt'},
      {code: ' M', path: 'edited.ts'},
      {code: 'A ', path: 'new-and-present.ts'},
      {code: 'MD', path: 'tracked-then-deleted.ts'},
      {code: ' D', path: 'deleted.ts'},
      {code: 'UU', path: 'conflicted.ts'},
    ]);
    expect(verdict.phantoms.map((e) => e.path)).deep.eq(['tmp.spec.ts']);
    expect(verdict.untracked.map((e) => e.path)).deep.eq(['scratch.txt']);
    expect(verdict.blocking.map((e) => e.path), 'a staged file on disk, a tracked file deleted or edited, a conflict — all real work')
      .deep.eq(['edited.ts', 'new-and-present.ts', 'tracked-then-deleted.ts', 'deleted.ts', 'conflicted.ts']);
  });

  it('the refusal NAMES the files, capped', async () => {
    const {describeBlocking} = await load();
    const entries = Array.from({length: 14}, (_, i) => ({code: ' M', path: `f${i}.ts`}));
    const text = describeBlocking(entries, 12);
    expect(text.split('\n')).has.length(13);
    expect(text).contains('  M f0.ts');
    expect(text).contains('…and 2 more');
  });
});
