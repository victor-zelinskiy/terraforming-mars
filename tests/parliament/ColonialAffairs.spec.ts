import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  COLONIAL_AFFAIRS, COLONIAL_AFFAIRS_BONUSES, COLONIAL_AFFAIRS_CODE, COLONIAL_AFFAIRS_ID, colonyBonusMultiplier, colonyBonusSteps, colonyBonusStepShape,
  colonyRepeatStepKey, colonyStepKey, NO_COLONIES_STEP_KEY,
} from '../../src/server/parliament/resolutions/unity/ColonialAffairs';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {immediateStepsOf} from '../../src/server/parliament/resolutions/IResolution';
import {answerGate, answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {Colony} from '../../src/server/colonies/Colony';
import {Luna} from '../../src/server/colonies/Luna';
import {Titan} from '../../src/server/colonies/Titan';
import {Miranda} from '../../src/server/colonies/Miranda';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Ganymede} from '../../src/server/colonies/Ganymede';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Enceladus} from '../../src/server/colonies/Enceladus';
import {Titania} from '../../src/server/cards/community/Titania';
import {Iapetus} from '../../src/server/cards/community/Iapetus';
import {ALL_COLONIES_TILES} from '../../src/server/colonies/ColonyManifest';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {Satellites} from '../../src/server/cards/base/Satellites';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {IPlayer} from '../../src/server/IPlayer';

/**
 * COLONIAL AFFAIRS (Turmoil Redux, RX07) — the first resolution whose steps
 * are a PLAN PER PLAYER and whose one enactment pays a player several
 * rewards of different natures. What these specs pin: k = 2 + ⌊I/2⌋ (1…5 →
 * 2, 3, 3, 4, 4), the winner's influence read AFTER its Agenda step; the
 * plan's deterministic keys (one per tile, k pairs for Pluto, one named skip
 * with no colonies) and the same plan on a reload in the middle of the
 * second Pluto pair with nothing paid twice; THE LAW OF MERGING (Luna ×3 is
 * one 6 M€ record, Titan ×3 one distribution of 3, Miranda ×3 one intake of
 * 3, Pluto ×3 three pairs with the next card never revealed before the
 * previous discard is answered); the skips with their size; a community
 * loss as an honest negative record; the chairman quest untouched; MarsBot
 * paid nothing; the seat's colony ledger in the model.
 */
const COLONIAL = resolutionInstanceId(COLONIAL_AFFAIRS_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, game.parliament!];
}

/** Seat Colonial Affairs in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, COLONIAL);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** THE TABLE: the tiles in this order, each with the given seats' cubes on it (activated — a cube can only stand on an active tile). */
function arrangeColonies(game: IGame, table: Array<[Colony, Array<IPlayer>]>): void {
  game.colonies = table.map(([colony, owners]) => {
    colony.isActive = true;
    colony.colonies = owners.map((p) => p.id);
    return colony;
  });
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function outcomesOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

/** Answer a distribution: the amounts in the prompt's own card order. */
function distribute(player: TestPlayer, prompt: AndOptions, amounts: Partial<Record<CardName, number>>): void {
  const cards = prompt.cardResourceDistributionPrompt!.cards;
  player.process({type: 'and', responses: cards.map((c) => ({type: 'amount', amount: amounts[c.name] ?? 0}))});
}

/** Take every card of a standing intake prompt. */
function takeAll(player: TestPlayer): Array<CardName> {
  const take = cast(player.getWaitingFor(), SelectCard);
  expect(take.externalDrawPrompt, 'an intake stands').is.not.undefined;
  const names = take.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

/** Answer a standing discard with its first candidate; the prompt's structural marker is what identifies it. */
function discardFirst(player: TestPlayer): CardName {
  const discard = cast(player.getWaitingFor(), SelectCard);
  expect(discard.discardPrompt, 'a discard stands').is.not.undefined;
  const name = discard.cards[0].name;
  player.process({type: 'card', cards: [name]});
  return name;
}

describe('ColonialAffairs', () => {
  describe('the catalog entry', () => {
    it('is RX07 of Unity, ONE card, with the multiplier declared as a colony-bonuses unit stepping by 2 influence', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(COLONIAL_AFFAIRS_ID)).eq(COLONIAL_AFFAIRS);
      expect(COLONIAL_AFFAIRS.code).eq(COLONIAL_AFFAIRS_CODE);
      expect(COLONIAL_AFFAIRS_CODE).eq('RX07');
      expect(COLONIAL_AFFAIRS_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX07')).eq(COLONIAL_AFFAIRS);
      expect(COLONIAL_AFFAIRS.party).eq(PartyName.UNITY);
      expect(COLONIAL_AFFAIRS.copies).eq(1);
      expect(COLONIAL_AFFAIRS.compatibility, 'Colonies are required by Redux itself — no marker').is.undefined;
      expect(COLONIAL_AFFAIRS.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SPACE}, count: 2});
      expect(COLONIAL_AFFAIRS.scaled).deep.eq([COLONIAL_AFFAIRS_BONUSES]);
      expect(COLONIAL_AFFAIRS_BONUSES).deep.eq({id: 'colonyBonuses', unit: {kind: 'colonyBonuses'}, base: 2, perInfluence: 1, influenceStep: 2, recipient: 'each'});
      expect(COLONIAL_AFFAIRS.winnerSteps, 'no winner-only part').is.undefined;
      expect(COLONIAL_AFFAIRS.immediateSteps, 'the steps are a PLAN per player, not a list').is.undefined;
      expect(COLONIAL_AFFAIRS.immediateStepsFor).eq(colonyBonusSteps);
    });

    it('k = 2 + ⌊influence / 2⌋: influence 0…5 reads 2, 2, 3, 3, 4, 4 — the ONE shared formula', () => {
      expect([0, 1, 2, 3, 4, 5].map(colonyBonusMultiplier)).deep.eq([2, 2, 3, 3, 4, 4]);
      expect([0, 1, 2, 3, 4, 5].map((i) => scaledAmount(COLONIAL_AFFAIRS_BONUSES, i))).deep.eq([2, 2, 3, 3, 4, 4]);
      expect(colonyBonusMultiplier(-3), 'nothing below the base').eq(2);
    });

    it('every colony bonus of every tile in the manifest maps to a paying shape — none falls through to «unsupported»', () => {
      for (const entry of ALL_COLONIES_TILES) {
        const colony = new entry.Factory();
        // Pallas is Turmoil-only and never in a Redux game (its benefit counts delegates of the classic parties).
        if (colony.name === ColonyName.PALLAS) {
          continue;
        }
        expect(colonyBonusStepShape(colony.metadata.colony.type), colony.name).not.eq('unsupported');
      }
      expect(colonyBonusStepShape(ColonyBenefit.PLACE_DELEGATES)).eq('unsupported');
    });
  });

  describe('the plan per player', () => {
    it('one step per tile the player has a cube on, in the TABLE\'s order; Pluto is k pairs of draw → discard; the keys are deterministic', () => {
      const [game, p1, p2, parliament] = reduxGame();
      arrangeColonies(game, [[new Luna(), [p1]], [new Titan(), [p1, p2]], [new Miranda(), [p2]], [new Pluto(), [p1]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(3));
      const keys = colonyBonusSteps(p1, parliament, game).map((s) => s.key);
      expect(keys).deep.eq([
        colonyStepKey(ColonyName.LUNA),
        colonyStepKey(ColonyName.TITAN),
        colonyRepeatStepKey(ColonyName.PLUTO, 1, 'draw'), colonyRepeatStepKey(ColonyName.PLUTO, 1, 'discard'),
        colonyRepeatStepKey(ColonyName.PLUTO, 2, 'draw'), colonyRepeatStepKey(ColonyName.PLUTO, 2, 'discard'),
        colonyRepeatStepKey(ColonyName.PLUTO, 3, 'draw'), colonyRepeatStepKey(ColonyName.PLUTO, 3, 'discard'),
      ]);
      expect(keys).deep.eq(['colony:Luna', 'colony:Titan', 'colony:Pluto:1:draw', 'colony:Pluto:1:discard', 'colony:Pluto:2:draw', 'colony:Pluto:2:discard', 'colony:Pluto:3:draw', 'colony:Pluto:3:discard']);
      expect(colonyBonusSteps(p2, parliament, game).map((s) => s.key), 'p2: influence 0 → k = 2, its own tiles').deep.eq(['colony:Titan', 'colony:Miranda']);
      expect(immediateStepsOf(COLONIAL_AFFAIRS, p1, parliament, game).map((s) => s.key), 'the one reader of the two fields').deep.eq(keys);
    });

    it('a player with no cube anywhere has ONE step: the named skip', () => {
      const [game, p1, , parliament] = reduxGame();
      arrangeColonies(game, [[new Luna(), []]]);
      expect(colonyBonusSteps(p1, parliament, game).map((s) => s.key)).deep.eq([NO_COLONIES_STEP_KEY]);
    });
  });

  describe('the enactment', () => {
    it('pays every participant by its OWN influence: the winner\'s k is read AFTER its Agenda step; Luna ×k is ONE record of 2k M€', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1, p2]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the phase's step lands on influence 3 → k = 3
      parliament.agenda.set(p2.id, agendaForInfluence(1)); // k = 2
      // (The pass ends the generation: the production phase pays the TR income BEFORE the sitting — every
      // M€ assertion below reads the record's own before → after, never the raw total.)
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing was asked — the whole sitting ran through').is.undefined;
      const one = outcomesOf(parliament, p1);
      expect(one).has.length(1);
      expect(one[0]).deep.include({step: 'colony:Luna', kind: 'stock', effect: 'colonyBonuses', stock: Resource.MEGACREDITS, amount: 6, influence: 3, multiplier: 3, colony: ColonyName.LUNA, part: 'effect'});
      expect(one[0].after! - one[0].before!).eq(6);
      expect(p1.megaCredits, 'the total the record left behind').eq(one[0].after);
      const two = outcomesOf(parliament, p2)[0];
      expect(two).deep.include({kind: 'stock', amount: 4, influence: 1, multiplier: 2, colony: ColonyName.LUNA});
      expect(two.after! - two.before!).eq(4);
      expect(parliament.lastPhase?.agenda).deep.include({player: p1.id, to: agendaForInfluence(3)});
    });

    it('THE LAW OF MERGING — Titan ×3 is ONE distribution of 3 floaters over two holders; Miranda ×3 is ONE intake of 3 cards', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Titan(), [p1]], [new Miranda(), [p1]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.playedCards.push(new Dirigibles(), new AtmoCollectors());
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      const layout = cast(p1.getWaitingFor(), AndOptions);
      expect(layout.cardResourceDistributionPrompt?.amount, 'one question for the whole k').eq(3);
      expect(layout.cardResourceDistributionPrompt?.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]);
      expect(layout.choiceContext?.source).deep.eq({kind: 'resolution', resolution: COLONIAL_AFFAIRS_ID});
      distribute(p1, layout, {[CardName.DIRIGIBLES]: 2, [CardName.ATMO_COLLECTORS]: 1});
      runAllActions(game);
      expect(p1.tableau.get(CardName.DIRIGIBLES)?.resourceCount).eq(2);
      expect(p1.tableau.get(CardName.ATMO_COLLECTORS)?.resourceCount).eq(1);
      const take = cast(p1.getWaitingFor(), SelectCard);
      expect(take.externalDrawPrompt?.count, 'one intake of k cards').eq(3);
      expect(take.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: COLONIAL_AFFAIRS_ID, effect: 'colonyBonuses'});
      expect(game.projectDeck.drawPile.length).eq(deckBefore - 3);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      const mine = outcomesOf(parliament, p1);
      expect(mine.map((o) => `${o.step}:${o.kind}:${o.amount}`)).deep.eq(['colony:Titan:cardResource:3', 'colony:Miranda:cards:3']);
      expect(mine[0]).deep.include({resource: CardResource.FLOATER, multiplier: 3, colony: ColonyName.TITAN});
      expect(mine[0].cards).deep.eq([{card: CardName.DIRIGIBLES, amount: 2}, {card: CardName.ATMO_COLLECTORS, amount: 1}]);
      expect(mine[1]).deep.include({drawn: 3, multiplier: 3, colony: ColonyName.MIRANDA});
      expect(p1.cardsInHand.length).eq(3);
    });

    it('Titan ×2 with ONE holder is the family\'s ordinary pick — shown and confirmed, never applied behind the board', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Titan(), [p1]]]);
      parliament.agenda.set(p1.id, 0); // the step lands on 1 → k = 2
      p1.playedCards.push(new Dirigibles());
      endGeneration(game);
      const pick = cast(p1.getWaitingFor(), SelectCard);
      expect(pick.resourceGainPrompt?.amount).eq(2);
      expect(p1.tableau.get(CardName.DIRIGIBLES)?.resourceCount, 'nothing applied by the question').eq(0);
      p1.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      runAllActions(game);
      expect(p1.tableau.get(CardName.DIRIGIBLES)?.resourceCount).eq(2);
      settleParliamentGates(game);
      expect(outcomesOf(parliament, p1)[0]).deep.include({kind: 'cardResource', amount: 2, card: CardName.DIRIGIBLES, multiplier: 2});
    });

    it('PLUTO NEVER MERGES: k pairs of «draw 1 → discard 1», and the next card does not leave the deck before the previous discard is answered', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Pluto(), [p1]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // k = 3
      p1.cardsInHand.push(new Tardigrades());
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      const discarded: Array<CardName> = [];
      for (let pair = 1; pair <= 3; pair++) {
        const take = cast(p1.getWaitingFor(), SelectCard);
        expect(take.externalDrawPrompt?.count, `pair ${pair}: one card`).eq(1);
        expect(game.projectDeck.drawPile.length, `pair ${pair}: exactly one more card has left the deck`).eq(deckBefore - pair);
        const [drawn] = takeAll(p1);
        runAllActions(game);
        const discard = cast(p1.getWaitingFor(), SelectCard);
        expect(discard.discardPrompt?.source).deep.eq({kind: 'resolution', resolution: COLONIAL_AFFAIRS_ID});
        expect(discard.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: pair, total: 3});
        expect(discard.discardPrompt?.colonyBonus, 'the colony resolution\'s own marker is NOT set').is.undefined;
        expect(discard.cards.map((c) => c.name), 'the card just drawn is among the candidates').includes(drawn);
        expect(game.projectDeck.drawPile.length, `pair ${pair}: the next card is still in the deck while the discard stands`).eq(deckBefore - pair);
        expect(p1.pendingCardIntakes, 'no second intake is open').is.empty;
        discarded.push(discardFirst(p1));
        runAllActions(game);
      }
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p1.cardsInHand.length, 'one in, one out, three times').eq(1);
      const mine = outcomesOf(parliament, p1);
      expect(mine.map((o) => `${o.step}:${o.kind}:${o.amount}`)).deep.eq([
        'colony:Pluto:1:draw:cards:1', 'colony:Pluto:1:discard:discard:1',
        'colony:Pluto:2:draw:cards:1', 'colony:Pluto:2:discard:discard:1',
        'colony:Pluto:3:draw:cards:1', 'colony:Pluto:3:discard:discard:1',
      ]);
      expect(mine.filter((o) => o.kind === 'discard').map((o) => o.card)).deep.eq(discarded);
      for (const o of mine) {
        expect(o).deep.include({colony: ColonyName.PLUTO, multiplier: 3, influence: 3, effect: 'colonyBonuses'});
        expect(rewardAddressOf(o as never, p1.id as never).skipped, `${o.step} is a payout`).is.undefined;
      }
    });

    it('a reload in the middle of the SECOND Pluto pair rebuilds the same plan and the same question; nothing is paid twice', () => {
      const [game0, p1, , parliament0] = stage();
      arrangeColonies(game0, [[new Luna(), [p1]], [new Pluto(), [p1]]]);
      parliament0.agenda.set(p1.id, agendaForInfluence(3) - 1); // k = 3
      p1.cardsInHand.push(new Tardigrades());
      endGeneration(game0);
      const luna = outcomesOf(parliament0, p1).find((o) => o.step === 'colony:Luna');
      expect(luna?.amount, 'Luna paid before Pluto asks').eq(6);
      const paid = p1.megaCredits;
      takeAll(p1);
      runAllActions(game0);
      discardFirst(p1);
      runAllActions(game0);
      takeAll(p1);
      runAllActions(game0);
      // The second pair's discard stands: reload here.
      const game = reload(game0);
      const parliament = game.parliament!;
      const seat = game.getPlayerById(p1.id) as TestPlayer;
      const plan = immediateStepsOf(COLONIAL_AFFAIRS, seat, parliament, game).map((s) => s.key);
      expect(plan).deep.eq(['colony:Luna', 'colony:Pluto:1:draw', 'colony:Pluto:1:discard', 'colony:Pluto:2:draw', 'colony:Pluto:2:discard', 'colony:Pluto:3:draw', 'colony:Pluto:3:discard']);
      const rebuilt = cast(seat.getWaitingFor(), SelectCard);
      expect(rebuilt.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 3});
      expect(parliament.phase?.effects?.pending).deep.eq({player: p1.id, key: 'colony:Pluto:2:discard'});
      expect(seat.megaCredits, 'Luna is not paid again').eq(paid);
      discardFirst(seat);
      runAllActions(game);
      takeAll(seat);
      runAllActions(game);
      discardFirst(seat);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(seat.megaCredits).eq(paid);
      const mine = outcomesOf(parliament, seat);
      expect(mine.map((o) => o.step)).deep.eq(plan);
      expect(new Set(mine.map((o) => o.step)).size, 'one record per step').eq(mine.length);
    });

    it('the skips name themselves WITH THEIR SIZE: no colonies (×k), no holder (k floaters), an empty deck (k cards)', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Titan(), [p2]], [new Miranda(), [p2]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      parliament.agenda.set(p2.id, agendaForInfluence(4)); // k = 4
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      const one = outcomesOf(parliament, p1);
      expect(one).has.length(1);
      expect(one[0]).deep.include({step: NO_COLONIES_STEP_KEY, kind: 'skipped', reason: 'You have no colonies', amount: 3, multiplier: 3, influence: 3});
      expect(one[0].colony).is.undefined;
      const two = outcomesOf(parliament, p2);
      expect(two.map((o) => `${o.step}:${o.kind}:${o.reason}:${o.amount}`)).deep.eq([
        'colony:Titan:skipped:No card can hold floaters:4',
        'colony:Miranda:skipped:The project deck is empty:4',
      ]);
      expect(two[0]).deep.include({resource: CardResource.FLOATER, multiplier: 4, colony: ColonyName.TITAN});
      expect(two[1]).deep.include({drawn: 0, multiplier: 4, colony: ColonyName.MIRANDA});
      for (const o of [...one, ...two]) {
        expect(rewardAddressOf(o as never, o.player as never).skipped, o.step).eq(o.reason);
      }
    });

    it('Pluto with an EMPTY hand after an empty deck: the discard is a named skip, never a silent no-op', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Pluto(), [p1]]]);
      parliament.agenda.set(p1.id, 0); // k = 2
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomesOf(parliament, p1).map((o) => `${o.step}:${o.kind}:${o.reason ?? ''}`)).deep.eq([
        'colony:Pluto:1:draw:skipped:The project deck is empty', 'colony:Pluto:1:discard:skipped:No cards in hand to discard',
        'colony:Pluto:2:draw:skipped:The project deck is empty', 'colony:Pluto:2:discard:skipped:No cards in hand to discard',
      ]);
    });

    it('a COMMUNITY benefit is paid honestly through its own counter and recorded as the general colony bonus: Titania\'s loss is a NEGATIVE record, Iapetus\' discount a positive one', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Titania(), [p1]], [new Iapetus(), [p1]]]);
      parliament.agenda.set(p1.id, 0); // k = 2
      // The production phase pays the TR income (20) before the sitting: 5 M€ at the enactment — less than
      // 3 × 2, so the loss is capped by what the player has.
      p1.megaCredits = 5 - p1.terraformRating;
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(p1.megaCredits).eq(0);
      expect(p1.colonies.cardDiscount).eq(2);
      const mine = outcomesOf(parliament, p1);
      expect(mine[0]).deep.include({step: 'colony:Titania', kind: 'colonyBonus', stock: Resource.MEGACREDITS, amount: -5, before: 5, after: 0, multiplier: 2, colony: ColonyName.TITANIA, description: 'Lose 3 M€'});
      expect(mine[1]).deep.include({step: 'colony:Iapetus', kind: 'colonyBonus', amount: 2, multiplier: 2, colony: ColonyName.IAPETUS, description: 'Pay 1 M€ less for cards this generation'});
      for (const o of mine) {
        expect(rewardAddressOf(o as never, p1.id as never).skipped, `${o.step} is not a skip`).is.undefined;
        expect(REWARD_ADDRESS[o.kind].reading).eq('colony-ledger');
      }
    });

    it('a player with a cube on EVERY base tile receives every bonus in the table\'s order — a stock wave, a pick, an intake, the pairs', () => {
      const [game, p1, , parliament] = stage();
      const table: Array<[Colony, Array<IPlayer>]> = [[new Ceres(), [p1]], [new Ganymede(), [p1]], [new Luna(), [p1]], [new Enceladus(), [p1]], [new Miranda(), [p1]], [new Pluto(), [p1]]];
      arrangeColonies(game, table);
      parliament.agenda.set(p1.id, 0); // k = 2
      p1.playedCards.push(new Tardigrades());
      endGeneration(game);
      // Ceres, Ganymede, Luna paid at once (stock), then Enceladus asks (one holder → the ordinary pick).
      expect(p1.steel).eq(4);
      expect(p1.plants).eq(2);
      const luna = outcomesOf(parliament, p1).find((o) => o.step === 'colony:Luna');
      expect(luna?.amount).eq(4);
      expect(luna!.after! - luna!.before!).eq(4);
      const pick = cast(p1.getWaitingFor(), SelectCard);
      expect(pick.resourceGainPrompt?.amount).eq(2);
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(cast(p1.getWaitingFor(), SelectCard).externalDrawPrompt?.count, 'Miranda: one intake of 2').eq(2);
      takeAll(p1);
      runAllActions(game);
      for (let pair = 1; pair <= 2; pair++) {
        takeAll(p1);
        runAllActions(game);
        discardFirst(p1);
        runAllActions(game);
      }
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(outcomesOf(parliament, p1).map((o) => o.step)).deep.eq([
        'colony:Ceres', 'colony:Ganymede', 'colony:Luna', 'colony:Enceladus', 'colony:Miranda',
        'colony:Pluto:1:draw', 'colony:Pluto:1:discard', 'colony:Pluto:2:draw', 'colony:Pluto:2:discard',
      ]);
    });

    it('a NEUTRAL winner cancels nothing: every participant is still paid by its own influence', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, COLONIAL);
      parliament.addNeutralVote(parliament.slots[0]);
      arrangeColonies(game, [[new Luna(), [p1, p2]]]);
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      parliament.agenda.set(p2.id, agendaForInfluence(5));
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(outcomesOf(parliament, p1)[0]).deep.include({amount: 6, multiplier: 3, influence: 2}); // k = 3
      expect(outcomesOf(parliament, p2)[0]).deep.include({amount: 8, multiplier: 4, influence: 5}); // k = 4
    });
  });

  describe('the chairman quest, the model and MarsBot', () => {
    it('the payouts never progress the space-tag quest; playing space cards as an own action does', () => {
      const [game, p1, p2, parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1, p2]]]);
      endGeneration(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.quest?.source).eq(COLONIAL_AFFAIRS_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.SPACE}, count: 2});
      expect(parliament.questProgressOf(p1), 'the payout counted nothing').eq(0);
      game.phase = Phase.ACTION;
      const events = game.events;
      for (const card of [new SpaceElevator(), new Satellites()]) {
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

    it('the seat\'s COLONY LEDGER rides the model: every tile with a cube, the printed bonus as a grant, the description — never derived by the client', () => {
      const [game, p1, p2] = reduxGame();
      arrangeColonies(game, [[new Luna(), [p1]], [new Titan(), [p1, p2]], [new Pluto(), [p2]]]);
      const model = getParliamentModel(game, p1)!;
      const one = model.players.find((p) => p.color === p1.color)!;
      expect(one.colonyBonuses).deep.eq([
        {colony: ColonyName.LUNA, grant: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS}, description: 'Gain 2 M€'},
        {colony: ColonyName.TITAN, grant: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.FLOATER}, description: 'Add 1 floater to ANY card'},
      ]);
      const two = model.players.find((p) => p.color === p2.color)!;
      expect(two.colonyBonuses?.map((e) => e.colony)).deep.eq([ColonyName.TITAN, ColonyName.PLUTO]);
      expect(two.colonyBonuses?.[1].grant.benefit).eq(ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE);
    });

    it('MarsBot (mode none) is never asked, never paid, never a winner — its cubes receive nothing', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, COLONIAL);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      arrangeColonies(game, [[new Luna(), [human, bot]]]);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      runAllActions(game);
      const outcomes = parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.some((o) => o.player === bot.id), 'no record for the bot — its cube pays nothing').is.false;
      expect(outcomes.find((o) => o.player === human.id)).deep.include({step: 'colony:Luna', kind: 'stock', amount: 4});
      expect(bot.getWaitingFor()).is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });
  });
});
