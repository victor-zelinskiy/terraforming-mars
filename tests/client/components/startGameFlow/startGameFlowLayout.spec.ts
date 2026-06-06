import {expect} from 'chai';
import {startGameFlowLayoutBudget} from '@/client/components/startGameFlow/startGameFlowLayout';

describe('startGameFlowLayoutBudget', () => {
  it('returns compact window variables instead of a fullscreen-sized panel', () => {
    const budget = startGameFlowLayoutBudget({
      preludeCount: 2,
      corporationCount: 1,
      corporationSelectCount: 0,
      drawCandidateCount: 0,
      resolvedDrawCounts: [],
      copyCandidateCount: 0,
      waiting: false,
      allDone: false,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    expect(budget.windowWidth).to.be.lessThan(1241);
    expect(budget.windowWidth).to.be.greaterThan(719);
    expect(budget.footerReserveHeight).to.be.greaterThan(0);
    expect(budget.bodyMinHeight).to.be.greaterThan(140);
  });

  it('reserves space for Merger corporation candidates', () => {
    const base = startGameFlowLayoutBudget({
      preludeCount: 2,
      corporationCount: 1,
      corporationSelectCount: 0,
      drawCandidateCount: 0,
      resolvedDrawCounts: [],
      copyCandidateCount: 0,
      waiting: false,
      allDone: false,
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    const merger = startGameFlowLayoutBudget({
      preludeCount: 2,
      corporationCount: 1,
      corporationSelectCount: 4,
      drawCandidateCount: 0,
      resolvedDrawCounts: [],
      copyCandidateCount: 0,
      waiting: false,
      allDone: false,
      viewportWidth: 1440,
      viewportHeight: 900,
    });

    expect(merger.bodyMinHeight).to.be.greaterThan(base.bodyMinHeight);
    expect(merger.windowWidth).to.be.at.least(base.windowWidth);
  });

  it('reserves space for drew-N prelude candidates and resolved draw rows', () => {
    const activeDraw = startGameFlowLayoutBudget({
      preludeCount: 1,
      corporationCount: 1,
      corporationSelectCount: 0,
      drawCandidateCount: 3,
      resolvedDrawCounts: [],
      copyCandidateCount: 0,
      waiting: false,
      allDone: false,
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    const resolvedDraw = startGameFlowLayoutBudget({
      preludeCount: 1,
      corporationCount: 1,
      corporationSelectCount: 0,
      drawCandidateCount: 0,
      resolvedDrawCounts: [3],
      copyCandidateCount: 0,
      waiting: false,
      allDone: false,
      viewportWidth: 1440,
      viewportHeight: 900,
    });

    expect(activeDraw.bodyMinHeight).to.be.greaterThan(300);
    expect(resolvedDraw.bodyMinHeight).to.be.greaterThan(300);
    expect(resolvedDraw.windowWidth).to.eq(activeDraw.windowWidth);
  });
});
