import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {IPlayer} from '../../src/server/IPlayer';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  LIVE_EXPERIMENTS, LIVE_EXPERIMENTS_AFTER_BILL_KEY, LIVE_EXPERIMENTS_BILL, LIVE_EXPERIMENTS_CODE, LIVE_EXPERIMENTS_DATA, LIVE_EXPERIMENTS_FUTILE_REASON,
  LIVE_EXPERIMENTS_ID, LIVE_EXPERIMENTS_NO_CARD_REASON, LIVE_EXPERIMENTS_QUEST_CARDS, LIVE_EXPERIMENTS_UNAFFORDABLE_KEY, liveExperimentsCandidates,
  liveExperimentsPrice, liveExperimentsReserve,
} from '../../src/server/parliament/resolutions/scientists/LiveExperiments';
import {DIVERTED_RESEARCH_ID} from '../../src/server/parliament/resolutions/reds/DivertedResearch';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {armedPlayEffectsOf} from '../../src/server/cards/armedPlayEffects';
import {requirementEasingOf} from '../../src/server/models/requirementEasing';
import {previewableCard} from '../../src/server/models/cardPlayPreview';
import {actionBillPrice} from '../../src/common/parliament/actionBill';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {BOT_QUEST_PATHS, botQuestReachable} from '../../src/common/parliament/botQuestPath';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {CardResource} from '../../src/common/CardResource';
import {RequirementType} from '../../src/common/cards/RequirementType';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {Payment} from '../../src/common/inputs/Payment';
import {Message} from '../../src/common/logs/Message';
import {EventSource} from '../../src/common/events/EventSource';
import {ResolutionActionPromptMeta} from '../../src/common/models/PlayerInputModel';
import {PlayerInput} from '../../src/server/PlayerInput';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {SelectProjectCardToPlay} from '../../src/server/inputs/SelectProjectCardToPlay';
import {ICard} from '../../src/server/cards/ICard';
import {cast} from '../../src/common/utils/utils';
import {runAllActions, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {CuttingEdgeDesign} from '../../src/server/cards/turmoilRedux/CuttingEdgeDesign';
import {Grass} from '../../src/server/cards/base/Grass';
import {AdaptedLichen} from '../../src/server/cards/base/AdaptedLichen';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {MartianMediaCenter} from '../../src/server/cards/turmoil/MartianMediaCenter';
import {SulphurEatingBacteria} from '../../src/server/cards/venusNext/SulphurEatingBacteria';
import {ThinkTank} from '../../src/server/cards/pathfinders/ThinkTank';

/**
 * LIVE EXPERIMENTS (Turmoil Redux, RX36) — the Scientists' paid action whose
 * result is a whole CARD PLAY: «When enacted: gain data equal to your
 * Influence. Action: pay 6 M€ to play a card ignoring all global parameter
 * requirements.» Chairman quest: play 2 cards with a requirement.
 *
 * What these specs pin: the enactment is Diverted Research's data step one for
 * one; the bill is declared as DATA (6, no discount, no titanium) and priced
 * by the family's one function; the gate NAMES the price and the seat's means,
 * then «no card this would let you play» read through the PROBE (the law
 * armed, the bill held back as a reserve); futility is information, never a
 * block; PAY, THEN PLAY — the bill's settlement records the use, ARMS the
 * law's serialized waiver slot and asks the card (the law's marker at stage
 * `play`, the law as its asker), the candidates read with the waiver standing;
 * the play writes `requirement-eased` with the law as its source and the
 * class's journal line, and SPENDS the slot; a reload keeps the paid waiver
 * for the next ordinary play; the pass clears it; beside an armed TR49 both
 * stand and one play spends both; MAX bounds and Venus are waived, a tag and a
 * PARTY requirement never are; Think Tank spends nothing; decision Q5 cuts the
 * law's own play from every quest, its own included; the tenth quest kind
 * counts a project card with ANY printed requirement; the promised pick IS
 * the live one; the bot holds no action.
 */
const LIVE = resolutionInstanceId(LIVE_EXPERIMENTS_ID, 0);
const LIVE_SOURCE = {kind: 'resolution', resolution: LIVE_EXPERIMENTS_ID};

function reduxGame(options: {venus?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: options.venus === true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** The card ENACTED without a sitting, the table in its action phase at −30 °C (Grass needs −16 °C), p1 with 20 M€ and Grass in hand. */
function enacted(options: {venus?: boolean} = {}): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame(options);
  seatEnacted(parliament, LIVE);
  expect(parliament.enactedDefinition()).eq(LIVE_EXPERIMENTS);
  setTemperature(game, -30);
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  p1.cardsInHand = [new Grass()];
  return [game, p1, p2, parliament];
}

/** Seat the card in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, LIVE);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function markerOf(input: PlayerInput | undefined): ResolutionActionPromptMeta | undefined {
  return (input as {resolutionActionPrompt?: ResolutionActionPromptMeta} | undefined)?.resolutionActionPrompt;
}

/** The resolution action's option of the action menu, by its MARKER (never by its title). */
function actionOption(player: IPlayer): SelectOption | undefined {
  const option = ParliamentHandler.resolutionActionOptions(player).find((o: PlayerInput) => markerOf(o) !== undefined);
  return option === undefined ? undefined : cast(option, SelectOption);
}

/** The law's card pick, if that is what the seat is waiting for. */
function pickOf(player: IPlayer): SelectProjectCardToPlay | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectProjectCardToPlay && markerOf(wf)?.stage === 'play' ? wf : undefined;
}

function textOf(reason: string | Message): {key: string, params: Array<string>} {
  if (typeof reason === 'string') {
    return {key: reason, params: []};
  }
  return {key: reason.message, params: reason.data.map((d) => String(d.value))};
}

/** Answer the menu option, settle the (M€-only) bill and stand on the card pick. */
function payForPlay(game: IGame, player: TestPlayer): SelectProjectCardToPlay {
  actionOption(player)!.process({type: 'option'});
  runAllActions(game);
  const pick = pickOf(player);
  expect(pick, 'the law\'s card pick stands').is.not.undefined;
  return pick!;
}

function playThrough(player: TestPlayer, card: CardName, megacredits: number): void {
  player.process({type: 'projectCard', card, payment: Payment.of({megacredits})});
  runAllActions(player.game);
}

/** Run `f` as one of `player`'s own card plays. */
function asOwnPlay(player: IPlayer, f: () => void, source: EventSource = {kind: 'card', card: CardName.GRASS, owner: player.color}): void {
  const events = player.game.events;
  events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    events.endScope();
  }
}

function dataOn(player: IPlayer, name: CardName = CardName.SUPERCOMPUTER): number {
  return player.tableau.get(name)?.resourceCount ?? 0;
}

describe('LiveExperiments', () => {
  describe('the catalog entry', () => {
    it('is RX36 of the Scientists — one copy, no compatibility, data by influence, an action WITH A BILL, the cards-with-a-requirement quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(LIVE_EXPERIMENTS_ID)).eq(LIVE_EXPERIMENTS);
      expect(LIVE_EXPERIMENTS_CODE).eq('RX36');
      expect(LIVE_EXPERIMENTS_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX36')).eq(LIVE_EXPERIMENTS);
      expect(LIVE_EXPERIMENTS.party).eq(PartyName.SCIENTISTS);
      expect(LIVE_EXPERIMENTS.compatibility).is.undefined;
      expect(LIVE_EXPERIMENTS.scaled).deep.eq([LIVE_EXPERIMENTS_DATA]);
      expect(LIVE_EXPERIMENTS.immediateSteps?.map((s) => s.key)).deep.eq(['data']);
      expect(LIVE_EXPERIMENTS.winnerSteps).is.undefined;
      expect(LIVE_EXPERIMENTS.winnerReward).is.undefined;
      expect(LIVE_EXPERIMENTS.worldSteps).is.undefined;
      expect(LIVE_EXPERIMENTS.passive).is.undefined;
      expect(LIVE_EXPERIMENTS.action).is.not.undefined;
      expect(LIVE_EXPERIMENTS.actionBill, 'declared as DATA — 6 at every influence, honestly').deep.eq({amount: 6, discountPerInfluence: 0, titanium: false});
      expect(LIVE_EXPERIMENTS.text.name).eq('Live Experiments');
      expect(LIVE_EXPERIMENTS.text.action).eq('Pay 6 M€ to play a card from your hand ignoring all its global parameter requirements.');
      expect(LIVE_EXPERIMENTS.quest).deep.eq({goal: {kind: 'cardsWithRequirement'}, count: LIVE_EXPERIMENTS_QUEST_CARDS});
      expect(LIVE_EXPERIMENTS.text.quest).eq('Play 2 cards with a requirement');
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === LIVE), 'one physical copy').has.length(1);
      expect(familyOf(LIVE_EXPERIMENTS)).eq('influence');
    });

    it('the face prints «[data] / [influence]», then «6 M€ → [GLOBAL REQS. struck]*»', () => {
      const face = JSON.stringify(LIVE_EXPERIMENTS.renderData);
      expect(face).to.contain(`"type":"${CardRenderItemType.RESOURCE}"`);
      expect(face).to.contain(`"resource":"${CardResource.DATA}"`);
      expect(face).to.contain(`"type":"${CardRenderItemType.INFLUENCE}"`);
      expect(face).to.contain(`"type":"${CardRenderItemType.MEGACREDITS}"`);
      expect(face).to.contain('"amount":6');
      expect(face, 'upstream\'s printed glyph — the one TR49 and Ecology Experts print').to.contain(`"type":"${CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS}"`);
    });

    it('the quest footnote draws the REQUIREMENT PLATE with a digit — never the party plate, one figure', () => {
      const foot = questRenderData(LIVE_EXPERIMENTS.quest);
      const json = JSON.stringify(foot);
      expect(json).to.contain(`"type":"${CardRenderItemType.REQUIREMENT_PLATE}"`);
      expect(json).to.contain('"amount":2');
      expect(json).to.contain('"showDigit":true');
      expect(json).to.not.contain(`"type":"${CardRenderItemType.PARTY_REQUIREMENT}"`);
      expect(foot.rows[0].filter((n) => n !== undefined && typeof n !== 'string'), 'ONE figure').has.length(1);
    });

    it('the price is ONE function over the declared bill: 6 at every influence', () => {
      for (const influence of [0, 1, 3, 6]) {
        expect(actionBillPrice(LIVE_EXPERIMENTS_BILL, influence)).deep.eq({printed: 6, influence, discount: 0, price: 6});
      }
      const [, p1] = enacted();
      expect(liveExperimentsPrice(p1).price).eq(6);
    });
  });

  describe('the enactment — data by influence onto one card (Diverted Research\'s step)', () => {
    it('pays every participant 1 data × THEIR influence through the shared picker, the law as its asker', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      p1.playedCards.push(new Supercomputer());
      p2.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game);
      const ask1 = cast(p1.getWaitingFor(), SelectCard);
      expect(ask1.resourceGainPrompt?.amount, 'the winner stepped to influence 1').eq(1);
      expect(ask1.choiceContext?.source).deep.eq(LIVE_SOURCE);
      p1.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      const ask2 = cast(p2.getWaitingFor(), SelectCard);
      expect(ask2.resourceGainPrompt?.amount, 'a non-voter by its own influence').eq(3);
      p2.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(dataOn(p1)).eq(1);
      expect(dataOn(p2)).eq(3);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'data')).deep.include({kind: 'cardResource', resource: CardResource.DATA, amount: 1, card: CardName.SUPERCOMPUTER, influence: 1});
      expect(parliament.enacted).eq(LIVE);
      expect(parliament.rulingParty()).eq(PartyName.SCIENTISTS);
    });

    it('two named zeros: influence without a holder forfeits the sum by name; influence 0 asks nothing', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'data')).deep.include({kind: 'skipped', amount: 1, reason: 'No card can hold data'});
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'data')).deep.include({kind: 'skipped', amount: 2, reason: 'No card can hold data'});
      const [game2, q1, q2, parliament2] = stage();
      parliament2.agenda.set(q2.id, agendaForInfluence(0));
      q2.playedCards.push(new Supercomputer());
      endGenerationThroughParliament(game2);
      if (q1.getWaitingFor() !== undefined) {
        q1.process({type: 'card', cards: [(cast(q1.getWaitingFor(), SelectCard).cards[0] as ICard).name]});
        runAllActions(game2);
      }
      settleParliamentGates(game2);
      expect(parliament2.lastPhase?.outcomes?.find((o) => o.player === q2.id && o.step === 'data')).deep.include({kind: 'skipped', amount: 0, reason: 'No influence'});
    });
  });

  describe('the gate — a reason, never hidden', () => {
    it('5 M€: not offered, and the model NAMES the price and what the seat can pay', () => {
      const [game, p1] = enacted();
      p1.megaCredits = 5;
      expect(actionOption(p1)).is.undefined;
      const model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({resolution: LIVE_EXPERIMENTS_ID, party: PartyName.SCIENTISTS, hasAccess: true, usesLeft: 1, available: false});
      expect(textOf(model.reason)).deep.eq({key: LIVE_EXPERIMENTS_UNAFFORDABLE_KEY, params: ['6', '5']});
      expect(model.play, 'no promise while the action is refused').is.undefined;
    });

    it('6 M€ and a hand the waiver cannot open (a TAG requirement): «no card this would let you play»', () => {
      const [game, p1] = enacted();
      p1.megaCredits = 6;
      p1.cardsInHand = [new GeneRepair()];
      expect(actionOption(p1)).is.undefined;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction!.reason).eq(LIVE_EXPERIMENTS_NO_CARD_REASON);
    });

    it('the bill is held back as a RESERVE: Grass (11) at 16 M€ is out (16 − 6 < 11), at 17 M€ it is in — and the law is what opens it', () => {
      const [game, p1] = enacted();
      p1.megaCredits = 16;
      expect(actionOption(p1), '16 − 6 < 11').is.undefined;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction!.reason).eq(LIVE_EXPERIMENTS_NO_CARD_REASON);
      p1.megaCredits = 17;
      expect(actionOption(p1)).is.not.undefined;
      expect(liveExperimentsCandidates(p1).map((c) => [c.card.name, c.opened])).deep.eq([[CardName.GRASS, true]]);
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction!.futile, 'the law opens Grass').is.undefined;
    });

    it('the reserve reads the M€ first, then Helion\'s heat — never a pocket the bill cannot take', () => {
      const [, p1] = enacted();
      p1.megaCredits = 4;
      p1.heat = 10;
      expect(liveExperimentsReserve(p1, 6)).deep.eq({megacredits: 4});
      p1.canUseHeatAsMegaCredits = true;
      expect(liveExperimentsReserve(p1, 6)).deep.eq({megacredits: 4, heat: 2});
    });

    it('everything playable anyway: AVAILABLE, with the futility verdict (information, never a block)', () => {
      const [game, p1] = enacted();
      setTemperature(game, 4);
      p1.cardsInHand = [new Grass(), new AdaptedLichen()];
      expect(actionOption(p1), 'still offered').is.not.undefined;
      const model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model.available).is.true;
      expect(model.futile).deep.eq({kind: 'zero-yield', reason: LIVE_EXPERIMENTS_FUTILE_REASON});
    });

    it('the gate is READ-ONLY: the probe restores everything (the save before = the save after)', () => {
      const [game, p1] = enacted();
      const before = JSON.stringify(game.serialize());
      LIVE_EXPERIMENTS.action!.canAct(p1);
      LIVE_EXPERIMENTS.action!.futility!(p1);
      LIVE_EXPERIMENTS.action!.playModel!(p1);
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(p1.temporaryGlobalRequirementWaiver).is.undefined;
      expect(p1.canPlay(new Grass()), 'the live hand reads the live state again').is.false;
    });

    it('the preview: the price against the rail with the card it buys as its note; without a seat the printed 6', () => {
      const [, p1] = enacted();
      expect(LIVE_EXPERIMENTS.action!.preview(p1)).deep.eq([
        {direction: 'cost', icon: 'megacredits', amount: 6, note: 'then play a card ignoring global requirements', current: 20, resulting: 14},
      ]);
      expect(LIVE_EXPERIMENTS.action!.preview()).deep.eq([{direction: 'cost', icon: 'megacredits', amount: 6, note: 'then play a card ignoring global requirements'}]);
    });
  });

  describe('PAY, THEN PLAY — the chain', () => {
    it('the option carries the marker, the price chips and the law as its asker', () => {
      const [, p1] = enacted();
      const option = actionOption(p1)!;
      expect(option.resolutionActionPrompt).deep.eq({resolution: LIVE_EXPERIMENTS_ID, party: PartyName.SCIENTISTS, stage: 'choose', usesLeft: 1, usesPerGeneration: 1});
      expect(option.buttonLabel).eq('Play card');
      expect(option.choiceContext?.source).deep.eq(LIVE_SOURCE);
      expect(option.metadata).deep.include({kind: 'generic', icon: 'megacredits', amount: 6});
      expect(textOf(option.title)).deep.eq({key: 'Pay ${0} M€ to play a card ignoring global requirements (Live Experiments)', params: ['6']});
    });

    it('the bill (M€ only — no prompt) records the use, ARMS the law\'s waiver and asks the card: Grass in, the party card out', () => {
      const [game, p1, , parliament] = enacted();
      p1.cardsInHand = [new Grass(), new AdaptedLichen(), new MartianMediaCenter()];
      const pick = payForPlay(game, p1);
      expect(p1.megaCredits, 'the 6 are paid').eq(14);
      expect(parliament.resolutionActionUsesLeft(p1), 'the use is recorded at the bill').eq(0);
      expect(p1.armedLawWaiver).eq(LIVE_EXPERIMENTS_ID);
      expect(armedPlayEffectsOf(p1)).deep.eq([{source: {resolution: LIVE_EXPERIMENTS_ID}, sourceType: 'resolution', effect: {kind: 'requirementWaiver'}, expires: 'next-play'}]);
      expect(pick.resolutionActionPrompt?.stage).eq('play');
      expect(pick.choiceContext?.source, 'the pick\'s ADDRESS is the law').deep.eq(LIVE_SOURCE);
      expect(pick.toModel(p1).resolutionActionPrompt?.stage, 'the marker rides the input\'s own model').eq('play');
      const names = pick.cards.map((c) => c.name);
      expect(names).to.include(CardName.GRASS);
      expect(names).to.include(CardName.ADAPTED_LICHEN);
      expect(names, 'a PARTY requirement is never waived').to.not.include(CardName.MARTIAN_MEDIA_CENTER);
      expect(game.gameLog.some((e) => e.message === '${0} paid ${1} M€ to ${2}: the next card played ignores its global requirements')).is.true;
    });

    it('the play: the requirement is WAIVED, `requirement-eased` names the LAW, the class\'s journal line, the waiver SPENT', () => {
      const [game, p1] = enacted();
      payForPlay(game, p1);
      playThrough(p1, CardName.GRASS, 11);
      expect(p1.playedCards.has(CardName.GRASS)).is.true;
      expect(p1.megaCredits, '20 − 6 − 11').eq(3);
      expect(p1.armedLawWaiver, 'spent by the play').is.undefined;
      expect(armedPlayEffectsOf(p1)).deep.eq([]);
      const eased = game.events.events.find((e) => e.type === 'requirement-eased');
      expect(eased?.source).deep.eq({kind: 'resolution', id: LIVE_EXPERIMENTS_ID, owner: p1.color});
      expect(eased?.target).deep.eq({card: CardName.GRASS});
      expect(game.gameLog.some((e) => e.message === '${0} ignored the global requirements of ${1} thanks to ${2}')).is.true;
    });

    it('MAX bounds and Venus are waived (Arctic Algae at +4 °C, Sulphur-Eating Bacteria at 0 % Venus)', () => {
      const [game, p1] = enacted({venus: true});
      setTemperature(game, 4);
      setVenusScaleLevel(game, 0);
      p1.megaCredits = 40;
      p1.cardsInHand = [new ArcticAlgae(), new SulphurEatingBacteria()];
      expect(p1.canPlay(new ArcticAlgae())).is.false;
      const candidates = liveExperimentsCandidates(p1).map((c) => c.card.name);
      expect(candidates).to.have.members([CardName.ARCTIC_ALGAE, CardName.SULPHUR_EATING_BACTERIA]);
      const pick = payForPlay(game, p1);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.ARCTIC_ALGAE, CardName.SULPHUR_EATING_BACTERIA]);
      playThrough(p1, CardName.ARCTIC_ALGAE, 12);
      expect(p1.playedCards.has(CardName.ARCTIC_ALGAE)).is.true;
    });

    it('Think Tank spends NOTHING on a waived requirement', () => {
      const [game, p1] = enacted();
      const thinkTank = new ThinkTank();
      thinkTank.resourceCount = 10;
      p1.playedCards.push(thinkTank);
      payForPlay(game, p1);
      const grass = p1.cardsInHand.find((c) => c.name === CardName.GRASS)!;
      expect(p1.canPlay(grass)).is.true;
      expect(grass.additionalProjectCosts).is.undefined;
      playThrough(p1, CardName.GRASS, 11);
      expect(thinkTank.resourceCount).eq(10);
    });

    it('a RELOAD between the bill and the pick: the waiver is in the save, paid = owed — the next ordinary play spends it', () => {
      const [game, p1] = enacted();
      payForPlay(game, p1);
      const copy = reload(game);
      const q1 = copy.getPlayerById(p1.id) as TestPlayer;
      expect(q1.armedLawWaiver).eq(LIVE_EXPERIMENTS_ID);
      expect(q1.megaCredits).eq(14);
      const grass = q1.cardsInHand.find((c) => c.name === CardName.GRASS)!;
      expect(q1.canPlay(grass), 'the armed waiver lets Grass through').is.true;
      q1.playCard(grass, Payment.of({megacredits: 11}));
      runAllActions(copy);
      expect(q1.armedLawWaiver).is.undefined;
      expect(copy.events.events.find((e) => e.type === 'requirement-eased')?.source).deep.include({kind: 'resolution', id: LIVE_EXPERIMENTS_ID});
    });

    it('the PASS loses an unspent waiver', () => {
      const [game, p1] = enacted();
      payForPlay(game, p1);
      p1.popWaitingFor();
      p1.pass();
      expect(p1.armedLawWaiver).is.undefined;
      expect(armedPlayEffectsOf(p1)).deep.eq([]);
    });

    it('beside an armed TR49: TWO armed slots, both shown — ONE play spends both', () => {
      const [game, p1] = enacted();
      p1.megaCredits = 40;
      const ced = new CuttingEdgeDesign();
      p1.cardsInHand.push(ced);
      p1.playCard(ced, Payment.of({megacredits: 2}));
      runAllActions(game);
      expect(armedPlayEffectsOf(p1).map((a) => a.source)).deep.eq([CardName.CUTTING_EDGE_DESIGN]);
      payForPlay(game, p1);
      expect(armedPlayEffectsOf(p1).map((a) => a.source)).deep.eq([CardName.CUTTING_EDGE_DESIGN, {resolution: LIVE_EXPERIMENTS_ID}]);
      expect(requirementEasingOf(p1, new Grass())[0].sources[0].source, 'the paid law is named').deep.include({kind: 'resolution', id: LIVE_EXPERIMENTS_ID});
      playThrough(p1, CardName.GRASS, 11);
      expect(armedPlayEffectsOf(p1), 'both spent').deep.eq([]);
    });
  });

  describe('the promise — the pick the console pre-collects IS the live one', () => {
    it('the model lists every hand card: the law\'s candidates enabled (eased by the LAW, decisive), the rest refused with a reason', () => {
      const [game, p1] = enacted();
      p1.cardsInHand = [new Grass(), new AdaptedLichen(), new MartianMediaCenter()];
      const play = getParliamentModel(game, p1)!.viewer!.resolutionAction!.play!;
      expect(play.reserve).eq(6);
      expect(play.billAsks).is.false;
      expect(play.input.type).eq('projectCard');
      const grass = play.input.cards.find((c) => c.name === CardName.GRASS)!;
      expect(grass.isDisabled).is.undefined;
      expect(grass.requirementEasing?.[0]).deep.include({effective: 'waived', decisive: true});
      expect(grass.requirementEasing?.[0].sources[0].source).deep.include({kind: 'resolution', id: LIVE_EXPERIMENTS_ID});
      const lichen = play.input.cards.find((c) => c.name === CardName.ADAPTED_LICHEN)!;
      expect(lichen.isDisabled).is.undefined;
      const media = play.input.cards.find((c) => c.name === CardName.MARTIAN_MEDIA_CENTER)!;
      expect(media.isDisabled, 'a party requirement stays refused').is.true;
      expect(media.unplayableReasons?.length, 'with its own reason').greaterThan(0);
      // The promise against the live pick: the same set of cards.
      const promised = play.input.cards.filter((c) => c.isDisabled !== true).map((c) => c.name);
      const pick = payForPlay(game, p1);
      expect(pick.cards.map((c) => c.name)).to.have.members(promised);
    });

    it('a card only the bill\'s reserve refuses is named so («not enough M€ after the 6»)', () => {
      const [game, p1] = enacted();
      setTemperature(game, 4);
      p1.megaCredits = 16;
      p1.cardsInHand = [new Grass(), new AdaptedLichen()];
      const play = getParliamentModel(game, p1)!.viewer!.resolutionAction!.play!;
      const grass = play.input.cards.find((c) => c.name === CardName.GRASS)!;
      expect(grass.isDisabled, '16 − 6 < 11 (Adapted Lichen, 9, keeps the action open)').is.true;
      expect(textOf(grass.disabledReason as string | Message)).deep.eq({key: LIVE_EXPERIMENTS_AFTER_BILL_KEY, params: ['6']});
    });

    it('the bill ASKS (Helion\'s heat) → nothing is promised as pre-collectable; the live road raises the bill first', () => {
      const [game, p1] = enacted();
      p1.canUseHeatAsMegaCredits = true;
      p1.heat = 5;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction!.play!.billAsks).is.true;
      actionOption(p1)!.process({type: 'option'});
      runAllActions(game);
      const bill = p1.getWaitingFor();
      expect(bill).instanceOf(SelectPayment);
      expect(markerOf(bill)?.stage).eq('pay');
    });

    it('the PROBE lends a candidate\'s play preview — only for the enacted law named, only while its action is the seat\'s', () => {
      const [game, p1, , parliament] = enacted();
      expect(previewableCard(p1, CardName.GRASS), 'Grass is unplayable as any play').is.undefined;
      const probe = ParliamentHandler.resolutionPlayProbe(p1, LIVE_EXPERIMENTS_ID)!;
      expect(probe).is.not.undefined;
      expect(probe(() => previewableCard(p1, CardName.GRASS)?.name)).eq(CardName.GRASS);
      expect(p1.temporaryGlobalRequirementWaiver).is.undefined;
      expect(ParliamentHandler.resolutionPlayProbe(p1, DIVERTED_RESEARCH_ID), 'another law').is.undefined;
      parliament.recordResolutionActionUse(p1);
      expect(ParliamentHandler.resolutionPlayProbe(p1, LIVE_EXPERIMENTS_ID), 'the use is spent').is.undefined;
      void game;
    });
  });

  describe('the quest — the tenth kind, and decision Q5', () => {
    function withQuest(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = enacted();
      parliament.quest = {definition: LIVE_EXPERIMENTS.quest, source: LIVE_EXPERIMENTS_ID, generation: game.generation, progress: new Map()};
      return [game, p1, p2, parliament];
    }

    it('the goal: a PROJECT card printing ANY requirement — not one without, not a corporation or a prelude', () => {
      const goal = {kind: 'cardsWithRequirement'} as const;
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.ACTIVE, requirements: [RequirementType.TEMPERATURE]})).eq(1);
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED, requirements: [RequirementType.TAG]})).eq(1);
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.EVENT, requirements: [RequirementType.PARTY]})).eq(1);
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED, requirements: []})).eq(0);
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.CORPORATION, requirements: [RequirementType.TAG]})).eq(0);
      expect(QuestTracker.match(goal, {kind: 'cardsPlayed', cardType: CardType.PRELUDE, requirements: [RequirementType.TAG]})).eq(0);
      expect(QuestTracker.match(goal, {kind: 'trade'})).eq(0);
      expect(QuestTracker.requirementTypesOf(new Grass())).deep.eq([RequirementType.TEMPERATURE]);
      expect(QuestTracker.requirementTypesOf(new AdaptedLichen())).deep.eq([]);
      expect(QuestTracker.requirementTypesOf(new MartianMediaCenter())).deep.eq([RequirementType.PARTY]);
    });

    it('Q5: Grass played THROUGH the law counts 0 — its own quest included', () => {
      const [game, p1, , parliament] = withQuest();
      payForPlay(game, p1);
      playThrough(p1, CardName.GRASS, 11);
      expect(parliament.questProgressOf(p1)).eq(0);
    });

    it('an ordinary play counts: Grass at −16 °C → 1; Adapted Lichen (no requirement) → nothing more', () => {
      const [game, p1, , parliament] = withQuest();
      setTemperature(game, -16);
      const grass = p1.cardsInHand[0];
      asOwnPlay(p1, () => p1.playCard(grass, Payment.of({megacredits: 11})));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      const lichen = new AdaptedLichen();
      p1.cardsInHand.push(lichen);
      asOwnPlay(p1, () => p1.playCard(lichen, Payment.of({megacredits: 9})), {kind: 'card', card: CardName.ADAPTED_LICHEN, owner: p1.color});
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
    });

    it('the bot can reach it — its real project cards print requirements (the same report)', () => {
      expect(BOT_QUEST_PATHS.cardsWithRequirement).eq('adapter');
      expect(botQuestReachable({kind: 'cardsWithRequirement'}, {productions: [], cardResources: [], specialTiles: false})).is.true;
    });
  });

  describe('MarsBot', () => {
    it('holds no action of the law (outside the enactment aspect)', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      seatEnacted(game.parliament!, LIVE);
      game.phase = Phase.ACTION;
      expect(ParliamentHandler.resolutionActionOptions(bot)).deep.eq([]);
    });
  });
});
