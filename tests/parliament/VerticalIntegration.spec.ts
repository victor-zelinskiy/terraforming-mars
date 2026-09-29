import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  VERTICAL_INTEGRATION, VERTICAL_INTEGRATION_CODE, VERTICAL_INTEGRATION_ID, VERTICAL_INTEGRATION_MEGACREDITS,
  VERTICAL_INTEGRATION_NO_CARDS_REASON,
} from '../../src/server/parliament/resolutions/industrialists/VerticalIntegration';
import {RD_FUNDING} from '../../src/server/parliament/resolutions/scientists/RdFunding';
import {ARCHITECTURE_AWARD_PRODUCTION} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {SCIENTISTS_BUDGET_MEGACREDITS} from '../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {resolutionCount, resolutionCountUnitsOf} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {cardCountVerdict, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Tycoon} from '../../src/server/milestones/Tycoon';
import {Celebrity} from '../../src/server/awards/Celebrity';
import {AICentral} from '../../src/server/cards/base/AICentral';
import {DevelopmentCenter} from '../../src/server/cards/base/DevelopmentCenter';
import {MediaGroup} from '../../src/server/cards/base/MediaGroup';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {SelfReplicatingRobots} from '../../src/server/cards/promo/SelfReplicatingRobots';
import {Mine} from '../../src/server/cards/base/Mine';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {ImportedHydrogen} from '../../src/server/cards/base/ImportedHydrogen';
import {Thorgate} from '../../src/server/cards/corporation/Thorgate';
import {PowerGeneration} from '../../src/server/cards/prelude/PowerGeneration';
import {Apollo} from '../../src/server/cards/ceos/Apollo';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {Odyssey} from '../../src/server/cards/pathfinders/Odyssey';

/**
 * VERTICAL INTEGRATION (Turmoil Redux, RX32) — the SMALLEST card of the
 * family: «Gain 1 M€ for each blue project card you have in play +
 * Influence.» The formula is Scientists Budget's (RX27) without the levy and
 * the draw; the chairman quest is R&D Funding's (RX26) own object and key.
 *
 * What these specs pin is therefore the ONE new thing and the joints around
 * it: a count that asks the card's TYPE (`CardType.ACTIVE`, and nothing
 * else), «in play» as the shared tableau walk defines it, one card = one
 * unit, the sum B + I with no cap, the named zero — and, deliberately, that
 * the engine's own «blue» counters (Tycoon, Celebrity — both `ACTIVE ||
 * AUTOMATED`, blue AND green) are NOT this rule, and that the two sibling
 * counts of the family still answer their own questions over the same table.
 */
const LAW = resolutionInstanceId(VERTICAL_INTEGRATION_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Vertical Integration in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, LAW);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'megacredits');
}

/** `n` real BLUE project cards. */
function blueCards(n: number): Array<ICard> {
  return [new AICentral(), new DevelopmentCenter(), new MediaGroup(), new SearchForLife()].slice(0, n);
}

describe('VerticalIntegration', () => {
  describe('the catalog entry', () => {
    it('is RX32 of the Industrialists, dealt as ONE card, with no levy, no cap and no winner part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(VERTICAL_INTEGRATION_ID)).eq(VERTICAL_INTEGRATION);
      expect(VERTICAL_INTEGRATION_CODE).eq('RX32');
      expect(VERTICAL_INTEGRATION_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX32')).eq(VERTICAL_INTEGRATION);
      expect(VERTICAL_INTEGRATION.party).eq(PartyName.INDUSTRIALISTS);
      expect(VERTICAL_INTEGRATION.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(VERTICAL_INTEGRATION.levy, 'nothing is paid for it').is.undefined;
      expect(VERTICAL_INTEGRATION.winnerSteps, 'no winner-only part').is.undefined;
      expect(VERTICAL_INTEGRATION.winnerReward).is.undefined;
      expect(VERTICAL_INTEGRATION.passive).is.undefined;
      expect(VERTICAL_INTEGRATION.action).is.undefined;
      expect(VERTICAL_INTEGRATION.scaled).deep.eq([VERTICAL_INTEGRATION_MEGACREDITS]);
      expect(VERTICAL_INTEGRATION_MEGACREDITS.cap, 'no «max» is printed').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === LAW)).has.length(1);
    });

    it('THE FORMULA IS RX27\'s, TERM FOR TERM — only the count id differs: 1 M€ per counted thing + 1 per influence', () => {
      const {count, ...rest} = VERTICAL_INTEGRATION_MEGACREDITS;
      const {count: budgetCount, ...budgetRest} = SCIENTISTS_BUDGET_MEGACREDITS;
      expect(rest, 'unit, rate, recipient and the absent cap are one declaration').deep.eq(budgetRest);
      expect(count).deep.eq({id: 'blueCards', per: 1});
      expect(budgetCount).deep.eq({id: 'scienceTags', per: 1});
      // The terms ADD; nothing multiplies; a zero of either side still pays the other.
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 2, 2], [3, 1, 4], [2, 2, 4], [5, 0, 5], [4, 3, 7]];
      for (const [b, i, expected] of cases) {
        expect(scaledAmount(VERTICAL_INTEGRATION_MEGACREDITS, i, b), `B=${b} I=${i}`).eq(expected);
      }
    });

    it('THE QUEST IS RX26\'s OWN OBJECT AND KEY — «play 2 blue cards», declared by TYPE, never a second key', () => {
      expect(VERTICAL_INTEGRATION.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2});
      expect(VERTICAL_INTEGRATION.quest).deep.eq(RD_FUNDING.quest);
      expect(VERTICAL_INTEGRATION.text.quest).eq(RD_FUNDING.text.quest).and.eq('Play 2 blue cards');
    });

    it('the count is of the CARDS kind — one card, one unit; a card has no second blueness to weigh', () => {
      expect(resolutionCountKind('blueCards')).deep.eq({kind: 'cards'});
      const [, p1] = reduxGame();
      p1.playedCards.push(new AICentral(), new DevelopmentCenter());
      const counted = resolutionCount(p1, 'blueCards');
      expect(counted.count).eq(2);
      expect(counted.units, 'no per-card column on a card count').is.undefined;
      expect(counted.byTag).is.undefined;
      expect(counted.spaces).is.undefined;
      expect(counted.cards).deep.eq([CardName.AI_CENTRAL, CardName.DEVELOPMENT_CENTER]);
    });
  });

  describe('which cards count (B) — the TYPE is the whole question', () => {
    it('a blue card counts whatever it prints; a GREEN card, an EVENT, a CORPORATION, a PRELUDE and a CEO do not', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(
        new AICentral(), // ACTIVE, science + building → counts
        new MediaGroup(), // ACTIVE, an Earth tag and no building → counts all the same
        new Mine(), // AUTOMATED (green) → no
        new ImportedHydrogen(), // EVENT → no
        new Thorgate(), // CORPORATION → no
        new PowerGeneration(), // PRELUDE → no
        new Apollo(), // CEO → no
      );
      const counted = resolutionCount(p1, 'blueCards');
      expect(counted.count).eq(2);
      expect(counted.cards).deep.eq([CardName.AI_CENTRAL, CardName.MEDIA_GROUP]);
    });

    it('each refusal NAMES itself — and the one that counts asks nothing else (no tag, no VP icon, no cost)', () => {
      const ctx = {eventTagsInPlay: false};
      const verdict = (card: ICard) => cardCountVerdict('blueCards', card, ctx);
      expect(verdict(new AICentral())).deep.eq({counts: true});
      for (const card of [new Mine(), new ImportedHydrogen(), new Thorgate(), new PowerGeneration(), new Apollo()]) {
        expect(verdict(card), card.name).deep.eq({counts: false, reason: 'Not a blue card'});
      }
      // A made-up blue card with no tags, no VP and no cost still counts: the type IS the rule.
      expect(verdict(fakeCard({name: 'Bare Blue' as CardName, type: CardType.ACTIVE, tags: []}))).deep.eq({counts: true});
      // …and a made-up GREEN card printing every tag and a fat VP icon does not.
      expect(verdict(fakeCard({
        name: 'Rich Green' as CardName, type: CardType.AUTOMATED, tags: [Tag.BUILDING, Tag.SCIENCE], victoryPoints: 5,
      }))).deep.eq({counts: false, reason: 'Not a blue card'});
    });

    it('the tag-activity rule is NOT asked: a played EVENT is out by its type, with Odyssey in play or not', () => {
      const [, p1] = reduxGame();
      const blueEvent = fakeCard({name: 'Blue Flash' as CardName, type: CardType.EVENT, tags: [Tag.EVENT]});
      p1.playedCards.push(new ImportedHydrogen(), blueEvent, new AICentral());
      expect(resolutionCount(p1, 'blueCards').cards).deep.eq([CardName.AI_CENTRAL]);
      p1.playedCards.push(new Odyssey());
      expect(p1.tags.eventTagsInPlay(), 'Odyssey keeps events face up').is.true;
      expect(resolutionCount(p1, 'blueCards').cards, 'a face-up event is still not a blue card').deep.eq([CardName.AI_CENTRAL]);
    });

    it('only the player\'s OWN cards IN PLAY: not the hand, not a rival\'s tableau, not a card hosted under Self-Replicating Robots', () => {
      const [, p1, p2] = reduxGame();
      p1.cardsInHand.push(new DevelopmentCenter());
      p2.playedCards.push(new AICentral(), new MediaGroup());
      const robots = new SelfReplicatingRobots();
      // A blue card HOSTED by the robots is not in the tableau at all — only the robots themselves are.
      robots.targetCards.push(new DevelopmentCenter() as IProjectCard);
      p1.playedCards.push(robots);
      const mine = resolutionCount(p1, 'blueCards');
      expect(mine.count, 'the robots alone — the hand and the hosted card are outside the tableau').eq(1);
      expect(mine.cards).deep.eq([CardName.SELF_REPLICATING_ROBOTS]);
      expect(resolutionCount(p2, 'blueCards').count, 'the rival counts their own two').eq(2);
    });

    it('a disabled Pharmacy Union is out of play — for this count as for every other', () => {
      const [, p1] = reduxGame();
      const union = new PharmacyUnion();
      union.isDisabled = true;
      p1.playedCards.push(union, new AICentral());
      expect(resolutionCount(p1, 'blueCards').cards).deep.eq([CardName.AI_CENTRAL]);
      expect(resolutionCountUnitsOf(p1, 'blueCards', union), 'the disabled card contributes nothing').eq(0);
      union.isDisabled = false;
      expect(resolutionCount(p1, 'blueCards').cards, 'an enabled Pharmacy Union is a corporation, still not blue').deep.eq([CardName.AI_CENTRAL]);
    });

    it('⚠ THE ENGINE\'S «BLUE» COUNTERS ARE NOT THIS RULE: Tycoon and Celebrity count blue AND green', () => {
      const [, p1] = reduxGame();
      // Two blue (AI Central 21 M€, Media Group 6) and two green (Artificial Lake 15, Mine 4).
      p1.playedCards.push(new AICentral(), new MediaGroup(), new ArtificialLake(), new Mine());
      expect(resolutionCount(p1, 'blueCards').count, 'the law counts the BLUE ones').eq(2);
      expect(new Tycoon().getScore(p1), 'the milestone counts blue AND green').eq(4);
      expect(new Celebrity().getScore(p1), 'the award counts blue AND green above 20 M€ — AI Central alone').eq(1);
      // Three different numbers over ONE tableau: borrowing either counter would be silent, not broken.
      expect(new Tycoon().getScore(p1)).not.eq(resolutionCount(p1, 'blueCards').count);
      expect(new Celebrity().getScore(p1)).not.eq(resolutionCount(p1, 'blueCards').count);
    });

    it('the two sibling counts of the family answer their own questions over the SAME tableau — nothing moved', () => {
      const [, p1] = reduxGame();
      // Artificial Lake: green, building, +1 VP → RX02's alone. AI Central: BLUE, science + building, +1 VP →
      // all three. Media Group: blue, Earth, no VP → RX32's alone. Mine: green, building, no VP → nobody's.
      p1.playedCards.push(new ArtificialLake(), new AICentral(), new MediaGroup(), new Mine());
      expect(resolutionCount(p1, 'blueCards').cards, 'RX32 — by type').deep.eq([CardName.AI_CENTRAL, CardName.MEDIA_GROUP]);
      expect(resolutionCount(p1, 'buildingCardsWithNonNegativeVp').cards, 'RX02 is unchanged — by tag and VP icon')
        .deep.eq([CardName.ARTIFICIAL_LAKE, CardName.AI_CENTRAL]);
      expect(resolutionCount(p1, 'scienceTags').count, 'RX27 is unchanged — by tag').eq(1);
      expect(scaledAmount(ARCHITECTURE_AWARD_PRODUCTION, 2, resolutionCount(p1, 'buildingCardsWithNonNegativeVp').count)).eq(4);
      expect(scaledAmount(SCIENTISTS_BUDGET_MEGACREDITS, 2, resolutionCount(p1, 'scienceTags').count)).eq(3);
      expect(scaledAmount(VERTICAL_INTEGRATION_MEGACREDITS, 2, resolutionCount(p1, 'blueCards').count)).eq(4);
    });
  });

  describe('the enactment', () => {
    it('pays EVERY participant B + I into the supply — the brief\'s two examples, seat by seat', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 wins with one delegate (no party effect); p2 never voted and sits at influence 1.
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's own step lands on influence 2
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      p2.playedCards.push(...blueCards(3));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(LAW);
      // p2: 3 blue cards and influence 1 → +4 M€ (the brief's second example), read off the record's own edges.
      const paid2 = outcomeOf(parliament, p2)!;
      expect(paid2).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 4, count: 3, influence: 1});
      expect(paid2.counted).deep.eq([CardName.AI_CENTRAL, CardName.DEVELOPMENT_CENTER, CardName.MEDIA_GROUP]);
      expect(paid2.countedUnits, 'no per-card column on a card count').is.undefined;
      expect(paid2.after! - paid2.before!).eq(4);
      expect(p2.megaCredits).eq(paid2.after);
      // p1: no blue card at all — the influence pays on its own, after the Agenda step the win takes first.
      const paid1 = outcomeOf(parliament, p1)!;
      expect(paid1).deep.include({kind: 'stock', amount: 2, count: 0, influence: 2});
      expect(paid1.counted).deep.eq([]);
      expect(p1.megaCredits).eq(paid1.after);
    });

    it('0 blue cards and influence 2 pay +2 M€ — the influence term stands on its own', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      const paid = outcomeOf(parliament, p2)!;
      expect(paid).deep.include({kind: 'stock', amount: 2, count: 0, influence: 2});
      expect(paid.counted).deep.eq([]);
      expect(paid.after! - paid.before!, 'the supply moved by exactly the influence').eq(2);
      expect(p2.megaCredits).eq(paid.after);
      expect(outcomeOf(parliament, p1)?.count, 'and the winner counts their own zero').eq(0);
    });

    it('influence comes from the ledger AFTER the winner\'s Agenda step, and a neutral winner cancels nothing', () => {
      const [game, p1, p2, parliament] = stage();
      // p2 never voted and is a participant all the same: influence 3, one blue card.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands exactly on influence 3
      const agendaBefore = parliament.agendaOf(p1);
      p2.playedCards.push(...blueCards(1));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.agendaOf(p1), 'the winner took their step BEFORE the effect').eq(agendaBefore + 1);
      expect(outcomeOf(parliament, p1)?.influence, 'read AFTER that step').eq(3);
      const paid2 = outcomeOf(parliament, p2)!;
      expect(paid2, '1 blue card + influence 3').deep.include({amount: 4, count: 1, influence: 3});
      expect(paid2.after! - paid2.before!).eq(4);
    });

    it('a payout of nothing NAMES itself: no blue card and no influence — one skipped record, no M€ moved', () => {
      const [game, , p2, parliament] = stage();
      parliament.agenda.set(p2.id, 0);
      endGenerationThroughParliament(game);
      const cash = p2.megaCredits; // after the production phase, before the effects run
      settleParliamentGates(game);
      const outcome = outcomeOf(parliament, p2)!;
      expect(outcome.kind).eq('skipped');
      expect(outcome.reason).eq(VERTICAL_INTEGRATION_NO_CARDS_REASON).and.eq('No blue cards and no influence');
      expect(outcome).deep.include({amount: 0, count: 0, influence: 0});
      expect(outcome.before, 'nothing moved, so there are no edges to state').is.undefined;
      expect(p2.megaCredits, 'the supply is untouched').eq(cash);
      expect(parliament.lastPhase?.outcomes?.filter((o) => o.player === p2.id), 'exactly one record for the one step').has.length(1);
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source', () => {
      const [game, , p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p2.playedCards.push(...blueCards(2));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      const lines = game.gameLog.filter((entry) =>
        entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} blue card(s) + ${4} influence'));
      expect(lines, 'ONE line per paid seat — never one per counted card').has.length(2);
      const mine = lines.filter((entry) => entry.data.some((d) => d.type === LogMessageDataType.PLAYER && d.value === p2.color));
      expect(mine).has.length(1);
      const data = mine[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(VERTICAL_INTEGRATION_ID);
      // amount 4 = 2 blue cards + influence 2, then the count and the influence, then the supply's edges.
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value).slice(0, 3)).deep.eq(['4', '2', '2']);
      const gain = game.events.events.filter((e) =>
        e.type === 'resource-changed' && e.player === p2.color &&
        e.source?.kind === 'resolution' && e.source.id === VERTICAL_INTEGRATION_ID);
      expect(gain, 'ONE standard gain, recorded under the resolution as its source').has.length(1);
      expect(gain[0].impact?.stock?.megacredits).eq(4);
      expect(gain[0].impact?.snapshot?.after! - gain[0].impact?.snapshot?.before!, 'the supply moved by the payout, over the production phase’s income').eq(4);
    });
  });

  describe('once per enactment', () => {
    it('a later blue card never recomputes what was paid, and a reload pays nothing again', () => {
      const [game, , p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      p2.playedCards.push(...blueCards(2));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      const paid = p2.megaCredits;
      expect(outcomeOf(parliament, p2)).deep.include({amount: 3, count: 2, influence: 1});
      expect(outcomeOf(parliament, p2)?.after).eq(paid);
      p2.playedCards.push(new MediaGroup(), new SearchForLife());
      expect(p2.megaCredits, 'a growing tableau changes nothing').eq(paid);
      const live = reload(game);
      const seat = live.getPlayerById(p2.id) as TestPlayer;
      expect(seat.megaCredits).eq(paid);
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p2.id && o.step === 'megacredits'))
        .deep.include({amount: 3, count: 2});
    });
  });

  describe('the chairman quest — play 2 blue cards', () => {
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

    it('counts BLUE cards played after the enactment — a green card and a card already in play count nothing', () => {
      const [game, p1, , parliament] = stage();
      endGenerationThroughParliament(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(VERTICAL_INTEGRATION_ID);
      p1.playedCards.push(new AICentral());
      expect(parliament.questProgressOf(p1), 'no retroactive progress').eq(0);
      playAsAction(p1, new Mine());
      expect(parliament.questProgressOf(p1), 'a green card is not a blue one').eq(0);
      playAsAction(p1, new DevelopmentCenter());
      expect(parliament.questProgressOf(p1)).eq(1);
      playAsAction(p1, new MediaGroup());
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, LAW);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(...blueCards(2));
      bot.playedCards.push(...blueCards(3));
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
      const paid = parliament.lastPhase!.outcomes![0];
      expect(paid, '2 blue cards + the winner\'s influence 1').deep.include({kind: 'stock', amount: 3, count: 2, influence: 1});
      expect(human.megaCredits).eq(paid.after);
      // The bot's own production phase moves its supply; THIS card never does.
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'),
        'nothing reached the bot under the resolution').is.empty;
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts,
        'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number + the cards that made it) rides the model, and the outcome reaches the client', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new AICentral(), new Mine(), new MediaGroup());
      const model = getParliamentModel(game, p2);
      const countOfSeat = (color: typeof p1.color) =>
        model?.players.find((p) => p.color === color)?.counts?.find((c) => c.id === 'blueCards');
      expect(countOfSeat(p1.color)).deep.eq({id: 'blueCards', count: 2, cards: [CardName.AI_CENTRAL, CardName.MEDIA_GROUP]});
      expect(countOfSeat(p2.color)).deep.eq({id: 'blueCards', count: 0, cards: []});
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.find((o) => o.player === p1.color))
        .deep.include({kind: 'stock', stock: Resource.MEGACREDITS, amount: 3, count: 2, influence: 1});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
