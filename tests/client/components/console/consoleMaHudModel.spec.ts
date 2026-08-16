import {expect} from 'chai';
import {buildMaHudZone} from '@/client/console/consoleMaHudModel';
import {ConsoleMaSource} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/**
 * P30: the right STRATEGY RAIL's Milestones/Awards projection — the pure
 * model behind the icon-first HUD. The whole state matrix is pinned here:
 * open / server-ready / offered-now / taken, leader vs second vs sponsor,
 * every tie shape, the completed (3/3) recomposition facts, and the price
 * pass-through (the server's own maCosts number, never a re-derivation).
 */
describe('consoleMaHudModel (P30)', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';
  const third: Color = 'green';

  const source = (over: Partial<ConsoleMaSource>): ConsoleMaSource => ({
    name: 'Mayor',
    playerName: undefined,
    color: undefined,
    scores: [],
    ...over,
  });

  const opts = (over: Partial<{myColor: Color, availableNow: ReadonlySet<string>, maxSlots: number, cost: number}> = {}) => ({
    myColor: me,
    availableNow: new Set<string>(),
    maxSlots: 3,
    cost: 8,
    ...over,
  });

  describe('milestones', () => {
    it('keeps SERVER order (stable positions for a HUD of medals)', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Mayor', scores: [{color: me, score: 1}]}),
        source({name: 'Terraformer', playerName: 'Vika', color: rival, scores: []}),
        source({name: 'Gardener', scores: [{color: me, score: 0}]}),
      ], opts());
      expect(zone.items.map((it) => it.name)).to.deep.eq(['Mayor', 'Terraformer', 'Gardener']);
    });

    it('exposes MY progress with the printed threshold while open', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Mayor', threshold: 3, scores: [{color: me, score: 2}, {color: rival, score: 3}]}),
      ], opts());
      expect(zone.items[0].my).to.deep.eq({score: 2, threshold: 3, ready: false, conditional: false});
    });

    it('ready is SERVER-authoritative (claimable beats the raw threshold)', () => {
      const served = buildMaHudZone('milestones', [
        source({name: 'Terraformer', threshold: 26, scores: [{color: me, score: 20, claimable: true}]}),
      ], opts());
      expect(served.items[0].my?.ready).to.eq(true);
      // The printed threshold is only the degrade fallback for an old model.
      const degraded = buildMaHudZone('milestones', [
        source({name: 'Mayor', threshold: 3, scores: [{color: me, score: 3}]}),
      ], opts());
      expect(degraded.items[0].my?.ready).to.eq(true);
    });

    it('a condition milestone (no numeric threshold) is marked conditional', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Hoverlord', scores: [{color: me, score: 0, claimable: true}]}),
      ], opts());
      expect(zone.items[0].my).to.deep.eq({score: 0, threshold: undefined, ready: true, conditional: true});
    });

    it('no scores from the server → no my-block at all (nothing honest to print)', () => {
      const zone = buildMaHudZone('milestones', [source({name: 'Mayor', scores: []})], opts());
      expect(zone.items[0].my).to.eq(undefined);
    });

    it('a taken milestone carries its owner and drops the progress', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Mayor', playerName: 'Vika', color: rival, scores: [{color: me, score: 2}]}),
      ], opts());
      expect(zone.items[0].taken).to.deep.eq({color: rival});
      expect(zone.items[0].my).to.eq(undefined);
    });

    it('ready-but-not-offered stays distinct from offered-now', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Mayor', threshold: 3, scores: [{color: me, score: 3, claimable: true}]}),
        source({name: 'Builder', threshold: 8, scores: [{color: me, score: 8, claimable: true}]}),
      ], opts({availableNow: new Set(['Builder'])}));
      expect(zone.items[0].my?.ready).to.eq(true);
      expect(zone.items[0].availableNow).to.eq(false); // met, blocked by the turn — never an error state
      expect(zone.items[1].availableNow).to.eq(true);
      expect(zone.actionable).to.eq(1);
    });
  });

  describe('awards', () => {
    it('leader group includes every co-leader; second is the next non-zero tier', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 4}, {color: rival, score: 4}, {color: third, score: 2}]}),
      ], opts());
      expect(zone.items[0].leader).to.deep.eq({colors: [me, rival], score: 4});
      expect(zone.items[0].second).to.deep.eq({colors: [third], score: 2});
      // A tie for FIRST awards no 2nd place at all (giveAwards): the chaser
      // group stays visible but must never wear the silver rank.
      expect(zone.items[0].secondRanked).to.eq(false);
    });

    it('a tie for SECOND keeps every chaser in one group', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 7}, {color: rival, score: 3}, {color: third, score: 3}]}),
      ], opts());
      expect(zone.items[0].second).to.deep.eq({colors: [rival, third], score: 3});
      // Single leader + 3 players → the 2nd-place VP is real.
      expect(zone.items[0].secondRanked).to.eq(true);
    });

    it('a DUEL has no ranked second place (only 1st scores in a 2-player game)', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 7}, {color: rival, score: 3}]}),
      ], opts());
      expect(zone.items[0].second).to.deep.eq({colors: [rival], score: 3});
      expect(zone.items[0].secondRanked).to.eq(false);
    });

    it('a single non-zero participant leads with no second place', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 1004}, {color: rival, score: 0}]}),
      ], opts());
      expect(zone.items[0].leader).to.deep.eq({colors: [me], score: 1004});
      expect(zone.items[0].second).to.eq(undefined);
    });

    it('all zeros → no meaningful leader at all', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 0}, {color: rival, score: 0}]}),
      ], opts());
      expect(zone.items[0].leader).to.eq(undefined);
      expect(zone.items[0].second).to.eq(undefined);
    });

    it('funding KEEPS the live race (funder is not necessarily the scorer)', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', playerName: 'Vika', color: rival,
          scores: [{color: me, score: 5}, {color: rival, score: 2}]}),
      ], opts());
      expect(zone.items[0].taken).to.deep.eq({color: rival});
      expect(zone.items[0].leader).to.deep.eq({colors: [me], score: 5});
      expect(zone.items[0].second).to.deep.eq({colors: [rival], score: 2});
    });
  });

  describe('the zone system line', () => {
    it('slot tray fills with taker colours in item order, padded to maxSlots', () => {
      const zone = buildMaHudZone('milestones', [
        source({name: 'Mayor', playerName: 'A', color: rival}),
        source({name: 'Gardener'}),
        source({name: 'Builder', playerName: 'B', color: me}),
      ], opts());
      expect(zone.slots).to.deep.eq([rival, me, undefined]);
      expect(zone.takenCount).to.eq(2);
      expect(zone.slotsLeft).to.eq(1);
      expect(zone.completed).to.eq(false);
    });

    it('completed at maxSlots — the recomposition fact, not a longer list', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker', playerName: 'A', color: me}),
        source({name: 'Thermalist', playerName: 'B', color: rival}),
        source({name: 'Scientist', playerName: 'C', color: third}),
        source({name: 'Miner'}),
      ], opts());
      expect(zone.completed).to.eq(true);
      expect(zone.slotsLeft).to.eq(0);
      expect(zone.slots).to.deep.eq([me, rival, third]);
      // The open item is still IN the projection (the completed pose filters
      // in the component — an undo must be able to bring it back).
      expect(zone.items).to.have.length(4);
    });

    it('passes the server price through untouched (maCosts, never re-derived)', () => {
      expect(buildMaHudZone('awards', [], opts({cost: 14})).cost).to.eq(14);
      expect(buildMaHudZone('milestones', [], opts({cost: 0})).cost).to.eq(0);
    });

    it('actionable counts only OPEN entries offered right now', () => {
      const zone = buildMaHudZone('awards', [
        source({name: 'Banker'}),
        source({name: 'Thermalist', playerName: 'Vika', color: rival}),
      ], opts({availableNow: new Set(['Banker', 'Thermalist'])}));
      expect(zone.actionable).to.eq(1);
    });
  });
});
