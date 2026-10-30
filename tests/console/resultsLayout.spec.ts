import {expect} from 'chai';
import {FACE_REM, RESULTS_TIERS, ResultsBox, ResultsLayoutInput, ResultsLayoutSeat, resultsLayoutOf, ResultsProfile} from '@/client/console/parliament/resultsLayout';

/*
 * THE RESULTS CARD IS SOLVED (P71 · ledger CY): the zones' widths, the faces' sizes and the ledger's token tier are
 * decided from what the card says and its box, so nothing leaves its row on any profile, with any number of seats and
 * totals, with or without fresh resolutions. The real boxes are read by the e2e guard (`expectResultsContained`); this
 * spec pins the solver's own promises over the whole grid of inputs.
 */
/** The card's box (rem) on the three profiles — the stage the results pose gives the card (measured on the box: the Deck 1068 × 375 px at 20 px). */
const BOXES: Readonly<Record<ResultsProfile, ResultsBox>> = {
  fhd: {width: 78, height: 27},
  tv: {width: 81, height: 26.5},
  deck: {width: 53.4, height: 18.75},
};
const PROFILES: ReadonlyArray<ResultsProfile> = ['fhd', 'tv', 'deck'];

function seats(n: number, totals: number, over: Partial<ResultsLayoutSeat> = {}): Array<ResultsLayoutSeat> {
  return Array.from({length: n}, (_, i) => ({
    numbers: Array.from({length: totals}, (__, j) => (j % 2 === 0 ? 12 : -3)),
    objects: 0,
    skips: 0,
    marks: totals > 0,
    name: ['French_Fries', 'victor', 'Бот', 'player4'][i],
    winner: i === 0,
    ...over,
  }));
}

function input(over: Partial<ResultsLayoutInput> = {}): ResultsLayoutInput {
  return {seats: seats(3, 3), fresh: 3, support: true, noDelegate: false, worldLines: 0, inSitting: false, ...over};
}

describe('resultsLayout — the results card, solved', () => {
  for (const profile of PROFILES) {
    describe(`profile ${profile}`, () => {
      const box = BOXES[profile];
      for (const n of [1, 2, 3, 4]) {
        for (const totals of [1, 3, 5, 8]) {
          for (const fresh of [0, 3]) {
            it(`${n} seat(s) × ${totals} total(s), ${fresh} fresh: the zones fit the card, the faces read, every row holds or folds by name`, () => {
              const layout = resultsLayoutOf(input({seats: seats(n, totals), fresh}), box, profile);
              const used = layout.enactedWidth + layout.payoutsWidth + layout.nextWidth;
              expect(used, 'the three zones fit the card\'s width').lessThan(box.width);
              expect(layout.payoutsWidth, 'the ledger is the card\'s subject — never squeezed below a reading width').greaterThan(20);
              expect(layout.enactedZoom).within(.42, .86);
              expect(FACE_REM.height * layout.enactedZoom, 'the enacted face stands inside its column').lessThan(box.height);
              if (fresh > 0) {
                expect(layout.freshZoom, 'a fresh face never drops below its caption\'s floor').at.least(profile === 'deck' ? .3 : .44);
                expect(layout.freshPerRow).within(1, 3);
              } else {
                expect(layout.freshZoom).eq(0);
              }
              expect(layout.fold).lengthOf(n);
              layout.fold.forEach((shown) => {
                if (shown !== undefined) {
                  expect(layout.tier, 'a fold exists only past the last tier').eq('compact');
                  expect(shown).lessThan(totals);
                }
              });
              expect(layout.totalSize, 'the tier\'s size — the Deck at 0.8 of the TV ladder').closeTo(RESULTS_TIERS[layout.tier].total * (profile === 'deck' ? .8 : 1), 1e-9);
            });
          }
        }
      }

      it('the tier never GROWS with more to say (monotone in seats and in totals)', () => {
        const rank = {hero: 0, regular: 1, compact: 2};
        let last = -1;
        for (const totals of [1, 2, 4, 6, 8, 12]) {
          const tier = rank[resultsLayoutOf(input({seats: seats(3, totals)}), box, profile).tier];
          expect(tier).at.least(last);
          last = tier;
        }
        last = -1;
        for (const n of [1, 2, 3, 4]) {
          const tier = rank[resultsLayoutOf(input({seats: seats(n, 3)}), box, profile).tier];
          expect(tier).at.least(last);
          last = tier;
        }
      });
    });
  }

  it('a quiet table: no fresh resolutions — the next-vote column is as narrow as the seals, the ledger takes the rest', () => {
    const withFresh = resultsLayoutOf(input({fresh: 3}), BOXES.tv, 'tv');
    const without = resultsLayoutOf(input({fresh: 0}), BOXES.tv, 'tv');
    expect(without.nextWidth).lessThan(withFresh.nextWidth);
    expect(without.payoutsWidth).greaterThan(withFresh.payoutsWidth);
  });

  it('nothing to say about the next vote at all (no fresh, no support, no exception): no column', () => {
    const layout = resultsLayoutOf(input({fresh: 0, support: false}), BOXES.tv, 'tv');
    expect(layout.nextWidth).eq(0);
  });

  it('the frames of the owner — three seats at 4K: the ledger reads at the hero / regular tier, never the compact one', () => {
    // Frame 1 (Mohole Contest): the winner 2 tokens + a parameter, a skip, one token.
    const mohole = resultsLayoutOf(input({seats: [
      {numbers: [6, 5], objects: 1, skips: 0, marks: true, name: 'victor', winner: true},
      {numbers: [], objects: 0, skips: 1, marks: false, name: 'Бот', winner: false},
      {numbers: [3], objects: 0, skips: 0, marks: false, name: 'French_Fries', winner: false},
    ]}), BOXES.tv, 'tv');
    expect(mohole.tier).not.eq('compact');
    // Frame 2 (Colonial Affairs): the cards, the discards, two more units each.
    const colonial = resultsLayoutOf(input({fresh: 0, seats: [
      {numbers: [6, 3, 3], objects: 0, skips: 0, marks: true, name: 'French_Fries', winner: false},
      {numbers: [3, 3, 3, 3], objects: 0, skips: 0, marks: true, name: 'victor', winner: false},
      {numbers: [4], objects: 0, skips: 0, marks: true, name: 'Бот', winner: true},
    ]}), BOXES.tv, 'tv');
    expect(colonial.tier).not.eq('compact');
    expect(colonial.fold.every((f) => f === undefined)).is.true;
  });

  it('the Deck: the colonial table on three seats (the who column at the Deck\'s own type) holds every token — no fold', () => {
    const layout = resultsLayoutOf(input({seats: [
      {numbers: [4], objects: 0, skips: 0, marks: true, name: 'player2', winner: true},
      {numbers: [], objects: 0, skips: 1, marks: false, name: 'player3', winner: false},
      {numbers: [6, 3, 6, 3], objects: 0, skips: 0, marks: true, name: 'player1', winner: false},
    ]}), BOXES.deck, 'deck');
    expect(layout.fold.every((f) => f === undefined), JSON.stringify(layout)).is.true;
  });

  it('a theoretical edge — a seat with more than the card can hold — folds its tail into «+N», never silently', () => {
    const layout = resultsLayoutOf(input({seats: seats(4, 40)}), BOXES.deck, 'deck');
    expect(layout.tier).eq('compact');
    expect(layout.fold.every((f) => f !== undefined && f < 40)).is.true;
  });
});
