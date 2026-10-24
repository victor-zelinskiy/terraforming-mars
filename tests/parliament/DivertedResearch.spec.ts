import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  DIVERTED_RESEARCH, DIVERTED_RESEARCH_CODE, DIVERTED_RESEARCH_DATA, DIVERTED_RESEARCH_ID, DIVERTED_RESEARCH_QUEST_DATA,
} from '../../src/server/parliament/resolutions/reds/DivertedResearch';
import {
  DIVERTED_DATA_PICK_TITLE, DIVERTED_NO_HOLDER_REASON, divertedNetCatches, pendingDivertedData, resetDivertedNet,
} from '../../src/server/parliament/resolutions/DivertedTerraforming';
import {MOHOLE_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/MoholeContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {TileType} from '../../src/common/TileType';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Payment} from '../../src/common/inputs/Payment';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {GameEvent} from '../../src/common/events/GameEvent';
import {Behavior} from '../../src/server/behavior/Behavior';
import {Card} from '../../src/server/cards/Card';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ICard} from '../../src/server/cards/ICard';
import {CardRenderer} from '../../src/server/cards/render/CardRenderer';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {actionFutility} from '../../src/server/models/actionFutility';
import {buildStandardProjectPreview} from '../../src/server/models/standardProjectPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {BiologicalSimulations} from '../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {WaterSplittingPlant} from '../../src/server/cards/base/WaterSplittingPlant';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {GiantIceAsteroid} from '../../src/server/cards/base/GiantIceAsteroid';
import {Flooding} from '../../src/server/cards/base/Flooding';
import {Whales} from '../../src/server/cards/underworld/Whales';
import {Arboretum} from '../../src/server/cards/turmoilRedux/Arboretum';
import {EcologicalExperiment} from '../../src/server/cards/turmoilRedux/EcologicalExperiment';
import {IcyImpactors} from '../../src/server/cards/promo/IcyImpactors';
import {ConvertHeat, heatConversionMetadata} from '../../src/server/cards/base/standardActions/ConvertHeat';
import {ConvertPlants, plantConversionMetadata} from '../../src/server/cards/base/standardActions/ConvertPlants';
import {AsteroidStandardProject} from '../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {AquiferStandardProject} from '../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {GreeneryStandardProject} from '../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {Europa} from '../../src/server/colonies/Europa';
import {Board} from '../../src/server/boards/Board';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {isICardRenderEffect, isICardRenderItem} from '../../src/common/cards/render/Types';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {cast} from '../../src/common/utils/utils';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {AutomaTerraformer} from '../../src/server/automa/AutomaTerraformer';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {pushNearestBonus} from '../../src/server/automa/AutomaNearBonusPush';
import {hellasSouthPoleUsable} from '../../src/server/automa/AutomaPlacementBonus';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * DIVERTED RESEARCH (Turmoil Redux, RX35) — the first REPLACING passive: data
 * by influence at the enactment, and — while the card stands enacted — every
 * step of oxygen or temperature and every greenery or ocean tile a seat would
 * gain becomes 1 data on one of its cards, asked ONCE per operation, the
 * ceiling cutting nothing, the ceiling's and the cell's gates falling.
 *
 * What these specs pin: the catalog entry and the face; the enactment's data
 * (by each seat's own influence, the two named zeros, a reload inside the
 * question); the passive on every door — a card's step, a standard project, a
 * conversion, a two-ocean card, a greenery (ONE data, its oxygen part of it), a
 * card printing a step AND a tile (two), the ceiling («even if maxed» — nine
 * oceans and no Whales animal, 14 % oxygen), the PRINTED steps (13 % + 2 → 2);
 * one question per operation (Lake Marineris, Giant Ice Asteroid); no holder —
 * a named loss with its sum and no gate; the fallen gates (Р5); the Hellas
 * pole, Europa, Icy Impactors' credited seat, Flooding's missing adjacency,
 * Arboretum's missing cities, TR47's fall; what the law never touches (the
 * World Government, an unrewarded move, a lowering, Venus, a bare rating, the
 * bot, the NEXT law's winner); the final greenery (Р2); the quest (Р6); the
 * events; the net; the forecast twin on every door; the standard-project and
 * conversion readings; the futility verdicts; the dossier; purity; a reload.
 */
const DIVERTED = resolutionInstanceId(DIVERTED_RESEARCH_ID, 0);
const DIVERTED_SOURCE = {kind: 'resolution', resolution: DIVERTED_RESEARCH_ID};

function reduxGame(options: {board?: BoardName} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {
    turmoilReduxExpansion: true, coloniesExtension: true,
    boardName: options.board ?? BoardName.THARSIS,
  });
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, DIVERTED);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting — the passive alone is under test; p1 holds a data card (Supercomputer). */
function enacted(options: {board?: BoardName, holder?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame(options);
  parliament.enacted = DIVERTED;
  if (options.holder !== false) {
    p1.playedCards.push(new Supercomputer());
  }
  p1.megaCredits = 50;
  p1.heat = 16;
  p1.plants = 16;
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
  constructor(behavior: Behavior) {
    super({
      name: `Probe ${++probes}` as CardName, type: CardType.AUTOMATED, cost: 0, behavior,
      metadata: {cardNumber: 'X00', renderData: CardRenderer.builder(() => {})},
    });
  }
}

function dataOn(player: IPlayer, name: CardName = CardName.SUPERCOMPUTER): number {
  return player.tableau.get(name)?.resourceCount ?? 0;
}

/** The law's `effect-triggered` markers on the replacing channel. */
function markers(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'resolution' &&
    e.source.id === DIVERTED_RESEARCH_ID && e.trigger === 'terraforming-diverted');
}

function planetEvents(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'global-parameter-changed' || e.type === 'tile-placed');
}

/** The ONE «where» prompt the operation left standing — the shared picker, the law as its asker, the sum as its amount. */
function wherePrompt(player: TestPlayer): SelectCard<ICard> {
  const prompt = cast(player.getWaitingFor(), SelectCard) as SelectCard<ICard>;
  expect(prompt.choiceContext?.source, 'the law asks').deep.eq(DIVERTED_SOURCE);
  expect(prompt.resourceGainPrompt?.diverted, 'the structural marker of a replaced unit').deep.eq({resolution: DIVERTED_RESEARCH_ID});
  return prompt;
}

/** Answer the «where» with the first candidate and drain the queue. */
function land(player: TestPlayer): ICard {
  const prompt = wherePrompt(player);
  const card = prompt.cards[0];
  player.process({type: 'card', cards: [card.name]});
  runAllActions(player.game);
  return card;
}

function convertHeat(player: TestPlayer): void {
  const action = new ConvertHeat();
  expect(action.canAct(player)).is.true;
  player.defer(action.action(player));
  runAllActions(player.game);
}

function whereStepOf(steps: ReadonlyArray<ActionPreviewStep>): ActionPreviewStep | undefined {
  return steps.find((s) => s.kind === 'input' && s.input.type === 'card' && (s.input as SelectCardModel).resourceGainPrompt?.diverted !== undefined);
}

describe('DivertedResearch', () => {
  afterEach(() => {
    expect(divertedNetCatches(), 'no unit reached the engine\'s seating door under the law').eq(0);
    resetDivertedNet();
  });

  describe('the catalog entry', () => {
    it('is RX35 of the Reds — one copy, no expansion needed, the four-data quest, a replacing passive with its twins, no winner part', () => {
      const definition = DIVERTED_RESEARCH;
      expect(REDUX_RESOLUTION_CATALOG.get(DIVERTED_RESEARCH_ID)).eq(DIVERTED_RESEARCH);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX35')).eq(DIVERTED_RESEARCH);
      expect(definition.code).eq(DIVERTED_RESEARCH_CODE);
      expect(definition.code).match(RESOLUTION_CODE_PATTERN);
      expect(definition.party).eq(PartyName.REDS);
      expect(definition.copies).eq(1);
      expect(definition.compatibility).is.undefined;
      expect(definition.quest).deep.eq({goal: {kind: 'cardResource', resource: CardResource.DATA}, count: DIVERTED_RESEARCH_QUEST_DATA});
      expect(definition.winnerSteps ?? []).is.empty;
      expect(definition.worldSteps ?? []).is.empty;
      expect(definition.passive?.divertTerraforming).is.a('function');
      expect(definition.passive?.placementFacts).is.a('function');
      expect(definition.passive?.forecast).is.a('function');
      expect(definition.text.passive).is.a('string').and.not.empty;
    });

    it('the shared formula: 1 data per point of influence onto ONE card (no layout), nothing below zero', () => {
      expect(DIVERTED_RESEARCH_DATA.unit).deep.eq({kind: 'cardResource', resources: [CardResource.DATA]});
      expect(scaledAmount(DIVERTED_RESEARCH_DATA, 0)).eq(0);
      expect(scaledAmount(DIVERTED_RESEARCH_DATA, 3)).eq(3);
      expect(familyOf(DIVERTED_RESEARCH)).eq('influence');
    });

    it('the face: data / influence on the first row; the passive as ONE rule — REPLACE the four units → data', () => {
      const [dataRow, effectRow] = DIVERTED_RESEARCH.renderData.rows;
      const data = dataRow[0];
      expect(isICardRenderItem(data) && data.type === CardRenderItemType.RESOURCE && data.resource === CardResource.DATA, 'the data resource').is.true;
      const influence = dataRow[2];
      expect(isICardRenderItem(influence) && influence.type === CardRenderItemType.INFLUENCE, 'per influence').is.true;
      const effect = effectRow[0];
      expect(isICardRenderEffect(effect), 'the second row is an effect frame').is.true;
      if (!isICardRenderEffect(effect)) {
        return;
      }
      const [cause, , result] = effect.rows;
      const causeTypes = cause.filter(isICardRenderItem).map((n) => n.type);
      expect(causeTypes[0], 'the printed verb').eq(CardRenderItemType.TEXT);
      expect(causeTypes).include.members([CardRenderItemType.TEMPERATURE, CardRenderItemType.OXYGEN, CardRenderItemType.OCEANS, CardRenderItemType.GREENERY]);
      expect(isICardRenderItem(result[0]) && result[0].type === CardRenderItemType.RESOURCE && result[0].resource === CardResource.DATA, 'the result: data').is.true;
    });
  });

  describe('the enactment — data by influence onto one card', () => {
    it('pays every participant 1 data × THEIR influence through the shared picker — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      p1.playedCards.push(new Supercomputer());
      p2.playedCards.push(new BiologicalSimulations());
      endGenerationThroughParliament(game);
      const ask1 = cast(p1.getWaitingFor(), SelectCard);
      expect(ask1.resourceGainPrompt?.amount, 'the winner stepped to influence 1').eq(1);
      expect(ask1.choiceContext?.source).deep.eq(DIVERTED_SOURCE);
      expect(ask1.resourceGainPrompt?.diverted, 'the enactment is no replaced unit').is.undefined;
      p1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      const ask2 = cast(p2.getWaitingFor(), SelectCard);
      expect(ask2.resourceGainPrompt?.amount, 'a non-voter is paid by its own influence').eq(3);
      p2.process({type: 'card', cards: [CardName.BIOLOGICAL_SIMULATIONS]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(dataOn(p1)).eq(1);
      expect(dataOn(p2, CardName.BIOLOGICAL_SIMULATIONS)).eq(3);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'data')).deep.include({kind: 'cardResource', resource: CardResource.DATA, amount: 1, card: CardName.SUPERCOMPUTER, influence: 1});
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'data')).deep.include({kind: 'cardResource', amount: 3, card: CardName.BIOLOGICAL_SIMULATIONS, influence: 3});
      expect(parliament.enacted).eq(DIVERTED);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
    });

    it('two named zeros: influence 0 asks nothing; influence without a holder forfeits the sum by name', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      // p1 wins (influence 1) with no data card; p2 has influence 2 and no data card either.
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'data')).deep.include({kind: 'skipped', amount: 1, reason: 'No card can hold data', influence: 1});
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'data')).deep.include({kind: 'skipped', amount: 2, reason: 'No card can hold data'});
      expect(game.gameLog.some((e) => e.message === '${0} has no card that can hold data — ${1} data from ${2} are forfeited')).is.true;
      // Influence 0 — the other zero.
      const [game2, q1, q2, parliament2] = stage();
      parliament2.agenda.set(q2.id, agendaForInfluence(0));
      q2.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game2);
      if (q1.getWaitingFor() !== undefined) {
        q1.process({type: 'card', cards: [(cast(q1.getWaitingFor(), SelectCard).cards[0] as ICard).name]});
        runAllActions(game2);
      }
      settleParliamentGates(game2);
      const o2 = parliament2.lastPhase?.outcomes?.find((o) => o.player === q2.id && o.step === 'data');
      expect(o2).deep.include({kind: 'skipped', amount: 0, reason: 'No influence', influence: 0});
      expect(dataOn(q2)).eq(0);
    });

    it('a reload INSIDE the question rebuilds the same ask with the same amount and pays once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      p1.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game);
      cast(p1.getWaitingFor(), SelectCard);
      const copy = reload(game);
      const q1 = copy.getPlayerById(p1.id) as TestPlayer;
      const ask = cast(q1.getWaitingFor(), SelectCard);
      expect(ask.resourceGainPrompt?.amount, 'the winner stepped 3 → 4 = still influence 2').eq(2);
      expect(ask.choiceContext?.source).deep.eq(DIVERTED_SOURCE);
      q1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(copy);
      settleParliamentGates(copy);
      expect(dataOn(q1)).eq(2);
    });

    it('the model carries the record to every client', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game);
      p1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(DIVERTED);
      const outcomes = getParliamentModel(game, p2)?.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.color && o.step === 'data')).deep.include({kind: 'cardResource', amount: 1, card: CardName.SUPERCOMPUTER});
    });
  });

  describe('the passive — a unit becomes data, asked once, before the ceiling', () => {
    it('a card\'s oxygen step: the scale stands, no rating, no bonus step, no planet event; the law\'s marker and journal line; the data lands on the chosen card', () => {
      const [game, p1] = enacted();
      setOxygenLevel(game, 7);
      const tr = p1.terraformRating;
      const temperature = game.getTemperature();
      p1.playCard(new Probe({global: {oxygen: 1}}));
      runAllActions(game);
      expect(game.getOxygenLevel(), 'the scale stands').eq(7);
      expect(game.getTemperature(), 'the 8 % bonus step is never crossed').eq(temperature);
      expect(p1.terraformRating, 'no rating').eq(tr);
      expect(planetEvents(game), 'nothing of the planet happened').deep.eq([]);
      expect(markers(game)).has.length(1);
      expect(game.gameLog.some((e) => e.message === '${0}: ${1} replaces ${2} step(s) of ${3} with ${4} data')).is.true;
      const prompt = wherePrompt(p1);
      expect(prompt.resourceGainPrompt?.amount).eq(1);
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.SUPERCOMPUTER]);
      land(p1);
      expect(dataOn(p1)).eq(1);
      // The landing is the law's own child: the marker's descendant, sourced by the law.
      const landing = game.events.events.find((e) => e.type === 'card-resource-changed');
      expect(landing?.source).deep.include({kind: 'resolution', id: DIVERTED_RESEARCH_ID});
      expect(landing?.parentId).eq(markers(game)[0].id);
    });

    it('the Asteroid standard project: 14 M€ paid, the temperature stands, 1 data', () => {
      const [game, p1] = enacted();
      setTemperature(game, -20);
      const project = new AsteroidStandardProject();
      expect(project.canAct(p1)).is.true;
      project.payAndExecute(p1, Payment.of({megacredits: 14}));
      runAllActions(game);
      expect(p1.megaCredits).eq(36);
      expect(game.getTemperature()).eq(-20);
      land(p1);
      expect(dataOn(p1)).eq(1);
    });

    it('the heat conversion: 8 heat paid, the temperature stands, 1 data — and at the maximum too (Р5: no warning, no gate)', () => {
      const [game, p1] = enacted();
      setTemperature(game, MAX_TEMPERATURE);
      const action = new ConvertHeat();
      expect(action.canAct(p1), 'the ceiling is no gate').is.true;
      expect(action.warnings.has('maxtemp'), 'and no warning').is.false;
      convertHeat(p1);
      expect(p1.heat).eq(8);
      land(p1);
      expect(dataOn(p1)).eq(1);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
    });

    it('«even if the parameter is maxed»: 14 % oxygen + «+1 oxygen» is 1 data; nine oceans + an aquifer is 1 data and Whales takes NO animal', () => {
      const [game, p1] = enacted();
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      p1.playCard(new Probe({global: {oxygen: 1}}));
      runAllActions(game);
      land(p1);
      expect(dataOn(p1)).eq(1);

      // The board is ARRANGED before the law stands (the engine's own door is the net under it).
      const [game2, q1, , parliament2] = reduxGame();
      maxOutOceans(q1, 9);
      parliament2.enacted = DIVERTED;
      q1.playedCards.push(new Supercomputer());
      q1.megaCredits = 50;
      const whales = new Whales();
      q1.playedCards.push(whales);
      const aquifer = new AquiferStandardProject();
      expect(aquifer.canAct(q1)).is.true;
      expect(aquifer.warnings.has('maxoceans')).is.false;
      aquifer.payAndExecute(q1, Payment.of({megacredits: 18}));
      runAllActions(game2);
      expect(q1.getWaitingFor(), 'no cell is asked').is.not.instanceOf(SelectSpace);
      land(q1);
      expect(dataOn(q1)).eq(1);
      expect(whales.resourceCount, 'the ocean never reached its no-ocean branch').eq(0);
      expect(game2.board.getOceanSpaces()).has.length(9);
    });

    it('PRINTED steps count (Р3): 13 % + «+2 oxygen» is 2 data', () => {
      const [game, p1] = enacted();
      setOxygenLevel(game, 13);
      p1.playCard(new Probe({global: {oxygen: 2}}));
      runAllActions(game);
      expect(wherePrompt(p1).resourceGainPrompt?.amount).eq(2);
      land(p1);
      expect(dataOn(p1)).eq(2);
      expect(game.getOxygenLevel()).eq(13);
    });

    it('a greenery is ONE data (its oxygen is part of the tile): the plant conversion spends 8 plants, seats nothing, asks no cell', () => {
      const [game, p1] = enacted();
      const oxygen = game.getOxygenLevel();
      const tr = p1.terraformRating;
      const convert = new ConvertPlants();
      expect(convert.canAct(p1)).is.true;
      const option = cast(convert.action(p1), SelectOption);
      expect(option.metadata?.card, 'the option names the standard action structurally').eq(CardName.CONVERT_PLANTS);
      p1.defer(option.cb(undefined));
      runAllActions(game);
      expect(p1.plants).eq(8);
      expect(game.getOxygenLevel()).eq(oxygen);
      expect(p1.terraformRating, 'no greenery rating either').eq(tr);
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY)).is.false;
      expect(wherePrompt(p1).resourceGainPrompt?.amount).eq(1);
      land(p1);
      expect(dataOn(p1)).eq(1);
    });

    it('a card printing «+1 O₂» AND a greenery is 2 data — one question', () => {
      const [game, p1] = enacted();
      p1.playCard(new Probe({global: {oxygen: 1}, greenery: {}}));
      runAllActions(game);
      expect(wherePrompt(p1).resourceGainPrompt?.amount).eq(2);
      land(p1);
      expect(dataOn(p1)).eq(2);
    });

    it('ONE operation — ONE question (Р4): Lake Marineris is one pick for 2, Giant Ice Asteroid one pick for 4', () => {
      const [game, p1] = enacted();
      p1.playCard(new LakeMarineris());
      runAllActions(game);
      expect(wherePrompt(p1).resourceGainPrompt?.amount).eq(2);
      land(p1);
      expect(p1.getWaitingFor(), 'no second question').is.undefined;
      expect(dataOn(p1)).eq(2);
      expect(game.board.getOceanSpaces()).has.length(0);

      const [game2, q1, q2] = enacted();
      q2.plants = 0;
      q1.playCard(new GiantIceAsteroid());
      runAllActions(game2);
      expect(wherePrompt(q1).resourceGainPrompt?.amount, 'two degrees + two oceans').eq(4);
      land(q1);
      expect(q1.getWaitingFor()).is.undefined;
      expect(dataOn(q1)).eq(4);
      expect(pendingDivertedData(q1), 'the accumulator is flushed').eq(0);
    });

    it('no holder: the loss is NAMED with its sum — the action was never blocked, nothing is seated', () => {
      const [game, p1] = enacted({holder: false});
      const action = new ConvertHeat();
      expect(action.canAct(p1), 'no gate for want of a holder').is.true;
      convertHeat(p1);
      expect(p1.getWaitingFor()).is.undefined;
      expect(p1.heat).eq(8);
      const skip = game.events.events.find((e) => e.type === 'effect-skipped');
      expect(skip?.impact.skipped).deep.include({reason: DIVERTED_NO_HOLDER_REASON});
      expect(skip?.impact.skipped?.effect).deep.include({icon: 'data', amount: 1});
      expect(skip?.parentId, 'the loss is the law\'s own child').eq(markers(game)[0].id);
      expect(game.gameLog.some((e) => e.message === '${0} has no card that can hold data — ${1} data from ${2} are lost')).is.true;
    });

    it('the fallen gates (Р5): no cell needed for a greenery, no ceiling for an asteroid — the price alone gates', () => {
      const [game, p1] = enacted();
      game.board.getAvailableSpacesForGreenery = () => [];
      expect(new ConvertPlants().canAct(p1)).is.true;
      expect(new GreeneryStandardProject().canAct(p1)).is.true;
      expect(new GreeneryStandardProject().actionUnavailableReason(p1)).is.undefined;
      setTemperature(game, MAX_TEMPERATURE);
      const asteroid = new AsteroidStandardProject();
      expect(asteroid.canAct(p1)).is.true;
      expect(asteroid.warnings.has('maxtemp')).is.false;
      p1.plants = 0;
      expect(new ConvertPlants().canAct(p1), 'the price still gates').is.false;
      p1.megaCredits = 10;
      expect(asteroid.canAct(p1)).is.false;
    });

    it('the Hellas pole: 6 M€ buy 1 data, no cell is asked, the dossier said so before the city', () => {
      const [game, p1] = enacted({board: BoardName.HELLAS});
      const pole = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.OCEAN))!;
      const dossier = boardCellPreview(p1, pole, 'city');
      const fact = [...dossier.immediateFacts, ...dossier.recipientFacts, ...dossier.warningFacts, ...dossier.ruleFacts].find((f) => f.id === 'redux-resolution-ocean-bonus');
      expect(fact, 'the law\'s own fact in the cell dossier').is.not.undefined;
      expect(fact?.delta).deep.include({icon: 'data', amount: 1});
      p1.megaCredits = 12;
      game.addCity(p1, pole);
      runAllActions(game);
      expect(p1.megaCredits, 'the bill was paid').eq(6);
      expect(p1.getWaitingFor()).is.not.instanceOf(SelectSpace);
      land(p1);
      expect(dataOn(p1)).eq(1);
      expect(game.board.getOceanSpaces()).has.length(0);
    });

    it('Europa\'s build bonus: the colony\'s ocean is 1 data', () => {
      const [game, p1] = enacted();
      const europa = new Europa();
      game.colonies.push(europa);
      europa.addColony(p1);
      runAllActions(game);
      expect(p1.getWaitingFor()).is.not.instanceOf(SelectSpace);
      land(p1);
      expect(dataOn(p1)).eq(1);
    });

    it('Icy Impactors: the CREDITED seat\'s ocean is replaced — the first player is never asked for a cell', () => {
      const [game, p1, p2] = enacted();
      (game as unknown as {first: IPlayer}).first = p2;
      const card = new IcyImpactors();
      card.resourceCount = 1;
      p1.playedCards.push(card);
      cast(card.action(p1), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(p2.getWaitingFor(), 'the chooser has nothing to choose').is.undefined;
      expect(card.resourceCount).eq(0);
      land(p1);
      expect(dataOn(p1)).eq(1);
    });

    it('Flooding: the ocean is replaced, so nobody is adjacent — no attack, no steal', () => {
      const [game, p1, p2] = enacted();
      p2.megaCredits = 10;
      p1.playCard(new Flooding());
      runAllActions(game);
      expect(p1.getWaitingFor(), 'straight to the «where»').is.instanceOf(SelectCard);
      land(p1);
      expect(p2.megaCredits).eq(10);
      expect(dataOn(p1)).eq(1);
    });

    it('Arboretum: the greenery is replaced, no city is adjacent — the card\'s own target is not asked, the law pays 1', () => {
      const [game, p1] = enacted();
      p1.playedCards.push(new BiologicalSimulations());
      const preview = cardPlayPreview(p1, new Arboretum());
      expect(preview.branches[0].steps.filter((s) => s.kind === 'boardPlacement')).is.empty;
      expect(preview.branches[0].steps.filter((s) => s.kind === 'input')).has.length(1);
      p1.playCard(new Arboretum());
      runAllActions(game);
      const prompt = wherePrompt(p1);
      expect(prompt.resourceGainPrompt?.amount).eq(1);
      land(p1);
      expect(dataOn(p1) + dataOn(p1, CardName.BIOLOGICAL_SIMULATIONS)).eq(1);
    });

    it('Ecological Experiment: the raise is replaced (3 data — a step, a step, an ocean), the fall still lowers what is not at its minimum', () => {
      const [game, p1] = enacted();
      setTemperature(game, 0);
      setOxygenLevel(game, 5);
      const tr = p1.terraformRating;
      p1.playCard(new EcologicalExperiment());
      runAllActions(game);
      // The card's own data first (3 to any card), then the law's «where» at the back of the line.
      const own = cast(p1.getWaitingFor(), SelectCard);
      expect(own.choiceContext?.source?.kind).eq('card');
      p1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      expect(wherePrompt(p1).resourceGainPrompt?.amount, 'temperature + oxygen + the ocean').eq(3);
      land(p1);
      expect(dataOn(p1)).eq(6);
      expect(game.getTemperature(), 'the fall').eq(-2);
      expect(game.getOxygenLevel()).eq(4);
      expect(p1.terraformRating, 'nothing was gained, nothing is kept').eq(tr);
    });
  });

  describe('what the law never touches', () => {
    it('the World Government\'s move, an unrewarded move, a lowering, Venus and a bare rating', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
      game.parliament!.enacted = DIVERTED;
      p1.playedCards.push(new Supercomputer());
      game.phase = Phase.SOLAR;
      game.increaseOxygenLevel(p1, 1);
      expect(game.getOxygenLevel(), 'the World Government terraforms').eq(1);
      game.phase = Phase.ACTION;
      game.increaseTemperature(p1, 1, {unrewarded: true});
      expect(game.getTemperature(), 'an unrewarded move is nobody\'s gain').eq(-28);
      game.increaseOxygenLevel(p1, -1);
      expect(game.getOxygenLevel(), 'a lowering').eq(0);
      const tr = p1.terraformRating;
      p1.playCard(new Probe({global: {venus: 1}}));
      runAllActions(game);
      expect(game.getVenusScaleLevel(), 'Venus is not named').eq(2);
      p1.playCard(new Probe({tr: 1}));
      runAllActions(game);
      expect(p1.terraformRating, 'a bare rating').eq(tr + 2);
      expect(markers(game)).deep.eq([]);
      expect(p1.getWaitingFor()).is.undefined;
    });

    it('MarsBot under an older save (`none`) is outside the aspect: its raise terraforms, the human\'s is replaced', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      game.phase = Phase.ACTION;
      game.parliament!.enacted = DIVERTED;
      human.playedCards.push(new Supercomputer());
      const botTr = bot.terraformRating;
      game.increaseOxygenLevel(bot, 1);
      expect(game.getOxygenLevel()).eq(1);
      expect(bot.terraformRating).eq(botTr + 1);
      expect(ParliamentHandler.divertsTerraforming(bot)).is.false;
      expect(ParliamentHandler.divertsTerraforming(human)).is.true;
      game.increaseOxygenLevel(human, 1);
      expect(game.getOxygenLevel()).eq(1);
      runAllActions(game);
      land(human);
      expect(dataOn(human)).eq(1);
    });

    it('the NEXT law\'s winner part: Mohole Contest after Diverted Research pays its winner the temperature and the rating', () => {
      const [game, p1, , parliament] = reduxGame();
      seatEnacted(parliament, DIVERTED);
      seatResolution(parliament, 0, MOHOLE_CONTEST_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      setTemperature(game, -20);
      const tr = p1.terraformRating;
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      expect(parliament.enacted).eq(resolutionInstanceId(MOHOLE_CONTEST_ID, 0));
      expect(game.getTemperature()).eq(-16);
      expect(p1.terraformRating).greaterThanOrEqual(tr + 2);
      expect(markers(game)).deep.eq([]);
    });
  });

  describe('MarsBot under the law (decision D13 — the `restriction` aspect, M€ instead of data)', () => {
    function bound(options: {board?: BoardName} = {}): [IGame, TestPlayer, IPlayer] {
      const [game, human, bot] = testAutomaGame({
        coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics',
        ...(options.board === undefined ? {} : {boardName: options.board}),
      });
      game.phase = Phase.ACTION;
      game.parliament!.enacted = DIVERTED;
      human.playedCards.push(new Supercomputer());
      bot.megaCredits = 0;
      resetDivertedNet();
      return [game, human, bot];
    }

    const failedActions = (game: IGame) => game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
    const raisedLines = (game: IGame) => game.gameLog.filter((m) => m.message === '${0} raised ${1} ${2} {step|steps}').length;
    const greeneries = (game: IGame) => game.board.spaces.filter((space) => space.tile?.tileType === TileType.GREENERY).length;

    it('the bot is bound — the engine\'s own door replaces its raise: no step, no rating, 1 M€ per step, the law\'s marker, no question', () => {
      const [game, human, bot] = bound();
      expect(ParliamentHandler.divertsTerraforming(bot)).is.true;
      const tr = bot.terraformRating;
      game.increaseOxygenLevel(bot, 2);
      expect(game.getOxygenLevel()).eq(0);
      expect(bot.terraformRating).eq(tr);
      expect(bot.megaCredits).eq(2);
      expect(markers(game)).length(1);
      expect(pendingDivertedData(bot), 'nothing accrues for a landing').eq(0);
      expect(planetEvents(game)).deep.eq([]);
      expect(game.gameLog.some((m) => m.message === '${0}: ${1} replaces ${2} step(s) of ${3} with ${4} M€')).is.true;
      runAllActions(game);
      expect(human.getWaitingFor(), 'nobody is asked about the bot\'s M€').is.undefined;
      expect(getParliamentModel(game, human)!.players.find((p) => p.color === bot.color)?.restriction).is.true;
    });

    it('the track raise is replaced BEFORE the ceiling — at +8 °C too: the law\'s 1 M€, no Failed Action, no «raised» line', () => {
      const [game, , bot] = bound();
      AutomaTerraformer.raiseTemperature(game);
      expect(game.getTemperature()).eq(-30);
      expect(bot.megaCredits).eq(1);
      setTemperature(game, MAX_TEMPERATURE);
      AutomaTerraformer.raiseTemperature(game);
      expect(bot.megaCredits).eq(2);
      expect(failedActions(game)).eq(0);
      expect(raisedLines(game)).eq(0);
    });

    it('the shared tile placer seats no greenery and no ocean — 1 M€ each, the placer reports the action resolved, the net is never reached', () => {
      const [game, , bot] = bound();
      expect(AutomaTilePlacer.placeGreenery(game)).is.true;
      AutomaTilePlacer.placeOcean(game);
      expect(greeneries(game)).eq(0);
      expect(game.board.getOceanSpaces()).length(0);
      expect(game.getOxygenLevel()).eq(0);
      expect(bot.megaCredits).eq(2);
      expect(divertedNetCatches()).eq(0);
      // The board's nine oceans, seated with the law away (the util loops on `addOcean` until they stand).
      game.parliament!.enacted = undefined;
      maxOutOceans(bot);
      game.parliament!.enacted = DIVERTED;
      const before = bot.megaCredits;
      AutomaTilePlacer.placeOcean(game);
      expect(bot.megaCredits, 'nine oceans and «an ocean» is the law\'s 1 M€, not a Failed Action').eq(before + 1);
      expect(failedActions(game)).eq(0);
    });

    it('the near-bonus ladder: the PRINTED two temperature steps are 2 M€; the greenery + oxygen branch is 2 M€; nothing reads «raised»', () => {
      const [game, , bot] = bound();
      setTemperature(game, -26);
      expect(pushNearestBonus(game, 'ocean')).eq('temperature');
      expect(game.getTemperature()).eq(-26);
      expect(bot.megaCredits).eq(2);
      setTemperature(game, MAX_TEMPERATURE);
      setOxygenLevel(game, 7);
      expect(pushNearestBonus(game, 'ocean')).eq('oxygen');
      expect(game.getOxygenLevel()).eq(7);
      expect(greeneries(game)).eq(0);
      expect(bot.megaCredits).eq(4);
      expect(raisedLines(game)).eq(0);
      expect(divertedNetCatches()).eq(0);
    });

    it('the Hellas South Pole buys the bot no ocean under the law — the hex is «without rewards» (6 M€ for the law\'s 1 M€)', () => {
      const [game, , bot] = bound({board: BoardName.HELLAS});
      bot.megaCredits = 10;
      expect(hellasSouthPoleUsable(game, bot)).is.false;
      game.parliament!.enacted = undefined;
      expect(hellasSouthPoleUsable(game, bot)).is.true;
    });

    it('the World Government\'s phase still terraforms for the bot', () => {
      const [game, , bot] = bound();
      game.phase = Phase.SOLAR;
      expect(ParliamentHandler.divertsTerraforming(bot)).is.false;
    });
  });

  describe('the final greenery (Р2) and the quest (Р6)', () => {
    it('the final placement under the law: the plants buy 1 data, the marker names it, no cell is asked', () => {
      const [game, p1] = enacted();
      game.phase = Phase.PRODUCTION;
      p1.plants = 8;
      p1.takeActionForFinalGreenery();
      const ask = cast(p1.getWaitingFor(), OrOptions);
      expect(ask.finalGreeneryPrompt).deep.eq({spaces: game.board.getAvailableSpacesForGreenery(p1).length, diverted: {resolution: DIVERTED_RESEARCH_ID, data: 1}});
      expect(ask.options[0]).is.instanceOf(SelectOption);
      p1.process({type: 'or', index: 0, response: {type: 'option'}});
      runAllActions(game);
      expect(p1.plants).eq(0);
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY)).is.false;
      land(p1);
      expect(dataOn(p1)).eq(1);
    });

    it('the data of the enactment never counts; the data the law diverts inside the seat\'s own action counts; the chair comes on the fourth', () => {
      const [game, p1, , parliament] = stage();
      // Agenda 5 reads as influence 3 — and the winner's step (5 → 6) still does.
      parliament.agenda.set(p1.id, agendaForInfluence(3));
      p1.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game);
      p1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(dataOn(p1)).eq(3);
      expect(parliament.quest?.source).eq(DIVERTED_RESEARCH_ID);
      expect(parliament.questProgressOf(p1), 'the enactment is the political phase\'s').eq(0);
      game.phase = Phase.ACTION;
      p1.heat = 40;
      for (let i = 1; i <= 3; i++) {
        convertHeat(p1);
        land(p1);
        expect(parliament.questProgressOf(p1), `the seat's own conversion #${i}`).eq(i);
      }
      convertHeat(p1);
      land(p1);
      expect(parliament.quest?.completedBy, 'the fourth completes the quest').eq(p1.id);
    });
  });

  describe('the net', () => {
    it('a tile that still reaches the seating door under the law is diverted there and COUNTED as a miss', () => {
      const [game, p1] = enacted();
      const cell = game.board.getAvailableSpacesForGreenery(p1)[0];
      game.addGreenery(p1, cell);
      expect(cell.tile, 'nothing is seated').is.undefined;
      expect(divertedNetCatches()).eq(1);
      runAllActions(game);
      land(p1);
      expect(dataOn(p1)).eq(1);
      resetDivertedNet();
    });
  });

  describe('the forecast twin — the exit pass on every door', () => {
    it('a card play: the printed chip STRUCK with its data, no implied rating, the «where» step addressed to the law, the law\'s fact on its channel; nothing while not enacted', () => {
      const [game, p1, , parliament] = reduxGame();
      p1.playedCards.push(new Supercomputer());
      const plain = cardPlayPreview(p1, new Probe({global: {temperature: 1}}));
      expect(plain.branches[0].effects.map((e) => e.icon)).deep.eq(['temperature', 'tr']);
      expect(plain.branches[0].effects[0].diverted).is.undefined;

      parliament.enacted = DIVERTED;
      const card = new Probe({global: {temperature: 1}});
      const preview = cardPlayPreview(p1, card);
      const chips = preview.branches[0].effects;
      expect(chips.map((e) => e.icon), 'no implied rating beside a struck scale').deep.eq(['temperature']);
      expect(chips[0].diverted).deep.eq({resolution: DIVERTED_RESEARCH_ID, data: 1});
      const where = whereStepOf(preview.branches[0].steps);
      expect(where, 'the «where» is pre-collected').is.not.undefined;
      expect(where?.kind === 'input' && where.amount).eq(1);
      expect(where?.kind === 'input' && where.for).deep.eq({role: 'card', source: DIVERTED_SOURCE});
      expect(where?.kind === 'input' && where.input.title).deep.include({message: DIVERTED_DATA_PICK_TITLE});
      const facts = allForecastFacts(effectForecastForPlay(p1, card, preview));
      const own = facts.filter((f) => f.source.kind === 'resolution' && f.source.name === DIVERTED_RESEARCH_ID);
      expect(own).has.length(1);
      expect(own[0].source.channel).eq('terraforming-diverted');
      expect(own[0].certainty).eq('exact');
      expect(own[0].effects).deep.include({direction: 'gain', icon: 'data', amount: 1, note: 'to a card'});
      expect(facts.some((f) => f.source.kind === 'party'), 'no party reacts to a step that never happens').is.false;
      expect(game.events.events.filter((e) => e.type === 'effect-triggered'), 'read-only').deep.eq([]);
    });

    it('a two-ocean card: the tile steps go, one struck ocean chip for both, one «where» for 2; Giant Ice Asteroid reads 4', () => {
      const [, p1] = enacted();
      const lake = cardPlayPreview(p1, new LakeMarineris());
      expect(lake.branches[0].steps.filter((s) => s.kind === 'boardPlacement')).is.empty;
      const ocean = lake.branches[0].effects.find((e) => e.icon === 'oceans');
      expect(ocean?.diverted).deep.eq({resolution: DIVERTED_RESEARCH_ID, data: 2});
      const lakeWhere = whereStepOf(lake.branches[0].steps);
      expect(lakeWhere?.kind === 'input' ? lakeWhere.amount : undefined).eq(2);
      const giant = cardPlayPreview(p1, new GiantIceAsteroid());
      const total = giant.branches[0].effects.reduce((sum, e) => sum + (e.diverted?.data ?? 0), 0);
      expect(total).eq(4);
    });

    it('the ceiling cuts nothing in the preview either: nine oceans and a one-ocean card still promise the struck tile', () => {
      const [, p1, , parliament] = reduxGame();
      maxOutOceans(p1, 9);
      parliament.enacted = DIVERTED;
      p1.playedCards.push(new Supercomputer());
      const preview = cardPlayPreview(p1, new Probe({ocean: {}}));
      expect(preview.branches[0].effects.find((e) => e.icon === 'oceans')?.diverted?.data).eq(1);
      expect(preview.branches[0].steps.some((s) => s.kind === 'note'), 'no «oceans maxed» warning').is.false;
    });

    it('no holder: the chips read the loss, no «where» step, the law\'s fact is a named skip', () => {
      const [, p1] = enacted({holder: false});
      const card = new Probe({global: {oxygen: 1}});
      const preview = cardPlayPreview(p1, card);
      expect(preview.branches[0].effects[0].diverted).deep.eq({resolution: DIVERTED_RESEARCH_ID, data: 1, lost: true});
      expect(whereStepOf(preview.branches[0].steps)).is.undefined;
      const own = allForecastFacts(effectForecastForPlay(p1, card, preview)).filter((f) => f.source.kind === 'resolution');
      expect(own[0].certainty).eq('skipped');
    });

    it('a blue action (Water Splitting Plant at 14 % oxygen): the step is struck, the action has value with a holder and is «no target» without', () => {
      const [game, p1] = enacted();
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      p1.energy = 3;
      const card = new WaterSplittingPlant();
      p1.playedCards.push(card);
      const preview = actionPreview(p1, card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'oxygen')?.diverted?.data).eq(1);
      expect(whereStepOf(preview.branches[0].steps)).is.not.undefined;
      expect(preview.branches[0].futile, 'a yield with a holder').is.undefined;
      expect(actionFutility(p1, card)).is.undefined;
      const [game2, q1] = enacted({holder: false});
      setOxygenLevel(game2, MAX_OXYGEN_LEVEL);
      q1.energy = 3;
      const card2 = new WaterSplittingPlant();
      q1.playedCards.push(card2);
      expect(actionFutility(q1, card2)?.verdict).deep.include({kind: 'no-target', reason: DIVERTED_NO_HOLDER_REASON});
      expect(actionPreview(q1, card2).branches[0].futile).deep.include({kind: 'no-target'});
    });

    it('the standard projects: Asteroid a struck step and a «where», Greenery ONE struck tile (no rating), Aquifer a struck ocean — no cell target', () => {
      const [, p1] = enacted();
      const asteroid = buildStandardProjectPreview(p1, new AsteroidStandardProject(), 14);
      expect(asteroid.effects.map((e) => e.icon)).deep.eq(['megacredits', 'temperature']);
      expect(asteroid.effects[1].diverted?.data).eq(1);
      expect(asteroid.steps).has.length(1);
      expect(asteroid.target).is.undefined;
      expect(asteroid.futile).is.undefined;
      const greenery = buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
      expect(greenery.effects.map((e) => e.icon)).deep.eq(['megacredits', 'greenery']);
      expect(greenery.effects[1].diverted?.data).eq(1);
      expect(greenery.target).is.undefined;
      const aquifer = buildStandardProjectPreview(p1, new AquiferStandardProject(), 18);
      expect(aquifer.effects.map((e) => e.icon)).deep.eq(['megacredits', 'oceans']);
      expect(aquifer.effects[1].diverted?.data).eq(1);
      expect(aquifer.target).is.undefined;
    });

    it('the conversions\' option readings: the struck step / tile, the «where», no «parameter maxed» at the maximum', () => {
      const [game, p1] = enacted();
      setTemperature(game, MAX_TEMPERATURE);
      const heat = heatConversionMetadata(p1, 8);
      expect(heat.effects?.map((e) => e.icon)).deep.eq(['heat', 'temperature']);
      expect(heat.effects?.[1].diverted?.data).eq(1);
      expect(heat.futile).is.undefined;
      expect(heat.steps).has.length(1);
      const plants = plantConversionMetadata(p1);
      expect(plants.card).eq(CardName.CONVERT_PLANTS);
      expect(plants.effects?.map((e) => e.icon)).deep.eq(['plants', 'greenery']);
      expect(plants.effects?.[1].diverted?.data).eq(1);
      expect(plants.steps).has.length(1);
    });

    it('is READ-ONLY: the passes serialize the game to the same bytes', () => {
      const [game, p1] = enacted();
      const before = JSON.stringify(game.serialize());
      cardPlayPreview(p1, new GiantIceAsteroid());
      buildStandardProjectPreview(p1, new GreeneryStandardProject(), 23);
      heatConversionMetadata(p1, 8);
      plantConversionMetadata(p1);
      expect(JSON.stringify(game.serialize())).eq(before);
    });

    it('the law survives a reload: the copy replaces too', () => {
      const [game, p1] = enacted();
      const copy = reload(game);
      const q1 = copy.getPlayerById(p1.id) as TestPlayer;
      expect(ParliamentHandler.divertsTerraforming(q1)).is.true;
      copy.increaseOxygenLevel(q1, 1);
      expect(copy.getOxygenLevel()).eq(0);
      runAllActions(copy);
      land(q1);
      expect(dataOn(q1)).eq(1);
    });
  });

  describe('once enacted', () => {
    it('the REDS rule, and the passive ends when another card takes the slot', () => {
      const [game, p1, , parliament] = enacted();
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      parliament.enacted = undefined;
      game.increaseOxygenLevel(p1, 1);
      expect(game.getOxygenLevel()).eq(1);
      expect(markers(game)).deep.eq([]);
    });

    it('a greenery of the ordinary board is still a greenery for a seat WITHOUT the law (nothing enacted)', () => {
      const [game, p1] = reduxGame();
      const before = game.board.getOceanSpaces().length;
      p1.playCard(new Probe({greenery: {}}));
      runAllActions(game);
      const prompt = cast(p1.getWaitingFor(), SelectSpace);
      prompt.cb(prompt.spaces[0]);
      runAllActions(game);
      expect(game.board.spaces.filter((s) => Board.isGreenerySpace(s))).has.length(1);
      expect(game.board.getOceanSpaces()).has.length(before);
    });
  });
});
