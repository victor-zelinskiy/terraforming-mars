import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  NO_CITY_ON_MARS_REASON, NOT_ELIGIBLE_REASON, SKYSCRAPERS, SKYSCRAPERS_CODE, SKYSCRAPERS_GRANT, SKYSCRAPERS_ID, SKYSCRAPERS_INFLUENCE_LINE,
  SKYSCRAPERS_STEP_KEY,
} from '../../src/server/parliament/resolutions/marsFirst/Skyscrapers';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {repeatPlacementBonuses} from '../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {answerGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {
  TILE_GRANT_NO_DESTINATION_REASON, TILE_GRANT_NOT_ELIGIBLE_REASON, tileGrantEligibility, tileGrantStepKey,
} from '../../src/common/parliament/tileGrant';
import {countSpacesToward} from '../../src/common/parliament/resolutionCounts';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {MarsBoard} from '../../src/server/boards/MarsBoard';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {CardName} from '../../src/common/cards/CardName';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';

/**
 * SKYSCRAPERS (Turmoil Redux, RX20) — the winner of the vote and every
 * participant with influence ≥ 2 each gain a city tile that MUST be placed on
 * top of one of their own cities on Mars: a CITY STACK.
 *
 * What these specs pin: the recipients are a THRESHOLD set (the winner
 * always, the line for everyone else — the rule names the seat it passes
 * over); a seat with no city on Mars is skipped BY NAME; the candidates are
 * exactly the seat's own cities on Mars (never another's, never a space
 * city, never an empty cell — and shown even when there is one); the answer
 * raises the cell's stack and keeps its tile; the cell pays NOTHING again
 * (printed bonus, ocean adjacency, the law's repeat); what answers a city
 * placed still answers (a card's trigger); the record names the cell and the
 * stack; the endgame scores the adjacent greeneries once per tier with one
 * breakdown row per tier; a reload inside the question rebuilds it and lands
 * the tier once; the recipients go in turn; the chairman quest never counts
 * the tier; MarsBot is never asked and never a target.
 */
const SKY = resolutionInstanceId(SKYSCRAPERS_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Skyscrapers in slot 0 with p1's delegate on it (p1 wins it); Architecture Award governs before the enactment. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, SKY);
  seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function outcomeOf(parliament: Parliament, player: TestPlayer): SerializedEnactOutcome | undefined {
  const outcomes = parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? [];
  return outcomes.find((o) => o.player === player.id && o.step === SKYSCRAPERS_STEP_KEY && o.kind !== 'reaction');
}

/** A city for `player` on a QUIET cell (no printed bonus, no ocean beside it) — placed silently, outside any effect. */
function seatCity(game: IGame, player: TestPlayer, opts?: {bonus?: boolean, card?: CardName}): Space {
  const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
    (opts?.bonus === true ? s.bonus.includes(SpaceBonus.PLANT) : s.bonus.length === 0) &&
    !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined || (opts?.bonus !== true && a.spaceType === SpaceType.OCEAN)));
  if (space === undefined) {
    throw new Error('no cell for a city');
  }
  space.tile = {tileType: TileType.CITY, ...(opts?.card === undefined ? {} : {card: opts.card})};
  space.player = player;
  return space;
}

function greeneryBeside(game: IGame, city: Space, count: number): Array<Space> {
  const out: Array<Space> = [];
  for (const adj of game.board.getAdjacentSpaces(city)) {
    if (out.length === count) {
      break;
    }
    if (adj.tile === undefined && adj.spaceType === SpaceType.LAND) {
      adj.tile = {tileType: TileType.GREENERY};
      adj.player = city.player;
      out.push(adj);
    }
  }
  if (out.length !== count) {
    throw new Error(`only ${out.length} greeneries fit beside ${city.id}`);
  }
  return out;
}

describe('Skyscrapers', () => {
  describe('the catalog entry', () => {
    it('is RX20 of Mars First — one copy, no expansion needed, the «2 city tiles on Mars» quest, one immediate step, nothing for the winner alone or the world', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(SKYSCRAPERS_ID)).eq(SKYSCRAPERS);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode(SKYSCRAPERS_CODE)).eq(SKYSCRAPERS);
      expect(SKYSCRAPERS.party).eq(PartyName.MARS);
      expect(SKYSCRAPERS.copies).eq(1);
      expect(SKYSCRAPERS.compatibility).is.undefined;
      expect(SKYSCRAPERS.quest).deep.eq({goal: {kind: 'tile', tile: 'city'}, count: 2});
      expect(SKYSCRAPERS.immediateSteps?.map((s) => s.key)).deep.eq([SKYSCRAPERS_STEP_KEY]);
      expect(SKYSCRAPERS.winnerSteps).is.undefined;
      expect(SKYSCRAPERS.winnerReward).is.undefined;
      expect(SKYSCRAPERS.worldSteps).is.undefined;
      expect(SKYSCRAPERS.scaled).is.undefined;
      expect(SKYSCRAPERS.passive).is.undefined;
      expect(SKYSCRAPERS.renderData.rows.length).greaterThan(0);
    });

    it('declares the grant as DATA: one city tile as a tier on the seat\'s own city, for the winner and everyone at influence ≥ 2 — the tile-grant family', () => {
      expect(SKYSCRAPERS.tileGrant).eq(SKYSCRAPERS_GRANT);
      expect(SKYSCRAPERS_GRANT).deep.eq({tile: 'city', placement: 'own-city', recipients: {winner: true, influenceAtLeast: 2}});
      expect(SKYSCRAPERS_INFLUENCE_LINE).eq(2);
      expect(familyOf(SKYSCRAPERS)).eq('tile-grant');
    });

    it('ONE predicate decides who receives it: the winner at any influence, anyone else at or above the line', () => {
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: true, influence: 0})).eq('winner');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: true, influence: 1})).eq('winner');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 2})).eq('influence');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 5})).eq('influence');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 1})).eq('none');
      expect(tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: false, influence: 0})).eq('none');
    });
  });

  describe('who receives the tile', () => {
    it('the winner receives it below the line (influence 1 after its Agenda step); a seat at influence 1 that did not win is passed over BY THE RULE', () => {
      const [game, p1, p2, parliament] = stage();
      seatCity(game, p1);
      seatCity(game, p2);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(parliament.influence(p1), 'the winner\'s Agenda step came first').eq(1);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      expect(ask.placementContext?.source).deep.eq({kind: 'resolution', resolution: SKYSCRAPERS_ID});
      expect(ask.placementContext?.cancellable).is.false;
      expect(ask.placementType).eq('city-tier');
      expect(ask.tileType).eq(TileType.CITY);
      p1.process({type: 'space', spaceId: ask.spaces[0].id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomeOf(parliament, p2)).deep.eq({
        player: p2.id, step: SKYSCRAPERS_STEP_KEY, part: 'effect', kind: 'skipped', influence: 1, reason: NOT_ELIGIBLE_REASON,
      });
      expect(game.gameLog.some((e) => e.message === '${0} is below 2 influence and did not win the vote — no city tile from ${1}'), 'the journal names the rule').is.true;
    });

    it('a seat at influence 2 receives it without winning; at influence 0 it is passed over', () => {
      const [game, p1, p2, parliament] = stage();
      seatCity(game, p1);
      const city2 = seatCity(game, p2);
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGeneration(game);
      // The winner first (p1), then p2 in turn.
      p1.process({type: 'space', spaceId: cast(p1.getWaitingFor(), SelectSpace).spaces[0].id});
      runAllActions(game);
      const ask = cast(p2.getWaitingFor(), SelectSpace);
      expect(ask.spaces.map((s) => s.id)).deep.eq([city2.id]);
      p2.process({type: 'space', spaceId: city2.id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(city2.stackHeight).eq(2);
      expect(outcomeOf(parliament, p2)).deep.eq({
        player: p2.id, step: SKYSCRAPERS_STEP_KEY, part: 'effect', kind: 'city', influence: 2, space: city2.id, stackHeight: 2,
      });
      // …and at influence 0 nothing: the rule, named.
      const [game0, one, two, parliament0] = stage();
      seatCity(game0, one);
      seatCity(game0, two);
      endGeneration(game0);
      one.process({type: 'space', spaceId: cast(one.getWaitingFor(), SelectSpace).spaces[0].id});
      runAllActions(game0);
      settleParliamentGates(game0);
      expect(outcomeOf(parliament0, two)).deep.include({kind: 'skipped', influence: 0, reason: NOT_ELIGIBLE_REASON});
    });

    it('a neutral winner: nobody is the star — the line alone decides (influence 2 receives, influence 1 does not)', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, SKY);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.addNeutralVote(parliament.slots[0]);
      const city1 = seatCity(game, p1);
      seatCity(game, p2);
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      expect(parliament.phase?.summary?.winner.player).eq('NEUTRAL');
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      expect(ask.spaces.map((s) => s.id)).deep.eq([city1.id]);
      p1.process({type: 'space', spaceId: city1.id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'city', space: city1.id, stackHeight: 2});
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', reason: NOT_ELIGIBLE_REASON});
    });

    it('no city on Mars: the tile has nowhere to go — NAMED and skipped (the winner included), never «no influence»', () => {
      const [game, p1, p2, parliament] = stage();
      // p2 qualifies by influence but owns only a SPACE city — not on Mars.
      const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
      ganymede.tile = {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY};
      ganymede.player = p2;
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      // Nothing was asked: the sitting ran to its end with the two named skips.
      expect(p1.getWaitingFor()).not.instanceOf(SelectSpace);
      expect(p2.getWaitingFor()).not.instanceOf(SelectSpace);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomeOf(parliament, p1)).deep.eq({
        player: p1.id, step: SKYSCRAPERS_STEP_KEY, part: 'effect', kind: 'skipped', influence: 1, reason: NO_CITY_ON_MARS_REASON,
      });
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', influence: 3, reason: NO_CITY_ON_MARS_REASON});
      expect(ganymede.stackHeight, 'the space city is untouched').is.undefined;
      expect(game.gameLog.filter((e) => e.message === '${0} has no city on Mars — the city tile from ${1} is skipped')).has.length(2);
    });
  });

  describe('where the tile goes', () => {
    it('the candidates are the seat\'s OWN cities on Mars — never another\'s, never a space city, never an empty cell — and every other cell says why', () => {
      const [game, p1, p2] = stage();
      const mine = seatCity(game, p1);
      const theirs = seatCity(game, p2);
      const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
      ganymede.tile = {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY};
      ganymede.player = p1;
      expect(game.board.getAvailableSpacesForType(p1, 'city-tier').map((s) => s.id)).deep.eq([mine.id]);
      expect(MarsBoard.canStackCity(theirs, p1)).is.false;
      expect(MarsBoard.canStackCity(ganymede, p1)).is.false;
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      // ONE candidate is still a question (no auto-select).
      expect(ask.spaces.map((s) => s.id)).deep.eq([mine.id]);
      const reasons = new Map((ask.illegalSpaces ?? []).map((s) => [s.spaceId, s.reason]));
      expect(reasons.get(theirs.id)).eq('not-your-city');
      expect(reasons.get(ganymede.id)).eq('not-your-city');
      const empty = game.board.getAvailableSpacesForCity(p1)[0];
      expect(reasons.get(empty.id)).eq('not-your-city');
      // The engine refuses the wrong cells outright, whatever the client sends.
      expect(() => game.addCityTier(p1, theirs)).to.throw(/own city/);
      expect(() => game.addCityTier(p1, empty)).to.throw(/own city/);
      expect(() => game.addCityTier(p1, ganymede)).to.throw(/own city/);
      p1.process({type: 'space', spaceId: mine.id});
      runAllActions(game);
      expect(mine.stackHeight).eq(2);
      expect(theirs.stackHeight).is.undefined;
    });

    it('the answer raises the stack and keeps the cell\'s tile and owner — a named base stays what it was; a second tier makes a stack of 3', () => {
      const [game, p1, , parliament] = stage();
      const city = seatCity(game, p1, {card: CardName.NOCTIS_CITY});
      const tile = city.tile;
      endGeneration(game);
      p1.process({type: 'space', spaceId: city.id});
      runAllActions(game);
      expect(city.tile, 'the same tile object — the base is untouched').eq(tile);
      expect(city.tile?.card).eq(CardName.NOCTIS_CITY);
      expect(city.player?.id).eq(p1.id);
      expect(city.stackHeight).eq(2);
      expect(Board.tiersOf(city)).eq(2);
      expect(Board.isCitySpace(city)).is.true;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'city', space: city.id, stackHeight: 2});
      game.addCityTier(p1, city);
      expect(city.stackHeight).eq(3);
      expect(game.gameLog.filter((e) => e.message === '${0} built a city tile on top of their city — a stack of ${1} · ${2}')).has.length(2);
    });

    it('the cell pays NOTHING again: no printed bonus, no ocean adjacency, no Ares — and the enacted law that repeats bonuses has nothing to repeat', () => {
      const [game, p1] = stage();
      // A city on a PLANT cell BESIDE an ocean: the first city collected both. (Plants, so the ruling Mars
      // First's own steel for a tile placed — a party answer, not the cell's — cannot be mistaken for it.)
      const city = seatCity(game, p1, {bonus: true});
      const shore = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined);
      if (shore !== undefined) {
        shore.tile = {tileType: TileType.OCEAN};
      }
      expect(city.bonus).includes(SpaceBonus.PLANT);
      endGeneration(game);
      // Measured AFTER the production phase and BEFORE the tier: what the tier itself pays.
      const plants = p1.plants;
      const mc = p1.megaCredits;
      p1.lastOceanBonus = undefined;
      p1.process({type: 'space', spaceId: city.id});
      runAllActions(game);
      expect(city.stackHeight).eq(2);
      expect(p1.plants, 'the printed plants were collected by the first city').eq(plants);
      expect(p1.megaCredits, 'the ocean beside it paid the first city').eq(mc);
      expect(p1.lastOceanBonus, 'no ocean payout to present').is.undefined;
      expect(p1.lastPlacementLawPayout).is.undefined;
      // Development Craze's repeat, told the placement is a TIER, pays nothing.
      expect(repeatPlacementBonuses(p1, city, {coveringExistingTile: true, stacked: true})).is.undefined;
      expect(p1.plants).eq(plants);
      expect(p1.megaCredits).eq(mc);
    });

    it('what answers a city tile placed still answers: Rover Construction pays its 2 M€ for the tier, and the ruling Mars First pays its steel and card', () => {
      const [game, p1, p2, parliament] = stage();
      seatCity(game, p1);
      p2.playedCards.push(new RoverConstruction());
      endGeneration(game);
      // Skyscrapers is enacted BEFORE its effect: Mars First rules now — its passive answers the tier.
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      // Measured AFTER the production phase and BEFORE the tier.
      const mc = p2.megaCredits;
      const steel = p1.steel;
      const hand = p1.cardsInHand.length;
      p1.process({type: 'space', spaceId: cast(p1.getWaitingFor(), SelectSpace).spaces[0].id});
      runAllActions(game);
      expect(p2.megaCredits, 'a city tile was placed — the trigger fires').eq(mc + 2);
      expect(p1.steel, 'the party answers a tile placed on Mars — 1 steel').eq(steel + 1);
      expect(p1.cardsInHand.length, '…and a card for a city').eq(hand + 1);
      expect(game.events.events.some((e) => e.type === 'tile-placed' && e.tile === TileType.CITY && e.player === p1.color), 'the recorder saw a city placed').is.true;
    });

    it('the recipients go IN TURN: the winner\'s question stands first, the next seat\'s only after the answer', () => {
      const [game, p1, p2, parliament] = stage();
      const city1 = seatCity(game, p1);
      const city2 = seatCity(game, p2);
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectSpace);
      expect(p2.getWaitingFor(), 'p2 waits for the winner').is.undefined;
      expect(parliament.phase?.effects?.pending).deep.eq({player: p1.id, key: SKYSCRAPERS_STEP_KEY});
      p1.process({type: 'space', spaceId: city1.id});
      runAllActions(game);
      expect(p1.getWaitingFor()).is.undefined;
      cast(p2.getWaitingFor(), SelectSpace);
      expect(parliament.phase?.effects?.pending).deep.eq({player: p2.id, key: SKYSCRAPERS_STEP_KEY});
      p2.process({type: 'space', spaceId: city2.id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(city1.stackHeight).eq(2);
      expect(city2.stackHeight).eq(2);
      expect(game.board.countCities(p1)).eq(2);
      expect(game.board.countCities(p2)).eq(2);
    });
  });

  describe('the score', () => {
    it('each tier scores the cell\'s adjacent greeneries separately — a stack of 2 beside 3 greeneries is 6 VP, explained as two rows of 3', () => {
      const [game, p1] = stage();
      const city = seatCity(game, p1, {card: CardName.NOCTIS_CITY});
      greeneryBeside(game, city, 3);
      expect(p1.getVictoryPoints().city).eq(3);
      endGeneration(game);
      p1.process({type: 'space', spaceId: city.id});
      runAllActions(game);
      const vp = p1.getVictoryPoints();
      expect(vp.city).eq(6);
      expect(vp.detailsCities).deep.eq([
        {spaceId: city.id, points: 3, cardName: CardName.NOCTIS_CITY, tier: 1, tiers: 2},
        {spaceId: city.id, points: 3, cardName: undefined, tier: 2, tiers: 2},
      ]);
    });

    it('the chairman quest never counts the tier (the political phase), and the game\'s own «cities» quantity counts it', () => {
      const [game, p1, , parliament] = stage();
      const city = seatCity(game, p1);
      endGeneration(game);
      p1.process({type: 'space', spaceId: city.id});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.quest?.source).eq(SKYSCRAPERS_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tile', tile: 'city'}, count: 2});
      expect(parliament.questProgressOf(p1)).eq(0);
      expect(game.board.countCities(p1)).eq(2);
      expect(game.board.getCities(p1), 'the cells stay one').has.length(1);
    });
  });

  describe('recovery', () => {
    it('a reload inside the question rebuilds it with the same marker and candidates; the answer lands the tier once; a repeated answer is refused', () => {
      const [game, p1, p2, parliament] = stage();
      const city = seatCity(game, p1);
      seatCity(game, p2);
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectSpace);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(one.getWaitingFor(), SelectSpace);
      expect(ask.placementContext?.source).deep.eq({kind: 'resolution', resolution: SKYSCRAPERS_ID});
      expect(ask.spaces.map((s) => s.id)).deep.eq([city.id]);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const again = cast(one.getWaitingFor(), SelectSpace);
      one.process({type: 'space', spaceId: again.spaces[0].id});
      expect(() => one.process({type: 'space', spaceId: again.spaces[0].id})).to.throw();
      runAllActions(live);
      const liveCity = live.board.getSpaceOrThrow(city.id);
      expect(liveCity.stackHeight).eq(2);
      // …and the stack survives the NEXT save.
      const saved = live.serialize().board.spaces.find((s) => s.id === city.id);
      expect(saved?.stackHeight).eq(2);
      const two = live.getPlayerById(p2.id) as TestPlayer;
      const ask2 = cast(two.getWaitingFor(), SelectSpace);
      two.process({type: 'space', spaceId: ask2.spaces[0].id});
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.step === SKYSCRAPERS_STEP_KEY && o.kind === 'city')).has.length(2);
      expect(outcomes.filter((o) => o.player === p1.id && o.step === SKYSCRAPERS_STEP_KEY && o.kind !== 'reaction')).has.length(1);
    });
  });

  describe('the model', () => {
    it('the step key and the skip reasons are the DECLARATION\'s (`tileGrantStepKey`, the two reasons) — no per-card table on the client', () => {
      expect(SKYSCRAPERS_STEP_KEY).eq(tileGrantStepKey(SKYSCRAPERS_GRANT));
      expect(SKYSCRAPERS_STEP_KEY).eq('city-tier');
      expect(NOT_ELIGIBLE_REASON).eq(TILE_GRANT_NOT_ELIGIBLE_REASON);
      expect(NO_CITY_ON_MARS_REASON).eq(TILE_GRANT_NO_DESTINATION_REASON);
    });

    it('the seat model carries the DESTINATIONS as a board count (`marsCities`): the very cells the step offers — a cell once whatever its stack; a space city and another\'s city are not in it', () => {
      const [game, p1, p2] = stage();
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG), 'the grant declares its count').includes('marsCities');
      const mine = seatCity(game, p1);
      mine.stackHeight = 2;
      const theirs = seatCity(game, p2);
      const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
      ganymede.tile = {tileType: TileType.CITY};
      ganymede.player = p1;
      const count = (player: TestPlayer) => getParliamentModel(game, player)?.players.find((p) => p.color === player.color)?.counts?.find((c) => c.id === 'marsCities');
      expect(count(p1)).deep.eq({id: 'marsCities', count: 1, cards: [], spaces: [mine.id]});
      expect(count(p1)?.spaces, 'the count IS the candidate list').deep.eq(game.board.getAvailableSpacesForType(p1, 'city-tier').map((s) => s.id));
      expect(count(p2)).deep.eq({id: 'marsCities', count: 1, cards: [], spaces: [theirs.id]});
      expect(resolutionCount(p1, 'marsCities')).deep.eq({id: 'marsCities', count: 1, cards: [], spaces: [mine.id]});
    });

    it('PARITY: the shared cell predicate (the stand\'s) agrees with the engine\'s candidate list over a corpus of boards', () => {
      const corpus: Array<(game: IGame, p1: TestPlayer, p2: TestPlayer) => void> = [
        () => {},
        (game, p1) => {
          seatCity(game, p1);
        },
        (game, p1) => {
          seatCity(game, p1).stackHeight = 3;
          seatCity(game, p1);
        },
        (game, p1, p2) => {
          seatCity(game, p1);
          seatCity(game, p2);
          const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
          ganymede.tile = {tileType: TileType.CITY};
          ganymede.player = p1;
        },
        (game, p1) => {
          const city = seatCity(game, p1);
          greeneryBeside(game, city, 2);
        },
      ];
      for (const arrange of corpus) {
        const [game, p1, p2] = stage();
        arrange(game, p1, p2);
        const own = game.board.spaces.filter((s) => s.player === p1);
        const stand = countSpacesToward('marsCities', own);
        const engine = game.board.getAvailableSpacesForType(p1, 'city-tier').map((s) => s.id);
        expect(stand.spaces, `board #${corpus.indexOf(arrange)}`).deep.eq(engine);
        expect(stand.count).eq(engine.length);
      }
    });
  });

  describe('MarsBot', () => {
    it('is never asked, never a target: the human\'s tier lands on the human\'s city, the bot\'s city is no candidate and no stack', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, SKY);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      const mine = game.board.getAvailableSpacesForCity(human)[0];
      mine.tile = {tileType: TileType.CITY};
      mine.player = human;
      const bots = game.board.getAvailableSpacesForCity(bot).find((s) => !game.board.getAdjacentSpaces(s).some((a) => a.id === mine.id))!;
      bots.tile = {tileType: TileType.CITY};
      bots.player = bot;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      const ask = cast(human.getWaitingFor(), SelectSpace);
      expect(ask.spaces.map((s) => s.id)).deep.eq([mine.id]);
      expect(bot.getWaitingFor()).is.undefined;
      human.process({type: 'space', spaceId: mine.id});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(mine.stackHeight).eq(2);
      expect(bots.stackHeight).is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.outcomes?.filter((o) => o.player === bot.id), 'no record for the bot').has.length(0);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });
  });
});
