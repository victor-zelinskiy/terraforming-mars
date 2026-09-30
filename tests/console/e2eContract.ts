import * as fs from 'fs';
import * as path from 'path';

/**
 * THE E2E CONTRACT — what an e2e spec waits for, read STATICALLY.
 *
 * An e2e spec talks to the product through two vocabularies: DOM HOOKS
 * (`[data-sit-reward-state]`, `.con-parl__pline`) and COPY (`toContainText(/Ваша
 * награда/)`). Both belong to the PRODUCT and both are renamed / removed by
 * product work — and the e2e tree is the one place nobody re-reads when that
 * happens, because a full run takes hours and nothing else compiles against
 * it. The spec does not fail at the commit that broke it; it fails weeks later
 * as a 30 s timeout on a selector, in front of an agent who did not write
 * either side and has to reverse-engineer «is this red mine?». Measured on
 * 2026-09-30: 110 dead hooks across 70 files — failing specs, dead fallbacks
 * in `a, b` selectors that hid what the spec meant, and «must be absent»
 * checks on legacy modals deleted in wave 2 (always true, proving nothing).
 *
 * This module is the ONE reader of that contract, shared by the liveness guard
 * (`e2eLiveness.spec.ts` — fails the commit that kills a hook a spec still
 * uses) and the affected-spec finder (`tests/console/e2eAffected.ts` — which specs
 * a change of product files can break, i.e. which ones to run before
 * committing). PURE: file reads and regexes, no imports of the product.
 */

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const E2E_DIR = path.join(REPO_ROOT, 'tests', 'e2e');

export type HookKind = 'attr' | 'class';
/** One hook an e2e file references: `data-*` attribute or class token; a trailing `-`/`_` means a dynamic PREFIX (`.con-x--${state}`). */
export type HookRef = {kind: HookKind; token: string; file: string; line: number};
/** One product phrase an e2e text assertion waits for (a Cyrillic run of words, lower-cased, ё → е). */
export type CopyRef = {phrase: string; file: string; line: number};

export function walk(dir: string, exts: ReadonlyArray<string>, skipDirs: ReadonlyArray<string> = ['node_modules']): Array<string> {
  const out: Array<string> = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.includes(entry.name)) {
        out.push(...walk(full, exts, skipDirs));
      }
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Blank out comments, keeping every newline — so line numbers survive and prose about a hook is never a use of it. */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

/** Every e2e source (specs AND the shared drivers — a driver's dead selector breaks forty specs), fixtures excluded. */
export function e2eFiles(): Array<string> {
  return walk(E2E_DIR, ['.ts'], ['node_modules', 'fixtures']);
}

export function rel(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
/**
 * `data-*` attribute names used as HOOKS: inside a selector (`[data-x…]`) or as the WHOLE string (`getAttribute('data-x')`).
 * A trailing dash is a dynamic prefix (`[data-parl-seat-${kind}]`). The same word inside prose — an assertion
 * message saying «a data-or-microbe law» — is not a hook.
 */
const ATTR = /(?:^|\[\s*)(data-[a-z0-9]+(?:-[a-z0-9]+)*-?)/g;
/** A class token used as a SELECTOR: a dot after a selector boundary, a BEM-ish name (at least one separator). */
const CLASS = /(?:^|[\s(,>+~\]):])\.([a-z][a-z0-9]*(?:(?:--|__|-|_)[a-z0-9]+)+(?:--|__|-|_)?)/g;
/** Things that look like `.name-x` and are not classes: file names, versions. */
const NOT_A_CLASS = /\.(spec|png|json|ts|js|mjs|cjs|webp|less|css|md|txt|log|html|svg|jpg|jpeg|zip|webm|tsx|br|gz)$/;

/** Every hook an e2e file references in its string literals. */
export function hookRefs(file: string): Array<HookRef> {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const out: Array<HookRef> = [];
  for (const lit of text.matchAll(STRING_LITERAL)) {
    const body = lit[0].slice(1, -1);
    const at = lit.index ?? 0;
    for (const m of body.matchAll(ATTR)) {
      out.push({kind: 'attr', token: m[1], file: rel(file), line: lineOf(text, at + 1 + (m.index ?? 0))});
    }
    for (const m of body.matchAll(CLASS)) {
      if (NOT_A_CLASS.test('.' + m[1])) {
        continue;
      }
      out.push({kind: 'class', token: m[1], file: rel(file), line: lineOf(text, at + 1 + (m.index ?? 0))});
    }
  }
  return out;
}

/** Normalize a phrase for comparison: lower case, ё → е, runs of whitespace → one space. */
export function normPhrase(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/**
 * The first argument of every TEXT ASSERTION (`toContainText`, `toHaveText`,
 * `getByText`, `hasText:`, `toMatch`, `toContain`) — the product copy a spec
 * waits for. A regex's alternation branches are read one by one (`/Выполнил|Won
 * by/`), and only Cyrillic runs are phrases (the English branch is the key,
 * the Russian one is what the console renders).
 */
const TEXT_CALL = /(?:toContainText|toHaveText|getByText|hasText\s*:|toMatch|toContain)\s*\(?\s*(\/(?:[^/\\\n]|\\.)+\/[gimsuy]*|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
const CYRILLIC_RUN = /[А-Яа-яЁё]+(?:[ -][А-Яа-яЁё]+)*/g;

export function copyRefs(file: string): Array<CopyRef> {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const out: Array<CopyRef> = [];
  for (const m of text.matchAll(TEXT_CALL)) {
    const arg = m[1];
    const body = arg.startsWith('/') ? arg.slice(1, arg.lastIndexOf('/')) : arg.slice(1, -1);
    const line = lineOf(text, m.index ?? 0);
    for (const branch of body.split('|')) {
      for (const run of branch.matchAll(CYRILLIC_RUN)) {
        const phrase = normPhrase(run[0]);
        if (phrase.length >= 3) {
          out.push({phrase, file: rel(file), line});
        }
      }
    }
  }
  return out;
}

/**
 * THE PRODUCT'S HOOK CORPUS: the client (Vue + TS), the shared layer (render
 * helpers build class names there too) and the HTML shell — comments blanked.
 * Styles are deliberately NOT part of it: a class that only a stylesheet
 * names is styled, not rendered, and no spec can wait for it.
 */
export function productCorpus(): string {
  const files = [
    ...walk(path.join(REPO_ROOT, 'src', 'client'), ['.vue', '.ts']),
    ...walk(path.join(REPO_ROOT, 'src', 'common'), ['.ts']),
    ...walk(path.join(REPO_ROOT, 'assets'), ['.html'], ['node_modules', 'locales', 'card-images', 'fonts']),
  ];
  return files.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
}

/** Every RU translation value + the client's own text — the vocabulary a text assertion may wait for. */
export function copyVocabulary(): string {
  const values: Array<string> = [];
  const collect = (v: unknown) => {
    if (typeof v === 'string') {
      values.push(normPhrase(v));
    } else if (v !== null && typeof v === 'object') {
      Object.values(v).forEach(collect);
    }
  };
  for (const file of walk(path.join(REPO_ROOT, 'src', 'locales', 'ru'), ['.json'])) {
    collect(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  // The client's own text — its code, never its COMMENTS (a comment saying «значок ПО» once vouched for copy the
  // product had re-worded to «со значком ПО», and the spec waiting for it stayed red for weeks).
  for (const file of walk(path.join(REPO_ROOT, 'src', 'client'), ['.vue', '.ts'])) {
    values.push(normPhrase(stripComments(fs.readFileSync(file, 'utf8'))));
  }
  return values.join('\n');
}

const camel = (kebab: string) => kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/**
 * THE CORPUS AS AN INDEX, built in one pass — a regex per reference over a
 * multi-megabyte corpus took minutes; set lookups take milliseconds.
 *   · `words`  — every `[a-zA-Z0-9_-]+` token (an attribute or class named literally);
 *   · `dataset` — every `dataset.<name>` read or write (an attribute named in camel case);
 *   · `stems`  — every token the product CONCATENATES onto (`'con-x--' + s`, `` `con-x--${s}` ``).
 */
export type ProductIndex = {words: Set<string>; dataset: Set<string>; stems: Set<string>; transitions: Set<string>};

export function indexCorpus(corpus: string): ProductIndex {
  const words = new Set<string>();
  for (const m of corpus.matchAll(/[a-zA-Z0-9_-]+/g)) {
    words.add(m[0]);
  }
  const dataset = new Set<string>();
  for (const m of corpus.matchAll(/dataset\.([a-zA-Z0-9]+)/g)) {
    dataset.add(m[1]);
  }
  const stems = new Set<string>();
  for (const m of corpus.matchAll(/([a-zA-Z0-9_-]+)(?=['"]|\$\{|` \+)/g)) {
    stems.add(m[1]);
  }
  // A Vue TRANSITION renders classes nobody writes out: `<transition name="con-band-fade">` puts
  // `con-band-fade-leave-active` on the leaving node. The name is the contract (static names only — a bound
  // `:name` is a dynamic stem and falls to the stem rule).
  const transitions = new Set<string>();
  for (const m of corpus.matchAll(/<(?:transition|Transition|transition-group|TransitionGroup)\b[^>]*?\sname="([a-zA-Z0-9_-]+)"/g)) {
    transitions.add(m[1]);
  }
  return {words, dataset, stems, transitions};
}

/**
 * THE HOOKS THE E2E TREE WRITES ITSELF — a probe that injects its own marker
 * (`host.dataset.chipProbe = '1'`, `classList.add('con-profile-tv')`) waits
 * for something that exists by construction, not for the product.
 */
export function e2eWrittenHooks(files: ReadonlyArray<string>): {attrs: Set<string>; classes: Set<string>} {
  const attrs = new Set<string>();
  const classes = new Set<string>();
  for (const file of files) {
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of text.matchAll(/dataset\.([a-zA-Z0-9]+)\s*=(?!=)/g)) {
      attrs.add('data-' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
    }
    for (const m of text.matchAll(/setAttribute\(\s*['"`](data-[a-z0-9-]+)['"`]/g)) {
      attrs.add(m[1]);
    }
    for (const m of text.matchAll(/classList\.(?:add|toggle)\(([^)]*)\)/g)) {
      for (const q of m[1].matchAll(/['"`]([a-zA-Z0-9_-]+)['"`]/g)) {
        classes.add(q[1]);
      }
    }
    for (const m of text.matchAll(/className\s*=\s*(['"`])([^'"`]*)\1/g)) {
      for (const c of m[2].split(/\s+/)) {
        if (c !== '') {
          classes.add(c);
        }
      }
    }
    // An HTML string the spec writes into the page (`innerHTML = '<span class="…" data-…>'`).
    for (const lit of text.matchAll(STRING_LITERAL)) {
      const body = lit[0];
      if (!body.includes('<')) {
        continue;
      }
      for (const a of body.matchAll(/\s(data-[a-z0-9-]+)=/g)) {
        attrs.add(a[1]);
      }
      for (const c of body.matchAll(/class=\\?["']([^"'\\]*)/g)) {
        c[1].split(/\s+/).filter((x) => x !== '').forEach((x) => classes.add(x));
      }
    }
  }
  return {attrs, classes};
}

/** Is a hook still RENDERED by the product (or written by the e2e tree itself)? */
export function hookAlive(ref: Pick<HookRef, 'kind' | 'token'>, index: ProductIndex, written: {attrs: Set<string>; classes: Set<string>}): boolean {
  const token = ref.token;
  const prefix = /[-_]$/.test(token);
  if (ref.kind === 'attr') {
    if (written.attrs.has(token) || (prefix && [...written.attrs].some((a) => a.startsWith(token)))) {
      return true;
    }
    if (prefix) {
      // A dynamic attribute name in the spec (`[data-parl-seat-${kind}]`): the product must name something under it.
      return index.stems.has(token) || [...index.words].some((w) => w.startsWith(token) && w.length > token.length);
    }
    return index.words.has(token) || index.dataset.has(camel(token.slice('data-'.length)));
  }
  if (written.classes.has(token) || (prefix && [...written.classes].some((c) => c.startsWith(token)))) {
    return true;
  }
  if (!prefix && index.words.has(token)) {
    return true;
  }
  const transition = /^(.+)-(?:(?:enter|leave)-(?:from|active|to)|move)$/.exec(token);
  if (transition !== null && index.transitions.has(transition[1])) {
    return true;
  }
  // A dynamic prefix in the SPEC (`.wgt-icon--${param}`): alive while the product names anything under it.
  if (prefix && (index.stems.has(token) || [...index.words].some((w) => w.startsWith(token) && w.length > token.length))) {
    return true;
  }
  // A DYNAMIC class: the product builds it from a stem (`'con-sit__door-tile--' + tile`, `` `con-x--${s}` ``,
  // `'con-eg__subseg--s' + shade`). Walk back through every proper prefix and accept one the product concatenates
  // onto — a stem that already names a BEM element or modifier (`__` / `--`), so a bare block root never vouches
  // for everything under it.
  for (let i = token.length - 1; i >= 8; i--) {
    const stem = token.slice(0, i);
    if ((stem.includes('__') || stem.includes('--')) && index.stems.has(stem)) {
      return true;
    }
  }
  return false;
}
