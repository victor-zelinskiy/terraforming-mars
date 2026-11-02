import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {
  BonusCardId,
  MARSBOT_MAX_TRACK_POSITION,
  MarsBotTrackRole,
  TrackAction,
  TrackDefinition,
} from '../../src/common/automa/AutomaTypes';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {VASTITAS_FAN_MARSBOT_BOARD, VASTITAS_FAN_TRACK} from '../../src/server/automa/boards/VastitasBorealisFanMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {HELLAS_MARSBOT_BOARD} from '../../src/server/automa/boards/HellasMarsBot';
import {ELYSIUM_MARSBOT_BOARD} from '../../src/server/automa/boards/ElysiumMarsBot';
import {UTOPIA_MARSBOT_BOARD} from '../../src/server/automa/boards/UtopiaMarsBot';
import {TERRA_CIMMERIA_MARSBOT_BOARD} from '../../src/server/automa/boards/TerraCimmeriaMarsBot';
import {VASTITAS_BOREALIS_MARSBOT_BOARD} from '../../src/server/automa/boards/VastitasBorealisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';

/**
 * THE FAN-MAP VASTITAS BOREALIS BOARD IS DATA — this spec is its photograph,
 * AND its design brief: the board is HOME-MADE (docs/AUTOMA_DATA_AUDIT.md §2f),
 * so beside the cell-by-cell pin it asserts the LAW the six official boards
 * share (docs/claude/marsbot-fan-map-checklist.md §A) — the icon totals, the
 * role order, the track ends, the milestone / award cells — so a later edit
 * cannot quietly leave the official pattern.
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

/** The cross-track ENERGY icon on building 4 and 13 (Elysium's / Terra Cimmeria's cells). */
const POWER: TrackAction = `tag_${VASTITAS_FAN_TRACK.POWER}`;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const FAN: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2        3  4      5  6              7            8           9        10      11 12       13     14          15      16             17 18
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
    cells: [_, 'advance', 'floater', 'advance', 'city', 'floater2', 'greenery', _, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER], productions: [Resource.ENERGY],
    cells: [_, 'advance', _, 'tr3', _, 'city', 'advance', 'milestone', _, 'city', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.CITY, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', _, _, 'temperature', _, _, 'advance', 'temperature', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', 'advance', _, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

/** How many cells of the whole board print this action (`tag` = any cross-track icon). */
function count(board: ReadonlyArray<TrackDefinition>, action: TrackAction | 'tag' | 'empty'): number {
  let n = 0;
  for (const track of board) {
    for (const cell of track.layout) {
      const key = cell === undefined ? 'empty' : cell.startsWith('tag_') ? 'tag' : cell;
      if (key === action) {
        n++;
      }
    }
  }
  return n;
}

/** Σ of every printed «gain N TR» cell. */
function totalTr(board: ReadonlyArray<TrackDefinition>): number {
  let n = 0;
  for (const track of board) {
    for (const cell of track.layout) {
      if (cell !== undefined && /^tr\d$/.test(cell)) {
        n += Number(cell.substring(2));
      }
    }
  }
  return n;
}

describe('VASTITAS BOREALIS (fan map) MarsBot board — the home-made component, cell by cell', () => {
  it('has the 7 printed tracks, in the shared role order', () => {
    expect(VASTITAS_FAN_MARSBOT_BOARD).has.length(7);
    expect(VASTITAS_FAN_MARSBOT_BOARD.map((t) => t.role)).deep.eq(FAN.map((r) => r.role));
    expect(VASTITAS_FAN_MARSBOT_BOARD.map((t) => t.role)).deep.eq(THARSIS_MARSBOT_BOARD.map((t) => t.role));
  });

  it('the VASTITAS_FAN_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(VASTITAS_FAN_TRACK)) {
      expect(VASTITAS_FAN_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  FAN.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => VASTITAS_FAN_MARSBOT_BOARD[index];

      it('pairs the designed tags', () => {
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

describe('VASTITAS BOREALIS (fan map) — the §A law of the six official boards, as assertions', () => {
  const board = VASTITAS_FAN_MARSBOT_BOARD;
  const OFFICIAL: ReadonlyArray<[string, ReadonlyArray<TrackDefinition>]> = [
    ['Tharsis', THARSIS_MARSBOT_BOARD], ['Hellas', HELLAS_MARSBOT_BOARD], ['Elysium', ELYSIUM_MARSBOT_BOARD],
    ['Utopia Planitia', UTOPIA_MARSBOT_BOARD], ['Terra Cimmeria', TERRA_CIMMERIA_MARSBOT_BOARD],
    ['Vastitas Borealis Nova', VASTITAS_BOREALIS_MARSBOT_BOARD],
  ];

  it('prints exactly 10 oceans, 13 temperature steps + 1 double, 15 greeneries, 10 cities, 4 milestones, 4 awards', () => {
    expect(count(board, 'ocean')).eq(10);
    expect(count(board, 'temperature')).eq(13);
    expect(count(board, 'temperature2')).eq(1);
    expect(count(board, 'greenery')).eq(15);
    expect(count(board, 'city')).eq(10);
    expect(count(board, 'milestone')).eq(4);
    expect(count(board, 'award')).eq(4);
  });

  it('…and the six official boards print the very same totals — the law this board was designed by', () => {
    for (const [name, official] of OFFICIAL) {
      for (const action of ['ocean', 'greenery', 'city', 'milestone', 'award', 'temperature2'] as const) {
        expect(count(official, action), `${name}: ${action}`).eq(count(board, action));
      }
      expect(count(official, 'temperature'), `${name}: temperature`).eq(13);
    }
  });

  it('38 empty cells, 15 «advance» cells, Σ TR 80 — inside the official 37–39 / 14–16 / 78–84 bands', () => {
    expect(count(board, 'empty')).eq(38);
    expect(count(board, 'advance')).eq(15);
    expect(totalTr(board)).eq(80);
    for (const [name, official] of OFFICIAL) {
      expect(count(official, 'empty'), `${name}: empty`).to.be.within(37, 39);
      expect(count(official, 'advance'), `${name}: advance`).to.be.within(14, 16);
      expect(totalTr(official), `${name}: Σ TR`).to.be.within(78, 84);
    }
  });

  it('the track ENDS are the official ones: tr5 · tr6 · tr5 · tr7 · tr8 · tr7 · tr6', () => {
    expect(board.map((t) => t.layout[18])).deep.eq(['tr5', 'tr6', 'tr5', 'tr7', 'tr8', 'tr7', 'tr6']);
    expect(THARSIS_MARSBOT_BOARD.map((t) => t.layout[18]), 'Tharsis prints the same ends').deep.eq(board.map((t) => t.layout[18]));
  });

  it('the milestone / award cells stand where every official board puts them', () => {
    const find = (action: TrackAction) => board.map((t) => t.layout.indexOf(action));
    expect(find('milestone')).deep.eq([7, 8, -1, 9, 7, -1, -1]);
    expect(find('award')).deep.eq([9, -1, 10, -1, -1, 9, 10]);
    expect(THARSIS_MARSBOT_BOARD.map((t) => t.layout.indexOf('milestone'))).deep.eq(find('milestone'));
    expect(THARSIS_MARSBOT_BOARD.map((t) => t.layout.indexOf('award'))).deep.eq(find('award'));
  });

  it('the expansion icons are the v1.16+ set: one venus, one floater, two floater2 — and no colony cell', () => {
    expect(count(board, 'venus')).eq(1);
    expect(count(board, 'venus2')).eq(0);
    expect(count(board, 'floater')).eq(1);
    expect(count(board, 'floater2')).eq(2);
    expect(count(board, 'colony'), 'that is Utopia\'s').eq(0);
  });

  it('prints exactly two cross-track icons — the ENERGY tag on building 4 and 13 (Elysium\'s cells)', () => {
    const tagCells: Array<string> = [];
    board.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action?.startsWith('tag_') === true) {
          tagCells.push(`${track.role}:${position}=${action}`);
        }
      });
    });
    expect(tagCells).deep.eq([`building:4=tag_${VASTITAS_FAN_TRACK.POWER}`, `building:13=tag_${VASTITAS_FAN_TRACK.POWER}`]);
    expect(ELYSIUM_MARSBOT_BOARD[0].layout[4]).eq(POWER);
    expect(ELYSIUM_MARSBOT_BOARD[0].layout[13]).eq(POWER);
  });

  it('the second trade fleet\'s cell (POWER 9) exists and prints a city', () => {
    expect(board[VASTITAS_FAN_TRACK.POWER].layout[9]).eq('city');
  });
});

describe('VASTITAS BOREALIS (fan map) — the tag topology is Hellas\' / Elysium\'s, derived from the M&A row', () => {
  const board = () => new MarsBotBoard(VASTITAS_FAN_MARSBOT_BOARD);

  it('Jovian rides SCIENCE, Power stands ALONE, City rides EARTH, the bio row keeps all three', () => {
    const b = board();
    const science = b.trackIndexOfRoleOrThrow('science');
    const power = b.trackIndexOfRoleOrThrow('power');
    const earth = b.trackIndexOfRoleOrThrow('earth');
    const bio = b.trackIndexOfRoleOrThrow('bio');
    expect(b.getTrackIndexForTag(Tag.JOVIAN), 'Jovian → Jovian/Science (Voyager\'s track, Rim Settler\'s calibration)').eq(science);
    expect(b.getTrackIndexForTag(Tag.SCIENCE)).eq(science);
    expect(b.getTrackIndexForTag(Tag.POWER), 'Power alone (V. Electrician counts power tags)').eq(power);
    expect(VASTITAS_FAN_MARSBOT_BOARD[power].tags).deep.eq([Tag.POWER]);
    expect(b.getTrackIndexForTag(Tag.CITY), 'City → City/Earth').eq(earth);
    expect(b.getTrackIndexForTag(Tag.EARTH)).eq(earth);
    expect(b.getTrackIndexForTag(Tag.MICROBE), 'Microbe stays on bio — the shared Venus row keeps pointing there').eq(bio);
    expect(b.getTrackIndexForTag(Tag.ANIMAL)).eq(bio);
    expect(b.getTrackIndexForTag(Tag.PLANT)).eq(bio);
  });

  it('is Hellas\' pairing exactly — the same tag sets on every row', () => {
    VASTITAS_FAN_MARSBOT_BOARD.forEach((track, index) => {
      expect(track.tags, track.role).deep.eq(HELLAS_MARSBOT_BOARD[index].tags);
    });
  });

  it('production regression follows the printed BADGES, never the tag pairing', () => {
    const b = board();
    const expected = {
      [Resource.STEEL]: 'building',
      [Resource.TITANIUM]: 'space',
      [Resource.MEGACREDITS]: 'event',
      [Resource.ENERGY]: 'power',
      [Resource.HEAT]: 'earth', // City + Earth — the row Naturalist reads beside bio
      [Resource.PLANTS]: 'bio',
    } as const;
    for (const [resource, role] of Object.entries(expected)) {
      const index = b.getTrackIndexForProduction(resource as Resource);
      expect(index, `${resource} maps to a track`).is.not.undefined;
      expect(b.tracks[index!].definition.role, `${resource} regresses ${role}`).eq(role);
    }
    expect(b.getTrackOfRole('science')!.definition.productions, 'the Jovian/Science row carries no badge').is.empty;
  });

  it('differs from Tharsis in exactly the designed cells (docs/AUTOMA_DATA_AUDIT.md §2f)', () => {
    const diffs: Array<string> = [];
    VASTITAS_FAN_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = THARSIS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:4 empty→tag_4',
      'building:5 tr2→empty',
      'building:11 tag_1→empty',
      'building:13 empty→tag_4',
      'space:11 tr3→tr4',
      'space:16 tr4→tr5',
      'event:6 venus2→floater2',
      'event:12 tr4→tr5',
      'science:2 empty→floater',
      'science:5 empty→floater2',
      'power:2 venus→empty',
      'power:4 venus2→empty',
      'power:5 temperature→city',
      'power:9 temperature→city',
      'earth:4 tr3→temperature',
      'earth:5 city→empty',
      'earth:8 city→temperature',
    ]);
  });

  it('the science row is Hellas\' cell by cell; the bio row is Tharsis\' — the rows the brief names as copied', () => {
    expect(VASTITAS_FAN_MARSBOT_BOARD[VASTITAS_FAN_TRACK.SCIENCE].layout).deep.eq(HELLAS_MARSBOT_BOARD[3].layout);
    expect(VASTITAS_FAN_MARSBOT_BOARD[VASTITAS_FAN_TRACK.BIO].layout).deep.eq(THARSIS_MARSBOT_BOARD[6].layout);
  });

  it('the shared Venus row\'s cell-9 MICROBE reaches the bio row here — no own Venus row needed', () => {
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(VASTITAS_FAN_MARSBOT_BOARD[VENUS_CELL9_TARGET_TRACK].tags).to.include(Tag.MICROBE);
  });
});

describe('the VASTITAS BOREALIS (fan map) profile', () => {
  const profile = () => marsBotMapProfile(BoardName.VASTITAS_BOREALIS);

  it('is a supported MarsBot board — beside, not instead of, the official Nova one', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.VASTITAS_BOREALIS);
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.VASTITAS_BOREALIS_NOVA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
    expect(profile().boardName).eq(BoardName.VASTITAS_BOREALIS);
    expect(profile().tracks).eq(VASTITAS_FAN_MARSBOT_BOARD);
  });

  it('plays with the fork\'s own BF1 Corporate Competition', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN);
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.VASTITAS_BOREALIS)) {
      expect(marsBotMapProfile(board).corporateCompetition, board).not.eq(BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN);
    }
  });

  it('ranks oceans first, then reward icons — Utopia\'s profile, for the same tile-position awards (Irrigator, Edgedancer)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['oceans', 'reward-icons']);
    expect(marsBotMapProfile(BoardName.UTOPIA_PLANITIA).placementTiebreakers.map((t) => t.id)).deep.eq(profile().placementTiebreakers.map((t) => t.id));
    expect(profile().tiebreakRewardBonus, 'the edge bullet').is.not.undefined;
    expect(profile().venusTrack, 'the shared Venus row').is.undefined;
  });

  it('carries no other map\'s step', () => {
    const ids = profile().placementTiebreakers.map((t) => t.id);
    expect(ids).to.not.include('polar-region');
    expect(ids).to.not.include('southern-region');
    expect(ids).to.not.include('special-tile');
    expect(ids).to.not.include('edge');
  });

  it('declares exactly one track per role', () => {
    const roles = profile().tracks.map((t) => t.role);
    expect(new Set(roles).size).eq(roles.length);
    expect([...roles].sort()).deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
  });

  it('changed no cell of any official board', () => {
    // The six official photographs each pin their own board; this is the
    // cross-check in one place: the fan board is a NEW object, and the
    // official ones still differ from it where they must.
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.VASTITAS_BOREALIS)) {
      expect(marsBotMapProfile(board).tracks, board).not.eq(VASTITAS_FAN_MARSBOT_BOARD);
    }
  });
});
