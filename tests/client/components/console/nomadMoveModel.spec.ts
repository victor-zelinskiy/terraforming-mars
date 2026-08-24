import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {TileType} from '@/common/TileType';
import {
  NOMAD_ANCHOR_FX, NOMAD_ANCHOR_FY, NOMAD_SIZE_F,
  applyNomadMovePreview,
  detectNomadMoveDiff,
  nomadAnchorOf,
  nomadDstShadowAt,
  nomadFlightPlan,
  nomadFlightPoint,
  nomadMoveBonuses,
  nomadScaleAt,
  nomadSizeOf,
  nomadSrcShadowAt,
  nomadTiltAt,
  verifyNomadMove,
} from '@/client/console/nomads/nomadMoveModel';

function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

describe('nomadMoveModel', () => {
  describe('detectNomadMoveDiff (the from→to pair is what a MOVE looks like from any seat)', () => {
    it('one departure + one arrival = the move', () => {
      const diff = detectNomadMoveDiff(
        [space('05', {nomads: true}), space('06')],
        [space('05'), space('06', {nomads: true})]);
      expect(diff).to.deep.equal({fromId: '05', toId: '06'});
    });

    it('a FIRST placement (bare appearance) is NOT a move — Flow A owns it', () => {
      expect(detectNomadMoveDiff(
        [space('05'), space('06')],
        [space('05'), space('06', {nomads: true})])).to.be.undefined;
    });

    it('a bare disappearance (board reset) is not a move either', () => {
      expect(detectNomadMoveDiff(
        [space('05', {nomads: true})],
        [space('05')])).to.be.undefined;
    });

    it('an unchanged board diffs to nothing', () => {
      expect(detectNomadMoveDiff(
        [space('05', {nomads: true})],
        [space('05', {nomads: true})])).to.be.undefined;
    });

    it('misaligned ids are skipped defensively', () => {
      expect(detectNomadMoveDiff(
        [space('05', {nomads: true})],
        [space('06', {nomads: true})])).to.be.undefined;
    });

    it('the UNDO of a move reads as the reverse move (the camp walks back)', () => {
      const diff = detectNomadMoveDiff(
        [space('06', {nomads: true}), space('05')],
        [space('06'), space('05', {nomads: true})]);
      expect(diff).to.deep.equal({fromId: '06', toId: '05'});
    });
  });

  describe('verifyNomadMove (the armed transaction\'s server proof)', () => {
    const prev = [space('05', {nomads: true}), space('06')];
    const next = [space('05'), space('06', {nomads: true})];

    it('accepts exactly the armed destination', () => {
      expect(verifyNomadMove(prev, next, '06')).to.deep.equal({fromId: '05', toId: '06'});
    });

    it('refuses a different destination (the server did something else)', () => {
      expect(verifyNomadMove(prev, next, '07')).to.be.undefined;
    });

    it('refuses a response with no move at all', () => {
      expect(verifyNomadMove(prev, prev, '06')).to.be.undefined;
    });
  });

  describe('nomadMoveBonuses (what the move physically collects)', () => {
    it('stock icons only — one transfer per printed icon', () => {
      const bonuses = nomadMoveBonuses(space('06', {bonus: [SpaceBonus.STEEL, SpaceBonus.PLANT]}));
      expect(bonuses.map((b) => b.spec)).to.deep.equal([
        {channel: 'stock', resource: 'steel', amount: 1},
        {channel: 'stock', resource: 'plants', amount: 1},
      ]);
    });

    it('a DRAW_CARD bonus keeps its OWN cinematic — never a stock chip', () => {
      const bonuses = nomadMoveBonuses(space('06', {bonus: [SpaceBonus.DRAW_CARD, SpaceBonus.TITANIUM]}));
      expect(bonuses).to.have.length(1);
      expect(bonuses[0].spec.resource).to.eq('titanium');
    });

    it('a HAZARD destination grants NOTHING (the published ruling)', () => {
      expect(nomadMoveBonuses(space('06', {
        bonus: [SpaceBonus.STEEL], tileType: TileType.EROSION_MILD,
      }))).to.deep.equal([]);
    });

    it('no destination → nothing (defensive)', () => {
      expect(nomadMoveBonuses(undefined)).to.deep.equal([]);
    });
  });

  describe('applyNomadMovePreview (the targeted silent flip)', () => {
    it('flips BOTH flags on the displayed view in one turn', () => {
      const displayed = [space('05', {nomads: true}), space('06')];
      const incoming = [space('05'), space('06', {nomads: true})];
      applyNomadMovePreview(displayed, incoming, {fromId: '05', toId: '06'});
      expect(displayed[0].nomads).to.be.undefined;
      expect(displayed[1].nomads).to.be.true;
    });
  });

  describe('the hop geometry (one physical object on one curve)', () => {
    it('the flight starts at the lifted departure and ends exactly at the arrival', () => {
      const plan = nomadFlightPlan({x: 100, y: 100}, {x: 180, y: 100});
      const p0 = nomadFlightPoint(plan, 0);
      const p1 = nomadFlightPoint(plan, 1);
      expect(p0).to.deep.equal({x: 100, y: 100});
      expect(p1).to.deep.equal({x: 180, y: 100});
    });

    it('the arc rises ABOVE both endpoints (a hop, not a slide)', () => {
      const plan = nomadFlightPlan({x: 100, y: 100}, {x: 180, y: 100});
      const apex = nomadFlightPoint(plan, 0.5);
      expect(apex.y).to.be.lessThan(100);
    });

    it('scale: exactly 1 at touchdown, crests mid-flight', () => {
      expect(nomadScaleAt(1)).to.eq(1);
      expect(nomadScaleAt(0.42)).to.be.greaterThan(nomadScaleAt(0));
      expect(nomadScaleAt(0.42)).to.be.greaterThan(1);
    });

    it('tilt leans INTO the travel direction and is fully upright before landing', () => {
      expect(nomadTiltAt(0.3, 1)).to.be.greaterThan(0);
      expect(nomadTiltAt(0.3, -1)).to.be.lessThan(0);
      expect(nomadTiltAt(0.8, 1)).to.eq(0);
      expect(nomadTiltAt(1, 1)).to.eq(0);
      expect(nomadTiltAt(0.3, 0)).to.eq(0); // a vertical hop never rolls
    });

    it('the SOURCE shadow stays down and lets go; the DESTINATION shadow converges to contact', () => {
      expect(nomadSrcShadowAt(0).alpha).to.be.greaterThan(nomadSrcShadowAt(1).alpha);
      expect(nomadSrcShadowAt(1).alpha).to.eq(0);
      expect(nomadDstShadowAt(0).alpha).to.eq(0);
      expect(nomadDstShadowAt(1).alpha).to.be.greaterThan(0.5);
      expect(nomadDstShadowAt(1).scale).to.eq(1);
    });
  });

  describe('the token anchor (derived from the board geometry, zoom-free)', () => {
    it('anchor + size resolve from hex fractions (the .board-nomad numbers)', () => {
      const hex = {x: 0, y: 0, w: 46, h: 51};
      const anchor = nomadAnchorOf(hex);
      // The resting token: 16px at margin (4.5, 15) inside the 46×51 hex.
      expect(anchor.x).to.be.closeTo(15 + 8, 0.01);
      expect(anchor.y).to.be.closeTo(4.5 + 8, 0.26);
      expect(nomadSizeOf(hex)).to.eq(16);
      // The fractions themselves are the contract with board.less.
      expect(NOMAD_ANCHOR_FX).to.eq(0.5);
      expect(NOMAD_ANCHOR_FY).to.be.closeTo(12.5 / 51, 0.001);
      expect(NOMAD_SIZE_F).to.be.closeTo(16 / 46, 0.001);
    });

    it('…and scale with the hex (board zoom / TV scale bake in for free)', () => {
      const hex = {x: 100, y: 200, w: 92, h: 102};
      const anchor = nomadAnchorOf(hex);
      expect(anchor.x).to.eq(100 + 46);
      expect(nomadSizeOf(hex)).to.eq(32);
    });
  });
});
