import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * NO ROOT-ANCHORED `:has()` IN CONSOLE STYLES.
 *
 * Blink re-evaluates a `:has()` whose SUBJECT is a document-level element
 * (`.con-root` / `html` / `body`) against subtree mutations and answers with
 * a whole-subtree style invalidation — i.e. a full-document recalc, roughly
 * once per animated frame. Measured on the «Разыграно» category flight
 * (100 cards, 1280×800): ~1.2 s of UpdateLayoutTree per episode with four
 * such rules, ~37 ms once they were keyed on plain classes. EVERY console
 * animation paid it; the biggest surfaces paid the most.
 *
 * The replacement is `conWsPresenceBridge.ts` — ONE MutationObserver that
 * publishes `.con-root--ws-open` / `--ws-dockcover` / `--pfocus` with the
 * same semantics (true while a matching element is in the DOM, leave
 * transitions included). A new root-level presence flag belongs there.
 *
 * `:has()` anchored on a SMALL element is fine and stays in use (the
 * workspace head, the strategy cassette, a zoom slot): its invalidation is
 * scoped to that element's own subtree.
 *
 * Full write-up: docs/PLAYED_TABLEAU_PERFORMANCE.md.
 */
const STYLES = path.join(__dirname, '..', '..', 'src', 'styles');
/** Selector subjects whose `:has()` costs a document-wide recalc. */
const ROOT_ANCHORS = /(^|[\s,>+~])(html|body|\.con-root)(\.[\w-]+|:[\w-]+(\([^)]*\))?)*:has\(/;

function consoleSheets(): Array<string> {
  return fs.readdirSync(STYLES)
    .filter((f) => f.startsWith('console') && f.endsWith('.less'))
    .map((f) => path.join(STYLES, f));
}

/** Strip `/* … *\/` blocks (multi-line included) so prose can name the retired hook. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

describe('console styles: no root-anchored :has()', () => {
  it('every `:has()` in console*.less is anchored on a scoped element', () => {
    const offenders: Array<string> = [];
    for (const file of consoleSheets()) {
      const lines = withoutComments(fs.readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (ROOT_ANCHORS.test(line)) {
          offenders.push(`${path.basename(file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      'root-anchored :has() costs a whole-document style recalc per animated frame — ' +
      'publish the flag from conWsPresenceBridge.ts instead:\n' + offenders.join('\n'),
    ).to.deep.equal([]);
  });
});
