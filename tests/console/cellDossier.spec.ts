import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Message} from '../../src/common/logs/Message';
import {addCity, addGreenery} from '../TestingUtils';
import {
  cellDossierSections, cellIdentity, cellMarks, cellOwnVp, cellRing, litNeighbours,
} from '@/client/console/cellDossier';
import {buildDossierRows} from '@/client/console/placementDossier';
import {previewFacts, relationsFromInfo, relationsFromPreview} from '@/client/console/placementRelations';

/**
 * TR67 «КЛЕТКА — ОДНО ДОСЬЕ» — the inspection is the placement's dossier: the
 * hover's facts regrouped by INTENT on the same rows, the cell's OBJECT as the
 * title, the portrait's marks and own points, and the neighbour ring lit by the
 * SAME relation tones the field draws — over the real engine's answers, so a
 * change on either side that breaks «column ≡ field» goes red here.
 */
describe('cellDossier — the inspection on the placement\'s chassis (TR67)', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  const en = (key: string, params?: ReadonlyArray<string>) => (params ?? []).reduce((acc, p, i) => acc.replace(`\${${i}}`, p), key);
  const msg = (m: Message) => String(m.message);

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function land(predicate: (s: Space) => boolean = () => true): Space {
    const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching land');
    }
    return space;
  }
  const freeLandAround = (s: Space) => game.board.getAdjacentSpaces(s).filter((n) => n.spaceType === SpaceType.LAND && n.tile === undefined);

  it('an empty square with a bonus beside an ocean: ONE «when placing here» section — the printed bonus and the ocean money, the placement\'s own rows', () => {
    const target = land((s) => s.bonus.length > 0 && game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(target).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player2, ocean);
    const info = boardCellInfo(player, target);
    const sections = cellDossierSections(info, player.color);
    expect(sections.map((s) => s.key)).deep.eq(['gain']);
    expect(sections[0].titleKey).eq('When placing here');
    const labels = sections[0].rows.map((r) => r.label);
    expect(labels).includes('Cell bonus');
    expect(labels).includes('Next to an ocean');
    // The SAME rows the placement draws for the same facts (one builder, one vocabulary).
    const placement = buildDossierRows(boardCellPreview(player, target, 'land').immediateFacts.filter((f) => f.category === 'ocean-adjacency-bonus'));
    const mine = sections[0].rows.find((r) => r.label === 'Next to an ocean')!;
    expect(mine.delta).deep.eq(placement[0].delta);
    expect(cellIdentity(info, en, msg).title).eq('Land with a bonus');
  });

  it('the ring lights the paying ocean with what ONE ocean pays — and the field lights exactly the same neighbours', () => {
    const target = land((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(target).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player2, ocean);
    const info = boardCellInfo(player, target);
    const ring = cellRing(info.portrait, info.facts, player.color);
    expect(ring).has.length(6);
    const lit = ring.find((s) => s.piece?.space === ocean.id)!;
    expect(lit.tone).eq('ocean');
    expect(lit.chip?.delta).deep.eq({icon: 'megacredits', amount: player.oceanBonus, direction: 'gain'});
    const field = relationsFromInfo(info).map((r) => r.spaceId).filter((id) => game.board.getAdjacentSpaces(target).some((n) => n.id === id));
    expect(litNeighbours(ring).sort()).deep.eq([...field].sort());
  });

  it('a city: its endgame block grouped by recipient, its own points on the portrait, its greeneries lit gold at +1 each', () => {
    const city = land((s) => freeLandAround(s).length >= 2);
    addCity(player, city.id);
    const greens = freeLandAround(city).slice(0, 2);
    greens.forEach((g) => addGreenery(player, g.id));
    const info = boardCellInfo(player, city);
    const sections = cellDossierSections(info, player.color);
    const endgame = sections.find((s) => s.key === 'endgame')!;
    expect(endgame.groups?.map((g) => g.recipient.kind)).deep.eq(['current-player']);
    expect(cellOwnVp(info)).eq(2);
    const ring = cellRing(info.portrait, info.facts, player.color);
    const lit = ring.filter((s) => s.tone !== undefined);
    expect(lit.map((s) => s.piece?.space).sort()).deep.eq(greens.map((g) => g.id).sort());
    expect(lit.every((s) => s.tone === 'score' && s.chip?.vp === 1 && s.chip.for === undefined)).is.true;
    expect(cellIdentity(info, en, msg).title).eq('City');
  });

  it('a greenery beside a RIVAL\'s city: the city is named in the rival\'s group, lit in the ring with the rival\'s dot; the greenery\'s OWN point (classic rules) stays the portrait\'s', () => {
    const green = land((s) => freeLandAround(s).length >= 1);
    const rivalCity = freeLandAround(green)[0];
    addCity(player2, rivalCity.id);
    addGreenery(player, green.id);
    const info = boardCellInfo(player, green);
    const endgame = cellDossierSections(info, player.color).find((s) => s.key === 'endgame')!;
    const rival = endgame.groups?.find((g) => g.recipient.kind === 'tile-owner');
    expect(rival?.rows.map((r) => r.label)).deep.eq(['Adjacent cities']);
    const ring = cellRing(info.portrait, info.facts, player.color);
    const lit = ring.find((s) => s.piece?.space === rivalCity.id)!;
    expect(lit.tone).eq('score');
    expect(lit.chip).deep.eq({vp: 1, for: player2.color});
    // The greenery's OWN point (no parliament here: the classic +1) is the portrait's — never the city's.
    expect(cellOwnVp(info)).eq(1);
  });

  it('an ocean tile: what a tile placed BESIDE it receives is the cell\'s standing mechanic, not a field rule', () => {
    const reserve = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
    game.addOcean(player, reserve);
    const sections = cellDossierSections(boardCellInfo(player, reserve), player.color);
    expect(sections.map((s) => s.key)).includes('tile');
    expect(sections.find((s) => s.key === 'tile')!.titleKey).eq('When placed adjacent');
  });

  it('a tile over a printed bonus: «под тайлом» names the CELL BONUS, never the section\'s words twice', () => {
    const space = land((s) => s.bonus.some((b) => b === SpaceBonus.PLANT || b === SpaceBonus.STEEL || b === SpaceBonus.TITANIUM));
    addGreenery(player, space.id);
    const under = cellDossierSections(boardCellInfo(player, space), player.color).find((s) => s.key === 'uncovers')!;
    expect(under.titleKey).eq('Under the tile');
    expect(under.rows.every((r) => r.label === 'Cell bonus')).is.true;
  });

  it('a city STACK reads one endgame row per tier — two statements with other params never merge into «×2»', () => {
    const city = land((s) => freeLandAround(s).length >= 1);
    addCity(player, city.id);
    city.stackHeight = 2;
    addGreenery(player, freeLandAround(city)[0].id);
    const endgame = cellDossierSections(boardCellInfo(player, city), player.color).find((s) => s.key === 'endgame')!;
    const tiers = endgame.rows.filter((r) => r.label === 'Tier ${0} of ${1} scores for adjacent greeneries');
    expect(tiers.map((r) => r.params)).deep.eq([['1', '2'], ['2', '2']]);
    expect(tiers.every((r) => r.count === 1)).is.true;
  });

  it('a special tile is titled by its own name; a city over its water and a stack carry marks, not rows', () => {
    const space = land();
    game.simpleAddTile(player, space, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
    const info = boardCellInfo(player, space);
    const id = cellIdentity(info, en, msg);
    expect(id.title).eq('Capital');
    expect(id.special).is.true;
    expect(cellMarks({...info, portrait: {...info.portrait!, under: TileType.OCEAN, stackHeight: 2}}).map((m) => m.key))
      .deep.eq(['Ocean under the city', 'Stack of ${0}']);
  });

  it('a placement\'s ring is lit by the PREVIEW — the field\'s set, no more', () => {
    const target = land((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(target).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player2, ocean);
    const preview = boardCellPreview(player, target, 'greenery');
    const ring = cellRing(boardCellInfo(player, target).portrait, previewFacts(preview), player.color);
    const field = relationsFromPreview(preview).map((r) => r.spaceId).filter((id) => game.board.getAdjacentSpaces(target).some((n) => n.id === id));
    expect(litNeighbours(ring).sort()).deep.eq([...field].sort());
    expect(litNeighbours(ring)).includes(ocean.id);
  });

  it('no portrait (an older payload) → no ring, never a throw', () => {
    const info = boardCellInfo(player, land());
    expect(cellRing(undefined, info.facts)).deep.eq([]);
  });
});
