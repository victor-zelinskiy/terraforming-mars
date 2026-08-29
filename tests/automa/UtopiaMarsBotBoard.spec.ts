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
import {UTOPIA_MARSBOT_BOARD, UTOPIA_TRACK} from '../../src/server/automa/boards/UtopiaMarsBot';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {ELYSIUM_MARSBOT_BOARD} from '../../src/server/automa/boards/ElysiumMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK, VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';

/**
 * THE UTOPIA PLANITIA BOARD IS DATA — this spec is its photograph.
 *
 * Every one of the 7 × 19 cells is pinned individually, so a refactor that
 * moves ONE icon fails with that cell's coordinates instead of a length check
 * that still passes. Transcribed from the official Utopia Planitia MarsBot
 * board component («compatible with rules v1.16+»), cross-verified against the
 * retail component (2026-08-29).
 *
 * `_` marks an empty cell — spelled out rather than omitted, because an empty
 * cell is a fact about the board, not the absence of one.
 */
const _ = undefined;

/** The printed VENUS-tag icon on building 11: «advance the Venus track». */
const VENUS_TAG: TrackAction = `tag_${VENUS_TRACK_INDEX}`;

type Row = {
  role: MarsBotTrackRole;
  tags: ReadonlyArray<Tag>;
  productions: ReadonlyArray<Resource>;
  cells: ReadonlyArray<TrackAction | undefined>;
};

const UTOPIA: ReadonlyArray<Row> = [
  {
    role: 'building', tags: [Tag.BUILDING], productions: [Resource.STEEL],
    //      0  1  2         3  4  5      6              7            8           9        10      11         12       13 14          15      16             17 18
    cells: [_, _, 'ocean', _, _, 'tr2', 'temperature', 'milestone', 'greenery', 'award', 'city', VENUS_TAG, 'ocean', _, 'greenery', 'city', 'temperature', _, 'tr5'],
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
    role: 'science', tags: [Tag.SCIENCE], productions: [],
    cells: [_, 'advance', _, _, 'city', 'greenery', 'milestone', _, 'tr2', 'advance', 'temperature', 'ocean', 'tr3', 'temperature', 'tr4', 'advance', _, 'temperature', 'tr7'],
  },
  {
    role: 'power', tags: [Tag.POWER, Tag.JOVIAN], productions: [Resource.ENERGY],
    cells: [_, 'advance', 'floater', 'tr3', 'floater2', 'temperature', 'advance', 'milestone', _, 'temperature', 'greenery', 'advance', 'ocean', _, 'city', 'greenery', _, 'temperature', 'tr8'],
  },
  {
    role: 'earth', tags: [Tag.EARTH, Tag.CITY], productions: [Resource.HEAT],
    cells: [_, 'city', _, _, 'tr3', 'city', _, 'advance', 'city', 'award', 'advance', 'city', 'greenery', 'tr4', 'greenery', 'advance', _, 'city', 'tr7'],
  },
  {
    role: 'bio', tags: [Tag.PLANT, Tag.ANIMAL, Tag.MICROBE], productions: [Resource.PLANTS],
    cells: [_, _, _, 'greenery', _, 'greenery', 'greenery', _, _, 'ocean', 'award', 'temperature', 'tr3', 'greenery', 'greenery', 'ocean', 'greenery', _, 'tr6'],
  },
];

describe('UTOPIA PLANITIA MarsBot board — the transcribed component, cell by cell', () => {
  it('has the 7 printed tracks, in printed order', () => {
    expect(UTOPIA_MARSBOT_BOARD).has.length(7);
    expect(UTOPIA_MARSBOT_BOARD.map((t) => t.role)).deep.eq(UTOPIA.map((r) => r.role));
  });

  it('the UTOPIA_TRACK indexes name the rows they actually sit on', () => {
    for (const [name, index] of Object.entries(UTOPIA_TRACK)) {
      expect(UTOPIA_MARSBOT_BOARD[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  UTOPIA.forEach((row, index) => {
    describe(`the ${row.role} track`, () => {
      const track = () => UTOPIA_MARSBOT_BOARD[index];

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

describe('UTOPIA PLANITIA — the tag pairing is THARSIS\', not Hellas\'/Elysium\'s', () => {
  const board = () => new MarsBotBoard(UTOPIA_MARSBOT_BOARD);

  it('Jovian rides the POWER track and Science stands alone', () => {
    // «Hellas and Elysium: the [Jovian] tag is paired with [Science]» (Adding
    // Expansions p.8) names exactly two boards — Utopia is not one of them.
    const power = board().trackIndexOfRoleOrThrow('power');
    expect(board().getTrackIndexForTag(Tag.JOVIAN), 'Jovian → Jovian/Energy').eq(power);
    expect(board().getTrackIndexForTag(Tag.POWER), 'Energy → Jovian/Energy').eq(power);
    expect(board().getTrackIndexForTag(Tag.SCIENCE), 'Science stands alone')
      .eq(board().trackIndexOfRoleOrThrow('science'));

    const elysium = new MarsBotBoard(ELYSIUM_MARSBOT_BOARD);
    expect(elysium.getTrackIndexForTag(Tag.JOVIAN), 'Elysium is untouched: Jovian rides Science')
      .eq(elysium.trackIndexOfRoleOrThrow('science'));
  });

  it('Earth and City share a track; the bio tags share another', () => {
    const earth = board().trackIndexOfRoleOrThrow('earth');
    expect(board().getTrackIndexForTag(Tag.EARTH)).eq(earth);
    expect(board().getTrackIndexForTag(Tag.CITY)).eq(earth);
    const bio = board().trackIndexOfRoleOrThrow('bio');
    for (const tag of [Tag.PLANT, Tag.ANIMAL, Tag.MICROBE] as const) {
      expect(board().getTrackIndexForTag(tag), `${tag} → bio`).eq(bio);
    }
  });

  it('production regression follows the printed BADGES, never the tag pairing', () => {
    const utopia = board();
    const expected = {
      [Resource.STEEL]: 'building',
      [Resource.TITANIUM]: 'space',
      [Resource.MEGACREDITS]: 'event',
      [Resource.ENERGY]: 'power', // Jovian+Energy — never Science
      [Resource.HEAT]: 'earth', // Earth+City
      [Resource.PLANTS]: 'bio',
    } as const;
    for (const [resource, role] of Object.entries(expected)) {
      const index = utopia.getTrackIndexForProduction(resource as Resource);
      expect(index, `${resource} maps to a track`).is.not.undefined;
      expect(utopia.tracks[index!].definition.role, `${resource} regresses ${role}`).eq(role);
    }
    expect(utopia.tracks[utopia.getTrackIndexForProduction(Resource.ENERGY)!].definition.role,
      'energy production never reaches the Science track on this board').not.eq('science');
  });

  it('differs from Tharsis in exactly the transcribed cells', () => {
    const diffs: Array<string> = [];
    UTOPIA_MARSBOT_BOARD.forEach((track, index) => {
      track.layout.forEach((action, position) => {
        const other = THARSIS_MARSBOT_BOARD[index].layout[position];
        if (action !== other) {
          diffs.push(`${track.role}:${position} ${other ?? 'empty'}→${action ?? 'empty'}`);
        }
      });
    });
    expect(diffs).deep.eq([
      'building:11 tag_1→tag_7',
      'space:1 advance→empty',
      'space:4 empty→advance',
      'space:5 ocean→colony',
      'space:10 empty→ocean',
      'space:11 tr3→tr2',
      'event:6 venus2→floater2',
      'science:3 advance→empty',
      'science:5 empty→greenery',
      'science:6 greenery→milestone',
      'science:9 milestone→advance',
      'power:2 venus→floater',
      'power:4 venus2→floater2',
      'bio:7 advance→empty',
    ]);
  });

  it('prints exactly one «Place a Colony» cell, on the SPACE track at 5', () => {
    const colonyCells: Array<string> = [];
    UTOPIA_MARSBOT_BOARD.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action === 'colony') {
          colonyCells.push(`${track.role}:${position}`);
        }
      });
    });
    expect(colonyCells).deep.eq(['space:5']);
  });

  it('prints exactly one cross-track tag icon, and it points at the VENUS track', () => {
    // The target is a board-local ROW INDEX, and this one lands PAST the 7 map
    // rows on purpose: it is the appended Venus board. Pinning the number here
    // is what catches a future map that reorders its rows.
    const tagCells: Array<string> = [];
    UTOPIA_MARSBOT_BOARD.forEach((track) => {
      track.layout.forEach((action, position) => {
        if (action?.startsWith('tag_') === true) {
          tagCells.push(`${track.role}:${position}=${action}`);
        }
      });
    });
    expect(tagCells).deep.eq(['building:11=tag_7']);
    expect(VENUS_TRACK_INDEX, 'the Venus track is appended as the 8th row').eq(7);
    expect(UTOPIA_MARSBOT_BOARD.length, 'so the target sits past the map rows').eq(VENUS_TRACK_INDEX);
  });
});

describe('the UTOPIA PLANITIA map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.UTOPIA_PLANITIA);

  it('is a supported MarsBot board', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.UTOPIA_PLANITIA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
  });

  it('plays with B11, the Utopia Corporate Competition (Setup Guide v1.3 step 18)', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(marsBotMapProfile(BoardName.ELYSIUM).corporateCompetition,
      'Elysium keeps B10').eq(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(marsBotMapProfile(BoardName.HELLAS).corporateCompetition,
      'Hellas keeps B09').eq(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(marsBotMapProfile(BoardName.THARSIS).corporateCompetition,
      'Tharsis keeps B08').eq(BonusCardId.B08_CORPORATE_COMPETITION);
  });

  it('prints NO region step — its edge rule rides step 4 instead', () => {
    // Adding Expansions p.10: «On Utopia Planitia, edge spaces are considered
    // to have an additional reward icon FOR PURPOSES OF TIEBREAKERS» is a
    // bullet UNDER «cover the most reward icons», not a step of its own.
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['oceans', 'reward-icons']);
    expect(profile().tiebreakRewardBonus, 'the edge bullet is declared as data').is.not.undefined;
  });

  it('carries no Hellas/Elysium leakage', () => {
    const ids = profile().placementTiebreakers.map((t) => t.id);
    expect(ids, 'no Hellas polar step').to.not.include('polar-region');
    expect(ids, 'no Elysium southern step').to.not.include('southern-region');
    expect(profile().tracks).eq(UTOPIA_MARSBOT_BOARD);
    expect(marsBotMapProfile(BoardName.HELLAS).tiebreakRewardBonus,
      'and the edge bonus is Utopia\'s alone').is.undefined;
    expect(marsBotMapProfile(BoardName.ELYSIUM).tiebreakRewardBonus).is.undefined;
    expect(marsBotMapProfile(BoardName.THARSIS).tiebreakRewardBonus).is.undefined;
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
