import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {worldStepHandle} from '../../src/server/parliament/ParliamentPhase';
import {
  WATER_EXPORT, WATER_EXPORT_CODE, WATER_EXPORT_DISCOUNT, WATER_EXPORT_ID, WATER_EXPORT_MEGACREDITS, WATER_EXPORT_REMOVAL, WATER_EXPORT_TAGS,
  waterExportDiscount,
} from '../../src/server/parliament/resolutions/reds/WaterExport';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceId} from '../../src/common/Types';
import {Payment} from '../../src/common/inputs/Payment';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {
  NO_REMOVABLE_OCEAN_REASON, OCEANS_AT_MAX_REASON, TILE_REMOVAL_STEP_KEY, tileRemovalDeclared, tileRemovalRoom,
} from '../../src/common/parliament/tileRemoval';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {MAX_OCEAN_TILES} from '../../src/common/constants';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Space} from '../../src/server/boards/Space';
import {addOcean, fakeCard, maxOutOceans, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame, testAutomaMultiplayerGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {Mine} from '../../src/server/cards/base/Mine';
import {MirandaResort} from '../../src/server/cards/base/MirandaResort';
import {AsteroidMining} from '../../src/server/cards/base/AsteroidMining';
import {EarthCatapult} from '../../src/server/cards/base/EarthCatapult';
import {VenusGovernor} from '../../src/server/cards/venusNext/VenusGovernor';
import {LunaGovernor} from '../../src/server/cards/colonies/LunaGovernor';
import {Capital} from '../../src/server/cards/base/Capital';
import {IProjectCard} from '../../src/server/cards/IProjectCard';

/**
 * WATER EXPORT (Turmoil Redux, RX33) — 2 M€ per influence for every
 * participant, then the FIRST PLAYER removes one ocean tile from the board
 * (unless the oceans are at their maximum), and while the card stands enacted
 * a DISCOUNT: 3 M€ off a card with an Earth, Venus or Jovian tag, once per card.
 *
 * What these specs pin: the per-seat payout; the world part running ONCE per
 * enactment (a neutral winner included), belonging to no seat — and ASKING:
 * the prompt goes to the first player in generation order (a voter or not, a
 * delegate on the card or not; the nearest HUMAN when that seat is MarsBot),
 * every other seat waits, one removable ocean is still a question, a reload
 * inside the question rebuilds it for the same seat and removes nothing
 * twice; both skips NAMED (the card's clause first, the empty board second);
 * the removal being the engine's own (the parameter drops, no rating is
 * taken back, the cell's bonus stays paid, Capital recounts, an upgraded
 * ocean is never offered); the seats' M€ landing BEFORE the removal; and the
 * DISCOUNT — applied by the one price function to any of the three tags and
 * to nothing else, ONCE per card whatever the number of qualifying tags,
 * itemized under the LAW's source, floored at zero, read by the play forecast
 * from the same breakdown, gone with the law, and never MarsBot's.
 */
const WATER = resolutionInstanceId(WATER_EXPORT_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** An ocean of p2's on a cell with a PLANT bonus (so «the bonus is not returned» has something to measure). */
function placeOcean(game: IGame, owner: TestPlayer): Space {
  const bonusCell = game.board.getAvailableSpacesForOcean(owner).find((s) => s.bonus.includes(SpaceBonus.PLANT));
  return addOcean(owner, bonusCell?.id);
}

/** Seat Water Export in slot 0 with `voter`'s delegate on it; ONE ocean of p2's on the board. Both seats at 0 M€. */
function stage(voter: 0 | 1 = 0): [IGame, TestPlayer, TestPlayer, Parliament, Space] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, WATER);
  parliament.placeVote(voter === 0 ? p1 : p2, parliament.slots[0], 'lobby');
  const ocean = placeOcean(game, p2);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament, ocean];
}

/** Seat Water Export with a NEUTRAL delegate on it — the world part must still happen. */
function stageNeutral(): [IGame, TestPlayer, TestPlayer, Parliament, Space] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, WATER);
  parliament.addNeutralVote(parliament.slots[0]);
  const ocean = placeOcean(game, p2);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament, ocean];
}

/** The removal prompt `player` holds, if it is the one standing. */
function removalPromptOf(player: IPlayer): SelectSpace | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectSpace && wf.placementEffect === 'remove' ? wf : undefined;
}

/** Answer the removal prompt `player` holds (the first candidate unless told which), then walk the gates. */
function answerRemoval(game: IGame, player: IPlayer, spaceId?: SpaceId): void {
  const wf = cast(player.getWaitingFor(), SelectSpace);
  player.process({type: 'space', spaceId: spaceId ?? wf.spaces[0].id});
  runAllActions(game);
  settleParliamentGates(game);
}

/** The card ENACTED by a real sitting (the removal answered), the next generation's action phase open. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = stage();
  endGenerationThroughParliament(game);
  answerRemoval(game, p1);
  runAllActions(game);
  settleParliamentGates(game);
  game.phase = Phase.ACTION;
  expect(parliament.enacted).eq(WATER);
  p1.megaCredits = 40;
  p2.megaCredits = 40;
  return [game, p1, p2, parliament];
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomesOf(parliament: Parliament) {
  return parliament.lastPhase?.outcomes ?? parliament.phase?.summary?.outcomes ?? [];
}

function worldOutcome(parliament: Parliament) {
  return outcomesOf(parliament).find((o) => o.player === undefined && o.step === TILE_REMOVAL_STEP_KEY);
}

function seatOutcome(parliament: Parliament, player: TestPlayer) {
  return outcomesOf(parliament).find((o) => o.player === player.id && o.step === 'megacredits');
}

/** The law's own line in a price breakdown, if the law is in it. */
function lawDiscountOf(player: IPlayer, card: IProjectCard) {
  return player.getCardCostBreakdown(card).discounts.find((d) => d.source.kind === 'resolution' && d.source.id === WATER_EXPORT_ID);
}

/** Make `first` the first player in generation order (the seat the printed rule names) without touching anything else. */
function seatFirst(game: IGame, first: IPlayer, others: ReadonlyArray<IPlayer>): void {
  const live = game as Game;
  live.first = first;
  live.playersInGenerationOrder = [first, ...others];
}

describe('WaterExport', () => {
  describe('the catalog entry', () => {
    it('is RX33 of the Reds — one copy, no expansion needed, the two-Jovian-tag quest, no winner part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(WATER_EXPORT_ID)).eq(WATER_EXPORT);
      expect(WATER_EXPORT_CODE).eq('RX33');
      expect(WATER_EXPORT_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX33')).eq(WATER_EXPORT);
      expect(WATER_EXPORT.party).eq(PartyName.REDS);
      expect(WATER_EXPORT.copies).eq(1);
      expect(WATER_EXPORT.compatibility).is.undefined;
      expect(WATER_EXPORT.quest).deep.eq({goal: {kind: 'tag', tag: Tag.JOVIAN}, count: 2});
      expect(WATER_EXPORT.winnerSteps, 'no winner-only part — «when enacted», not «the winner»').is.undefined;
      expect(WATER_EXPORT.winnerReward).is.undefined;
      expect(WATER_EXPORT.worldMoves, 'the world part is a REMOVAL, not a parameter move').is.undefined;
    });

    it('declares its WORLD part on all three layers: the data, the shared step and the sentence', () => {
      expect(WATER_EXPORT.tileRemoval).deep.eq(WATER_EXPORT_REMOVAL);
      expect(WATER_EXPORT_REMOVAL).deep.eq({tile: 'ocean', executor: 'first-player'});
      expect(tileRemovalDeclared(WATER_EXPORT_REMOVAL)).is.true;
      expect((WATER_EXPORT.worldSteps ?? []).map((s) => s.key)).deep.eq([TILE_REMOVAL_STEP_KEY]);
      expect(WATER_EXPORT.text.world, 'the inspector reads the world part as its own block').is.a('string');
      expect(WATER_EXPORT.immediateSteps?.map((s) => s.key), 'the removal is never a seat\'s step').deep.eq(['megacredits']);
    });

    it('declares its PASSIVE as a DISCOUNT hook with its text and its (fact-free) forecast', () => {
      expect(typeof WATER_EXPORT.passive?.cardDiscount).eq('function');
      expect(typeof WATER_EXPORT.passive?.forecast, 'the honesty law: a passive declares its forecast').eq('function');
      expect(WATER_EXPORT.text.passive, 'the effects list and the REWARD stage read it').is.a('string');
      expect(WATER_EXPORT.passive?.onTilePlaced, 'no tile hook — nothing of this law fires on a placement').is.undefined;
      expect(WATER_EXPORT_DISCOUNT).eq(3);
      expect(WATER_EXPORT_TAGS).deep.eq([Tag.EARTH, Tag.VENUS, Tag.JOVIAN]);
    });

    it('the shared formula: 2 M€ per point of influence, nothing below zero', () => {
      expect(scaledAmount(WATER_EXPORT_MEGACREDITS, 0)).eq(0);
      expect(scaledAmount(WATER_EXPORT_MEGACREDITS, 1)).eq(2);
      expect(scaledAmount(WATER_EXPORT_MEGACREDITS, 3)).eq(6);
      expect(WATER_EXPORT_MEGACREDITS.cap, 'no cap').is.undefined;
    });

    it('the stand opens the WORLD-MOVE family from the declaration alone (the ocean count is the instrument)', () => {
      expect(familyOf(WATER_EXPORT)).eq('world-move');
    });

    it('the address of a removed tile: the board, no chip, the world-removal reading, a named skip plate', () => {
      expect(REWARD_ADDRESS.tileRemoved).deep.include({surface: 'board', source: 'none', unit: 'tile', stage: 'board', reading: 'world-removal'});
      const removed = rewardAddressOf({step: TILE_REMOVAL_STEP_KEY, part: 'world', kind: 'tileRemoved', space: '10', amount: -1,
        parameter: {id: 'oceans', before: 1, after: 0}}, 'blue' as never);
      expect(removed.mine, 'a world record belongs to every viewer').is.true;
      expect(removed.skipped).is.undefined;
      expect(removed.payload.space).eq('10');
      const nothing = rewardAddressOf({step: TILE_REMOVAL_STEP_KEY, part: 'world', kind: 'skipped', reason: OCEANS_AT_MAX_REASON}, 'blue' as never);
      expect(nothing.skipped).eq(OCEANS_AT_MAX_REASON);
    });

    it('the shared ROOM: the card\'s clause first (at the maximum), the empty board second, one removal otherwise', () => {
      expect(tileRemovalRoom(WATER_EXPORT_REMOVAL, {oceans: 3})).deep.include({current: 3, atMax: false, removable: 3, removes: true, resulting: 2});
      expect(tileRemovalRoom(WATER_EXPORT_REMOVAL, {oceans: MAX_OCEAN_TILES})).deep.include({atMax: true, removes: false, resulting: MAX_OCEAN_TILES});
      expect(tileRemovalRoom(WATER_EXPORT_REMOVAL, {oceans: 0})).deep.include({atMax: false, removable: 0, removes: false, resulting: 0});
      expect(tileRemovalRoom(WATER_EXPORT_REMOVAL, {oceans: 2, removableOceans: 0}), 'every ocean upgraded').deep.include({removable: 0, removes: false, resulting: 2});
      expect(tileRemovalRoom(WATER_EXPORT_REMOVAL, {oceans: 2, removableOceans: 1})).deep.include({removable: 1, removes: true, resulting: 1});
    });
  });

  describe('the M€ payout', () => {
    it('pays every participant 2 × THEIR influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGenerationThroughParliament(game);
      expect(parliament.agendaOf(p1)).eq(1);
      const one = seatOutcome(parliament, p1);
      const two = seatOutcome(parliament, p2);
      expect(one, 'the winner: 2 × 1').deep.include({kind: 'stock', stock: Resource.MEGACREDITS, amount: 2, influence: 1});
      expect(two, 'a non-voter by its own track: 2 × 3').deep.include({kind: 'stock', amount: 6, influence: 3});
      expect((one?.after ?? 0) - (one?.before ?? 0)).eq(2);
      expect((two?.after ?? 0) - (two?.before ?? 0)).eq(6);
    });

    it('influence 0 pays nothing and NAMES it', () => {
      const [game, p1, , parliament] = stageNeutral();
      endGenerationThroughParliament(game);
      expect(seatOutcome(parliament, p1)).deep.include({kind: 'skipped', amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no M€ from ${1}')).is.true;
    });

    it('EVERY seat is paid BEFORE the removal is asked — the card\'s own order (seats → world)', () => {
      const [game, p1, p2, parliament] = stage();
      endGenerationThroughParliament(game);
      expect(removalPromptOf(p1), 'the removal is the standing question').is.not.undefined;
      const outcomes = outcomesOf(parliament);
      expect(outcomes.filter((o) => o.step === 'megacredits').map((o) => o.player)).deep.eq([p1.id, p2.id]);
      expect(outcomes.some((o) => o.step === TILE_REMOVAL_STEP_KEY), 'no record of the removal until it is answered').is.false;
    });
  });

  describe('the world\'s part — the FIRST PLAYER removes one ocean, once, for the table', () => {
    it('ASKS the first player: a removal prompt over the plain oceans, marked by the server (never a title), sourced by the law', () => {
      const [game, p1, p2, , ocean] = stage();
      endGenerationThroughParliament(game);
      expect(game.playersInGenerationOrder[0]).eq(p1);
      const prompt = removalPromptOf(p1);
      expect(prompt, 'the first player holds the removal').is.not.undefined;
      expect(prompt?.spaces.map((s) => s.id)).deep.eq([ocean.id]);
      expect(prompt?.placementEffect).eq('remove');
      expect(prompt?.placementType).eq('ocean-removal');
      expect(prompt?.tileType).eq(TileType.OCEAN);
      expect(prompt?.placementContext).deep.include({cancellable: false, source: {kind: 'resolution', resolution: WATER_EXPORT_ID}});
      expect(p2.getWaitingFor(), 'the other seat WAITS — the sitting stops at the question').is.undefined;
    });

    it('ONE removable ocean is still a QUESTION — never an auto-pick (invariant 3)', () => {
      const [game, p1, , , ocean] = stage();
      endGenerationThroughParliament(game);
      expect(game.board.getOceanSpaces()).has.length(1);
      expect(removalPromptOf(p1)?.spaces.map((s) => s.id)).deep.eq([ocean.id]);
      expect(ocean.tile, 'nothing removed before the answer').is.not.undefined;
    });

    it('the phase PUBLISHES the ask as its pending question, so every other seat reads the honest wait', () => {
      const [game, p1, p2, parliament] = stage();
      endGenerationThroughParliament(game);
      expect(parliament.phase?.effects?.pending).deep.eq({player: p1.id, key: TILE_REMOVAL_STEP_KEY});
      const model = getParliamentModel(game, p2);
      expect(model?.phase?.pending).deep.eq({player: p1.color, key: TILE_REMOVAL_STEP_KEY, input: 'space'});
    });

    it('the answer REMOVES the tile through the engine: the cell empties, the count drops by one, the record names the cell, the tile, the chooser — and no seat', () => {
      const [game, p1, , parliament, ocean] = stage();
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      expect(ocean.tile, 'the cell is bare').is.undefined;
      expect(ocean.player).is.undefined;
      expect(game.board.getOceanSpaces()).has.length(0);
      const record = worldOutcome(parliament);
      expect(record).deep.include({kind: 'tileRemoved', part: 'world', space: ocean.id, tile: TileType.OCEAN, chosenBy: p1.id, amount: -1});
      expect(record?.parameter).deep.eq({id: 'oceans', before: 1, after: 0});
      expect(record?.player, 'a WORLD record belongs to NO seat').is.undefined;
      expect(parliament.phase?.effects?.pending, 'the question is answered').is.undefined;
      expect(parliament.enacted).eq(WATER);
    });

    it('the journal names the removal by the engine\'s own line and the law\'s count line', () => {
      const [game, p1, , , ocean] = stage();
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      expect(game.gameLog.some((e) => e.message === '${0} ${1} ${2} · ${3}' && e.data.some((d) => d.value === 'removed')), 'logBoardTileAction').is.true;
      const line = game.gameLog.find((e) => e.message === '${0}: the ocean count falls ${1} → ${2}; nobody loses TR for it');
      expect(line?.data[0].value).eq(WATER_EXPORT_ID);
      expect(line?.data[1].value).eq('1');
      expect(line?.data[2].value).eq('0');
    });

    it('a NEUTRAL winner changes nothing about it: «when enacted», not «the winner» — the first player is still asked', () => {
      const [game, p1, , parliament, ocean] = stageNeutral();
      endGenerationThroughParliament(game);
      expect(parliament.phase?.summary?.winner.player).eq('NEUTRAL');
      expect(removalPromptOf(p1)).is.not.undefined;
      answerRemoval(game, p1, ocean.id);
      expect(worldOutcome(parliament)?.kind).eq('tileRemoved');
      expect(game.board.getOceanSpaces()).has.length(0);
    });

    it('the EXECUTOR is the first player in generation order — a seat with NO delegate on the card, not the winner', () => {
      const [game, p1, p2, parliament] = stage(1);
      endGenerationThroughParliament(game);
      expect(parliament.phase?.summary?.winner.player, 'red won the vote').eq(p2.id);
      expect(parliament.votesOf(p1, parliament.slots[0]), 'blue holds nothing on the card').eq(0);
      expect(removalPromptOf(p1), 'the FIRST PLAYER is asked, whoever won').is.not.undefined;
      expect(p2.getWaitingFor()).is.undefined;
    });

    it('…and it follows the POSITION, not the seat: with red first in generation order, red is asked', () => {
      const [game, p1, p2, parliament] = stage(0);
      seatFirst(game, p2, [p1]);
      endGenerationThroughParliament(game);
      expect(parliament.phase?.summary?.winner.player, 'blue won the vote').eq(p1.id);
      expect(removalPromptOf(p2), 'red — first in generation order — is asked').is.not.undefined;
      expect(p1.getWaitingFor()).is.undefined;
      expect(worldStepHandle(game)).eq(p2);
    });

    it('a reload INSIDE the question rebuilds the SAME prompt for the SAME seat, and the answer removes exactly one tile', () => {
      const [game, p1, , , ocean] = stage();
      endGenerationThroughParliament(game);
      const live = reload(game);
      const copy = live.getPlayerById(p1.id);
      const rebuilt = removalPromptOf(copy);
      expect(rebuilt, 'the question stands on the copy').is.not.undefined;
      expect(rebuilt?.spaces.map((s) => s.id)).deep.eq([ocean.id]);
      expect(rebuilt?.placementContext?.source).deep.eq({kind: 'resolution', resolution: WATER_EXPORT_ID});
      answerRemoval(live, copy, ocean.id);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.step === TILE_REMOVAL_STEP_KEY)).has.length(1);
      expect(live.board.getOceanSpaces()).has.length(0);
      settleParliamentGates(live);
      expect(live.board.getOceanSpaces(), 'a second walk removes nothing').has.length(0);
      expect(live.parliament!.lastPhase!.outcomes!.filter((o) => o.step === TILE_REMOVAL_STEP_KEY)).has.length(1);
      expect(game.board.getOceanSpaces(), 'the original was never answered').has.length(1);
    });
  });

  describe('two conditions, two reasons — and both NAMED', () => {
    it('the oceans AT THEIR MAXIMUM: the card\'s own clause — nothing is asked, the skip names it', () => {
      const [game, p1, p2, parliament] = stage();
      maxOutOceans(p2);
      expect(game.canAddOcean()).is.false;
      endGenerationThroughParliament(game);
      expect(removalPromptOf(p1), 'no question').is.undefined;
      expect(worldOutcome(parliament)).deep.include({kind: 'skipped', part: 'world', amount: 0, reason: OCEANS_AT_MAX_REASON});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'oceans', before: MAX_OCEAN_TILES, after: MAX_OCEAN_TILES});
      expect(game.board.getOceanSpaces()).has.length(MAX_OCEAN_TILES);
      expect(game.gameLog.some((e) => e.message === 'Oceans are at their maximum — ${0} removes none')).is.true;
      expect(parliament.phase, 'the sitting closed on its own').is.undefined;
    });

    it('NO ocean on the board: the physical condition — its own reason, never the other one', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, WATER);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p2.megaCredits = 0;
      expect(game.board.getOceanSpaces()).has.length(0);
      endGenerationThroughParliament(game);
      expect(removalPromptOf(p1)).is.undefined;
      expect(worldOutcome(parliament)).deep.include({kind: 'skipped', amount: 0, reason: NO_REMOVABLE_OCEAN_REASON});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'oceans', before: 0, after: 0});
      expect(game.gameLog.some((e) => e.message === 'No ocean tile can be removed — ${0} removes none')).is.true;
    });

    it('EVERY ocean upgraded (an Ocean City on the only ocean): nothing removable — the same physical reason, the count untouched', () => {
      const [game, p1, , parliament, ocean] = stage();
      ocean.tile = {tileType: TileType.OCEAN_CITY};
      expect(game.board.getOceanSpaces(), 'an upgraded ocean still counts for the parameter').has.length(1);
      expect(game.board.getOceanSpaces({upgradedOceans: false})).has.length(0);
      endGenerationThroughParliament(game);
      expect(removalPromptOf(p1)).is.undefined;
      expect(worldOutcome(parliament)).deep.include({kind: 'skipped', reason: NO_REMOVABLE_OCEAN_REASON});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'oceans', before: 1, after: 1});
      expect(ocean.tile?.tileType, 'the upgraded ocean is never removed').eq(TileType.OCEAN_CITY);
    });

    it('a plain ocean beside an upgraded one: only the plain one is offered', () => {
      const [game, p1, p2, , plain] = stage();
      const upgraded = addOcean(p2);
      upgraded.tile = {tileType: TileType.OCEAN_FARM};
      endGenerationThroughParliament(game);
      expect(removalPromptOf(p1)?.spaces.map((s) => s.id)).deep.eq([plain.id]);
    });
  });

  describe('what follows the removal is the engine\'s — pinned, never programmed', () => {
    it('NOBODY loses a terraform rating: the seat that placed the ocean keeps its step; the winner gains at most its Agenda step', () => {
      const [game, p1, p2, , ocean] = stage();
      const placerBefore = p2.terraformRating;
      const winnerBefore = p1.terraformRating;
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      expect(p2.terraformRating, 'the rating the ocean paid is never taken back').eq(placerBefore);
      expect(p1.terraformRating - winnerBefore).to.be.at.most(1);
      expect(p1.terraformRating).to.be.at.least(winnerBefore);
    });

    it('the cell\'s printed bonus is NOT returned, and an ocean placed there again pays it (and its rating) again — the engine\'s rule', () => {
      const [game, p1, p2, , ocean] = stage();
      expect(ocean.bonus).includes(SpaceBonus.PLANT);
      const plants = p2.plants;
      const rating = p2.terraformRating;
      expect(plants, 'the placement paid the plants').to.be.greaterThan(0);
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      expect(p2.plants, 'the plants stay paid').eq(plants);
      game.phase = Phase.ACTION;
      addOcean(p2, ocean.id);
      expect(p2.plants, 'placed again, the cell pays again').to.be.greaterThan(plants);
      expect(p2.terraformRating, '…and the rating is paid again').eq(rating + 1);
    });

    it('a CAPITAL beside the removed ocean scores one point less at the end — the board as it stands, recounted by the engine', () => {
      const [game, p1, p2, , ocean] = stage();
      const site = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      p2.playedCards.push(new Capital());
      game.simpleAddTile(p2, site, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      const before = p2.getVictoryPoints().total;
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      expect(p2.getVictoryPoints().total).eq(before - 1);
    });

    it('the board\'s own explainer promises exactly that BEFORE the pick: the count, the rating nobody loses, the Capital\'s point', () => {
      const [game, p1, p2, , ocean] = stage();
      const site = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
      p2.playedCards.push(new Capital());
      game.simpleAddTile(p2, site, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      const preview = boardCellPreview(p1, ocean, 'ocean-removal', {placementEffect: 'remove'});
      expect(preview.legal).is.true;
      expect(preview.placesTile).is.false;
      const all = [...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts, ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts];
      const leaves = all.find((f) => f.id === 'remove-ocean');
      expect(leaves?.delta).deep.include({icon: 'ocean', amount: 1, direction: 'cost', current: 1, resulting: 0});
      expect(all.some((f) => f.id === 'remove-ocean-no-tr'), 'the rating nobody loses is said out loud').is.true;
      const capital = all.find((f) => f.id === `remove-capital-${site.id}`);
      expect(capital?.vp).deep.eq({from: 1, to: 0});
      expect(capital?.recipient).deep.eq({kind: 'tile-owner', color: p2.color});
      expect(capital?.spaces).deep.eq([site.id]);
      expect(all.some((f) => f.category === 'printed-placement-bonus'), 'no bonus is promised — none is paid').is.false;
      const land = boardCellPreview(p1, site, 'ocean-removal', {placementEffect: 'remove'});
      expect(land.legal, 'a cell with no plain ocean is not a pick').is.false;
    });
  });

  describe('the DISCOUNT — 3 M€ off an Earth, Venus or Jovian tag while the law stands', () => {
    it('the rate function: any ONE of the three tags → 3, anything else → 0', () => {
      const [, p1] = reduxGame();
      expect(waterExportDiscount(p1, new EarthCatapult()), 'Earth').eq(3);
      expect(waterExportDiscount(p1, new VenusGovernor()), 'Venus').eq(3);
      expect(waterExportDiscount(p1, new MirandaResort()), 'Jovian').eq(3);
      expect(waterExportDiscount(p1, new Mine()), 'Building only').eq(0);
    });

    it('ONCE PER CARD, never per tag: two of the three tags on one card, or the same tag twice, are still one discount', () => {
      const [, p1] = reduxGame();
      expect(waterExportDiscount(p1, fakeCard({cost: 20, tags: [Tag.EARTH, Tag.JOVIAN]}))).eq(3);
      expect(waterExportDiscount(p1, fakeCard({cost: 20, tags: [Tag.EARTH, Tag.VENUS, Tag.JOVIAN]}))).eq(3);
      expect(waterExportDiscount(p1, new LunaGovernor()), 'Earth ×2').eq(3);
    });

    it('the price of a Jovian card falls by 3, itemized under the LAW\'s own source — never the cardless remainder', () => {
      const [, p1] = enacted();
      const resort = p1.getCardCostBreakdown(new MirandaResort());
      expect(resort.base).eq(12);
      expect(resort.final).eq(9);
      expect(resort.discounts).deep.eq([{source: {kind: 'resolution', id: WATER_EXPORT_ID, owner: p1.color}, amount: 3}]);
      expect(p1.getCardCost(new MirandaResort()), 'the price and its breakdown are ONE function').eq(9);
      expect(lawDiscountOf(p1, new EarthCatapult())?.amount, 'Earth').eq(3);
      expect(lawDiscountOf(p1, new VenusGovernor())?.amount, 'Venus').eq(3);
      const two = p1.getCardCostBreakdown(fakeCard({cost: 20, tags: [Tag.EARTH, Tag.JOVIAN]}));
      expect(two.final, 'two qualifying tags: 20 − 3, never 20 − 6').eq(17);
    });

    it('a card WITHOUT one of the tags pays its printed price — no line of the law', () => {
      const [, p1] = enacted();
      const mine = p1.getCardCostBreakdown(new Mine());
      expect(mine.final).eq(mine.base);
      expect(mine.discounts).deep.eq([]);
      expect(ParliamentHandler.cardDiscount(p1, new Mine())).is.undefined;
    });

    it('the price never goes below zero — the nominal 3 stays in the breakdown, the final is floored', () => {
      const [, p1] = enacted();
      const cheap = fakeCard({cost: 2, tags: [Tag.JOVIAN]});
      const breakdown = p1.getCardCostBreakdown(cheap);
      expect(breakdown.final).eq(0);
      expect(breakdown.discounts.map((d) => d.amount)).deep.eq([3]);
    });

    it('EVERY participant holds the law — the seat that did not vote for it too', () => {
      const [, , p2] = enacted();
      expect(lawDiscountOf(p2, new MirandaResort())?.amount).eq(3);
    });

    it('nothing enacted, or ANOTHER law enacted → no discount: the handler reads the enacted card at the query', () => {
      const [, p1, , parliament] = reduxGame();
      expect(p1.getCardCost(new MirandaResort()), 'nothing enacted').eq(12);
      parliament.enacted = WATER;
      expect(p1.getCardCost(new MirandaResort()), 'the law stands').eq(9);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      expect(p1.getCardCost(new MirandaResort()), 'the law changed — the discount ends with it').eq(12);
      expect(lawDiscountOf(p1, new MirandaResort())).is.undefined;
    });

    it('PLAYING the card pays the discounted price and records the LAW\'s own discount-applied', () => {
      const [game, p1] = enacted();
      const before = p1.megaCredits;
      p1.checkPaymentAndPlayCard(new MirandaResort(), Payment.of({megacredits: 9}));
      runAllActions(game);
      expect(before - p1.megaCredits, '12 − 3 = 9 paid').eq(9);
      const events = game.events.serialize().events;
      const discount = events.filter((e) => e.type === 'discount-applied');
      expect(discount).has.length(1);
      expect(discount[0].source).deep.eq({kind: 'resolution', id: WATER_EXPORT_ID, owner: p1.color});
      expect(discount[0].impact.megacreditsSaved).eq(3);
      expect(discount[0].target).deep.eq({card: CardName.MIRANDA_RESORT});
    });

    it('the play FORECAST reads the discount from the same breakdown — the law named, the same 3 M€; no fact of the law duplicates it', () => {
      const [, p1] = enacted();
      const resort = new MirandaResort();
      const forecast = effectForecastForPlay(p1, resort, cardPlayPreview(p1, resort));
      expect(forecast.discounts).deep.eq({
        base: 12, final: 9,
        items: [{source: {kind: 'resolution', id: WATER_EXPORT_ID, owner: p1.color}, amount: 3}],
        other: 0,
      });
      expect(forecast.discounts.final).eq(p1.getCardCost(resort));
      expect(allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution'), 'no second reading as a fact').deep.eq([]);
    });

    it('the passive\'s own forecast states nothing (its twin is the breakdown)', () => {
      const [, p1] = enacted();
      expect(WATER_EXPORT.passive?.forecast({
        player: p1, grants: [], tiles: [],
        source: (channel) => ({kind: 'resolution', name: WATER_EXPORT_ID, owner: p1.color, channel}),
        exact: () => {
          throw new Error('not called');
        },
        deferred: () => {
          throw new Error('not called');
        },
        stockGain: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        productionChange: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        drawGain: () => ({direction: 'gain', icon: 'cards', amount: 0}),
      })).deep.eq([]);
    });
  });

  describe('the chairman quest — play 2 Jovian tags', () => {
    it('two Jovian cards complete it; a card without the tag moves no progress', () => {
      const [game, p1, , parliament] = enacted();
      expect(parliament.quest?.source).eq(WATER_EXPORT_ID);
      p1.playCard(new Mine(), Payment.of({megacredits: 4}));
      runAllActions(game);
      expect(parliament.questProgressOf(p1), 'a Building card is not a Jovian tag').eq(0);
      p1.playCard(new MirandaResort(), Payment.of({megacredits: 9}));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      p1.playCard(new AsteroidMining(), Payment.of({megacredits: 27}));
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
    });
  });

  describe('MarsBot', () => {
    it('the handle NEVER lands on the bot: with the bot first in generation order, the right passes to the nearest human', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const [blue, red] = humans;
      expect(worldStepHandle(game), 'blue first').eq(blue);
      seatFirst(game, bot, [red, blue]);
      expect(worldStepHandle(game), 'the bot is skipped — red is the nearest human').eq(red);
      seatFirst(game, red, [bot, blue]);
      expect(worldStepHandle(game)).eq(red);
    });

    it('a bot-first table asks the human to remove the ocean; the bot is never asked, never paid, never discounted', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, WATER);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      game.phase = Phase.ACTION;
      const ocean = addOcean(human);
      seatFirst(game, bot, [human]);
      expect(game.playersInGenerationOrder[0]).eq(bot);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      settleParliamentGates(game);
      expect(bot.getWaitingFor(), 'the bot is never asked a political question').is.undefined;
      const prompt = removalPromptOf(human);
      expect(prompt, 'the human — the nearest seat after the bot — holds the removal').is.not.undefined;
      expect(parliament.phase?.effects?.pending?.player).eq(human.id);
      answerRemoval(game, human, ocean.id);
      expect(ocean.tile).is.undefined;
      expect(worldOutcome(parliament)).deep.include({kind: 'tileRemoved', chosenBy: human.id});
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id), 'the bot is never a recipient here').is.false;
      expect(parliament.enacted).eq(WATER);
      expect(bot.getCardCostBreakdown(new MirandaResort()).discounts, 'the bot holds no law').deep.eq([]);
      expect(human.getCardCost(new MirandaResort()), 'the human does').eq(9);
    });
  });

  describe('recovery and the model', () => {
    it('the law survives a reload: the discount stands on the copy too', () => {
      const [game, p1] = enacted();
      const live = reload(game);
      const copy = live.getPlayerById(p1.id);
      expect(copy.getCardCost(new MirandaResort())).eq(9);
    });

    it('the model carries the world record to every client, with no seat on it and the chooser named by colour', () => {
      const [game, p1, p2, , ocean] = stage();
      endGenerationThroughParliament(game);
      answerRemoval(game, p1, ocean.id);
      for (const viewer of [p1, p2]) {
        const outcomes = getParliamentModel(game, viewer)?.lastPhase?.outcomes ?? [];
        const world = outcomes.filter((o) => o.part === 'world');
        expect(world.map((o) => `${o.step}:${o.kind}:${o.space}`), `viewer ${viewer.color}`).deep.eq([`${TILE_REMOVAL_STEP_KEY}:tileRemoved:${ocean.id}`]);
        expect(world.every((o) => o.player === undefined), 'a world record names no seat on the wire').is.true;
        expect(world[0].actor, 'the chooser, by colour').eq(p1.color);
        expect(world[0].tile).eq(TileType.OCEAN);
      }
    });

    it('once enacted, the REDS rule', () => {
      const [game, p1, p2, parliament] = enacted();
      runAllActions(game);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      expect(parliament.hasPartyEffect(p1, PartyName.REDS)).is.true;
      expect(parliament.hasPartyEffect(p2, PartyName.REDS), 'the ruling party\'s effect is everyone\'s').is.true;
    });
  });
});
