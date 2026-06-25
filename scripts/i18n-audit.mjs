import fs from 'fs';
import path from 'path';

const root = path.resolve('src');
const localesRu = path.join(root, 'locales', 'ru');

// 1) Collect all ru keys (recursive over values that are objects)
const ruKeys = new Set();
function collectKeys(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      ruKeys.add(k);
      if (v && typeof v === 'object') collectKeys(v);
    }
  }
}
for (const f of fs.readdirSync(localesRu)) {
  if (!f.endsWith('.json')) continue;
  try {
    collectKeys(JSON.parse(fs.readFileSync(path.join(localesRu, f), 'utf8')));
  } catch (e) {
    console.error('parse fail', f, e.message);
  }
}

// 2) In-scope dirs + core files
const inScopeCardDirs = ['base', 'corporation', 'promo', 'venusNext', 'colonies', 'prelude'];
const targetDirs = [
  ...inScopeCardDirs.map((d) => path.join(root, 'server', 'cards', d)),
  path.join(root, 'server', 'deferredActions'),
  path.join(root, 'server', 'inputs'),
  path.join(root, 'server', 'behavior'),
];
const targetFiles = [
  path.join(root, 'server', 'Game.ts'),
  path.join(root, 'server', 'Player.ts'),
  path.join(root, 'server', 'cards', 'gainOrAddResource.ts'),
  path.join(root, 'server', 'cards', 'actionPreviews.ts'),
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
}
const files = [...targetFiles];
for (const d of targetDirs) if (fs.existsSync(d)) walk(d, files);

// strip // line comments and /* */ block comments (good enough for this audit)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Patterns that produce user-facing prompt/title/option strings.
const str = `'([^'\\\\]+)'`;
const dstr = `"([^"\\\\]+)"`;
const patterns = [];
for (const s of [str, dstr]) {
  patterns.push(new RegExp(`title:\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bmessage\\(\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bnew SelectOption\\(\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bnew SelectCard\\(\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bnew SelectAmount\\(\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bsetTitle\\(\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bnew Select\\w+\\(\\s*[^,]+,\\s*${s}`, 'g'));
  patterns.push(new RegExp(`\\bcreateMarsSelectSpace\\(\\s*[^,]+,\\s*${s}`, 'g'));
}

const missing = new Map(); // string -> Set(files)
function record(s, file) {
  if (!s) return;
  if (!/[A-Za-z]/.test(s[0])) return;
  if (!/\s/.test(s) && !s.includes('${')) return; // single-word non-template → likely internal
  if (ruKeys.has(s)) return;
  if (!missing.has(s)) missing.set(s, new Set());
  missing.get(s).add(path.relative(root, file));
}

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) record(m[1], file);
  }
}

const sorted = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`\n=== MISSING RU TRANSLATIONS (${sorted.length}) ===\n`);
for (const [s, fileSet] of sorted) {
  console.log(`"${s}"\n    ${[...fileSet].join(', ')}`);
}
