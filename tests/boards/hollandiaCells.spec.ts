import {expect} from 'chai';
import {readFileSync} from 'node:fs';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {boardOptions} from '../../src/server/boards/randomBoard';
import {Space} from '../../src/server/boards/Space';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {milestoneManifest} from '../../src/server/milestones/Milestones';
import {awardManifest} from '../../src/server/awards/Awards';
import {LEGENDS} from '../../src/client/components/Legends';
import {SPECIAL_CELL_INFO, getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';
import {PREMIUM_MAPS} from '../../src/client/components/create/premium/createGameMeta';
import {cellDossierSections} from '@/client/console/cellDossier';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';

/**
 * HOLLANDIA in the premium scope for a HUMAN — read off the same game as the commit:
 *  · the board: 12 ocean reserves, 37 land cells, the 12 cells of the ASTEROID DEFLECTION ZONE (the north-east wedge),
 *    no volcano, only the five printed bonuses every map knows;
 *  · the zone's rule is the engine's ONE flag (`withinDeflectionZone` → `plantsAreProtected`), its standing state said
 *    per seat in the cell's dossier — a section of its own, the viewer first — and its change said in the journal;
 *  · ONE marker names the rule on the wedge's central cell; no legacy caption, no marker of another map;
 *  · the map draws its milestone / award set (no row of its own) and says so on its creator tile.
 */
const HOLLANDIA = {boardName: BoardName.HOLLANDIA} as const;
/** The zone by the BoardBuilder's row layout [5,6,7,8,9,8,7,6,5], idOffset=3. */
const ZONE_IDS = ['07', '12', '13', '18', '19', '20', '26', '27', '28', '35', '36', '37'];
const ZONE_CENTRE = '19';

describe('Hollandia — the board the premium scope stands on', () => {
  let game: IGame;
  let p1: TestPlayer;
  let p2: TestPlayer;

  beforeEach(() => {
    [game, p1, p2] = testGame(2, HOLLANDIA);
  });

  const zone = (): Array<Space> => game.board.spaces.filter((s) => s.spaceType === SpaceType.DEFLECTION_ZONE);
  const land = (): Array<Space> => game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
  const greenery = (player: TestPlayer, space: Space) => game.addTile(player, space, {tileType: TileType.GREENERY});

  it('cells: 12 ocean reserves · 37 land · the 12 cells of the zone — no volcano, no special bonus', () => {
    const mars = game.board.spaces.filter((s) => s.y >= 0 && s.y <= 8 && s.spaceType !== SpaceType.COLONY);
    const count = (type: SpaceType) => mars.filter((s) => s.spaceType === type).length;
    expect(count(SpaceType.OCEAN)).eq(12);
    expect(count(SpaceType.LAND)).eq(37);
    expect(zone().map((s) => s.id).sort()).deep.eq(ZONE_IDS);
    expect(mars.some((s) => s.volcanic === true)).is.false;
    const printed = new Set(mars.flatMap((s) => s.bonus));
    expect([...printed].sort()).deep.eq(
      [SpaceBonus.TITANIUM, SpaceBonus.STEEL, SpaceBonus.PLANT, SpaceBonus.DRAW_CARD, SpaceBonus.HEAT].sort());
    // The zone is land for every placement rule.
    expect(zone().every((s) => game.board.getAvailableSpacesOnLand(p1).includes(s))).is.true;
  });

  it('no milestone / award row of its own — every game draws five of each', () => {
    expect(milestoneManifest.boards[BoardName.HOLLANDIA]).deep.eq([]);
    expect(awardManifest.boards[BoardName.HOLLANDIA]).deep.eq([]);
    expect(game.milestones).has.length(5);
    expect(game.awards).has.length(5);
    expect(new Set(game.milestones.map((m) => m.name)).size).eq(5);
  });

  it('the draw is the game\'s own seeded stream — the same seed draws the same set, another seed another', () => {
    const names = (seed: number, suffix: string) => {
      const players = [TestPlayer.BLUE.newPlayer({idSuffix: suffix}), TestPlayer.RED.newPlayer({idSuffix: suffix})];
      const g = Game.newInstance(`game-id${suffix}`, players, players[0], `spectator-id${suffix}`, {...HOLLANDIA}, seed);
      return [...g.milestones.map((m) => m.name), ...g.awards.map((a) => a.name)].join(' · ');
    };
    expect(names(0.37, '-a')).eq(names(0.37, '-b'));
    const others = new Set([0.11, 0.23, 0.41, 0.59, 0.73].map((seed, i) => names(seed, `-s${i}`)));
    expect(others.size, 'five seeds do not all draw one set').is.greaterThan(1);
  });

  it('the zone shelters a seat while ALL its tiles are inside — and the journal names both edges', () => {
    const lines = () => game.gameLog.map((entry) => entry.message);
    greenery(p1, zone()[0]);
    expect(p1.withinDeflectionZone).is.true;
    expect(p1.plantsAreProtected()).is.true;
    expect(p2.plantsAreProtected()).is.false;
    expect(lines()).to.include('${0}\'s plants are now protected by the Deflection Zone');

    greenery(p1, land()[0]);
    expect(p1.plantsAreProtected()).is.false;
    expect(lines()).to.include('${0}\'s plants are no longer protected by the Deflection Zone');
  });

  it('the dossier of a zone cell: the rule, then every seat\'s standing — the viewer first — in a section of its own', () => {
    greenery(p1, zone()[0]);
    greenery(p2, land()[0]);
    const info = boardCellInfo(p1, zone()[3]);
    const status = (color: string) => info.facts.find((f) => f.id === `deflection-status-${color}`);
    expect(status(p1.color)?.title).eq('Plants are protected');
    expect(status(p1.color)?.severity).eq('positive');
    expect(status(p2.color)?.title).eq('No tiles in the zone');
    greenery(p2, zone()[5]);
    const after = boardCellInfo(p1, zone()[3]);
    expect(after.facts.find((f) => f.id === `deflection-status-${p2.color}`)?.title).eq('Tiles outside the zone');

    const sections = cellDossierSections(after, p1.color);
    const section = sections.find((s) => s.key === 'zone');
    expect(section, 'the zone\'s own section').is.not.undefined;
    expect(section!.titleKey).eq('Deflection Zone');
    // The rule is the lead row — its own sentence, never the section's title a second time.
    expect(section!.lead?.map((row) => row.label))
      .deep.eq(['Protects you from plant destruction while ALL your tiles are inside this zone.']);
    expect(section!.groups?.map((g) => g.recipient.kind), 'the viewer first, then the other seat').deep.eq(['current-player', 'player']);
    expect(section!.groups?.map((g) => g.rows.map((row) => row.label))).deep.eq([['Plants are protected'], ['Tiles outside the zone']]);
    // On the marker's cell the lore at the foot is the rule — the section keeps the seats alone.
    const marked = cellDossierSections(after, p1.color, {lore: true}).find((s) => s.key === 'zone');
    expect(marked?.lead).deep.eq([]);
    expect(marked?.groups).has.length(2);
    // …and nothing of the zone is left among the field rules.
    expect(sections.find((s) => s.key === 'rules')?.rows.some((row) => row.label === 'Deflection Zone') ?? false).is.false;
    // An ordinary land cell carries no zone section at all.
    expect(cellDossierSections(boardCellInfo(p1, land()[1]), p1.color).some((s) => s.key === 'zone')).is.false;
  });

  it('a placement says what it does to the viewer\'s shelter BEFORE the press', () => {
    const impact = (space: Space) => {
      const preview = boardCellPreview(p1, space, 'greenery');
      return [...preview.ruleFacts, ...preview.warningFacts].find((f) => f.id === 'deflection-impact');
    };
    expect(impact(zone()[0])?.description).eq('Activates protection from plant destruction (while all your tiles stay in the zone).');
    // The impact carries the zone's condition — the standing rule is not printed beside it a second time.
    const preview = boardCellPreview(p1, zone()[0], 'greenery');
    expect([...preview.ruleFacts, ...preview.warningFacts].filter((f) => f.title === 'Deflection Zone').map((f) => f.id)).deep.eq(['deflection-impact']);
    greenery(p1, zone()[0]);
    expect(impact(zone()[1])?.description).eq('Keeps your protection from plant destruction.');
    const leaving = impact(land()[0]);
    expect(leaving?.description).eq('Disables your protection from plant destruction (a tile outside the zone).');
    expect(leaving?.timing).eq('warning');
  });
});

describe('Hollandia — the marker, the catalog, the pools', () => {
  const markers = SPECIAL_CELL_INFO.filter((m) => m.boardName === BoardName.HOLLANDIA);

  it('ONE marker names the zone\'s rule, on the wedge\'s central cell — which prints no bonus under the «i»', () => {
    const [game] = testGame(2, HOLLANDIA);
    expect(markers.map((m) => m.spaceId)).deep.eq([ZONE_CENTRE]);
    const cell = game.board.getSpaceOrThrow(ZONE_CENTRE as never);
    expect(cell.spaceType).eq(SpaceType.DEFLECTION_ZONE);
    expect(cell.bonus).deep.eq([]);
    expect(markers[0].title).eq('Deflection Zone');
    // The dossier's own sentence — the marker and the rule row can never say two things.
    const rule = boardCellInfo(game.players[0], cell).facts.find((f) => f.id === 'deflection-zone');
    expect(markers[0].description).eq(rule?.description);
    expect(getSpecialCellInfo(ZONE_CENTRE as never, BoardName.HOLLANDIA)?.id).eq(markers[0].id);
  });

  it('no marker of another map leaks onto Hollandia, and its marker onto no other map', () => {
    const [game] = testGame(2, HOLLANDIA);
    const marked = game.board.spaces.filter((s) => s.y >= 0 && s.y <= 8 && s.spaceType !== SpaceType.COLONY)
      .filter((s) => getSpecialCellInfo(s.id, BoardName.HOLLANDIA) !== undefined).map((s) => s.id);
    expect(marked).deep.eq([ZONE_CENTRE]);
    for (const other of Object.values(BoardName).filter((b) => b !== BoardName.HOLLANDIA)) {
      expect(getSpecialCellInfo(ZONE_CENTRE as never, other)?.id, other).not.eq(markers[0].id);
    }
  });

  it('no legacy caption: nothing in LEGENDS, no Hollandia branch in Board.vue', () => {
    expect(LEGENDS[BoardName.HOLLANDIA]).deep.eq([]);
    expect(readFileSync('src/client/components/Board.vue', 'utf8')).not.to.match(/BoardName\.HOLLANDIA/);
  });

  it('the creator offers it as a fan map and says what it is — the zone, and the drawn set', () => {
    const row = PREMIUM_MAPS.find((m) => m.id === BoardName.HOLLANDIA);
    expect(row?.fan).is.true;
    expect(row?.descKey).to.match(/deflection zone/);
    expect(row?.descKey).to.match(/draws its set/);
    const ru = JSON.parse(readFileSync('src/locales/ru/create_game.json', 'utf8'));
    expect(JSON.stringify(ru)).to.include(row!.descKey);
  });

  it('it is in the random pools — and since 2026-11-06 in the bot\'s too', () => {
    expect(boardOptions(RandomBoardOption.ALL)).to.include(BoardName.HOLLANDIA);
    expect(boardOptions(RandomBoardOption.ALL, {automa: true})).to.include(BoardName.HOLLANDIA);
  });

  it('the zone is drawn in ONE hue in all three places — the field, the dossier\'s portrait, the creator\'s miniature', () => {
    const field = readFileSync('src/styles/board.less', 'utf8');
    const start = field.indexOf('.board-space-type-deflection-zone {');
    const block = field.slice(start, field.indexOf('.board-hidden-tile', start));
    expect(block, 'the field: the violet ground').to.include('rgba(148,108,236,0.24)');
    // The ground is mounted BEFORE the printed bonus — its clip-path makes it a painted layer, and last it washed the icons.
    const cell = readFileSync('src/client/components/BoardSpace.vue', 'utf8');
    expect(cell.indexOf('data-deflection-zone'), 'the zone\'s ground under the bonus').is.lessThan(cell.indexOf('<bonus :bonus="space.bonus"'));
    expect(block, 'the field: a kant over a covering tile, no fill').to.match(/deflection-zone--covered \{[^}]*fill='none'/);
    expect(block, 'the legacy yellow wash is gone').not.to.match(/251, 255, 16|255,240,140/);
    const fingerprint = readFileSync('src/client/components/create/premium/PremiumMapFingerprint.vue', 'utf8');
    expect(fingerprint).to.include('rgba(148, 108, 236, 0.30)');
    expect(fingerprint).to.include('\'map-fp__hex--zone\': s.t === SpaceType.DEFLECTION_ZONE');
    expect(readFileSync('src/styles/map_fingerprint.less', 'utf8')).to.include('.map-fp__hex--zone');
    expect(readFileSync('src/styles/console_cell_dossier.less', 'utf8')).to.match(/&--deflection \{ --cp-ground: radial-gradient\([^)]*#8f72c9/);
  });
});
