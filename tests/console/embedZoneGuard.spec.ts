import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * EVERY OUTCOME ZONE DECLARES ITSELF (`v-embed-zone`) — the worklist half of
 * `src/client/console/embedZoneRegistry.ts`.
 *
 * The shell's gates open a claimed surface's teleport only while a node
 * matching the published selector is REGISTERED as mounted
 * (`workspaceOutcomeZone`). A zone that never declares itself still works by
 * the old behaviour (the undeclared-node fallback) — and with it the old race
 * comes back: a selector outliving its node, a teleport aimed at nothing, a
 * decision mounted UNDER a full-bleed scene (the «Корпоративные архивы» blocker
 * of 2026-10-18). So every selector a publisher can name must have its element
 * wear the directive.
 *
 * The publishers are found, not listed: every `setWorkspaceOutcomeSlot(` call
 * (string literals, a SCREAMING_CASE const of the same file), the two host
 * tables (`PLAY_OUTCOME_HOSTS`, `ADOPTION_ZONES`) and the colonies' computed
 * selector. A new host fails here with the selector it publishes.
 */
const SRC = path.resolve(__dirname, '../../src/client');

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const FILES = walk(SRC).map((file) => ({file, text: fs.readFileSync(file, 'utf8')}));

/** The argument text of every `fn(` call (balanced parentheses). */
function callArgs(text: string, fn: string): Array<string> {
  const out: Array<string> = [];
  let at = text.indexOf(`${fn}(`);
  while (at !== -1) {
    let depth = 0;
    let i = at + fn.length;
    const start = i + 1;
    for (; i < text.length; i++) {
      if (text[i] === '(') {
        depth++;
      } else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    out.push(text.slice(start, i));
    at = text.indexOf(`${fn}(`, i);
  }
  return out;
}

/** The selector-shaped string literals of an expression or a block — comments
 *  stripped first (an apostrophe in prose would pair with a real quote). */
const literals = (expr: string): Array<string> =>
  Array.from(expr.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(/'([^']*)'/g), (m) => m[1])
    .filter((s) => s.startsWith('[') || s.startsWith('.'));

/** The block of `name … {` up to its matching `}` (a const table or a computed's body). */
function block(text: string, name: string): string {
  const at = text.indexOf(name);
  if (at === -1) {
    return '';
  }
  const open = text.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(open, i + 1);
      }
    }
  }
  return '';
}

function publishedSelectors(): Map<string, string> {
  const found = new Map<string, string>();
  for (const {file, text} of FILES) {
    const rel = path.relative(SRC, file);
    if (rel.endsWith('consoleWorkspaceOutcome.ts') || rel.endsWith('embedZoneRegistry.ts')) {
      continue; // the definitions themselves
    }
    for (const arg of callArgs(text, 'setWorkspaceOutcomeSlot')) {
      for (const lit of literals(arg)) {
        found.set(lit, rel);
      }
      for (const name of arg.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? []) {
        const m = text.match(new RegExp(`const ${name} = '([^']+)'`));
        if (m !== null) {
          found.set(m[1], rel);
        }
      }
    }
    for (const table of ['PLAY_OUTCOME_HOSTS', 'ADOPTION_ZONES']) {
      if (text.includes(`const ${table}`)) {
        for (const lit of literals(block(text, `const ${table}`))) {
          found.set(lit, rel);
        }
      }
    }
    if (rel.endsWith('ConsoleColoniesSection.vue')) {
      for (const lit of literals(block(text, 'outcomeSlotSelector(): string'))) {
        found.set(lit, rel);
      }
    }
  }
  return found;
}

/** Every opening tag in a template that the selector names. */
function tagsFor(selector: string): Array<{file: string, tag: string}> {
  const slot = selector.match(/\[data-embed-slot="([^"]+)"\]/);
  const cls = selector.match(/^\.([a-z0-9_-]+)$/);
  const out: Array<{file: string, tag: string}> = [];
  for (const {file, text} of FILES) {
    if (!file.endsWith('.vue')) {
      continue;
    }
    const template = text.slice(0, Math.max(0, text.indexOf('<script')));
    for (const m of template.matchAll(/<(div|section)\b[^>]*>/g)) {
      const tag = m[0];
      const hit = slot !== null ? tag.includes(`data-embed-slot="${slot[1]}"`) :
        cls !== null ? new RegExp(`class="([^"]*\\s)?${cls[1]}(\\s[^"]*)?"`).test(tag) : false;
      if (hit) {
        out.push({file: path.relative(SRC, file), tag: tag.replace(/\s+/g, ' ')});
      }
    }
  }
  return out;
}

describe('embed zones — every zone a publisher can name declares itself', () => {
  const published = publishedSelectors();

  it('finds the publishers (anti-vacuous)', () => {
    for (const known of ['.con-start__embed', '[data-embed-slot="hand-outcome"]', '[data-embed-slot="workspace-reveal"]',
      '[data-embed-slot="colonies-reveal"]', '[data-embed-slot="colonies-focus-reveal"]', '[data-embed-slot="hydro"]']) {
      expect([...published.keys()], `the scan sees ${known}`).to.include(known);
    }
  });

  it('every published zone is rendered somewhere, and every element of it wears v-embed-zone', () => {
    const missing: Array<string> = [];
    for (const [selector, publisher] of published) {
      const tags = tagsFor(selector);
      if (tags.length === 0) {
        missing.push(`${selector} (published by ${publisher}) — no template renders it`);
        continue;
      }
      for (const {file, tag} of tags) {
        if (!tag.includes('v-embed-zone')) {
          missing.push(`${selector} (published by ${publisher}) — ${file}: ${tag.slice(0, 160)}`);
        }
      }
    }
    expect(missing, `zones without v-embed-zone:\n  ${missing.join('\n  ')}`).to.deep.eq([]);
  });
});
