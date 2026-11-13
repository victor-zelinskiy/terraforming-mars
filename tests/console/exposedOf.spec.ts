import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE TYPE OF A REF ON A COMPONENT IS `ExposedOf<typeof Child>` (src/client/components/exposedOf.ts ·
 * docs/claude/vapor/ROADMAP.md § 4a).
 *
 * `InstanceType<typeof Child>` compiles only while `Child` is a virtual-DOM component: the type of a
 * `<script setup vapor>` module is a function, not a constructor. The whole client flipped answered with 116 errors
 * of one kind — in the PARENTS of every converted child, not in the child that was touched. So the client names a
 * component's ref by the one type that reads both forms, and a flip changes no type of anybody's ref.
 *
 * Two more things the type checker asks of a script that is to become Vapor (its body is a function body there):
 * every `import` stands above the script's first statement, and so does an `export`ed type.
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

const rel = (file: string): string => path.relative(ROOT, file).replace(/\\/g, '/');

/** The statements of a `<script setup>` body by line: 'import' · 'export' · 'other' (comments and blank lines skipped). */
function scriptStatements(source: string): Array<{line: number, kind: 'import' | 'export' | 'other'}> {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^<script\b[^>]*\bsetup\b/.test(line));
  const end = lines.findIndex((line, index) => index > start && line.startsWith('</script>'));
  if (start < 0 || end < 0) {
    return [];
  }
  const out: Array<{line: number, kind: 'import' | 'export' | 'other'}> = [];
  let inComment = false;
  let inStatement = false; // inside a multi-line import / export / declaration that began at column 0
  for (let i = start + 1; i < end; i++) {
    const text = lines[i];
    const trimmed = text.trim();
    if (inComment) {
      inComment = !trimmed.includes('*/');
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inComment = !trimmed.includes('*/');
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }
    if (/^\s/.test(text) || /^[}\])]/.test(text)) {
      continue; // a continuation line of the statement above
    }
    void inStatement;
    inStatement = true;
    out.push({line: i + 1, kind: /^import\b/.test(text) ? 'import' : /^export\b/.test(text) ? 'export' : 'other'});
  }
  return out;
}

describe('a component\'s ref is typed `ExposedOf<typeof Child>` — and a script keeps its imports and exports on top', function() {
  // One read of the client tree, not a timing: the budget is that walk on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);
  const files = walk(CLIENT).map((file) => ({file, source: fs.readFileSync(file, 'utf8')}));

  it('nothing under src/client spells `InstanceType<typeof …>`', () => {
    const sites: Array<string> = [];
    for (const {file, source} of files) {
      if (file.endsWith('exposedOf.ts')) {
        continue; // the helper's own header names what it replaces
      }
      source.split('\n').forEach((line, index) => {
        if (/\bInstanceType<\s*typeof\b/.test(line)) {
          sites.push(`${rel(file)}:${index + 1}`);
        }
      });
    }
    expect(sites, '`ExposedOf<typeof Child>` (components/exposedOf.ts): the type of a Vapor component is not a constructor').to.deep.equal([]);
  });

  it('in a `<script setup>` every import — and every exported type — stands above the first statement', () => {
    const late: Array<string> = [];
    for (const {file, source} of files) {
      if (!file.endsWith('.vue')) {
        continue;
      }
      let statementSeen = false;
      for (const statement of scriptStatements(source)) {
        if (statement.kind === 'other') {
          statementSeen = true;
        } else if (statementSeen) {
          late.push(`${rel(file)}:${statement.line} — ${statement.kind}`);
        }
      }
    }
    expect(late, 'a `<script setup vapor>` body is a function body to the type checker: an import / an export below a statement is not at a ' +
      'module\'s top level there (move it up beside the imports; a type that many files share lives in a sibling .ts)').to.deep.equal([]);
  });
});
