import {expect} from 'chai';
import {planPlayedTargetSizing, PlayedTargetOwner, PlayedTargetCategory} from '@/client/console/played/consolePlayedTargetModel';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

const card = (n: string) => ({name: n} as CardModel);
const owner = (spec: ReadonlyArray<[PlayedTargetCategory, number]>): PlayedTargetOwner => ({
  id: 'red', name: 'admin', color: 'red', self: true, totalPlayed: 20,
  candidates: spec.flatMap(([cat, n], gi) => new Array(n).fill(0).map((_x, i) => ({
    cardName: `${cat}${gi}${i}` as CardName, category: cat, relation: 'external-card' as const,
    ownerId: 'red', slotKey: `${cat}${gi}${i}`, preview: [], model: card(`${cat}${gi}${i}`),
  }))),
});

/** The three profiles, with the candidate zone each really offers. */
const PROFILES = [
  {name: '4K TV     ', availW: 1690, availH: 1337, ui: 1.9, handheld: false},
  {name: '1080p     ', availW: 900, availH: 700, ui: 1, handheld: false},
  {name: 'Steam Deck', availW: 700, availH: 430, ui: 0.75, handheld: true},
];

const CASES: ReadonlyArray<[string, ReadonlyArray<[PlayedTargetCategory, number]>]> = [
  ['1 card               ', [['active', 1]]],
  ['2 cards / 1 category ', [['active', 2]]],
  ['2 cards / 2 categories', [['active', 1], ['automated', 1]]],
  ['3 cards / 1+2  ★     ', [['active', 1], ['automated', 2]]],
  ['3 cards / 1 category ', [['active', 3]]],
  ['4 cards              ', [['active', 2], ['automated', 2]]],
  ['6 cards              ', [['active', 2], ['automated', 4]]],
  ['12 cards             ', [['active', 4], ['automated', 8]]],
  ['15 cards             ', [['active', 5], ['automated', 10]]],
  ['24 cards             ', [['active', 8], ['automated', 16]]],
];

/**
 * THE LAYOUT MATRIX — printed, not just asserted.
 *
 * Two «done» reports have been wrong about this surface, both because the
 * reasoning was checked and the NUMBERS were not. This prints what the solver
 * actually decides for every case the acceptance list names, so the decision is
 * a table anyone can read rather than a claim anyone has to trust.
 */
describe('played-target layout — the decision matrix', () => {
  it('prints columns × rows, card size and overflow for every case', () => {
    for (const p of PROFILES) {
      console.log(`\n── ${p.name} — zone ${p.availW}×${p.availH} (ui ${p.ui}) ──`);
      for (const [label, spec] of CASES) {
        const s = planPlayedTargetSizing({
          owners: [owner(spec)], mode: 'tabs', availW: p.availW, availH: p.availH, ui: p.ui, handheld: p.handheld,
        });
        const cardW = 320 * s.cardZoom;
        const cardH = 460 * s.cardZoom;
        const cols = spec.map(([, n]) => Math.ceil(n / s.rows)).reduce((a, b) => a + b, 0);
        const usedH = s.rows * cardH + (s.rows - 1) * s.gapPx;

        console.log(
          `${label} ${cols}×${s.rows}  card ${cardW.toFixed(0)}×${cardH.toFixed(0)}` +
          `  usedH ${usedH.toFixed(0)}  scroll=${s.overflows ? 'YES' : 'no'}`);
      }
    }
  });

  /**
   * THE ACCEPTANCE CRITERION, as a test.
   *
   * Three cards on a 4K band — one Active, two Automated — must fit whole, in
   * ONE row, with the two Automated cards SIDE BY SIDE. Two «done» reports were
   * wrong about exactly this, so it is pinned rather than described.
   */
  it('3 cards / 1+2 categories on 4K: one row, no scroll, no stack', () => {
    const s = planPlayedTargetSizing({
      owners: [owner([['active', 1], ['automated', 2]])],
      mode: 'tabs', availW: 1690, availH: 1337, ui: 1.9, handheld: false,
    });
    expect(s.overflows, 'three cards on a 4K band may never scroll').to.eq(false);
    expect(s.rows, 'and they belong in ONE row').to.eq(1);
    // The two-card category spans TWO columns; the one-card category spans one.
    expect(Math.ceil(2 / s.rows), 'the busier category gets two tracks').to.eq(2);
    const cardH = 460 * s.cardZoom;
    expect(cardH, 'the row must fit the height budget whole').to.be.at.most(1337);
    expect(320 * s.cardZoom, 'and the cards stay large').to.be.greaterThan(400);
  });

  /** HORIZONTAL BEFORE VERTICAL: adding a card to a category widens the grid
   *  before it ever deepens it, while the width lasts. */
  it('grows the grid sideways before it grows it downward', () => {
    const box = {mode: 'tabs' as const, availW: 1690, availH: 1337, ui: 1.9, handheld: false};
    for (const n of [1, 2, 3]) {
      const s = planPlayedTargetSizing({owners: [owner([['active', n]])], ...box});
      expect(s.rows, `${n} cards still fit one row`).to.eq(1);
      expect(s.overflows).to.eq(false);
    }
  });

  /** SHRINK BEFORE SCROLL, and one scale for the whole surface. */
  it('shrinks the uniform card before it ever reports overflow', () => {
    const box = {mode: 'tabs' as const, availW: 1690, availH: 1337, ui: 1.9, handheld: false};
    const three = planPlayedTargetSizing({owners: [owner([['active', 3]])], ...box});
    const twelve = planPlayedTargetSizing({owners: [owner([['active', 12]])], ...box});
    expect(twelve.cardZoom).to.be.lessThan(three.cardZoom);
    expect(twelve.overflows, 'twelve cards on 4K still fit').to.eq(false);
  });

  /** …and scroll IS reachable — it is the honest answer for a box that cannot
   *  hold the set at a readable size, not an outcome the solver avoids. */
  it('reports overflow when even the floor cannot hold the set', () => {
    const s = planPlayedTargetSizing({
      owners: [owner([['active', 40]])], mode: 'tabs', availW: 420, availH: 300, ui: 1, handheld: false,
    });
    expect(s.overflows).to.eq(true);
    expect(s.cardZoom, 'and the cards stay readable while it scrolls').to.be.at.least(0.3);
  });

  /** The layout is DETERMINISTIC — a repeated entry lands on the same geometry,
   *  so nothing appears to resize when the player merely comes back. */
  it('is identical on a repeated entry', () => {
    const box = {owners: [owner([['active', 1], ['automated', 2]])], mode: 'tabs' as const, availW: 1690, availH: 1337, ui: 1.9, handheld: false};
    expect(planPlayedTargetSizing(box)).to.deep.eq(planPlayedTargetSizing(box));
  });
});
