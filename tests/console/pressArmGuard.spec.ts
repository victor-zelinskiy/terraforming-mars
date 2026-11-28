import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/*
 * A LATCH RAISED BESIDE A SUBMIT IS THE PRESS's (FREEZE ZERO, stage 9 — docs/claude/console/freeze-zero/PLAN.md § 8;
 * the family of #119). `session/pressState.ts` binds «a commit is on its way» to the submit its press makes — it falls
 * with that submit by every road that leaves the move unmade. This guard keeps the FORM: a function of the console
 * that RAISES a latch (`scopedState`) and MAKES A SUBMIT declares that latch as `pressState`, or stands on the list
 * below with why it is not a press's.
 *
 * The form that froze the finale («Завершить свою партию» — CI's games 621 · 630 · 648): `finalGreeneryCommitting`,
 * a `scopedState` of the session, raised by three presses of one file; two of them had an unwind declared by hand
 * (`onPressUnlanded`), the third was not on that list — and a list kept in authors' memory is the class (REVIEW § 2,
 * L15). A new file starts at zero; the list only shrinks.
 *
 * What it does NOT see (the semantic guard is the replay of the family and, to come, the table «every press × every
 * fault of the wire»): a latch raised in one function and the submit made in another; state that is not a
 * `scopedState` (a field of a module's `reactive`, a frame that left) — `onPressUnlanded` stays the door for those.
 */
const ROOT = path.join(__dirname, '..', '..');
const SCAN = ['src/client/console', 'src/client/components/console'];
const SUBMIT = /^(shell\.submit|shell\.submitBatch|submitInput|submitBatch)$/;
const REST = /^(false|undefined|''|""|null|0)$/;

/** `<file> · <function> · <latch>` → why this raise beside a submit is not a press's latch. */
const NOT_A_PRESS: Readonly<Record<string, string>> = {
  'src/client/console/shell/playCardController.ts · acceptConfirm · pendingClientPick':
    'raised in a branch that makes NO submit and returns: it opens a CLIENT question (the replaced unit\'s «where» — the shared picker) whose own answer makes the batch; the function\'s submits are its other branches',
};

type Raise = {file: string, fn: string, latch: string, kind: string, line: number};

function sourcesOf(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourcesOf(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function raisesBesideASubmit(): Array<Raise> {
  const found: Array<Raise> = [];
  for (const file of SCAN.flatMap((dir) => sourcesOf(path.join(ROOT, dir)))) {
    let text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      text = /<script[^>]*>([\s\S]*?)<\/script>/.exec(text)?.[1] ?? '';
    }
    if (!/submit/i.test(text) || !/(scopedState|pressState)\(/.test(text)) {
      continue;
    }
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const latches = new Map<string, string>();
    const declared = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && ts.isCallExpression(node.initializer)) {
        const callee = node.initializer.expression.getText(sf);
        if (callee === 'scopedState' || callee === 'pressState') {
          latches.set(node.name.text, callee);
        }
      }
      ts.forEachChild(node, declared);
    };
    declared(sf);
    const isFunction = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
      ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
    const nameOf = (fn: ts.FunctionLikeDeclaration): string => {
      if (fn.name !== undefined) {
        return fn.name.getText(sf);
      }
      const parent = fn.parent;
      return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? parent.name.text : ts.isPropertyAssignment(parent) ? parent.name.getText(sf) : '(anonymous)';
    };
    const judge = (fn: ts.FunctionLikeDeclaration): void => {
      const raised: Array<Raise> = [];
      let submits = 0;
      const within = (node: ts.Node): void => {
        if (node !== fn && isFunction(node)) {
          return; // (a nested function is judged on its own)
        }
        if (ts.isCallExpression(node) && SUBMIT.test(node.expression.getText(sf))) {
          submits++;
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) &&
            node.left.name.text === 'value' && ts.isIdentifier(node.left.expression) && latches.has(node.left.expression.text) && !REST.test(node.right.getText(sf))) {
          raised.push({
            file: path.relative(ROOT, file).replace(/\\/g, '/'), fn: nameOf(fn), latch: node.left.expression.text,
            kind: latches.get(node.left.expression.text) ?? '', line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          });
        }
        ts.forEachChild(node, within);
      };
      ts.forEachChild(fn, within);
      if (submits > 0) {
        found.push(...raised);
      }
    };
    const everyFunction = (node: ts.Node): void => {
      if (isFunction(node) && node.body !== undefined) {
        judge(node);
      }
      ts.forEachChild(node, everyFunction);
    };
    everyFunction(sf);
  }
  return found;
}

describe('a latch raised beside a submit is the press\'s (`pressState`)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);
  const raises = raisesBesideASubmit();
  const keyOf = (r: Raise): string => `${r.file} · ${r.fn} · ${r.latch}`;

  it('the scan sees the finale\'s three presses — and they are `pressState`', () => {
    const finale = raises.filter((r) => r.latch === 'finalGreeneryCommitting');
    expect(finale.map((r) => r.fn).sort(), 'the cell\'s commit, the exchange, «Завершить свою партию»').to.deep.eq(['convertFinalGreenery', 'finishFinalGreenery', 'onTaskSpacePicked']);
    expect(finale.every((r) => r.kind === 'pressState')).to.eq(true);
  });

  it('every latch a function raises beside its submit is a `pressState` — or says why it is not a press\'s', () => {
    const loose = raises.filter((r) => r.kind !== 'pressState' && NOT_A_PRESS[keyOf(r)] === undefined).map((r) => `${keyOf(r)} (line ${r.line})`);
    expect(loose, 'a `scopedState` raised in a function that makes a submit: declare it `pressState(label, rest)` (`session/pressState.ts`) — ' +
      'it then falls with that submit when the move is not made; or add a row to NOT_A_PRESS with why').to.deep.eq([]);
  });

  it('the list only shrinks: a row whose raise is gone, or is a `pressState` now, is taken out', () => {
    const live = new Set(raises.filter((r) => r.kind !== 'pressState').map(keyOf));
    expect(Object.keys(NOT_A_PRESS).filter((key) => !live.has(key)), 'stale rows of NOT_A_PRESS').to.deep.eq([]);
  });
});
