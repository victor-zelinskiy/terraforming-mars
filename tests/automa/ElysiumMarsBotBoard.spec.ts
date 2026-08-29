import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {
  BonusCardId,
  MARSBOT_MAX_TRACK_POSITION,
  MarsBotTrackRole,
  TrackAction,
} from '../../src/common/automa/AutomaTypes';
import {ELYSIUM_MARSBOT_BOARD, ELYSIUM_TRACK} from '../../src/server/automa/boards/ElysiumMarsBot';
import {HELLAS_MARSBOT_BOARD} from '../../src/server/automa/boards/HellasMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';

/**
 * THE ELYSIUM BOARD IS DATA — this spec is its photograph.
 *
 * Every one of the 7 × 19 cells is pinned individually, so a refactor that
 * moves ONE icon fails with that cell's coordinates instead of a length check
 * that still passes. Transcribed from the official Elysium MarsBot board
 * component («compatible with rules v1.16+»), verified cell-for-cell against
 * the retail component (2026-08-29).
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

/** The printed power-tag icon: «advance the track that tag belongs to». */
const POWER: TrackAction = `tag_${ELYSIUM_TRACK.POWER}`;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const ELYSIUM: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2         3  4       5  6              7            8           9        10      11 12       13      14          15      16             17 18
    cells: [_, _, 'ocean', _, POWER, _, 'temperature', 'milestone', 'greenery', 'award', 'city', _, 'ocean', POWER, 'greenery', 'city', 'temperature', _, 'tr5'],
  },
  {
    role: 'space', tags: [Tag.SPACE], productions: [Resource.TITANIUM],
    cells: [_, 'advance', _, 'temperature', _, 'ocean', 'city', 'venus', 'milestone', 'temperature', _, 'tr4', 'ocean', _, 'temperature', _, 'tr5', _, 'tr6'],
  },
  {
    role: 'event', tags: [Tag.EVENT], productions: [Resource.MEGACREDITS],
    cells: [_, 'advance', _, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', _, 'tr5', 'temperature', 'greenery', 'advance', 'temperature2', _, 'tr5'],
  },
  {
    role: 'science', tags: [Tag.JOVIAN, Tag.SCIENCE], productions: [],
    cells: [_, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', POWER, 'tr3', 'milestone', 'temperature', 'ocean', 'tr4', 'temperature', 'tr5', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER], productions: [Resource.ENERGY],
    cells: [_, 'advance', _, 'tr3', _, 'temperature', 'advance', 'milestone', _, 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.CITY, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', _, _, _, 'city', _, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', 'advance', _, 'ocean', 'award', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

describe('ELYSIUM MarsBot board — the transcribed component, cell by cell', () => {
  it('has the 7 printed tracks, in printed order', () => {
    expect(ELYSIUM_MARSBOT_BOARD).has.length(7);
    expect(ELYSIUM_MARSBOT_BOARD.map((t) => t.role)).deep.eq(ELYSIUM.map((r) => r.role));
  });

  it('the ELYSIUM_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(ELYSIUM_TRACK)) {
      const role = ELYSIUM_MARSBOT_BOARD[index].role;
      expect(role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  ELYSIUM.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => ELYSIUM_MARSBOT_BOARD[index];

      it('pairs the printed tags', () => {
        expect(track().tags).deep.eq(row.tags);
      });

      it('carries the printed production badge', () => {
        expect(track().productions).deep.eq(row.productions);
      });

      it('runs 0–18', () => {
        expect(track().layout).has.length(MARSBOT_MAX_TRACK_POSITION + 1);
        expect(track().maxPosition, 'the map tracks use the default 18').is.undefined;
      });

      // ONE assertion per cell: a moved icon names its own position.
      row.cells.forEach((action, position) => {
        it(`space ${position} is ${action ?? 'empty'}`, () => {
          expect(track().layout[position]).eq(action);
        });
      });
    });
  });
});

describe('ELYSIUM vs HELLAS — only the printed differences', () => {
  it('shares the Jovian/Science pairing and leaves Power alone (Adding Expansions p.8)', () => {
    const board = new MarsBotBoard(ELYSIUM_MARSBOT_BOARD);
    const science = board.trackIndexOfRoleOrThrow('science');
    expect(board.getTrackIndexForTag(Tag.JOVIAN), 'Jovian rides the science track').eq(science);
    expect(board.getTrackIndexForTag(Tag.SCIENCE), 'so does Science').eq(science);
    expect(board.getTrackIndexForTag(Tag.POWER), 'Power stands alone')
      .eq(board.trackIndexOfRoleOrThrow('power'));

    const tharsis = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    expect(tharsis.getTrackIndexForTag(Tag.JOVIAN), 'Tharsis is untouched: Jovian rides Power')
      .eq(tharsis.trackIndexOfRoleOrThrow('power'));
  });

  it('leaves every production badge where it was — the tag pairing is not a regression move', () => {
    const elysium = new MarsBotBoard(ELYSIUM_MARSBOT_BOARD);
    const tharsis = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    for (const resource of [Resource.STEEL, Resource.TITANIUM, Resource.MEGACREDITS,
      Resource.ENERGY, Resource.HEAT, Resource.PLANTS] as const) {
      const elysiumRole = elysium.tracks[elysium.getTrackIndexForProduction(resource) ?? -1]?.definition.role;
      const tharsisRole = tharsis.tracks[tharsis.getTrackIndexForProduction(resource) ?? -1]?.definition.role;
      expect(elysiumRole, `${resource} regresses the same ROLE on both boards`).eq(tharsisRole);
    }
    expect(elysium.getTrackIndexForProduction(Resource.ENERGY),
      'ENERGY production still regresses the POWER track, not the Jovian/Science one')
      .eq(elysium.trackIndexOfRoleOrThrow('power'));
  });

  it('differs from Hellas in exactly the transcribed cells', () => {
    const diffs: Array<string> = [];
    ELYSIUM_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = HELLAS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:4 empty→tag_4',
      'building:5 tr2→empty',
      'building:13 empty→tag_4',
      'space:11 tr3→tr4',
      'space:16 tr4→tr5',
      'event:12 tr4→tr5',
      'science:7 empty→tag_4',
      'science:8 tr2→tr3',
      'science:12 tr3→tr4',
      'science:14 tr4→tr5',
      'power:2 advance→empty',
      'earth:4 tr3→empty',
      'bio:12 tr3→tr4',
    ]);
  });

  it('prints exactly three cross-track tag icons, all of them the POWER tag', () => {
    // The board's only `tag_N` cells. A transcription that pointed one of them
    // at another row would still «be a tag icon» — this pins the target.
    const tagCells: Array<string> = [];
    ELYSIUM_MARSBOT_BOARD.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action?.startsWith('tag_') === true) {
          tagCells.push(`${track.role}:${position}=${action}`);
          expect(Number(action.substring(4)), 'points at the power row').eq(ELYSIUM_TRACK.POWER);
        }
      });
    });
    expect(tagCells).deep.eq(['building:4=tag_4', 'building:13=tag_4', 'science:7=tag_4']);
  });
});

describe('the ELYSIUM map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.ELYSIUM);

  it('plays with B10, the Elysium Corporate Competition (Setup Guide v1.3 step 18)', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(marsBotMapProfile(BoardName.HELLAS).corporateCompetition,
      'Hellas keeps B09').eq(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(marsBotMapProfile(BoardName.THARSIS).corporateCompetition,
      'Tharsis keeps B08').eq(BonusCardId.B08_CORPORATE_COMPETITION);
  });

  it('puts the Southern Region AFTER the reward icons — the mirror of Hellas (Adding Expansions p.10)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id))
      .deep.eq(['oceans', 'reward-icons', 'southern-region']);
    expect(marsBotMapProfile(BoardName.HELLAS).placementTiebreakers.map((t) => t.id),
      'Hellas prints its region step BEFORE the icons')
      .deep.eq(['oceans', 'polar-region', 'reward-icons']);
  });

  it('carries no Hellas leakage — no polar step, and its board is its own', () => {
    expect(profile().placementTiebreakers.some((t) => t.id === 'polar-region')).is.false;
    expect(profile().tracks).eq(ELYSIUM_MARSBOT_BOARD);
  });
});
