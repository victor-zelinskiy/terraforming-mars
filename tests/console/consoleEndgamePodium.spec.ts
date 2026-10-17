import {expect} from 'chai';
import {
  EQUAL_HEADROOM, FACE_ASPECT, FACE_PX_H, faceZoom, horizonDrop, horizonRadius, planPodium, podiumModeFor, podiumOrder,
  SEAT_SPEC, slotOffset,
} from '../../src/client/console/endgame/consoleEndgamePodium';

/**
 * TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» — the PODIUM planner: the seats' geometry from the measured box. The finale was a table
 * of five 60 px bars over an empty horizon (the winner 8 % of the screen's height); these specs pin what replaced it:
 * the hero stands ≥ a third of the box tall and is the tallest seat, the places step down, the equal seats of the
 * count stand lower than the hero (the crowning RISES), every seat fits the box at every table size and profile, the
 * winner stands on the horizon's crest.
 */
const TV4K = {boxW: 3520, boxH: 1300, rem: 40};
const FHD = {boxW: 1760, boxH: 650, rem: 20};
const DECK = {boxW: 1180, boxH: 470, rem: 13.3};

describe('consoleEndgamePodium — the podium planner (TR69)', () => {
  it('a duel and a solo game stand SIDE by side; three and more STACK', () => {
    expect([1, 2, 3, 4, 5].map(podiumModeFor)).deep.eq(['side', 'side', 'stack', 'stack', 'stack']);
  });

  for (const [profile, box] of [['tv4k', TV4K], ['fhd', FHD], ['deck', DECK]] as const) {
    for (const seats of [1, 2, 3, 4, 5]) {
      it(`${profile} · ${seats} seat(s): every seat fits the box, the hero is the tallest, the count stands lower`, () => {
        const plan = planPodium({seats, ...box});
        const row = (w: number) => seats * w + (seats - 1) * plan.gap;
        for (const geo of [plan.equal, plan.hero, plan.place]) {
          expect(geo.seatH, 'no seat taller than the box').to.be.at.most(box.boxH + 0.5);
          expect(geo.faceH).to.be.at.least(0);
          expect(geo.faceH * FACE_ASPECT, 'the face fits its seat').to.be.at.most(geo.seatW + 0.5);
        }
        expect(row(plan.equal.seatW), 'the equal row fits the width').to.be.at.most(box.boxW + 0.5);
        expect(row(plan.hero.seatW), 'the crowned row fits the width (one width for every seat)').to.be.at.most(box.boxW + 0.5);
        expect(plan.hero.faceH, 'the hero has the largest face').to.be.at.least(plan.place.faceH);
        expect(plan.hero.seatH, 'the hero is the tallest seat').to.be.at.least(plan.place.seatH);
        expect(plan.equal.faceH, 'the count stands lower — the crowning rises').to.be.at.most(plan.hero.faceH * EQUAL_HEADROOM + 0.5);
        expect(plan.place.faceH).to.be.closeTo(plan.hero.faceH * SEAT_SPEC[plan.mode].placeRatio, 0.5);
      });
    }
  }

  it('a SIDE seat is never shorter than its reading column — a narrow box\'s width-capped face does not cut the seat', () => {
    // The Deck duel (1280 × 800, the handheld rem ≈ 20): the face is width-capped beside the 19rem reading column, and the
    // seat once took the FACE's height alone — the name stood over the seat, the medallions hung over the actions.
    const box = {boxW: 1240, boxH: 560, rem: 20};
    const plan = planPodium({seats: 2, ...box});
    const padY = SEAT_SPEC.side.padYRem * box.rem;
    expect(plan.mode).eq('side');
    expect(plan.hero.faceH, 'the face is width-capped here').to.be.below(SEAT_SPEC.side.heroReadRem * box.rem);
    expect(plan.hero.seatH, 'the hero seat holds its reading column').to.be.at.least(Math.min(box.boxH, plan.heroReadH + padY) - 0.5);
    expect(plan.place.seatH, 'the place seat holds its reading column').to.be.at.least(Math.min(box.boxH, plan.readH + padY) - 0.5);
    expect(plan.hero.seatH).to.be.at.most(box.boxH + 0.5);
  });

  it('THE HERO IS A THIRD OF THE STAGE at 4K and FHD — never the 8 % row it replaced (2 and 5 seats)', () => {
    for (const box of [TV4K, FHD]) {
      for (const seats of [2, 5]) {
        const plan = planPodium({seats, ...box});
        expect(plan.hero.seatH / box.boxH, `${seats} seats at ${box.rem}px rem`).to.be.at.least(1 / 3);
      }
    }
  });

  it('the seats share the row equally and never stretch past the mode\'s ceiling (a solo seat stays a seat)', () => {
    const five = planPodium({seats: 5, ...TV4K});
    expect(five.hero.seatW).eq(five.place.seatW);
    expect(five.equal.seatW).eq(five.hero.seatW);
    const solo = planPodium({seats: 1, ...TV4K});
    expect(solo.hero.seatW).to.be.at.most(SEAT_SPEC.side.maxWRem * TV4K.rem);
  });

  it('a starved box yields small honest seats, never a negative face or an overflow', () => {
    const plan = planPodium({seats: 5, boxW: 400, boxH: 200, rem: 20});
    for (const geo of [plan.equal, plan.hero, plan.place]) {
      expect(geo.faceH).to.be.at.least(0);
    }
    const empty = planPodium({seats: 3, boxW: 0, boxH: 0, rem: 20});
    expect(empty.hero.faceH).eq(0);
  });

  it('THE PODIUM ORDER: the winner in the middle, the runner-up at its left, the third at its right, outwards', () => {
    expect(podiumOrder([1, 2, 3])).deep.eq([2, 1, 3]);
    expect(podiumOrder([1, 2, 3, 4])).deep.eq([4, 2, 1, 3]);
    expect(podiumOrder([1, 2, 3, 4, 5])).deep.eq([4, 2, 1, 3, 5]);
    expect(podiumOrder([1])).deep.eq([1]);
  });

  it('the seats stand ON the horizon: the crest drops nothing, the outer slots stand lower, symmetric', () => {
    const r = horizonRadius(3840);
    const plan = planPodium({seats: 5, ...TV4K});
    const drops = [0, 1, 2, 3, 4].map((i) => horizonDrop(slotOffset(i, 5, plan.hero.seatW, plan.gap), r));
    expect(drops[2]).eq(0);
    expect(drops[1]).to.be.closeTo(drops[3], 1e-6);
    expect(drops[0]).to.be.greaterThan(drops[1]);
    expect(drops[0], 'a gentle planet, never a dome').to.be.below(0.12 * TV4K.boxH);
  });

  it('the face zoom maps the planner\'s face height onto the premium face\'s own px', () => {
    expect(faceZoom(FACE_PX_H)).eq(1);
    expect(faceZoom(FACE_PX_H / 2)).eq(0.5);
  });
});
