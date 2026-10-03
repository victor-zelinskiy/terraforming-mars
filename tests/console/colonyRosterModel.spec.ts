import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardResource} from '../../src/common/CardResource';
import {ColonyRosterPrompt, colonyRosterChangeText} from '../../src/common/colonies/ColonyRoster';
import {
  ROSTER_ARRIVE_MS, ROSTER_DEPART_MS, ROSTER_REDUCED_MS, ROSTER_RESEAT_MS,
  reanchorColonyCursor, rosterBeats, rosterCeremonyMs, rosterDiff, rosterDraftStands, rosterIncomingOf, rosterLeavable,
  rosterLevel, rosterOutgoingOf, rosterStageReading,
} from '../../src/client/console/colonyRoster/colonyRosterModel';

const {CERES, EUROPA, LUNA, TITAN, IO, ENCELADUS} = ColonyName;

/** TR10's prompt: Ceres and Titan may leave; Io enters active with a colony, Enceladus inactive without one. */
const REPLACE: ColonyRosterPrompt = {
  kind: 'replace',
  outgoing: [
    {colony: CERES},
    {colony: EUROPA, reason: 'This colony tile has colonies on it'},
    {colony: LUNA, reason: 'A trade fleet stands on this colony tile'},
    {colony: TITAN},
  ],
  incoming: [
    {colony: ENCELADUS, entersActive: false, build: {skipped: 'Colony is inactive'}},
    {colony: IO, entersActive: true, build: {slot: 0}},
  ],
};
const ADD: ColonyRosterPrompt = {kind: 'add', incoming: [{colony: IO, entersActive: true}, {colony: TITAN, entersActive: false}]};
const REMOVE: ColonyRosterPrompt = {kind: 'remove', outgoing: [{colony: CERES}, {colony: LUNA}]};

describe('colonyRosterModel — the pure half of the colony roster', () => {
  describe('rosterLevel — which question the grid asks', () => {
    it('a removal asks who leaves, an addition who enters; no marker — no level', () => {
      expect(rosterLevel(REMOVE, undefined)).eq('outgoing');
      expect(rosterLevel(ADD, undefined)).eq('incoming');
      expect(rosterLevel(undefined, CERES)).is.undefined;
    });

    it('a replacement walks from «who leaves» to «who enters» once the leaving tile is chosen', () => {
      expect(rosterLevel(REPLACE, undefined)).eq('outgoing');
      expect(rosterLevel(REPLACE, CERES)).eq('incoming');
    });
  });

  describe('the server\'s lists, read', () => {
    it('the tiles that may leave are the ones with no reason, in the table\'s order', () => {
      expect(rosterLeavable(REPLACE)).deep.eq([CERES, TITAN]);
      expect(rosterLeavable(ADD)).deep.eq([]);
      expect(rosterOutgoingOf(REPLACE, EUROPA)?.reason).eq('This colony tile has colonies on it');
      expect(rosterIncomingOf(REPLACE, IO)).deep.eq({colony: IO, entersActive: true, build: {slot: 0}});
      expect(rosterIncomingOf(REPLACE, CERES)).is.undefined;
    });

    it('a draft stands only while the marker still lists its tile as able to leave', () => {
      expect(rosterDraftStands(REPLACE, CERES)).is.true;
      expect(rosterDraftStands(REPLACE, EUROPA), 'a tile the server would refuse').is.false;
      expect(rosterDraftStands(REPLACE, undefined)).is.false;
      expect(rosterDraftStands(ADD, CERES), 'an addition has nobody leaving').is.false;
      expect(rosterDraftStands(undefined, CERES)).is.false;
    });
  });

  describe('rosterDiff — one change between two tables', () => {
    it('a replacement keeps its slot', () => {
      expect(rosterDiff([CERES, EUROPA, LUNA], [IO, EUROPA, LUNA])).deep.eq({kind: 'replace', removed: CERES, added: IO, slot: 0});
      expect(rosterDiff([CERES, EUROPA, LUNA], [CERES, EUROPA, TITAN])).deep.eq({kind: 'replace', removed: LUNA, added: TITAN, slot: 2});
    });

    it('an addition names the slot the tile took (sorted in by the engine); a removal the slot it left', () => {
      expect(rosterDiff([CERES, LUNA], [CERES, IO, LUNA])).deep.eq({kind: 'add', added: IO, slot: 1});
      expect(rosterDiff([CERES, EUROPA, LUNA], [CERES, LUNA])).deep.eq({kind: 'remove', removed: EUROPA, slot: 1});
    });

    it('the same table, or more than one change, is nothing to play', () => {
      expect(rosterDiff([CERES, LUNA], [CERES, LUNA])).is.undefined;
      expect(rosterDiff([CERES, LUNA], [IO, TITAN])).is.undefined;
      expect(rosterDiff([CERES, LUNA], [CERES, IO, LUNA, TITAN])).is.undefined;
      // A tile gone and another come in a DIFFERENT slot is two changes, not a replacement.
      expect(rosterDiff([CERES, EUROPA, LUNA], [EUROPA, IO, LUNA])).is.undefined;
    });
  });

  describe('reanchorColonyCursor — the cursor is a NAME', () => {
    it('a tile seated BEFORE the focus does not move the focus off its colony', () => {
      // The focus stood on Luna (index 1); Io is sorted in before it.
      expect(reanchorColonyCursor([CERES, LUNA], [CERES, IO, LUNA], 1)).eq(2);
    });

    it('a tile seated after the focus, and an unchanged table, keep the index', () => {
      expect(reanchorColonyCursor([CERES, LUNA], [CERES, LUNA, TITAN], 0)).eq(0);
      expect(reanchorColonyCursor([CERES, LUNA], [CERES, LUNA], 1)).eq(1);
    });

    it('the focused tile was REPLACED — the focus goes to its successor by slot', () => {
      expect(reanchorColonyCursor([CERES, EUROPA, LUNA], [CERES, IO, LUNA], 1)).eq(1);
    });

    it('the focused tile was REMOVED — the tile that closed the gap, clamped at the end', () => {
      expect(reanchorColonyCursor([CERES, EUROPA, LUNA], [CERES, LUNA], 1)).eq(1);
      expect(reanchorColonyCursor([CERES, EUROPA, LUNA], [CERES, EUROPA], 2)).eq(1);
      expect(reanchorColonyCursor([CERES], [], 0)).eq(0);
    });

    it('the table changed wholesale (the catalog took the rail) — the index is clamped, never out of range', () => {
      expect(reanchorColonyCursor([CERES, EUROPA, LUNA, TITAN], [ENCELADUS, IO], 3)).eq(1);
    });
  });

  describe('rosterStageReading — three facts, each once', () => {
    const needs = (colony: ColonyName) => colony === ENCELADUS ? [CardResource.MICROBE] : [];

    it('a replacement that builds: who leaves, who arrives active, where the colony lands', () => {
      expect(rosterStageReading(REPLACE, CERES, IO, needs)).deep.eq({
        leaves: CERES,
        arrives: {colony: IO, entersActive: true, needs: []},
        build: {lands: true, slot: 0},
      });
    });

    it('a tile that enters inactive names what would wake it, and the colony is the ONE reason it is not built', () => {
      expect(rosterStageReading(REPLACE, TITAN, ENCELADUS, needs)).deep.eq({
        leaves: TITAN,
        arrives: {colony: ENCELADUS, entersActive: false, needs: [CardResource.MICROBE]},
        build: {lands: false, reason: 'Colony is inactive'},
      });
    });

    it('an addition has nobody leaving and builds nothing; a removal has nobody arriving', () => {
      expect(rosterStageReading(ADD, undefined, IO, needs)).deep.eq({arrives: {colony: IO, entersActive: true, needs: []}});
      expect(rosterStageReading(REMOVE, CERES, undefined, needs)).deep.eq({leaves: CERES});
      expect(rosterStageReading(undefined, CERES, IO, needs)).deep.eq({});
    });
  });

  describe('the ceremony\'s beats', () => {
    it('a replacement never reseats: the planet leaves, the planet arrives', () => {
      expect(rosterBeats({kind: 'replace', removed: CERES, added: IO, slot: 0})).deep.eq(['depart', 'arrive']);
    });

    it('a removal lets the planet go and then closes the ranks; an addition opens them first', () => {
      expect(rosterBeats({kind: 'remove', removed: CERES, slot: 0})).deep.eq(['depart', 'reseat']);
      expect(rosterBeats({kind: 'add', added: IO, slot: 1})).deep.eq(['reseat', 'arrive']);
    });

    it('reduced motion plays no beat — final poses and one short fade', () => {
      const change = {kind: 'replace', removed: CERES, added: IO, slot: 0} as const;
      expect(rosterBeats(change, {reduced: true})).deep.eq([]);
      expect(rosterCeremonyMs(change, {reduced: true})).eq(ROSTER_REDUCED_MS);
    });

    it('the ceremony\'s length is the sum of its beats', () => {
      expect(rosterCeremonyMs({kind: 'replace', removed: CERES, added: IO, slot: 0})).eq(ROSTER_DEPART_MS + ROSTER_ARRIVE_MS);
      expect(rosterCeremonyMs({kind: 'add', added: IO, slot: 1})).eq(ROSTER_RESEAT_MS + ROSTER_ARRIVE_MS);
    });
  });

  describe('colonyRosterChangeText — the change in words', () => {
    const name = (colony: ColonyName) => `«${colony}»`;

    it('the leaving tile first, then the arriving one', () => {
      expect(colonyRosterChangeText({kind: 'replace', removed: CERES, added: IO, slot: 0}, name)).eq('− «Ceres» · + «Io»');
      expect(colonyRosterChangeText({kind: 'add', added: IO, slot: 0}, name)).eq('+ «Io»');
      expect(colonyRosterChangeText({kind: 'remove', removed: CERES, slot: 0}, name)).eq('− «Ceres»');
    });
  });
});
