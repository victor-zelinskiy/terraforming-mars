import {expect} from 'chai';
import {boardInfoState, buildBoardCellUrl, configureBoardInfo} from '@/client/components/board/boardInfoState';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';

/**
 * WHAT THE DOSSIER ASKS THE SERVER — the board-cell-preview URL. Two of its
 * parameters change what the server answers for the SAME cell, and a client
 * that forgets either gets a confident wrong panel rather than an error:
 *
 *   `staged=1` — the cell is picked BEFORE the card is paid (a staged play),
 *     so every affordability fact is judged against the money left AFTER the
 *     card's own price. The route always supported it; for a long while no
 *     client sent it, and a staged dossier called an Ares cleanup «affordable»
 *     against the whole wallet.
 *   `from=<cell>` — a MOVE's lifted city (Turmoil Redux TR14): the cell is read
 *     as that city's DESTINATION; without it, as the SOURCE.
 */
describe('boardCellPreviewUrl', () => {
  const saved = {...boardInfoState.cfg};

  beforeEach(() => {
    configureBoardInfo({participantId: 'p-blue', color: 'blue', boardName: BoardName.THARSIS, players: []});
  });

  after(() => {
    Object.assign(boardInfoState.cfg, saved);
  });

  function params(url: string | undefined): URLSearchParams {
    expect(url, 'configured — a URL is built').to.be.a('string');
    return new URLSearchParams((url as string).split('?')[1]);
  }

  it('a plain hover carries the cell and the perspective, nothing else', () => {
    const p = params(buildBoardCellUrl('10'));
    expect(p.get('space')).to.equal('10');
    expect(p.get('id')).to.equal('p-blue');
    expect(p.get('color')).to.equal('blue');
    for (const key of ['kind', 'cleared', 'tile', 'card', 'effect', 'staged', 'from']) {
      expect(p.has(key), key).to.be.false;
    }
  });

  it('`staged` is sent ONLY when asked, beside the card it prices', () => {
    const live = params(buildBoardCellUrl('10', 'city', false, TileType.CITY, CardName.ADMINISTRATION_DISTRICT));
    expect(live.has('staged')).to.be.false;
    const staged = params(buildBoardCellUrl('10', 'city', false, TileType.CITY, CardName.ADMINISTRATION_DISTRICT, undefined, true));
    expect(staged.get('staged')).to.equal('1');
    expect(staged.get('card'), 'the price folded in is this card\'s').to.equal(CardName.ADMINISTRATION_DISTRICT);
  });

  it('a MOVE: the kind and the effect ride every request; `from` only once a city is lifted', () => {
    const source = params(buildBoardCellUrl('10', 'city-move', false, TileType.CITY, CardName.RE_SETTLEMENT, 'move', true));
    expect(source.get('kind')).to.equal('city-move');
    expect(source.get('effect')).to.equal('move');
    expect(source.has('from'), 'the SOURCE reading — the city under the cursor').to.be.false;
    const destination = params(buildBoardCellUrl('11', 'city-move', false, TileType.CITY, CardName.RE_SETTLEMENT, 'move', true, '10'));
    expect(destination.get('space')).to.equal('11');
    expect(destination.get('from'), 'the DESTINATION reading of that city').to.equal('10');
    expect(destination.get('staged')).to.equal('1');
  });

  it('a reward THE CELL DECIDES (TR21): the staged greenery asks as its card — the target never rides the URL', () => {
    const p = params(buildBoardCellUrl('17', 'greenery', false, TileType.GREENERY, CardName.ARBORETUM, undefined, true));
    expect(p.get('card'), 'the card\'s own hook answers «+N data · for N adjacent cities» on this cell').to.equal(CardName.ARBORETUM);
    expect(p.get('staged')).to.equal('1');
    // The chosen holder is the CLIENT's to add (its count + the server's amount): one answer per cell, cached as such.
    expect([...p.keys()].sort()).to.deep.equal(['card', 'color', 'id', 'kind', 'space', 'staged', 'tile']);
  });

  it('the default effect is not sent (both sides default to a tile)', () => {
    expect(params(buildBoardCellUrl('10', 'city', false, TileType.CITY, undefined, 'tile')).has('effect')).to.be.false;
    expect(params(buildBoardCellUrl('10', 'land', false, undefined, undefined, 'marker')).get('effect')).to.equal('marker');
  });

  it('before configuration there is no URL at all', () => {
    const id = boardInfoState.cfg.participantId;
    boardInfoState.cfg.participantId = undefined;
    expect(buildBoardCellUrl('10', 'city')).to.be.undefined;
    boardInfoState.cfg.participantId = id;
  });
});
