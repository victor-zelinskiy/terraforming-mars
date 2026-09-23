import {expect} from 'chai';
import * as path from 'path';
import {pathToFileURL} from 'url';

/*
 * `npm run push`'s tree check (scripts/pushTree.mjs). A push got stuck on «working tree is not clean»
 * with NOTHING to commit: a temporary file had been `git add`ed and then deleted from disk, leaving an
 * `AD` index entry — in neither HEAD nor the tree. Such a PHANTOM is dropped, UNTRACKED files never
 * block (a rebase and an amend do not touch them), and every REAL change still refuses the push — by name.
 *
 * It got stuck a second time, the mirror image: package.json staged at an OLDER version than the tip,
 * while HEAD and the working tree already agreed on the newer one (`MM`, net change vs HEAD: zero). A
 * STALE index entry like that is unstaged — it has nothing to commit, and the version amend would
 * otherwise sweep the stale blob straight into the tip. It is only recognisable with the set of paths
 * that really differ from HEAD, so the classifier takes it; a CONFLICT is never stale.
 */
type Entry = {code: string, path: string};
type Verdict = {phantoms: Array<Entry>, stale: Array<Entry>, untracked: Array<Entry>, blocking: Array<Entry>};
type TreeModule = {
  parsePorcelainZ: (raw: string) => Array<Entry>,
  classifyTree: (entries: Array<Entry>, netChanged?: Set<string>) => Verdict,
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
    expect(verdict.stale, 'without the net-change set nothing is reclassified').deep.eq([]);
    expect(verdict.blocking.map((e) => e.path), 'a staged file on disk, a tracked file deleted or edited, a conflict — all real work')
      .deep.eq(['edited.ts', 'new-and-present.ts', 'tracked-then-deleted.ts', 'deleted.ts', 'conflicted.ts']);
  });

  it('a staged change the tree has already undone is STALE — it has nothing to commit, and an amend would sweep it in', async () => {
    const {classifyTree} = await load();
    const verdict = classifyTree([
      {code: 'MM', path: 'package.json'},      // staged at the old version, tree back at HEAD's
      {code: 'MM', path: 'package-lock.json'}, // in lockstep with it, same story
      {code: 'MM', path: 'real-work.ts'},      // staged AND actually different from HEAD
      {code: ' M', path: 'edited-only.ts'},
      {code: ' D', path: 'nothing-staged.ts'}, // nothing in the index to be stale ABOUT
    ], new Set(['real-work.ts', 'edited-only.ts']));
    expect(verdict.stale.map((e) => e.path)).deep.eq(['package.json', 'package-lock.json']);
    expect(verdict.blocking.map((e) => e.path)).deep.eq(['real-work.ts', 'edited-only.ts', 'nothing-staged.ts']);
  });

  it('an unmerged entry BLOCKS even when the tree happens to match HEAD — the merge is still owed a resolution', async () => {
    const {classifyTree} = await load();
    const netChanged = new Set<string>();
    const verdict = classifyTree([
      {code: 'UU', path: 'both-edited.ts'},
      {code: 'AA', path: 'both-added.ts'},
      {code: 'DD', path: 'both-deleted.ts'},
      {code: 'DU', path: 'deleted-by-us.ts'},
    ], netChanged);
    expect(verdict.stale).deep.eq([]);
    expect(verdict.blocking).has.length(4);
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
