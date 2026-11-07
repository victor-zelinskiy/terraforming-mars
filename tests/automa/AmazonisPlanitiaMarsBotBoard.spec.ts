import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {BonusCardId, MARSBOT_EXTENDED_TRACK_POSITION, MARSBOT_MAX_TRACK_POSITION, TrackAction, TrackDefinition} from '../../src/common/automa/AutomaTypes';
import {Tag} from '../../src/common/cards/Tag';
import {Resource} from '../../src/common/Resource';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {
  AMAZONIS_PLANITIA_COLONY_CELLS, AMAZONIS_PLANITIA_MARSBOT_BOARD, AMAZONIS_PLANITIA_TAILS, AMAZONIS_PLANITIA_TAIL_START, AMAZONIS_PLANITIA_TRACK,
  AMAZONIS_PLANITIA_VENUS_END, AMAZONIS_PLANITIA_VENUS_TRACK, amazonisPlanitiaVenusTrackFor,
} from '../../src/server/automa/boards/AmazonisPlanitiaMarsBot';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK} from '../../src/server/automa/boards/VenusMarsBot';
import {isExtendedTrack, matBody, matTail, matViolations, tailViolations} from '../../src/server/automa/ma/matLaw';

/**
 * THE AMAZONIS PLANITIA MARSBOT BOARD — the first EXTENDED board (docs/claude/amazonis-planitia-marsbot.md,
 * docs/AUTOMA_DATA_AUDIT.md §2k): 25-cell rows (0–24). The BODY (0–18) is the Tharsis board by the law of the six
 * official boards — plus the module's three colony cubes for Constructor, printed as `colony5` cells; the LATE RESERVE
 * (19–24) is the map's own, by the law of the reserve. Every cell is pinned here: a cell is a fact about the board.
 */
const _ = undefined;

/** The designed reserve, row by row (the body is Tharsis' — pinned against the Tharsis file below). */
const RESERVE: ReadonlyArray<{role: string, cells: ReadonlyArray<TrackAction>}> = [
  {role: 'building', cells: ['advance', 'city', 'tr3', 'temperature', 'greenery', 'tr6']},
  {role: 'space', cells: ['advance', 'temperature2', 'tr3', 'ocean', 'temperature', 'tr7']},
  {role: 'event', cells: ['advance', 'greenery', 'tr3', 'temperature', 'ocean', 'tr6']},
  {role: 'science', cells: ['advance', 'temperature', 'tr4', 'ocean', 'temperature2', 'tr8']},
  {role: 'power', cells: ['advance', 'greenery', 'tr4', 'city', 'temperature', 'tr8']},
  {role: 'earth', cells: ['advance', 'temperature', 'tr3', 'greenery', 'ocean', 'tr8']},
  {role: 'bio', cells: ['advance', 'greenery', 'tr3', 'greenery', 'temperature', 'tr7']},
];

function count(board: ReadonlyArray<TrackDefinition>, action: TrackAction | 'tag' | 'empty', from = 0, to = Infinity): number {
  let n = 0;
  for (const track of board) {
    track.layout.forEach((cell, i) => {
      if (i < from || i > to) {
        return;
      }
      const key = cell === undefined ? 'empty' : cell.startsWith('tag_') ? 'tag' : cell;
      if (key === action) {
        n++;
      }
    });
  }
  return n;
}

function totalTr(board: ReadonlyArray<TrackDefinition>, from = 0, to = Infinity): number {
  let n = 0;
  for (const track of board) {
    track.layout.forEach((cell, i) => {
      if (i >= from && i <= to && cell !== undefined && /^tr\d$/.test(cell)) {
        n += Number(cell.substring(2));
      }
    });
  }
  return n;
}

describe('AMAZONIS PLANITIA MarsBot board — the extended component, cell by cell', () => {
  const board = AMAZONIS_PLANITIA_MARSBOT_BOARD;

  it('has the 7 printed tracks, in the shared role order, each of 25 cells ending on 24', () => {
    expect(board).has.length(7);
    expect(board.map((t) => t.role)).deep.eq(THARSIS_MARSBOT_BOARD.map((t) => t.role));
    for (const track of board) {
      expect(track.layout, track.role).has.length(MARSBOT_EXTENDED_TRACK_POSITION + 1);
      expect(track.maxPosition, track.role).eq(MARSBOT_EXTENDED_TRACK_POSITION);
      expect(isExtendedTrack(track), track.role).is.true;
      expect(track.layout[0], `${track.role}: the start is empty`).eq(_);
    }
    expect(AMAZONIS_PLANITIA_TAIL_START).eq(MARSBOT_MAX_TRACK_POSITION + 1);
  });

  it('the AMAZONIS_PLANITIA_TRACK indexes name the rows they sit on', () => {
    for (const [name, index] of Object.entries(AMAZONIS_PLANITIA_TRACK)) {
      expect(board[index].role.toUpperCase(), `${name} is row ${index}`).eq(name);
    }
  });

  it('the BODY is the Tharsis board — Jovian on Power, City on Earth, the Microbe on bio; the badges Tharsis\' — plus the three colony cubes', () => {
    board.forEach((track, i) => {
      const tharsis = THARSIS_MARSBOT_BOARD[i];
      expect(track.tags, track.role).deep.eq(tharsis.tags);
      expect(track.productions, track.role).deep.eq(tharsis.productions);
      const body = matBody(track);
      expect(body.layout, `${track.role}: the body is 19 cells`).has.length(19);
      expect(body.maxPosition, 'the body is a printed-format row').is.undefined;
      const diffs: Array<string> = [];
      body.layout.forEach((cell, k) => {
        if (cell !== tharsis.layout[k]) {
          diffs.push(`${k}:${tharsis.layout[k] ?? 'empty'}→${cell ?? 'empty'}`);
        }
      });
      const colonies = AMAZONIS_PLANITIA_COLONY_CELLS.filter((c) => c.track === i).map((c) => `${c.at}:empty→colony5`);
      expect(diffs, `${track.role} differs from Tharsis only by its colony cubes`).deep.eq(colonies);
    });
    expect(AMAZONIS_PLANITIA_COLONY_CELLS).deep.eq([{track: 1, at: 4}, {track: 1, at: 10}, {track: 4, at: 8}]);
    const b = new MarsBotBoard(board);
    expect(b.getTrackIndexForTag(Tag.JOVIAN)).eq(AMAZONIS_PLANITIA_TRACK.POWER);
    expect(b.getTrackIndexForTag(Tag.CITY)).eq(AMAZONIS_PLANITIA_TRACK.EARTH);
    expect(b.getTrackIndexForTag(Tag.MICROBE)).eq(AMAZONIS_PLANITIA_TRACK.BIO);
    expect(b.getTrackIndexForTag(Tag.SCIENCE), 'Physicist reads science + space: the science row carries nothing else').eq(AMAZONIS_PLANITIA_TRACK.SCIENCE);
    expect(board[AMAZONIS_PLANITIA_TRACK.SCIENCE].tags).deep.eq([Tag.SCIENCE]);
    expect(b.getTrackIndexForProduction(Resource.STEEL)).eq(AMAZONIS_PLANITIA_TRACK.BUILDING);
    expect(b.getTrackIndexForProduction(Resource.ENERGY)).eq(AMAZONIS_PLANITIA_TRACK.POWER);
  });

  RESERVE.forEach((row, index) => {
    describe(`the ${row.role} track's late reserve`, () => {
      it(`is cells ${AMAZONIS_PLANITIA_TAIL_START}–${MARSBOT_EXTENDED_TRACK_POSITION}: ${row.cells.join(' · ')}`, () => {
        expect(board[index].role).eq(row.role);
        expect(matTail(board[index])).deep.eq(row.cells);
        expect(AMAZONIS_PLANITIA_TAILS[index]).deep.eq(row.cells);
        row.cells.forEach((cell, k) => {
          expect(board[index].layout[AMAZONIS_PLANITIA_TAIL_START + k], `${row.role} ${AMAZONIS_PLANITIA_TAIL_START + k}`).eq(cell);
        });
      });
    });
  });

  it('the body keeps the law of the six boards: 10 oceans, 13 + 1 temperature, 15 greeneries, 10 cities, 4 + 4 cells, ΣTR 82, the ends', () => {
    const bodies = board.map(matBody);
    expect(matViolations(bodies)).deep.eq([]);
    expect(count(bodies, 'ocean')).eq(10);
    expect(count(bodies, 'temperature')).eq(13);
    expect(count(bodies, 'temperature2')).eq(1);
    expect(count(bodies, 'greenery')).eq(15);
    expect(count(bodies, 'city')).eq(10);
    expect(count(bodies, 'milestone')).eq(4);
    expect(count(bodies, 'award')).eq(4);
    expect(count(bodies, 'colony5'), 'Constructor\'s cubes').eq(3);
    expect(count(bodies, 'empty'), 'Tharsis\' 37 less the three cubes').eq(34);
    expect(count(bodies, 'advance')).eq(15);
    expect(totalTr(bodies)).eq(82);
    expect(bodies.map((t) => t.layout[18])).deep.eq(['tr5', 'tr6', 'tr5', 'tr7', 'tr8', 'tr7', 'tr6']);
    const find = (action: TrackAction) => bodies.map((t) => t.layout.indexOf(action));
    expect(find('milestone')).deep.eq([7, 8, -1, 9, 7, -1, -1]);
    expect(find('award')).deep.eq([9, -1, 10, -1, -1, 9, 10]);
  });

  it('the late reserve keeps ITS law: no empty cell, an «advance» first, a TR end, 4 oceans · 6 greeneries · 2 cities · 7 + 2 temperature, ΣTR 73', () => {
    expect(tailViolations(board)).deep.eq([]);
    expect(matViolations(board), 'the whole board — body law + reserve law').deep.eq([]);
    const from = AMAZONIS_PLANITIA_TAIL_START;
    expect(count(board, 'empty', from)).eq(0);
    expect(count(board, 'advance', from)).eq(7);
    expect(count(board, 'ocean', from)).eq(4);
    expect(count(board, 'greenery', from)).eq(6);
    expect(count(board, 'city', from)).eq(2);
    expect(count(board, 'temperature', from)).eq(7);
    expect(count(board, 'temperature2', from)).eq(2);
    expect(count(board, 'milestone', from) + count(board, 'award', from) + count(board, 'colony5', from)).eq(0);
    expect(totalTr(board, from)).eq(73);
    expect(board.map((t) => t.layout[MARSBOT_EXTENDED_TRACK_POSITION])).deep.eq(['tr6', 'tr7', 'tr6', 'tr8', 'tr8', 'tr8', 'tr7']);
    expect(board.every((t) => t.layout[AMAZONIS_PLANITIA_TAIL_START] === 'advance'), 'the push into the reserve').is.true;
  });

  it('the whole board prints what the map\'s longer parameters ask for: 14 oceans (11), 26 temperature steps (22), 21 greeneries (18 %), 12 cities, ΣTR 155', () => {
    expect(count(board, 'ocean')).eq(14);
    expect(count(board, 'temperature') + 2 * count(board, 'temperature2')).eq(26);
    expect(count(board, 'greenery')).eq(21);
    expect(count(board, 'city')).eq(12);
    expect(totalTr(board)).eq(155);
  });

  it('a mixed format is no mat — and the law still refuses a reserve with an empty cell or no «advance» first', () => {
    expect(matViolations([board[0], ...THARSIS_MARSBOT_BOARD.slice(1)])[0]).to.match(/^mixed formats/);
    const holed: TrackDefinition = {...board[0], layout: board[0].layout.map((c, i) => (i === 20 ? undefined : c))};
    expect(tailViolations([holed, ...board.slice(1)])).to.include('building: reserve cell 20 is empty');
    const flat: TrackDefinition = {...board[0], layout: board[0].layout.map((c, i) => (i === 19 ? 'tr3' : c))};
    expect(tailViolations([flat, ...board.slice(1)]).some((v) => v.startsWith('building: the reserve opens with'))).is.true;
  });
});

describe('AMAZONIS PLANITIA MarsBot board — the Venus row for a Venus that runs to 33 %', () => {
  it('is the printed row with its end re-cut: 16 cells, 7 Venus steps (the printed row: 13 cells, 4 steps), the +5 TR at 15', () => {
    const row = AMAZONIS_PLANITIA_VENUS_TRACK;
    expect(row.role).eq('venus');
    expect(row.layout).has.length(AMAZONIS_PLANITIA_VENUS_END + 1);
    expect(row.maxPosition).eq(AMAZONIS_PLANITIA_VENUS_END);
    expect(row.layout.slice(0, 12)).deep.eq(VENUS_TRACK.layout.slice(0, 12));
    expect(row.layout.slice(12)).deep.eq(['venus', 'advance', 'venus2', 'tr5']);
    expect(row.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    expect(row.microbeTagCells).deep.eq([9]);
    const venusSteps = (r: TrackDefinition) => r.layout.filter((c) => c === 'venus').length + 2 * r.layout.filter((c) => c === 'venus2').length;
    expect(venusSteps(row)).eq(7);
    expect(venusSteps(VENUS_TRACK)).eq(4);
  });

  it('follows the Microbe tag to whatever row a generated mat gives it', () => {
    expect(amazonisPlanitiaVenusTrackFor(3).layout[9]).eq('tag_3');
    expect(amazonisPlanitiaVenusTrackFor(3).layout.slice(12)).deep.eq(['venus', 'advance', 'venus2', 'tr5']);
  });
});

describe('the AMAZONIS PLANITIA map profile', () => {
  const profile = () => marsBotMapProfile(BoardName.AMAZONIS_PLANITIA);

  it('is a supported MarsBot board — the last map of the game to join', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.AMAZONIS_PLANITIA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());
    expect(profile().boardName).eq(BoardName.AMAZONIS_PLANITIA);
    expect(profile().tracks).eq(AMAZONIS_PLANITIA_MARSBOT_BOARD);
    expect(profile().borrowedBoard, 'its own board, not a loan').is.undefined;
  });

  it('plays with the fork\'s own BF5 Corporate Competition — and nobody else does', () => {
    expect(profile().corporateCompetition).eq(BonusCardId.BF5_CORPORATE_COMPETITION_AMAZONIS_PLANITIA);
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.AMAZONIS_PLANITIA)) {
      expect(marsBotMapProfile(board).corporateCompetition, board).not.eq(BonusCardId.BF5_CORPORATE_COMPETITION_AMAZONIS_PLANITIA);
    }
  });

  it('ranks oceans → reward icons — no step of its own (no criterion of the row counts where its tiles stand); its own Venus row', () => {
    expect(profile().placementTiebreakers.map((t) => t.id)).deep.eq(['oceans', 'reward-icons']);
    expect(profile().tiebreakRewardBonus).is.undefined;
    expect(profile().venusTrack).eq(AMAZONIS_PLANITIA_VENUS_TRACK);
    expect(profile().venusTrackFor).eq(amazonisPlanitiaVenusTrackFor);
  });

  it('is the ONLY extended board — every other map prints the 19-cell format', () => {
    for (const board of MARSBOT_BOARDS.filter((b) => b !== BoardName.AMAZONIS_PLANITIA)) {
      for (const track of marsBotMapProfile(board).tracks) {
        expect(isExtendedTrack(track), `${board} ${track.role}`).is.false;
        expect(track.layout, `${board} ${track.role}`).has.length(MARSBOT_MAX_TRACK_POSITION + 1);
      }
    }
  });
});
