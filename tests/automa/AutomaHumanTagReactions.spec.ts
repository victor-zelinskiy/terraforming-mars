import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {IGame} from '../../src/server/IGame';
import {AutomaHumanTagReactions} from '../../src/server/automa/AutomaHumanTagReactions';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {SaturnSystems} from '../../src/server/cards/corporation/SaturnSystems';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {Splice} from '../../src/server/cards/promo/Splice';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {Tag} from '../../src/common/cards/Tag';
import {CardType} from '../../src/common/cards/CardType';
import {AutomaColonies} from '../../src/server/automa/AutomaColonies';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {Miranda} from '../../src/server/colonies/Miranda';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

function flipCard(game: IGame, human: TestPlayer, name: CardName) {
  game.automa!.actionDeck = [{kind: 'project', name}];
  botTakesOneTurn(game, human);
  runAllActions(game);
}

/**
 * Human reactions to the bot's card flips. Two regimes (AutomaHumanTagReactions
 * header, AUTOMA_DATA_AUDIT.md §10): a RESOLVED PROJECT CARD fires EVERY human
 * `onCardPlayedByAnyPlayer` reactor (fork rule 2026-09-06 — the Saturn Systems
 * FAQ precedent generalized), while NON-CARD tags / microbe advancements stay
 * the RB-B-enumerated allowlist (Saturn Systems / Pharmacy Union / Splice).
 */
describe('AutomaHumanTagReactions (bot flips → human reactors)', () => {
  describe('Saturn Systems — «triggered when you or MarsBot play a card with a Jovian tag»', () => {
    it('a bot flip with a Jovian tag raises the owner\'s M€ production', () => {
      const [game, human] = testAutomaGame({}, '-sat1');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.IO_MINING_INDUSTRIES); // Jovian + Space.
      expect(human.production.megacredits).eq(1);
    });

    it('a card resolved through Research & Development (B03) triggers it too', () => {
      const [game, human] = testAutomaGame({}, '-sat2');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      game.projectDeck.drawPile.push(newProjectCard(CardName.METHANE_FROM_TITAN)!); // Top of the deck.
      game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(human.production.megacredits).eq(1);
    });

    it('a flip without a Jovian tag changes nothing (tracker advances are structurally excluded)', () => {
      const [game, human] = testAutomaGame({}, '-sat3');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.ACQUIRED_COMPANY); // Earth only.
      expect(human.production.megacredits).eq(0);
    });

    it('multiplayer: whichever human holds Saturn Systems reacts (the dispatch walks every seat)', () => {
      const [game, humans] = testAutomaMultiplayerGame(2, {}, '-satmp');
      humans[1].playedCards.push(new SaturnSystems());
      for (const h of humans) {
        game.playerIsFinishedWithResearchPhase(h);
      }
      // The routing property under test is seat-independent — invoke the
      // dispatch the resolution sites call (turn order is its own machinery).
      AutomaHumanTagReactions.onBotCardResolved(game, newProjectCard(CardName.IO_MINING_INDUSTRIES)!);
      runAllActions(game);
      expect(humans[0].production.megacredits).eq(0);
      expect(humans[1].production.megacredits).eq(1);
    });
  });

  describe('Pharmacy Union — «a microbe advancement… as if a card with a microbe was played»', () => {
    it('a bot flip with a microbe tag adds a disease and costs the owner up to 4 M€', () => {
      const [game, human] = testAutomaGame({}, '-pu1');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.GHG_PRODUCING_BACTERIA); // Science + Microbe.
      expect(pu.resourceCount, 'one disease per microbe tag').eq(1);
      expect(human.megaCredits).eq(6);
    });

    it('the science half stays own-plays-only: a bot science flip triggers nothing', () => {
      const [game, human] = testAutomaGame({}, '-pu2');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      const trBefore = human.terraformRating;
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.GENE_REPAIR); // Science only.
      // Nothing of Pharmacy Union's science clause fired: no disease, no M€
      // move, no TR (the human's NEXT-turn action prompt is ordinary flow).
      expect(pu.resourceCount).eq(0);
      expect(human.megaCredits).eq(10);
      expect(human.terraformRating).eq(trBefore);
    });

    it('the bot landing on the Venus board\'s microbe cell (9) is a microbe advancement', () => {
      const [game, human] = testAutomaGame({venusNextExtension: true}, '-pu3');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      const venus = game.automa!.board.tracks[VENUS_TRACK_INDEX];
      venus.position = 8;
      game.automa!.actionDeck = [{kind: 'project', name: CardName.VENUS_GOVERNOR}]; // Venus ×2: 8→9 (microbe cell)→10.
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(pu.resourceCount).eq(1);
      expect(human.megaCredits).eq(6);
    });
  });

  describe('Splice — the owner gains 2 M€, the bot takes its deterministic M€ half', () => {
    it('a bot flip with a microbe tag: owner +2 M€, bot +2 M€, never a prompt', () => {
      const [game, human, bot] = testAutomaGame({}, '-sp1');
      human.playedCards.push(new Splice());
      game.playerIsFinishedWithResearchPhase(human);
      const humanBefore = human.megaCredits;
      const botBefore = bot.megaCredits;
      flipCard(game, human, CardName.GHG_PRODUCING_BACTERIA);
      expect(human.megaCredits).eq(humanBefore + 2);
      expect(bot.megaCredits).eq(botBefore + 2);
      expect(bot.getWaitingFor(), 'the bot never receives a prompt').is.undefined;
    });

    it('the Venus microbe cell resolves Splice as if a microbe card was played', () => {
      const [game, human, bot] = testAutomaGame({venusNextExtension: true}, '-sp2');
      human.playedCards.push(new Splice());
      game.playerIsFinishedWithResearchPhase(human);
      const humanBefore = human.megaCredits;
      const botBefore = bot.megaCredits;
      const venus = game.automa!.board.tracks[VENUS_TRACK_INDEX];
      venus.position = 8;
      game.automa!.actionDeck = [{kind: 'project', name: CardName.VENUS_GOVERNOR}];
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(human.megaCredits).eq(humanBefore + 2);
      expect(bot.megaCredits).eq(botBefore + 2);
    });
  });

  describe('the GENERAL card rule — a resolved project card fires EVERY human reactor', () => {
    // Fork rule (owner, 2026-09-06), generalizing the Saturn Systems FAQ
    // precedent: a project card MarsBot RESOLVES counts as «any player plays a
    // card» for every human onCardPlayedByAnyPlayer effect. Solar Logistics —
    // «when any player plays a space event, draw a card» — is the trigger
    // shape under test; its draw routes through the mandatory external-draw
    // intake (the trigger is foreign by construction).
    it('Solar Logistics: a bot Space+Event flip grants ONE external-draw intake, never a silent hand insert', () => {
      const [game, human, bot] = testAutomaGame({}, '-sl1');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      const handBefore = human.cardsInHand.length;
      flipCard(game, human, CardName.ASTEROID); // A Space EVENT.
      expect(human.cardsInHand.length, 'the card is withheld until taken').eq(handBefore);
      expect(human.pendingCardIntakes).has.length(1);
      const intake = human.pendingCardIntakes[0];
      expect(intake.cards).has.length(1);
      expect(intake.effectCard).eq(CardName.SOLAR_LOGISTICS);
      expect(intake.effectCardOwner).eq('you');
      expect(intake.initiator).eq(bot.color);
      expect(intake.triggerCard).eq(CardName.ASTEROID);
      // The mandatory take prompt stands, marked structurally.
      const wf = human.getWaitingFor();
      expect(wf?.externalDrawPrompt?.intakeId).eq(intake.id);
      expect(wf?.externalDrawPrompt?.remaining).eq(1);
    });

    it('answering the take prompt moves the card into the hand and completes the bot turn', () => {
      const [game, human] = testAutomaGame({}, '-sl1b');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      const handBefore = human.cardsInHand.length;
      flipCard(game, human, CardName.ASTEROID);
      const cardName = human.pendingCardIntakes[0].cards[0].name;
      human.process({type: 'card', cards: [cardName]});
      runAllActions(game);
      expect(human.cardsInHand.map((c) => c.name)).contains(cardName);
      expect(human.cardsInHand.length).eq(handBefore + 1);
      expect(human.pendingCardIntakes).is.empty;
    });

    it('a space project that is not an event does not trigger it', () => {
      const [game, human] = testAutomaGame({}, '-sl4');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.IO_MINING_INDUSTRIES); // Space, automated.
      expect(human.pendingCardIntakes).is.empty;
    });

    it('an event without a space tag does not trigger it', () => {
      const [game, human] = testAutomaGame({}, '-sl5');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      flipCard(game, human, CardName.SABOTAGE); // Event, no space tag.
      expect(human.pendingCardIntakes).is.empty;
    });

    it('a maxed track (the movement collapses into a Failed Action) still counts as a resolved card', () => {
      const [game, human] = testAutomaGame({}, '-sl6');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      for (const track of game.automa!.board.tracks) {
        track.position = track.maxPosition;
      }
      flipCard(game, human, CardName.ASTEROID);
      expect(human.pendingCardIntakes, 'the card resolution, not the track movement, is the trigger').has.length(1);
    });

    it('a track advance without a resolved card never reaches the dispatch (structural exclusion)', () => {
      const [game, human] = testAutomaGame({}, '-sl7');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      // Advance the event track directly — the shape every cascaded track
      // action / bonus effect takes. No card is resolved, nothing may fire.
      const eventTrackIndex = game.automa!.board.tracks.findIndex((t) => t.definition.tags.includes(Tag.EVENT));
      AutomaResolver.advanceTrack(game, eventTrackIndex);
      runAllActions(game);
      expect(human.pendingCardIntakes).is.empty;
    });

    it('sequential tag handling of ONE card stays ONE trigger (per-card granularity)', () => {
      const [game, human] = testAutomaGame({}, '-sl8');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      const doubleSpaceEvent = fakeCard({tags: [Tag.SPACE, Tag.SPACE], type: CardType.EVENT});
      AutomaHumanTagReactions.onBotCardResolved(game, doubleSpaceEvent);
      runAllActions(game);
      expect(human.pendingCardIntakes).has.length(1);
      expect(human.pendingCardIntakes[0].cards).has.length(1);
    });

    it('two suitable projects resolved in one chain are two full triggers', () => {
      const [game, human] = testAutomaGame({}, '-sl9');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      AutomaHumanTagReactions.onBotCardResolved(game, newProjectCard(CardName.ASTEROID)!);
      AutomaHumanTagReactions.onBotCardResolved(game, newProjectCard(CardName.BIG_ASTEROID)!);
      runAllActions(game);
      expect(human.pendingCardIntakes).has.length(2);
    });

    it('a card resolved through Research & Development (B03) triggers it — additional projects share the funnel', () => {
      const [game, human] = testAutomaGame({}, '-sl10');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      game.projectDeck.drawPile.push(newProjectCard(CardName.ASTEROID)!); // Top of the deck.
      game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
      botTakesOneTurn(game, human);
      runAllActions(game);
      expect(human.pendingCardIntakes).has.length(1);
      expect(human.pendingCardIntakes[0].triggerCard).eq(CardName.ASTEROID);
    });

    it('a card revealed for a placement tiebreak is not a resolved card', () => {
      const [game, human] = testAutomaGame({}, '-sl11');
      human.playedCards.push(new SolarLogistics());
      game.playerIsFinishedWithResearchPhase(human);
      game.projectDeck.drawPile.push(newProjectCard(CardName.ASTEROID)!);
      const land = game.board.getAvailableSpacesOnLand(human).slice(0, 2);
      AutomaTilePlacer.breakTie(game, land);
      runAllActions(game);
      expect(human.pendingCardIntakes, 'a cost flip reveals, it does not resolve').is.empty;
    });
  });

  describe('ENGINE-path reactions — the bot rides the shared doors, so human reactors fire with no bridge', () => {
    it('Arctic Algae: a bot-placed ocean pays the owner 2 plants (Game.addTile fan-out)', () => {
      const [game, human] = testAutomaGame({}, '-eng1');
      human.playedCards.push(new ArcticAlgae());
      game.playerIsFinishedWithResearchPhase(human);
      const before = human.plants;
      AutomaTilePlacer.placeOcean(game);
      expect(game.board.getOceanSpaces(), 'the bot really placed an ocean').has.length(1);
      runAllActions(game);
      expect(human.plants).eq(before + 2);
    });

    it('human Poseidon: the bot building a colony raises the owner\'s M€ production (botBuildColony fan-out)', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true}, '-eng2');
      human.playedCards.push(new Poseidon());
      game.playerIsFinishedWithResearchPhase(human);
      expect(AutomaColonies.botBuildColony(game)).is.true;
      runAllActions(game);
      expect(human.production.megacredits).eq(1);
    });

    it('a bot trade on a human-owned Miranda raises the detached colony-bonus collect (initiator = bot)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true}, '-eng3');
      const miranda = new Miranda();
      game.colonies.splice(0, game.colonies.length, miranda);
      AutomaColonies.setupColonies(game);
      miranda.colonies.push(human.id);
      game.playerIsFinishedWithResearchPhase(human);
      bot.megaCredits = 3;
      expect(AutomaColonies.botTrade(game)).is.true;
      runAllActions(game);
      const wf = human.getWaitingFor();
      expect(wf?.colonyBonusPrompt?.colonyName).eq(miranda.name);
      expect(wf?.colonyBonusPrompt?.trader).eq(bot.color);
    });
  });

  describe('the NON-CARD allowlist — RB-B maps starting tags / microbe advances to exactly three corporations', () => {
    it('the starting-tag route reaches Saturn Systems\' non-card-tag clause', () => {
      // No implemented corporation prints a Jovian starting tag — exercise the
      // route directly (the same call selectCorporation makes per tag).
      const [game, human] = testAutomaGame({}, '-sl2');
      human.playedCards.push(new SaturnSystems());
      game.playerIsFinishedWithResearchPhase(human);
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.JOVIAN);
      expect(human.production.megacredits).eq(1);
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.EARTH);
      expect(human.production.megacredits).eq(1); // Earth is nobody's clause.
    });

    it('a microbe starting tag would route to Pharmacy Union / Splice', () => {
      const [game, human, bot] = testAutomaGame({}, '-sl3');
      const pu = new PharmacyUnion();
      human.playedCards.push(pu);
      human.playedCards.push(new Splice());
      human.megaCredits = 10;
      game.playerIsFinishedWithResearchPhase(human);
      const botBefore = bot.megaCredits;
      AutomaHumanTagReactions.onBotNonCardTag(game, Tag.MICROBE);
      runAllActions(game);
      expect(pu.resourceCount).eq(1);
      expect(bot.megaCredits).eq(botBefore + 2); // Splice's deterministic bot half.
    });
  });
});

