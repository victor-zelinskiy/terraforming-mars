import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE LAW OF ACCESS IS ONE FUNCTION — the client never decides a party-effect
 * threshold by a constant (TR36 Council Seat, the first card that LOWERS it).
 *
 * The threshold of the delegates road is the SERVER's verdict per seat
 * (`PartyAccessModel.effectDelegates`: the printed two, or what a card of the
 * seat's lowered it to), and the client reads it through ONE helper
 * (`effectDelegatesOf` in `consoleParliamentModel.ts` — which also owns the
 * printed PLACES every surface draws, `PARTY_EFFECT_PLACES`). Before this
 * card five client sites read `PARTY_EFFECT_DELEGATES` straight off the shared
 * constant — the plaque's places, the voting area's «ВАШИ ▢▢» row, the vote
 * mode's access reading, the inspector's footer, a chip's wording — and each
 * would have kept drawing «1/2» and «not yet» over an effect the server had
 * already granted. Nothing compiles against a rule like that, so the guard
 * reads the sources: the shared constant's name may appear in `src/client/**`
 * ONLY in the one model file, and never in a `.vue` at all.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT = path.join(ROOT, 'src', 'client');
const HELPER = path.join('src', 'client', 'console', 'parliament', 'consoleParliamentModel.ts');
const CONSTANT = 'PARTY_EFFECT_DELEGATES';

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Lines of `src` that name the constant outside a comment (a line comment, a block-comment line, an HTML comment). */
function codeReferences(src: string): Array<number> {
  const out: Array<number> = [];
  let inBlock = false;
  let inHtml = false;
  src.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) {
        inBlock = false;
      }
      return;
    }
    if (inHtml) {
      if (trimmed.includes('-->')) {
        inHtml = false;
      }
      return;
    }
    if (trimmed.startsWith('/*')) {
      inBlock = !trimmed.includes('*/');
      return;
    }
    if (trimmed.startsWith('<!--')) {
      inHtml = !trimmed.includes('-->');
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return;
    }
    const code = line.replace(/\/\/.*$/, '');
    if (code.includes(CONSTANT)) {
      out.push(i + 1);
    }
  });
  return out;
}

describe('the party-effect threshold is read through ONE client helper (TR36 Council Seat)', () => {
  const files = walk(CLIENT);
  const readers = files
    .map((file) => ({file: path.relative(ROOT, file), lines: codeReferences(fs.readFileSync(file, 'utf8'))}))
    .filter((entry) => entry.lines.length > 0);

  it('reads a real corpus (anti-vacuous: the helper itself names the constant)', () => {
    expect(files.length).to.be.greaterThan(500);
    expect(readers.map((r) => r.file.split(path.sep).join('/'))).to.include(HELPER.split(path.sep).join('/'));
  });

  it('`PARTY_EFFECT_DELEGATES` is named in src/client ONLY by the helper file — every surface asks `effectDelegatesOf` / `PARTY_EFFECT_PLACES`', () => {
    const strays = readers.filter((r) => r.file !== HELPER).map((r) => `${r.file}:${r.lines.join(',')}`);
    expect(strays, 'client files deciding a party-effect threshold by the shared constant').to.deep.eq([]);
  });

  it('no `.vue` names it at all (a template cannot know whose threshold it draws)', () => {
    const vues = readers.filter((r) => r.file.endsWith('.vue')).map((r) => r.file);
    expect(vues).to.deep.eq([]);
  });

  it('the helper exports the one reader and the printed places (the names the surfaces import)', () => {
    const src = fs.readFileSync(path.join(ROOT, HELPER), 'utf8');
    expect(src).to.include('export function effectDelegatesOf(');
    expect(src).to.include(`export const PARTY_EFFECT_PLACES = ${CONSTANT};`);
    expect(src).to.include(`access?.effectDelegates ?? ${CONSTANT}`);
  });
});
