import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  CLIMATE_RESEARCH, CLIMATE_RESEARCH_CODE, CLIMATE_RESEARCH_DRAW, CLIMATE_RESEARCH_HEAT,
  CLIMATE_RESEARCH_HEAT_PER_CARD, CLIMATE_RESEARCH_ID,
} from '../../src/server/parliament/resolutions/greens/ClimateResearch';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {BIODOME_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, answerGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN, STARTER_QUEST} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, sequelAmount} from '../../src/common/parliament/influenceScaling';
import {partyReactionAmount, productionReactionOf} from '../../src/common/parliament/partyReactions';
import {PARTY_EFFECTS} from '../../src/server/parliament/parties/PartyEffects';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ExternalDrawIntake} from '../../src/server/deferredActions/ExternalDrawIntake';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {IPlayer} from '../../src/server/IPlayer';

/**
 * CLIMATE RESEARCH (Turmoil Redux, RX05) — the first SEQUENTIAL resolution:
 * part two reads what part one left behind.
 *
 * What these specs pin: +1 heat production per point of influence for every
 * participant with NO cap and no winner-only part; then 1 card per FULL 3
 * steps of the WHOLE heat production after the raise (floor division, the
 * remainder yields nothing, nothing is spent); influence 0 never cancels part
 * two; the ruling Greens answer the raise ONCE with M€ PRODUCTION, through
 * their own hook and under their own source; the cards come from the project
 * deck as a mandatory intake the political phase waits for; and the chairman
 * quest counts the player's OWN raises, never this card's.
 */
const CLIMATE = resolutionInstanceId(CLIMATE_RESEARCH_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Climate Research in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, CLIMATE);
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

function outcomeOf(parliament: Parliament, player: TestPlayer, step: 'heat-production' | 'draw') {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes?.find((o) => o.player === player.id && o.step === step);
}

/** The live mandatory take of `player`, if that is what it is waiting for. */
function takePrompt(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectCard && (wf as SelectCard<IProjectCard>).externalDrawPrompt !== undefined ?
    wf as SelectCard<IProjectCard> : undefined;
}

/** Answer the whole take in one press (what «B забрать все» sends). */
function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

/** …when there is one (a zero draw asks nothing at all). */
function takeAllIfAsked(player: IPlayer): Array<CardName> {
  return takePrompt(player) === undefined ? [] : takeAll(player);
}

/** Supply (resource) changes of `player` recorded under a source of `kind` — the honesty probe. */
function stockEventsFrom(game: IGame, player: IPlayer, kind: string) {
  return game.events.events.filter((e) => e.type === 'resource-changed' && e.player === player.color && e.source?.kind === kind);
}

describe('ClimateResearch', () => {
  describe('the catalog entry', () => {
    it('is RX05 of the Greens — their THIRD real resolution, dealt as ONE card', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(CLIMATE_RESEARCH_ID)).eq(CLIMATE_RESEARCH);
      expect(CLIMATE_RESEARCH_CODE).eq('RX05');
      expect(CLIMATE_RESEARCH_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX05')).eq(CLIMATE_RESEARCH);
      // The four before it keep their codes — a code is assigned by hand.
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX01')?.id).eq(AQUIFER_CONTEST_ID);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX03')?.id).eq(BIODOME_CONTEST_ID);
      expect(CLIMATE_RESEARCH.party).eq(PartyName.GREENS);
      expect(CLIMATE_RESEARCH.winnerSteps, 'no winner-only part').is.undefined;
      expect(CLIMATE_RESEARCH.winnerReward, 'no winner tile either').is.undefined;
      // The deck is the sum of what is shipped, DERIVED from the catalog rather than listed here: every new
      // Greens resolution would otherwise have to edit this card's own spec to say «and that one too».
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      const greens = dealt.filter((instance) => REDUX_RESOLUTION_CATALOG.ofInstance(instance).party === PartyName.GREENS);
      const shippedGreens = REDUX_RESOLUTION_CATALOG.all()
        .filter((definition) => definition.party === PartyName.GREENS)
        .flatMap((definition) => Array.from({length: definition.copies}, (_v, copy) => resolutionInstanceId(definition.id, copy)));
      expect(greens.sort()).deep.eq(shippedGreens.sort());
      expect(greens, 'Aquifer Contest, Biodome Contest and this one at the very least').includes(CLIMATE)
        .and.includes(resolutionInstanceId(AQUIFER_CONTEST_ID, 0))
        .and.includes(resolutionInstanceId(BIODOME_CONTEST_ID, 0));
      expect(dealt.filter((i) => i === CLIMATE), 'one physical copy').has.length(1);
    });

    it('declares TWO scaled parts: influence → heat production, then heat production → cards', () => {
      expect(CLIMATE_RESEARCH.scaled).deep.eq([CLIMATE_RESEARCH_HEAT, CLIMATE_RESEARCH_DRAW]);
      expect(CLIMATE_RESEARCH_HEAT).deep.eq({
        id: 'heatProduction', unit: {kind: 'production', resource: Resource.HEAT}, perInfluence: 1, recipient: 'each',
      });
      expect(CLIMATE_RESEARCH_HEAT.cap, 'no «max 5» on this card').is.undefined;
      expect(CLIMATE_RESEARCH_DRAW.unit).deep.eq({kind: 'cards'});
      expect(CLIMATE_RESEARCH_DRAW.perInfluence, 'influence never enters the second half twice').eq(0);
      expect(CLIMATE_RESEARCH_DRAW.sequel).deep.eq({
        after: 'heatProduction', total: {kind: 'production', resource: Resource.HEAT}, per: 3,
      });
      expect(CLIMATE_RESEARCH_DRAW.cap).is.undefined;
      expect(CLIMATE_RESEARCH_HEAT_PER_CARD).eq(3);
    });

    it('its chairman quest is the production goal the starter quest already uses — one mechanism, one sentence', () => {
      expect(CLIMATE_RESEARCH.quest).deep.eq({goal: {kind: 'production', resource: Resource.HEAT}, count: 3});
      expect(CLIMATE_RESEARCH.quest).deep.eq(STARTER_QUEST);
      expect(CLIMATE_RESEARCH.text.quest).eq('Raise your heat production 3 steps');
    });

    it('the shared formula — every control example of the brief', () => {
      // heat production before | influence | after | cards
      const cases: Array<[number, number, number, number]> = [
        [0, 0, 0, 0], [1, 1, 2, 0], [3, 0, 3, 1], [6, 0, 6, 2],
        [2, 1, 3, 1], [4, 2, 6, 2], [7, 2, 9, 3], [0, 6, 6, 2],
      ];
      for (const [before, influence, after, cards] of cases) {
        const steps = scaledAmount(CLIMATE_RESEARCH_HEAT, influence);
        expect(steps, `influence ${influence} → steps`).eq(influence);
        expect(before + steps, `${before} + ${influence}`).eq(after);
        expect(sequelAmount(CLIMATE_RESEARCH_DRAW, after), `production ${after} → cards`).eq(cards);
      }
      // No cap anywhere: influence 6 pays 6 steps, production 30 draws 10.
      expect(scaledAmount(CLIMATE_RESEARCH_HEAT, 6)).eq(6);
      expect(sequelAmount(CLIMATE_RESEARCH_DRAW, 30)).eq(10);
      // The remainder yields nothing and a negative production draws nothing.
      expect(sequelAmount(CLIMATE_RESEARCH_DRAW, 8)).eq(2);
      expect(sequelAmount(CLIMATE_RESEARCH_DRAW, -4)).eq(0);
    });
  });

  describe('part one — the heat production', () => {
    it('raises EVERY participant\'s heat production by THEIR influence — voters or not, no cap', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner) — Agenda 0 → step 1 in the phase = influence 1.
      // p2 never voted — influence 2 by its own track.
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.production.override({heat: 4});
      p2.production.override({heat: 0});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(parliament.enacted).eq(CLIMATE);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(p1.production.heat, '4 + influence 1').eq(5);
      expect(p2.production.heat, '0 + influence 2').eq(2);
      expect(outcomeOf(parliament, p1, 'heat-production')).deep.include({
        kind: 'production', effect: 'heatProduction', production: Resource.HEAT, amount: 1, influence: 1, before: 4, after: 5,
      });
      expect(outcomeOf(parliament, p2, 'heat-production')).deep.include({amount: 2, influence: 2, before: 0, after: 2});
    });

    it('influence comes from the Redux ledger AFTER the winner\'s Agenda step — never the delegates on the card', () => {
      const [game, p1, , parliament] = stage();
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.agenda.set(p1.id, 2); // influence 1 now; the phase's step lands on 3 = influence 2
      expect(parliament.influence(p1)).eq(1);
      p1.production.override({heat: 0});
      endGeneration(game);
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(outcomeOf(parliament, p1, 'heat-production')).deep.include({influence: 2, amount: 2, before: 0, after: 2});
    });

    it('influence 0 is NAMED and skipped — and never cancels part two', () => {
      const [game, p1, p2, parliament] = stage();
      // p2 never voted (influence 0) but already produces 6 heat.
      p2.production.override({heat: 6});
      p1.production.override({heat: 0});
      endGeneration(game);
      runAllActions(game);
      const take = takePrompt(p2);
      expect(take, 'part two ran on its own').is.not.undefined;
      expect(take?.cards).has.length(2);
      expect(p2.production.heat, 'no raise at influence 0').eq(6);
      expect(outcomeOf(parliament, p2, 'heat-production')).deep.include({
        kind: 'skipped', reason: 'No influence', amount: 0, influence: 0, before: 6, after: 6,
      });
      expect(game.gameLog.some((e) => e.message.includes('has no influence — no ${1} production'))).is.true;
    });

    it('a negative heat production rises the ordinary way', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      p1.production.override({heat: -3});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.heat).eq(-1);
      expect(outcomeOf(parliament, p1, 'heat-production')).deep.include({before: -3, after: -1, amount: 2});
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'skipped', amount: 0});
    });

    it('a neutral winner cancels nothing: every participant is still paid', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, CLIMATE);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      p1.production.override({heat: 2});
      p2.production.override({heat: 0});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(CLIMATE);
      expect(p1.production.heat, 'influence 1, no Agenda step for a neutral winner').eq(3);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({amount: 1, drawn: 1});
      expect(outcomeOf(parliament, p2, 'heat-production')).deep.include({kind: 'skipped', influence: 0});
    });

    it('the journal carries the whole calculation with the resolution as its source; the recorder sees the production change', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1);
      p1.production.override({heat: 4});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      const line = game.gameLog.filter((e) => e.message.startsWith('${0} raised ${1} production by ${2} from ${3}'));
      expect(line).has.length(1);
      expect(line[0].data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(CLIMATE_RESEARCH_ID);
      expect(line[0].data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['2', '2', '4', '6']);
      const deltas = game.events.events.filter((e) => e.type === 'production-changed' && e.player === p1.color);
      const mine = deltas.filter((e) => e.source?.kind === 'resolution' && e.source.id === CLIMATE_RESEARCH_ID);
      expect(mine).has.length(1);
      expect(mine[0].impact?.production?.heat).eq(2);
      expect(mine[0].impact?.snapshot).deep.include({before: 4, after: 6});
    });
  });

  describe('the Greens\' reaction', () => {
    it('is the PARTY\'s rule, not this card\'s: M€ PRODUCTION up by the steps actually gained, under the Greens\' own source', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2 after the winner's step
      p1.production.override({heat: 4, megacredits: 1});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(p1.production.heat).eq(6);
      expect(p1.production.megacredits, '+2 M€ PRODUCTION, one per heat step').eq(3);
      // PRODUCTION, never cash: the Greens' answer to a production step adds no
      // M€ to the supply (their OTHER rule — 2 M€ per TR — did not fire here).
      expect(stockEventsFrom(game, p1, 'party'), 'no cash from the party').is.empty;
      // TWO production events, each under its OWN source — the resolution
      // raised the heat, the Greens answered with the M€.
      const deltas = game.events.events.filter((e) => e.type === 'production-changed' && e.player === p1.color);
      const fromGreens = deltas.filter((e) => e.source?.kind === 'party' && e.source.name === PartyName.GREENS);
      expect(fromGreens, 'exactly once — a player who already held the effect is not paid twice').has.length(1);
      expect(fromGreens[0].impact?.production?.megacredits).eq(2);
      // Nothing about the reaction is written into the resolution itself.
      const fromResolution = deltas.filter((e) => e.source?.kind === 'resolution');
      expect(fromResolution).has.length(1);
      expect(fromResolution[0].impact?.production?.megacredits ?? 0).eq(0);
    });

    it('pays a player who did NOT hold the Greens before — the enactment makes them the ruling party first', () => {
      const [game, p1, p2, parliament] = reduxGame();
      // Another party rules going in (Architecture Award is the Mars First card).
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(parliament.hasPartyEffect(p2, PartyName.GREENS), 'no access before').is.false;
      seatResolution(parliament, 0, CLIMATE);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p2.production.override({heat: 0, megacredits: 0});
      endGeneration(game);
      takeAllIfAsked(p1);
      takeAllIfAsked(p2);
      runAllActions(game);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      expect(p2.production.heat).eq(2);
      expect(p2.production.megacredits).eq(2);
    });

    it('a zero raise pays no M€ production — and the reaction never reads the production the player already had', () => {
      const [game, , p2, parliament] = stage();
      p2.production.override({heat: 9, megacredits: 0}); // influence 0, already 9 heat production
      endGeneration(game);
      takeAll(p2);
      runAllActions(game);
      expect(p2.production.heat).eq(9);
      expect(p2.production.megacredits, 'the reaction answers the STEPS, not the total').eq(0);
      settleParliamentGates(game);
      expect(parliament.lastPhase, 'the phase completed').is.not.undefined;
    });

    it('the reaction is DECLARED beside the hook, so a forecast reads the same rule the payout runs', () => {
      const greens = PARTY_EFFECTS[PartyName.GREENS];
      const reaction = productionReactionOf(greens.reactions, Resource.HEAT);
      expect(reaction).is.not.undefined;
      expect(reaction?.gain).deep.eq({kind: 'production', resource: Resource.MEGACREDITS});
      expect(partyReactionAmount(reaction!, 2)).eq(2);
      expect(productionReactionOf(greens.reactions, Resource.PLANTS), 'plants trigger it too').is.not.undefined;
      expect(productionReactionOf(greens.reactions, Resource.STEEL), 'steel does not').is.undefined;
      expect(productionReactionOf(PARTY_EFFECTS[PartyName.REDS].reactions, Resource.HEAT)).is.undefined;
    });
  });

  describe('part two — the draw', () => {
    it('counts the WHOLE heat production after the raise, floors it, and hands the cards over as a mandatory take', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2 after the winner's step
      p1.production.override({heat: 7});
      const handBefore = p1.cardsInHand.length;
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      expect(p1.production.heat, '7 + 2').eq(9);
      const ask = takePrompt(p1);
      expect(ask, 'the phase asks the recipient to take them').is.not.undefined;
      expect(ask?.cards, '9 / 3 = 3 cards').has.length(3);
      expect(ask?.externalDrawPrompt).deep.include({count: 3, remaining: 3});
      expect(ask?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: CLIMATE_RESEARCH_ID, effect: 'draw'});
      expect(ask?.choiceContext?.source).deep.eq({kind: 'resolution', resolution: CLIMATE_RESEARCH_ID});
      expect(ask?.choiceContext?.mode).eq('reward');
      // THE CARDS CAME FROM THE PROJECT DECK and are withheld from the hand
      // until taken — no hand projection can see them early.
      expect(game.projectDeck.drawPile.length).eq(deckBefore - 3);
      expect(p1.cardsInHand.length).eq(handBefore);
      expect(p1.pendingCardIntakes).has.length(1);
      const taken = takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand.map((c) => c.name)).includes.members(taken);
      expect(p1.pendingCardIntakes, 'the intake is closed').is.empty;
      expect(p1.playedCards.asArray(), 'taking a card is not playing it').is.empty;
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({
        kind: 'cards', effect: 'draw', amount: 3, drawn: 3, influence: 2,
      });
      expect(outcomeOf(parliament, p1, 'draw')?.total).deep.eq({before: 7, after: 9});
      settleParliamentGates(game);
      expect(parliament.lastPhase, 'the political phase finished only after the take').is.not.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('the remainder yields nothing: production 8 draws 2, production 2 draws none and asks nothing', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1);
      p1.production.override({heat: 6}); // 6 + 2 = 8 → 2 cards
      p2.production.override({heat: 2}); // influence 0 → 2 → 0 cards
      endGeneration(game);
      expect(takePrompt(p1)?.cards).has.length(2);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2), 'no empty take step').is.undefined;
      expect(p2.pendingCardIntakes).is.empty;
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({
        kind: 'skipped', effect: 'draw', amount: 0, reason: 'Heat production below 3 — no cards',
      });
      expect(outcomeOf(parliament, p2, 'draw')?.total).deep.eq({before: 2, after: 2});
      expect(game.gameLog.some((e) => e.message.includes('draws no cards'))).is.true;
    });

    it('the heat SUPPLY plays no part, and nothing is spent to draw', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 6});
      p1.heat = 40;
      const tr = p1.terraformRating;
      endGeneration(game);
      // Influence 1 (the winner's Agenda step) → production 7 → 2 cards. The
      // 40 heat in the supply changed nothing either way.
      expect(p1.production.heat).eq(7);
      expect(takePrompt(p1)?.cards).has.length(2);
      takeAll(p1);
      runAllActions(game);
      // 40 + the 6 the PRODUCTION phase itself paid — the resolution spent none
      // and added none: it moved production, not the supply.
      expect(p1.heat, 'only the production phase touched the supply').eq(46);
      expect(p1.production.heat, 'the production is not spent for the cards').eq(7);
      expect(p1.terraformRating).eq(tr);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({amount: 2, drawn: 2});
    });

    it('a partial take re-issues the prompt for the remainder, and the phase waits for all of it', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 8}); // + influence 1 = 9 → 3 cards
      endGeneration(game);
      const ask = takePrompt(p1)!;
      expect(ask.cards).has.length(3);
      const first = ask.cards[0].name;
      p1.process({type: 'card', cards: [first]});
      expect(p1.cardsInHand.map((c) => c.name)).includes(first);
      const again = takePrompt(p1);
      expect(again?.cards, 'the remainder is re-issued under the same intake').has.length(2);
      expect(again?.externalDrawPrompt).deep.include({count: 3, remaining: 2});
      expect(parliament.phase, 'the political phase has not moved on').is.not.undefined;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(3);
      settleParliamentGates(game);
      expect(parliament.lastPhase).is.not.undefined;
    });

    it('an empty project deck is named, and nothing is substituted for the cards', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 8});
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      endGeneration(game);
      runAllActions(game);
      expect(takePrompt(p1), 'nothing to take').is.undefined;
      expect(p1.cardsInHand).is.empty;
      expect(stockEventsFrom(game, p1, 'resolution'), 'no substitute reward').is.empty;
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'skipped', amount: 3, drawn: 0, reason: 'The project deck is empty'});
      expect(game.gameLog.some((e) => e.message.includes('drew no cards from'))).is.true;
    });

    it('a short deck delivers what it has, and the record keeps BOTH numbers', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 8}); // 9 → 3 owed
      const only = game.projectDeck.drawPile.slice(-2);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      endGeneration(game);
      expect(takePrompt(p1)?.cards).has.length(2);
      takeAll(p1);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 3, drawn: 2});
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for'))).is.true;
    });

    it('recipients are visited in order — the next seat is not asked while one still owes a take', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.production.override({heat: 5});
      p2.production.override({heat: 4});
      endGeneration(game);
      expect(takePrompt(p1)?.cards, '5 + 1 = 6 → 2').has.length(2);
      expect(p2.getWaitingFor(), 'p2 waits its turn').is.undefined;
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2)?.cards, '4 + 2 = 6 → 2').has.length(2);
      takeAll(p2);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase).is.not.undefined;
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({amount: 2});
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({amount: 2});
    });
  });

  describe('once per enactment', () => {
    it('a later production change never draws again, and a repeated answer pays nothing twice', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 5});
      endGeneration(game);
      const ask = takePrompt(p1)!;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(2);
      // The same answer again: refused, nothing drawn, nothing taken.
      expect(() => ask.process({type: 'card', cards: ask.cards.map((c) => c.name)})).to.throw();
      expect(p1.cardsInHand).has.length(2);
      // A later raise of the same production is an ordinary action-phase gain.
      game.phase = Phase.ACTION;
      p1.production.add(Resource.HEAT, 6);
      runAllActions(game);
      expect(p1.production.heat).eq(12);
      expect(p1.cardsInHand, 'no second draw').has.length(2);
      expect(p1.pendingCardIntakes).is.empty;
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({amount: 2, drawn: 2});
    });

    it('a LATER, legal enactment of the same card is a NEW calculation', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 2});
      endGeneration(game);
      expect(p1.production.heat).eq(3);
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(1);
      settleParliamentGates(game);

      // Generation 2: the card comes back up and wins again.
      game.phase = Phase.ACTION;
      seatResolution(parliament, 0, CLIMATE);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      expect(p1.production.heat, 'a fresh raise by the influence of the day').is.greaterThan(3);
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand.length).is.greaterThan(1);
    });
  });

  describe('the final generation', () => {
    it('the LAST political phase still raises the production AND still owes the draw', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 5});
      // Mars is terraformed: this political phase is the LAST one (steps 1–3).
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      maxOutOceans(p1);
      const handBefore = p1.cardsInHand.length;
      endGeneration(game);
      expect(parliament.phase?.final, 'the final political phase').is.true;
      expect(p1.production.heat, 'the raise still happens — the endgame reads the real value').eq(6);
      const take = takePrompt(p1);
      expect(take, 'the draw is NOT skipped because the game is ending').is.not.undefined;
      expect(take?.cards).has.length(2);
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand.length).eq(handBefore + 2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.final).is.true;
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2});
    });
  });

  describe('reload', () => {
    it('before the raise: the whole effect runs once on the reloaded game', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 5});
      seatResolution(parliament, 0, CLIMATE);
      // Serialize the game BEFORE the generation ends and run the phase there.
      const copy = reload(game);
      const c1 = copy.playersInGenerationOrder[0] as TestPlayer;
      endGeneration(copy);
      expect(c1.production.heat).eq(6);
      expect(takePrompt(c1)?.cards).has.length(2);
      takeAll(c1);
      runAllActions(copy);
      expect(c1.cardsInHand).has.length(2);
    });

    it('INSIDE the take: the cards are not re-drawn, the count is not recomputed, and the phase still waits', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 8}); // 9 → 3 cards
      endGeneration(game);
      const offered = takePrompt(p1)!.cards.map((c) => c.name).sort();
      const deckAfterDraw = game.projectDeck.drawPile.length;
      expect(parliament.phase?.step).eq('effects');

      const copy = reload(game);
      const c1 = copy.playersInGenerationOrder[0] as TestPlayer;
      expect(copy.projectDeck.drawPile.length, 'nothing is drawn again').eq(deckAfterDraw);
      expect(c1.pendingCardIntakes).has.length(1);
      const again = takePrompt(c1);
      expect(again?.cards.map((c) => c.name).sort(), 'the same three cards').deep.eq(offered);
      // Change the production AFTER the count was fixed: the draw does not follow it.
      c1.production.override({heat: 30});
      takeAll(c1);
      runAllActions(copy);
      expect(c1.cardsInHand).has.length(3);
      expect(c1.pendingCardIntakes).is.empty;
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });

    it('a PARTIAL take survives the reload: only the remainder is offered, nothing is doubled', () => {
      const [game, p1] = stage();
      p1.production.override({heat: 8});
      endGeneration(game);
      const ask = takePrompt(p1)!;
      const first = ask.cards[0].name;
      p1.process({type: 'card', cards: [first]});

      const copy = reload(game);
      const c1 = copy.playersInGenerationOrder[0] as TestPlayer;
      expect(c1.cardsInHand.map((c) => c.name)).deep.eq([first]);
      const again = takePrompt(c1);
      expect(again?.cards).has.length(2);
      expect(again?.externalDrawPrompt).deep.include({count: 3, remaining: 2});
      takeAll(c1);
      runAllActions(copy);
      expect(c1.cardsInHand).has.length(3);
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });

    it('between two seats: the finished seat is not paid again', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.production.override({heat: 5, megacredits: 0});
      p2.production.override({heat: 4, megacredits: 0});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2), 'p2 is the one being asked now').is.not.undefined;

      const copy = reload(game);
      const [c1, c2] = copy.playersInGenerationOrder as Array<TestPlayer>;
      expect(c1.production.heat, 'p1\'s raise is not repeated').eq(6);
      expect(c1.production.megacredits, 'nor the Greens\' answer to it').eq(1);
      expect(c1.cardsInHand, 'nor p1\'s cards').has.length(2);
      takeAll(c2);
      runAllActions(copy);
      expect(c2.cardsInHand).has.length(2);
      expect(c1.cardsInHand).has.length(2);
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });

    it('the intake survives as ORDINARY game state — an older save with the flat card fields still loads', () => {
      const [game, p1] = stage();
      p1.production.override({heat: 8});
      endGeneration(game);
      const serialized = structuredClone(game.serialize());
      const seat = serialized.players.find((pl) => pl.color === p1.color)!;
      expect(seat.pendingCardIntakes).has.length(1);
      expect(seat.pendingCardIntakes![0].cause).deep.eq({kind: 'resolution', resolution: CLIMATE_RESEARCH_ID, effect: 'draw'});
      // A save written before the cause became data: the flat fields ARE the card cause.
      const legacy = structuredClone(serialized);
      const legacySeat = legacy.players.find((pl) => pl.color === p1.color)!;
      const intake = legacySeat.pendingCardIntakes![0];
      delete intake.cause;
      intake.effectCard = CardName.SOLAR_LOGISTICS;
      intake.effectCardOwner = 'you';
      intake.initiator = p1.color;
      const restored = Game.deserialize(legacy);
      const r1 = restored.playersInGenerationOrder.find((pl) => pl.color === p1.color)!;
      expect(r1.pendingCardIntakes[0].cause).deep.eq({
        kind: 'card', effectCard: CardName.SOLAR_LOGISTICS, effectCardOwner: 'you', initiator: p1.color,
      });
    });
  });

  describe('the chairman quest', () => {
    it('THIS card\'s raise never progresses it — nor does the Greens\' M€ production', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 5});
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      // Generation 2's quest is this card's: +3 heat production.
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'production', resource: Resource.HEAT}, count: 3});
      expect(parliament.quest?.source).eq(CLIMATE_RESEARCH_ID);
      expect(parliament.questProgressOf(p1), 'the enactment\'s own raise is not the player\'s action').eq(0);
    });

    it('the player\'s OWN raises complete it — +2 then +1, and a high production alone does nothing', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 0});
      endGeneration(game);
      runAllActions(game);
      expect(parliament.quest?.source).eq(CLIMATE_RESEARCH_ID);
      expect(parliament.questProgressOf(p1)).eq(0);

      game.phase = Phase.ACTION;
      p1.production.override({heat: 9}); // a big production, set behind the engine's back
      expect(parliament.questProgressOf(p1), 'having it is not raising it').eq(0);

      game.events.beginAction(p1, {kind: 'card', card: CardName.ASTEROID}, {category: 'card-play'});
      p1.production.add(Resource.HEAT, 2, {log: false});
      game.events.endScope();
      expect(parliament.questProgressOf(p1)).eq(2);
      expect(parliament.quest?.completedBy).is.undefined;

      game.events.beginAction(p1, {kind: 'card', card: CardName.ASTEROID}, {category: 'card-play'});
      p1.production.add(Resource.HEAT, 1, {log: false});
      game.events.endScope();
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });

    it('heat resources, the temperature and M€ production are not heat production', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({heat: 0});
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      game.events.beginAction(p1, {kind: 'card', card: CardName.ASTEROID}, {category: 'card-play'});
      p1.stock.add(Resource.HEAT, 8, {log: false});
      p1.production.add(Resource.MEGACREDITS, 3, {log: false});
      game.increaseTemperature(p1, 2);
      game.events.endScope();
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(0);
      expect(parliament.quest?.completedBy).is.undefined;
    });

    it('the tracker refuses the political phase and anything under a resolution source — the rule, directly', () => {
      const [game, p1] = stage();
      game.phase = Phase.PARLIAMENT;
      game.events.beginAction(p1, {kind: 'resolution', id: CLIMATE_RESEARCH_ID, owner: p1.color}, {category: 'political-phase'});
      expect(QuestTracker.eligible(p1)).is.false;
      game.events.endScope();
      game.phase = Phase.ACTION;
      game.events.beginAction(p1, {kind: 'resolution', id: CLIMATE_RESEARCH_ID, owner: p1.color}, {category: 'card-play'});
      expect(QuestTracker.eligible(p1), 'a resolution source anywhere on the stack').is.false;
      game.events.endScope();
    });
  });

  describe('the model', () => {
    it('carries the seat\'s heat PRODUCTION — the input the second half divides — and the recorded outcomes', () => {
      const [game, p1, p2] = stage();
      p1.production.override({heat: 4});
      p2.production.override({heat: 1});
      const before = getParliamentModel(game, p1)!;
      const seat = before.players.find((s) => s.color === p1.color)!;
      expect(seat.production?.[Resource.HEAT]).eq(4);
      expect(before.players.find((s) => s.color === p2.color)?.production?.[Resource.HEAT]).eq(1);
      expect(Object.keys(seat.production ?? {}), 'only what some declaration names').deep.eq([Resource.HEAT]);

      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      const after = getParliamentModel(game, p1)!;
      const outcomes = after.lastPhase?.outcomes ?? [];
      const draw = outcomes.find((o) => o.player === p1.color && o.step === 'draw');
      expect(draw).deep.include({kind: 'cards', amount: 1, drawn: 1, influence: 1});
      expect(draw?.total).deep.eq({before: 4, after: 5});
      expect(after.players.find((s) => s.color === p1.color)?.production?.[Resource.HEAT]).eq(5);
    });
  });

  describe('MarsBot', () => {
    it('stays out of the parliament entirely — no raise, no draw, no prompt', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, CLIMATE);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.production.override({heat: 5});
      bot.production.override({heat: 9});
      const botCards = bot.cardsInHand.length;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      // The sitting's barrier is ONE human: the bot holds no gate.
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      takeAll(human);
      runAllActions(game);
      expect(parliament.participates(bot)).is.false;
      expect(bot.production.heat, 'no raise for a seat outside the parliament').eq(9);
      expect(bot.cardsInHand.length).eq(botCards);
      expect(bot.pendingCardIntakes).is.empty;
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id)).is.false;
    });

    it('the shared intake refuses a bot recipient outright — the rules must be answered at the call site', () => {
      const [, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      expect(bot.isMarsBot).is.true;
      expect(() => ExternalDrawIntake.open(bot, 2, {kind: 'resolution', resolution: CLIMATE_RESEARCH_ID}))
        .to.throw(/MarsBot/);
    });
  });
});
