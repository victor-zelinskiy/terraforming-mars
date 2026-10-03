import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armColonyRosterChange, clearColonyRoster, colonyRosterDraft, colonyRosterPending, colonyRosterState, detectColonyRosterChange,
  disarmColonyRoster, isColonyRosterInputLocked, presentedColonyRoster, registerColonyRosterHost, resetColonyRoster,
  runColonyRosterCeremony, seedColonyRosterHolds,
} from '@/client/console/colonyRoster/consoleColonyRoster';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';

const {CERES, EUROPA, LUNA, IO} = ColonyName;

function tile(name: ColonyName): ColonyModel {
  return {name, colonies: [], isActive: true, trackPosition: 1, visitor: undefined};
}

function view(...names: Array<ColonyName>): PlayerViewModel {
  return {game: {colonies: names.map(tile)}} as unknown as PlayerViewModel;
}

const BEFORE = view(CERES, EUROPA, LUNA);
const REPLACED = view(IO, EUROPA, LUNA);

/**
 * THE COLONY ROSTER CEREMONY — the controller (docs/COLONY_ROSTER_CEREMONY.md).
 * Two tempos, one owner each: the player's own change is an ARMED transport
 * gate; somebody else's is SEEDED from the views' diff, only while the colony
 * grid stands. (jsdom has no stage and no grid: a ceremony that cannot be
 * measured CONFESSES and lands in its final pose — which is what is pinned.)
 */
describe('consoleColonyRoster — the roster ceremony\'s controller', () => {
  afterEach(() => {
    resetColonyRoster();
  });

  describe('the player\'s own flow — the armed gate', () => {
    it('the arm is consumed only by an answer that carries THAT change', () => {
      armColonyRosterChange({kind: 'replace', removed: CERES, added: IO, builds: true});
      expect(colonyRosterPending()).is.true;
      // A parked tail / a re-ask: the table did not change.
      expect(detectColonyRosterChange(BEFORE, BEFORE)).is.undefined;
      expect(colonyRosterState.armed, 'the arm stands for the answer that will carry it').is.not.undefined;
      // Another change than the armed one is not ours.
      expect(detectColonyRosterChange(BEFORE, view(CERES, IO, LUNA))).is.undefined;
      expect(detectColonyRosterChange(BEFORE, REPLACED)).deep.eq({kind: 'replace', removed: CERES, added: IO, slot: 0});
      expect(colonyRosterState.armed, 'consumed exactly once').is.undefined;
      expect(detectColonyRosterChange(BEFORE, REPLACED)).is.undefined;
    });

    it('nothing armed — nothing detected (every other answer passes straight through)', () => {
      expect(detectColonyRosterChange(BEFORE, REPLACED)).is.undefined;
    });

    it('the ceremony holds the foreground and the pad, names its receipt, and resolves — a stage that cannot be measured is CONFESSED', async () => {
      const change = {kind: 'replace', removed: CERES, added: IO, slot: 0} as const;
      const run = runColonyRosterCeremony(change, true);
      expect(colonyRosterState.live).is.true;
      expect(isColonyRosterInputLocked()).is.true;
      expect(isAnimationHoldActive(), 'the named hold stands').is.true;
      expect(colonyRosterState.receipt).deep.eq({removed: CERES, added: IO, built: true});
      await run;
      expect(colonyRosterState.live).is.false;
      expect(isColonyRosterInputLocked()).is.false;
      expect(colonyRosterState.degraded, 'no stage in this DOM — said so, never silent').eq('replace: no stage');
      // …and in its final pose: the seat gone, the hero docked.
      expect(colonyRosterState.seatGone).is.true;
      expect(colonyRosterState.docked).is.true;
    });

    it('the apply block that follows the gate does NOT seed the same change for the grid', async () => {
      registerColonyRosterHost(() => true);
      await runColonyRosterCeremony({kind: 'replace', removed: CERES, added: IO, slot: 0}, false);
      seedColonyRosterHolds(BEFORE, REPLACED);
      expect(colonyRosterState.held).is.undefined;
      expect(colonyRosterState.live).is.false;
    });

    it('a refused submit drops the arm and keeps the draft; the end of the flow drops both', () => {
      colonyRosterDraft.outgoing = CERES;
      armColonyRosterChange({kind: 'replace', removed: CERES, added: IO, builds: false});
      disarmColonyRoster();
      expect(colonyRosterState.armed).is.undefined;
      expect(colonyRosterDraft.outgoing, 'the player is still choosing').eq(CERES);
      clearColonyRoster();
      expect(colonyRosterDraft.outgoing).is.undefined;
      expect(colonyRosterState.receipt).is.undefined;
    });
  });

  describe('a watcher — seeded from the views\' diff', () => {
    it('with NO grid on screen nothing is seeded: the table is simply new', () => {
      registerColonyRosterHost(() => false);
      seedColonyRosterHolds(BEFORE, REPLACED);
      expect(colonyRosterState.held).is.undefined;
      expect(colonyRosterState.live).is.false;
      expect(presentedColonyRoster(REPLACED.game.colonies).map((c) => c.name)).deep.eq([IO, EUROPA, LUNA]);
    });

    it('with the grid standing the presented table stays the OLD one and the ceremony is owed', () => {
      registerColonyRosterHost(() => true);
      seedColonyRosterHolds(BEFORE, REPLACED);
      expect(colonyRosterState.live).is.true;
      expect(colonyRosterState.scale).eq('tile');
      expect(colonyRosterState.change).deep.eq({kind: 'replace', removed: CERES, added: IO, slot: 0});
      expect(presentedColonyRoster(REPLACED.game.colonies).map((c) => c.name), 'the ONE reader of the grid\'s table').deep.eq([CERES, EUROPA, LUNA]);
      expect(isColonyRosterInputLocked()).is.true;
    });

    it('a view that changed nothing about the table seeds nothing', () => {
      registerColonyRosterHost(() => true);
      seedColonyRosterHolds(BEFORE, BEFORE);
      expect(colonyRosterState.live).is.false;
      seedColonyRosterHolds(undefined, REPLACED);
      expect(colonyRosterState.live).is.false;
    });

    it('while the player\'s own change is armed or playing, a view is never seeded as a watcher\'s', () => {
      registerColonyRosterHost(() => true);
      armColonyRosterChange({kind: 'replace', removed: CERES, added: IO, builds: false});
      seedColonyRosterHolds(BEFORE, REPLACED);
      expect(colonyRosterState.held).is.undefined;
    });

    it('an abort releases the held table at once', () => {
      registerColonyRosterHost(() => true);
      seedColonyRosterHolds(BEFORE, REPLACED);
      clearColonyRoster();
      expect(colonyRosterState.held).is.undefined;
      expect(colonyRosterState.live).is.false;
      expect(presentedColonyRoster(REPLACED.game.colonies).map((c) => c.name)).deep.eq([IO, EUROPA, LUNA]);
    });
  });
});
