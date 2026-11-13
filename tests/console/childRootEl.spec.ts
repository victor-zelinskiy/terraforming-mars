import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A CHILD'S ROOT IS SAID, NEVER REACHED FOR (src/client/components/rootEl.ts · docs/claude/vapor/RECIPES.md § R12 ·
 * ROADMAP § 4a · B5).
 *
 * `childRef.$el` is a property of a virtual-DOM instance. A Vapor child's ref is its `defineExpose` object: `$el` is
 * `undefined` there, with no error — the whole client flipped on 2026-11-13 lost its fullscreen viewer, the workspace
 * band's rail edge and every flying tile's proxy that way, each a `$el` read off a child that type-checked and passed
 * its unit spec. So:
 *
 *   · NOTHING under `src/client` reads `.$el` (a component's own root is its template ref — R12);
 *   · a component that exposes `rootEl` hands over a template ref that stands ON ITS ROOT ELEMENT — the first tag of
 *     its template carries that ref's key — so the name cannot come to mean «some element of mine».
 */
const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT = path.join(ROOT, 'src', 'client');

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(vue|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Comments out: a line comment, a block comment, an HTML comment — a sentence ABOUT `$el` is not a read of it. */
function code(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (line, before: string) => before + ' '.repeat(line.length - before.length));
}

const rel = (file: string): string => path.relative(ROOT, file).replace(/\\/g, '/');

describe('a child\'s root is said, never reached for — no `$el` in the client', function() {
  // One read of the client tree, not a timing: the budget is that walk on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);
  const files = walk(CLIENT).map((file) => ({file, source: fs.readFileSync(file, 'utf8')}));

  it('nothing under src/client reads `.$el`', () => {
    const reads: Array<string> = [];
    for (const {file, source} of files) {
      code(source).split('\n').forEach((line, index) => {
        if (/\.\$el\b|\[['"]\$el['"]\]|\{\s*\$el\b/.test(line)) {
          reads.push(`${rel(file)}:${index + 1}  ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(reads, 'a Vapor child\'s ref answers no `$el` — the child exposes `rootEl` (components/rootEl.ts), or the parent asks its own DOM').to.deep.equal([]);
  });

  it('a component that exposes `rootEl` exposes the ref of its ROOT element', () => {
    const problems: Array<string> = [];
    let exposing = 0;
    for (const {file, source} of files) {
      if (!file.endsWith('.vue')) {
        continue;
      }
      const expose = /defineExpose\(\{[^}]*\brootEl\b(?:\s*:\s*(\w+))?[^}]*\}\)/.exec(code(source));
      if (expose === null) {
        continue;
      }
      exposing++;
      const binding = expose[1] ?? 'rootEl';
      const key = new RegExp(`\\b${binding}\\s*=\\s*useTemplateRef<[^>]*>\\(\\s*'([^']+)'\\s*\\)`).exec(source)?.[1];
      if (key === undefined) {
        problems.push(`${rel(file)} — \`rootEl\` is not a \`useTemplateRef\` of this script (${binding})`);
        continue;
      }
      const template = /<template>([\s\S]*)<\/template>/.exec(source)?.[1] ?? '';
      const firstTag = /<[a-zA-Z][^>]*>/.exec(code(template))?.[0] ?? '';
      if (!new RegExp(`\\bref="${key}"`).test(firstTag)) {
        problems.push(`${rel(file)} — the ref «${key}» is not on the template's root element (${firstTag.slice(0, 60).replace(/\s+/g, ' ')}…)`);
      }
    }
    expect(problems).to.deep.equal([]);
    expect(exposing, 'the contract has holders (a rename of the member would empty this check)').to.be.greaterThan(5);
  });
});
