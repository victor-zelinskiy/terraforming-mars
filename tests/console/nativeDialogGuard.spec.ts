import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * NO NATIVE DIALOG ON A SCREEN A PAD PLAYS (docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * `alert()` / `confirm()` / `prompt()` of the browser are BLOCKING: the page's script stops behind them — the
 * liveness arbiter, the pulse's witness, the transport — and on a pad-only device (the couch, the Steam Machine) the
 * dialog's button is a window no button of the pad reaches. One such call on the game's road is a freeze nothing in
 * the page can even see. Until 2026-11-15 the root ended every failure of the view's fetch AND of its commit in
 * `alert('Error getting game data')`.
 *
 * The console has its own surfaces for the same words: `showAlert` → the console's system alert (A / B dismiss it),
 * the loading curtain's error state (`failLoading`), the last line. This guard reads every `.ts` / `.vue` under
 * `src/client` and fails on a native dialog call outside the list below — the mouse-only ADMIN pages, each with why.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const TREE = path.join(ROOT, 'src', 'client');

/** Files that may call a native dialog: path → why (a page no pad ever plays). */
const MOUSE_ONLY: Readonly<Record<string, string>> = {
  'src/client/components/admin/GameOverview.vue': 'the admin\'s game page — a mouse page behind the server\'s admin id, never reached from the console',
  'src/client/components/GamesOverview.vue': 'the admin\'s list of games — a mouse page behind the server\'s admin id',
  'src/client/components/LoadGameForm.vue': 'the admin\'s «load a game by id» form — a mouse page',
  'src/client/components/auth/LoginHome.vue': 'the hosted server\'s login page — a mouse page, not part of the native shell',
};

function sources(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sources(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The code of a file with its comments and string contents blanked — a dialog NAMED in a comment is not a call. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, (m) => m[0] + ' '.repeat(Math.max(0, m.length - 2)) + m[m.length - 1]);
}

/** Native dialog calls of one file: `line: text`. */
export function nativeDialogCalls(text: string): Array<string> {
  const code = codeOnly(text);
  // A file that declares its own `confirm` / `alert` / `prompt` (a component's method) calls ITS function by that name.
  const declares = (name: string): boolean => new RegExp(`function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=`).test(code);
  const found: Array<string> = [];
  const lines = code.split('\n');
  const raw = text.split('\n');
  lines.forEach((line, i) => {
    const hits: Array<string> = [];
    if (/\bwindow\s*\.\s*(alert|confirm|prompt)\s*\(/.test(line)) {
      hits.push('window');
    }
    for (const name of ['alert', 'confirm', 'prompt']) {
      if (new RegExp(`(?<![\\w.$])${name}\\s*\\(`).test(line) && !new RegExp(`function\\s+${name}\\s*\\(`).test(line) && !declares(name)) {
        hits.push(name);
      }
    }
    if (hits.length > 0) {
      found.push(`${i + 1}: ${raw[i].trim().slice(0, 120)}`);
    }
  });
  return found;
}

describe('no native dialog on a screen a pad plays', function() {
  // A read of the whole client tree — a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);
  const files = sources(TREE);

  it('reads a real corpus, and sees what it is there for (anti-vacuous)', () => {
    expect(files.length).to.be.greaterThan(900);
    expect(nativeDialogCalls('function f() {\n  alert(\'x\');\n}')).to.have.length(1);
    expect(nativeDialogCalls('if (!confirm(text)) {\n  return;\n}')).to.have.length(1);
    expect(nativeDialogCalls('window.alert(message);')).to.have.length(1);
    // Not calls: the console\'s own alert, a method, a component\'s own `confirm`, a comment, a string.
    expect(nativeDialogCalls('showAlert(a, b);\nr.showAlert(a);\nthis.alert(a);\nshowConsoleAlert(a);')).to.deep.eq([]);
    expect(nativeDialogCalls('function confirm(): void {\n  done();\n}\nconfirm();')).to.deep.eq([]);
    expect(nativeDialogCalls('// alert(\'x\') used to stand here\nconst s = "alert(1)";\n/* confirm(x) */')).to.deep.eq([]);
  });

  it('no file under src/client calls alert / confirm / prompt of the browser — but the mouse-only admin pages', () => {
    const offenders: Array<string> = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (MOUSE_ONLY[rel] !== undefined) {
        continue;
      }
      for (const call of nativeDialogCalls(fs.readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}:${call}`);
      }
    }
    expect(offenders, 'a native dialog blocks the page and no pad reaches its button — use `showAlert` (the console\'s system alert), ' +
      '`failLoading` (the curtain\'s error state) or say why the file is a mouse-only page in MOUSE_ONLY').to.deep.eq([]);
  });

  it('the mouse-only list is honest: every file on it exists, still calls a native dialog, and says why', () => {
    for (const [rel, why] of Object.entries(MOUSE_ONLY)) {
      const file = path.join(ROOT, rel);
      expect(fs.existsSync(file), `${rel} is gone — drop its row`).to.eq(true);
      expect(nativeDialogCalls(fs.readFileSync(file, 'utf8')).length, `${rel} calls no native dialog any more — drop its row`).to.be.greaterThan(0);
      expect(why.length, `${rel} says why`).to.be.greaterThan(24);
    }
  });
});
