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
import {AMAZONIS_MARSBOT_BOARD, AMAZONIS_TRACK} from '../../src/server/automa/boards/AmazonisMarsBot';
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
 * THE AMAZONIS PLANITIA BOARD IS DATA — this spec is its photograph AND its
 * design brief (docs/AUTOMA_DATA_AUDIT.md §2g): a HOME-MADE board, so beside the
 * cell-by-cell pin it asserts the law the six official boards share
 * (docs/claude/marsbot-fan-map-checklist.md §A) and the three «colony for 5 M€»
 * cells standing exactly where the Awards & Milestones module places the
 * Pioneer-at-4 cubes (Adding Expansions p.14: space #7, #10 · power #8).
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

const AMAZONIS: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2        3  4  5      6              7            8           9        10      11 12       13 14          15      16             17 18
    cells: [_, _, 'ocean', _, _, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', _, 'ocean', _, 'greenery', 'city', 'temperature', _, 'tr5'],
  },
  {
    role: 'space', tags: [Tag.SPACE], productions: [Resource.TITANIUM],
    cells: [_, 'advance', _, 'temperature', 'venus', 'ocean', 'city', 'colony5', 'milestone', 'temperature', 'colony5', 'tr3', 'ocean', _, 'temperature', _, 'tr4', _, 'tr6'],
  },
  {
    role: 'event', tags: [Tag.EVENT], productions: [Resource.MEGACREDITS],
    cells: [_, 'advance', _, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', _, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', _, 'tr5'],
  },
  {
    role: 'science', tags: [Tag.SCIENCE], productions: [],
    cells: [_, 'advance', _, _, 'city', _, 'greenery', _, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER, Tag.JOVIAN], productions: [Resource.ENERGY],
    cells: [_, 'advance', 'floater', 'tr3', 'floater2', 'temperature', 'advance', 'milestone', 'colony5', 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.CITY, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', _, _, _, 'city', _, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', 'advance', _, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

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

describe('AMAZONIS PLANITIA (fan map) MarsBot board — the home-made component, cell by cell', () => {
  it('has the 7 printed tracks, in the shared role order', () => {
    expect(AMAZONIS_MARSBOT_BOARD).has.length(7);
    expect(AMAZONIS_MARSBOT_BOARD.map((t) => t.role)).deep.eq(AMAZONIS.map((r) => r.role));
    expect(AMAZONIS_MARSBOT_BOARD.map((t) => t.role)).deep.eq(THARSIS_MARSBOT_BOARD.map((t) => t.role));
  });

  it('the AMAZONIS_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(AMAZONIS_TRACK)) {
      expect(AMAZONIS_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  AMAZONIS.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => AMAZONIS_MARSBOT_BOARD[index];

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

      row.cells.forEach((action, position) => {
        it(`space ${position} is ${action ?? 'empty'}`, () => {
          expect(track().layout[position]).eq(action);
        });
      });
    });
  });
});

describe('AMAZONIS PLANITIA (fan map) — the §A law of the six official boards, as assertions', () => {
  const board = AMAZONIS_MARSBOT_BOARD;
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
    for (const [name, official] of OFFICIAL) {
      for (const action of ['ocean', 'greenery', 'city', 'milestone', 'award', 'temperature2'] as const) {
        expect(count(official, action), `${name}: ${action}`).eq(count(board, action));
      }
    }
  });

  it('37 empty cells, 14 «advance» cells, Σ TR 79 — inside the official 37–39 / 14–16 / 78–84 bands', () => {
    expect(count(board, 'empty')).eq(37);
    expect(count(board, 'advance')).eq(14);
    expect(totalTr(board)).eq(79);
  });

  it('the track ENDS are the official ones: tr5 · tr6 · tr5 · tr7 · tr8 · tr7 · tr6', () => {
    expect(board.map((t) => t.layout[18])).deep.eq(['tr5', 'tr6', 'tr5', 'tr7', 'tr8', 'tr7', 'tr6']);
  });

  it('the milestone / award cells stand where every official board puts them', () => {
    const find = (action: TrackAction) => board.map((t) => t.layout.indexOf(action));
    expect(find('milestone')).deep.eq([7, 8, -1, 9, 7, -1, -1]);
    expect(find('award')).deep.eq([9, -1, 10, -1, -1, 9, 10]);
  });

  it('the expansion icons are the v1.16+ set: one venus, one floater, two floater2', () => {
    expect(count(board, 'venus')).eq(1);
    expect(count(board, 'venus2')).eq(0);
    expect(count(board, 'floater')).eq(1);
    expect(count(board, 'floater2')).eq(2);
    expect(count(board, 'tag'), 'no cross-track icon — nothing in the row asks for one').eq(0);
  });

  it('prints THREE «colony for 5 M€» cells exactly where the A&M module places the Pioneer-at-4 cubes — and no free colony cell', () => {
    const cells: Array<string> = [];
    board.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action === 'colony5') {
          cells.push(`${track.role}:${position}`);
        }
      });
    });
    expect(cells).deep.eq(['space:7', 'space:10', 'power:8']);
    expect(count(board, 'colony'), 'the free Utopia cell is Utopia\'s').eq(0);
    expect(UTOPIA_MARSBOT_BOARD[1].layout[5], 'and Utopia keeps its own').eq('colony');
  });

  it('the second trade fleet\'s cell (POWER 9) exists', () => {
    expect(board[AMAZONIS_TRACK.POWER].layout[9]).eq('temperature');
  });
});

describe('AMAZONIS PLANITIA (fan map) — the tag topology is Tharsis\' / Utopia\'s, derived from the row', () => {
  const board = () => new MarsBotBoard(AMAZONIS_MARSBOT_BOARD);

  it('Jovian rides POWER, City rides EARTH, Science stands alone, the bio row keeps all three', () => {
    const b = board();
    expect(b.getTrackIndexForTag(Tag.JOVIAN), 'Jovian → Power (the A&M cube track)').eq(b.trackIndexOfRoleOrThrow('power'));
    expect(b.getTrackIndexForTag(Tag.CITY), 'City → Earth (Terran\'s calibration)').eq(b.trackIndexOfRoleOrThrow('earth'));
    expect(AMAZONIS_MARSBOT_BOARD[AMAZONIS_TRACK.SCIENCE].tags).deep.eq([Tag.SCIENCE]);
    expect(b.getTrackIndexForTag(Tag.MICROBE)).eq(b.trackIndexOfRoleOrThrow('bio'));
    expect(b.getTrackIndexForTag(Tag.ANIMAL)).eq(b.trackIndexOfRoleOrThrow('bio'));
    expect(b.getTrackIndexForTag(Tag.PLANT)).eq(b.trackIndexOfRoleOrThrow('bio'));
    AMAZONIS_MARSBOT_BOARD.forEach((track, index) => {
      // The same SETS as Utopia's rows (the printed order within a pair is the Hellas / Elysium one).
      expect([...track.tags].sort(), `${track.role} pairs as Utopia`).deep.eq([...UTOPIA_MARSBOT_BOARD[index].tags].sort());
    });
  });

  it('production regression follows the printed BADGES', () => {
    const b = board();
    const expected = {
      [Resource.STEEL]: 'building',
      [Resource.TITANIUM]: 'space',
      [Resource.MEGACREDITS]: 'event',
      [Resource.ENERGY]: 'power',
      [Resource.HEAT]: 'earth',
      [Resource.PLANTS]: 'bio',
    } as const;
    for (const [resource, role] of Object.entries(expected)) {
      const index = b.getTrackIndexForProduction(resource as Resource);
      expect(index, `${resource} maps to a track`).is.not.undefined;
      expect(b.tracks[index!].definition.role, `${resource} regresses ${role}`).eq(role);
    }
  });

  it('differs from Tharsis in exactly the designed cells (docs/AUTOMA_DATA_AUDIT.md §2g)', () => {
    const diffs: Array<string> = [];
    AMAZONIS_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = THARSIS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:11 tag_1→empty',
      'space:4 empty→venus',
      'space:7 venus→colony5',
      'space:10 empty→colony5',
      'event:6 venus2→floater2',
      'science:3 advance→empty',
      'power:2 venus→floater',
      'power:4 venus2→floater2',
      'power:8 empty→colony5',
      'earth:4 tr3→empty',
    ]);
  });

  it('the rows the brief names as copied: building = Hellas, event = Hellas, earth = Elysium, bio = Tharsis', () => {
    expect(AMAZONIS_MARSBOT_BOARD[AMAZONIS_TRACK.BUILDING].layout).deep.eq(HELLAS_MARSBOT_BOARD[0].layout);
    expect(AMAZONIS_MARSBOT_BOARD[AMAZONIS_TRACK.EVENT].layout).deep.eq(HELLAS_MARSBOT_BOARD[2].layout);
    expect(AMAZONIS_MARSBOT_BOARD[AMAZONIS_TRACK.EARTH].layout).deep.eq(ELYSIUM_MARSBOT_BOARD[5].layout);
    expect(AMAZONIS_MARSBOT_BOARD[AMAZONIS_TRACK.BIO].layout).deep.eq(THARSIS_MARSBOT_BOARD[6].layout);
  });

  it('the shared Venus row\'s cell-9 MICROBE reaches the bio row here — no own Venus row needed', () => {
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(AMAZONIS_MARSBOT_BOARD[VENUS_CELL9_TARGET_TRACK].tags).to.include(Tag.MICROBE);
  });
});

describe('the AMAZONIS PLANITIA map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.AMAZONIS);

  it('is a supported MarsBot board', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.AMAZONIS);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
    expect(profile().boardName).eq(BoardName.AMAZONIS);
    expect(profile().tracks).eq(AMAZONIS_MARSBOT_BOARD);
  });

  it('plays with the fork\'s own BF2 Corporate Competition — and nobody else does', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS);
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.AMAZONIS)) {
      expect(marsBotMapProfile(board).corporateCompetition, board).not.eq(BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS);
    }
  });

  it('ranks oceans → the equatorial region → reward icons → the most empty neighbours (Tropicalist + Tourist)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['oceans', 'equatorial-region', 'reward-icons', 'empty-neighbours']);
    expect(profile().tiebreakRewardBonus, 'no «+1 icon» bullet').is.undefined;
    expect(profile().venusTrack, 'the shared Venus row').is.undefined;
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.AMAZONIS)) {
      const ids = marsBotMapProfile(board).placementTiebreakers.map((t) => t.id);
      expect(ids, board).to.not.include('equatorial-region');
      expect(ids, board).to.not.include('empty-neighbours');
    }
  });

  it('declares exactly one track per role', () => {
    const roles = profile().tracks.map((t) => t.role);
    expect(new Set(roles).size).eq(roles.length);
    expect([...roles].sort()).deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
  });
});
