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
// Each entry: {re, prompt} — `prompt: true` means the match must also pass the
// PROMPT_LIKE heuristic (used for the broad `return` pattern to avoid noise).
const patterns = [];
for (const s of [str, dstr]) {
  patterns.push({re: new RegExp(`title:\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bmessage\\(\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bnew SelectOption\\(\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bnew SelectCard\\(\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bnew SelectAmount\\(\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bsetTitle\\(\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bnew Select\\w+\\(\\s*[^,]+,\\s*${s}`, 'g')});
  patterns.push({re: new RegExp(`\\bcreateMarsSelectSpace\\(\\s*[^,]+,\\s*${s}`, 'g')});
  // Bare `return '<prompt>'` — catches title/reason helpers like getTitle() that
  // feed SelectSpace/SelectCard/UnplayableReason without a recognizable call
  // shape (this is the class the ocean→greenery placement title fell into).
  patterns.push({re: new RegExp(`return\\s+${s}`, 'g'), prompt: true});
}

// A returned string is only treated as user-facing when it reads like a prompt/
// reason: it starts with a known UI verb/lead word. Keeps the `return` pattern
// from flooding the report with internal error/debug strings.
const PROMPT_LIKE = /^(Select|Choose|Place|Add|Gain|Remove|Pay|Spend|Lose|Increase|Decrease|Discard|Draw|Claim|Fund|Build|Trade|Convert|Colony |Cannot |You already|Not enough|No |Nothing |Card |Production )/;

// A string that ends with whitespace or a ` - ` separator is an operand of a
// runtime concatenation (`'Increase ' + resource + …`, `'Claim - ' + name`).
// The COMPLETE runtime string ("Increase steel production 1 step") is the real
// key and is often already translated — the fragment is a false positive, so
// bucket it separately (verify the full strings by grepping, not by this key).
const FRAGMENT = /[\s]$|- $/;

const missing = new Map(); // string -> Set(files)
const fragments = new Map(); // concatenation-operand fragment -> Set(files)
function record(s, file) {
  if (!s) return;
  if (!/[A-Za-z]/.test(s[0])) return;
  if (!/\s/.test(s) && !s.includes('${')) return; // single-word non-template → likely internal
  if (ruKeys.has(s)) return;
  const bucket = FRAGMENT.test(s) ? fragments : missing;
  if (!bucket.has(s)) bucket.set(s, new Set());
  bucket.get(s).add(path.relative(root, file));
}

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  for (const {re, prompt} of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (prompt && !PROMPT_LIKE.test(m[1])) continue;
      record(m[1], file);
    }
  }
}

const sorted = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`\n=== MISSING RU TRANSLATIONS (${sorted.length}) ===\n`);
for (const [s, fileSet] of sorted) {
  console.log(`"${s}"\n    ${[...fileSet].join(', ')}`);
}

const frags = [...fragments.entries()].sort((a, b) => a[0].localeCompare(b[0]));
if (frags.length > 0) {
  console.log(`\n=== CONCATENATION FRAGMENTS — verify the FULL runtime strings are keyed (${frags.length}) ===\n`);
  for (const [s, fileSet] of frags) {
    console.log(`"${s}"…\n    ${[...fileSet].join(', ')}`);
  }
}
