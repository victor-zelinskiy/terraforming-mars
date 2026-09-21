import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  CENTRAL_POWER_GRID, CENTRAL_POWER_GRID_CAP, CENTRAL_POWER_GRID_CODE, CENTRAL_POWER_GRID_ID, CENTRAL_POWER_GRID_PRODUCTION,
} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {ARCHITECTURE_AWARD, ARCHITECTURE_AWARD_ID, ARCHITECTURE_AWARD_PRODUCTION} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {BIODOME_CONTEST} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {RESOLUTION_TAG_COUNTING_MODE} from '../../src/common/parliament/resolutionCounts';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {fakeCard, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {PowerPlant} from '../../src/server/cards/base/PowerPlant';
import {SolarPower} from '../../src/server/cards/base/SolarPower';
import {FusionPower} from '../../src/server/cards/base/FusionPower';
import {GeothermalPower} from '../../src/server/cards/base/GeothermalPower';
import {NuclearPower} from '../../src/server/cards/base/NuclearPower';
import {BiomassCombustors} from '../../src/server/cards/base/BiomassCombustors';
import {ArtificialPhotosynthesis} from '../../src/server/cards/base/ArtificialPhotosynthesis';
import {IndustrialMicrobes} from '../../src/server/cards/base/IndustrialMicrobes';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {Mine} from '../../src/server/cards/base/Mine';
import {EnergyTapping} from '../../src/server/cards/base/EnergyTapping';
import {Thorgate} from '../../src/server/cards/corporation/Thorgate';
import {PowerGeneration} from '../../src/server/cards/prelude/PowerGeneration';
import {HE3FusionPlant} from '../../src/server/cards/moon/HE3FusionPlant';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {Odyssey} from '../../src/server/cards/pathfinders/Odyssey';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';

/**
 * CENTRAL POWER GRID (Turmoil Redux, RX04) — the SECOND card of the «counter +
 * influence → capped production» family, and the one that proves the family is
 * a mechanism rather than a copy: the declaration, the arithmetic, the
 * production change, the recorded outcome and the idempotency are Architecture
 * Award's, while WHAT IS COUNTED is this card's own.
 *
 * What these specs pin: min(5, P + I) for every participant; P is the player's
 * POWER TAGS in play — every tag a card prints, so ONE card can be worth two,
 * with no VP filter and no dependence on the energy resource or on energy
 * production; a wild tag is never a power tag at an enactment (server AND
 * model); I is the Redux influence read after the winner's Agenda step; the
 * cap bounds the increase, not the total; the increase is the standard
 * `production.add` under the resolution's source, applied once per enactment.
 */
const GRID = resolutionInstanceId(CENTRAL_POWER_GRID_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Central Power Grid in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, GRID);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/**
 * Every player passes; production → the parliament; the sitting's ASSEMBLY
 * gate is answered for every seat (the harness's stale menus cleared first),
 * so the resolution's own asks stand — or, for a quiet card, the ADJOURN gate
 * is answered too and the phase is over (`parliamentArrange`).
 */
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

/** `n` real cards printing ONE power tag each. */
function powerCards(n: number): Array<ICard> {
  return [new PowerPlant(), new SolarPower(), new FusionPower(), new GeothermalPower(), new NuclearPower()].slice(0, n);
}

describe('CentralPowerGrid', () => {
  describe('the catalog entry', () => {
    it('is RX04 of the Industrialists, dealt as ONE card', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(CENTRAL_POWER_GRID_ID)).eq(CENTRAL_POWER_GRID);
      expect(CENTRAL_POWER_GRID_CODE).eq('RX04');
      expect(CENTRAL_POWER_GRID_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX04')).eq(CENTRAL_POWER_GRID);
      // The first three keep their codes — a code is assigned by hand, not by array position.
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX02')).eq(ARCHITECTURE_AWARD);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX03')).eq(BIODOME_CONTEST);
      expect(CENTRAL_POWER_GRID.party).eq(PartyName.INDUSTRIALISTS);
      expect(CENTRAL_POWER_GRID.quest).deep.eq({goal: {kind: 'tag', tag: Tag.POWER}, count: 2});
      expect(CENTRAL_POWER_GRID.scaled).deep.eq([CENTRAL_POWER_GRID_PRODUCTION]);
      expect(CENTRAL_POWER_GRID.winnerSteps, 'no winner-only part').is.undefined;
      expect(CENTRAL_POWER_GRID.winnerReward, 'no winner tile either').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === GRID)).has.length(1);
    });

    it('the shared formula: min(5, P + I) — every example of the brief, the cap on the SUM', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 2, 2], [2, 0, 2], [2, 2, 4], [3, 2, 5], [4, 3, 5], [7, 0, 5]];
      for (const [p, i, expected] of cases) {
        expect(scaledAmount(CENTRAL_POWER_GRID_PRODUCTION, i, p), `P=${p} I=${i}`).eq(expected);
      }
      expect(uncappedAmount(CENTRAL_POWER_GRID_PRODUCTION, 3, 4)).eq(7);
      // Tags and influence add up — never multiply.
      expect(scaledAmount(CENTRAL_POWER_GRID_PRODUCTION, 1, 2)).eq(3);
      expect(CENTRAL_POWER_GRID_CAP).eq(5);
    });

    it('shares the mechanism with Architecture Award and differs only in what is counted', () => {
      expect(CENTRAL_POWER_GRID_PRODUCTION.unit).deep.eq(ARCHITECTURE_AWARD_PRODUCTION.unit);
      expect(CENTRAL_POWER_GRID_PRODUCTION.cap).eq(ARCHITECTURE_AWARD_PRODUCTION.cap);
      expect(CENTRAL_POWER_GRID_PRODUCTION.perInfluence).eq(ARCHITECTURE_AWARD_PRODUCTION.perInfluence);
      expect(CENTRAL_POWER_GRID_PRODUCTION.recipient).eq(ARCHITECTURE_AWARD_PRODUCTION.recipient);
      expect(CENTRAL_POWER_GRID_PRODUCTION.count?.id).eq('powerTags');
      expect(ARCHITECTURE_AWARD_PRODUCTION.count?.id, 'Architecture Award still counts CARDS').eq('buildingCardsWithNonNegativeVp');
    });
  });

  describe('which tags count (P)', () => {
    it('counts TAGS, not cards: one card with two power tags is worth 2', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new HE3FusionPlant(), new PowerPlant());
      const count = resolutionCount(p1, 'powerTags');
      expect(count.count).eq(3);
      expect(count.cards).deep.eq([CardName.HE3_FUSION_PLANT, CardName.POWER_PLANT]);
      expect(count.units, 'the card\'s own contribution explains the number').deep.eq([2, 1]);
      // Architecture Award's rule is untouched: one card is one unit there.
      p1.playedCards.push(new ArtificialLake());
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count).eq(1);
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').units, 'a card count carries no per-card column').is.undefined;
    });

    it('the VP icon plays no part: a power card without one and one with a negative one both count', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(
        new PowerPlant(), // power + building, no VP icon → counts
        new BiomassCombustors(), // power + building, −1 VP → counts
        new EnergyTapping(), // power, −1 VP → counts
        new SolarPower(), // power + building, +1 VP → counts
      );
      expect(resolutionCount(p1, 'powerTags').count).eq(4);
      // The same tableau through Architecture Award's filter: only the +1 VP card.
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').cards).deep.eq([CardName.SOLAR_POWER]);
    });

    it('the energy RESOURCE and energy PRODUCTION are not tags', () => {
      const [, p1] = reduxGame();
      // Raises energy production 2 steps, prints a science tag and no power tag.
      p1.playedCards.push(new ArtificialPhotosynthesis());
      p1.production.override({energy: 9});
      p1.stock.override({energy: 7});
      expect(resolutionCount(p1, 'powerTags').count).eq(0);
      p1.playedCards.push(new PowerPlant());
      expect(resolutionCount(p1, 'powerTags').count, 'only the printed tag moves the number').eq(1);
    });

    it('every source in play counts: projects, the corporation, a prelude — one mechanism, not a projects-only walk', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new Thorgate(), new PowerGeneration(), new PowerPlant());
      const count = resolutionCount(p1, 'powerTags');
      expect(count.count).eq(3);
      expect(count.cards).deep.eq([CardName.THORGATE, CardName.POWER_GENERATION, CardName.POWER_PLANT]);
      expect(p1.tableau.corporations().map((c) => c.name)).deep.eq([CardName.THORGATE]);
    });

    it('two corporations after a merger both count', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new Thorgate(), fakeCard({name: 'Merged Grid Corp' as CardName, type: CardType.CORPORATION, tags: [Tag.POWER, Tag.POWER]}));
      expect(resolutionCount(p1, 'powerTags').count).eq(3);
    });

    it('only the player\'s own cards IN PLAY: not the hand, not a rival\'s tableau; played events are face down unless Odyssey', () => {
      const [, p1, p2] = reduxGame();
      p1.cardsInHand.push(new PowerPlant());
      p2.playedCards.push(new SolarPower());
      const powerEvent = fakeCard({name: 'Grid Surge' as CardName, type: CardType.EVENT, tags: [Tag.POWER, Tag.EVENT]});
      p1.playedCards.push(powerEvent);
      expect(resolutionCount(p1, 'powerTags').count, 'hand, rival tableau, face-down event').eq(0);
      expect(resolutionCount(p2, 'powerTags').cards).deep.eq([CardName.SOLAR_POWER]);
      // Odyssey keeps events face up: their tags are in play — the shared tag-activity rule.
      p1.playedCards.push(new Odyssey());
      expect(p1.tags.eventTagsInPlay()).is.true;
      expect(resolutionCount(p1, 'powerTags').cards).deep.eq(['Grid Surge']);
    });

    it('a disabled Pharmacy Union is out of play for the breakdown and for the canonical count alike', () => {
      const [, p1] = reduxGame();
      const union = new PharmacyUnion();
      union.isDisabled = true;
      p1.playedCards.push(union, new PowerPlant());
      expect(resolutionCount(p1, 'powerTags').cards).deep.eq([CardName.POWER_PLANT]);
    });

    it('a WILD tag is not a power tag — neither a printed one nor the Scientists\' granted one', () => {
      const [, p1, , parliament] = reduxGame();
      p1.playedCards.push(new NobelPrize(), new PowerPlant());
      // The player's own ACTION context does count a wild tag — that is the
      // substitution this resolution must not borrow.
      expect(p1.tags.count(Tag.POWER, 'default'), 'the action context substitutes the wild tag').eq(2);
      expect(p1.tags.count(Tag.POWER, RESOLUTION_TAG_COUNTING_MODE)).eq(1);
      expect(resolutionCount(p1, 'powerTags').count).eq(1);
      // …and neither does the Scientists' extra wild tag, held or not.
      parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
      expect(p1.tags.count(Tag.POWER, 'default')).eq(3);
      expect(resolutionCount(p1, 'powerTags').count, 'an enactment is not the player\'s own action').eq(1);
      expect(scaledAmount(CENTRAL_POWER_GRID_PRODUCTION, 0, resolutionCount(p1, 'powerTags').count)).eq(1);
    });

    it('the breakdown always adds up to the canonical tag count, over a corpus of tableaus', () => {
      const [, p1] = reduxGame();
      const corpus: Array<Array<ICard>> = [
        [],
        [new PowerPlant()],
        [new HE3FusionPlant()],
        [new HE3FusionPlant(), new PowerPlant(), new SolarPower()],
        [new Thorgate(), new PowerGeneration(), new EnergyTapping(), new BiomassCombustors()],
        [new ArtificialPhotosynthesis(), new Mine(), new SearchForLife()],
        [new NobelPrize(), new PowerPlant(), new Odyssey()],
      ];
      for (const tableau of corpus) {
        p1.playedCards.set(...tableau);
        const model = resolutionCount(p1, 'powerTags');
        const fromCards = (model.units ?? []).reduce((sum, n) => sum + n, 0);
        expect(model.count, tableau.map((c) => c.name).join(' + ')).eq(p1.tags.count(Tag.POWER, RESOLUTION_TAG_COUNTING_MODE));
        expect(fromCards, 'the explanation adds up to the number').eq(model.count);
      }
    });
  });

  describe('the enactment', () => {
    it('raises EVERY participant\'s M€ production by min(5, P + I) — voters or not — through the standard production change', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner, one delegate: no party effect) — Agenda 0 → step 1 in the phase = influence 1; two power tags.
      p1.playedCards.push(...powerCards(2));
      // p2 never voted — influence 2, one power tag.
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p2.playedCards.push(...powerCards(1));
      p1.production.override({megacredits: 3});
      p2.production.override({megacredits: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(GRID);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      expect(p1.production.megacredits, 'P 2 + I 1 (after the winner\'s Agenda step)').eq(3 + 3);
      expect(p2.production.megacredits, 'P 1 + I 2').eq(0 + 3);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'production', effect: 'production', production: Resource.MEGACREDITS, amount: 3, count: 2, influence: 1, uncapped: 3, before: 3, after: 6});
      expect(outcomeOf(parliament, p1)?.counted).deep.eq([CardName.POWER_PLANT, CardName.SOLAR_POWER]);
      expect(outcomeOf(parliament, p1)?.countedUnits).deep.eq([1, 1]);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'production', amount: 3, count: 1, influence: 2, before: 0, after: 3});
      // PRODUCTION, not cash: the card's ONLY mutation is the production change
      // — no matching amount in M€, no energy production, no resource at all.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === CENTRAL_POWER_GRID_ID);
      expect(mine.filter((e) => e.type === 'production-changed'), 'one production change per seat').has.length(2);
      expect(mine.filter((e) => e.type === 'resource-changed'), 'and not one M€ of cash').has.length(0);
      expect(mine.every((e) => e.impact?.production?.energy === undefined), 'never energy production').is.true;
      expect(p1.production.energy).eq(0);
    });

    it('one card with two power tags pays for both, and the outcome records its contribution', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new HE3FusionPlant(), new PowerPlant());
      p1.production.override({megacredits: 0});
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 4, count: 3, influence: 1});
      expect(outcomeOf(parliament, p1)?.countedUnits).deep.eq([2, 1]);
      expect(p1.production.megacredits).eq(4);
    });

    it('the cap bounds the INCREASE: production 8 becomes 13, P 4 + I 3 still pays +5 (the outcome keeps the sum 7)', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...powerCards(4));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands on influence 3
      p1.production.override({megacredits: 8});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(13);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 5, count: 4, influence: 3, uncapped: 7, before: 8, after: 13});
      // p2 with nothing: named, skipped, nothing changed.
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: 'No power tags and no influence'});
      expect(p2.production.megacredits).eq(0);
    });

    it('a negative production rises the ordinary way: −3 with +4 becomes 1', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...powerCards(3));
      parliament.agenda.set(p1.id, 0); // the winner's step → influence 1
      p1.production.override({megacredits: -3});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
      expect(outcomeOf(parliament, p1)).deep.include({before: -3, after: 1, amount: 4});
    });

    it('influence comes from the Redux ledger AFTER the winner\'s Agenda step — never the delegates on the card', () => {
      const [game, p1, , parliament] = stage();
      // Three more delegates on the card (four in all): delegates give no influence.
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.agenda.set(p1.id, 2); // influence 1 now; the phase's step lands on 3 = influence 2
      expect(parliament.influence(p1)).eq(1);
      endGeneration(game);
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(outcomeOf(parliament, p1)).deep.include({influence: 2, count: 0, amount: 2});
    });

    it('a neutral winner cancels nothing: every participant is still paid, and nobody gets a winner-only part', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, GRID);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.playedCards.push(...powerCards(1));
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(GRID);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 1, count: 1, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 1, count: 0, influence: 1});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part !== 'winner'), 'no winner part at all').is.true;
    });

    it('two delegates grant the Industrialists\' EFFECT, never this effect: nothing is paid before the enactment', () => {
      const [, p1, , parliament] = stage();
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      p1.playedCards.push(...powerCards(3));
      const before = p1.production.megacredits;
      expect(parliament.hasPartyEffect(p1, PartyName.INDUSTRIALISTS)).is.true;
      expect(p1.production.megacredits).eq(before);
      expect(parliament.lastPhase).is.undefined;
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source; the recorder sees the production change', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...powerCards(4));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 2});
      endGeneration(game);
      runAllActions(game);
      const capped = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} ${2} production from ${3}: ${4} power tag(s) + ${5} influence = ${6}, limited'));
      expect(capped).has.length(1);
      const data = capped[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(CENTRAL_POWER_GRID_ID);
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['5', '4', '3', '7', '2', '7']);
      expect(game.gameLog.filter((entry) => entry.message.includes('no ${1} production from ${2}')), 'p2\'s zero is named').has.length(1);
      // The standard production change was recorded under the resolution's source (the phase's scope).
      const deltas = game.events.events.filter((e) => e.type === 'production-changed' && e.player === p1.color);
      const grid = deltas.filter((e) => e.source?.kind === 'resolution' && e.source.id === CENTRAL_POWER_GRID_ID);
      expect(grid).has.length(1);
      expect(grid[0].impact?.production?.megacredits).eq(5);
      expect(grid[0].impact?.snapshot).deep.include({before: 2, after: 7});
      expect(p2.production.megacredits).eq(0);
    });

    it('the FINAL generation still raises the production and pays no cash instead of it', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...powerCards(3));
      p1.production.override({megacredits: 4});
      // Mars is terraformed: this political phase is the LAST one.
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      maxOutOceans(p1);
      p1.production.override({megacredits: 4});
      const cashBefore = p1.megaCredits;
      const trAtProduction = p1.terraformRating;
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.final, 'the final political phase').is.true;
      expect(p1.production.megacredits, 'the production still rises — the endgame reads the real value').eq(4 + 4);
      // The final income was paid by the production of THAT generation, before
      // the political phase; the card adds nothing to it and pays no cash of
      // its own for the generation that will never come.
      expect(p1.megaCredits - cashBefore, 'the final income, by the old production').eq(trAtProduction + 4);
      expect(game.events.events.filter((e) =>
        e.source?.kind === 'resolution' && e.source.id === CENTRAL_POWER_GRID_ID && e.type === 'resource-changed'), 'no cash from the card').has.length(0);
    });
  });

  describe('once per enactment', () => {
    it('later tags, later influence and a change of government never recompute what was paid', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...powerCards(1));
      endGeneration(game);
      runAllActions(game);
      const paid = p1.production.megacredits;
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({amount: 2, count: 1, influence: 1});
      // More power tags and more influence afterwards: nothing moves.
      p1.playedCards.push(new HE3FusionPlant(), new SolarPower());
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.production.megacredits).eq(paid);
      expect(outcomeOf(parliament, p1)).deep.eq(outcome);
      // Losing the tags again takes nothing away, and a new government keeps the production.
      p1.playedCards.remove(p1.playedCards.get(CardName.HE3_FUSION_PLANT)!);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.production.megacredits).eq(paid);
    });

    it('a reload after the enactment pays nothing again; the recorded result survives', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new HE3FusionPlant());
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
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id)?.countedUnits, 'the contribution survives the save').deep.eq([2]);
    });

    it('an enactment interrupted between two players resumes with the second only: the first is never paid twice (reload AND an in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...powerCards(2));
      p2.playedCards.push(...powerCards(3));
      p1.production.override({megacredits: 1});
      p2.production.override({megacredits: 1});
      // p2's increase fails once (a crash in the middle of the effects step).
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
      expect(p1.production.megacredits, 'p1 was paid before the interruption').eq(1 + 3);
      const bySeat = parliament.phase?.appliedBySeat ?? {};
      expect((bySeat[p1.id] ?? []).filter((key) => key.endsWith(':production'))).has.length(1);
      expect((bySeat[p2.id] ?? []).some((key) => key.endsWith(':production'))).is.false;

      // A reload of that state resumes the phase: p2 once, p1 not again.
      const live = reload(game);
      runAllActions(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.production.megacredits).eq(1 + 3);
      expect(two.production.megacredits).eq(1 + 3);
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'production')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'production')).has.length(1);

      // The same state re-entered in memory (a repeated handler call on the
      // original, still mid-phase game object) behaves the same.
      p2.production.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      runAllActions(game);
      expect(p1.production.megacredits, 'the re-entry skips the applied key').eq(1 + 3);
      expect(p2.production.megacredits).eq(1 + 3);
    });

    it('a later, legal enactment of the same card applies again, by the table as it stands then', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...powerCards(1));
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.megacredits).eq(2);
      game.phase = Phase.ACTION;
      p1.playedCards.push(new HE3FusionPlant());
      seatResolution(parliament, 0, GRID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      runAllActions(game);
      // Agenda 1 → 2 (a TR step: influence stays 1); three power tags now.
      settleParliamentGates(game);
      expect(parliament.lastPhase?.generation).eq(2);
      expect(outcomeOf(parliament, p1)).deep.include({count: 3, influence: 1, amount: 4});
      expect(p1.production.megacredits).eq(2 + 4);
    });
  });

  describe('the chairman quest — play 2 power tags', () => {
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

    function enactGrid(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(CENTRAL_POWER_GRID_ID);
      return [game, p1, p2, parliament];
    }

    it('counts PLAYED power tags regardless of VP; cards already in play and the enactment itself count nothing', () => {
      const [game, p1, p2, parliament] = enactGrid();
      expect(parliament.questProgressOf(p1), 'the enactment is not a power play').eq(0);
      p1.playedCards.push(new PowerPlant(), new SolarPower());
      expect(parliament.questProgressOf(p1), 'no retroactive progress').eq(0);
      playAsAction(p1, new GeothermalPower()); // a power tag, no VP icon
      expect(parliament.questProgressOf(p1)).eq(1);
      playAsAction(p1, new BiomassCombustors()); // a power tag, a negative icon
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      // Once per generation: nobody else completes it.
      playAsAction(p2, new PowerPlant());
      playAsAction(p2, new NuclearPower());
      expect(parliament.questProgressOf(p2)).eq(0);
      expect(parliament.chairman).eq(p1.id);
    });

    it('one card with two power tags completes it at once; a wild tag is no power tag', () => {
      const [game, p1, p2, parliament] = enactGrid();
      playAsAction(p2, new NobelPrize());
      expect(parliament.questProgressOf(p2)).eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      playAsAction(p1, new HE3FusionPlant());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
    });

    it('raising energy production is not playing a power tag', () => {
      const [, p1, , parliament] = enactGrid();
      playAsAction(p1, new IndustrialMicrobes());
      expect(p1.production.energy, 'the card did raise energy production').is.greaterThan(0);
      expect(parliament.questProgressOf(p1)).eq(0);
      expect(parliament.quest?.completedBy).is.undefined;
    });

    it('a sitting chairman who completes it keeps the seat and still takes the Agenda step', () => {
      const [game, p1, , parliament] = enactGrid();
      parliament.chairman = p1.id;
      const agendaBefore = parliament.agendaOf(p1);
      playAsAction(p1, new PowerPlant());
      playAsAction(p1, new SolarPower());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1)).eq(agendaBefore + 1);
    });

    it('progress and the completion survive a reload; the reward is never granted twice', () => {
      const [game, p1] = enactGrid();
      playAsAction(p1, new PowerPlant());
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      live.phase = Phase.ACTION;
      expect(live.parliament!.questProgressOf(one)).eq(1);
      playAsAction(one, new SolarPower());
      expect(live.parliament!.quest?.completedBy).eq(one.id);
      answerQuestGate(live, one);
      const agenda = live.parliament!.agendaOf(one);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      live.phase = Phase.ACTION;
      playAsAction(one, new GeothermalPower());
      expect(live.parliament!.agendaOf(one), 'no second reward after the reload').eq(agenda);
      expect(live.parliament!.quest?.completedBy).eq(one.id);
    });

    it('the quest\'s progress and the resolution\'s counter are different data', () => {
      const [, p1, , parliament] = enactGrid();
      p1.playedCards.push(new HE3FusionPlant()); // two tags already in play
      expect(resolutionCount(p1, 'powerTags').count).eq(2);
      expect(parliament.questProgressOf(p1), 'nothing was PLAYED since the enactment').eq(0);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, GRID);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(...powerCards(2));
      bot.playedCards.push(...powerCards(2));
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
      expect(human.production.megacredits).eq(3);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number, cards and contributions) rides the model; the outcome reaches the client with every recorded input', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new HE3FusionPlant(), new ArtificialPhotosynthesis(), new PowerPlant());
      const model = getParliamentModel(game, p2);
      const counts = model?.players.find((p) => p.color === p1.color)?.counts;
      expect(counts?.find((c) => c.id === 'powerTags')).deep.eq(
        {id: 'powerTags', count: 3, cards: [CardName.HE3_FUSION_PLANT, CardName.POWER_PLANT], units: [2, 1]});
      // Both counted terms of the catalog ride along — one model, every rule.
      expect(counts?.map((c) => c.id)).deep.eq(['buildingCardsWithNonNegativeVp', 'powerTags']);
      expect(model?.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'powerTags')).deep.eq(
        {id: 'powerTags', count: 0, cards: [], units: []});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.find((o) => o.player === p1.color)).deep.include({kind: 'production', amount: 4, count: 3, influence: 1, uncapped: 4});
      expect(last?.outcomes?.find((o) => o.player === p1.color)?.countedUnits).deep.eq([2, 1]);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
