import {expect} from 'chai';
import {readFileSync} from 'node:fs';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';
import {ArabiaTerraBoard} from '../../src/server/boards/ArabiaTerraBoard';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {boardOptions} from '../../src/server/boards/randomBoard';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {newProjectCard} from '../../src/server/createCard';
import {IGame} from '../../src/server/IGame';
import {LEGENDS} from '../../src/client/components/Legends';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/**
 * ARABIA TERRA in the premium scope for a HUMAN — read off the same game as the commit:
 *  · a COVE says its rule (an ocean or a land tile), beside the volcanic rule on the volcanic cove;
 *  · the printed DATA / SCIENCE bonuses land on a card — with no card to hold them the dossier names the loss BEFORE
 *    the press and the commit skips them by name; with a holder they land;
 *  · the energy-production cove pays its production;
 *  · the four volcanic cells wear markers under the names the BOARD ITSELF printed (Tikhonarov, Ladon, Flaugergues,
 *    Charybdis — the last legacy SVG captions, hardcoded in `Board.vue` outside `LEGENDS`, are gone);
 *  · the map is in the «random (all)» pool (it was excluded until these bonuses were adapted).
 */
const ARABIA = {boardName: BoardName.ARABIA_TERRA} as const;
const DATA_CELL = '16';
const SCIENCE_CELL = '34';
const ENERGY_COVE = '32';
const VOLCANIC_COVE = '20';

function facts(player: TestPlayer, id: string) {
  return boardCellInfo(player, player.game.board.getSpaceOrThrow(id as never)).facts;
}

describe('Arabia Terra — a cove says what it is', () => {
  it('a cove\'s dossier carries the rule: an ocean tile or a land tile', () => {
    const [, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const cove = facts(player, '44').find((f) => f.id === 'cove');
    expect(cove?.title).eq('Cove');
    expect(cove?.description).eq('An ocean tile or a land tile may be placed here.');
    expect(facts(player, '05').some((f) => f.id === 'cove'), 'a land cell is no cove').is.false;
  });

  it('the VOLCANIC cove says both rules', () => {
    const [, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const ids = facts(player, VOLCANIC_COVE).map((f) => f.id);
    expect(ids).to.include('cove');
    expect(ids).to.include('volcanic');
  });

  it('the rule is told in a PLACEMENT too — for an ocean and for a greenery alike — and is gone once a tile covers it', () => {
    const [game, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const cove = game.board.getSpaceOrThrow('44');
    for (const kind of ['ocean', 'greenery'] as const) {
      const preview = boardCellPreview(player, cove, kind);
      expect(preview.legal, kind).is.true;
      expect(preview.ruleFacts.some((f) => f.id === 'cove'), kind).is.true;
    }
    game.addOcean(player, cove);
    expect(boardCellInfo(player, cove).facts.some((f) => f.id === 'cove'), 'a covered cove needs no placement rule').is.false;
  });
});

describe('Arabia Terra — the printed data / science / energy-production bonuses for a human', () => {
  it('DATA with NO holder: the dossier names the loss, and the commit skips it by name', () => {
    const [game, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const cell = game.board.getSpaceOrThrow(DATA_CELL);
    expect(cell.bonus).to.include(SpaceBonus.DATA);
    expect(player.getResourceCards(CardResource.DATA), 'the fixture: no data holder').is.empty;
    const skipped = facts(player, DATA_CELL).find((f) => f.id === 'printed-card-resource-skipped');
    expect(skipped?.description).eq('No card of yours can hold it — this bonus will be skipped.');
    const logs = game.gameLog.length;
    game.addGreenery(player, cell);
    runAllActions(game);
    expect(player.popWaitingFor(), 'nothing is asked').is.undefined;
    expect(cell.tile?.tileType).eq(TileType.GREENERY);
    expect(game.gameLog.slice(logs).some((l) => /skipped|no eligible/i.test(l.message)), 'the skip is told').is.true;
  });

  it('SCIENCE with a holder: no skip line, and the commit lands it on the card', () => {
    const [game, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const holder = newProjectCard(CardName.OLYMPUS_CONFERENCE)!;
    player.playedCards.push(holder);
    expect(facts(player, SCIENCE_CELL).map((f) => f.id)).to.not.include('printed-card-resource-skipped');
    game.addGreenery(player, game.board.getSpaceOrThrow(SCIENCE_CELL));
    runAllActions(game);
    expect(holder.resourceCount, 'one science per printed icon').eq(1);
  });

  it('SCIENCE with NO holder reads the same named loss', () => {
    const [, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    expect(facts(player, SCIENCE_CELL).map((f) => f.id)).to.include('printed-card-resource-skipped');
  });

  it('the ENERGY-PRODUCTION cove pays one production — as a land tile and as an ocean', () => {
    for (const kind of ['greenery', 'ocean'] as const) {
      const [game, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
      const cove = game.board.getSpaceOrThrow(ENERGY_COVE);
      const before = player.production.energy;
      if (kind === 'ocean') {
        game.addOcean(player, cove);
      } else {
        game.addGreenery(player, cove);
      }
      runAllActions(game);
      expect(player.production.energy, kind).eq(before + 1);
    }
  });
});

describe('Arabia Terra — the cell markers sit on the cells that earn them', () => {
  const board = ArabiaTerraBoard.newInstance(DEFAULT_GAME_OPTIONS, new SeededRandom(0));
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.ARABIA_TERRA);

  it('every volcanic cell is named — by the names the board printed — and every marker sits on a volcanic cell', () => {
    const volcanic = board.spaces.filter((s) => s.volcanic === true).map((s) => s.id).sort();
    expect(volcanic).deep.eq(['20', '55', '58', '63']);
    expect(markers.map((m) => m.spaceId).sort()).deep.eq(volcanic);
    expect(Object.fromEntries(markers.map((m) => [m.spaceId, m.title]))).deep.eq({
      '20': 'Tikhonarov', '55': 'Ladon', '58': 'Flaugergues', '63': 'Charybdis',
    });
    for (const marker of markers) {
      expect(marker.description, marker.id).contains('potential volcano spot');
    }
    expect(new Set(markers.map((m) => m.id)).size, 'unique ids').eq(markers.length);
    // Tikhonarov is the volcanic COVE — its marker names the place, its dossier both rules.
    expect(board.getSpaceOrThrow('20').spaceType).eq(SpaceType.COVE);
  });

  it('no other cove is given a name, and NO legacy caption is left — neither in LEGENDS nor hardcoded in Board.vue', () => {
    for (const cove of board.spaces.filter((s) => s.spaceType === SpaceType.COVE && s.volcanic !== true)) {
      expect(getSpecialCellInfo(cove.id, BoardName.ARABIA_TERRA), cove.id).is.undefined;
    }
    expect(LEGENDS[BoardName.ARABIA_TERRA]).deep.eq([]);
    // The four names lived as hardcoded <tspan>s in the board template, outside LEGENDS — which is exactly how a
    // «no captions» check that read LEGENDS alone passed over them. The template may name no board any more.
    const template = readFileSync('src/client/components/Board.vue', 'utf8');
    expect(template, 'no per-board caption block in the template').to.not.match(/v-if="boardName === BoardName\.[A-Z_]+"[\s\S]{0,200}board-caption/);
    for (const name of ['Tikhonarov', 'Ladon', 'Flaugergues', 'Charybdis']) {
      expect(template, name).to.not.contain(name);
    }
  });

  it('no marker of another map leaks onto Arabia Terra', () => {
    for (const m of SPECIAL_CELL_INFO.filter((m) => m.boardName !== undefined && m.boardName !== BoardName.ARABIA_TERRA)) {
      expect(getSpecialCellInfo(m.spaceId, BoardName.ARABIA_TERRA)?.id, m.id).not.eq(m.id);
    }
  });
});

describe('Arabia Terra — a cove is TWO surfaces wherever it is drawn', () => {
  it('the portrait piece carries the square\'s kind AND its volcanic mark — the client draws the two halves from it', () => {
    const [game, player] = testGame(1, ARABIA) as [IGame, TestPlayer];
    const piece = (id: string) => boardCellInfo(player, game.board.getSpaceOrThrow(id as never)).portrait;
    expect(piece('44')).to.include({spaceType: SpaceType.COVE});
    expect(piece('44'), 'a plain cove is not volcanic').to.not.have.property('volcanic');
    expect(piece(VOLCANIC_COVE), 'Tikhonarov: a cove AND volcanic').to.include({spaceType: SpaceType.COVE, volcanic: true});
    expect(piece('55'), 'a volcanic land cell').to.include({spaceType: SpaceType.LAND, volcanic: true});
    expect(piece('05'), 'plain land').to.not.have.property('volcanic');
    // …and a neighbour in the ring is the same piece (the ring of 19 holds the volcanic cove 20).
    const ring = piece('19')?.neighbours.filter((n) => n !== null).map((n) => [n?.space, n?.volcanic === true]) ?? [];
    expect(ring).to.deep.include(['20', true]);
  });

  it('the field, the portrait and the creator\'s miniature all draw the OCEAN half — a volcanic cove too', () => {
    const board = readFileSync('src/styles/board.less', 'utf8');
    const dossier = readFileSync('src/styles/console_cell_dossier.less', 'utf8');
    const OCEAN_HALF = 'rgba(70,170,225,0.32)';
    for (const type of ['cove', 'volcanic-cove']) {
      const rule = new RegExp(`\\.board-space-type-${type} \\{[^}]*\\}`).exec(board.replace(/@\{[\w-]+\}/g, 'VAR'))?.[0] ?? '';
      expect(rule, `the field's ${type}: the left half is water`).to.include(`<polygon points='23,1 23,50 1.5,37.7 1.5,13.3' fill='${OCEAN_HALF}'/>`);
      expect(rule, `the field's ${type}: the divider`).to.include('<line x1=\'23\' y1=\'1\' x2=\'23\' y2=\'50\'');
    }
    // The volcanic cove's LAND half is volcanic — and nothing washes the whole cell red any more.
    const volcanic = new RegExp('\\.board-space-type-volcanic-cove \\{[^}]*\\}').exec(board.replace(/@\{[\w-]+\}/g, 'VAR'))?.[0] ?? '';
    expect(volcanic).to.include('<polygon points=\'23,1 44.5,13.3 44.5,37.7 23,50\'');
    expect(volcanic, 'no whole-cell wash over the water').to.not.match(/background-color/);
    // The portrait: both cove grounds are an ocean half (left) and a land half (right) with the divider.
    for (const ground of ['cove', 'cove-volcanic']) {
      const rule = new RegExp(`&--${ground} \\{[^}]*\\}`).exec(dossier)?.[0] ?? '';
      expect(rule, `the portrait's ${ground}: the ocean half`).to.match(/#3f86b8[^;]*left \/ 50% 100% no-repeat/);
      expect(rule, `the portrait's ${ground}: the land half`).to.match(/right \/ 50% 100% no-repeat/);
    }
    const portrait = readFileSync('src/client/components/console/ConsoleCellPortrait.vue', 'utf8');
    expect(portrait).to.include('con-cellp__hex--cove-volcanic').and.include('con-cellp__hex--volcanic');
    // The miniature: a half-hex of ocean over the cove's land tone.
    const mini = readFileSync('src/client/components/create/premium/PremiumMapFingerprint.vue', 'utf8');
    expect(mini).to.include('map-fp__hex-half').and.include('hexLeftHalf');
  });
});

describe('Arabia Terra — the random pool', () => {
  it('is rolled by «random (all)» — for a human game and for a MarsBot game', () => {
    expect(boardOptions(RandomBoardOption.ALL)).to.include(BoardName.ARABIA_TERRA);
    expect(boardOptions(RandomBoardOption.ALL, {automa: true})).to.include(BoardName.ARABIA_TERRA);
  });
});
