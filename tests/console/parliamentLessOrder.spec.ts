import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE PARLIAMENT STYLESHEETS' CASCADE ORDER (Э0 of the sitting rework).
 *
 * `console_parliament.less` was cut into nine files by byte-identical moves,
 * so the cascade BETWEEN them is nothing but the import order in
 * `common.less`. Two of the files re-align the same element at EQUAL
 * specificity: the yield chassis (`.con-iyield { align-items: flex-start }`)
 * and the stages file (`.con-parl__enact-yield { align-items: center }` — the
 * reading under the carried card of the enactment stage). In the single file
 * the stage block stood AFTER the chassis and won; the first cut imported the
 * stages earlier and the reading lost its centring — the Э0 pixel probe
 * measured the payout block 8 px off at 1080, 22 393 px of divergence. This
 * guard pins the order so a later re-shuffle of the imports cannot flip the
 * cascade silently.
 */
const ROOT = path.join(__dirname, '..', '..');

const PARLIAMENT_FAMILY = [
  'console_parliament',
  'console_parliament_vote',
  'console_party_plaque',
  'console_resolution_face',
  'console_party_action',
  'console_resolution_inspect',
  'console_influence_yield',
  'console_parliament_sitting',
  'console_resolutions_playground',
] as const;

function importOrder(): Array<string> {
  const less = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'common.less'), 'utf8');
  return [...less.matchAll(/@import\s+"\.\/(console_[a-z_]+)\.less";/g)].map((m) => m[1]);
}

describe('parliament LESS cascade order (the Э0 split)', () => {
  it('the stages file cascades AFTER the yield chassis it re-aligns at equal specificity', () => {
    const order = importOrder();
    const yieldAt = order.indexOf('console_influence_yield');
    const sittingAt = order.indexOf('console_parliament_sitting');
    expect(yieldAt, 'the yield chassis is imported').to.be.greaterThan(-1);
    expect(sittingAt, 'the stages file is imported').to.be.greaterThan(-1);
    expect(sittingAt, '`.con-parl__enact-yield` must follow `.con-iyield` in the cascade').to.be.greaterThan(yieldAt);
  });

  it('every file of the family is imported exactly once, after the composite surfaces and before the TV profile ladder', () => {
    const order = importOrder();
    for (const name of PARLIAMENT_FAMILY) {
      expect(order.filter((n) => n === name), name).to.have.length(1);
    }
    const positions = PARLIAMENT_FAMILY.map((n) => order.indexOf(n));
    expect(order.indexOf('console_composite'), 'the family follows the composite surfaces').to.be.lessThan(Math.min(...positions));
    expect(order.indexOf('console_tv'), 'the TV profile ladder follows the whole family').to.be.greaterThan(Math.max(...positions));
  });
});
