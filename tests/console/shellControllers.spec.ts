import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {shellFiles} from './shellSource';

/*
 * THE SHELL'S STRUCTURE HOLDS (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S2 / S6).
 *
 * `ConsoleShell.vue` is a composition root: `setup()` constructs the controllers under `console/shell/` (and the
 * supervisor) and SPREADS what each returns, so the template, the `watch` table and the hooks reach every member by its
 * name. That composition has four ways to go wrong silently — none of them a type error, each of them a bug that would
 * show as «a value that never updates» or «a press that does nothing»:
 *
 *  ① two controllers return the same name — the later spread wins, the earlier member is shadowed;
 *  ② a name is returned by a controller AND still declared in the shell's options — Vue resolves setup state first;
 *  ③ a template `ref="x"` shares its name with a returned member — Vue writes the ELEMENT into that setup ref;
 *  ④ a controller is written but never constructed / spread — its members do not exist on the instance.
 *
 * …and one that the production build catches and `vue-tsc` does not:
 *
 *  ⑤ a `.ts` controller imports a NAMED export from a `.vue` file — plain tsc sees `*.vue` through the shim.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SHELL = path.join(ROOT, 'src', 'client', 'components', 'console', 'ConsoleShell.vue');
const read = (file: string) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

type Controller = {file: string, factory: string, members: ReadonlyArray<string>};

function controllers(): ReadonlyArray<Controller> {
  const out: Array<Controller> = [];
  for (const file of shellFiles()) {
    if (file === SHELL) {
      continue;
    }
    const text = read(file);
    const factory = /\nexport function (create\w+Controller)\(/.exec(text)?.[1];
    if (factory === undefined) {
      continue; // a shared-state module of the shell, not a controller
    }
    const open = text.lastIndexOf('\n  return {\n');
    const close = text.indexOf('\n  };', open);
    const members = text.slice(open, close).split('\n').flatMap((row) => {
      const key = /^ {4}(\w+)[,:]/.exec(row);
      return key === null ? [] : [key[1]];
    });
    out.push({file: path.relative(ROOT, file).split(path.sep).join('/'), factory, members});
  }
  return out;
}

type ShellOwn = {props: Array<string>, data: Array<string>, computed: Array<string>, methods: Array<string>, watchers: Array<string>};

/** What the shell's own options declare: props, data fields, computeds, methods, watch rows (each at its block's indent). */
function shellOwn(shell: string): ShellOwn {
  const script = shell.slice(shell.indexOf('<script lang="ts">'));
  const block = (open: string, close: string, row: RegExp): Array<string> => {
    const from = script.indexOf(open);
    if (from === -1) {
      return [];
    }
    const names: Array<string> = [];
    for (const line of script.slice(from, script.indexOf(close, from)).split('\n')) {
      const key = row.exec(line);
      if (key !== null) {
        names.push(key[1]);
      }
    }
    return names;
  };
  return {
    props: block('\n  props: {\n', '\n  },\n', /^ {4}(\w+): \{/),
    data: block('\n  data() {\n', '\n  },\n', /^ {6}(\w+)[,:]/),
    computed: block('\n  computed: {\n', '\n  watch: {\n', /^ {4}(?:async )?(\w+)\(/),
    methods: block('\n  methods: {\n', '\n  mounted() {\n', /^ {4}(?:async )?(\w+)\(/),
    watchers: block('\n  watch: {\n', '\n  methods: {\n', /^ {4}('[^']+'|\w+)(?:\(|: \{)/),
  };
}

/** …as one list of names. */
function shellOwnNames(shell: string): ReadonlyArray<string> {
  const own = shellOwn(shell);
  return [...own.props, ...own.data, ...own.computed, ...own.methods];
}

/**
 * THE SHELL ONLY SHRINKS. What it still declares is not domain code: the mirrors of module state the template and the
 * path watchers need, three facts of the phase anchors, a handful of one-line verbs, and the `watch` table (the ordered
 * list of reactions — each a one-line delegate). A NEW data field, computed, method or watch row here is a domain member
 * in the wrong place: it belongs in a controller (`.claude/rules/console-flow.md` § The shell is being taken apart).
 * When a member LEAVES the shell, lower its bound in the same diff.
 */
const SHELL_BOUNDS = {data: 38, computed: 3, methods: 28, watchers: 145, lines: 3800};

describe('the shell is a composition root — its controllers', () => {
  const shell = read(SHELL);
  const all = controllers();

  it('reads a real structure (anti-vacuous): the controllers and their members are found', () => {
    expect(all.length, 'controllers under console/shell/ and console/supervisor/').to.be.greaterThan(10);
    expect(all.reduce((n, c) => n + c.members.length, 0), 'members they return').to.be.greaterThan(150);
    expect(all.map((c) => c.factory)).to.include.members(['createViewerController', 'createSupervisorController']);
  });

  it('① no name is returned by two controllers (the later spread would shadow the earlier member)', () => {
    const owners = new Map<string, Array<string>>();
    for (const c of all) {
      for (const member of c.members) {
        owners.set(member, [...(owners.get(member) ?? []), c.file]);
      }
    }
    const twice = [...owners].filter(([, files]) => files.length > 1).map(([member, files]) => `${member}: ${files.join(' + ')}`);
    expect(twice, 'one member, one owner').to.deep.equal([]);
  });

  it('② no name is returned by a controller AND declared in the shell\'s own options', () => {
    const own = new Set(shellOwnNames(shell));
    expect(own.size, 'the shell\'s own names are read').to.be.greaterThan(20);
    const both = all.flatMap((c) => c.members.filter((member) => own.has(member)).map((member) => `${member} (${c.file})`));
    expect(both, 'a member lives in ONE place — move it, do not copy it').to.deep.equal([]);
  });

  it('③ no template ref shares its name with a returned member (Vue would write the element into it)', () => {
    const template = shell.slice(0, shell.indexOf('<script lang="ts">'));
    const refs = new Set([...template.matchAll(/\bref="([\w$]+)"/g)].map((m) => m[1]));
    expect(refs.size, 'the template\'s refs are read').to.be.greaterThan(10);
    const hit = all.flatMap((c) => c.members.filter((member) => refs.has(member)).map((member) => `${member} (${c.file})`));
    expect(hit, 'rename the ref or the member').to.deep.equal([]);
  });

  it('④ every controller is constructed once in setup() and spread into what setup returns', () => {
    const setup = shell.slice(shell.indexOf('\n  setup() {\n'), shell.indexOf('\n  data() {\n'));
    const problems: Array<string> = [];
    for (const c of all) {
      const made = [...setup.matchAll(new RegExp(`const (\\w+) = ${c.factory}\\(`, 'g'))];
      if (made.length !== 1) {
        problems.push(`${c.factory}: constructed ${made.length} time(s) in setup()`);
        continue;
      }
      if (!new RegExp(`\\.\\.\\.${made[0][1]}\\b`).test(setup)) {
        problems.push(`${c.factory}: «${made[0][1]}» is not spread into setup()'s return`);
      }
    }
    expect(problems).to.deep.equal([]);
  });

  it('⑤ no controller imports a NAMED export from a .vue file (plain tsc — the production build — cannot see it)', () => {
    const offenders: Array<string> = [];
    for (const file of shellFiles()) {
      if (file === SHELL) {
        continue;
      }
      for (const line of read(file).split('\n')) {
        if (/^import\b/.test(line) && /\{[^}]*\}\s+from\s+'[^']+\.vue';/.test(line)) {
          offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')}: ${line.trim()}`);
        }
      }
    }
    expect(offenders, 'move the type into the SFC\'s sibling `<component>Types.ts` and import it from there').to.deep.equal([]);
  });

  it('THE SHELL ONLY SHRINKS: no new data field, computed, method or watch row', () => {
    const own = shellOwn(shell);
    const counts = {
      data: own.data.length, computed: own.computed.length, methods: own.methods.length, watchers: own.watchers.length,
      lines: shell.split('\n').length,
    };
    expect(own.watchers.length, 'the watch table is read').to.be.greaterThan(100);
    for (const key of Object.keys(SHELL_BOUNDS) as Array<keyof typeof SHELL_BOUNDS>) {
      expect(counts[key], `the shell's ${key}: ${counts[key]} — new shell behaviour is a CONTROLLER member, not a member of ` +
        'ConsoleShell.vue (lower the bound when one leaves)').to.be.at.most(SHELL_BOUNDS[key]);
    }
  });

  it('the watch block is a TABLE: every row only delegates to its reaction\'s body (`this.when<Key>Changes(…)`)', () => {
    const watch = shell.slice(shell.indexOf('\n  watch: {\n'), shell.indexOf('\n  methods: {\n'));
    const delegates = watch.match(/this\.when\w+Changes\d*\(/g) ?? [];
    expect(delegates.length, 'the delegates are read').to.be.greaterThan(100);
    // Whatever uses the instance in the table and is not a delegate is a body that stayed behind.
    const stray = watch.split('\n').filter((line) => /\bthis\./.test(line) && !/^\s*(?:return )?this\.when\w+Changes\d*\([\w, ]*\);$/.test(line))
      .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line));
    expect(stray, 'move the body into its controller as `when<Key>Changes` — the table keeps the order, nothing else').to.deep.equal([]);
  });

  it('the shell proves it provides every port: one conformance row per controller that has one', () => {
    const conform = shell.slice(shell.indexOf('    shellPortsConform(): void {'));
    const body = conform.slice(0, conform.indexOf('\n    },\n'));
    const missing: Array<string> = [];
    for (const file of shellFiles()) {
      if (file === SHELL) {
        continue;
      }
      const port = /\nexport type (\w+Port) = \{/.exec(read(file))?.[1];
      if (port !== undefined && !new RegExp(`: ${port} = this;`).test(body)) {
        missing.push(port);
      }
    }
    expect(missing, 'a port the shell does not prove it provides is checked by nobody (vue-tsc reads these rows)').to.deep.equal([]);
  });
});
