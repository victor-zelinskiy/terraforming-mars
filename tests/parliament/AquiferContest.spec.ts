import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {AQUIFER_CONTEST, AQUIFER_CONTEST_ANIMALS, AQUIFER_CONTEST_CODE, AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {dummyResolutionId, REDUX_RESOLUTION_CATALOG, ResolutionCatalog} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cast} from '../../src/common/utils/utils';
import {maxOutOceans, runAllActions} from '../TestingUtils';
import {Fish} from '../../src/server/cards/base/Fish';
import {Pets} from '../../src/server/cards/base/Pets';
import {Birds} from '../../src/server/cards/base/Birds';
import {AdvancedEcosystems} from '../../src/server/cards/base/AdvancedEcosystems';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {TileType} from '../../src/common/TileType';
import {Tag} from '../../src/common/cards/Tag';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';

/**
 * AQUIFER CONTEST (Turmoil Redux, RX01) — the first real resolution and the
 * template of the family. What these specs pin: the payout is per
 * participant by THEIR influence (voters or not), the winner's Agenda step
 * counts before the payout, the amount comes from the ONE shared formula, a
 * zero payout asks nothing, a missing recipient is named and forfeited,
 * zero-animal cards are targets and an animal TAG is not, the winner's ocean
 * is the standard placement (TR, the Greens' reaction, no cost, no action),
 * a neutral winner places none, and a reload / a repeated answer inside any
 * question pays nothing twice and loses nothing.
 */
const AQUIFER = resolutionInstanceId(AQUIFER_CONTEST_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Aquifer Contest in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  parliament.slots[0].instance = AQUIFER;
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/**
 * Every player passes; the engine runs production → the parliament. The
 * harness leaves a STALE action menu (an `OrOptions`) on a seat that passed
 * after being handed its turn; the political phase's own prompts are never
 * a menu here, so the stale ones are cleared to read the phase's asks alone.
 */
function endGeneration(game: IGame): void {
  game.playersInGenerationOrder.forEach((player) => {
    game.playerHasPassed(player);
    game.playerIsFinishedTakingActions();
  });
  for (const player of game.playersInGenerationOrder) {
    if (player.getWaitingFor() instanceof OrOptions) {
      (player as TestPlayer).popWaitingFor();
    }
  }
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function animalsOn(player: TestPlayer, name: CardName): number {
  return player.tableau.get(name)?.resourceCount ?? 0;
}

describe('AquiferContest', () => {
  describe('the catalog entry', () => {
    it('is catalogued with its printed code, replaces the second Greens dummy in the deck and keeps the pool at 12', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(AQUIFER_CONTEST_ID)).eq(AQUIFER_CONTEST);
      expect(AQUIFER_CONTEST.code).eq(AQUIFER_CONTEST_CODE);
      expect(AQUIFER_CONTEST_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode(AQUIFER_CONTEST_CODE)).eq(AQUIFER_CONTEST);
      expect(AQUIFER_CONTEST.party).eq(PartyName.GREENS);
      expect(AQUIFER_CONTEST.quest).deep.eq({goal: {kind: 'tag', tag: Tag.ANIMAL}, count: 1});
      expect(AQUIFER_CONTEST.scaled).deep.eq([AQUIFER_CONTEST_ANIMALS]);
      // The old dummy stays loadable (an older save may carry it) but is never dealt again.
      const oldDummy = REDUX_RESOLUTION_CATALOG.get(dummyResolutionId(PartyName.GREENS, 2));
      expect(oldDummy?.copies).eq(0);
      expect(oldDummy?.dummy).is.true;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt).has.length(12);
      expect(dealt).includes(AQUIFER);
      expect(dealt).not.includes(resolutionInstanceId(dummyResolutionId(PartyName.GREENS, 2), 0));
      expect(dealt.filter((instance) => REDUX_RESOLUTION_CATALOG.ofInstance(instance).party === PartyName.GREENS)).has.length(2);
    });

    it('every printed code is unique and well-formed; a duplicate or a malformed one is refused', () => {
      const codes = REDUX_RESOLUTION_CATALOG.all().map((r) => r.code).filter((c): c is string => c !== undefined);
      expect(new Set(codes).size).eq(codes.length);
      for (const code of codes) {
        expect(code).matches(RESOLUTION_CODE_PATTERN);
      }
      expect(() => new ResolutionCatalog([AQUIFER_CONTEST, {...AQUIFER_CONTEST, id: 'RDX_OTHER'}])).to.throw(/Duplicate resolution code/);
      expect(() => new ResolutionCatalog([{...AQUIFER_CONTEST, code: 'X01'}])).to.throw(/malformed code/);
    });

    it('the shared formula: 1 animal per point of influence, nothing below zero', () => {
      expect(scaledAmount(AQUIFER_CONTEST_ANIMALS, 0)).eq(0);
      expect(scaledAmount(AQUIFER_CONTEST_ANIMALS, 1)).eq(1);
      expect(scaledAmount(AQUIFER_CONTEST_ANIMALS, 3)).eq(3);
      expect(scaledAmount(AQUIFER_CONTEST_ANIMALS, -2)).eq(0);
    });
  });

  describe('the animals payout', () => {
    it('pays every participant by THEIR influence — the winner AFTER its Agenda step, a non-voter by its own track — through the shared picker', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner) stands at the start: the phase's Agenda step takes it to step 1 = influence 1.
      // p2 never voted and sits at step 5 = influence 3.
      parliament.agenda.set(p2.id, 5);
      p1.playedCards.push(new Fish());
      p2.playedCards.push(new Fish(), new Pets());
      endGeneration(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(parliament.agendaOf(p1)).eq(1);

      const ask1 = cast(p1.getWaitingFor(), SelectCard);
      expect(ask1.resourceGainPrompt?.amount, 'the winner\'s payout counts the Agenda step').eq(1);
      expect(ask1.resourceGainPrompt?.cardResource).eq('animal');
      expect(ask1.choiceContext?.source).deep.eq({kind: 'resolution', resolution: AQUIFER_CONTEST_ID});
      expect(ask1.choiceContext?.mode).eq('reward');
      expect(ask1.cards.map((c) => c.name)).deep.eq([CardName.FISH]);
      expect(p2.getWaitingFor(), 'players are visited in order').is.undefined;
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(animalsOn(p1, CardName.FISH)).eq(1);
      // The winner's own steps follow its payout: the ocean comes before p2 is visited.
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      expect(p2.getWaitingFor(), 'p2 waits for the winner\'s ocean').is.undefined;
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);

      const ask2 = cast(p2.getWaitingFor(), SelectCard);
      expect(ask2.resourceGainPrompt?.amount, 'a non-voter is paid by its own influence').eq(3);
      expect(ask2.cards.map((c) => c.name)).has.members([CardName.FISH, CardName.PETS]);
      // The VP reading follows each card's OWN rule: Fish 1 per animal, Pets 1 per 2.
      expect(ask2.resourceGainPrompt?.vpBox?.[CardName.FISH]).deep.include({from: 0, to: 3});
      expect(ask2.resourceGainPrompt?.vpBox?.[CardName.PETS]).deep.include({from: 0, to: 1});
      p2.process({type: 'card', cards: [CardName.PETS]});
      expect(animalsOn(p2, CardName.PETS)).eq(3);
      expect(animalsOn(p2, CardName.FISH)).eq(0);
    });

    it('influence 0 asks nothing, names itself in the journal and records a skipped outcome', () => {
      const [game, p1, p2, parliament] = stage();
      p2.playedCards.push(new Fish());
      // p1 wins (step 1 → influence 1) and has no animal card; p2 has one but influence 0.
      endGeneration(game);
      // p1's animals are forfeited (no card) and it places the winner's ocean; p2 is then visited.
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      // p2 was never asked: the phase is over and the game moved on to the next research phase.
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      const next = p2.getWaitingFor();
      expect(next instanceof SelectCard ? next.resourceGainPrompt : undefined, 'no question for a zero payout').is.undefined;
      expect(animalsOn(p2, CardName.FISH)).eq(0);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'animals')).deep.include({kind: 'skipped', reason: 'No influence', amount: 0, influence: 0});
      expect(game.gameLog.some((entry) => entry.message.includes('has no influence'))).is.true;
    });

    it('no eligible card: the payout is named and forfeited — never banked, never converted; an animal TAG is not storage', () => {
      const [game, p1, , parliament] = stage();
      // p1 at step 5 (influence 3 after the phase's own step → 3 stays: step 6 is a TR step).
      parliament.agenda.set(p1.id, 5);
      p1.playedCards.push(new AdvancedEcosystems(), new Tardigrades());
      const tr = p1.terraformRating;
      endGeneration(game);
      // The winner's ocean is asked right away (the animals part was skipped, nothing asked).
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      expect(ocean.placementContext?.source).deep.eq({kind: 'resolution', resolution: AQUIFER_CONTEST_ID});
      const skipped = parliament.phase?.summary?.outcomes?.find((o) => o.player === p1.id && o.step === 'animals');
      expect(skipped).deep.include({kind: 'skipped', reason: 'No card can hold animals', amount: 3, influence: 3});
      expect(p1.tableau.get(CardName.TARDIGRADES)?.resourceCount ?? 0, 'microbes are not animals').eq(0);
      expect(p1.terraformRating, 'nothing converted').eq(tr + 1); // the Agenda step 6 pays its own 1 TR, nothing else
    });

    it('a card with zero animals is a target; the single candidate is still SHOWN and confirmed (never applied behind the board)', () => {
      const [game, p1] = stage();
      p1.playedCards.push(new Birds());
      endGeneration(game);
      const ask = cast(p1.getWaitingFor(), SelectCard);
      expect(ask.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
      expect(animalsOn(p1, CardName.BIRDS)).eq(0);
      p1.process({type: 'card', cards: [CardName.BIRDS]});
      expect(animalsOn(p1, CardName.BIRDS)).eq(1);
    });

    it('adding the animals never progresses the animal-tag chairman quest; playing an animal-tag card does', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Fish());
      endGeneration(game);
      cast(p1.getWaitingFor(), SelectCard);
      p1.process({type: 'card', cards: [CardName.FISH]});
      // the winner's ocean
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.quest?.source).eq(AQUIFER_CONTEST_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.ANIMAL}, count: 1});
      expect(parliament.questProgressOf(p1), 'the payout counted nothing').eq(0);
      // Generation 2: p2 plays an animal-tagged card as its OWN action-phase action.
      game.phase = Phase.ACTION;
      const events = game.events;
      events.beginAction(p2, {kind: 'card', card: CardName.ADVANCED_ECOSYSTEMS, owner: p2.color}, {category: 'card-play'});
      try {
        p2.playCard(new AdvancedEcosystems());
      } finally {
        events.endScope();
      }
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p2.id);
      expect(parliament.chairman).eq(p2.id);
    });
  });

  describe('the winner\'s ocean', () => {
    it('is the standard placement: the winner picks a legal ocean cell, gains the TR, the Greens pay 2 M€ once, no M€ spent, no action counted', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new Fish());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      expect(ocean.spaces.length).greaterThan(0);
      expect(ocean.spaces.every((s) => game.board.getAvailableSpacesForOcean(p1).includes(s))).is.true;
      expect(ocean.placementContext?.cancellable).is.false;
      const tr = p1.terraformRating;
      const mc = p1.megaCredits;
      const actions = p1.actionsTakenThisGame;
      const space = ocean.spaces.find((s) => s.bonus.length === 0) ?? ocean.spaces[0];
      p1.process({type: 'space', spaceId: space.id});
      runAllActions(game);
      expect(space.tile?.tileType).eq(TileType.OCEAN);
      expect(p1.terraformRating).eq(tr + 1);
      // The Greens rule now (Aquifer Contest is enacted): 2 M€ per TR step, paid ONCE by the ordinary hook.
      expect(p1.megaCredits, 'no standard-project cost; the Greens\' 2 M€ arrive').eq(mc + 2);
      expect(p1.actionsTakenThisGame).eq(actions);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      const outcome = parliament.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'ocean');
      expect(outcome).deep.include({kind: 'ocean', space: space.id});
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });

    it('a neutral winner places no ocean; the animals still reach every participant', () => {
      const [game, p1, p2, parliament] = reduxGame();
      parliament.slots[0].instance = AQUIFER;
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, 1);
      parliament.agenda.set(p2.id, 3);
      p1.playedCards.push(new Fish());
      p2.playedCards.push(new Fish());
      endGeneration(game);
      expect(cast(p1.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(cast(p2.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      p2.process({type: 'card', cards: [CardName.FISH]});
      runAllActions(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.lastPhase?.outcomes?.some((o) => o.step === 'ocean'), 'no ocean step for a neutral winner').is.false;
      expect(game.board.getOceanSpaces()).has.length(0);
    });

    it('no ocean left: the part is named and skipped, the phase goes on', () => {
      const [game, p1, , parliament] = stage();
      maxOutOceans(p1);
      const tr = p1.terraformRating;
      endGeneration(game);
      runAllActions(game);
      expect(p1.getWaitingFor(), 'no placement asked — the game moved on to the next research phase').is.not.instanceOf(SelectSpace);
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      expect(parliament.lastPhase?.outcomes?.find((o) => o.step === 'ocean')).deep.include({kind: 'skipped', reason: 'No ocean tile is left'});
      expect(p1.terraformRating, 'only the Agenda step itself').eq(tr);
      expect(game.gameLog.some((entry) => entry.message.includes('No ocean tile is left'))).is.true;
    });
  });

  describe('the model, the journal and the waiting seats', () => {
    it('every other seat reads WHO is asked and WHAT kind of answer; the recorded outcomes ride the model with colours', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new Fish());
      endGeneration(game);
      // p1 picks a card: p2's model says so (no step name, no resolution name — the input kind).
      let phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.step).eq('effects');
      expect(phase?.pending).deep.eq({player: p1.color, key: 'animals', input: 'card'});
      p1.process({type: 'card', cards: [CardName.FISH]});
      // p1 places the winner's ocean: a placement now.
      phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.pending).deep.eq({player: p1.color, key: 'ocean', input: 'space'});
      expect(phase?.outcomes).deep.eq([
        {player: p1.color, step: 'animals', effect: 'animals', kind: 'cardResource', resource: 'Animal', amount: 1, card: CardName.FISH, influence: 1},
      ]);
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.map((o) => `${o.player}:${o.step}:${o.kind}`)).deep.eq([
        `${p1.color}:animals:cardResource`, `${p1.color}:ocean:ocean`, `${p2.color}:animals:skipped`,
      ]);
    });

    it('the journal names the payout with its recipient card AND the resolution it came from', () => {
      const [game, p1] = stage();
      p1.playedCards.push(new Fish());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      const added = game.gameLog.find((entry) => entry.message === '${0} added ${1} ${2} to ${3} from ${4}');
      expect(added, 'the addition line').is.not.undefined;
      expect(added?.data.find((d) => d.type === LogMessageDataType.CARD)?.value).eq(CardName.FISH);
      expect(added?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(AQUIFER_CONTEST_ID);
      expect(game.gameLog.some((entry) => entry.message === 'Resolution ${0} is enacted')).is.true;
      expect(game.gameLog.some((entry) => entry.message === '${0} is the winning player of ${1}')).is.true;
    });
  });

  describe('recovery', () => {
    it('a reload inside the animal pick rebuilds the same question with the same amount; the answer pays once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2); // → step 3 after the phase = influence 2
      p1.playedCards.push(new Fish(), new Birds());
      endGeneration(game);
      expect(cast(p1.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(one.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount).eq(2);
      expect(ask.choiceContext?.source).deep.eq({kind: 'resolution', resolution: AQUIFER_CONTEST_ID});
      expect(live.parliament!.phase?.effectState?.[p1.id]?.animalsOwed, 'the amount is fixed with the phase').eq(2);
      // Even if the influence moved meanwhile, the question keeps the amount it was built with.
      live.parliament!.agenda.set(p1.id, 8);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      expect(cast(one.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(2);
      one.process({type: 'card', cards: [CardName.BIRDS]});
      expect(one.tableau.get(CardName.BIRDS)?.resourceCount).eq(2);
      expect(one.tableau.get(CardName.FISH)?.resourceCount).eq(0);
      // A REPEATED answer to the processed question is refused and pays nothing more.
      expect(() => one.process({type: 'card', cards: [CardName.FISH]})).to.throw();
      expect(one.tableau.get(CardName.FISH)?.resourceCount).eq(0);
      expect(one.tableau.get(CardName.BIRDS)?.resourceCount).eq(2);
      // The winner's ocean follows; a reload inside it keeps the placement pending and nothing placed.
      expect(one.getWaitingFor()).is.instanceOf(SelectSpace);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      const ocean = cast(one.getWaitingFor(), SelectSpace);
      expect(live.board.getOceanSpaces()).has.length(0);
      one.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(live);
      expect(live.board.getOceanSpaces()).has.length(1);
      expect(live.parliament!.phase).is.undefined;
      expect(live.generation).eq(2);
      // Every key applied once: the outcomes are one per step.
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'animals')).has.length(1);
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'ocean')).has.length(1);
    });

    it('a reload BETWEEN two players\' payouts asks the second player once, never the first again', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 1);
      p1.playedCards.push(new Fish());
      p2.playedCards.push(new Fish());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      const live = reload(game);
      const one = live.getPlayerById(p1.id) as TestPlayer;
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(one.tableau.get(CardName.FISH)?.resourceCount).eq(1);
      expect(one.getWaitingFor(), 'p1 owes the ocean, not a second pick').is.instanceOf(SelectSpace);
      expect(two.getWaitingFor(), 'p2 waits for p1').is.undefined;
      const ocean = cast(one.getWaitingFor(), SelectSpace);
      one.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(live);
      expect(cast(two.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      two.process({type: 'card', cards: [CardName.FISH]});
      runAllActions(live);
      expect(two.tableau.get(CardName.FISH)?.resourceCount).eq(1);
      expect(one.tableau.get(CardName.FISH)?.resourceCount).eq(1);
      expect(live.parliament!.phase).is.undefined;
    });

    it('a later, legal enactment of the same card pays again (idempotency is per enactment, never forever)', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new Fish());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      expect(game.generation).eq(2);
      expect(animalsOn(p1, CardName.FISH)).eq(1);
      // Generation 2: the card leaves ENACTED for the discard, then returns to the vote and wins again.
      game.phase = Phase.ACTION;
      parliament.slots[0].instance = AQUIFER;
      parliament.enacted = undefined;
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      expect(cast(p1.getWaitingFor(), SelectCard).resourceGainPrompt?.amount, 'step 2 = influence 1 still').eq(1);
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(animalsOn(p1, CardName.FISH)).eq(2);
    });

    it('MarsBot (mode none) is never asked, never paid, never a winner', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      parliament.slots[0].instance = AQUIFER;
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new Fish());
      bot.playedCards.push(new Fish());
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(cast(human.getWaitingFor(), SelectCard).resourceGainPrompt?.amount).eq(1);
      human.process({type: 'card', cards: [CardName.FISH]});
      expect(bot.getWaitingFor()).is.undefined;
      const ocean = cast(human.getWaitingFor(), SelectSpace);
      human.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.tableau.get(CardName.FISH)?.resourceCount ?? 0).eq(0);
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
    });

    it('the animals count in the final score', () => {
      const [game, p1] = stage();
      p1.playedCards.push(new Fish());
      const before = p1.getVictoryPoints().total;
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      const ocean = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ocean.spaces[0].id});
      runAllActions(game);
      // +1 VP for the animal on Fish, +1 TR for the ocean (Agenda step 1 is an influence step: no TR).
      expect(p1.getVictoryPoints().total).eq(before + 1 + 1);
    });
  });
});
