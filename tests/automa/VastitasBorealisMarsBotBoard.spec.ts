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
  VASTITAS_BOREALIS_MARSBOT_BOARD,
  VASTITAS_TRACK,
  VASTITAS_VENUS_TRACK,
} from '../../src/server/automa/boards/VastitasBorealisMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK, VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';

/**
 * THE VASTITAS BOREALIS BOARD IS DATA — this spec is its photograph.
 *
 * Every one of the 7 × 19 cells is pinned individually, so a refactor that
 * moves ONE icon fails with that cell's coordinates instead of a length check
 * that still passes. Transcribed from the official Vastitas Borealis MarsBot
 * board component («compatible with rules v1.16+», provided 2026-10-31).
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

/** The printed VENUS-tag icon on building 11. */
const VENUS: TrackAction = `tag_${VENUS_TRACK_INDEX}`;
/** The printed ANIMAL-tag icon on Microbe/Science 16 — the Animal/Plant row. */
const ANIMAL: TrackAction = `tag_${VASTITAS_TRACK.BIO}`;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const VASTITAS: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1          2        3  4  5      6              7            8           9        10      11     12       13 14          15      16             17 18
    cells: [_, 'advance', 'ocean', _, _, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', VENUS, 'ocean', _, 'greenery', 'city', 'temperature', _, 'tr5'],
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
    role: 'science', tags: [Tag.MICROBE, Tag.SCIENCE], productions: [],
    cells: [_, 'advance', _, _, 'city', _, 'greenery', _, 'tr2', 'milestone', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', ANIMAL, 'temperature', 'tr5'],
  },
  {
    role: 'power', tags: [Tag.CITY, Tag.POWER], productions: [Resource.ENERGY],
    cells: [_, 'advance', _, 'tr3', _, 'city', 'advance', 'milestone', _, 'city', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.JOVIAN, Tag.EARTH], productions: [Resource.HEAT],
    cells: [_, 'city', 'floater', _, 'temperature', 'floater2', _, 'advance', 'temperature', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.ANIMAL, Tag.PLANT], productions: [Resource.PLANTS],
    cells: [_, _, 'greenery', _, 'greenery', _, 'greenery', 'advance', _, 'ocean', 'award', 'temperature', 'tr4', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr8'],
  },
];

describe('VASTITAS BOREALIS MarsBot board — the transcribed component, cell by cell', () => {
  it('has the 7 printed tracks, in printed order', () => {
    expect(VASTITAS_BOREALIS_MARSBOT_BOARD).has.length(7);
    expect(VASTITAS_BOREALIS_MARSBOT_BOARD.map((t) => t.role)).deep.eq(VASTITAS.map((r) => r.role));
  });

  it('the VASTITAS_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(VASTITAS_TRACK)) {
      expect(VASTITAS_BOREALIS_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  VASTITAS.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => VASTITAS_BOREALIS_MARSBOT_BOARD[index];

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

describe('VASTITAS BOREALIS — three pairings move at once (Adding Expansions p.8)', () => {
  const board = () => new MarsBotBoard(VASTITAS_BOREALIS_MARSBOT_BOARD);

  it('Microbe rides SCIENCE, City rides ENERGY, Jovian rides EARTH; the bio row keeps Animal + Plant', () => {
    const b = board();
    const science = b.trackIndexOfRoleOrThrow('science');
    const power = b.trackIndexOfRoleOrThrow('power');
    const earth = b.trackIndexOfRoleOrThrow('earth');
    const bio = b.trackIndexOfRoleOrThrow('bio');
    expect(b.getTrackIndexForTag(Tag.MICROBE), 'Microbe → Microbe/Science').eq(science);
    expect(b.getTrackIndexForTag(Tag.SCIENCE), 'Science → Microbe/Science').eq(science);
    expect(b.getTrackIndexForTag(Tag.CITY), 'City → City/Energy').eq(power);
    expect(b.getTrackIndexForTag(Tag.POWER), 'Energy → City/Energy').eq(power);
    expect(b.getTrackIndexForTag(Tag.JOVIAN), 'Jovian → Jovian/Earth').eq(earth);
    expect(b.getTrackIndexForTag(Tag.EARTH), 'Earth → Jovian/Earth').eq(earth);
    expect(b.getTrackIndexForTag(Tag.ANIMAL), 'Animal → Animal/Plant').eq(bio);
    expect(b.getTrackIndexForTag(Tag.PLANT), 'Plant → Animal/Plant').eq(bio);
  });

  it('production regression follows the printed BADGES, never the tag pairing', () => {
    const b = board();
    const expected = {
      [Resource.STEEL]: 'building',
      [Resource.TITANIUM]: 'space',
      [Resource.MEGACREDITS]: 'event',
      [Resource.ENERGY]: 'power', // City + Energy
      [Resource.HEAT]: 'earth', // Jovian + Earth
      [Resource.PLANTS]: 'bio', // Animal + Plant
    } as const;
    for (const [resource, role] of Object.entries(expected)) {
      const index = b.getTrackIndexForProduction(resource as Resource);
      expect(index, `${resource} maps to a track`).is.not.undefined;
      expect(b.tracks[index!].definition.role, `${resource} regresses ${role}`).eq(role);
    }
    expect(b.getTrackOfRole('science')!.definition.productions,
      'the Microbe/Science row carries no production badge at all').is.empty;
  });

  it('differs from Tharsis in exactly the transcribed cells', () => {
    const diffs: Array<string> = [];
    VASTITAS_BOREALIS_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = THARSIS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:1 empty→advance',
      'building:11 tag_1→tag_7',
      'space:11 tr3→tr4',
      'space:16 tr4→tr5',
      'event:6 venus2→floater2',
      'event:12 tr4→tr5',
      'science:3 advance→empty',
      'science:16 empty→tag_6',
      'science:18 tr7→tr5',
      'power:2 venus→empty',
      'power:4 venus2→empty',
      'power:5 temperature→city',
      'power:9 temperature→city',
      'earth:2 empty→floater',
      'earth:4 tr3→temperature',
      'earth:5 city→floater2',
      'earth:8 city→temperature',
      'bio:2 empty→greenery',
      'bio:3 greenery→empty',
      'bio:4 empty→greenery',
      'bio:5 greenery→empty',
      'bio:12 tr3→tr4',
      'bio:18 tr6→tr8',
    ]);
  });

  it('prints exactly two cross-track tag icons: VENUS on building 11 and ANIMAL on science 16', () => {
    const tagCells: Array<string> = [];
    VASTITAS_BOREALIS_MARSBOT_BOARD.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action?.startsWith('tag_') === true) {
          tagCells.push(`${track.role}:${position}=${action}`);
        }
      });
    });
    expect(tagCells).deep.eq([`building:11=tag_${VENUS_TRACK_INDEX}`, `science:16=tag_${VASTITAS_TRACK.BIO}`]);
  });

  it('prints no «Place a Colony» cell — that is Utopia\'s', () => {
    expect(VASTITAS_BOREALIS_MARSBOT_BOARD.flatMap((track) => track.layout).filter((action) => action === 'colony')).is.empty;
  });
});

describe('VASTITAS BOREALIS — the Venus row follows the MICROBE', () => {
  it('cell 9 (a printed microbe tag) advances the Microbe/SCIENCE row, not bio', () => {
    expect(VASTITAS_VENUS_TRACK.layout[9]).eq(`tag_${VASTITAS_TRACK.SCIENCE}`);
    expect(VASTITAS_BOREALIS_MARSBOT_BOARD[VASTITAS_TRACK.SCIENCE].tags).to.include(Tag.MICROBE);
  });

  it('is otherwise the very same printed row as every other map\'s', () => {
    VENUS_TRACK.layout.forEach((action, position) => {
      if (position !== 9) {
        expect(VASTITAS_VENUS_TRACK.layout[position], `cell ${position}`).eq(action);
      }
    });
    expect(VASTITAS_VENUS_TRACK.microbeTagCells).deep.eq(VENUS_TRACK.microbeTagCells);
    expect(VASTITAS_VENUS_TRACK.maxPosition).eq(VENUS_TRACK.maxPosition);
    expect(VASTITAS_VENUS_TRACK.role).eq('venus');
  });

  it('the shared row still points at the bio row, where every other map keeps the microbe', () => {
    expect(VENUS_TRACK.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.VASTITAS_BOREALIS_NOVA)) {
      const profile = marsBotMapProfile(board);
      expect(profile.venusTrack, board).is.undefined;
      expect(profile.tracks[VENUS_CELL9_TARGET_TRACK].tags, board).to.include(Tag.MICROBE);
    }
  });
});

describe('the VASTITAS BOREALIS map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.VASTITAS_BOREALIS_NOVA);

  it('is a supported MarsBot board — and it is the NOVA one', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.VASTITAS_BOREALIS_NOVA);
    // The fork's older Vastitas Borealis is a fan map with a home-made profile
    // of its own (`VastitasBorealisFanMarsBot`) — never THIS board's data.
    expect(marsBotMapProfile(BoardName.VASTITAS_BOREALIS).tracks).not.eq(VASTITAS_BOREALIS_MARSBOT_BOARD);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
  });

  it('plays with B13 (Setup Guide v1.3 step 18)', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS);
  });

  it('ranks reward icons FIRST, then edges, then oceans (Adding Expansions p.10 steps 4 and 6)', () => {
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['reward-icons', 'edge', 'oceans']);
  });

  it('carries no other map\'s rule, and nobody else gained the edge step', () => {
    const ids = profile().placementTiebreakers.map((t) => t.id);
    expect(ids).to.not.include('polar-region');
    expect(ids).to.not.include('southern-region');
    expect(ids).to.not.include('special-tile');
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.VASTITAS_BOREALIS_NOVA)) {
      expect(marsBotMapProfile(board).placementTiebreakers.map((t) => t.id), board).to.not.include('edge');
    }
  });

  it('declares exactly one track per role', () => {
    const roles = profile().tracks.map((t) => t.role);
    expect(new Set(roles).size).eq(roles.length);
    expect([...roles].sort()).deep.eq(['bio', 'building', 'earth', 'event', 'power', 'science', 'space']);
  });
});
