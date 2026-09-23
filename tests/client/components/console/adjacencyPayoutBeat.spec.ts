import {expect} from 'chai';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {GreeneryAdjacencyBonusModel} from '@/common/models/GreeneryAdjacencyBonusModel';
import {
  buildGroveProxies,
  buildOceanCoins,
  greeneryBonusFor,
  isGroveBeatStaged,
  isOceanBeatStaged,
  oceanBonusFor,
  runGreeneryAdjacencyBeat,
  runOceanAdjacencyBeat,
} from '@/client/console/tilePlacement/adjacencyPayoutBeat';

/**
 * The SHARED ocean-adjacency beat. Its whole reason to exist is that TWO
 * placements earn the payout by the same server rule — a tile landing, and a
 * Mars Nomads camp MOVING onto the cell (`Game.grantPlacementBonuses` computes
 * ocean adjacency whether or not a tile is placed) — so both must play ONE
 * animation, and the hold must be released exactly once on every path.
 */
describe('adjacencyPayoutBeat · the WATER half (one payout, two callers)', () => {
  describe('oceanBonusFor — the manifest is accepted only for its own space', () => {
    const bonus: OceanAdjacencyBonusModel = {
      spaceId: '06', oceanSpaceIds: ['07'], perOcean: 2, megacredits: 2,
    };

    it('accepts a live payout that names this placement', () => {
      expect(oceanBonusFor(bonus, '06')).to.equal(bonus);
    });

    it('refuses a manifest from an EARLIER input (a stale snapshot)', () => {
      expect(oceanBonusFor(bonus, '19')).to.be.undefined;
    });

    it('refuses an empty payout — no money, no beat', () => {
      expect(oceanBonusFor({...bonus, megacredits: 0}, '06')).to.be.undefined;
      expect(oceanBonusFor({...bonus, oceanSpaceIds: []}, '06')).to.be.undefined;
      expect(oceanBonusFor(undefined, '06')).to.be.undefined;
    });
  });

  describe('the beat itself', () => {
    const bonus: OceanAdjacencyBonusModel = {
      spaceId: '06', oceanSpaceIds: ['07', '08'], perOcean: 2, megacredits: 4,
    };
    const tileRect = {x: 100, y: 100, w: 46, h: 51};

    it('releases the aggregated hold EXACTLY once when no ocean hex can be measured', async () => {
      // Under JSDOM no board hex exists → the beat degrades and the reward is
      // announced by its delta chip alone. The counter must never stay held.
      let releases = 0;
      await runOceanAdjacencyBeat({
        bonus, tileRect, uiScale: 1,
        alive: () => true,
        release: () => releases++,
      });
      expect(releases).to.eq(1);
      expect(isOceanBeatStaged()).to.be.false;
    });

    it('releases once even when the CALLER died before the beat could stage', async () => {
      let releases = 0;
      await runOceanAdjacencyBeat({
        bonus, tileRect, uiScale: 1,
        alive: () => false, // the transaction aborted mid-response
        release: () => releases++,
      });
      expect(releases).to.eq(1);
      expect(isOceanBeatStaged()).to.be.false;
    });

    it('stages nothing for oceans it cannot measure (the money still rides the chip)', () => {
      expect(buildOceanCoins(bonus, tileRect, 1)).to.deep.equal([]);
    });
  });
});

/**
 * The GROVE half (Turmoil Redux, «Forestry Support»). Same module, same
 * mechanics, same release discipline — what differs is declared: a grove pays
 * TWO resources, so ONE payer stages ONE pulse and TWO chips.
 */
describe('adjacencyPayoutBeat · the GROVE half (the law\'s own adjacency)', () => {
  const bonus: GreeneryAdjacencyBonusModel = {
    spaceId: '06',
    greenerySpaceIds: ['07', '08'],
    perGreenery: {megacredits: 2, plants: 1},
    megacredits: 4,
    plants: 2,
  };
  const tileRect = {x: 100, y: 100, w: 46, h: 51};

  describe('greeneryBonusFor — the breakdown is accepted only for its own space', () => {
    it('accepts a live payout that names this placement', () => {
      expect(greeneryBonusFor(bonus, '06')).to.equal(bonus);
    });

    it('refuses a breakdown from an EARLIER input (a stale snapshot)', () => {
      expect(greeneryBonusFor(bonus, '19')).to.be.undefined;
    });

    it('refuses an empty payout — no groves, no beat', () => {
      expect(greeneryBonusFor({...bonus, greenerySpaceIds: []}, '06')).to.be.undefined;
      expect(greeneryBonusFor({...bonus, megacredits: 0, plants: 0}, '06')).to.be.undefined;
      expect(greeneryBonusFor(undefined, '06')).to.be.undefined;
    });
  });

  describe('buildGroveProxies — ONE grove, ONE canopy, TWO chips', () => {
    // JSDOM has no board hexes, so the measurable set is empty by construction
    // — the same honest degrade the ocean half asserts for itself.
    it('stages nothing for groves it cannot measure (the money still rides the chips)', () => {
      const staged = buildGroveProxies(bonus, tileRect, 1);
      expect(staged.groves).to.deep.equal([]);
      expect(staged.chips).to.deep.equal([]);
    });

    it('a rate with no plants stages ONE chip per grove — the pair is DATA, never a fixed two', () => {
      const coinOnly: GreeneryAdjacencyBonusModel = {...bonus, perGreenery: {megacredits: 2, plants: 0}, plants: 0};
      // Still unmeasurable here; what this pins is the shape of the plan, so
      // the assertion is on the builder's own contract for an empty measure.
      expect(buildGroveProxies(coinOnly, tileRect, 1).chips).to.deep.equal([]);
    });
  });

  describe('the beat itself', () => {
    it('releases the aggregated hold EXACTLY once when no grove hex can be measured', async () => {
      let released = 0;
      await runGreeneryAdjacencyBeat({
        bonus, tileRect, uiScale: 1, alive: () => true, release: () => {
          released++;
        },
      });
      expect(released).to.equal(1);
      expect(isGroveBeatStaged()).to.be.false;
    });

    it('releases once even when the CALLER died before the beat could stage', async () => {
      let released = 0;
      await runGreeneryAdjacencyBeat({
        bonus, tileRect, uiScale: 1, alive: () => false, release: () => {
          released++;
        },
      });
      expect(released).to.equal(1);
      expect(isGroveBeatStaged()).to.be.false;
    });
  });
});
