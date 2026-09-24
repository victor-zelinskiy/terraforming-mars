import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  MEDICAL_DATABASE, MEDICAL_DATABASE_CODE, MEDICAL_DATABASE_ID, MEDICAL_DATABASE_KINDS, MEDICAL_DATABASE_RESOURCES,
} from '../../src/server/parliament/resolutions/scientists/MedicalDatabase';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerGate, answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {cardCountVerdict, resolutionCountKind, RESOLUTION_TAG_COUNTING_MODE} from '../../src/common/parliament/resolutionCounts';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {InputError} from '../../src/server/inputs/InputError';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {Decomposers} from '../../src/server/cards/base/Decomposers';
import {Research} from '../../src/server/cards/base/Research';
import {PhysicsComplex} from '../../src/server/cards/base/PhysicsComplex';
import {Fish} from '../../src/server/cards/base/Fish';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';

/**
 * MEDICAL DATABASE (Turmoil Redux, RX18) — the second Scientists card and the
 * first of the DISTRIBUTING family whose unit comes in TWO KINDS. What these
 * specs pin: N = science tags + influence through the canonical counter
 * (Research is 2, a wild tag is not a science tag); the recipients are the
 * holders of data AND of microbes at once — the UNION, in tableau order,
 * each once (a WARE holder among them); the kind of every unit follows from
 * the CARD it lands on, never from a second question; the SHARED step's two
 * shapes hold over the list exactly as over one kind (a pick with N = 1 or
 * ONE holder, never an auto-apply; a distribution with its structural marker
 * naming the kinds and each holder's own); a mixed landing records no single
 * kind but every card's; a wrong sum is refused with nothing applied; a
 * reload inside the layout rebuilds it and pays once; the skips name
 * themselves with their size — «no holder» apart from «no influence»; the
 * chairman quest never counts the units; MarsBot is nowhere; the old callers
 * of the shared step (one kind = the list of one) behave as before.
 *
 * A DATA holder exists in Pathfinders / the Moon / Underworld only, so the
 * data branch stands on a SYNTHETIC card (`fakeCard` with `resourceType:
 * DATA`) — the ordinary game's holders are microbe holders, and the record
 * then reads like Cloud Development's.
 */
const MEDICAL = resolutionInstanceId(MEDICAL_DATABASE_ID, 0);

/** A synthetic DATA holder — the branch the premium scope has no real card for. */
function dataVault(name = 'Data Vault'): IProjectCard {
  return fakeCard({name: name as CardName, type: CardType.ACTIVE, tags: [Tag.SCIENCE], resourceType: CardResource.DATA});
}

/** A synthetic WARE holder — the one card that holds «any» kind (a counter, never a kind). */
function wareCrate(): IProjectCard {
  return fakeCard({name: 'Ware Crate' as CardName, type: CardType.ACTIVE, tags: [], resourceType: CardResource.WARE});
}

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Medical Database in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, MEDICAL);
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

function storedOn(player: TestPlayer, name: CardName | string): number {
  return player.tableau.get(name as CardName)?.resourceCount ?? 0;
}

/** Answer a distribution: the amounts in the prompt's own card order. */
function distribute(player: TestPlayer, prompt: AndOptions, amounts: Partial<Record<string, number>>): void {
  const cards = prompt.cardResourceDistributionPrompt!.cards;
  player.process({type: 'and', responses: cards.map((c) => ({type: 'amount', amount: amounts[c.name] ?? 0}))});
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).find((o) => o.player === player.id && o.step === 'resources');
}

describe('MedicalDatabase', () => {
  describe('the catalog entry', () => {
    it('is RX18 of the Scientists, ONE card, dealt in every Redux game, with the science-tag count and the two-kind distributed unit declared', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MEDICAL_DATABASE_ID)).eq(MEDICAL_DATABASE);
      expect(MEDICAL_DATABASE.code).eq(MEDICAL_DATABASE_CODE);
      expect(MEDICAL_DATABASE_CODE).eq('RX18');
      expect(MEDICAL_DATABASE_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX18')).eq(MEDICAL_DATABASE);
      expect(MEDICAL_DATABASE.party).eq(PartyName.SCIENTISTS);
      expect(MEDICAL_DATABASE.copies).eq(1);
      expect(MEDICAL_DATABASE.compatibility, 'microbes are a base resource: no dependency').is.undefined;
      expect(MEDICAL_DATABASE.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
      expect(MEDICAL_DATABASE.scaled).deep.eq([MEDICAL_DATABASE_RESOURCES]);
      expect(MEDICAL_DATABASE_RESOURCES.unit).deep.eq({kind: 'cardResource', resources: [CardResource.DATA, CardResource.MICROBE], spread: true});
      expect(MEDICAL_DATABASE_KINDS).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(MEDICAL_DATABASE_RESOURCES.count).deep.eq({id: 'scienceTags', per: 1});
      expect(MEDICAL_DATABASE_RESOURCES.perInfluence).eq(1);
      expect(MEDICAL_DATABASE_RESOURCES.cap, 'no cap').is.undefined;
      expect(MEDICAL_DATABASE.winnerSteps, 'no winner-only part').is.undefined;
      expect(MEDICAL_DATABASE.worldSteps, 'no world step').is.undefined;
      expect(MEDICAL_DATABASE.passive, 'no passive').is.undefined;
      expect(MEDICAL_DATABASE.immediateSteps?.map((s) => s.key)).deep.eq(['resources']);
      // In the pool of a plain Redux game — no Pathfinders, no data holder anywhere, and still dealt.
      const [, , , parliament] = reduxGame();
      const pool = [...parliament.deck, ...parliament.discard, ...parliament.slots.map((s) => s.instance), ...(parliament.enacted === undefined ? [] : [parliament.enacted])];
      expect(pool).includes(MEDICAL);
    });

    it('the shared formula: 1 unit per science tag + 1 per influence, nothing below zero, no cap', () => {
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, 0, 0)).eq(0);
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, 1, 0)).eq(1);
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, 0, 3)).eq(3);
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, 2, 3)).eq(5);
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, 5, 9)).eq(14);
      expect(scaledAmount(MEDICAL_DATABASE_RESOURCES, -2, 0)).eq(0);
    });

    it('is the DISTRIBUTED family by its declaration — the two kinds change nothing about the instrument', () => {
      expect(familyOf(MEDICAL_DATABASE)).eq('distributed');
    });
  });

  describe('the count: science tags, through the canonical counter', () => {
    it('is the ordinary one-tag count over the science tag: Research is 2, a science-tagged microbe holder 1, the card list explains the number', () => {
      expect(resolutionCountKind('scienceTags')).deep.eq({kind: 'tags', tags: [Tag.SCIENCE]});
      const [, p1] = reduxGame();
      p1.playedCards.push(new Research(), new GHGProducingBacteria(), new Tardigrades());
      const counted = resolutionCount(p1, 'scienceTags');
      expect(counted.count).eq(3);
      expect(counted.cards).deep.eq([CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA]);
      expect(counted.units, 'Research prints two').deep.eq([2, 1]);
      expect(counted.byTag, 'one tag: no per-tag breakdown').is.undefined;
      expect(cardCountVerdict('scienceTags', new Tardigrades(), {eventTagsInPlay: false})).deep.eq({counts: false, reason: 'No science tag'});
    });

    it('a wild tag is not a science tag at an enactment, whatever the player\'s own action context would substitute', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new NobelPrize(), new PhysicsComplex());
      const counted = resolutionCount(p1, 'scienceTags');
      expect(counted.count, 'Physics Complex alone').eq(1);
      expect(counted.cards).deep.eq([CardName.PHYSICS_COMPLEX]);
      expect(p1.tags.count(Tag.SCIENCE, 'default')).eq(2);
      expect(p1.tags.count(Tag.SCIENCE, RESOLUTION_TAG_COUNTING_MODE)).eq(1);
    });

    it('the explanation always adds up to the canonical number, over a corpus of tableaus', () => {
      const [, p1] = reduxGame();
      const corpus: Array<Array<ICard>> = [
        [],
        [new Research()],
        [new GHGProducingBacteria(), new RegolithEaters()],
        [new Research(), new PhysicsComplex(), new Fish()],
        [new NobelPrize(), new Tardigrades()],
        [dataVault(), new Decomposers()],
      ];
      for (const tableau of corpus) {
        p1.playedCards.set(...tableau);
        const model = resolutionCount(p1, 'scienceTags');
        const fromCards = (model.units ?? []).reduce((sum, n) => sum + n, 0);
        expect(model.count, tableau.map((c) => c.name).join(' + ')).eq(p1.tags.count(Tag.SCIENCE, RESOLUTION_TAG_COUNTING_MODE));
        expect(fromCards, 'the explanation adds up to the number').eq(model.count);
      }
    });
  });

  describe('the recipients: the holders of data AND of microbes, each unit\'s kind its card\'s', () => {
    it('the shape follows the shared step: N = 1 over several holders of BOTH kinds is the family\'s ordinary pick, and the pick spans both', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 wins with nothing to hold; p2 never voted — influence 0 — and holds one science tag on a data card
      // beside a microbe holder: ONE unit, TWO places of two kinds to put it.
      parliament.agenda.set(p2.id, 0);
      p2.playedCards.push(dataVault(), new Tardigrades());
      endGeneration(game);
      runAllActions(game);
      const ask = cast(p2.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount).eq(1);
      expect(ask.resourceGainPrompt?.cardResource, 'no ONE kind over two').is.undefined;
      expect(ask.resourceGainPrompt?.cardResources).deep.eq(['data', 'microbe']);
      expect(ask.resourceGainPrompt?.cardResourceByCard).deep.eq({'Data Vault': 'data', [CardName.TARDIGRADES]: 'microbe'});
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: MEDICAL_DATABASE_ID});
      expect(ask.cards.map((c) => c.name)).deep.eq(['Data Vault', CardName.TARDIGRADES]);
      expect(ask.cardResourceDistributionPrompt, 'not a distribution').is.undefined;
      p2.process({type: 'card', cards: [CardName.TARDIGRADES]});
      expect(storedOn(p2, CardName.TARDIGRADES)).eq(1);
      expect(storedOn(p2, 'Data Vault')).eq(0);
      const outcome = outcomeOf(parliament, p2);
      // ONE unit of ONE kind landed: the record names the kind — the microbe the card took.
      expect(outcome).deep.include({kind: 'cardResource', resource: CardResource.MICROBE, amount: 1, card: CardName.TARDIGRADES, influence: 0, count: 1});
      expect(outcome?.resources).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(outcome?.cards).deep.eq([{card: CardName.TARDIGRADES, amount: 1, resource: CardResource.MICROBE}]);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', reason: 'No card can hold data or microbes', amount: 1});
    });

    it('ONE holder, N = 3: the pick is SHOWN and confirmed (never applied behind the board) and all three land there', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      p1.playedCards.push(new GHGProducingBacteria()); // a science tag + the only holder: N = 1 + 2 = 3
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount).eq(3);
      expect(ask.cards.map((c) => c.name)).deep.eq([CardName.GHG_PRODUCING_BACTERIA]);
      expect(storedOn(p1, CardName.GHG_PRODUCING_BACTERIA), 'nothing applied before the confirm').eq(0);
      p1.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      expect(storedOn(p1, CardName.GHG_PRODUCING_BACTERIA)).eq(3);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({kind: 'cardResource', resource: CardResource.MICROBE, amount: 3, card: CardName.GHG_PRODUCING_BACTERIA, influence: 2, count: 1});
      expect(outcome?.counted).deep.eq([CardName.GHG_PRODUCING_BACTERIA]);
      expect(outcome?.cards).deep.eq([{card: CardName.GHG_PRODUCING_BACTERIA, amount: 3, resource: CardResource.MICROBE}]);
    });

    it('N ≥ 2 over holders of BOTH kinds: the DISTRIBUTION — the union in tableau order, the marker naming the kinds and each holder\'s own', () => {
      const [game, p1] = stage();
      // Tardigrades (microbe) · Data Vault (science, data) · Fish (animals: not a holder) · Decomposers (microbe, 1 VP per 3).
      p1.playedCards.push(new Tardigrades(), dataVault(), new Fish(), new Decomposers());
      endGeneration(game); // 1 tag + influence 1 = 2 over THREE holders
      const ask = cast(p1.getWaitingFor(), AndOptions);
      const meta = ask.cardResourceDistributionPrompt!;
      expect(meta.amount).eq(2);
      expect(meta.cardResource, 'no ONE kind over two').is.undefined;
      expect(meta.cardResources).deep.eq(['data', 'microbe']);
      expect(meta.cardResourceByCard).deep.eq({[CardName.TARDIGRADES]: 'microbe', 'Data Vault': 'data', [CardName.DECOMPOSERS]: 'microbe'});
      expect(meta.cards.map((c) => c.name), 'the union, in tableau order, the animal holder out').deep.eq([CardName.TARDIGRADES, 'Data Vault', CardName.DECOMPOSERS]);
      expect(ask.options.map((o) => o.title)).deep.eq([CardName.TARDIGRADES, 'Data Vault', CardName.DECOMPOSERS]);
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: MEDICAL_DATABASE_ID});
      expect(meta.vpByAmount?.[CardName.DECOMPOSERS], 'the VP table per k: 1 per 3 — two units move nothing').deep.eq([{from: 0, to: 0}, {from: 0, to: 0}]);
      expect(storedOn(p1, CardName.TARDIGRADES), 'nothing applied by the question').eq(0);
    });

    it('a MIXED landing: each unit lands as ITS card\'s kind, the journal names each card\'s resource, the record names no single kind but every card\'s', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1); // influence 1
      p1.playedCards.push(new Research(), new Tardigrades(), dataVault()); // 2 + 1 = 3 tags → N = 4
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      expect(ask.cardResourceDistributionPrompt?.amount).eq(4);
      distribute(p1, ask, {[CardName.TARDIGRADES]: 3, 'Data Vault': 1});
      expect(storedOn(p1, CardName.TARDIGRADES)).eq(3);
      expect(storedOn(p1, 'Data Vault')).eq(1);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({kind: 'cardResource', amount: 4, influence: 1, count: 3, part: 'effect', effect: 'resources'});
      expect(outcome?.resource, 'units of two kinds: no single kind').is.undefined;
      expect(outcome?.resources).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(outcome?.card, 'spread over two cards: no single card').is.undefined;
      expect(outcome?.cards).deep.eq([{card: CardName.TARDIGRADES, amount: 3, resource: CardResource.MICROBE}, {card: 'Data Vault', amount: 1, resource: CardResource.DATA}]);
      expect(outcome?.counted).deep.eq([CardName.RESEARCH, 'Data Vault']);
      expect(outcome?.countedUnits).deep.eq([2, 1]);
      expect((parliament.phase?.summary?.outcomes ?? []).filter((o) => o.player === p1.id && o.step === 'resources'), 'exactly one record').has.length(1);
      // The journal: one addition line per card, each naming the CARD's resource and the resolution.
      const added = game.gameLog.filter((entry) => entry.message === '${0} added ${1} ${2} to ${3} from ${4}');
      expect(added.map((e) => e.data.find((d) => d.type === LogMessageDataType.CARD)?.value)).deep.eq([CardName.TARDIGRADES, 'Data Vault']);
      expect(added.map((e) => e.data.find((d) => d.type === LogMessageDataType.RESOURCE)?.value), 'each line names the resource of its CARD').deep.eq([CardResource.MICROBE, CardResource.DATA]);
      expect(added.every((e) => e.data.some((d) => d.type === LogMessageDataType.RESOLUTION && d.value === MEDICAL_DATABASE_ID))).is.true;
      expect(game.gameLog.some((entry) => entry.message.startsWith('${0} placed ${1} resource(s) from ${2}'))).is.true;
    });

    it('all on the microbe holders is legal — the record then names the ONE kind every unit took, as Cloud Development\'s does', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new GHGProducingBacteria(), new RegolithEaters(), dataVault()); // 3 tags + 1 = 4
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      distribute(p1, ask, {[CardName.GHG_PRODUCING_BACTERIA]: 2, [CardName.REGOLITH_EATERS]: 2});
      const outcome = outcomeOf(parliament, p1);
      expect(outcome?.resource).eq(CardResource.MICROBE);
      expect(outcome?.resources).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(outcome?.cards).deep.eq([
        {card: CardName.GHG_PRODUCING_BACTERIA, amount: 2, resource: CardResource.MICROBE},
        {card: CardName.REGOLITH_EATERS, amount: 2, resource: CardResource.MICROBE},
      ]);
      expect(storedOn(p1, 'Data Vault')).eq(0);
    });

    it('a WARE holder is a holder of either kind: a unit on it is journaled and recorded as the card\'s own resource', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new Research(), wareCrate(), new Tardigrades()); // N = 2 + 1 = 3
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      expect(ask.cardResourceDistributionPrompt?.cards.map((c) => c.name)).deep.eq(['Ware Crate', CardName.TARDIGRADES]);
      expect(ask.cardResourceDistributionPrompt?.cardResourceByCard).deep.eq({'Ware Crate': 'ware', [CardName.TARDIGRADES]: 'microbe'});
      distribute(p1, ask, {'Ware Crate': 2, [CardName.TARDIGRADES]: 1});
      expect(storedOn(p1, 'Ware Crate'), 'the counter is what the card keeps').eq(2);
      const outcome = outcomeOf(parliament, p1);
      expect(outcome?.resource).is.undefined;
      expect(outcome?.cards).deep.eq([{card: 'Ware Crate', amount: 2, resource: CardResource.WARE}, {card: CardName.TARDIGRADES, amount: 1, resource: CardResource.MICROBE}]);
      const added = game.gameLog.filter((entry) => entry.message === '${0} added ${1} ${2} to ${3} from ${4}');
      expect(added.map((e) => e.data.find((d) => d.type === LogMessageDataType.RESOURCE)?.value)).deep.eq([CardResource.WARE, CardResource.MICROBE]);
    });

    it('a sum below N is refused with an InputError — the prompt stands, nothing is applied; so is a sum above N', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new Research(), new Tardigrades(), dataVault()); // N = 4
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), AndOptions);
      expect(() => distribute(p1, ask, {[CardName.TARDIGRADES]: 3})).to.throw(InputError, /Expecting 4 .*, got 3/);
      expect(p1.getWaitingFor(), 'the prompt stands').eq(ask);
      expect(storedOn(p1, CardName.TARDIGRADES), 'nothing applied').eq(0);
      expect(outcomeOf(parliament, p1), 'nothing recorded').is.undefined;
      expect(() => distribute(p1, ask, {[CardName.TARDIGRADES]: 3, 'Data Vault': 2})).to.throw(InputError, /Expecting 4 .*, got 5/);
      expect(p1.getWaitingFor()).eq(ask);
      expect(storedOn(p1, 'Data Vault')).eq(0);
      // …and the corrected answer goes through.
      distribute(p1, ask, {[CardName.TARDIGRADES]: 2, 'Data Vault': 2});
      expect(storedOn(p1, CardName.TARDIGRADES)).eq(2);
      expect(storedOn(p1, 'Data Vault')).eq(2);
      expect(outcomeOf(parliament, p1)?.cards).has.length(2);
    });

    it('pays every participant by THEIR OWN tags and influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 0); // → step 1 = influence 1
      parliament.agenda.set(p2.id, agendaForInfluence(3)); // never voted: influence 3
      p1.playedCards.push(new GHGProducingBacteria(), new Tardigrades()); // 1 tag → N = 2 over two holders
      p2.playedCards.push(new Research(), new Decomposers(), dataVault()); // 2 + 1 = 3 tags → N = 6 over two holders
      endGeneration(game);
      const ask1 = cast(p1.getWaitingFor(), AndOptions);
      expect(ask1.cardResourceDistributionPrompt?.amount, 'the winner\'s Agenda step counts').eq(2);
      expect(p2.getWaitingFor(), 'players are visited in order').is.undefined;
      distribute(p1, ask1, {[CardName.GHG_PRODUCING_BACTERIA]: 1, [CardName.TARDIGRADES]: 1});
      runAllActions(game);
      const ask2 = cast(p2.getWaitingFor(), AndOptions);
      expect(ask2.cardResourceDistributionPrompt?.amount, 'a non-voter is paid by its own tags and influence').eq(6);
      distribute(p2, ask2, {[CardName.DECOMPOSERS]: 4, 'Data Vault': 2});
      runAllActions(game);
      expect(storedOn(p2, CardName.DECOMPOSERS)).eq(4);
      expect(storedOn(p2, 'Data Vault')).eq(2);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(outcomeOf(parliament, p2)).deep.include({amount: 6, influence: 3, count: 3});
    });

    it('a neutral winner cancels nothing: everyone is still paid', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, MEDICAL);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      parliament.agenda.set(p2.id, 0);
      p1.playedCards.push(new GHGProducingBacteria()); // N = 2, one holder
      p2.playedCards.push(new RegolithEaters()); // science tag, one holder: N = 1
      endGeneration(game);
      expect(cast(p1.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      p1.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      runAllActions(game);
      expect(cast(p2.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      p2.process({type: 'card', cards: [CardName.REGOLITH_EATERS]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(storedOn(p1, CardName.GHG_PRODUCING_BACTERIA)).eq(2);
      expect(storedOn(p2, CardName.REGOLITH_EATERS)).eq(1);
    });
  });

  describe('the skips — named, with their size, two reasons apart', () => {
    it('N = 0 asks nothing and records «no science tags and no influence» — even with holders waiting', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Tardigrades());
      // p2 holds microbe storage and a synthetic DATA holder without a science tag: two holders, nothing to place.
      p2.playedCards.push(new Tardigrades(), fakeCard({name: 'Idle Vault' as CardName, type: CardType.ACTIVE, tags: [], resourceType: CardResource.DATA}));
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(storedOn(p2, CardName.TARDIGRADES)).eq(0);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', reason: 'No science tags and no influence', amount: 0, influence: 0, count: 0});
      expect(outcomeOf(parliament, p2)?.resources).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(game.gameLog.some((entry) => entry.message.includes('has no science tags and no influence'))).is.true;
    });

    it('no holder of EITHER kind: the payout is NAMED WITH ITS SIZE and forfeited — never «no influence», never silent; a science TAG is not storage', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2
      p1.playedCards.push(new Research(), new PhysicsComplex(), new Fish()); // three science tags, an animal holder, no data / microbe storage
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing asked, the phase went on').is.undefined;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', reason: 'No card can hold data or microbes', amount: 5, influence: 2, count: 3});
      expect(outcomeOf(parliament, p1)?.resources).deep.eq([CardResource.DATA, CardResource.MICROBE]);
      expect(storedOn(p1, CardName.FISH), 'animals are neither').eq(0);
      expect(game.gameLog.some((entry) => entry.message.includes('has no card that can hold data or microbes'))).is.true;
    });
  });

  describe('recovery', () => {
    it('a reload inside the DISTRIBUTION rebuilds the same question (marker, kinds, faces) and pays once', () => {
      // A save holds REAL cards only: the ordinary game's holders — microbe holders — over the two-kind step.
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new Research(), new Tardigrades(), new GHGProducingBacteria()); // 3 tags + 1 = 4
      endGeneration(game);
      const before = cast(p1.getWaitingFor(), AndOptions).cardResourceDistributionPrompt!;
      expect(before.amount).eq(4);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(one.getWaitingFor(), AndOptions);
      const meta = ask.cardResourceDistributionPrompt!;
      expect(meta.amount).eq(4);
      expect(meta.cardResource, 'the step spans two kinds even where every holder takes one').is.undefined;
      expect(meta.cardResources).deep.eq(['data', 'microbe']);
      expect(meta.cardResourceByCard).deep.eq({[CardName.TARDIGRADES]: 'microbe', [CardName.GHG_PRODUCING_BACTERIA]: 'microbe'});
      expect(meta.cardResourceByCard).deep.eq(before.cardResourceByCard);
      expect(meta.cards.map((c) => c.name)).deep.eq(before.cards.map((c) => c.name));
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: MEDICAL_DATABASE_ID});
      expect(live.parliament!.phase?.effectState?.[p1.id]?.resourcesOwed, 'the amount is fixed with the phase').eq(4);
      // Even if the influence or the tableau moved meanwhile, the question keeps the number it was built with.
      live.parliament!.agenda.set(p1.id, 8);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const again = cast(one.getWaitingFor(), AndOptions);
      expect(again.cardResourceDistributionPrompt?.amount).eq(4);
      distribute(one, again, {[CardName.TARDIGRADES]: 4});
      expect(storedOn(one, CardName.TARDIGRADES)).eq(4);
      expect(storedOn(one, CardName.GHG_PRODUCING_BACTERIA)).eq(0);
      // A REPEATED answer to the processed question is refused and pays nothing more.
      expect(() => one.process({type: 'and', responses: [{type: 'amount', amount: 0}, {type: 'amount', amount: 4}]})).to.throw();
      expect(storedOn(one, CardName.TARDIGRADES)).eq(4);
      runAllActions(live);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'resources')).has.length(1);
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'resources')?.cards).deep.eq([{card: CardName.TARDIGRADES, amount: 4, resource: CardResource.MICROBE}]);
    });

    it('a reload inside the single PICK rebuilds it with the same kinds; a reload BETWEEN two seats asks the second once', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      p1.playedCards.push(new GHGProducingBacteria()); // N = 2, one holder
      p2.playedCards.push(new RegolithEaters()); // N = 2 (a science tag + influence 1), one holder
      endGeneration(game);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      expect(cast(one.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      one.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      runAllActions(live);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(storedOn(one, CardName.GHG_PRODUCING_BACTERIA)).eq(2);
      expect(one.getWaitingFor(), 'p1 owes nothing more').is.undefined;
      const pick = cast(two.getWaitingFor(), SelectCard);
      expect(pick.resourceGainPrompt?.amount).eq(2);
      expect(pick.resourceGainPrompt?.cardResource).is.undefined;
      expect(pick.resourceGainPrompt?.cardResources).deep.eq(['data', 'microbe']);
      expect(pick.resourceGainPrompt?.cardResourceByCard).deep.eq({[CardName.REGOLITH_EATERS]: 'microbe'});
      two.process({type: 'card', cards: [CardName.REGOLITH_EATERS]});
      runAllActions(live);
      expect(storedOn(two, CardName.REGOLITH_EATERS)).eq(2);
      expect(outcomeOf(live.parliament!, two)).deep.include({kind: 'cardResource', resource: CardResource.MICROBE, amount: 2, card: CardName.REGOLITH_EATERS});
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
    });
  });

  describe('the chairman quest, the Scientists in power, the model and MarsBot', () => {
    it('the units never progress the science-tag quest; playing a science card as an own action does', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new GHGProducingBacteria(), new Tardigrades()); // N = 2 over two holders
      endGeneration(game);
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.GHG_PRODUCING_BACTERIA]: 1, [CardName.TARDIGRADES]: 1});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.rulingParty()).eq(PartyName.SCIENTISTS);
      expect(parliament.quest?.source).eq(MEDICAL_DATABASE_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
      expect(parliament.questProgressOf(p1), 'the payout counted nothing').eq(0);
      // Generation 2: p2 plays a two-science-tag card as its OWN action-phase action.
      game.phase = Phase.ACTION;
      const events = game.events;
      const research = new Research();
      events.beginAction(p2, {kind: 'card', card: research.name, owner: p2.color}, {category: 'card-play'});
      try {
        p2.playCard(research);
      } finally {
        events.endScope();
      }
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p2.id);
      answerQuestGate(game, p2);
      expect(parliament.chairman).eq(p2.id);
    });

    it('the model: every seat carries the science-tag count; the recorded outcome rides with colours, the kinds and each card\'s own', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new Research(), new Tardigrades(), dataVault());
      const seat = getParliamentModel(game, p1)?.players.find((p) => p.color === p1.color);
      const count = seat?.counts?.find((c) => c.id === 'scienceTags');
      expect(count).deep.eq({id: 'scienceTags', count: 3, cards: [CardName.RESEARCH, 'Data Vault'], units: [2, 1]});
      endGeneration(game);
      let phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.pending).deep.eq({player: p1.color, key: 'resources', input: 'and'});
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.TARDIGRADES]: 1, 'Data Vault': 3});
      phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.outcomes?.[0]).deep.include({
        player: p1.color, step: 'resources', part: 'effect', effect: 'resources', kind: 'cardResource', amount: 4, influence: 1, count: 3,
      });
      expect(phase?.outcomes?.[0].resource).is.undefined;
      expect(phase?.outcomes?.[0].resources).deep.eq(['Data', 'Microbe']);
      expect(phase?.outcomes?.[0].cards).deep.eq([{card: CardName.TARDIGRADES, amount: 1, resource: 'Microbe'}, {card: 'Data Vault', amount: 3, resource: 'Data'}]);
    });

    it('MarsBot (mode none) is never asked, never paid, never a winner', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, MEDICAL);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new GHGProducingBacteria());
      bot.playedCards.push(new GHGProducingBacteria());
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      expect(cast(human.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      human.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.tableau.get(CardName.GHG_PRODUCING_BACTERIA)?.resourceCount ?? 0).eq(0);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('the units count in the final score', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(1) - 1);
      p1.playedCards.push(new Research(), new Decomposers(), new Tardigrades()); // N = 3
      const before = p1.getVictoryPoints().total;
      endGeneration(game);
      distribute(p1, cast(p1.getWaitingFor(), AndOptions), {[CardName.DECOMPOSERS]: 3});
      runAllActions(game);
      settleParliamentGates(game);
      expect(p1.getVictoryPoints().total, '3 microbes on Decomposers = 1 VP').eq(before + 1);
    });
  });
});
