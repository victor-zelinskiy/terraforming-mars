import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {ratingLeaders, ratingVetoed} from '../../src/server/parliament/ratingVetoGate';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {
  UNMI_VETO, UNMI_VETO_CODE, UNMI_VETO_DRAW, UNMI_VETO_FORECAST_TITLE, UNMI_VETO_ID, UNMI_VETO_QUEST_MARS_TAGS, UNMI_VETO_REASON,
} from '../../src/server/parliament/resolutions/reds/UnmiVeto';
import {MOHOLE_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/MoholeContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {OPEN_IP_TRADE} from '../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {SPONSORED_PROJECTS} from '../../src/server/parliament/resolutions/scientists/SponsoredProjects';
import {endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {TileType} from '../../src/common/TileType';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {GameEvent} from '../../src/common/events/GameEvent';
import {Behavior} from '../../src/server/behavior/Behavior';
import {Card} from '../../src/server/cards/Card';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {CardRenderer} from '../../src/server/cards/render/CardRenderer';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {actionFutility} from '../../src/server/models/actionFutility';
import {buildStandardProjectPreview} from '../../src/server/models/standardProjectPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {GiantIceAsteroid} from '../../src/server/cards/base/GiantIceAsteroid';
import {WaterSplittingPlant} from '../../src/server/cards/base/WaterSplittingPlant';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {UnitedNationsMarsInitiative} from '../../src/server/cards/corporation/UnitedNationsMarsInitiative';
import {Pristar} from '../../src/server/cards/turmoil/Pristar';
import {ConvertHeat, heatConversionMetadata} from '../../src/server/cards/base/standardActions/ConvertHeat';
import {plantConversionMetadata} from '../../src/server/cards/base/standardActions/ConvertPlants';
import {AsteroidStandardProject} from '../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {GreeneryStandardProject} from '../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {isICardRenderEffect, isICardRenderItem} from '../../src/common/cards/render/Types';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {cast} from '../../src/common/utils/utils';
import {runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * UNMI VETO (Turmoil Redux, RX42) — the SECOND replacing passive, and the
 * lighter one: a draw by influence at the enactment, and — while the card
 * stands enacted — every seat FIRST BY TERRAFORM RATING gains no rating: the
 * whole event of the funnel refused before anything of it runs, the scale
 * step / tile / bonus that carried it happening as printed, nothing in its
 * place, nothing asked.
 *
 * What these specs pin: the catalog entry and the face; the enactment's draw
 * (by influence, the named zero, a reload inside the take); the gate — LIVE at
 * every event, a tie at the top binding every one of them, ONE event judged
 * whole (a seat one below the top with «+3» gains all three and is bound from
 * then on), the engine's own order inside one action (a greenery's two
 * ratings, Giant Ice Asteroid's three events); what the refusal leaves
 * untouched (the scale, the tile, the track's bonus, the planet's events) and
 * what it never starts (`trThisGeneration`, «raised this generation», the
 * UNMI corporation closed, Pristar paid, no `tr-changed`, no reactor); what
 * the law never touches (a lowering, the World Government, a zero); the
 * status moving by name (`rating-veto-changed`); the Agenda step's record;
 * the final greenery; MarsBot under the veto and in the comparison (Р3); the
 * NEXT law's winner; the quest; the forecast twin on every door (the chips
 * struck in the funnel's order, the law's own fact, the «no effect» verdict of
 * a bare rating); the model; purity; a reload.
 */
const VETO = resolutionInstanceId(UNMI_VETO_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, VETO);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting — the passive alone is under test; p1 FIRST by rating (30 against 20). */
function enacted(ratings: {p1: number, p2: number} = {p1: 30, p2: 20}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  parliament.enacted = VETO;
  p1.terraformRating = ratings.p1;
  p2.terraformRating = ratings.p2;
  p1.megaCredits = 50;
  p1.heat = 16;
  p1.plants = 16;
  p1.energy = 6;
  return [game, p1, p2, parliament];
}

/** The Agenda position that reads as influence `n` for a seat that takes no step during the phase. */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** A declarative card with `behavior` — played through the real executor. A NEW name per probe: `Card` caches its static properties by name. */
let probes = 0;
class Probe extends Card implements IProjectCard {
  constructor(behavior: Behavior, tags: Array<Tag> = []) {
    super({
      name: `Veto probe ${++probes}` as CardName, type: CardType.AUTOMATED, cost: 0, behavior, tags,
      metadata: {cardNumber: 'X00', renderData: CardRenderer.builder(() => {})},
    });
  }
}

/** The law's `effect-triggered` markers on the vetoing channel. */
function markers(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' &&
    e.source.id === UNMI_VETO_ID && e.trigger === 'rating-vetoed');
}

/** The named losses the law recorded, as their magnitudes — the children of its markers, in order. */
function refused(game: IGame, player?: IPlayer): Array<number> {
  const ids = new Set(markers(game).map((m) => m.id));
  return game.events.events
    .filter((e) => e.type === 'effect-skipped' && e.parentId !== undefined && ids.has(e.parentId) && (player === undefined || e.player === player.color))
    .map((e) => e.impact.skipped?.effect?.amount ?? -1);
}

function trChanges(game: IGame, player: IPlayer): Array<number> {
  return game.events.events.filter((e) => e.type === 'tr-changed' && e.player === player.color).map((e) => e.impact.tr ?? 0);
}

function vetoChanges(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'rating-veto-changed');
}

function takePrompt(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectCard && (wf as SelectCard<IProjectCard>).externalDrawPrompt !== undefined ? wf as SelectCard<IProjectCard> : undefined;
}

function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

function ratingChips(effects: ReadonlyArray<ActionEffect>): Array<ActionEffect> {
  return effects.filter((e) => e.icon === 'tr' && e.direction === 'gain');
}

function vetoedSteps(effects: ReadonlyArray<ActionEffect>): number {
  return effects.reduce((sum, e) => sum + (e.vetoed?.steps ?? 0), 0);
}

describe('UnmiVeto', () => {
  describe('the catalog entry', () => {
    it('is RX42 of the Reds — one copy, no expansion needed, the two-Mars-tags quest, a vetoing passive with its forecast, the shared draw, no winner part', () => {
      expect(REDUX_RESOLUTION_CATALOG.all()).includes(UNMI_VETO);
      expect(UNMI_VETO.id).eq(UNMI_VETO_ID);
      expect(UNMI_VETO.code).eq(UNMI_VETO_CODE);
      expect(RESOLUTION_CODE_PATTERN.test(UNMI_VETO_CODE)).is.true;
      expect(REDUX_RESOLUTION_CATALOG.all().filter((d) => d.code === UNMI_VETO_CODE), 'RX42 is one card').has.length(1);
      expect(UNMI_VETO.party).eq(PartyName.REDS);
      expect(UNMI_VETO.copies).eq(1);
      expect(UNMI_VETO.compatibility).is.undefined;
      expect(UNMI_VETO.quest).deep.eq({goal: {kind: 'tag', tag: Tag.MARS}, count: UNMI_VETO_QUEST_MARS_TAGS});
      expect(UNMI_VETO.scaled).deep.eq([UNMI_VETO_DRAW]);
      expect(UNMI_VETO.immediateSteps?.map((s) => s.key)).deep.eq(['draw']);
      expect(UNMI_VETO.winnerSteps ?? []).is.empty;
      expect(UNMI_VETO.worldSteps ?? []).is.empty;
      expect(UNMI_VETO.action).is.undefined;
      expect(typeof UNMI_VETO.passive?.vetoRating).eq('function');
      expect(typeof UNMI_VETO.passive?.forecast).eq('function');
      expect(UNMI_VETO.passive?.divertTerraforming, 'the rating alone — no unit is replaced').is.undefined;
      expect(UNMI_VETO.text.effect, 'Open IP Trade\'s sentence — the same part').eq(OPEN_IP_TRADE.text.effect);
      expect(familyOf(UNMI_VETO)).eq('influence');
    });

    it('the draw is the SHARED step — Open IP Trade and Sponsored Projects stand on the same function', () => {
      expect(UNMI_VETO.immediateSteps?.[0].key).eq(UNMI_VETO_DRAW.id);
      expect(OPEN_IP_TRADE.immediateSteps?.[0].key).eq('draw');
      expect(SPONSORED_PROJECTS.immediateSteps?.[0].key).eq('draw');
    });

    it('the face: card / influence on the first row; the passive as ONE rule — «[TR «>»] : [TR struck]»', () => {
      const rows = UNMI_VETO.renderData.rows;
      const first = rows[0].filter(isICardRenderItem).map((i) => i.type);
      expect(first).deep.eq([CardRenderItemType.CARDS, CardRenderItemType.INFLUENCE]);
      const effect = rows[1].find(isICardRenderEffect);
      expect(effect, 'the rule is one effect box').is.not.undefined;
      const items = effect!.rows.flat().filter(isICardRenderItem);
      const ratings = items.filter((i) => i.type === CardRenderItemType.TR);
      expect(ratings).has.length(2);
      expect(ratings[0].innerText, 'the highest rating — the «>» inside the icon').eq('>');
      expect(ratings[0].cancelled).is.undefined;
      expect(ratings[1].cancelled, 'the rating it does not gain — struck, as Pristar prints it').eq(true);
    });
  });

  describe('the enactment — cards by influence through the shared intake', () => {
    it('pays every participant 1 card × THEIR influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      const hand1 = p1.cardsInHand.length;
      const hand2 = p2.cardsInHand.length;
      endGenerationThroughParliament(game);
      expect(takePrompt(p1)?.cards, 'the winner stepped to influence 1').has.length(1);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2)?.cards, 'a non-voter is paid by its own influence').has.length(3);
      takeAll(p2);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p1.cardsInHand).has.length(hand1 + 1);
      expect(p2.cardsInHand).has.length(hand2 + 3);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'draw')).deep.include({kind: 'cards', amount: 1, drawn: 1, influence: 1});
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'draw')).deep.include({kind: 'cards', amount: 3, drawn: 3, influence: 3});
      expect(parliament.enacted).eq(VETO);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
    });

    it('influence 0 is a NAMED zero — nothing drawn, nothing asked', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      const hand2 = p2.cardsInHand.length;
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p2.cardsInHand).has.length(hand2);
      expect(parliament.lastPhase?.outcomes?.find((o) => o.player === p2.id && o.step === 'draw')).deep.include({kind: 'skipped', amount: 0, reason: 'No influence', influence: 0});
    });

    it('a reload INSIDE the take: the same cards, nothing drawn twice, taken once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      endGenerationThroughParliament(game);
      const before = takePrompt(p1)!.cards.map((c) => c.name);
      expect(before).has.length(2);
      const deck = game.projectDeck.drawPile.length;
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(takePrompt(seat)?.cards.map((c) => c.name)).deep.eq(before);
      expect(again.projectDeck.drawPile.length, 'nothing drawn again').eq(deck);
      const hand = seat.cardsInHand.length;
      seat.process({type: 'card', cards: before});
      runAllActions(again);
      settleParliamentGates(again);
      expect(seat.cardsInHand).has.length(hand + 2);
    });
  });

  describe('the passive — the whole event refused before the funnel runs, for the seat first by rating, live', () => {
    it('a card\'s bare rating: the rating stands; the law\'s marker, journal line and NAMED loss with its magnitude; no `tr-changed`, no «raised this generation», no `trThisGeneration`', () => {
      const [game, p1] = enacted();
      expect(ratingVetoed(p1)).is.true;
      expect(ParliamentHandler.ratingVetoed(p1)).is.true;
      p1.playCard(new Probe({tr: 2}));
      runAllActions(game);
      expect(p1.terraformRating, 'no rating').eq(30);
      expect(markers(game)).has.length(1);
      expect(refused(game)).deep.eq([2]);
      const skip = game.events.events.find((e) => e.type === 'effect-skipped');
      expect(skip?.impact.skipped).deep.eq({label: 'Terraform rating', reason: UNMI_VETO_REASON, effect: {direction: 'gain', icon: 'tr', amount: 2}});
      expect(skip?.parentId, 'the law\'s own child').eq(markers(game)[0].id);
      expect(game.gameLog.some((e) => e.message === '${0} does not gain ${1} ${2}: ${3} — the highest rating')).is.true;
      expect(trChanges(game, p1), 'nothing of the rating was recorded as a change').deep.eq([]);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
      expect(p1.trThisGeneration).eq(0);
      expect(p1.terraformRatingFromCards).eq(0);
      expect(p1.terraformRatingSources).deep.eq([]);
    });

    it('a seat NOT first by rating gains as before — and the status is live: once first, its next gain is refused', () => {
      const [game, p1, p2] = enacted({p1: 20, p2: 30});
      expect(ratingVetoed(p1)).is.false;
      expect(ratingVetoed(p2)).is.true;
      p1.playCard(new Probe({tr: 10}));
      runAllActions(game);
      expect(p1.terraformRating, 'all ten — the event is judged whole').eq(30);
      expect(refused(game)).deep.eq([]);
      expect(ratingVetoed(p1), 'a tie at the top binds every one of them').is.true;
      p1.playCard(new Probe({tr: 1}));
      runAllActions(game);
      expect(p1.terraformRating).eq(30);
      expect(refused(game)).deep.eq([1]);
    });

    it('ONE event, judged whole (Р2): a seat one below the top with «+3» gains all three; the seat at the top with «+3» gains none', () => {
      const [game, p1, p2] = enacted({p1: 29, p2: 30});
      p1.playCard(new Probe({tr: 3}));
      runAllActions(game);
      expect(p1.terraformRating).eq(32);
      p2.playCard(new Probe({tr: 3}));
      runAllActions(game);
      expect(p2.terraformRating, 'not first any more — gained').eq(33);
      p2.playCard(new Probe({tr: 3}));
      runAllActions(game);
      expect(p2.terraformRating, 'first now — refused whole').eq(33);
      expect(refused(game)).deep.eq([3]);
    });

    it('the engine\'s own order inside ONE action: a scale step moves, its bonus step comes, the ratings alone are refused — event by event', () => {
      const [game, p1] = enacted();
      setOxygenLevel(game, 7);
      const temperature = game.getTemperature();
      p1.playCard(new Probe({global: {oxygen: 1}}));
      runAllActions(game);
      expect(game.getOxygenLevel(), 'the scale moved').eq(8);
      expect(game.getTemperature(), 'the 8 % bonus step was crossed').eq(temperature + 2);
      expect(p1.terraformRating).eq(30);
      expect(refused(game), 'two events: the oxygen\'s rating and the bonus temperature\'s').deep.eq([1, 1]);
      expect(game.events.events.filter((e) => e.type === 'global-parameter-changed'), 'the planet\'s events stand').has.length(2);
    });

    it('a greenery is TWO events (the oxygen\'s rating, the Redux tile\'s rating): the tile is seated, the oxygen rises, both ratings refused', () => {
      const [game, p1] = enacted();
      p1.playCard(new Probe({greenery: {}}));
      runAllActions(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      p1.process({type: 'space', spaceId: ask.spaces[0].id});
      runAllActions(game);
      expect(game.board.spaces.some((s) => s.player === p1 && s.tile?.tileType === TileType.GREENERY), 'the tile landed').is.true;
      expect(game.getOxygenLevel()).eq(1);
      expect(p1.terraformRating).eq(30);
      expect(refused(game)).deep.eq([1, 1]);
      expect(game.events.events.some((e) => e.type === 'tile-placed')).is.true;
    });

    it('Giant Ice Asteroid for a seat one below the top: the temperature\'s two steps are gained as ONE event, then the two oceans\' ratings are refused one by one', () => {
      const [game, p1, p2] = enacted({p1: 29, p2: 30});
      setTemperature(game, -20);
      p1.playCard(new GiantIceAsteroid());
      runAllActions(game);
      for (let i = 0; i < 2; i++) {
        const ask = cast(p1.getWaitingFor(), SelectSpace);
        p1.process({type: 'space', spaceId: ask.spaces[0].id});
        runAllActions(game);
      }
      expect(game.getTemperature()).eq(-16);
      expect(game.board.getOceanSpaces()).has.length(2);
      expect(p1.terraformRating, '29 + 2, first by rating from then on').eq(31);
      expect(refused(game)).deep.eq([1, 1]);
      expect(p2.terraformRating).eq(30);
    });

    it('the UNMI corporation stays closed («not raised this generation») and Pristar is paid as «not raised» — by the letter', () => {
      const [game, p1] = enacted();
      const unmi = new UnitedNationsMarsInitiative();
      p1.playCorporationCard(unmi);
      runAllActions(game);
      p1.playCard(new Probe({tr: 1}));
      runAllActions(game);
      expect(p1.hasIncreasedTerraformRatingThisGeneration).is.false;
      expect(unmi.canAct(p1), 'the corporation\'s action needs a rating raised this generation').is.false;
      const pristar = new Pristar();
      const mc = p1.megaCredits;
      pristar.onProductionPhase(p1);
      expect(p1.megaCredits, 'Pristar: «you did not get TR so far this generation»').eq(mc + 6);
      expect(pristar.resourceCount).eq(1);
    });

    it('the UNMI corporation\'s own action under the veto: 3 M€ paid, no rating — «no effect», never blocked (Р5)', () => {
      const [game, p1] = enacted();
      const unmi = new UnitedNationsMarsInitiative();
      p1.playCorporationCard(unmi);
      p1.hasIncreasedTerraformRatingThisGeneration = true;
      runAllActions(game);
      expect(unmi.canAct(p1)).is.true;
      expect(actionFutility(p1, unmi)?.verdict).deep.eq({kind: 'rating-vetoed', reason: UNMI_VETO_REASON});
      const mc = p1.megaCredits;
      unmi.action(p1);
      runAllActions(game);
      expect(p1.megaCredits).eq(mc - 3);
      expect(p1.terraformRating).eq(30);
      expect(refused(game)).deep.eq([1]);
    });

    it('a LOWERING is never refused, and it moves the status: a seat that falls out of the top LEAVES the veto, by name', () => {
      const [game, p1, p2] = enacted({p1: 30, p2: 30});
      expect(ratingVetoed(p1)).is.true;
      expect(ratingVetoed(p2)).is.true;
      p1.decreaseTerraformRating(1);
      expect(p1.terraformRating).eq(29);
      expect(refused(game)).deep.eq([]);
      expect(ratingVetoed(p1)).is.false;
      const change = vetoChanges(game);
      expect(change).has.length(1);
      expect(change[0].player).eq(p1.color);
      expect(change[0].source).deep.include({kind: 'resolution', id: UNMI_VETO_ID});
      expect(change[0].impact.ratingVeto).deep.eq({entered: [], left: [p1.color], leaders: [{color: p2.color, tr: 30}]});
      // …and a raise that brings it back ENTERS it, by name.
      p1.playCard(new Probe({tr: 2}));
      runAllActions(game);
      expect(p1.terraformRating).eq(31);
      expect(vetoChanges(game)).has.length(2);
      expect(vetoChanges(game)[1].impact.ratingVeto).deep.eq({entered: [p1.color], left: [p2.color], leaders: [{color: p1.color, tr: 31}]});
    });

    it('the World Government\'s move gives no rating — nothing is refused, nothing recorded', () => {
      const [game, p1] = enacted();
      game.phase = Phase.SOLAR;
      setTemperature(game, -20);
      game.increaseTemperature(p1, 1);
      expect(game.getTemperature()).eq(-18);
      expect(p1.terraformRating).eq(30);
      expect(markers(game)).deep.eq([]);
      expect(refused(game)).deep.eq([]);
    });

    it('a zero gain is nobody\'s: no marker, no line', () => {
      const [game, p1] = enacted();
      p1.increaseTerraformRating(0);
      expect(markers(game)).deep.eq([]);
    });

    it('the Agenda track\'s step under the veto: the marker moves, the record says the rating did not come, the law\'s line replaces the track\'s', () => {
      const [game, p1, , parliament] = enacted();
      parliament.agenda.set(p1.id, 1); // the next step (2) pays a rating
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 1, {reason: 'card', card: CardName.SUPERCOMPUTER});
      expect(walk).deep.eq({from: 1, to: 2, steps: [{to: 2, bonus: 'tr', vetoed: true}]});
      expect(parliament.agendaOf(p1)).eq(2);
      expect(p1.terraformRating).eq(30);
      expect(refused(game)).deep.eq([1]);
      expect(game.gameLog.some((e) => e.message === '${0} gained ${1} ${2} from the Agenda track'), 'the track\'s own line is not written').is.false;
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr', vetoed: true}]);
      // …and for a seat below the top the record carries no mark.
      const [game2, q1, , parliament2] = enacted({p1: 20, p2: 30});
      parliament2.agenda.set(q1.id, 1);
      const walk2 = ChairmanSeat.walkAgenda(q1, parliament2, 1, {reason: 'card', card: CardName.SUPERCOMPUTER});
      expect(walk2?.steps).deep.eq([{to: 2, bonus: 'tr'}]);
      expect(q1.terraformRating).eq(21);
      expect(refused(game2)).deep.eq([]);
    });

    it('the final greenery of the last generation: the marker names the veto, the tile is seated (no oxygen — the engine\'s own rule), the Redux tile\'s rating refused', () => {
      const [game, p1] = enacted();
      game.phase = Phase.PRODUCTION;
      p1.plants = 8;
      p1.takeActionForFinalGreenery();
      const ask = cast(p1.getWaitingFor(), OrOptions);
      expect(ask.finalGreeneryPrompt).deep.eq({spaces: game.board.getAvailableSpacesForGreenery(p1).length, ratingVetoed: {resolution: UNMI_VETO_ID}});
      const place = cast(ask.options[0], SelectSpace);
      p1.process({type: 'or', index: 0, response: {type: 'space', spaceId: place.spaces[0].id}});
      runAllActions(game);
      expect(p1.plants).eq(0);
      expect(game.board.spaces.some((s) => s.player === p1 && s.tile?.tileType === TileType.GREENERY)).is.true;
      expect(game.getOxygenLevel(), 'a final greenery raises no oxygen — the engine\'s rule, not the law\'s').eq(0);
      expect(p1.terraformRating).eq(30);
      expect(refused(game), 'the Redux tile\'s own rating — the one rating a final greenery pays').deep.eq([1]);
    });

    it('the NEXT law\'s winner part: Mohole Contest after UNMI Veto pays its winner the temperature AND the rating', () => {
      const [game, p1, , parliament] = reduxGame();
      seatEnacted(parliament, VETO);
      seatResolution(parliament, 0, MOHOLE_CONTEST_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.terraformRating = 40;
      setTemperature(game, -20);
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(resolutionInstanceId(MOHOLE_CONTEST_ID, 0));
      expect(game.getTemperature()).eq(-16);
      expect(p1.terraformRating).greaterThanOrEqual(42);
      expect(markers(game)).deep.eq([]);
    });

    it('the law survives a reload: the copy refuses too', () => {
      const [game, p1] = enacted();
      const copy = reload(game);
      const q1 = copy.getPlayerById(p1.id) as TestPlayer;
      expect(ratingVetoed(q1)).is.true;
      copy.increaseOxygenLevel(q1, 1);
      expect(copy.getOxygenLevel()).eq(1);
      expect(q1.terraformRating).eq(30);
      expect(refused(copy)).deep.eq([1]);
    });
  });

  describe('MarsBot — under the veto and in the comparison (decision Р3, the `restriction` aspect)', () => {
    function seated(mode: 'politics' | 'none'): [IGame, TestPlayer, IPlayer] {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
      game.phase = Phase.ACTION;
      game.parliament!.enacted = VETO;
      return [game, human, bot];
    }

    it('the bot first by rating gains no rating — through the same funnel, by not one branch of its own; the line is about the bot', () => {
      const [game, human, bot] = seated('politics');
      bot.setTerraformRating(30);
      human.terraformRating = 20;
      expect(ratingVetoed(bot)).is.true;
      expect(ratingVetoed(human)).is.false;
      bot.increaseTerraformRating(1, {log: true});
      expect(bot.terraformRating).eq(30);
      expect(refused(game, bot)).deep.eq([1]);
      human.increaseTerraformRating(1);
      expect(human.terraformRating, 'the human below the top gains').eq(21);
    });

    it('the bot below the top gains as before; the bot and the human EQUAL at the top are both bound', () => {
      const [game, human, bot] = seated('politics');
      bot.setTerraformRating(20);
      human.terraformRating = 30;
      bot.increaseTerraformRating(2);
      expect(bot.terraformRating).eq(22);
      bot.setTerraformRating(30);
      expect(ratingVetoed(bot)).is.true;
      expect(ratingVetoed(human)).is.true;
      bot.increaseTerraformRating(1);
      human.increaseTerraformRating(1);
      expect(bot.terraformRating).eq(30);
      expect(human.terraformRating).eq(30);
      expect(refused(game)).deep.eq([1, 1]);
    });

    it('under `none` (an older save) the bot is in the comparison but outside the aspect: it leads unbound, and the human below it gains', () => {
      const [game, human, bot] = seated('none');
      bot.setTerraformRating(30);
      human.terraformRating = 20;
      expect([...ratingLeaders(game)]).deep.eq([bot.id]);
      expect(ratingVetoed(bot)).is.false;
      bot.increaseTerraformRating(1);
      human.increaseTerraformRating(1);
      expect(bot.terraformRating).eq(31);
      expect(human.terraformRating).eq(21);
      expect(refused(game)).deep.eq([]);
      const model = getParliamentModel(game, human)!;
      expect(model.players.find((p) => p.color === bot.color)?.restriction).is.false;
      expect(model.players.find((p) => p.color === human.color)?.restriction).is.true;
    });
  });

  describe('the quest — 2 Mars tags of the seat\'s own', () => {
    it('a played Mars tag counts; the enactment\'s draw never', () => {
      const [game, p1, , parliament] = stage();
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.quest?.source).eq(UNMI_VETO_ID);
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.ACTION;
      p1.playCard(new Probe({}, [Tag.MARS]));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      p1.playCard(new Probe({}, [Tag.BUILDING]));
      runAllActions(game);
      expect(parliament.questProgressOf(p1), 'another tag plays no part').eq(1);
    });
  });

  describe('the forecast twin — the exit pass on every door, in the funnel\'s order', () => {
    it('a card play for the seat first by rating: the bare rating and the implied rating are STRUCK, the scale chip is not, the law\'s fact is a named skip on its channel, no party reacts', () => {
      const [game, p1, , parliament] = enacted();
      setOxygenLevel(game, 7);
      parliament.enacted = undefined;
      const plain = cardPlayPreview(p1, new Probe({tr: 2, global: {oxygen: 1}}));
      expect(ratingChips(plain.branches[0].effects).map((e) => e.vetoed)).deep.eq([undefined, undefined]);

      parliament.enacted = VETO;
      const card = new Probe({tr: 2, global: {oxygen: 1}});
      const preview = cardPlayPreview(p1, card);
      const chips = preview.branches[0].effects;
      // The executor's own order: the scale (and its implied rating) before the bare rating.
      expect(chips.map((e) => e.icon)).deep.eq(['oxygen', 'tr', 'tr']);
      expect(chips[0].vetoed, 'the scale chip stands — the planet moves').is.undefined;
      expect(chips[1].implied).is.true;
      expect(chips[1].vetoed).deep.eq({resolution: UNMI_VETO_ID, steps: 1});
      expect(chips[2].vetoed).deep.eq({resolution: UNMI_VETO_ID, steps: 2});
      expect(vetoedSteps(chips)).eq(3);
      const facts = allForecastFacts(effectForecastForPlay(p1, card, preview));
      const own = facts.filter((f) => f.source.kind === 'resolution' && f.source.name === UNMI_VETO_ID);
      expect(own).has.length(1);
      expect(own[0].source.channel).eq('rating-vetoed');
      expect(own[0].certainty).eq('skipped');
      expect(own[0].reason).eq(UNMI_VETO_FORECAST_TITLE);
      expect(own[0].note).eq(UNMI_VETO_REASON);
      expect(own[0].effects).deep.eq([{direction: 'gain', icon: 'tr', amount: 3}]);
      expect(facts.some((f) => f.source.kind === 'party'), 'no party reacts to a rating that never comes').is.false;
      expect(game.events.events.filter((e) => e.type === 'effect-triggered'), 'read-only').deep.eq([]);
    });

    it('a seat one below the top: the oxygen\'s implied rating is gained (and makes it first), the bare «+3» after it is struck — the funnel\'s own sequence, the pool read where the struck steps did not move it', () => {
      const [, p1] = enacted({p1: 29, p2: 30});
      const preview = cardPlayPreview(p1, new Probe({tr: 3, global: {oxygen: 1}}));
      const chips = preview.branches[0].effects;
      expect(chips.map((e) => e.icon)).deep.eq(['oxygen', 'tr', 'tr']);
      expect(chips[1].implied).is.true;
      expect(chips[1].vetoed, '29 → 30: gained').is.undefined;
      expect(chips[2].vetoed, '30 against 30: refused').deep.eq({resolution: UNMI_VETO_ID, steps: 3});
      expect(chips[2]).deep.include({amount: 3, current: 30, resulting: 33});
      // …a seat two below the top: both are gained — the bare rating reads the pool after the implied step.
      const [, q1] = enacted({p1: 28, p2: 30});
      const both = cardPlayPreview(q1, new Probe({tr: 3, global: {oxygen: 1}})).branches[0].effects;
      expect(both[1].vetoed).is.undefined;
      expect(both[2].vetoed).is.undefined;
      expect(both[2]).deep.include({current: 29, resulting: 32});
    });

    it('a blue action: the UNMI corporation is «no effect» (rating-vetoed); Water Splitting Plant\'s step is struck beside a living scale; Aquifer Pumping\'s ocean is not struck', () => {
      const [, p1] = enacted();
      const unmi = new UnitedNationsMarsInitiative();
      p1.playCorporationCard(unmi);
      p1.hasIncreasedTerraformRatingThisGeneration = true;
      const corp = actionPreview(p1, unmi);
      expect(corp.branches[0].futile).deep.eq({kind: 'rating-vetoed', reason: UNMI_VETO_REASON});
      expect(ratingChips(corp.branches[0].effects)[0].vetoed).deep.eq({resolution: UNMI_VETO_ID, steps: 1});
      const plant = new WaterSplittingPlant();
      p1.playedCards.push(plant);
      const action = actionPreview(p1, plant);
      expect(action.branches[0].futile, 'the scale moves — the action has value').is.undefined;
      expect(ratingChips(action.branches[0].effects).map((e) => e.vetoed)).deep.eq([{resolution: UNMI_VETO_ID, steps: 1}]);
      expect(actionFutility(p1, plant)).is.undefined;
      const pump = new AquiferPumping();
      p1.playedCards.push(pump);
      const ocean = actionPreview(p1, pump);
      expect(ocean.branches[0].steps.some((s) => s.kind === 'boardPlacement'), 'the cell is still asked — the ocean is seated').is.true;
      expect(ocean.branches[0].effects.some((e) => e.icon === 'oceans' && e.vetoed !== undefined)).is.false;
      expect(ocean.branches[0].futile).is.undefined;
    });

    it('the standard projects: Asteroid\'s rating struck beside a living temperature (not «no effect»); Greenery\'s two ratings struck, the cell still asked', () => {
      const [, p1] = enacted();
      const asteroid = buildStandardProjectPreview(p1, new AsteroidStandardProject(), 14);
      expect(asteroid.effects.find((e) => e.icon === 'temperature')?.vetoed).is.undefined;
      expect(ratingChips(asteroid.effects).map((e) => e.vetoed)).deep.eq([{resolution: UNMI_VETO_ID, steps: 1}]);
      expect(asteroid.futile).is.undefined;
      const greenery = buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
      const ratings = ratingChips(greenery.effects);
      expect(ratings.length).greaterThanOrEqual(1);
      expect(ratings.every((e) => e.vetoed !== undefined), 'every rating of the greenery').is.true;
      expect(greenery.target, 'the cell is asked — the tile is seated').eq('space');
    });

    it('the conversions\' option readings: the heat\'s rating struck beside a living step, the plants\' ratings struck beside a living tile — neither «no effect»', () => {
      const [, p1] = enacted();
      const heat = heatConversionMetadata(p1, 8);
      expect(heat.effects?.find((e) => e.icon === 'temperature')?.vetoed).is.undefined;
      expect(ratingChips(heat.effects ?? []).map((e) => e.vetoed)).deep.eq([{resolution: UNMI_VETO_ID, steps: 1}]);
      expect(heat.futile).is.undefined;
      expect(heat.steps, 'nothing to pre-collect — nothing stands in the rating\'s place').is.undefined;
      const plants = plantConversionMetadata(p1);
      const plantRatings = ratingChips(plants.effects ?? []);
      expect(plantRatings.map((e) => e.amount), 'the greenery: two rating events, stated for the step').deep.eq([1, 1]);
      expect(plantRatings.every((e) => e.implied === true && e.vetoed !== undefined)).is.true;
      expect(plants.steps?.some((s) => s.kind === 'boardPlacement'), 'the cell is still asked').is.true;
      expect(plants.futile).is.undefined;
    });

    it('the live conversion agrees with its reading, number for number: 8 heat → the temperature moves, the rating is refused', () => {
      const [game, p1] = enacted();
      setTemperature(game, -20);
      const promised = vetoedSteps(heatConversionMetadata(p1, 8).effects ?? []);
      const action = new ConvertHeat();
      p1.defer(action.action(p1));
      runAllActions(game);
      expect(game.getTemperature()).eq(-18);
      expect(p1.heat).eq(8);
      expect(p1.terraformRating).eq(30);
      expect(refused(game).reduce((a, b) => a + b, 0)).eq(promised);
    });

    it('is READ-ONLY: the passes serialize the game to the same bytes', () => {
      const [game, p1] = enacted();
      const before = JSON.stringify(game.serialize());
      cardPlayPreview(p1, new GiantIceAsteroid());
      buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
      heatConversionMetadata(p1, 8);
      plantConversionMetadata(p1);
      getParliamentModel(game, p1);
      ratingLeaders(game);
      expect(JSON.stringify(game.serialize())).eq(before);
    });
  });

  describe('the model — who is under the veto, live, on the enacted law and on a candidate', () => {
    it('the enacted law carries every seat first by rating with its rating; a tie lists both; the candidate reads «as if enacted now»', () => {
      const [game, p1, p2, parliament] = enacted({p1: 30, p2: 30});
      const model = getParliamentModel(game, p1)!;
      expect(model.enacted?.trVeto).deep.eq({leaders: [{color: p1.color, tr: 30}, {color: p2.color, tr: 30}]});
      expect(model.players.every((p) => p.restriction === true)).is.true;
      p2.terraformRating = 31;
      expect(getParliamentModel(game, p1)!.enacted?.trVeto).deep.eq({leaders: [{color: p2.color, tr: 31}]});
      // …a candidate in the voting area.
      const [game2, q1, q2, parliament2] = reduxGame();
      seatResolution(parliament2, 0, VETO);
      q1.terraformRating = 27;
      q2.terraformRating = 30;
      const slot = getParliamentModel(game2, q1)!.slots.find((s) => s.resolution === UNMI_VETO_ID);
      expect(slot?.trVetoIfEnacted).deep.eq({leaders: [{color: q2.color, tr: 30}]});
      expect(getParliamentModel(game2, q1)!.slots.filter((s) => s.resolution !== UNMI_VETO_ID).every((s) => s.trVetoIfEnacted === undefined)).is.true;
      expect(getParliamentModel(game2, q1)!.enacted, 'nothing enacted').is.undefined;
      expect(parliament.enacted).eq(VETO);
    });
  });

  describe('once enacted', () => {
    it('the REDS rule, and the veto ends when another card takes the slot', () => {
      const [game, p1, , parliament] = enacted();
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      seatEnacted(parliament, MOHOLE_CONTEST_ID);
      expect(ratingVetoed(p1)).is.false;
      p1.playCard(new Probe({tr: 1}));
      runAllActions(game);
      expect(p1.terraformRating).eq(31);
      expect(markers(game)).deep.eq([]);
    });
  });
});
