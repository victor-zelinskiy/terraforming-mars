import {expect} from 'chai';
import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE RECIPE BOOK IS COMPLETE (the road to `createVaporApp(App)` — docs/claude/vapor/RECIPES.md).
 *
 * The rework of the client's Options-API components is done BY ANALOGY: every construct a component uses has ONE
 * recipe, and a conversion applies the rows its sheet names. That only holds while the book covers everything the
 * client actually contains — so it is checked, not promised: `scripts/vapor/inventory.mjs` reads every single-file
 * component with a real parser (the script through TypeScript, the template through `@vue/compiler-dom`) and fails on
 * a construct with no row. A new construct in the client is a new recipe BEFORE it is a surprise in the middle of a wave.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const BOOK = path.join(ROOT, 'docs', 'claude', 'vapor', 'RECIPES.md');
const TOOL = path.join(ROOT, 'scripts', 'vapor', 'inventory.mjs');

describe('the Vapor recipe book — every construct of the client has a recipe', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000); // the tool parses every component of the client once

  it('the inventory finds no construct without a recipe (and reads a real corpus)', () => {
    const json = path.join(ROOT, 'node_modules', '.cache', 'vapor-inventory.json');
    fs.mkdirSync(path.dirname(json), {recursive: true});
    let out = '';
    try {
      out = execFileSync(process.execPath, [TOOL, '--json', json], {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    } catch (error) {
      const failed = error as {stdout?: string, stderr?: string};
      expect.fail(`the inventory failed — a construct has no recipe:\n${failed.stderr ?? ''}\n${failed.stdout ?? ''}`);
    }
    const inventory = JSON.parse(fs.readFileSync(json, 'utf8')) as {forms: Record<string, number>, totals: Record<string, number>, components: Array<{file: string}>};
    expect(inventory.components.length, 'the components are read').to.be.greaterThan(400);
    expect(inventory.totals['opt:props'], 'their option blocks are read').to.be.greaterThan(100);
    expect(inventory.totals['tpl:$t'], 'their templates are read').to.be.greaterThan(1000);
    expect(out).to.match(/^components: \d+ — options \d+ · script-setup \d+ · vapor \d+/);
  });

  it('every recipe id the tool hands out is a section of the book, and every section is handed out', () => {
    const tool = fs.readFileSync(TOOL, 'utf8');
    const table = tool.slice(tool.indexOf('export const RECIPES = {'), tool.indexOf('\n};', tool.indexOf('export const RECIPES = {')));
    const used = new Set([...table.matchAll(/'(R\d+)'/g)].map((m) => m[1]));
    const sections = new Set([...fs.readFileSync(BOOK, 'utf8').matchAll(/^### (R\d+) — /gm)].map((m) => m[1]));
    expect(used.size, 'the tool\'s table is read').to.be.greaterThan(15);
    expect([...used].filter((id) => !sections.has(id)).sort(), 'a recipe id with no section in RECIPES.md').to.deep.equal([]);
    expect([...sections].filter((id) => !used.has(id)).sort(), 'a section no construct points at — a dead recipe, or a construct the tool does not read').to.deep.equal([]);
  });

  it('a `<script setup>` component takes a directive from `vDirectives` only (another module\'s export is the Options form — refused at step B)', () => {
    const offenders: Array<string> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.vue')) {
          const text = fs.readFileSync(full, 'utf8');
          const script = /<script\b[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/.exec(text)?.[1];
          if (script === undefined) {
            continue;
          }
          for (const m of script.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
            const directives = m[1].split(',').map((name) => name.trim()).filter((name) => /^v[A-Z]/.test(name));
            if (directives.length > 0 && m[2] !== '@/client/directives/vDirectives') {
              offenders.push(`${path.relative(ROOT, full).split(path.sep).join('/')}: ${directives.join(', ')} from ${m[2]}`);
            }
          }
        }
      }
    };
    walk(path.join(ROOT, 'src', 'client'));
    expect(offenders, 'import the binding of the same name from @/client/directives/vDirectives (RECIPES § R17)').to.deep.equal([]);
  });

  it('every capability fixture the book cites exists', () => {
    const cited = new Set([...fs.readFileSync(BOOK, 'utf8').matchAll(/`((?:Vapor|Setup)\w+\.vue)`/g)].map((m) => m[1]));
    expect(cited.size, 'the citations are read').to.be.greaterThan(8);
    const missing = [...cited].filter((name) => !fs.existsSync(path.join(ROOT, 'tests', 'client', 'vapor', 'fixtures', name)));
    expect(missing, 'a ✔ of the book must be an executable row').to.deep.equal([]);
  });
});
