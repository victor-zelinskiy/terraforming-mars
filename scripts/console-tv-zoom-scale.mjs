/*
 * console-tv-zoom-scale.mjs — one-shot: multiply the FIXED `zoom:` values
 * that integrate px-authored desktop content (premium card faces, benefit
 * glyphs, TagCount clusters, ActionEffectChips, BoardFactGroups rows) into
 * the console shell by `var(--con-ui-scale, 1)` so the TV profile scales
 * them in lockstep with the rem-authored console chrome. On every non-tv
 * profile the var is 1 → byte-identical rendering.
 *
 * Deliberately SKIPPED (relative counter-zooms inside already-zoomed
 * slots, and rem-text zoom nudges — multiplying those would double-scale):
 * .con-cards__pickband 1.15/1.5 counters, .con-task__source-label 1.1.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'src/styles/console.less');

// {near: 1-based line hint, find: exact substring, zoom: original value}
const TARGETS = [
  {near: 489, zoom: '0.32'}, // draft-tray pcard
  {near: 782, zoom: '1.2'}, // res-aux TagCount cluster
  {near: 898, zoom: '1.25'}, // board info BoardFactGroups
  {near: 1227, zoom: '1.05'}, // hydro stop-reward icons
  {near: 3557, zoom: '0.86'}, // inspector facts
  {near: 5783, zoom: '1.35'}, // info tags cluster
  {near: 5921, zoom: '0.78'}, // info excard (pcard)
  {near: 6482, zoom: '1.22'}, // coltile reward glyph
  {near: 6659, zoom: '0.78'}, // colinspect benefit-glyph
  {near: 6703, zoom: '1.25'}, // trade benefit-glyph
  {near: 7160, zoom: '1.05'}, // trade track-reward
  {near: 7215, zoom: '1.05'}, // trade bonus-glyph
  {near: 7333, zoom: '0.9'}, // task source card
  {near: 7455, zoom: '1.15'}, // task opt-effects chips
  {near: 8973, zoom: '0.62'}, // start mini card
  {near: 8981, zoom: '0.7'}, // start mini --id
  {near: 8993, zoom: '0.5'}, // start dense mini
  {near: 8994, zoom: '0.6'}, // start dense mini --id
  {near: 9078, zoom: '0.92'}, // start ceremony card tile
  {near: 9137, zoom: '0.86'}, // start prelude tile
  {near: 9193, zoom: '0.78'}, // start cands slots
  {near: 9194, zoom: '0.64'}, // start cands corps
  {near: 9386, zoom: '0.92'}, // reveal tile
  {near: 9390, zoom: '0.78'}, // reveal source colony
  {near: 9529, zoom: '1.05'}, // trade confirm colony tile
  {near: 9685, zoom: '1.15'}, // actconfirm formula graphic
  {near: 10838, zoom: '1.15'}, // cardactions graphic
  {near: 10908, zoom: '1.25'}, // cardactions detail graphic
  {near: 11247, zoom: '1.0'}, // composer playcard
];

const src = readFileSync(FILE, 'utf8');
const lines = src.split('\n');
let ok = 0;
const misses = [];
for (const t of TARGETS) {
  const find = `zoom: ${t.zoom};`;
  const replace = `zoom: calc(${t.zoom} * var(--con-ui-scale, 1));`;
  let hit = -1;
  for (let d = 0; d <= 8 && hit === -1; d++) {
    for (const idx of [t.near - 1 + d, t.near - 1 - d]) {
      if (idx >= 0 && idx < lines.length && lines[idx].includes(find) && !lines[idx].includes('--con-ui-scale')) {
        hit = idx;
        break;
      }
    }
  }
  if (hit === -1) {
    misses.push(t);
    continue;
  }
  lines[hit] = lines[hit].replace(find, replace);
  ok++;
}
// The board-info facts block mixes a rem font-size ON the zoom container —
// divide it back so the text is not double-scaled by the multiplied zoom.
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('TV-scale the reused BoardFactGroups rows')) {
    for (let j = i; j < i + 4; j++) {
      if (lines[j].includes('font-size: .95rem;')) {
        lines[j] = lines[j].replace('font-size: .95rem;', 'font-size: calc(.95rem / var(--con-ui-scale, 1));');
        ok++;
      }
    }
  }
}
if (misses.length > 0) {
  console.error('MISSED targets (file drifted?):', misses);
  process.exit(1);
}
writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log(`applied ${ok} zoom multiplications`);
