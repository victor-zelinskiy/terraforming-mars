import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * T03 · CF — THE RAIL'S PAINT MAY CHANGE, ITS BOXES MAY NOT.
 *
 * The left rail is the landing zone of every resource flight (`consoleResourceTransfer.targetPointFor` aims at
 * `.con-score__value`, `.con-res__row--X .con-res__digits / __stockwrap / __prod`; the generation scene and the
 * conversion overlay measure the same rows). Its GEOMETRY is a mature contract: the size tokens `--cr-*` / `--ct-*`
 * on every profile are pinned here as a table (a change is a deliberate geometry change, made in the same diff as
 * this table and the e2e baseline `tests/e2e/railAnchorsBaseline.json`), and the plate / the rows / the hull carry
 * no `transform`, `filter` or `will-change` — each would make a stacking context or a moved box under the flight
 * layers. The e2e twin (`console-rail-material.spec.ts`) measures the anchors themselves, ±1 px, on three profiles.
 */
const STYLES = path.resolve(__dirname, '../../src/styles');

/** Every rail size token, file by file, in source order — the geometry the base client shipped. */
const TOKENS: Readonly<Record<string, ReadonlyArray<string>>> = {
  'console.less': [
    '--cr-pad: .6rem', '--cr-icon: 1.75rem', '--cr-row-py: .3rem', '--cr-rgap: .4rem', '--cr-panel-gap: .6rem',
    '--cr-score-h: 2.6rem', '--cr-prod-w: 2.2rem', '--cr-aux-off: .85rem', '--cr-aux-w: 4.5rem',
    '--ct-icon: 2.1rem', '--ct-num: 1rem', '--ct-gap-y: .35rem', '--ct-gap-x: .2rem',
    // the handheld profile
    '--cr-pad: .4rem', '--cr-icon: 1.1rem', '--cr-row-py: .2rem', '--cr-rgap: .25rem', '--cr-panel-gap: .4rem',
    '--cr-score-h: 1.95rem', '--cr-aux-off: .75rem', '--cr-aux-w: 3.5rem',
    '--ct-icon: 1.4rem', '--ct-num: .78rem', '--ct-gap-y: .25rem',
  ],
  'console_tv.less': [
    '--cr-pad: 0.65rem', '--cr-icon: 2.2rem', '--cr-row-py: 0.4rem', '--cr-rgap: 0.45rem', '--cr-score-h: 3rem',
    '--cr-prod-w: 2.3rem', '--cr-aux-off: 0.95rem', '--cr-aux-w: 4.9rem',
    '--ct-icon: 2.6rem', '--ct-num: 1.15rem', '--ct-gap-y: 0.4rem',
  ],
};

/** The rail's TOP-LEVEL rule (a nested `.con-res {` of a state block precedes nothing — anchored on its own line). */
const RAIL_RULE = '\n.con-res {\n';

function read(file: string): string {
  return fs.readFileSync(path.join(STYLES, file), 'utf8');
}

/** The body of the top-level rule that starts with `head` (balanced braces). */
function ruleBody(source: string, head: string): string {
  const at = source.indexOf(head);
  expect(at, `rule «${head}» exists`).to.be.greaterThan(-1);
  let depth = 0;
  for (let i = source.indexOf('{', at); i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(at, i + 1);
      }
    }
  }
  throw new Error(`unbalanced rule ${head}`);
}

describe('railGeometryParity — the rail\'s boxes are a contract, its paint is free', () => {
  for (const [file, expected] of Object.entries(TOKENS)) {
    it(`the size tokens of ${file} are the base client's`, () => {
      const found = Array.from(read(file).matchAll(/(--c[rt]-[a-z-]+): *([^;]+);/g)).map((m) => `${m[1]}: ${m[2].trim()}`);
      expect(found).deep.eq(expected);
    });
  }

  it('the rail\'s own rules carry no transform / filter / will-change on the plate, the rows or the hull', () => {
    const body = ruleBody(read('console.less'), RAIL_RULE);
    // The `__icon`'s drop-shadow is a printed-icon nicety the console strips; everything else is the bank itself.
    const bank = body.replace(/&__icon \{[^}]*\}/, '');
    for (const banned of [/\btransform\s*:/, /\bfilter\s*:/, /\bwill-change\s*:/]) {
      expect(bank, `${banned} on the rail's chassis`).not.to.match(banned);
    }
  });

  it('the row grid and the production track keep their shape', () => {
    const body = ruleBody(read('console.less'), RAIL_RULE);
    expect(body).to.contain('grid-template-columns: var(--cr-icon) minmax(0, 1fr) var(--cr-prod-w, 2.2rem);');
    expect(body).to.contain('padding: var(--cr-row-py) .5rem var(--cr-row-py) calc(.5rem + var(--con-pad-x, 0vw));');
    expect(body).to.contain('padding: .15rem .3rem;');
  });
});
