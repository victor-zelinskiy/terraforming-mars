import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CURSOR_EASE, CURSOR_MS} from '../../src/client/components/motion/motionTokens';

/*
 * THE CURSOR IS ONE LIVING OBJECT — the grammar's static guard (TR58; `.claude/rules/console-ui.md` § THE CURSOR).
 *
 * The owner's 4K report of 2026-10-16: the focus «appears in one frame» and the card «micro-jumps». The causes were
 * all in the stylesheets and all invisible to every guard: a ring painted on the card FACE with no transition while
 * the lift ran on the SLOT (two elements, two clocks); a variant tile whose focus shadow list was `[inset, outer,
 * outer]` against a resting `[inset, inset, outer]` — a transition the browser cannot interpolate, so it snaps while
 * the stylesheet SAYS it fades; fifteen surfaces each picking its own 140 / 150 / 160 / 240 / 260 ms. This spec holds
 * the grammar the iteration introduced:
 *  1. ONE clock — the CSS `--con-cursor-ms` / `--con-cursor-ease` equal the JS `CURSOR_MS` / `CURSOR_EASE`;
 *  2. a MIGRATED surface stays migrated — its host calls `.con-cursor(…)` and its cursor state `.con-cursor-on()`;
 *  3. a focus state that paints a box-shadow beside a resting one of the SAME element with a box-shadow transition
 *     must keep the two lists interpolable (pairwise the same `inset`-ness — the browser pads the shorter list, but
 *     never turns an inset shadow into an outer one: it snaps);
 *  4. THE RATCHET — every other focus rule (`--focused` / `--selected` / `[data-focused]` / `:focus-visible`) that
 *     paints `box-shadow` / `transform` / `background` / `opacity` by hand is DEBT, counted per stylesheet in
 *     `cursorGrammarBaseline.json`: growth fails (a new hand-painted cursor — use `.con-cursor()`), and a fall fails
 *     until it is locked in (lower the number in the same diff) — an improvement cannot erode;
 *  5. no `scrollIntoView` in the console — a cursor-driven scroll goes through `ConsoleScrollArea.ensureVisible`
 *     (bounded to its own viewport, the cursor's clock, the RESTING box).
 */

// `CURSOR_GRAMMAR_STYLES` reads another tree (the report's BEFORE: `git archive HEAD src/styles`); `CURSOR_GRAMMAR_BASELINE=write`
// LOCKS IN the ratchet (writes the counts instead of asserting them) — the same diff that lowered them.
const STYLES = process.env.CURSOR_GRAMMAR_STYLES ?? path.resolve(__dirname, '..', '..', 'src', 'styles');
const BASELINE = path.resolve(__dirname, 'cursorGrammarBaseline.json');

/** The surfaces this iteration migrated: the host's resting rule and its cursor state, by resolved selector. */
const MIGRATED: ReadonlyArray<{surface: string, host: string, on: string}> = [
  {surface: '«Карты в руке» (the album slot)', host: '.con-hand__slot', on: '.con-hand__slot--selected'},
  {surface: '«Действия карт» (the action tile)', host: '.con-cardactions__tile', on: '.con-cardactions__tile--focused'},
  {surface: '«Действия карт» (the live group)', host: '.con-cardactions__group', on: '.con-cardactions__group--live'},
  {surface: '«Колонии» (the colony tile)', host: '.con-coltile', on: '.con-coltile--focused'},
  {surface: '«Стандартные проекты» (the project card)', host: '.con-stdp__card', on: '.con-stdp__card--focused'},
  {surface: 'the composers (a choice row)', host: '.con-composer__row', on: '.con-composer__row--focused'},
  {surface: 'the target step (a candidate)', host: '.con-ptsel__slot', on: '.con-ptsel__slot--focused'},
  {surface: 'the target step (the self proxy)', host: '.con-ptsel__self', on: '.con-ptsel__self--focused'},
  {surface: 'the variant choice (an outcome tile)', host: '.con-vchoice__opt', on: '.con-vchoice__opt--focused'},
  {surface: 'the start workspace (a queue mini)', host: '.con-start__mini', on: '.con-start__mini--focused'},
  {surface: 'the Parliament (a party plaque)', host: '.con-pseal', on: '.con-pseal--focus'},
  {surface: 'the Parliament (the voting plate)', host: '.con-parl__voting', on: '.con-parl__voting--focus'},
  {surface: 'the Parliament (a vote card)', host: '.con-parl__slot', on: '.con-parl__slot--selected'},
  {surface: 'the composers (the commit row)', host: '.con-composer__cta', on: '.con-composer__cta--focused'},
];

type Decl = {prop: string, value: string, line: number};
type Rule = {file: string, line: number, selectors: Array<string>, decls: Array<Decl>, calls: Array<string>};

/** Comments blanked (newlines kept — the guard reports line numbers). */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

/** Split on top-level commas (never inside parentheses). */
function splitTop(text: string): Array<string> {
  const out: Array<string> = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function resolve(parents: ReadonlyArray<string>, own: string): Array<string> {
  const mine = splitTop(own);
  if (parents.length === 0) {
    return mine;
  }
  const out: Array<string> = [];
  for (const p of parents) {
    for (const m of mine) {
      out.push(m.includes('&') ? m.replace(/&/g, p) : `${p} ${m}`);
    }
  }
  return out;
}

/**
 * A small Less structure reader: nested rule blocks with their resolved selectors, their own declarations and mixin
 * calls. Mixin DEFINITIONS (`.name(…) {`), keyframes and detached rulesets are skipped; `@media` / `@supports` are
 * transparent (their rules keep the parent's selector).
 */
export function readLess(file: string, source: string): Array<Rule> {
  const text = stripComments(source);
  const rules: Array<Rule> = [];
  type Frame = {selectors: Array<string>, rule?: Rule, skip: boolean};
  const stack: Array<Frame> = [{selectors: [], skip: false}];
  let buf = '';
  let bufEmpty = true;
  let bufLine = 1;
  let line = 1;
  let paren = 0;
  const top = () => stack[stack.length - 1];
  const flushStatement = () => {
    const stmt = buf.trim();
    buf = '';
    bufEmpty = true;
    const frame = top();
    if (stmt.length === 0 || frame.skip || frame.rule === undefined) {
      return;
    }
    if (/^\.[\w-]+\s*\(/.test(stmt) || /^\.[\w-]+\s*;?$/.test(stmt)) {
      frame.rule.calls.push(stmt);
      return;
    }
    const m = /^([\w-]+)\s*\+?:\s*([\s\S]*)$/.exec(stmt);
    if (m !== null) {
      frame.rule.decls.push({prop: m[1], value: m[2].trim(), line: bufLine});
    }
  };
  for (const ch of text) {
    if (ch === '\n') {
      line++;
    }
    if (bufEmpty && ch.trim().length > 0) {
      bufEmpty = false;
      bufLine = line;
    }
    if (ch === '(') {
      paren++;
    } else if (ch === ')') {
      paren--;
    }
    if (paren > 0) {
      buf += ch;
      continue;
    }
    if (ch === ';') {
      flushStatement();
      continue;
    }
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      bufEmpty = true;
      const parent = top();
      if (parent.skip || /^\.[\w-]+\s*\(/.test(head) || head.startsWith('@keyframes') || head.startsWith('@font-face') || /^@[\w-]+\s*:/.test(head)) {
        stack.push({selectors: parent.selectors, skip: true});
      } else if (head.startsWith('@media') || head.startsWith('@supports') || head.startsWith('@container')) {
        stack.push({selectors: parent.selectors, rule: parent.rule, skip: false});
      } else {
        const selectors = resolve(parent.selectors, head);
        const rule: Rule = {file, line: bufLine, selectors, decls: [], calls: []};
        rules.push(rule);
        stack.push({selectors, rule, skip: false});
      }
      continue;
    }
    if (ch === '}') {
      flushStatement();
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    buf += ch;
  }
  return rules;
}

// `--focus` too (PL-509): the Parliament's whole family wore it and escaped both the ratchet and the interpolation check.
const FOCUS = /--focus(ed)?\b|--selected\b|\[data-focused|:focus-visible/;
const PAINT = new Set(['box-shadow', 'transform', 'background', 'background-color', 'background-image', 'opacity']);
const CURSOR_CALL = /^\.con-cursor(-on|-paint)?\s*\(/;

function consoleSheets(): Array<string> {
  return fs.readdirSync(STYLES).filter((n) => /^console.*\.less$/.test(n)).sort();
}

let cachedRules: Array<Rule> | undefined;
function allRules(): Array<Rule> {
  cachedRules = cachedRules ?? consoleSheets().flatMap((name) => readLess(name, fs.readFileSync(path.join(STYLES, name), 'utf8')));
  return cachedRules;
}

/** Hand-painted cursor rules: a focus selector, a paint property declared directly, no cursor mixin call. */
function debtOf(rules: ReadonlyArray<Rule>): Array<Rule> {
  return rules.filter((r) =>
    r.selectors.some((s) => FOCUS.test(s)) &&
    !r.calls.some((c) => CURSOR_CALL.test(c)) &&
    r.decls.some((d) => PAINT.has(d.prop)));
}

function insetPattern(value: string): Array<boolean> | undefined {
  if (/^@[\w-]+$/.test(value.trim()) || value.trim() === 'none' || value.includes('var(--')) {
    return undefined;
  }
  return splitTop(value).map((part) => /\binset\b/.test(part));
}

describe('the cursor grammar (TR58 — the cursor is one living object)', () => {
  it('the reader sees nesting, `&`, comma lists, media blocks and mixin calls', () => {
    const rules = readLess('t.less', `
      .a { box-shadow: 0 0 1px red;
        &--focused { .con-cursor-on(); }
        &__b, &__c { transition: box-shadow 1s; }
        @media (x) { &--selected { opacity: .5; } }
        .con-cursor(0 0 0 1px red, 0 0 2px blue; .4rem; none; 3);
      }
      .mix(@x) { opacity: @x; }
      @keyframes k { from { opacity: 0; } }
    `);
    const by = (sel: string) => rules.find((r) => r.selectors.includes(sel));
    expect(by('.a')?.decls.map((d) => d.prop)).to.deep.eq(['box-shadow']);
    expect(by('.a')?.calls.some((c) => c.startsWith('.con-cursor('))).to.eq(true);
    expect(by('.a--focused')?.calls).to.deep.eq(['.con-cursor-on()']);
    expect(by('.a__b')?.selectors).to.deep.eq(['.a__b', '.a__c']);
    expect(by('.a--selected')?.decls.map((d) => d.prop)).to.deep.eq(['opacity']);
    expect(rules.some((r) => r.selectors.includes('.mix(@x)') || r.selectors.some((s) => s.includes('from')))).to.eq(false);
  });

  it('ONE clock: the CSS cursor tokens equal the JS mirror', () => {
    const source = fs.readFileSync(path.join(STYLES, 'console.less'), 'utf8');
    const ms = /--con-cursor-ms:\s*calc\((\d+)ms\s*\*\s*var\(--motion-scale/.exec(source);
    const move = /--con-cursor-move-ms:\s*calc\((\d+)ms\s*\*\s*var\(--motion-scale/.exec(source);
    const ease = /--con-cursor-ease:\s*(cubic-bezier\([^)]*\))/.exec(source);
    expect(Number(ms?.[1]), '--con-cursor-ms').to.eq(CURSOR_MS);
    expect(Number(move?.[1]), '--con-cursor-move-ms').to.eq(CURSOR_MS);
    expect(ease?.[1].replace(/\s+/g, ''), '--con-cursor-ease').to.eq(CURSOR_EASE.replace(/\s+/g, ''));
  });

  it('every migrated surface stays on the grammar: its host calls `.con-cursor()`, its cursor state `.con-cursor-on()`', () => {
    const rules = allRules();
    const missing: Array<string> = [];
    for (const m of MIGRATED) {
      const host = rules.some((r) => r.selectors.includes(m.host) && r.calls.some((c) => ['.con-cursor(', '.con-cursor-shadow(', '.con-cursor-glow(', '.con-cursor-ring('].some((m) => c.startsWith(m))));
      const on = rules.some((r) => r.selectors.includes(m.on) && r.calls.some((c) => c.startsWith('.con-cursor-on(')));
      if (!host) {
        missing.push(`${m.surface}: no \`.con-cursor(…)\` / \`-shadow\` / \`-glow\` / \`-ring\` on ${m.host}`);
      }
      if (!on) {
        missing.push(`${m.surface}: no \`.con-cursor-on()\` on ${m.on}`);
      }
    }
    expect(missing, missing.join('\n')).to.deep.eq([]);
  }).timeout(60_000);

  it('a focus shadow beside a resting one with a box-shadow transition is INTERPOLABLE (pairwise the same inset-ness)', () => {
    const rules = allRules();
    const offenders: Array<string> = [];
    for (const r of rules) {
      const shadow = r.decls.find((d) => d.prop === 'box-shadow');
      if (shadow === undefined) {
        continue;
      }
      for (const sel of r.selectors.filter((s) => FOCUS.test(s))) {
        const restSel = sel.replace(/(--focused|--focus|--selected)\b/g, '').replace(/\[data-focused[^\]]*\]/g, '').replace(/:focus-visible/g, '');
        if (restSel === sel) {
          continue;
        }
        const rest = rules.find((x) => x.selectors.includes(restSel) && x.decls.some((d) => d.prop === 'box-shadow'));
        if (rest === undefined) {
          continue;
        }
        const transition = rest.decls.filter((d) => d.prop === 'transition' || d.prop === 'transition-property').map((d) => d.value).join(',');
        if (!/\bbox-shadow\b|\ball\b/.test(transition)) {
          continue;
        }
        const a = insetPattern(rest.decls.find((d) => d.prop === 'box-shadow')!.value);
        const b = insetPattern(shadow.value);
        if (a === undefined || b === undefined) {
          continue;
        }
        const clash = a.slice(0, Math.min(a.length, b.length)).some((v, i) => v !== b[i]);
        if (clash) {
          offenders.push(`${r.file}:${r.line} ${sel} — rest [${a.map((v) => v ? 'inset' : 'outer')}] vs focus [${b.map((v) => v ? 'inset' : 'outer')}]: the declared transition snaps`);
        }
      }
    }
    expect(offenders, `a box-shadow transition between lists of different inset-ness cannot interpolate — use \`.con-cursor()\`:\n${offenders.join('\n')}`).to.deep.eq([]);
  }).timeout(60_000);

  it('THE RATCHET: hand-painted cursor rules per stylesheet never grow, and a fall is locked in', () => {
    const debt = debtOf(allRules());
    const counts: Record<string, number> = {};
    for (const r of debt) {
      counts[r.file] = (counts[r.file] ?? 0) + 1;
    }
    if (process.env.CURSOR_GRAMMAR_BASELINE === 'write') {
      const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
      fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + String.fromCharCode(10));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew: Array<string> = [];
    const fell: Array<string> = [];
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const now = counts[file] ?? 0;
      const was = baseline[file] ?? 0;
      if (now > was) {
        const list = debt.filter((r) => r.file === file).map((r) => `  ${r.file}:${r.line} ${r.selectors[0]}`).join('\n');
        grew.push(`${file}: ${was} → ${now} — a new hand-painted cursor; paint it with \`.con-cursor()\`:\n${list}`);
      } else if (now < was) {
        fell.push(`${file}: ${was} → ${now}`);
      }
    }
    expect(grew, grew.join('\n')).to.deep.eq([]);
    expect(fell, `the debt FELL — lock it in: set these in tests/console/cursorGrammarBaseline.json\n${fell.join('\n')}`).to.deep.eq([]);
  }).timeout(60_000);

  it('no `scrollIntoView` in the console — a cursor scroll is `ConsoleScrollArea.ensureVisible`', () => {
    const roots = [path.resolve(__dirname, '..', '..', 'src', 'client', 'components', 'console'), path.resolve(__dirname, '..', '..', 'src', 'client', 'console')];
    const offenders: Array<string> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|vue)$/.test(entry.name)) {
          const lines = stripComments(fs.readFileSync(full, 'utf8')).split('\n');
          lines.forEach((l, i) => {
            if (/\.scrollIntoView\s*\(/.test(l)) {
              offenders.push(`${path.relative(process.cwd(), full)}:${i + 1}: ${l.trim()}`);
            }
          });
        }
      }
    };
    roots.forEach(walk);
    expect(offenders, `scrollIntoView walks outer containers and runs on its own clock:\n${offenders.join('\n')}`).to.deep.eq([]);
  }).timeout(60_000);
});
