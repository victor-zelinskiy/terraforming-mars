import {expect} from 'chai';
import {BoardName} from '../../../src/common/boards/BoardName';
import {Tag} from '../../../src/common/cards/Tag';
import {BonusCardId} from '../../../src/common/automa/AutomaTypes';
import {AUTOMA_SUPPORTED_BOARDS} from '../../../src/common/automa/automaCompatibility';
import {buildBonusCardView} from '../../../src/common/automa/BonusCardData';
import {MARSBOT_BOARDS, marsBotMapProfile} from '../../../src/server/automa/boards/MarsBotMapProfile';
import {milestoneManifest} from '../../../src/server/milestones/Milestones';
import {awardManifest} from '../../../src/server/awards/Awards';
import {matViolations} from '../../../src/server/automa/ma/matLaw';
import {GeneratedMat, generateBotMat, MAT_GENERATOR_VERSION, MAT_TOPOLOGIES, MatContext, topologyOf} from '../../../src/server/automa/ma/matGenerator';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {Game} from '../../../src/server/Game';
import {Server} from '../../../src/server/models/ServerModel';
import {testAutomaRandomSetGame} from './matTestGame';
import {testAutomaGame} from '../AutomaTestGame';

/**
 * THE MAT GENERATOR (docs/claude/prompts/marsbot-dynamic-ma-framework.md § Генератор): the law of the six boards over
 * the ten static mats, the golden test «rebuild the official boards», determinism, the Hollandia seam, the topology
 * layer, the per-set repairs (tokens, colony cells, no jump into a threshold), the save path and the B14 face.
 */

function fixedSet(boardName: BoardName, venus: boolean): MatContext {
  return {
    boardName,
    milestones: [...milestoneManifest.boards[boardName], ...(venus ? ['Hoverlord'] : [])],
    awards: [...awardManifest.boards[boardName], ...(venus ? ['Venuphile'] : [])],
    venus,
    colonies: venus,
  };
}

/**
 * GOLDEN-TEST DISTANCES — cells a generated mat differs from the map's own board when the generator is handed that
 * map's fixed row. The target is 0 (the base rows, untouched); the one measured exception is the OLD Terra Cimmeria,
 * whose own board puts an «advance» on Earth space 7, one push before Firestarter's threshold 8 — the no-jump law
 * (decision R3) swaps it on the generated mat.
 */
const GOLDEN_DISTANCE: Partial<Record<BoardName, number>> = {[BoardName.TERRA_CIMMERIA]: 2};

describe('MarsBot mat generator', () => {
  it('the law of the six boards holds on every static board (the law is calibrated, not invented)', () => {
    for (const boardName of MARSBOT_BOARDS) {
      expect(matViolations(marsBotMapProfile(boardName).tracks), boardName).deep.eq([]);
    }
  });

  it('knows six lawful topologies, the four the static boards print among them', () => {
    expect(MAT_TOPOLOGIES.map((t) => t.id)).deep.eq([
      'J:science C:earth M:bio', 'J:power C:earth M:bio', 'J:power C:earth M:science',
      'J:earth C:science M:bio', 'J:earth C:power M:bio', 'J:earth C:power M:science',
    ]);
    const printed = new Set(MARSBOT_BOARDS.map((b) => topologyOf(marsBotMapProfile(b).tracks).id));
    expect([...printed].sort()).deep.eq(['J:earth C:power M:science', 'J:earth C:science M:bio', 'J:power C:earth M:bio', 'J:science C:earth M:bio']);
  });

  it('GOLDEN: handed a map\'s fixed row, it rebuilds that map — its topology, its rows, no replacement', () => {
    for (const boardName of AUTOMA_SUPPORTED_BOARDS) {
      for (const venus of [false, true]) {
        const mat = generateBotMat(fixedSet(boardName, venus));
        const label = `${boardName}${venus ? '+venus+colonies' : ''}`;
        expect(mat.topology, label).eq(topologyOf(marsBotMapProfile(boardName).tracks).id);
        expect(mat.report.rows.filter((r) => r.replaced), label).deep.eq([]);
        expect(mat.report.distance, `${label}: ${mat.report.repairs.join(' · ')}`).eq(GOLDEN_DISTANCE[boardName] ?? 0);
      }
    }
  });

  it('is DETERMINISTIC — the same input gives the same mat, byte for byte', () => {
    const context: MatContext = {
      boardName: BoardName.ELYSIUM, milestones: ['Rim Settler', 'Energizer', 'Dataminer', 'Builder7', 'Mayor'],
      awards: ['Traveller', 'Manufacturer', 'Collector', 'Excentric', 'Suburbian'], venus: true, colonies: true,
    };
    expect(JSON.stringify(generateBotMat(context))).eq(JSON.stringify(generateBotMat({...context})));
    expect(generateBotMat(context).version).eq(MAT_GENERATOR_VERSION);
  });

  it('a map with no MarsBot board of its own takes Tharsis as its base (the A&M module\'s rule — the Hollandia seam)', () => {
    const mat = generateBotMat({boardName: BoardName.HOLLANDIA, milestones: ['Builder', 'Mayor'], awards: ['Banker'], venus: false, colonies: false});
    expect(mat.base).eq(BoardName.THARSIS);
    expect(mat.report.baseIsFallback).is.true;
    expect(mat.report.distance, 'a set Tharsis already serves keeps Tharsis').eq(0);
    expect(matViolations(mat.tracks)).deep.eq([]);
  });

  it('two milestones on one track move a floating tag away (Energizer + Rim Settler on Tharsis)', () => {
    const mat = generateBotMat({boardName: BoardName.THARSIS, milestones: ['Energizer', 'Rim Settler', 'Mayor', 'Gardener', 'Builder'],
      awards: ['Landlord', 'Scientist', 'Banker', 'Thermalist', 'Miner'], venus: false, colonies: false});
    const power = mat.tracks.find((t) => t.role === 'power')!;
    expect(power.tags, 'Jovian leaves the energy-badge track').not.contains(Tag.JOVIAN);
    expect(mat.report.shares.filter((s) => s.names.includes('Energizer') && s.names.includes('Rim Settler'))).deep.eq([]);
    expect(matViolations(mat.tracks)).deep.eq([]);
    expect(mat.report.rows.some((r) => r.replaced), 'the move is made with whole library rows').is.true;
  });

  it('a «resources on cards» milestone gets its TOKEN cells (decision R8) — enough for its threshold and a margin', () => {
    const tokens = (mat: GeneratedMat, kind: string) => mat.tracks.reduce((sum, t) =>
      sum + t.layout.reduce((s, a) => s + (a === `token_${kind}` ? 1 : a === `token2_${kind}` ? 2 : 0), 0), 0);
    const dataminer = generateBotMat({boardName: BoardName.HELLAS, milestones: ['Dataminer'], awards: [], venus: false, colonies: false});
    expect(tokens(dataminer, 'data')).eq(9);
    const aeronaut = generateBotMat({boardName: BoardName.HELLAS, milestones: ['Aeronaut'], awards: [], venus: false, colonies: false});
    expect(tokens(aeronaut, 'fighter')).eq(5);
    expect(matViolations(dataminer.tracks)).deep.eq([]);
    expect(tokens(generateBotMat(fixedSet(BoardName.HELLAS, false)), 'data'), 'no Dataminer, no data cells').eq(0);
  });

  it('a token cell pays the bot its tokens when the track lands on it', () => {
    const [game] = testAutomaRandomSetGame({milestones: ['Dataminer', 'Mayor', 'Gardener', 'Builder', 'Planner'],
      awards: ['Landlord', 'Scientist', 'Banker', 'Thermalist', 'Miner']}, {}, '-tokens-land');
    const board = game.automa!.board;
    const index = board.tracks.findIndex((t) => t.definition.layout.some((a) => a === 'token2_data'));
    const cell = board.tracks[index].definition.layout.indexOf('token2_data');
    board.tracks[index].position = cell - 1;
    AutomaResolver.advanceTrack(game, index);
    expect(game.automa!.tokens.data).eq(2);
  });

  it('with Colonies, a colony-counting criterion gets the module\'s colony cells — unless the base already prints one', () => {
    const tharsis = generateBotMat({boardName: BoardName.THARSIS, milestones: ['Pioneer4'], awards: ['Constructor'], venus: false, colonies: true});
    const colonyCells = (mat: GeneratedMat) => mat.tracks.reduce((n, t) => n + t.layout.filter((a) => a === 'colony5').length, 0);
    expect(colonyCells(tharsis)).eq(3);
    expect(matViolations(tharsis.tracks)).deep.eq([]);
    expect(colonyCells(generateBotMat({boardName: BoardName.THARSIS, milestones: ['Pioneer4'], awards: [], venus: false, colonies: false})),
      'without Colonies — no cell').eq(0);
    const utopia = generateBotMat({boardName: BoardName.UTOPIA_PLANITIA, milestones: ['Pioneer4'], awards: [], venus: false, colonies: true});
    expect(colonyCells(utopia), 'Utopia prints its own colony cell').eq(0);
  });

  it('NO JUMP (decision R3): the cell before a milestone\'s threshold is never an «advance»', () => {
    const mat = generateBotMat({boardName: BoardName.TERRA_CIMMERIA, milestones: ['Firestarter'], awards: [], venus: false, colonies: false});
    const earth = mat.tracks.find((t) => t.role === 'earth')!;
    expect(marsBotMapProfile(BoardName.TERRA_CIMMERIA).tracks.find((t) => t.role === 'earth')!.layout[7], 'the printed board').eq('advance');
    expect(earth.layout[7]).not.eq('advance');
    expect(mat.report.repairs).deep.eq(['swap earth 7↔6 (no jump into Firestarter at 8)']);
  });

  it('a random-set game plays its generated mat, keeps it through a save, and an old save reads the printed board', () => {
    const [game] = testAutomaRandomSetGame({milestones: ['Energizer', 'Rim Settler', 'Mayor', 'Gardener', 'Builder'],
      awards: ['Landlord', 'Scientist', 'Banker', 'Thermalist', 'Miner']}, {venusNextExtension: true}, '-save');
    const mat = game.automa!.mat!;
    expect(game.automa!.board.tracks.slice(0, 7).map((t) => t.definition)).deep.eq(mat.tracks);
    expect(game.automa!.board.tracks).has.length(8);
    const restored = Game.deserialize(structuredClone(game.serialize()));
    expect(restored.automa!.mat).deep.eq(mat);
    expect(restored.automa!.board.tracks.map((t) => t.definition.tags)).deep.eq(game.automa!.board.tracks.map((t) => t.definition.tags));
    // An ordinary game carries no mat; its save rebuilds the printed board from the map name.
    const [fixed] = testAutomaGame({}, '-fixed-save');
    expect(fixed.serialize().automa!.mat).is.undefined;
    expect(Game.deserialize(structuredClone(fixed.serialize())).automa!.board.tracks.map((t) => t.definition))
      .deep.eq(marsBotMapProfile(BoardName.THARSIS).tracks);
  });

  it('B14 «Corporate Competition · this game\'s set»: in the deck, its face lists THIS game\'s awards and their pushes', () => {
    const [game] = testAutomaRandomSetGame({milestones: ['Mayor', 'Gardener', 'Builder', 'Planner', 'Energizer'],
      awards: ['Forecaster', 'Entrepreneur', 'Manufacturer', 'Suburbian', 'Collector']}, {aresExtension: true}, '-b14');
    expect(game.automa!.profile.corporateCompetition).eq(BonusCardId.B14_CORPORATE_COMPETITION_MA);
    const ids = [...game.automa!.bonusDeck, ...game.automa!.actionDeck].filter((e) => e.kind === 'bonus').map((e) => (e as {id: BonusCardId}).id);
    expect(ids).contains(BonusCardId.B14_CORPORATE_COMPETITION_MA);
    const model = Server.getGameModel(game).automa!;
    expect(model.competition!.map((l) => l.award)).deep.eq(['Forecaster', 'Entrepreneur', 'Manufacturer', 'Suburbian', 'Collector']);
    expect(model.competition!.find((l) => l.award === 'Forecaster')!.free).is.true;
    expect(model.competition!.find((l) => l.award === 'Entrepreneur')!.none).is.true;
    const view = buildBonusCardView(BonusCardId.B14_CORPORATE_COMPETITION_MA, {venus: false, colonies: false, competition: model.competition});
    expect(view.name).eq('Corporate Competition · this game\'s set');
    expect(view.lines.filter((l) => l.award !== undefined).map((l) => l.award)).deep.eq(model.competition!.map((l) => l.award));
    expect(view.lines.some((l) => l.text.startsWith('Forecaster instead GAINS')), 'the free option is said').is.true;
    // A fixed-row game has no such list.
    const [fixed] = testAutomaGame({}, '-b14-fixed');
    expect(Server.getGameModel(fixed).automa!.competition).is.undefined;
  });
});
