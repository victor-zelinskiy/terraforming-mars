import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE SHELL'S CODE, WHEREVER IT LIVES — for the source guards.
 *
 * `ConsoleShell.vue` is being taken apart (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5): a member
 * a guard looks up may stand in the SFC today and in a controller (`src/client/console/shell/*.ts`, the supervisor)
 * tomorrow, and the same line reads `this.colonyModel` in one and `colonyModel.value` / `shell.colonyModel` in the
 * other. A guard that names a FILE and a DIALECT breaks on every move without the wiring having changed at all.
 *
 * So the guards read ONE corpus in ONE dialect — the monolith's: the SFC as it is, and every controller module put
 * BACK into it (`shell.x` → `this.x`; a member's own `x.value` / `x(…)` → `this.x` / `this.x(…)`; an `ownX` alias →
 * `this.x`). What a controller's members are is read off its own `return {…}` — the extraction tool's contract — so the
 * translation is exact, not a guess: a free `x` that is NOT a member (an import, a local) stays `x`.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SHELL_SFC = path.join(ROOT, 'src', 'client', 'components', 'console', 'ConsoleShell.vue');
const CONTROLLER_DIRS = [
  path.join(ROOT, 'src', 'client', 'console', 'shell'),
  path.join(ROOT, 'src', 'client', 'console', 'supervisor'),
];

/** Code only: block, line and template comments dropped (a comment may quote what a guard forbids). */
export function codeOnly(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const escape = (text: string) => text.replace(/[$]/g, '\\$');

/**
 * The SFC's MIRRORS — data fields that ARE an imported module state (`consoleState`, `hydroFlow: hydroFlowState`): the
 * monolith read them as `this.<field>`, a controller reads the import itself.
 */
export function shellMirrors(sfc: string): ReadonlyArray<{name: string, imported: string}> {
  const text = sfc.replace(/\r\n/g, '\n');
  const data = text.indexOf('\n  data() {\n');
  if (data === -1) {
    return [];
  }
  const block = text.slice(data, text.indexOf('\n  },\n', data));
  const imports = text.slice(text.indexOf('<script'), data).split('\n').filter((line) => line.startsWith('import ')).join('\n');
  const out: Array<{name: string, imported: string}> = [];
  for (const line of block.split('\n')) {
    const row = /^ {6}(\w+)(?:: (\w+))?,$/.exec(line);
    if (row === null) {
      continue;
    }
    const imported = row[2] ?? row[1];
    if (new RegExp(`[{,\\s]${escape(imported)}[},\\s]`).test(imports)) {
      out.push({name: row[1], imported});
    }
  }
  return out;
}

/** A controller module, read in the monolith's dialect. */
export function inMonolithDialect(controller: string, mirrors: ReadonlyArray<{name: string, imported: string}> = []): string {
  const text = controller.replace(/\r\n/g, '\n');
  const open = text.lastIndexOf('\n  return {\n');
  if (open === -1 || !/\nexport function create\w+Controller\(/.test(text)) {
    return text; // not a controller (a shared-state module)
  }
  const close = text.indexOf('\n  };', open);
  const members: Array<{name: string, local: string}> = [];
  for (const row of text.slice(open, close).split('\n')) {
    const key = /^ {4}(\w+)(?:: (\w+))?,$/.exec(row);
    if (key !== null) {
      members.push({name: key[1], local: key[2] ?? key[1]});
    }
  }
  let body = text.slice(0, open).replace(/\bshell\./g, 'this.');
  // (below the imports only: an import line keeps the module state's own name)
  const firstCode = body.search(/\nexport (?:type|function|const) /);
  for (const {name, imported} of mirrors) {
    body = body.slice(0, firstCode) + body.slice(firstCode).replace(new RegExp(`(?<![\\w$.])${escape(imported)}(?![\\w$])`, 'g'), `this.${name}`);
  }
  for (const {name, local} of members) {
    const id = escape(local);
    if (new RegExp(`\\n {2}const ${id} = (?:ref|computed)\\(`).test(body)) {
      body = body.replace(new RegExp(`(?<![\\w$.])${id}\\.value\\b`, 'g'), `this.${name}`);
    } else if (new RegExp(`\\n {2}(?:async )?function ${id}\\b`).test(body)) {
      // every use but the declaration itself (`function x(` keeps its name — `shellMember` finds it by it)
      body = body.replace(new RegExp(`(?<!function )(?<![\\w$.])${id}(?![\\w$])`, 'g'), `this.${name}`);
      if (local !== name) {
        body = body.replace(new RegExp(`function ${id}\\b`), `function ${name}`);
      }
    }
    if (local !== name) {
      body = body.replace(new RegExp(`\\n {2}const ${id} = (ref|computed)\\(`), `\n  const ${name} = $1(`);
    }
  }
  // …and its SHAPE: a member is `name(…): T {` … `},` at the options' indent, as it stood in the SFC — so a guard's own
  // «the body of member X» reader finds it in either home.
  const factory = body.search(/\nexport function create\w+Controller\(/);
  const lines = body.slice(factory + 1).split('\n');
  let closing: string | undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (closing !== undefined) {
      if (line === closing) {
        lines[i] = '  },';
        closing = undefined;
      }
    } else if (/^ {2}(?:async )?function \w+/.test(line)) {
      lines[i] = line.replace(/^( {2}(?:async )?)function /, '$1');
      closing = '  }';
    } else if (/^ {2}const \w+ = computed\(\(\).* => \{$/.test(line)) {
      lines[i] = line.replace(/^ {2}const (\w+) = computed\(\(\)(.*) => \{$/, '  $1()$2 {');
      closing = '  });';
    }
    if (lines[i] !== '') {
      lines[i] = '  ' + lines[i];
    }
  }
  return body.slice(0, factory + 1) + lines.join('\n') + text.slice(open);
}

/**
 * The files of the shell's code — the controllers FIRST, the SFC last: a guard's «the body of member X» reader takes
 * the first `X(` it meets, and the SFC's `watch` table has a ROW named after the computed it watches (`colonyFollowUpLive(live)
 * { this.when…Changes(live); }`) — the member itself must be met before its watcher's row.
 */
export function shellFiles(): ReadonlyArray<string> {
  const controllers = CONTROLLER_DIRS.flatMap((dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).sort().map((f) => path.join(dir, f)) : []));
  return [...controllers, SHELL_SFC];
}

const corpus = new Map<boolean, string>();

/** The whole of it, in the monolith's dialect. `comments: false` (the default) drops them. */
export function shellCode(options: {comments?: boolean} = {}): string {
  const comments = options.comments === true;
  let text = corpus.get(comments);
  if (text === undefined) {
    const mirrors = shellMirrors(fs.readFileSync(SHELL_SFC, 'utf8'));
    text = shellFiles().map((file) => {
      const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const translated = file === SHELL_SFC ? raw : inMonolithDialect(raw, mirrors);
      return comments ? translated : codeOnly(translated);
    }).join('\n');
    corpus.set(comments, text);
  }
  return text;
}

/**
 * The body of a member — a method or a computed of the SFC (`name(...) {` at the options' indent), or a controller's
 * `function name(` / `const name = computed(` — from its first line to the line that closes it, in the monolith's
 * dialect. Fails (by name) when the member is gone.
 */
export function shellMember(name: string, options: {comments?: boolean} = {}): string {
  const source = shellCode(options);
  const id = escape(name);
  const forms: ReadonlyArray<{open: RegExp, close: RegExp}> = [
    {open: new RegExp(`\\n {4}(?:async )?${id}\\(`), close: /\n {4}},\n/},
    {open: new RegExp(`\\n {2}(?:async )?function ${id}(?:<[^>]*>)?\\(`), close: /\n {2}}\n/},
    {open: new RegExp(`\\n {2}const ${id} = computed\\(`), close: /\n {2}}\);\n/},
  ];
  for (const form of forms) {
    const start = source.search(form.open);
    if (start === -1) {
      continue;
    }
    const rest = source.slice(start + 1);
    const end = rest.search(form.close);
    return rest.slice(0, end === -1 ? undefined : end);
  }
  return expect.fail(`the shell's code still has «${name}» (in the SFC or in a controller under console/shell/)`);
}
