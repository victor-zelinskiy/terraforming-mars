import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  CLOUD_DEVELOPMENT, CLOUD_DEVELOPMENT_CODE, CLOUD_DEVELOPMENT_FLOATERS, CLOUD_DEVELOPMENT_ID,
} from '../../src/server/parliament/resolutions/unity/CloudDevelopment';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerGate, answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {RESOLUTION_TAG_COUNTING_MODE} from '../../src/common/parliament/resolutionCounts';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {InputError} from '../../src/server/inputs/InputError';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {ICard} from '../../src/server/cards/ICard';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {FloatingHabs} from '../../src/server/cards/venusNext/FloatingHabs';
import {JovianLanterns} from '../../src/server/cards/colonies/JovianLanterns';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {CloudTourism} from '../../src/server/cards/prelude2/CloudTourism';
import {TitanFloatingLaunchPad} from '../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {Atmoscoop} from '../../src/server/cards/venusNext/Atmoscoop';
import {JupiterFloatingStation} from '../../src/server/cards/colonies/JupiterFloatingStation';
import {StratosphericBirds} from '../../src/server/cards/venusNext/StratosphericBirds';
import {IoSulphurResearch} from '../../src/server/cards/venusNext/IoSulphurResearch';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {Celestic} from '../../src/server/cards/venusNext/Celestic';
import {Fish} from '../../src/server/cards/base/Fish';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {TradeWithUnity} from '../../src/server/parliament/TradeWithUnity';
import {AddResourcesToCards} from '../../src/server/deferredActions/AddResourcesToCards';

/**
 * CLOUD DEVELOPMENT (Turmoil Redux, RX06) — the first Unity resolution, the
 * first that depends on an expansion (Venus Next) and the first whose payout
 * is DISTRIBUTED over several cards. What these specs pin: N = Venus tags +
 * Jovian tags + influence through the canonical counter (a card with both
 * tags is 2, a wild tag is neither); the SHAPE of the ask is the shared
 * step's (N = 1 or one holder → the family's ordinary card pick, never an
 * auto-apply; N ≥ 2 over ≥ 2 holders → the distribution with its structural
 * marker and the VP table of every amount); the sum is exactly N, applied
 * through `addResourceTo`, ONE record with the whole list; a wrong sum is an
 * `InputError` with nothing applied; a reload inside either question rebuilds
 * it and pays once; skips name themselves with their size; the chairman
 * quest never counts the floaters; without Venus the card is nowhere, and an
 * older Venus save deals it in; Unity rules once it is enacted.
 */
const CLOUD = resolutionInstanceId(CLOUD_DEVELOPMENT_ID, 0);

function reduxGame(venus = true): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: venus});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Cloud Development in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, CLOUD);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function floatersOn(player: TestPlayer, name: CardName): number {
  return player.tableau.get(name)?.resourceCount ?? 0;
}

/** Answer a distribution: the amounts in the prompt's own card order. */
function distribute(player: TestPlayer, prompt: AndOptions, amounts: Partial<Record<CardName, number>>): void {
  const cards = prompt.cardResourceDistributionPrompt!.cards;
  player.process({type: 'and', responses: cards.map((c) => ({type: 'amount', amount: amounts[c.name] ?? 0}))});
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).find((o) => o.player === player.id && o.step === 'floaters');
}

describe('CloudDevelopment', () => {
  describe('the catalog entry', () => {
    it('is RX06 of Unity, ONE card, Venus Next only, with the two-tag count and the distributed floater declared', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(CLOUD_DEVELOPMENT_ID)).eq(CLOUD_DEVELOPMENT);
      expect(CLOUD_DEVELOPMENT.code).eq(CLOUD_DEVELOPMENT_CODE);
      expect(CLOUD_DEVELOPMENT_CODE).eq('RX06');
      expect(CLOUD_DEVELOPMENT_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX06')).eq(CLOUD_DEVELOPMENT);
      expect(CLOUD_DEVELOPMENT.party).eq(PartyName.UNITY);
      expect(CLOUD_DEVELOPMENT.copies).eq(1);
      expect(CLOUD_DEVELOPMENT.compatibility).deep.eq(['venus']);
      expect(CLOUD_DEVELOPMENT.quest).deep.eq({goal: {kind: 'tag', tag: Tag.VENUS}, count: 2});
      expect(CLOUD_DEVELOPMENT.scaled).deep.eq([CLOUD_DEVELOPMENT_FLOATERS]);
      expect(CLOUD_DEVELOPMENT_FLOATERS.unit).deep.eq({kind: 'cardResource', resources: [CardResource.FLOATER], spread: true});
      expect(CLOUD_DEVELOPMENT_FLOATERS.count).deep.eq({id: 'venusJovianTags', per: 1});
      expect(CLOUD_DEVELOPMENT.winnerSteps, 'no winner-only part').is.undefined;
      expect(CLOUD_DEVELOPMENT_FLOATERS.cap, 'no cap').is.undefined;
    });

    it('is in the deck of a Venus game and NOWHERE in a game without Venus Next', () => {
      const [, , , withVenus] = reduxGame(true);
      const pool = (p: Parliament) => [...p.deck, ...p.discard, ...p.slots.map((s) => s.instance), ...(p.enacted === undefined ? [] : [p.enacted])];
      expect(pool(withVenus)).includes(CLOUD);
      const [, , , without] = reduxGame(false);
      expect(pool(without)).not.includes(CLOUD);
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true)).includes(CLOUD);
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances((d) => (d.compatibility ?? []).every((e) => e !== 'venus'))).not.includes(CLOUD);
    });

    it('a Venus save from BEFORE the card loads with its own pool intact and plays on — the newcomer breaks nothing', () => {
      const [game, p1, , parliament] = reduxGame(true);
      // The save's pool as it was dealt without this card: strip it from wherever the deal put it, and give the
      // slot it held to a card of a party not yet on the table (the older deal would have dealt one).
      const serialized = game.serialize();
      const p = serialized.parliament!;
      p.deck = p.deck.filter((i) => i !== CLOUD);
      p.discard = p.discard.filter((i) => i !== CLOUD);
      if (p.slots.some((s) => s.instance === CLOUD)) {
        const other = parliament.deck.find((i) => parliament.resolutionOf(i).party !== PartyName.UNITY &&
          !p.slots.some((s) => s.instance !== CLOUD && parliament.resolutionOf(s.instance).party === parliament.resolutionOf(i).party));
        p.slots = p.slots.filter((s) => s.instance !== CLOUD);
        if (other !== undefined) {
          p.deck = p.deck.filter((i) => i !== other);
          p.slots.push({instance: other, votes: []});
        }
      }
      const pool = [...p.deck, ...p.discard, ...p.slots.map((s) => s.instance)];
      const live = Game.deserialize(structuredClone(serialized));
      const loaded = live.parliament!;
      // A formed deck is a formed deck: the load neither loses a card nor forces the newcomer into it.
      expect([...loaded.deck, ...loaded.discard, ...loaded.slots.map((s) => s.instance)].sort()).deep.eq([...pool].sort());
      expect(loaded.slots.length).eq(3);
      loaded.assertLedger(live);
      // …and the game plays on: a whole sitting runs on the older pool.
      live.phase = Phase.ACTION;
      const one = live.getPlayerById(p1.id) as TestPlayer;
      loaded.placeVote(one, loaded.slots[0], 'lobby');
      endGenerationThroughParliament(live);
      // The enacted card may ask (its own family's asks) — answer the plainest way until the sitting closes.
      for (let round = 0; round < 8 && loaded.phase !== undefined; round++) {
        for (const seat of live.playersInGenerationOrder) {
          const wf = seat.getWaitingFor();
          if (wf instanceof SelectCard) {
            seat.process({type: 'card', cards: [wf.cards[0].name]});
          } else if (wf instanceof AndOptions && wf.cardResourceDistributionPrompt !== undefined) {
            seat.process({type: 'and', responses: wf.options.map((_, i) => ({type: 'amount', amount: i === 0 ? wf.cardResourceDistributionPrompt!.amount : 0}))});
          } else if (wf instanceof SelectSpace) {
            seat.process({type: 'space', spaceId: wf.spaces[0].id});
          }
          runAllActions(live);
        }
        settleParliamentGates(live);
      }
      expect(loaded.phase, 'the sitting closed on the older pool').is.undefined;
      expect(live.generation).eq(2);
    });

    it('the shared formula: 1 floater per Venus or Jovian tag + 1 per influence, nothing below zero, no cap', () => {
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, 0, 0)).eq(0);
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, 1, 0)).eq(1);
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, 0, 2)).eq(2);
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, 3, 4)).eq(7);
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, 5, 9)).eq(14);
      expect(scaledAmount(CLOUD_DEVELOPMENT_FLOATERS, -2, 0)).eq(0);
    });
  });

  describe('the count: Venus tags + Jovian tags, through the canonical counter', () => {
    it('adds the two tags up, one unit per printed tag: a card with BOTH is 2, the per-tag totals ride along', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new Dirigibles(), new JovianLanterns(), new CloudTourism());
      const counted = resolutionCount(p1, 'venusJovianTags');
      expect(counted.count).eq(4);
      expect(counted.cards).deep.eq([CardName.DIRIGIBLES, CardName.JOVIAN_LANTERNS, CardName.CLOUD_TOURISM]);
      expect(counted.units, 'Cloud Tourism prints both').deep.eq([1, 1, 2]);
      expect(counted.byTag).deep.eq([{tag: Tag.VENUS, count: 2}, {tag: Tag.JOVIAN, count: 2}]);
    });

    it('a Venus tag without floater storage counts; a floater holder without a tag does not; a wild tag is neither', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new StratosphericBirds(), new AtmoCollectors(), new NobelPrize());
      const counted = resolutionCount(p1, 'venusJovianTags');
      expect(counted.count, 'Stratospheric Birds (Venus) alone').eq(1);
      expect(counted.cards).deep.eq([CardName.STRATOSPHERIC_BIRDS]);
      // …even though the player's own ACTION context would substitute the wild tag.
      expect(p1.tags.count(Tag.VENUS, 'default')).eq(2);
      expect(p1.tags.count(Tag.VENUS, RESOLUTION_TAG_COUNTING_MODE)).eq(1);
    });

    it('the corporation in play counts; a permanent Jovian modifier counts through the canonical number, the breakdown names the cards', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new Celestic(), new Atmoscoop());
      p1.tags.extraJovianTags = 1;
      const counted = resolutionCount(p1, 'venusJovianTags');
      expect(counted.count, 'Celestic (Venus) + Atmoscoop (Jovian) + the modifier').eq(3);
      expect(counted.cards).deep.eq([CardName.CELESTIC, CardName.ATMOSCOOP]);
      expect(counted.byTag).deep.eq([{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 2}]);
    });

    it('the breakdown always adds up to the canonical counts, over a corpus of tableaus', () => {
      const [, p1] = reduxGame();
      const corpus: Array<Array<ICard>> = [
        [],
        [new Dirigibles()],
        [new CloudTourism()],
        [new Dirigibles(), new JovianLanterns(), new CloudTourism(), new Fish()],
        [new IoSulphurResearch(), new TitanFloatingLaunchPad(), new StratosphericBirds()],
        [new NobelPrize(), new AtmoCollectors()],
      ];
      for (const tableau of corpus) {
        p1.playedCards.set(...tableau);
        const model = resolutionCount(p1, 'venusJovianTags');
        const fromCards = (model.units ?? []).reduce((sum, n) => sum + n, 0);
        const canonical = p1.tags.count(Tag.VENUS, RESOLUTION_TAG_COUNTING_MODE) + p1.tags.count(Tag.JOVIAN, RESOLUTION_TAG_COUNTING_MODE);
        expect(model.count, tableau.map((c) => c.name).join(' + ')).eq(canonical);
        expect(fromCards, 'the explanation adds up to the number').eq(model.count);
        expect((model.byTag ?? []).reduce((sum, e) => sum + e.count, 0), 'the per-tag totals add up too').eq(model.count);
      }
    });
  });

  describe('the shape of the ask (the shared step decides)', () => {
    it('N = 1 over several holders: the family\'s ordinary card pick — the same `resourceGainPrompt`, the player picks the holder', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 wins with nothing to hold (its share is named and forfeited); p2 never voted — influence 0 —
      // and holds Dirigibles (a Venus tag: N = 1) beside a tagless holder: ONE unit, TWO places to put it.
      parliament.agenda.set(p2.id, 0);
      p2.playedCards.push(new Dirigibles(), new AtmoCollectors());
      endGeneration(game);
      runAllActions(game);
      const ask = cast(p2.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount).eq(1);
      expect(ask.resourceGainPrompt?.cardResource).eq('floater');
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: CLOUD_DEVELOPMENT_ID});
      expect(ask.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]);
      expect(ask.cardResourceDistributionPrompt, 'not a distribution').is.undefined;
      p2.process({type: 'card', cards: [CardName.ATMO_COLLECTORS]});
      expect(floatersOn(p2, CardName.ATMO_COLLECTORS)).eq(1);
      expect(floatersOn(p2, CardName.DIRIGIBLES)).eq(0);
      const outcome = outcomeOf(parliament, p2);
      expect(outcome).deep.include({kind: 'cardResource', resource: CardResource.FLOATER, amount: 1, card: CardName.ATMO_COLLECTORS, influence: 0, count: 1});
      expect(outcome?.cards).deep.eq([{card: CardName.ATMO_COLLECTORS, amount: 1, resource: CardResource.FLOATER}]);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', reason: 'No card can hold floaters', amount: 1});
    });

    it('ONE holder, N = 3: the pick is SHOWN and confirmed (never applied behind the board) and all three land there', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      p1.playedCards.push(new Dirigibles()); // Venus tag + the only holder: N = 2 + 1 = 3
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount).eq(3);
      expect(ask.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
      expect(floatersOn(p1, CardName.DIRIGIBLES), 'nothing applied before the confirm').eq(0);
      p1.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(3);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({kind: 'cardResource', amount: 3, card: CardName.DIRIGIBLES, influence: 2, count: 1});
      expect(outcome?.counted).deep.eq([CardName.DIRIGIBLES]);
      expect(outcome?.countedByTag).deep.eq([{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 0}]);
      expect(outcome?.cards).deep.eq([{card: CardName.DIRIGIBLES, amount: 3, resource: CardResource.FLOATER}]);
    });

    it('N ≥ 2 over ≥ 2 holders: the DISTRIBUTION — the structural marker carries the faces, the sum and the VP table of every amount', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1); // influence 1 after the step
      // Floating Habs (Venus, 1 VP per 2 floaters) + Jovian Lanterns (Jovian, 1 VP per 2) + Atmo Collectors (no tag, no VP): N = 1 + 2 = 3.
      p1.playedCards.push(new FloatingHabs(), new JovianLanterns(), new AtmoCollectors());
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      const meta = ask.cardResourceDistributionPrompt!;
      expect(meta.amount).eq(3);
      expect(meta.cardResource).eq('floater');
      expect(meta.cards.map((c) => c.name)).deep.eq([CardName.FLOATING_HABS, CardName.JOVIAN_LANTERNS, CardName.ATMO_COLLECTORS]);
      expect(meta.cards.map((c) => c.resources), 'the live stored counts ride the faces').deep.eq([0, 0, 0]);
      expect(ask.options.map((o) => o.title)).deep.eq([CardName.FLOATING_HABS, CardName.JOVIAN_LANTERNS, CardName.ATMO_COLLECTORS]);
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: CLOUD_DEVELOPMENT_ID});
      expect(ask.choiceContext?.mode).eq('reward');
      // The VP table, per k: stepped points («1 per 2») read per amount, never derived from one delta.
      expect(meta.vpByAmount?.[CardName.FLOATING_HABS]).deep.eq([{from: 0, to: 0}, {from: 0, to: 1}, {from: 0, to: 1}]);
      expect(meta.vpByAmount?.[CardName.JOVIAN_LANTERNS]).deep.eq([{from: 0, to: 0}, {from: 0, to: 1}, {from: 0, to: 1}]);
      expect(meta.vpByAmount?.[CardName.ATMO_COLLECTORS], 'a card whose points never move is absent').is.undefined;
      expect(floatersOn(p1, CardName.FLOATING_HABS), 'nothing applied by the question').eq(0);
    });

    it('the VP table matches what REALLY applying k floaters scores, for every card and every k', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2
      // Floating Habs scores 1 VP per 2 floaters, Cloud Tourism 1 per 3 — two stepped rules, two different steps.
      p1.playedCards.push(new FloatingHabs(), new CloudTourism(), new Dirigibles()); // tags: 1 + 2 + 1 = 4 → N = 6
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      const meta = ask.cardResourceDistributionPrompt!;
      expect(meta.amount).eq(6);
      for (const card of [p1.tableau.get(CardName.FLOATING_HABS)!, p1.tableau.get(CardName.CLOUD_TOURISM)!]) {
        const table = meta.vpByAmount?.[card.name];
        expect(table, `${card.name} responds to floaters`).is.not.undefined;
        const base = card.getVictoryPoints(p1);
        for (let k = 1; k <= meta.amount; k++) {
          card.resourceCount = k;
          expect(table?.[k - 1], `${card.name} at k=${k}`).deep.eq({from: base, to: card.getVictoryPoints(p1)});
        }
        card.resourceCount = 0;
      }
      expect(meta.vpByAmount?.[CardName.DIRIGIBLES], 'Dirigibles scores nothing').is.undefined;
    });
  });

  describe('the distribution', () => {
    function distributing(): [IGame, TestPlayer, TestPlayer, Parliament, AndOptions] {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1); // influence 1 → N = 3 with two Venus tags
      p1.playedCards.push(new FloatingHabs(), new Dirigibles(), new AtmoCollectors());
      endGeneration(game);
      return [game, p1, p2, parliament, cast(p1.getWaitingFor(), AndOptions)];
    }

    it('lands the units where the player put them, through `addResourceTo`, and records ONE outcome with the whole list', () => {
      const [game, p1, , parliament, ask] = distributing();
      distribute(p1, ask, {[CardName.FLOATING_HABS]: 2, [CardName.ATMO_COLLECTORS]: 1});
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(2);
      expect(floatersOn(p1, CardName.ATMO_COLLECTORS)).eq(1);
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(0);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({kind: 'cardResource', resource: CardResource.FLOATER, amount: 3, influence: 1, count: 2, part: 'effect', effect: 'floaters'});
      expect(outcome?.card, 'spread over two cards: no single card').is.undefined;
      expect(outcome?.cards).deep.eq([{card: CardName.FLOATING_HABS, amount: 2, resource: CardResource.FLOATER}, {card: CardName.ATMO_COLLECTORS, amount: 1, resource: CardResource.FLOATER}]);
      expect(outcome?.counted).deep.eq([CardName.FLOATING_HABS, CardName.DIRIGIBLES]);
      expect(outcome?.countedUnits).deep.eq([1, 1]);
      expect((parliament.phase?.summary?.outcomes ?? []).filter((o) => o.player === p1.id && o.step === 'floaters'), 'exactly one record').has.length(1);
      // The journal: one addition line per card, each naming the resolution, and the calculation.
      const added = game.gameLog.filter((entry) => entry.message === '${0} added ${1} ${2} to ${3} from ${4}');
      expect(added.map((e) => e.data.find((d) => d.type === LogMessageDataType.CARD)?.value)).deep.eq([CardName.FLOATING_HABS, CardName.ATMO_COLLECTORS]);
      expect(added.every((e) => e.data.some((d) => d.type === LogMessageDataType.RESOLUTION && d.value === CLOUD_DEVELOPMENT_ID))).is.true;
      expect(game.gameLog.some((entry) => entry.message.startsWith('${0} placed ${1} floater(s) from ${2}'))).is.true;
    });

    it('all on one card is legal — the record then names the ONE card too', () => {
      const [, p1, , parliament, ask] = distributing();
      distribute(p1, ask, {[CardName.DIRIGIBLES]: 3});
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(3);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome?.card).eq(CardName.DIRIGIBLES);
      expect(outcome?.cards).deep.eq([{card: CardName.DIRIGIBLES, amount: 3, resource: CardResource.FLOATER}]);
    });

    it('a sum below N is refused with an InputError — the prompt stands, nothing is applied; so is a sum above N', () => {
      const [, p1, , parliament, ask] = distributing();
      expect(() => distribute(p1, ask, {[CardName.FLOATING_HABS]: 2})).to.throw(InputError, /Expecting 3 .*, got 2/);
      expect(p1.getWaitingFor(), 'the prompt stands').eq(ask);
      expect(floatersOn(p1, CardName.FLOATING_HABS), 'nothing applied').eq(0);
      expect(outcomeOf(parliament, p1), 'nothing recorded').is.undefined;
      expect(() => distribute(p1, ask, {[CardName.FLOATING_HABS]: 2, [CardName.DIRIGIBLES]: 2})).to.throw(InputError, /Expecting 3 .*, got 4/);
      expect(p1.getWaitingFor()).eq(ask);
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(0);
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(0);
      // A single amount above N is refused by the amount itself.
      expect(() => distribute(p1, ask, {[CardName.FLOATING_HABS]: 4})).to.throw(InputError);
      expect(p1.getWaitingFor()).eq(ask);
      // …and the corrected answer goes through.
      distribute(p1, ask, {[CardName.FLOATING_HABS]: 1, [CardName.DIRIGIBLES]: 1, [CardName.ATMO_COLLECTORS]: 1});
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(1);
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(1);
      expect(floatersOn(p1, CardName.ATMO_COLLECTORS)).eq(1);
      expect(outcomeOf(parliament, p1)?.cards).has.length(3);
    });

    it('pays every participant by THEIR OWN tags and influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 0); // → step 1 = influence 1
      parliament.agenda.set(p2.id, agendaForInfluence(3)); // never voted: influence 3
      p1.playedCards.push(new Dirigibles(), new AtmoCollectors()); // 1 tag → N = 2 over two holders
      p2.playedCards.push(new JovianLanterns(), new CloudTourism()); // 1 + 2 = 3 tags → N = 6 over two holders
      endGeneration(game);
      const ask1 = cast(p1.getWaitingFor(), AndOptions);
      expect(ask1.cardResourceDistributionPrompt?.amount, 'the winner\'s Agenda step counts').eq(2);
      expect(p2.getWaitingFor(), 'players are visited in order').is.undefined;
      distribute(p1, ask1, {[CardName.DIRIGIBLES]: 1, [CardName.ATMO_COLLECTORS]: 1});
      runAllActions(game);
      const ask2 = cast(p2.getWaitingFor(), AndOptions);
      expect(ask2.cardResourceDistributionPrompt?.amount, 'a non-voter is paid by its own tags and influence').eq(6);
      distribute(p2, ask2, {[CardName.JOVIAN_LANTERNS]: 4, [CardName.CLOUD_TOURISM]: 2});
      runAllActions(game);
      expect(floatersOn(p2, CardName.JOVIAN_LANTERNS)).eq(4);
      expect(floatersOn(p2, CardName.CLOUD_TOURISM)).eq(2);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(outcomeOf(parliament, p2)).deep.include({amount: 6, influence: 3, count: 3});
      expect(outcomeOf(parliament, p2)?.countedByTag).deep.eq([{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 2}]);
    });

    it('a neutral winner cancels nothing: everyone is still paid', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, CLOUD);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      parliament.agenda.set(p2.id, 0);
      p1.playedCards.push(new Dirigibles()); // N = 2, one holder
      p2.playedCards.push(new JupiterFloatingStation()); // Jovian tag, one holder: N = 1
      endGeneration(game);
      expect(cast(p1.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      p1.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      runAllActions(game);
      expect(cast(p2.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      p2.process({type: 'card', cards: [CardName.JUPITER_FLOATING_STATION]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(2);
      expect(floatersOn(p2, CardName.JUPITER_FLOATING_STATION)).eq(1);
    });
  });

  describe('the skips — named, with their size', () => {
    it('N = 0 asks nothing and records the skip with its reason', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 wins (influence 1) and has a holder; p2 has a holder but neither tags nor influence.
      p1.playedCards.push(new AtmoCollectors());
      p2.playedCards.push(new AtmoCollectors());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.ATMO_COLLECTORS]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(floatersOn(p2, CardName.ATMO_COLLECTORS)).eq(0);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', reason: 'No Venus or Jovian tags and no influence', amount: 0, influence: 0, count: 0});
      expect(game.gameLog.some((entry) => entry.message.includes('has no Venus or Jovian tags and no influence'))).is.true;
    });

    it('no holder: the payout is NAMED WITH ITS SIZE and forfeited — never banked, never converted; a Venus TAG is not storage', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2
      p1.playedCards.push(new StratosphericBirds(), new IoSulphurResearch()); // a Venus tag and a Jovian tag, no floater storage
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing asked, the phase went on').is.undefined;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', reason: 'No card can hold floaters', amount: 4, influence: 2, count: 2});
      expect(p1.tableau.get(CardName.STRATOSPHERIC_BIRDS)?.resourceCount ?? 0, 'animals are not floaters').eq(0);
      expect(game.gameLog.some((entry) => entry.message.includes('has no card that can hold floaters'))).is.true;
    });
  });

  describe('recovery', () => {
    it('a reload inside the DISTRIBUTION rebuilds the same question (marker, amount, faces) and pays once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new FloatingHabs(), new Dirigibles());
      endGeneration(game);
      const before = cast(p1.getWaitingFor(), AndOptions).cardResourceDistributionPrompt!;
      expect(before.amount).eq(3);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(one.getWaitingFor(), AndOptions);
      const meta = ask.cardResourceDistributionPrompt!;
      expect(meta.amount).eq(3);
      expect(meta.cards.map((c) => c.name)).deep.eq(before.cards.map((c) => c.name));
      expect(meta.vpByAmount).deep.eq(before.vpByAmount);
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: CLOUD_DEVELOPMENT_ID});
      expect(live.parliament!.phase?.effectState?.[p1.id]?.floatersOwed, 'the amount is fixed with the phase').eq(3);
      // Even if the influence or the tableau moved meanwhile, the question keeps the number it was built with.
      live.parliament!.agenda.set(p1.id, 8);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const again = cast(one.getWaitingFor(), AndOptions);
      expect(again.cardResourceDistributionPrompt?.amount).eq(3);
      distribute(one, again, {[CardName.FLOATING_HABS]: 3});
      expect(floatersOn(one, CardName.FLOATING_HABS)).eq(3);
      expect(floatersOn(one, CardName.DIRIGIBLES)).eq(0);
      // A REPEATED answer to the processed question is refused and pays nothing more.
      expect(() => one.process({type: 'and', responses: [{type: 'amount', amount: 0}, {type: 'amount', amount: 3}]})).to.throw();
      expect(floatersOn(one, CardName.DIRIGIBLES)).eq(0);
      expect(floatersOn(one, CardName.FLOATING_HABS)).eq(3);
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'floaters')).has.length(1);
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'floaters')?.cards).deep.eq([{card: CardName.FLOATING_HABS, amount: 3, resource: CardResource.FLOATER}]);
    });

    it('a reload inside the single PICK rebuilds it with the same amount; a reload BETWEEN two seats asks the second once', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      p1.playedCards.push(new Dirigibles()); // N = 2, one holder
      p2.playedCards.push(new AtmoCollectors()); // N = 1, one holder
      endGeneration(game);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      expect(cast(one.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      one.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      runAllActions(live);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(floatersOn(one, CardName.DIRIGIBLES)).eq(2);
      expect(one.getWaitingFor(), 'p1 owes nothing more').is.undefined;
      expect(cast(two.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      two.process({type: 'card', cards: [CardName.ATMO_COLLECTORS]});
      runAllActions(live);
      expect(floatersOn(two, CardName.ATMO_COLLECTORS)).eq(1);
      expect(floatersOn(one, CardName.DIRIGIBLES)).eq(2);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
    });
  });

  describe('the chairman quest, Unity in power, the model and MarsBot', () => {
    it('the floaters never progress the Venus-tag quest; playing a Venus card as an own action does', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Dirigibles(), new FloatingHabs()); // N = 3 over two holders
      endGeneration(game);
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.DIRIGIBLES]: 2, [CardName.FLOATING_HABS]: 1});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.quest?.source).eq(CLOUD_DEVELOPMENT_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.VENUS}, count: 2});
      expect(parliament.questProgressOf(p1), 'the payout counted nothing').eq(0);
      // Generation 2: p2 plays two Venus cards as its OWN action-phase actions.
      game.phase = Phase.ACTION;
      const events = game.events;
      for (const card of [new Dirigibles(), new StratosphericBirds()]) {
        events.beginAction(p2, {kind: 'card', card: card.name, owner: p2.color}, {category: 'card-play'});
        try {
          p2.playCard(card);
        } finally {
          events.endScope();
        }
        runAllActions(game);
      }
      expect(parliament.quest?.completedBy).eq(p2.id);
      answerQuestGate(game, p2);
      expect(parliament.chairman).eq(p2.id);
    });

    it('once enacted, UNITY RULES: every participant holds its effect and the free trade path is open', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new AtmoCollectors());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.ATMO_COLLECTORS]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.rulingParty()).eq(PartyName.UNITY);
      expect(parliament.hasPartyEffect(p1, PartyName.UNITY)).is.true;
      expect(parliament.hasPartyEffect(p2, PartyName.UNITY), 'the ruling party\'s effect is everyone\'s').is.true;
      expect(new TradeWithUnity(p1).canUse()).is.true;
      expect(new TradeWithUnity(p2).canUse()).is.true;
      expect(parliament.partyActionUsesLeft(p2, PartyName.UNITY)).eq(1);
      expect(game.gameLog.some((entry) => entry.message === '${0} is now the ruling party — every player has its effect' &&
        entry.data.some((d) => d.value === PartyName.UNITY))).is.true;
    });

    it('the model: every seat carries the two-tag count with its breakdown; the recorded outcome rides with colours and its list', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new FloatingHabs(), new JovianLanterns());
      const seat = getParliamentModel(game, p1)?.players.find((p) => p.color === p1.color);
      const count = seat?.counts?.find((c) => c.id === 'venusJovianTags');
      expect(count).deep.eq({id: 'venusJovianTags', count: 2, cards: [CardName.FLOATING_HABS, CardName.JOVIAN_LANTERNS], units: [1, 1], byTag: [{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 1}]});
      endGeneration(game);
      let phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.pending).deep.eq({player: p1.color, key: 'floaters', input: 'and'});
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.FLOATING_HABS]: 1, [CardName.JOVIAN_LANTERNS]: 2});
      phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.outcomes?.[0]).deep.include({
        player: p1.color, step: 'floaters', part: 'effect', effect: 'floaters', kind: 'cardResource', resource: 'Floater', amount: 3, influence: 1, count: 2,
      });
      expect(phase?.outcomes?.[0].cards).deep.eq([{card: CardName.FLOATING_HABS, amount: 1, resource: CardResource.FLOATER}, {card: CardName.JOVIAN_LANTERNS, amount: 2, resource: CardResource.FLOATER}]);
      expect(phase?.outcomes?.[0].countedByTag).deep.eq([{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 1}]);
    });

    it('MarsBot (mode none) is never asked, never paid, never a winner', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, CLOUD);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new Dirigibles());
      bot.playedCards.push(new Dirigibles());
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      expect(cast(human.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      human.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.tableau.get(CardName.DIRIGIBLES)?.resourceCount ?? 0).eq(0);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('the floaters count in the final score', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new FloatingHabs(), new Dirigibles()); // N = 3
      const before = p1.getVictoryPoints().total;
      endGeneration(game);
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.FLOATING_HABS]: 2, [CardName.DIRIGIBLES]: 1});
      runAllActions(game);
      settleParliamentGates(game);
      expect(p1.getVictoryPoints().total, '2 floaters on Floating Habs = 1 VP').eq(before + 1);
    });
  });

  describe('the shared step (AddResourcesToCards) on its own', () => {
    it('reports where the units landed once, and refuses a wrong sum before a single unit lands', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new FloatingHabs(), new Dirigibles());
      const landed: Array<Array<{card: CardName, amount: number}>> = [];
      const prompt = cast(new AddResourcesToCards(p1, CardResource.FLOATER, 2, {autoSelect: false})
        .andThen((placed) => {
          landed.push(placed.map((p) => ({card: p.card.name, amount: p.amount})));
          return undefined;
        }).execute(), AndOptions);
      expect(prompt.cardResourceDistributionPrompt?.amount).eq(2);
      expect(() => prompt.process({type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 0}]}, p1)).to.throw(InputError);
      expect(landed).deep.eq([]);
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(0);
      prompt.process({type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 1}]}, p1);
      expect(landed).deep.eq([[{card: CardName.FLOATING_HABS, amount: 1}, {card: CardName.DIRIGIBLES, amount: 1}]]);
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(1);
      expect(floatersOn(p1, CardName.DIRIGIBLES)).eq(1);
    });

    it('N = 1, or one holder, is the family\'s ordinary pick; with `autoSelect: false` a lone holder is still asked', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new FloatingHabs());
      const asked = new AddResourcesToCards(p1, CardResource.FLOATER, 3, {autoSelect: false}).execute();
      expect(asked).is.instanceOf(SelectCard);
      expect(cast(asked, SelectCard).resourceGainPrompt?.amount).eq(3);
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(0);
      // The legacy default (the project cards): a lone holder takes it at once.
      expect(new AddResourcesToCards(p1, CardResource.FLOATER, 3).execute()).is.undefined;
      expect(floatersOn(p1, CardName.FLOATING_HABS)).eq(3);
      p1.playedCards.push(new Dirigibles());
      const one = new AddResourcesToCards(p1, CardResource.FLOATER, 1, {autoSelect: false}).execute();
      expect(one, 'one unit over two holders: a pick, never a distribution').is.instanceOf(SelectCard);
      expect(cast(one, SelectCard).cards.map((c) => c.name)).deep.eq([CardName.FLOATING_HABS, CardName.DIRIGIBLES]);
    });
  });
});

/*
 * THE STAND: the declaration alone puts the card in the DISTRIBUTED family — the player's instrument is the
 * layout over their holders, the two-tag count is a term of the reading (Central Power Grid, whose count is
 * the whole instrument, stays in the tag-counted family). The «Полигон» opens the family of a resolution it
 * has never seen from this one function; a spread that fell into the tag-counted family would be shown as a
 * production formula.
 */
describe('Cloud Development — the stand', () => {
  it('is the DISTRIBUTED family by its declaration; the tag-counted family keeps Central Power Grid', () => {
    expect(familyOf(CLOUD_DEVELOPMENT)).eq('distributed');
    expect(familyOf(REDUX_RESOLUTION_CATALOG.get(CENTRAL_POWER_GRID_ID)!)).eq('counted-tags');
  });
});
