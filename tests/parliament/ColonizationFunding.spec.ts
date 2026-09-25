import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  COLONIZATION_FUNDING, COLONIZATION_FUNDING_CAP, COLONIZATION_FUNDING_CODE, COLONIZATION_FUNDING_ID, COLONIZATION_FUNDING_PER_CITY,
  COLONIZATION_FUNDING_PRODUCTION,
} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {CENTRAL_POWER_GRID, CENTRAL_POWER_GRID_PRODUCTION} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '../../src/common/cards/render/CardRenderSymbolType';
import {isICardRenderItem, isICardRenderSymbol} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {countSpacesToward, resolutionCountKind, spaceCountVerdict} from '../../src/common/parliament/resolutionCounts';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {addCity, addGreenery, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {MoonExpansion} from '../../src/server/moon/MoonExpansion';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GanymedeColony} from '../../src/server/cards/base/GanymedeColony';
import {PhobosSpaceHaven} from '../../src/server/cards/base/PhobosSpaceHaven';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * COLONIZATION FUNDING (Turmoil Redux, RX08) — the THIRD card of the «counter
 * + influence → capped production» family, and the first whose counter reads
 * THE BOARD: min(6, 2 × S + I) for every participant, S the player's SPACE
 * CITIES as the engine counts them (`MarsBoard.getCitiesOffMars`), I the
 * Redux influence after the winner's Agenda step.
 *
 * What these specs pin: the formula's examples (influence pays on its own, the
 * cap bounds the SUM); the count is the engine's — a city on Mars, a rival's
 * space city, the Moon's tiles and an empty reserved area count nothing, a
 * Venus reserved area counts like the base ones; the shared cell predicate the
 * stand uses agrees with the engine over a corpus of boards; the record
 * freezes the count WITH ITS CELLS and a reload pays nothing twice; the
 * chairman quest sees the player's own space city and nothing else; MarsBot
 * is never counted or paid; the model carries the cells to the client.
 */
const FUNDING = resolutionInstanceId(COLONIZATION_FUNDING_ID, 0);
const GANYMEDE = SpaceName.GANYMEDE_COLONY;
const PHOBOS = SpaceName.PHOBOS_SPACE_HAVEN;

function reduxGame(options: {venus?: boolean, moon?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {
    turmoilReduxExpansion: true, coloniesExtension: true,
    venusNextExtension: options.venus === true, moonExpansion: options.moon === true,
  });
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Colonization Funding in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, FUNDING);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'production');
}

/** The ids of `player`'s cities off Mars, as THE ENGINE reads them. */
function engineSpaceCities(player: TestPlayer): Array<string> {
  return player.game.board.getCitiesOffMars(player).map((s) => s.id);
}

describe('ColonizationFunding', () => {
  describe('the catalog entry', () => {
    it('is RX08 of Unity, dealt as ONE card in every game (no expansion needed), with the one-space-city quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(COLONIZATION_FUNDING_ID)).eq(COLONIZATION_FUNDING);
      expect(COLONIZATION_FUNDING_CODE).eq('RX08');
      expect(COLONIZATION_FUNDING_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX08')).eq(COLONIZATION_FUNDING);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX04'), 'earlier codes stand — a code is assigned by hand').eq(CENTRAL_POWER_GRID);
      expect(COLONIZATION_FUNDING.party).eq(PartyName.UNITY);
      expect(COLONIZATION_FUNDING.compatibility, 'a base card: the reserved areas off Mars are the base game\'s').is.undefined;
      expect(COLONIZATION_FUNDING.quest).deep.eq({goal: {kind: 'tile', tile: 'spaceCity'}, count: 1});
      expect(COLONIZATION_FUNDING.scaled).deep.eq([COLONIZATION_FUNDING_PRODUCTION]);
      expect(COLONIZATION_FUNDING.winnerSteps, 'no winner-only part').is.undefined;
      expect(COLONIZATION_FUNDING.winnerReward, 'no winner tile either').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === FUNDING)).has.length(1);
    });

    it('the formula: min(6, 2 × S + I) — every example of the brief; influence pays on its own; the cap bounds the SUM', () => {
      const cases: Array<[number, number, number]> = [
        [0, 0, 0], [0, 3, 3], [1, 0, 2], [1, 1, 3], [2, 1, 5], [2, 2, 6], [2, 3, 6], [3, 0, 6], [3, 5, 6],
      ];
      for (const [cities, influence, expected] of cases) {
        expect(scaledAmount(COLONIZATION_FUNDING_PRODUCTION, influence, cities), `S=${cities} I=${influence}`).eq(expected);
      }
      expect(uncappedAmount(COLONIZATION_FUNDING_PRODUCTION, 3, 2), 'the sum before the cap').eq(7);
      expect(uncappedAmount(COLONIZATION_FUNDING_PRODUCTION, 5, 3)).eq(11);
      expect(COLONIZATION_FUNDING_CAP).eq(6);
      expect(COLONIZATION_FUNDING_PER_CITY).eq(2);
    });

    it('shares the family\'s mechanism and differs in the counter (the BOARD), the rate and the cap', () => {
      expect(COLONIZATION_FUNDING_PRODUCTION.unit).deep.eq(CENTRAL_POWER_GRID_PRODUCTION.unit);
      expect(COLONIZATION_FUNDING_PRODUCTION.perInfluence).eq(CENTRAL_POWER_GRID_PRODUCTION.perInfluence);
      expect(COLONIZATION_FUNDING_PRODUCTION.recipient).eq(CENTRAL_POWER_GRID_PRODUCTION.recipient);
      expect(COLONIZATION_FUNDING_PRODUCTION.count).deep.eq({id: 'spaceCities', per: 2});
      expect(COLONIZATION_FUNDING_PRODUCTION.cap).eq(6);
      expect(resolutionCountKind('spaceCities')).deep.eq({kind: 'board', tiles: 'spaceCity', measure: 'cells'});
      expect(familyOf(COLONIZATION_FUNDING), 'the stand opens the board-count family from the declaration alone').eq('counted-board');
    });

    it('the quest graphic is the city tile with the footnote spark — the same drawing the face prints as the counted object', () => {
      const [row] = questRenderData(COLONIZATION_FUNDING.quest).rows;
      const items = row.filter(isICardRenderItem).map((item) => item.type);
      const symbols = row.filter(isICardRenderSymbol).map((symbol) => symbol.type);
      expect(items).deep.eq([CardRenderItemType.CITY]);
      expect(symbols).deep.eq([CardRenderSymbolType.ASTERIX]);
      const face = COLONIZATION_FUNDING.renderData.rows[0];
      expect(face.filter(isICardRenderItem).some((item) => item.type === CardRenderItemType.CITY), 'the face prints the city').is.true;
      expect(face.filter(isICardRenderSymbol).some((symbol) => symbol.type === CardRenderSymbolType.ASTERIX), '…with the spark').is.true;
    });
  });

  describe('which tiles count (S) — the engine\'s own reading', () => {
    it('counts the player\'s city tiles on the reserved areas off Mars, and names the CELLS (no card in the list)', () => {
      const [, p1] = reduxGame();
      expect(resolutionCount(p1, 'spaceCities')).deep.eq({id: 'spaceCities', count: 0, cards: [], spaces: []});
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      const count = resolutionCount(p1, 'spaceCities');
      expect(count.count).eq(2);
      expect(count.spaces).deep.eq([GANYMEDE, PHOBOS]);
      expect(count.cards, 'a tile has no card').deep.eq([]);
      expect(count.units, 'no per-card column on a board count').is.undefined;
      expect(count.count).eq(engineSpaceCities(p1).length);
      expect([...(count.spaces ?? [])]).deep.eq(engineSpaceCities(p1));
    });

    it('a city ON Mars is not a space city; a rival\'s space city is theirs; an empty reserved area is nothing', () => {
      const [, p1, p2] = reduxGame();
      addCity(p1); // the first free city cell on Mars
      addCity(p2, GANYMEDE);
      expect(resolutionCount(p1, 'spaceCities').count).eq(0);
      expect(resolutionCount(p2, 'spaceCities')).deep.include({count: 1, spaces: [GANYMEDE]});
      addCity(p1, PHOBOS);
      expect(resolutionCount(p1, 'spaceCities')).deep.include({count: 1, spaces: [PHOBOS]});
    });

    it('a Venus reserved area counts like the base ones (Dawn City); a greenery is never a city', () => {
      const [, p1] = reduxGame({venus: true});
      addCity(p1, SpaceName.DAWN_CITY);
      addCity(p1, GANYMEDE);
      addGreenery(p1);
      expect(resolutionCount(p1, 'spaceCities')).deep.include({count: 2, spaces: [GANYMEDE, SpaceName.DAWN_CITY]});
    });

    it('the Moon is another board: none of its tiles is a space city', () => {
      const [game, p1] = reduxGame({moon: true});
      const moon = MoonExpansion.moonData(game).moon;
      const cells = moon.spaces.filter((s) => s.tile === undefined && s.spaceType !== SpaceType.COLONY);
      MoonExpansion.addHabitatTile(p1, cells[0].id);
      MoonExpansion.addMineTile(p1, cells[1].id);
      MoonExpansion.addRoadTile(p1, cells[2].id);
      expect(resolutionCount(p1, 'spaceCities').count).eq(0);
      addCity(p1, GANYMEDE);
      expect(resolutionCount(p1, 'spaceCities')).deep.include({count: 1, spaces: [GANYMEDE]});
    });

    it('PARITY: the shared cell predicate (the stand\'s) agrees with the engine over a corpus of boards', () => {
      const corpus: Array<(p1: TestPlayer, p2: TestPlayer) => void> = [
        () => {},
        (p1) => addCity(p1, GANYMEDE),
        (p1) => {
          addCity(p1, GANYMEDE);
          addCity(p1, PHOBOS);
        },
        (p1) => addCity(p1),
        (p1, p2) => {
          addCity(p1, GANYMEDE);
          addCity(p2, PHOBOS);
          addCity(p1);
          addGreenery(p1);
        },
        (p1) => addCity(p1, SpaceName.DAWN_CITY),
      ];
      for (const arrange of corpus) {
        const [game, p1, p2] = reduxGame({venus: true});
        arrange(p1, p2);
        const own = game.board.spaces.filter((space) => space.player?.id === p1.id);
        const shared = countSpacesToward('spaceCities', own);
        expect([...(shared.spaces ?? [])], 'the stand\'s predicate names the engine\'s cells').deep.eq(engineSpaceCities(p1));
        expect(shared.count).eq(resolutionCount(p1, 'spaceCities').count);
      }
      // …and each «does not count» names its reason.
      expect(spaceCountVerdict('spaceCities', {id: '35', spaceType: SpaceType.LAND, tile: {tileType: TileType.CITY}})).deep.eq({counts: false, reason: 'On Mars — not a space city'});
      expect(spaceCountVerdict('spaceCities', {id: GANYMEDE, spaceType: SpaceType.COLONY})).deep.eq({counts: false, reason: 'No city tile here'});
      expect(spaceCountVerdict('spaceCities', {id: GANYMEDE, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}})).deep.eq({counts: true});
    });
  });

  describe('the enactment', () => {
    it('raises EVERY participant\'s M€ production by min(6, 2 × S + I) — voters or not — through the standard production change', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner, one delegate: no party effect) — Agenda 0 → step 1 in the phase = influence 1; two space cities.
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      // p2 never voted — influence 2, no space city: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.production.override({megacredits: 3});
      p2.production.override({megacredits: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(FUNDING);
      expect(parliament.rulingParty()).eq(PartyName.UNITY);
      expect(p1.production.megacredits, '2 × 2 + I 1 (after the winner\'s Agenda step)').eq(3 + 5);
      expect(p2.production.megacredits, '0 cities + I 2').eq(0 + 2);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'production', effect: 'production', production: Resource.MEGACREDITS, amount: 5, count: 2, influence: 1, uncapped: 5, before: 3, after: 8});
      expect(outcomeOf(parliament, p1)?.counted, 'no card is counted').deep.eq([]);
      expect(outcomeOf(parliament, p1)?.countedSpaces, 'the CELLS are').deep.eq([GANYMEDE, PHOBOS]);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'production', amount: 2, count: 0, influence: 2, before: 0, after: 2});
      expect(outcomeOf(parliament, p2)?.countedSpaces).deep.eq([]);
      // PRODUCTION, not cash: the card's ONLY mutation is the production change.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === COLONIZATION_FUNDING_ID);
      expect(mine.filter((e) => e.type === 'production-changed'), 'one production change per seat').has.length(2);
      expect(mine.filter((e) => e.type === 'resource-changed'), 'and not one M€ of cash').has.length(0);
    });

    it('the cap bounds the INCREASE: 2 cities + I 3 → +6 (the outcome keeps the sum 7), production 8 becomes 14; 3 cities + I 5 → +6', () => {
      const [game, p1, p2, parliament] = stage();
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands on influence 3
      p1.production.override({megacredits: 8});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(14);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 6, count: 2, influence: 3, uncapped: 7, before: 8, after: 14});
      // p2 with nothing: named, skipped, nothing changed.
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: 'No space cities and no influence'});
      expect(outcomeOf(parliament, p2)?.countedSpaces).deep.eq([]);
      expect(p2.production.megacredits).eq(0);
      // Three cities and influence 5: still +6.
      expect(scaledAmount(COLONIZATION_FUNDING_PRODUCTION, 5, 3)).eq(6);
    });

    it('influence alone pays: no space city and influence 3 is +3', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 1});
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'production', amount: 3, count: 0, influence: 3, uncapped: 3, before: 1, after: 4});
    });

    it('a neutral winner cancels nothing: every participant is still paid, and nobody gets a winner-only part', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, FUNDING);
      parliament.addNeutralVote(parliament.slots[0]);
      addCity(p1, GANYMEDE);
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(FUNDING);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 2, count: 1, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 1, count: 0, influence: 1});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part !== 'winner'), 'no winner part at all').is.true;
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source', () => {
      const [game, p1, p2, parliament] = stage();
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 8});
      endGeneration(game);
      runAllActions(game);
      const capped = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} ${2} production from ${3}: ${4} space city(-ies) × 2 + ${5} influence = ${6}, limited'));
      expect(capped).has.length(1);
      const data = capped[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(COLONIZATION_FUNDING_ID);
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['6', '2', '3', '7', '8', '14']);
      expect(game.gameLog.filter((entry) => entry.message.includes('no ${1} production from ${2}')), 'p2\'s zero is named').has.length(1);
      const deltas = game.events.events.filter((e) => e.type === 'production-changed' && e.player === p1.color &&
        e.source?.kind === 'resolution' && e.source.id === COLONIZATION_FUNDING_ID);
      expect(deltas).has.length(1);
      expect(deltas[0].impact?.production?.megacredits).eq(6);
      expect(p2.production.megacredits).eq(0);
    });
  });

  describe('once per enactment — the count is frozen in the record', () => {
    it('a later space city, a later influence and a change of government never recompute what was paid', () => {
      const [game, p1, , parliament] = stage();
      addCity(p1, GANYMEDE);
      endGeneration(game);
      runAllActions(game);
      const paid = p1.production.megacredits;
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({amount: 3, count: 1, influence: 1});
      expect(outcome?.countedSpaces).deep.eq([GANYMEDE]);
      // Another space city and more influence afterwards: nothing moves.
      addCity(p1, PHOBOS);
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.production.megacredits).eq(paid);
      expect(outcomeOf(parliament, p1)).deep.eq(outcome);
      expect(resolutionCount(p1, 'spaceCities').count, 'the live count moved — the record did not').eq(2);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.production.megacredits).eq(paid);
    });

    it('a reload after the enactment pays nothing again; the recorded cells survive the save', () => {
      const [game, p1, , parliament] = stage();
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      endGeneration(game);
      runAllActions(game);
      const paid = p1.production.megacredits;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(one.production.megacredits).eq(paid);
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'production')).deep.eq(
        parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'production'));
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id)?.countedSpaces).deep.eq([GANYMEDE, PHOBOS]);
    });

    it('an enactment interrupted between two players resumes with the second only — the first is never paid twice (reload AND an in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = stage();
      addCity(p1, GANYMEDE);
      addCity(p2, PHOBOS);
      p1.production.override({megacredits: 1});
      p2.production.override({megacredits: 1});
      const realAdd = p2.production.add.bind(p2.production);
      let failures = 0;
      p2.production.add = (resource, amount, options) => {
        if (resource === Resource.MEGACREDITS && failures === 0) {
          failures++;
          throw new Error('interrupted');
        }
        realAdd(resource, amount, options);
      };
      expect(() => endGeneration(game)).to.throw('interrupted');
      expect(parliament.phase?.step).eq('effects');
      expect(p1.production.megacredits, 'p1 was paid before the interruption: 2 × 1 + I 1').eq(1 + 3);
      const live = reload(game);
      runAllActions(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.production.megacredits).eq(1 + 3);
      expect(two.production.megacredits, 'p2: 2 × 1 + I 0').eq(1 + 2);
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'production')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'production')).has.length(1);
      p2.production.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      runAllActions(game);
      expect(p1.production.megacredits, 'the re-entry skips the applied key').eq(1 + 3);
      expect(p2.production.megacredits).eq(1 + 2);
    });
  });

  describe('the chairman quest — place 1 space city', () => {
    function playAsAction(player: TestPlayer, card: ICard): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-play'});
      try {
        player.playCard(card as IProjectCard);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    /** A city on Mars placed by the player's OWN action (the engine's standard placement under an action scope). */
    function placeMarsCityAsAction(player: TestPlayer): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.IMMIGRANT_CITY, owner: player.color}, {category: 'card-play'});
      try {
        addCity(player);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    function enactFunding(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(COLONIZATION_FUNDING_ID);
      return [game, p1, p2, parliament];
    }

    it('the enactment moves no progress; a space city the player places completes it at once; a city on Mars does not count', () => {
      const [game, p1, p2, parliament] = enactFunding();
      expect(parliament.questProgressOf(p1), 'the enactment is not a placement').eq(0);
      placeMarsCityAsAction(p2);
      expect(parliament.questProgressOf(p2), 'a city on Mars is not a space city').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      playAsAction(p1, new GanymedeColony());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      playAsAction(p2, new PhobosSpaceHaven());
      expect(parliament.questProgressOf(p2)).eq(0);
      expect(parliament.chairman).eq(p1.id);
    });

    it('a space city already in place counts nothing retroactively; the resolution\'s counter and the quest\'s progress are different data', () => {
      const [, p1, , parliament] = enactFunding();
      addCity(p1, GANYMEDE);
      expect(resolutionCount(p1, 'spaceCities').count).eq(1);
      expect(parliament.questProgressOf(p1), 'nothing was PLACED by an action since the enactment').eq(0);
      expect(parliament.quest?.completedBy).is.undefined;
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, FUNDING);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      addCity(human, GANYMEDE);
      game.addCity(bot, game.board.getSpaceOrThrow(PHOBOS));
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player)).deep.eq([human.id]);
      expect(human.production.megacredits, '2 × 1 + I 1').eq(3);
      expect(parliament.lastPhase?.outcomes?.[0]?.countedSpaces, 'the bot\'s space city is nobody\'s here').deep.eq([GANYMEDE]);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number and CELLS) rides the model; the outcome reaches the client with the cells', () => {
      const [game, p1, p2, parliament] = stage();
      addCity(p1, GANYMEDE);
      addCity(p1, PHOBOS);
      addCity(p1);
      const model = getParliamentModel(game, p2);
      const counts = model?.players.find((p) => p.color === p1.color)?.counts;
      expect(counts?.find((c) => c.id === 'spaceCities')).deep.eq({id: 'spaceCities', count: 2, cards: [], spaces: [GANYMEDE, PHOBOS]});
      expect(counts?.map((c) => c.id)).includes('spaceCities');
      expect(model?.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'spaceCities')).deep.eq(
        {id: 'spaceCities', count: 0, cards: [], spaces: []});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const mine = last?.outcomes?.find((o) => o.player === p1.color);
      expect(mine).deep.include({kind: 'production', amount: 5, count: 2, influence: 1, uncapped: 5});
      expect(mine?.countedSpaces).deep.eq([GANYMEDE, PHOBOS]);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
