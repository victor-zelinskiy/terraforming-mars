import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {
  MARSBOT_MAX_TRACK_POSITION,
  MarsBotTrackRole,
  TrackAction,
} from '../../src/common/automa/AutomaTypes';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {HELLAS_MARSBOT_BOARD} from '../../src/server/automa/boards/HellasMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';

/**
 * THE HELLAS BOARD IS DATA — this spec is its photograph.
 *
 * Every one of the 7 × 19 cells is pinned individually, so a refactor that
 * moves ONE icon fails with that cell's coordinates instead of a length check
 * that still passes. Transcribed from the official Hellas MarsBot board
 * component (late PnP / low-ink sheet, «compatible with rules v1.16+»).
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const HELLAS: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //     0  1  2         3  4  5      6              7            8           9        10      11 12       13 14          15      16             17 18
    cells: [_, _, 'ocean', _, _, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', _, 'ocean', _, 'greenery', 'city', 'temperature', _, 'tr5'],
  },
  {
    role: 'space', tags: [Tag.SPACE], productions: [Resource.TITANIUM],
    cells: [_, 'advance', _, 'temperature', _, 'ocean', 'city', 'venus', 'milestone', 'temperature', _, 'tr3', 'ocean', _, 'temperature', _, 'tr4', _, 'tr6'],
  },
  {
    role: 'event', tags: [Tag.EVENT], productions: [Resource.MEGACREDITS],
    cells: [_, 'advance', _, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', _, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', _, 'tr5'],
  },
  {
    role: 'science', tags: [Tag.JOVIAN, Tag.SCIENCE], productions: [],
    cells: [_, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', _, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER], productions: [Resource.ENERGY],
    cells: [_, 'advance', 'advance', 'tr3', _, 'temperature', 'advance', 'milestone', _, 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.CITY, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', _, _, 'tr3', 'city', _, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', 'advance', _, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

describe('HELLAS MarsBot board — the transcribed component, cell by cell', () => {
  it('has the 7 printed tracks, in printed order', () => {
    expect(HELLAS_MARSBOT_BOARD).has.length(7);
    expect(HELLAS_MARSBOT_BOARD.map((t) => t.role)).deep.eq(HELLAS.map((r) => r.role));
  });

  HELLAS.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => HELLAS_MARSBOT_BOARD[index];

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

describe('HELLAS vs THARSIS — only the printed differences', () => {
  it('moves the Jovian tag onto the science track (Adding Expansions p.8)', () => {
    const board = new MarsBotBoard(HELLAS_MARSBOT_BOARD);
    const science = board.trackIndexOfRoleOrThrow('science');
    expect(board.getTrackIndexForTag(Tag.JOVIAN), 'Jovian rides the science track').eq(science);
    expect(board.getTrackIndexForTag(Tag.SCIENCE), 'so does Science').eq(science);
    expect(board.getTrackIndexForTag(Tag.POWER), 'Power stands alone')
      .eq(board.trackIndexOfRoleOrThrow('power'));

    const tharsis = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    expect(tharsis.getTrackIndexForTag(Tag.JOVIAN), 'Tharsis is untouched: Jovian rides Power')
      .eq(tharsis.trackIndexOfRoleOrThrow('power'));
  });

  it('leaves every production badge where it was — the tag move is not a regression move', () => {
    const hellas = new MarsBotBoard(HELLAS_MARSBOT_BOARD);
    const tharsis = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    for (const resource of [Resource.STEEL, Resource.TITANIUM, Resource.MEGACREDITS,
      Resource.ENERGY, Resource.HEAT, Resource.PLANTS] as const) {
      const hellasRole = hellas.tracks[hellas.getTrackIndexForProduction(resource) ?? -1]?.definition.role;
      const tharsisRole = tharsis.tracks[tharsis.getTrackIndexForProduction(resource) ?? -1]?.definition.role;
      expect(hellasRole, `${resource} regresses the same ROLE on both boards`).eq(tharsisRole);
    }
  });

  it('differs from Tharsis in exactly the transcribed cells', () => {
    const diffs: Array<string> = [];
    HELLAS_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = THARSIS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:11 tag_1→empty',
      'event:6 venus2→floater2',
      'science:2 empty→floater',
      'science:5 empty→floater2',
      'power:2 venus→advance',
      'power:4 venus2→empty',
    ]);
  });
});

describe('MarsBot map profiles', () => {
  it('covers every board the compatibility guard allows — and nothing else', () => {
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
  });

  it('gives each map its own Corporate Competition card (Setup Guide v1.3 step 18)', () => {
    expect(marsBotMapProfile(BoardName.THARSIS).corporateCompetition)
      .eq(BonusCardId.B08_CORPORATE_COMPETITION);
    expect(marsBotMapProfile(BoardName.HELLAS).corporateCompetition)
      .eq(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
  });

  it('gives Hellas the Polar Region step between oceans and reward icons (Adding Expansions p.10)', () => {
    expect(marsBotMapProfile(BoardName.HELLAS).placementTiebreakers.map((t) => t.id))
      .deep.eq(['oceans', 'polar-region', 'reward-icons']);
    expect(marsBotMapProfile(BoardName.THARSIS).placementTiebreakers.map((t) => t.id),
      'Tharsis prints no extra step').deep.eq(['oceans', 'reward-icons']);
  });

  it('declares exactly one track per role on every map', () => {
    for (const boardName of MARSBOT_BOARDS) {
      const roles = marsBotMapProfile(boardName).tracks.map((t) => t.role);
      expect(new Set(roles).size, `${boardName} has no duplicate roles`).eq(roles.length);
      expect([...roles].sort(), `${boardName} declares every base role`)
        .deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
    }
  });

  it('keeps the Venus board\'s cell-9 tag icon pointing at each map\'s BIO track', () => {
    // The Venus track is appended to whichever map board is in play, and its
    // cell 9 encodes a board-local INDEX. Every profile must therefore put the
    // bio track at that index — the guard for a future map that reorders rows.
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    for (const boardName of MARSBOT_BOARDS) {
      expect(marsBotMapProfile(boardName).tracks[VENUS_CELL9_TARGET_TRACK].role, boardName).eq('bio');
    }
  });
});
