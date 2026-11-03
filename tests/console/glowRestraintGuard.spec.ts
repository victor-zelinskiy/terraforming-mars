import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE PREMIUM-RESTRAINT LAW — the static guard (`.claude/rules/console-ui.md` § VISUAL RESTRAINT).
 *
 * The owner, 2026-10-24, on a 4K frame of the Parliament: «перебор с эффектами свечения — UI потерял премиальный
 * стиль: левая панель, верхний бар, зона парламента — везде добавлен эффект свечения». Every surface had grown its own
 * coloured halo (a `box-shadow` with no offset, a blur and a light colour) for a STANDING state — the active seat, the
 * viewer's chip, a party with access, a seated chairman, the reached career step, a convertible rail row (which also
 * BREATHED, forever). Each was added «to make the state visible»; together they turned the screen into a lit panel
 * where nothing is louder than anything else.
 *
 * The law: a standing state is drawn by MATERIAL — a crisp kant (inset hairline), a fill, weight, form, an icon —
 * never by light. A halo is legitimate only (a) on the CURSOR, through the one grammar (`.con-cursor()` — its layers
 * are scaled by `--con-cursor-on`, and this guard skips them), and (b) inside a ONE-SHOT `@keyframes` that marks an
 * event the player must not miss (a landing, a gained access) and ends on its own. This spec holds it:
 *  1. THE CLEANED SURFACES STAY CLEAN — the left rail (`.con-res*`, `.con-score`, `.con-tagmx`), the top strip
 *     (`.con-status*`) and the Parliament's stylesheets carry ZERO standing halos;
 *  2. THE RATCHET — every other console stylesheet's standing halos are DEBT, counted per file in
 *     `glowRestraintBaseline.json`: growth fails (a new glow — draw the state with a kant), and a fall fails until it
 *     is locked in (lower the number in the same diff) — an improvement cannot erode;
 *  3. THE TOP STRIP SEES WHAT A BOX-SHADOW SCAN CANNOT (EW, the owner 2026-11-03 — «чипы игроков несут слишком сильный
 *     glow»: the strip read ZERO halos by the letter and glowed by the eye) — on the strip a standing `text-shadow`
 *     with a blur, a `filter: drop-shadow` in a light colour, an endless loop (`infinite` — one licensed row:
 *     the attention beacon's sonar) and a BRIGHT OUTER RING (`0 0 0 <spread>` in a light colour at ≥ 50 % — a halo
 *     with no blur; a kant is inset) all fail;
 *  4. THE MILESTONES / AWARDS WORKSPACE AND THE STRATEGY RAIL (FB, P49 — designed before this law, 11 of the 64 halos
 *     of `console.less`, a light pool under every emblem, a glowing name on every row, a focus halo through `var()`
 *     past the scan and a rail rim that breathed forever) — the same eyes as the strip's PLUS the `var()` halo, in the
 *     `.con-ma*` / `.con-mafocus*` / `.con-strat*` blocks: ZERO. The ceremony keeps its light (the owner's licence —
 *     a ceremony IS the event) and the activation's one-shot layers are opacity 0 at rest — each exemption has its row.
 */

const STYLES = path.resolve(__dirname, '..', '..', 'src', 'styles');
const BASELINE = path.resolve(__dirname, 'glowRestraintBaseline.json');

/** Stylesheets cleaned to zero (2026-10-24) — a standing halo here fails outright. */
const ZERO_FILES: ReadonlyArray<string> = [
  'console_status_material.less',
  'console_parliament.less',
  'console_parliament_chamber.less',
  'console_parliament_sitting.less',
  'console_parliament_vote.less',
  'console_party_plaque.less',
  'console_influence_yield.less',
];
/** …and the always-visible HUD blocks inside `console.less`, by the top-level selector they live under. */
const ZERO_BLOCKS = /^\.(con-res|con-score|con-status|con-tagmx)\b/;
/** A TRANSIENT OBJECT made of light — never a state: it exists for one flight and is gone. Each row says why. */
const TRANSIENT_LIGHT: ReadonlyMap<string, string> = new Map([
  ['.con-parl__flight--spark', 'the alliance impulse (TR62) — one bead of light flown partner → ally by GSAP, unmounted on arrival'],
]);

type Halo = {file: string, line: number, block: string, layer: string};

/** The top strip's blocks inside `console.less` (the strip, its deck's pile and count). */
const STRIP_BLOCKS = /^\.(con-status|con-deckstack)\b/;
/** The strip's stylesheets read whole. */
const STRIP_FILES: ReadonlyArray<string> = ['console_status_material.less'];
/** A ring of the strip that exists only while a FLIGHT is in the air (never a state) — each row says why. */
const STRIP_TRANSIENT: ReadonlyMap<string, string> = new Map([
  ['var(--con-intake-tone', 'the EXPECTING ring of a seat intake (T06): drawn at ≤ .45 opacity only while a token flies to that seat, gone on the touchdown'],
]);
/** The ONE endless loop the strip may run, with its reason. */
const STRIP_LOOPS: ReadonlyMap<string, string> = new Map([
  ['con-beacon-ping', 'the attention beacon — a decision the player OWES with its card off-screen: one sparse sonar ring'],
]);

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
  return out;
}

/** A dark colour is a drop shadow's ink, never light. */
function isDark(colour: string): boolean {
  const rgb = colour.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb !== null) {
    return Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3]) < 120;
  }
  return /#000\b|\bblack\b/i.test(colour);
}

/** A HALO: an outer layer with no real offset, a blur and a light colour — and not the cursor's own layer. */
function isHalo(layer: string): boolean {
  const t = layer.trim().replace(/\s+/g, ' ');
  if (t.startsWith('inset') || t.includes('--con-cursor-on')) {
    return false;
  }
  const m = t.match(/^(-?[\d.]+(?:rem|px)?) (-?[\d.]+(?:rem|px)?) ([\d.]+(?:rem|px))(?: (-?[\d.]+(?:rem|px)))? (.+)$/);
  if (m === null || Number.parseFloat(m[3]) === 0) {
    return false;
  }
  if (Math.abs(Number.parseFloat(m[1])) > 0.05 || Math.abs(Number.parseFloat(m[2])) > 0.3) {
    return false;
  }
  return !isDark(m[5]);
}

/** The alpha a colour expression paints at: `fade(@x, N%)`, an rgba alpha, or 1 for an opaque colour. */
function alphaOf(colour: string): number {
  const fade = colour.match(/fade\([^,]+,\s*([\d.]+)%\)/);
  if (fade !== null) {
    return Number(fade[1]) / 100;
  }
  const rgba = colour.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  if (rgba !== null) {
    return Number(rgba[1]);
  }
  // A triplet in a custom property (`rgba(var(--con-track-accent), .4)`) — the alpha is the last argument.
  const varRgba = colour.match(/rgba\(\s*var\([^)]*\)\s*,\s*([\d.]+)\s*\)/);
  if (varRgba !== null) {
    return Number(varRgba[1]);
  }
  return /transparent/.test(colour) ? 0 : 1;
}

/** A BRIGHT OUTER RING: `0 0 0 <spread> <light colour ≥ 50 %>` — a halo with no blur (a kant is inset). */
function isBrightRing(layer: string): boolean {
  const t = layer.trim().replace(/\s+/g, ' ');
  if (t.startsWith('inset') || t.includes('--con-cursor-on')) {
    return false;
  }
  const m = t.match(/^0 0 0 (-?[\d.]+(?:rem|px)) (.+)$/);
  return m !== null && Number.parseFloat(m[1]) > 0 && !isDark(m[2]) && alphaOf(m[2]) >= 0.5;
}

/** A light TEXT shadow: a layer with a blur and a light colour (a dark engraving offset is ink, not light). */
function isTextGlow(layer: string): boolean {
  return isHalo(layer);
}

/** A light DROP SHADOW inside a `filter`: blurred and light. */
function dropShadowGlows(value: string): Array<string> {
  const out: Array<string> = [];
  for (const m of value.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g)) {
    if (isHalo(m[1])) {
      out.push(`drop-shadow(${m[1].trim()})`);
    }
  }
  return out;
}

/** Every STANDING light of the strip a box-shadow scan cannot see (§ 3). `@keyframes` bodies are events and skipped. */
function stripLightsOf(file: string, blocks: RegExp | undefined): Array<Halo> {
  const source = stripComments(fs.readFileSync(path.join(STYLES, file), 'utf8'));
  const out: Array<Halo> = [];
  const stack: Array<string> = [];
  let segment = '';
  let line = 1;
  const flushDecl = () => {
    if (stack.some((h) => h.startsWith('@keyframes')) || (blocks !== undefined && !blocks.test(stack[0] ?? ''))) {
      return;
    }
    const decl = segment.match(/^\s*([a-z-]+)\s*:([\s\S]*)$/);
    if (decl === null) {
      return;
    }
    const [, prop, value] = decl;
    const at = {file, line, block: stack[0] ?? ''};
    if (prop === 'text-shadow') {
      splitTop(value).filter(isTextGlow).forEach((l) => out.push({...at, layer: `text-shadow: ${l.trim()}`}));
    } else if (prop === 'filter' || prop === '-webkit-filter') {
      dropShadowGlows(value).forEach((l) => out.push({...at, layer: `filter: ${l}`}));
    } else if (prop === 'box-shadow') {
      splitTop(value).filter((l) => isBrightRing(l) && ![...STRIP_TRANSIENT.keys()].some((k) => l.includes(k))).forEach((l) => out.push({...at, layer: `outer ring: ${l.trim().replace(/\s+/g, ' ')}`}));
    } else if ((prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/.test(value)) {
      const name = value.trim().split(/\s+/)[0];
      if (!STRIP_LOOPS.has(name)) {
        out.push({...at, layer: `endless loop: ${value.trim().replace(/\s+/g, ' ')}`});
      }
    }
  };
  for (const ch of source) {
    if (ch === '{') {
      stack.push(segment.trim());
      segment = '';
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
      segment = '';
    } else if (ch === ';') {
      flushDecl();
      segment = '';
    } else {
      segment += ch;
    }
    if (ch === '\n') {
      line++;
    }
  }
  return out;
}

/** Every standing halo of one stylesheet: `@keyframes` bodies are events, not states, and are skipped. */
function halosOf(file: string): Array<Halo> {
  const source = stripComments(fs.readFileSync(path.join(STYLES, file), 'utf8'));
  const out: Array<Halo> = [];
  const stack: Array<string> = [];
  let segment = '';
  let segmentStart = 0;
  let line = 1;
  const flushDecl = () => {
    const m = segment.match(/^\s*box-shadow\s*:([\s\S]*)$/);
    if (m !== null && !stack.some((h) => h.startsWith('@keyframes'))) {
      const declLine = segmentStart + (segment.match(/^\s*/)?.[0].split('\n').length ?? 1) - 1;
      for (const layer of splitTop(m[1])) {
        if (isHalo(layer)) {
          out.push({file, line: declLine, block: stack[0] ?? '', layer: layer.trim().replace(/\s+/g, ' ')});
        }
      }
    }
  };
  for (const ch of source) {
    if (ch === '{') {
      stack.push(segment.trim());
      segment = '';
      segmentStart = line;
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
      segment = '';
      segmentStart = line;
    } else if (ch === ';') {
      flushDecl();
      segment = '';
      segmentStart = line;
    } else {
      segment += ch;
    }
    if (ch === '\n') {
      line++;
    }
  }
  return out;
}

function consoleSheets(): Array<string> {
  return fs.readdirSync(STYLES).filter((f) => /^console.*\.less$/.test(f)).sort();
}

/** The MA workspace and the strategy rail inside `console.less` (§ 4). */
const MA_BLOCKS = /^\.(con-ma|con-mafocus|con-strat)\b/;
/** A nested rule of those blocks that is an EVENT, never a state — matched against the rule's own selector path. */
const MA_EVENT_LIGHT: ReadonlyArray<{selector: RegExp, why: string}> = [
  {selector: /__cere/, why: 'the claim / sponsorship CEREMONY — the owner\'s licence: a ceremony is the event the light marks, and it ends'},
  {selector: /&__(actring|spark|sweep|kiss)\b/, why: 'the rail\'s ACTIVATION layers — opacity 0 at rest, lit only inside a one-shot @keyframes that ends at 0'},
  {selector: /&--(activating|repulse|crownmove)\b/, why: 'a one-shot class the rail\'s machine sets for one phrase and removes'},
];

/** A halo whose blur is the shared glow radius (`var(--con-glow-r)`) — the hand-written focus halo the numeric scan misses. */
function isVarHalo(layer: string): boolean {
  const t = layer.trim().replace(/\s+/g, ' ');
  if (t.startsWith('inset') || t.includes('--con-cursor-on')) {
    return false;
  }
  const m = t.match(/^0 0 var\(--con-glow-r[^)]*\) (.+)$/);
  return m !== null && !isDark(m[1]);
}

/** Every STANDING light of the MA blocks (§ 4): halos (numeric or `var()`), bright outer rings, glowing text, light drop shadows, loops. */
function maLightsOf(): Array<Halo> {
  const source = stripComments(fs.readFileSync(path.join(STYLES, 'console.less'), 'utf8'));
  const out: Array<Halo> = [];
  const stack: Array<string> = [];
  let segment = '';
  let line = 1;
  const flushDecl = () => {
    if (stack.some((h) => h.startsWith('@keyframes')) || !MA_BLOCKS.test(stack[0] ?? '')) {
      return;
    }
    if (stack.some((h) => MA_EVENT_LIGHT.some((e) => e.selector.test(h)))) {
      return;
    }
    const decl = segment.match(/^\s*([a-z-]+)\s*:([\s\S]*)$/);
    if (decl === null) {
      return;
    }
    const [, prop, value] = decl;
    const at = {file: 'console.less', line, block: stack.join(' ')};
    if (prop === 'text-shadow') {
      splitTop(value).filter(isTextGlow).forEach((l) => out.push({...at, layer: `text-shadow: ${l.trim()}`}));
    } else if (prop === 'filter' || prop === '-webkit-filter') {
      dropShadowGlows(value).forEach((l) => out.push({...at, layer: `filter: ${l}`}));
    } else if (prop === 'box-shadow') {
      splitTop(value).filter((l) => isHalo(l) || isVarHalo(l) || isBrightRing(l))
        .forEach((l) => out.push({...at, layer: `box-shadow: ${l.trim().replace(/\s+/g, ' ')}`}));
    } else if ((prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/.test(value)) {
      out.push({...at, layer: `endless loop: ${value.trim().replace(/\s+/g, ' ')}`});
    }
  };
  for (const ch of source) {
    if (ch === '{') {
      stack.push(segment.trim());
      segment = '';
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
      segment = '';
    } else if (ch === ';') {
      flushDecl();
      segment = '';
    } else {
      segment += ch;
    }
    if (ch === '\n') {
      line++;
    }
  }
  return out;
}

/**
 * THE PARLIAMENT BY EYE (§ 5 — P51 · FG, the owner 2026-11-03: «визуал и стили ПАРЛАМЕНТА — то, что сделано слабо»).
 * The Parliament's sheets were ZERO by the letter (`halosOf` reads a blurred box-shadow only) and lit by the eye:
 * bright OUTER rings for the committed support and the viewer's Agenda dot, an opaque mint ring on the seated winner, a
 * halo hidden in a custom property (`--pd-foot-glow`, painted by `player_delegate.less`), the ghost footprint that
 * BREATHED forever, a tinted inset WASH over the party access panel. The strip's eyes now read them too, plus a halo
 * declared in a custom property and a wide tinted inset wash; the delegate figure's sheet, the invitation plate
 * (`.con-mandatory`) and the four Parliament readings that were on the ratchet are read the same way.
 */
const PARLIAMENT_EYE_FILES: ReadonlyArray<string> = [
  'console_parliament.less',
  'console_parliament_chamber.less',
  'console_parliament_sitting.less',
  'console_parliament_vote.less',
  'console_parliament_payout_details.less',
  'console_party_plaque.less',
  'console_influence_reading.less',
  'console_influence_yield.less',
  'console_resolution_face.less',
  'console_resolution_inspect.less',
  'console_track_marker.less',
  'player_delegate.less',
];
/** The invitation plate inside `console.less` (and its tone rules in `console_prompt.less`). */
const PARLIAMENT_EYE_BLOCKS = /^\.(con-mandatory)\b/;
/** An inset layer wide enough to be a WASH (a tinted glow over a panel), never a kant: blur ≥ 1rem in a light colour. */
function isInsetWash(layer: string): boolean {
  const t = layer.trim().replace(/\s+/g, ' ');
  const m = t.match(/^inset (-?[\d.]+(?:rem|px)?) (-?[\d.]+(?:rem|px)?) ([\d.]+)(rem|px)(?: -?[\d.]+(?:rem|px))? (.+)$/);
  if (m === null) {
    return false;
  }
  const blurRem = m[4] === 'px' ? Number(m[3]) / 20 : Number(m[3]);
  return blurRem >= 1 && !isDark(m[5]);
}

/**
 * A TRANSIENT FLIGHT OBJECT of the Parliament's sheets — never a state: the track director's PROXY disc exists for one
 * glide (charge · glide · lock) and is unmounted on arrival. Matched against the rule's selector path.
 */
const PARLIAMENT_TRANSIENT: ReadonlyArray<{selector: RegExp, why: string}> = [
  {selector: /^\.con-track-proxy-(body|phases)\(/, why: 'the track director\'s PROXY disc in flight (charge · glide · lock) — unmounted on the lock, never a standing state'},
];

/** The file's own LESS colour variables (`@x: value;`), so a dark ring named by a variable is read as ink, never light. */
function lessVarsOf(source: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of source.matchAll(/^@([a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    vars.set(m[1], m[2].trim());
  }
  return vars;
}

let allLessVars: Map<string, string> | undefined;
/** Every stylesheet's variables, the first declaration winning — read once. */
function allLessVarsOf(): Map<string, string> {
  if (allLessVars === undefined) {
    allLessVars = new Map();
    for (const f of fs.readdirSync(STYLES).filter((x) => x.endsWith('.less')).sort()) {
      for (const [k, v] of lessVarsOf(stripComments(fs.readFileSync(path.join(STYLES, f), 'utf8')))) {
        if (!allLessVars.has(k)) {
          allLessVars.set(k, v);
        }
      }
    }
  }
  return allLessVars;
}

/** Every standing light of the Parliament's sheets (§ 5). `@keyframes` bodies are events and skipped. */
function parliamentLightsOf(file: string, blocks: RegExp | undefined): Array<Halo> {
  const raw = stripComments(fs.readFileSync(path.join(STYLES, file), 'utf8'));
  // The sheet's own variables first, then any other sheet's (a mixin's colour is declared where the mixin lives).
  const vars = new Map([...allLessVarsOf(), ...lessVarsOf(raw)]);
  const source = raw; // the variables are resolved per declaration (`resolve`), never over the whole sheet
  const resolve = (text: string) => text.replace(/@([a-z0-9-]+)/gi, (whole, name: string) => {
    const value = vars.get(name);
    return value !== undefined && !value.includes('@') && !/gradient/.test(value) ? value : whole;
  });
  const out: Array<Halo> = [];
  const stack: Array<string> = [];
  let segment = '';
  let line = 1;
  const flushDecl = () => {
    if (stack.some((h) => h.startsWith('@keyframes')) || (blocks !== undefined && !blocks.test(stack[0] ?? ''))) {
      return;
    }
    if (TRANSIENT_LIGHT.has(stack[0] ?? '') || stack.some((h) => TRANSIENT_LIGHT.has(h))) {
      return;
    }
    if (PARLIAMENT_TRANSIENT.some((t) => t.selector.test(stack[0] ?? ''))) {
      return;
    }
    const decl = segment.match(/^\s*(--[a-z0-9-]+|[a-z-]+)\s*:([\s\S]*)$/);
    if (decl === null) {
      return;
    }
    const [, prop, rawValue] = decl;
    const value = resolve(rawValue);
    const at = {file, line, block: stack.join(' ')};
    const shadowish = prop === 'box-shadow' || (prop.startsWith('--') && /^\s*(inset\s+)?-?[\d.]+(rem|px)?\s+-?[\d.]+(rem|px)?\s+[\d.]+(rem|px)/.test(value));
    if (prop === 'text-shadow') {
      splitTop(value).filter(isTextGlow).forEach((l) => out.push({...at, layer: `text-shadow: ${l.trim()}`}));
    } else if (prop === 'filter' || prop === '-webkit-filter') {
      dropShadowGlows(value).forEach((l) => out.push({...at, layer: `filter: ${l}`}));
    } else if (shadowish) {
      splitTop(value).filter((l) => isHalo(l) || isVarHalo(l) || isBrightRing(l) || isInsetWash(l))
        .forEach((l) => out.push({...at, layer: `${prop}: ${l.trim().replace(/\s+/g, ' ')}`}));
    } else if ((prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/.test(value)) {
      out.push({...at, layer: `endless loop: ${value.trim().replace(/\s+/g, ' ')}`});
    }
  };
  for (const ch of source) {
    if (ch === '{') {
      stack.push(segment.trim());
      segment = '';
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
      segment = '';
    } else if (ch === ';') {
      flushDecl();
      segment = '';
    } else {
      segment += ch;
    }
    if (ch === '\n') {
      line++;
    }
  }
  return out;
}

describe('glowRestraintGuard — a standing state is a kant, never a glow', () => {
  it('THE PARLIAMENT BY EYE: no standing halo, bright ring, custom-property halo, wash, glowing text or loop (FG)', () => {
    expect(isInsetWash('inset 0 0 2.6rem var(--paccess-tint)')).is.true;
    expect(isInsetWash('inset 0 0 0 .06rem fade(@con-mint, 60%)')).is.false;
    const offenders = [
      ...PARLIAMENT_EYE_FILES.flatMap((file) => parliamentLightsOf(file, undefined)),
      ...parliamentLightsOf('console.less', PARLIAMENT_EYE_BLOCKS),
    ].map((h) => `  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
    expect(offenders, `a standing light on the Parliament — draw the state with a kant / fill / weight / word (\`console-ui.md\` § VISUAL RESTRAINT):\n${offenders.join('\n')}`).to.deep.eq([]);
  }).timeout(20_000); // it reads every stylesheet's variables once — a cold read on a loaded machine outgrows the 2 s default

  it('the detector sees a halo, and only a halo', () => {
    expect(isHalo('0 0 .9rem fade(@con-mint, 26%)')).is.true;
    expect(isHalo('0 0 1.1rem color-mix(in srgb, var(--x) 45%, transparent)')).is.true;
    expect(isHalo('0 0 .8rem .2rem rgba(95, 227, 180, 0.5)')).is.true;
    expect(isHalo('inset 0 0 0 .06rem @con-amber')).is.false;
    expect(isHalo('0 .6rem 1.4rem rgba(0, 0, 0, 0.55)')).is.false;
    expect(isHalo('0 0 0 .06rem fade(@con-cyan, 70%)')).is.false;
    expect(isHalo('0 0 calc(var(--con-glow-r) * var(--con-cursor-on)) rgba(1, 2, 3, .25)')).is.false;
  });

  it('THE CLEANED SURFACES: the rail, the top strip and the Parliament carry no standing halo', () => {
    const offenders: Array<string> = [];
    for (const file of ZERO_FILES) {
      for (const h of halosOf(file).filter((x) => !TRANSIENT_LIGHT.has(x.block))) {
        offenders.push(`  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
      }
    }
    for (const h of halosOf('console.less')) {
      if (ZERO_BLOCKS.test(h.block)) {
        offenders.push(`  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
      }
    }
    expect(offenders, `a standing glow on a surface cleaned to zero — draw the state with a kant / fill / weight (\`console-ui.md\` § VISUAL RESTRAINT):\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the strip\'s detectors see a light a box-shadow scan cannot, and only that', () => {
    expect(isBrightRing('0 0 0 .06rem fade(@con-mint, 72%)')).is.true;
    expect(isBrightRing('0 0 0 .05rem fade(@con-cyan, 30%)')).is.false;
    expect(isBrightRing('0 0 0 .05rem rgba(0, 0, 0, 0.6)')).is.false;
    expect(isBrightRing('inset 0 0 0 .06rem fade(@con-mint, 72%)')).is.false;
    expect(isTextGlow('0 0 .4rem fade(@con-mint, 25%)')).is.true;
    expect(isTextGlow('0 .05rem 0 rgba(0, 0, 0, 0.6)')).is.false;
    expect(dropShadowGlows('drop-shadow(0 0 .3rem fade(@con-amber, 55%))')).to.have.lengthOf(1);
    expect(dropShadowGlows('drop-shadow(0 .1rem .3rem rgba(0, 0, 0, 0.5))')).deep.eq([]);
  });

  it('THE TOP STRIP: no standing text glow, no light drop shadow, no bright outer ring, no endless loop but the beacon\'s', () => {
    const offenders = [
      ...STRIP_FILES.flatMap((file) => stripLightsOf(file, undefined)),
      ...stripLightsOf('console.less', STRIP_BLOCKS),
    ].map((h) => `  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
    expect(offenders, `a standing light on the top strip — draw the state with a kant / fill / weight / word (\`console-ui.md\` § VISUAL RESTRAINT):\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('THE MA WORKSPACE AND THE STRATEGY RAIL: no standing halo, glowing text, bright ring or loop (FB)', () => {
    expect(isVarHalo('0 0 var(--con-glow-r) fade(@con-cyan, 18%)')).is.true;
    expect(isVarHalo('inset 0 0 0 var(--con-focus-ring) fade(@con-cyan, 85%)')).is.false;
    const offenders = maLightsOf().map((h) => `  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
    expect(offenders, `a standing light on the MA workspace / the strategy rail — draw the state with a kant / fill / weight / word (\`console-ui.md\` § VISUAL RESTRAINT):\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('THE RATCHET: standing halos per stylesheet never grow, and a fall is locked in', () => {
    const counts: Record<string, number> = {};
    const all: Array<Halo> = [];
    for (const file of consoleSheets()) {
      const halos = halosOf(file);
      all.push(...halos);
      if (halos.length > 0) {
        counts[file] = halos.length;
      }
    }
    if (process.env.GLOW_RESTRAINT_BASELINE === 'write') {
      fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + String.fromCharCode(10));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew: Array<string> = [];
    const fell: Array<string> = [];
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const now = counts[file] ?? 0;
      const was = baseline[file] ?? 0;
      if (now > was) {
        const list = all.filter((h) => h.file === file).map((h) => `  ${h.file}:${h.line} ${h.block} → ${h.layer}`).join('\n');
        grew.push(`${file}: ${was} → ${now} — a new standing glow; draw the state with a kant / fill / weight, or make it a one-shot @keyframes event:\n${list}`);
      } else if (now < was) {
        fell.push(`${file}: ${was} → ${now}`);
      }
    }
    expect(grew, grew.join('\n')).to.deep.eq([]);
    expect(fell, `the glow debt FELL — lock it in: set these in tests/console/glowRestraintBaseline.json (or run with GLOW_RESTRAINT_BASELINE=write)\n${fell.join('\n')}`).to.deep.eq([]);
  });
});
