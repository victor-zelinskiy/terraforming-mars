import {expect} from 'chai';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {
  buildOceanCoins,
  isOceanBeatStaged,
  oceanBonusFor,
  runOceanAdjacencyBeat,
} from '@/client/console/tilePlacement/oceanAdjacencyBeat';

/**
 * The SHARED ocean-adjacency beat. Its whole reason to exist is that TWO
 * placements earn the payout by the same server rule — a tile landing, and a
 * Mars Nomads camp MOVING onto the cell (`Game.grantPlacementBonuses` computes
 * ocean adjacency whether or not a tile is placed) — so both must play ONE
 * animation, and the hold must be released exactly once on every path.
 */
describe('oceanAdjacencyBeat (one water payout, two callers)', () => {
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
