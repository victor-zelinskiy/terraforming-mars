import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  URBAN_DEVELOPMENT, URBAN_DEVELOPMENT_CODE, URBAN_DEVELOPMENT_ID, URBAN_DEVELOPMENT_STEEL, urbanDevelopmentCards,
} from '../../src/server/parliament/resolutions/marsFirst/UrbanDevelopment';
import {DEVELOPMENT_CRAZE, DEVELOPMENT_CRAZE_ID, DEVELOPMENT_CRAZE_STEEL} from '../../src/server/parliament/resolutions/marsFirst/DevelopmentCraze';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardType} from '../../src/common/cards/CardType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderEffect, isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {GameEvent} from '../../src/common/events/GameEvent';
import {Payment} from '../../src/common/inputs/Payment';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {effectForecastForPlay, effectForecastForAction} from '../../src/server/models/effectForecast';
import {allForecastFacts, EffectForecastFact} from '../../src/common/models/EffectForecastModel';
import {ICard} from '../../src/server/cards/ICard';
import {Mine} from '../../src/server/cards/base/Mine';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {ViralEnhancers} from '../../src/server/cards/base/ViralEnhancers';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {SolarLogistics} from '../../src/server/cards/promo/SolarLogistics';
import {MiningGuild} from '../../src/server/cards/corporation/MiningGuild';
import {CityStandardProject} from '../../src/server/cards/base/standardProjects/CityStandardProject';
import {setRulingParty, fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * URBAN DEVELOPMENT (Turmoil Redux, RX30) — Development Craze's steel and
 * Development Craze's quest, plus the family's SECOND reactive passive: a law
 * that answers A CARD BEING PLAYED («after you play a Building tag, draw a
 * card»).
 *
 * What these specs pin: the steel by each seat's OWN influence (a named skip at
 * 0); a card drawn PER PRINTED BUILDING TAG (two tags → two cards), a wild tag
 * counting for nothing, a card without the tag paying nothing, the standard
 * project City paying nothing (it plays no card); the draw made
 * SYNCHRONOUSLY, under the resolution's own `effect-triggered` marker, with
 * the journal naming the law and an exhausted deck named too; the law held by
 * every PARTICIPANT and by no bot, and ENDING the moment another card takes
 * the enacted slot; the forecast twin — EXACT, on the law's own channel, and
 * standing where the live hook stands in the fan-out — present on a PLAY and
 * absent on an ACTION; and the upstream party policy `mp02` left as it was
 * (still once per card).
 */
const URBAN = resolutionInstanceId(URBAN_DEVELOPMENT_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, URBAN);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting — the passive alone is under test. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  parliament.enacted = URBAN;
  return [game, p1, p2, parliament];
}

function outcomesOf(parliament: Parliament, player: IPlayer): Array<SerializedEnactOutcome> {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id && o.kind !== 'reaction');
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** The resolution's `effect-triggered` markers in the stream. */
function urbanMarkers(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' && e.source.id === URBAN_DEVELOPMENT_ID);
}

function factsOf(player: IPlayer, card: ICard): Array<EffectForecastFact> {
  return [...allForecastFacts(effectForecastForPlay(player, card, cardPlayPreview(player, card)))];
}

function resolutionFactsOf(player: IPlayer, card: ICard): Array<EffectForecastFact> {
  return factsOf(player, card).filter((f) => f.source.kind === 'resolution' && f.source.name === URBAN_DEVELOPMENT_ID);
}

/** A project card with exactly the tags asked for — the reading is about TAGS, so the card is made of them. */
function tagged(tags: ReadonlyArray<Tag>, type: CardType = CardType.AUTOMATED) {
  return fakeCard({tags: [...tags], type});
}

describe('UrbanDevelopment', () => {
  describe('the catalog entry', () => {
    it('is RX30 of Mars First, ONE card: steel by influence for everyone, a card-played passive with its own forecast twin, the special-tile quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(URBAN_DEVELOPMENT_ID)).eq(URBAN_DEVELOPMENT);
      expect(URBAN_DEVELOPMENT_CODE).eq('RX30');
      expect(URBAN_DEVELOPMENT_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX30')).eq(URBAN_DEVELOPMENT);
      expect(URBAN_DEVELOPMENT.party).eq(PartyName.MARS);
      expect(URBAN_DEVELOPMENT.compatibility, 'a base card').is.undefined;
      expect(URBAN_DEVELOPMENT.quest, 'the printed solid brown hex: ONE special tile, never «city or special»').deep.eq({goal: {kind: 'tile', tile: 'special'}, count: 1});
      expect(URBAN_DEVELOPMENT.text.quest, 'Development Craze\'s own key — one footnote, one key').eq(DEVELOPMENT_CRAZE.text.quest);
      expect(URBAN_DEVELOPMENT.winnerSteps, 'no winner-only part').is.undefined;
      expect(URBAN_DEVELOPMENT.levy, 'nothing is paid at the enactment').is.undefined;
      expect(URBAN_DEVELOPMENT.action, 'no action').is.undefined;
      expect(typeof URBAN_DEVELOPMENT.passive?.onCardPlayed, 'the live hook').eq('function');
      expect(typeof URBAN_DEVELOPMENT.passive?.cardPlayedForecast, 'the honesty law: a live hook declares its twin').eq('function');
      expect(URBAN_DEVELOPMENT.passive?.onTilePlaced, 'the law does not answer a placement').is.undefined;
      expect(URBAN_DEVELOPMENT.text.passive, 'the sitting reads the passive').is.a('string').and.not.empty;
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === URBAN)).has.length(1);
      expect(familyOf(URBAN_DEVELOPMENT)).eq(familyOf(DEVELOPMENT_CRAZE));
    });

    it('the steel is Development Craze\'s formula, written out again: 1 per point of influence, for each, no cap', () => {
      expect(URBAN_DEVELOPMENT.scaled).deep.eq([URBAN_DEVELOPMENT_STEEL]);
      expect(URBAN_DEVELOPMENT_STEEL).deep.eq({...DEVELOPMENT_CRAZE_STEEL});
      for (const influence of [0, 1, 2, 3, 5]) {
        expect(scaledAmount(URBAN_DEVELOPMENT_STEEL, influence), `influence ${influence}`).eq(influence);
      }
    });

    it('the face: steel / influence on the first row; the passive as the dictionary reads it — a building TAG played → a card', () => {
      const [steelRow, effectRow] = URBAN_DEVELOPMENT.renderData.rows;
      const steel = steelRow[0];
      expect(isICardRenderItem(steel) && steel.type === CardRenderItemType.STEEL, 'the steel resource').is.true;
      const influence = steelRow[2];
      expect(isICardRenderItem(influence) && influence.type === CardRenderItemType.INFLUENCE, 'per influence').is.true;
      const effect = effectRow[0];
      expect(isICardRenderEffect(effect), 'the second row is an effect frame').is.true;
      if (!isICardRenderEffect(effect)) {
        return;
      }
      const [cause, , result] = effect.rows;
      expect(isICardRenderItem(cause[0]) && cause[0].type === CardRenderItemType.TAG && cause[0].tag === Tag.BUILDING, 'the trigger: a building tag').is.true;
      expect(isICardRenderItem(result[0]) && result[0].type === CardRenderItemType.CARDS, 'the result: a card').is.true;
      expect(isICardRenderItem(result[0]) && result[0].amount === 1, '… exactly one').is.true;
      // The footnote: the printed solid brown hex as ONE glyph — never «city / special».
      const [quest] = questRenderData(URBAN_DEVELOPMENT.quest).rows;
      expect(quest.map((n) => isICardRenderItem(n) ? n.type : 'sym')).deep.eq([CardRenderItemType.EMPTY_TILE_SPECIAL]);
    });
  });

  describe('the steel', () => {
    it('pays EVERY participant 1 steel per point of its OWN influence — the winner after its Agenda step', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.enacted, 'the card stands enacted — its passive is live from here').eq(URBAN);
      expect(p1.steel, 'the winner, after its Agenda step').eq(2);
      expect(p2.steel, 'influence 3').eq(3);
      expect(p1.production.steel, 'a stock gain, never production').eq(0);
      expect(outcomesOf(parliament, p2).map((o) => o.step + ':' + o.kind)).deep.eq(['steel:stock']);
      expect(outcomesOf(parliament, p2)[0]).deep.include({part: 'effect', effect: 'steel', stock: Resource.STEEL, amount: 3, influence: 3, before: 0, after: 3});
      expect(game.gameLog.some((e) => e.message === '${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})')).is.true;
    });

    it('influence 0 is a NAMED skip', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, 0);
      endGenerationThroughParliament(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p2.steel).eq(0);
      expect(outcomesOf(parliament, p2)[0]).deep.include({kind: 'skipped', effect: 'steel', stock: Resource.STEEL, amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no steel from ${1}')).is.true;
      expect(p1.steel, 'the winner (influence 1 after its step) is paid').eq(1);
    });
  });

  describe('the passive: a card drawn per building tag', () => {
    it('ONE building tag draws ONE card, under the resolution\'s own marker, and the journal names the law', () => {
      const [game, p1] = enacted();
      const before = p1.cardsInHand.length;
      p1.playCard(new Mine());
      // SYNCHRONOUS, at the hook: `playCard` has not returned to the caller
      // yet and the card is already in hand — nothing of this law waits in the
      // deferred queue, so nothing can reorder it.
      expect(p1.cardsInHand.length - before, 'the card is in hand before the play returns').eq(1);
      const queued = p1.cardsInHand.length;
      runAllActions(game);
      expect(p1.cardsInHand.length, 'draining the queue adds nothing more').eq(queued);
      expect(p1.production.steel, 'the Mine itself paid as it always did').eq(1);
      expect(urbanMarkers(game), 'one firing, under the law\'s source').has.length(1);
      expect(game.gameLog.some((e) => e.message.includes('building tag(s) and draws'))).is.true;
    });

    it('TWO building tags on one card draw TWO cards — «a building tag» is every building tag (Point Luna\'s reading)', () => {
      const [, p1] = enacted();
      const before = p1.cardsInHand.length;
      p1.playCard(tagged([Tag.BUILDING, Tag.BUILDING]));
      expect(p1.cardsInHand.length - before).eq(2);
    });

    it('the ONE reading is the shared function — printed tags of the card, the real double-building card included', () => {
      const [, p1] = enacted();
      expect(urbanDevelopmentCards(p1, new Mine()), 'one printed tag').eq(1);
      expect(urbanDevelopmentCards(p1, new MiningGuild()), 'the game\'s only card with two building tags').eq(2);
      expect(urbanDevelopmentCards(p1, new Tardigrades()), 'no building tag').eq(0);
      expect(urbanDevelopmentCards(p1, tagged([Tag.WILD])), 'a wild tag is not a building tag').eq(0);
    });

    it('a card WITHOUT a building tag pays nothing, and a WILD tag is not one', () => {
      const [game, p1] = enacted();
      const before = p1.cardsInHand.length;
      p1.playCard(new Tardigrades());
      p1.playCard(tagged([Tag.WILD]));
      expect(p1.cardsInHand.length).eq(before);
      expect(urbanMarkers(game), 'nothing fired — no scope was opened either').deep.eq([]);
    });

    it('the standard project CITY pays nothing: it plays no card and carries no tag', () => {
      const [game, p1] = enacted();
      p1.megaCredits = 30;
      const before = p1.cardsInHand.length;
      new CityStandardProject().payAndExecute(p1, Payment.of({megacredits: 25}));
      runAllActions(game);
      const selectSpace = cast(p1.popWaitingFor(), SelectSpace);
      selectSpace.process({type: 'space', spaceId: selectSpace.spaces[0].id});
      runAllActions(game);
      expect(game.board.getCities(p1), 'the city really was built').has.length(1);
      expect(p1.cardsInHand.length, 'the cell may print its own card bonus, but no more than that').is.at.most(before + 1);
      expect(urbanMarkers(game), 'no firing: nothing was played').deep.eq([]);
      expect(game.gameLog.some((e) => e.message.includes('building tag(s) and draws')), 'and nothing was journaled').is.false;
    });

    it('EVERY participant holds the law, not just the seat that won it', () => {
      const [, p1, p2] = enacted();
      const before1 = p1.cardsInHand.length;
      const before2 = p2.cardsInHand.length;
      p1.playCard(tagged([Tag.BUILDING]));
      p2.playCard(tagged([Tag.BUILDING]));
      expect(p1.cardsInHand.length - before1).eq(1);
      expect(p2.cardsInHand.length - before2).eq(1);
    });

    it('a seat WITHOUT the law draws nothing: nothing enacted, or another card enacted', () => {
      const [game, p1, , parliament] = reduxGame();
      const before = p1.cardsInHand.length;
      p1.playCard(tagged([Tag.BUILDING]));
      expect(p1.cardsInHand.length, 'nothing enacted').eq(before);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      p1.playCard(tagged([Tag.BUILDING]));
      expect(p1.cardsInHand.length, 'another law stands').eq(before);
      expect(urbanMarkers(game)).deep.eq([]);
    });

    it('the draw ENDS when the law changes — the dispatcher reads the enacted card at every firing', () => {
      const [game, p1, , parliament] = enacted();
      const before = p1.cardsInHand.length;
      p1.playCard(tagged([Tag.BUILDING]));
      expect(p1.cardsInHand.length - before).eq(1);
      parliament.enacted = resolutionInstanceId(DEVELOPMENT_CRAZE_ID, 0);
      p1.playCard(tagged([Tag.BUILDING]));
      expect(p1.cardsInHand.length - before, 'no second card').eq(1);
      expect(urbanMarkers(game), 'the one firing is the old one').has.length(1);
    });

    it('an exhausted deck is NAMED — never a silent zero', () => {
      const [game, p1] = enacted();
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      const before = p1.cardsInHand.length;
      p1.playCard(tagged([Tag.BUILDING, Tag.BUILDING]));
      expect(p1.cardsInHand.length).eq(before);
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for')), 'the shortfall names itself').is.true;
    });

    it('MarsBot is outside the parliament: its play answers nothing, the human\'s does', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      game.phase = Phase.ACTION;
      game.parliament!.enacted = URBAN;
      const botBefore = bot.cardsInHand.length;
      bot.playCard(tagged([Tag.BUILDING]));
      expect(bot.cardsInHand.length, 'no law for a bot').eq(botBefore);
      expect(urbanMarkers(game)).deep.eq([]);
      const humanBefore = human.cardsInHand.length;
      human.playCard(tagged([Tag.BUILDING]));
      expect(human.cardsInHand.length - humanBefore).eq(1);
      expect(urbanMarkers(game)).has.length(1);
    });
  });

  describe('the forecast twin', () => {
    it('states the cards EXACTLY, on the law\'s own channel; two tags are two cards; nothing while not enacted', () => {
      const [, p1, , parliament] = reduxGame();
      expect(resolutionFactsOf(p1, new Mine()), 'not enacted').deep.eq([]);
      parliament.enacted = URBAN;
      const facts = resolutionFactsOf(p1, new Mine());
      expect(facts).has.length(1);
      const fact = facts[0];
      expect(fact.certainty, 'the tags are printed on the card in front of the player').eq('exact');
      expect(fact.timing).eq('immediate');
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.source.channel, 'the same channel the live hook fires on').eq('card-played');
      expect(fact.source.owner).eq(p1.color);
      expect(fact.effects.map((e) => [e.icon, e.amount])).deep.eq([['cards', 1]]);
      expect(fact.reason).eq('Urban Development draws a card for every building tag you play');
      expect(resolutionFactsOf(p1, tagged([Tag.BUILDING, Tag.BUILDING]))[0].effects[0].amount).eq(2);
      expect(resolutionFactsOf(p1, new Tardigrades()), 'no building tag, no promise').deep.eq([]);
    });

    it('stands where the LIVE hook stands: after the acting seat\'s own tableau, before the other seats\'', () => {
      const [, p1, p2, parliament] = reduxGame();
      parliament.enacted = URBAN;
      p1.playedCards.push(new ViralEnhancers()); // reacts to a plant tag — step 1
      p2.playedCards.push(new SolarLogistics()); // reacts to a space EVENT — step 3
      const facts = factsOf(p1, tagged([Tag.BUILDING, Tag.SPACE, Tag.PLANT], CardType.EVENT));
      const own = facts.findIndex((f) => f.source.channel === 'card-played' && f.source.kind === 'card');
      const law = facts.findIndex((f) => f.source.kind === 'resolution');
      const any = facts.findIndex((f) => f.source.channel === 'card-played-by-any');
      expect(own, 'the acting seat\'s own reactor is there').is.greaterThan(-1);
      expect(any, 'another seat\'s reactor is there').is.greaterThan(-1);
      expect(law).is.greaterThan(own);
      expect(law).is.lessThan(any);
    });

    it('the coverage stays COMPLETE — the law is described, never an unknown', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.enacted = URBAN;
      const forecast = effectForecastForPlay(p1, new Mine(), cardPlayPreview(p1, new Mine()));
      expect(forecast.coverage).eq('complete');
    });

    it('a card ACTION promises no card: activating an action is not playing a card', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.enacted = URBAN;
      const pumping = new AquiferPumping();
      p1.playedCards.push(pumping);
      p1.megaCredits = 30;
      const forecast = effectForecastForAction(p1, pumping, actionPreview(p1, pumping));
      expect(allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution')).deep.eq([]);
    });

    it('is READ-ONLY: asking the forecast draws nothing and changes no hand', () => {
      const [game, p1, , parliament] = reduxGame();
      parliament.enacted = URBAN;
      const hand = p1.cardsInHand.length;
      const deck = game.projectDeck.drawPile.length;
      resolutionFactsOf(p1, tagged([Tag.BUILDING, Tag.BUILDING]));
      expect(p1.cardsInHand.length).eq(hand);
      expect(game.projectDeck.drawPile.length).eq(deck);
      expect(urbanMarkers(game)).deep.eq([]);
    });
  });

  describe('what must NOT have moved', () => {
    it('the upstream Mars First policy mp02 still pays ONCE PER CARD — a differently-built sentence, left alone', () => {
      const [game, player] = testGame(2, {turmoilExtension: true});
      setRulingParty(game, PartyName.MARS, 'mp02');
      player.playCard(tagged([Tag.BUILDING, Tag.BUILDING]));
      expect(player.megaCredits, '2 M€ for the CARD, not 2 per tag').eq(2);
    });
  });
});
