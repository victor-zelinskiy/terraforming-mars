#!/usr/bin/env node
/*
 * THE TEMPLATE STARTS WITH ITS ROOT (docs/claude/vapor/RECIPES.md § R24).
 *
 *   node scripts/vapor/root-first.mjs [--write] [<component.vue> …]      (no file: every component of src/client)
 *
 * A comment that stands in a template BEFORE its root is kept by a development build, and in a Vapor component it
 * makes the root a FRAGMENT there: the attributes the parent lets fall through (`class`, `data-*`, listeners) are
 * dropped — in `npm run dev:client` and in every unit mount, never in production (which strips comments). The
 * readiness ledger fails a Vapor component that opens with one. This moves such comments, verbatim, into the head of
 * the component's `<script setup>` block as one block comment, and leaves the template starting with its root.
 * Nothing else of the file is touched; without `--write` it only lists what it would do.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const named = args.filter((a) => !a.startsWith('--'));

const files = [];
if (named.length > 0) {
  files.push(...named);
} else {
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.name.endsWith('.vue')) {
        files.push(p);
      }
    }
  })(path.join(process.cwd(), 'src', 'client'));
}

let moved = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const text = source.replace(/\r\n/g, '\n');
  const open = /^<template\b[^>\n]*>\n/m.exec(text);
  if (open === null) {
    continue;
  }
  // the run of comments (and blank lines) between `<template>` and the first node
  let at = open.index + open[0].length;
  const comments = [];
  for (;;) {
    const rest = text.slice(at);
    const lead = /^(\s*)<!--([\s\S]*?)-->[ \t]*\n?/.exec(rest);
    if (lead === null) {
      break;
    }
    comments.push(lead[2]);
    at += lead[0].length;
  }
  if (comments.length === 0) {
    continue;
  }
  const script = /^<script setup\b[^>\n]*>\n/m.exec(text);
  if (script === null) {
    console.log(`SKIP    ${file} — no <script setup> to carry the comment`);
    continue;
  }
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  // the comment's own lines, dedented, with nothing that could close a block comment
  const body = [];
  comments.forEach((comment, index) => {
    const lines = comment.replace(/\*\//g, '*​/').split('\n').map((line) => line.replace(/\s+$/, ''));
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    const indent = Math.min(...lines.filter((line) => line.trim() !== '').map((line) => /^\s*/.exec(line)[0].length));
    if (index > 0) {
      body.push('');
    }
    body.push(...lines.map((line) => line.slice(Math.min(indent, line.length))));
  });
  const block = ['/*', ...body.map((line) => (line === '' ? ' *' : ` * ${line}`)), ' *', ' * (This comment opened the template; the template starts with its root now.)', ' */', ''].join('\n');
  // rebuild: the template without its leading comments, the block at the head of the script
  let next = text.slice(0, open.index + open[0].length) + text.slice(at);
  const scriptAt = /^<script setup\b[^>\n]*>\n/m.exec(next);
  const insertAt = scriptAt.index + scriptAt[0].length;
  next = next.slice(0, insertAt) + block + next.slice(insertAt);
  moved++;
  console.log(`${WRITE ? 'moved  ' : 'would  '} ${rel} — ${comments.length} comment(s), ${body.length} line(s)`);
  if (WRITE) {
    fs.writeFileSync(file, nl === '\r\n' ? next.replace(/\n/g, '\r\n') : next);
  }
}
console.log(`${WRITE ? 'moved' : 'would move'}: ${moved} component(s)`);
