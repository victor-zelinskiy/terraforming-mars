import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE CAMERA'S CLASSES RESTYLE NOTHING THEY DO NOT NAME (PL-777).
 *
 * Planet Focus moves the camera by flipping classes on the board's root (`con-board--pfocus` / `--pfocus-anim` /
 * `--pfocus-exit` / `--pfocus-settled`). Two ways a stylesheet makes such a flip restyle the WHOLE board — measured
 * at 4K on the GPU with invalidation tracking: three «invalidates subtree» on `.con-board` per exit and 900–1 240
 * elements restyled per flip (after the fix: none, and 720–920):
 *
 *   1. a selector under a camera class whose RIGHTMOST compound is universal (`.global-numbers > *`): Blink has no
 *      feature to key the invalidation on and invalidates the whole subtree of the element whose class changed;
 *   2. a CUSTOM PROPERTY declared by a camera class on the board's ROOT: it is inherited, so every descendant's
 *      style is recomputed when it changes.
 *
 * The shells under `.global-numbers` are named instead (`global-numbers-shell` on every direct child — Board.vue),
 * matched as `> :where(.global-numbers-shell)` (zero specificity, the cascade reads as it did with `*`), and the
 * planet's own transition timing is written on `.board-cont` itself.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const STYLES = path.join(ROOT, 'src', 'styles');
const BOARD = path.join(ROOT, 'src', 'client', 'components', 'Board.vue');

/** Comments blanked (newlines kept). */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

/** Splits on the characters `at` accepts that stand OUTSIDE parentheses. */
function splitTop(text: string, at: (ch: string) => boolean): Array<string> {
  const out: Array<string> = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') {
      depth++;
    }
    if (ch === ')') {
      depth--;
    }
    if (depth === 0 && at(ch)) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/** The rightmost compound of one selector (after the last descendant / child / sibling combinator). */
function rightmostCompound(selector: string): string {
  const parts = splitTop(selector, (ch) => /[\s>+~]/.test(ch));
  return parts[parts.length - 1] ?? '';
}

/**
 * A compound Blink has no feature to key an invalidation on: nothing but `*` and pseudo-classes / elements once its
 * functional pseudos are set aside. `:is()` / `:where()` lend their argument's features, so a compound carrying one is
 * keyed.
 */
function isUniversal(compound: string): boolean {
  if (/:(?:is|where)\(/.test(compound)) {
    return false;
  }
  const rest = compound
    .replace(/::?[\w-]+\([^)]*\)/g, '')
    .replace(/::?[\w-]+/g, '')
    .replace(/^\*/, '');
  return rest === '';
}

type Block = {selectors: Array<string>, body: string, line: number};

/**
 * Every `selector { declarations }` block of a LESS sheet, nesting resolved (`&` → the parent, else a descendant),
 * at-rules transparent, with the block's OWN declarations only — one linear pass (the console sheet is ~38k lines).
 */
function blocks(source: string): Array<Block> {
  const out: Array<Block> = [];
  const stack: Array<Block> = [];
  let buf = '';
  let line = 1;
  let bufLine = 1;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\n') {
      line++;
    }
    if (ch === '{' && source[i - 1] === '@') {
      // A LESS interpolation (`@{name}`) — part of the text, not a block.
      const close = source.indexOf('}', i);
      buf += source.slice(i, close + 1);
      i = close;
      continue;
    }
    if (ch === '{') {
      const head = buf.trim();
      const parents = stack.length > 0 ? stack[stack.length - 1].selectors : [''];
      const selectors = head.startsWith('@') ?
        parents :
        splitTop(head, (c) => c === ',').flatMap((child) => parents.map((parent) =>
          child.includes('&') ? child.replace(/&/g, parent) : (parent === '' ? child : `${parent} ${child}`)));
      stack.push({selectors, body: '', line: bufLine});
      buf = '';
    } else if (ch === ';' || ch === '}') {
      if (stack.length > 0) {
        stack[stack.length - 1].body += buf + ';';
      }
      buf = '';
      if (ch === '}') {
        const block = stack.pop();
        if (block !== undefined && block.selectors.some((s) => s !== '')) {
          out.push(block);
        }
      }
    } else {
      if (buf.trim() === '' && !/\s/.test(ch)) {
        bufLine = line;
      }
      buf += ch;
    }
  }
  return out;
}

/** The rule paints the board's ROOT: its rightmost compound names a camera class (negations set aside). */
function onBoardRoot(selector: string): boolean {
  return /\.con-board--pfocus/.test(rightmostCompound(selector).replace(/:not\([^)]*\)/g, ''));
}

const SHEETS = fs.readdirSync(STYLES).filter((name) => name.endsWith('.less'))
  .map((name) => ({name, blocks: blocks(stripComments(fs.readFileSync(path.join(STYLES, name), 'utf8')))}));

describe('Planet Focus — the camera\'s classes restyle nothing they do not name (PL-777)', () => {
  it('the scanners see the defects and spare the fix', () => {
    expect(isUniversal(rightmostCompound('.con-board--pfocus .con-board__stage .global-numbers > *'))).to.eq(true);
    expect(isUniversal(rightmostCompound('.con-board--pfocus .x > *:not(.y)::after'))).to.eq(true);
    expect(isUniversal(rightmostCompound('.con-board--pfocus .global-numbers > :where(.global-numbers-shell)'))).to.eq(false);
    expect(isUniversal(rightmostCompound('.con-board--pfocus .board-outer-spaces'))).to.eq(false);
    expect(onBoardRoot('.con-board--pfocus.con-board--pfocus-anim')).to.eq(true);
    expect(onBoardRoot('.con-board--pfocus-anim:not(.con-board--pfocus)')).to.eq(true);
    expect(onBoardRoot('.con-board--pfocus .con-board__stage > .board-cont')).to.eq(false);
    const nested = blocks('.con-board {\n  &--pfocus { --x: 1; .a > * { opacity: 0; } }\n  .b, .c { color: red; }\n}');
    expect(nested.map((b) => b.selectors.join(', '))).to.deep.eq(['.con-board--pfocus .a > *', '.con-board--pfocus', '.con-board .b, .con-board .c', '.con-board']);
    expect(nested[1].body).to.contain('--x: 1');
    expect(nested[1].body).to.not.contain('opacity');
    // The rule PL-777 removed: timing handed to the planet through the root's inherited custom properties.
    const old = blocks('.con-board--pfocus.con-board--pfocus-anim { --pfocus-ms: 680ms; }');
    expect(old.filter((b) => b.selectors.some(onBoardRoot)).map((b) => b.body.trim())).to.deep.eq(['--pfocus-ms: 680ms; ;']);
  });

  it('no selector under a camera class ends in a universal compound', () => {
    expect(SHEETS.length, 'the stylesheets were found').to.be.greaterThan(20);
    let scanned = 0;
    const offenders: Array<string> = [];
    for (const sheet of SHEETS) {
      for (const block of sheet.blocks) {
        for (const selector of block.selectors.filter((s) => /pfocus/.test(s))) {
          scanned++;
          if (isUniversal(rightmostCompound(selector))) {
            offenders.push(`${sheet.name}:${block.line}: ${selector}`);
          }
        }
      }
    }
    expect(scanned, 'the camera\'s selectors were found').to.be.greaterThan(20);
    expect(offenders, `a universal compound under a camera class restyles the whole board on every flip — name the elements:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('no camera class declares a custom property on the board\'s root', () => {
    const offenders: Array<string> = [];
    for (const sheet of SHEETS) {
      for (const block of sheet.blocks.filter((b) => b.selectors.some(onBoardRoot))) {
        if (/(^|[;\s])--[\w-]+\s*:/.test(block.body)) {
          offenders.push(`${sheet.name}:${block.line}: ${block.selectors.join(', ')}`);
        }
      }
    }
    expect(offenders, `an inherited custom property set by a camera class restyles every descendant — write the property on the element that reads it:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('every direct child of `.global-numbers` wears `global-numbers-shell`', () => {
    const lines = fs.readFileSync(BOARD, 'utf8').split(/\r?\n/);
    const open = lines.findIndex((l) => /<div class="global-numbers">/.test(l));
    expect(open, 'Board.vue renders `.global-numbers`').to.be.greaterThan(-1);
    const indent = lines[open].search(/\S/);
    const childIndent = indent + 4;
    const children: Array<string> = [];
    for (let i = open + 1; i < lines.length; i++) {
      const line = lines[i];
      const at = line.search(/\S/);
      if (at === indent && line.trim().startsWith('</div>')) {
        break;
      }
      if (at === childIndent && line.trim().startsWith('<') && !line.trim().startsWith('<!--') && !line.trim().startsWith('</')) {
        let tag = line;
        for (let j = i + 1; !tag.includes('>') && j < lines.length; j++) {
          tag += ' ' + lines[j];
        }
        children.push(tag.trim());
      }
    }
    expect(children.length, 'the shells were found (arcs, chip containers, the ocean band)').to.be.greaterThanOrEqual(6);
    const bare = children.filter((tag) => !/global-numbers-shell/.test(tag));
    expect(bare, `a shell without the class is not faded by the camera:\n${bare.join('\n')}`).to.deep.eq([]);
  });
});
