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
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {
  TERRA_CIMMERIA_MARSBOT_BOARD,
  TERRA_CIMMERIA_TRACK,
} from '../../src/server/automa/boards/TerraCimmeriaMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {ELYSIUM_MARSBOT_BOARD} from '../../src/server/automa/boards/ElysiumMarsBot';
import {UTOPIA_MARSBOT_BOARD} from '../../src/server/automa/boards/UtopiaMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';

/**
 * THE TERRA CIMMERIA BOARD IS DATA — this spec is its photograph.
 *
 * Every one of the 7 × 19 cells is pinned individually, so a refactor that
 * moves ONE icon fails with that cell's coordinates instead of a length check
 * that still passes. Transcribed from the official Terra Cimmeria MarsBot board
 * component («compatible with rules v1.16+», provided 2026-08-29).
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

/** The printed ENERGY-tag icon: «advance the track that tag belongs to». */
const ENERGY: TrackAction = `tag_${TERRA_CIMMERIA_TRACK.POWER}`;
/** The printed EVENT-tag icon on the City/Science row. */
const EVENT: TrackAction = `tag_${TERRA_CIMMERIA_TRACK.EVENT}`;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const TERRA: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2         3  4        5  6              7            8           9        10      11 12       13       14          15      16             17 18
    cells: [_, _, 'ocean', _, ENERGY, _, 'temperature', 'milestone', 'greenery', 'award', 'city', _, 'ocean', ENERGY, 'greenery', 'city', 'temperature', _, 'tr5'],
  },
  {
    role: 'space', tags: [Tag.SPACE], productions: [Resource.TITANIUM],
    cells: [_, 'advance', _, 'temperature', _, 'ocean', 'city', 'venus', 'milestone', 'temperature', _, 'tr4', 'ocean', _, 'temperature', _, 'tr5', _, 'tr6'],
  },
  {
    role: 'event', tags: [Tag.EVENT], productions: [Resource.MEGACREDITS],
    cells: [_, 'advance', _, 'ocean', 'greenery', 'advance', 'floater2', 'advance', 'ocean', 'tr3', 'award', _, 'tr4', 'temperature', 'greenery', 'advance', 'temperature2', _, 'tr5'],
  },
  {
    role: 'science', tags: [Tag.CITY, Tag.SCIENCE], productions: [],
    cells: [_, 'advance', _, 'city', _, 'city', 'greenery', EVENT, 'milestone', _, 'city', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER], productions: [Resource.ENERGY],
    cells: [_, 'advance', _, 'tr3', _, 'temperature', 'advance', 'award', _, 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.JOVIAN, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', 'floater', _, 'temperature', 'floater2', _, 'advance', _, 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', 'advance', _, 'ocean', 'milestone', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

describe('TERRA CIMMERIA MarsBot board — the transcribed component, cell by cell', () => {
  it('has the 7 printed tracks, in printed order', () => {
    expect(TERRA_CIMMERIA_MARSBOT_BOARD).has.length(7);
    expect(TERRA_CIMMERIA_MARSBOT_BOARD.map((t) => t.role)).deep.eq(TERRA.map((r) => r.role));
  });

  it('the TERRA_CIMMERIA_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(TERRA_CIMMERIA_TRACK)) {
      expect(TERRA_CIMMERIA_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  TERRA.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => TERRA_CIMMERIA_MARSBOT_BOARD[index];

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

describe('TERRA CIMMERIA — the tag topology no other board has', () => {
  const board = () => new MarsBotBoard(TERRA_CIMMERIA_MARSBOT_BOARD);

  it('City rides SCIENCE, Jovian rides EARTH, and Energy stands alone', () => {
    const b = board();
    const science = b.trackIndexOfRoleOrThrow('science');
    const earth = b.trackIndexOfRoleOrThrow('earth');
    const power = b.trackIndexOfRoleOrThrow('power');
    expect(b.getTrackIndexForTag(Tag.CITY), 'City → City/Science').eq(science);
    expect(b.getTrackIndexForTag(Tag.SCIENCE), 'Science → City/Science').eq(science);
    expect(b.getTrackIndexForTag(Tag.JOVIAN), 'Jovian → Jovian/Earth').eq(earth);
    expect(b.getTrackIndexForTag(Tag.EARTH), 'Earth → Jovian/Earth').eq(earth);
    expect(b.getTrackIndexForTag(Tag.POWER), 'Energy stands alone').eq(power);
    expect(b.tracks[power].definition.tags, 'and nothing else rides it').deep.eq([Tag.POWER]);
  });

  it('every OTHER supported map pairs those tags differently — no topology leaked', () => {
    const tharsis = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
    expect(tharsis.getTrackIndexForTag(Tag.JOVIAN), 'Tharsis: Jovian rides Power')
      .eq(tharsis.trackIndexOfRoleOrThrow('power'));
    expect(tharsis.getTrackIndexForTag(Tag.CITY), 'Tharsis: City rides Earth')
      .eq(tharsis.trackIndexOfRoleOrThrow('earth'));
    const elysium = new MarsBotBoard(ELYSIUM_MARSBOT_BOARD);
    expect(elysium.getTrackIndexForTag(Tag.JOVIAN), 'Elysium: Jovian rides Science')
      .eq(elysium.trackIndexOfRoleOrThrow('science'));
    const utopia = new MarsBotBoard(UTOPIA_MARSBOT_BOARD);
    expect(utopia.getTrackIndexForTag(Tag.JOVIAN), 'Utopia: Jovian rides Power')
      .eq(utopia.trackIndexOfRoleOrThrow('power'));
  });

  it('production regression follows the printed BADGES, never the tag pairing', () => {
    const b = board();
    const expected = {
      [Resource.STEEL]: 'building',
      [Resource.TITANIUM]: 'space',
      [Resource.MEGACREDITS]: 'event',
      [Resource.ENERGY]: 'power', // standalone Energy — never Jovian/Earth
      [Resource.HEAT]: 'earth', // Jovian + Earth — never City/Science
      [Resource.PLANTS]: 'bio',
    } as const;
    for (const [resource, role] of Object.entries(expected)) {
      const index = b.getTrackIndexForProduction(resource as Resource);
      expect(index, `${resource} maps to a track`).is.not.undefined;
      expect(b.tracks[index!].definition.role, `${resource} regresses ${role}`).eq(role);
    }
    expect(b.getTrackOfRole('science')!.definition.productions,
      'the City/Science row carries no production badge at all').is.empty;
  });

  it('differs from Tharsis in exactly the transcribed cells', () => {
    const diffs: Array<string> = [];
    TERRA_CIMMERIA_MARSBOT_BOARD.forEach((track, index) => {
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
      'science:3 advance→city',
      'science:4 city→empty',
      'science:5 empty→city',
      'science:7 empty→tag_2',
      'science:8 tr2→milestone',
      'science:9 milestone→empty',
      'science:10 temperature→city',
      'power:2 venus→empty',
      'power:4 venus2→empty',
      'power:7 milestone→award',
      'earth:2 empty→floater',
      'earth:4 tr3→temperature',
      'earth:5 city→floater2',
      'earth:8 city→empty',
      'bio:10 award→milestone',
      'bio:12 tr3→tr4',
    ]);
  });

  it('prints exactly three cross-track tag icons: two ENERGY and one EVENT', () => {
    const tagCells: Array<string> = [];
    TERRA_CIMMERIA_MARSBOT_BOARD.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action?.startsWith('tag_') === true) {
          tagCells.push(`${track.role}:${position}=${action}`);
        }
      });
    });
    expect(tagCells).deep.eq(['building:4=tag_4', 'building:13=tag_4', 'science:7=tag_2']);
    expect(TERRA_CIMMERIA_TRACK.POWER, 'tag_4 is the energy row').eq(4);
    expect(TERRA_CIMMERIA_TRACK.EVENT, 'tag_2 is the event row').eq(2);
  });

  it('prints no «Place a Colony» cell — MSL Curiosity is a HEX, not a track action', () => {
    // Utopia's colony cell is a track icon; Terra Cimmeria's colony is a
    // placement-bonus override on one board hex. Confusing the two is the
    // single most likely way to mis-port this map.
    const colonyCells = TERRA_CIMMERIA_MARSBOT_BOARD
      .flatMap((track) => track.layout)
      .filter((action) => action === 'colony');
    expect(colonyCells).is.empty;
    expect(UTOPIA_MARSBOT_BOARD[1].layout[5], 'Utopia keeps its own').eq('colony');
  });
});

describe('the TERRA CIMMERIA map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.TERRA_CIMMERIA_NOVA);

  it('is a supported MarsBot board — and it is the NOVA one', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.TERRA_CIMMERIA_NOVA);
    expect(AUTOMA_SUPPORTED_BOARDS, 'the fork\'s older Terra Cimmeria is a different map')
      .to.not.include(BoardName.TERRA_CIMMERIA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
  });

  it('plays with B12 (Setup Guide v1.3 step 18)', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA);
    for (const [board, card] of [
      [BoardName.THARSIS, BonusCardId.B08_CORPORATE_COMPETITION],
      [BoardName.HELLAS, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS],
      [BoardName.ELYSIUM, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM],
      [BoardName.UTOPIA_PLANITIA, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA],
    ] as const) {
      expect(marsBotMapProfile(board).corporateCompetition, board).eq(card);
    }
  });

  it('puts the SPECIAL-TILE step between oceans and the reward icons (Adding Expansions p.10)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id))
      .deep.eq(['oceans', 'special-tile', 'reward-icons']);
  });

  it('carries no other map\'s rule', () => {
    const ids = profile().placementTiebreakers.map((t) => t.id);
    expect(ids, 'no Hellas polar step').to.not.include('polar-region');
    expect(ids, 'no Elysium southern step').to.not.include('southern-region');
    expect(profile().tiebreakRewardBonus, 'and no Utopia edge bonus').is.undefined;
    expect(profile().tracks).eq(TERRA_CIMMERIA_MARSBOT_BOARD);
    // …and nobody else gained the special-tile step.
    for (const board of [BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM, BoardName.UTOPIA_PLANITIA]) {
      expect(marsBotMapProfile(board).placementTiebreakers.map((t) => t.id), board)
        .to.not.include('special-tile');
    }
  });

  it('keeps the Venus board\'s cell-9 tag icon pointing at the BIO track', () => {
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(profile().tracks[VENUS_CELL9_TARGET_TRACK].role).eq('bio');
  });

  it('declares exactly one track per role', () => {
    const roles = profile().tracks.map((t) => t.role);
    expect(new Set(roles).size).eq(roles.length);
    expect([...roles].sort()).deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
  });
});
