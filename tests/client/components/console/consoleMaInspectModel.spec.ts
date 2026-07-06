import {expect} from 'chai';
import {Color} from '@/common/Color';
import {buildMaInspect, projectAwardVp, MaInspectPlayer} from '@/client/components/console/consoleMaInspectModel';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';

const R: Color = 'red';
const B: Color = 'blue';
const G: Color = 'green';

function players(...colors: Array<Color>): Array<MaInspectPlayer> {
  return colors.map((c) => ({color: c, name: c.toString()}));
}

function item(over: Partial<ConsoleMaItem>): ConsoleMaItem {
  return {
    key: 'x', name: 'Landlord', kind: 'award', description: 'desc',
    scores: [], threshold: undefined, myColor: R, myScore: 0, myReady: false,
    myLead: false, leaderScore: 0, cost: undefined, available: false, blocker: '',
    takenBy: undefined, slotsExhausted: false,
    ...over,
  };
}

describe('consoleMaInspectModel', () => {
  describe('projectAwardVp (engine-faithful)', () => {
    it('single 1st + single 2nd in a 3-player game → 5 / 2 / 0', () => {
      expect(projectAwardVp([5, 3, 1], 3)).to.deep.eq([5, 2, 0]);
    });
    it('no 2nd place in a 2-player game', () => {
      expect(projectAwardVp([5, 2], 2)).to.deep.eq([5, 0]);
    });
    it('tie for 1st → both get 5, NO 2nd awarded', () => {
      expect(projectAwardVp([4, 4, 2], 3)).to.deep.eq([5, 5, 0]);
    });
    it('tie for 2nd → each tied gets 2', () => {
      expect(projectAwardVp([5, 2, 2], 3)).to.deep.eq([5, 2, 2]);
    });
    it('all zero → nobody places (no meaningful projection)', () => {
      expect(projectAwardVp([0, 0, 0], 3)).to.deep.eq([0, 0, 0]);
    });
    it('a 0 score never takes 2nd place', () => {
      expect(projectAwardVp([5, 0, 0], 3)).to.deep.eq([5, 0, 0]);
    });
  });

  describe('award standings', () => {
    it('ranks leader→last, projects VP, flags viewer', () => {
      const v = buildMaInspect(
        item({kind: 'award', myColor: G, scores: [{color: R, score: 5}, {color: B, score: 3}, {color: G, score: 1}]}),
        players(R, B, G));
      expect(v.mode).to.eq('award-standings');
      expect(v.rows.map((r) => r.color)).to.deep.eq([R, B, G]);
      expect(v.rows.map((r) => r.rank)).to.deep.eq([1, 2, 3]);
      expect(v.rows.map((r) => r.projectedVp)).to.deep.eq([5, 2, undefined]);
      expect(v.rows[0].isLeader).to.eq(true);
      expect(v.rows[0].barPct).to.eq(100);
      expect(v.rows[1].barPct).to.eq(60);
      expect(v.vpFirst).to.eq(5);
      expect(v.vpSecond).to.eq(2);
      // viewer is GREEN (last) → behind the leader by 4.
      expect(v.summary).to.deep.eq({tone: 'behind', gap: 4});
      expect(v.rows.find((r) => r.color === G)?.viewer).to.eq(true);
    });

    it('viewer leads → lead tone; a 2-player game has no 2nd VP', () => {
      const v = buildMaInspect(
        item({kind: 'award', myColor: R, scores: [{color: R, score: 6}, {color: B, score: 2}]}),
        players(R, B));
      expect(v.summary).to.deep.eq({tone: 'lead'});
      expect(v.vpSecond).to.eq(0);
      expect(v.rows.map((r) => r.projectedVp)).to.deep.eq([5, undefined]);
    });

    it('tie for the lead → tie-lead tone', () => {
      const v = buildMaInspect(
        item({kind: 'award', myColor: R, scores: [{color: R, score: 4}, {color: B, score: 4}, {color: G, score: 1}]}),
        players(R, B, G));
      expect(v.summary).to.deep.eq({tone: 'tie-lead'});
      expect(v.rows.filter((r) => r.projectedVp === 5)).to.have.length(2);
    });

    it('nobody has scored → no-race tone, no VP', () => {
      const v = buildMaInspect(
        item({kind: 'award', myColor: R, scores: [{color: R, score: 0}, {color: B, score: 0}]}),
        players(R, B));
      expect(v.summary).to.deep.eq({tone: 'no-race'});
      expect(v.rows.every((r) => r.projectedVp === undefined)).to.eq(true);
    });

    it('a funded award still shows the standings (only WHO wins matters)', () => {
      const v = buildMaInspect(
        item({kind: 'award', myColor: R, takenBy: {color: B, name: 'Bob'},
          scores: [{color: R, score: 3}, {color: B, score: 1}]}),
        players(R, B));
      expect(v.mode).to.eq('award-standings');
      expect(v.taken).to.eq(true);
      expect(v.owner).to.deep.eq({color: B, name: 'Bob'});
      expect(v.rows).to.have.length(2);
    });
  });

  describe('milestone race (unclaimed)', () => {
    it('ranks by progress, flags who can claim, no per-player VP', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: 3, myColor: B,
          scores: [{color: R, score: 3, claimable: true}, {color: B, score: 1}]}),
        players(R, B));
      expect(v.mode).to.eq('milestone-race');
      expect(v.rows.map((r) => r.color)).to.deep.eq([R, B]);
      expect(v.rows[0].canClaim).to.eq(true);
      expect(v.rows[0].barPct).to.eq(100);
      expect(v.rows[1].barPct).to.eq(Math.round((1 / 3) * 100));
      expect(v.rows.every((r) => r.projectedVp === undefined)).to.eq(true);
      // viewer BLUE is short of the threshold by 2.
      expect(v.summary).to.deep.eq({tone: 'progress', gap: 2});
    });

    it('viewer meets the threshold → can-claim tone', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: 3, myColor: R,
          scores: [{color: R, score: 4}, {color: B, score: 0}]}),
        players(R, B));
      expect(v.summary).to.deep.eq({tone: 'can-claim'});
      expect(v.rows.find((r) => r.color === R)?.canClaim).to.eq(true);
    });
  });

  describe('milestone condition (no numeric threshold — Merchant / Minimalist / Briber)', () => {
    it('renders a met / not-met list (no fake threshold), met players first', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: undefined, myColor: B,
          scores: [{color: R, score: 0, claimable: false}, {color: B, score: 1, claimable: true}]}),
        players(R, B));
      expect(v.mode).to.eq('milestone-condition');
      expect(v.threshold).to.eq(undefined);
      expect(v.rows).to.have.length(2);
      // The met player sorts to the top; canClaim is per-player.
      expect(v.rows[0].color).to.eq(B);
      expect(v.rows[0].canClaim).to.eq(true);
      expect(v.rows[1].canClaim).to.eq(false);
      // The viewer (BLUE) meets it.
      expect(v.summary).to.deep.eq({tone: 'condition-met'});
    });

    it('condition-unmet when the viewer does not meet it', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: undefined, myColor: R,
          scores: [{color: R, score: 0, claimable: false}, {color: B, score: 1, claimable: true}]}),
        players(R, B));
      expect(v.summary).to.deep.eq({tone: 'condition-unmet'});
    });

    it('ignores the raw score for ordering (Minimalist: a HIGH count is NOT met)', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: undefined, myColor: R,
          scores: [{color: R, score: 5, claimable: false}, {color: B, score: 1, claimable: true}]}),
        players(R, B));
      expect(v.mode).to.eq('milestone-condition');
      // BLUE meets it (1 ≤ 2) and outranks RED (5 cards) despite the lower score.
      expect(v.rows.map((r) => r.color)).to.deep.eq([B, R]);
    });
  });

  describe('milestone claimed (owned)', () => {
    it('no standings, owner surfaced, claimed-other tone for a rival owner', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: 3, myColor: R, takenBy: {color: B, name: 'Bob'},
          scores: [{color: R, score: 3}, {color: B, score: 3}]}),
        players(R, B));
      expect(v.mode).to.eq('milestone-claimed');
      expect(v.rows).to.have.length(0);
      expect(v.owner).to.deep.eq({color: B, name: 'Bob'});
      expect(v.summary).to.deep.eq({tone: 'claimed-other', name: 'Bob', color: B});
    });

    it('claimed-you tone when the viewer owns it', () => {
      const v = buildMaInspect(
        item({kind: 'milestone', threshold: 3, myColor: R, takenBy: {color: R, name: 'Me'},
          scores: [{color: R, score: 3}]}),
        players(R));
      expect(v.summary).to.deep.eq({tone: 'claimed-you'});
    });
  });

  it('competition ranking: ties share a rank, then it skips', () => {
    const v = buildMaInspect(
      item({kind: 'award', myColor: R, scores: [{color: R, score: 3}, {color: B, score: 3}, {color: G, score: 1}]}),
      players(R, B, G));
    expect(v.rows.map((r) => r.rank)).to.deep.eq([1, 1, 3]);
  });
});
