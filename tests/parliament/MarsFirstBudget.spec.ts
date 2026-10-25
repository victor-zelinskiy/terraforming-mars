import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  MARS_FIRST_BUDGET, MARS_FIRST_BUDGET_CODE, MARS_FIRST_BUDGET_GRANT, MARS_FIRST_BUDGET_ID, MARS_FIRST_BUDGET_LEVY, MARS_FIRST_BUDGET_LEVY_AMOUNT,
  MARS_FIRST_BUDGET_MEGACREDITS, MARS_FIRST_BUDGET_NO_TAGS_REASON,
} from '../../src/server/parliament/resolutions/marsFirst/MarsFirstBudget';
import {GREENS_BUDGET} from '../../src/server/parliament/resolutions/greens/GreensBudget';
import {SKYSCRAPERS_GRANT} from '../../src/server/parliament/resolutions/marsFirst/Skyscrapers';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, gatePromptOf, seatResolution, settleParliamentGates, sittingOpen, questionOf} from './parliamentArrange';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {botWinnerRewardKind, botWinsSomething, declaresWinnerPart} from '../../src/server/automa/BotWinnerReward';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {BoardName} from '../../src/common/boards/BoardName';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {cardCountVerdict, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyNothingReasonKey, levyShortReasonKey} from '../../src/common/parliament/resolutionLevy';
import {
  TILE_GRANT_NO_SPACE_REASON, tileGrantCountId, tileGrantEligibility, tileGrantInfluenceLine, tileGrantRewardsWinner, tileGrantStepKey,
} from '../../src/common/parliament/tileGrant';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {MartianRoads} from '../../src/server/cards/turmoilRedux/MartianRoads';
import {MechSports} from '../../src/server/cards/turmoilRedux/MechSports';
import {Mine} from '../../src/server/cards/base/Mine';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {DeclarationOfIndependence} from '../../src/server/cards/pathfinders/DeclarationOfIndependence';
import {MartianMonuments} from '../../src/server/cards/pathfinders/MartianMonuments';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';

/**
 * MARS FIRST BUDGET (Turmoil Redux, RX38) — the SIXTH card of the BUDGET
 * family, ASSEMBLED whole: the shared levy of 12 M€ (RX15), a count over TWO
 * tags (building + Mars) + influence, and the tile grant's SECOND variant —
 * a city for EVERY seat by the ordinary rules, clockwise from the first
 * player (the shared `tileGrantStep`, Skyscrapers' executor). And the first
 * grant MarsBot takes a seat of (decision D11): the tile, never the money.
 *
 * What these specs pin (docs/claude/prompts/resolution-rx38-mars-first-budget.md
 * §2): the printed order is the executed order, seat by seat (levy → payout
 * → city, then the next seat); the levy is the family's (20 / 5 / 0 M€); the
 * count is building + Mars tags added up (a card with both is 2, a wild tag
 * none, an event face down, the per-tag breakdown on the record); the city is
 * every participant's, voter or not, MANDATORY, by the ordinary rules, an
 * earlier seat's city closing the cells beside it for the later ones; no
 * legal cell is a named skip; the cell pays its bonus and its ocean
 * adjacency, and the ruling Mars First answers every HUMAN's city with a
 * steel and a card; a paid cell is offered only to a seat that can afford it
 * AFTER the levy and the payout; the quest never counts the sitting's city;
 * a reload inside the question rebuilds it and nothing is paid twice; and
 * MarsBot — never levied, never paid, never answered by the ruling party —
 * places its own city by its own rule IN ITS PLACE in the order, without a
 * Failed Action on an empty board, and never twice.
 */
const BUDGET = resolutionInstanceId(MARS_FIRST_BUDGET_ID, 0);
const CITY = tileGrantStepKey(MARS_FIRST_BUDGET_GRANT);

function reduxGame(options?: {boardName?: BoardName}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, ...(options ?? {})});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the budget in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(options?: {boardName?: BoardName}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame(options);
  seatResolution(parliament, 0, BUDGET);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function allRecords(parliament: Parliament): Array<SerializedEnactOutcome> {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes ?? [];
}

function recordsOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return allRecords(parliament).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

function outcomeOf(parliament: Parliament, player: IPlayer, step: string): SerializedEnactOutcome | undefined {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

function cityPrompt(player: IPlayer): SelectSpace {
  return cast(player.getWaitingFor(), SelectSpace);
}

/** A QUIET land cell — no printed bonus, nothing beside it (no tile, no ocean cell), never one of `avoid` or beside them. */
function quietCell(game: IGame, avoid: ReadonlyArray<Space> = []): Space {
  const near = (s: Space) => avoid.some((a) => a.id === s.id || game.board.getAdjacentSpaces(a).some((n) => n.id === s.id));
  const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0 &&
    s.id !== game.board.noctisCitySpaceId && !near(s) &&
    !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined || a.spaceType === SpaceType.OCEAN));
  if (space === undefined) {
    throw new Error('no quiet cell');
  }
  return space;
}

/** Cover every free land cell with a nobody's greenery — the ordinary city rules then leave no cell at all. */
function fillMars(game: IGame): void {
  for (const space of game.board.spaces) {
    if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
      space.tile = {tileType: TileType.GREENERY};
    }
  }
}

describe('MarsFirstBudget', () => {
  describe('the catalog entry', () => {
    it('is RX38 of Mars First, dealt as ONE card, with the 2-Mars-tag quest and no winner, world, passive or action part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MARS_FIRST_BUDGET_ID)).eq(MARS_FIRST_BUDGET);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode(MARS_FIRST_BUDGET_CODE)).eq(MARS_FIRST_BUDGET);
      expect(MARS_FIRST_BUDGET_CODE).eq('RX38');
      expect(MARS_FIRST_BUDGET.party).eq(PartyName.MARS);
      expect(MARS_FIRST_BUDGET.copies).eq(1);
      expect(MARS_FIRST_BUDGET.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(MARS_FIRST_BUDGET.quest).deep.eq({goal: {kind: 'tag', tag: Tag.MARS}, count: 2});
      expect(MARS_FIRST_BUDGET.winnerSteps).is.undefined;
      expect(MARS_FIRST_BUDGET.winnerReward).is.undefined;
      expect(MARS_FIRST_BUDGET.worldSteps).is.undefined;
      expect(MARS_FIRST_BUDGET.passive).is.undefined;
      expect(MARS_FIRST_BUDGET.action).is.undefined;
      expect(familyOf(MARS_FIRST_BUDGET), 'a budget — the grant to everyone qualifies nobody').eq(familyOf(GREENS_BUDGET));
      expect(familyOf(MARS_FIRST_BUDGET)).eq('counted-tags');
    });

    it('is ASSEMBLED: the family\'s levy at 12 first, a count over TWO tags, and the grant\'s second variant (everyone · any legal cell) last', () => {
      expect(MARS_FIRST_BUDGET.levy).eq(MARS_FIRST_BUDGET_LEVY);
      expect(MARS_FIRST_BUDGET_LEVY).deep.eq({resource: Resource.MEGACREDITS, amount: MARS_FIRST_BUDGET_LEVY_AMOUNT, recipient: 'each'});
      expect(MARS_FIRST_BUDGET.scaled).deep.eq([MARS_FIRST_BUDGET_MEGACREDITS]);
      expect(MARS_FIRST_BUDGET_MEGACREDITS.count).deep.eq({id: 'buildingMarsTags', per: 1});
      expect(resolutionCountKind('buildingMarsTags')).deep.eq({kind: 'tags', tags: [Tag.BUILDING, Tag.MARS]});
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('buildingMarsTags');
      expect(MARS_FIRST_BUDGET.tileGrant).deep.eq({tile: 'city', placement: 'any-legal', recipients: {kind: 'everyone'}});
      expect(MARS_FIRST_BUDGET.immediateSteps?.map((s) => s.key), 'the printed order').deep.eq([LEVY_STEP_KEY, 'megacredits', CITY]);
      expect(CITY).eq('city');
    });

    it('the grant\'s TWO questions read apart: WHO (everyone — no line, no winner\'s part) and WHERE (any legal cell — nothing to count)', () => {
      expect(tileGrantEligibility(MARS_FIRST_BUDGET_GRANT, {winner: false, influence: 0})).eq('everyone');
      expect(tileGrantEligibility(MARS_FIRST_BUDGET_GRANT, {winner: true, influence: 0})).eq('everyone');
      expect(tileGrantInfluenceLine(MARS_FIRST_BUDGET_GRANT)).is.undefined;
      expect(tileGrantRewardsWinner(MARS_FIRST_BUDGET_GRANT)).is.false;
      expect(tileGrantCountId(MARS_FIRST_BUDGET_GRANT), 'the legal cells explain nothing').is.undefined;
      // Skyscrapers keeps its own two answers, migrated byte for byte.
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 1})).eq('none');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 2})).eq('influence');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: true, influence: 0})).eq('winner');
      expect(tileGrantCountId(SKYSCRAPERS_GRANT)).eq('marsCities');
      expect(tileGrantStepKey(SKYSCRAPERS_GRANT)).eq('city-tier');
      // No winner's part for the bot pass, and no ★ for the vote chooser.
      expect(declaresWinnerPart(MARS_FIRST_BUDGET)).is.false;
      expect(botWinnerRewardKind(MARS_FIRST_BUDGET)).is.undefined;
      expect(botWinsSomething(MARS_FIRST_BUDGET)).is.false;
    });

    it('the shared count asks ONE question of a card — does it PRINT a building or a Mars tag, face up', () => {
      const up = {eventTagsInPlay: false};
      expect(cardCountVerdict('buildingMarsTags', new MartianRoads(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('buildingMarsTags', new Mine(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('buildingMarsTags', new MechSports(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('buildingMarsTags', new NobelPrize(), up)).deep.eq({counts: false, reason: 'No building or Mars tag'});
      expect(cardCountVerdict('buildingMarsTags', new DeclarationOfIndependence(), up), 'a played event lies face down').deep.eq({counts: false, reason: 'A played event is face down'});
    });
  });

  describe('the enactment — the printed order, seat by seat', () => {
    it('levy → payout → city for p1, THEN all three for p2; p1\'s city closes the cells beside it; both cities are paid by the ruling Mars First', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Martian Roads (2) + Mine (1) = 3 → +6.
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new MartianRoads(), new Mine());
      p1.terraformRating = 0;
      // p2 never voted — influence 1, no card: the influence pays on its own, and the city is p2's all the same.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      p2.terraformRating = 0;
      endGenerationThroughParliament(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty(), 'the law takes the ENACTED slot before its steps run').eq(PartyName.MARS);
      // THE MONEY IS SETTLED BEFORE THE QUESTION: the levy and the payout are recorded, the city asks.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -12, owed: 12, before: 20, after: 8});
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', amount: 6, count: 3, influence: 3, before: 8, after: 14});
      expect(paid1.counted).deep.eq([CardName.MARTIAN_ROADS, CardName.MINE]);
      expect(paid1.countedUnits).deep.eq([2, 1]);
      expect(paid1.countedByTag).deep.eq([{tag: Tag.BUILDING, count: 2}, {tag: Tag.MARS, count: 1}]);
      // THE CITY: the ordinary city rules' cells, the resolution as the source, a COMMITTED placement (mandatory — no way out).
      const ask1 = cityPrompt(p1);
      expect(ask1.spaces.map((s) => s.id)).deep.eq(game.board.getAvailableSpacesForType(p1, 'city').map((s) => s.id));
      expect(ask1.placementContext?.source).deep.eq({kind: 'resolution', resolution: MARS_FIRST_BUDGET_ID});
      expect(ask1.placementContext?.cancellable, 'Р2: the city is mandatory').is.not.true;
      expect(questionOf(p2), 'the next seat waits for the whole of p1\'s part').is.undefined;
      expect(recordsOf(parliament, p2), 'p2 has paid nothing yet').deep.eq([]);
      const x = quietCell(game);
      const steel1 = p1.steel;
      const hand1 = p1.cardsInHand.length;
      p1.process({type: 'space', spaceId: x.id});
      runAllActions(game);
      expect(x.tile?.tileType).eq(TileType.CITY);
      expect(x.player?.id).eq(p1.id);
      expect(p1.steel, 'Р3: the ruling Mars First pays a steel for the tile').eq(steel1 + 1);
      expect(p1.cardsInHand.length, '…and a card for the city').eq(hand1 + 1);
      expect(outcomeOf(parliament, p1, CITY), 'a new city names its cell — no stack').deep.eq({player: p1.id, step: CITY, part: 'effect', kind: 'city', influence: 3, space: x.id});
      const reaction = allRecords(parliament).find((o) => o.kind === 'reaction' && o.player === p1.id && o.step === CITY);
      expect(reaction, 'the party\'s answer rides the city step\'s own record').deep.include({party: PartyName.MARS, stock: Resource.STEEL, amount: 1});
      // …only THEN p2: its levy, its payout, its city — and p1's city has closed the cells beside it.
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -12, owed: 12});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 1, count: 0, influence: 1});
      const ask2 = cityPrompt(p2);
      const closed = game.board.getAdjacentSpaces(x).map((s) => s.id);
      expect(ask2.spaces.map((s) => s.id).filter((id) => closed.includes(id) || id === x.id), 'the order matters: an earlier city closes its neighbours').deep.eq([]);
      const y = quietCell(game, [x]);
      p2.process({type: 'space', spaceId: y.id});
      runAllActions(game);
      expect(outcomeOf(parliament, p2, CITY)).deep.include({kind: 'city', space: y.id});
      // THE ORDER, whole: every record of p1 before any of p2.
      expect(allRecords(parliament).filter((o) => o.kind !== 'reaction').map((o) => `${o.player}:${o.step}`)).deep.eq([
        `${p1.id}:${LEVY_STEP_KEY}`, `${p1.id}:megacredits`, `${p1.id}:${CITY}`,
        `${p2.id}:${LEVY_STEP_KEY}`, `${p2.id}:megacredits`, `${p2.id}:${CITY}`,
      ]);
      expect(gatePromptOf(p1)).is.not.undefined;
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('the levy is the family\'s, bounded by the seat: 20 M€ leaves 8; 5 M€ pays 5 of 12 and says so; 0 M€ is a named skip — every seat still gets its payout and its city', () => {
      // 5 M€: the take is what the seat holds, the shortfall on the paying record, the payout and the city still come.
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 5;
      p1.terraformRating = 0;
      endGenerationThroughParliament(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include(
        {kind: 'stock', amount: -5, owed: 12, before: 5, after: 0, reason: levyShortReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 3, count: 0, influence: 3, before: 0, after: 3});
      expect(cityPrompt(p1).spaces.length, 'the levy asks no solvency — the city is still asked').is.greaterThan(0);

      // 0 M€: a named skip carrying the owed sum — the payout and the city still come.
      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      q1.megaCredits = 0;
      q1.terraformRating = 0;
      endGenerationThroughParliament(game2);
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.eq(
        {player: q1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 12, reason: levyNothingReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 3, before: 0, after: 3});
      expect(cityPrompt(q1).spaces.length).is.greaterThan(0);
    });

    it('the count is TWO tags added up: a card printing both counts twice, a wild tag is none, a played event is face down; zero tags AND zero influence is a NAMED zero', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 0;
      // Martian Roads (Mars + building = 2) + Mech Sports (Mars) + Mine (building) = 4;
      // Nobel Prize (wild) counts nothing; Declaration of Independence (an EVENT with a Mars tag) lies face down.
      p1.playedCards.push(new MartianRoads(), new MechSports(), new Mine(), new NobelPrize(), new DeclarationOfIndependence());
      p2.playedCards.push(new NobelPrize());
      p2.terraformRating = 0;
      const live = resolutionCount(p1, 'buildingMarsTags');
      expect(live.count).eq(4);
      expect(live.cards).deep.eq([CardName.MARTIAN_ROADS, CardName.MECH_SPORTS, CardName.MINE]);
      expect(live.units).deep.eq([2, 1, 1]);
      expect(live.byTag).deep.eq([{tag: Tag.BUILDING, count: 2}, {tag: Tag.MARS, count: 2}]);
      expect(p1.tags.count(Tag.MARS, 'raw'), 'the canonical counter agrees — and needs no Pathfinders gate').eq(2);
      endGenerationThroughParliament(game);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 7, count: 4, influence: 3});
      p1.process({type: 'space', spaceId: quietCell(game).id});
      runAllActions(game);
      // p2: influence 0 and no tag — a named zero, and the levy and the city are its own all the same.
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: MARS_FIRST_BUDGET_NO_TAGS_REASON});
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no building or Mars tags and no influence')), 'p2\'s zero is named').has.length(1);
      expect(cityPrompt(p2).spaces.length).is.greaterThan(0);
    });

    it('no legal cell — a NAMED skip for every seat, nothing instead, and the sitting does not stall', () => {
      const [game, p1, p2, parliament] = stage();
      fillMars(game);
      endGenerationThroughParliament(game);
      for (const player of [p1, p2]) {
        expect(outcomeOf(parliament, player, CITY), player.color).deep.include({kind: 'skipped', reason: TILE_GRANT_NO_SPACE_REASON});
      }
      expect(game.gameLog.filter((e) => e.message === '${0} has no legal space for a city tile — the city tile from ${1} is skipped')).has.length(2);
      expect(parliament.phase, 'nothing asked — the chain ran to its end and the sitting is closed').is.undefined;
      expect(game.generation).eq(2);
    });

    it('the cell pays as any city of the political phase: its printed bonus and the ocean beside it', () => {
      const [game, p1, , parliament] = stage();
      // A STEEL cell beside an ocean cell holding a real ocean, with no tile next to it otherwise.
      const cell = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.includes(SpaceBonus.STEEL) &&
        game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN) && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined))!;
      const water = game.board.getAdjacentSpaces(cell).find((a) => a.spaceType === SpaceType.OCEAN)!;
      water.tile = {tileType: TileType.OCEAN};
      endGenerationThroughParliament(game);
      const steelBonus = cell.bonus.filter((b) => b === SpaceBonus.STEEL).length;
      const oceans = game.board.getAdjacentSpaces(cell).filter((a) => Board.isOceanSpace(a)).length;
      const steel = p1.steel;
      const mc = p1.megaCredits;
      p1.process({type: 'space', spaceId: cell.id});
      runAllActions(game);
      expect(p1.steel, 'the printed steel + the ruling Mars First\'s one').eq(steel + steelBonus + 1);
      expect(p1.megaCredits, '2 M€ per ocean beside the cell').eq(mc + 2 * oceans);
      expect(outcomeOf(parliament, p1, CITY)).deep.include({kind: 'city', space: cell.id});
    });

    it('a paid cell is offered only to a seat that can afford it AFTER the levy and the payout (Hellas\' South Pole, 6 M€)', () => {
      const [game, p1, p2, parliament] = stage({boardName: BoardName.HELLAS});
      const pole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
      // p1 holds 12 M€ at the sitting: −12 → 0, then +1 (the winner's influence 1) — the pole is out of reach.
      p1.megaCredits = 12;
      p1.terraformRating = 0;
      // p2 holds 30: −12 → 18 — the pole is a candidate.
      p2.megaCredits = 30;
      p2.terraformRating = 0;
      endGenerationThroughParliament(game);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({after: 1});
      expect(cityPrompt(p1).spaces.map((s) => s.id), 'with 1 M€ the paid cell is not offered').not.includes(pole.id);
      expect(cityPrompt(p1).spaces.length, 'the free cells are').is.greaterThan(0);
      p1.process({type: 'space', spaceId: quietCell(game, [pole]).id});
      runAllActions(game);
      expect(cityPrompt(p2).spaces.map((s) => s.id), 'with 18 M€ it is').includes(pole.id);
    });

    it('a reload INSIDE the city question rebuilds the same question; the levy and the payout are never taken or paid twice; the city lands once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 0;
      endGenerationThroughParliament(game);
      const spaces = cityPrompt(p1).spaces.map((s) => s.id);
      const mc = p1.megaCredits;
      const live = reload(game);
      const q1 = live.getPlayerById(p1.id) as TestPlayer;
      const parl = live.parliament!;
      expect(cityPrompt(q1).spaces.map((s) => s.id)).deep.eq(spaces);
      expect(q1.megaCredits, 'nothing taken or paid again').eq(mc);
      expect(recordsOf(parl, q1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      const x = quietCell(live);
      q1.process({type: 'space', spaceId: x.id});
      runAllActions(live);
      expect(live.board.spaces.filter((s) => s.player?.id === q1.id && Board.isCitySpace(s))).has.length(1);
      expect(recordsOf(parl, q1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', CITY]);
    });
  });

  describe('the chairman quest — play 2 Mars tags', () => {
    it('the sitting\'s city moves no progress (the political phase); the player\'s OWN Mars tags complete it', () => {
      const [game, p1, p2, parliament] = stage();
      endGenerationThroughParliament(game);
      p1.process({type: 'space', spaceId: quietCell(game).id});
      runAllActions(game);
      p2.process({type: 'space', spaceId: quietCell(game, game.board.spaces.filter((s) => Board.isCitySpace(s))).id});
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(MARS_FIRST_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.MARS}, count: 2});
      expect(parliament.questProgressOf(p1), 'the city plays no tag').eq(0);
      p1.playCard(new MechSports());
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      p1.playCard(new MartianMonuments());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('the model — what the client reads', () => {
    it('every seat\'s two-tag count rides the model; the grant counts nothing; the human seat takes the tile', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new MartianRoads());
      const model = getParliamentModel(game, p1)!;
      const one = model.players.find((p) => p.color === p1.color)!;
      expect(one.counts?.find((c) => c.id === 'buildingMarsTags')).deep.include({count: 2, cards: [CardName.MARTIAN_ROADS], units: [2],
        byTag: [{tag: Tag.BUILDING, count: 1}, {tag: Tag.MARS, count: 1}]});
      expect(one.seatGrant).is.true;
      expect(model.players.find((p) => p.color === p2.color)?.seatGrant).is.true;
    });
  });

  describe('MarsBot — a seat of the city, never of the money (decision D11)', () => {
    type Table = {game: IGame; human: TestPlayer; bot: IPlayer; parliament: Parliament};

    function seated(mode: 'politics' | 'none' = 'politics', arrange?: (t: Table) => void): Table {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.slots.forEach((slot) => (slot.votes = []));
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new MartianRoads());
      const table = {game, human, bot, parliament};
      arrange?.(table);
      return table;
    }

    /**
     * The human passes, the bot (an empty deck) passes, the generation ends into the sitting — which runs at once
     * up to the human's city (or, nothing asked, to its end). The bot's cash is read BEFORE the pass: the chain no
     * longer stops ahead of the enactment, and MarsBot has no production phase to move it in between.
     */
    function intoTheSitting(t: Table): number {
      t.game.automa!.actionDeck = [];
      const botCash = t.bot.megaCredits;
      t.human.popWaitingFor();
      t.game.playerHasPassed(t.human);
      t.game.playerIsFinishedTakingActions();
      // The sitting has convened: its chain stands at the human's city, or — no legal cell, nothing asked — it has run to its end.
      expect(sittingOpen(t.game), 'the sitting has convened').is.true;
      expect(t.bot.getWaitingFor(), 'the bot is never asked').is.undefined;
      return botCash;
    }

    /** Three greeneries around one cell — the bot's rule («next to as much greenery as possible») then has an answer. */
    function greeneriesAround(game: IGame): Space {
      const centre = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= 4)!;
      game.board.getAdjacentSpaces(centre).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).slice(0, 3)
        .forEach((a) => (a.tile = {tileType: TileType.GREENERY}));
      return centre;
    }

    function adjacentGreeneries(game: IGame, space: Space): number {
      return game.board.getAdjacentSpaces(space).filter((a) => a.tile?.tileType === TileType.GREENERY).length;
    }

    function botRecords(t: Table): Array<SerializedEnactOutcome> {
      return allRecords(t.parliament).filter((o) => o.player === t.bot.id);
    }

    it('never levied, never paid, never answered by the ruling party — and it places its city by ITS OWN rule, in its place after the human', () => {
      let centre: Space | undefined;
      const t = seated('politics', ({game}) => (centre = greeneriesAround(game)));
      const botSteel = t.bot.steel;
      const botCash = intoTheSitting(t);
      // The human is first: levy, payout, the city question.
      expect(cityPrompt(t.human).spaces.length).is.greaterThan(0);
      expect(botRecords(t), 'the bot waits for its turn in the order').deep.eq([]);
      t.human.process({type: 'space', spaceId: quietCell(t.game, [centre!]).id});
      runAllActions(t.game);
      const records = botRecords(t);
      expect(records.map((o) => o.step), 'the city alone — no levy, no payout').deep.eq([CITY]);
      const landed = t.game.board.getSpaceOrThrow(records[0].space!);
      expect(records[0]).deep.include({part: 'effect', kind: 'city'});
      expect(records[0].stackHeight).is.undefined;
      expect(landed.player?.id).eq(t.bot.id);
      expect(landed.id, 'next to as much greenery as possible — the one cell beside all three').eq(centre!.id);
      expect(adjacentGreeneries(t.game, landed)).eq(3);
      expect(t.bot.megaCredits, 'no levy, no payout, no Failed Action').eq(botCash);
      expect(t.bot.steel, 'MarsBot ignores the ruling party').eq(botSteel);
      expect(t.game.events.events.filter((e) => e.player === t.bot.color && e.type === 'resource-changed' && e.source?.kind === 'resolution'),
        'nothing reached the bot\'s supply under the resolution').is.empty;
      expect(t.bot.getWaitingFor()).is.undefined;
      settleParliamentGates(t.game);
      expect(t.parliament.phase).is.undefined;
    });

    it('a FIRST-PLAYER bot places FIRST, and its city closes the cells beside it for the human', () => {
      const t = seated('politics', ({game, bot}) => {
        greeneriesAround(game);
        game.overrideFirstPlayer(bot);
      });
      intoTheSitting(t);
      const [record] = botRecords(t);
      expect(record, 'the bot placed before the human was asked').deep.include({kind: 'city'});
      expect(recordsOf(t.parliament, t.human).map((o) => o.step), 'the human\'s money comes after the bot\'s city').deep.eq([LEVY_STEP_KEY, 'megacredits']);
      const closed = t.game.board.getAdjacentSpaces(t.game.board.getSpaceOrThrow(record.space!)).map((s) => s.id);
      expect(cityPrompt(t.human).spaces.map((s) => s.id).filter((id) => closed.includes(id) || id === record.space)).deep.eq([]);
      expect(allRecords(t.parliament).filter((o) => o.kind !== 'reaction').map((o) => o.player)).deep.eq([t.bot.id, t.human.id, t.human.id]);
    });

    it('no legal cell — a named skip for the bot as for the human, and NO Failed Action', () => {
      const t = seated('politics', ({game}) => fillMars(game));
      const botCash = intoTheSitting(t);
      expect(outcomeOf(t.parliament, t.human, CITY)).deep.include({kind: 'skipped', reason: TILE_GRANT_NO_SPACE_REASON});
      expect(botRecords(t)).deep.eq([{player: t.bot.id, step: CITY, part: 'effect', kind: 'skipped', influence: t.parliament.influence(t.bot), reason: TILE_GRANT_NO_SPACE_REASON}]);
      expect(t.bot.megaCredits, 'a law is not a printed icon — no Failed Action compensation').eq(botCash);
    });

    it('a human\'s Tharsis Republic answers the bot\'s city like any other city on Mars', () => {
      const t = seated('politics', ({game, human, bot}) => {
        greeneriesAround(game);
        human.playedCards.push(new TharsisRepublic());
        game.overrideFirstPlayer(bot);
      });
      const production = t.human.production.megacredits;
      intoTheSitting(t);
      expect(botRecords(t)[0]).deep.include({kind: 'city'});
      expect(t.human.production.megacredits, '+1 M€ production for the bot\'s city on Mars').eq(production + 1);
    });

    it('a reload AFTER the bot\'s city and BEFORE the human\'s answer — the bot never places a second city', () => {
      const t = seated('politics', ({game, bot}) => {
        greeneriesAround(game);
        game.overrideFirstPlayer(bot);
      });
      intoTheSitting(t);
      expect(botRecords(t)).has.length(1);
      const live = reload(t.game);
      const human = live.getPlayerById(t.human.id) as TestPlayer;
      const bot = live.getPlayerById(t.bot.id);
      const botCities = () => live.board.spaces.filter((s) => s.player?.id === bot.id && Board.isCitySpace(s)).length;
      expect(botCities()).eq(1);
      human.process({type: 'space', spaceId: cityPrompt(human).spaces[0].id});
      runAllActions(live);
      settleParliamentGates(live);
      expect(botCities(), 'one city, never two').eq(1);
      expect(allRecords(live.parliament!).filter((o) => o.player === bot.id)).has.length(1);
    });

    it('mode \'none\' — the bot takes no seat of anything: no city, no record', () => {
      const t = seated('none', ({game}) => greeneriesAround(game));
      intoTheSitting(t);
      t.human.process({type: 'space', spaceId: quietCell(t.game).id});
      runAllActions(t.game);
      settleParliamentGates(t.game);
      expect(botRecords(t)).deep.eq([]);
      expect(t.game.board.spaces.filter((s) => s.player?.id === t.bot.id && Board.isCitySpace(s))).has.length(0);
    });

    it('the model: the bot\'s seat takes the tile and is paid nothing; under \'none\' it takes neither', () => {
      const politics = seated('politics');
      const seat = getParliamentModel(politics.game, politics.human)!.players.find((p) => p.color === politics.bot.color)!;
      expect(seat).deep.include({participates: true, enactment: false, seatGrant: true});
      expect(seat.counts, 'no payout count for a seat the law does not pay').is.undefined;
      const none = seated('none');
      const quiet = getParliamentModel(none.game, none.human)!.players.find((p) => p.color === none.bot.color);
      expect(quiet === undefined || quiet.seatGrant === false).is.true;
    });
  });
});
