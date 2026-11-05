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
import {ARABIA_TERRA_MARSBOT_BOARD, ARABIA_TERRA_TRACK} from '../../src/server/automa/boards/ArabiaTerraMarsBot';
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
 * THE ARABIA TERRA BOARD IS DATA — this spec is its photograph AND its design brief (docs/AUTOMA_DATA_AUDIT.md §2i): a
 * HOME-MADE board, the owner's decision of 2026-11-05 — the Hellas board (Power alone, for Economizer) with Utopia
 * Planitia's SPACE row (the official Pioneer's free colony cell) and Elysium's POWER row. Beside the cell-by-cell pin it
 * asserts the §A law of the six official boards (docs/claude/marsbot-fan-map-checklist.md) and where each row came from.
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty cell is a fact about the board.
 */
const _ = undefined;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const ARABIA: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2        3  4  5      6              7            8           9        10      11 12       13 14          15      16             17 18
    cells: [_, _, 'ocean', _, _, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', _, 'ocean', _, 'greenery', 'city', 'temperature', _, 'tr5'],
  },
  {
    role: 'space', tags: [Tag.SPACE], productions: [Resource.TITANIUM],
    cells: [_, _, _, 'temperature', 'advance', 'colony', 'city', 'venus', 'milestone', 'temperature', 'ocean', 'tr2', 'ocean', _, 'temperature', _, 'tr4', _, 'tr6'],
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
    cells: [_, 'advance', _, 'tr3', _, 'temperature', 'advance', 'milestone', _, 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
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

describe('ARABIA TERRA (fan map) MarsBot board — the home-made component, cell by cell', () => {
  it('has the 7 printed tracks, in the shared role order', () => {
    expect(ARABIA_TERRA_MARSBOT_BOARD).has.length(7);
    expect(ARABIA_TERRA_MARSBOT_BOARD.map((t) => t.role)).deep.eq(ARABIA.map((r) => r.role));
    expect(ARABIA_TERRA_MARSBOT_BOARD.map((t) => t.role)).deep.eq(THARSIS_MARSBOT_BOARD.map((t) => t.role));
  });

  it('the ARABIA_TERRA_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(ARABIA_TERRA_TRACK)) {
      expect(ARABIA_TERRA_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  ARABIA.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => ARABIA_TERRA_MARSBOT_BOARD[index];

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

describe('ARABIA TERRA (fan map) — the §A law of the six official boards, as assertions', () => {
  const board = ARABIA_TERRA_MARSBOT_BOARD;
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

  it('37 empty cells, 15 «advance» cells, Σ TR 81 — inside the official 37–39 / 14–16 / 78–84 bands', () => {
    expect(count(board, 'empty')).eq(37);
    expect(count(board, 'advance')).eq(15);
    expect(totalTr(board)).eq(81);
  });

  it('the track ENDS are the official ones: tr5 · tr6 · tr5 · tr7 · tr8 · tr7 · tr6', () => {
    expect(board.map((t) => t.layout[18])).deep.eq(['tr5', 'tr6', 'tr5', 'tr7', 'tr8', 'tr7', 'tr6']);
  });

  it('the milestone / award cells stand where every official board puts them', () => {
    const find = (action: TrackAction) => board.map((t) => t.layout.indexOf(action));
    expect(find('milestone')).deep.eq([7, 8, -1, 9, 7, -1, -1]);
    expect(find('award')).deep.eq([9, -1, 10, -1, -1, 9, 10]);
  });

  it('the expansion icons are the v1.16+ set: one venus, one floater, two floater2 — and ONE free colony cell', () => {
    expect(count(board, 'venus')).eq(1);
    expect(count(board, 'venus2')).eq(0);
    expect(count(board, 'floater')).eq(1);
    expect(count(board, 'floater2')).eq(2);
    expect(count(board, 'tag'), 'no cross-track icon').eq(0);
    expect(count(board, 'colony'), 'the official Pioneer\'s cell').eq(1);
    expect(board[ARABIA_TERRA_TRACK.SPACE].layout[5]).eq('colony');
    expect(count(board, 'colony5'), 'the paid cells are Amazonis\'').eq(0);
  });

  it('the second trade fleet\'s cell (POWER 9) exists', () => {
    expect(board[ARABIA_TERRA_TRACK.POWER].layout[9]).eq('temperature');
  });
});

describe('ARABIA TERRA (fan map) — the topology and where each row came from', () => {
  const board = () => new MarsBotBoard(ARABIA_TERRA_MARSBOT_BOARD);

  it('POWER stands ALONE (Economizer), Jovian rides Science, City rides Earth (Terran), the bio row keeps all three', () => {
    const b = board();
    expect(ARABIA_TERRA_MARSBOT_BOARD[ARABIA_TERRA_TRACK.POWER].tags).deep.eq([Tag.POWER]);
    expect(b.getTrackIndexForTag(Tag.JOVIAN)).eq(b.trackIndexOfRoleOrThrow('science'));
    expect(b.getTrackIndexForTag(Tag.CITY)).eq(b.trackIndexOfRoleOrThrow('earth'));
    for (const tag of [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT]) {
      expect(b.getTrackIndexForTag(tag), `${tag} → bio (Botanist, Zoologist)`).eq(b.trackIndexOfRoleOrThrow('bio'));
    }
    ARABIA_TERRA_MARSBOT_BOARD.forEach((track, index) => {
      expect([...track.tags].sort(), `${track.role} pairs as Hellas`).deep.eq([...HELLAS_MARSBOT_BOARD[index].tags].sort());
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

  it('is the HELLAS board with exactly two rows swapped: SPACE from Utopia Planitia, POWER from Elysium', () => {
    ARABIA_TERRA_MARSBOT_BOARD.forEach((track, index) => {
      const source = index === ARABIA_TERRA_TRACK.SPACE ? UTOPIA_MARSBOT_BOARD : index === ARABIA_TERRA_TRACK.POWER ? ELYSIUM_MARSBOT_BOARD : HELLAS_MARSBOT_BOARD;
      expect(track.layout, track.role).deep.eq(source[index].layout);
    });
  });

  it('differs from Hellas in exactly the designed cells (docs/AUTOMA_DATA_AUDIT.md §2i)', () => {
    const diffs: Array<string> = [];
    ARABIA_TERRA_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = HELLAS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'space:1 advance→empty',
      'space:4 empty→advance',
      'space:5 ocean→colony',
      'space:10 empty→ocean',
      'space:11 tr3→tr2',
      'power:2 advance→empty',
    ]);
  });

  it('the shared Venus row\'s cell-9 MICROBE reaches the bio row here — no own Venus row needed', () => {
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(ARABIA_TERRA_MARSBOT_BOARD[VENUS_CELL9_TARGET_TRACK].tags).to.include(Tag.MICROBE);
  });
});

describe('the ARABIA TERRA map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.ARABIA_TERRA);

  it('is a supported MarsBot board', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.ARABIA_TERRA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
    expect(profile().boardName).eq(BoardName.ARABIA_TERRA);
    expect(profile().tracks).eq(ARABIA_TERRA_MARSBOT_BOARD);
  });

  it('plays with the fork\'s own BF4 Corporate Competition — and nobody else does', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.BF4_CORPORATE_COMPETITION_ARABIA_TERRA);
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.ARABIA_TERRA)) {
      expect(marsBotMapProfile(board).corporateCompetition, board).not.eq(BonusCardId.BF4_CORPORATE_COMPETITION_ARABIA_TERRA);
    }
  });

  it('ranks oceans → reward icons — no step of its own (no criterion of the row counts where its tiles stand)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['oceans', 'reward-icons']);
    expect(profile().tiebreakRewardBonus, 'no «+1 icon» bullet').is.undefined;
    expect(profile().venusTrack, 'the shared Venus row').is.undefined;
  });

  it('declares exactly one track per role', () => {
    const roles = profile().tracks.map((t) => t.role);
    expect(new Set(roles).size).eq(roles.length);
    expect([...roles].sort()).deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
  });
});
