import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {codeOnly, SHELL_MEMBERS, SHELL_REACTIONS, shellFiles} from './shellSource';

/*
 * THE SHELL'S STRUCTURE HOLDS (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S2 / S6 / S-last).
 *
 * `ConsoleShell.vue` is LAYOUT: its template, the components it renders, its props — and a `setup()` that returns ONE
 * composition (`console/shell/useConsoleShell.ts`). The composition constructs the controllers under `console/shell/`
 * (and the supervisor) in `shellMembers.ts` and SPREADS what each returns, so the template and the reactions table
 * reach every member by its name. That composition has four ways to go wrong silently — none of them a type error,
 * each of them a bug that would show as «a value that never updates» or «a press that does nothing»:
 *
 *  ① two controllers return the same name — the later spread wins, the earlier member is shadowed;
 *  ② a name is returned by a controller AND declared by the shell itself (a mirror, a ref of its own, a prop);
 *  ③ a template `ref="x"` shares its name with a returned member — Vue writes the ELEMENT into that setup ref;
 *  ④ a controller is written but never constructed / spread — its members do not exist on the shell.
 *
 * …and one that the production build catches and `vue-tsc` does not:
 *
 *  ⑤ a `.ts` controller imports a NAMED export from a `.vue` file — plain tsc sees `*.vue` through the shim.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SHELL = path.join(ROOT, 'src', 'client', 'components', 'console', 'ConsoleShell.vue');
const COMPOSITION = path.join(ROOT, 'src', 'client', 'console', 'shell', 'useConsoleShell.ts');
const PORT = path.join(ROOT, 'src', 'client', 'console', 'shell', 'shellPort.ts');
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
      continue; // a shared-state module of the shell, or its composition — not a controller
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

type ShellOwn = {props: Array<string>, mirrors: Array<string>, refs: Array<string>, reactions: Array<string>};

/** What the shell declares ITSELF: the SFC's props, the mirrors of module state, the composition's own refs, the reactions. */
function shellOwn(): ShellOwn {
  const script = read(SHELL).slice(read(SHELL).indexOf('<script lang="ts">'));
  const members = read(SHELL_MEMBERS);
  const rowsOf = (text: string, open: string, close: string, row: RegExp): Array<string> => {
    const from = text.indexOf(open);
    if (from === -1) {
      return [];
    }
    const names: Array<string> = [];
    for (const line of text.slice(from, text.indexOf(close, from)).split('\n')) {
      const key = row.exec(line);
      if (key !== null) {
        names.push(key[1]);
      }
    }
    return names;
  };
  const compose = members.slice(members.indexOf('\nexport function composeShellMembers('));
  const returned = /\n {2}return \{\.\.\.shellMirrors\(\), ([^}]*)\};/.exec(compose)?.[1] ?? '';
  return {
    props: rowsOf(script, '\n  props: {\n', '\n  },\n', /^ {4}(\w+): \{/),
    mirrors: rowsOf(members, '\nfunction shellMirrors() {\n', '\n  };\n', /^ {4}(\w+)[,:]/),
    refs: returned.split(',').map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('...')),
    reactions: codeOnly(read(SHELL_REACTIONS)).split('\n').filter((line) => /^ {2}watch\(/.test(line)),
  };
}

/** …as one list of names. */
function shellOwnNames(): ReadonlyArray<string> {
  const own = shellOwn();
  return [...own.props, ...own.mirrors, ...own.refs];
}

/**
 * THE SHELL ONLY SHRINKS. What it still declares is not domain code: the mirrors of module state the template and the
 * reactions' paths read, and the reactions table (the ordered list — each row a one-line delegate). A NEW mirror or a
 * new row is a domain member in the wrong place: it belongs in a controller (`.claude/rules/console-flow.md` § The
 * shell is layout). When one LEAVES, lower its bound in the same diff.
 */
const SHELL_BOUNDS = {mirrors: 34, reactions: 145, lines: 1860};

describe('the shell is a composition root — its controllers', () => {
  const shell = read(SHELL);
  const all = controllers();

  it('reads a real structure (anti-vacuous): the controllers and their members are found', () => {
    expect(all.length, 'controllers under console/shell/ and console/supervisor/').to.be.greaterThan(10);
    expect(all.reduce((n, c) => n + c.members.length, 0), 'members they return').to.be.greaterThan(150);
    expect(all.map((c) => c.factory)).to.include.members(['createViewerController', 'createSupervisorController', 'createWiringController']);
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

  it('② no name is returned by a controller AND declared by the shell itself (a prop, a mirror, a ref of its own)', () => {
    const own = new Set(shellOwnNames());
    expect(own.size, 'the shell\'s own names are read').to.be.greaterThan(20);
    expect([...own], 'the props, the mirrors and the composition\'s own refs are all read')
      .to.include.members(['playerView', 'consoleState', 'surfaces', 'conRootEl']);
    const both = all.flatMap((c) => c.members.filter((member) => own.has(member)).map((member) => `${member} (${c.file})`));
    expect(both, 'a member lives in ONE place — move it, do not copy it').to.deep.equal([]);
  });

  it('③ no template ref shares its name with a returned member (Vue would write the element into it)', () => {
    const template = shell.slice(0, shell.indexOf('<script lang="ts">'));
    const refs = new Set([...template.matchAll(/(?<![:\w])ref="([\w$]+)"/g)].map((m) => m[1]));
    // The surfaces a controller reaches stand in the REGISTRY (`:ref="surfaces.bind.<name>"` — S3); a string ref is
    // what is left for a setup ref of the shell's own (its root, the three hull members the band geometry measures,
    // the dock).
    const bound = new Set([...template.matchAll(/:ref="surfaces\.bind\.([\w$]+)"/g)].map((m) => m[1]));
    expect(bound.size, 'the surfaces bound through the registry are read').to.be.greaterThan(30);
    expect(refs.size, 'the template\'s string refs are read').to.be.greaterThan(0);
    const hit = all.flatMap((c) => c.members.filter((member) => refs.has(member)).map((member) => `${member} (${c.file})`));
    expect(hit, 'rename the ref or the member').to.deep.equal([]);
  });

  it('④ every controller is constructed once in the composition and spread into what it returns', () => {
    const members = read(SHELL_MEMBERS);
    const compose = members.slice(members.indexOf('\nexport function composeShellMembers('), members.indexOf('\nexport type ShellMembers'));
    expect(compose.length, 'the composition is read').to.be.greaterThan(1000);
    const problems: Array<string> = [];
    for (const c of all) {
      const made = [...compose.matchAll(new RegExp(`const (\\w+) = ${c.factory}\\(`, 'g'))];
      if (made.length !== 1) {
        problems.push(`${c.factory}: constructed ${made.length} time(s) in composeShellMembers()`);
        continue;
      }
      if (!new RegExp(`\\.\\.\\.${made[0][1]}\\b`).test(compose)) {
        problems.push(`${c.factory}: «${made[0][1]}» is not spread into the composition's return`);
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

  it('THE SHELL IS LAYOUT: the SFC declares no data, computed, methods, watch or hooks — its setup() is ONE composition', () => {
    const script = codeOnly(shell.slice(shell.indexOf('<script lang="ts">'), shell.lastIndexOf('</script>')));
    const options = [...script.matchAll(/^ {2}(\w+)(?:\(\w*\) \{|: \{|: )/gm)].map((m) => m[1]);
    expect(options, 'the component\'s options — new behaviour is a controller member, a new reaction a row of the table')
      .to.deep.equal(['name', 'components', 'props', 'setup']);
    const setup = script.slice(script.indexOf('\n  setup(props) {\n'));
    expect(setup.slice(0, setup.indexOf('\n  },')).split('\n').map((line) => line.trim()).filter((line) => line !== ''))
      .to.deep.equal(['setup(props) {', 'return useConsoleShell(props);']);
    expect(script, 'nothing in the shell asks for the instance').to.not.match(/\bthis\b|getCurrentInstance/);
  });

  it('THE COMPOSITION KEEPS ITS ORDER: the members, the port bound, the reactions, the wiring hooks LAST — and asks for no instance', () => {
    const compose = codeOnly(read(COMPOSITION));
    const order = ['useConsoleNativeSurface();', 'useConsoleSession();', 'createShellPort(props)', 'composeShellMembers(port)', 'port.bind(members)',
      'installShellReactions(shell)', 'onMounted(() => shell.shellMounted())', 'onBeforeUnmount(() => shell.shellLeaving())', 'return members;'];
    const at = order.map((step) => compose.indexOf(step));
    expect(at.every((index) => index !== -1), `every step stands: ${order.filter((_, i) => at[i] === -1).join(' · ')}`).to.equal(true);
    expect(at, 'the controllers\' own watchers and hooks first, then the table, then the shell\'s two hooks').to.deep.equal([...at].sort((a, b) => a - b));
    for (const file of [COMPOSITION, PORT, SHELL_MEMBERS, SHELL_REACTIONS]) {
      expect(codeOnly(read(file)), `${path.basename(file)} runs in any effect scope — a Vapor component has no instance`).to.not.match(/getCurrentInstance|\.proxy\b/);
    }
  });

  it('THE SHELL ONLY SHRINKS: no new mirror, no new reaction row', () => {
    const own = shellOwn();
    const counts = {mirrors: own.mirrors.length, reactions: own.reactions.length, lines: shell.split('\n').length};
    expect(own.reactions.length, 'the reactions table is read').to.be.greaterThan(100);
    expect(own.mirrors.length, 'the mirrors are read').to.be.greaterThan(20);
    for (const key of Object.keys(SHELL_BOUNDS) as Array<keyof typeof SHELL_BOUNDS>) {
      expect(counts[key], `the shell's ${key}: ${counts[key]} — new shell behaviour is a CONTROLLER member, not a member of ` +
        'the shell (lower the bound when one leaves)').to.be.at.most(SHELL_BOUNDS[key]);
    }
  });

  it('the reactions are a TABLE: every row only delegates to its reaction\'s body (`shell.when<Key>Changes(…)`)', () => {
    const table = codeOnly(read(SHELL_REACTIONS));
    const body = table.slice(table.indexOf('\nexport function installShellReactions(shell: Shell): void {\n'), table.lastIndexOf('\n}'));
    const lines = body.split('\n').slice(2).filter((line) => line.trim() !== '');
    expect(lines.length, 'the rows are read').to.be.greaterThan(100);
    // A row: ONE source read off the shell, ONE delegate, its options. Anything else is a body that stayed behind.
    const row = /^ {2}watch\(\(\) => shell\.[\w.?]+, \([\w, ]*\) => shell\.when\w+Changes\d*\([\w, ]*\)(?:, \{[^}]*\})?\);$/;
    const stray = lines.filter((line) => !row.test(line));
    expect(stray, 'move the body into its controller as `when<Key>Changes` — the table keeps the order, nothing else').to.deep.equal([]);
  });

  it('the shell proves it provides every port: one conformance row per controller that has one', () => {
    const members = read(SHELL_MEMBERS);
    const conform = members.slice(members.indexOf('\nexport function shellPortsConform(shell: Shell): void {'));
    const body = conform.slice(0, conform.indexOf('\n}\n'));
    expect(body.length, 'the conformance rows are read').to.be.greaterThan(500);
    const missing: Array<string> = [];
    for (const file of shellFiles()) {
      if (file === SHELL) {
        continue;
      }
      const port = /\nexport type (\w+Port) = \{/.exec(read(file))?.[1];
      if (port !== undefined && !new RegExp(`: ${port} = shell;`).test(body)) {
        missing.push(port);
      }
    }
    expect(missing, 'a port the shell does not prove it provides is checked by nobody (tsc reads these rows)').to.deep.equal([]);
  });
});
